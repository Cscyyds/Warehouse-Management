/**
 * 静态复现：模拟 PdfExportDialog 打开时的状态流转，
 * 检查「预览请求参数」与「最终勾选状态」是否始终一致。
 *
 * 这里直接复刻组件里的关键调用顺序（resetState → setupPreview → refreshPreview），
 * 不加载 Vue，只验证纯逻辑层面是否会拿到旧状态。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const cache = new Map()
const SRC = new URL('../', import.meta.url)

function loadTs(url) {
  const key = url.pathname
  if (cache.has(key)) return cache.get(key)
  const src = readFileSync(url, 'utf8')
  const code = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  cache.set(key, exports)
  const require = (spec) => {
    if (spec.startsWith('@/')) return loadTs(new URL(`${spec.slice(2)}.ts`, SRC))
    throw new Error(spec)
  }
  new Function('exports', 'require', code)(exports, require)
  return exports
}

const { PDF_CATALOGUES, defaultHiddenFields } = loadTs(new URL('config/pdfExportOptions.ts', SRC))
const { buildPdfExportSnapshot } = loadTs(new URL('utils/pdfExport.ts', SRC))
const { snapshotToPreviewRequest, isSamePreviewRequest } = loadTs(new URL('utils/pdfPreview.ts', SRC))

/** 模拟组件：用局部变量代表 ref */
function simulateOpen(kind, billId) {
  const catalogue = PDF_CATALOGUES[kind]
  let hideFields = []
  const captured = []

  // 组件里 setupPreview() 内部会立刻 refreshPreview(true)，即马上读一次当前状态
  const captureRequest = () => {
    const snap = buildPdfExportSnapshot({
      kind, billId, billNo: 'NO1',
      hideFields: [...hideFields], hideSections: [],
    })
    captured.push(snapshotToPreviewRequest(snap))
  }

  // ① 打开弹窗：先 resetState（写默认勾选），再 setupPreview（内部立即取参）
  hideFields = catalogue ? defaultHiddenFields(catalogue) : []
  captureRequest()

  // ② 勾选变化的 watch 再触发一次（可能重复）
  captureRequest()

  return { hideFields, captured, expected: defaultHiddenFields(catalogue) }
}

test('打开弹窗时首次预览请求必须已包含默认勾选', () => {
  for (const kind of ['purchase', 'sales', 'customerOrder']) {
    const { captured, expected } = simulateOpen(kind, 'bill_1')
    assert.ok(captured.length >= 1, `${kind} 应至少发出一次预览请求`)
    const first = new Set(captured[0].hideFields)
    for (const key of expected) {
      assert.ok(first.has(key), `${kind} 首次预览请求缺少默认勾选 ${key}（会看到不一致）`)
    }
  }
})

test('首次与随后请求参数一致，不会出现「预览跳变」', () => {
  for (const kind of ['purchase', 'sales', 'customerOrder']) {
    const { captured } = simulateOpen(kind, 'bill_1')
    for (let i = 1; i < captured.length; i++) {
      assert.ok(
        isSamePreviewRequest(captured[0], captured[i]),
        `${kind} 第 ${i + 1} 次请求与首次不一致，会造成预览内容跳变`,
      )
    }
  }
})

test('默认勾选后仍保留可见正文（后端不会 400）', () => {
  for (const kind of ['purchase', 'sales', 'customerOrder']) {
    const cat = PDF_CATALOGUES[kind]
    const hidden = new Set(defaultHiddenFields(cat))
    const visibleOrder = cat.orderFields.filter((f) => !hidden.has(f.key))
    const visibleItem = cat.itemFields.filter((f) => !hidden.has(f.key))
    assert.ok(visibleOrder.length > 0, `${kind} 主单正文全隐`)
    assert.ok(visibleItem.length > 0, `${kind} 明细列全隐`)
  }
})
