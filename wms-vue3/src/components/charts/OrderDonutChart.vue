<template>
  <div class="chart-card">
    <div class="chart-card-header">
      <span class="chart-card-title">订单状态分布</span>
    </div>
    <div class="chart-body" ref="chartRef"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { OrderDistributionItem } from '@/api/modules/dashboard'
import { useThemeStore } from '@/stores/theme'

echarts.use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps<{ data: OrderDistributionItem[] }>()
const themeStore = useThemeStore()
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

const COLORS = ['#667eea', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#06b6d4', '#8b5cf6']

function buildOption(data: OrderDistributionItem[], isDark: boolean) {
  const textColor = isDark ? '#cbd5e1' : '#64748b'

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: {
      bottom: 0,
      textStyle: { color: textColor, fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '72%'],
        center: ['50%', '48%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 3,
          borderColor: isDark ? '#1e293b' : '#fff',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold' },
        },
        data: data.map((item, i) => ({
          ...item,
          itemStyle: { color: COLORS[i % COLORS.length] },
        })),
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
