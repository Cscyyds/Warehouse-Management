import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { ElMessage } from 'element-plus'
import { isPublicPath } from '@/config/menuPermissionMap'
import { isPageVisible, type PagePermissionView } from '@/config/pagePermissionMap'

const routerHistoryBase = import.meta.env.BASE_URL

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Landing',
    component: () => import('@/views/LandingPage.vue'),
    meta: { title: '智星云仓储' }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/trial',
    name: 'TrialBooking',
    component: () => import('@/views/TrialBooking.vue'),
    meta: { title: '预约试用' }
  },
  {
    path: '/privacy',
    name: 'PrivacyPolicy',
    component: () => import('@/views/PrivacyPolicy.vue'),
    meta: { title: '个人信息保护声明' }
  },
  {
    // 以 /app 作为 MainLayout 的挂载点，子路由使用绝对路径保持原有 URL 不变
    path: '/app',
    component: () => import('@/layout/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '仪表盘' }
      },
      {
        path: '/common/add',
        name: 'AddTemplate',
        component: () => import('@/views/common/AddTemplate.vue'),
        meta: { title: '新增' }
      },
      // 系统管理
      { path: '/system/personnel', name: 'Personnel', component: () => import('@/views/system/Personnel.vue'), meta: { title: '人事资料管理' } },
      { path: '/system/organization', name: 'Organization', component: () => import('@/views/system/Organization.vue'), meta: { title: '组织机构管理' } },
      { path: '/system/position', name: 'Position', component: () => import('@/views/system/Position.vue'), meta: { title: '岗位管理' } },
      { path: '/system/roles', name: 'Roles', component: () => import('@/views/system/Role.vue'), meta: { title: '角色管理' } },
      { path: '/system/admin', name: 'Admin', component: () => import('@/views/system/Admin.vue'), meta: { title: '二级管理员' } },
      { path: '/system/params', name: 'Params', component: () => import('@/views/system/Params.vue'), meta: { title: '参数设置' } },
      { path: '/system/dict', name: 'Dict', component: () => import('@/views/system/Dict.vue'), meta: { title: '字典管理' } },
      { path: '/system/dict-data', name: 'DictData', component: () => import('@/views/system/DictData.vue'), meta: { title: '字典数据' } },
      { path: '/system/area', name: 'Area', component: () => import('@/views/system/Area.vue'), meta: { title: '行政区划' } },
      { path: '/system/logs', name: 'Logs', component: () => import('@/views/monitor/AccessLog.vue'), meta: { title: '访问日志' } },
      { path: '/system/online', name: 'Online', component: () => import('@/views/monitor/OnlineUser.vue'), meta: { title: '在线用户' } },
      // 客户管理
      { path: '/customer/type', name: 'CustomerType', component: () => import('@/views/customer/CustomerType.vue'), meta: { title: '客户类型设定' } },
      { path: '/customer/region', name: 'CustomerRegion', component: () => import('@/views/customer/CustomerRegion.vue'), meta: { title: '区域管理设定' } },

      { path: '/customer/info', name: 'CustomerInfo', component: () => import('@/views/customer/CustomerInfo.vue'), meta: { title: '正式客户信息' } },
      { path: '/customer/public', name: 'CustomerPublic', component: () => import('@/views/customer/CustomerPublic.vue'), meta: { title: '公海客户' } },
      { path: '/customer/new', name: 'CustomerNew', component: () => import('@/views/customer/CustomerNew.vue'), meta: { title: '新开拓客户' } },
      { path: '/customer/finance/credit', name: 'CustomerFinanceCredit', component: () => import('@/views/customer/CustomerFinanceCredit.vue'), meta: { title: '客户授信余额表' } },
      { path: '/customer/finance/prepay', name: 'CustomerFinancePrepay', component: () => import('@/views/customer/CustomerFinancePrepay.vue'), meta: { title: '预付款余额表' } },
      { path: '/customer/finance/gift', name: 'CustomerFinanceGift', component: () => import('@/views/customer/CustomerFinanceGift.vue'), meta: { title: '赠送金额余额表' } },
      { path: '/customer/finance/gift/add', name: 'CustomerGiftAdd', component: () => import('@/views/customer/CustomerGiftAdd.vue'), meta: { title: '新增赠送金额' } },
      { path: '/customer/finance/balance', name: 'CustomerFinanceBalance', component: () => import('@/views/customer/CustomerFinanceBalance.vue'), meta: { title: '客户余额表' } },
      { path: '/customer/report/sales', name: 'CustomerReportSales', component: () => import('@/views/Placeholder.vue'), meta: { title: '客户月度销售表' } },
      { path: '/customer/task/visit', name: 'CustomerTaskVisit', component: () => import('@/views/customer/CustomerTaskVisit.vue'), meta: { title: '拜访任务单' } },
      { path: '/customer/task/visit/add', name: 'CustomerTaskVisitAdd', component: () => import('@/views/customer/CustomerTaskVisitAdd.vue'), meta: { title: '新增拜访任务' } },
      { path: '/customer/finance/credit/:customerId', name: 'CustomerCreditUsage', component: () => import('@/views/customer/CustomerCreditUsage.vue'), meta: { title: '授信使用明细' } },
      { path: '/customer/finance/gift/:customerId', name: 'CustomerGiftUsage', component: () => import('@/views/customer/CustomerGiftUsage.vue'), meta: { title: '赠送使用明细' } },
      { path: '/customer/finance/prepay/:customerId', name: 'CustomerPrepaymentUsage', component: () => import('@/views/customer/CustomerPrepaymentUsage.vue'), meta: { title: '预付款使用明细' } },
      { path: '/customer/finance/balance/:customerId', name: 'CustomerBalanceLog', component: () => import('@/views/customer/CustomerBalanceLog.vue'), meta: { title: '余额变动明细' } },
      // 产品管理
      { path: '/product/category', name: 'ProductCategory', component: () => import('@/views/product/ProductCategory.vue'), meta: { title: '产品类别' } },
      { path: '/product/unit', name: 'ProductUnit', component: () => import('@/views/product/ProductUnit.vue'), meta: { title: '计量单位' } },
      { path: '/product/info', name: 'ProductInfo', component: () => import('@/views/product/ProductInfo.vue'), meta: { title: '产品资料' } },
      { path: '/product/track', name: 'ProductTrack', component: () => import('@/views/Placeholder.vue'), meta: { title: '产品跟踪' } },
      { path: '/product/unsold', name: 'ProductUnsold', component: () => import('@/views/product/ProductUnsold.vue'), meta: { title: '滞销产品' } },
      // 仓库管理
      { path: '/warehouse/location', name: 'WarehouseLocation', component: () => import('@/views/warehouse/WarehouseLocation.vue'), meta: { title: '库位管理' } },
      { path: '/warehouse/shelf', name: 'WarehouseShelf', component: () => import('@/views/warehouse/WarehouseShelf.vue'), meta: { title: '放货货位' } },
      { path: '/warehouse/plastic', name: 'WarehousePlastic', component: () => import('@/views/warehouse/WarehousePlastic.vue'), meta: { title: '塑料盒管理' } },
      { path: '/warehouse/shelf-bind', name: 'WarehouseShelfBind', component: () => import('@/views/Placeholder.vue'), meta: { title: '产品货架绑定' } },
      { path: '/warehouse/barcode-in', name: 'WarehouseBarcodeIn', component: () => import('@/views/warehouse/WarehouseBarcodeIn.vue'), meta: { title: '入库条码' } },
      { path: '/warehouse/barcode-out', name: 'WarehouseBarcodeOut', component: () => import('@/views/warehouse/WarehouseBarcodeOut.vue'), meta: { title: '出库条码' } },
      { path: '/warehouse/barcode-package', name: 'WarehouseBarcodePackage', component: () => import('@/views/warehouse/WarehouseBarcodePackage.vue'), meta: { title: '包装条码' } },
      { path: '/warehouse/barcode-product', name: 'WarehouseBarcodeProduct', component: () => import('@/views/warehouse/WarehouseBarcodeProduct.vue'), meta: { title: '产品示例条码' } },
      { path: '/warehouse/stock', name: 'WarehouseStock', component: () => import('@/views/warehouse/WarehouseStock.vue'), meta: { title: '产品库存' } },
      { path: '/warehouse/stock/detail', name: 'WarehouseStockDetail', component: () => import('@/views/warehouse/WarehouseStockDetail.vue'), meta: { title: '库存明细' } },
      { path: '/warehouse/printer-model', name: 'WarehousePrinterModel', component: () => import('@/views/warehouse/WarehousePrinterModelView.vue'), meta: { title: '打印机型号' } },
      { path: '/warehouse/stock-check', name: 'WarehouseStockCheck', component: () => import('@/views/warehouse/WarehouseStockCheck.vue'), meta: { title: '库存盘点' } },
      { path: '/warehouse/stock-location', name: 'WarehouseStockLocation', component: () => import('@/views/warehouse/WarehouseStockLocation.vue'), meta: { title: '库位库存表' } },
      // 采购管理
      { path: '/purchase/supplier-type', name: 'SupplierType', component: () => import('@/views/purchase/SupplierType.vue'), meta: { title: '供应商类型' } },
      { path: '/purchase/supplier', name: 'Supplier', component: () => import('@/views/purchase/Supplier.vue'), meta: { title: '供应商档案' } },
      { path: '/purchase/supplier/credit', name: 'SupplierCredit', component: () => import('@/views/purchase/supplier/SupplierCredit.vue'), meta: { title: '供应商授信' } },
      { path: '/purchase/supplier/credit/add', name: 'SupplierCreditAdd', component: () => import('@/views/purchase/supplier/SupplierCreditAdd.vue'), meta: { title: '新增/调减供应商授信' } },
      { path: '/purchase/supplier/credit/detail', name: 'SupplierCreditDetail', component: () => import('@/views/purchase/supplier/SupplierCreditDetail.vue'), meta: { title: '供应商授信明细' } },
      { path: '/purchase/supplier/gift', name: 'SupplierGift', component: () => import('@/views/purchase/supplier/SupplierGift.vue'), meta: { title: '供应商赠送金额' } },
      { path: '/purchase/supplier/gift/add', name: 'SupplierGiftAdd', component: () => import('@/views/purchase/supplier/SupplierGiftAdd.vue'), meta: { title: '新增/调减供应商赠送金额' } },
      { path: '/purchase/supplier/gift/detail', name: 'SupplierGiftDetail', component: () => import('@/views/purchase/supplier/SupplierGiftDetail.vue'), meta: { title: '供应商赠送金额明细' } },
      { path: '/purchase/order', name: 'PurchaseOrder', component: () => import('@/views/purchase/PurchaseOrder.vue'), meta: { title: '采购订单' } },
      { path: '/purchase/inbound', name: 'PurchaseInbound', component: () => import('@/views/purchase/PurchaseInbound.vue'), meta: { title: '采购入库单' } },
      { path: '/purchase/return', name: 'PurchaseReturn', component: () => import('@/views/purchase/PurchaseReturn.vue'), meta: { title: '采购退货单' } },
      { path: '/purchase/reconciliation', name: 'PurchaseReconciliation', component: () => import('@/views/purchase/PurchaseReconciliation.vue'), meta: { title: '采购对账单' } },
      { path: '/purchase/report/return-summary', name: 'PurchaseReportReturnSummary', component: () => import('@/views/purchase/PurchaseReturnSummary.vue'), meta: { title: '采购退货汇总表' } },
      { path: '/purchase/report/inbound-detail', name: 'PurchaseReportInboundDetail', component: () => import('@/views/purchase/PurchaseInboundDetail.vue'), meta: { title: '采购入库单明细' } },
      { path: '/purchase/report/supplier-balance', name: 'PurchaseReportSupplierBalance', component: () => import('@/views/purchase/SupplierBalance.vue'), meta: { title: '供应商余额表' } },
      // 销售管理
      { path: '/sales/order', name: 'SalesOrder', component: () => import('@/views/sales/SalesOrder.vue'), meta: { title: '销售订单' } },
      { path: '/sales/customer-order', name: 'CustomerOrder', component: () => import('@/views/sales/CustomerOrder.vue'), meta: { title: '客户订货单' } },
      { path: '/sales/customer-order/create', name: 'CustomerOrderCreate', component: () => import('@/views/sales/CustomerOrderCreate.vue'), meta: { title: '新增客户订货单' } },
      { path: '/sales/return', name: 'SalesReturn', component: () => import('@/views/sales/SalesReturn.vue'), meta: { title: '销售退货单' } },
      { path: '/sales/after-sales', name: 'SalesAfterSales', component: () => import('@/views/sales/AfterSales.vue'), meta: { title: '售后服务' } },
      { path: '/sales/reconciliation', name: 'SalesReconciliation', component: () => import('@/views/sales/Reconciliation.vue'), meta: { title: '对账单' } },
      { path: '/sales/reconciliation/add', name: 'SalesReconciliationAdd', component: () => import('@/views/sales/SalesReconciliationAdd.vue'), meta: { title: '新增销售对账单' } },
      { path: '/sales/report/product-summary', name: 'SalesReportProductSummary', component: () => import('@/views/sales/SalesReportProductSummary.vue'), meta: { title: '产品销售汇总表' } },
      { path: '/sales/report/customer-summary', name: 'SalesReportCustomerSummary', component: () => import('@/views/sales/SalesReportCustomerSummary.vue'), meta: { title: '客户销售汇总表' } },
      // { path: '/sales/report/city-summary', name: 'SalesReportCitySummary', component: () => import('@/views/sales/SalesReportCitySummary.vue'), meta: { title: '城市销售汇总表' } },
      { path: '/sales/report/order-detail', name: 'SalesReportOrderDetail', component: () => import('@/views/sales/SalesReportOrderDetail.vue'), meta: { title: '销售订单明细表' } },
      // { path: '/sales/report/receipt-detail', name: 'SalesReportReceiptDetail', component: () => import('@/views/sales/SalesReportReceiptDetail.vue'), meta: { title: '订单收款明细表' } },
      // { path: '/sales/report/undelivered', name: 'SalesReportUndelivered', component: () => import('@/views/sales/SalesReportUndelivered.vue'), meta: { title: '未发货明细表' } },
      // { path: '/sales/report/frozen-stock', name: 'SalesReportFrozenStock', component: () => import('@/views/sales/SalesReportFrozenStock.vue'), meta: { title: '冻结库存明细表' } },
      // { path: '/sales/report/return-summary', name: 'SalesReportReturnSummary', component: () => import('@/views/sales/SalesReportReturnSummary.vue'), meta: { title: '销售退货汇总表' } },
      { path: '/sales/report/customer-order-detail', name: 'SalesReportCustomerOrderDetail', component: () => import('@/views/sales/SalesReportCustomerOrderDetail.vue'), meta: { title: '客户订货明细表' } },
      // 配送管理
      { path: '/delivery/task', name: 'DeliveryTask', component: () => import('@/views/delivery/DeliveryTask.vue'), meta: { title: '配送任务' } },
      { path: '/delivery/task/add', name: 'DeliveryTaskAdd', component: () => import('@/views/delivery/DeliveryTaskAdd.vue'), meta: { title: '新增配送任务' } },
      { path: '/delivery/task/detail', name: 'DeliveryTaskDetail', component: () => import('@/views/delivery/DeliveryTaskDetail.vue'), meta: { title: '配送任务详情' } },
      { path: '/delivery/driver', name: 'DeliveryDriver', component: () => import('@/views/delivery/Driver.vue'), meta: { title: '司机档案' } },
      { path: '/delivery/driver/add', name: 'DeliveryDriverAdd', component: () => import('@/views/delivery/DriverAdd.vue'), meta: { title: '新增/编辑司机档案' } },
      { path: '/delivery/logistics', name: 'DeliveryLogistics', component: () => import('@/views/delivery/DeliveryLogistics.vue'), meta: { title: '物流单号管理' } },
      { path: '/delivery/pickup', name: 'DeliveryPickup', component: () => import('@/views/Placeholder.vue'), meta: { title: '提货记录' } },
      { path: '/delivery/vehicle', name: 'DeliveryVehicle', component: () => import('@/views/delivery/Vehicle.vue'), meta: { title: '车辆管理' } },
      { path: '/delivery/company', name: 'DeliveryCompany', component: () => import('@/views/customer/LogisticsCompany.vue'), meta: { title: '物流公司' } },
      { path: '/delivery/vehicle-checkin', name: 'DeliveryVehicleCheckin', component: () => import('@/views/Placeholder.vue'), meta: { title: '车辆打卡' } },
      { path: '/delivery/vehicle-fuel', name: 'DeliveryVehicleFuel', component: () => import('@/views/Placeholder.vue'), meta: { title: '车辆加油' } },
      // 财务管理
      { path: '/finance/subject', name: 'FinanceSubject', component: () => import('@/views/finance/AccountSubject.vue'), meta: { title: '科目管理' } },
      { path: '/finance/bank-account', name: 'FinanceBankAccount', component: () => import('@/views/finance/BankAccount.vue'), meta: { title: '银行账户' } },
      { path: '/finance/other-receipt', name: 'FinanceOtherReceipt', component: () => import('@/views/finance/OtherReceipt.vue'), meta: { title: '其他收款' } },
      { path: '/finance/payment-order', name: 'FinancePaymentOrder', component: () => import('@/views/finance/PaymentOrder.vue'), meta: { title: '付款单' } },
      { path: '/finance/monthly-payment', name: 'FinanceMonthlyPayment', component: () => import('@/views/finance/MonthlyPaymentOrder.vue'), meta: { title: '月结付款单' } },
      { path: '/finance/prepayment', name: 'FinancePrepayment', component: () => import('@/views/finance/PrepaymentOrder.vue'), meta: { title: '预付款单' } },
      { path: '/finance/other-payment', name: 'FinanceOtherPayment', component: () => import('@/views/finance/OtherPayment.vue'), meta: { title: '其他付款' } },
      { path: '/finance/transfer', name: 'FinanceTransfer', component: () => import('@/views/finance/CollectionReceipt.vue'), meta: { title: '收款单' } },
      { path: '/finance/gift', name: 'FinanceGift', component: () => import('@/views/finance/MonthlyReceiptOrder.vue'), meta: { title: '月结收款单' } },
      { path: '/finance/gift/add', name: 'MonthlyReceiptOrderAdd', component: () => import('@/views/finance/MonthlyReceiptOrderAdd.vue'), meta: { title: '新增月结收款单' } },
      { path: '/finance/precollection', name: 'FinancePrecollection', component: () => import('@/views/finance/PrecollectionOrder.vue'), meta: { title: '预收款单' } },
      { path: '/finance/precollection/add', name: 'PrecollectionOrderAdd', component: () => import('@/views/finance/PrecollectionOrderAdd.vue'), meta: { title: '新增预收款单' } },
      { path: '/finance/report/bank-balance', name: 'FinanceReportBankBalance', component: () => import('@/views/Placeholder.vue'), meta: { title: '银行余额表' } },
      { path: '/finance/report/bank-detail', name: 'FinanceReportBankDetail', component: () => import('@/views/Placeholder.vue'), meta: { title: '银行明细表' } },
      { path: '/finance/report/expense-detail', name: 'FinanceReportExpenseDetail', component: () => import('@/views/Placeholder.vue'), meta: { title: '费用明细表' } },
      // 主管监控
      { path: '/monitor/discount', name: 'MonitorDiscount', component: () => import('@/views/Placeholder.vue'), meta: { title: '开单折扣' } },
      { path: '/monitor/sales-daily', name: 'MonitorSalesDaily', component: () => import('@/views/Placeholder.vue'), meta: { title: '销售日报' } },
      { path: '/monitor/sales-performance', name: 'MonitorSalesPerformance', component: () => import('@/views/Placeholder.vue'), meta: { title: '销售业绩' } },
      { path: '/monitor/warehouse-workload', name: 'MonitorWarehouseWorkload', component: () => import('@/views/Placeholder.vue'), meta: { title: '库房工作量统计表' } },
      { path: '/monitor/cs-workload', name: 'MonitorCsWorkload', component: () => import('@/views/Placeholder.vue'), meta: { title: '客服工作量统计' } },
      { path: '/monitor/category-sales', name: 'MonitorCategorySales', component: () => import('@/views/Placeholder.vue'), meta: { title: '产品类别销售统计表' } },
      { path: '/monitor/customer-analysis', name: 'MonitorCustomerAnalysis', component: () => import('@/views/Placeholder.vue'), meta: { title: '客户销售分析' } },
      // 个人中心
      { path: '/profile', name: 'Profile', component: () => import('@/views/profile/Profile.vue'), meta: { title: '个人中心' } },
      { path: '/profile/change-password', name: 'ChangePassword', component: () => import('@/views/profile/ChangePassword.vue'), meta: { title: '修改密码' } },
      { path: '/profile/my-visit-task', name: 'MyVisitTask', component: () => import('@/views/profile/MyVisitTask.vue'), meta: { title: '负责拜访任务' } },
      // AI 助手
      { path: '/ai/chat', name: 'CozeChat', component: () => import('@/views/ai/CozeChat.vue'), meta: { title: 'AI 助手' } },
    ]
  },
  // PDF 图片审核工作台：独立全屏页面，不套 WMS 布局
  {
    path: '/ai/pdf_review',
    name: 'PdfReview',
    component: () => import('@/views/ai/pdf-review/index.vue'),
    meta: { title: 'PDF 图片审核' }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' }
  }
]

const router = createRouter({
  history: createWebHistory(routerHistoryBase),
  routes
})

/**
 * 子页面权限继承（通用祖先回退，见 menuPermissionMap.ts 同名注释）：
 * 从子页面 path 逐级去掉末段，命中第一个「已注册且通过页面级判定」的
 * 祖先列表页即按其权限放行；全部落空返回 false（fail-closed）。
 * 例：/warehouse/stock/detail → /warehouse/stock；/customer/finance/credit/:id → /customer/finance/credit
 */
function inheritedAllowed(path: string, permissionStore: PagePermissionView): boolean {
  const segs = path.split('/')
  for (let end = segs.length - 1; end >= 2; end--) {
    const ancestor = segs.slice(0, end).join('/')
    if (!ancestor || ancestor === path) continue
    const matched = router.resolve(ancestor)
    if (!matched.matched.length) continue // 未注册的中间路径，继续向上
    const title = matched.meta?.title as string | undefined
    if (isPageVisible(ancestor, title, permissionStore)) {
      return true
    }
  }
  return false
}

// 全局前置守卫：
//   1. 未登录 → 跳登录页
//   2. 已登录 → 首次导航前先加载可见权限（store 内部幂等去重），再做页面级权限校验
//      - 公共页（仪表盘/个人中心//common/add 等）豁免
//      - 业务页按「菜单名 === 页面标题」映射到后端菜单集合校验，fail-closed：
//        加载失败或映射不到 → 视为无权限，ElMessage 提示后落在仪表盘
router.beforeEach(async (to, _from, next) => {
const PUBLIC_PATHS = new Set(['/login', '/', '/trial', '/privacy'])

// 全局前置守卫：未登录可访问宣传页与登录页，其余路由需登录；已登录访问登录页跳转到仪表盘，但可以访问宣传页
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')
  if (!token) {
    if (PUBLIC_PATHS.has(to.path)) {
      next()
    } else {
      next('/login')
    }
    return
  }
  {
    // 已登录用户访问登录页时跳转到仪表盘，但允许访问宣传页
    if (to.path === '/login') {
      next('/dashboard')
      return
  }
  if (!token) {
    next()
    return
  }

  // 登录态：首次导航前确保权限已加载（后续导航直接读缓存集合，不再发请求）
  try {
    const { usePermissionStore } = await import('@/stores/permission')
    const permissionStore = usePermissionStore()
    await permissionStore.load()

    if (to.path === '/login' || isPublicPath(to.path)) {
      next()
      return
    }

    // 页面级权限匹配（两级，见 pagePermissionMap.ts 的 isPageVisible）：
    //   1. 模块菜单命中（路径级覆盖 → 标题映射 → 标题本身，命中任一）
    //   2. 页面「查询类」权限码命中任一（仅已登记映射的页面生效，未登记回退第 1 级）
    // 严格语义：只绑写权限（如仅 create_org）不足以进页面，避免进去列表 403。
    // 另：新增/编辑/详情子页面按祖先路径回退跟随所属列表页权限（inheritedAllowed）。
    // 全部落空 → 无权限（fail-closed）
    const allowed = isPageVisible(to.path, to.meta.title as string, permissionStore)
      || inheritedAllowed(to.path, permissionStore)

    if (!allowed) {
      ElMessage.warning('您暂无访问该页面的权限，如需开通请联系管理员')
      next('/dashboard')
      return
    }
    next()
  } catch {
    /* load() 内部已 fail-closed，不会 reject；此处仅兜底放行，避免守卫异常导致白屏 */
      next()
    }
  }
})

export default router
