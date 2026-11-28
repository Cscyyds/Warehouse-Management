import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeAgentDisplayText } from './agentOutputSanitizer.ts'

test('hides absolute WMS page URLs from assistant output', () => {
  const input = '当前页面为销售订单列表（http://localhost:3000/wms/sales/order），操作已完成。'
  const output = sanitizeAgentDisplayText(input)

  assert.equal(output.includes('localhost'), false)
  assert.equal(output.includes('/wms/sales/order'), false)
  assert.equal(output, '当前页面为销售订单列表（当前页面），操作已完成。')
})

test('hides bare internal routes and API paths', () => {
  const output = sanitizeAgentDisplayText('页面 /wms/sales/order，接口 /api/v1/sales/order/list')

  assert.equal(output, '页面 当前页面，接口 内部地址')
})

test('does not alter normal assistant text', () => {
  const input = '已成功定位到销售订单页面。当前共有 0 条数据。'

  assert.equal(sanitizeAgentDisplayText(input), input)
})
