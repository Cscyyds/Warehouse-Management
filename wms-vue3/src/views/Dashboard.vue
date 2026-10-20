<template>
  <div class="dashboard">
    <DashboardHero
      badge-text="实时数据"
      :title="heroTitle"
      :subtitle="heroSubtitle"
      :stats="heroStats"
    >
      <template #time-card>
        <DashboardTimeCard :data-update-time="overview.summary.updateTime" />
      </template>
    </DashboardHero>

    <!-- ══════════ WMS 模式统计组：入库 / 出库 / 发货 / 待仓库作业 ══════════ -->
    <div v-if="!isTianxin" class="stats-groups" v-loading="loading">
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12" :md="6">
          <StatGroupCard title="入库" badge="今日" :items="wmsGroupItems('inbound')" />
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <StatGroupCard title="出库" badge="今日" :items="wmsGroupItems('outbound')" />
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <StatGroupCard title="发货" badge="今日" :items="wmsGroupItems('shipping')" />
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <StatGroupCard
            title="待仓库作业"
            :badge="`合计 ${overview.pendingOps.total} 单`"
            :items="pendingOpsItems"
          />
        </el-col>
      </el-row>
    </div>

    <!-- ══════════ 天心模式统计组：贸易四单据 / 库存概览 ══════════ -->
    <div v-else class="stats-groups" v-loading="loading">
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12" :md="12">
          <StatGroupCard title="天心贸易单据" badge="今日" :items="tianxinTradeItems" />
        </el-col>
        <el-col :xs="24" :sm="12" :md="12">
          <StatGroupCard
            title="库存概览"
            :badge="`${overview.inventoryItemCount} 款有库存`"
            :items="stockItems"
          />
        </el-col>
      </el-row>
    </div>

    <!-- ══════════ 图表区 ══════════ -->
    <div class="charts-section">
      <!-- NATIVE：趋势 / 库存 TOP；订单分布 / 库存预警 -->
      <template v-if="!isTianxin">
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <TrendLineChart :data="overview.dailyTrends" />
          </el-col>
          <el-col :xs="24" :md="12">
            <BarChart
              title="库存 TOP 产品"
              unit="数量"
              :categories="inventoryTopCategories"
              :full-labels="inventoryTopFullLabels"
              :codes="inventoryTopCodes"
              :series="inventoryTopSeries"
              empty-title="暂无库存数据"
              empty-desc="请先创建仓库并完成产品入库，库存分布情况将在此展示"
            />
          </el-col>
        </el-row>
        <el-row :gutter="16" style="margin-top: 16px;">
          <el-col :xs="24" :md="canViewStockWarning ? 12 : 24">
            <OrderDonutChart :data="overview.orderDistribution" />
          </el-col>
          <el-col v-if="canViewStockWarning" :xs="24" :md="12">
            <StockAlertCard :items="stockWarning.items" :total="stockWarning.total" />
          </el-col>
        </el-row>
      </template>

      <!-- TIANXIN：库存 TOP / 出库分布；(生产 /) 库存预警。无生产模块时预警独占一行；无预警权限时生产独占一行 -->
      <template v-else>
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <BarChart
              title="库存 TOP 产品"
              unit="数量"
              :categories="inventoryTopCategories"
              :full-labels="inventoryTopFullLabels"
              :codes="inventoryTopCodes"
              :series="inventoryTopSeries"
              empty-title="暂无库存数据"
              empty-desc="请先创建仓库并完成产品入库，库存分布情况将在此展示"
            />
          </el-col>
          <el-col :xs="24" :md="12">
            <BarChart
              title="各仓库出库分布（近7天）"
              unit="出库数量"
              :categories="outboundCategories"
              :series="outboundSeries"
              empty-title="暂无出库数据"
              empty-desc="天心销货单同步到本系统后，按仓库的出库量将在此展示"
            />
          </el-col>
        </el-row>
        <el-row v-if="overview.productionEnabled || canViewStockWarning" :gutter="16" style="margin-top: 16px;">
          <el-col v-if="overview.productionEnabled" :xs="24" :md="canViewStockWarning ? 12 : 24">
            <ProductionCard :production="overview.production" />
          </el-col>
          <el-col v-if="canViewStockWarning" :xs="24" :md="overview.productionEnabled ? 12 : 24">
            <StockAlertCard :items="stockWarning.items" :total="stockWarning.total" />
          </el-col>
        </el-row>
      </template>
    </div>

    <!-- ══════════ 内容区（最近入库单为 WMS 单据，天心模式不展示） ══════════ -->
    <div v-if="!isTianxin" class="content-section">
      <div class="section-left">
        <RecentBillTable
          title="最近入库单"
          :items="overview.recentInbounds"
          view-all-route="/purchase/inbound"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type {
  DashboardOverview,
  StatGroup,
  TianxinTradeDocItem,
} from '@/api/modules/dashboard'
import { getDashboardOverview } from '@/api/modules/dashboard'
import { getStockWarningProducts } from '@/api/modules/product'
import type { StockWarningItem } from '@/api/modules/product'
import { usePermissionStore } from '@/stores/permission'
import { TRADE_DOC_LIST_PATH, TRADE_SHARED_PAGES } from '@/config/tradeDocConfig'
import DashboardHero from '@/components/dashboard/DashboardHero.vue'
import type { HeroStat } from '@/components/dashboard/DashboardHero.vue'
import StatGroupCard from '@/components/dashboard/StatGroupCard.vue'
import type { StatGroupItem } from '@/components/dashboard/StatGroupCard.vue'
import StockAlertCard from '@/components/dashboard/StockAlertCard.vue'
import RecentBillTable from '@/components/dashboard/RecentBillTable.vue'
import ProductionCard from '@/components/dashboard/ProductionCard.vue'
import DashboardTimeCard from '@/components/dashboard/DashboardTimeCard.vue'
import TrendLineChart from '@/components/charts/TrendLineChart.vue'
import BarChart from '@/components/charts/BarChart.vue'
import OrderDonutChart from '@/components/charts/OrderDonutChart.vue'

const operatorName = ref(localStorage.getItem('operator_name') || '')
const loading = ref(false)
const permissionStore = usePermissionStore()

/** 库存预警可见性：预警卡片 / Hero 数字卡 / 天心库存概览条目同进退。
 *  无 perm_api_prod_stock_warning_all（后端 2026-10-14 权限批次）时整块隐藏，
 *  避免无权限账号请求 403 后按"0 条预警"渲染造成误判。路由守卫已 await 权限加载，无时序问题。 */
const canViewStockWarning = computed(() => permissionStore.hasUrlPerm('GET /api/v1/tenant-products/stock-warning/query'))

/** 库存预警数据（2026-10 改造）：预警卡片与各处"库存预警"数字统一改用 stock-warning 接口，
 *  弃用 dashboard 聚合的 alerts/stockAlerts（旧口径不含断货、不排除滞销，与新接口数字对不上）。 */
const stockWarning = reactive<{ total: number; items: StockWarningItem[] }>({ total: 0, items: [] })

/** 兜底空壳：接口失败（无权限 403 属预期静默场景）或旧版后端缺字段时，页面按空数据渲染 */
const overview = reactive<DashboardOverview>({
  mode: 'NATIVE',
  productionEnabled: false,
  summary: { pendingOrders: 0, stockAlerts: 0, todayInbound: 0, updateTime: '--:--' },
  pendingOps: { purchaseReceipt: 0, purchaseReturn: 0, salesReturn: 0, salesOrder: 0, total: 0 },
  statGroups: {
    inbound: { pending: { count: 0, change: '', trend: '' }, completed: { count: 0, change: '', trend: '' } },
    outbound: { pending: { count: 0, change: '', trend: '' }, completed: { count: 0, change: '', trend: '' } },
    shipping: { pending: { count: 0, change: '', trend: '' }, completed: { count: 0, change: '', trend: '' } },
  },
  recentInbounds: [],
  dailyTrends: [],
  inventoryTopProducts: [],
  orderDistribution: [],
  inventorySummary: { totalQty: 0, saleableQty: 0 },
  inventoryItemCount: 0,
  tianxinTrade: {
    docs: [],
    totals: { totalCount: 0, todayCount: 0, last7DaysCount: 0, pendingOpsCount: 0 },
  },
  warehouseOutbound: [],
  production: {
    enabled: false,
    docs: [],
    totals: { billCount: 0, pendingOpsCount: 0, errorDocCount: 0, unboundPrdCount: 0 },
  },
})

const isTianxin = computed(() => overview.mode === 'TIANXIN')

/** 天心贸易 docKey → 标题与列表路由（名称单点来自 tradeDocConfig，后端不再下发名称） */
const tradePageByDocKey: Record<string, { title: string; path: string }> = Object.fromEntries(
  Object.entries(TRADE_SHARED_PAGES).map(([path, page]) => [
    page.docKey,
    {
      title: page.title.replace('（天心）', ''),
      path: TRADE_DOC_LIST_PATH[page.docKey] ?? path,
    },
  ])
)

const heroTitle = computed(() => (isTianxin.value ? '天心 ERP 运营总览' : 'WMS 仓储运营总览'))

const heroSubtitle = computed(() => {
  const greeting = `您好，${operatorName.value}`
  return isTianxin.value
    ? `${greeting} · 采购/销售由天心 ERP 接管，以下为生产与贸易数据概览`
    : `${greeting} · 欢迎回来，以下是今日运营概览`
})

/** 业务指标卡（时间信息已合并到右侧独立的 DashboardTimeCard，不再进此队列） */
const heroStats = computed<HeroStat[]>(() => {
  if (isTianxin.value) {
    const stats: HeroStat[] = [
      {
        label: '贸易待作业',
        value: overview.tianxinTrade.totals.pendingOpsCount,
        icon: 'Van',
        color: 'linear-gradient(135deg, #667eea, #764ba2)',
        route: TRADE_DOC_LIST_PATH['purchase-order'],
      },
      {
        label: '近7天单据',
        value: overview.tianxinTrade.totals.last7DaysCount,
        icon: 'Document',
        color: 'linear-gradient(135deg, #f59e0b, #d97706)',
        route: TRADE_DOC_LIST_PATH['sales-order'],
      },
    ]
    if (overview.productionEnabled) {
      stats.push({
        label: '生产待作业',
        value: overview.production.totals.pendingOpsCount,
        icon: 'Cpu',
        color: 'linear-gradient(135deg, #10b981, #059669)',
        route: '/production/overview',
      })
    }
    if (canViewStockWarning.value) {
      stats.push({
        label: '库存预警',
        value: stockWarning.total,
        icon: 'Warning',
        color: 'linear-gradient(135deg, #ef4444, #dc2626)',
        route: '/warehouse/stock',
      })
    }
    return stats
  }
  const stats: HeroStat[] = [
    {
      label: '待处理单据',
      value: overview.summary.pendingOrders,
      icon: 'Clock',
      color: 'linear-gradient(135deg, #667eea, #764ba2)',
      route: '/sales/order',
    },
  ]
  if (canViewStockWarning.value) {
    stats.push({
      label: '库存预警',
      value: stockWarning.total,
      icon: 'Warning',
      color: 'linear-gradient(135deg, #f59e0b, #d97706)',
      route: '/warehouse/stock',
    })
  }
  stats.push({
    label: '今日入库',
    value: overview.summary.todayInbound,
    icon: 'Download',
    color: 'linear-gradient(135deg, #10b981, #059669)',
    route: '/purchase/inbound',
  })
  return stats
})

const wmsGroupConfig: Record<keyof DashboardOverview['statGroups'], {
  items: { key: keyof StatGroup; label: string; gradient: string; icon: string; accentColor: string }[]
}> = {
  inbound: {
    items: [
      { label: '未入库单数', gradient: 'linear-gradient(135deg, #667eea, #764ba2)', icon: 'Download', key: 'pending', accentColor: '#667eea' },
      { label: '已入库单数', gradient: 'linear-gradient(135deg, #10b981, #059669)', icon: 'CircleCheck', key: 'completed', accentColor: '#10b981' }
    ]
  },
  outbound: {
    items: [
      { label: '未出库单数', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', icon: 'Upload', key: 'pending', accentColor: '#f59e0b' },
      { label: '已出库单数', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', icon: 'CircleCheck', key: 'completed', accentColor: '#ef4444' }
    ]
  },
  shipping: {
    items: [
      { label: '未发货单数', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', icon: 'Clock', key: 'pending', accentColor: '#3b82f6' },
      { label: '已发货单数', gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)', icon: 'Van', key: 'completed', accentColor: '#06b6d4' }
    ]
  }
}

function wmsGroupItems(groupKey: keyof DashboardOverview['statGroups']): StatGroupItem[] {
  return wmsGroupConfig[groupKey].items.map(cfg => {
    const stat = overview.statGroups[groupKey][cfg.key]
    return {
      label: cfg.label,
      value: stat.count,
      icon: cfg.icon,
      gradient: cfg.gradient,
      accentColor: cfg.accentColor,
      change: stat.change,
      trend: stat.trend
    }
  })
}

const pendingOpsItems = computed<StatGroupItem[]>(() => [
  {
    label: '采购入库待作业', value: overview.pendingOps.purchaseReceipt,
    icon: 'Download', gradient: 'linear-gradient(135deg, #667eea, #764ba2)', accentColor: '#667eea'
  },
  {
    label: '采购退货待出库', value: overview.pendingOps.purchaseReturn,
    icon: 'RefreshLeft', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', accentColor: '#f59e0b'
  },
  {
    label: '销售退货待入库', value: overview.pendingOps.salesReturn,
    icon: 'Refresh', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', accentColor: '#3b82f6'
  },
  {
    label: '销售出库待出库', value: overview.pendingOps.salesOrder,
    icon: 'Upload', gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)', accentColor: '#06b6d4'
  }
])

const tradeStyles: Record<TianxinTradeDocItem['docKey'], { gradient: string; accentColor: string; icon: string }> = {
  'purchase-order': { gradient: 'linear-gradient(135deg, #667eea, #764ba2)', accentColor: '#667eea', icon: 'Download' },
  'sales-order': { gradient: 'linear-gradient(135deg, #10b981, #059669)', accentColor: '#10b981', icon: 'Upload' },
  'purchase-return': { gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', accentColor: '#f59e0b', icon: 'RefreshLeft' },
  'sales-return': { gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', accentColor: '#3b82f6', icon: 'Refresh' }
}

const tianxinTradeItems = computed<StatGroupItem[]>(() =>
  overview.tianxinTrade.docs.map(doc => {
    const style = tradeStyles[doc.docKey] ?? tradeStyles['purchase-order']
    const page = tradePageByDocKey[doc.docKey]
    const hintParts = [`近7天 ${doc.last7DaysCount} 单`, `待作业 ${doc.pendingOpsCount}`]
    if (doc.lastBillDate) hintParts.push(`最近 ${doc.lastBillDate}`)
    return {
      label: page?.title ?? doc.docKey,
      value: doc.todayCount,
      icon: style.icon,
      gradient: style.gradient,
      accentColor: style.accentColor,
      hint: hintParts.join(' · ')
    }
  })
)

const stockItems = computed<StatGroupItem[]>(() => [
  {
    label: '库存总量', value: overview.inventorySummary.totalQty,
    icon: 'Box', gradient: 'linear-gradient(135deg, #667eea, #764ba2)', accentColor: '#667eea',
    hint: '仓库真实库存'
  },
  {
    label: '可用库存', value: overview.inventorySummary.saleableQty,
    icon: 'Files', gradient: 'linear-gradient(135deg, #10b981, #059669)', accentColor: '#10b981',
    hint: '可售口径'
  },
  {
    label: '有库存产品', value: overview.inventoryItemCount,
    icon: 'Goods', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', accentColor: '#f59e0b',
    hint: '仓库库存大于 0'
  },
  ...(canViewStockWarning.value ? [{
    label: '库存预警', value: stockWarning.total,
    icon: 'Warning', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', accentColor: '#ef4444',
    hint: '断货或低于预警线'
  }] : [])
])

// 横向条形图每条标签独占一行，直接把品名放轴上（超出由图表按宽度截断），
// 编码作为 tooltip 副信息；老接口无 code 时自动省略括号。
const inventoryTopCategories = computed(() =>
  overview.inventoryTopProducts.map(d => d.name || d.code || '')
)

const inventoryTopFullLabels = computed(() =>
  overview.inventoryTopProducts.map(d => d.name || d.code || '')
)

const inventoryTopCodes = computed(() =>
  overview.inventoryTopProducts.map(d => d.code || '')
)

const inventoryTopSeries = computed(() => [
  {
    name: '总库存',
    values: overview.inventoryTopProducts.map(d => d.total),
    colors: ['#667eea', '#764ba2'] as [string, string]
  },
  {
    name: '可用库存',
    values: overview.inventoryTopProducts.map(d => d.saleable),
    colors: ['#10b981', '#059669'] as [string, string]
  }
])

const outboundCategories = computed(() => overview.warehouseOutbound.map(d => d.name))

const outboundSeries = computed(() => [
  {
    name: '出库数量',
    values: overview.warehouseOutbound.map(d => d.qty),
    colors: ['#f59e0b', '#d97706'] as [string, string]
  }
])

function applyOverview(data: Partial<DashboardOverview> | undefined) {
  if (!data) return
  // 逐块覆盖：后端单块降级或旧版缺字段时保留兜底值，不写入 undefined
  if (data.mode) overview.mode = data.mode
  overview.productionEnabled = !!data.productionEnabled
  if (data.summary) Object.assign(overview.summary, data.summary)
  if (data.pendingOps) Object.assign(overview.pendingOps, data.pendingOps)
  if (data.statGroups) Object.assign(overview.statGroups, data.statGroups)
  if (data.inventorySummary) Object.assign(overview.inventorySummary, data.inventorySummary)
  if (data.tianxinTrade) Object.assign(overview.tianxinTrade, data.tianxinTrade)
  if (data.production) Object.assign(overview.production, data.production)
  overview.inventoryItemCount = data.inventoryItemCount ?? 0
  overview.recentInbounds = data.recentInbounds ?? []
  overview.dailyTrends = data.dailyTrends ?? []
  overview.inventoryTopProducts = data.inventoryTopProducts ?? []
  overview.orderDistribution = data.orderDistribution ?? []
  overview.warehouseOutbound = data.warehouseOutbound ?? []
}

async function fetchDashboard() {
  loading.value = true
  try {
    const res = await getDashboardOverview({ dateRange: 'today' })
    applyOverview(res.data)
  } catch (err) {
    // 接口异常时保留空数据，不阻塞页面（请求已 silent，不弹全局 toast）；
    // 控制台留痕便于排查（无接口权限的账号会 403，属预期内静默场景）
    console.error('[仪表盘概览加载失败]', err)
  } finally {
    loading.value = false
  }
}

/** 库存预警：仅取最紧急的前 8 条（接口默认排序 warning_level ASC 最紧急在前，无需传 sort）。
 *  失败保留空数据不阻塞页面（可见性已由 canViewStockWarning 把关，此处兜底网络/服务异常）。 */
async function fetchStockWarning() {
  if (!canViewStockWarning.value) return
  try {
    const res = await getStockWarningProducts({ page: 1, page_size: 8 })
    stockWarning.total = res.data.total ?? 0
    stockWarning.items = res.data.items ?? []
  } catch (err) {
    console.error('[仪表盘库存预警加载失败]', err)
  }
}

onMounted(() => {
  fetchDashboard()
  fetchStockWarning()
})
</script>

<style scoped>
.dashboard { padding: 0; animation: fadeInUp 0.3s ease; }
.stats-groups { margin-bottom: 16px; }
.charts-section { margin-bottom: 16px; }
.content-section { display: flex; gap: 16px; }
.section-left { flex: 1; }

@media (max-width: 960px) {
  .content-section { flex-direction: column; }
}
</style>
