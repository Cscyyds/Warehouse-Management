<template>
  <div class="chart-card">
    <div class="chart-card-header">
      <span class="chart-card-title">各仓库库存分布</span>
    </div>
    <div v-show="!data.length" class="chart-empty">
      <div class="empty-icon"><el-icon :size="36"><Odometer /></el-icon></div>
      <div class="empty-title">暂无仓库库存数据</div>
      <div class="empty-desc">请先创建仓库并完成产品入库，库存分布情况将在此展示</div>
    </div>
    <div v-show="data.length" class="chart-body" ref="chartRef"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { Odometer } from '@element-plus/icons-vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { WarehouseStockItem } from '@/api/modules/dashboard'
import { useThemeStore } from '@/stores/theme'

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps<{ data: WarehouseStockItem[] }>()
const themeStore = useThemeStore()
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

function buildOption(data: WarehouseStockItem[], isDark: boolean) {
  const textColor = isDark ? '#cbd5e1' : '#64748b'
  const gridColor = isDark ? '#1e293b' : '#f1f5f9'

  return {
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['总库存', '可售库存'],
      bottom: 0,
      textStyle: { color: textColor, fontSize: 11 },
    },
    grid: { left: 8, right: 16, top: 12, bottom: 32 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.name),
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
      axisLabel: { color: textColor, fontSize: 11, rotate: data.length > 4 ? 20 : 0 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor, fontSize: 11 },
    },
    series: [
      {
        name: '总库存',
        type: 'bar',
        data: data.map(d => d.total),
        barWidth: '40%',
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#667eea' },
            { offset: 1, color: '#764ba2' },
          ]),
        },
      },
      {
        name: '可售库存',
        type: 'bar',
        data: data.map(d => d.saleable),
        barWidth: '40%',
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#10b981' },
            { offset: 1, color: '#059669' },
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
.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 220px;
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
