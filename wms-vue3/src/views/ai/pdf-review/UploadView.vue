<script setup>
import { ref } from 'vue';

// DESIGN_SPEC 6.4 / 5.3 上传面板
const props = defineProps({
  fileLabel: { type: String, default: '' },
  startDisabled: { type: Boolean, default: true }
});
const emit = defineEmits(['choose', 'submit-url', 'start', 'demo']);

const dragging = ref(false);
const url = ref('');
const fileInput = ref(null);

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
@media (max-width: 680px) {
  .url-row { flex-wrap: wrap; }
  .url-row .input { flex-basis: 100%; }
  .upload-actions { flex-direction: column; align-items: stretch; }
  .upload-actions .btn-ghost { order: 1; }
  .upload-actions .btn-primary { order: 0; width: 100%; }
}
</style>
