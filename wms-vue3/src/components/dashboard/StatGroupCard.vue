<template>
  <div class="stat-group">
    <div class="stat-group-header">
      <span class="stat-group-title">{{ title }}</span>
      <span v-if="badge" class="stat-group-badge">{{ badge }}</span>
    </div>
    <div class="stat-group-cards">
      <div
        v-for="(item, idx) in items"
        :key="item.label"
        class="stat-card"
        :style="{ '--delay': `${idx * 0.08}s`, '--accent': item.accentColor }"
      >
        <div class="stat-card-icon" :style="{ background: item.gradient }">
          <el-icon :size="20" color="#fff"><component :is="item.icon" /></el-icon>
        </div>
        <div class="stat-card-body">
          <div class="stat-card-title">{{ item.label }}</div>
          <div class="stat-card-value">{{ item.value }}</div>
        </div>
        <div
          v-if="item.change !== undefined"
          class="stat-card-trend"
          :class="(item.change || '').startsWith('+') ? 'trend-up' : 'trend-down'"
        >
          <div class="trend-badge">
            <el-icon :size="10">
              <component :is="(item.change || '').startsWith('+') ? 'CaretTop' : 'CaretBottom'" />
            </el-icon>
            <span>{{ item.change }}</span>
          </div>
          <span class="trend-text">{{ item.trend }}</span>
        </div>
        <div v-else-if="item.hint" class="stat-card-hint">{{ item.hint }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface StatGroupItem {
  label: string
  value: string | number
  icon: string
  gradient: string
  accentColor: string
  /** 环比文案（如 +12%）；不传则不显示趋势徽标 */
  change?: string
  trend?: string
  /** 无趋势徽标时的次要说明（如「近7天 12 张」） */
  hint?: string
}

defineProps<{
  title: string
  badge?: string
  items: StatGroupItem[]
}>()
</script>

<style scoped>
.stat-group {
  background: var(--bg-white);
  border-radius: var(--radius-md);
  padding: 18px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-xs);
  height: 100%;
}
.stat-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}
.stat-group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.stat-group-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--bg-page);
  color: var(--text-secondary);
  font-weight: 500;
  border: 1px solid var(--border-color);
}
.stat-group-cards { display: flex; flex-direction: column; gap: 10px; }
.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-page);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-light);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  animation: fadeInUp 0.3s ease both;
  animation-delay: var(--delay);
  overflow: hidden;
  position: relative;
}
.stat-card:hover {
  border-color: var(--border-color);
  box-shadow: var(--shadow-sm);
}
.stat-card-icon {
  width: 40px; height: 40px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-card-body { flex: 1; min-width: 0; }
.stat-card-title { font-size: 11px; color: var(--text-secondary); margin-bottom: 3px; }
.stat-card-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.stat-card-trend { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.trend-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 7px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 600;
}
.trend-up .trend-badge { background: var(--success-light); color: var(--success); }
.trend-down .trend-badge { background: var(--danger-light); color: var(--danger); }
.trend-text { font-size: 11px; color: var(--text-tertiary); white-space: nowrap; }
.stat-card-hint { font-size: 11px; color: var(--text-tertiary); white-space: nowrap; }
</style>
