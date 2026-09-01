<template>
  <div class="dashboard">
    <!-- Hero 区域：企业级信息卡片 -->
    <div class="hero-section">
      <div class="hero-content">
        <div class="hero-badge">
          <span class="hero-badge-dot"></span>
          <span>实时数据</span>
        </div>
        <h1 class="hero-title">WMS 仓储运营总览</h1>
        <p class="hero-subtitle">您好，{{ operatorName }} · 欢迎回来，以下是今日运营概览</p>
      </div>
      <div class="hero-stats">
        <div class="hero-stat-card" v-for="item in heroStats" :key="item.label" @click="handleHeroClick(item.label)">
          <div class="hero-stat-icon" :style="{ background: item.color }">
            <el-icon :size="18" color="#fff"><component :is="item.icon" /></el-icon>
          </div>
          <div class="hero-stat-info">
            <div class="hero-stat-value">{{ item.value }}</div>
            <div class="hero-stat-label">{{ item.label }}</div>
          </div>
        </div>
        <div class="hero-stat-card">
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
        <el-col v-for="groupKey in (['inbound', 'outbound', 'shipping'] as const)" :key="groupKey" :xs="24" :sm="12" :md="8">
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

    <!-- 图表区域 -->
    <div class="charts-section">
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12" :md="12">
          <TrendLineChart :data="dailyTrends" />
        </el-col>
        <el-col :xs="24" :sm="12" :md="12">
          <WarehouseBarChart :data="warehouseStock" />
        </el-col>
      </el-row>
      <el-row :gutter="16" style="margin-top: 16px;">
        <el-col :xs="24" :sm="12" :md="12">
          <OrderDonutChart :data="orderDistribution" />
        </el-col>
        <el-col :xs="24" :sm="12" :md="12">
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
            <span class="glass-card-more" @click="handleViewAllInbound">查看全部 &rarr;</span>
          </div>
          <el-table border :data="recentInbounds" style="width: 100%" size="small" class="custom-table">
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
            <el-table-column prop="time" label="时间" width="160"  show-overflow-tooltip/>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <span class="status-dot" :class="'status-dot--' + statusType(row.status)"></span>
                <el-tag :type="statusType(row.status)" size="small" effect="light" round>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { CaretTop, CaretBottom, Download, Upload, CircleCheck, Clock, Van, Warning } from '@element-plus/icons-vue'
import { getDashboardOverview } from '@/api/modules/dashboard'
import type {
  DashboardOverview,
  StatGroup,
  RecentInboundItem,
  StockAlertItem,
  DailyTrendItem,
  WarehouseStockItem,
  OrderDistributionItem,
} from '@/api/modules/dashboard'
import TrendLineChart from '@/components/charts/TrendLineChart.vue'
import WarehouseBarChart from '@/components/charts/WarehouseBarChart.vue'
import OrderDonutChart from '@/components/charts/OrderDonutChart.vue'

const router = useRouter()
const updateTime = ref('--:--')

const operatorName = ref(localStorage.getItem('operator_name') || '')

/** Hero 统计卡片 → 业务页面路由映射 */
const heroRouteMap: Record<string, string> = {
  '待处理单据': '/sales/order',
  '库存预警': '/warehouse/stock',
  '今日入库': '/purchase/inbound'
}

function handleHeroClick(label: string) {
  const path = heroRouteMap[label]
  if (path) router.push(path)
}

/** 最近入库单「查看全部」→ 采购入库单列表 */
function handleViewAllInbound() {
  router.push('/purchase/inbound')
}

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
const dailyTrends = ref<DailyTrendItem[]>([])
const warehouseStock = ref<WarehouseStockItem[]>([])
const orderDistribution = ref<OrderDistributionItem[]>([])

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

    dailyTrends.value = data.dailyTrends || []
    warehouseStock.value = data.warehouseStock || []
    orderDistribution.value = data.orderDistribution || []

    animateProgress()
  } catch (err) {
    // 接口异常时保留空数据，不阻塞页面（请求已 silent，不弹全局 toast）；
    // 控制台留痕便于排查（无接口权限的账号会 403，属预期内静默场景）
    console.error('[仪表盘概览加载失败]', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboard()
})
</script>

<style scoped>
.dashboard { padding: 0; animation: fadeInUp 0.3s ease; }

/* ═══════════════════════════════════════
   Hero Section — 企业级信息卡片
   ═══════════════════════════════════════ */
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

/* Hero Stats — inline KPI chips */
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
  cursor: pointer;
}
.hero-stat-card:hover {
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

/* ═══════════════════════════════════════
   Stat Groups — White Cards
   ═══════════════════════════════════════ */
.stats-groups { margin-bottom: 16px; }

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
  cursor: default;
  animation: fadeInUp 0.3s ease both;
  animation-delay: var(--delay);
  overflow: hidden;
  position: relative;
}
.stat-card:hover {
  border-color: var(--border-color);
  box-shadow: var(--shadow-sm);
}
/* glow removed — not needed in clean style */
.stat-card-glow { display: none; }

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

/* ═══════════════════════════════════════
   Charts Section
   ═══════════════════════════════════════ */
.charts-section { margin-bottom: 16px; }

/* ═══════════════════════════════════════
   Content Section — White Cards
   ═══════════════════════════════════════ */
.content-section { display: flex; gap: 16px; }
.section-left { flex: 1; }

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
.glass-card-more {
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  font-weight: 500;
  transition: color var(--transition-fast);
}
.glass-card-more:hover { color: var(--primary); }

.alert-count {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--danger-light);
  color: var(--danger);
  font-weight: 600;
  border: 1px solid var(--danger-border);
}

/* Table helpers */
.mono-text {
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.quantity-text { font-weight: 600; color: var(--text-primary); font-variant-numeric: tabular-nums; }

.status-dot {
  display: inline-block;
  width: 5px; height: 5px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
  position: relative;
  top: -1px;
}
.status-dot--success { background: var(--success); }
.status-dot--primary { background: var(--info); }
.status-dot--warning { background: var(--warning); }
.status-dot--info    { background: var(--text-tertiary); }

/* Alert Progress */
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

/* Empty state (shared with chart components) */
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
/* shimmer removed — no decorative animation */

/* ── 响应式断点 ── */
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
  .hero-stats {
    flex-wrap: wrap;
    width: 100%;
  }
  .hero-stat-card { flex: 1 1 calc(50% - 10px); min-width: 160px; }
  .content-section { flex-direction: column; }
}

@media (max-width: 768px) {
  .hero-section { padding: 14px 14px; }
  .hero-title { font-size: 16px; }
  .hero-stat-card { flex: 1 1 100%; }
}
</style>
