import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { getPageAgentInstructions, setAgentTaskContext } from './instructions.ts'

test('uses the injected task context instead of the page URL for the semantic catalog', () => {
  setAgentTaskContext('昨天卖了什么货')
  const text = getPageAgentInstructions('http://localhost:5173/wms/sales/order')

  assert.ok(text.startsWith('页面导航必须优先使用 navigate_wms_page'))
  assert.ok(text.includes('与当前请求最相关的语义页面：'))
  // 语义详述必须进入 Prompt：修复前 URL 被当作查询词，这里只剩 id:title 概览
  assert.ok(text.includes('sales.report.order-detail｜销售订单明细表'))
  assert.ok(text.includes('不适用：'))
  // 候选之外保留全量索引，避免候选选偏时 LLM 无从纠偏
  assert.ok(text.includes('finance.transfer:收款单'))
})

test('ignores the URL argument page-agent passes to getPageInstructions', () => {
  setAgentTaskContext('昨天卖了什么货')
  const withSalesUrl = getPageAgentInstructions('http://localhost:5173/wms/sales/order')
  const withDashboardUrl = getPageAgentInstructions('http://localhost:5173/dashboard')
  const withoutUrl = getPageAgentInstructions()

  assert.equal(withSalesUrl, withDashboardUrl)
  assert.equal(withSalesUrl, withoutUrl)
})

test('falls back to the full page index when no task context is set', () => {
  setAgentTaskContext('')
  const text = getPageAgentInstructions('http://localhost:5173/wms/sales/order')

  assert.ok(!text.includes('与当前请求最相关的语义页面：'))
  assert.ok(!text.includes('｜'))
  assert.ok(text.includes('- 销售管理：sales.order:销售订单[可新增]'))
  assert.ok(text.includes('finance.transfer:收款单'))
  assert.ok(text.includes('page 只能取自下方清单中列出的页面 ID'))
})

test('agentRuntime injects the normalized task into the instructions context', () => {
  const source = readFileSync(new URL('./runtime/agentRuntime.ts', import.meta.url), 'utf8')

  assert.ok(
    source.includes(
      "import { getPageAgentInstructions, setAgentTaskContext } from '@/agent/instructions'",
    ),
  )
  assert.ok(source.includes('setAgentTaskContext(normalizedTask)'))
})
