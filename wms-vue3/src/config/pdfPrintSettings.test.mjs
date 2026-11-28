import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'
import { computed, effectScope, nextTick, reactive, ref, watch } from 'vue'

const root = new URL('../', import.meta.url)
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file)
  const exports = {}
  cache.set(file, exports)
  const source = readFileSync(new URL(file, root), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('exports', 'require', js)(exports, specifier => {
    if (specifier.startsWith('@/')) return load(specifier.slice(2) + '.ts')
    throw new Error(specifier)
  })
  return exports
}
const catalogues = load('config/pdfExportOptions.ts')
const logic = load('utils/pdfPrintSettings.ts')
const snapshots = load('utils/pdfExport.ts')
const previews = load('utils/pdfPreview.ts')
const { PDF_CATALOGUES, defaultShownFields, alwaysShownKeys } = catalogues
const { resolvePdfPrintSetting, validatePdfShownFields, samePdfShownFields } = logic
const system = kind => ({ doc_kind: kind, shown_fields: null, revision: 0, catalogue_version: 1, source: 'system', updated_by_name: '', updated_at: null })
const company = (kind, fields, revision = 1) => ({ ...system(kind), source: 'company', shown_fields: fields, revision })
const minimal = kind => [...alwaysShownKeys(PDF_CATALOGUES[kind]), 'items.product_name']

test('三类单据未设置公司默认时严格沿用现有内置默认', () => {
  for (const kind of Object.keys(PDF_CATALOGUES)) {
    assert.deepEqual(resolvePdfPrintSetting(PDF_CATALOGUES[kind], system(kind)), defaultShownFields(PDF_CATALOGUES[kind]))
  }
})

test('公司默认按对应类型独立解析，读取结果不共享可修改的数组', () => {
  for (const kind of Object.keys(PDF_CATALOGUES)) {
    const setting = company(kind, minimal(kind))
    const shown = resolvePdfPrintSetting(PDF_CATALOGUES[kind], setting)
    assert.deepEqual(shown, minimal(kind))
    shown.push('items.qty')
    assert.equal(setting.shown_fields.includes('items.qty'), false)
  }
})

test('错误配置不能回退全部显示，禁止空正文、固定项缺失、未知字段和类型串用', () => {
  const catalogue = PDF_CATALOGUES.purchase
  for (const setting of [null, system('sales'), { ...system('purchase'), source: 'wrong' },
    { ...system('purchase'), catalogue_version: 2 }, company('purchase', []), company('purchase', null),
    company('purchase', alwaysShownKeys(catalogue)), company('purchase', ['items.qty']),
    company('purchase', [...minimal('purchase'), 'items.discount_price']),
    company('purchase', minimal('purchase'), -1)]) {
    assert.throws(() => resolvePdfPrintSetting(catalogue, setting))
  }
  assert.throws(() => validatePdfShownFields(catalogue, [...alwaysShownKeys(catalogue), 'items.length_text']))
})

test('勾选比较忽略顺序，恢复系统默认只生成独立草稿', () => {
  const saved = minimal('sales')
  const draft = defaultShownFields(PDF_CATALOGUES.sales)
  assert.equal(samePdfShownFields(saved, [...saved].reverse()), true)
  assert.equal(samePdfShownFields(saved, draft), false)
  assert.deepEqual(saved, minimal('sales'))
})

function component(file, dependencies, names) {
  const source = parse(readFileSync(new URL(file, root), 'utf8')).descriptor.scriptSetup.content
  const ast = ts.createSourceFile('component.ts', source, ts.ScriptTarget.Latest, true)
  const body = ast.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(ast)).join('\n')
  const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  return new Function(...Object.keys(dependencies), js + '\nreturn { ' + names.join(', ') + ' }')(...Object.values(dependencies))
}
function wrapper(fetch, storage = { getItem: () => 'session-a' }) {
  const scope = effectScope()
  const props = reactive({ modelValue: true, kind: 'purchase', billId: 'p1', billNo: 'PO1' })
  const state = scope.run(() => component('components/PdfExportDialog.vue', {
    ref, computed, watch, onBeforeUnmount: () => {}, onDeactivated: () => {}, defineProps: () => props, defineEmits: () => () => {}, defineExpose: () => {},
    getPdfCatalogue: catalogues.getPdfCatalogue, shownToHidden: catalogues.shownToHidden,
    getEffectivePdfPrintSetting: fetch, resolvePdfPrintSetting, validatePdfShownFields,
    buildPdfExportSnapshot: snapshots.buildPdfExportSnapshot,
    localStorage: storage, showErrorDialog: () => {},
  }, ['initialShownFields', 'defaultsLoading', 'defaultsError', 'ready']))
  return { ...state, props, stop: () => scope.stop() }
}

test('公司默认读取完成前不初始化编辑区或首次预览，失败后保持禁止下载', async () => {
  let resolve
  const state = wrapper(() => new Promise(done => { resolve = done }))
  assert.equal(state.initialShownFields.value, null)
  assert.equal(state.defaultsLoading.value, true)
  assert.equal(state.ready.value, false)
  resolve({ data: company('purchase', minimal('purchase')) })
  await nextTick(); await nextTick()
  assert.deepEqual(state.initialShownFields.value, minimal('purchase'))
  assert.equal(state.ready.value, true)
  state.stop()

  const failed = wrapper(async () => { throw new Error('读取失败') })
  await nextTick(); await nextTick()
  assert.equal(failed.initialShownFields.value, null)
  assert.equal(failed.ready.value, false)
  assert.equal(failed.defaultsError.value, '读取失败')
  failed.stop()
})

test('切换账号后迟到的公司默认配置不会进入预览', async () => {
  let token = 'session-a', resolve
  const state = wrapper(() => new Promise(done => { resolve = done }), { getItem: () => token })
  token = 'session-b'
  resolve({ data: company('purchase', minimal('purchase')) })
  await nextTick(); await nextTick()
  assert.equal(state.initialShownFields.value, null)
  assert.equal(state.ready.value, false)
  assert.match(state.defaultsError.value, /会话已变化/)
  state.stop()
})

test('关闭后迟到的默认配置不会初始化预览，再次打开读取新公司方案', async () => {
  let resolve
  let requests = 0
  const state = wrapper(() => { requests++; return new Promise(done => { resolve = done }) })
  state.props.modelValue = false
  await nextTick()
  resolve({ data: company('purchase', minimal('purchase')) })
  await nextTick(); await nextTick()
  assert.equal(state.initialShownFields.value, null)
  state.props.modelValue = true
  await nextTick()
  resolve({ data: company('purchase', defaultShownFields(PDF_CATALOGUES.purchase), 2) })
  await nextTick(); await nextTick()
  assert.equal(requests, 2)
  assert.deepEqual(state.initialShownFields.value, defaultShownFields(PDF_CATALOGUES.purchase))
  state.stop()
})

function editor(kind, configurationMode = false, dependencies = {}) {
  const scope = effectScope()
  const requests = []
  const fields = minimal(kind)
  const props = reactive({ modelValue: true, kind, billId: 'bill1', billNo: 'NO1', initialShownFields: fields,
    configurationMode, previewFetcher: async () => new Blob() })
  const state = scope.run(() => component('components/PdfExportEditor.vue', {
    ...catalogues, ...snapshots, ...previews,
    ref, computed, watch, onActivated: () => {}, onDeactivated: () => {}, onBeforeUnmount: () => {},
    defineProps: () => props, defineEmits: () => () => {}, defineExpose: () => {},
    createPdfPreviewController: () => ({ request: request => requests.push(request), dispose: () => {}, retry: () => {} }),
    ...dependencies,
  }, ['shownFields', 'toggleField', 'resetAll', 'convertPreviewUrl', 'teardownPreview']))
  return { ...state, props, requests, stop: () => scope.stop() }
}

test('共享编辑区三类首次预览直接使用公司字段，临时改勾不改写默认值', async () => {
  for (const kind of Object.keys(PDF_CATALOGUES)) {
    const state = editor(kind)
    assert.deepEqual(state.requests[0].hideFields, catalogues.shownToHidden(PDF_CATALOGUES[kind], minimal(kind)))
    state.toggleField('items.qty', true)
    await nextTick()
    assert.ok(state.shownFields.value.includes('items.qty'))
    assert.equal(state.props.initialShownFields.includes('items.qty'), false)
    state.resetAll()
    assert.deepEqual(state.shownFields.value, minimal(kind))
    state.stop()
  }
})

test('离开预览后异步完成的旧 PDF 转换被丢弃，不能覆盖新的单据', async () => {
  let resolve
  const state = editor('purchase', false, {
    fetchWithSafeErrors: () => new Promise(done => { resolve = done }),
    blobToPdfDataUrl: async () => 'data:application/pdf;base64,old',
  })
  const conversion = state.convertPreviewUrl('blob:old')
  state.teardownPreview()
  resolve({ blob: async () => new Blob() })
  assert.equal(await conversion, '')
  state.stop()
})

test('设置页更换预览单据不丢失未保存的勾选，打印弹窗换单仍按默认初始化', async () => {
  for (const mode of [true, false]) {
    const state = editor('purchase', mode)
    state.toggleField('items.qty', true)
    state.props.billId = 'bill2'
    await nextTick()
    assert.equal(state.shownFields.value.includes('items.qty'), mode)
    assert.equal(state.requests.at(-1).billId, 'bill2')
    state.stop()
  }
})

test('设置页与打印入口读取同一目录，菜单和权限登记包含独立管理入口', () => {
  const page = readFileSync(new URL('views/system/PdfPrintSettings.vue', root), 'utf8')
  const dialog = readFileSync(new URL('components/PdfExportDialog.vue', root), 'utf8')
  assert.match(page, /<PdfExportEditor/)
  assert.match(dialog, /<PdfExportEditor/)
  assert.match(page, /expected_revision: settings\[kind\]!.revision/)
  assert.match(readFileSync(new URL('layout/MainLayout.vue', root), 'utf8'), /\/system\/pdf-print-settings/)
  assert.match(readFileSync(new URL('config/menuPermissionMap.ts', root), 'utf8'), /'打印设置': 'menu_employee'/)
  assert.match(page, /onBeforeRouteLeave/)
})

function automaticSampleHarness(fetch, allowed = true) {
  const source = parse(readFileSync(new URL('views/system/PdfPrintSettings.vue', root), 'utf8')).descriptor.scriptSetup.content
  const ast = ts.createSourceFile('settings.ts', source, ts.ScriptTarget.Latest, true)
  const names = ['ensureDefaultSample', 'cancelSampleLoads']
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name.text)).map(node => node.getText(ast)).join('\n')
  const samples = {}, sampleLoads = {}, sampleErrors = {}
  let token = 'session-a'
  const dependencies = {
    samples, sampleLoads, sampleErrors, kinds: Object.keys(PDF_CATALOGUES),
    settings: Object.fromEntries(Object.keys(PDF_CATALOGUES).map(kind => [kind, system(kind)])),
    permission: { hasUrlPerm: () => allowed }, PDF_PRINT_ENDPOINTS: logic.PDF_PRINT_ENDPOINTS,
    listEndpoints: { purchase: 'purchase-list', sales: 'sales-list', customerOrder: 'customer-list' },
    getFirstPdfPreviewSample: fetch, localStorage: { getItem: () => token },
  }
  const js = ts.transpileModule('let sampleGeneration = 0;\n' + functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const actions = new Function(...Object.keys(dependencies), js + '\nreturn { ensureDefaultSample, cancelSampleLoads }')(...Object.values(dependencies))
  return { ...actions, samples, sampleLoads, sampleErrors, setToken: value => { token = value } }
}

test('打印设置自动选择每类第一张单据，已有手动选择时不重新替换', async () => {
  const calls = []
  const state = automaticSampleHarness(async kind => { calls.push(kind); return { id: kind + '-first', no: 'NO1', partyName: '示例' } })
  for (const kind of Object.keys(PDF_CATALOGUES)) {
    await state.ensureDefaultSample(kind)
    assert.equal(state.samples[kind].id, kind + '-first')
    await state.ensureDefaultSample(kind)
  }
  assert.deepEqual(calls, Object.keys(PDF_CATALOGUES))
})

test('第一张单据请求未完成时手动更换，不会被迟到的默认结果覆盖', async () => {
  let resolve
  const state = automaticSampleHarness(() => new Promise(done => { resolve = done }))
  const pending = state.ensureDefaultSample('purchase')
  state.samples.purchase = { id: 'manual', no: 'PO-MANUAL' }
  resolve({ id: 'first', no: 'PO-FIRST' })
  await pending
  assert.equal(state.samples.purchase.id, 'manual')
  assert.equal(state.sampleLoads.purchase, false)
})

test('无单据、无权限和读取失败不阻断字段设置，离开或切换账号会丢弃旧结果', async () => {
  const empty = automaticSampleHarness(async () => null)
  await empty.ensureDefaultSample('purchase')
  assert.equal(empty.samples.purchase, undefined)
  assert.equal(empty.sampleLoads.purchase, false)
  assert.equal(empty.sampleErrors.purchase, '')
  let requests = 0
  const forbidden = automaticSampleHarness(async () => { requests++; return null }, false)
  await forbidden.ensureDefaultSample('purchase')
  assert.equal(requests, 0)
  const failed = automaticSampleHarness(async () => { throw new Error('查询失败') })
  await failed.ensureDefaultSample('purchase')
  assert.match(failed.sampleErrors.purchase, /字段设置仍可保存/)
  for (const cancel of [state => state.cancelSampleLoads(), state => state.setToken('session-b')]) {
    let resolve
    const state = automaticSampleHarness(() => new Promise(done => { resolve = done }))
    const pending = state.ensureDefaultSample('sales')
    cancel(state)
    resolve({ id: 'stale', no: 'SO-OLD' })
    await pending
    assert.equal(state.samples.sales, undefined)
  }
})

test('自动示例请求第一页一条记录，并与手动选择器使用相同的三类字段映射', async () => {
  const source = readFileSync(new URL('api/modules/pdfPreviewSamples.ts', root), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}, requests = []
  function response(kind, params) {
    requests.push({ kind, params })
    return Promise.resolve({ data: {
      purchase_order: [{ purchase_order_id: 'p1', order_no: 'PO1', supplier_name: '供应商' }],
      sales_orders: [{ sales_order_id: 's1', sales_order_no: 'SO1', customer_name: '客户甲' }],
      customer_orders: [{ customer_order_id: 'c1', order_no: 'CO1', customer_name: '客户乙' }], total: 1,
    } })
  }
  new Function('exports', 'require', js)(exports, name => {
    if (name === './purchase') return { getPurchaseOrderList: params => response('purchase', params) }
    if (name === './sales') return { getSalesOrderListV2: params => response('sales', params) }
    if (name === './customerOrder') return { getCustomerOrderList: params => response('customerOrder', params) }
    if (name === '@/utils/data') return {}
    throw new Error(name)
  })
  for (const [kind, id, no] of [['purchase', 'p1', 'PO1'], ['sales', 's1', 'SO1'], ['customerOrder', 'c1', 'CO1']]) {
    const sample = await exports.getFirstPdfPreviewSample(kind)
    assert.equal(sample.id, id)
    assert.equal(sample.no, no)
  }
  for (const request of requests) assert.deepEqual(request.params, { page: 1, page_size: 1, sort_by: 'created_at', sort_order: 'DESC' })
})
