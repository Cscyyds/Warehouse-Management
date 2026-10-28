import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import * as previews from '../../utils/productRelationPreview.ts'

const { descriptor } = parse(readFileSync(new URL('./ProductRelationImportDialog.vue', import.meta.url), 'utf8'))
const output = ts.transpileModule(compileScript(descriptor, { id: 'relation-test' }).content, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const renderer = Vue.createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
const row = { row_number: 2, product: { product_id: 'p', product_code: '001', product_name: '产品' }, before: { sale_price: '0' }, after: {}, changed_fields: [] }
const valid = () => ({ total_rows: 1, create_count: 0, update_count: 1, skipped_count: 0, create_list: [], update_list: [row] })
const tick = async () => { await Promise.resolve(); await Vue.nextTick(); await Promise.resolve() }
async function mount(options = {}) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'); globalThis.localStorage = { getItem: () => 'test' }
  const previewed = [], submitted = [], exports = {}
  const imports = {
    vue: Vue, 'element-plus': { ElMessage: { success() {} }, ElMessageBox: { confirm: options.confirm ?? (async () => true) } },
    '@/api/modules/productBatch': { previewProductRelations: async (kind, file) => { previewed.push(file); return { data: options.preview ?? valid() } } },
    '@/api/modules/batchImport': { IMPORT_TASK_APIS: { 'product-supplier': { submit: '/submit', list: '/list', detail: '/detail' } }, importProductSuppliers: async file => { submitted.push(file); if (options.failSubmit) throw new Error('提交超时'); return { data: { import_task_id: 'task-1' } } } },
    '@/stores/permission': { usePermissionStore: () => ({ hasUrlPerm: () => true }) },
    '@/config/importTemplates': { IMPORT_TEMPLATES: { 'product-supplier': '' } },
    '@/utils/productRelationPreview': previews,
    '@/utils/importTask': { importRequestError: e => e.message },
    '@/views/common/ImportTaskList.vue': {}, '@/views/common/ImportTaskDetail.vue': {},
  }
  new Function('require', 'exports', output)(name => { assert.ok(name in imports, name); return imports[name] }, exports)
  const component = exports.default; component.render = () => null
  const app = renderer.createApp(component, { modelValue: true, kind: 'product-supplier', allowed: true, checkAccess: options.checkAccess ?? (async () => true) })
  const vm = app.mount({}); await tick()
  return { state: vm.$.setupState, previewed, submitted, setKind: kind => { vm.$.props.kind = kind }, close: () => { app.unmount(); if (saved) Object.defineProperty(globalThis, 'localStorage', saved); else delete globalThis.localStorage } }
}
const file = name => new File(['xlsx-content'], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

test('正式执行使用同一File；更换文件必须清除原预览', async () => {
  const h = await mount()
  try {
    const first = file('first.xlsx'); h.state.chooseFile({ raw: first }); await h.state.runPreview()
    assert.equal(h.state.canExecute, true)
    h.state.chooseFile({ raw: file('second.xlsx') }); assert.equal(h.state.preview, null); assert.equal(h.state.canExecute, false)
    await h.state.runPreview(); await h.state.submit()
    assert.equal(h.submitted[0], h.previewed[1]); assert.equal(h.state.taskId, 'task-1')
  } finally { h.close() }
})
test('预览未通过或被裁剪时不会提交正式任务', async () => {
  for (const preview of [{ ...valid(), total_rows: 2, skipped_count: 1 }, { ...valid(), total_rows: 100, update_count: 100 }]) {
    const h = await mount({ preview })
    try { h.state.chooseFile({ raw: file('rows.xlsx') }); await h.state.runPreview(); await h.state.submit(); assert.equal(h.submitted.length, 0) } finally { h.close() }
  }
})
test('正式提交超时不自动重复发送，并保留结果待核对状态', async () => {
  const h = await mount({ failSubmit: true })
  try {
    h.state.chooseFile({ raw: file('rows.xlsx') }); await h.state.runPreview(); await h.state.submit(); await h.state.submit()
    assert.equal(h.submitted.length, 1); assert.equal(h.state.uncertain, true); assert.equal(h.state.canExecute, false)
  } finally { h.close() }
})
test('提交前权限预判失败不误称正式任务已提交或结果未知', async () => {
  let checks = 0
  const h = await mount({ checkAccess: async () => { if (++checks > 1) throw new Error('权限查询失败'); return true } })
  try {
    h.state.chooseFile({ raw: file('rows.xlsx') }); await h.state.runPreview(); await h.state.submit()
    assert.equal(h.submitted.length, 0); assert.equal(h.state.uncertain, false); assert.equal(h.state.error, '权限查询失败')
  } finally { h.close() }
})

test('核对未知提交结果时切换维护类型，不会清除另一类型的重复提交保护', async () => {
  let confirm, confirmations = 0
  const confirmation = new Promise(resolve => { confirm = resolve })
  const h = await mount({ confirm: () => { confirmations++; return confirmation } })
  try {
    h.state.uncertainTypes.add('product-supplier'); h.state.uncertainTypes.add('product-sale-price')
    const pending = h.state.acknowledge(); await tick()
    await h.state.acknowledge(); assert.equal(confirmations, 1)
    h.setKind('product-sale-price'); await tick(); confirm(true); await pending
    assert.equal(h.state.uncertainTypes.has('product-supplier'), true)
    assert.equal(h.state.uncertainTypes.has('product-sale-price'), true)
  } finally { confirm(true); h.close() }
})
