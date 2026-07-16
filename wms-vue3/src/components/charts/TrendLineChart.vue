<template>
  <div class="chart-card">
    <div class="chart-card-header">
      <span class="chart-card-title">近7日出入库趋势</span>
    </div>
    <div class="chart-body" ref="chartRef"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { DailyTrendItem } from '@/api/modules/dashboard'
import { useThemeStore } from '@/stores/theme'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps<{ data: DailyTrendItem[] }>()
const themeStore = useThemeStore()
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

function buildOption(data: DailyTrendItem[], isDark: boolean) {
  const textColor = isDark ? '#cbd5e1' : '#64748b'
  const gridColor = isDark ? '#1e293b' : '#f1f5f9'
  return {
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['入库', '出库'],
      top: 0,
      right: 0,
      textStyle: { color: textColor, fontSize: 11 },
    },
    grid: { left: 8, right: 16, top: 28, bottom: 8 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date),
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
      axisLabel: { color: textColor, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor, fontSize: 11 },
    },
    series: [
      {
        name: '入库',
        type: 'line',
        data: data.map(d => d.inbound),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#667eea' },
        itemStyle: { color: '#667eea' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(102,126,234,0.15)' },
            { offset: 1, color: 'rgba(102,126,234,0)' },
          ]),
        },
      },
      {
        name: '出库',
        type: 'line',
        data: data.map(d => d.outbound),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#10b981' },
        itemStyle: { color: '#10b981' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16,185,129,0.15)' },
            { offset: 1, color: 'rgba(16,185,129,0)' },
          ]),
        },
      },
    ],
  }
}

function render() {
  if (!chartRef.value) return
  if (!chart) {
    chart = echarts.init(chartRef.value)
  }
  chart.setOption(buildOption(props.data, themeStore.isDark), true)
}

onMounted(() => {
  render()
  window.addEventListener('resize', () => chart?.resize())
})

watch(() => themeStore.isDark, () => render())
watch(() => props.data, () => render(), { deep: true })

onBeforeUnmount(() => {
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
  margin-bottom: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-light);
}
.chart-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.chart-body {
  width: 100%;
  height: 220px;
}
</style>
