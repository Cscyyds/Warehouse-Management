<template>
  <div class="hero-section">
    <div class="hero-content">
      <div class="hero-badge">
        <span class="hero-badge-dot"></span>
        <span>{{ badgeText }}</span>
      </div>
      <h1 class="hero-title">{{ title }}</h1>
      <p class="hero-subtitle">{{ subtitle }}</p>
    </div>
    <div class="hero-stats">
      <div
        v-for="item in stats"
        :key="item.label"
        class="hero-stat-card"
        :class="{ 'hero-stat-card--clickable': !!item.route }"
        @click="handleClick(item)"
      >
        <div class="hero-stat-icon" :style="{ background: item.color }">
          <el-icon :size="18" color="#fff"><component :is="item.icon" /></el-icon>
        </div>
        <div class="hero-stat-info">
          <div class="hero-stat-value" :class="{ 'hero-stat-value--time': item.isTime }">{{ item.value }}</div>
          <div class="hero-stat-label">{{ item.label }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

export interface HeroStat {
  label: string
  value: string | number
  icon: string
  color: string
  /** 点击跳转的业务页路由；为空则不可点 */
  route?: string
  isTime?: boolean
}

defineProps<{
  badgeText: string
  title: string
  subtitle: string
  stats: HeroStat[]
}>()

const router = useRouter()

function handleClick(item: HeroStat) {
  if (item.route) router.push(item.route)
}
</script>

<style scoped>
.hero-section {
  position: relative;
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  padding: 24px 28px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-xs);
}
.hero-content { position: relative; z-index: 1; }
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--success-light);
  border: 1px solid var(--success-border);
  border-radius: var(--radius-full);
  padding: 3px 12px;
  font-size: 11px;
  color: var(--success);
  margin-bottom: 10px;
  font-weight: 500;
}
.hero-badge-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--success);
  animation: pulse 2.5s ease-in-out infinite;
}
.hero-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 5px;
  letter-spacing: -0.01em;
}
.hero-subtitle { font-size: 13px; color: var(--text-secondary); }

.hero-stats {
  position: relative; z-index: 1;
  display: flex;
  gap: 10px;
}
.hero-stat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-page);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}
.hero-stat-card--clickable { cursor: pointer; }
.hero-stat-card--clickable:hover {
  border-color: var(--primary-border);
  box-shadow: var(--shadow-sm);
}
.hero-stat-icon {
  width: 34px; height: 34px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.hero-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.hero-stat-value--time { font-size: 13px; font-weight: 600; }
.hero-stat-label { font-size: 11px; color: var(--text-secondary); margin-top: 1px; }

@media (max-width: 1280px) {
  .hero-section { padding: 18px 20px; }
  .hero-title { font-size: 18px; }
}
@media (max-width: 960px) {
  .hero-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
  .hero-stats { flex-wrap: wrap; width: 100%; }
  .hero-stat-card { flex: 1 1 calc(50% - 10px); min-width: 160px; }
}
@media (max-width: 768px) {
  .hero-section { padding: 14px 14px; }
  .hero-title { font-size: 16px; }
  .hero-stat-card { flex: 1 1 100%; }
}
</style>
