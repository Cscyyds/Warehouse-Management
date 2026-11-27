/**
 * 一次性核对：用真实 axios 验证三个 PDF 请求的最终 URL 形如重复标准键。
 * 只发起请求到本地假服务，断言 URL；不依赖后端。
 */
import axios from 'axios'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const moduleCache = new Map()
/** 项目根锚点：`@/` 始终映射到 src/，不随调用方所在目录变化 */
const SRC_ROOT = new URL('../src/', import.meta.url)

function loadTs(url) {
  const key = url.pathname
  if (moduleCache.has(key)) return moduleCache.get(key)
  const source = readFileSync(url, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  moduleCache.set(key, exports)
  const localRequire = (spec) => {
    if (spec.startsWith('@/')) return loadTs(new URL(`${spec.slice(2)}.ts`, SRC_ROOT))
    throw new Error(`未预期依赖：${spec}`)
  }
  new Function('exports', 'require', compiled)(exports, localRequire)
  return exports
}

const { repeatKeyParamsSerializer, buildPdfExportSnapshot } =
  loadTs(new URL('../src/utils/pdfExport.ts', import.meta.url))

const captured = []
const server = http.createServer((req, res) => {
  captured.push(req.url)
  res.writeHead(400, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ success: false, message: 'test' }))
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port

const client = axios.create({ baseURL: `http://127.0.0.1:${port}`, timeout: 5000 })

// 模拟 sales 列表行的真实调用：隐藏 2 字段 + 1 区域 + 隐藏单号
const snap = buildPdfExportSnapshot({
  kind: 'sales',
  billId: 'so_abc123',
  billNo: 'XS2026001',
  hideFields: ['document.order_no', 'order.receivable_amount', 'items.discount_price'],
  hideSections: ['notes'],
})

try {
  await client.get('/api/v1/tenant-sales-orders/print/pdf', {
    params: { sales_order_id: snap.billId, hide_fields: snap.hideFields, hide_sections: snap.hideSections },
    paramsSerializer: { indexes: null },
    responseType: 'blob',
    validateStatus: () => true,
  })
} catch { /* 忽略：只关心 URL */ }

server.close()

const url = captured[0] || ''
console.log('实际 URL:', url)
const checks = [
  ['含 sales_order_id', url.includes('sales_order_id=so_abc123')],
  ['hide_fields 为重复键', (url.match(/hide_fields=/g) || []).length === 3],
  ['hide_sections 为重复键', (url.match(/hide_sections=/g) || []).length === 1],
  ['无方括号', !url.includes('[') && !url.includes('%5B')],
  ['无逗号串', !url.includes('%2C')],
  ['单号隐藏文件名正确', snap.fileName === '销售订单.pdf'],
]
let ok = true
for (const [label, pass] of checks) {
  console.log(`  ${pass ? '✔' : '✖'} ${label}`)
  if (!pass) ok = false
}
console.log(ok ? '\n全部通过：后端将收到合法的重复标准键' : '\n存在不符项')
process.exit(ok ? 0 : 1)
