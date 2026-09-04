<script setup>
import { computed, ref } from 'vue';
// DESIGN_SPEC 结果面板：指标卡 + 发布进度 + 图片墙（带描述）+ 重新解析
// 注：productsJson/imagesJson 仅作为画廊数据源在组件内部消费，不再渲染原始 JSON
const props = defineProps({
  productCount: { type: [String, Number], default: '-' },
  productsState: { type: String, default: '-' },
  imagesState: { type: String, default: '-' },
  productsJson: { type: String, default: '[]' },
  imagesJson: { type: String, default: '[]' },
  message: { type: String, default: '所有候选图片已审核，结果如下。' },
  publish: { type: Object, default: () => ({ status: '', processed: 0, failed: 0, remaining: 0, hasMore: false, retrying: false, driving: false }) }
});
const emit = defineEmits(['restart', 'retry-failed', 'continue-publish']);

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

// 图片墙：优先从 product_data_json 构建富数据（URL + 描述 + 类型 + 页码 + 产品名），
// product_data_json 解析不到时回退 image_urls_json 纯 URL 列表
const TYPE_LABELS = {
  main: '主图', size: '尺寸图', install: '安装图',
  detail: '细节图', structure: '结构图', other: '其他图',
};
const galleryItems = computed(() => {
  const items = [];
  const seen = new Set();
  const push = (url, meta = {}) => {
    if (!url || typeof url !== 'string' || seen.has(url)) return;
    seen.add(url);
    items.push({
      url,
      description: String(meta.description || ''),
      typeLabel: TYPE_LABELS[meta.image_type] || '',
      pageNumber: Number(meta.page_number) || 0,
      productName: String(meta.product_name || ''),
    });
  };
  try {
    const parsed = JSON.parse(props.productsJson);
    for (const p of (Array.isArray(parsed) ? parsed : [])) {
      const name = String(p?.product_basic?.product_name || p?.product_name || '');
      for (const img of (p?.product_images || [])) {
        push(img?.image_url, {
          description: img?.description,
          image_type: img?.image_type,
          page_number: img?.page_number,
          product_name: name,
        });
      }
    }
  } catch { /* 回退到 URL 列表 */ }
  if (!items.length) {
    try {
      const urls = JSON.parse(props.imagesJson);
      (Array.isArray(urls) ? urls : []).forEach(u => push(u));
    } catch { /* 无图片 */ }
  }
  return items;
});
// 图片说明文案：描述 → 类型 → 页码 → 序号，逐级兜底
function captionOf(item, index) {
  if (item.description) return item.description;
  if (item.typeLabel) return item.typeLabel + (item.pageNumber ? ` · 第 ${item.pageNumber} 页` : '');
  if (item.pageNumber) return `第 ${item.pageNumber} 页`;
  return `图片 ${index + 1}`;
}
// 加载失败的图片（占位提示，不阻塞其他图）
const broken = ref({});
function markBroken(url) { broken.value = { ...broken.value, [url]: true }; }
// 点击放大（遮罩内带描述与产品名）
const preview = ref(null);
function openPreview(item) { preview.value = item; }
function closePreview() { preview.value = null; }
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

    <!-- 成品图片墙：BOS 持久外链直显，带图片描述，点击放大 -->
    <div v-if="galleryItems.length" class="result-block">
      <h3>成品图片（{{ galleryItems.length }}）</h3>
      <div class="gallery">
        <figure v-for="(item, i) in galleryItems" :key="item.url" class="shot">
          <img v-if="!broken[item.url]" :src="item.url" :alt="captionOf(item, i)" loading="lazy"
               @click="openPreview(item)" @error="markBroken(item.url)">
          <div v-else class="shot-broken" aria-label="图片加载失败">图片加载失败</div>
          <figcaption>
            <span class="cap-text" :title="captionOf(item, i)">{{ captionOf(item, i) }}</span>
            <span v-if="item.typeLabel" class="cap-tag">{{ item.typeLabel }}</span>
          </figcaption>
        </figure>
      </div>
    </div>

    <button class="btn btn-secondary restart" type="button" @click="emit('restart')">解析新的 PDF</button>

    <!-- 图片放大预览（含描述/类型/页码/产品名） -->
    <Teleport to="body">
      <div v-if="preview" class="preview-mask" @click="closePreview">
        <img :src="preview.url" :alt="preview.description || '图片预览'" @click.stop>
        <div class="preview-meta" @click.stop>
          <strong v-if="preview.description">{{ preview.description }}</strong>
          <span class="preview-tags">
            <em v-if="preview.productName">{{ preview.productName }}</em>
            <em v-if="preview.typeLabel">{{ preview.typeLabel }}</em>
            <em v-if="preview.pageNumber">第 {{ preview.pageNumber }} 页</em>
          </span>
        </div>
        <button class="btn btn-secondary preview-close" type="button" @click="closePreview">关闭</button>
      </div>
    </Teleport>
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
/* 图片墙 */
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}
.shot {
  margin: 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  overflow: hidden;
  cursor: zoom-in;
  transition: border-color var(--duration-fast);
}
.shot:hover { border-color: var(--border-focus); }
.shot img {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  background: var(--bg-subtle);
}
.shot-broken {
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-tertiary);
  background: var(--bg-subtle);
}
.shot figcaption {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 11px;
  color: var(--text-tertiary);
}
.cap-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
}
.cap-tag {
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--accent-50, var(--bg-subtle));
  color: var(--accent-600);
  font-weight: 600;
}
/* 图片放大预览 */
.preview-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 32px;
  background: rgba(0, 0, 0, 0.72);
}
.preview-mask img {
  max-width: min(92vw, 1100px);
  max-height: 70vh;
  object-fit: contain;
  border-radius: var(--radius-md);
  background: #fff;
}
.preview-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  max-width: min(92vw, 1100px);
  color: #fff;
  text-align: center;
}
.preview-meta strong {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
}
.preview-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.preview-tags em {
  font-style: normal;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 12px;
}
.preview-close { flex: none; }
.restart { margin-top: var(--space-6); }
@media (max-width: 680px) { .result-grid { grid-template-columns: 1fr; } }
</style>
