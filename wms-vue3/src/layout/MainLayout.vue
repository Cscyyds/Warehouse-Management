<template>
  <el-container class="layout-container">
    <el-header class="topbar">
      <div class="topbar-left">
        <div class="brand">WMS</div>
        <div class="top-nav">
          <div
            v-for="item in topNavItems"
            :key="item.key"
            :class="['nav-item', { active: activeTopNav === item.key }]"
            @click="handleTopNavClick(item.key)"
          >
            {{ item.label }}
          </div>
        </div>
      </div>    
      <div class="topbar-right">
        <el-tooltip content="全屏">
          <el-icon :size="18" class="topbar-icon" @click="toggleFullscreen">
            <FullScreen />
          </el-icon>
        </el-tooltip>
        <el-tooltip content="通知">
          <el-badge :value="3" class="topbar-badge">
            <el-icon :size="18" class="topbar-icon">
              <Bell />
            </el-icon>
          </el-badge>
        </el-tooltip>
        <el-dropdown trigger="click" @command="handleUserCommand">
          <span class="user-avatar">
            <el-avatar :size="32" icon="UserFilled" />
            <span class="user-name">王浩</span>
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">个人中心</el-dropdown-item>
              <el-dropdown-item command="password">修改密码</el-dropdown-item>
              <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>
    <el-container class="body-container">
      <el-aside width="230px" class="aside">
        <div class="user-card">
          <el-avatar :size="48" icon="UserFilled" />
          <div class="user-info">
            <div class="user-name-text">王浩</div>
            <div class="user-status"><span class="status-dot" />在线</div>
          </div>
        </div>
        <el-menu
          :default-active="activeMenu"
          class="side-menu"
          @select="handleMenuSelect"
        >
          <template v-for="item in currentSideMenu" :key="item.index">
            <el-sub-menu v-if="item.children" :index="item.index">
              <template #title>
                <el-icon><component :is="item.icon" /></el-icon>
                <span>{{ item.title }}</span>
              </template>
              <el-menu-item v-for="child in item.children" :key="child.index" :index="child.index">
                {{ child.title }}
              </el-menu-item>
            </el-sub-menu>
            <el-menu-item v-else :index="item.index">
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.title }}</span>
            </el-menu-item>
          </template>
        </el-menu>
      </el-aside>
      <el-container class="content-container">
        <div class="tab-bar">
          <div class="tab-list">
            <div
              v-for="tab in tabStore.tabs"
              :key="tab.path"
              :class="['tab-item', { active: tabStore.activeTab === tab.path }]"
              @click="handleTabClick(tab.path)"
            >
              <span>{{ tab.title }}</span>
              <el-icon v-if="tab.closable" class="tab-close" @click.stop="handleCloseTab(tab.path)">
                <Close />
              </el-icon>
            </div>
          </div>
          <el-dropdown trigger="click" @command="handleTabCommand">
            <el-button text class="tab-actions-btn">
              <el-icon><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="closeOther">关闭其他</el-dropdown-item>
                <el-dropdown-item command="closeAll">关闭全部</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <el-main class="main-content">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </el-main>
        <el-footer class="footer">
          <span>© 2026 WMS 仓库管理系统 - All Rights Reserved</span>
          <span class="version">V4.2</span>
        </el-footer>
      </el-container>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTabStore } from '@/stores/tab'
import { FullScreen, Bell, ArrowDown, Close, UserFilled } from '@element-plus/icons-vue'

interface MenuItem {
  index: string
  title: string
  icon?: string
  children?: MenuItem[]
}

const router = useRouter()
const route = useRoute()
const tabStore = useTabStore()

const activeTopNav = ref('system')
const activeMenu = ref('')

const topNavItems = [
  { key: 'system', label: '系统管理' },
  { key: 'customer', label: '客户管理' },
  { key: 'product', label: '产品管理' },
  { key: 'warehouse', label: '仓库管理' },
  { key: 'purchase', label: '采购管理' },
  { key: 'sales', label: '销售管理' },
  { key: 'delivery', label: '配送管理' },
  { key: 'finance', label: '财务管理' },
  { key: 'monitor', label: '主管监控' }
]

const sideMenuMap: Record<string, MenuItem[]> = {
  system: [
    { index: 'org', title: '组织管理', icon: 'Avatar', children: [
      { index: '/system/personnel', title: '人事资料管理' },
      { index: '/system/organization', title: '组织机构管理' },
      { index: '/system/position', title: '岗位管理' }
    ]},
    { index: 'perm', title: '权限管理', icon: 'Lock', children: [
      { index: '/system/roles', title: '角色管理' },
      { index: '/system/admin', title: '二级管理员' }
    ]},
    { index: 'setting', title: '系统设置', icon: 'Setting', children: [
      { index: '/system/params', title: '参数设置' },
      { index: '/system/dict', title: '字典管理' },
      { index: '/system/area', title: '行政区划' }
    ]},
    { index: 'monitor', title: '系统监控', icon: 'Monitor', children: [
      { index: '/system/logs', title: '访问日志' },
      { index: '/system/online', title: '在线用户' }
    ]},
    { index: 'msg', title: '消息推送', icon: 'ChatDotSquare', children: [
      { index: '/system/msg-pending', title: '未完成消息' },
      { index: '/system/msg-done', title: '已完成消息' },
      { index: '/system/msg-template', title: '消息模板管理' }
    ]}
  ],
 customer: [
    { index: 'info', title: '客户档案', icon: 'UserFilled', children: [
      { index: '/customer/type', title: '客户类型' },
      { index: '/customer/new', title: '新开拓客户' },
      { index: '/customer/info', title: '客户资料' },
      { index: '/customer/public', title: '公海客户' }
    ]},
    { index: 'region', title: '区域管理', icon: 'Location', children: [
      { index: '/customer/region', title: '区域管理' }
    ]},
    { index: 'finance', title: '客户财务', icon: 'Money', children: [
      { index: '/customer/finance/credit', title: '客户授信余额表' },
      { index: '/customer/finance/prepay', title: '预付款余额表' },
      { index: '/customer/finance/gift', title: '赠送金额余额表' },
      { index: '/customer/finance/balance', title: '客户余额表' }
    ]},
    { index: 'report', title: '报表与任务', icon: 'DataAnalysis', children: [
      { index: '/customer/report/sales', title: '客户月度销售表' },
      { index: '/customer/task/visit', title: '拜访任务单' }
    ]}
  ],
  product: [
    { index: '/product/category', title: '产品类别', icon: 'Menu' },
    { index: '/product/unit', title: '计量单位', icon: 'Menu' },
    { index: '/product/info', title: '产品资料', icon: 'Document' },
    { index: '/product/track', title: '产品跟踪', icon: 'Search' },
    { index: '/product/unsold', title: '滞销产品表', icon: 'TrendCharts' }
  ],
  warehouse: [
    { index: 'location', title: '库位管理', icon: 'OfficeBuilding', children: [
      { index: '/warehouse/location', title: '库位管理' },
      { index: '/warehouse/shelf', title: '放货货位' },
      { index: '/warehouse/plastic', title: '塑料盒管理' },
      { index: '/warehouse/shelf-bind', title: '产品货架绑定' }
    ]},
    { index: 'stock', title: '库存管理', icon: 'DataBoard', children: [
      { index: '/warehouse/stock', title: '库存查看' },
      { index: '/warehouse/stock-check', title: '库存盘点' },
      { index: '/warehouse/stock-location', title: '库位库存表' }
    ]},
    { index: 'barcode', title: '条码管理', icon: 'Barcode', children: [
      { index: '/warehouse/barcode-in', title: '入库条码' },
      { index: '/warehouse/barcode-out', title: '出库条码' },
      { index: '/warehouse/barcode-logistics', title: '物流条码' }
    ]},
    { index: 'printer', title: '打印管理', icon: 'Printer', children: [
      { index: '/warehouse/printer', title: '打印机' }
    ]}
  ],
  purchase: [
    { index: 'supplier', title: '供应商管理', icon: 'User', children: [
      { index: '/purchase/supplier-type', title: '供应商类型' },
      { index: '/purchase/supplier', title: '供应商档案' }
    ]},
    { index: 'order', title: '采购单据', icon: 'Document', children: [
      { index: '/purchase/order', title: '采购订单' },
      { index: '/purchase/inbound', title: '采购入库单' },
      { index: '/purchase/return', title: '采购退货单' }
    ]},
    { index: 'report', title: '采购报表', icon: 'DataAnalysis', children: [
      { index: '/purchase/report/sales-summary', title: '销量汇总表' },
      { index: '/purchase/report/return-summary', title: '采购退货汇总表' },
      { index: '/purchase/report/inbound-detail', title: '采购入库单明细' },
      { index: '/purchase/report/supplier-balance', title: '供应商余额表' },
      { index: '/purchase/report/suggestion', title: '采购建议表' }
    ]}
  ],
  sales: [
    { index: 'order', title: '销售单据', icon: 'Document', children: [
      { index: '/sales/customer-order', title: '客户订货单' },
      { index: '/sales/order', title: '销售订单' },
      { index: '/sales/return', title: '销售退货单' },
      { index: '/sales/after-sales', title: '售后服务' }
    ]},
    { index: 'reconciliation', title: '对账管理', icon: 'Coin', children: [
      { index: '/sales/reconciliation', title: '对账单管理' }
    ]},
    { index: 'report', title: '销售报表', icon: 'DataAnalysis', children: [
      { index: '/sales/report/product-summary', title: '产品销售汇总表' },
      { index: '/sales/report/customer-summary', title: '客户销售汇总表' },
      { index: '/sales/report/city-summary', title: '城市销售汇总表' },
      { index: '/sales/report/order-detail', title: '销售订单明细表' },
      { index: '/sales/report/receipt-detail', title: '订单收款明细表' },
      { index: '/sales/report/undelivered', title: '未发货明细表' },
      { index: '/sales/report/frozen-stock', title: '冻结库存明细表' },
      { index: '/sales/report/return-summary', title: '销售退货汇总表' },
      { index: '/sales/report/customer-order-detail', title: '客户订货明细表' }
    ]}
  ],
  delivery: [
    { index: 'task', title: '配送运营', icon: 'Van', children: [
      { index: '/delivery/task', title: '配送任务' },
      { index: '/delivery/pickup', title: '提货记录' }
    ]},
    { index: 'vehicle', title: '车辆与物流', icon: 'Truck', children: [
      { index: '/delivery/vehicle', title: '车辆管理' },
      { index: '/delivery/company', title: '物流公司' },
      { index: '/delivery/vehicle-checkin', title: '车辆打卡' },
      { index: '/delivery/vehicle-fuel', title: '车辆加油' }
    ]}
  ],
  finance: [
    { index: 'base', title: '基础设置', icon: 'Setting', children: [
      { index: '/finance/subject', title: '科目管理' },
      { index: '/finance/bank-account', title: '银行账户' }
    ]},
    { index: 'payment', title: '收支管理', icon: 'Money', children: [
      { index: '/finance/receipt', title: '收款管理' },
      { index: '/finance/payment', title: '付款管理' },
      { index: '/finance/transfer', title: '银行转账' },
      { index: '/finance/gift', title: '赠送金额' }
    ]},
    { index: 'report', title: '财务报表', icon: 'DataAnalysis', children: [
      { index: '/finance/report/bank-balance', title: '银行余额表' },
      { index: '/finance/report/bank-detail', title: '银行明细表' },
      { index: '/finance/report/expense-detail', title: '费用明细表' }
    ]}
  ],
  monitor: [
    { index: 'sales', title: '销售监控', icon: 'TrendCharts', children: [
      { index: '/monitor/discount', title: '开单折扣' },
      { index: '/monitor/sales-daily', title: '销售日报' },
      { index: '/monitor/sales-performance', title: '销售业绩' }
    ]},
    { index: 'workload', title: '工作量统计', icon: 'DataBoard', children: [
      { index: '/monitor/warehouse-workload', title: '库房工作量统计表' },
      { index: '/monitor/cs-workload', title: '客服工作量统计' }
    ]},
    { index: 'analysis', title: '分析报表', icon: 'DataAnalysis', children: [
      { index: '/monitor/category-sales', title: '产品类别销售统计表' },
      { index: '/monitor/customer-analysis', title: '客户销售分析' }
    ]}
  ]
}

const currentSideMenu = computed(() => sideMenuMap[activeTopNav.value] || [])

function handleTopNavClick(key: string) {
  activeTopNav.value = key
  const menu = sideMenuMap[key]
  if (menu && menu.length > 0 && menu[0].children && menu[0].children.length > 0) {
    activeMenu.value = menu[0].children[0].index
  }
}

function handleMenuSelect(index: string) {
  const title = findMenuTitle(index)
  openPageAsTab(index, title)
}

function findMenuTitle(path: string): string {
  for (const menus of Object.values(sideMenuMap)) {
    for (const item of menus) {
      if (item.children) {
        const child = item.children.find(c => c.index === path)
        if (child) return child.title
      } else if (item.index === path) {
        return item.title
      }
    }
  }
  return ''
}

function openPageAsTab(path: string, title: string) {
  tabStore.addTab(path, title)
  router.push(path)
}

function handleTabClick(path: string) {
  tabStore.setActiveTab(path)
  router.push(path)
}

function handleCloseTab(path: string) {
  tabStore.closeTab(path)
  if (tabStore.activeTab !== path) {
    router.push(tabStore.activeTab)
  }
}

function handleTabCommand(command: string) {
  if (command === 'closeOther') tabStore.closeOtherTabs(route.path)
  else if (command === 'closeAll') {
    tabStore.closeAllTabs()
    router.push('/dashboard')
  }
}

function handleUserCommand(command: string) {
  if (command === 'logout') {
    localStorage.removeItem('token')
    router.push('/login')
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

watch(() => route.path, (path) => {
  tabStore.setActiveTab(path)
  for (const [key, menus] of Object.entries(sideMenuMap)) {
    for (const item of menus) {
      if (item.children) {
        const child = item.children.find(c => c.index === path)
        if (child) {
          activeTopNav.value = key
          activeMenu.value = path
          return
        }
      } else if (item.index === path) {
        activeTopNav.value = key
        activeMenu.value = path
        return
      }
    }
  }
})
</script>

<style scoped>
.layout-container { height: 100vh; display: flex; flex-direction: column; }

/* ── Topbar ── */
.topbar {
  height: 56px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}
.topbar-left { display: flex; align-items: center; gap: 32px; }
.brand { font-size: 22px; font-weight: 700; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.top-nav { display: flex; gap: 6px; }
.nav-item { padding: 10px 25px; cursor: pointer; font-size: 16px; color: var(--text-secondary); border-radius: var(--radius-xs); transition: all var(--transition-fast); }
.nav-item:hover { color: var(--primary); background: var(--bg-hover); }
.nav-item.active { color: #fff; background: var(--primary-gradient); font-weight: 500; }
.topbar-right { display: flex; align-items: center; gap: 16px; }
.topbar-icon { cursor: pointer; color: var(--text-secondary); transition: color var(--transition-fast); }
.topbar-icon:hover { color: var(--primary); }
.user-avatar {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: background var(--transition-fast);
}
.user-avatar:hover { background: #f3f4f6; }
.user-name { font-size: 15px; color: var(--text-primary); }

/* ── Body ── */
.body-container { flex: 1; overflow: hidden; }

/* ── Sidebar ── */
.aside {
  background: #fff;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.user-card {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #f0f0f0;
}
.user-info { flex: 1; }
.user-name-text { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.user-status { font-size: 12px; color: #52c41a; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.status-dot { width: 6px; height: 6px; background: #52c41a; border-radius: 50%; }

.side-menu { border-right: none; flex: 1; }

:deep(.el-menu) {
  border-right: none;
}

:deep(.el-menu-item),
:deep(.el-sub-menu__title) {
  color: var(--text-secondary);
  transition: all 0.2s;
  position: relative;
}

:deep(.el-menu-item:hover),
:deep(.el-sub-menu__title:hover) {
  color: var(--primary);
  background-color: rgba(64, 158, 255, 0.06) !important;
}

:deep(.el-menu-item.is-active) {
  color: var(--primary) !important;
  background-color: rgba(64, 158, 255, 0.08) !important;
}

:deep(.el-menu-item.is-active::after) {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: var(--primary, #409eff);
  border-radius: 0 3px 3px 0;
}

:deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: var(--primary);
}

:deep(.el-sub-menu .el-menu) {
  background-color: #fafafa !important;
}

:deep(.el-menu--popup) {
  border-radius: 4px;
  padding: 4px 0;
}

:deep(.el-menu--popup .el-menu-item) {
  color: var(--text-secondary);
}

:deep(.el-menu--popup .el-menu-item:hover) {
  color: var(--primary);
  background-color: rgba(64, 158, 255, 0.06) !important;
}

:deep(.el-menu--popup .el-menu-item.is-active) {
  color: var(--primary) !important;
  background-color: rgba(64, 158, 255, 0.08) !important;
}

:deep(.el-sub-menu__title .el-sub-menu__icon-arrow) {
  color: var(--text-tertiary);
  transition: color 0.2s;
}

:deep(.el-sub-menu__title:hover .el-sub-menu__icon-arrow) {
  color: var(--text-secondary);
}

:deep(.el-menu-item .el-icon),
:deep(.el-sub-menu__title .el-icon) { color: inherit; }

.aside::-webkit-scrollbar { width: 5px; }
.aside::-webkit-scrollbar-track { background: transparent; }
.aside::-webkit-scrollbar-thumb {
  background: #d9d9d9;
  border-radius: 3px;
}
.aside::-webkit-scrollbar-thumb:hover {
  background: #bfbfbf;
}

/* ── Content area ── */
.content-container { display: flex; flex-direction: column; overflow: hidden; }
.tab-bar { height: 40px; background: #fff; border-bottom: 1px solid #e8e8e8; display: flex; align-items: center; padding: 0 8px; flex-shrink: 0; }
.tab-list { flex: 1; display: flex; overflow-x: auto; }
.tab-item { padding: 8px 16px; font-size: 13px; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 6px; border-right: 1px solid #f0f0f0; color: var(--text-secondary); transition: all var(--transition-fast); }
.tab-item:hover { color: var(--primary); background: var(--bg-hover); }
.tab-item.active { color: var(--primary); background: #f0f0ff; font-weight: 500; }
.tab-close { font-size: 12px; border-radius: 2px; padding: 1px; }
.tab-close:hover { background: #ddd; }
.main-content { background: var(--bg-page); padding: 16px; overflow-y: auto; flex: 1; }
.footer { height: 36px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; font-size: 12px; color: var(--text-tertiary); background: #fff; border-top: 1px solid #e8e8e8; flex-shrink: 0; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
