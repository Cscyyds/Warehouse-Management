<template>
  <div class="chart-card">
    <div class="chart-card-header">
      <span class="chart-card-title">{{ title }}</span>
      <span v-if="unit" class="chart-card-unit">{{ unit }}</span>
    </div>
    <div v-show="!hasData" class="chart-empty">
      <div class="empty-icon"><el-icon :size="36"><Odometer /></el-icon></div>
      <div class="empty-title">{{ emptyTitle }}</div>
      <div class="empty-desc">{{ emptyDesc }}</div>
    </div>
    <div v-show="hasData" class="chart-body" ref="chartRef" :style="{ height: bodyHeight + 'px' }"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Odometer } from '@element-plus/icons-vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useThemeStore } from '@/stores/theme'

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

interface BarSeries {
  name: string
  values: number[]
  colors: [string, string]
}

const props = defineProps<{
  title: string
  categories: string[]
  series: BarSeries[]
  unit?: string
  emptyTitle?: string
  emptyDesc?: string
  /** 类目的完整名（给 tooltip 用）；不传则 tooltip 直接用 categories */
  fullLabels?: string[]
  /** 类目的辅助编码（如产品编码），在 tooltip 标题后以灰色括号展示 */
  codes?: string[]
}>()

const themeStore = useThemeStore()
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

const hasData = computed(() =>
  props.categories.length > 0 && props.series.some(s => s.values.some(v => v > 0))
)

/** 横向条形图每行约占 32px，按条数自适应高度，避免 8 条被压进固定 260px */
const bodyHeight = computed(() => Math.min(360, Math.max(200, 44 + props.categories.length * 32)))

function buildOption(isDark: boolean) {
  const textColor = isDark ? '#cbd5e1' : '#64748b'
  const gridColor = isDark ? '#1e293b' : '#f1f5f9'
  const hasLegend = props.series.length > 1

  // 类目名（品名/仓库名）长度不可控，竖排柱状图每条只有几十像素带宽，
  // 旋转与截断都救不了；改横向条形图：每条标签独占一行，宽度按卡片给，
  // 超出由 ECharts 按 overflow 省略号截断，完整名走 tooltip。
  // 数据本身按值降序传入，反转后最大值落在顶部。
  const labels = [...props.categories].reverse()
  const fullLabels = (props.fullLabels ?? props.categories).slice().reverse()
  const codes = (props.codes ?? []).slice().reverse()
  const single = props.series.length === 1

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        if (!Array.isArray(params) || !params.length) return ''
        const idx = params[0].dataIndex
        const title = fullLabels[idx] ?? labels[idx] ?? ''
        const code = codes[idx]
        const head = code && code !== title
          ? `<div style="font-weight:600;margin-bottom:4px">${title} <span style="opacity:.6;font-weight:400">(${code})</span></div>`
          : `<div style="font-weight:600;margin-bottom:4px">${title}</div>`
        const lines = params.map((p: any) =>
          `${p.marker}${p.seriesName}: <b>${p.value ?? 0}</b>`
        )
        return `${head}${lines.join('<br/>')}`
      },
    },
    legend: hasLegend
      ? { data: props.series.map(s => s.name), bottom: 0, textStyle: { color: textColor, fontSize: 11 } }
      : undefined,
    grid: {
      left: 8,
      right: single ? 56 : 24,
      top: 8,
      bottom: hasLegend ? 30 : 8,
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: gridColor } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: textColor, fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
      axisLabel: {
        color: textColor,
        fontSize: 11,
        interval: 0,
        width: 150,
        overflow: 'truncate',
      },
    },
    series: props.series.map(s => ({
      name: s.name,
      type: 'bar',
      data: [...s.values].reverse(),
      barWidth: hasLegend ? '34%' : '55%',
      label: single
        ? { show: true, position: 'right', fontSize: 10, color: textColor }
        : undefined,
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: s.colors[0] },
          { offset: 1, color: s.colors[1] },
        ]),
      },
    })),
  }
}

function render() {
  if (!chartRef.value || !hasData.value) return
  if (!chart) {
    chart = echarts.init(chartRef.value)
  }
  chart.setOption(buildOption(themeStore.isDark), true)
}

onMounted(() => {
  if (!chartRef.value) return
  ro = new ResizeObserver(() => {
    if (!chartRef.value) return
    const { width } = chartRef.value.getBoundingClientRect()
    if (width === 0) return
    if (!chart) {
      chart = echarts.init(chartRef.value)
      chart.setOption(buildOption(themeStore.isDark), true)
    } else {
      chart.resize()
    }
  })
  ro.observe(chartRef.value)
})

watch(() => themeStore.isDark, () => render())
watch(() => [props.categories, props.series, props.fullLabels, props.codes], () => render(), { deep: true })

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.chart-card {
  background: var(--bg-white);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-xs);
  padding: 16px;
  height: 100%;
}
.chart-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-light);
}
.chart-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.chart-card-unit {
  font-size: 11px;
  color: var(--text-tertiary);
}
.chart-body {
  width: 100%;
  height: 260px;
}
.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 260px;
  color: var(--text-secondary);
}
.empty-icon {
  color: var(--text-tertiary);
  margin-bottom: 10px;
  opacity: 0.5;
}
.empty-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.empty-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: center;
  max-width: 240px;
  line-height: 1.5;
}
</style>
