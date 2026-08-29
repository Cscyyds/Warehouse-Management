<script setup>
// DESIGN_SPEC 结果面板：指标卡 + JSON 复制 + 重新解析
const props = defineProps({
  productCount: { type: [String, Number], default: '-' },
  productsState: { type: String, default: '-' },
  imagesState: { type: String, default: '-' },
  productsJson: { type: String, default: '[]' },
  imagesJson: { type: String, default: '[]' },
  message: { type: String, default: '所有候选图片已审核，结果如下。' }
});
const emit = defineEmits(['copy', 'restart']);

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
