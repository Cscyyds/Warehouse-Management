<script setup lang="ts">
import { ref } from 'vue'
import { ElDialog } from 'element-plus'
import type { ErrorDialogContent } from '@/utils/errorDialogModel'

defineProps<{ content: ErrorDialogContent }>()
defineEmits<{ closed: [] }>()
const visible = ref(true)
</script>

<template>
  <ElDialog v-model="visible" class="wms-error-dialog" modal-class="wms-error-overlay"
    width="520px" align-center append-to-body :close-on-click-modal="false"
    :close-on-press-escape="true" :show-close="false" :title="content.title" @closed="$emit('closed')">
    <template #header="{ titleId, titleClass }">
      <div class="wms-error-heading">
        <span class="wms-error-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M12 6v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <circle cx="12" cy="18" r="1" fill="currentColor" />
          </svg>
        </span>
        <h2 :id="titleId" :class="titleClass">{{ content.title }}</h2>
        <button type="button" class="wms-error-close" aria-label="关闭错误窗口" @click="visible = false">×</button>
      </div>
    </template>
    <div class="wms-error-content">
      <p>{{ content.reason }}</p>
      <p v-if="content.fields.length" class="wms-error-fields"><strong>字段：</strong>{{ content.fields.join('、') }}</p>
      <details v-if="content.details.length" class="wms-error-details">
        <summary>查看错误明细（{{ content.details.length }} 条）</summary>
        <ul><li v-for="(detail, index) in content.details" :key="index">{{ detail }}</li></ul>
      </details>
    </div>
    <template #footer>
      <div class="wms-error-actions">
        <button type="button" class="wms-error-confirm" autofocus @click="visible = false">知道了</button>
      </div>
    </template>
  </ElDialog>
</template>

<style>
/* Three base colors only. All controls, focus states and scrollbars reuse them. */
.el-dialog.wms-error-dialog {
  --error-surface: #fff;
  --error-ink: #1f2329;
  --error-accent: #922b21;
  --el-dialog-bg-color: var(--error-surface);
  --el-text-color-primary: var(--error-ink);
  color: var(--error-ink);
  background: var(--error-surface) !important;
  border: 1px solid var(--error-ink) !important;
  border-radius: var(--radius-lg, 16px) !important;
  box-shadow: none !important;
  max-width: calc(100vw - 32px);
  align-self: center;
  flex: none;
  height: auto;
  margin: auto !important;
}
html.dark .wms-error-dialog {
  --error-surface: #1e2128;
  --error-ink: #e8e9eb;
  --error-accent: #c0392b;
}
.el-dialog.wms-error-dialog > .el-dialog__header,
.el-dialog.wms-error-dialog > .el-dialog__footer { border: 0 !important; }
.el-dialog.wms-error-dialog .el-dialog__body { color: var(--error-ink); }
.wms-error-heading { display: flex; align-items: center; gap: 12px; }
.wms-error-dialog .el-dialog__title { color: var(--error-ink) !important; flex: 1; line-height: 1.5; }
.wms-error-mark {
  display: grid; place-items: center; box-sizing: border-box; flex: 0 0 30px; width: 30px; height: 30px;
  border: 2px solid var(--error-accent); border-radius: 50%;
  color: var(--error-accent); font-size: 20px; font-weight: 700; line-height: 1;
}
.wms-error-mark svg { display: block; }
.wms-error-dialog button {
  font: inherit; cursor: pointer; border: 1px solid var(--error-ink);
  border-radius: var(--radius-sm, 8px); padding: 8px 14px;
  background: var(--error-surface); color: var(--error-ink);
}
.wms-error-dialog button:hover { border-color: var(--error-accent); text-decoration: underline; }
.wms-error-dialog button:focus-visible,
.wms-error-details summary:focus-visible { outline: 2px solid var(--error-accent); outline-offset: 3px; }
.wms-error-dialog .wms-error-close { border: 0; padding: 0 6px; font-size: 26px; line-height: 1.2; }
.wms-error-dialog .wms-error-close:hover { color: var(--error-accent); text-decoration: none; }
.wms-error-content { max-height: 50vh; overflow: auto; overflow-wrap: anywhere; white-space: pre-wrap; font-size: var(--font-base, 14px); line-height: 1.7; scrollbar-color: var(--error-ink) var(--error-surface); }
.wms-error-content::-webkit-scrollbar-thumb { background: var(--error-ink); }
.wms-error-content::-webkit-scrollbar-track { background: var(--error-surface); }
.wms-error-fields, .wms-error-details { margin-top: 16px; }
.wms-error-details summary { cursor: pointer; color: var(--error-accent); }
.wms-error-details ul { margin: 12px 0 0; padding-left: 22px; }
.wms-error-details li + li { margin-top: 8px; }
.wms-error-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 12px; }
.wms-error-dialog .wms-error-confirm { background: var(--error-accent); border-color: var(--error-accent); color: var(--error-surface); }
html.dark .wms-error-dialog .wms-error-confirm { color: var(--error-ink); }
.wms-error-overlay.is-message-box, .wms-error-overlay { background-color: rgba(0, 0, 0, .45); }
</style>
