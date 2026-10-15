<template>
  <div class="glass-card">
    <div class="glass-card-header">
      <div class="glass-card-title">
        <span class="card-title-icon card-title-icon--warning"><el-icon :size="16"><Warning /></el-icon></span>
        <span>库存预警</span>
      </div>
      <span class="alert-count">{{ total ?? items.length }} 项</span>
    </div>
    <div v-if="!items.length" class="chart-empty">
      <div class="empty-icon"><el-icon :size="36"><CircleCheck /></el-icon></div>
      <div class="empty-title">暂无库存预警</div>
      <div class="empty-desc">所有产品库存充足，无需预警。创建产品并设置库存预警阈值后，低库存商品将在此显示</div>
    </div>
    <div v-else class="alert-list">
      <div v-for="(item, idx) in items" :key="item.product_id" class="alert-item" :style="{ '--delay': `${idx * 0.06}s` }">
        <div class="alert-header">
          <span class="alert-name" :title="`${item.product_code} ${item.product_name}`">{{ item.product_name }}</span>
          <span class="alert-meta">
            <el-tag :type="levelMeta(item).tag" size="small" class="alert-level">{{ levelMeta(item).label }}</el-tag>
            <span class="alert-percent" :class="{ 'alert-percent--danger': item.warning_level === 'CRITICAL', 'alert-percent--warning': item.warning_level === 'SEVERE' }">
              {{ percentText(item) }}
            </span>
          </span>
        </div>
        <div class="alert-progress-wrap">
          <div class="alert-progress-bg">
            <div
              class="alert-progress-bar"
              :style="{ width: (animatedPercents[item.product_id] ?? 0) + '%', background: levelMeta(item).gradient }"
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
import type { StockWarningItem } from '@/api/modules/product'

const props = defineProps<{ items: StockWarningItem[]; total?: number }>()

/** 等级 → 文案/标签色/进度条渐变，分档口径与后端 stock-warning 接口一致（比率 0.5/0.8 分界） */
function levelMeta(item: StockWarningItem): { label: string; tag: 'danger' | 'warning' | 'info'; gradient: string } {
  if (item.warning_level === 'CRITICAL') return { label: '危急', tag: 'danger', gradient: 'linear-gradient(90deg, #ef4444, #f87171)' }
  if (item.warning_level === 'SEVERE') return { label: '严重', tag: 'warning', gradient: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }
  return { label: '轻度', tag: 'info', gradient: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }
}

/** 库存比率（0~1）→ 百分比；断货未设线时 stock_ratio 为 null，进度条归零、文案显示"断货" */
function ratioPercent(item: StockWarningItem): number {
  if (item.stock_ratio == null) return 0
  const n = Number(item.stock_ratio)
  return Number.isFinite(n) ? Math.min(100, Math.round(n * 100)) : 0
}

function percentText(item: StockWarningItem): string {
  return item.stock_ratio == null ? '断货' : `${ratioPercent(item)}%`
}

const animatedPercents = reactive<Record<string, number>>({})

function animateProgress() {
  props.items.forEach(item => { animatedPercents[item.product_id] = 0 })
  requestAnimationFrame(() => {
    const duration = 800
    const start = performance.now()
    const targets = Object.fromEntries(props.items.map(i => [i.product_id, ratioPercent(i)]))
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      props.items.forEach(i => { animatedPercents[i.product_id] = Math.round((targets[i.product_id] ?? 0) * ease) })
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

watch(() => props.items, () => animateProgress(), { immediate: true, deep: true })
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
.alert-name {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
  flex: 1;
  min-width: 0;
  margin-right: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.alert-meta { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.alert-level { transform: scale(0.9); }
.alert-percent {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  min-width: 34px;
  text-align: right;
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
