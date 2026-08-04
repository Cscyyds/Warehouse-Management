import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  agentNavigationPages,
  getAgentNavigationParentRouteName,
  resolveAgentNavigation,
} from './navigationCatalog.ts'
import { agentSemanticPages } from './semanticCatalog/index.ts'

test('resolves a sales order list by business name', () => {
  const result = resolveAgentNavigation('销售订单', 'list')
  assert.equal(result.ok, true)
  assert.equal(result.location.name, 'SalesOrder')
})

test('resolves a sales order create page to fixed safe query parameters', () => {
  const result = resolveAgentNavigation('销售开单', 'create')
  assert.equal(result.ok, true)
  assert.deepEqual(result.location, {
    name: 'AddTemplate',
    query: { type: 'salesOrder' },
  })
})

test('treats an unspecified open-order request as sales order creation', () => {
  const result = resolveAgentNavigation('开单', 'create')
  assert.equal(result.ok, true)
  assert.equal(result.page.id, 'sales.order')
})

test('rejects raw routes and unsupported arbitrary destinations', () => {
  const result = resolveAgentNavigation('/common/add?type=salesOrder', 'create')
  assert.deepEqual(result, { ok: false, reason: 'not_found', suggestions: [] })
})

test('reports ambiguous broad business names instead of guessing', () => {
  const result = resolveAgentNavigation('订单', 'list')
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'ambiguous')
})

test('rejects create mode when the page has no direct create route', () => {
  const result = resolveAgentNavigation('销售订单明细表', 'create')
  assert.deepEqual(result, {
    ok: false,
    reason: 'mode_not_supported',
    suggestions: ['销售订单明细表'],
  })
})

test('keeps navigation IDs unique', () => {
  const ids = agentNavigationPages.map((page) => page.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('provides explicit semantic metadata for every enabled WMS navigation page', () => {
  assert.equal(agentNavigationPages.length, 60)
  assert.deepEqual(
    agentNavigationPages.map((page) => page.id).sort(),
    Object.keys(agentSemanticPages).sort(),
  )

  for (const page of agentNavigationPages) {
    assert.ok(page.description.length >= 10, `${page.id} 缺少业务描述`)
    assert.ok(page.keywords.length >= 2, `${page.id} 缺少语义关键词`)
    assert.ok(page.intentExamples.length >= 2, `${page.id} 缺少用户表达示例`)
  }
})

test('includes the dashboard as a safe semantic navigation target', () => {
  const result = resolveAgentNavigation('工作台', 'list')
  assert.equal(result.ok, true)
  assert.equal(result.page.id, 'dashboard.overview')
  assert.equal(result.location.name, 'Dashboard')
})

test('references only named routes that exist in the Vue Router configuration', () => {
  const routerSource = readFileSync(new URL('../router/index.ts', import.meta.url), 'utf8')
  const routeNames = new Set(
    [...routerSource.matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1]),
  )
  const locations = agentNavigationPages.flatMap((page) =>
    page.create ? [page.list, page.create] : [page.list],
  )

  for (const location of locations) {
    assert.equal(routeNames.has(location.name), true, `未知路由名称: ${location.name}`)
    assert.deepEqual(Object.keys(location.query ?? {}).filter((key) => key !== 'type'), [])
  }
})

test('maps a shared create route back to its parent list route', () => {
  assert.equal(
    getAgentNavigationParentRouteName('AddTemplate', { type: 'salesOrder' }),
    'SalesOrder',
  )
})

test('maps a dedicated create route back to its parent list route', () => {
  assert.equal(
    getAgentNavigationParentRouteName('DeliveryTaskAdd', {}),
    'DeliveryTask',
  )
})
