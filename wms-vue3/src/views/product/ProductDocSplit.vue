<template>
  <!-- 产品文档拆分：嵌入 WMS 主布局的 PDF 图片解析工作台。
       高度 = 内容区可视高度（本页撑满 el-main，el-main 自身 overflow-y:auto，
       但嵌入模式的工作台根容器自带 overflow:auto，故这里用固定视口高度、
       内部独立滚动，避免双滚动条叠加）。
       组件名不可改：keep-alive include 按名匹配，缓存后切标签页
       SSE 任务进度/审核状态不丢失。 -->
  <div class="product-doc-split">
    <!-- 顶部操作栏：知识库导入入口 -->
    <div class="top-actions">
      <el-button type="primary" plain @click="goToKnowledgeImport">
        <el-icon><Upload /></el-icon>
        知识库导入
      </el-button>
    </div>
    <PdfReviewWorkbench embedded />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Upload } from '@element-plus/icons-vue'
import PdfReviewWorkbench from '@/views/ai/pdf-review/index.vue'

defineOptions({ name: 'ProductDocSplit' })

const router = useRouter()

function goToKnowledgeImport() {
  router.push('/product/knowledge-import')
}
</script>

<style scoped>
.product-doc-split {
  /* 56 顶栏 + 38 标签条 = 94；再减内容区上下 padding（--space-main 上下各 12） */
  height: calc(100vh - 94px - 24px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 8px;
  /* 跟随系统主题页面底色（浅色 #F5F6F7 / 深色 #141618） */
  background: var(--bg-page);
}

.top-actions {
  padding: 12px 16px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
}

.product-doc-split > :deep(.pdf-workbench) {
  flex: 1;
  min-height: 0;
}
</style>
