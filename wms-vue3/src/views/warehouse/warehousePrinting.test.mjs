import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import ts from 'typescript'
import { ref } from 'vue'
import { prepareCloudPrintRequest, CloudPrintSelectionError } from '../../utils/cloudPrintRequest.ts'

function functionsFrom(file, names, imports) {
  const filename = new URL(file, import.meta.url).pathname
  const { descriptor } = parse(readFileSync(new URL(file, import.meta.url), 'utf8'), { filename })
  const source = ts.createSourceFile(filename, descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const nodes = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text))
  assert.equal(nodes.length, names.length)
  const code = ts.transpileModule(nodes.map(node => node.getText(source)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  return new Function(...Object.keys(imports), `${code}; return { ${names.join(',')} }`)(...Object.values(imports))
}

function locationHarness() {
  const warnings = []
  const state = {
    selectedLocations: ref([]), locationPrintRows: ref([]), locationPrintOpen: ref(false),
    ElMessage: { warning: message => warnings.push(message) },
  }
  const handlers = functionsFrom('WarehouseLocation.vue', ['isPrintableLocation', 'handleLocationSelectionChange', 'handlePrintLocations'], state)
  return { ...state, ...handlers, warnings }
}

const warehouse = { node_type: 'warehouse', warehouse_id: 'wh_1', id: 'wh_1' }
const parent = { node_type: 'location', location_id: 'loc_1', node_name: '货架一', location_no: 'A01' }
const child = { node_type: 'location', id: 'loc_2', location_name: '货架二', simple_code: 'A02' }

for (const file of ['WarehouseLocation.vue', 'WarehousePrintTask.vue']) {
  test(`${file} script and template compile`, () => {
    const { descriptor, errors } = parse(readFileSync(new URL(file, import.meta.url), 'utf8'), { filename: file })
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: file })
    const template = compileTemplate({ source: descriptor.template.content, filename: file, id: file,
      compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [])
  })
}

test('selection includes only explicit valid locations, not warehouses or implicit descendants', () => {
  const h = locationHarness()
  const row = { ...parent, children: [child] }
  h.handleLocationSelectionChange([warehouse, row, { node_type: 'location' }])
  assert.deepEqual(h.selectedLocations.value, [row])
  assert.equal(h.isPrintableLocation(warehouse), false)
  assert.equal(h.isPrintableLocation(child), true)
  const template = readFileSync(new URL('WarehouseLocation.vue', import.meta.url), 'utf8')
  assert.match(template, /checkStrictly: true/)
  assert.match(template, /:selectable="isPrintableLocation"/)
})

test('bulk print entry stays visible without a front-end queue permission code', () => {
  const source = readFileSync(new URL('WarehouseLocation.vue', import.meta.url), 'utf8')
  const handler = source.indexOf('@click="handlePrintLocations(selectedLocations)"')
  assert.notEqual(handler, -1, 'Missing location print toolbar button')
  const button = source.slice(source.lastIndexOf('<el-button', handler), source.indexOf('>', handler) + 1)
  assert.doesNotMatch(button, /v-perm\s*=/)
  assert.match(button, /:disabled="loading \|\| !selectedLocations.length"/)
})

test('single and multiple locations pass the correct IDs and labels to the shared print dialog', () => {
  const h = locationHarness()
  h.handlePrintLocations([parent])
  assert.equal(h.locationPrintOpen.value, true)
  assert.deepEqual(h.locationPrintRows.value, [{ id: 'loc_1', title: '货架一', subtitle: 'A01' }])
  h.handlePrintLocations([warehouse, parent, child])
  assert.deepEqual(h.locationPrintRows.value, [
    { id: 'loc_1', title: '货架一', subtitle: 'A01' },
    { id: 'loc_2', title: '货架二', subtitle: 'A02' },
  ])
})

test('empty selection cannot print; 100 locations are allowed and 101 are rejected without truncation', () => {
  const h = locationHarness()
  h.handlePrintLocations([warehouse])
  assert.equal(h.locationPrintOpen.value, false)
  const locations = Array.from({ length: 101 }, (_, i) => ({ ...parent, location_id: `loc_${i}` }))
  h.handlePrintLocations(locations)
  assert.equal(h.locationPrintOpen.value, false)
  assert.deepEqual(h.locationPrintRows.value, [])
  assert.match(h.warnings[0], /100/)
  h.handlePrintLocations(locations.slice(0, 100))
  assert.equal(h.locationPrintOpen.value, true)
  assert.equal(h.locationPrintRows.value.length, 100)
})

test('reloading locations clears checked rows before fetching replacement data', async () => {
  let clears = 0
  const state = {
    loading: ref(false), locationTableRef: ref({ clearSelection: () => { clears++ } }),
    selectedLocations: ref([parent]), selectedNodeId: ref(null), treeTableData: ref([]),
    pagination: { page: 1, pageSize: 20, total: 0 }, hasLocationSearchFilters: () => false,
    hasWarehouseSearchFilters: () => false, buildTreeRows: rows => rows,
    getWarehouseTree: async () => {
      assert.equal(state.selectedLocations.value.length, 0)
      return { data: { warehouse: [warehouse], total: 1 } }
    },
  }
  await functionsFrom('WarehouseLocation.vue', ['loadData'], state).loadData()
  assert.equal(clears, 1)
  assert.equal(state.loading.value, false)
  assert.equal(state.pagination.total, 1)
})

const task = (task_no, created_at) => ({ print_task_id: task_no, task_no, created_at })
const pendingRow = print_task_id => ({ print_task_id, task_no: print_task_id, status: 'PENDING' })

function listState(overrides = {}) {
  return {
    activeStatus: ref('PENDING'), bizTypeFilter: ref(''), loading: ref(false), tasks: ref([]),
    selection: ref([]), lastRefreshAt: ref(''), page: ref(1), pageSize: ref(20), total: ref(0),
    listRequestId: ref(0), searchKeyword: ref(''), searchInput: ref(''),
    ...overrides,
  }
}

for (const status of ['PENDING', 'PRINTED', 'CANCELED']) {
  test(`refresh queries ${status} tasks one page at a time and keeps the server order`, async () => {
    const input = [
      task('PT20260923099', '2026-09-23 23:59:59'),
      task('PT20260924002', '2026-09-24 10:00:00'),
      task('PT20260924010', '2026-09-24 10:00:00'),
      task('PT20260924003', '2026-09-24 11:00:00'),
    ]
    const originalOrder = input.map(item => item.task_no)
    const state = listState({
      activeStatus: ref(status), bizTypeFilter: ref('LOCATION'), page: ref(3), pageSize: ref(50),
      tasks: ref([task('PT20260922001', '2026-09-22 08:00:00')]), selection: ref([input[0]]),
      listPrintTasks: async query => {
        assert.deepEqual(query, { status, biz_type: 'LOCATION', keyword: undefined, page: 3, page_size: 50 })
        return { list: input, total: 120, page: 3, page_size: 50 }
      },
    })
    const { refresh } = functionsFrom('WarehousePrintTask.vue', ['refresh'], state)
    await refresh()
    assert.deepEqual(state.tasks.value.map(item => item.task_no), originalOrder)
    assert.deepEqual(input.map(item => item.task_no), originalOrder)
    assert.equal(state.total.value, 120)
    assert.equal(state.page.value, 3)
    assert.equal(state.pageSize.value, 50)
    assert.equal(state.selection.value.length, 0)
    assert.equal(state.loading.value, false)
    assert.match(state.lastRefreshAt.value, /^\d{2}:\d{2}:\d{2}$/)
  })
}

test('refresh asks for the first page with the page size the operator picked', async () => {
  const queried = []
  const state = listState({
    listPrintTasks: async query => {
      queried.push(query)
      return { list: [], total: 0, page: 1, page_size: 20 }
    },
  })
  await functionsFrom('WarehousePrintTask.vue', ['refresh'], state).refresh()
  assert.deepEqual(queried, [{ status: 'PENDING', biz_type: undefined, keyword: undefined, page: 1, page_size: 20 }])
})

test('changing the page size restarts from the first page', () => {
  const queried = []
  const state = listState({
    page: ref(3), pageSize: ref(50),
    refresh: async () => { queried.push('refresh') },
  })
  functionsFrom('WarehousePrintTask.vue', ['onSizeChange'], state).onSizeChange()
  assert.equal(state.page.value, 1)
  assert.deepEqual(queried, ['refresh'])
})

test('refresh follows the server when the subscription limit narrows the page size', async () => {
  const state = listState({
    pageSize: ref(100),
    listPrintTasks: async () => ({ list: [task('PT1', '2026-09-24 10:00:00')], total: 1, page: 1, page_size: 10 }),
  })
  await functionsFrom('WarehousePrintTask.vue', ['refresh'], state).refresh()
  assert.equal(state.pageSize.value, 10)
  assert.equal(state.total.value, 1)
})

test('empty task responses remain empty and do not leave the table loading', async () => {
  const state = listState({
    tasks: ref([task('old', '2026-09-23 10:00:00')]),
    listPrintTasks: async () => ({ list: [], total: 0, page: 1, page_size: 20 }),
  })
  await functionsFrom('WarehousePrintTask.vue', ['refresh'], state).refresh()
  assert.deepEqual(state.tasks.value, [])
  assert.equal(state.total.value, 0)
  assert.equal(state.loading.value, false)
})

test('a task confirmed as printed leaves the pending list without waiting for a refresh', async () => {
  const rows = [pendingRow('pt_1'), pendingRow('pt_2')]
  const confirmed = []
  const state = listState({
    tasks: ref([...rows]), total: ref(2), selection: ref([rows[0]]),
    markPrintTaskPrinted: async printTaskId => { confirmed.push(printTaskId) },
    ElMessage: { success: () => {}, warning: () => {} },
  })
  const { confirmPrinted } = functionsFrom('WarehousePrintTask.vue', ['dropTaskFromList', 'confirmPrinted'], state)
  await confirmPrinted(rows[0])
  assert.deepEqual(confirmed, ['pt_1'])
  assert.deepEqual(state.tasks.value.map(item => item.task_no), ['pt_2'])
  assert.equal(state.total.value, 1)
  assert.deepEqual(state.selection.value, [])
  assert.equal(rows[0].status, 'PRINTED')
})

test('printing the last task of a page steps back instead of leaving an empty page', () => {
  const rows = [pendingRow('pt_5')]
  const refreshes = []
  const state = listState({
    tasks: ref([...rows]), total: ref(41), page: ref(3),
    refresh: async () => { refreshes.push('refresh') },
  })
  functionsFrom('WarehousePrintTask.vue', ['dropTaskFromList'], state).dropTaskFromList(rows[0])
  assert.deepEqual(state.tasks.value, [])
  assert.equal(state.total.value, 40)
  assert.equal(state.page.value, 2)
  assert.equal(refreshes.length, 1)
})

test('history tabs keep their rows when a status is written back', async () => {
  const rows = [pendingRow('pt_9')]
  const state = listState({
    activeStatus: ref('PRINTED'), tasks: ref([...rows]), total: ref(1), page: ref(2),
    markPrintTaskPrinted: async () => {},
    ElMessage: { success: () => {}, warning: () => {} },
  })
  const { confirmPrinted } = functionsFrom('WarehousePrintTask.vue', ['dropTaskFromList', 'confirmPrinted'], state)
  await confirmPrinted(rows[0])
  assert.deepEqual(state.tasks.value.map(item => item.task_no), ['pt_9'])
  assert.equal(state.total.value, 1)
  assert.equal(state.page.value, 2)
})

test('the task table is paginated on the server, not sliced on the client', () => {
  const source = readFileSync(new URL('WarehousePrintTask.vue', import.meta.url), 'utf8')
  assert.match(source, /:data="initialLoading \? skeletonRows : tasks"/)
  assert.match(source, /<el-pagination/)
  assert.match(source, /v-model:current-page="page"/)
  assert.match(source, /v-model:page-size="pageSize"/)
  assert.match(source, /:total="total"/)
  assert.doesNotMatch(source, /tasks\.value\.slice/)
})

function batchState(overrides = {}) {
  const messages = []
  return {
    messages,
    state: {
      selection: ref([]), settingsReady: ref(true), batchPrinting: ref(false), batchProgress: ref(''),
      printingTaskId: ref(''), outputMode: ref('LOCAL'),
      ElMessageBox: { confirm: async () => {} },
      ElMessage: {
        success: m => messages.push(['success', m]),
        warning: m => messages.push(['warning', m]),
        error: m => messages.push(['error', m]),
      },
      ...overrides,
    },
  }
}

test('batch printing aborts the remaining tasks when the printer fails fast (stalled)', async () => {
  const attempted = []
  const { state, messages } = batchState({
    selection: ref([
      { print_task_id: 'p1', task_no: 'T1', status: 'PENDING', is_generative: false },
      { print_task_id: 'p2', task_no: 'T2', status: 'PENDING', is_generative: false },
      { print_task_id: 'p3', task_no: 'T3', status: 'PENDING', is_generative: false },
    ]),
    executePrintTask: async task => { attempted.push(task.task_no); return false },
    refresh: async () => {},
  })
  await functionsFrom('WarehousePrintTask.vue', ['batchPrint'], state).batchPrint()
  assert.deepEqual(attempted, ['T1'], '打印机判死后不应继续尝试后续任务')
  assert.match(messages.find(([kind]) => kind === 'error')?.[1] || '', /中止剩余 2 个/)
  assert.equal(state.batchProgress.value, '')
  assert.equal(state.batchPrinting.value, false)
})

test('batch printing reports a summary when every task prints fine', async () => {
  const attempted = []
  const { state, messages } = batchState({
    selection: ref([
      { print_task_id: 'p1', task_no: 'T1', status: 'PENDING', is_generative: false },
      { print_task_id: 'p2', task_no: 'T2', status: 'PENDING', is_generative: false },
    ]),
    executePrintTask: async task => { attempted.push(task.task_no); return true },
    refresh: async () => {},
  })
  await functionsFrom('WarehousePrintTask.vue', ['batchPrint'], state).batchPrint()
  assert.deepEqual(attempted, ['T1', 'T2'])
  assert.match(messages.find(([kind]) => kind === 'success')?.[1] || '', /批量打印完成：2 个任务/)
  assert.equal(state.batchProgress.value, '')
  assert.equal(state.batchPrinting.value, false)
})

test('search submits the trimmed keyword to the server and resets the page; clearing restores all tasks', async () => {
  const queries = []
  const state = listState({ page: ref(4), searchInput: ref('  银色  '),
    listPrintTasks: async query => { queries.push(query); return { list: [], total: 0, page: 1, page_size: 20 } },
  })
  const handlers = functionsFrom('WarehousePrintTask.vue', ['refresh', 'searchTasks'], state)
  handlers.searchTasks()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(queries[0].keyword, '银色')
  assert.equal(queries[0].page, 1)
  state.searchInput.value = ''
  handlers.searchTasks()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(queries[1].keyword, undefined)
})

test('a slower old search cannot replace the latest search results', async () => {
  const resolvers = []
  const state = listState({ listPrintTasks: () => new Promise(resolve => resolvers.push(resolve)) })
  const { refresh } = functionsFrom('WarehousePrintTask.vue', ['refresh'], state)
  const old = refresh()
  state.searchKeyword.value = 'new'
  const latest = refresh()
  resolvers[1]({ list: [task('new', '')], total: 1, page: 1, page_size: 20 })
  await latest
  resolvers[0]({ list: [task('old', '')], total: 8, page: 1, page_size: 20 })
  await old
  assert.equal(state.tasks.value[0].task_no, 'new')
  assert.equal(state.total.value, 1)
})

for (const status of ['PENDING', 'PRINTED']) {
  test(`${status} printing sends every label and only pending tasks write back status`, async () => {
    const sent = [], confirmed = [], messages = []
    const row = { ...pendingRow('pt1'), status, print_qty: 2 }
    const state = { printingTaskId: ref(''), outputMode: ref('LOCAL'), buildParams: () => ({}),
      fetchTaskPrintData: async () => [{ key: '0', result: {} }, { key: '1', result: {} }],
      printLabel: async label => { sent.push(label.key); return 'ok' },
      confirmPrinted: async task => { confirmed.push(task.print_task_id) },
      ElMessage: { success: m => messages.push(m), error: m => messages.push(m) },
    }
    const ok = await functionsFrom('WarehousePrintTask.vue', ['executePrintTask'], state).executePrintTask(row)
    assert.equal(ok, true)
    assert.deepEqual(sent, ['0', '1'])
    assert.deepEqual(confirmed, status === 'PENDING' ? ['pt1'] : [])
    assert.equal(row.status, status)
    assert.equal(state.printingTaskId.value, '')
  })
}

test('failed reprint retains printed status and never writes back', async () => {
  const row = { ...pendingRow('pt1'), status: 'PRINTED', print_qty: 1 }
  const state = { printingTaskId: ref(''), outputMode: ref('LOCAL'), buildParams: () => ({}),
    fetchTaskPrintData: async () => [{ result: {} }], printLabel: async () => 'fail',
    confirmPrinted: async () => assert.fail('Reprint must not write status'),
    ElMessage: { error: () => {} },
  }
  assert.equal(await functionsFrom('WarehousePrintTask.vue', ['executePrintTask'], state).executePrintTask(row), false)
  assert.equal(row.status, 'PRINTED')
  assert.equal(state.printingTaskId.value, '')
})

test('cloud acceptance keeps the request for status checks and completion clears it without local printing', async () => {
  const storage = new Map(), sent = [], messages = []
  let printed = false
  const row = { ...pendingRow('cloud1'), status: 'PENDING', print_qty: 2 }
  const state = {
    printingTaskId: ref(''), outputMode: ref('CLOUD'), cloudPrinterId: ref('cpr1'), cloudCodeStyle: ref('QRCODE'),
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    submitCloudPrint: async request => { sent.push(request); return { status: 'SUBMITTED' } },
    queryCloudJob: async () => ({ status: printed ? 'PRINTED' : 'SUBMITTED' }), cloudJobMessage: job => job.status,
    confirmPrinted: () => assert.fail('Cloud acceptance must not invoke local confirmation'),
    fetchTaskPrintData: () => assert.fail('Cloud must not fetch local SDK data'),
    ElMessage: { warning: text => messages.push(text), success: text => messages.push(text) },
  }
  state.prepareCloudPrintRequest = (key, selection, query) => prepareCloudPrintRequest(key, selection, query, state.localStorage)
  state.CloudPrintSelectionError = CloudPrintSelectionError
  const { executePrintTask } = functionsFrom('WarehousePrintTask.vue', ['executePrintTask'], state)
  assert.equal(await executePrintTask(row), true)
  assert.equal(storage.size, 1)
  assert.equal(row.status, 'PENDING')
  printed = true
  assert.equal(await executePrintTask(row), true)
  assert.equal(sent[0].request_id, sent[1].request_id)
  assert.equal(sent[1].cloud_printer_id, 'cpr1', '状态未确定前继续使用原设备和请求')
  assert.equal(storage.size, 0)
  assert.deepEqual(messages, ['SUBMITTED', 'PRINTED'])
})

test('uncertain cloud order keeps the original request and never confirms local completion', async () => {
  const storage = new Map()
  const state = {
    printingTaskId: ref(''), outputMode: ref('CLOUD'), cloudPrinterId: ref('cpr1'), cloudCodeStyle: ref('BARCODE'),
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    submitCloudPrint: async () => ({ status: 'UNKNOWN' }), cloudJobMessage: () => '核查云订单',
    queryCloudJob: () => assert.fail('Unknown order has no reliable order id'),
    confirmPrinted: () => assert.fail('Unknown order must not mark task printed'),
    ElMessage: { warning: () => {} },
  }
  state.prepareCloudPrintRequest = (key, selection, query) => prepareCloudPrintRequest(key, selection, query, state.localStorage)
  state.CloudPrintSelectionError = CloudPrintSelectionError
  const row = { ...pendingRow('cloud2'), status: 'PENDING' }
  assert.equal(await functionsFrom('WarehousePrintTask.vue', ['executePrintTask'], state).executePrintTask(row), false)
  assert.equal(storage.size, 1)
  assert.equal(row.status, 'PENDING')
})
