/**
 * 精臣打印服务 WebSocket 连接管理（移植自 web-4.0.6_20260514/pc-sdk-vue/src/utils/Socket.js）
 * 浏览器通过 ws://127.0.0.1:37989 连接用户本机的精臣打印服务（桌面程序）
 */

/** SDK 接口返回结构 */
export interface ResultAck {
  errorCode: number
  info?: string
  result?: number
  /** 打印进度上报字段 */
  printPages?: number
  printCopies?: number
  onPrintPageLengthCompleted?: number
}

export interface SdkMessage {
  apiName: string
  resultAck?: ResultAck
  Error?: string
  [key: string]: unknown
}

export type PrintListener = (msg: SdkMessage) => void

interface PendingRequest {
  timestamp: number
  content: { apiName: string }
  resolve: (value: SdkMessage) => void
  timeoutCallback: ReturnType<typeof setTimeout>
}

export const PRINT_SERVICE_URL = 'ws://127.0.0.1:37989'

/** 指数退避封顶（毫秒） */
const MAX_RECONNECT_DELAY = 30000

export class NmSocket {
  /** resetTime 为重连间隔基数；从未连上时最多自动重连 maxReconnectAttempts 次，避免服务未安装时空转 */
  options = { resetTime: 3000, timeout: 10000, connectTimeout: 2500, maxReconnectAttempts: 3 }
  private customClose = false
  /** 连续自动重连次数（连上成功后清零） */
  private reconnectAttempts = 0
  /** 本次页面生命周期内是否连上过；连上过再断线则不限次保活重连 */
  private everConnected = false
  private promisePool: Record<string, PendingRequest> = {}
  private printListeners = new Set<PrintListener>()
  private openChangeCallback: ((open: boolean) => void) | null = null
  private openingPromise: Promise<{ ws: NmSocket }> | null = null
  private reconnectTimer?: ReturnType<typeof setTimeout>
  private disconnect?: (error: Error) => void
  _websocket?: WebSocket

  constructor(options: Partial<{ resetTime: number; timeout: number; connectTimeout: number }> = {}) {
    this.options = { ...this.options, ...options }
  }

  private isJSON(str: unknown): SdkMessage | false {
    if (typeof str !== 'string') return false
    try {
      return JSON.parse(str) as SdkMessage
    } catch {
      return false
    }
  }

  private closeCallback() {
    if (this.customClose || this.reconnectTimer !== undefined) return
    if (!this.everConnected && this.reconnectAttempts >= this.options.maxReconnectAttempts) return
    const delay = Math.min(this.options.resetTime * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY)
    this.reconnectAttempts += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      void this.open().catch(() => {})
    }, delay)
  }

  open(openChange?: (open: boolean) => void, onMessageCallback?: (msg: SdkMessage) => void): Promise<{ ws: NmSocket }> {
    if (openChange) this.openChangeCallback = openChange
    if (this._websocket?.readyState === 1) return Promise.resolve({ ws: this })
    if (this.openingPromise) return this.openingPromise
    this.customClose = false
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined

    let ws: WebSocket
    try {
      ws = new WebSocket(PRINT_SERVICE_URL)
    } catch (error) {
      this.openChangeCallback?.(false)
      this.closeCallback()
      return Promise.reject(error)
    }
    this._websocket = ws
    this.openingPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => disconnect(new Error('打印服务连接超时')), this.options.connectTimeout)
      const disconnect = (error: Error) => {
        if (this._websocket !== ws) return
        clearTimeout(timer)
        ws.onopen = null
        ws.onerror = null
        ws.onclose = null
        ws.onmessage = null
        this._websocket = undefined
        this.openingPromise = null
        this.disconnect = undefined
        if (ws.readyState === 0 || ws.readyState === 1) ws.close()
        this.printListeners.clear()
        for (const [apiName, request] of Object.entries(this.promisePool)) {
          request.resolve({ apiName, resultAck: { errorCode: 23 }, Error: '打印服务连接断开' })
          this.cleanupRequest(apiName, request)
        }
        reject(error)
        this.openChangeCallback?.(false)
        this.closeCallback()
      }
      this.disconnect = disconnect
      ws.onopen = () => {
        if (this._websocket !== ws) return
        clearTimeout(timer)
        this.openingPromise = null
        this.everConnected = true
        this.reconnectAttempts = 0
        resolve({ ws: this })
        this.openChangeCallback?.(true)
      }
      // error 后通常紧跟 close，两者共用一次清理，避免安排两次重连。
      ws.onerror = () => disconnect(new Error('打印服务连接失败'))
      ws.onclose = () => disconnect(new Error('打印服务连接关闭'))
      ws.onmessage = (e: MessageEvent) => {
        if (this._websocket !== ws) return
        const msg = this.isJSON(e.data) || (e.data as unknown as SdkMessage)
        this.messageRouter(msg, onMessageCallback)
      }
    })
    return this.openingPromise
  }

  /** 消息路由：API 响应走 promisePool，commitJob 主动上报走 printListeners */
  private messageRouter(msg: SdkMessage, onMessageCallback?: (msg: SdkMessage) => void) {
    const isAutoReport = msg.apiName === 'commitJob'
    if (msg.apiName && msg.apiName !== 'getPrinterHighLevelInfo' && msg.apiName !== 'printStatus' && !isAutoReport) {
      this.handleApiResponse(msg)
    } else if (isAutoReport) {
      this.handleEventPush(msg)
    }
    if (msg.apiName === 'getPrinterHighLevelInfo' || msg.apiName !== 'printStatus') {
      onMessageCallback?.(msg)
    }
  }

  private handleApiResponse(msg: SdkMessage) {
    const req = this.promisePool[msg.apiName]
    if (!req) return
    if (msg.apiName === 'commitJob') {
      if (msg.resultAck?.info === 'commitJob ok!') {
        req.resolve(msg)
        this.cleanupRequest(msg.apiName, req)
      }
    } else {
      // 与官方一致：响应处理后一律清理挂起请求（成功也清理）。
      // 若成功后残留条目，10s 超时回调触发时会误删后续同名请求的新条目，
      // 导致该请求的响应被丢弃、只能等超时（表现为偶发 errorCode 22）
      req.resolve(msg)
      this.cleanupRequest(msg.apiName, req)
    }
  }

  private handleEventPush(msg: SdkMessage) {
    // commitJob 的 API 层响应（'commitJobApi Success!'）只会走事件通道，
    // 此处顺带 resolve 挂起的 commitJob 请求，避免调用方空等 10s 超时
    if (msg.apiName === 'commitJob' && msg.resultAck?.info === 'commitJobApi Success!') {
      const req = this.promisePool.commitJob
      if (req) {
        req.resolve(msg)
        this.cleanupRequest('commitJob', req)
      }
    }
    this.printListeners.forEach((listener) => listener(msg))
  }

  private cleanupRequest(apiName: string, req?: PendingRequest) {
    req && clearTimeout(req.timeoutCallback)
    delete this.promisePool[apiName]
  }

  /** 手动关闭连接 */
  close() {
    this.customClose = true
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined
    this.disconnect?.(new Error('打印服务连接已关闭'))
  }

  /** 发送指令并等待响应（超时返回 errorCode 22）；content 允许顶层附加字段（如 generateImagePreviewImage 的 displayScale） */
  send(content: { apiName: string; parameter?: unknown; [key: string]: unknown }, timeout: number | null = null): Promise<SdkMessage> {
    const ws = this._websocket
    if (ws?.readyState !== 1) {
      return Promise.resolve({ apiName: content.apiName, resultAck: { errorCode: 23 }, Error: '打印服务未连接' })
    }
    const timestamp = Date.now()
    const timeoutCallback = setTimeout(
      () => {
        const req = this.promisePool[content.apiName]
        if (req && req.timestamp === timestamp) {
          req.resolve({ apiName: content.apiName, resultAck: { errorCode: 22 }, Error: '打印超时' })
          this.cleanupRequest(content.apiName, req)
        }
      },
      timeout !== null ? timeout : this.options.timeout,
    )
    return new Promise((resolve) => {
      this.promisePool[content.apiName] = { timestamp, content, resolve, timeoutCallback }
      ws.send(JSON.stringify({ ...content }))
    })
  }

  addPrintListener(callback: PrintListener): PrintListener | undefined {
    if (typeof callback !== 'function') return undefined
    this.printListeners.delete(callback)
    this.printListeners.add(callback)
    return callback
  }

  removePrintListener(callback: PrintListener) {
    if (!callback) return
    this.printListeners.delete(callback)
  }
}

/** 打印服务连接状态：2 = WebSocket OPEN */
export function printServiceReady(socket: NmSocket): boolean {
  return socket._websocket?.readyState === 1
}
