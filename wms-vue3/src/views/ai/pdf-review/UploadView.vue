<script setup>
import { ref } from 'vue';

// DESIGN_SPEC 6.4 / 5.3 上传面板
const props = defineProps({
  fileLabel: { type: String, default: '' },
  startDisabled: { type: Boolean, default: true },
  recentJobs: { type: Array, default: () => [] }
});
const emit = defineEmits(['choose', 'submit-url', 'start', 'demo', 'restore']);

const dragging = ref(false);
const url = ref('');
const fileInput = ref(null);
const restoreId = ref('');

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

    <div class="dropzone" :class="{ drag: dragging }" role="button" tabindex="0"
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

    <div v-if="props.fileLabel" class="file-info">{{ props.fileLabel }}</div>

    <div class="url-row">
      <input v-model="url" class="input" type="url" placeholder="BOS PDF URL（可选）"
             @keydown.enter="submitUrl">
      <button class="btn btn-secondary" type="button" @click="submitUrl">使用 URL</button>
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
.upload-panel { max-width: 640px; margin: 0 auto; }
.file-info {
  min-height: 24px;
  margin-top: var(--space-4);
  color: var(--text-secondary);
  font-size: 13px;
  text-align: center;
}
.url-row { display: flex; gap: 10px; margin-top: var(--space-5); }
.url-row .input { flex: 1; min-width: 0; }
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
.recent-hint[data-hint="已完成"] { color: var(--accent-600); }
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
  .upload-actions { flex-direction: column; align-items: stretch; }
  .upload-actions .btn-ghost { order: 1; }
  .upload-actions .btn-primary { order: 0; width: 100%; }
}
</style>
