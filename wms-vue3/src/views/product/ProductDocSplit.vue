<template>
  <!-- 产品文档拆分：嵌入 WMS 主布局的 PDF 图片解析工作台。
       高度策略：不再用 calc(100vh - 94px - 24px) 这类魔数 —— 顶栏 56px 在 ≤960px
       会降为 50px，--space-main 又是 clamp 动态值（10~16px），两者都会让硬编码值失准，
       窄屏下表现为底部被裁或出现双滚动条。
       改为纯 flex 链：本薄壳撑满 el-main 的内容盒，滚动下放给工作台内部
       （.pdf-workbench.embedded > .workbench-body），与 MainLayout 的
       .main-content（flex:1 / overflow-y:auto）分工明确、互不叠加。
       组件名不可改：keep-alive include 按名匹配，缓存后切标签页
       SSE 任务进度/审核状态不丢失。 -->
  <div class="product-doc-split">
    <!-- 页头：标题 + 说明 + 跨页入口。
         原先只是一条仅放「知识库导入」的独立白条，视觉噪音大、信息量极低；
         改为与其他 WMS 页面一致的页头形态（标题说明在左、操作在右）。 -->
    <header class="page-head">
      <div class="page-head-text">
        <h1 class="page-title">产品文档拆分</h1>
        <p class="page-desc">上传 PDF 后自动完成页面识别、候选拆图与人工审核，并可导出 Excel 校验后入库产品知识库</p>
      </div>
      <!-- 双引擎切换（功能开关 VITE_PDF_AGENT_TOGGLE=1 时才显示）：同一个工作台、
           同一套交互，仅切换后端解析链路。Coze 走网关 SSE；pdf_agent 走同源
           /pdf-agent 子应用。首期上线仅 Coze 引擎，开关默认隐藏。 -->
      <div class="page-head-actions">
        <el-radio-group v-if="showEngineSwitch" v-model="engine" size="small" class="engine-switch">
          <el-radio-button value="coze">Coze 工作流</el-radio-button>
          <el-radio-button value="agent">pdf_agent（本地复刻）</el-radio-button>
        </el-radio-group>
        <el-button type="primary" plain class="page-head-action" @click="goToKnowledgeImport">
          <el-icon><Upload /></el-icon>
          知识库导入
        </el-button>
      </div>
    </header>
    <!-- 引擎以 prop 注入工作台，页面与交互完全不变 -->
    <PdfReviewWorkbench embedded :engine="engine" @engine-revert="engine = $event" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Upload } from '@element-plus/icons-vue'
import PdfReviewWorkbench from '@/views/ai/pdf-review/index.vue'

defineOptions({ name: 'ProductDocSplit' })

const router = useRouter()

// pdf_agent 引擎功能开关：默认关闭（仅 Coze 上线）。放开时在 .env 设
// VITE_PDF_AGENT_TOGGLE=1 并重新构建。关闭时强制 Coze 并清掉调试期
// 残留的 localStorage 引擎记忆——光藏按钮不够，旧值会把用户静默留在 agent 链路。
const showEngineSwitch = import.meta.env.VITE_PDF_AGENT_TOGGLE === '1'

const engine = ref<'coze' | 'agent'>(
  showEngineSwitch && localStorage.getItem('doc_split_engine') === 'agent' ? 'agent' : 'coze')
if (!showEngineSwitch) localStorage.removeItem('doc_split_engine')
watch(engine, v => {
  if (showEngineSwitch) localStorage.setItem('doc_split_engine', v)
})

function goToKnowledgeImport() {
  router.push('/product/knowledge-import')
}
</script>

<style scoped>
.product-doc-split {
  /* flex 链撑满 el-main 内容盒；overflow:hidden 保证滚动只发生在工作台内部 */
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 8px;
  /* 跟随系统主题页面底色（浅色 #F5F6F7 / 深色 #141618） */
  background: var(--bg-page);
}

/* 页头：与其他 WMS 页面一致的标题行形态 */
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex: none;
  padding: 12px 16px;
  background: var(--bg-white);
  border-bottom: 1px solid var(--border-color);
}
.page-head-text { min-width: 0; }
.page-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-primary);
}
.page-desc {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page-head-action { flex: none; }
.page-head-actions { display: flex; align-items: center; gap: 10px; flex: none; }
.engine-switch { flex: none; }

/* 窄屏：说明与按钮堆叠，避免标题被挤压换行 */
@media (max-width: 900px) {
  .page-head { flex-direction: column; align-items: stretch; gap: 8px; }
  .page-desc { white-space: normal; }
}

.product-doc-split > :deep(.pdf-workbench) {
  flex: 1;
  min-height: 0;
}
</style>