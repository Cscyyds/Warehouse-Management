import { PcmStreamRecorder } from '@/agent/voice/pcmWavRecorder'

const ASR_STREAM_PATH = '/api/v1/asr/doubao/stream'

export interface SpeechTranscriptionResult {
  text: string
  provider: string
}

type AsrServerMessage = {
  text?: unknown
  error?: unknown
}

function buildAsrWebSocketUrl(token: string): string {
  const url = new URL(ASR_STREAM_PATH, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('token', token)
  return url.toString()
}

/** 豆包流式语音识别客户端：录音 PCM 实时推流，停止后立即返回最终文本 */
export class VoiceTranscriber {
  private socket?: WebSocket
  private recorder?: PcmStreamRecorder
  private finalResolve?: (result: SpeechTranscriptionResult) => void
  private finalReject?: (error: Error) => void

  static isSupported(): boolean {
    return PcmStreamRecorder.isSupported()
  }

  async start(): Promise<void> {
    const token = localStorage.getItem('token')?.trim()
    if (!token) throw new Error('登录状态已失效，请重新登录')

    const socket = new WebSocket(buildAsrWebSocketUrl(token))
    socket.binaryType = 'arraybuffer'
    this.socket = socket
    socket.addEventListener('message', (event) => this.handleMessage(event))
    socket.addEventListener('close', () => {
      this.socket = undefined
      if (this.finalReject) this.rejectPending(new Error('语音识别连接已断开'))
    })

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        cleanup()
        // 连接后先发音频参数配置，再开始推流
        socket.send(JSON.stringify({ format: 'pcm', rate: 16000, bits: 16, channel: 1 }))
        resolve()
      }
      const onError = () => {
        cleanup()
        reject(new Error('无法连接语音识别服务'))
      }
      const cleanup = () => {
        socket.removeEventListener('open', onOpen)
        socket.removeEventListener('error', onError)
      }
      socket.addEventListener('open', onOpen)
      socket.addEventListener('error', onError)
    })

    const recorder = new PcmStreamRecorder((chunk) => this.sendAudio(chunk))
    this.recorder = recorder
    try {
      await recorder.start()
    } catch (error) {
      await this.cancel()
      throw error
    }
  }

  private sendAudio(chunk: ArrayBuffer): void {
    if (!chunk.byteLength || this.socket?.readyState !== WebSocket.OPEN) return
    this.socket.send(chunk)
  }

  async stop(): Promise<SpeechTranscriptionResult> {
    const socket = this.socket
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('语音识别连接不可用')
    }
    await this.recorder?.stop()
    this.recorder = undefined
    socket.send(JSON.stringify({ type: 'end' }))
    return new Promise<SpeechTranscriptionResult>((resolve, reject) => {
      this.finalResolve = resolve
      this.finalReject = reject
    })
  }

  async cancel(): Promise<void> {
    const socket = this.socket
    this.socket = undefined
    if (socket?.readyState === WebSocket.OPEN) socket.close(1000)
    else socket?.close()
    const recorder = this.recorder
    this.recorder = undefined
    await recorder?.cancel()
    this.rejectPending(new Error('语音识别已取消'))
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== 'string') return
    let message: AsrServerMessage
    try {
      message = JSON.parse(event.data) as AsrServerMessage
    } catch {
      this.rejectPending(new Error('语音服务返回了无效响应'))
      return
    }
    if (typeof message.error === 'string' && message.error) {
      this.rejectPending(new Error(message.error))
      return
    }
    if (typeof message.text === 'string') {
      const text = message.text.trim()
      if (!text) {
        this.rejectPending(new Error('没有识别到语音内容，请靠近麦克风重试'))
        return
      }
      const resolve = this.finalResolve
      this.finalResolve = undefined
      this.finalReject = undefined
      resolve?.({ text, provider: 'doubao' })
    }
  }

  private rejectPending(error: Error): void {
    const reject = this.finalReject
    this.finalResolve = undefined
    this.finalReject = undefined
    reject?.(error)
  }
}
