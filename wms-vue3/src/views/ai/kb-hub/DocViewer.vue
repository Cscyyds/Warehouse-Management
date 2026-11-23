<script setup>
/**
 * 已入库文档的分块详情（右侧抽屉，只读）：按入库时的参数快照重算分块，
 * 与入库结果一致；顶部列出该快照，便于对照「为什么切成这样」。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import PreviewPanel from './PreviewPanel.vue';
import { chunkDocument, EMBEDDING_MODELS, separatorCode } from './chunker';

const props = defineProps({
  doc: { type: Object, required: true },   // KbDocRecord：status=ready，带 source / config
  kbName: { type: String, default: '' },
});
const emit = defineEmits(['close']);

const cfg = computed(() => props.doc.config);
const result = computed(() => chunkDocument(props.doc.source, cfg.value));
const results = computed(() => new Map([[props.doc.source.id, result.value]]));
const docs = computed(() => [props.doc.source]);

const SPLIT_LABEL = { paragraph: '按段落', length: '按长度', separator: '按分隔符' };
const PRECISION_LABEL = { coarse: '粗粒度', standard: '标准', fine: '精细', custom: '自定义' };

const params = computed(() => {
  const c = cfg.value;
  const out = [{ k: '处理方式', v: props.doc.storeMode }];
  if (c.storeMode !== 'whole') {
    out.push({ k: '分块条件', v: c.trigger === 'force' ? '强制分块' : `原文 > ${c.triggerLength} 字` });
    if (c.storeMode === 'chunk') {
      out.push({
        k: '分块方式',
        v: c.splitBy === 'separator' ? `按分隔符 ${c.separators.map(separatorCode).join(' ')}` : SPLIT_LABEL[c.splitBy],
      });
    }
    out.push({
      k: '切片精度',
      v: `${PRECISION_LABEL[c.precision]} · 最大 ${c.maxChunkSize} 字${c.storeMode === 'chunk' ? ` · 重叠 ${c.overlap} 字` : ''}`,
    });
    out.push({ k: '最大段落深度', v: String(c.maxDepth) });
  }
  const idx = [c.titleToIndex && '标题', c.autoIndex && '关键词与摘要'].filter(Boolean);
  out.push({ k: '索引增强', v: `${idx.length ? idx.join('、') : '无'} · 索引 ${c.indexSize} 字` });
  out.push({ k: '向量模型', v: EMBEDDING_MODELS.find(m => m.value === c.embeddingModel)?.label || c.embeddingModel });
  return out;
});

function fmtTime(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── 抽屉行为：Esc 关闭、锁背景滚动、打开时聚焦关闭按钮 ──
const closeBtn = ref(null);
let prevOverflow = '';
function onKeydown(e) { if (e.key === 'Escape') emit('close'); }
onMounted(async () => {
  prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  window.addEventListener('keydown', onKeydown);
  await nextTick();
  closeBtn.value?.focus();
});
onBeforeUnmount(() => {
  document.body.style.overflow = prevOverflow;
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div class="viewer-bg" @mousedown.self="emit('close')">
    <aside class="viewer" role="dialog" aria-modal="true" :aria-label="`${props.doc.name} 分块详情`">
      <header class="viewer-head">
        <i class="ext-badge" :data-ext="props.doc.ext">{{ props.doc.ext === 'text' ? 'TXT' : props.doc.ext }}</i>
        <div class="vh-info">
          <span class="panel-overline">{{ props.kbName }} / 已入库</span>
          <h2 :title="props.doc.name">{{ props.doc.name }}</h2>
          <span class="vh-meta">
            {{ props.doc.chunks }} 个分块 · {{ props.doc.chars.toLocaleString() }} 字 · 入库于 {{ fmtTime(props.doc.updatedAt) }}
          </span>
        </div>
        <button ref="closeBtn" class="btn btn-secondary btn-sm" type="button" @click="emit('close')">关闭</button>
      </header>

      <div class="viewer-body">
        <h3 class="params-title">入库参数</h3>
        <dl class="params">
          <div v-for="p in params" :key="p.k">
            <dt>{{ p.k }}</dt>
            <dd>{{ p.v }}</dd>
          </div>
        </dl>
        <PreviewPanel class="flat" :docs="docs" :doc="props.doc.source" :result="result" :results="results"
                      :config="cfg" :active-id="props.doc.source.id" title="分块详情" overline="CHUNKS" />
      </div>
    </aside>
  </div>
</template>

<style scoped>
.viewer-bg {
  position: fixed; inset: 0; z-index: 2000;
  display: flex; justify-content: flex-end;
  background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(3px);
  animation: bg-in 150ms ease-out;
}
.viewer {
  display: flex; flex-direction: column; width: min(1080px, 94vw); height: 100%;
  background: var(--bg-body); box-shadow: var(--shadow-xl);
  animation: drawer-in 250ms var(--ease-out);
}
.viewer-head {
  flex: none; display: flex; align-items: center; gap: 14px; padding: 14px 24px;
  border-bottom: 1px solid var(--border-default); background: var(--bg-panel);
}
.viewer-head .ext-badge { font-style: normal; }
.vh-info { flex: 1; min-width: 0; }
.vh-info .panel-overline { margin-bottom: 2px; }
.vh-info h2 { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 18px; font-weight: 700; }
.vh-meta { color: var(--text-secondary); font-size: 12px; }
.viewer-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 18px 24px 32px; }
.params-title { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
.params { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; margin: 0 0 16px; }
.params div { padding: 8px 12px; border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--bg-panel); }
.params dt { color: var(--text-secondary); font-size: 12px; }
.params dd { margin: 2px 0 0; font-size: 13px; font-weight: 600; word-break: break-all; }
.viewer .viewer-body .flat { box-shadow: none; }
@keyframes bg-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes drawer-in { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: none; } }
@media (max-width: 680px) {
  .viewer { width: 100vw; }
  .viewer-head, .viewer-body { padding-left: 16px; padding-right: 16px; }
}
</style>
