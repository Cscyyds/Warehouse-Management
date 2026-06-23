<template>
  <div class="dashboard">
    <!-- Hero 区域：渐变背景 + 装饰光球 -->
    <div class="hero-section">
      <div class="hero-bg">
        <div class="hero-orb hero-orb--1"></div>
        <div class="hero-orb hero-orb--2"></div>
        <div class="hero-orb hero-orb--3"></div>
      </div>
      <div class="hero-content">
        <div class="hero-badge">
          <span class="hero-badge-dot"></span>
          <span>实时数据</span>
        </div>
        <h1 class="hero-title">WMS 仓储运营总览</h1>
        <p class="hero-subtitle">您好，{{ operatorName }} ——— 欢迎回来，以下是今日运营概览</p>
      </div>
      <div class="hero-stats">
        <div class="hero-stat-card" v-for="item in heroStats" :key="item.label">
          <div class="hero-stat-icon" :style="{ background: item.color }">
            <el-icon :size="18" color="#fff"><component :is="item.icon" /></el-icon>
          </div>
          <div class="hero-stat-info">
            <div class="hero-stat-value">
              <span class="counter">{{ item.value }}</span>
            </div>
            <div class="hero-stat-label">{{ item.label }}</div>
          </div>
        </div>
        <div class="hero-stat-card hero-stat-card--time">
          <div class="hero-stat-icon" style="background: linear-gradient(135deg, #64748b, #475569)">
            <el-icon :size="18" color="#fff"><Clock /></el-icon>
          </div>
          <div class="hero-stat-info">
            <div class="hero-stat-value hero-stat-value--time">{{ updateTime }}</div>
            <div class="hero-stat-label">数据更新时间</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 统计卡片组 -->
    <div class="stats-groups" v-loading="loading">
      <el-row :gutter="16">
        <el-col v-for="groupKey in (['inbound', 'outbound', 'shipping'] as const)" :key="groupKey" :span="8">
          <div class="stat-group">
            <div class="stat-group-header">
              <span class="stat-group-title">{{ statGroupConfig[groupKey].label }}</span>
              <span class="stat-group-badge">今日</span>
            </div>
            <div class="stat-group-cards">
              <div
                v-for="(item, idx) in statGroupConfig[groupKey].items"
                :key="item.label"
                class="stat-card"
                :style="{ '--delay': `${idx * 0.08}s`, '--accent': item.accentColor }"
              >
                <div class="stat-card-glow"></div>
                <div class="stat-card-icon" :style="{ background: item.gradient }">
                  <el-icon :size="20" color="#fff"><component :is="item.icon" /></el-icon>
                </div>
                <div class="stat-card-body">
                  <div class="stat-card-title">{{ item.label }}</div>
                  <div class="stat-card-value">{{ statGroups[groupKey][item.key].count }}</div>
                </div>
                <div class="stat-card-trend" :class="statGroups[groupKey][item.key].change.startsWith('+') ? 'trend-up' : 'trend-down'">
                  <div class="trend-badge">
                    <el-icon :size="10"><component :is="statGroups[groupKey][item.key].change.startsWith('+') ? 'CaretTop' : 'CaretBottom'" /></el-icon>
                    <span>{{ statGroups[groupKey][item.key].change }}</span>
                  </div>
                  <span class="trend-text">{{ statGroups[groupKey][item.key].trend }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 内容区域 -->
    <div class="content-section">
      <div class="section-left">
        <div class="glass-card">
          <div class="glass-card-header">
            <div class="glass-card-title">
              <span class="card-title-icon"><el-icon :size="16"><Download /></el-icon></span>
              <span>最近入库单</span>
            </div>
            <span class="glass-card-more">查看全部 &rarr;</span>
          </div>
          <el-table :data="recentInbounds" style="width: 100%" size="small" class="custom-table">
            <el-table-column prop="no" label="单号" width="150">
              <template #default="{ row }">
                <span class="mono-text">{{ row.no }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="product" label="产品" />
            <el-table-column prop="quantity" label="数量" width="80">
              <template #default="{ row }">
                <span class="quantity-text">{{ row.quantity }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="time" label="时间" width="160" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <span class="status-dot" :class="'status-dot--' + statusType(row.status)"></span>
                <el-tag :type="statusType(row.status)" size="small" effect="light" round>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      <div class="section-right">
        <div class="glass-card">
          <div class="glass-card-header">
            <div class="glass-card-title">
              <span class="card-title-icon card-title-icon--warning"><el-icon :size="16"><Warning /></el-icon></span>
              <span>库存预警</span>
            </div>
            <span class="alert-count">{{ alerts.length }} 项</span>
          </div>
          <div class="alert-list">
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { CaretTop, CaretBottom, Download, Upload, CircleCheck, Clock, Van, Warning } from '@element-plus/icons-vue'
import { getDashboardOverview } from '@/api/modules/dashboard'
import type { DashboardOverview, StatGroup, RecentInboundItem, StockAlertItem } from '@/api/modules/dashboard'

const updateTime = ref('--:--')

const operatorName = ref(localStorage.getItem('operator_name') || '')

const summary = ref({ pendingOrders: 0, stockAlerts: 0, todayInbound: 0 })

const heroStats = computed(() => [
  { label: '待处理单据', value: summary.value.pendingOrders, icon: 'Clock', color: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { label: '库存预警', value: summary.value.stockAlerts, icon: 'Warning', color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  { label: '今日入库', value: summary.value.todayInbound, icon: 'Download', color: 'linear-gradient(135deg, #10b981, #059669)' }
])

const statGroupConfig: Record<keyof typeof statGroups, { label: string; items: { label: string; gradient: string; icon: string; key: keyof StatGroup; accentColor: string }[] }> = {
  inbound: {
    label: '入库',
    items: [
      { label: '未入库单数', gradient: 'linear-gradient(135deg, #667eea, #764ba2)', icon: 'Download', key: 'pending', accentColor: '#667eea' },
      { label: '已入库单数', gradient: 'linear-gradient(135deg, #10b981, #059669)', icon: 'CircleCheck', key: 'completed', accentColor: '#10b981' }
    ]
  },
  outbound: {
    label: '出库',
    items: [
      { label: '未出库单数', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', icon: 'Upload', key: 'pending', accentColor: '#f59e0b' },
      { label: '已出库单数', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', icon: 'CircleCheck', key: 'completed', accentColor: '#ef4444' }
    ]
  },
  shipping: {
    label: '发货',
    items: [
      { label: '未发货单数', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', icon: 'Clock', key: 'pending', accentColor: '#3b82f6' },
      { label: '已发货单数', gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)', icon: 'Van', key: 'completed', accentColor: '#06b6d4' }
    ]
  }
}

const statGroups = reactive<{ inbound: StatGroup; outbound: StatGroup; shipping: StatGroup }>({
  inbound: { pending: { count: 0, change: '', trend: '' }, completed: { count: 0, change: '', trend: '' } },
  outbound: { pending: { count: 0, change: '', trend: '' }, completed: { count: 0, change: '', trend: '' } },
  shipping: { pending: { count: 0, change: '', trend: '' }, completed: { count: 0, change: '', trend: '' } }
})

function statusType(status: string): string {
  const map: Record<string, string> = {
    '已完成': 'success',
    '进行中': 'primary',
    '待审核': 'warning',
    '待处理': 'warning',
    '已取消': 'info'
  }
  return map[status] ?? 'info'
}

function progressGradient(percent: number): string {
  if (percent >= 80) return 'linear-gradient(90deg, #ef4444, #f87171)'
  if (percent >= 60) return 'linear-gradient(90deg, #f59e0b, #fbbf24)'
  if (percent >= 30) return 'linear-gradient(90deg, #3b82f6, #60a5fa)'
  return 'linear-gradient(90deg, #10b981, #34d399)'
}

const recentInbounds = ref<RecentInboundItem[]>([])
const alerts = ref<StockAlertItem[]>([])

const animatedPercents = reactive<Record<string, number>>({})

function animateProgress() {
  alerts.value.forEach(item => { animatedPercents[item.name] = 0 })
  requestAnimationFrame(() => {
    const duration = 800
    const start = performance.now()
    const targets = Object.fromEntries(alerts.value.map(a => [a.name, a.percent]))
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      alerts.value.forEach(a => { animatedPercents[a.name] = Math.round(targets[a.name] * ease) })
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

const loading = ref(false)

async function fetchDashboard() {
  loading.value = true
  try {
    const res = await getDashboardOverview({ dateRange: 'today' })
    const data: DashboardOverview = res.data

    summary.value = {
      pendingOrders: data.summary.pendingOrders,
      stockAlerts: data.summary.stockAlerts,
      todayInbound: data.summary.todayInbound
    }
    updateTime.value = data.summary.updateTime

    Object.assign(statGroups, data.statGroups)

    recentInbounds.value = data.recentInbounds
    alerts.value = data.alerts

    animateProgress()
  } catch {
    // 接口异常时保留空数据，不阻塞页面
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboard()
})
</script>

<style scoped>
.dashboard { padding: 0; animation: fadeInUp 0.5s ease; }

/* ═══════════════════ Hero 区域 ═══════════════════ */
.hero-section {
  position: relative;
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  padding: 36px 40px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}
.hero-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.hero-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.15;
  animation: floatOrb 8s ease-in-out infinite;
}
.hero-orb--1 {
  width: 200px; height: 200px;
  background: #818cf8;
  top: -40px; right: 10%;
  animation-delay: 0s;
}
.hero-orb--2 {
  width: 150px; height: 150px;
  background: #c084fc;
  bottom: -30px; left: 20%;
  animation-delay: -3s;
}
.hero-orb--3 {
  width: 120px; height: 120px;
  background: #22d3ee;
  top: 50%; right: 30%;
  animation-delay: -5s;
}

@keyframes floatOrb {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(15px, -20px) scale(1.05); }
  66% { transform: translate(-10px, 15px) scale(0.95); }
}

.hero-content { position: relative; z-index: 1; }
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--primary-bg);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-full);
  padding: 4px 14px;
  font-size: 12px;
  color: var(--primary);
  margin-bottom: 12px;
}
.hero-badge-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #34d399;
  animation: pulse 2s ease-in-out infinite;
}
.hero-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
  letter-spacing: -0.02em;
}
.hero-subtitle { font-size: 14px; color: var(--text-secondary); }

.hero-stats {
  position: relative; z-index: 1;
  display: flex;
  gap: 12px;
}
.hero-stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-page);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 14px 18px;
  transition: all 0.3s ease;
}
.hero-stat-card:hover {
  background: var(--bg-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.hero-stat-icon {
  width: 38px; height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.hero-stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.hero-stat-value--time {
  font-size: 16px;
  font-weight: 600;
}
.hero-stat-label { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

/* ═══════════════════ 统计卡片组 ═══════════════════ */
.stats-groups { margin-bottom: 20px; }
.stat-group {
  background: var(--bg-white);
  border-radius: var(--radius-md);
  padding: 20px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  transition: box-shadow 0.3s ease;
}
.stat-group:hover { box-shadow: var(--shadow-md); }

.stat-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.stat-group-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.stat-group-badge {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: var(--radius-full);
  background: var(--primary-bg);
  color: var(--primary);
  font-weight: 500;
}
.stat-group-cards { display: flex; flex-direction: column; gap: 12px; }

.stat-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--bg-white);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  animation: fadeInUp 0.5s ease both;
  animation-delay: var(--delay);
  overflow: hidden;
}
.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 28px rgba(0,0,0,0.08);
  border-color: var(--accent);
}
.stat-card:hover .stat-card-glow {
  opacity: 1;
}
.stat-card-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at top left, color-mix(in srgb, var(--accent) 6%, transparent), transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.stat-card-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.stat-card-body { flex: 1; min-width: 0; }
.stat-card-title { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.stat-card-value { font-size: 26px; font-weight: 700; color: var(--text-primary); line-height: 1.2; font-variant-numeric: tabular-nums; }

.stat-card-trend {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.trend-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 600;
}
.trend-up .trend-badge { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.trend-down .trend-badge { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.trend-text { font-size: 11px; color: var(--text-tertiary); white-space: nowrap; }

/* ═══════════════════ 内容区域 ═══════════════════ */
.content-section { display: flex; gap: 16px; }
.section-left { flex: 2; }
.section-right { flex: 1; }

.glass-card {
  background: var(--bg-white);
  border-radius: var(--radius-md);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  transition: box-shadow 0.3s ease;
}
.glass-card:hover { box-shadow: var(--shadow-md); }

.glass-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}
.glass-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}
.card-title-icon {
  width: 28px; height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-bg);
  color: var(--primary);
}
.card-title-icon--warning {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}
.glass-card-more {
  font-size: 12px;
  color: var(--primary);
  cursor: pointer;
  font-weight: 500;
  transition: color 0.2s;
}
.glass-card-more:hover { color: var(--primary-dark); }
.alert-count {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: var(--radius-full);
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  font-weight: 500;
}

/* 表格样式 */
.mono-text { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 12px; color: var(--primary); font-weight: 500; }
.quantity-text { font-weight: 600; color: var(--text-primary); }
.status-dot {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
}
.status-dot--success { background: #10b981; box-shadow: 0 0 6px rgba(16,185,129,0.4); }
.status-dot--primary { background: #6366f1; box-shadow: 0 0 6px rgba(99,102,241,0.4); }
.status-dot--warning { background: #f59e0b; box-shadow: 0 0 6px rgba(245,158,11,0.4); }
.status-dot--info { background: #94a3b8; }

/* 预警进度条 */
.alert-list { display: flex; flex-direction: column; gap: 14px; }
.alert-item {
  animation: fadeInUp 0.4s ease both;
  animation-delay: var(--delay);
}
.alert-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
.alert-name { color: var(--text-primary); font-weight: 500; }
.alert-percent { color: var(--text-secondary); font-weight: 600; font-variant-numeric: tabular-nums; }
.alert-percent--danger { color: #ef4444; }
.alert-percent--warning { color: #f59e0b; }

.alert-progress-wrap { position: relative; }
.alert-progress-bg {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: var(--border-light);
  overflow: hidden;
}
.alert-progress-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}
.alert-progress-bar::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmer 2s ease-in-out infinite;
}
</style>
