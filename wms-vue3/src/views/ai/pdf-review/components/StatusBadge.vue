<script setup>
// DESIGN_SPEC 6.1 状态徽章
const props = defineProps({
  status: { type: String, default: 'waiting' },
  text: { type: String, default: '等待上传' }
});
</script>

<template>
  <span class="status-badge" :data-status="props.status">
    <span class="status-dot"></span>
    <span class="status-text">{{ props.text }}</span>
  </span>
</template>
