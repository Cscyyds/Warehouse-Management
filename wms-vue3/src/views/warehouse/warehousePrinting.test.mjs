import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import ts from 'typescript'
import { ref } from 'vue'

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

for (const status of ['PENDING', 'PRINTED', 'CANCELED']) {
  test(`refresh sorts ${status} tasks newest first with numeric task numbers breaking ties`, async () => {
    const input = [
      task('PT20260924002', '2026-09-24 10:00:00'),
      task('PT20260924003', '2026-09-24 11:00:00'),
      task('PT20260924010', '2026-09-24 10:00:00'),
      task('PT20260923099', '2026-09-23 23:59:59'),
    ]
    const originalOrder = input.map(item => item.task_no)
    const state = {
      activeStatus: ref(status), bizTypeFilter: ref('LOCATION'), loading: ref(false),
      tasks: ref([]), selection: ref([input[0]]), lastRefreshAt: ref(''),
      listPrintTasks: async query => {
        assert.deepEqual(query, { status, biz_type: 'LOCATION', page: 1, page_size: 100 })
        return { list: input }
      },
    }
    const { refresh } = functionsFrom('WarehousePrintTask.vue', ['refresh'], state)
    await refresh()
    assert.deepEqual(state.tasks.value.map(item => item.task_no), ['PT20260924003', 'PT20260924010', 'PT20260924002', 'PT20260923099'])
    assert.deepEqual(input.map(item => item.task_no), originalOrder)
    assert.equal(state.selection.value.length, 0)
    assert.equal(state.loading.value, false)
    input.push(task('PT20260924011', '2026-09-24 12:00:00'))
    await refresh()
    assert.equal(state.tasks.value[0].task_no, 'PT20260924011')
  })
}

test('empty task responses remain empty and do not leave the table loading', async () => {
  const state = {
    activeStatus: ref('PENDING'), bizTypeFilter: ref(''), loading: ref(false),
    tasks: ref([task('old', '2026-09-23 10:00:00')]), selection: ref([]), lastRefreshAt: ref(''),
    listPrintTasks: async () => ({ list: [] }),
  }
  await functionsFrom('WarehousePrintTask.vue', ['refresh'], state).refresh()
  assert.deepEqual(state.tasks.value, [])
  assert.equal(state.loading.value, false)
})
