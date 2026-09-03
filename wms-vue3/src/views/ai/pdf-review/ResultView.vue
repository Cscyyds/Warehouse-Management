<script setup>
import { computed } from 'vue';
// DESIGN_SPEC 结果面板：指标卡 + 发布进度 + JSON 复制 + 重新解析
const props = defineProps({
  productCount: { type: [String, Number], default: '-' },
  productsState: { type: String, default: '-' },
  imagesState: { type: String, default: '-' },
  productsJson: { type: String, default: '[]' },
  imagesJson: { type: String, default: '[]' },
  message: { type: String, default: '所有候选图片已审核，结果如下。' },
  publish: { type: Object, default: () => ({ status: '', processed: 0, failed: 0, remaining: 0, hasMore: false, retrying: false, driving: false }) }
});
const emit = defineEmits(['copy', 'restart', 'retry-failed', 'continue-publish']);

const publishBusy = computed(() => props.publish.driving || props.publish.retrying);
// 状态行文案：发布中 / 部分失败 / 已完成
const publishStatusText = computed(() => {
  if (props.publish.retrying) return '正在重试失败图片…';
  if (props.publish.driving) return '正在发布图片…';
  switch (props.publish.status) {
    case 'publishing': return '发布中';
    case 'publish_partial': return '发布完成（部分图片失败）';
    case 'published': return '发布完成';
    default: return props.publish.status ? props.publish.status : '';
  }
});

async function copy(kind) {
  const text = kind === 'products' ? props.productsJson : props.imagesJson;
  try {
    await navigator.clipboard.writeText(text);
    emit('copy', true); // success toast
  } catch {
    emit('copy', false);
  }
}
</script>

<template>
  <section class="panel result-panel fade-in">
    <div class="panel-header">
      <span class="panel-overline">PDF PIPELINE / 04</span>
      <h1 class="panel-title">解析完成</h1>
      <p class="panel-lead">{{ props.message }}</p>
    </div>

    <div class="result-grid">
      <div class="result-card"><span>产品数量</span><strong>{{ props.productCount }}</strong></div>
      <div class="result-card"><span>产品数据</span><strong>{{ props.productsState }}</strong></div>
      <div class="result-card"><span>正式图片</span><strong>{{ props.imagesState }}</strong></div>
    </div>

    <!-- 发布进度：S3 发布可见性（已发布 / 失败 / 剩余 + 重试、续跑入口） -->
    <div v-if="props.publish.status" class="publish-panel" :data-status="props.publish.status">
      <div class="publish-head">
        <span v-if="publishBusy" class="publish-spinner" aria-hidden="true"></span>
        <strong>{{ publishStatusText }}</strong>
        <span class="publish-counts">
          已发布 {{ props.publish.processed }} · 失败 {{ props.publish.failed }} · 剩余 {{ props.publish.remaining }}
        </span>
      </div>
      <div class="publish-actions">
        <button v-if="props.publish.failed > 0" class="btn btn-secondary" type="button"
                :disabled="publishBusy" @click="emit('retry-failed')">重试失败图片</button>
        <button v-if="props.publish.status === 'publishing' && props.publish.remaining > 0"
                class="btn btn-secondary" type="button"
                :disabled="publishBusy" @click="emit('continue-publish')">继续发布剩余</button>
      </div>
    </div>

    <div class="result-block">
      <h3>product_data_json
        <button class="btn btn-ghost" type="button" @click="copy('products')">复制</button>
      </h3>
      <pre>{{ props.productsJson }}</pre>
    </div>
    <div class="result-block">
      <h3>image_urls_json
        <button class="btn btn-ghost" type="button" @click="copy('images')">复制</button>
      </h3>
      <pre>{{ props.imagesJson }}</pre>
    </div>

    <button class="btn btn-secondary restart" type="button" @click="emit('restart')">解析新的 PDF</button>
  </section>
</template>

<style scoped>
.result-panel { max-width: 920px; margin: 0 auto; }
.result-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
  margin: var(--space-6) 0;
}
.result-card {
  padding: var(--space-5);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  box-shadow: var(--shadow-sm);
}
.result-card span { display: block; color: var(--text-tertiary); font-size: 12px; font-weight: 500; }
.result-card strong { display: block; margin-top: 6px; font-size: 22px; font-weight: 700; color: var(--text-primary); }
/* 发布进度面板 */
.publish-panel {
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--border-default);
  border-left: 4px solid var(--accent-600);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}
.publish-panel[data-status="publishing"] { border-left-color: var(--info-600); }
.publish-panel[data-status="publish_partial"] { border-left-color: var(--warn-600); }
.publish-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 14px;
}
.publish-head strong { color: var(--text-primary); }
.publish-counts { color: var(--text-tertiary); font-size: 13px; }
.publish-spinner {
  flex: none;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(13, 138, 109, 0.22);
  border-top-color: var(--accent-600);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.publish-actions { display: flex; gap: var(--space-3); margin-top: var(--space-3); }
@keyframes spin { to { transform: rotate(360deg); } }
.result-block { margin-top: var(--space-5); }
.result-block h3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.result-block pre {
  max-height: 280px;
  overflow: auto;
  padding: 14px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  font: 12px/1.55 var(--font-mono);
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-secondary);
  margin: 0;
}
.restart { margin-top: var(--space-6); }
@media (max-width: 680px) { .result-grid { grid-template-columns: 1fr; } }
</style>
