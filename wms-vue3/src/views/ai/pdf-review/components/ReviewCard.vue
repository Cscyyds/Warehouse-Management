<script setup>
import { ref } from 'vue';

// DESIGN_SPEC 6.9 审核卡片：顶部色条、4 决策按钮、键盘导航
const props = defineProps({
  item: { type: Object, required: true },
  index: { type: Number, default: 0 },
  decision: { type: Object, default: null }
});
const emit = defineEmits(['decide']);

const root = ref(null);
const ACTIONS = [
  { key: 'approve', label: '通过', labelClass: 'approve' },
  { key: 'reject', label: '拒绝', labelClass: 'reject' },
  { key: 'skip', label: '跳过', labelClass: 'skip' },
  { key: 'recrop', label: '重裁', labelClass: 'recrop' }
];

// 枚举字段英文 value + 中文 label（后端 image_type 存英文枚举值）
const IMAGE_TYPE_LABELS = {
  main: '主图', install: '安装图', detail: '细节图',
  size: '尺寸图', structure: '结构图', other: '其他'
};
function typeLabel(value) {
  return IMAGE_TYPE_LABELS[value] || value || '其他';
}

function isActive(action) {
  return props.decision?.action === action;
}

function buttons() {
  return root.value?.querySelectorAll?.('[data-card-action]') || [];
}

function onKeydown(e) {
  const btns = buttons();
  if (!btns.length) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const i = Array.from(btns).indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === 'ArrowRight' ? btns[(i + 1) % btns.length] : btns[(i - 1 + btns.length) % btns.length];
    next.focus();
  }
}
</script>

<template>
  <article ref="root" class="review-card"
           :data-decision="decision?.action || ''"
           @keydown="onKeydown">
    <div class="card-preview">
      <img v-if="props.item.preview_url" :src="props.item.preview_url" alt="preview" loading="lazy">
      <div v-else class="card-preview empty">无预览</div>
      <span class="preview-label">图片 {{ props.index + 1 }}</span>
    </div>
    <div class="card-body">
      <div class="card-title">{{ props.item.product_name || '候选产品' }}</div>
      <div class="card-meta">
        <span>{{ typeLabel(props.item.image_type) }}</span>
        <span>第 {{ props.item.pdf_page_number ?? '-' }} 页</span>
      </div>
      <p class="card-desc">{{ props.item.description || '无描述' }}</p>
      <div class="card-actions">
        <button v-for="a in ACTIONS" :key="a.key"
                :class="['action', { active: isActive(a.key), [a.labelClass]: isActive(a.key) }]"
                data-card-action type="button"
                :aria-pressed="isActive(a.key)"
                @click="emit('decide', a.key)">{{ a.label }}</button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.review-card {
  position: relative;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: all var(--duration-fast) var(--ease-out);
}
.review-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
/* 顶部决策色条（DESIGN_SPEC 6.9） */
.review-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  width: 0;
  transition: width 150ms var(--ease-out);
  z-index: 2;
}
.review-card[data-decision="approve"]::before { width: 100%; background: var(--accent-500); }
.review-card[data-decision="reject"]::before { width: 100%; background: var(--danger-600); }
.review-card[data-decision="skip"]::before { width: 100%; background: var(--warn-600); }
.review-card[data-decision="recrop"]::before { width: 100%; background: var(--info-600); }

.card-preview { position: relative; aspect-ratio: 16 / 10; background: var(--bg-subtle); overflow: hidden; }
.card-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
.preview-label {
  position: absolute;
  top: 10px; left: 10px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: rgba(17, 24, 39, 0.78);
  color: var(--text-inverse);
  font-size: 11px;
  font-weight: 600;
}
.card-body { padding: 14px; }
.card-title { font-size: 14px; font-weight: 700; color: var(--text-primary); line-height: 1.35; }
.card-meta { display: flex; gap: 12px; margin-top: 6px; color: var(--text-tertiary); font-size: 12px; }
.card-desc { margin: 10px 0 0; color: var(--text-secondary); font-size: 12px; line-height: 1.5; min-height: 36px; }

.card-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 12px;
}
.action {
  min-height: 32px;
  padding: 0 4px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-panel);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  transition: all var(--duration-fast);
}
.action:hover:not(.active) { background: var(--bg-hover); }
.action:active { transform: scale(0.97); }
.action.active.approve { border-color: var(--accent-500); background: var(--accent-50); color: var(--accent-900); }
.action.active.reject { border-color: var(--danger-600); background: var(--danger-50); color: var(--danger-600); }
.action.active.skip { border-color: var(--warn-600); background: var(--warn-50); color: var(--warn-600); }
.action.active.recrop { border-color: var(--info-600); background: var(--info-50); color: var(--info-600); }
</style>
