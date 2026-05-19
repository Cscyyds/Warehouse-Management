import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
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
      { path: '/system/msg-pending', name: 'MsgPending', component: () => import('@/views/monitor/MsgPending.vue'), meta: { title: '未完成消息' } },
      { path: '/system/msg-done', name: 'MsgDone', component: () => import('@/views/monitor/MsgDone.vue'), meta: { title: '已完成消息' } },
      { path: '/system/msg-template', name: 'MsgTemplate', component: () => import('@/views/monitor/MsgTemplate.vue'), meta: { title: '消息模板管理' } },
      // 客户管理
      { path: '/customer/type', name: 'CustomerType', component: () => import('@/views/Placeholder.vue'), meta: { title: '客户类型设定' } },
      { path: '/customer/region', name: 'CustomerRegion', component: () => import('@/views/Placeholder.vue'), meta: { title: '区域管理设定' } },
      { path: '/customer/info', name: 'CustomerInfo', component: () => import('@/views/Placeholder.vue'), meta: { title: '正式客户信息' } },
      { path: '/customer/public', name: 'CustomerPublic', component: () => import('@/views/Placeholder.vue'), meta: { title: '公海客户' } },
      { path: '/customer/new', name: 'CustomerNew', component: () => import('@/views/Placeholder.vue'), meta: { title: '新开拓客户' } },
      { path: '/customer/finance/credit', name: 'CustomerFinanceCredit', component: () => import('@/views/Placeholder.vue'), meta: { title: '客户授信余额表' } },
      { path: '/customer/finance/prepay', name: 'CustomerFinancePrepay', component: () => import('@/views/Placeholder.vue'), meta: { title: '预付款余额表' } },
      { path: '/customer/finance/gift', name: 'CustomerFinanceGift', component: () => import('@/views/Placeholder.vue'), meta: { title: '赠送金额余额表' } },
      { path: '/customer/finance/balance', name: 'CustomerFinanceBalance', component: () => import('@/views/Placeholder.vue'), meta: { title: '客户余额表' } },
      { path: '/customer/report/sales', name: 'CustomerReportSales', component: () => import('@/views/Placeholder.vue'), meta: { title: '客户月度销售表' } },
      { path: '/customer/task/visit', name: 'CustomerTaskVisit', component: () => import('@/views/Placeholder.vue'), meta: { title: '拜访任务单' } },
      // 产品管理
      { path: '/product/category', name: 'ProductCategory', component: () => import('@/views/Placeholder.vue'), meta: { title: '产品类别' } },
      { path: '/product/unit', name: 'ProductUnit', component: () => import('@/views/Placeholder.vue'), meta: { title: '计量单位' } },
      { path: '/product/info', name: 'ProductInfo', component: () => import('@/views/Placeholder.vue'), meta: { title: '产品资料' } },
      { path: '/product/track', name: 'ProductTrack', component: () => import('@/views/Placeholder.vue'), meta: { title: '产品跟踪' } },
      { path: '/product/unsold', name: 'ProductUnsold', component: () => import('@/views/Placeholder.vue'), meta: { title: '滞销产品' } },
      // 仓库管理
      { path: '/warehouse/location', name: 'WarehouseLocation', component: () => import('@/views/Placeholder.vue'), meta: { title: '库位管理' } },
      { path: '/warehouse/shelf', name: 'WarehouseShelf', component: () => import('@/views/Placeholder.vue'), meta: { title: '放货货位' } },
      { path: '/warehouse/plastic', name: 'WarehousePlastic', component: () => import('@/views/Placeholder.vue'), meta: { title: '塑料盒管理' } },
      { path: '/warehouse/shelf-bind', name: 'WarehouseShelfBind', component: () => import('@/views/Placeholder.vue'), meta: { title: '产品货架绑定' } },
      { path: '/warehouse/barcode-in', name: 'WarehouseBarcodeIn', component: () => import('@/views/Placeholder.vue'), meta: { title: '入库条码' } },
      { path: '/warehouse/barcode-out', name: 'WarehouseBarcodeOut', component: () => import('@/views/Placeholder.vue'), meta: { title: '出库条码' } },
      { path: '/warehouse/barcode-logistics', name: 'WarehouseBarcodeLogistics', component: () => import('@/views/Placeholder.vue'), meta: { title: '物流条码' } },
      { path: '/warehouse/stock', name: 'WarehouseStock', component: () => import('@/views/Placeholder.vue'), meta: { title: '库存查看' } },
      { path: '/warehouse/printer', name: 'WarehousePrinter', component: () => import('@/views/Placeholder.vue'), meta: { title: '打印机' } },
      { path: '/warehouse/stock-check', name: 'WarehouseStockCheck', component: () => import('@/views/Placeholder.vue'), meta: { title: '库存盘点' } },
      { path: '/warehouse/stock-location', name: 'WarehouseStockLocation', component: () => import('@/views/Placeholder.vue'), meta: { title: '库位库存表' } },
      // 采购管理
      { path: '/purchase/supplier-type', name: 'SupplierType', component: () => import('@/views/Placeholder.vue'), meta: { title: '供应商类型' } },
      { path: '/purchase/supplier', name: 'Supplier', component: () => import('@/views/Placeholder.vue'), meta: { title: '供应商档案' } },
      { path: '/purchase/order', name: 'PurchaseOrder', component: () => import('@/views/Placeholder.vue'), meta: { title: '采购订单' } },
      { path: '/purchase/inbound', name: 'PurchaseInbound', component: () => import('@/views/Placeholder.vue'), meta: { title: '采购入库单' } },
      { path: '/purchase/return', name: 'PurchaseReturn', component: () => import('@/views/Placeholder.vue'), meta: { title: '采购退货单' } },
      { path: '/purchase/report/sales-summary', name: 'PurchaseReportSalesSummary', component: () => import('@/views/Placeholder.vue'), meta: { title: '销量汇总表' } },
      { path: '/purchase/report/return-summary', name: 'PurchaseReportReturnSummary', component: () => import('@/views/Placeholder.vue'), meta: { title: '采购退货汇总表' } },
      { path: '/purchase/report/inbound-detail', name: 'PurchaseReportInboundDetail', component: () => import('@/views/Placeholder.vue'), meta: { title: '采购入库单明细' } },
      { path: '/purchase/report/supplier-balance', name: 'PurchaseReportSupplierBalance', component: () => import('@/views/Placeholder.vue'), meta: { title: '供应商余额表' } },
      { path: '/purchase/report/suggestion', name: 'PurchaseReportSuggestion', component: () => import('@/views/Placeholder.vue'), meta: { title: '采购建议表' } },
      // 销售管理
      { path: '/sales/customer-order', name: 'SalesCustomerOrder', component: () => import('@/views/Placeholder.vue'), meta: { title: '客户订货单' } },
      { path: '/sales/order', name: 'SalesOrder', component: () => import('@/views/Placeholder.vue'), meta: { title: '销售订单' } },
      { path: '/sales/return', name: 'SalesReturn', component: () => import('@/views/Placeholder.vue'), meta: { title: '销售退货单' } },
      { path: '/sales/after-sales', name: 'SalesAfterSales', component: () => import('@/views/Placeholder.vue'), meta: { title: '售后服务' } },
      { path: '/sales/reconciliation', name: 'SalesReconciliation', component: () => import('@/views/Placeholder.vue'), meta: { title: '对账单' } },
      { path: '/sales/report/product-summary', name: 'SalesReportProductSummary', component: () => import('@/views/Placeholder.vue'), meta: { title: '产品销售汇总表' } },
      { path: '/sales/report/customer-summary', name: 'SalesReportCustomerSummary', component: () => import('@/views/Placeholder.vue'), meta: { title: '客户销售汇总表' } },
      { path: '/sales/report/city-summary', name: 'SalesReportCitySummary', component: () => import('@/views/Placeholder.vue'), meta: { title: '城市销售汇总表' } },
      { path: '/sales/report/order-detail', name: 'SalesReportOrderDetail', component: () => import('@/views/Placeholder.vue'), meta: { title: '销售订单明细表' } },
      { path: '/sales/report/receipt-detail', name: 'SalesReportReceiptDetail', component: () => import('@/views/Placeholder.vue'), meta: { title: '订单收款明细表' } },
      { path: '/sales/report/undelivered', name: 'SalesReportUndelivered', component: () => import('@/views/Placeholder.vue'), meta: { title: '未发货明细表' } },
      { path: '/sales/report/frozen-stock', name: 'SalesReportFrozenStock', component: () => import('@/views/Placeholder.vue'), meta: { title: '冻结库存明细表' } },
      { path: '/sales/report/return-summary', name: 'SalesReportReturnSummary', component: () => import('@/views/Placeholder.vue'), meta: { title: '销售退货汇总表' } },
      { path: '/sales/report/customer-order-detail', name: 'SalesReportCustomerOrderDetail', component: () => import('@/views/Placeholder.vue'), meta: { title: '客户订货明细表' } },
      // 配送管理
      { path: '/delivery/task', name: 'DeliveryTask', component: () => import('@/views/Placeholder.vue'), meta: { title: '配送任务' } },
      { path: '/delivery/pickup', name: 'DeliveryPickup', component: () => import('@/views/Placeholder.vue'), meta: { title: '提货记录' } },
      { path: '/delivery/vehicle', name: 'DeliveryVehicle', component: () => import('@/views/Placeholder.vue'), meta: { title: '车辆管理' } },
      { path: '/delivery/company', name: 'DeliveryCompany', component: () => import('@/views/Placeholder.vue'), meta: { title: '物流公司' } },
      { path: '/delivery/vehicle-checkin', name: 'DeliveryVehicleCheckin', component: () => import('@/views/Placeholder.vue'), meta: { title: '车辆打卡' } },
      { path: '/delivery/vehicle-fuel', name: 'DeliveryVehicleFuel', component: () => import('@/views/Placeholder.vue'), meta: { title: '车辆加油' } },
      // 财务管理
      { path: '/finance/subject', name: 'FinanceSubject', component: () => import('@/views/Placeholder.vue'), meta: { title: '科目管理' } },
      { path: '/finance/bank-account', name: 'FinanceBankAccount', component: () => import('@/views/Placeholder.vue'), meta: { title: '银行账户' } },
      { path: '/finance/receipt', name: 'FinanceReceipt', component: () => import('@/views/Placeholder.vue'), meta: { title: '收款管理' } },
      { path: '/finance/payment', name: 'FinancePayment', component: () => import('@/views/Placeholder.vue'), meta: { title: '付款管理' } },
      { path: '/finance/transfer', name: 'FinanceTransfer', component: () => import('@/views/Placeholder.vue'), meta: { title: '银行转账' } },
      { path: '/finance/gift', name: 'FinanceGift', component: () => import('@/views/Placeholder.vue'), meta: { title: '赠送金额' } },
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
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
