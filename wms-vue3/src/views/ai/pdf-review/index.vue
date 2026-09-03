<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import Topbar from './components/Topbar.vue';
import Stepper from './components/Stepper.vue';
import Modal from './components/Modal.vue';
import Toast from './components/Toast.vue';
import UploadView from './UploadView.vue';
import ProcessView from './ProcessView.vue';
import ReviewView from './ReviewView.vue';
import ResultView from './ResultView.vue';

// ── 后端 API ──
const API = {
  upload: '/api/v1/files/upload/pdf',
  start: '/api/v1/pdf-workflow/start',
  review: '/api/v1/plugin/pdf/jobs/{job_id}/review',
  reply: '/api/v1/pdf-workflow/resume'
};
// 云端部署的后端（工作流云函数在此建任务，本地 8001 查不到其任务快照）
const CLOUD_API_BASE = 'https://www.aster-mindlink.cn:7779';
// 审核数据源粘性寻址：任务建在哪个实例由审核数据里的图片 URL 源决定
// （interrupt 载荷中的 preview_url 指向任务实例），命中后固定使用该源，
// 避免每次请求都盲试本地/云端读到不一致的快照
const reviewBase = ref('');

function originOf(url) {
  try { return new URL(url).origin; } catch { return ''; }
}
// 从审核数据携带的图片 URL 推导任务实例（仅在尚未确定时采纳）
function adoptReviewBase(url) {
  if (reviewBase.value) return;
  const origin = originOf(url);
  if (origin) reviewBase.value = origin;
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
const crop = ref({ open: false, index: -1, box: null, start: null });
const cropImage = ref(null);
const result = ref({});
const activity = ref([]);
const retryCount = ref(0);
const submitting = ref(false);

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

// ── 最近任务（localStorage 自记录，跨会话恢复入口）──
const RECENT_JOBS_KEY = 'pdf_review_recent_jobs';
const JOB_STATUS_HINTS = {
  ready: '处理中', processing: '处理中', merging: '处理中',
  review_pending: '待审核', publishing: '发布中', publish_partial: '部分失败',
  published: '已完成', failed: '失败', canceled: '已取消'
};
const recentJobs = ref(loadRecentJobs());

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
}
function forgetJob(jobIdToForget) {
  recentJobs.value = recentJobs.value.filter(x => x.job_id !== jobIdToForget);
  saveRecentJobs();
}

// 解析失败自动重试上限
const MAX_PARSE_RETRY = 3;

// 重试状态（供处理页展示）
const retryInfo = computed(() => ({
  active: retryCount.value > 0,
  current: retryCount.value,
  max: MAX_PARSE_RETRY,
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
  activity.value.unshift({ title, detail });
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
      pdf_url: retryJobId ? '' : pdfUrl.value,
      pdf_name: pdfName.value,
      job_id: retryJobId,
      token: localStorage.getItem('token') || ''
    })
  });
  if (!r.ok) throw new Error(r.status === 401 ? '登录状态已失效，请重新登录' : '启动未成功，请重试');
  await sse(r);
}

async function start() {
  try {
    phase.value = 'processing';
    setStatus('busy', '正在上传');
    reviewBase.value = '';
    restored.value = false;
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
  phase.value = 'processing';
  setStatus('busy', `重试中（${retryCount.value}/${MAX_PARSE_RETRY}）`);
  message.value = `重试中（第 ${retryCount.value}/${MAX_PARSE_RETRY} 次），已完成的进度会保留…`;
  addActivity(`重试中 ${retryCount.value}/${MAX_PARSE_RETRY}`, reusedJobId ? '继续处理剩余内容' : '重新发起解析');
  // 复用 job_id 续跑时保留步骤条进度；无 job_id 才回卷到 W1
  if (!reusedJobId) {
    wSteps.value[0].state = 'active';
    wSteps.value[1].state = '';
    wSteps.value[2].state = '';
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
  if (d.job_id) {
    jobId.value = d.job_id;
    rememberJob(jobId.value);
  }

  if (name === 'message') {
    message.value = d.content || d.message || '工作流处理中';
    const text = message.value + ' ' + (d.node_title || '');
    if (/W2|merge|product/i.test(text)) { wSteps.value[0].state = 'done'; wSteps.value[1].state = 'active'; }
    if (/W3|review/i.test(text)) { wSteps.value[1].state = 'done'; wSteps.value[2].state = 'active'; }
    addActivity(d.node_title || 'Workflow', message.value);
  } else if (name === 'interrupt') {
    eventId.value = d.event_id || '';
    statusMode.value = 'waiting-review';
    statusText.value = '等待人工审核';
    wSteps.value[2].state = 'active';
    rememberJob(jobId.value, '待审核');
    phase.value = 'review';
    await loadReview(d);
    return true;
  } else if (name === 'done') {
    // End 节点为"返回变量"模式时流式 content 为空，直接查后端最终结果接口
    result.value = parse(d.full_content) || d;
    wSteps.value.forEach(s => s.state = 'done');
    phase.value = 'completed';
    setStatus('done');
    rememberJob(jobId.value, '已完成');
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
    return {
      source_crop_id: cropId,
      preview_url: preview || '',
      // 整页预览（重裁用）：网关规范化协议与旧后端均通过该接口按裁剪候选定位整页
      page_preview_url: cropId && jobIdForAssets
        ? `${base}/api/v1/plugin/pdf/jobs/${jobIdForAssets}/review/page-assets/${cropId}`
        : '',
      product_name: String(pickField(item, crop, 'product_name') || ''),
      image_type: String(pickField(item, crop, 'image_type') || 'other'),
      pdf_page_number: Number(pickField(item, crop, 'pdf_page_number') || 0),
      description: String(pickField(item, crop, 'description') || ''),
      pdf_bbox: pickField(item, crop, 'pdf_bbox'),
    };
  }).filter(x => x.source_crop_id);
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
      const items = normalizeReviewItems(container.items, jobId.value);
      batches.value = [];
      for (let n = 0; n < items.length; n += 8) batches.value.push({ items: items.slice(n, n + 8) });
      if (!batches.value.length) batches.value = [{ items: [] }];
      decisions.value = {};
      batchIndex.value = 0;
      addActivity('审核数据已加载', `${items.length} 张图片`);
      return;
    }

    const questionText = i.message || i.raw?.interrupt_data?.data?.content || '';
    // 中断消息未带 job_id 时，从图片 URL 中提取
    if (!jobId.value) {
      jobId.value = extractJobId(questionText) || extractJobId(i.raw ? JSON.stringify(i.raw) : '');
    }

    // 快照兜底：粘性源优先，本地 8001 次之，云端 7779 兜底（云端工作流建的任务本地查不到）
    let snap = null;
    if (jobId.value) {
      for (const base of reviewBases()) {
        try {
          const r = await fetch(`${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/review`, { headers: authHeaders() });
          if (!r.ok) continue;
          const d = await r.json();
          snap = parse(d.review_json) || d;
          if (snap?.crop_bindings?.length) {
            // 命中即粘住该实例，后续 final-result / page-assets 直接使用
            if (base) reviewBase.value = base;
            break;
          }
        } catch { continue; }
      }
    }

    const pending = (snap?.crop_bindings || []).filter(x => !x.review_action);
    const items = pending.length
      ? normalizeReviewItems(pending, jobId.value)
      : normalizeReviewItems(parseItemsFromText(questionText), jobId.value);

    batches.value = [];
    for (let n = 0; n < items.length; n += 8) batches.value.push({ items: items.slice(n, n + 8) });
    if (!batches.value.length) batches.value = [{ items: [] }];
    decisions.value = {};
    batchIndex.value = 0;
    if (items.length) addActivity('审核数据已加载', items.length + ' 张图片');
    else addActivity('当前批次无待审图片');
  } catch {
    addActivity('审核数据加载中断');
  }
}

// ── 审核 ──
const actionLabels = { approve: '通过', reject: '拒绝', skip: '跳过', recrop: '重裁' };

function decide(item, action) {
  if (action === 'recrop') { openCrop(items.value.indexOf(item)); return; }
  decisions.value = { ...decisions.value, [item.source_crop_id]: { source_crop_id: item.source_crop_id, action } };
  addActivity('决策', `${actionLabels[action]} · ${item.product_name || ''}`.trim());
}

function approveAll() {
  items.value.forEach(x => {
    decisions.value = { ...decisions.value, [x.source_crop_id]: { source_crop_id: x.source_crop_id, action: 'approve' } };
  });
  addActivity('全部通过', items.value.length + ' 张图片');
}

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
    // 提交成功后中断已失效，清空避免重复提交同一 event_id
    eventId.value = '';
    phase.value = 'processing';
    setStatus('busy', '处理中');
    addActivity('提交审核', `${payload.length} 张图片`);
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

// 恢复任务：按任务状态分支进入对应阶段（审核 / 发布 / 处理中只读跟进）
async function restoreJob(rawId) {
  const id = String(rawId || '').trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id)) { notify('请输入 32 位十六进制的任务 ID', true); return; }
  restart();
  restored.value = true;
  jobId.value = id;
  pdfName.value = recentJobs.value.find(x => x.job_id === id)?.pdf_name || '恢复的任务';
  phase.value = 'processing';
  setStatus('busy', '正在恢复任务');
  message.value = '正在查询任务状态…';
  addActivity('恢复任务', id);
  const job = await fetchJobStatus(id);
  if (!job) {
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
    wSteps.value[0].state = 'done';
    wSteps.value[1].state = 'active';
    pollProcessingStatus();
    return;
  }
  // failed / canceled
  notify(`任务状态异常（${JOB_STATUS_HINTS[job.status] || job.status}），无法恢复`, true);
  restart();
}

// 恢复会话进入审核阶段（无 SSE event_id，提交走直提通道）
async function restoreReview() {
  phase.value = 'review';
  statusMode.value = 'waiting-review';
  statusText.value = '等待人工审核';
  wSteps.value[0].state = 'done';
  wSteps.value[1].state = 'done';
  wSteps.value[2].state = 'active';
  await loadReviewSnapshot();
}

// 拉取审核快照：未决策的裁剪候选载入批次；快照产品记录备用（直提时默认通过）
async function loadReviewSnapshot() {
  let snap = null;
  for (const base of reviewBases()) {
    try {
      const r = await fetch(`${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/review`, { headers: authHeaders() });
      if (!r.ok) continue;
      const d = await r.json();
      snap = parse(d.review_json) || d;
      if (snap?.crop_bindings?.length) { if (base) reviewBase.value = base; break; }
    } catch { continue; }
  }
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
  if (items.length) {
    addActivity('审核数据已加载', `${items.length} 张图片（恢复会话）`);
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
  stopStatusPolling();
  restart();
  notify('已断开工作流连接（任务可能仍在后台执行，可通过任务 ID 恢复）');
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
  try { activeAbort?.abort(); } catch { /* 连接已结束 */ }
});

// ── 重裁弹窗 ──
// 整页预览不可用时（旧后端无 page-assets 接口）回退为裁剪图展示；
// 此时框选坐标按"裁剪图 = 当前 pdf_bbox 区域的渲染"映射回整页坐标
const cropFallback = ref(false);

// 当前裁剪区域（整页坐标系），重裁时叠加展示
const cropCurrentBox = computed(() => {
  const b = items.value[crop.value.index]?.pdf_bbox;
  return Array.isArray(b) && b.length === 4 && b.every(n => typeof n === 'number' && n >= 0 && n <= 1) ? b : null;
});

function openCrop(i) {
  crop.value = { open: true, index: i, box: null, start: null };
  cropFallback.value = false;
  nextTick(() => {
    cropImage.value.style.width = '';
    cropImage.value.style.imageRendering = '';
    cropImage.value.src = items.value[i].page_preview_url || items.value[i].preview_url || '';
  });
}
function onCropImageError() {
  const item = items.value[crop.value.index];
  if (!item || cropFallback.value || !item.page_preview_url) return;
  cropFallback.value = true;
  cropImage.value.src = item.preview_url || '';
}
// 回退形态下小裁剪图按比例放大到可框选的尺寸（候选区域可能只有页面的百分之几，
// 原始缩略图仅几十像素宽）。point() 基于渲染后的 boundingRect 计算坐标，放大不影响映射精度
function onCropImageLoad() {
  const img = cropImage.value;
  if (!img || !crop.value.open) return;
  if (!cropFallback.value) {
    img.style.width = '';
    img.style.imageRendering = '';
    return;
  }
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return;
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
function closeCrop() {
  crop.value.open = false;
  crop.value.index = -1;
  crop.value.box = null;
  crop.value.start = null;
  cropFallback.value = false;
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
  crop.value.box = (box[2] - box[0] > 0.02 && box[3] - box[1] > 0.02)
    ? box.map(x => +x.toFixed(4))
    : null;
}
function applyCrop() {
  if (!crop.value.box) return;
  const x = items.value[crop.value.index];
  let box = crop.value.box;
  if (cropFallback.value || !x.page_preview_url) {
    // 回退形态：当前展示的是裁剪图（即 pdf_bbox 区域的渲染），把框选坐标映射回整页坐标
    const cur = cropCurrentBox.value;
    if (!cur) { notify('无法确定当前裁剪区域，不能应用重裁', true); return; }
    const [cx0, cy0, cx1, cy1] = cur;
    box = [
      cx0 + box[0] * (cx1 - cx0),
      cy0 + box[1] * (cy1 - cy0),
      cx0 + box[2] * (cx1 - cx0),
      cy0 + box[3] * (cy1 - cy0),
    ].map(v => +Math.min(1, Math.max(0, v)).toFixed(4));
  }
  decisions.value = { ...decisions.value, [x.source_crop_id]: { source_crop_id: x.source_crop_id, action: 'recrop', pdf_bbox: box } };
  addActivity('重新裁剪', x.product_name || '');
  closeCrop();
}

function handleCopy(ok) {
  notify(ok ? '已复制到剪贴板' : '复制失败，请手动选择', !ok);
}
function restart() {
  try { activeAbort?.abort(); } catch { /* 连接已结束 */ }
  stopStatusPolling();
  phase.value = 'upload';
  setStatus('waiting');
  file.value = null;
  pdfUrl.value = '';
  pdfName.value = '';
  jobId.value = '';
  eventId.value = '';
  reviewBase.value = '';
  retryCount.value = 0;
  submitting.value = false;
  restored.value = false;
  snapshotProducts.value = [];
  publish.value = { status: '', processed: 0, failed: 0, remaining: 0, hasMore: false, retrying: false, driving: false };
  batchIndex.value = 0;
  message.value = '正在准备工作流…';
  batches.value = [];
  decisions.value = {};
  result.value = {};
  activity.value = [];
  wSteps.value[0].state = 'active';
  wSteps.value[1].state = '';
  wSteps.value[2].state = '';
}
</script>

<template>
  <div class="pdf-workbench">
    <Topbar :status="statusMode" :status-text="statusText" />

    <main class="shell" :class="{ wide: phase === 'review' }">
      <Stepper :phase="phase" />

      <UploadView
        v-if="phase === 'upload'"
        :file-label="fileLabel" :start-disabled="!canStart"
        :recent-jobs="recentJobs"
        @choose="choose" @submit-url="useUrl" @start="start" @demo="demo"
        @restore="restoreJob" />

      <ProcessView
        v-else-if="phase === 'processing'"
        :message="message" :file-name="fileName" :file-url="fileUrlDisplay"
        :steps="wSteps"
        :retry="retryInfo"
        @cancel="cancelRun" />

      <ReviewView
        v-else-if="phase === 'review'"
        :batches="batches" :batch-index="batchIndex" :items="items"
        :decisions="decisions" :activity="activity"
        :can-abandon="!!jobId"
        @select-batch="batchIndex = $event" @decide="decide"
        @approve-all="approveAll" @submit="submit" @abandon="abandonJob" />

      <ResultView
        v-else
        :product-count="result.product_count ?? '-'"
        :products-state="result.product_data_json ? '已生成' : '无数据'"
        :images-state="result.image_urls_json ? '已生成' : '无数据'"
        :products-json="productDataOutput" :images-json="imageUrlsOutput"
        :message="result.message || '所有候选图片已审核，结果如下。'"
        :publish="publish"
        @copy="handleCopy" @restart="restart"
        @retry-failed="retryFailedPublish" @continue-publish="drivePublish" />
    </main>

    <Modal :open="crop.open" title="重新裁剪" :subtitle="cropFallback ? '整页预览不可用，已回退为裁剪图（小图已放大便于框选，坐标自动映射回整页）' : '在整页预览上拖动选择新区域（虚线为当前裁剪区域）'" @close="closeCrop">
      <div class="crop-stage"
           @pointerdown.prevent="crop.start = point($event)"
           @pointermove.prevent="draw($event)"
           @pointerup.prevent="crop.start = null"
           @pointercancel="crop.start = null">
        <!-- crop-frame 精确包住可见图片区域：框选坐标与叠加框都相对图片本身，
             避免竖版页面在 max-height 约束下信箱式留白导致坐标错位 -->
        <div class="crop-frame">
          <img ref="cropImage" draggable="false" alt="page preview" @error="onCropImageError" @load="onCropImageLoad">
        <div v-if="cropCurrentBox && !cropFallback" class="selection current"
             :style="{
               left: (cropCurrentBox[0] * 100) + '%',
               top: (cropCurrentBox[1] * 100) + '%',
               width: ((cropCurrentBox[2] - cropCurrentBox[0]) * 100) + '%',
               height: ((cropCurrentBox[3] - cropCurrentBox[1]) * 100) + '%'
             }"></div>
        <div v-if="crop.box" class="selection"
             :style="{
               left: (crop.box[0] * 100) + '%',
               top: (crop.box[1] * 100) + '%',
               width: ((crop.box[2] - crop.box[0]) * 100) + '%',
               height: ((crop.box[3] - crop.box[1]) * 100) + '%'
             }"></div>
        </div>
      </div>
      <div class="crop-readout">
        {{ crop.box ? `新裁剪区域：${JSON.stringify(crop.box)}` : (cropCurrentBox ? `当前区域：${JSON.stringify(cropCurrentBox)}` : '请拖动选择区域') }}
      </div>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="closeCrop">取消</button>
        <button class="btn btn-primary" type="button" :disabled="!crop.box" @click="applyCrop">应用裁剪框</button>
      </template>
    </Modal>

    <Toast :message="toast" :error="toastError" />
  </div>
</template>

<style scoped>
/* ── Design Tokens ── */
.pdf-workbench {
  --bg-body: #f7f8fa;
  --bg-panel: #ffffff;
  --bg-elevated: #ffffff;
  --bg-subtle: #f1f4f6;
  --bg-hover: #f4f6f8;
  --bg-active: #eef9f4;

  --text-primary: #111827;
  --text-secondary: #4b5563;
  --text-tertiary: #9ca3af;
  --text-inverse: #ffffff;

  --border-default: #e5e7eb;
  --border-strong: #d1d5db;
  --border-focus: #9bcdb6;
  --divider: #f3f4f6;

  --accent-600: #0d8a6d;
  --accent-500: #10b981;
  --accent-50: #ecfdf5;
  --accent-900: #064e3b;

  --danger-600: #dc2626;
  --danger-50: #fef2f2;

  --warn-600: #d97706;
  --warn-50: #fffbeb;

  --info-600: #2563eb;
  --info-50: #eff6ff;

  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.08);

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
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.35); }
  50%      { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
}
@keyframes ring {
  0%, 100% { box-shadow: 0 0 0 0 rgba(13, 138, 109, 0.25); }
  50%      { box-shadow: 0 0 0 5px rgba(13, 138, 109, 0); }
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
.pdf-workbench :deep(.status-badge[data-status="done"]) { color: var(--accent-900); background: var(--accent-50); }
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
.pdf-workbench :deep(.stepper-step.done) { color: var(--accent-600); }
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
  background: var(--accent-600);
  border-color: var(--accent-600);
  color: var(--text-inverse);
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
.pdf-workbench :deep(.stepper-line.done) { background: var(--accent-500); }

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
  box-shadow: 0 0 0 3px rgba(13, 138, 109, 0.12);
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
.pdf-workbench :deep(.modal) {
  width: min(860px, 100%);
  max-height: 92vh;
  overflow: auto;
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-lg);
}

/* ── 裁剪舞台 ── */
.crop-stage {
  position: relative;
  overflow: hidden;
  background: #111827;
  border-radius: var(--radius-md);
  cursor: crosshair;
  user-select: none;
  touch-action: none;
  display: flex;
  justify-content: center;
}
/* frame 精确包裹可见图片（等比缩放、不 letterbox），
   叠加框与 point() 坐标因此都相对图片本身 */
.crop-frame {
  position: relative;
}
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
  background: rgba(13, 138, 109, 0.28);
  pointer-events: none;
}
/* 当前裁剪区域叠加（重裁基准，虚线区分于新框选） */
.selection.current {
  border: 2px dashed #f59e0b;
  background: rgba(245, 158, 11, 0.12);
}
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
