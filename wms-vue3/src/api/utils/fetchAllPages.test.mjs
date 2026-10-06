/**
 * fetchAllPages 单测：验证「按 total 翻页取全」在各种后端行为下的正确性。
 *
 * 关注点：
 *  1. 单页装得下 → 不发多余请求
 *  2. 超过单页 → 按 total 补拉并合并
 *  3. total 缺失/为 0 → 不多翻页（防静默丢数据的同时也防空转）
 *  4. 补拉页返回空 → 提前结束，不把空数组拼进结果
 *  5. total 异常膨胀 → 被 maxPages 防御住
 *  6. 默认 page_size 为 100（后端上限），不会踩静默回退
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

/** 直接转译并加载 .ts 源文件（该文件只有 type-only 的外部依赖，转译后无运行时 import） */
function loadTsModule(relativeUrl) {
  const filename = fileURLToPath(new URL(relativeUrl, import.meta.url))
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const module = { exports: {} }
  new Function('exports', 'require', 'module', '__filename', '__dirname', code)(
    module.exports, () => { throw new Error('unexpected runtime require') }, module, filename, filename.slice(0, filename.lastIndexOf('/'))
  )
  return module.exports
}

const { fetchAllPages } = loadTsModule('./fetchAllPages.ts')

/** 构造一个分页后端：nodes 为全量数据，按 page/page_size切片 */
function pagedBackend(nodes, { onRequest } = {}) {
  const calls = []
  return {
    calls,
    fetchPage: async ({ page, page_size }) => {
      calls.push({ page, page_size })
      onRequest?.({ page, page_size })
      const start = (page - 1) * page_size
      return {
        code: 200,
        message: 'ok',
        data: { total: nodes.length, items: nodes.slice(start, start + page_size) },
      }
    },
  }
}

const plain = {
  fetchPage: null,
  pick: data => data.items,
  assign: (data, items) => { data.items = items },
}

test('单页能装下时只请求一次，不发多余翻页请求', async () => {
  const nodes = Array.from({ length: 20 }, (_, i) => ({ id: i }))
  const backend = pagedBackend(nodes)
  const res = await fetchAllPages({ ...plain, fetchPage: backend.fetchPage })
  assert.equal(backend.calls.length, 1)
  assert.equal(res.data.items.length, 20)
  assert.deepEqual(res.data.items.map(n => n.id), nodes.map(n => n.id))
})

test('恰好等于单页上限时也不翻页', async () => {
  const nodes = Array.from({ length: 100 }, (_, i) => ({ id: i }))
  const backend = pagedBackend(nodes)
  const res = await fetchAllPages({ ...plain, fetchPage: backend.fetchPage })
  assert.equal(backend.calls.length, 1)
  assert.equal(res.data.items.length, 100)
})

test('超过单页上限时按 total 补拉剩余页并合并（顺序保持）', async () => {
  const nodes = Array.from({ length: 250 }, (_, i) => ({ id: i }))
  const backend = pagedBackend(nodes)
  const res = await fetchAllPages({ ...plain, fetchPage: backend.fetchPage })
  assert.deepEqual(backend.calls.map(c => c.page), [1, 2, 3])
  assert.equal(res.data.items.length, 250)
  assert.deepEqual(res.data.items.map(n => n.id), nodes.map(n => n.id))
  // 合并结果不能出现重复
  assert.equal(new Set(res.data.items.map(n => n.id)).size, 250)
})

test('真实场景：34 个省级行政区（超过后端默认 20）必须一次取全', async () => {
  const nodes = Array.from({ length: 34 }, (_, i) => ({ area_id: `a${i}` }))
  const backend = pagedBackend(nodes)
  const res = await fetchAllPages({ ...plain, fetchPage: backend.fetchPage })
  assert.equal(res.data.items.length, 34)
  assert.equal(backend.calls[0].page_size, 100)
})

test('默认 page_size 为 100，不会踩后端静默回退', async () => {
  const backend = pagedBackend([])
  await fetchAllPages({ ...plain, fetchPage: backend.fetchPage })
  assert.equal(backend.calls[0].page_size, 100)
})

test('total 缺失时按实际条数处理，不空转翻页', async () => {
  const calls = []
  const res = await fetchAllPages({
    ...plain,
    fetchPage: async ({ page }) => {
      calls.push(page)
      return { message: 'ok', data: { items: [{ id: 1 }, { id: 2 }] } }
    },
  })
  assert.deepEqual(calls, [1])
  assert.equal(res.data.items.length, 2)
})

test('total 为 0 时只请求第一页', async () => {
  const calls = []
  const res = await fetchAllPages({
    ...plain,
    fetchPage: async ({ page }) => {
      calls.push(page)
      return { message: 'ok', data: { total: 0, items: [] } }
    },
  })
  assert.deepEqual(calls, [1])
  assert.deepEqual(res.data.items, [])
})

test('补拉页返回空数组时停止累加，不把空页拼进结果（并行发请求，只在合并层截断）', async () => {
  const calls = []
  const res = await fetchAllPages({
    ...plain,
    fetchPage: async ({ page }) => {
      calls.push(page)
      return {
        message: 'ok',
        data: { total: 999, items: page === 1 ? [{ id: 1 }] : [] },
      }
    },
  })
  // total 声明 999 → 按页上限算出 10 页并并行发出（total 不可信时以 maxPages 兜底）
  assert.deepEqual(calls, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  // 但合并在第 2 页拿到空数组时就停止，结果里不会混入空页
  assert.equal(res.data.items.length, 1)
})

test('total 异常膨胀时被 maxPages 防御住，不会无限翻页', async () => {
  const calls = []
  await fetchAllPages({
    ...plain,
    maxPages: 3,
    fetchPage: async ({ page }) => {
      calls.push(page)
      return { message: 'ok', data: { total: 10_000_000, items: [{ id: page }] } }
    },
  })
  assert.deepEqual(calls, [1, 2, 3])
})

test('支持自定义 total 取值函数', async () => {
  const nodes = Array.from({ length: 150 }, (_, i) => ({ id: i }))
  const backend = {
    calls: [],
    fetchPage: async ({ page, page_size }) => {
      backend.calls.push(page)
      const start = (page - 1) * page_size
      return { message: 'ok', data: { count: nodes.length, rows: nodes.slice(start, start + page_size) } }
    },
  }
  const res = await fetchAllPages({
    fetchPage: backend.fetchPage,
    pick: data => data.rows,
    assign: (data, items) => { data.rows = items },
    total: data => data.count,
  })
  assert.deepEqual(backend.calls, [1, 2])
  assert.equal(res.data.rows.length, 150)
})

test('第一页的其它响应字段被原样保留（调用方取值路径无需改动）', async () => {
  const backend = pagedBackend([{ id: 1 }])
  const res = await fetchAllPages({
    fetchPage: async args => ({
      ...(await backend.fetchPage(args)),
      data: { ...(await backend.fetchPage(args)).data, page: 1, extra: 'kept' },
    }),
    pick: data => data.items,
    assign: (data, items) => { data.items = items },
  })
  assert.equal(res.data.extra, 'kept')
})

test('源码不使用裸 page_size 猜测，避免与后端上限脱节', () => {
  const source = readFileSync(new URL('../utils/fetchAllPages.ts', import.meta.url), 'utf8')
  assert.match(source, /FETCH_ALL_PAGE_SIZE = 100/)
})