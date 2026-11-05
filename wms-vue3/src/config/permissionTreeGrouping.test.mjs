import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const loaded = new Map()
function loadConfig(path) {
  if (loaded.has(path)) return loaded.get(path)
  const exports = {}
  loaded.set(path, exports)
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  new Function('require', 'exports', output)(name => {
    assert.ok(name.startsWith('.'), `Unexpected dependency: ${name}`)
    return loadConfig(resolve(dirname(path), name + '.ts'))
  }, exports)
  return exports
}

const { groupRolePermissionTree, getRolePermissionModeHint } = loadConfig(resolve(here, 'permissionTreeGrouping.ts'))
const { PAGE_PERMS_BY_TITLE } = loadConfig(resolve(here, 'pagePermissionMap.ts'))
const pairedPages = ['采购订单', '采购退货单', '销售订单', '销售退货单']
const commonPages = ['供应商档案', '供应商类型', '客户资料', '采购入库单明细', '采购退货汇总表', '生产概览']
const titles = [...pairedPages, ...pairedPages.map(title => `${title}（天心）`), ...commonPages]
const codes = [...new Set(titles.flatMap(title => PAGE_PERMS_BY_TITLE[title].all))]
const source = [{ id: 'menu_source', label: '后端权限', type: 'menu', children: codes.map(id => ({ id, label: id, type: 'perm' })) }]
source[0].children.push({ id: 'perm_future_unmapped', label: '未归类权限', type: 'perm' })

function flatten(nodes) {
  return nodes.flatMap(node => [node, ...flatten(node.children || [])])
}

for (const mode of ['TIANXIN', 'NATIVE']) {
  test(`${mode} only shows matching document permissions without losing common permissions`, () => {
    const original = JSON.stringify(source)
    const tree = groupRolePermissionTree(source, mode)
    const nodes = flatten(tree)
    const ids = new Set(nodes.map(n => n.id))
    for (const title of pairedPages) {
      const shown = mode === 'TIANXIN' ? `${title}（天心）` : title
      const hidden = mode === 'TIANXIN' ? title : `${title}（天心）`
      assert.ok(ids.has(`page:${shown}`), shown)
      assert.ok(!ids.has(`page:${hidden}`), hidden)
      const binding = PAGE_PERMS_BY_TITLE[hidden]
      for (const code of binding.all.filter(code => !binding.deps?.includes(code))) {
        assert.ok(!ids.has(code), `Hidden permission must not reappear under other permissions: ${code}`)
      }
    }
    for (const title of commonPages) assert.ok(ids.has(`page:${title}`), title)
    assert.ok(ids.has('perm_future_unmapped'))
    assert.equal(ids.size, nodes.length, 'Duplicate node IDs')
    assert.equal(JSON.stringify(source), original, 'Filtering must not mutate input or bound IDs')
    assert.ok(nodes.every(node => !node.children || node.children.length > 0))
  })
}

test('mode unavailable preserves the server-visible tree instead of assuming WMS mode', () => {
  const ids = new Set(flatten(groupRolePermissionTree(source, null)).map(n => n.id))
  for (const title of titles) assert.ok(ids.has(`page:${title}`), title)
  assert.match(getRolePermissionModeHint(null), /未获取/)
})

test('filtering never invents permissions absent from visible-permissions', () => {
  const onlyWms = [{ id: 'perm_api_pur_list_order', label: '采购查询', type: 'perm' }]
  assert.deepEqual(groupRolePermissionTree(onlyWms, 'TIANXIN'), [])
  assert.deepEqual(groupRolePermissionTree([], 'NATIVE'), [])
})

test('mode hints explain the hidden counterpart and retained bindings', () => {
  assert.match(getRolePermissionModeHint('TIANXIN'), /当前为天心模式/)
  assert.match(getRolePermissionModeHint('TIANXIN'), /WMS/)
  assert.match(getRolePermissionModeHint('NATIVE'), /当前为 WMS 模式/)
  assert.match(getRolePermissionModeHint('NATIVE'), /天心/)
  for (const mode of ['TIANXIN', 'NATIVE']) assert.match(getRolePermissionModeHint(mode), /已绑定权限不会因隐藏而删除/)
})
