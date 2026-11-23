<script setup>
/**
 * 知识库数据中台 demo（纯前端，无后端调用）。
 *
 * 流程：知识库首页 → ①选择数据（本地文件 / 自定义文本）→ ②处理设置与预览 → ③处理入库。
 * 文件解析与切片都在浏览器内完成，只为「处理前预览」服务；③处理入库为模拟进度。
 * 视觉沿用 pdf_agent 工作台：同一套 token 桥接 WMS 全局主题（浅/深色随 html.dark 切换）。
 */
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useThemeStore } from '@/stores/theme';
import KbHome from './KbHome.vue';
import SourceStep from './SourceStep.vue';
import ConfigPanel from './ConfigPanel.vue';
import PreviewPanel from './PreviewPanel.vue';
import ProcessStep from './ProcessStep.vue';
import DocViewer from './DocViewer.vue';
import { chunkDocument, defaultConfig, EMBEDDING_MODELS } from './chunker';
import { parseFile, textDocument } from './parsers';
import { seedKnowledgeBases, STORE_MODE_LABEL } from './seed';

defineOptions({ name: 'KbHub' });

const theme = useThemeStore();

// ── 知识库 ──
const kbs = ref(seedKnowledgeBases(Date.now()));
const activeKbId = ref(kbs.value[0].id);
const activeKb = computed(() => kbs.value.find(k => k.id === activeKbId.value) || kbs.value[0]);

async function createKb() {
  let name;
  try {
    ({ value: name } = await ElMessageBox.prompt('知识库名称', '新建知识库', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPlaceholder: '如：售后政策',
      inputValidator: v => (String(v || '').trim() ? true : '请输入名称'),
    }));
  } catch { return; }
  const kb = { id: `kb_${Date.now().toString(36)}`, name: name.trim(), desc: '', embeddingModel: 'bge-m3', docs: [] };
  kbs.value.push(kb);
  activeKbId.value = kb.id;
}

async function deleteDoc(doc) {
  try {
    await ElMessageBox.confirm(`删除「${doc.name}」及其 ${doc.chunks} 个分块？`, '删除文档', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    });
  } catch { return; }
  const kb = activeKb.value;
  kb.docs = kb.docs.filter(d => d.id !== doc.id);
  sims = sims.filter(s => s.docId !== doc.id);
}

// 已就绪文档的分块详情（只读抽屉，按入库参数快照重算）
const viewingDoc = ref(null);
function viewDoc(doc) {
  if (doc.status === 'ready' && doc.source && doc.config) viewingDoc.value = doc;
}

// ── 向导 ──
const STEPS = [
  { key: 'source', label: '选择数据' },
  { key: 'config', label: '处理设置与预览' },
  { key: 'process', label: '处理入库' },
];
const phase = ref('home');
const stepIdx = computed(() => STEPS.findIndex(s => s.key === phase.value));

const docs = ref([]);
const parsing = ref([]);
const cfg = reactive(defaultConfig());
const previewId = ref('');
const jobs = ref([]);
const processDone = computed(() => jobs.value.length > 0 && jobs.value.every(j => j.status === 'done'));

function resetWizard() {
  docs.value = [];
  jobs.value = [];
  previewId.value = '';
}

function startImport() {
  if (phase.value === 'process' || processDone.value) resetWizard();
  phase.value = 'source';
}

async function backHome() {
  if ((phase.value === 'source' || phase.value === 'config') && docs.value.length) {
    try {
      await ElMessageBox.confirm('已选择的数据和处理设置不会保留。', '放弃本次导入？', {
        confirmButtonText: '放弃', cancelButtonText: '继续编辑', type: 'warning',
      });
    } catch { return; }
  }
  resetWizard();
  phase.value = 'home';
}

async function addFiles(files) {
  for (const file of files) {
    if (docs.value.some(d => d.name === file.name && d.size === file.size)) {
      ElMessage.info(`「${file.name}」已在列表中`);
      continue;
    }
    const key = `${file.name}_${file.size}_${parsing.value.length}`;
    parsing.value.push({ key, name: file.name });
    try {
      docs.value.push(await parseFile(file));
    } catch (e) {
      ElMessage.error(`${file.name}：${e?.message || '解析失败'}`);
    } finally {
      parsing.value = parsing.value.filter(p => p.key !== key);
    }
  }
}

function addText({ title, text }) {
  docs.value.push(textDocument(title, text));
}

function removeDoc(id) {
  docs.value = docs.value.filter(d => d.id !== id);
  if (previewId.value === id) previewId.value = docs.value[0]?.id || '';
}

function goConfig() {
  cfg.embeddingModel = activeKb.value.embeddingModel;
  if (!docs.value.some(d => d.id === previewId.value)) previewId.value = docs.value[0]?.id || '';
  phase.value = 'config';
}

// 每个文档的切片结果：参数一变即全部重算（demo 文档量小，直接算）
const results = computed(() => {
  const map = new Map();
  for (const d of docs.value) map.set(d.id, chunkDocument(d, cfg));
  return map;
});
const totals = computed(() => {
  let chunks = 0; let tokens = 0; let empty = 0;
  for (const r of results.value.values()) {
    chunks += r.chunks.length;
    tokens += r.chunks.reduce((n, c) => n + c.tokens, 0);
    if (!r.chunks.length) empty++;
  }
  return { docs: docs.value.length, chunks, tokens, empty };
});
const previewDoc = computed(() => docs.value.find(d => d.id === previewId.value) || docs.value[0] || null);
const modelLabel = computed(() => EMBEDDING_MODELS.find(m => m.value === cfg.embeddingModel)?.label || cfg.embeddingModel);

// ── 模拟处理：解析 → 清洗 → 切片 → 向量化 → 写入索引 ──
const STAGES = ['文件解析', '数据清洗', '文本切片', '向量化', '写入索引'];
let sims = [];
let timer = null;

function stageDurations(chunks) {
  return [900, 600, 700, Math.min(5000, 1200 + chunks * 60), 700];
}

function runSims() {
  if (timer) return;
  timer = setInterval(tick, 150);
}

function tick() {
  const now = Date.now();
  for (const s of sims) {
    const elapsed = Math.max(0, now - s.startAt);
    const total = s.durations.reduce((a, b) => a + b, 0);
    let acc = 0; let stage = 0;
    while (stage < s.durations.length - 1 && elapsed >= acc + s.durations[stage]) acc += s.durations[stage++];
    const stagePct = Math.min(100, ((elapsed - acc) / s.durations[stage]) * 100);
    const pct = Math.min(100, Math.round((elapsed / total) * 100));
    const kb = kbs.value.find(k => k.id === s.kbId);
    const rec = kb?.docs.find(d => d.id === s.docId);
    const job = s.jobId ? jobs.value.find(j => j.id === s.jobId) : null;
    if (rec) rec.progress = pct;
    if (job) { job.stage = stage; job.stagePct = elapsed > 0 ? stagePct : 0; job.progress = pct; }
    if (elapsed >= total) {
      s.finished = true;
      if (rec) Object.assign(rec, { status: 'ready', progress: 100, chunks: s.chunks, chars: s.chars, updatedAt: now, error: '' });
      if (job) { job.status = 'done'; job.stage = STAGES.length; }
    } else if (job && elapsed > 0) {
      job.status = 'running';
    }
  }
  sims = sims.filter(s => !s.finished);
  if (!sims.length) { clearInterval(timer); timer = null; }
}

function startProcess() {
  if (!docs.value.length) return;
  if (totals.value.empty === docs.value.length) {
    ElMessage.warning('当前参数下没有可入库的内容');
    return;
  }
  const kb = activeKb.value;
  const now = Date.now();
  const modeLabel = STORE_MODE_LABEL[cfg.storeMode];
  // 参数快照：入库后「查看分块」按它重算，之后再改设置不影响已入库文档
  const snapshot = { ...cfg, separators: [...cfg.separators] };
  jobs.value = docs.value.map((d, i) => {
    const r = results.value.get(d.id);
    const job = {
      id: `job_${d.id}`, name: d.name, ext: d.ext, chunks: r.chunks.length, chars: r.totalChars,
      tokens: r.chunks.reduce((n, c) => n + c.tokens, 0), stage: 0, stagePct: 0, progress: 0, status: 'queued',
    };
    kb.docs.unshift({
      id: d.id, name: d.name, ext: d.ext, size: d.size, chunks: 0, chars: 0,
      status: 'processing', progress: 0, storeMode: modeLabel, updatedAt: now,
      source: d, config: snapshot,
    });
    sims.push({
      kbId: kb.id, docId: d.id, jobId: job.id, startAt: now + i * 500,
      durations: stageDurations(job.chunks), chunks: job.chunks, chars: job.chars,
    });
    return job;
  });
  phase.value = 'process';
  runSims();
}

function retryDoc(doc) {
  const r = doc.source && doc.config ? chunkDocument(doc.source, doc.config) : null;
  const chars = r ? r.totalChars : (doc.chars || Math.round(doc.size / 2));
  const chunks = r ? r.chunks.length : Math.max(1, Math.round(chars / 600));
  Object.assign(doc, { status: 'processing', progress: 0, error: '' });
  sims.push({ kbId: activeKb.value.id, docId: doc.id, startAt: Date.now(), durations: stageDurations(chunks), chunks, chars });
  runSims();
}

onBeforeUnmount(() => { if (timer) clearInterval(timer); });

// ── 顶栏状态 ──
const status = computed(() => {
  if (phase.value === 'home') {
    const busy = kbs.value.reduce((n, k) => n + k.docs.filter(d => d.status === 'processing').length, 0);
    return busy ? { mode: 'busy', text: `${busy} 个文档处理中` } : { mode: 'waiting', text: `${kbs.value.length} 个知识库` };
  }
  if (phase.value === 'source') return { mode: 'waiting', text: docs.value.length ? `已选 ${docs.value.length} 项` : '等待选择数据' };
  if (phase.value === 'config') return { mode: 'waiting-review', text: `预览 ${totals.value.chunks} 个分块` };
  return processDone.value ? { mode: 'done', text: '处理完成' } : { mode: 'busy', text: '处理中' };
});
</script>

<template>
  <div class="kb-hub">
    <header class="topbar">
      <button class="brand" type="button" title="返回知识库首页" @click="backHome">
        <span class="brand-mark" aria-hidden="true">KB</span>
        <span>
          <span class="brand-title">知识库数据中台</span>
          <span class="brand-sub">上传 · 切片 · 向量化 · 检索就绪</span>
        </span>
      </button>
      <div class="topbar-right">
        <span class="status-badge" :data-status="status.mode">
          <span class="status-dot"></span><span>{{ status.text }}</span>
        </span>
        <button class="theme-toggle" type="button"
                :title="theme.isDark ? '切换到浅色模式' : '切换到深色模式'"
                :aria-label="theme.isDark ? '切换到浅色模式' : '切换到深色模式'"
                @click="theme.toggleTheme()">
          <svg v-if="!theme.isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
        </button>
      </div>
    </header>

    <main class="shell" :class="{ wide: phase === 'config' || phase === 'home' }">
      <nav v-if="phase !== 'home'" class="stepper" aria-label="导入流程">
        <template v-for="(s, i) in STEPS" :key="s.key">
          <div class="stepper-step" :class="{ done: i < stepIdx || processDone, current: i === stepIdx && !processDone }">
            <span class="stepper-node" aria-hidden="true">{{ i < stepIdx || processDone ? '✓' : i + 1 }}</span>
            <span>{{ s.label }}</span>
          </div>
          <div v-if="i < STEPS.length - 1" class="stepper-line" :class="{ done: i < stepIdx }"></div>
        </template>
      </nav>

      <KbHome v-if="phase === 'home'"
              :kbs="kbs" :active-id="activeKbId"
              @select="activeKbId = $event" @create="createKb" @import="startImport"
              @delete-doc="deleteDoc" @retry-doc="retryDoc" @view-doc="viewDoc" />

      <SourceStep v-else-if="phase === 'source'"
                  :kb-name="activeKb.name" :docs="docs" :parsing="parsing"
                  @add-files="addFiles" @add-text="addText" @remove="removeDoc"
                  @back="backHome" @next="goConfig" />

      <section v-else-if="phase === 'config'" class="config-layout fade-in">
        <div class="config-grid">
          <ConfigPanel :config="cfg" :model-label="modelLabel" :kb-name="activeKb.name" />
          <PreviewPanel v-if="previewDoc" v-model:active-id="previewId"
                        :docs="docs" :doc="previewDoc" :result="results.get(previewDoc.id)" :config="cfg"
                        :results="results" />
        </div>
        <footer class="config-foot">
          <button class="btn btn-secondary" type="button" @click="phase = 'source'">上一步</button>
          <span class="foot-summary">
            {{ totals.docs }} 个数据源 → <strong>{{ totals.chunks }}</strong> 个分块
            · 预计 {{ totals.tokens.toLocaleString() }} tokens · 写入「{{ activeKb.name }}」
            <em v-if="totals.empty" class="foot-warn">⚠ {{ totals.empty }} 个数据源无有效内容，将跳过</em>
          </span>
          <button class="btn btn-primary" type="button" :disabled="!totals.chunks" @click="startProcess">开始处理</button>
        </footer>
      </section>

      <ProcessStep v-else :jobs="jobs" :stages="STAGES" :done="processDone" :kb-name="activeKb.name"
                   :model-label="modelLabel"
                   @home="resetWizard(); phase = 'home'" @more="startImport" />
    </main>

    <DocViewer v-if="viewingDoc" :doc="viewingDoc" :kb-name="activeKb.name" @close="viewingDoc = null" />
  </div>
</template>

<style scoped>
/* ── Design Tokens：与 pdf_agent 工作台（pdf-review/index.vue）同源，桥接 WMS 全局主题 ── */
.kb-hub {
  --bg-body: var(--bg-page);
  --bg-panel: var(--bg-white);
  --bg-subtle: var(--bg-hover);
  --text-inverse: #ffffff;
  --border-default: var(--border-color);
  --border-strong: color-mix(in srgb, var(--text-primary) 22%, var(--border-color));
  --border-focus: var(--primary-lighter);
  --divider: var(--border-light);
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
  --success-600: var(--success);
  --success-50: var(--success-light);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 20px;
  --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 120ms;
  --duration-normal: 200ms;
  --font-sans: "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  /* 分块长度图的单系列数据色（非状态色）：浅/深色各取一档，已过 dataviz 校验（亮度带/彩度/对比度） */
  --kb-bar: #3B6FB6;
  /* Element Plus 控件主色对齐品牌红（只影响本页内联控件） */
  --el-color-primary: var(--primary);
  --el-color-primary-light-3: color-mix(in srgb, var(--primary) 70%, var(--bg-white));
  --el-color-primary-light-5: color-mix(in srgb, var(--primary) 50%, var(--bg-white));
  --el-color-primary-light-7: color-mix(in srgb, var(--primary) 30%, var(--bg-white));
  --el-color-primary-light-8: color-mix(in srgb, var(--primary) 20%, var(--bg-white));
  --el-color-primary-light-9: color-mix(in srgb, var(--primary) 8%, var(--bg-white));
  --el-color-primary-dark-2: var(--primary-dark);

  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg-body);
  color: var(--text-primary);
  font: 14px/1.6 var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
:global(html.dark) .kb-hub { --kb-bar: #5B8DD9; }

/* ── Topbar ── */
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 28px;
  background: color-mix(in srgb, var(--bg-panel) 95%, transparent);
  border-bottom: 1px solid var(--border-default);
  backdrop-filter: blur(10px);
}
.brand { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 0; border: 0; background: none; color: inherit; text-align: left; cursor: pointer; }
.brand-mark {
  display: grid; place-items: center; flex: none;
  width: 36px; height: 36px; border-radius: var(--radius-md);
  background: var(--accent-600); color: #fff; font-size: 12px; font-weight: 800;
}
.brand-title { display: block; font-size: 15px; font-weight: 700; white-space: nowrap; }
.brand-sub { display: block; margin-top: 1px; color: var(--text-tertiary); font-size: 12px; white-space: nowrap; }
.topbar-right { display: flex; align-items: center; gap: 12px; flex: none; }
.theme-toggle {
  display: grid; place-items: center; width: 32px; height: 32px;
  border: 1px solid var(--border-default); border-radius: var(--radius-sm);
  background: var(--bg-panel); color: var(--text-tertiary); cursor: pointer;
}
.theme-toggle:hover { color: var(--accent-600); border-color: var(--border-focus); background: var(--bg-hover); }
.theme-toggle svg { width: 16px; height: 16px; }

/* ── Status badge ── */
.status-badge {
  display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px;
  border-radius: var(--radius-xl); font-size: 13px; font-weight: 500;
}
.status-badge[data-status="waiting"] { color: var(--text-secondary); background: var(--bg-subtle); }
.status-badge[data-status="busy"] { color: var(--accent-900); background: var(--accent-50); }
.status-badge[data-status="waiting-review"] { color: var(--warn-600); background: var(--warn-50); }
.status-badge[data-status="done"] { color: var(--success-600); background: var(--success-50); }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.status-badge[data-status="busy"] .status-dot { animation: pulse 1.6s infinite; }

/* ── Layout ── */
.shell { flex: 1; width: 100%; max-width: 1080px; margin: 0 auto; padding: 0 var(--space-6) var(--space-8); }
.shell.wide { max-width: 1480px; }
.shell > :first-child:not(.stepper) { margin-top: var(--space-6); }

/* ── Stepper ── */
.stepper { display: flex; align-items: center; justify-content: center; gap: 8px; max-width: 640px; margin: var(--space-6) auto var(--space-5); }
.stepper-step { display: flex; align-items: center; gap: 10px; color: var(--text-tertiary); font-size: 13px; font-weight: 500; white-space: nowrap; }
.stepper-step.done { color: var(--success-600); }
.stepper-step.current { color: var(--text-primary); font-weight: 600; }
.stepper-node {
  display: grid; place-items: center; flex: none; width: 26px; height: 26px; border-radius: 50%;
  border: 2px solid var(--border-strong); font-size: 11px; font-weight: 700;
}
.stepper-step.done .stepper-node { background: var(--success-600); border-color: var(--success-600); color: #fff; }
.stepper-step.current .stepper-node { border-color: var(--accent-600); color: var(--accent-600); animation: ring 1.8s infinite; }
.stepper-line { flex: 1; max-width: 60px; height: 2px; border-radius: 1px; background: var(--border-default); }
.stepper-line.done { background: color-mix(in srgb, var(--success-600) 45%, var(--border-default)); }

/* ── 设置 + 预览 ── */
.config-grid { display: grid; grid-template-columns: minmax(340px, 400px) minmax(0, 1fr); gap: var(--space-5); align-items: start; }
.config-foot {
  position: sticky; bottom: 0; z-index: 20;
  display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap;
  margin-top: var(--space-5); padding: var(--space-3) var(--space-5);
  border: 1px solid var(--border-default); border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-panel) 96%, transparent); box-shadow: var(--shadow-lg);
  backdrop-filter: blur(8px);
}
/* 右侧给 WMS 全局「小星助手」悬浮按钮（fixed，右下 22px，宽约 130px）让位，避免盖住「开始处理」 */
@media (min-width: 681px) {
  .config-foot { margin-right: 148px; }
}
.foot-summary { flex: 1; min-width: 240px; color: var(--text-secondary); font-size: 13px; }
.foot-summary strong { color: var(--text-primary); font-size: 15px; }
.foot-warn { margin-left: 8px; font-style: normal; color: var(--warn-600); }
@media (max-width: 1080px) {
  .config-grid { grid-template-columns: 1fr; }
}
@media (max-width: 680px) {
  .topbar { padding: 0 16px; }
  .brand-sub { display: none; }
  .shell { padding: 0 var(--space-4) var(--space-6); }
}

/* ── 共享基础类（子组件通用，样式与 pdf_agent 工作台一致） ── */
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 35%, transparent); }
  50% { box-shadow: 0 0 0 6px transparent; }
}
@keyframes ring {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 25%, transparent); }
  50% { box-shadow: 0 0 0 5px transparent; }
}
.kb-hub :deep(.fade-in) { animation: fadeIn 250ms var(--ease-out); }
.kb-hub :deep(.panel) {
  border: 1px solid var(--border-default); border-radius: var(--radius-lg);
  background: var(--bg-panel); box-shadow: var(--shadow-md); padding: var(--space-8);
}
.kb-hub :deep(.panel-overline) {
  display: block; margin-bottom: var(--space-2); color: var(--text-tertiary);
  font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
}
.kb-hub :deep(.panel-title) { margin: 0; font-size: 24px; font-weight: 700; line-height: 1.25; letter-spacing: -0.02em; }
.kb-hub :deep(.panel-lead) { margin: var(--space-2) 0 0; color: var(--text-secondary); font-size: 14px; }
.kb-hub :deep(.btn) {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex: none;
  height: 40px; padding: 0 18px; white-space: nowrap;
  border: 1px solid transparent; border-radius: var(--radius-sm); background: transparent; color: inherit;
  font: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.kb-hub :deep(.btn:focus-visible) { outline: 2px solid var(--accent-600); outline-offset: 2px; }
.kb-hub :deep(.btn:disabled) { opacity: 0.5; cursor: not-allowed; }
.kb-hub :deep(.btn-sm) { height: 32px; padding: 0 12px; font-size: 13px; }
.kb-hub :deep(.btn-primary) { background: var(--accent-600); border-color: var(--accent-600); color: var(--text-inverse); box-shadow: var(--shadow-sm); }
.kb-hub :deep(.btn-primary:hover:not(:disabled)) { background: var(--accent-900); border-color: var(--accent-900); transform: translateY(-1px); }
.kb-hub :deep(.btn-secondary) { border-color: var(--border-strong); background: var(--bg-panel); color: var(--text-secondary); }
.kb-hub :deep(.btn-secondary:hover:not(:disabled)) { background: var(--bg-hover); color: var(--text-primary); }
.kb-hub :deep(.btn-ghost) { color: var(--text-secondary); }
.kb-hub :deep(.btn-ghost:hover:not(:disabled)) { color: var(--text-primary); background: var(--bg-subtle); }
.kb-hub :deep(.input) {
  width: 100%; height: 40px; padding: 0 14px;
  border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  background: var(--bg-panel); color: var(--text-primary); font: inherit; font-size: 14px;
  transition: border-color var(--duration-fast), box-shadow var(--duration-fast);
}
.kb-hub :deep(textarea.input) { height: auto; padding: 10px 14px; line-height: 1.6; resize: vertical; }
.kb-hub :deep(.input::placeholder) { color: var(--text-tertiary); }
.kb-hub :deep(.input:focus) {
  outline: none; border-color: var(--accent-600);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent);
}
.kb-hub :deep(.ext-badge) {
  display: inline-grid; place-items: center; flex: none; width: 40px; height: 44px;
  border: 1.5px solid currentColor; border-radius: var(--radius-sm); background: var(--bg-panel);
  font-size: 10px; font-weight: 800; letter-spacing: 0.03em; text-transform: uppercase; color: var(--text-secondary);
}
.kb-hub :deep(.ext-badge[data-ext="pdf"]) { color: #C0392B; }
.kb-hub :deep(.ext-badge[data-ext="docx"]) { color: #2F6FB7; }
.kb-hub :deep(.ext-badge[data-ext="xlsx"]),
.kb-hub :deep(.ext-badge[data-ext="xls"]),
.kb-hub :deep(.ext-badge[data-ext="csv"]) { color: #2E8B57; }
.kb-hub :deep(.ext-badge[data-ext="text"]) { color: var(--accent-600); }
</style>
