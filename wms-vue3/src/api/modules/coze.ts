/**
 * Coze AI 工作流 SSE 接口封装
 *
 * 注意：SSE 流式接口必须使用原生 fetch，axios 不支持流式读取。
 * 后端接口路径：
 *   POST /api/v1/coze/workflow/start   启动工作流
 *   POST /api/v1/coze/workflow/reply   回复工作流中断
 */

const API_BASE = '/api'

export interface CozeStreamCallbacks {
  /** 收到 message 事件（内容片段） */
  onMessage: (content: string, nodeTitle: string) => void
  /** 收到 interrupt 事件（工作流等待用户输入） */
  onInterrupt: (eventId: string, interruptType: number, message: string) => void
  /** 收到 error 事件或网络异常 */
  onError: (message: string) => void
  /** 流正常结束 */
  onDone: () => void
}

/**
 * 读取 SSE 流的核心工具函数。
 * 使用 fetch + ReadableStream 逐行解析 SSE 格式：
 *   event: <type>
 *   data: <json>
 *   (空行)
 */
async function streamCozeWorkflow(
  url: string,
  body: Record<string, unknown>,
  callbacks: CozeStreamCallbacks,
): Promise<void> {
  const token = localStorage.getItem('token') || ''
  console.log('[Coze] fetch:', url, 'token:', token ? 'present' : 'missing')

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    callbacks.onError('网络连接失败，请检查服务是否启动')
    return
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const json = await response.json()
      detail = json?.detail || json?.message || detail
    } catch {
      // 忽略解析失败
    }
    callbacks.onError(detail)
    return
  }

  // SSE 流模式
  const reader = response.body?.getReader()
  if (!reader) {
    callbacks.onError('无法读取响应流')
    return
  }

  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let currentEvent = 'message'

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // 按行处理，保留未完整的最后一行
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trimEnd()

      if (line === '') {
        // 空行：重置 event 类型
        currentEvent = 'message'
        continue
      }

      if (line.startsWith(':')) {
        // SSE 注释行，忽略
        continue
      }

      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue

      const field = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim()

      if (field === 'event') {
        currentEvent = value.toLowerCase()
        continue
      }

      if (field !== 'data') continue

      // 处理结束标志
      if (value === '[DONE]') {
        callbacks.onDone()
        reader.cancel()
        return
      }

      let data: Record<string, unknown>
      try {
        data = JSON.parse(value)
      } catch {
        continue
      }

      switch (currentEvent) {
        case 'message':
          callbacks.onMessage(
            (data.content as string) ?? '',
            (data.node_title as string) ?? '',
          )
          break

        case 'interrupt':
          callbacks.onInterrupt(
            (data.event_id as string) ?? '',
            (data.interrupt_type as number) ?? 2,
            (data.message as string) ?? '',
          )
          reader.cancel()
          return

        case 'error':
          callbacks.onError((data.message as string) ?? '工作流执行出错')
          reader.cancel()
          return

        case 'done':
          callbacks.onDone()
          reader.cancel()
          return

        default:
          break
      }
    }
  }

  // 流自然结束但未收到 [DONE]，也视为完成
  callbacks.onDone()
}

/**
 * 启动 Coze 工作流
 * @param input 用户输入内容
 * @param callbacks SSE 事件回调
 */
export function startCozeWorkflow(
  input: string,
  callbacks: CozeStreamCallbacks,
): Promise<void> {
  return streamCozeWorkflow(
    `${API_BASE}/v1/coze/workflow/start`,
    { input },
    callbacks,
  )
}

/**
 * 回复 Coze 工作流中断
 * @param eventId 中断事件 ID
 * @param answer 用户回复内容
 * @param callbacks SSE 事件回调
 */
export function replyCozeWorkflow(
  eventId: string,
  answer: string,
  callbacks: CozeStreamCallbacks,
): Promise<void> {
  return streamCozeWorkflow(
    `${API_BASE}/v1/coze/workflow/reply`,
    { event_id: eventId, answer, interrupt_type: 2 },
    callbacks,
  )
}
