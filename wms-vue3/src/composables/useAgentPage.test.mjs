import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import * as Vue from 'vue'

const root = new URL('../', import.meta.url)

// 与 productionTabCache.test.mjs 同一套无 DOM 求值方式：TS 转 CJS 后注入依赖，
// 用 Vue 自定义渲染器挂载组件，真实跑 onMounted/watch 生命周期。
function evaluate(source, imports) {
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const exports = {}
  new Function('require', 'exports', output)((name) => {
    assert.ok(name in imports, `Unmocked dependency: ${name}`)
    return imports[name]
  }, exports)
  return exports
}

const typeStubs = {}
const modules = {
  vue: Vue,
  '@/agent/actionRegistry': evaluate(
    readFileSync(new URL('agent/actionRegistry.ts', root), 'utf8'),
    { './types': typeStubs },
  ),
  '@/agent/pageRegistry': evaluate(
    readFileSync(new URL('agent/pageRegistry.ts', root), 'utf8'),
    { './types': typeStubs },
  ),
}
const { useAgentPage } = evaluate(
  readFileSync(new URL('composables/useAgentPage.ts', root), 'utf8'),
  modules,
)
const { getCurrentAgentPage } = modules['@/agent/pageRegistry']
const { getRegisteredAgentActions } = modules['@/agent/actionRegistry']

function hostNode(type) {
  return { type, children: [], parent: null }
}

const renderer = Vue.createRenderer({
  createElement: hostNode,
  createText: (text) => ({ ...hostNode('text'), text }),
  createComment: hostNode,
  setText(node, text) { node.text = text },
  setElementText(node, text) { node.text = text },
  patchProp() {},
  parentNode: (node) => node.parent,
  nextSibling(node) {
    const children = node.parent?.children || []
    return children[children.indexOf(node) + 1] || null
  },
  insert(node, parent, anchor) {
    if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node)
    node.parent = parent
  },
  remove(node) {
    if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1)
    node.parent = null
  },
})

function mount(setup) {
  const app = renderer.createApp({ setup, render: () => null })
  app.mount(hostNode('root'))
  return app
}

function action(id) {
  return {
    id,
    title: id,
    description: id,
    inputSchema: { parse: (value) => value },
    inputGuide: '',
    risk: 'read',
    confirmation: 'none',
    execute: async () => ({}),
  }
}

test('registers a static page definition on mount and clears it on unmount', () => {
  const app = mount(() => {
    useAgentPage(
      { id: 'static.list', title: '静态页', routePath: '/static', description: '静态页面。' },
      [action('static.search')],
    )
    return () => null
  })
  assert.equal(getCurrentAgentPage()?.definition.id, 'static.list')
  assert.deepEqual(getRegisteredAgentActions().map((item) => item.id), ['static.search'])

  app.unmount()
  assert.equal(getCurrentAgentPage(), undefined)
  assert.deepEqual(getRegisteredAgentActions(), [])
})

test('re-registers when the reactive page identity and actions change', async () => {
  const pageId = Vue.ref('alpha.form')
  const app = mount(() => {
    useAgentPage(
      () => ({ id: pageId.value, title: '表单', routePath: '/common/add', description: '表单页。' }),
      // 动作 id 刻意保持不变：若旧动作未先注销，registerAgentActions 会因重复注册抛错
      () => [action('form.shared')],
    )
    return () => null
  })
  assert.equal(getCurrentAgentPage()?.definition.id, 'alpha.form')
  assert.deepEqual(getRegisteredAgentActions().map((item) => item.id), ['form.shared'])

  pageId.value = 'beta.form'
  await Vue.nextTick()
  assert.equal(getCurrentAgentPage()?.definition.id, 'beta.form')
  assert.deepEqual(getRegisteredAgentActions().map((item) => item.id), ['form.shared'])

  app.unmount()
  assert.equal(getCurrentAgentPage(), undefined)
  assert.deepEqual(getRegisteredAgentActions(), [])
})

test('registers later once the async page identity becomes available', async () => {
  const identity = Vue.ref(undefined)
  const app = mount(() => {
    useAgentPage(() => identity.value)
    return () => null
  })
  assert.equal(getCurrentAgentPage(), undefined)

  identity.value = { id: 'late.list', title: '迟到页', routePath: '/late', description: '迟到注册。' }
  await Vue.nextTick()
  assert.equal(getCurrentAgentPage()?.definition.id, 'late.list')

  identity.value = undefined
  await Vue.nextTick()
  assert.equal(getCurrentAgentPage(), undefined)

  app.unmount()
})
