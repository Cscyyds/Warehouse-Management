<script setup>
import StatusBadge from './StatusBadge.vue';
const props = defineProps({
  status: { type: String, default: 'waiting' },
  statusText: { type: String, default: '等待上传' },
  title: { type: String, default: 'PDF 图片解析工作台' },
  sub: { type: String, default: '识图拆图 · 产品整理 · 人工审核' }
});
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">PDF</div>
      <div>
        <div class="brand-title">{{ props.title }}</div>
        <div class="brand-sub">{{ props.sub }}</div>
      </div>
    </div>
    <StatusBadge :status="props.status" :text="props.statusText" />
  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 28px;
  background: rgba(255, 255, 255, 0.95);
  border-bottom: 1px solid var(--border-default);
  backdrop-filter: blur(10px);
}
.brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.brand-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: #111827;
  color: var(--text-inverse);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  flex: none;
}
.brand-title { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; white-space: nowrap; }
.brand-sub { margin-top: 1px; color: var(--text-tertiary); font-size: 12px; white-space: nowrap; }
@media (max-width: 680px) {
  .topbar { padding: 0 16px; }
  .brand-sub { display: none; }
}
</style>
