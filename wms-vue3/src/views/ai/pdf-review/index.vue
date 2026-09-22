<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import Topbar from './components/Topbar.vue';
import Stepper from './components/Stepper.vue';
import Modal from './components/Modal.vue';
import Toast from './components/Toast.vue';
import UploadView from './UploadView.vue';
import ProcessView from './ProcessView.vue';
import ReviewView from './ReviewView.vue';
import ResultView from './ResultView.vue';

// 组件名：keep-alive include 按名匹配（嵌入 WMS 主布局时由
// ProductDocSplit 薄壳包一层，本组件自身不进缓存名单，仅薄壳进）。
// 独立全屏路由 /ai/pdf_review 直接用本组件，无缓存需求。
defineOptions({ name: 'PdfReviewWorkbench' });

// 嵌入模式：被 WMS 主布局内的 ProductDocSplit 薄壳承载时置 true。
// 影响：①根容器不再撑 100vh（改由薄壳定高）；
//      ②Topbar/Stepper 隐藏（页面标题、步骤指示由 WMS 标签页与薄壳承担，避免重复）；
//      ③Toast/裁剪弹窗/图片预览从 fixed（相对浏览器视口）降级为 absolute
//        （相对本组件根容器），避免弹层盖住 WMS 顶栏与侧边栏。
const props = defineProps({
  embedded: { type: Boolean, default: false }
});

// ── 后端 API ──
const API = {
  upload: '/api/v1/files/upload/pdf',
  start: '/api/v1/pdf-workflow/start',
  review: '/api/v1/plugin/pdf/jobs/{job_id}/review',
  reply: '/api/v1/pdf-workflow/resume',
  // 方案 D：流实例（{id}/events 轮询、DELETE 取消排队）
  stream: '/api/v1/pdf-stream'
};
// 云端部署的后端（工作流云函数在此建任务，本地 8001 查不到其任务快照）。
// 地址由 .env 的 VITE_PDF_API_BASE 注入：生产配置云端地址保留兜底能力；
// 调试环境留空 = 仅走本地（同源 vite 代理 → 127.0.0.1:8001），不接线上。
const CLOUD_API_BASE = String(import.meta.env.VITE_PDF_API_BASE || '').trim().replace(/\/+$/, '');
// 允许作为任务实例源（粘性寻址）的 origin：同源 + 配置的云端（未配置云端时仅同源）。
// 未配置云端时任务数据携带的云端图片 URL 一律不采纳，避免调试请求被带上线。
function allowedBase(origin) {
  return !origin || origin === location.origin || (!!CLOUD_API_BASE && origin === CLOUD_API_BASE);
}
// 审核数据源粘性寻址：任务建在哪个实例由审核数据里的图片 URL 源决定
// （interrupt 载荷中的 preview_url 指向任务实例），命中后固定使用该源，
// 避免每次请求都盲试本地/云端读到不一致的快照
const reviewBase = ref('');

function originOf(url) {
  try {
    // data:/blob: 等不透明 URL 的 origin 是字面量 "null"，不能当任务实例源
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.origin : '';
  } catch { return ''; }
}
// 从审核数据携带的图片 URL 推导任务实例（仅在尚未确定时采纳；须为允许的源）
function adoptReviewBase(url) {
  if (reviewBase.value) return;
  const origin = originOf(url);
  if (origin && allowedBase(origin)) reviewBase.value = origin;
}
// 快照接口候选源：粘性源优先，本地同源次之，云端兜底
function reviewBases() {
  return [reviewBase.value, '', CLOUD_API_BASE].filter((v, i, a) => a.indexOf(v) === i);
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem('token') || '';
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

// ── 全局状态 ──
const phase = ref('upload');                 // upload / processing / review / completed
const statusMode = ref('waiting');           // waiting / busy / waiting-review / done / error
const statusText = ref('等待上传');
const file = ref(null);
const pdfUrl = ref('');
const pdfName = ref('');
const jobId = ref('');
const eventId = ref('');
const message = ref('正在准备工作流…');
const batches = ref([]);
const batchIndex = ref(0);
const decisions = ref({});
const toast = ref('');
const toastError = ref(false);
// 重裁画布交互状态：zoom 滚轮聚焦放大（1..8）、fitW 为 100% 时的图片宽度（px）、
// drag 当前手势（draw 框外新画 / move 框内平移 / resize 拖边角拉伸）、grab 平移抓取偏移、
// base 拉伸起始框、handle 拉伸命中的边/角、hover 无手势时的悬停反馈、
// mode 编辑框来源：''=仅展示原区域 / 'current'=直抓原区域原位编辑 / 'drawn'=重新框选的新框
const CROP_ZOOM_MAX = 8;
function blankCrop() {
  return { open: false, index: -1, box: null, start: null, zoom: 1, fitW: 0, drag: null, grab: null, base: null, handle: '', hover: '', mode: '' };
}
const crop = ref(blankCrop());
const cropStage = ref(null);
const cropImage = ref(null);
const result = ref({});
const activity = ref([]);
const retryCount = ref(0);
// 本次重试是否复用 job_id 续跑（C：决定提示文案是否承诺“进度保留”）
const retryResumed = ref(false);
const submitting = ref(false);
// 审核方式：manual = 人工逐张确认（默认）；auto_approve = 工作流自动通过全部候选
const reviewMode = ref('manual');
// 中途转自动审核：置位后本批剩余候选与后续所有中断批次都不再人工确认
const autoRest = ref(false);
// 审核超时自动提交：工作流 resume 的等待窗口有限，批次展示后 60s 仍未提交则
// 未决项自动通过并提交——否则 Coze 侧中断超时会掐断本次运行，而后导出 xlsx
// 的前置条件是工作流完整跑完一次（建表发生在 End 之前）
// 默认 60s；URL ?reviewAutoSeconds= 可覆盖（5~600s，联调/自检加速用）
const REVIEW_AUTO_SUBMIT_SECONDS = (() => {
  const v = Number(new URLSearchParams(window.location.search).get('reviewAutoSeconds'));
  return Number.isFinite(v) && v >= 5 ? Math.min(Math.round(v), 600) : 60;
})();
const reviewCountdown = ref(0);
let reviewCountdownTimer = null;
// 是否已进入过审核阶段：进入后，批次间/发布期的 processing 段仍属审核
// 阶段（W3 = 人工审核与结果发布），步骤条停在③审核、不回退到②处理
const hasEnteredReview = ref(false);
// xlsx 导出（工作台最终产物）：飞书多维表格数据表 → Excel
// state: '' 未导出 / 'exporting' 导出中 / 'ready' 可下载 / 'error' 失败
const exportState = ref({ state: '', fileName: '', downloadUrl: '', tableId: '', tableName: '', error: '' });
// 知识库导入（两步式）：① 编排路由校验落批次 ② 自带接口提交 + 投递索引
// state: '' 待导入 / 'importing' 校验中 / 'validated' 已出校验结果 / 'committing' 提交中 /
//        'committed' 已提交索引 / 'error' 失败；summary 为批次摘要（后端 batch_to_dict）
// source: 'export' 服务端产物 / 'file' 用户回传的本地修改文件（fileName 为原文件名）
function blankKbState() {
  return { state: '', importId: '', base: '', source: '', fileName: '', summary: null, errorRows: [], commitResult: null, error: '' };
}
const kbState = ref(blankKbState());
// 导出数据预览（结果页免下载检查）：展开即拉最新（重新导出后为新产物）
function blankExportPreview() {
  return { open: false, state: '', columns: [], rows: [], totalRows: 0, truncated: false, error: '' };
}
const exportPreview = ref(blankExportPreview());

// ── 任务恢复（P1）──
// 恢复会话：SSE 中断流已丢失（无 event_id），审核提交走插件 REST 直提通道
const restored = ref(false);
// 恢复会话的快照产品列表：本页只做图片审核，直提时产品全部默认通过
const snapshotProducts = ref([]);
// 发布进度（实时路径轮询 / 恢复路径前端驱动共同维护）
const publish = ref({ status: '', processed: 0, failed: 0, remaining: 0, hasMore: false, retrying: false, driving: false });
// 当前 SSE 连接与状态轮询句柄（取消/离开页面时释放）
let activeAbort = null;
let statusTimer = null;
// ── 方案 D：流轮询（stream 模式）──
// start/resume 受理返回 JSON {stream_id} 时进入轮询链路；legacy 仍走 SSE。
// 分流依据 = 响应 Content-Type（后端 PDF_STREAM_MODE 唯一事实源），
// 切换/回滚只动后端 env，前端零配置。
const streamId = ref('');
// 轮询循环令牌：每条新流/每次停止自增，旧循环在下一轮检查时自然退出
// （与 activeAbort 的 SSE 中止语义对齐，restart/恢复都会换代）
let streamPollToken = 0;
// 轮询节奏（方案 D）：首次立即拉一次，之后按「收敛斜坡 + 状态下限」取值，
// 避免排队期/长节点以固定 2s 空转把请求打满。
//   斜坡：30s→15s→10s→8s→6s→4s→2s（每轮前进一档，末档即稳定间隔）
//   下限：status=queued 时不低于 STREAM_POLL_QUEUED_MIN_MS（排队确实没有新事件）
//   有进展：本轮拉到新事件 → 斜坡立即收敛到末档，快速跟进
// 注意：以下斜坡/下限**只用于 sleep 模式**（后端不支持长轮询时）。
// 服务端支持长轮询（响应体带 max_wait）时节奏改由服务端"守候"决定，斜坡不参与
// ——见 pollStream 尾部；只有请求频率下限 STREAM_POLL_MIN_MS 仍作为兜底。
const STREAM_POLL_RAMP_MS = [30000, 15000, 10000, 8000, 6000, 4000, 2000];
// 末档（最快）= 稳定间隔；也是失败重试与"有进展"时的取值
const STREAM_POLL_MIN_MS = STREAM_POLL_RAMP_MS[STREAM_POLL_RAMP_MS.length - 1];
// 排队态下限：排队时快轮询纯属空转，抬到 10s
const STREAM_POLL_QUEUED_MIN_MS = 10000;
// 运行态入口上限：流已经在跑就不该再等 30s（斜坡的慢档只为排队期省请求）。
// 于是运行态直接从斜坡尾段起步：8s→6s→4s→2s
const STREAM_POLL_RUNNING_MAX_MS = 8000;
// 连续拉取失败容忍：单次失败静默重试，连续 3 次合成 error 事件走既有自动重试
const STREAM_POLL_MAX_FAILS = 3;
// 单条流跟进总时长上限：超过即停止轮询并提示。防 worker 故障时任务"永远 queued"
// 导致无限空转——queued 下轮询是成功的（200 + 空事件），不会触发 MAX_FAILS。
// 流与事件均已落库，用户刷新即可凭 stream_id 重新挂轮询，不丢进度。
const STREAM_POLL_MAX_DURATION_MS = 30 * 60 * 1000;
function stopStreamPolling() { streamPollToken += 1; }
// 快照源不可用的提示去重：同一任务只提示一次（每批 interrupt 都会拉快照，
// 否则每次提交批次都弹一遍同样的 toast）
let snapshotMissWarnedFor = '';

// ── 最近任务（localStorage 自记录，跨会话恢复入口）──
const RECENT_JOBS_KEY = 'pdf_review_recent_jobs';
const JOB_STATUS_HINTS = {
  ready: '处理中', processing: '处理中', merging: '处理中',
  review_pending: '待审核', publishing: '发布中', publish_partial: '部分失败',
  published: '已完成', failed: '失败', canceled: '已取消'
};
const recentJobs = ref(loadRecentJobs());

// ── 活跃任务（刷新自动接管 A）──
// 任务拿到 job_id 后持久化到 localStorage；刷新/重进页面时若仍处于跟进中
// （未到终态、未主动重置），在上传页顶部展示横幅：继续跟进 / 开始新任务。
// 不自动跳转：避免用户想开新任务时被硬拽回旧任务；点「继续跟进」复用 restoreJob。
// 解析计时锚点（epoch ms）：start() 时打点，随活跃任务持久化，刷新后计时不重置；
// 恢复任务时优先用活跃任务的 started_at，其次用最近任务的 added_at，都没有则从恢复时刻起算
const parseStartedAt = ref(0);

const ACTIVE_JOB_KEY = 'pdf_review_active_job';
// ref 先建空再赋值：loadActiveJob 内部会调 clearActiveJob（清过期记录并同步置空 ref），
// 若用 ref(loadActiveJob()) 初始化，clearActiveJob 引用未初始化的 activeJob 会报 TDZ 错
const activeJob = ref(null);
function loadActiveJob() {
  try {
    const raw = JSON.parse(localStorage.getItem(ACTIVE_JOB_KEY) || 'null');
    // job_id 与 stream_id 至少其一存在（stream 模式排队/运行早期只有 stream_id）
    if (!raw || !(raw.job_id || raw.stream_id)) return null;
    // 过期防护：与后端任务快照同寿命（12h）；超龄不再提示（仍可从最近任务手动恢复）
    if (Date.now() - Number(raw.at || 0) > 12 * 3600_000) { clearActiveJob(); return null; }
    return raw;
  } catch { return null; }
}
function saveActiveJob() {
  if (!jobId.value && !streamId.value) return;
  const name = pdfName.value || recentJobs.value.find(x => x.job_id === jobId.value)?.pdf_name || 'PDF document';
  // stream_id 随任务一起持久化：stream 模式下排队/运行早期（尚未发现 job_id）
  // 刷新后凭 stream_id 重挂轮询（since=0 全量重放，状态无损）
  const record = {
    job_id: jobId.value,
    stream_id: streamId.value || '',
    pdf_name: name,
    at: Date.now(),
    started_at: parseStartedAt.value || Date.now()
  };
  try { localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify(record)); } catch { /* 存储满等异常忽略 */ }
  // ref 与存储同步：换新任务时横幅指向新任务，旧任务终态后不再残留陈旧横幅
  activeJob.value = record;
}
function clearActiveJob() {
  try { localStorage.removeItem(ACTIVE_JOB_KEY); } catch { /* 忽略 */ }
  activeJob.value = null;
}
activeJob.value = loadActiveJob();
// 本会话已处于跟进中（非上传页）时不再展示横幅；点「开始新任务」后本会话也不再弹
const activeJobDismissed = ref(false);
const showActiveJobBanner = computed(() => phase.value === 'upload' && !!activeJob.value && !activeJobDismissed.value);
function dismissActiveJob() {
  activeJobDismissed.value = true;
}
// 横幅「继续跟进」入口：优先 job_id（两模式通用），仅 stream 模式排队/早期
// 只有 stream_id 时走流恢复（restoreStream，重放后 job_id 自动接管记录链）
// 实现见下方 restoreStream 之后（与恢复链同域）；此处仅引用声明提升安全

function loadRecentJobs() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_JOBS_KEY) || '[]');
    return Array.isArray(list) ? list.filter(x => x && x.job_id).slice(0, 20) : [];
  } catch { return []; }
}
function saveRecentJobs() {
  try { localStorage.setItem(RECENT_JOBS_KEY, JSON.stringify(recentJobs.value)); } catch { /* 存储满等异常忽略 */ }
}
function rememberJob(jobIdToRecord, hint) {
  if (!jobIdToRecord) return;
  const existing = recentJobs.value.find(x => x.job_id === jobIdToRecord);
  if (existing) {
    if (hint) existing.hint = hint;
    if (pdfName.value) existing.pdf_name = pdfName.value;
  } else {
    recentJobs.value.unshift({ job_id: jobIdToRecord, pdf_name: pdfName.value || 'PDF document', hint: hint || '处理中', added_at: Date.now() });
    recentJobs.value = recentJobs.value.slice(0, 20);
  }
  saveRecentJobs();
  // 活跃任务随最近任务同步维护：首次拿到 job_id 记录，终态（已完成/失败/取消）时清除
  const terminal = hint === '已完成' || hint === '失败' || hint === '已取消';
  if (terminal) clearActiveJob();
  else if (jobIdToRecord === jobId.value) saveActiveJob();
}
function forgetJob(jobIdToForget) {
  recentJobs.value = recentJobs.value.filter(x => x.job_id !== jobIdToForget);
  saveRecentJobs();
  // 放弃的任务不再作为可接管的活跃任务；其审核草稿一并清除
  if (activeJob.value?.job_id === jobIdToForget) clearActiveJob();
  clearReviewDraft(jobIdToForget);
}

// 解析失败自动重试上限
const MAX_PARSE_RETRY = 3;

// 重试状态（供处理页展示）
const retryInfo = computed(() => ({
  active: retryCount.value > 0,
  current: retryCount.value,
  max: MAX_PARSE_RETRY,
  resumed: retryResumed.value,
}));

const items = computed(() => batches.value[batchIndex.value]?.items || []);
const selected = computed(() => items.value.map(x => decisions.value[x.source_crop_id]).filter(Boolean));
const ready = computed(() => items.value.length > 0 && selected.value.length === items.value.length);

const canStart = computed(() => !!(file.value || pdfUrl.value));
const fileLabel = computed(() => file.value
  ? `${file.value.name} · ${(file.value.size / 1048576).toFixed(2)} MB`
  : '');
const fileName = computed(() => file.value?.name || (pdfUrl.value ? 'Remote PDF' : 'PDF document'));
const fileUrlDisplay = computed(() => pdfUrl.value || '等待 BOS 上传');

// 工作流步骤状态
const wSteps = ref([
  { key: 'w1', label: 'W1 · 页面识别与候选裁图', state: 'active' },
  { key: 'w2', label: 'W2 · 产品合并与预览生成', state: '' },
  { key: 'w3', label: 'W3 · 人工审核与结果发布', state: '' }
]);
// 单调推进步骤条：把 idx 之前全部置 done、idx 置 active、之后置空。
// 真实工作流不会回退，因此任何“进入第 idx 步”的事件都应保证前面步骤已完成，
// 避免“后面步骤进行中、前面步骤还等待”的矛盾态（旧代码中断只置 W3、不回填 W1/W2）。
function activateStep(idx) {
  wSteps.value.forEach((s, i) => {
    if (i < idx) s.state = 'done';
    else if (i === idx) s.state = 'active';
    else s.state = '';
  });
}

const productDataOutput = computed(() => pretty(result.value.product_data_json ?? result.value.products ?? []));
const imageUrlsOutput = computed(() => pretty(result.value.image_urls_json ?? result.value.image_urls ?? []));

const LABELS = {
  waiting: '等待上传',
  busy: '处理中',
  'waiting-review': '等待人工审核',
  done: '解析完成',
  error: '执行失败'
};

// ── 工具 ──
function setStatus(mode, text) {
  statusMode.value = mode;
  statusText.value = text || LABELS[mode];
}
let toastTimer = null;
function notify(v, error = false) {
  toast.value = v;
  toastError.value = error;
  // 重置定时器：连续提示时前一条的关闭回调不应提前清掉新 toast
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = ''; toastTimer = null; }, 3200);
}
function addActivity(title, detail = '') {
  // at：活动发生时刻（ProcessView 处理日志展示 HH:mm；ReviewView 只读 title/detail 不受影响）
  activity.value.unshift({ title, detail, at: Date.now() });
}
function parse(v) {
  if (v && typeof v === 'object') return v;
  try { const x = JSON.parse(v); return typeof x === 'string' ? JSON.parse(x) : x; } catch { return null; }
}
function pretty(v) {
  const x = parse(v) ?? v;
  try { return JSON.stringify(x, null, 2); } catch { return String(v); }
}

// ── 上传 ──
function choose(f) {
  if (!f) return;
  if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
    notify('请选择 PDF 文件', true);
    return;
  }
  file.value = f;
  pdfUrl.value = '';
  pdfName.value = f.name;
  setStatus('waiting', '等待上传');
  addActivity('选择文件', f.name);
}
function useUrl(u) {
  if (!/^https?:\/\//i.test(u)) { notify('请输入有效 URL', true); return; }
  file.value = null;
  pdfUrl.value = u;
  pdfName.value = u.split('/').pop()?.split('?')[0] || 'document.pdf';
  addActivity('使用 URL', u);
}
function demo() {
  phase.value = 'review';
  hasEnteredReview.value = true;
  statusMode.value = 'waiting-review';
  statusText.value = '等待人工审核';
  eventId.value = 'demo';
  batches.value = [{
    items: [
      {
        source_crop_id: 'demo-1', product_name: 'AVENTOS HF', image_type: 'structure',
        pdf_page_number: 2, description: '结构爆炸图，展示 HF 上翻门五金组件。',
        preview_url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900',
        page_preview_url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1600',
        pdf_bbox: [0.08, 0.12, 0.62, 0.58]
      },
      {
        source_crop_id: 'demo-2', product_name: 'SERVO-DRIVE', image_type: 'detail',
        pdf_page_number: 6, description: '产品细节示意图。',
        preview_url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900',
        page_preview_url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600',
        // W1 页面预览兜底 + 拆页场景（逻辑页 = 物理页右侧 75%）：
        // 演示 normalizeReviewItems 由 page_analysis_id 推导 w1_page_url 的降级形态
        w1_page_url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1400',
        source_bbox: [0.25, 0, 1, 1],
        pdf_bbox: [0.3, 0.25, 0.85, 0.75]
      }
    ]
  }];
  addActivity('加载界面示例');
}

// ── 启动 / 真实工作流 ──
async function uploadFile() {
  const f = new FormData();
  f.append('file', file.value);
  const r = await fetch(API.upload, { method: 'POST', headers: authHeaders(), body: f });
  if (!r.ok) throw new Error(r.status === 401 ? '登录状态已失效，请重新登录' : '文件上传未成功，请重试');
  const data = await r.json();
  pdfUrl.value = data.file_url;
  pdfName.value = data.file_name || pdfName.value;
  if (!pdfUrl.value) throw new Error('文件上传未成功，请重试');
}

// 启动工作流；retryJobId 非空表示失败重试（复用已有任务，pdf_url 必须为空）
async function startWorkFlow(retryJobId = '') {
  activeAbort = new AbortController();
  const r = await fetch(API.start, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
    signal: activeAbort.signal,
    body: JSON.stringify({
      // Coze 约定：job_id 复用已有任务时 pdf_url 必须传空，否则工作流入参校验报错
      pdf_url: retryJobId ? '' : (pdfUrl.value || '').trim(),
      pdf_name: pdfName.value,
      job_id: retryJobId,
      // 审核方式：上传页选择 manual/auto_approve；审核中途「转自动审核」后，
      // 后续任何 /start（含失败自动重试）都以 auto_approve 重跑，与前端 autoRest 行为一致
      review_mode: autoRest.value ? 'auto_approve' : reviewMode.value,
      token: localStorage.getItem('token') || ''
    })
  });
  if (!r.ok) {
    // 校验失败（422 等）时透出后端 detail，直接可见是哪个字段没过校验
    let msg = r.status === 401 ? '登录状态已失效，请重新登录' : `启动未成功（HTTP ${r.status}）`;
    try {
      const err = await r.json();
      const detail = Array.isArray(err.detail)
        ? err.detail.map(x => `${(x.loc || []).slice(1).join('.')}: ${x.msg}`).join('；')
        : (typeof err.detail === 'string' ? err.detail : '');
      if (detail) msg = `启动被拒绝：${detail}`;
    } catch { /* 响应体非 JSON，保留默认文案 */ }
    throw new Error(msg);
  }
  // 方案 D 分流（响应即事实源）：JSON = stream 模式受理；SSE = legacy 直连。
  // Accept 头仍为 SSE：后端 stream 分支不看 Accept，legacy 也不受影响
  if (isStreamAccepted(r)) {
    const d = await r.json();
    await followStream(d.stream_id || '');
    return;
  }
  await sse(r);
}

async function start() {
  try {
    phase.value = 'processing';
    parseStartedAt.value = Date.now();
    setStatus('busy', '正在上传');
    reviewBase.value = '';
    restored.value = false;
    // 上传页选「自动审核」：归一到 autoRest 通道——自动通过分支在工作流云端侧，
    // 若工作流仍发来中断（分支缺失/旧版本），前端按所选模式立即自动通过并提交，
    // 而不是停在人工审核页干等（wire 契约不变：/start 仍带 review_mode=auto_approve）
    autoRest.value = reviewMode.value === 'auto_approve';
    hasEnteredReview.value = false;
    snapshotProducts.value = [];
    if (file.value) await uploadFile();
    if (!pdfUrl.value) throw new Error('请选择 PDF 或填写 URL');
    setStatus('busy', '工作流处理中');
    addActivity('上传完成', file.value?.name || 'BOS URL');
    retryCount.value = 0;
    await startWorkFlow('');
  } catch (e) {
    if (e?.name === 'AbortError') return;   // 取消已自行处理页面状态
    phase.value = 'upload';
    setStatus('waiting', '等待上传');
    notify(e.message || '启动未成功，请重试', true);
  }
}

// ── 自动重试（复用 job_id 续跑）──
async function retryParse() {
  if (retryCount.value >= MAX_PARSE_RETRY) {
    phase.value = 'upload';
    setStatus('error', '解析未完成');
    notify('本次解析未能完成，请重新发起任务', true);
    return;
  }
  retryCount.value += 1;
  const reusedJobId = jobId.value;
  // SSE 在送达 job_id 前就断流、且无可用 pdf_url 时，重试只会发出双空请求体（后端 422），直接终止
  if (!reusedJobId && !(pdfUrl.value || '').trim()) {
    phase.value = 'upload';
    setStatus('error', '解析未完成');
    notify('本次解析未能完成，请重新发起任务', true);
    return;
  }
  phase.value = 'processing';
  setStatus('busy', `重试中（${retryCount.value}/${MAX_PARSE_RETRY}）`);
  retryResumed.value = !!reusedJobId;
  // C：诚实文案——只有复用 job_id 续跑时进度才保留；全新重跑不承诺保留
  message.value = reusedJobId
    ? `重试中（第 ${retryCount.value}/${MAX_PARSE_RETRY} 次），已完成的进度会保留…`
    : `重试中（第 ${retryCount.value}/${MAX_PARSE_RETRY} 次），将重新开始解析（此前进度无法续接）…`;
  addActivity(`重试中 ${retryCount.value}/${MAX_PARSE_RETRY}`, reusedJobId ? '继续处理剩余内容' : '重新发起解析');
  // 复用 job_id 续跑时保留步骤条进度；无 job_id 才回卷到 W1
  if (!reusedJobId) {
    activateStep(0);
  }
  try {
    await startWorkFlow(reusedJobId);
  } catch (e) {
    if (e?.name === 'AbortError') return;   // 用户取消，不再自动重试
    await retryParse();
  }
}

async function sse(r) {
  const rd = r.body?.getReader();
  if (!rd) throw new Error('stream unavailable');
  jobBuf = '';   // 每条流独立缓冲，避免跨任务残留
  const td = new TextDecoder();
  let b = '';
  let stop = false;
  while (!stop) {
    const x = await rd.read();
    if (x.done) break;
    b += td.decode(x.value, { stream: true });
    const a = b.split(/\n\n/);
    b = a.pop() || '';
    // 串行处理，保证 interrupt / done / error 不交错
    for (const ev of a) {
      if (!ev.trim()) continue;
      // 终态事件后中止本流，避免与重试新开的流交叉
      if (await event(ev)) { stop = true; break; }
    }
  }
  if (!stop && b.trim()) await event(b);
  try { await rd.cancel(); } catch { /* 流已关闭 */ }
}

// ── 方案 D：流轮询客户端（stream 模式的“数据源”）──
// 与 sse() 平行：同样以事件块喂给 event()，使消息/中断/完成/错误的全部
// 处理逻辑（W 步骤推进、job_id 流式捕获、审核页加载、结果页进入、
// 自动重试）零改动继承。差异只在数据获取方式：
// sse = 持连接逐块推送；pollStream = 2s 间隔按 seq 增量拉取。

// 分流判定（响应即事实源）：后端 PDF_STREAM_MODE=stream 时 start/resume
// 返回 JSON；legacy 时返回 text/event-stream。容错：JSON 后缀也接受
// （个别代理会重写 Content-Type 头）
function isStreamAccepted(r) {
  const ct = String(r.headers.get('content-type') || '').toLowerCase();
  return ct.includes('application/json') || ct.endsWith('+json');
}

// 受理后跟流：记录 stream_id（刷新续接/取消用）并启动轮询
async function followStream(sid) {
  if (!sid) throw new Error('后端未返回 stream_id，无法跟进任务');
  streamId.value = sid;
  stopStreamPolling();          // 新流：旧循环令牌作废
  saveActiveJob();              // 排队/运行早期无 job_id 也能刷新续接
  await pollStream(sid, 0);
}

async function pollStream(sid, since = 0) {
  const token = streamPollToken;
  let cursor = since;
  let fails = 0;
  let stopped = false;
  // 粘性源优先、同源/云端兑底（流与任务同实例：dispatch 建流即落库）
  const bases = [reviewBase.value, '', CLOUD_API_BASE].filter((v, i, a) => a.indexOf(v) === i);
  let queuedShown = false;
  // 轮询节奏状态：rampStep 从 -1 起步，使首次计算出的等待正好是斜坡首档（30s）；
  // pollStartedAt 供总时长上限判定
  let rampStep = -1;
  // 上一轮的状态：queued → running 的跃迁意味着 worker 刚领取任务，
  // 立即收敛到最快档（否则可能还停在 30s 档，让用户白等一轮）
  let prevStatus = '';
  const pollStartedAt = Date.now();
  // 服务端长轮询能力上限（秒）：由响应体 max_wait 自学习。老后端/未开启时不返回
  // 该字段 → 保持 0，整条链路退回客户端 sleep 轮询（与改造前逐字节一致）。
  let longPollCap = 0;
  // 自检失败（中间层吃掉 wait）后置位：本会话不再启用长轮询。
  // 必须是独立标志——否则下一轮响应里的 max_wait 会把 longPollCap 重新点亮，
  // 于是"判定→回退→再判定"来回震荡，每轮都白发一次带 wait 的请求。
  let longPollBlocked = false;
  // 下一轮请求声明的挂起秒数（0 = 普通即时轮询）
  let waitSec = 0;
  // 本轮结束到下一轮之间的等待：有进展则收敛到末档，否则斜坡前进一档；
  // 排队态再抬到下限
  function nextPollDelay(status, gotEvents) {
    rampStep = gotEvents
      ? STREAM_POLL_RAMP_MS.length - 1
      : Math.min(rampStep + 1, STREAM_POLL_RAMP_MS.length - 1);
    let ms = STREAM_POLL_RAMP_MS[rampStep];
    if (status === 'queued') {
      ms = Math.max(ms, STREAM_POLL_QUEUED_MIN_MS);   // 排队态：抬到下限
    } else {
      ms = Math.min(ms, STREAM_POLL_RUNNING_MAX_MS);  // 运行态：压到入口上限
    }
    return ms;
  }

  while (!stopped) {
    if (token !== streamPollToken) return;   // 新流/重置/离开页面：静默让位
    let d = null;
    const reqAt = Date.now();
    // 拉取（失败换源重试；全部源失败计一次 fails）
    for (const b of bases) {
      try {
        // waitSec>0 时服务端会挂起"守候"，有新事件/状态跃迁才回——请求数随"有变化
        // 的次数"走，静默期不产生空转请求，且事件一到就是近实时（不等客户端定时器）
        const url = `${b}${API.stream}/${encodeURIComponent(sid)}/events?since=${cursor}`
          + (waitSec > 0 ? `&wait=${waitSec}` : '');
        const r = await fetch(url, {
          headers: authHeaders(), signal: activeAbort?.signal
        });
        if (!r.ok) continue;
        d = await r.json();
        if (b) reviewBase.value = b;
        break;
      } catch { continue; }
    }
    if (token !== streamPollToken) return;
    const reqElapsed = Date.now() - reqAt;
    if (!d) {
      fails += 1;
      if (fails >= STREAM_POLL_MAX_FAILS) {
        // 连续失败合成 error 事件 → 走 event() 的既有自动重试链
        await event(`event: error\ndata: ${JSON.stringify({ type: 'poll_failed', message: '进度轮询连续失败，请检查网络' })}\n\n`);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, STREAM_POLL_MIN_MS));
      continue;
    }
    fails = 0;
    // 自学习长轮询能力：首轮 waitSec=0 即时返回，顺带带回服务端上限
    // （已判定 wait 不可用的会话不再重新点亮）
    if (!longPollBlocked && typeof d.max_wait === 'number' && d.max_wait > 0) longPollCap = d.max_wait;

    // 排队态：worker 未领取（K 满员时任务在此等待）；计时器已独立持续
    if (d.status === 'queued' && !queuedShown) {
      queuedShown = true;
      message.value = '排队中，前面还有任务处理中…';
      addActivity('排队等待', '解析通道繁忙，任务已进入队列');
    }
    // job_id 回填（受理响应没有时，事件里发现即接管：recent/activeJob/续跑重试）
    if (d.job_id && d.job_id !== jobId.value) {
      jobId.value = d.job_id;
      rememberJob(jobId.value);
    }

    // 增量事件 → 重建 SSE 文本块喂给现有处理器
    const gotEvents = (d.events || []).length > 0;
    for (const e of (d.events || [])) {
      const text = `event: ${e.ev}\ndata: ${JSON.stringify(e.data ?? {})}\n\n`;
      if (await event(text)) { stopped = true; break; }
      cursor = Math.max(cursor, e.seq);
    }
    if (stopped) return;

    // has_more：单页装不下（长流全量重放），立即翻页不等 2s（且不得挂起）
    if (d.has_more) { cursor = d.last_seq; waitSec = 0; continue; }

    // 流终态兜底：事件驱动未触发时（如终态事件落库失败）合成对应事件，避免轮询空转
    if (['interrupted', 'done', 'error', 'canceled'].includes(d.status)) {
      const evName = d.status === 'interrupted' ? 'interrupt' : 'done';
      const payload = d.status === 'canceled'
        ? { type: 'canceled', message: '任务已被取消' }
        : { type: 'terminal_without_event', message: `流已结束（${d.status}）但未收到对应事件` };
      await event(`event: ${d.status === 'canceled' ? 'error' : evName}\ndata: ${JSON.stringify(payload)}\n\n`);
      return;
    }

    cursor = d.last_seq;
    // 总时长上限：防 worker 故障/任务长期 queued 时无限空转（queued 下轮询是成功的，
    // 不会触发 MAX_FAILS，故必须靠时长兜底）。流与事件已落库，刷新即可重新接管。
    if (Date.now() - pollStartedAt > STREAM_POLL_MAX_DURATION_MS) {
      stopStreamPolling();
      message.value = '跟进超时，已停止自动刷新';
      addActivity('跟进超时', '任务仍在后台处理，刷新页面可重新接管进度');
      notify('跟进超时，已停止自动刷新；任务仍在后台处理，刷新页面可重新接管', true);
      return;
    }
    const statusChanged = prevStatus !== '' && prevStatus !== d.status;
    const justStarted = prevStatus === 'queued' && d.status !== 'queued';
    prevStatus = d.status;
    // 长轮询生效自检：声明挂起 ≥2s，却"无事件、状态未变、且远早于挂起时长"就返回
    // → 说明中间层（代理/网关）把 wait 吃掉了（服务端本应挂满）。
    // 此时若继续不 sleep 就会退化成高频空转（比多几次请求严重得多），故本会话
    // 永久退回客户端 sleep 模式。必须排除 statusChanged：服务端对"状态跃迁"
    // 本来就会提前返回，那是合法短返回，误判会把长轮询白白关掉。
    if (!longPollBlocked && longPollCap > 0 && waitSec >= 2
        && !gotEvents && !statusChanged && reqElapsed < waitSec * 400) {
      longPollBlocked = true;
      longPollCap = 0;
    }
    if (longPollCap > 0) {
      // 长轮询模式：直接要满上限，让服务端"守候"而不是让客户端定时器决定节奏。
      // 不能用斜坡时长去 min 上限——那会把挂起压回 2s，等于把长轮询废掉（实测
      // 稳态请求数 16 而非应有的 ~9）。服务端在事件到达/状态跃迁时立刻返回，
      // 请求数自然等于"有变化的次数"；静默节点（如 VLM 长时间推理）与排队期
      // 则一直挂着，完全不产生空转请求。
      waitSec = longPollCap;
      // 请求频率下限：事件密集时服务端会跟着事件回（可能毫秒级），用最小间隔
      // 兜底，避免把"事件率"直接放大成"请求率"（等价于改造前的 2s 固定间隔）
      const idle = STREAM_POLL_MIN_MS - reqElapsed;
      if (idle > 0) await new Promise(resolve => setTimeout(resolve, idle));
    } else {
      // 无长轮询（老后端/未开启）：退回客户端 sleep 斜坡，节奏完全由本地决定
      waitSec = 0;
      await new Promise(resolve => setTimeout(resolve, nextPollDelay(d.status, gotEvents || justStarted)));
    }
  }
}

async function event(block) {
  let name = 'message';
  const dataLines = [];
  block.split(/\r?\n/).forEach(l => {
    if (l.startsWith('event:')) name = l.slice(6).trim();
    else if (l.startsWith('data:')) dataLines.push(l.slice(5).trimStart());
  });
  const raw = dataLines.join('\n').trim();
  if (!raw) return;
  let d = parse(raw) || {};
  // B 方案：工作流首节点回传 job_id 后前端第一时刻记录，重试即可续跑。
  // 兼容多种回传形态：顶层/嵌套字段、单事件文本、以及“流式分块”——输出节点可能把
  // `"job_id":` 与 hex 值拆到相邻两条事件，故用跨事件缓冲拼接后再匹配。
  let earlyJobId = pickJobId(d, raw);
  if (!earlyJobId && !jobId.value) {
    jobBuf = (jobBuf + (typeof d.content === 'string' ? d.content : '')).slice(-512);
    earlyJobId = matchJobIdText(jobBuf);
  }
  if (earlyJobId && earlyJobId !== jobId.value) {
    jobId.value = earlyJobId;
    rememberJob(jobId.value);
  }

  if (name === 'message') {
    // 问答节点提问文本（"请审核以下候选图片…"）是给 interrupt/review 通道用的，
    // 不是处理进度；网关旧版本未过滤时会漏到这里，防御性跳过不展示
    const isReviewQuestion = /问答/.test(d.node_title || '')
      || /请审核以下候选图片|请选择[：:]通过/.test(d.content || d.message || '');
    message.value = isReviewQuestion
      ? '正在等待图片审核数据…'
      : (d.content || d.message || '工作流处理中');
    const text = message.value + ' ' + (d.node_title || '');
    // 节点标题中英文都匹配（真实 Coze 工作流节点为中文：产品整理/人工审核等）
    if (/W2|merge|product|产品整理|产品合并|预览生成/i.test(text)) activateStep(1);
    if (/W3|review|人工审核|结果发布/i.test(text)) activateStep(2);
    addActivity(
      isReviewQuestion ? '问答节点提问（已屏蔽）' : (d.node_title || 'Workflow'),
      isReviewQuestion ? '审核引导文本不在此展示，等待审核面板加载' : message.value,
    );
  } else if (name === 'interrupt') {
    eventId.value = d.event_id || '';
    statusMode.value = 'waiting-review';
    statusText.value = '等待人工审核';
    // 进入审核中断 = W1/W2 已完成（单调推进，回填前两步）
    activateStep(2);
    rememberJob(jobId.value, '待审核');
    phase.value = 'review';
    hasEnteredReview.value = true;
    await loadReview(d);
    armReviewCountdown();
    return true;
  } else if (name === 'done') {
    // End 节点为"返回变量"模式时流式 content 为空，直接查后端最终结果接口
    result.value = parse(d.full_content) || d;
    wSteps.value.forEach(s => s.state = 'done');
    phase.value = 'completed';
    setStatus('done');
    rememberJob(jobId.value, '已完成');
    // 工作流最终输出里带 table_id/table_name（每解析一次建一张新数据表）：
    // 先从 done 事件提取，再由 loadFinalResult 用服务端 bitable 覆盖（后者更权威）
    rememberBitable(result.value);
    await loadFinalResult();
    // 工作流返回时发布可能尚未完成（End 节点早于全部图片渲染），转轮询跟进
    if (publish.value.status === 'publishing') pollFinalUntilDone();
    return true;
  } else if (name === 'error') {
    // 复用 job_id 续跑，服务端快照保留已提交的 review_action，只处理剩余候选
    await retryParse();
    return true;
  }
  return false;
}

// 拉取发布后的产品数据与图片清单（粘性源优先，本地/云端兜底）
// 返回任务状态，供调用方判断发布是否仍在进行
async function loadFinalResult() {
  if (!jobId.value) return '';
  for (const base of reviewBases()) {
    try {
      const r = await fetch(`${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/final-result`, { headers: authHeaders() });
      if (!r.ok) continue;
      const d = await r.json();
      const parsed = parse(d.result_json);
      if (!parsed) continue;
      if (base) reviewBase.value = base;
      // 同步发布进度（结果页进度面板使用），并回写最近任务状态
      publish.value = {
        ...publish.value,
        status: d.status ?? '',
        processed: d.image_count ?? 0,
        failed: d.failed_count ?? 0,
        remaining: 0,
      };
      rememberJob(jobId.value, JOB_STATUS_HINTS[d.status] || '');
      rememberBitable(parsed);
      applyServerExport(parsed);
      result.value = {
        ...result.value,
        product_count: d.product_count ?? parsed.products?.length ?? 0,
        image_count: d.image_count ?? 0,
        status: d.status ?? parsed.status ?? '',
        product_data_json: pretty(parsed.products ?? []),
        image_urls_json: pretty(
          (parsed.products ?? []).flatMap(p => (p.product_images ?? []).map(img => img.image_url))
        ),
        message: d.failed_count > 0
          ? `发布完成，${d.failed_count} 张图片渲染失败。`
          : '所有候选图片已审核发布，结果如下。',
      };
      return d.status ?? '';
    } catch { continue; }
  }
  return '';
}

// 从 Markdown 审核文本提取 job_id（图片 URL 形如 .../jobs/{job_id}/review/assets/...）
function extractJobId(text) {
  const m = String(text || '').match(/\/api\/v1\/plugin\/pdf\/jobs\/([a-f0-9]{32})\//i);
  return m ? m[1] : '';
}

// 从文本里提取 job_id：先试素材 URL 形态，再试 JSON 字段形态（值前引号可选，
// 兼容流式分块把 `"job_id":` 与 hex 拆开、或 hex 不带引号的情况）
function matchJobIdText(text) {
  const s = String(text || '');
  return extractJobId(s) || (s.match(/"job_id"\s*:\s*"?([a-f0-9]{32})/i)?.[1] || '');
}

// 跨事件缓冲：输出节点流式分块吐 JSON 时（`"job_id":` 与 hex 值拆在相邻事件），
// 拼接最近若干事件的 content 再匹配；拿到 job_id 后停止累积
let jobBuf = '';

// 从单条 SSE 事件里尽可能早地提取 job_id（B 方案续跑的关键）
function pickJobId(d, raw) {
  if (d?.job_id) return String(d.job_id);
  const nested = d?.data?.job_id || d?.output?.job_id || d?.result?.job_id || d?.parameters?.job_id;
  if (nested) return String(nested);
  return matchJobIdText(raw);
}

// 从 Markdown 审核文本解析候选图片（问答节点未输出结构化 JSON 时的兜底）
function parseItemsFromText(text) {
  const raw = String(text || '');
  if (!raw) return [];
  const items = [];
  // 按 "图片N" 分块，抓产品名、页码、描述、bbox、图片链接
  const blocks = raw.split(/\n(?=图片\d+\n)/g);
  for (const block of blocks) {
    const head = block.match(/^图片(\d+)\s*\n/);
    if (!head) continue;
    const img = block.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
    if (!img) continue;
    const name = block.match(/产品名称：(.+)/);
    const page = block.match(/来源 PDF 页码：第\s*(\d+)\s*页/);
    const desc = block.match(/图片描述：(.+)/);
    const bbox = block.match(/当前裁剪区域：\[([^\]]+)\]/);
    const url = new URL(img[1], window.location.origin);
    // 图片 URL 与快照接口同源，直接使用
    items.push({
      source_crop_id: decodeURIComponent(url.pathname.split('/').pop()),
      preview_url: url.origin + url.pathname,
      product_name: name ? name[1].trim() : '',
      image_type: (block.match(/图片类型：(\w+)/) || [])[1] || 'other',
      pdf_page_number: page ? Number(page[1]) : 0,
      description: desc ? desc[1].trim() : '',
      pdf_bbox: bbox ? bbox[1].split(',').map(v => parseFloat(v.trim())) : undefined,
    });
  }
  return items;
}

// 递归在任意嵌套结构中寻找带 items 数组的审核协议对象
function findReviewItems(value, depth = 0) {
  if (!value || depth > 4) return null;
  if (typeof value === 'string') {
    const parsed = parse(value);
    return parsed && parsed !== value ? findReviewItems(parsed, depth + 1) : null;
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      const found = findReviewItems(v, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    if (Array.isArray(value.items) && value.items.length) return value;
    // Coze 包装结构 {content_type, content}
    if (typeof value.content === 'string' || value.content != null) {
      const found = findReviewItems(value.content, depth + 1);
      if (found) return found;
    }
    if (value.data != null) {
      const found = findReviewItems(value.data, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// 统一字段读取：兼容字段在 item 外层或嵌套在 crop 对象内（frontend_data_json 两种形态）
function pickField(item, crop, ...keys) {
  for (const k of keys) {
    if (item?.[k] != null && item[k] !== '') return item[k];
    if (crop?.[k] != null && crop[k] !== '') return crop[k];
  }
  return undefined;
}

function normalizeReviewItems(list, jobIdForAssets = '') {
  return list.map((item, idx) => {
    const crop = item?.crop && typeof item.crop === 'object' ? item.crop : {};
    let preview = pickField(item, crop, 'preview_url');
    if (preview) adoptReviewBase(preview);
    const cropId = String(pickField(item, crop, 'source_crop_id') || '');
    const base = reviewBase.value || CLOUD_API_BASE;
    if (!preview && cropId && jobIdForAssets) {
      preview = `${base}/api/v1/plugin/pdf/jobs/${jobIdForAssets}/review/assets/${cropId}`;
    }
    // W1 页面记录 ID + 逻辑页归一化范围（后端快照权威回填；旧后端无此字段时为空/全页）
    const pageAnalysisId = String(pickField(item, crop, 'page_analysis_id') || '');
    const sbRaw = pickField(item, crop, 'source_bbox');
    const sourceBbox = Array.isArray(sbRaw) && sbRaw.length === 4 && sbRaw.every(n => typeof n === 'number')
      ? sbRaw
      : [0, 0, 1, 1];
    return {
      source_crop_id: cropId,
      preview_url: preview || '',
      // 整页预览（重裁用）：网关规范化协议与旧后端均通过该接口按裁剪候选定位整页
      page_preview_url: cropId && jobIdForAssets
        ? `${base}/api/v1/plugin/pdf/jobs/${jobIdForAssets}/review/page-assets/${cropId}`
        : '',
      // W1 页面预览兜底（120dpi）：page-assets 不可用时按 page_analysis_id 定位；
      // 拆页场景该图为逻辑视图（clip=source_bbox），框选坐标需按 source_bbox 映射回物理页
      w1_page_url: pageAnalysisId && jobIdForAssets
        ? `${base}/api/v1/plugin/pdf/assets/${pageAnalysisId}`
        : '',
      source_bbox: sourceBbox,
      product_name: String(pickField(item, crop, 'product_name') || ''),
      image_type: String(pickField(item, crop, 'image_type') || 'other'),
      pdf_page_number: Number(pickField(item, crop, 'pdf_page_number') || 0),
      description: String(pickField(item, crop, 'description') || ''),
      pdf_bbox: pickField(item, crop, 'pdf_bbox'),
    };
  }).filter(x => x.source_crop_id);
}

// preview_url 的 origin → reviewBase（同源返回 ''，无法解析返回 null 表示沿用应答源）
function ownerBaseOf(url) {
  if (!url) return null;
  try {
    const u = new URL(url, location.origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin === location.origin ? '' : u.origin;
  } catch { return null; }
}

// 快照候选源全部落空时的显式提示（按任务去重）。
// 原实现静默 return null，会让"任务不在当前实例"这类实例/配置错配无感：
// 界面照常分批次，只是整页预览层、已审状态回读悄悄失效，排障只能翻后端日志。
function warnSnapshotUnavailable(sawNotFound) {
  if (!jobId.value || snapshotMissWarnedFor === jobId.value) return;
  snapshotMissWarnedFor = jobId.value;
  const shortId = jobId.value.slice(0, 8);
  if (sawNotFound) {
    notify('审核数据源无此任务，请检查实例配置', true);
    addActivity(
      '审核快照源不匹配',
      `任务 ${shortId}… 在候选实例均返回 404（任务不存在）。`
        + '常见原因：工作流在云端实例建任务，而页面读快照走了本地同源。'
        + '请把 VITE_PDF_API_BASE 指向建任务实例，并确认 vite 的 PDF 代理目标一致。'
    );
    return;
  }
  notify('审核快照读取失败：实例不可达', true);
  addActivity(
    '审核快照源不可达',
    `任务 ${shortId}… 的候选实例请求异常或快照尚未生成；请确认网关已启动、网络可达。`
  );
}

// 快照获取：粘性源优先，本地 8001 次之，云端 7779 兜底（云端工作流建的任务本地查不到）
// 命中后以快照 preview_url 的 origin 粘住实例——预览图由持有源 PDF 文件的实例渲染；
// 本地/云端共库时"谁应答"不等于"谁有文件"（本地应答但文件在云端 → 发布裁剪 FileNotFoundError）
async function fetchReviewSnapshot() {
  if (!jobId.value) return null;
  // 区分"任务不存在（404）"与"实例不可达/无快照"，供失败提示给出可操作的原因
  let sawNotFound = false;
  for (const base of reviewBases()) {
    try {
      const r = await fetch(`${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/review`, { headers: authHeaders() });
      if (!r.ok) {
        if (r.status === 404) sawNotFound = true;
        continue;
      }
      const d = await r.json();
      const snap = parse(d.review_json) || d;
      if (snap?.crop_bindings?.length) {
        const owner = ownerBaseOf(snap.crop_bindings.find(b => b.preview_url)?.preview_url);
        // 应答源仅在确为 http(s) 源时采纳，防止 "null" 等脏值进入粘性寻址
        const safeBase = (base === '' || /^https?:\/\//.test(base)) ? base : '';
        // 快照携带的 preview_url 指向未配置的云端实例时不采纳（调试仅走本地）
        const adopted = (owner !== null && allowedBase(owner)) ? owner : safeBase;
        reviewBase.value = allowedBase(adopted) ? adopted : '';
        return snap;
      }
    } catch { continue; }
  }
  warnSnapshotUnavailable(sawNotFound);
  return null;
}

async function loadReview(i = {}) {
  try {
    // 优先消费网关规范化的审核协议（pdf_review_v1，interrupt 事件 review 字段），
    // 结构保证强 schema；旧网关无该字段时再走多态兜底解析
    const container = (i.review && Array.isArray(i.review.items) && i.review.items.length)
      ? i.review
      : findReviewItems(i.raw?.interrupt_data?.data)
        || findReviewItems(i.review_json)
        || findReviewItems(i.message);
    if (container?.items?.length) {
      if (!jobId.value) jobId.value = extractJobId(JSON.stringify(container)) || i.review?.job_id || '';
      // 问答节点 interrupt 只携带 Markdown 提问文本，网关从中解析出的候选项
      // 不含整页预览定位字段（page_analysis_id / source_bbox 只在任务快照的
      // crop_bindings 里）；此时拉快照按 source_crop_id 合并补齐，否则 W1
      // 整页预览层永远不可用，重裁只剩裁剪图放大
      const needsEnrich = container.items.some(x => !(x?.page_analysis_id || x?.crop?.page_analysis_id));
      if (needsEnrich) {
        const snap = await fetchReviewSnapshot();
        if (snap?.crop_bindings?.length) {
          const byId = new Map(snap.crop_bindings.map(b => [b.source_crop_id, b]));
          container.items.forEach(x => {
            const target = x?.crop ? x.crop : x;
            const b = byId.get(target.source_crop_id);
            if (!b) return;
            if (!target.page_analysis_id) target.page_analysis_id = b.page_analysis_id || '';
            if (!target.source_bbox && b.source_bbox) target.source_bbox = b.source_bbox;
          });
        }
      }
      const items = normalizeReviewItems(container.items, jobId.value);
      batches.value = [];
      for (let n = 0; n < items.length; n += 8) batches.value.push({ items: items.slice(n, n + 8) });
      if (!batches.value.length) batches.value = [{ items: [] }];
      decisions.value = {};
      batchIndex.value = 0;
      // 中断批次与刷新前是同一批时，回填未提交的决策草稿（B）
      const draftRestored = restoreReviewDraft();
      addActivity('审核数据已加载', `${items.length} 张图片${draftRestored ? `（已恢复 ${draftRestored} 条未提交决策）` : ''}`);
      // 转自动审核后：新中断不再展示审核页，推迟到本流处理结束后自动通过并提交
      if (autoRest.value) setTimeout(() => { autoApproveRest(); }, 0);
      return;
    }

    const questionText = i.message || i.raw?.interrupt_data?.data?.content || '';
    // 中断消息未带 job_id 时，从图片 URL 中提取
    if (!jobId.value) {
      jobId.value = extractJobId(questionText) || extractJobId(i.raw ? JSON.stringify(i.raw) : '');
    }

    const snap = await fetchReviewSnapshot();

    const pending = (snap?.crop_bindings || []).filter(x => !x.review_action);
    const items = pending.length
      ? normalizeReviewItems(pending, jobId.value)
      : normalizeReviewItems(parseItemsFromText(questionText), jobId.value);

    batches.value = [];
    for (let n = 0; n < items.length; n += 8) batches.value.push({ items: items.slice(n, n + 8) });
    if (!batches.value.length) batches.value = [{ items: [] }];
    decisions.value = {};
    batchIndex.value = 0;
    // 恢复路径：回填刷新前未提交的决策草稿（B）
    const draftRestored = restoreReviewDraft();
    if (items.length) addActivity('审核数据已加载', `${items.length} 张图片${draftRestored ? `（已恢复 ${draftRestored} 条未提交决策）` : ''}`);
    else addActivity('当前批次无待审图片');
    // 转自动审核后：快照/Markdown 兜底路径同样自动通过并提交
    if (autoRest.value && items.length) setTimeout(() => { autoApproveRest(); }, 0);
  } catch {
    addActivity('审核数据加载中断');
  }
}

// ── 审核 ──
const actionLabels = { approve: '通过', reject: '拒绝', skip: '跳过', recrop: '重裁' };

// ── 审核决策草稿（B）──
// 丢决策窗口：同一批 8 张已审 N 张未提交时刷新，已提交批次无事，但这 N 张全丢。
// 草稿按 job_id 持久化（防抖 500ms），恢复审核时按 source_crop_id 回填；
// 批次提交成功 / 任务放弃或终态时清除。草稿只存 approve/reject/skip/recrop 的
// 轻量决策（recrop 含 pdf_bbox），不存图片等其他大对象。
const reviewDraftKey = (id) => `pdf_review_draft_${id}`;
let draftSaveTimer = null;
function saveReviewDraftSoon() {
  if (!jobId.value || phase.value !== 'review') return;
  if (draftSaveTimer) clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => {
    draftSaveTimer = null;
    try { localStorage.setItem(reviewDraftKey(jobId.value), JSON.stringify(decisions.value)); } catch { /* 存储满等异常忽略 */ }
  }, 500);
}
function clearReviewDraft(id) {
  try { localStorage.removeItem(reviewDraftKey(id || jobId.value)); } catch { /* 忽略 */ }
}
// 恢复/新中断载入审核数据后调用：仅回填仍存在的候选（已提交项不在 pending 里）
function restoreReviewDraft() {
  if (!jobId.value) return 0;
  let saved;
  try { saved = JSON.parse(localStorage.getItem(reviewDraftKey(jobId.value)) || 'null'); } catch { saved = null; }
  if (!saved || typeof saved !== 'object') return 0;
  const known = new Set(batches.value.flatMap(b => b.items).map(x => x.source_crop_id));
  let restored = 0;
  const merged = { ...decisions.value };
  for (const [cropId, decision] of Object.entries(saved)) {
    if (!known.has(cropId) || !decision?.action) continue;   // 过期草稿项：候选已提交/不存在
    if (merged[cropId]) continue;                             // 当前会话已有决策优先
    merged[cropId] = decision;
    restored += 1;
  }
  if (restored) decisions.value = merged;
  return restored;
}

function decide(item, action) {
  if (action === 'recrop') { openCrop(items.value.indexOf(item)); return; }
  decisions.value = { ...decisions.value, [item.source_crop_id]: { source_crop_id: item.source_crop_id, action } };
  saveReviewDraftSoon();
  addActivity('决策', `${actionLabels[action]} · ${item.product_name || ''}`.trim());
}

function approveAll() {
  items.value.forEach(x => {
    decisions.value = { ...decisions.value, [x.source_crop_id]: { source_crop_id: x.source_crop_id, action: 'approve' } };
  });
  addActivity('全部通过', items.value.length + ' 张图片');
}

// ── 中途转自动审核 ──
// 把当前中断带来的全部候选（跨 UI 分页）标记为通过；W3 每批最多 5 张，一个 interrupt 即一页
function markAllApproved() {
  batches.value.flatMap(b => b.items).forEach(x => {
    decisions.value = { ...decisions.value, [x.source_crop_id]: { source_crop_id: x.source_crop_id, action: 'approve' } };
  });
}
// 自动通过当前中断的全部候选并立即提交；恢复会话时 submit 内部会走直提通道
async function autoApproveRest() {
  if (submitting.value) return;
  batchIndex.value = 0;
  markAllApproved();
  addActivity('自动通过', `${selected.value.length} 张图片（转自动审核）`);
  await submit();
}
// 审核页按钮入口：置位后当前批次立即提交，后续中断批次由 loadReview 挂钩自动处理
async function switchToAuto() {
  if (autoRest.value) return;
  autoRest.value = true;
  addActivity('转为自动审核', '本批及后续批次不再人工确认');
  // 若恰有提交在途：本轮候选已随该次提交走完，等下一个中断自动处理即可
  if (!submitting.value) await autoApproveRest();
}

// ── 审核超时自动提交（REVIEW_AUTO_SUBMIT_SECONDS）──
function stopReviewCountdown() {
  if (reviewCountdownTimer) { clearInterval(reviewCountdownTimer); reviewCountdownTimer = null; }
  reviewCountdown.value = 0;
}
// 批次展示即起算：工作流侧的等待时钟在中断发出时已开始，不随用户操作顺延。
// 注意不能以 submitting 作守卫——下一批 interrupt 是在上次提交的 SSE 流内到达的，
// 此时 submitting 仍为 true；豁免提交在途只在触发时判断
function armReviewCountdown() {
  stopReviewCountdown();
  // 恢复会话走 REST 直提（工作流不续跑，无等待窗口）；演示模式与自动审核同理豁免
  if (restored.value || autoRest.value || reviewMode.value === 'auto_approve') return;
  if (!eventId.value || eventId.value === 'demo' || !items.value.length) return;
  reviewCountdown.value = REVIEW_AUTO_SUBMIT_SECONDS;
  reviewCountdownTimer = setInterval(() => {
    reviewCountdown.value -= 1;
    if (reviewCountdown.value <= 0) {
      stopReviewCountdown();
      autoSubmitOnTimeout();
    }
  }, 1000);
}
// 超时兜底：只把未决项补成「通过」，用户已做的拒绝/重裁决策原样保留；
// 编辑中的重裁随超时作废（避免脏决策落在随后已失效的 event_id 上）
async function autoSubmitOnTimeout() {
  if (submitting.value || !eventId.value) return;
  let filled = 0;
  batches.value.flatMap(b => b.items).forEach(x => {
    if (!decisions.value[x.source_crop_id]) {
      decisions.value = { ...decisions.value, [x.source_crop_id]: { source_crop_id: x.source_crop_id, action: 'approve' } };
      filled += 1;
    }
  });
  if (crop.value.open) closeCrop();
  addActivity('超时自动审核', filled ? `${filled} 张未决图片自动通过` : '提交已完成的决策');
  await submit();
}
watch(phase, (p) => { if (p !== 'review') stopReviewCountdown(); });
watch(autoRest, (v) => { if (v) stopReviewCountdown(); });

async function submit() {
  if (submitting.value) return;
  // 恢复会话：SSE 中断流已丢失（无 event_id），走插件 REST 直提通道
  if (restored.value) { await submitDirect(); return; }
  if (!ready.value || !eventId.value) { notify('请完成当前批次', true); return; }
  submitting.value = true;
  const payload = selected.value;
  try {
    const r = await fetch(API.reply, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
      body: JSON.stringify({ event_id: eventId.value, crops: payload })
    });
    if (!r.ok) {
      let detail = '';
      try { const j = await r.json(); detail = j?.detail || j?.message || ''; } catch { /* 无响应体 */ }
      notify(detail ? `提交未成功：${detail}` : '提交未成功，请重试', true);
      return;
    }
    // 方案 D 分流：JSON = stream 模式受理；SSE = legacy 直连（同 startWorkFlow）。
    // 收尾与 SSE 分支完全一致：清 event_id、切处理中、清本批草稿
    if (isStreamAccepted(r)) {
      const d = await r.json();
      eventId.value = '';
      phase.value = 'processing';
      setStatus('busy', '处理中');
      addActivity('提交审核', `${payload.length} 张图片`);
      clearReviewDraft();
      await followStream(d.stream_id || '');
      return;
    }
    // 提交成功后中断已失效，清空避免重复提交同一 event_id
    eventId.value = '';
    phase.value = 'processing';
    setStatus('busy', '处理中');
    addActivity('提交审核', `${payload.length} 张图片`);
    // 本批已提交：清除决策草稿（B）
    clearReviewDraft();
    await sse(r);
  } catch {
    setStatus('waiting-review', '等待人工审核');
    notify('提交未成功，请重试', true);
  } finally {
    submitting.value = false;
  }
}

// ── 任务恢复与直提通道（P1）──
function stopStatusPolling() {
  if (statusTimer) { clearInterval(statusTimer); statusTimer = null; }
}

// 双源探测任务状态：粘性源优先，本地/云端兜底；命中即粘住
async function fetchJobStatus(id = jobId.value) {
  for (const base of reviewBases()) {
    try {
      const r = await fetch(`${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(id)}`, { headers: authHeaders() });
      if (!r.ok) continue;
      const d = await r.json();
      if (base) reviewBase.value = base;
      return d;
    } catch { continue; }
  }
  return null;
}

// 归档兜底：任务检查点过期后，发布过结果的任务仍可凭持久归档直达结算页。
// 命中返回 true（页面状态已切换）；无归档返回 false（调用方继续原失败分支）。
async function tryArchivedResult(id = jobId.value) {
  for (const base of reviewBases()) {
    try {
      const r = await fetch(`${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(id)}/final-result`, { headers: authHeaders() });
      if (!r.ok) continue;
      const d = await r.json();
      const parsed = parse(d.result_json);
      if (!parsed?.products) continue;
      if (base) reviewBase.value = base;
      restored.value = true;
      jobId.value = id;
      wSteps.value.forEach(s => s.state = 'done');
      publish.value = {
        ...publish.value,
        status: d.status ?? 'published',
        processed: d.image_count ?? 0,
        failed: d.failed_count ?? 0,
        remaining: 0,
      };
      result.value = {
        product_count: d.product_count ?? parsed.products?.length ?? 0,
        image_count: d.image_count ?? 0,
        status: d.status ?? parsed.status ?? '',
        product_data_json: pretty(parsed.products ?? []),
        image_urls_json: pretty(
          (parsed.products ?? []).flatMap(p => (p.product_images ?? []).map(img => img.image_url))
        ),
        message: d.failed_count > 0
          ? `归档结果：发布完成，${d.failed_count} 张图片渲染失败。`
          : '归档结果：所有候选图片已审核发布。',
      };
      phase.value = 'completed';
      setStatus('done');
      addActivity('查看归档结果', `任务检查点已过期，从持久归档恢复（${d.product_count ?? 0} 个产品）`);
      rememberBitable(parsed);
      applyServerExport(parsed);
      return true;
    } catch { continue; }
  }
  return false;
}

// 从工作流输出里深度提取飞书数据表定位（table_id/table_name）。
// 总工作流的 End 节点输出结构不固定（可能嵌在 data/output/result 等层级下，
// 字段名也可能带 bitable_ 前缀），所以按候选键名递归搜索，而不是只认顶层固定字段。
const TABLE_ID_KEYS = ['table_id', 'bitable_table_id', 'tableId', 'feishu_table_id'];
const TABLE_NAME_KEYS = ['table_name', 'bitable_table_name', 'tableName', 'feishu_table_name'];

function deepFindTableBinding(root, depth = 0) {
  if (!root || typeof root !== 'object' || depth > 6) return null;
  // 同层优先：table_id 与 table_name 通常是同一个对象里的兄弟字段
  for (const key of TABLE_ID_KEYS) {
    const raw = root[key];
    // 字符串化的 JSON（工作流输出常见形态）先尝试解析再递归
    if (typeof raw === 'string' && raw.trim()) {
      const name = TABLE_NAME_KEYS.map(k => root[k]).find(v => typeof v === 'string' && v.trim()) || '';
      return { tableId: raw.trim(), tableName: String(name).trim() };
    }
  }
  for (const value of Object.values(root)) {
    if (typeof value === 'string') {
      // 工作流常把子结构序列化成字符串塞在字段里
      const nested = value.trim().startsWith('{') || value.trim().startsWith('[') ? parse(value) : null;
      const hit = nested ? deepFindTableBinding(nested, depth + 1) : null;
      if (hit) return hit;
    } else if (value && typeof value === 'object') {
      const hit = deepFindTableBinding(value, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

// 记录飞书数据表定位（工作流每解析一次建一张新表）：
// 优先服务端结果里的 bitable（W3 回调透传，最权威），
// 其次从工作流最终输出（done 事件 result）里深度提取
function rememberBitable(parsed) {
  const b = parsed?.bitable;
  let binding = b?.table_id
    ? { tableId: String(b.table_id), tableName: String(b.table_name || '') }
    : null;
  if (!binding) binding = deepFindTableBinding(parsed);
  if (!binding) binding = deepFindTableBinding(result.value);
  if (!binding?.tableId) return;
  exportState.value = { ...exportState.value, tableId: binding.tableId, tableName: binding.tableName };
}

// 服务端已有导出记录（首次导出成功后固化进快照/归档）→ 直接给下载链接，
// 不再打飞书；导出中/已就绪时不覆盖（避免打断进行中的重新导出）
function applyServerExport(parsed) {
  const rec = parsed?.export;
  if (!rec?.file_name) return;
  if (!['', 'error'].includes(exportState.value.state)) return;
  exportState.value = {
    ...exportState.value,
    state: 'ready',
    fileName: String(rec.file_name),
    downloadUrl: `${reviewBase.value || ''}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/export.xlsx`,
  };
}

// 导出 xlsx（最终产物）：服务端走飞书导出三步链，产物落执行实例后提供下载。
// 优先粘性源（预览/发布所在实例）；若该实例未部署导出路由（旧版本，
// 路由级 404 "Not Found"）则回退同源实例——导出只依赖共享库与飞书 API，
// 不依赖源 PDF，任何新代码实例都能执行。
async function exportXlsx() {
  if (!jobId.value || exportState.value.state === 'exporting') return;
  // 重新导出会生成新产物，导入状态随之作废（已入库的数据仍在，重新导入按记录 id 覆盖更新）
  kbState.value = blankKbState();
  exportPreview.value = blankExportPreview();
  exportState.value = { ...exportState.value, state: 'exporting', error: '' };
  addActivity('导出 Excel', '正在从飞书多维表格导出…');
  const candidates = [reviewBase.value || '', ''].filter((v, i, a) => a.indexOf(v) === i);
  try {
    let lastDetail = '';
    for (const base of candidates) {
      const r = await fetch(`${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/export-xlsx`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          table_id: exportState.value.tableId || '',
          table_name: exportState.value.tableName || '',
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        exportState.value = {
          state: 'ready',
          fileName: d.file_name || 'products.xlsx',
          // 下载与导出同实例（产物在执行实例本地磁盘）
          downloadUrl: `${base}${d.download_url}`,
          tableId: d.table_id || exportState.value.tableId || '',
          tableName: d.table_name || exportState.value.tableName || '',
          error: '',
        };
        addActivity('导出完成', d.file_name || '');
        notify('Excel 已生成，可直接下载');
        return;
      }
      lastDetail = typeof d?.detail === 'string' ? d.detail : `导出失败（${r.status}）`;
      // 业务 404（中文 detail，如任务不存在）是真实错误，直接抛；
      // 仅路由级 "Not Found"（旧实例）才换下一个源
      if (!(r.status === 404 && lastDetail === 'Not Found')) throw new Error(lastDetail);
    }
    throw new Error(lastDetail || '导出失败');
  } catch (e) {
    exportState.value = { ...exportState.value, state: 'error', error: e?.message || '导出失败' };
    notify(e?.message || '导出失败', true);
  }
}

// 发布终态后自动导出一次：xlsx 是工作台的最终产物，且首次导出会把
// 数据表绑定（来自工作流 End 输出）固化进服务端快照/归档——之后重新导出、
// 刷新页面、归档恢复都不再依赖本次会话。失败不自动重试，由用户手动点。
// 注意时序：发布完成（published）先于工作流建表（End 输出 table_id），
// 两个条件分别就绪的时间不定，任一变化都要复查是否同时满足。
function maybeAutoExport() {
  if ((publish.value.status === 'published' || publish.value.status === 'publish_partial')
      && exportState.value.state === '' && exportState.value.tableId) {
    exportXlsx();
  }
}
watch(() => publish.value.status, maybeAutoExport);
watch(() => exportState.value.tableId, maybeAutoExport);

// ── 知识库导入（两步式）─────────────────────────────────
// 导入候选源：产物所在实例（下载 URL 的源）优先——编排路由要读该实例
// 本地磁盘上的导出文件；粘性审核源次之；同源兜底。后续 commit/明细/
// 状态接口只依赖共享库，沿用导入成功的源即可。
function kbImportCandidates() {
  const bases = [];
  try {
    const u = new URL(exportState.value.downloadUrl, location.origin);
    if (allowedBase(u.origin)) bases.push(u.origin === location.origin ? '' : u.origin);
  } catch { /* downloadUrl 无效时走后续候选 */ }
  if (reviewBase.value && !bases.includes(reviewBase.value)) bases.push(reviewBase.value);
  if (!bases.includes('')) bases.push('');
  return bases;
}

// 步骤①：调编排路由（读产物 → sheet 改「图册记录表」、记录状态填
// 「已发布」→ 导入器校验落批次）。404 统一换下一个候选源：可能是旧
// 实例没部署该路由，也可能产物在另一实例；其余状态（403/422/5xx）
// 是确定性失败，直接抛。
// 校验在途守卫（直提与回传共用）
function kbBusy() {
  return ['importing', 'committing'].includes(kbState.value.state);
}
// 已有未提交的校验结果时，重开校验需确认覆盖（已入库数据不受影响，
// 重新导入按图册记录 id 幂等 upsert）
function confirmKbReplace() {
  // 仅当上次校验通过（有可提交的结果）才打扰；上次就没通过时直接重来
  if (kbState.value.state !== 'validated') return true;
  if (kbState.value.summary?.status !== 'validated') return true;
  return window.confirm('已有未提交的校验结果，继续将替换当前校验结果（已入库数据不受影响）。');
}
// 校验成功落状态（直提与回传共用）；validation_failed 批次不抛错，
// 前端按 status 拦提交、后端 commit 409 兜底
async function applyKbValidation(base, d, source, fileName) {
  kbState.value = {
    ...kbState.value, state: 'validated', base,
    importId: d.import_id, source, fileName, summary: d,
  };
  if (d.status === 'validated') {
    addActivity('知识库校验完成', `共 ${d.total_rows} 行，有效 ${d.valid_rows}，警告 ${d.warning_rows}`);
    notify(`校验通过：${d.valid_rows} 行可导入`);
  } else {
    addActivity('知识库校验失败', d.error_message || d.status);
  }
  if (d.error_rows > 0) await fetchKbErrorRows();
}

// 步骤①：调编排路由（读产物 → sheet 改「图册记录表」、记录状态仅补空值
// → 导入器校验落批次）。404 统一换下一个候选源：可能是旧实例没部署该
// 路由，也可能产物在另一实例；其余状态（403/422/5xx）是确定性失败，直接抛。
async function importKnowledge() {
  if (!jobId.value || exportState.value.state !== 'ready' || kbBusy()) return;
  if (!confirmKbReplace()) return;
  kbState.value = { ...blankKbState(), state: 'importing', source: 'export' };
  addActivity('导入知识库', '正在校验导出数据…');
  const candidates = kbImportCandidates();
  let lastDetail = '';
  try {
    for (const base of candidates) {
      const r = await fetch(`${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/import-knowledge`, {
        method: 'POST', headers: authHeaders(),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        await applyKbValidation(base, d, 'export', '');
        return;
      }
      lastDetail = typeof d?.detail === 'string' ? d.detail : `导入失败（${r.status}）`;
      if (r.status !== 404) throw new Error(lastDetail);
    }
    throw new Error(lastDetail || '导入失败');
  } catch (e) {
    kbState.value = { ...kbState.value, state: 'error', error: e?.message || '导入失败' };
    notify(e?.message || '导入失败', true);
  }
}

// 步骤①（回传通道）：用户下载检查/修改后的 xlsx 直接上传校验（不要求先
// 导出，产物与文件互不依赖）。服务端只补「记录状态」空值为「已发布」，
// 显式填写的值尊重；sheet 名不做静默修复（改坏了由导入器给出准确报错）。
const KB_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
async function uploadKbFile(file) {
  if (!file || !jobId.value || kbBusy()) return;
  if (!/\.xlsx$/i.test(file.name || '')) {
    notify('请上传 .xlsx 文件（Excel 工作簿）', true);
    return;
  }
  if (file.size > KB_UPLOAD_MAX_BYTES) {
    notify('文件超过 100MB 上限', true);
    return;
  }
  if (!confirmKbReplace()) return;
  kbState.value = { ...blankKbState(), state: 'importing', source: 'file', fileName: file.name };
  addActivity('上传 Excel', `${file.name}，正在校验…`);
  let lastDetail = '';
  try {
    for (const base of reviewBases()) {
      const form = new FormData();
      form.append('file', file);
      // 不手动设 Content-Type：浏览器自动带 multipart boundary
      const r = await fetch(
        `${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/import-knowledge/file`,
        { method: 'POST', headers: authHeaders(), body: form },
      );
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        await applyKbValidation(base, d, 'file', file.name);
        return;
      }
      lastDetail = typeof d?.detail === 'string' ? d.detail : `导入失败（${r.status}）`;
      if (r.status !== 404) throw new Error(lastDetail);
    }
    throw new Error(lastDetail || '导入失败');
  } catch (e) {
    kbState.value = { ...kbState.value, state: 'error', error: e?.message || '导入失败' };
    notify(e?.message || '导入失败', true);
  }
}

// 导出数据预览：展开即拉最新（每次展开重新请求，不缓存——重新导出/
// 产物被替换后自然反映最新数据）。源用产物所在实例（同导入候选项）。
async function toggleExportPreview() {
  if (!jobId.value || exportState.value.state !== 'ready') return;
  const open = !exportPreview.value.open;
  if (!open) {
    exportPreview.value = { ...exportPreview.value, open: false };
    return;
  }
  exportPreview.value = { ...exportPreview.value, open: true, state: 'loading', error: '' };
  let lastDetail = '';
  try {
    for (const base of kbImportCandidates()) {
      const r = await fetch(
        `${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/export/preview`,
        { headers: authHeaders() },
      );
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        exportPreview.value = {
          open: true, state: 'ready',
          columns: d.columns || [], rows: d.rows || [],
          totalRows: d.total_rows || 0, truncated: !!d.truncated, error: '',
        };
        return;
      }
      lastDetail = typeof d?.detail === 'string' ? d.detail : `预览失败（${r.status}）`;
      if (r.status !== 404) throw new Error(lastDetail);
    }
    throw new Error(lastDetail || '预览不可用');
  } catch (e) {
    exportPreview.value = { ...exportPreview.value, state: 'error', error: e?.message || '预览失败' };
  }
}

// 行级错误明细（自带接口；失败不阻断——摘要里的 error_rows/error_message 仍可见）
async function fetchKbErrorRows() {
  const { base, importId } = kbState.value;
  if (!importId) return;
  try {
    const r = await fetch(`${base}/api/v1/knowledge/admin/imports/${encodeURIComponent(importId)}/rows?status=error`,
      { headers: authHeaders() });
    const d = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(d.rows)) kbState.value = { ...kbState.value, errorRows: d.rows };
  } catch { /* 明细拉取失败静默 */ }
}

// 步骤②：提交批次 + 投递索引任务（后台 embedding → Qdrant，不自动轮询；
// 完成即可检索；按图册记录 id 幂等 upsert，失败可重复导入）
async function commitKnowledge() {
  const { state, base, importId } = kbState.value;
  if (state !== 'validated' || !importId) return;
  if (kbState.value.summary?.status !== 'validated') return;
  kbState.value = { ...kbState.value, state: 'committing', error: '' };
  addActivity('提交知识库', '正在提交批次并投递索引任务…');
  try {
    const r = await fetch(`${base}/api/v1/knowledge/admin/imports/${encodeURIComponent(importId)}/commit`, {
      method: 'POST', headers: authHeaders(),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(typeof d?.detail === 'string' ? d.detail : `提交失败（${r.status}）`);
    kbState.value = { ...kbState.value, state: 'committed', summary: { ...kbState.value.summary, ...d }, commitResult: d };
    const failed = Array.isArray(d.dispatch_failed_job_ids) ? d.dispatch_failed_job_ids.length : 0;
    addActivity('知识库提交完成', failed ? `已提交，${failed} 个索引任务投递失败` : '已提交索引');
    notify(failed ? `已提交，${failed} 个索引任务投递失败` : '已提交，正在建立检索索引，稍后即可检索');
  } catch (e) {
    // 回到校验完成态，保留摘要供重试提交
    kbState.value = { ...kbState.value, state: 'validated', error: e?.message || '提交失败' };
    notify(e?.message || '提交失败', true);
  }
}

// 手动刷新批次状态（committed → indexing → active/active_partial）
async function refreshKbStatus() {
  const { state, base, importId } = kbState.value;
  if (state !== 'committed' || !importId) return;
  try {
    const r = await fetch(`${base}/api/v1/knowledge/admin/imports/${encodeURIComponent(importId)}`,
      { headers: authHeaders() });
    const d = await r.json().catch(() => ({}));
    if (r.ok) kbState.value = { ...kbState.value, summary: { ...kbState.value.summary, ...d } };
  } catch { /* 刷新失败静默，可再点 */ }
}

// ── 提交后自动轮询索引状态 ──
// 目的：提交后索引在后台异步执行（committed → indexing → active/active_partial），
// 用户不再需要手动反复点“刷新状态”；到终态（可检索 / 部分失败）自动停止，
// 页面卸载时清理定时器；单轮失败不改断轮询（下一轮重试）。
const KB_POLL_INTERVAL = 5000;
const KB_TERMINAL_STATUS = ['active', 'active_partial'];
const kbLastCheckedAt = ref(0);
const kbPolling = ref(false);
let kbPollTimer = null;
let kbPollBusy = false;
function stopKbPolling() {
  if (kbPollTimer) { clearInterval(kbPollTimer); kbPollTimer = null; }
  kbPolling.value = false;
}
function startKbPolling() {
  if (kbPollTimer) return;
  kbPolling.value = true;
  kbPollTimer = setInterval(async () => {
    const { state, summary } = kbState.value;
    if (state !== 'committed' || KB_TERMINAL_STATUS.includes(summary?.status)) { stopKbPolling(); return; }
    if (kbPollBusy) return;   // 上一轮未返回时跳过，避免请求堆叠
    kbPollBusy = true;
    try {
      await refreshKbStatus();
      kbLastCheckedAt.value = Date.now();
    } finally {
      kbPollBusy = false;
    }
  }, KB_POLL_INTERVAL);
}
// 进入已提交（提交成功）即开始轮询；离开该状态或到达终态自动停止
watch(
  () => [kbState.value.state, kbState.value.summary?.status],
  ([state, status]) => {
    if (state === 'committed' && !KB_TERMINAL_STATUS.includes(status)) startKbPolling();
    else stopKbPolling();
  },
  { immediate: true },
);

// 恢复任务：按任务状态分支进入对应阶段（审核 / 发布 / 处理中只读跟进）
async function restoreJob(rawId) {
  const id = String(rawId || '').trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id)) { notify('请输入 32 位十六进制的任务 ID', true); return; }
  restart();
  restored.value = true;
  jobId.value = id;
  // 计时锚点：活跃任务记录优先（刷新续接不重置），其次最近任务 added_at，否则从恢复时刻起算
  const recentForTimer = recentJobs.value.find(x => x.job_id === id);
  parseStartedAt.value = (activeJob.value?.job_id === id && activeJob.value?.started_at)
    ? activeJob.value.started_at
    : (recentForTimer?.added_at || Date.now());
  pdfName.value = recentJobs.value.find(x => x.job_id === id)?.pdf_name || '恢复的任务';
  phase.value = 'processing';
  setStatus('busy', '正在恢复任务');
  message.value = '正在查询任务状态…';
  addActivity('恢复任务', id);
  const job = await fetchJobStatus(id);
  if (!job) {
    // 任务检查点（12 小时生命周期）已清理：尝试持久归档（发布过结果的任务可直达结算页）
    const archived = await tryArchivedResult(id);
    if (archived) return;
    notify('未找到该任务（临时任务保留 12 小时，可能已过期）', true);
    restart();
    return;
  }
  rememberJob(id, JOB_STATUS_HINTS[job.status] || '');
  if (job.status === 'review_pending') { await restoreReview(); return; }
  if (['publishing', 'publish_partial', 'published'].includes(job.status)) {
    await enterResultPhase();
    pollFinalUntilDone();
    return;
  }
  if (['ready', 'processing', 'merging'].includes(job.status)) {
    message.value = `任务仍在解析中（${job.progress_current ?? 0}/${job.progress_total ?? '?'} 页），页面将自动跟进…`;
    activateStep(1);
    pollProcessingStatus();
    return;
  }
  // failed / canceled
  notify(`任务状态异常（${JOB_STATUS_HINTS[job.status] || job.status}），无法恢复`, true);
  restart();
}

// 恢复流（stream 模式）：排队/运行早期只有 stream_id，无 job_id 可查任务快照。
// since=0 全量重放事件（活动流水/W 步骤/消息历史无损）；计时锚点取活跃任务记录
async function restoreStream(rawSid) {
  const sid = String(rawSid || '').trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(sid)) { notify('无效的流实例 ID', true); return; }
  restart();
  restored.value = true;
  streamId.value = sid;
  parseStartedAt.value = (activeJob.value?.stream_id === sid && activeJob.value?.started_at)
    ? activeJob.value.started_at
    : Date.now();
  pdfName.value = activeJob.value?.pdf_name || '恢复的任务';
  phase.value = 'processing';
  setStatus('busy', '正在恢复任务');
  message.value = '正在重放任务事件…';
  addActivity('恢复任务', `流 ${sid.slice(0, 8)}…（重放全部事件）`);
  await pollStream(sid, 0);
}

// 横幅「继续跟进」入口：优先 job_id（两条模式通用），仅 stream 模式排队/早期
// 只有 stream_id 时走流恢复（重放后事件里发现 job_id 会自动接管记录链）
async function resumeActiveJob() {
  const target = activeJob.value;
  if (!target) return;
  activeJobDismissed.value = true;
  if (target.job_id) { await restoreJob(target.job_id); return; }
  if (target.stream_id) { await restoreStream(target.stream_id); return; }
}

// 恢复会话进入审核阶段（无 SSE event_id，提交走直提通道）
async function restoreReview() {
  phase.value = 'review';
  hasEnteredReview.value = true;
  statusMode.value = 'waiting-review';
  statusText.value = '等待人工审核';
  activateStep(2);
  await loadReviewSnapshot();
}

// 拉取审核快照：未决策的裁剪候选载入批次；快照产品记录备用（直提时默认通过）
// 复用 fetchReviewSnapshot（以 preview_url origin 粘住文件归属实例，发布裁剪不走错实例）
async function loadReviewSnapshot() {
  const snap = await fetchReviewSnapshot();
  const pending = (snap?.crop_bindings || []).filter(x => !x.review_action);
  snapshotProducts.value = (snap?.products || []).map(p => ({
    product_candidate_id: p.product_candidate_id ?? p.id ?? '',
    reviewed: !!p.review_action,
  }));
  const items = normalizeReviewItems(pending, jobId.value);
  batches.value = [];
  for (let n = 0; n < items.length; n += 8) batches.value.push({ items: items.slice(n, n + 8) });
  if (!batches.value.length) batches.value = [{ items: [] }];
  decisions.value = {};
  batchIndex.value = 0;
  // 恢复会话：回填刷新前未提交的决策草稿（B）
  const draftRestored = restoreReviewDraft();
  if (items.length) {
    addActivity('审核数据已加载', `${items.length} 张图片（恢复会话${draftRestored ? `，已恢复 ${draftRestored} 条未提交决策` : ''}）`);
  } else {
    addActivity('当前批次无待审图片');
    await finalizeDirect();
  }
}

// 快照产品中未审核的项全部默认通过（本页只做图片审核；finalize 要求产品全部已决）
function productApprovals() {
  return snapshotProducts.value
    .filter(p => p.product_candidate_id && !p.reviewed)
    .map(p => ({ product_candidate_id: p.product_candidate_id, action: 'approve' }));
}

// 插件 REST 直提：decisions_json 与工作流 resume 载荷同构（{products, crops}）
async function postReviewDecisions(crops, finalize) {
  const body = { products: productApprovals(), crops };
  const r = await fetch(`${reviewBase.value}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/review`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ review_mode: 'manual', decisions_json: JSON.stringify(body), finalize })
  });
  if (!r.ok) {
    let detail = '';
    try { const j = await r.json(); detail = j?.detail || j?.message || ''; } catch { /* 无响应体 */ }
    throw new Error(detail ? `提交未成功：${detail}` : '提交未成功，请重试');
  }
  return r.json();
}

// 直提当前批次：批次间不回 SSE，剩余批次继续快照循环
async function submitDirect() {
  submitting.value = true;
  try {
    const res = await postReviewDecisions(selected.value, false);
    addActivity('提交审核', `${selected.value.length} 张图片`);
    // 本批已提交：草稿使命完成（loadReviewSnapshot 重载后也会被过滤，这里主动清避免残留）
    clearReviewDraft();
    if ((res?.remaining_review_count ?? 0) > 0) {
      await loadReviewSnapshot();
      notify('已提交当前批次，还有待审图片');
    } else {
      await finalizeDirect();
    }
  } catch (e) {
    notify(e.message || '提交未成功，请重试', true);
  } finally {
    submitting.value = false;
  }
}

// 审核收尾：finalize 写入任务快照，随后进入结果页驱动发布
async function finalizeDirect() {
  try {
    await postReviewDecisions([], true);
  } catch (e) {
    // 重复 finalize / 已完成审核时后端会拒绝，忽略后照常读结果
    addActivity('收尾提交', e.message || '');
  }
  rememberJob(jobId.value, '发布中');
  await enterResultPhase();
  drivePublish();
}

async function postPublishBatch(retryFailed) {
  const r = await fetch(`${reviewBase.value}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/publish/next-batch`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ batch_size: 5, retry_failed: !!retryFailed })
  });
  if (!r.ok) {
    let detail = '';
    try { const j = await r.json(); detail = j?.detail || j?.message || ''; } catch { /* 无响应体 */ }
    throw new Error(detail || '发布请求未成功');
  }
  return r.json();
}

function adoptPublishState(d) {
  publish.value = {
    ...publish.value,
    status: d.status ?? publish.value.status,
    processed: d.processed_count ?? publish.value.processed,
    failed: d.failed_count ?? publish.value.failed,
    remaining: d.remaining ?? publish.value.remaining,
    hasMore: !!d.has_more,
  };
  rememberJob(jobId.value, JOB_STATUS_HINTS[publish.value.status] || '');
}

// 前端驱动发布：批量认领渲染直到无剩余（接口按批次认领，并发安全，可从中断处续跑）
async function drivePublish() {
  if (publish.value.driving) return;
  publish.value.driving = true;
  publish.value.retrying = false;
  setStatus('busy', '发布中');
  try {
    for (let i = 0; i < 100; i += 1) {
      const d = await postPublishBatch(false);
      adoptPublishState(d);
      if (d.status !== 'publishing' || !d.has_more) break;
    }
    await loadFinalResult();
    phase.value = 'completed';
    if (publish.value.failed > 0) {
      setStatus('done');
      notify(`发布完成，${publish.value.failed} 张图片失败，可点击「重试失败图片」`, true);
    } else {
      setStatus('done');
    }
  } catch (e) {
    phase.value = 'completed';
    setStatus('error', '发布中断');
    notify(e.message || '发布未成功，可点击「继续发布剩余」续跑', true);
  } finally {
    publish.value.driving = false;
  }
}

// 重试渲染失败的图片（retry_failed 只重新认领 failed 项）
async function retryFailedPublish() {
  if (publish.value.driving || publish.value.retrying) return;
  publish.value.retrying = true;
  setStatus('busy', '重试失败图片');
  try {
    for (let i = 0; i < 100; i += 1) {
      const d = await postPublishBatch(true);
      adoptPublishState(d);
      if (d.status !== 'publishing' || !d.has_more) break;
    }
    await loadFinalResult();
    setStatus('done');
    notify(publish.value.failed > 0
      ? `仍有 ${publish.value.failed} 张图片渲染失败`
      : '失败图片已全部重试完成', publish.value.failed > 0);
  } catch (e) {
    notify(e.message || '重试未成功，请稍后再试', true);
  } finally {
    publish.value.retrying = false;
  }
}

// 结果阶段兜底轮询：工作流侧仍在发布时实时跟随其进度
function pollFinalUntilDone() {
  stopStatusPolling();
  let tries = 0;
  statusTimer = setInterval(async () => {
    tries += 1;
    if (tries > 150) { stopStatusPolling(); return; }
    const job = await fetchJobStatus();
    if (!job) return;
    publish.value = { ...publish.value, status: job.status };
    rememberJob(jobId.value, JOB_STATUS_HINTS[job.status] || '');
    if (job.status !== 'publishing') {
      stopStatusPolling();
      await loadFinalResult();
      if (job.status === 'publish_partial') notify('部分图片发布失败，可点击「重试失败图片」', true);
    }
  }, 2000);
}

// 恢复会话下任务仍在解析（W1/W2）：只读跟进，进入审核/发布阶段后自动接管
function pollProcessingStatus() {
  stopStatusPolling();
  let tries = 0;
  statusTimer = setInterval(async () => {
    tries += 1;
    if (tries > 200) { stopStatusPolling(); return; }
    const job = await fetchJobStatus();
    if (!job) return;
    rememberJob(jobId.value, JOB_STATUS_HINTS[job.status] || '');
    message.value = `任务仍在解析中（${job.progress_current ?? 0}/${job.progress_total ?? '?'} 页）…`;
    if (job.status === 'review_pending') {
      stopStatusPolling();
      await restoreReview();
    } else if (['publishing', 'publish_partial', 'published'].includes(job.status)) {
      stopStatusPolling();
      await enterResultPhase();
      drivePublish();
    } else if (['failed', 'canceled'].includes(job.status)) {
      stopStatusPolling();
      notify(`任务${JOB_STATUS_HINTS[job.status] || '已结束'}`, true);
      restart();
    }
  }, 3000);
}

// 结果阶段进入：读取最终结果（含发布进度），发布未完成时状态保持"发布中"
async function enterResultPhase() {
  phase.value = 'completed';
  wSteps.value.forEach(s => { s.state = 'done'; });
  setStatus('busy', '发布中');
  await loadFinalResult();
  if (publish.value.status !== 'publishing') setStatus('done');
}

// 取消：中断 SSE 连接与状态轮询；任务可能仍在云端后台执行，可凭任务 ID 恢复
function cancelRun() {
  try { activeAbort?.abort(); } catch { /* 连接已结束 */ }
  stopStreamPolling();
  cancelQueuedStream();
  streamId.value = '';
  stopStatusPolling();
  restart();
  notify('已断开任务跟进（排队中的任务已出队；运行中的可能仍在后台执行，可通过任务 ID 恢复）');
}

// 放弃任务：删除后端任务快照并从最近任务移除（仅审核等非发布阶段的任务允许删除）
async function abandonJob() {
  if (!jobId.value) return;
  if (!window.confirm('确定放弃此任务？后端任务快照将被删除，已解析内容不可恢复。')) return;
  try {
    const r = await fetch(`${reviewBase.value}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}`, {
      method: 'DELETE', headers: authHeaders()
    });
    if (!r.ok) {
      let detail = '';
      try { const j = await r.json(); detail = j?.detail || j?.message || ''; } catch { /* 无响应体 */ }
      notify(detail || '放弃任务未成功（发布中的任务不可删除）', true);
      return;
    }
    forgetJob(jobId.value);
    restart();
    notify('任务已放弃');
  } catch {
    notify('放弃任务未成功，请重试', true);
  }
}

onBeforeUnmount(() => {
  stopStatusPolling();
  stopStreamPolling();
  stopReviewCountdown();
  stopKbPolling();
  // 决策草稿防抖冲刷：卸载前未到期的保存立即落地（刷新丢决策窗口归零）
  if (draftSaveTimer) { clearTimeout(draftSaveTimer); draftSaveTimer = null; }
  if (jobId.value && phase.value === 'review') {
    try { localStorage.setItem(reviewDraftKey(jobId.value), JSON.stringify(decisions.value)); } catch { /* 存储满等异常忽略 */ }
  }
  try { activeAbort?.abort(); } catch { /* 连接已结束 */ }
});

// ── 重裁弹窗 ──
// 预览源三级降级：page-assets 物理整页（96dpi，坐标直用）→
// W1 页面预览 /assets/{page_analysis_id}（120dpi；拆页时为逻辑视图，坐标按 source_bbox 映射）→
// 裁剪小图放大（按当前 pdf_bbox 映射回整页）
const cropSource = ref(''); // 'page' | 'w1' | 'crop'

// 当前裁剪区域（整页坐标系），重裁时叠加展示
const cropCurrentBox = computed(() => {
  const b = items.value[crop.value.index]?.pdf_bbox;
  return Array.isArray(b) && b.length === 4 && b.every(n => typeof n === 'number' && n >= 0 && n <= 1) ? b : null;
});

// 当前展示视图 → 物理整页坐标的线性变换：物理 = offset + 视图内坐标 * span
// page 层为恒等变换；w1 层为 source_bbox（逻辑页范围）；crop 层为当前 pdf_bbox
function cropViewTransform() {
  const item = items.value[crop.value.index];
  if (!item) return null;
  if (cropSource.value === 'w1') {
    const sb = Array.isArray(item.source_bbox) && item.source_bbox.length === 4 ? item.source_bbox : [0, 0, 1, 1];
    return { offset: [sb[0], sb[1]], span: [sb[2] - sb[0], sb[3] - sb[1]] };
  }
  if (cropSource.value === 'crop') {
    const cur = cropCurrentBox.value;
    if (!cur) return null;
    return { offset: [cur[0], cur[1]], span: [cur[2] - cur[0], cur[3] - cur[1]] };
  }
  return { offset: [0, 0], span: [1, 1] };
}

// 当前裁剪区域在展示视图坐标系下的位置（虚线叠加框）；不在视图内时隐藏
const cropCurrentBoxView = computed(() => {
  const item = items.value[crop.value.index];
  const b = cropCurrentBox.value;
  if (!item || !b) return null;
  if (cropSource.value === 'w1') {
    const sb = Array.isArray(item.source_bbox) && item.source_bbox.length === 4 ? item.source_bbox : [0, 0, 1, 1];
    const sw = sb[2] - sb[0], sh = sb[3] - sb[1];
    if (sw <= 0 || sh <= 0) return null;
    const v = [(b[0] - sb[0]) / sw, (b[1] - sb[1]) / sh, (b[2] - sb[0]) / sw, (b[3] - sb[1]) / sh];
    if (v.some(x => x < -0.02 || x > 1.02)) return null;
    return v.map(x => +Math.min(1, Math.max(0, x)).toFixed(4));
  }
  if (cropSource.value === 'crop') return null; // 小图本身就是当前区域，无需叠加
  return b;
});

const cropSubtitle = computed(() => {
  // 有当前区域叠加时提示参考物：高亮框即原裁剪范围，可直接拖拽调整或框选新区域替换
  // 拖动画新框后原框让位，提示语随之切换
  const drawing = crop.value.mode === 'drawn';
  const refHint = cropCurrentBoxView.value
    ? (drawing ? '。已框选新区域（原区域参考见读数）' : '。高亮框为当前裁剪范围：直接拖拽移动、拖边角调整大小，或框选新区域替换')
    : '';
  switch (cropSource.value) {
    case 'w1': {
      const sb = items.value[crop.value.index]?.source_bbox;
      const split = Array.isArray(sb) && (sb[0] !== 0 || sb[1] !== 0 || sb[2] !== 1 || sb[3] !== 1);
      return (split
        ? '整页预览不可用，已回退为页面预览（拆分页视图），框选坐标将自动映射回整页'
        : '整页预览不可用，已回退为页面预览，框选坐标与整页一致') + refHint;
    }
    case 'crop':
      return '整页预览不可用，已回退为裁剪图（小图已放大便于框选，坐标自动映射回整页）';
    default:
      return '在整页预览上拖动选择新区域' + refHint;
  }
});

// 编辑框（视图坐标）映射回物理整页坐标——applyCrop 与读数共用同一映射
const cropBoxPhysical = computed(() => {
  if (!crop.value.box) return null;
  const t = cropViewTransform();
  if (!t) return null;
  return [
    t.offset[0] + crop.value.box[0] * t.span[0],
    t.offset[1] + crop.value.box[1] * t.span[1],
    t.offset[0] + crop.value.box[2] * t.span[0],
    t.offset[1] + crop.value.box[3] * t.span[1],
  ].map(v => +Math.min(1, Math.max(0, v)).toFixed(4));
});

// 读数行：统一展示物理整页坐标（原区域本就是物理口径，新旧可直接对比）
const cropReadout = computed(() => {
  if (crop.value.box) {
    if (crop.value.mode === 'current') {
      const phys = cropBoxPhysical.value || crop.value.box;
      const orig = cropCurrentBox.value;
      return `调整后区域：${JSON.stringify(phys)}` + (orig ? `（原 ${JSON.stringify(orig)}）` : '');
    }
    return `新裁剪区域：${JSON.stringify(cropBoxPhysical.value || crop.value.box)}`;
  }
  return cropCurrentBox.value ? `当前区域：${JSON.stringify(cropCurrentBox.value)}` : '请拖动选择区域';
});

function openCrop(i) {
  crop.value = { ...blankCrop(), open: true, index: i };
  nextTick(() => {
    const item = items.value[i];
    cropSource.value = item.page_preview_url ? 'page' : (item.w1_page_url ? 'w1' : 'crop');
    cropImage.value.style.width = '';
    cropImage.value.style.maxWidth = '';
    cropImage.value.style.maxHeight = '';
    cropImage.value.style.imageRendering = '';
    cropImage.value.src = item.page_preview_url || item.w1_page_url || item.preview_url || '';
  });
}
function onCropImageError() {
  const item = items.value[crop.value.index];
  if (!item || cropSource.value === 'crop') return;
  // 降级换图：缩放状态随 fitW 一起失效，onCropImageLoad 重新测量
  crop.value.zoom = 1;
  crop.value.fitW = 0;
  if (cropSource.value === 'page' && item.w1_page_url) {
    // page-assets 不可用（如云端未部署该接口）→ W1 页面预览兜底
    cropSource.value = 'w1';
    cropImage.value.src = item.w1_page_url;
    return;
  }
  cropSource.value = 'crop';
  cropImage.value.src = item.preview_url || '';
}
// 回退形态下小裁剪图按比例放大到可框选的尺寸（候选区域可能只有页面的百分之几，
// 原始缩略图仅几十像素宽）。point() 基于渲染后的 boundingRect 计算坐标，放大不影响映射精度
function onCropImageLoad() {
  const img = cropImage.value;
  if (!img || !crop.value.open) return;
  // 每次换图重置缩放，并记录 100% 时的基础宽度（滚轮放大以此为基准）
  crop.value.zoom = 1;
  crop.value.fitW = 0;
  img.style.maxWidth = '';
  if (cropSource.value !== 'crop') {
    img.style.width = '';
    img.style.maxHeight = '';
    img.style.imageRendering = '';
  } else {
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (nw && nh) {
      const maxH = Math.max(window.innerHeight * 0.62, 320);
      const maxW = 800;
      const scale = Math.max(1, Math.min(maxW / nw, maxH / nh));
      if (scale > 1) {
        img.style.width = `${Math.round(nw * scale)}px`;
        // 放大倍数过大时用像素化渲染，线条图比平滑插值更容易看清框选位置
        img.style.imageRendering = scale >= 3 ? 'pixelated' : 'auto';
      } else {
        img.style.width = '';
        img.style.imageRendering = '';
      }
    }
  }
  crop.value.fitW = img.getBoundingClientRect().width;
}
function closeCrop() {
  crop.value = blankCrop();
  cropSource.value = '';
}
// ── 画布缩放（滚轮聚焦放大，锚定光标下的图像点）──
// 坐标口径不受影响：point() 基于放大后的 boundingRect 换算归一化值，
// 叠加框与遮罩都是 frame 内百分比定位，随缩放自动跟随
function applyCropZoom() {
  const img = cropImage.value;
  if (!img || !crop.value.open || !crop.value.fitW) return;
  if (crop.value.zoom <= 1) {
    img.style.maxWidth = '';
    img.style.maxHeight = '';
    img.style.width = cropSource.value === 'crop' ? `${Math.round(crop.value.fitW)}px` : '';
    nextTick(() => {
      const stage = cropStage.value;
      if (stage) { stage.scrollTop = 0; stage.scrollLeft = 0; }
    });
  } else {
    // 放大后解除 62vh 高度与 100% 宽度约束（否则宽度被钳在 stage 宽、横向放大失效），
    // 由 stage（max-height + overflow:auto）提供滚动视口
    img.style.maxWidth = 'none';
    img.style.maxHeight = 'none';
    img.style.width = `${Math.round(crop.value.fitW * crop.value.zoom)}px`;
  }
}
function setCropZoom(z) {
  if (!crop.value.open || crop.value.zoom === z) return;
  crop.value.zoom = z;
  applyCropZoom();
}
function onCropWheel(e) {
  const stage = cropStage.value;
  const img = cropImage.value;
  if (!crop.value.open || !stage || !img || !crop.value.fitW || !img.naturalWidth || !e.deltaY) return;
  e.preventDefault();
  // 触控板小幅滚动按比例缩放（鼠标一格 deltaY≈100 → 满 1.2 倍）
  const intensity = Math.min(1, Math.abs(e.deltaY) / 100);
  const factor = e.deltaY < 0 ? 1 + 0.2 * intensity : 1 / (1 + 0.2 * intensity);
  const next = Math.min(CROP_ZOOM_MAX, Math.max(1, +(crop.value.zoom * factor).toFixed(2)));
  if (next === crop.value.zoom) return;
  const sr = stage.getBoundingClientRect();
  const r = img.getBoundingClientRect();
  // 光标下的图像点比例（缩放后仍置于光标下；rect 已含滚动偏移，直接取相对值）
  const rx = (e.clientX - r.left) / r.width;
  const ry = (e.clientY - r.top) / r.height;
  crop.value.zoom = next;
  applyCropZoom();
  const nr = img.getBoundingClientRect();
  stage.scrollLeft += (nr.left - sr.left) + rx * nr.width - (e.clientX - sr.left);
  stage.scrollTop += (nr.top - sr.top) + ry * nr.height - (e.clientY - sr.top);
}
// ── 框选手势：已画框 框内按下=平移、边/角按下=拉伸、框外按下=重新框选；
// 未命中已画框时可直抓当前裁剪区域（高亮框）——复制为编辑中的新框，同样支持平移/拉伸。
// 边缘命中容差按屏幕像素换算成归一化值，不同缩放级别下手感一致 ──
const CROP_EDGE_PX = 8;    // 边/角命中容差（屏幕像素）
const CROP_MIN_SIZE = 0.02; // 拉伸最小宽高（与框选丢弃阈值一致）
const cropResizeCursors = {
  l: 'ew-resize', r: 'ew-resize', t: 'ns-resize', b: 'ns-resize',
  lt: 'nwse-resize', rb: 'nwse-resize', lb: 'nesw-resize', rt: 'nesw-resize',
};
const cropStageCursor = computed(() => {
  if (crop.value.drag === 'move') return 'grabbing';
  if (crop.value.drag === 'resize') return cropResizeCursors[crop.value.handle] || 'crosshair';
  if (crop.value.hover === 'move') return 'move';
  return cropResizeCursors[crop.value.hover] || '';
});
function insideCropBox(p, b) {
  if (!b) return false;
  // 微小容差：抓边缘时浮点换算（如 0.59999 vs 0.6）不应导致落空
  const EPS = 0.002;
  return p.x >= b[0] - EPS && p.x <= b[2] + EPS && p.y >= b[1] - EPS && p.y <= b[3] + EPS;
}
// 边/角命中：''=未命中 | 'l'|'r'|'t'|'b' | 角组合 'lt'/'rt'/'lb'/'rb'
function cropEdgeHit(p, b) {
  if (!b) return '';
  const img = cropImage.value;
  if (!img) return '';
  const r = img.getBoundingClientRect();
  if (!r.width || !r.height) return '';
  const tx = CROP_EDGE_PX / r.width;
  const ty = CROP_EDGE_PX / r.height;
  if (p.x < b[0] - tx || p.x > b[2] + tx || p.y < b[1] - ty || p.y > b[3] + ty) return '';
  const nearL = Math.abs(p.x - b[0]) <= tx;
  const nearR = Math.abs(p.x - b[2]) <= tx;
  const nearT = Math.abs(p.y - b[1]) <= ty;
  const nearB = Math.abs(p.y - b[3]) <= ty;
  // 框窄于两倍容差时两边同时命中：取较近的一边，避免手势歧义
  let h = '';
  if (nearL || nearR) h = (nearL && nearR)
    ? (Math.abs(p.x - b[0]) <= Math.abs(p.x - b[2]) ? 'l' : 'r')
    : (nearL ? 'l' : 'r');
  let v = '';
  if (nearT || nearB) v = (nearT && nearB)
    ? (Math.abs(p.y - b[1]) <= Math.abs(p.y - b[3]) ? 't' : 'b')
    : (nearT ? 't' : 'b');
  return h + v;
}
function startCropMove(p) {
  crop.value.drag = 'move';
  crop.value.grab = { dx: p.x - crop.value.box[0], dy: p.y - crop.value.box[1] };
}
function startCropResize(handle) {
  crop.value.drag = 'resize';
  crop.value.handle = handle;
  crop.value.base = [...crop.value.box];
}
function onCropPointerDown(e) {
  if (e.button !== 0) return; // 仅左键启动手势，右键/中键不干扰
  // 指针捕获：拖到弹窗外松开也能收到 pointerup，避免手势状态卡死
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 已释放等场景忽略 */ }
  const p = point(e);
  // 已画框优先：边/角=拉伸、框内=平移
  if (crop.value.box) {
    const h = cropEdgeHit(p, crop.value.box);
    if (h) { startCropResize(h); return; }
    if (insideCropBox(p, crop.value.box)) { startCropMove(p); return; }
  }
  // 未命中已画框时可直接抓当前裁剪区域：原框就地进入编辑（mode='current'，
  // 静态展示框让位给编辑框，视觉上就是拖动原框本身）；
  // 已在原位编辑时旧位置不再命中——避免把已挪走的框弹回原位
  const cur = crop.value.mode === 'current' ? null : cropCurrentBoxView.value;
  if (cur) {
    const h = cropEdgeHit(p, cur);
    if (h) { crop.value.box = [...cur]; crop.value.mode = 'current'; startCropResize(h); return; }
    if (insideCropBox(p, cur)) { crop.value.box = [...cur]; crop.value.mode = 'current'; startCropMove(p); return; }
  }
  crop.value.drag = 'draw';
  crop.value.start = p;
}
function onCropPointerMove(e) {
  // 兜底：capture 失效时（如异常路径漏掉 pointerup）左键已松开则立即结束手势，
  // 避免无按键的悬停移动继续平移/绘制
  if (crop.value.drag && !(e.buttons & 1)) { onCropPointerUp(); return; }
  if (crop.value.drag === 'resize') {
    const p = point(e);
    const b = [...crop.value.base];
    const h = crop.value.handle || '';
    // 被拖的边随指针走、对边固定为锚点；越界/过小 clamp 到画布与最小尺寸
    if (h.includes('l')) b[0] = Math.min(Math.max(p.x, 0), b[2] - CROP_MIN_SIZE);
    if (h.includes('r')) b[2] = Math.max(Math.min(p.x, 1), b[0] + CROP_MIN_SIZE);
    if (h.includes('t')) b[1] = Math.min(Math.max(p.y, 0), b[3] - CROP_MIN_SIZE);
    if (h.includes('b')) b[3] = Math.max(Math.min(p.y, 1), b[1] + CROP_MIN_SIZE);
    crop.value.box = b.map(v => +v.toFixed(4));
    return;
  }
  if (crop.value.drag === 'move') {
    const p = point(e);
    const g = crop.value.grab;
    const b = crop.value.box;
    if (!g || !b) return;
    const w = b[2] - b[0];
    const h = b[3] - b[1];
    // 平移后 clamp 在画布内，尺寸不变
    const nx = Math.min(1 - w, Math.max(0, p.x - g.dx));
    const ny = Math.min(1 - h, Math.max(0, p.y - g.dy));
    crop.value.box = [nx, ny, Math.min(1, nx + w), Math.min(1, ny + h)].map(v => +v.toFixed(4));
    return;
  }
  if (crop.value.drag === 'draw') { draw(e); return; }
  // 无手势时悬停反馈：已画框优先、其次当前区域；边/角=拉伸光标、框内=移动光标。
  // 原位编辑中旧位置已无框，不参与命中
  let hover = '';
  const p = point(e);
  for (const b of (crop.value.mode === 'current' ? [crop.value.box] : [crop.value.box, cropCurrentBoxView.value])) {
    if (!b) continue;
    const h = cropEdgeHit(p, b);
    if (h) { hover = h; break; }
    if (insideCropBox(p, b)) { hover = 'move'; break; }
  }
  crop.value.hover = hover;
}
function onCropPointerUp() {
  crop.value.drag = null;
  crop.value.start = null;
  crop.value.grab = null;
  crop.value.handle = '';
  crop.value.base = null;
}
function resetCrop() {
  crop.value.box = null;
  crop.value.mode = '';
  crop.value.start = null;
  setCropZoom(1);
}
function point(e) {
  const r = cropImage.value.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
    y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
  };
}
function draw(e) {
  if (!crop.value.start) return;
  const a = crop.value.start, b = point(e);
  const box = [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)];
  if (box[2] - box[0] > 0.02 && box[3] - box[1] > 0.02) {
    crop.value.box = box.map(x => +x.toFixed(4));
    crop.value.mode = 'drawn';
  } else {
    crop.value.box = null;
    crop.value.mode = '';
  }
}
function applyCrop() {
  if (!crop.value.box) return;
  const x = items.value[crop.value.index];
  // 框选坐标（视图内归一化）按当前视图变换映射回物理整页坐标
  const box = cropBoxPhysical.value;
  if (!box) { notify('无法确定当前裁剪区域，不能应用重裁', true); return; }
  decisions.value = { ...decisions.value, [x.source_crop_id]: { source_crop_id: x.source_crop_id, action: 'recrop', pdf_bbox: box } };
  saveReviewDraftSoon();
  addActivity('重新裁剪', x.product_name || '');
  closeCrop();
}

// 取消排队中的流（best-effort）：排队任务不再需要时出队；运行中的不可取消
// （后端 409），留着继续跑、可凭 stream_id 重挂。失败不影响调用方流程
async function cancelQueuedStream() {
  const sid = streamId.value;
  if (!sid) return;
  try {
    await fetch(`${API.stream}/${encodeURIComponent(sid)}`, { method: 'DELETE', headers: authHeaders() });
  } catch { /* best-effort：失败静默（流随 12h 清理白动回收） */ }
}

function restart() {
  try { activeAbort?.abort(); } catch { /* 连接已结束 */ }
  stopStreamPolling();
  // 排队中的流无人在看：best-effort 出队（运行中/终态则后端拒绝，无副作用）
  cancelQueuedStream();
  streamId.value = '';
  stopStatusPolling();
  stopReviewCountdown();
  // 重置：当前任务的审核草稿与「跟进中」标记一并清除（草稿仅服务刷新恢复）
  clearReviewDraft();
  parseStartedAt.value = 0;
  phase.value = 'upload';
  setStatus('waiting');
  file.value = null;
  pdfUrl.value = '';
  pdfName.value = '';
  jobId.value = '';
  eventId.value = '';
  retryResumed.value = false;
  reviewBase.value = '';
  retryCount.value = 0;
  submitting.value = false;
  restored.value = false;
  autoRest.value = false;
  hasEnteredReview.value = false;
  snapshotProducts.value = [];
  publish.value = { status: '', processed: 0, failed: 0, remaining: 0, hasMore: false, retrying: false, driving: false };
  exportState.value = { state: '', fileName: '', downloadUrl: '', tableId: '', tableName: '', error: '' };
  kbState.value = blankKbState();
  exportPreview.value = blankExportPreview();
  batchIndex.value = 0;
  message.value = '正在准备工作流…';
  batches.value = [];
  decisions.value = {};
  result.value = {};
  activity.value = [];
  activateStep(0);
}
</script>

<template>
  <div class="pdf-workbench" :class="{ embedded: props.embedded }">
    <Topbar v-if="!props.embedded" :status="statusMode" :status-text="statusText" />

    <main class="shell" :class="{ wide: phase === 'review' }">
      <Stepper v-if="!props.embedded" :phase="phase" :review-entered="hasEnteredReview" />

      <UploadView
        v-if="phase === 'upload'"
        v-model:review-mode="reviewMode"
        :file-label="fileLabel" :start-disabled="!canStart"
        :recent-jobs="recentJobs"
        :active-job="showActiveJobBanner ? activeJob : null"
        @choose="choose" @submit-url="useUrl" @start="start" @demo="demo"
        @restore="restoreJob" @resume-active="resumeActiveJob" @dismiss-active="dismissActiveJob" />

      <ProcessView
        v-else-if="phase === 'processing'"
        :message="message" :file-name="fileName" :file-url="fileUrlDisplay"
        :file-size="file?.size || 0"
        :activity="activity"
        :started-at="parseStartedAt"
        :steps="wSteps"
        :retry="retryInfo"
        @cancel="cancelRun" />

      <ReviewView
        v-else-if="phase === 'review'"
        :batches="batches" :batch-index="batchIndex" :items="items"
        :decisions="decisions" :activity="activity"
        :can-abandon="!!jobId" :auto-rest="autoRest" :auto-countdown="reviewCountdown"
        @select-batch="batchIndex = $event" @decide="decide"
        @approve-all="approveAll" @submit="submit" @abandon="abandonJob"
        @auto-rest="switchToAuto" />

      <ResultView
        v-else
        :product-count="result.product_count ?? '-'"
        :products-state="result.product_data_json ? '已生成' : '无数据'"
        :images-state="result.image_urls_json ? '已生成' : '无数据'"
        :products-json="productDataOutput" :images-json="imageUrlsOutput"
        :message="result.message || '所有候选图片已审核，结果如下。'"
        :publish="publish"
        :export-state="exportState"
        :export-preview="exportPreview"
        :kb-state="kbState"
        :kb-polling="kbPolling"
        :kb-last-checked-at="kbLastCheckedAt"
        :embedded="props.embedded"
        @restart="restart"
        @retry-failed="retryFailedPublish" @continue-publish="drivePublish"
        @export-xlsx="exportXlsx" @preview-export="toggleExportPreview"
        @import-knowledge="importKnowledge" @upload-kb="uploadKbFile"
        @commit-knowledge="commitKnowledge"
        @refresh-kb="refreshKbStatus" />
    </main>

    <Modal :open="crop.open" title="重新裁剪" :subtitle="cropSubtitle" @close="closeCrop">
      <div class="crop-wrap">
        <div class="crop-stage"
             ref="cropStage"
             :style="cropStageCursor ? { cursor: cropStageCursor } : undefined"
             @pointerdown.prevent="onCropPointerDown($event)"
             @pointermove.prevent="onCropPointerMove($event)"
             @pointerup.prevent="onCropPointerUp"
             @pointercancel="onCropPointerUp"
             @wheel="onCropWheel"
             @dblclick.prevent="setCropZoom(1)">
          <!-- crop-frame 精确包住可见图片区域：框选坐标与叠加框都相对图片本身，
               避免竖版页面在 max-height 约束下信箱式留白导致坐标错位 -->
          <div class="crop-frame">
            <img ref="cropImage" draggable="false" alt="page preview" @error="onCropImageError" @load="onCropImageLoad">
          <!-- 静态展示的原区域框；画新框（mode='drawn'）或原位编辑（mode='current'）时
               都让位——画布上任何时刻最多一个框，避免双框混淆 -->
          <div v-if="cropCurrentBoxView && !crop.mode" class="selection current"
               :style="{
                 left: (cropCurrentBoxView[0] * 100) + '%',
                 top: (cropCurrentBoxView[1] * 100) + '%',
                 width: ((cropCurrentBoxView[2] - cropCurrentBoxView[0]) * 100) + '%',
                 height: ((cropCurrentBoxView[3] - cropCurrentBoxView[1]) * 100) + '%'
               }"></div>
          <div v-if="crop.box" class="selection editing" :class="{ current: crop.mode === 'current' }"
               :style="{
                 left: (crop.box[0] * 100) + '%',
                 top: (crop.box[1] * 100) + '%',
                 width: ((crop.box[2] - crop.box[0]) * 100) + '%',
                 height: ((crop.box[3] - crop.box[1]) * 100) + '%'
               }">
            <!-- 四角手柄：提示可拖角/拖边调整大小 -->
            <i class="handle tl"></i><i class="handle tr"></i><i class="handle bl"></i><i class="handle br"></i>
          </div>
          </div>
        </div>
        <!-- 缩放指示徽标：点击复位 100%，双击画布同样复位 -->
        <button class="crop-zoom" type="button" title="点击恢复 100%" @click="setCropZoom(1)">{{ Math.round(crop.zoom * 100) }}%</button>
      </div>
      <div class="crop-readout">{{ cropReadout }}</div>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="closeCrop">取消</button>
        <!-- 重置：清掉画错的框并复位缩放，一步回到刚打开弹窗的状态 -->
        <button class="btn btn-secondary" type="button" :disabled="!crop.box && crop.zoom === 1" @click="resetCrop">重置</button>
        <button class="btn btn-primary" type="button" :disabled="!crop.box" @click="applyCrop">应用裁剪框</button>
      </template>
    </Modal>

    <Toast :message="toast" :error="toastError" />
  </div>
</template>

<style scoped>
/* ── Design Tokens ──
   桥接 WMS 全局主题变量（styles/index.scss :root / html.dark）：
   本组件的语义 token 直接引用全局变量，浅色/深色模式随系统切换自动生效；
   主 accent 对齐 WMS 品牌红 --primary，语义色对齐系统 status 色板。 */
.pdf-workbench {
  --bg-body: var(--bg-page);
  --bg-panel: var(--bg-white);
  --bg-elevated: var(--bg-white);
  --bg-subtle: var(--bg-hover);
  /* 卡片按压/选中态：品牌红极浅底（与 --primary-bg 同源、稍浅一档） */
  --bg-active: color-mix(in srgb, var(--primary) 4%, var(--bg-white));

  /* 与全局同名的 token（--bg-hover / --text-primary / --text-secondary /
     --text-tertiary / --shadow-sm / --shadow-md / --shadow-lg）不在此重定义，
     直接继承 :root 与 html.dark 的全局值，主题切换自动生效。
     --text-inverse 例外：本组件内它是"彩色底上的反白文字"
     （品牌红按钮、选中节点、图片上的角标），深浅模式都应为白色，
     而全局 --text-inverse 在深色下翻转为深字，故此处固定为白。 */
  --text-inverse: #ffffff;

  --border-default: var(--border-color);
  --border-strong: color-mix(in srgb, var(--text-primary) 22%, var(--border-color));
  --border-focus: var(--primary-lighter);
  --divider: var(--border-light);

  /* 主 accent：WMS 品牌红（600=主色、500=亮一档、50=浅底、900=深色 hover） */
  --accent-600: var(--primary);
  --accent-500: var(--primary-light);
  --accent-50: var(--primary-bg);
  --accent-900: var(--primary-dark);

  --danger-600: var(--danger);
  --danger-50: var(--danger-light);

  --warn-600: var(--warning);
  --warn-50: var(--warning-light);

  --info-600: var(--info);
  --info-50: var(--info-light);

  /* 审核语义色：通过=success 绿（流程成功语义，不随品牌红走） */
  --success-600: var(--success);
  --success-50: var(--success-light);

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --duration-fast: 120ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;

  --font-sans: "Inter", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  --bp-sm: 680px;
  --bp-md: 1080px;
  --bp-lg: 1280px;

  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg-body);
  color: var(--text-primary);
  font: 14px/1.6 var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

/* ── 嵌入模式（WMS 主布局内）──
   薄壳 ProductDocSplit 已给定高度，这里填满即可；
   position:relative 作为弹层 absolute 定位的包含块 */
.pdf-workbench.embedded {
  position: relative;
  min-height: 0;
  height: 100%;
  overflow: auto;
}

.pdf-workbench :deep(*),
.pdf-workbench :deep(*::before),
.pdf-workbench :deep(*::after) { box-sizing: border-box; }

.pdf-workbench :deep(button),
.pdf-workbench :deep(input) { font-family: inherit; font-size: inherit; }
.pdf-workbench :deep(button) { cursor: pointer; }

/* ── Animations ── */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 35%, transparent); }
  50%      { box-shadow: 0 0 0 6px transparent; }
}
@keyframes ring {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 25%, transparent); }
  50%      { box-shadow: 0 0 0 5px transparent; }
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes slideIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.pdf-workbench :deep(.fade-in) { animation: fadeIn 250ms var(--ease-out) forwards; }

/* ── Status Badge ── */
.pdf-workbench :deep(.status-badge) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-xl);
  font-size: 13px;
  font-weight: 500;
  transition: background var(--duration-fast), color var(--duration-fast);
}
.pdf-workbench :deep(.status-badge[data-status="waiting"]) { color: var(--text-tertiary); background: var(--bg-subtle); }
.pdf-workbench :deep(.status-badge[data-status="busy"]) { color: var(--accent-900); background: var(--accent-50); }
.pdf-workbench :deep(.status-badge[data-status="waiting-review"]) { color: var(--warn-600); background: var(--warn-50); }
.pdf-workbench :deep(.status-badge[data-status="done"]) { color: var(--success-600); background: var(--success-50); }
.pdf-workbench :deep(.status-badge[data-status="error"]) { color: var(--danger-600); background: var(--danger-50); }
.pdf-workbench :deep(.status-dot) { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.pdf-workbench :deep(.status-badge[data-status="busy"] .status-dot),
.pdf-workbench :deep(.status-badge[data-status="waiting-review"] .status-dot) {
  animation: pulse 1.6s var(--ease-in-out) infinite;
}

/* ── Stepper ── */
.pdf-workbench :deep(.stepper) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: var(--space-8) auto var(--space-6);
  max-width: 640px;
  padding: 0 var(--space-5);
}
.pdf-workbench :deep(.stepper-step) {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-tertiary);
  font-size: 13px;
  font-weight: 500;
  transition: color var(--duration-fast);
  white-space: nowrap;
}
/* 步骤条状态语义：完成=绿（与结果页流程卡 .flow-rail 一致）、当前=品牌红、未开始=灰；
   红色仅作品牌/激活语义，真正的失败走 --danger（避免“全红分不清已完成还是出错”） */
.pdf-workbench :deep(.stepper-step.done) { color: var(--success-600); }
.pdf-workbench :deep(.stepper-step.current) { color: var(--text-primary); font-weight: 600; }
.pdf-workbench :deep(.stepper-node) {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid currentColor;
  flex: none;
  font-size: 11px;
  font-weight: 700;
  transition: all var(--duration-fast);
}
.pdf-workbench :deep(.stepper-step.done .stepper-node) {
  background: var(--success-600);
  border-color: var(--success-600);
  color: #ffffff;
}
.pdf-workbench :deep(.stepper-step.current .stepper-node) {
  border-color: var(--accent-600);
  color: var(--accent-600);
  animation: ring 1.8s var(--ease-in-out) infinite;
}
.pdf-workbench :deep(.stepper-step:not(.done):not(.current) .stepper-node) {
  border-color: var(--border-strong);
  color: var(--text-tertiary);
}
.pdf-workbench :deep(.stepper-line) {
  flex: 1;
  height: 2px;
  max-width: 60px;
  background: var(--border-default);
  border-radius: 1px;
  transition: background var(--duration-fast);
}
.pdf-workbench :deep(.stepper-line.done) { background: color-mix(in srgb, var(--success-600) 45%, var(--border-default)); }

/* ── Layout ── */
.shell {
  flex: 1;
  max-width: 960px;
  margin: 0 auto;
  padding: 0 var(--space-6) var(--space-12);
  width: 100%;
}
.shell.wide { max-width: var(--bp-lg); }

/* ── Panel ── */
.pdf-workbench :deep(.panel) {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-panel);
  box-shadow: var(--shadow-md);
  padding: var(--space-10);
  animation: fadeIn 250ms var(--ease-out);
}
.pdf-workbench :deep(.panel-overline) {
  display: block;
  margin-bottom: var(--space-2);
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.pdf-workbench :deep(.panel-title) {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
}
.pdf-workbench :deep(.panel-lead) {
  margin: var(--space-3) 0 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

/* ── Buttons ── */
.pdf-workbench :deep(.btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 18px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  transition: all var(--duration-fast) var(--ease-out);
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  text-decoration: none;
}
.pdf-workbench :deep(.btn:focus-visible) { outline: 2px solid var(--accent-600); outline-offset: 2px; }
.pdf-workbench :deep(.btn:disabled) { opacity: 0.5; cursor: not-allowed; }
.pdf-workbench :deep(.btn:active:not(:disabled)) { transform: scale(0.98); }
.pdf-workbench :deep(.btn-primary) {
  background: var(--accent-600);
  color: var(--text-inverse);
  box-shadow: var(--shadow-sm);
  border-color: var(--accent-600);
}
.pdf-workbench :deep(.btn-primary:hover:not(:disabled)) {
  background: var(--accent-900);
  border-color: var(--accent-900);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
.pdf-workbench :deep(.btn-secondary) {
  border-color: var(--border-strong);
  background: var(--bg-panel);
  color: var(--text-secondary);
}
.pdf-workbench :deep(.btn-secondary:hover:not(:disabled)) {
  border-color: var(--border-default);
  background: var(--bg-hover);
}
.pdf-workbench :deep(.btn-ghost) { color: var(--text-tertiary); }
.pdf-workbench :deep(.btn-ghost:hover:not(:disabled)) {
  color: var(--text-secondary);
  background: var(--bg-subtle);
}
.pdf-workbench :deep(.btn-danger) {
  color: var(--danger-600);
  border-color: var(--border-strong);
  background: var(--bg-panel);
}
.pdf-workbench :deep(.btn-block) { width: 100%; }

/* ── Inputs ── */
.pdf-workbench :deep(.input) {
  width: 100%;
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--bg-panel);
  color: var(--text-primary);
  font-size: 14px;
  transition: border-color var(--duration-fast), box-shadow var(--duration-fast);
}
.pdf-workbench :deep(.input::placeholder) { color: var(--text-tertiary); }
.pdf-workbench :deep(.input:focus) {
  outline: none;
  border-color: var(--accent-600);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent);
}
.pdf-workbench :deep(.input:disabled) { background: var(--bg-subtle); color: var(--text-tertiary); }

/* ── Dropzone ── */
.pdf-workbench :deep(.dropzone) {
  position: relative;
  padding: 48px 24px;
  border: 2px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  text-align: center;
  transition: all var(--duration-normal) var(--ease-out);
}
.pdf-workbench :deep(.dropzone.drag) {
  border-color: var(--accent-600);
  border-style: solid;
  background: var(--accent-50);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.pdf-workbench :deep(.dropzone.drag .upload-icon-wrap) {
  background: var(--accent-600);
  color: var(--text-inverse);
  transform: scale(1.05);
}
.pdf-workbench :deep(.upload-icon-wrap) {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  color: var(--text-tertiary);
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-fast) var(--ease-out);
}
.pdf-workbench :deep(.upload-icon-wrap svg) { width: 24px; height: 24px; }
.pdf-workbench :deep(.dropzone-title) { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.pdf-workbench :deep(.dropzone-hint) { margin-top: 6px; color: var(--text-tertiary); font-size: 13px; }
.pdf-workbench :deep(.dropzone .btn-secondary) { margin-top: 18px; }

/* ── Toast ── */
.pdf-workbench :deep(.toast) {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 3000;
  max-width: 380px;
  padding: 14px 18px;
  border: 1px solid var(--border-default);
  border-left: 4px solid var(--accent-600);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  box-shadow: var(--shadow-lg);
  color: var(--text-primary);
  font-size: 14px;
  animation: slideIn 200ms var(--ease-out);
}
/* 嵌入模式：局限在内容区内，避免盖住 WMS 顶栏/侧边栏 */
.pdf-workbench.embedded :deep(.toast) {
  position: absolute;
  right: 16px;
  bottom: 16px;
}
.pdf-workbench :deep(.toast.error) { border-left-color: var(--danger-600); color: var(--danger-600); }

/* ── Modal ── */
.pdf-workbench :deep(.modal-bg) {
  position: fixed;
  inset: 0;
  z-index: 2500;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}
/* 嵌入模式：遮罩局限在内容区内（根容器已设 position:relative） */
.pdf-workbench.embedded :deep(.modal-bg) {
  position: absolute;
  padding: 12px;
}
/* 嵌入模式：视口变小（内容区高度 < 100vh），弹窗高度约束同步收窄 */
.pdf-workbench.embedded :deep(.modal) {
  max-height: calc(100% - 24px);
}
.pdf-workbench :deep(.modal) {
  width: min(860px, 100%);
  max-height: 92vh;
  overflow: auto;
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-lg);
}

/* ── 裁剪舞台 ── */
.crop-wrap { position: relative; }
.crop-stage {
  position: relative;
  /* 滚轮放大后的滚动视口；zoom=1 时内容不溢出，表现与原 overflow:hidden 一致 */
  overflow: auto;
  max-height: 62vh;
  background: #111827;
  border-radius: var(--radius-md);
  cursor: crosshair;
  user-select: none;
  touch-action: none;
  display: flex;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
}
/* frame 精确包裹可见图片（等比缩放、不 letterbox），
   叠加框与 point() 坐标因此都相对图片本身。
   居中用 margin:auto 而非 justify-content:center：
   内容溢出可滚动时 auto 边距归零回退为起点对齐，保证放大后左/上区域可达。
   flex:none 禁止收缩——放大后 frame 保持图片实际宽度，供 stage 滚动 */
.crop-frame {
  position: relative;
  flex: none;
  margin: auto;
  /* 裁掉当前区域外围遮罩（box-shadow 外扩）的溢出，使遮罩只覆盖图片区域 */
  overflow: hidden;
}
/* 已画框四角手柄：提示可拖角/拖边调整（恒定屏幕尺寸，不随缩放变化） */
.selection .handle {
  position: absolute;
  width: 9px;
  height: 9px;
  border: 1.5px solid var(--accent-600);
  background: #fff;
}
.selection .handle.tl { top: -5px; left: -5px; }
.selection .handle.tr { top: -5px; right: -5px; }
.selection .handle.bl { bottom: -5px; left: -5px; }
.selection .handle.br { bottom: -5px; right: -5px; }
/* 缩放指示徽标（悬浮于舞台右下角，点击复位） */
.crop-zoom {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 2;
  padding: 2px 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.72);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}
.crop-zoom:hover { background: rgba(17, 24, 39, 0.9); }
.crop-frame img {
  display: block;
  max-width: 100%;
  max-height: 62vh;
  width: auto;
  height: auto;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}
.selection {
  position: absolute;
  border: 2px solid #fff;
  background: color-mix(in srgb, var(--primary) 28%, transparent);
  pointer-events: none;
}
/* 当前裁剪区域（重裁参考）：区域外压暗遮罩 + 高亮实线边框，
   用户一眼看出"裁的是哪里、裁多大"，并与新框选直接对比。
   遮罩用外扩 box-shadow 实现，由 crop-frame overflow:hidden 裁在图片范围内。 */
.selection.current {
  border: 2px solid var(--warn-600);
  background: transparent;
  box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.45);
}
/* 对角短角标：强化瞄准框语义（左上 + 右下） */
.selection.current::before,
.selection.current::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  border: 3px solid var(--warn-600);
}
.selection.current::before { top: -2px; left: -2px; border-width: 3px 0 0 3px; }
.selection.current::after { bottom: -2px; right: -2px; border-width: 0 3px 3px 0; }
/* 原位编辑中的当前区域框：四角手柄已提供抓取提示，装饰角标退场避免重叠 */
.selection.current.editing::before,
.selection.current.editing::after { display: none; }
.crop-readout {
  margin-top: 10px;
  color: var(--text-tertiary);
  font: 12px var(--font-mono);
}

/* ── Responsive ── */
@media (max-width: 1080px) {
  .shell { max-width: 960px; }
}
@media (max-width: 680px) {
  .shell { padding: 0 var(--space-4) var(--space-8); }
  .pdf-workbench :deep(.panel) { padding: var(--space-6); }
  .pdf-workbench :deep(.panel-title) { font-size: 22px; }
}
</style>
