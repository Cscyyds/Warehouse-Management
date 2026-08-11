export interface StreamingSpeechResult {
  text: string
  provider: string
}

interface SpeechStreamOptions {
  onPartial?: (text: string) => void
}

type SpeechServerEvent = {
  type: 'ready' | 'partial' | 'final' | 'error' | 'cancelled'
  text?: string
  provider?: string
  message?: string
}

function buildSpeechWebSocketUrl(): string {
  const url = new URL('/api/v1/page-agent/speech/stream', window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

export class StreamingSpeechRecognition {
  private socket?: WebSocket
  private readyResolve?: () => void
  private readyReject?: (error: Error) => void
  private finalResolve?: (result: StreamingSpeechResult) => void
  private finalReject?: (error: Error) => void
  private readonly onPartial?: (text: string) => void

  constructor(options: SpeechStreamOptions = {}) {
    this.onPartial = options.onPartial
  }

  async start(): Promise<void> {
    const token = localStorage.getItem('token')?.trim()
    if (!token) throw new Error('登录状态已失效，请重新登录')

    const socket = new WebSocket(buildSpeechWebSocketUrl())
    socket.binaryType = 'arraybuffer'
    this.socket = socket
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'auth', token }))
    })
    socket.addEventListener('message', (event) => this.handleMessage(event))
    socket.addEventListener('error', () => {
      this.rejectPending(new Error('无法连接语音识别服务'))
    })
    socket.addEventListener('close', () => {
      if (this.readyReject || this.finalReject) {
        this.rejectPending(new Error('语音识别连接已断开'))
      }
      this.socket = undefined
    })

    await new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
    })
  }

  sendAudio(chunk: ArrayBuffer): void {
    if (!chunk.byteLength || this.socket?.readyState !== WebSocket.OPEN) return
    this.socket.send(chunk)
  }

  async stop(): Promise<StreamingSpeechResult> {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error('语音识别连接不可用')
    }
    const result = new Promise<StreamingSpeechResult>((resolve, reject) => {
      this.finalResolve = resolve
      this.finalReject = reject
    })
    this.socket.send(JSON.stringify({ type: 'stop' }))
    return result
  }

  cancel(): void {
    const socket = this.socket
    this.socket = undefined
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'cancel' }))
      socket.close(1000)
    } else {
      socket?.close()
    }
    this.rejectPending(new Error('语音识别已取消'))
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== 'string') return
    let message: SpeechServerEvent
    try {
      message = JSON.parse(event.data) as SpeechServerEvent
    } catch {
      this.rejectPending(new Error('语音服务返回了无效响应'))
      return
    }

    if (message.type === 'ready') {
      this.readyResolve?.()
      this.readyResolve = undefined
      this.readyReject = undefined
      return
    }
    if (message.type === 'partial' && message.text) {
      this.onPartial?.(message.text)
      return
    }
    if (message.type === 'final' && message.text) {
      this.finalResolve?.({ text: message.text, provider: message.provider || 'doubao' })
      this.finalResolve = undefined
      this.finalReject = undefined
      return
    }
    if (message.type === 'error') {
      this.rejectPending(new Error(message.message || '语音识别失败，请稍后重试'))
    }
  }

  private rejectPending(error: Error): void {
    this.readyReject?.(error)
    this.finalReject?.(error)
    this.readyResolve = undefined
    this.readyReject = undefined
    this.finalResolve = undefined
    this.finalReject = undefined
  }
}
