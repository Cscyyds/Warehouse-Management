<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

// DESIGN_SPEC 6.8 弹窗：遮罩 blur、内容弹入、焦点陷阱、Esc 关闭
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' }
});
const emit = defineEmits(['close']);

const dialog = ref(null);
let lastFocused = null;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

watch(() => props.open, async (open) => {
  if (open) {
    await nextTick();
    lastFocused = document.activeElement;
    const el = dialog.value?.querySelector?.(FOCUSABLE);
    (el || dialog.value)?.focus?.();
  } else if (lastFocused) {
    lastFocused.focus?.();
  }
});

function onKeydown(e) {
  if (!props.open) return;
  if (e.key === 'Escape') { e.preventDefault(); emit('close'); return; }
  if (e.key !== 'Tab') return;
  // 焦点陷阱
  const nodes = dialog.value?.querySelectorAll?.(FOCUSABLE) || [];
  if (!nodes.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
}

watch(() => props.open, (open) => {
  if (open) window.addEventListener('keydown', onKeydown);
  else window.removeEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

function onBackdrop(e) {
  if (e.target === e.currentTarget) emit('close');
}
</script>

<template>
  <div v-if="props.open" class="modal-bg" @mousedown.self="onBackdrop">
    <div ref="dialog" class="modal" role="dialog" aria-modal="true"
         :aria-label="props.title || undefined">
      <div class="modal-head">
        <div>
          <h2>{{ props.title }}</h2>
          <p v-if="props.subtitle">{{ props.subtitle }}</p>
        </div>
        <button class="btn btn-ghost" type="button" @click="emit('close')">关闭</button>
      </div>
      <div class="modal-body"><slot></slot></div>
      <div class="modal-foot"><slot name="footer"></slot></div>
    </div>
  </div>
</template>

<style scoped>
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-default);
}
.modal-head h2 { margin: 0; font-size: 17px; font-weight: 700; }
.modal-head p { margin: 4px 0 0; color: var(--text-tertiary); font-size: 12px; }
.modal-body { padding: 18px 20px; }
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-default);
}
</style>
