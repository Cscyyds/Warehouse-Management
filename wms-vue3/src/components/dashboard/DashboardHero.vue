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
          <div class="hero-stat-value">{{ item.value }}</div>
          <div class="hero-stat-label">{{ item.label }}</div>
        </div>
      </div>
      <!-- 时间卡：与业务指标同排、固定在最右（当前时间 + 数据更新于两行合并） -->
      <slot name="time-card" />
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
  gap: 16px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-xs);
}
.hero-content { position: relative; z-index: 1; flex: 0 1 auto; min-width: 0; }
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
/* 窄屏时副标题让位给指标卡：单行截断，不换行挤压右侧 */
.hero-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-stats {
  position: relative; z-index: 1;
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
  gap: 10px;
  flex: 1 1 auto;
  min-width: 0;
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
  /* 4 张业务指标严格等宽吸收剩余宽度；min-width 取最长内容宽度下限，
     保证任何宽度下图标+数值+标签单行完整显示（文字均 nowrap） */
  flex: 1 1 0;
  min-width: 134px;
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
.hero-stat-info { min-width: 0; }
.hero-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.hero-stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 1px;
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .hero-section { padding: 18px 20px; }
  .hero-title { font-size: 18px; }
  .hero-stat-card { padding: 10px 12px; gap: 8px; min-width: 120px; }
  .hero-stat-icon { width: 30px; height: 30px; }
  .hero-stat-value { font-size: 18px; }
}
/* 行内排布装不下 4 指标 + 时间卡时改为纵向堆叠，避免横向溢出 */
@media (max-width: 1080px) {
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
