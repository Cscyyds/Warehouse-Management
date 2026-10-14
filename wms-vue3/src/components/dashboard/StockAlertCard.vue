<template>
  <div class="glass-card">
    <div class="glass-card-header">
      <div class="glass-card-title">
        <span class="card-title-icon card-title-icon--warning"><el-icon :size="16"><Warning /></el-icon></span>
        <span>库存预警</span>
      </div>
      <span class="alert-count">{{ alerts.length }} 项</span>
    </div>
    <div v-if="!alerts.length" class="chart-empty">
      <div class="empty-icon"><el-icon :size="36"><CircleCheck /></el-icon></div>
      <div class="empty-title">暂无库存预警</div>
      <div class="empty-desc">所有产品库存充足，无需预警。创建产品并设置库存预警阈值后，低库存商品将在此显示</div>
    </div>
    <div v-else class="alert-list">
      <div v-for="(item, idx) in alerts" :key="item.name" class="alert-item" :style="{ '--delay': `${idx * 0.06}s` }">
        <div class="alert-header">
          <span class="alert-name">{{ item.name }}</span>
          <span class="alert-percent" :class="{ 'alert-percent--danger': item.percent >= 80, 'alert-percent--warning': item.percent >= 60 && item.percent < 80 }">
            {{ item.percent }}%
          </span>
        </div>
        <div class="alert-progress-wrap">
          <div class="alert-progress-bg">
            <div
              class="alert-progress-bar"
              :style="{ width: (animatedPercents[item.name] ?? 0) + '%', background: progressGradient(item.percent) }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { CircleCheck, Warning } from '@element-plus/icons-vue'
import type { StockAlertItem } from '@/api/modules/dashboard'

const props = defineProps<{ alerts: StockAlertItem[] }>()

const animatedPercents = reactive<Record<string, number>>({})

function progressGradient(percent: number): string {
  if (percent >= 80) return 'linear-gradient(90deg, #ef4444, #f87171)'
  if (percent >= 60) return 'linear-gradient(90deg, #f59e0b, #fbbf24)'
  if (percent >= 30) return 'linear-gradient(90deg, #3b82f6, #60a5fa)'
  return 'linear-gradient(90deg, #10b981, #34d399)'
}

function animateProgress() {
  props.alerts.forEach(item => { animatedPercents[item.name] = 0 })
  requestAnimationFrame(() => {
    const duration = 800
    const start = performance.now()
    const targets = Object.fromEntries(props.alerts.map(a => [a.name, a.percent]))
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      props.alerts.forEach(a => { animatedPercents[a.name] = Math.round(targets[a.name] * ease) })
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

watch(() => props.alerts, () => animateProgress(), { immediate: true, deep: true })
</script>

<style scoped>
.glass-card {
  background: var(--bg-white);
  border-radius: var(--radius-md);
  padding: 20px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-xs);
  height: 100%;
}
.glass-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}
.glass-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.card-title-icon {
  width: 26px; height: 26px;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-bg);
  color: var(--primary);
}
.card-title-icon--warning {
  background: var(--warning-light);
  color: var(--warning);
}
.alert-count {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--danger-light);
  color: var(--danger);
  font-weight: 600;
  border: 1px solid var(--danger-border);
}
.alert-list { display: flex; flex-direction: column; gap: 14px; }
.alert-item {
  animation: fadeInUp 0.3s ease both;
  animation-delay: var(--delay);
}
.alert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.alert-name { font-size: 12px; color: var(--text-primary); font-weight: 500; }
.alert-percent {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.alert-percent--danger { color: var(--danger); }
.alert-percent--warning { color: var(--warning); }
.alert-progress-wrap { position: relative; }
.alert-progress-bg {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--border-light);
  overflow: hidden;
}
.alert-progress-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}
.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 220px;
  color: var(--text-secondary);
}
.empty-icon { color: var(--text-tertiary); margin-bottom: 10px; opacity: 0.5; }
.empty-title { font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px; }
.empty-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: center;
  max-width: 240px;
  line-height: 1.5;
}
</style>
