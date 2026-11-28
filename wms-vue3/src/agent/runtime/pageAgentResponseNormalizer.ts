type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : undefined
}

function unwrapDispatcherNavigation(
  toolName: string,
  toolArguments: unknown,
): { name: string; arguments: unknown } {
  const dispatcherInput = asRecord(toolArguments)
  if (
    toolName === 'execute_wms_action'
    && dispatcherInput?.actionId === 'navigate_wms_page'
    && asRecord(dispatcherInput.args)
  ) {
    return {
      name: 'navigate_wms_page',
      arguments: dispatcherInput.args,
    }
  }
  return { name: toolName, arguments: toolArguments }
}

/**
 * DeepSeek 偶尔会绕过 PageAgent 的 AgentOutput 宏工具，直接调用其中的具体 Action。
 * PageAgent 1.12.2 的自动修复会丢失这个工具名，因此在自有 fetch 边界先补齐标准结构。
 */
export async function normalizePageAgentModelResponse(response: Response): Promise<Response> {
  if (!response.ok) return response
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return response
  }

  let payload: JsonRecord
  try {
    const parsed = await response.clone().json()
    const record = asRecord(parsed)
    if (!record) return response
    payload = record
  } catch {
    return response
  }

  const choices = Array.isArray(payload.choices) ? payload.choices : []
  const firstChoice = asRecord(choices[0])
  const message = asRecord(firstChoice?.message)
  const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : []
  const firstToolCall = asRecord(toolCalls[0])
  const functionCall = asRecord(firstToolCall?.function)
  const toolName = functionCall?.name
  const rawArguments = functionCall?.arguments

  if (typeof toolName !== 'string' || !toolName || typeof rawArguments !== 'string') {
    return response
  }

  let parsedArguments: unknown
  try {
    parsedArguments = JSON.parse(rawArguments)
  } catch {
    // 保留原响应，让 PageAgent 按自身规则报告参数 JSON 错误。
    return response
  }

  if (toolName === 'AgentOutput') {
    const macroArguments = asRecord(parsedArguments)
    const action = asRecord(macroArguments?.action)
    const dispatcherNavigation = asRecord(action?.execute_wms_action)
    if (
      !macroArguments
      || !action
      || dispatcherNavigation?.actionId !== 'navigate_wms_page'
      || !asRecord(dispatcherNavigation.args)
    ) {
      return response
    }
    macroArguments.action = {
      navigate_wms_page: dispatcherNavigation.args,
    }
    functionCall.arguments = JSON.stringify(macroArguments)
  } else {
    const normalizedAction = unwrapDispatcherNavigation(toolName, parsedArguments)
    functionCall.name = 'AgentOutput'
    functionCall.arguments = JSON.stringify({
      action: {
        [normalizedAction.name]: normalizedAction.arguments,
      },
    })
  }

  const headers = new Headers(response.headers)
  headers.delete('content-length')
  headers.delete('content-encoding')
  headers.set('content-type', 'application/json; charset=utf-8')

  return new Response(JSON.stringify(payload), {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
