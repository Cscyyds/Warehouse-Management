<script setup>
/**
 * 处理前预览：原文解析结果 / 分块结果 两个视图，参数改动实时重算。
 * 分块长度图：单系列柱图（一柱一块，按顺序），悬停看明细，点击跳到对应分块卡片。
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { chunkStats } from './chunker';

const props = defineProps({
  docs: { type: Array, required: true },
  doc: { type: Object, required: true },
  result: { type: Object, required: true },
  results: { type: Map, required: true },
  config: { type: Object, required: true },
  activeId: { type: String, default: '' },
  // 入库前预览与已入库查看共用本面板，只换标题
  title: { type: String, default: '处理前预览' },
  overline: { type: String, default: 'PREVIEW' },
});
const emit = defineEmits(['update:activeId']);

const view = ref('chunks');
const showIndex = ref(false);
const keyword = ref('');
const limit = ref(40);
const flashSeq = ref(0);

watch(() => props.doc.id, () => { limit.value = 40; keyword.value = ''; });

const chunks = computed(() => props.result?.chunks || []);
const stats = computed(() => chunkStats(chunks.value, props.config));
const filtered = computed(() => {
  const kw = keyword.value.trim();
  return kw ? chunks.value.filter(c => c.text.includes(kw) || c.indexText.includes(kw)) : chunks.value;
});
const visible = computed(() => filtered.value.slice(0, limit.value));

const MODE_TAG = { chunked: '分块存储', whole: '整篇存储', qa: '问答对' };

// ── 原文视图：相邻且表头相同的表格行合并成一张表 ──
const sourceBlocks = computed(() => {
  const out = [];
  for (const b of props.doc.blocks) {
    const last = out[out.length - 1];
    if (b.kind === 'table' && b.cells) {
      const key = (b.header || []).join('\u0001');
      if (last?.kind === 'table-group' && last.key === key) last.rows.push(b.cells);
      else out.push({ kind: 'table-group', key, header: b.header || [], rows: [b.cells] });
    } else {
      out.push(b);
    }
  }
  return out;
});

// ── 分块长度图 ──
const CH = 132;
const PAD = { top: 14, right: 12, bottom: 22, left: 40 };
const chartEl = ref(null);
const chartW = ref(640);
const hover = ref(-1);
const ro = typeof ResizeObserver !== 'undefined'
  ? new ResizeObserver(([e]) => { chartW.value = Math.max(260, Math.floor(e.contentRect.width)); })
  : null;
watch(chartEl, (el, old) => {
  if (old) ro?.unobserve(old);
  if (el) ro?.observe(el);
});
onBeforeUnmount(() => ro?.disconnect());

function niceStep(max) {
  const raw = max / 3;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
}

const chart = computed(() => {
  const list = chunks.value;
  const n = list.length;
  const plotW = chartW.value - PAD.left - PAD.right;
  const plotH = CH - PAD.top - PAD.bottom;
  const limitLine = props.result?.mode === 'chunked' ? props.config.maxChunkSize : 0;
  const dataMax = Math.max(1, ...list.map(c => c.chars), limitLine);
  const step = niceStep(dataMax);
  const yMax = Math.ceil((dataMax * 1.08) / step) * step;
  const y = v => PAD.top + plotH - (v / yMax) * plotH;
  const slot = n ? plotW / n : plotW;
  const gap = slot >= 6 ? 2 : slot >= 3 ? 1 : 0;
  const bw = Math.max(1, slot - gap);
  const r = Math.min(4, bw / 2);
  const bars = list.map((c, i) => {
    const x = PAD.left + i * slot + gap / 2;
    const top = y(c.chars);
    const h = PAD.top + plotH - top;
    const rr = Math.min(r, h);
    const d = `M${x},${top + h}V${top + rr}Q${x},${top} ${x + rr},${top}H${x + bw - rr}Q${x + bw},${top} ${x + bw},${top + rr}V${top + h}Z`;
    return { d, x: PAD.left + i * slot, w: slot, seq: c.seq, cx: x + bw / 2, top };
  });
  const ticks = [];
  for (let v = 0; v <= yMax; v += step) ticks.push({ v, y: y(v) });
  // x 轴：首、尾和中间若干个序号，避免标签相撞
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 42))));
  const xLabels = bars.filter((_, i) => i === 0 || i === n - 1 || (i + 1) % every === 0)
    .filter((b, i, arr) => i === arr.length - 1 || arr[i + 1].cx - b.cx >= 28 || i === 0)
    .map(b => ({ x: b.cx, text: `#${b.seq}` }));
  return { bars, ticks, xLabels, limitY: limitLine ? y(limitLine) : null, limitLine, baseY: PAD.top + plotH, plotW };
});

const tip = computed(() => {
  const i = hover.value;
  const c = chunks.value[i];
  const b = chart.value.bars[i];
  if (!c || !b) return null;
  const left = Math.min(Math.max(b.cx, 90), chartW.value - 90);
  return { c, left, top: Math.max(4, b.top - 8) };
});

async function jumpTo(seq) {
  view.value = 'chunks';
  keyword.value = '';
  const idx = chunks.value.findIndex(c => c.seq === seq);
  if (idx >= limit.value) limit.value = idx + 20;
  await nextTick();
  document.getElementById(`kb-chunk-${seq}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  flashSeq.value = seq;
  setTimeout(() => { if (flashSeq.value === seq) flashSeq.value = 0; }, 1600);
}

function docChunkCount(id) {
  return props.results.get(id)?.chunks.length ?? 0;
}
</script>

<template>
  <section class="preview panel">
    <div class="pv-head">
      <div>
        <span class="panel-overline">{{ props.overline }}</span>
        <h2 class="pv-title">{{ props.title }}</h2>
      </div>
      <div class="seg" role="tablist" aria-label="预览视图">
        <button type="button" role="tab" :aria-selected="view === 'chunks'" :class="{ active: view === 'chunks' }"
                @click="view = 'chunks'">分块结果</button>
        <button type="button" role="tab" :aria-selected="view === 'source'" :class="{ active: view === 'source' }"
                @click="view = 'source'">原文解析</button>
      </div>
    </div>

    <div v-if="props.docs.length > 1" class="doc-tabs" role="tablist" aria-label="选择预览的数据源">
      <button v-for="d in props.docs" :key="d.id" type="button" role="tab"
              :aria-selected="d.id === props.doc.id" :class="{ active: d.id === props.doc.id }"
              :title="d.name" @click="emit('update:activeId', d.id)">
        <span class="dt-name">{{ d.name }}</span>
        <small>{{ docChunkCount(d.id) }} 块</small>
      </button>
    </div>

    <p v-if="props.doc.note" class="note">ⓘ {{ props.doc.note }}</p>

    <template v-if="view === 'chunks'">
      <div class="reason">
        <span class="mode-tag">{{ MODE_TAG[props.result.mode] }}</span>
        {{ props.result.reason }}
      </div>

      <div class="stats">
        <div class="stat"><span>分块数</span><strong>{{ stats.count }}</strong></div>
        <div class="stat"><span>平均长度</span><strong>{{ stats.avg }}<em>字</em></strong></div>
        <div class="stat"><span>最短 / 最长</span><strong>{{ stats.min }}<em>/</em>{{ stats.max }}</strong></div>
        <div class="stat"><span>预计 tokens</span><strong>{{ stats.tokens.toLocaleString() }}</strong></div>
      </div>

      <div v-if="chunks.length > 1" class="chart-card">
        <div class="chart-title">
          分块长度（字）<small>每根柱子是一个分块，按原文顺序排列；点击柱子定位到该分块</small>
        </div>
        <div ref="chartEl" class="chart" @mouseleave="hover = -1">
          <svg :width="chartW" :height="CH" role="img"
               :aria-label="`${stats.count} 个分块，平均 ${stats.avg} 字，最短 ${stats.min} 字，最长 ${stats.max} 字`">
            <g class="grid">
              <line v-for="t in chart.ticks" :key="t.v" :x1="40" :x2="chartW - 12" :y1="t.y" :y2="t.y"
                    :class="{ base: t.v === 0 }" />
              <text v-for="t in chart.ticks" :key="`l${t.v}`" :x="34" :y="t.y + 4" text-anchor="end">{{ t.v }}</text>
            </g>
            <g class="bars">
              <path v-for="(b, i) in chart.bars" :key="b.seq" :d="b.d"
                    :class="{ dim: hover >= 0 && hover !== i }" />
            </g>
            <g v-if="chart.limitY !== null" class="limit">
              <line :x1="40" :x2="chartW - 12" :y1="chart.limitY" :y2="chart.limitY" />
              <text :x="chartW - 14" :y="chart.limitY - 4" text-anchor="end">上限 {{ chart.limitLine }}</text>
            </g>
            <g class="xaxis">
              <text v-for="l in chart.xLabels" :key="l.text" :x="l.x" :y="CH - 6" text-anchor="middle">{{ l.text }}</text>
            </g>
            <g class="hits">
              <rect v-for="(b, i) in chart.bars" :key="`h${b.seq}`" :x="b.x" :y="0" :width="b.w" :height="chart.baseY"
                    @mouseenter="hover = i" @click="jumpTo(b.seq)" />
            </g>
          </svg>
          <div v-if="tip" class="tip" :style="{ left: `${tip.left}px`, top: `${tip.top}px` }">
            <strong>#{{ tip.c.seq }} · {{ tip.c.chars }} 字</strong>
            <span>{{ tip.c.tokens }} tokens<template v-if="tip.c.overlapHead"> · 含重叠 {{ tip.c.overlapHead }} 字</template></span>
            <span v-if="tip.c.headingPath.length" class="tip-path">{{ tip.c.headingPath.join(' › ') }}</span>
          </div>
        </div>
      </div>

      <div class="list-tools">
        <input v-model="keyword" class="input search" type="search" placeholder="在分块中查找文字">
        <label class="check"><input v-model="showIndex" type="checkbox"> 显示索引内容</label>
        <span class="list-count">{{ keyword ? `匹配 ${filtered.length} / ${chunks.length}` : `共 ${chunks.length} 块` }}</span>
      </div>

      <ol v-if="visible.length" class="chunk-list">
        <li v-for="c in visible" :id="`kb-chunk-${c.seq}`" :key="c.seq" class="chunk"
            :class="{ flash: flashSeq === c.seq }">
          <div class="chunk-head">
            <span class="chunk-seq">#{{ c.seq }}</span>
            <span v-if="c.headingPath.length" class="chunk-path" :title="c.headingPath.join(' › ')">
              {{ c.headingPath.join(' › ') }}
            </span>
            <span class="chunk-meta">{{ c.chars }} 字 · {{ c.tokens }} tokens</span>
          </div>
          <div v-if="c.qa" class="chunk-qa">
            <p><b>问</b>{{ c.qa.q }}</p>
            <p><b>答</b><span>{{ c.qa.a }}</span></p>
          </div>
          <p v-else class="chunk-text"><span v-if="c.overlapHead" class="overlap"
                  :title="`与上一块重叠的 ${c.overlapHead} 字`">{{ c.text.slice(0, c.overlapHead) }}</span>{{ c.text.slice(c.overlapHead) }}</p>
          <div v-if="c.keywords.length" class="kw">
            <span v-for="k in c.keywords" :key="k">{{ k }}</span>
          </div>
          <div v-if="showIndex" class="index-box">
            <span class="index-label">索引内容 · {{ c.indexText.length }} 字</span>
            <p><mark v-if="c.indexPrefixLen">{{ c.indexText.slice(0, c.indexPrefixLen) }}</mark>{{ c.indexText.slice(c.indexPrefixLen) }}</p>
          </div>
        </li>
      </ol>
      <p v-else class="empty">{{ keyword ? '没有匹配的分块' : '当前参数下没有可入库的内容' }}</p>
      <button v-if="filtered.length > limit" class="btn btn-secondary more" type="button" @click="limit += 40">
        再显示 {{ Math.min(40, filtered.length - limit) }} 块（剩余 {{ filtered.length - limit }}）
      </button>
    </template>

    <div v-else class="source">
      <template v-for="(b, i) in sourceBlocks" :key="i">
        <div v-if="b.kind === 'heading'" class="src-h" :data-level="Math.min(b.level || 1, 4)">
          <span class="src-lv">H{{ b.level }}</span>{{ b.text }}
        </div>
        <div v-else-if="b.kind === 'table-group'" class="src-table">
          <table>
            <thead><tr><th v-for="(h, j) in b.header" :key="j">{{ h }}</th></tr></thead>
            <tbody>
              <tr v-for="(r, j) in b.rows.slice(0, 50)" :key="j"><td v-for="(cell, k) in r" :key="k">{{ cell }}</td></tr>
            </tbody>
          </table>
          <p v-if="b.rows.length > 50" class="src-more">仅显示前 50 行，共 {{ b.rows.length }} 行</p>
        </div>
        <p v-else class="src-p">{{ b.text }}</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.preview { min-width: 0; padding: var(--space-5) var(--space-6) var(--space-6); }
.pv-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
.pv-title { margin: 0; font-size: 20px; font-weight: 700; }
.seg { display: inline-flex; padding: 3px; border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--bg-subtle); }
.seg button {
  padding: 5px 14px; border: 0; border-radius: var(--radius-sm); background: transparent;
  color: var(--text-secondary); font: inherit; font-size: 13px; cursor: pointer;
}
.seg button.active { background: var(--bg-panel); color: var(--accent-600); font-weight: 600; box-shadow: var(--shadow-sm); }

.doc-tabs { display: flex; gap: 6px; margin-top: var(--space-4); overflow-x: auto; padding-bottom: 2px; scrollbar-width: thin; }
.doc-tabs button {
  display: inline-flex; align-items: center; gap: 6px; flex: none; max-width: 240px; padding: 6px 12px;
  border: 1px solid var(--border-default); border-radius: 999px; background: var(--bg-panel);
  color: var(--text-secondary); font: inherit; font-size: 13px; cursor: pointer;
}
.doc-tabs button.active { border-color: var(--accent-600); color: var(--accent-600); background: var(--accent-50); font-weight: 600; }
.dt-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-tabs small { flex: none; color: var(--text-secondary); font-weight: 400; }

.note { margin: var(--space-3) 0 0; padding: 8px 12px; border-radius: var(--radius-sm); background: var(--warn-50); color: var(--text-primary); font-size: 12px; }

.reason { display: flex; align-items: center; gap: 8px; margin-top: var(--space-4); color: var(--text-secondary); font-size: 13px; }
.mode-tag { padding: 1px 8px; border-radius: 999px; background: var(--accent-50); color: var(--accent-600); font-size: 12px; font-weight: 600; }

.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); margin-top: var(--space-3); }
.stat { padding: 10px 14px; border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--bg-subtle); }
.stat span { display: block; font-size: 12px; color: var(--text-secondary); }
.stat strong { display: block; margin-top: 2px; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
.stat em { margin: 0 2px; color: var(--text-secondary); font-size: 12px; font-style: normal; font-weight: 400; }

.chart-card { margin-top: var(--space-3); padding: 12px 14px 6px; border: 1px solid var(--border-default); border-radius: var(--radius-md); }
.chart-title { font-size: 13px; font-weight: 600; }
.chart-title small { margin-left: 8px; color: var(--text-secondary); font-size: 12px; font-weight: 400; }
.chart { position: relative; margin-top: 4px; }
.chart svg { display: block; overflow: visible; }
.grid line { stroke: var(--divider); stroke-width: 1; }
.grid line.base { stroke: var(--border-strong); }
.grid text, .xaxis text { fill: var(--text-secondary); font-size: 11px; font-variant-numeric: tabular-nums; }
.bars path { fill: var(--kb-bar); transition: opacity var(--duration-fast); }
.bars path.dim { opacity: 0.35; }
.limit line { stroke: var(--text-secondary); stroke-width: 1; stroke-dasharray: 4 3; }
.limit text { fill: var(--text-secondary); font-size: 11px; }
.hits rect { fill: transparent; cursor: pointer; }
.tip {
  position: absolute; z-index: 5; transform: translate(-50%, -100%); pointer-events: none;
  display: flex; flex-direction: column; gap: 1px; min-width: 120px; max-width: 220px; padding: 6px 10px;
  border: 1px solid var(--border-default); border-radius: var(--radius-sm); background: var(--bg-panel);
  box-shadow: var(--shadow-md); font-size: 12px; white-space: nowrap;
}
.tip strong { font-size: 13px; }
.tip span { color: var(--text-secondary); }
.tip-path { overflow: hidden; text-overflow: ellipsis; }

.list-tools { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; margin: var(--space-4) 0 var(--space-3); }
.search { flex: 1; min-width: 180px; max-width: 320px; height: 34px; }
.check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
.check input { margin: 0; accent-color: var(--accent-600); }
.list-count { margin-left: auto; color: var(--text-secondary); font-size: 12px; }

.chunk-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.chunk {
  padding: 12px 14px; border: 1px solid var(--border-default); border-radius: var(--radius-md);
  background: var(--bg-panel); transition: border-color var(--duration-normal), box-shadow var(--duration-normal);
}
.chunk:hover { border-color: var(--border-strong); }
.chunk.flash { border-color: var(--accent-600); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent); }
.chunk-head { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 12px; }
.chunk-seq { flex: none; padding: 1px 8px; border-radius: var(--radius-sm); background: var(--bg-subtle); font-weight: 700; font-variant-numeric: tabular-nums; }
.chunk-path { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary); }
.chunk-meta { flex: none; margin-left: auto; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.chunk-text { margin: 8px 0 0; font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.overlap {
  padding: 1px 0; background: var(--bg-subtle); color: var(--text-secondary);
  text-decoration: underline dashed var(--border-strong); text-underline-offset: 3px;
}
.chunk-qa { margin-top: 8px; font-size: 13px; line-height: 1.7; }
.chunk-qa p { display: flex; gap: 8px; margin: 0 0 4px; }
.chunk-qa b {
  flex: none; display: grid; place-items: center; width: 20px; height: 20px; margin-top: 2px;
  border-radius: 4px; background: var(--accent-50); color: var(--accent-600); font-size: 11px;
}
.chunk-qa span { white-space: pre-wrap; }
.kw { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.kw span { padding: 1px 8px; border: 1px solid var(--border-default); border-radius: 999px; color: var(--text-secondary); font-size: 12px; }
.index-box { margin-top: 10px; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--bg-subtle); }
.index-label { display: block; margin-bottom: 4px; color: var(--text-secondary); font-size: 11px; font-weight: 600; }
.index-box p { margin: 0; font-family: var(--font-mono); font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.index-box mark { background: var(--accent-50); color: var(--accent-600); }
.empty { margin: 0; padding: var(--space-8) 0; color: var(--text-secondary); text-align: center; }
.more { width: 100%; margin-top: var(--space-3); }

.source { margin-top: var(--space-4); padding: var(--space-4) var(--space-5); border: 1px solid var(--border-default); border-radius: var(--radius-md); max-height: 72vh; overflow-y: auto; }
.src-h { display: flex; align-items: baseline; gap: 8px; margin: 14px 0 6px; font-weight: 700; }
.src-h:first-child { margin-top: 0; }
.src-h[data-level="1"] { font-size: 17px; }
.src-h[data-level="2"] { font-size: 15px; padding-left: 12px; }
.src-h[data-level="3"] { font-size: 14px; padding-left: 24px; }
.src-h[data-level="4"] { font-size: 13px; padding-left: 36px; }
.src-lv { flex: none; padding: 0 5px; border: 1px solid var(--border-default); border-radius: 4px; color: var(--text-secondary); font-size: 10px; font-weight: 600; }
.src-p { margin: 0 0 8px; font-size: 13px; line-height: 1.75; white-space: pre-wrap; }
.src-table { margin: 6px 0 12px; overflow-x: auto; }
.src-table table { width: 100%; border-collapse: collapse; font-size: 12px; }
.src-table th, .src-table td { padding: 5px 8px; border: 1px solid var(--border-default); text-align: left; white-space: nowrap; }
.src-table th { background: var(--bg-subtle); font-weight: 600; }
.src-more { margin: 4px 0 0; color: var(--text-secondary); font-size: 12px; }

@media (max-width: 680px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
}
</style>
