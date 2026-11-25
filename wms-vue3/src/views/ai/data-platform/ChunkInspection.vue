<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { Chunk } from './processing'

const props = defineProps<{ chunks: Chunk[]; actual: boolean }>()
const keyword = ref(''), showIndex = ref(false), visibleLimit = ref(40)
const hovered = ref(-1), flashed = ref(-1), chartEl = ref<HTMLElement | null>(null)
const chartWidth = ref(760)
const CHART_HEIGHT = 172, LEFT = 43, RIGHT = 14, TOP = 12, BOTTOM = 27, REFERENCE = 500
const visibleBars = computed(() => props.chunks.slice(0, 120))
const lengths = computed(() => props.chunks.map(chunk => chunk.text.length))
const avg = computed(() => lengths.value.length ? Math.round(lengths.value.reduce((sum, n) => sum + n, 0) / lengths.value.length) : 0)
const min = computed(() => lengths.value.length ? Math.min(...lengths.value) : 0)
const max = computed(() => lengths.value.length ? Math.max(...lengths.value) : 0)
const estimateTokens = (text: string) => {
  const cjk = (text.match(/[一-鿿]/g) || []).length
  return Math.ceil(cjk * .7 + (text.length - cjk) / 4)
}
const tokens = computed(() => props.chunks.reduce((sum, chunk) => sum + estimateTokens(chunk.text), 0))
const filtered = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return query ? props.chunks.filter(chunk => `${chunk.text} ${chunk.index}`.toLowerCase().includes(query)) : props.chunks
})
const shown = computed(() => filtered.value.slice(0, visibleLimit.value))
const plotWidth = computed(() => Math.max(180, chartWidth.value - LEFT - RIGHT))
const plotHeight = CHART_HEIGHT - TOP - BOTTOM
const scaleMax = computed(() => Math.max(600, Math.ceil(Math.max(max.value, REFERENCE) * 1.12 / 200) * 200))
const y = (value: number) => TOP + plotHeight * (1 - value / scaleMax.value)
const bars = computed(() => {
  const slot = plotWidth.value / Math.max(visibleBars.value.length, 1)
  return visibleBars.value.map((chunk, index) => ({
    x: LEFT + index * slot + Math.min(2, slot * .14),
    width: Math.max(1, slot - Math.min(3, slot * .28)),
    y: y(chunk.text.length), height: Math.max(1, y(0) - y(chunk.text.length)),
    slot, chunk, index,
  }))
})
const ticks = computed(() => Array.from({ length: Math.floor(scaleMax.value / 200) + 1 }, (_, i) => i * 200))
const tooltip = computed(() => {
  const bar = bars.value[hovered.value]
  if (!bar) return null
  return { bar, left: Math.min(Math.max(bar.x + bar.width / 2, 95), chartWidth.value - 95), top: Math.max(4, bar.y - 7) }
})
const labelEvery = computed(() => Math.max(1, Math.ceil(visibleBars.value.length / Math.max(4, Math.floor(plotWidth.value / 50)))))

let observer: ResizeObserver | null = null
watch(chartEl, (el, old) => {
  if (old) observer?.unobserve(old)
  if (!el) return
  observer ||= new ResizeObserver(entries => { chartWidth.value = Math.max(270, Math.floor(entries[0]?.contentRect.width || 760)) })
  observer.observe(el)
})
watch(keyword, () => { visibleLimit.value = 40 })
watch(() => props.chunks, () => { hovered.value = -1; visibleLimit.value = 40; keyword.value = '' })
onBeforeUnmount(() => observer?.disconnect())

function originLabel(chunk: Chunk) {
  const origin = chunk.origin || {}
  const path = Array.isArray(origin.heading_path) ? origin.heading_path.join(' › ') : ''
  return path || (origin.page ? `第 ${origin.page} 页` : origin.sheet ? `工作表 ${origin.sheet}` : '')
}
async function jumpTo(index: number) {
  keyword.value = ''
  visibleLimit.value = Math.max(visibleLimit.value, index + 1)
  await nextTick()
  document.getElementById(`dp-full-chunk-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flashed.value = index
  window.setTimeout(() => { if (flashed.value === index) flashed.value = -1 }, 1700)
}
</script>

<template>
  <section class="inspect">
    <div class="inspect-head"><div><span class="inspect-overline">CHUNK INSPECTION</span><h2>{{ actual ? '已入库的实际分块' : '入库前预计分块' }}</h2></div><span class="inspect-mode">{{ actual ? '实际结果' : '预计效果' }}</span></div>
    <p v-if="!actual" class="inspect-note">预览使用服务端正式切片规则。入库时按所选项补充摘要和图片说明；已有正文分块以此为准。</p>
    <div class="inspect-stats">
      <div><span>分块数</span><strong>{{ chunks.length }}</strong></div>
      <div><span>平均长度</span><strong>{{ avg }}<small>字</small></strong></div>
      <div><span>最短 / 最长</span><strong>{{ min }}<small> / </small>{{ max }}</strong></div>
      <div><span>预计 tokens</span><strong>{{ tokens.toLocaleString() }}</strong></div>
    </div>
    <div v-if="chunks.length > 1" class="inspect-chart-card">
      <div class="inspect-chart-title"><strong>分块长度（字）</strong><span>每根柱子对应一个分块；悬停看明细，点击定位</span></div>
      <div ref="chartEl" class="inspect-chart" @mouseleave="hovered = -1">
        <svg :width="chartWidth" :height="CHART_HEIGHT" role="group" :aria-label="`${chunks.length} 个分块，平均 ${avg} 字，点击柱子定位到分块`">
          <g class="inspect-grid"><template v-for="tick in ticks" :key="tick"><line :x1="LEFT" :x2="chartWidth - RIGHT" :y1="y(tick)" :y2="y(tick)" /><text :x="LEFT - 8" :y="y(tick) + 4" text-anchor="end">{{ tick }}</text></template></g>
          <g class="inspect-bars"><rect v-for="bar in bars" :key="bar.index" :x="bar.x" :y="bar.y" :width="bar.width" :height="bar.height" rx="3" :class="{ dim: hovered >= 0 && hovered !== bar.index, active: hovered === bar.index }" /></g>
          <g class="inspect-reference"><line :x1="LEFT" :x2="chartWidth - RIGHT" :y1="y(REFERENCE)" :y2="y(REFERENCE)" /><text :x="chartWidth - RIGHT - 2" :y="y(REFERENCE) - 5" text-anchor="end">参考 {{ REFERENCE }}</text></g>
          <g class="inspect-axis"><text v-for="bar in bars.filter((item, index) => index === 0 || index === bars.length - 1 || (index + 1) % labelEvery === 0)" :key="bar.index" :x="bar.x + bar.width / 2" :y="CHART_HEIGHT - 5" text-anchor="middle">#{{ bar.index + 1 }}</text></g>
          <g class="inspect-hit"><rect v-for="bar in bars" :key="bar.index" :x="bar.x - 1" y="0" :width="bar.slot" :height="CHART_HEIGHT - BOTTOM" role="button" tabindex="0" :aria-label="`定位第 ${bar.index + 1} 块，${bar.chunk.text.length} 字`" @pointerenter="hovered = bar.index" @pointerdown="hovered = bar.index" @focus="hovered = bar.index" @blur="hovered = -1" @click="jumpTo(bar.index)" @keydown.enter="jumpTo(bar.index)" @keydown.space.prevent="jumpTo(bar.index)" /></g>
        </svg>
        <div v-if="tooltip" class="inspect-tip" :style="{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }"><strong>#{{ tooltip.bar.index + 1 }} · {{ tooltip.bar.chunk.text.length }} 字</strong><span>约 {{ estimateTokens(tooltip.bar.chunk.text) }} tokens</span><span v-if="originLabel(tooltip.bar.chunk)" class="inspect-tip-path">{{ originLabel(tooltip.bar.chunk) }}</span></div>
      </div>
      <p v-if="chunks.length > 120" class="inspect-chart-note">图表展示前 120 块；下面的搜索覆盖全部 {{ chunks.length }} 块。</p>
    </div>
    <div class="inspect-tools"><input v-model="keyword" type="search" placeholder="在分块中查找文字" aria-label="搜索分块正文或索引" /><label><input v-model="showIndex" type="checkbox" /> 显示索引内容</label><span>{{ keyword ? `匹配 ${filtered.length} / ${chunks.length}` : `共 ${chunks.length} 块` }}</span></div>
    <ol v-if="shown.length" class="inspect-list"><li v-for="(chunk, index) in shown" :id="`dp-full-chunk-${index}`" :key="chunk.id" class="inspect-chunk" :class="{ flash: flashed === index }"><div class="inspect-chunk-head"><strong>#{{ index + 1 }}</strong><span class="inspect-path" :title="originLabel(chunk)">{{ originLabel(chunk) }}</span><small>{{ chunk.text.length }} 字 · 约 {{ estimateTokens(chunk.text) }} tokens</small></div><p>{{ chunk.text }}</p><div v-if="showIndex && chunk.index" class="inspect-index"><span>索引内容 · {{ chunk.index.length }} 字</span><p>{{ chunk.index }}</p></div></li></ol>
    <p v-else class="inspect-empty">{{ keyword ? '没有匹配的分块' : '当前没有可预览的分块' }}</p>
    <button v-if="filtered.length > visibleLimit" type="button" class="inspect-more" @click="visibleLimit += 40">再显示 {{ Math.min(40, filtered.length - visibleLimit) }} 块（剩余 {{ filtered.length - visibleLimit }}）</button>
  </section>
</template>

<style scoped>
.inspect{min-width:0}.inspect-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.inspect-overline{font-size:11px;color:var(--dp-red);letter-spacing:1.3px}.inspect-head h2{font-size:18px;margin:2px 0}.inspect-mode{font-size:12px;color:var(--dp-red);background:var(--dp-red-soft);padding:2px 9px;border-radius:20px;white-space:nowrap}.inspect-note,.inspect-chart-note{color:var(--dp-muted);font-size:12px;line-height:1.7;margin:10px 0}.inspect-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:15px 0}.inspect-stats>div{background:var(--dp-bg);border:1px solid var(--dp-line);border-radius:8px;padding:10px 13px}.inspect-stats span{display:block;font-size:12px;color:var(--dp-muted)}.inspect-stats strong{display:block;font-size:22px;line-height:1.4}.inspect-stats small{font-size:12px;color:var(--dp-muted);font-weight:400}.inspect-chart-card{border:1px solid var(--dp-line);border-radius:9px;padding:14px 14px 6px;margin-bottom:15px}.inspect-chart-title{display:flex;align-items:baseline;gap:13px;font-size:13px}.inspect-chart-title span{font-size:12px;color:var(--dp-muted)}.inspect-chart{position:relative;margin-top:5px;overflow:visible}.inspect-chart svg{display:block;max-width:100%}.inspect-grid line{stroke:var(--dp-line)}.inspect-grid text,.inspect-axis text{fill:var(--dp-muted);font-size:11px}.inspect-bars rect{fill:color-mix(in srgb,var(--dp-red) 64%,#516c8c);transition:opacity .15s,fill .15s}.inspect-bars rect.dim{opacity:.35}.inspect-bars rect.active{fill:var(--dp-red)}.inspect-reference line{stroke:var(--dp-muted);stroke-dasharray:4 3;opacity:.65}.inspect-reference text{fill:var(--dp-muted);font-size:11px}.inspect-hit rect{fill:transparent;cursor:pointer}.inspect-hit rect:focus-visible{stroke:var(--dp-red);stroke-width:2;outline:none}.inspect-tip{position:absolute;z-index:2;transform:translate(-50%,-100%);pointer-events:none;display:flex;flex-direction:column;min-width:130px;max-width:220px;padding:7px 10px;border:1px solid var(--dp-line);border-radius:7px;background:var(--dp-panel);box-shadow:0 10px 24px #0002;font-size:12px;white-space:nowrap}.inspect-tip span{color:var(--dp-muted)}.inspect-tip-path{overflow:hidden;text-overflow:ellipsis}.inspect-tools{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:14px 0}.inspect-tools>input{flex:1;min-width:180px;max-width:360px;border:1px solid var(--dp-line);border-radius:7px;background:var(--dp-panel);color:var(--dp-text);padding:8px 12px}.inspect-tools label{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px}.inspect-tools label input{accent-color:var(--dp-red)}.inspect-tools>span{margin-left:auto;font-size:12px;color:var(--dp-muted)}.inspect-list{list-style:none;display:grid;gap:9px;padding:0;margin:0}.inspect-chunk{border:1px solid var(--dp-line);border-radius:8px;padding:12px 14px;transition:border-color .2s,box-shadow .2s}.inspect-chunk:hover{border-color:var(--dp-muted)}.inspect-chunk.flash{border-color:var(--dp-red);box-shadow:0 0 0 3px var(--dp-red-soft)}.inspect-chunk-head{display:flex;align-items:center;gap:9px;min-width:0;font-size:12px}.inspect-chunk-head strong{background:var(--dp-bg);padding:1px 7px;border-radius:4px}.inspect-path{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dp-muted)}.inspect-chunk-head small{margin-left:auto;white-space:nowrap;color:var(--dp-muted);font-size:12px}.inspect-chunk>p{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0 0;font-size:14px;line-height:1.8}.inspect-index{margin-top:10px;padding:8px 10px;border-radius:6px;background:var(--dp-bg)}.inspect-index span{color:var(--dp-muted);font-size:11px}.inspect-index p{margin:4px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.inspect-empty{text-align:center;color:var(--dp-muted);padding:30px}.inspect-more{display:block;width:100%;padding:9px;border:1px solid var(--dp-line);border-radius:7px;margin-top:12px;background:var(--dp-panel);color:var(--dp-text)}.inspect-more:hover{border-color:var(--dp-red);color:var(--dp-red)}@media(max-width:700px){.inspect-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.inspect-chart-title{display:block}.inspect-chunk-head{flex-wrap:wrap}.inspect-chunk-head small{margin-left:0}}@media(prefers-reduced-motion:reduce){.inspect-bars rect,.inspect-chunk{transition:none}}
</style>
