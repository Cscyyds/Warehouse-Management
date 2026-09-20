<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
// DESIGN_SPEC 处理面板：W1/W2/W3 工作流步骤（时间轴）+ 活动流水 + 断开跟进 + 解析计时
const props = defineProps({
  message: { type: String, default: '正在准备进入工作流…' },
  fileName: { type: String, default: 'PDF document' },
  fileUrl: { type: String, default: '等待 BOS 上传' },
  // 本地上传的文件大小（字节）；URL/恢复任务无值 → 隐藏该行
  fileSize: { type: Number, default: 0 },
  // 活动流水（index.vue addActivity：最新在前，{ title, detail, at }）
  activity: { type: Array, default: () => [] },
  // 解析计时锚点（epoch ms）；0 表示无锚点（不显示计时）
  startedAt: { type: Number, default: 0 },
  steps: { type: Array, default: () => [
    { key: 'w1', label: 'W1 · 页面识别与候选裁图', state: 'active' },
    { key: 'w2', label: 'W2 · 产品合并与预览生成', state: '' },
    { key: 'w3', label: 'W3 · 人工审核与结果发布', state: '' }
  ] },
  retry: { type: Object, default: () => ({ active: false, current: 0, max: 3 }) }
});
const emit = defineEmits(['cancel']);

// ── 解析计时：每秒跳动，让用户知道“跑了多久 / 没卡死” ──
const now = ref(Date.now());
let elapsedTimer = null;
onMounted(() => {
  elapsedTimer = setInterval(() => { now.value = Date.now(); }, 1000);
});
onBeforeUnmount(() => { if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; } });
const elapsedText = computed(() => {
  if (!props.startedAt) return '';
  const totalSec = Math.max(0, Math.floor((now.value - props.startedAt) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
});

const fileSizeText = computed(() => (props.fileSize > 0
  ? `${(props.fileSize / 1048576).toFixed(2)} MB`
  : ''));
// 只有真实 http(s) 链接才提供复制（默认文案“等待 BOS 上传”不是链接）
const hasHttpUrl = computed(() => /^https?:\/\//i.test(props.fileUrl || ''));
const recentActivity = computed(() => (props.activity || []).slice(0, 6));

// 复制链接：clipboard API 优先，旧环境降级 execCommand；按钮内联反馈“已复制”
const copied = ref(false);
let copiedTimer = null;
function copyFileUrl() {
  const url = props.fileUrl || '';
  const markCopied = () => {
    copied.value = true;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => { copied.value = false; copiedTimer = null; }, 2000);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(markCopied).catch(() => legacyCopy(url, markCopied));
  } else {
    legacyCopy(url, markCopied);
  }
}
function legacyCopy(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    done();
  } catch { /* 复制失败静默：用户仍可选中文字手动复制 */ }
}
onBeforeUnmount(() => { if (copiedTimer) clearTimeout(copiedTimer); });

// W 步骤状态词：done=已完成（绿✓）active=进行中（品牌红+spinner）其余等待中
function wstepStateText(s) {
  if (s.state === 'done') return '已完成';
  if (s.state === 'active') return '进行中';
  return '等待中';
}
function formatClock(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>

<template>
  <section class="panel process-panel fade-in">
    <div class="panel-header">
      <span class="panel-overline">PDF PIPELINE / 02</span>
      <div class="title-row">
        <h1 class="panel-title">正在解析 PDF</h1>
        <!-- 解析计时：刷新/恢复续接同一锚点，不重置 -->
        <span v-if="props.startedAt" class="elapsed-chip" :title="`自 ${formatClock(props.startedAt)} 开始计时`">
          <i class="elapsed-dot" aria-hidden="true"></i>已用时 {{ elapsedText }}
        </span>
      </div>
      <p class="panel-lead" id="processMessage">{{ props.message }}</p>

      <div v-if="props.retry.active" class="retry-line" role="status" aria-live="polite">
        <span class="retry-spinner" aria-hidden="true"></span>
        <strong>重试中（{{ props.retry.current }} / {{ props.retry.max }}）</strong>
        <span class="retry-hint">{{ props.retry.resumed ? '已完成的进度会保留，请勿关闭页面' : '将重新开始解析（此前进度无法续接）' }}</span>
        <span class="retry-dots" aria-hidden="true">
          <i v-for="n in props.retry.max" :key="n"
             :class="{ used: n <= props.retry.current }"></i>
        </span>
      </div>
    </div>

    <!-- 文件信息：左品牌色徽标 + 右（文件名 / 大小 / 截断链接+复制），不再裸弃长 URL -->
    <div class="process-file">
      <div class="file-badge" aria-hidden="true">PDF</div>
      <div class="file-info">
        <strong :title="props.fileName">{{ props.fileName }}</strong>
        <span v-if="fileSizeText" class="file-meta">{{ fileSizeText }}</span>
        <div class="file-link-row">
          <span class="file-url" :title="props.fileUrl">{{ props.fileUrl }}</span>
          <button v-if="hasHttpUrl" class="btn btn-ghost copy-btn" type="button" @click="copyFileUrl">{{ copied ? '已复制' : '复制链接' }}</button>
        </div>
      </div>
    </div>

    <!-- W1/W2/W3：时间轴（左圆点轨道 + 右卡片）；状态语义 done=绿✓ active=品牌红+spinner 待定=灰 -->
    <div class="workflow-steps">
      <div v-for="s in props.steps" :key="s.key" class="wstep" :class="s.state">
        <span class="wstep-rail" aria-hidden="true">
          <i class="wstep-dot">{{ s.state === 'done' ? '✓' : '' }}</i>
        </span>
        <div class="wstep-card">
          <span class="wstep-label">{{ s.label }}</span>
          <span class="wstep-state">{{ wstepStateText(s) }}</span>
          <span v-if="s.state === 'active'" class="wstep-spinner" aria-hidden="true"></span>
        </div>
      </div>
    </div>

    <!-- 活动流水：最新在前（不再重复渲染顶部 message，消除“正在准备…”双现） -->
    <div v-if="recentActivity.length" class="process-log" aria-live="polite">
      <div v-for="(a, i) in recentActivity" :key="i" class="log-line">
        <em v-if="a.at">{{ formatClock(a.at) }}</em>
        <span>{{ a.title }}{{ a.detail ? ` · ${a.detail}` : '' }}</span>
      </div>
    </div>

    <!-- 断开仅中断前端连接与轮询（任务可能仍在后台执行，可凭任务 ID 恢复），中性操作不用危险红 -->
    <div class="cancel-row">
      <button class="btn btn-secondary" type="button" @click="emit('cancel')">断开跟进</button>
      <span class="cancel-hint">断开后任务可能仍在后台执行，可凭任务 ID 恢复</span>
    </div>
  </section>
</template>

<style scoped>
.process-panel { max-width: 720px; margin: 0 auto; }

/* 标题行：标题 + 解析计时芯片 */
.title-row { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.elapsed-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid var(--border-default);
  border-radius: 999px;
  background: var(--bg-subtle);
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.elapsed-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-600);
  animation: elapsed-pulse 1.4s ease-in-out infinite;
}
@keyframes elapsed-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

/* 重试进度：面板头部内联一行 */
.retry-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: var(--space-3);
  font-size: 13px;
}
.retry-spinner {
  flex: none;
  width: 14px;
  height: 14px;
  border: 2px solid color-mix(in srgb, var(--accent-600) 22%, transparent);
  border-top-color: var(--accent-600);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.retry-line strong {
  font-weight: 600;
  color: var(--accent-600);
}
.retry-hint {
  color: var(--text-tertiary);
  font-size: 12px;
}
.retry-dots { display: inline-flex; gap: 5px; flex: none; margin-left: auto; }
.retry-dots i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent-600) 20%, transparent);
  transition: background var(--duration-fast);
}
.retry-dots i.used { background: var(--accent-600); }
@keyframes spin { to { transform: rotate(360deg); } }

/* 文件信息：品牌色徽标 + 右侧（文件名 / 大小 / 截断链接 + 复制） */
.process-file {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  margin: var(--space-6) 0;
}
.file-badge {
  flex: none;
  padding: 12px 13px;
  border-radius: var(--radius-sm);
  background: var(--accent-600);
  color: var(--text-inverse);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.file-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.file-info strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: var(--text-primary);
}
.file-meta { font-size: 12px; color: var(--text-tertiary); }
.file-link-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.file-url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-tertiary);
}
.copy-btn { flex: none; height: 26px; padding: 0 10px; font-size: 12px; }

/* W1/W2/W3 时间轴：左侧圆点轨道 + 连接线（画在容器上，被圆点覆盖首尾） + 右侧卡片 */
.workflow-steps { position: relative; display: grid; gap: 12px; }
.workflow-steps::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 22px;
  bottom: 22px;
  width: 2px;
  background: var(--border-default);
  pointer-events: none;
}
.wstep { display: flex; align-items: center; gap: 12px; }
.wstep-rail { flex: none; width: 24px; display: grid; place-items: center; }
.wstep-dot {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  background: var(--bg-panel);
  color: transparent;
  font-size: 10px;
  font-weight: 700;
  font-style: normal;
  transition: all var(--duration-fast);
}
.wstep-card {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  background: var(--bg-panel);
  transition: all var(--duration-fast);
}
.wstep-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.wstep-state { margin-left: auto; flex: none; font-size: 11px; color: var(--text-tertiary); }
.wstep-spinner {
  flex: none;
  width: 13px;
  height: 13px;
  border: 2px solid color-mix(in srgb, var(--accent-600) 22%, transparent);
  border-top-color: var(--accent-600);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.wstep.active .wstep-card {
  border-color: var(--border-focus);
  color: var(--accent-600);
  background: var(--accent-50);
}
.wstep.active .wstep-label { font-weight: 600; }
.wstep.active .wstep-state { color: var(--accent-600); font-weight: 600; }
.wstep.active .wstep-dot { background: var(--accent-600); border-color: var(--accent-600); animation: wstep-pulse 1.6s infinite; }
/* 呼吸光晕：旧代码引用的 pulse 关键帧定义在 index.vue 的 scoped 样式里（会被重命名），
   跨文件引用从未生效；此处本地定义，active 圆点真正获得“进行中”动效 */
@keyframes wstep-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-600) 35%, transparent); }
  50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent-600) 0%, transparent); }
}
.wstep.done .wstep-card { color: var(--text-secondary); }
.wstep.done .wstep-label { color: var(--text-primary); }
.wstep.done .wstep-state { color: var(--success-600); font-weight: 600; }
.wstep.done .wstep-dot { background: var(--success-600); border-color: var(--success-600); color: #ffffff; }

/* 活动流水：最新在前，跟主状态文案（panel-lead）不再重复 */
.process-log {
  margin-top: var(--space-5);
  padding: 10px 14px;
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  font-size: 12px;
  color: var(--text-secondary);
  max-height: 180px;
  overflow-y: auto;
}
.log-line { display: flex; gap: 10px; padding: 3px 0; }
.log-line em {
  flex: none;
  font-style: normal;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}
.cancel-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-5);
}
.cancel-hint { font-size: 12px; color: var(--text-secondary); }
</style>
