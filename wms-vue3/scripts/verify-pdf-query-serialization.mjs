/** 验证三类 PDF API 的实际参数经 axios 序列化后均为重复标准键。
 * 自定义传输适配器捕获 URL；无需启动服务，也不受代理和本机端口限制影响。
 */
import axios from 'axios'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const moduleCache = new Map()
const SRC_ROOT = new URL('../src/', import.meta.url)
const captured = []
const client = axios.create({
  baseURL: 'http://pdf-fixture.invalid',
  adapter: async config => {
    captured.push(client.getUri(config))
    return { data: new Blob(['%PDF-1.4\n']), status: 200, statusText: 'OK', headers: {}, config }
  },
})
function loadTs(url) {
  const key = url.pathname
  if (moduleCache.has(key)) return moduleCache.get(key)
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  moduleCache.set(key, exports)
  const localRequire = spec => {
    if (spec === '@/utils/request') return { get: (url, params, config) => client.get(url, { ...config, params }) }
    if (spec.startsWith('@/')) return loadTs(new URL(`${spec.slice(2)}.ts`, SRC_ROOT))
    throw new Error(`未预期依赖：${spec}`)
  }
  new Function('exports', 'require', compiled)(exports, localRequire)
  return exports
}
const { buildPdfExportSnapshot } = loadTs(new URL('../src/utils/pdfExport.ts', import.meta.url))
const cases = [
  ['sales', 'sales', 'printSalesOrderPdf', 'sales_order_id', 'tenant-sales-orders', '销售订单.pdf'],
  ['purchase', 'purchase', 'printPurchaseOrderPdf', 'purchase_order_id', 'tenant-purchase-orders', '采购明细单.pdf'],
  ['customerOrder', 'customerOrder', 'printCustomerOrderPdf', 'customer_order_id', 'tenant-customer-orders', '客户订货单.pdf'],
]
for (const [kind, module, method, idKey, endpoint, fileName] of cases) {
  const snap = buildPdfExportSnapshot({
    kind, billId: 'fixture-id', billNo: 'ORDER-1',
    hideFields: ['document.order_no', 'order.receivable_amount', 'items.discount_price'], hideSections: ['notes'],
  })
  const api = loadTs(new URL(`../src/api/modules/${module}.ts`, import.meta.url))
  await api[method](snap.billId, { hide_fields: snap.hideFields, hide_sections: snap.hideSections })
  const url = captured.at(-1)
  assert.ok(url.includes(`/${endpoint}/print/pdf?`), url)
  const query = new URL(url).searchParams
  assert.equal(query.get(idKey), snap.billId)
  assert.deepEqual(query.getAll('hide_fields'), snap.hideFields)
  assert.deepEqual(query.getAll('hide_sections'), snap.hideSections)
  assert.ok(!url.includes('[') && !url.includes('%5B') && !url.includes('%2C'), url)
  assert.equal(snap.fileName, fileName)
  console.log(`PASS: ${method} 重复标准键及隐藏单号文件名`)
}
