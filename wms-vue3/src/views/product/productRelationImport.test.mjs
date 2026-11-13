import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'

const source = readFileSync(new URL('./ProductRelationImportDialog.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const output = ts.transpileModule(compileScript(descriptor, { id: 'relation-test' }).content, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const renderer = Vue.createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
const tick = async () => { await Promise.resolve(); await Vue.nextTick(); await Promise.resolve() }
async function mount(options = {}) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'); globalThis.localStorage = { getItem: () => 'test' }
  const submitted = [], exports = {}
  const imports = {
    vue: Vue, 'element-plus': { ElMessage: { success() {} }, ElMessageBox: { confirm: options.confirm ?? (async () => true) } },
    '@element-plus/icons-vue': { Document: {}, Download: {}, UploadFilled: {} },
    '@/api/modules/batchImport': { IMPORT_TASK_APIS: { 'product-supplier': { submit: '/submit', list: '/list', detail: '/detail' } }, importProductSuppliers: async file => { submitted.push(file); if (options.failSubmit) throw new Error('提交超时'); return { data: { import_task_id: 'task-1' } } }, importProductSalePrices: async file => { submitted.push(file); return { data: { import_task_id: 'task-2' } } } },
    '@/stores/permission': { usePermissionStore: () => ({ hasUrlPerm: url => options.canDetail !== false || !url.includes('detail') }) },
    '@/config/importTemplates': { IMPORT_TEMPLATES: { 'product-supplier': '' } },
    '@/utils/importTask': { importFileSize: () => '1 KB', importRequestError: e => e.message },
    '@/views/common/ImportTaskList.vue': {}, '@/views/common/ImportTaskDetail.vue': {},
  }
  new Function('require', 'exports', output)(name => { assert.ok(name in imports, name); return imports[name] }, exports)
  const component = exports.default; component.render = () => null
  const app = renderer.createApp(component, { modelValue: true, kind: 'product-supplier', allowed: true, checkAccess: options.checkAccess ?? (async () => true) })
  const vm = app.mount({}); await tick()
  return { state: vm.$.setupState, submitted, setKind: kind => { vm.$.props.kind = kind }, close: () => { app.unmount(); if (saved) Object.defineProperty(globalThis, 'localStorage', saved); else delete globalThis.localStorage } }
}
const file = name => new File(['xlsx-content'], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

test('选择文件后直接提交，等待一秒再打开当前任务详情', async () => {
  const h = await mount()
  try {
    const selected = file('rows.xlsx'); h.state.chooseFile({ raw: selected })
    let settled = false
    const pending = h.state.submit().then(() => { settled = true })
    for (let i = 0; i < 6 && !h.submitted.length; i++) await tick()
    assert.equal(h.submitted[0], selected)
    assert.equal(h.state.taskId, '')
    assert.equal(settled, false)
    await h.state.submit()
    assert.equal(h.submitted.length, 1)
    await pending
    assert.equal(h.state.taskId, 'task-1')
    assert.equal(h.state.file, null)
  } finally { h.close() }
})
test('任务详情复用现有组件，不再调用提交前预览接口', () => {
  assert.match(source, /<ImportTaskDetail/)
  assert.doesNotMatch(source, /previewProductRelations|runPreview|预览变更/)
})
test('没有任务详情权限时保留任务已受理提示，不误导为提交失败', async () => {
  const h = await mount({ canDetail: false })
  try {
    h.state.chooseFile({ raw: file('rows.xlsx') }); await h.state.submit()
    assert.equal(h.submitted.length, 1)
    assert.equal(h.state.taskId, '')
    assert.match(h.state.error, /任务已受理/)
    assert.equal(h.state.uncertain, false)
  } finally { h.close() }
})
test('正式提交超时不自动重复发送，并保留结果待核对状态', async () => {
  const h = await mount({ failSubmit: true })
  try {
    h.state.chooseFile({ raw: file('rows.xlsx') }); await h.state.submit(); await h.state.submit()
    assert.equal(h.submitted.length, 1); assert.equal(h.state.uncertain, true)
  } finally { h.close() }
})
test('提交前权限预判失败不误称正式任务已提交或结果未知', async () => {
  const h = await mount({ checkAccess: async () => { throw new Error('权限查询失败') } })
  try {
    h.state.chooseFile({ raw: file('rows.xlsx') }); await h.state.submit()
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
