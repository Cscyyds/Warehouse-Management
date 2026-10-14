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
    <div v-show="hasData" class="chart-body" ref="chartRef"></div>
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
}>()

const themeStore = useThemeStore()
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
let resizeHandler: (() => void) | null = null

const hasData = computed(() =>
  props.categories.length > 0 && props.series.some(s => s.values.some(v => v > 0))
)

function buildOption(isDark: boolean) {
  const textColor = isDark ? '#cbd5e1' : '#64748b'
  const gridColor = isDark ? '#1e293b' : '#f1f5f9'

  const categories = props.categories
  const fullLabels = props.fullLabels ?? categories
  // 外部已经提供短编码时不旋转；否则按最长中文名长度决定是否斜排
  const providedShort = Array.isArray(props.fullLabels) && props.fullLabels.length > 0
  const maxLen = categories.reduce((m, s) => Math.max(m, (s || '').length), 0)
  const rotate = providedShort ? 0 : (maxLen > 6 ? 30 : 0)
  const hasLegend = props.series.length > 1

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      // 悬浮时用 fullLabels 展示完整类目名，解决 x 轴只能显示短编码的问题
      formatter: (params: any) => {
        if (!Array.isArray(params) || !params.length) return ''
        const idx = params[0].dataIndex
        const title = fullLabels[idx] ?? params[0].name ?? ''
        const short = categories[idx] ?? ''
        const header = providedShort && short && short !== title
          ? `<div style="font-weight:600;margin-bottom:4px">${title} <span style="opacity:.6;font-weight:400">(${short})</span></div>`
          : `<div style="font-weight:600;margin-bottom:4px">${title}</div>`
        const lines = params.map((p: any) =>
          `${p.marker}${p.seriesName}: <b>${p.value ?? 0}</b>`
        )
        return `${header}${lines.join('<br/>')}`
      },
    },
    legend: hasLegend
      ? { data: props.series.map(s => s.name), bottom: 0, textStyle: { color: textColor, fontSize: 11 } }
      : undefined,
    // containLabel 让 ECharts 自己计算 x/y 轴标签占用空间，避免长中文名溢出
    grid: {
      left: 8,
      right: 16,
      top: 12,
      bottom: hasLegend ? 28 : 4,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
      axisLabel: {
        color: textColor,
        fontSize: 11,
        rotate,
        interval: 0,
        hideOverlap: true,
        // 兜底：即便外部传的 categories 很长（例如后端未返回短编码），也只在 x 轴露出前 8 字符，完整名走 tooltip
        formatter: (val: string) => {
          const str = String(val ?? '')
          // 遇到空格优先按空格断开（如「12410045 嵌入式…」直接取「12410045」）
          const spaceIdx = str.indexOf(' ')
          if (spaceIdx > 0 && spaceIdx <= 10) return str.slice(0, spaceIdx)
          return str.length > 8 ? str.slice(0, 8) + '…' : str
        },
      },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor, fontSize: 11 },
    },
    series: props.series.map(s => ({
      name: s.name,
      type: 'bar',
      data: s.values,
      barWidth: props.series.length > 1 ? '40%' : '50%',
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
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
  render()
  resizeHandler = () => chart?.resize()
  window.addEventListener('resize', resizeHandler)
})

watch(() => themeStore.isDark, () => render())
watch(() => [props.categories, props.series, props.fullLabels], () => render(), { deep: true })

onBeforeUnmount(() => {
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
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
