<template>
  <div class="placeholder-page">
    <div class="placeholder-icon">
      <el-icon :size="64" color="#c0c4cc"><Tools /></el-icon>
    </div>
    <h2 class="placeholder-title">{{ pageTitle }}</h2>
    <p class="placeholder-desc">功能开发中，敬请期待...</p>
    <div class="placeholder-dots">
      <span class="dot" /><span class="dot" /><span class="dot" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Tools } from '@element-plus/icons-vue'

const route = useRoute()
const pageTitle = computed(() => (route.meta?.title as string) || '页面')
</script>

<style scoped>
.placeholder-page { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; color: var(--text-tertiary); }
.placeholder-icon { margin-bottom: 16px; }
.placeholder-title { font-size: 20px; color: var(--text-secondary); margin-bottom: 8px; }
.placeholder-desc { font-size: 14px; margin-bottom: 16px; }
.placeholder-dots { display: flex; gap: 6px; }
.dot { width: 8px; height: 8px; background: var(--primary-lighter); border-radius: 50%; animation: bounce 1.4s ease-in-out infinite; }
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
</style>
