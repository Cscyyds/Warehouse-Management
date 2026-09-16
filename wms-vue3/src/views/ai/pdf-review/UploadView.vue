<script setup>
import { computed, ref } from 'vue';

// DESIGN_SPEC 6.4 / 5.3 上传面板
const props = defineProps({
  fileLabel: { type: String, default: '' },
  startDisabled: { type: Boolean, default: true },
  recentJobs: { type: Array, default: () => [] },
  reviewMode: { type: String, default: 'manual' },
  // 进行中任务接管横幅（A）：{ job_id, pdf_name, at }；空则不显示
  activeJob: { type: Object, default: null }
});
const emit = defineEmits(['choose', 'submit-url', 'start', 'demo', 'restore', 'update:reviewMode', 'resume-active', 'dismiss-active']);

const dragging = ref(false);
const url = ref('');
const fileInput = ref(null);
const restoreId = ref('');

// 已选文件状态：从 fileLabel（"name · x.xx MB"）拆出文件名与大小，
// 让拖放主框从"空态"切换为"已选"态（PDF 徽标 + 文件名），替换框外小字
const hasFile = computed(() => !!props.fileLabel);
const pickedName = computed(() => {
  const label = props.fileLabel || '';
  const sep = label.lastIndexOf(' · ');
  return sep > 0 ? label.slice(0, sep) : label;
});
const pickedSize = computed(() => {
  const label = props.fileLabel || '';
  const sep = label.lastIndexOf(' · ');
  return sep > 0 ? label.slice(sep + 3) : '';
});

function pick() { fileInput.value?.click(); }

function onChoose(e) {
  const f = e?.target?.files?.[0] || e?.[0];
  if (f) emit('choose', f);
  if (e?.target) e.target.value = '';
}

function submitUrl() {
  const v = url.value.trim();
  if (v) emit('submit-url', v);
}

// 恢复任务：手动输入任务 ID 或点击最近任务记录
function submitRestore() {
  const v = restoreId.value.trim();
  if (v) emit('restore', v);
}

function timeAgo(ts) {
  const diff = Date.now() - Number(ts || 0);
  if (!(diff >= 0)) return '';
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

function shortId(id) {
  const s = String(id || '');
  return s.length > 12 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
}
</script>

<template>
  <section class="panel upload-panel fade-in">
    <div class="panel-header">
      <span class="panel-overline">PDF PIPELINE / 01</span>
      <h1 class="panel-title">上传 PDF 文件</h1>
      <p class="panel-lead">文件上传至 BOS 后，自动进入页面识别、候选拆图和人工审核。</p>
    </div>

    <!-- 进行中任务接管（A）：刷新/重进时提示可继续，不自动跳转（保留开新任务自由） -->
    <div v-if="props.activeJob" class="active-job-banner" role="status">
      <i class="active-job-icon" aria-hidden="true"></i>
      <div class="active-job-info">
        <strong>检测到进行中的解析任务</strong>
        <span :title="props.activeJob.pdf_name">{{ props.activeJob.pdf_name }}</span>
      </div>
      <div class="active-job-actions">
        <button class="btn btn-primary" type="button" @click="emit('resume-active')">继续跟进</button>
        <button class="btn btn-ghost" type="button" @click="emit('dismiss-active')">开始新任务</button>
      </div>
    </div>

    <!-- 双状态：未选文件 = 拖放引导（空态）；已选 = PDF 徽标 + 文件名（已选态，点击可更换） -->
    <div v-if="!hasFile" class="dropzone" :class="{ drag: dragging }" role="button" tabindex="0"
         aria-describedby="dropzoneHelp"
         @dragover.prevent="dragging = true"
         @dragleave.prevent="dragging = false"
         @drop.prevent="dragging = false; onChoose($event.dataTransfer.files)"
         @click="pick"
         @keydown.enter.prevent="pick"
         @keydown.space.prevent="pick">
      <div class="upload-icon-wrap" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </div>
      <div class="dropzone-title">拖放 PDF 到这里</div>
      <div class="dropzone-hint" id="dropzoneHelp">或点击下方按钮选择本地文件</div>
      <button class="btn btn-secondary" type="button" @click.stop="pick">选择 PDF</button>
      <input ref="fileInput" type="file" accept="application/pdf" hidden @change="onChoose">
    </div>

    <div v-else class="dropzone picked" :class="{ drag: dragging }" role="button" tabindex="0"
         aria-label="已选择文件，点击可更换"
         @dragover.prevent="dragging = true"
         @dragleave.prevent="dragging = false"
         @drop.prevent="dragging = false; onChoose($event.dataTransfer.files)"
         @click="pick"
         @keydown.enter.prevent="pick"
         @keydown.space.prevent="pick">
      <div class="pdf-badge" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <span>PDF</span>
      </div>
      <div class="picked-info">
        <span class="picked-name" :title="pickedName">{{ pickedName }}</span>
        <span class="picked-meta">
          <i class="picked-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </i>
          已就绪<template v-if="pickedSize"> · {{ pickedSize }}</template>
        </span>
      </div>
      <span class="picked-swap" aria-hidden="true">点击更换文件</span>
      <input ref="fileInput" type="file" accept="application/pdf" hidden @change="onChoose">
    </div>

    <div class="url-row">
      <input v-model="url" class="input" type="url" placeholder="PDF URL（可选）"
             @keydown.enter="submitUrl">
      <button class="btn btn-secondary" type="button" @click="submitUrl">使用 URL</button>
    </div>

    <!-- 审核方式：人工审核（默认，中断等待逐张确认）/ 自动审核（auto_approve，无需人工确认） -->
    <div class="mode-row" role="radiogroup" aria-label="审核方式">
      <span class="mode-label">审核方式</span>
      <div class="mode-options">
        <button type="button" class="mode-option" role="radio"
                :class="{ active: props.reviewMode === 'manual' }"
                :aria-checked="props.reviewMode === 'manual'"
                @click="emit('update:reviewMode', 'manual')">
          <span class="mode-name">人工审核</span>
          <span class="mode-desc">逐张确认候选图片</span>
        </button>
        <button type="button" class="mode-option" role="radio"
                :class="{ active: props.reviewMode === 'auto_approve' }"
                :aria-checked="props.reviewMode === 'auto_approve'"
                @click="emit('update:reviewMode', 'auto_approve')">
          <span class="mode-name">自动审核</span>
          <span class="mode-desc">全部自动通过，无需确认</span>
        </button>
      </div>
    </div>

    <div class="upload-actions">
      <button class="btn btn-ghost" type="button" @click="emit('demo')">加载界面示例</button>
      <button class="btn btn-primary" type="button" :disabled="props.startDisabled"
              @click="emit('start')">
        <span>上传并开始解析</span>
      </button>
    </div>

    <!-- 任务恢复：SSE 中断/页面刷新后凭任务 ID 接续（localStorage 自记录） -->
    <div class="restore-panel">
      <h2>恢复任务</h2>
      <div class="restore-row">
        <input v-model="restoreId" class="input" type="text" placeholder="输入任务 ID（32 位十六进制）"
               @keydown.enter="submitRestore">
        <button class="btn btn-secondary" type="button" @click="submitRestore">恢复</button>
      </div>
      <ul v-if="props.recentJobs.length" class="recent-list">
        <li v-for="job in props.recentJobs" :key="job.job_id">
          <button type="button" class="recent-item"
                  :title="job.job_id"
                  @click="emit('restore', job.job_id)">
            <span class="recent-name">{{ job.pdf_name || 'PDF document' }}</span>
            <span class="recent-meta">
              <i class="recent-hint" :data-hint="job.hint">{{ job.hint }}</i>
              <span class="recent-time">{{ timeAgo(job.added_at) }}</span>
              <code class="recent-id">{{ shortId(job.job_id) }}</code>
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="recent-empty">暂无历史任务记录</p>
    </div>
  </section>
</template>

<style scoped>
/* 上传面板撑满内容容器（.shell 限宽 960px），避免宽屏下卡片过窄、两侧留白过多 */
.upload-panel { max-width: 100%; margin: 0 auto; }
/* 进行中任务接管横幅：仅上传页顶部展示；点「继续跟进」走 restoreJob */
.active-job-banner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-4);
  margin-bottom: var(--space-5);
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--border-focus);
  border-left: 4px solid var(--accent-600);
  border-radius: var(--radius-md);
  background: var(--accent-50, var(--bg-subtle));
}
.active-job-icon {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent-600);
  animation: active-job-pulse 1.6s infinite;
}
@keyframes active-job-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-600) 35%, transparent); }
  50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent-600) 0%, transparent); }
}
.active-job-info { flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 2px; }
.active-job-info strong { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.active-job-info span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-secondary);
}
.active-job-actions { display: flex; gap: var(--space-3); flex: none; }
@media (max-width: 680px) {
  .active-job-actions { width: 100%; }
  .active-job-actions .btn { flex: 1; }
}
/* 已选文件态：PDF 徽标 + 文件名 + 就绪状态 */
.dropzone.picked {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: var(--space-5) var(--space-6);
  border-style: solid;
  border-color: var(--accent-600);
  background: var(--accent-50, var(--bg-subtle));
  text-align: left;
}
.pdf-badge {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 52px;
  height: 60px;
  border: 1.5px solid var(--danger-600);
  border-radius: var(--radius-sm);
  color: var(--danger-600);
  background: var(--bg-panel);
}
.pdf-badge svg { width: 18px; height: 18px; }
.pdf-badge span { font-size: 10px; font-weight: 800; letter-spacing: 0.04em; }
.picked-info { flex: 1; min-width: 0; }
.picked-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picked-meta {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--accent-600);
  font-weight: 500;
}
.picked-check {
  display: inline-flex;
  width: 14px;
  height: 14px;
  padding: 2px;
  border-radius: 50%;
  background: var(--success-600, var(--accent-600));
  color: #fff;
  box-sizing: border-box;
}
.picked-check svg { width: 100%; height: 100%; }
.picked-swap { flex: none; font-size: 12px; color: var(--text-tertiary); text-decoration: underline; text-underline-offset: 3px; }
.dropzone.picked.drag { border-color: var(--accent-600); background: var(--accent-50, var(--bg-subtle)); filter: brightness(0.97); }
.url-row { display: flex; gap: 10px; margin-top: var(--space-5); }
.url-row .input { flex: 1; min-width: 0; }
/* 审核方式分段选择 */
.mode-row { display: flex; align-items: center; gap: var(--space-4); margin-top: var(--space-4); }
.mode-label { flex: none; font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.mode-options { display: flex; flex: 1; gap: 8px; }
.mode-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  text-align: left;
  transition: all var(--duration-fast);
}
.mode-option:hover { border-color: var(--border-focus); background: var(--bg-hover); }
.mode-option.active {
  border-color: var(--accent-600);
  background: var(--accent-50, var(--bg-subtle));
  box-shadow: inset 0 0 0 1px var(--accent-600);
}
.mode-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.mode-option.active .mode-name { color: var(--accent-600); }
.mode-desc { font-size: 11px; color: var(--text-tertiary); }
.upload-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-5);
  gap: var(--space-3);
}
/* 任务恢复面板 */
.restore-panel {
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--divider);
}
.restore-panel h2 {
  margin: 0 0 var(--space-3);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.restore-row { display: flex; gap: 10px; }
.restore-row .input { flex: 1; min-width: 0; font-family: var(--font-mono); }
.recent-list {
  list-style: none;
  margin: var(--space-4) 0 0;
  padding: 0;
  display: grid;
  gap: 6px;
  max-height: 220px;
  overflow: auto;
}
.recent-item {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  text-align: left;
  transition: all var(--duration-fast);
}
.recent-item:hover { border-color: var(--border-focus); background: var(--bg-hover); }
.recent-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-tertiary);
}
.recent-hint { font-style: normal; }
.recent-hint[data-hint="待审核"] { color: var(--warn-600); }
.recent-hint[data-hint="已完成"] { color: var(--success-600, var(--accent-600)); }
.recent-hint[data-hint="失败"], .recent-hint[data-hint="部分失败"] { color: var(--danger-600); }
.recent-id { font-family: var(--font-mono); margin-left: auto; }
.recent-empty {
  margin: var(--space-3) 0 0;
  font-size: 12px;
  color: var(--text-tertiary);
}
@media (max-width: 680px) {
  .url-row { flex-wrap: wrap; }
  .url-row .input { flex-basis: 100%; }
  .mode-row { flex-direction: column; align-items: stretch; gap: var(--space-2); }
  .upload-actions { flex-direction: column; align-items: stretch; }
  .upload-actions .btn-ghost { order: 1; }
  .upload-actions .btn-primary { order: 0; width: 100%; }
}
</style>
