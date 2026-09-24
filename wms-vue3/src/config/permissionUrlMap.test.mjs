/**
 * 一致性守卫：确保所有 .vue 中书写的 v-perm URL 都在权限字典里。
 *
 * URL 未登记时 v-perm 会 fail-open（不隐藏），拼错的 URL 不会报错、只会静默放行，
 * 因此这层断言是全量铺开后唯一能兜住拼写错误的手段。
 *
 * 运行：npm run test:perm-url-map
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const VIEWS_DIR = resolve(HERE, '../views')
const GENERATED_FILE = resolve(HERE, 'permissionUrlMap.generated.ts')
const OVERRIDES_FILE = resolve(HERE, 'permissionUrlMap.ts')

/** 直接正则抽取字典 key，避免测试依赖 TS 加载器 */
function readEndpointKeys(filePath, sectionMarker) {
  const text = readFileSync(filePath, 'utf8')
  const start = sectionMarker ? text.indexOf(sectionMarker) : 0
  const section = start >= 0 ? text.slice(start) : text
  const keys = new Set()
  for (const matched of section.matchAll(/^\s{2}'([A-Z]+ \/[^']*)':/gm)) keys.add(matched[1])
  return keys
}

function collectVueFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectVueFiles(full))
    else if (entry.endsWith('.vue')) out.push(full)
  }
  return out
}

/** 提取 v-perm="'...'" 中的字面量，跳过绑定表达式（如 v-perm="scene.endpoint"） */
function collectPermLiterals(filePath) {
  const text = readFileSync(filePath, 'utf8')
  const out = []
  for (const matched of text.matchAll(/v-perm="'([^']+)'"/g)) out.push(matched[1])
  return out
}

const registered = new Set([
  ...readEndpointKeys(GENERATED_FILE, 'API_PERM_BY_ENDPOINT'),
  ...readEndpointKeys(OVERRIDES_FILE, 'ENDPOINT_PERM_OVERRIDES'),
])
const registeredPaths = new Set([...registered].map(key => key.split(' ')[1]))

test('生成字典非空且区分同路径不同方法', () => {
  assert.ok(registered.size > 100, `字典条目过少：${registered.size}`)
  assert.ok(registered.has('GET /api/v1/tenant-visit-tasks'))
  assert.ok(registered.has('POST /api/v1/tenant-visit-tasks'))
})

test('已废弃的 tenant-printers 权限不在字典中', () => {
  const stale = [...registered].filter(key => key.includes('/api/v1/tenant-printers'))
  assert.deepEqual(stale, [])
})

// 与后端待执行结构变更_20260915.sql:1417-1446 的逐接口权限保持一致。
const importTaskPermissionPrefixes = {
  employee: 'perm_api_emp_import_task',
  product: 'perm_api_prod_import_task',
  customer: 'perm_api_crm_import_task',
  supplier: 'perm_api_pur_supplier_task',
  'sales-order': 'perm_api_sales_import_task',
  'purchase-order': 'perm_api_pur_import_task',
}
const overrideSection = readFileSync(OVERRIDES_FILE, 'utf8')
  .split('export const ENDPOINT_PERM_OVERRIDES:')[1]?.split('\n}')[0] ?? ''
const overrideCodes = new Map(
  [...overrideSection.matchAll(/^\s{2}'([A-Z]+ \/[^']*)':\s*\[([^\]]*)\]/gm)]
    .map(([, endpoint, codes]) => [endpoint, [...codes.matchAll(/'([^']+)'/g)].map(match => match[1])]),
)

for (const [type, prefix] of Object.entries(importTaskPermissionPrefixes)) {
  for (const action of ['list', 'detail']) {
    const endpoint = `GET /api/v1/import-tasks/${type}/${action}`
    test(`${endpoint} 仅使用专属查询权限，不复用 POST 上传权限`, () => {
      assert.ok(registered.has(endpoint), `${endpoint} 必须登记，不能 fail-open`)
      assert.deepEqual(overrideCodes.get(endpoint), [`${prefix}_${action}`])
    })
  }
}

const pdfPermissions = {
  'tenant-purchase-orders': 'perm_api_pur_print_order_pdf',
  'tenant-sales-orders': 'perm_api_sales_print_order_pdf',
  'tenant-customer-orders': 'perm_api_customer_order_print_pdf',
}
const generatedCodes = new Map(
  [...readFileSync(GENERATED_FILE, 'utf8').split('export const API_META_BY_ENDPOINT')[0]
    .matchAll(/^\s{2}'([A-Z]+ \/[^']*)':\s*\[([^\]]*)\]/gm)]
    .map(([, endpoint, codes]) => [endpoint, [...codes.matchAll(/'([^']+)'/g)].map(match => match[1])]),
)
for (const [resource, code] of Object.entries(pdfPermissions)) {
  test(`${resource} PDF 下载使用已登记且可从角色树分配的权限`, () => {
    const endpoint = `GET /api/v1/${resource}/print/pdf`
    assert.deepEqual(overrideCodes.get(endpoint) || generatedCodes.get(endpoint), [code])
    assert.ok(readFileSync(resolve(HERE, 'pagePermissionMap.ts'), 'utf8').includes(`'${code}'`))
  })
}

test('天心四类单据的24个权限均有中文映射，且权限码仍对应原端点', () => {
  const labelsSection = readFileSync(OVERRIDES_FILE, 'utf8')
    .split('export const PERM_CN_NAME_OVERRIDES:')[1]?.split('\n}')[0] ?? ''
  const labels = new Map([...labelsSection.matchAll(/'([^']+)':\s*'([^']+)'/g)]
    .map(([, code, label]) => [code, label]))
  const docs = [
    ['purchase-order', 'pur_trade_po', '采购订单'],
    ['purchase-return', 'pur_trade_pr', '采购退货单'],
    ['sales-order', 'sales_trade_so', '销售订单'],
    ['sales-return', 'sales_trade_sr', '销售退货单'],
  ]
  const actions = [
    ['list', 'GET', 'list', '查看', '列表'],
    ['search', 'GET', 'search', '搜索', ''],
    ['detail', 'GET', 'detail', '查看', '详情'],
    ['items_list', 'GET', 'items/list', '查看', '明细列表'],
    ['items_search', 'GET', 'items/search', '搜索', '明细'],
    ['sync_refresh', 'POST', 'sync/refresh', '手动同步', ''],
  ]
  for (const [doc, prefix, title] of docs) {
    for (const [suffix, method, path, action, object] of actions) {
      const code = `perm_api_${prefix}_${suffix}`
      assert.equal(labels.get(code), `${action}${title}${object}（天心）`, code)
      assert.deepEqual(overrideCodes.get(`${method} /api/v1/tenant-trade/${doc}/${path}`), [code])
    }
  }
})

test('所有 .vue 中的 v-perm URL 均已登记', () => {
  const unregistered = []
  for (const file of collectVueFiles(VIEWS_DIR)) {
    for (const literal of collectPermLiterals(file)) {
      const isEndpoint = literal.startsWith('/') || /^[A-Za-z]+\s+\//.test(literal)
      if (!isEndpoint) continue // 旧关键词模式，由 hasButtonPerm 处理
      const [maybeMethod, maybePath] = literal.split(/\s+/)
      const hit = maybePath
        ? registered.has(`${maybeMethod.toUpperCase()} ${maybePath}`)
        : registeredPaths.has(literal)
      if (!hit) unregistered.push(`${file}: ${literal}`)
    }
  }
  assert.deepEqual(unregistered, [], `以下 v-perm URL 未在权限字典中登记：\n${unregistered.join('\n')}`)
})
