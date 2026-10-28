<template>
  <!-- pdf_agent 独立调试页：真实工作台 UI，引擎固定 pdf_agent（本地复刻链路）。
       与「产品文档拆分」页已同引擎（该页亦固定 pdf_agent），本页保留为无 WMS 布局
       的全屏排障入口；/ai 前缀登录即达。
       后端需 /pdf-agent 可达：本地 = vite 代理 → 127.0.0.1:8001（VITE_PDF_PROXY_TARGET），
       线上 = 网关挂载的 /pdf-agent（随 Coze_Connect 部署）。 -->
  <div class="agent-debug">
    <div class="agent-debug-bar">
      <span class="agent-debug-title">pdf_agent 调试台</span>
      <span class="agent-debug-hint">
      </span>
    </div>
    <PdfReviewWorkbench engine="agent" />
  </div>
</template>

<script setup lang="ts">
import PdfReviewWorkbench from '@/views/ai/pdf-review/index.vue'

defineOptions({ name: 'PdfAgentDebug' })
</script>

<style scoped>
.agent-debug {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.agent-debug-bar {
  flex: none;
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 8px 16px;
  background: var(--el-color-warning-light-9, #fdf6ec);
  border-bottom: 1px solid var(--el-border-color-light, #e4e7ed);
}

.agent-debug-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-warning-dark-2, #b88230);
}

.agent-debug-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.agent-debug > :deep(.pdf-workbench) {
  flex: 1;
  min-height: 0;
}
</style>
