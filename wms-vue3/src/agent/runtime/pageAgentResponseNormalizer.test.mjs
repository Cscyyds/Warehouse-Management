import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePageAgentModelResponse } from './pageAgentResponseNormalizer.ts'

test('wraps a direct DeepSeek action tool call in PageAgent AgentOutput', async () => {
  const response = new Response(JSON.stringify({
    id: 'test-completion',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: '',
        tool_calls: [{
          index: 0,
          id: 'call-test',
          type: 'function',
          function: {
            name: 'execute_wms_action',
            arguments: JSON.stringify({
              actionId: 'navigate_wms_page',
              args: { page: '销售订单', mode: 'create' },
            }),
          },
        }],
      },
      finish_reason: 'tool_calls',
    }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  const normalized = await normalizePageAgentModelResponse(response)
  const payload = await normalized.json()
  const toolCall = payload.choices[0].message.tool_calls[0]

  assert.equal(toolCall.function.name, 'AgentOutput')
  assert.deepEqual(JSON.parse(toolCall.function.arguments), {
    action: {
      navigate_wms_page: { page: '销售订单', mode: 'create' },
    },
  })
})

test('unwraps dispatcher navigation inside an existing AgentOutput response', async () => {
  const response = new Response(JSON.stringify({
    choices: [{
      message: {
        tool_calls: [{
          type: 'function',
          function: {
            name: 'AgentOutput',
            arguments: JSON.stringify({
              action: {
                execute_wms_action: {
                  actionId: 'navigate_wms_page',
                  args: { page: '客户资料', mode: 'list' },
                },
              },
            }),
          },
        }],
      },
      finish_reason: 'tool_calls',
    }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  const normalized = await normalizePageAgentModelResponse(response)
  const payload = await normalized.json()
  const argumentsValue = JSON.parse(
    payload.choices[0].message.tool_calls[0].function.arguments,
  )

  assert.deepEqual(argumentsValue.action, {
    navigate_wms_page: { page: '客户资料', mode: 'list' },
  })
})

test('leaves an existing AgentOutput response unchanged', async () => {
  const response = new Response(JSON.stringify({
    choices: [{
      message: {
        tool_calls: [{
          type: 'function',
          function: {
            name: 'AgentOutput',
            arguments: JSON.stringify({ action: { done: { success: true, text: '完成' } } }),
          },
        }],
      },
      finish_reason: 'tool_calls',
    }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  assert.equal(await normalizePageAgentModelResponse(response), response)
})

test('leaves unsuccessful responses untouched', async () => {
  const response = new Response(JSON.stringify({ error: { message: 'rate limited' } }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' },
  })

  assert.equal(await normalizePageAgentModelResponse(response), response)
})
