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

export class NmSocket {
  /** 重连间隔 / 请求超时（毫秒） */
  options = { resetTime: 3000, timeout: 10000 }
  private customClose = false
  private promisePool: Record<string, PendingRequest> = {}
  private printListeners = new Set<PrintListener>()
  private openChangeCallback: ((open: boolean) => void) | null = null
  _websocket?: WebSocket

  constructor(options: Partial<{ resetTime: number; timeout: number }> = {}) {
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

  /** 断线后自动重连 */
  private closeCallback() {
    if (this.customClose) return
    this._websocket = undefined
    this.printListeners.clear()
    const timer = setTimeout(async () => {
      try {
        await this.open(this.openChangeCallback ?? undefined)
        clearTimeout(timer)
      } catch {
        this.openChangeCallback?.(false)
      }
    }, this.options.resetTime)
  }

  /** 打开连接；openChange 通知连接状态，onMessageCallback 统一接收设备状态上报 */
  open(openChange?: (open: boolean) => void, onMessageCallback?: (msg: SdkMessage) => void): Promise<{ ws: NmSocket }> {
    this.openChangeCallback = openChange ?? null
    return new Promise((resolve, reject) => {
      // 已有可用连接直接复用；残留的半开连接先丢弃重建（否则 Promise 永远挂起）
      if (this._websocket !== undefined) {
        if (this._websocket.readyState === 1) {
          openChange?.(true)
          resolve({ ws: this })
          return
        }
        this._websocket = undefined
      }
      this._websocket = new WebSocket(PRINT_SERVICE_URL)
      this._websocket.onopen = () => {
        openChange?.(true)
        resolve({ ws: this })
      }
      this._websocket.onerror = () => {
        openChange?.(false)
        // 必须 reject 结束等待方，否则调用方只能靠超时判负（表现为"未检测到打印服务"误报）
        reject(new Error('打印服务连接失败'))
        this.closeCallback()
      }
      this._websocket.onclose = () => {
        openChange?.(false)
        this.printListeners.clear()
        this.closeCallback()
      }
      this._websocket.onmessage = (e: MessageEvent) => {
        const msg = this.isJSON(e.data) || (e.data as unknown as SdkMessage)
        this.messageRouter(msg, onMessageCallback)
      }
    })
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
    if (this._websocket && this._websocket.readyState === 1) {
      this.printListeners.clear()
      this.openChangeCallback?.(false)
      this._websocket.close()
    }
    this.customClose = false
  }

  /** 发送指令并等待响应（超时返回 errorCode 22）；content 允许顶层附加字段（如 generateImagePreviewImage 的 displayScale） */
  send(content: { apiName: string; parameter?: unknown; [key: string]: unknown }, timeout: number | null = null): Promise<SdkMessage> {
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
      if (this._websocket && this._websocket.readyState === 1) {
        this._websocket.send(JSON.stringify({ ...content }))
      } else {
        this.promisePool[content.apiName].resolve({
          apiName: content.apiName,
          resultAck: { errorCode: 23 },
          Error: '打印服务未连接',
        })
      }
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
