import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import * as paths from '../../utils/sensitiveFields.ts'
import * as selection from '../../utils/productSelection.ts'
import { z } from 'zod'
import { buildSearchParams } from '../../utils/data.ts'
import * as allPages from '../../api/utils/fetchAllPages.ts'

const transpile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const moduleFrom = (code, imports) => { const exports = {}; new Function('require', 'exports', code)(name => imports[name], exports); return exports }
const fieldsCode = transpile(readFileSync(new URL('../../composables/useSensitiveFields.ts', import.meta.url), 'utf8'))
const remote = moduleFrom(transpile(readFileSync(new URL('../../composables/useRemoteDialogPagination.ts', import.meta.url), 'utf8')), { vue: Vue })
const sort = moduleFrom(transpile(readFileSync(new URL('../../composables/useTableSort.ts', import.meta.url), 'utf8')), { vue: Vue })
const renderer = Vue.createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
const tick = async () => { for (let i = 0; i < 10; i++) { await Promise.resolve(); await Vue.nextTick() } }
const product = id => ({ product_id: id, product_name: `产品${id}`, factory_price: '5', min_sale_price: '12', available_stock: '100', unit_id: 'u' })

async function mount(file, options = {}) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'); globalThis.localStorage = { getItem: () => 'session' }
  const restrictions = new Map(Object.entries(options.restrictions ?? {})), calls = [], events = [], errors = []
  const store = Vue.reactive({ entries: new Map(), revision: 0, normalizePath: path => path, load: async path => { const state = { status: options.unknown ? 'unknown' : 'ready', fields: (restrictions.get(path) ?? []).map(item => typeof item === 'string' ? ({ io_type: 'OUTPUT', restriction_type: 1, param_name: item }) : item) }; store.entries.set(path, state); return state } })
  const fields = moduleFrom(fieldsCode, { vue: Vue, '@/stores/sensitiveField': { useSensitiveFieldStore: () => store }, '@/utils/sensitiveFields': paths })
  const count = options.count ?? 1
  const supplier = { supplier_id: 's1', supplier_name: '供应商', preset_purchase_price: '8', avg_cost_price: '7' }
  const supplierQuery = async (args, name) => { calls.push({ name, args }); return { data: { supplier: [{ supplier_id: 's1', supplier_name: '供应商', status: 1, balance: 0, credit_limit: '100', gift_amount: '5', prepayment_amount: '20', is_monthly_settlement: 1 }], total: 1 } } }
  const api = {
    getPurchaseOrderList: async args => { calls.push({ name: 'order-list', args }); return options.orders ? options.orders(args) : { data: { purchase_order: [{ purchase_order_id: 'po1', order_no: 'PO1', supplier_name: '供应商', order_amount: '0', payable_amount: '0', rounding_amount: '0', use_gift_amount: '10', use_prepayment_amount: '5' }], total: 1, page_size: 10 } } },
    searchPurchaseOrders: async args => { calls.push({ name: 'order-search', args }); return { data: { purchase_order: [{ purchase_order_id: 'po2', order_no: 'PO2', payable_amount: '0' }], total: 1 } } },
    printPurchaseOrderPdf: async id => { calls.push({ name: 'pdf', args: id }); return new Blob(['%PDF-1.4\n']) },
    getSupplierBalanceSummary: async args => { calls.push({ name: 'balance-query', args }); if (options.summaryFail) throw new Error('请求失败'); return { data: { total: 1, global_balance: 0, global_positive_balance: 10, global_negative_balance: -10, suppliers: [{ supplier_id: 's1', supplier_name: '供应商', balance: '0' }] } } },
    searchSupplierBalanceSummary: async args => { calls.push({ name: 'balance-search', args }); return { data: { total: 1, global_balance: 0, suppliers: [{ supplier_id: 's1', supplier_name: '供应商', balance: '0' }] } } },
    getSupplierBalanceLogs: async args => { calls.push({ name: 'balance-logs', args }); return options.logs ? options.logs(args) : { data: { supplier_id: args.supplier_id, current_balance: 0, total: 1, page_size: 10, daily_groups: [{ date: '2026-10-28', day_start_balance: 0, day_end_balance: 0, day_change_amount: 0, details: [{ biz_no: 'PO1', remark: '保留备注', amount: 0, before_amount: 0, after_amount: 0 }] }] } } },
    searchSupplierBalanceLogs: async args => { calls.push({ name: 'balance-log-search', args }); return { data: { supplier_id: args.supplier_id, total: 0, page_size: 10, daily_groups: [] } } },
    getSupplierList: args => supplierQuery(args, 'supplier-list'), searchSupplier: args => supplierQuery(args, 'supplier-search'),
    searchProduct: async args => { calls.push({ name: 'search', args }); return options.search ? options.search(args) : { data: { products: Array.from({ length: count }, (_, i) => product(`p${i}`)), total: count } } },
    queryProductSuppliersSearch: async (id, args) => { calls.push({ name: 'supplier', args }); return { data: { products: Array.from({ length: count }, (_, i) => ({ ...product(`p${i}`), preset_purchase_price: '8', avg_cost_price: '7' })), total: count } } },
    batchPreviewProducts: async () => ({ data: { normal_products: [{ ...product('p0'), suppliers: [supplier] }], combined_products: [{ ...product('combo'), is_combined: 1, suppliers: [supplier], components: [{ component_id: 'c', component_product_id: 'child', num: 2, unit_price: '999', suppliers: [supplier], components: [] }] }] } }),
  }
  const imports = { vue: Vue, zod: { z }, 'vue-router': { useRouter: () => ({ push() {} }) }, 'element-plus': { ElMessage: { warning: value => errors.push(value), error: value => errors.push(value), info() {} }, ElMessageBox: {} }, '@element-plus/icons-vue': {}, '@/api': api, '@/utils/data': { buildSearchParams }, '@/composables/useRemoteDialogPagination': remote, '@/composables/useSensitiveFields': fields, '@/utils/productSelection': selection,
    '@/api/utils/fetchAllPages': allPages, '@/composables/useTableSort': sort, '@/composables/useTableSkeleton': { useTableSkeleton: () => ({ initialLoading: Vue.ref(false), skeletonRows: Vue.ref([]) }) }, '@/composables/useAgentPage': { useAgentPage() {} }, '@/composables/useTradeModeGate': { useTradeModeGate: () => ({ isTianxinMode: Vue.ref(false) }), isPurchaseSceneWriteBlocked: () => false }, '@/stores/permission': { usePermissionStore: () => ({ hasUrlPerm: () => true }) }, '@/utils/download': { downloadPdf: options => options.request() }, '@/utils/date': { isTableDateField: () => false, formatTableDate: value => String(value) }, '@/config/importTemplates': { IMPORT_TEMPLATES: {} }, '@/utils/orderDateRange': {},
  }
  const script = compileScript(parse(readFileSync(new URL(file, import.meta.url), 'utf8')).descriptor, { id: file }).content
  const exports = {}; new Function('require', 'exports', transpile(script))(name => name.endsWith('.vue') ? {} : (assert.ok(name in imports, name), imports[name]), exports)
  exports.default.render = () => null
  const props = Vue.reactive({ modelValue: true, ...options.props })
  const parent = { render: () => Vue.h(exports.default, { ...props, onConfirm: value => events.push(value), onConfirmMultiple: value => events.push(value), 'onUpdate:modelValue': value => { props.modelValue = value } }) }
  const app = renderer.createApp(parent); app.config.warnHandler = () => {}; const vm = app.mount({}); await tick()
  return { s: vm.$.subTree.component.setupState, props, calls, events, errors, restrict: (path, list) => restrictions.set(path, list), close() { app.unmount(); if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage } }
}

test('产品选择首次挂载即查询，跨页旧选择在确认前重新剔除受限价格', async () => {
  const h = await mount('./ProductSelectDialog.vue', { props: { multiple: true } })
  try {
    assert.equal(h.calls.length, 1); h.s.onSelectionChange([product('old-page')])
    h.restrict('/tenant-products/search', ['products[].factory_price', 'products[].min_sale_price', 'products[].available_stock'])
    await h.s.handleConfirm()
    assert.equal(h.events[0][0].product_id, 'old-page')
    assert.equal(Object.hasOwn(h.events[0][0], 'factory_price'), false); assert.equal(Object.hasOwn(h.events[0][0], 'available_stock'), false)
  } finally { h.close() }
})

test('产品弹窗关闭重开后，上一查询迟到响应不能覆盖新列表', async () => {
  let resolveOld, number = 0
  const h = await mount('./ProductSelectDialog.vue', { search: async () => { number++; if (number === 2) return new Promise(resolve => { resolveOld = resolve }); return { data: { products: [product(number === 1 ? 'initial' : 'new')], total: 1 } } } })
  try {
    const pending = h.s.loadData(); await tick(); h.props.modelValue = false; await tick(); h.props.modelValue = true; await tick()
    resolveOld({ data: { products: [product('old')], total: 1 } }); await pending; await tick()
    assert.equal(h.s.rawList[0].product_id, 'new')
  } finally { h.close() }
})

test('无来源采购退货不从受限预设价转用均价或最低价，人工填写仍可确认，重开清掉旧输入', async () => {
  const h = await mount('./NoOrderProductSelectDialog.vue', { props: { scene: 'purchase', supplierId: 's1' }, restrictions: { '/tenant-products/suppliers/search': ['products[].preset_purchase_price'] } })
  try {
    h.s.onOpen(); await tick(); assert.equal(h.s.priceMap.p0, undefined)
    h.s.onSelectionChange(h.s.allRows); await h.s.handleConfirm(); assert.equal(h.events.length, 0)
    h.s.priceMap.p0 = 6; h.s.priceSources.p0 = 'manual'; await h.s.handleConfirm()
    assert.equal(h.events[0][0].return_price, 6)
    h.props.modelValue = true; await tick(); h.s.onOpen(); await tick(); assert.equal(h.s.priceMap.p0, undefined)
  } finally { h.close() }
})

test('供应商选品使用真实服务端分页，50条回查明确传page_size且不截成默认20条', async () => {
  const h = await mount('./NoOrderProductSelectDialog.vue', { props: { scene: 'purchase', supplierId: 's1' }, count: 50 })
  try {
    h.s.pageSize = 50; h.s.onOpen(); await tick()
    assert.equal(h.s.allRows.length, 50); assert.equal(h.s.total, 50)
    assert.equal(h.calls.find(call => call.name === 'supplier').args.page_size, 50)
    assert.equal(h.calls.find(call => call.name === 'search').args.page_size, 50)
    assert.equal(h.s.priceMap.p0, 8)
  } finally { h.close() }
})

test('组合展开所有层级隐藏供应商价格，缺价不算金额合计，确认只带产品身份和数量', async () => {
  const h = await mount('../purchase/CombinedProductExpandDialog.vue', { props: { productIds: ['combo'], plainProducts: [product('p0')], scene: 'purchase' }, restrictions: { '/tenant-products/components/batch-preview': ['combined_products[].suppliers[].preset_purchase_price'] } })
  try {
    assert.equal(h.s.showPresetPrice, false)
    const parent = h.s.treeRows.find(row => row.__isCombined); assert.equal(parent.children[0].__presetPrice, '')
    const row = h.s.treeRows.find(row => !row.__isCombined); h.s.selectedRows = [row]
    assert.equal(h.s.selectedSumPrice, ''); await h.s.handleConfirm()
    assert.equal(h.events[0][0].product_id, 'p0'); assert.equal(Object.hasOwn(h.events[0][0], 'purchase_price'), false)
    assert.equal(Object.hasOwn(h.events[0][0], '_preset_price'), false)
  } finally { h.close() }
})

test('组合选品补全分批覆盖超过100项，每批明确分页参数；空数量不能默认为1', async () => {
  const h = await mount('../purchase/CombinedProductExpandDialog.vue', { props: { productIds: ['combo'], plainProducts: [product('p0')], scene: 'purchase' }, search: async args => ({ data: { products: JSON.parse(args.product_ids).map(product) } }) })
  try {
    const rows = Array.from({ length: 150 }, (_, i) => ({ __productId: `p${i}` }))
    const result = await h.s.enrichSelected(rows)
    assert.equal(result.size, 150)
    const calls = h.calls.filter(call => call.name === 'search')
    assert.equal(calls.length, 2); assert.equal(calls[0].args.page_size, 100); assert.equal(JSON.parse(calls[1].args.product_ids).length, 50)
    const row = h.s.treeRows.find(row => !row.__isCombined); row.__qty = ''; h.s.selectedRows = [row]
    await h.s.handleConfirm(); assert.equal(h.events.length, 0)
    assert.match(h.errors.at(-1), /大于0/)
  } finally { h.close() }
})

test('供应商档案列表与导出使用同一字段过滤，零余额正常展示，查询路径与筛选一致', async () => {
  const h = await mount('../purchase/PurchaseGenericList.vue', { props: { type: 'supplier' } })
  try {
    assert.equal(h.s.formatMoney(0), '0.00')
    assert.ok(h.s.visibleSceneColumns.some(column => column.key === 'balance'))
    h.restrict('/tenant-suppliers/list', ['supplier[].balance', 'supplier[].credit_limit'])
    await h.s.loadData(); await tick()
    assert.equal(h.s.visibleSceneColumns.some(column => column.key === 'balance'), false)
    assert.equal(Object.hasOwn(h.s.safeExportData[0], 'balance'), false)
    assert.equal(Object.hasOwn(h.s.tableData[0], 'credit_limit'), false)
    h.s.searchForm.supplier_name = '供应商'; await h.s.loadData(); await tick()
    assert.equal(h.s.listInterface, '/tenant-suppliers/search'); assert.equal(h.calls.at(-1).name, 'supplier-search')
  } finally { h.close() }
})

test('采购订单按真实list/search路径隐藏金额及导出，受限金额排序先清除，实际分页同步', async () => {
  const h = await mount('../purchase/PurchaseGenericList.vue', { props: { type: 'order' } })
  try {
    assert.equal(h.s.listInterface, '/tenant-purchase-orders/list'); assert.equal(h.s.pagination.pageSize, 10)
    assert.equal(h.s.formatMoney(h.s.tableData[0].order_amount), '0.00')
    h.s.handleSortChange({ prop: 'payable_amount', order: 'ascending' }); await tick()
    h.restrict('/tenant-purchase-orders/list', ['purchase_order[].payable_amount', 'purchase_order[].order_amount', 'purchase_order[].use_gift_amount', 'purchase_order[].use_prepayment_amount'])
    await h.s.loadData(); await tick()
    assert.equal(h.calls.filter(call => call.name === 'order-list').at(-1).args.sort_by, undefined)
    assert.equal(h.s.visibleSceneColumns.some(column => column.key === 'order_amount'), false)
    assert.equal(Object.hasOwn(h.s.safeExportData[0], 'use_gift_amount'), false)
    assert.equal(Object.hasOwn(h.s.tableData[0], 'use_prepayment_amount'), false)
    h.s.searchForm.created_at = []; await h.s.loadData(); assert.equal(h.s.listInterface, '/tenant-purchase-orders/list')
    h.restrict('/tenant-purchase-orders/search', ['purchase_order[].payable_amount'])
    h.s.searchForm.order_no = 'PO2'; await h.s.loadData()
    assert.equal(h.s.listInterface, '/tenant-purchase-orders/search'); assert.equal(h.calls.at(-1).name, 'order-search')
    assert.deepEqual(JSON.parse(h.calls.at(-1).args.search_value), { order_no: 'PO2' })
    assert.equal(Object.hasOwn(h.s.tableData[0], 'payable_amount'), false)
  } finally { h.close() }
})

test('采购订单响应删除提示收紧列和导出，刷新不把上次金额合回新响应', async () => {
  const h = await mount('../purchase/PurchaseGenericList.vue', { props: { type: 'order' }, orders: async () => ({ data: { purchase_order: [{ purchase_order_id: 'po1', order_no: 'PO1', order_amount: '9' }], total: 1, restricted_sensitive_fields: [{ field_id: 'f1', field_label: '采购金额', param_names: ['purchase_order[].order_amount'] }] } }) })
  try {
    assert.equal(h.s.visibleSceneColumns.some(column => column.key === 'order_amount'), false)
    assert.equal(Object.hasOwn(h.s.tableData[0], 'order_amount'), false)
    assert.equal(Object.hasOwn(h.s.safeExportData[0], 'order_amount'), false)
  } finally { h.close() }
})

test('采购打印独立预判：type1显示阻断中文，type2允许下载且不由列表隐藏状态代替', async () => {
  const h = await mount('../purchase/PurchaseGenericList.vue', { props: { type: 'order' } })
  try {
    const pdfPath = '/tenant-purchase-orders/print/pdf'
    h.restrict(pdfPath, [{ io_type: 'OUTPUT', restriction_type: 1, param_name: 'pdf.order_amount', field_label: '采购订单金额' }])
    await h.s.handlePrintPdf(h.s.tableData[0]); assert.match(h.s.pdfBlockReason, /采购订单金额/)
    assert.equal(h.calls.some(call => call.name === 'pdf'), false); assert.equal(h.s.printingId, '')
    h.restrict(pdfPath, [{ io_type: 'OUTPUT', restriction_type: 2, param_name: 'pdf.order_amount', field_label: '采购订单金额' }])
    h.restrict('/tenant-purchase-orders/list', ['purchase_order[].order_amount']); await h.s.loadData()
    await h.s.handlePrintPdf(h.s.tableData[0]); assert.equal(h.calls.filter(call => call.name === 'pdf').length, 1)
    assert.equal(h.s.pdfBlockReason, ''); assert.equal(h.s.printingId, '')
  } finally { h.close() }
})

test('供应商弹窗默认走list，确认前剔除旧选择的受限金额，仍保留身份和月结属性', async () => {
  const h = await mount('../purchase/SupplierSelectDialog.vue')
  try {
    assert.equal(h.calls[0].name, 'supplier-list'); h.s.handleSelectionChange(h.s.list)
    h.restrict('/tenant-suppliers/list', ['supplier[].balance', 'supplier[].credit_limit', 'supplier[].prepayment_amount', 'supplier[].gift_amount'])
    await h.s.handleConfirm()
    assert.equal(h.events[0].supplier_id, 's1'); assert.equal(h.events[0].is_monthly_settlement, 1)
    assert.equal(Object.hasOwn(h.events[0], 'balance'), false); assert.equal(Object.hasOwn(h.events[0], 'gift_amount'), false)
  } finally { h.close() }
})

test('供应商预判未知时允许选择身份，不回传金额或信用额度', async () => {
  const h = await mount('../purchase/SupplierSelectDialog.vue', { unknown: true })
  try { h.s.handleSelectionChange(h.s.list); await h.s.handleConfirm(); assert.equal(h.events[0].supplier_id, 's1'); assert.equal(Object.hasOwn(h.events[0], 'credit_limit'), false) } finally { h.close() }
})

test('供应商余额全局卡片与列表金额分别受控，不把缺键与真实零混淆', async () => {
  const h = await mount('../purchase/SupplierBalance.vue', { restrictions: { '/tenant-suppliers/balance-summary/query': ['global_positive_balance', 'suppliers[].balance'] } })
  try {
    assert.equal(h.s.money(h.s.summary.global_balance), '0.00'); assert.equal(h.s.money(undefined), '-')
    assert.equal(h.s.visibleMetrics.some(metric => metric.key === 'global_positive_balance'), false)
    assert.equal(h.s.visibleColumns.some(column => column.key === 'balance'), false)
    assert.equal(Object.hasOwn(h.s.tableData[0], 'balance'), false)
    h.s.searchForm.supplier_name = '供应商'; await h.s.loadData()
    assert.equal(h.calls.at(-1).name, 'balance-search'); assert.deepEqual(JSON.parse(h.calls.at(-1).args.search_value), { supplier_name: '供应商' })
  } finally { h.close() }
})

test('供应商日流水保留日期和单号，独立删除期初与明细金额，使用真实按天分页', async () => {
  const h = await mount('../purchase/SupplierBalance.vue', { restrictions: { '/tenant-suppliers/balance-logs/detail-query': ['current_balance', 'daily_groups[].day_start_balance', 'daily_groups[].details[].amount', 'daily_groups[].details[].before_amount'] } })
  try {
    h.s.openLogs({ supplier_id: 's1', supplier_name: '供应商' }); await tick()
    assert.equal(h.s.logPagination.pageSize, 10); assert.equal(h.s.logPagination.total, 1)
    assert.equal(Object.hasOwn(h.s.logData, 'current_balance'), false)
    const day = h.s.logData.daily_groups[0]
    assert.equal(day.date, '2026-10-28'); assert.equal(Object.hasOwn(day, 'day_start_balance'), false)
    assert.deepEqual(day.details[0], { biz_no: 'PO1', remark: '保留备注', after_amount: 0 })
    h.s.logSearch.biz_no = 'PO1'; await h.s.loadLogs()
    assert.equal(h.calls.at(-1).name, 'balance-log-search'); assert.deepEqual(JSON.parse(h.calls.at(-1).args.search_value), { biz_no: 'PO1' })
    h.s.logDates = ['2026-10-01', '2026-10-28']; await h.s.loadLogs()
    assert.equal(JSON.parse(h.calls.at(-1).args.search_value).end_time, '2026-10-28T23:59:59.999999')
  } finally { h.close() }
})

test('快速切换供应商流水丢弃旧结果，关闭动画不清掉重新打开的流水', async () => {
  let release
  const old = new Promise(resolve => { release = resolve })
  const h = await mount('../purchase/SupplierBalance.vue', { logs: args => args.supplier_id === 's1' ? old : Promise.resolve({ data: { supplier_id: 's2', current_balance: 2, total: 0, daily_groups: [] } }) })
  try {
    h.s.openLogs({ supplier_id: 's1' }); await tick(); h.s.openLogs({ supplier_id: 's2' }); await tick()
    release({ data: { supplier_id: 's1', current_balance: 999, total: 0, daily_groups: [] } }); await tick()
    assert.equal(h.s.logData.supplier_id, 's2'); h.s.closeLogs(); assert.equal(h.s.logData.supplier_id, 's2')
  } finally { h.close() }
})

test('供应商余额接口失败不被Agent报告为查询成功且零结果', async () => {
  const h = await mount('../purchase/SupplierBalance.vue', { summaryFail: true })
  try { assert.equal(h.s.loadFailed, true); await assert.rejects(h.s.supplierBalanceSearchAction.execute({}, { signal: new AbortController().signal }), /查询失败/) } finally { h.close() }
})

test('服务端实际页大小缩为10时，选择弹窗按10计算后续页，不漏第21条以后记录', async () => {
  const h = await mount('./ProductSelectDialog.vue', { search: async args => ({ data: { total: 25, page_size: 10, products: Array.from({ length: Math.min(10, 25 - (args.page - 1) * 10) }, (_, i) => product(`p${(args.page - 1) * 10 + i}`)) } }) })
  try {
    assert.equal(h.s.pagination.pageSize, 10)
    h.s.pagination.page = 3; await h.s.loadData()
    assert.equal(h.s.rawList.length, 5); assert.equal(h.s.rawList[0].product_id, 'p20')
  } finally { h.close() }
})

test('组合选品补全遵循实际分页，100项在限为10条时也完整补齐', async () => {
  const h = await mount('../purchase/CombinedProductExpandDialog.vue', { props: { productIds: ['combo'], plainProducts: [product('p0')], scene: 'purchase' }, search: async args => {
    const ids = JSON.parse(args.product_ids)
    return { data: { products: ids.slice((args.page - 1) * 10, args.page * 10).map(product), total: ids.length, page_size: 10 } }
  } })
  try {
    const result = await h.s.enrichSelected(Array.from({ length: 100 }, (_, i) => ({ __productId: `p${i}` })))
    assert.equal(result.size, 100)
    const requests = h.calls.filter(call => call.name === 'search')
    assert.equal(requests.length, 10); assert.equal(requests[1].args.page_size, 10)
  } finally { h.close() }
})
