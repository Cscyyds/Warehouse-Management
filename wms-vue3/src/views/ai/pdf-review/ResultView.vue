<script setup>
import { computed, nextTick, ref, watch } from 'vue';
// DESIGN_SPEC 结果面板：指标卡 + 发布进度 + 图片墙（带描述）+ 重新解析
// 注：productsJson/imagesJson 仅作为画廊数据源在组件内部消费，不再渲染原始 JSON
const props = defineProps({
  productCount: { type: [String, Number], default: '-' },
  productsState: { type: String, default: '-' },
  imagesState: { type: String, default: '-' },
  productsJson: { type: String, default: '[]' },
  imagesJson: { type: String, default: '[]' },
  message: { type: String, default: '所有候选图片已审核，结果如下。' },
  publish: { type: Object, default: () => ({ status: '', processed: 0, failed: 0, remaining: 0, hasMore: false, retrying: false, driving: false }) },
  // xlsx 导出（最终产物）：飞书多维表格数据表 → xlsx
  // { state: ''|'exporting'|'ready'|'error', fileName, downloadUrl, tableName, error }
  exportState: { type: Object, default: () => ({ state: '', fileName: '', downloadUrl: '', tableName: '', error: '' }) },
  // 导出数据预览（免下载检查）：{ open, state: ''|'loading'|'ready'|'error',
  //   columns, rows, totalRows, truncated, error }
  exportPreview: { type: Object, default: () => ({ open: false, state: '', columns: [], rows: [], totalRows: 0, truncated: false, error: '' }) },
  // 知识库导入（两步式）：导出的 xlsx → 官方产品知识库
  // { state: ''|'importing'|'validated'|'committing'|'committed'|'error',
  //   importId, base, source: 'export'|'file', fileName, summary(批次摘要),
  //   errorRows(行级错误), commitResult, error }
  kbState: { type: Object, default: () => ({ state: '', importId: '', base: '', source: '', fileName: '', summary: null, errorRows: [], commitResult: null, error: '' }) },
  // 嵌入模式：图片预览遮罩从 fixed（浏览器视口）降级为 absolute（最近定位祖先），
  // 避免盖住 WMS 主布局顶栏/侧边栏
  embedded: { type: Boolean, default: false },
  // 提交后自动轮询（父组件驱动）：轮询中标志 + 最近一次刷新时间（epoch ms）
  kbPolling: { type: Boolean, default: false },
  kbLastCheckedAt: { type: Number, default: 0 }
});
const emit = defineEmits(['restart', 'retry-failed', 'continue-publish', 'export-xlsx',
  'preview-export', 'import-knowledge', 'upload-kb', 'commit-knowledge', 'refresh-kb']);

const publishBusy = computed(() => props.publish.driving || props.publish.retrying);
// 状态行文案：发布中 / 部分失败 / 已完成
const publishStatusText = computed(() => {
  if (props.publish.retrying) return '正在重试失败图片…';
  if (props.publish.driving) return '正在发布图片…';
  switch (props.publish.status) {
    case 'publishing': return '发布中';
    case 'publish_partial': return '发布完成（部分图片失败）';
    case 'published': return '发布完成';
    default: return props.publish.status ? props.publish.status : '';
  }
});

// 图片墙：优先从 product_data_json 构建富数据（URL + 描述 + 类型 + 页码 + 产品名），
// product_data_json 解析不到时回退 image_urls_json 纯 URL 列表
const TYPE_LABELS = {
  main: '主图', size: '尺寸图', install: '安装图',
  detail: '细节图', structure: '结构图', other: '其他图',
};
const galleryItems = computed(() => {
  const items = [];
  const seen = new Set();
  const push = (url, meta = {}) => {
    if (!url || typeof url !== 'string' || seen.has(url)) return;
    seen.add(url);
    items.push({
      url,
      description: String(meta.description || ''),
      typeLabel: TYPE_LABELS[meta.image_type] || '',
      pageNumber: Number(meta.page_number) || 0,
      productName: String(meta.product_name || ''),
    });
  };
  try {
    const parsed = JSON.parse(props.productsJson);
    for (const p of (Array.isArray(parsed) ? parsed : [])) {
      const name = String(p?.product_basic?.product_name || p?.product_name || '');
      for (const img of (p?.product_images || [])) {
        push(img?.image_url, {
          description: img?.description,
          image_type: img?.image_type,
          page_number: img?.page_number,
          product_name: name,
        });
      }
    }
  } catch { /* 回退到 URL 列表 */ }
  if (!items.length) {
    try {
      const urls = JSON.parse(props.imagesJson);
      (Array.isArray(urls) ? urls : []).forEach(u => push(u));
    } catch { /* 无图片 */ }
  }
  return items;
});
// 图片说明文案：描述 → 类型 → 页码 → 序号，逐级兜底
function captionOf(item, index) {
  if (item.description) return item.description;
  if (item.typeLabel) return item.typeLabel + (item.pageNumber ? ` · 第 ${item.pageNumber} 页` : '');
  if (item.pageNumber) return `第 ${item.pageNumber} 页`;
  return `图片 ${index + 1}`;
}
// 加载失败的图片（占位提示，不阻塞其他图）
const broken = ref({});
function markBroken(url) { broken.value = { ...broken.value, [url]: true }; }
// 点击放大（遮罩内带描述与产品名）
const preview = ref(null);
function openPreview(item) { preview.value = item; }
function closePreview() { preview.value = null; }

// xlsx 导出（最终产物）：数据表名可读时显示在按钮说明里
const exporting = computed(() => props.exportState.state === 'exporting');
const exportReady = computed(() => props.exportState.state === 'ready' && !!props.exportState.downloadUrl);
// ① 引导语：始终显示在步骤标题下，随状态切换文案（kbStarted 定义在下方，computed 惰性求值不受影响）
const exportGuide = computed(() => {
  if (exporting.value) return '正在从飞书多维表格导出…';
  if (props.exportState.state === 'error') return props.exportState.error || '导出失败，可点击重新导出';
  if (exportReady.value) {
    return kbStarted.value
      ? '数据如有更新可重新导出；当前产物仍可用于第 2 步校验。'
      : '可先「页内预览」或下载检查，确认无误后进入第 2 步校验。';
  }
  return props.exportState.tableName
    ? `把数据表「${props.exportState.tableName}」的产品数据导出为 Excel，便于检查或归档。`
    : '把本次解析的产品数据导出为 Excel，便于检查或归档。';
});

// ── 知识库导入（两步式：编排路由校验 → 自带接口提交索引）──
const kbSummary = computed(() => props.kbState.summary || {});
// 校验通过才可提交：批次 status 必须是 validated（行级错误或工作簿级
// 失败都会落 validation_failed，后端 commit 同样 409 兜底）
const kbCommittable = computed(() => kbSummary.value.status === 'validated');
// 提交后的批次状态文案（索引在后台异步执行，手动刷新更新）
const KB_COMMITTED_TEXT = {
  committed: '已提交，正在建立检索索引',
  indexing: '正在建立检索索引（后台进行中）',
  active: '已完成，知识库可检索',
  active_partial: '部分内容建立索引失败',
};
const kbCommittedText = computed(() => {
  const s = kbSummary.value;
  const base = KB_COMMITTED_TEXT[s.status] || `状态：${s.status || '已提交'}`;
  const failed = Array.isArray(props.kbState.commitResult?.dispatch_failed_job_ids)
    ? props.kbState.commitResult.dispatch_failed_job_ids.length : 0;
  return failed ? `${base}（${failed} 个索引任务投递失败）` : base;
});
const kbHint = computed(() => {
  switch (props.kbState.state) {
    case 'importing': return '正在校验…';
    case 'error': return props.kbState.error || '校验失败，可修改后重试';
    case 'validated':
    case 'committing': return '校验通过，确认无误后可以提交；提交后会自动建立检索索引';
    case 'committed': return '已发布到知识库';
    default: return exportReady.value
      ? '校验这份导出数据，或上传你改好的 Excel'
      : '上传你改好的 Excel 参与校验（不要求先导出）';
  }
});
const showKbErrors = ref(false);

// 校验结果来源标记：区分「服务端产物」与「用户回传的文件」
const kbSourceText = computed(() => (props.kbState.source === 'file'
  ? `来源：本地文件 ${props.kbState.fileName || ''}`.trim()
  : '来源：本次导出'));

// ── 三步流程指示（① 导出数据 → ② 校验数据 → ③ 提交入库）──
// 上传本地文件通道不要求先导出：步骤②可在①未完成时激活（不假装①已完成）
const kbStarted = computed(() => !!props.kbState.state && props.kbState.state !== 'error');
const flowSteps = computed(() => {
  const done1 = exportReady.value;
  const done2 = props.kbState.state === 'committed';
  const done3 = ['active', 'active_partial'].includes(kbSummary.value.status || '');
  let current = 1;
  if (done1 || kbStarted.value) current = 2;
  if (done2) current = 3;
  if (done3) current = 4;
  return [
    { key: 'export', label: '导出数据', state: done1 ? 'done' : (current === 1 ? 'active' : 'todo') },
    { key: 'validate', label: '校验数据', state: done2 ? 'done' : (current === 2 ? 'active' : 'todo') },
    { key: 'index', label: '提交入库', state: done3 ? 'done' : (current === 3 ? 'active' : 'todo') },
  ];
});
// 步骤条每段的状态词（用户语言；②不依赖①，未导出时提示可直接上传）
function railStatusText(step) {
  if (step.key === 'export') {
    if (step.state === 'done') return '已生成';
    return step.state === 'active' ? '待导出' : '未开始';
  }
  if (step.key === 'validate') {
    if (step.state === 'done') return '校验通过';
    if (step.state !== 'active') return '未开始';
    return exportReady.value ? '待校验' : '可直接上传';
  }
  if (step.state === 'done') return kbSummary.value.status === 'active_partial' ? '部分失败' : '已提交';
  if (step.state === 'active') return props.kbState.state === 'committing' ? '提交中' : '待提交';
  return '等待校验';
}
// ② 是否为“当前推荐步骤”：决定校验按钮用主按钮还是次按钮（一屏只有一个红色主操作）
const validateIsCurrent = computed(() => !kbStarted.value);

// ── 步骤折叠（渐进披露）──
// 规则：当前步骤强制展开；已完成步骤默认收起为一行摘要（可手动展开/收起）；
//       未开始步骤本身只有一行预告，不参与折叠。
// 折叠不破坏“一屏一红”：主按钮始终在当前步骤，收起步骤里只有描边/文本按钮。
const flowPanel = ref(null);
const stepOpenOverride = ref({});
function stepStateOf(key) {
  return flowSteps.value.find(s => s.key === key)?.state || 'todo';
}
function isStepOpen(key) {
  const state = stepStateOf(key);
  if (state === 'todo') return true;   // 未开始步骤本身只有一行预告
  if (state === 'active') return true; // 当前步骤不可收起（保住主操作可见）
  return stepOpenOverride.value[key] === true;
}
function toggleStep(key) {
  if (stepStateOf(key) !== 'done') return;
  stepOpenOverride.value = { ...stepOpenOverride.value, [key]: !isStepOpen(key) };
}
// 状态推进时把当前步骤平滑滚进视野（首次渲染不滚，避免一进页面就跳动）
const currentStepKey = computed(() => flowSteps.value.find(s => s.state === 'active')?.key || '');
watch(currentStepKey, (key, prev) => {
  if (!key || !prev) return;
  nextTick(() => {
    flowPanel.value?.querySelector(`[data-step="${key}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
});
// 校验出现行级错误时默认展开明细；新一轮校验开始（importing）时收起旧明细
watch(() => props.kbState.state, (state) => {
  if (state === 'importing') { showKbErrors.value = false; return; }
  if ((state === 'validated' || state === 'committing') && props.kbState.errorRows.length > 0) {
    showKbErrors.value = true;
  }
});
// ③ 提交后的自动刷新提示（父组件轮询中才显示）
function formatClock(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
const kbPollText = computed(() => {
  if (!props.kbPolling) return '';
  return props.kbLastCheckedAt ? `自动刷新中 · 最近更新 ${formatClock(props.kbLastCheckedAt)}` : '自动刷新中（每 5 秒）';
});

// ── 回传上传（拖拽 + 点击）──
const dragOver = ref(false);
const uploadInput = ref(null);
function pickUpload() { uploadInput.value?.click(); }
function onUploadPick(e) {
  const f = e?.target?.files?.[0];
  if (f) emit('upload-kb', f);
  if (e?.target) e.target.value = '';   // 允许重复选择同一文件（改完再传）
}
function onUploadDrop(e) {
  dragOver.value = false;
  const f = e?.dataTransfer?.files?.[0];
  if (f) emit('upload-kb', f);
}

// ── 导出数据预览（区别于图片放大遮罩的 preview ref）──
const expPreview = computed(() => props.exportPreview || {});
const expPreviewRows = computed(() => expPreview.value.rows || []);
const expPreviewColumns = computed(() => expPreview.value.columns || []);
</script>

<template>
  <section class="panel result-panel fade-in">
    <div class="panel-header">
      <span class="panel-overline">PDF PIPELINE / 04</span>
      <h1 class="panel-title">解析完成</h1>
      <p class="panel-lead">{{ props.message }}</p>
    </div>

    <div class="result-grid">
      <div class="result-card"><span>产品数量</span><strong>{{ props.productCount }}</strong></div>
      <div class="result-card"><span>产品数据</span><strong>{{ props.productsState }}</strong></div>
      <div class="result-card"><span>正式图片</span><strong>{{ props.imagesState }}</strong></div>
    </div>

    <!-- 发布进度：S3 发布可见性（已发布 / 失败 / 剩余 + 重试、续跑入口） -->
    <div v-if="props.publish.status" class="publish-panel" :data-status="props.publish.status">
      <div class="publish-head">
        <span v-if="publishBusy" class="publish-spinner" aria-hidden="true"></span>
        <strong>{{ publishStatusText }}</strong>
        <span class="publish-counts">
          已发布 {{ props.publish.processed }} · 失败 {{ props.publish.failed }} · 剩余 {{ props.publish.remaining }}
        </span>
      </div>
      <div class="publish-actions">
        <button v-if="props.publish.failed > 0" class="btn btn-secondary" type="button"
                :disabled="publishBusy" @click="emit('retry-failed')">重试失败图片</button>
        <button v-if="props.publish.status === 'publishing' && props.publish.remaining > 0"
                class="btn btn-secondary" type="button"
                :disabled="publishBusy" @click="emit('continue-publish')">继续发布剩余</button>
      </div>
    </div>

    <!-- 数据产物 → 知识库：三步闭环流程卡（导出 → 校验导入 → 提交入库） -->
    <div ref="flowPanel" class="flow-panel" :data-state="props.kbState.state || 'idle'"
         :data-export-state="props.exportState.state || 'idle'">
      <div class="flow-head">
        <div class="export-info">
          <strong>发布到知识库</strong>
          <span class="export-hint">导出 Excel 检查 → 校验 → 提交入库，全程在本页完成</span>
        </div>
        <!-- 步骤条：唯一的进度状态源（已完成 / 进行中 / 未开始），与下方区块标题不再重复表达 -->
        <ol class="flow-rail" aria-label="发布流程">
          <li v-for="(s, i) in flowSteps" :key="s.key" class="rail-seg" :class="s.state"
              :aria-current="s.state === 'active' ? 'step' : undefined">
            <span class="rail-node" aria-hidden="true">{{ s.state === 'done' ? '✓' : i + 1 }}</span>
            <span class="rail-text">
              <em>{{ s.label }}</em>
              <small>{{ railStatusText(s) }}</small>
            </span>
            <span v-if="i < flowSteps.length - 1" class="rail-line" aria-hidden="true"></span>
          </li>
        </ol>
      </div>

      <!-- ① 导出（含免下载预览）：已完成时收起为摘要行 -->
      <div v-if="isStepOpen('export')" class="flow-block" data-step="export">
        <div class="flow-block-head">
          <strong>① 导出数据</strong>
          <span class="export-hint">{{ exportGuide }}</span>
        </div>
        <!-- 产物文件行：替代原来裸露在标题下的文件名说明 -->
        <div v-if="exportReady" class="export-file" :title="props.exportState.fileName || ''">
          <span class="export-file-tag">Excel</span>
          <span class="export-file-name">{{ props.exportState.fileName || 'products.xlsx' }}</span>
        </div>
        <div class="export-actions">
          <a v-if="exportReady" class="btn btn-secondary" :href="props.exportState.downloadUrl"
             :download="props.exportState.fileName || 'products.xlsx'">下载 Excel</a>
          <button v-else class="btn btn-primary" type="button" :disabled="exporting"
                  @click="emit('export-xlsx')">
            <span v-if="exporting" class="publish-spinner" aria-hidden="true"></span>
            {{ exporting ? '导出中…' : '导出 Excel' }}
          </button>
          <button v-if="exportReady" class="btn btn-secondary" type="button"
                  @click="emit('preview-export')">
            {{ expPreview.open ? '收起预览' : '页内预览（免下载）' }}
          </button>
          <!-- 已生成后仍可重新导出：数据表在飞书侧可能已被继续编辑 -->
          <button v-if="exportReady" class="btn btn-ghost" type="button"
                  :disabled="exporting" @click="emit('export-xlsx')">重新导出</button>
        </div>
        <!-- 预览表：前 N 行纯文本，横向滚动（列数多） -->
        <div v-if="expPreview.open" class="preview-box">
          <div v-if="expPreview.state === 'loading'" class="kb-body">
            <span class="publish-spinner" aria-hidden="true"></span>
            <span class="kb-text">正在读取预览数据…</span>
          </div>
          <p v-else-if="expPreview.state === 'error'" class="kb-error">{{ expPreview.error }}</p>
          <template v-else>
            <div class="preview-scroll">
              <table>
                <thead>
                  <tr><th v-for="(c, ci) in expPreviewColumns" :key="ci">{{ c }}</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(row, ri) in expPreviewRows" :key="ri">
                    <td v-for="(v, ci) in row" :key="ci">{{ v }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <span class="preview-meta">
              前 {{ expPreviewRows.length }} 行 / 共 {{ expPreview.totalRows }} 行
              {{ expPreview.truncated ? '（已截断，完整数据请下载查看）' : '' }}
            </span>
          </template>
        </div>
      </div>
      <!-- ① 已完成：一行摘要（文件名 + 下载 + 展开） -->
      <div v-else class="flow-block flow-block-collapsed" data-step="export">
        <div class="flow-block-summary" @click="toggleStep('export')">
          <span class="sum-check" aria-hidden="true">✓</span>
          <span class="sum-title">① 导出数据</span>
          <span class="sum-state">已生成</span>
          <span class="sum-detail" :title="props.exportState.fileName || ''">{{ props.exportState.fileName || 'products.xlsx' }}</span>
          <a class="btn btn-secondary sum-btn" :href="props.exportState.downloadUrl"
             :download="props.exportState.fileName || 'products.xlsx'" @click.stop>下载 Excel</a>
          <button class="btn btn-ghost sum-btn" type="button" @click.stop="toggleStep('export')">展开</button>
        </div>
      </div>

      <!-- ② 校验数据（产物直提 / 本地回传，两通道共用校验与摘要）：已完成后收起为摘要行 -->
      <div v-if="isStepOpen('validate')" class="flow-block" data-step="validate">
        <div class="flow-block-head">
          <strong>② 校验数据</strong>
          <span class="export-hint kb-hint">{{ kbHint }}</span>
        </div>
        <!-- 主通道：直接校验本次导出产物。已有校验结果时再次触发会先确认
             替换（重复导入按图册记录 id 幂等 upsert，不怕重来） -->
        <div v-if="exportReady" class="kb-entry">
          <button :class="['btn', validateIsCurrent ? 'btn-primary' : 'btn-secondary']" type="button"
                  @click="emit('import-knowledge')">校验这份导出数据</button>
        </div>
        <!-- 备选通道：本地文件（不要求先导出），与主通道用“或”分隔 -->
        <div v-if="exportReady" class="kb-or" role="separator" aria-orientation="horizontal"><span>或</span></div>
        <label class="upload-zone" :class="{ dragging: dragOver }"
               @dragover.prevent="dragOver = true" @dragleave="dragOver = false"
               @drop.prevent="onUploadDrop">
          <input ref="uploadInput" type="file" accept=".xlsx" hidden @change="onUploadPick">
          <span class="upload-hint">上传你改好的 Excel（.xlsx）：拖拽到此处，或</span>
          <button class="btn btn-secondary" type="button"
                  @click.stop.prevent="pickUpload">选择文件</button>
        </label>
        <!-- 状态区：校验中 / 校验结果 / 提交结果 / 失败原因 -->
        <div v-if="props.kbState.state" class="kb-body">
          <template v-if="props.kbState.state === 'importing'">
            <span class="publish-spinner" aria-hidden="true"></span>
            <span class="kb-text">
              正在校验{{ props.kbState.source === 'file' ? ` ${props.kbState.fileName}` : '导出数据' }}…
            </span>
          </template>
          <template v-else-if="props.kbState.state === 'validated' || props.kbState.state === 'committing'">
            <!-- 统计结构化：数字先行，“能不能提交、错在哪”一眼可读 -->
            <div class="kb-stats">
              <div class="kb-stat"><span>总行</span><strong>{{ kbSummary.total_rows ?? '-' }}</strong></div>
              <div class="kb-stat" :class="{ 'is-valid': (kbSummary.valid_rows ?? 0) > 0 }"><span>有效</span><strong>{{ kbSummary.valid_rows ?? '-' }}</strong></div>
              <div class="kb-stat" :class="{ 'is-warn': !!kbSummary.warning_rows }"><span>警告</span><strong>{{ kbSummary.warning_rows ?? 0 }}</strong></div>
              <div class="kb-stat" :class="{ 'is-error': !!kbSummary.error_rows }"><span>错误</span><strong>{{ kbSummary.error_rows ?? 0 }}</strong></div>
            </div>
            <div class="kb-meta-row">
              <span class="kb-source">{{ kbSourceText }}</span>
              <span v-if="!kbCommittable" class="kb-error">{{ kbSummary.error_message || '校验未通过，请修改后重新校验' }}</span>
              <button v-if="props.kbState.errorRows.length" class="btn btn-secondary" type="button"
                      @click="showKbErrors = !showKbErrors">
                {{ showKbErrors ? '收起明细' : `错误明细（${props.kbState.errorRows.length}）` }}
              </button>
            </div>
          </template>
          <template v-else-if="props.kbState.state === 'committed'">
            <span class="kb-text">{{ kbCommittedText }}</span>
            <span class="kb-source">{{ kbSourceText }}</span>
          </template>
          <span v-if="props.kbState.state === 'error' && props.kbState.error" class="kb-error">
            {{ props.kbState.error }}
          </span>
        </div>
        <!-- 行级错误明细（行号 + 原因） -->
        <ul v-if="showKbErrors && props.kbState.errorRows.length" class="kb-errors">
          <li v-for="row in props.kbState.errorRows" :key="row.row_no">
            第 {{ row.row_no }} 行：{{ (row.errors || []).join('；') || '未知错误' }}
          </li>
        </ul>
      </div>
      <!-- ② 已完成：一行摘要（校验结论 + 展开可重新校验） -->
      <div v-else class="flow-block flow-block-collapsed" data-step="validate">
        <div class="flow-block-summary" @click="toggleStep('validate')">
          <span class="sum-check" aria-hidden="true">✓</span>
          <span class="sum-title">② 校验数据</span>
          <span class="sum-state">校验通过</span>
          <span class="sum-detail">有效 {{ kbSummary.valid_rows ?? '-' }} · 错误 {{ kbSummary.error_rows ?? 0 }}</span>
          <button class="btn btn-ghost sum-btn" type="button" @click.stop="toggleStep('validate')">展开</button>
        </div>
      </div>

      <!-- ③ 提交入库（commit + 后台索引，自动刷新，可手动补刷） -->
      <div v-if="isStepOpen('index')" class="flow-block" data-step="index">
        <div class="flow-block-head">
          <strong>③ 提交入库</strong>
          <span class="export-hint">
            {{ props.kbState.state === 'committed'
              ? '已提交，正在建立检索索引；完成后知识库可检索'
              : '校验通过后可以提交；提交后会自动建立检索索引' }}
          </span>
        </div>
        <div class="kb-body">
          <template v-if="props.kbState.state === 'validated' || props.kbState.state === 'committing'">
            <button v-if="kbCommittable" class="btn btn-primary" type="button"
                    :disabled="props.kbState.state === 'committing'" @click="emit('commit-knowledge')">
              <span v-if="props.kbState.state === 'committing'" class="publish-spinner" aria-hidden="true"></span>
              {{ props.kbState.state === 'committing' ? '提交中…' : '提交入库' }}
            </button>
            <span v-else class="kb-text">校验未通过，请按第 2 步的错误明细修改后重新校验</span>
          </template>
          <template v-else-if="props.kbState.state === 'committed'">
            <span class="kb-text">{{ kbCommittedText }}</span>
            <button class="btn btn-secondary" type="button" @click="emit('refresh-kb')">刷新状态</button>
            <!-- 自动轮询中：显示刷新节奏与最近更新时间（到终态自动停） -->
            <span v-if="kbPollText" class="kb-poll">
              <span class="publish-spinner" aria-hidden="true"></span>{{ kbPollText }}
            </span>
          </template>
          <!-- 未到步骤：占位按钮 + 说明，替代原来的“等待②校验通过…” -->
          <template v-else>
            <button class="btn btn-secondary" type="button" disabled>提交入库</button>
            <span class="kb-text">完成第 2 步「校验数据」后即可提交；提交后会自动建立检索索引。</span>
          </template>
        </div>
      </div>
      <!-- ③ 已完成：一行摘要（入库结论 + 展开） -->
      <div v-else class="flow-block flow-block-collapsed" data-step="index">
        <div class="flow-block-summary" @click="toggleStep('index')">
          <span class="sum-check" aria-hidden="true">✓</span>
          <span class="sum-title">③ 提交入库</span>
          <span class="sum-state">{{ kbSummary.status === 'active_partial' ? '部分失败' : '已提交' }}</span>
          <span class="sum-detail">{{ kbCommittedText }}</span>
          <button class="btn btn-ghost sum-btn" type="button" @click.stop="toggleStep('index')">展开</button>
        </div>
      </div>
    </div>

    <!-- 成品图片墙：BOS 持久外链直显，带图片描述，点击放大 -->
    <div v-if="galleryItems.length" class="result-block">
      <h3>成品图片（{{ galleryItems.length }}）</h3>
      <div class="gallery">
        <figure v-for="(item, i) in galleryItems" :key="item.url" class="shot">
          <img v-if="!broken[item.url]" :src="item.url" :alt="captionOf(item, i)" loading="lazy"
               @click="openPreview(item)" @error="markBroken(item.url)">
          <div v-else class="shot-broken" aria-label="图片加载失败">图片加载失败</div>
          <figcaption>
            <span class="cap-text" :title="captionOf(item, i)">{{ captionOf(item, i) }}</span>
            <span v-if="item.typeLabel" class="cap-tag">{{ item.typeLabel }}</span>
          </figcaption>
        </figure>
      </div>
    </div>

    <button class="btn btn-secondary restart" type="button" @click="emit('restart')">解析新的 PDF</button>

    <!-- 图片放大预览（含描述/类型/页码/产品名） -->
    <Teleport to="body">
      <div v-if="preview" class="preview-mask" :class="{ embedded: props.embedded }" @click="closePreview">
        <img :src="preview.url" :alt="preview.description || '图片预览'" @click.stop>
        <div class="preview-meta" @click.stop>
          <strong v-if="preview.description">{{ preview.description }}</strong>
          <span class="preview-tags">
            <em v-if="preview.productName">{{ preview.productName }}</em>
            <em v-if="preview.typeLabel">{{ preview.typeLabel }}</em>
            <em v-if="preview.pageNumber">第 {{ preview.pageNumber }} 页</em>
          </span>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.result-panel { max-width: 920px; margin: 0 auto; }
.result-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
  margin: var(--space-6) 0;
}
.result-card {
  padding: var(--space-5);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  box-shadow: var(--shadow-sm);
}
.result-card span { display: block; color: var(--text-tertiary); font-size: 12px; font-weight: 500; }
.result-card strong { display: block; margin-top: 6px; font-size: 22px; font-weight: 700; color: var(--text-primary); }
/* 发布进度面板 */
.publish-panel {
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--border-default);
  border-left: 4px solid var(--accent-600);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}
.publish-panel[data-status="publishing"] { border-left-color: var(--info-600); }
.publish-panel[data-status="publish_partial"] { border-left-color: var(--warn-600); }
.publish-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 14px;
}
.publish-head strong { color: var(--text-primary); }
.publish-counts { color: var(--text-tertiary); font-size: 13px; }
.publish-spinner {
  flex: none;
  width: 14px;
  height: 14px;
  border: 2px solid color-mix(in srgb, var(--accent-600) 22%, transparent);
  border-top-color: var(--accent-600);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.publish-actions { display: flex; gap: var(--space-3); margin-top: var(--space-3); }
@keyframes spin { to { transform: rotate(360deg); } }
/* 数据产物 → 知识库：三步闭环流程卡 */
.flow-panel {
  margin-top: var(--space-5);
  border: 1px solid var(--border-default);
  border-left: 4px solid var(--accent-600);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.flow-panel[data-state="error"] { border-left-color: var(--danger-600); }
.flow-panel[data-state="committed"] { border-left-color: var(--success-600, var(--accent-600)); }
/* 卡头：标题/副标题 + 步骤条（步骤条是唯一的进度状态源） */
.flow-head {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border-default);
}
/* 步骤条：节点 + 名称 + 状态词，连接线自动填充段间空隙 */
.flow-rail {
  display: flex;
  align-items: center;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-x: auto;
}
.rail-seg { display: flex; align-items: center; gap: 8px; min-width: 0; }
.rail-seg:not(:last-child) { flex: 1; }
.rail-node {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 20px;
  height: 20px;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  background: var(--bg-panel);
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 700;
}
.rail-seg.done .rail-node { background: var(--success-600); border-color: var(--success-600); color: #ffffff; }
.rail-seg.active .rail-node {
  background: var(--accent-600);
  border-color: var(--accent-600);
  color: var(--text-inverse);
  box-shadow: 0 0 0 3px var(--accent-50, var(--bg-subtle));
}
.rail-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.rail-text em { font-style: normal; font-size: 12px; font-weight: 600; color: var(--text-secondary); white-space: nowrap; }
.rail-text small { font-size: 11px; color: var(--text-tertiary); white-space: nowrap; }
.rail-seg.active .rail-text em { color: var(--accent-600); }
.rail-seg.done .rail-text em { color: var(--text-primary); }
.rail-line { flex: 1; min-width: 16px; height: 1px; margin: 0 12px; background: var(--border-default); }
.rail-seg.done .rail-line { background: color-mix(in srgb, var(--success-600) 45%, var(--border-default)); }
.flow-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
}
.flow-block + .flow-block { border-top: 1px dashed var(--border-default); }
.flow-block-head { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.flow-block-head strong { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.export-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.export-info strong { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.export-hint { font-size: 12px; color: var(--text-tertiary); word-break: break-all; }
/* 仅 ② 的提示承载失败原因，报错时变红；① 的引导语保持中性色 */
.flow-panel[data-state="error"] .kb-hint { color: var(--danger-600); }
/* ① 产物文件行：文件标签 + 文件名（超长截断，title 悬浮看全名） */
.export-file {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-subtle);
}
.export-file-tag {
  flex: none;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--accent-50, var(--bg-subtle));
  color: var(--accent-600);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.export-file-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-secondary);
}
.export-actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3); }
.export-actions .publish-spinner { margin-right: 6px; border-top-color: currentColor; }
/* ② 入口区：主通道按钮 + “或”分隔 + 本地文件上传区 */
.kb-entry { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3); }
.kb-or {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-tertiary);
  font-size: 12px;
}
.kb-or::before, .kb-or::after { content: ''; flex: 1; height: 1px; background: var(--border-default); }
/* 本地文件上传区（拖拽 + 点击；不要求先导出） */
.upload-zone {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-width: 0;
  padding: 10px var(--space-4);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--bg-subtle);
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: border-color var(--duration-fast), background var(--duration-fast);
}
.upload-hint { min-width: 0; }
.upload-zone:hover, .upload-zone.dragging {
  border-color: var(--accent-600);
  background: var(--accent-50, var(--bg-subtle));
  color: var(--text-secondary);
}
/* 校验结果来源标记 */
.kb-source {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-subtle);
  word-break: break-all;
}
/* 预览表：前 N 行纯文本，横向滚动 */
.preview-box { display: flex; flex-direction: column; gap: 6px; }
.preview-scroll {
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm, 6px);
  background: var(--bg-panel);
}
.preview-scroll table { border-collapse: collapse; font-size: 12px; white-space: nowrap; }
.preview-scroll th, .preview-scroll td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-default);
  border-right: 1px solid var(--border-default);
  text-align: left;
  color: var(--text-secondary);
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.preview-scroll th {
  position: sticky;
  top: 0;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-subtle);
}
.preview-scroll tr:last-child td { border-bottom: none; }
.preview-meta { font-size: 12px; color: var(--text-tertiary); }
.kb-body { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3); }
.kb-body .publish-spinner { flex: none; }
.kb-text { font-size: 13px; color: var(--text-secondary); }
.kb-error { font-size: 12px; color: var(--danger-600); word-break: break-all; }
.kb-errors {
  flex-basis: 100%;
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--danger-600);
}
.kb-errors li { margin-top: 4px; word-break: break-all; }
/* ── P1：步骤折叠（已完成步骤收起为一行摘要）── */
.flow-block-collapsed { padding: var(--space-3) var(--space-5); }
.flow-block-summary { display: flex; align-items: center; gap: 10px; min-width: 0; cursor: pointer; }
.sum-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--success-600);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
}
.sum-title { flex: none; font-size: 13px; font-weight: 600; color: var(--text-primary); }
.sum-state {
  flex: none;
  padding: 1px 8px;
  border: 1px solid var(--border-default);
  border-radius: 999px;
  background: var(--bg-subtle);
  font-size: 11px;
  color: var(--text-secondary);
}
.sum-detail { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--text-tertiary); }
/* 摘要行里的次要操作压到 30px 高（用 .sum-btn 提高优先级，避免被全局 .btn 的 40px 覆盖） */
.flow-block-summary .btn.sum-btn { height: 30px; padding: 0 12px; font-size: 12px; }
/* ── P1：校验结果统计结构化 ── */
.kb-stats {
  flex-basis: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
  gap: var(--space-3);
}
.kb-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-subtle);
}
.kb-stat span { font-size: 11px; color: var(--text-tertiary); }
.kb-stat strong { font-size: 16px; font-weight: 700; color: var(--text-primary); line-height: 1.2; }
.kb-stat.is-valid strong { color: var(--success-600); }
.kb-stat.is-warn strong { color: var(--warn-600); }
.kb-stat.is-error strong { color: var(--danger-600); }
.kb-meta-row { flex-basis: 100%; display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3); }
/* ── P1：提交后的自动刷新提示 ── */
.kb-poll { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-tertiary); }
.result-block { margin-top: var(--space-5); }
.result-block h3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
/* 图片墙 */
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}
.shot {
  margin: 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  overflow: hidden;
  cursor: zoom-in;
  transition: border-color var(--duration-fast);
}
.shot:hover { border-color: var(--border-focus); }
.shot img {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  background: var(--bg-subtle);
}
.shot-broken {
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-tertiary);
  background: var(--bg-subtle);
}
.shot figcaption {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 11px;
  color: var(--text-tertiary);
}
.cap-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
}
.cap-tag {
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--accent-50, var(--bg-subtle));
  color: var(--accent-600);
  font-weight: 600;
}
/* 图片放大预览 */
.preview-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 32px;
  background: rgba(0, 0, 0, 0.72);
}
/* 嵌入模式：局限在 WMS 内容区内 */
.preview-mask.embedded {
  position: absolute;
  padding: 16px;
}
.preview-mask img {
  max-width: min(92vw, 1100px);
  max-height: 70vh;
  object-fit: contain;
  border-radius: var(--radius-md);
  background: #fff;
}
.preview-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  max-width: min(92vw, 1100px);
  color: #fff;
  text-align: center;
}
.preview-meta strong {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
}
.preview-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.preview-tags em {
  font-style: normal;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 12px;
}
.restart { margin-top: var(--space-6); }
@media (max-width: 680px) {
  .result-grid { grid-template-columns: 1fr; }
  /* 步骤条：小屏隐藏状态词、收紧连接线，避免横向撑破 */
  .rail-text small { display: none; }
  .rail-line { margin: 0 8px; }
}
</style>
