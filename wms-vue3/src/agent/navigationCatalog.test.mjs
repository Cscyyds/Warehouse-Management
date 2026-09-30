import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
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

test('resolves a broad order wording to the top candidate with close alternatives', () => {
  // '订单' 三个页面并列 280 分（采购订单 / 销售订单 / 销售订单明细表）：
  // 不再拒绝导航，而是跳 top1 并附上同分候选供 LLM 提示用户二次确认。
  const result = resolveAgentNavigation('订单', 'list')
  assert.equal(result.ok, true)
  assert.equal(result.page.id, 'purchase.order')
  assert.deepEqual(
    result.alternatives.map((alternative) => alternative.id),
    ['sales.order', 'sales.report.order-detail'],
  )
})

test('resolves a semantic page id directly without scoring', () => {
  const result = resolveAgentNavigation('sales.order', 'list')
  assert.equal(result.ok, true)
  assert.equal(result.page.id, 'sales.order')
  assert.deepEqual(result.alternatives, [])
})

test('reports weak matches below the score threshold instead of guessing', () => {
  const result = resolveAgentNavigation('订单列表', 'list')
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'ambiguous')
  assert.ok(result.suggestions.length > 0)
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
  // 计数与 semanticCatalog 键集保持同步（下方深比较为权威校验；本数值仅防静默增删）
  assert.equal(agentNavigationPages.length, 64)
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

function collectRegisteredPageIds() {
  const registered = new Set()
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir)
      if (entry.isDirectory()) {
        walk(url)
        continue
      }
      if (!/\.(vue|ts)$/.test(entry.name)) continue
      const source = readFileSync(url, 'utf8')
      for (const match of source.matchAll(/\bid:\s*'([^']+\.list)'/g)) {
        registered.add(match[1])
      }
    }
  }
  walk(new URL('../views/', import.meta.url))
  return registered
}

test('keeps every catalog agentPageId backed by a real page registration', () => {
  // 目录 agentPageId 与 views 内 useAgentPage 的注册 id 是两套人工维护的字符串，
  // 错配时只会在运行时由 waitForAgentPage 的 2.5s 超时暴露（pageRegistry.ts:62）。
  const registered = collectRegisteredPageIds()
  const declared = agentNavigationPages
    .map((page) => page.agentPageId)
    .filter(Boolean)
  assert.ok(declared.length >= 15, 'agentPageId 声明数量骤减，请确认页面注册未被整体移除')
  for (const id of declared) {
    assert.ok(registered.has(id), `agentPageId 缺少页面注册：${id}`)
  }
})
