/**
 * 芯烨本机打印代理 WebSocket 连接管理（镜像 nmPrint/Socket.ts 的
 * 请求-响应池 / 超时 / 断线自动重连模式，端口 37990）。
 *
 * 与精臣服务的差异：协议带 `reqId` 关联请求与响应，支持并发提交打印任务；
 * 打印为代理内排队异步执行，受理立即响应（errorCode=0 表示已入队），
 * 完成与进度经 `printDone` / `printProgress` 事件推送（按 reqId 关联）。
 */

/** 代理接口返回结构 */
export interface XpAck {
  reqId?: string
  errorCode: number
  info?: string
  /** getStatus 字段 */
  agentVersion?: string
  connected?: boolean
  printers?: string[]
  printerName?: string
  paperOut?: boolean
  coverOpen?: boolean
  busy?: boolean
  /** printProgress 字段 */
  done?: number
  total?: number
  /** DLL 原始返回码（排查用） */
  rawCode?: number
}

export interface XpMessage {
  apiName: string
  reqId?: string
  [key: string]: unknown
}

export type XpEventListener = (msg: XpAck & { apiName: string }) => void

interface PendingRequest {
  apiName: string
  resolve: (value: XpAck) => void
  timeoutCallback: ReturnType<typeof setTimeout>
}

export const XP_AGENT_WS_URL = 'ws://127.0.0.1:37990'

export class XpSocket {
  /** 重连间隔 / 请求超时（毫秒） */
  options = { resetTime: 3000, timeout: 10000 }
  private customClose = false
  private promisePool: Record<string, PendingRequest> = {}
  private eventListeners = new Set<XpEventListener>()
  private openChangeCallback: ((open: boolean) => void) | null = null
  private reqSeq = 0
  _websocket?: WebSocket

  constructor(options: Partial<{ resetTime: number; timeout: number }> = {}) {
    this.options = { ...this.options, ...options }
  }

  private isJSON(str: unknown): XpMessage | false {
    if (typeof str !== 'string') return false
    try {
      return JSON.parse(str) as XpMessage
    } catch {
      return false
    }
  }

  /** 断线后自动重连 */
  private closeCallback() {
    if (this.customClose) return
    this._websocket = undefined
    const timer = setTimeout(async () => {
      try {
        await this.open(this.openChangeCallback ?? undefined)
        clearTimeout(timer)
      } catch {
        this.openChangeCallback?.(false)
      }
    }, this.options.resetTime)
  }

  /** 打开连接；openChange 通知连接状态 */
  open(openChange?: (open: boolean) => void): Promise<{ ws: XpSocket }> {
    this.openChangeCallback = openChange ?? null
    return new Promise((resolve, reject) => {
      if (this._websocket !== undefined) {
        if (this._websocket.readyState === 1) {
          openChange?.(true)
          resolve({ ws: this })
          return
        }
        this._websocket = undefined
      }
      this._websocket = new WebSocket(XP_AGENT_WS_URL)
      this._websocket.onopen = () => {
        openChange?.(true)
        resolve({ ws: this })
      }
      this._websocket.onerror = () => {
        openChange?.(false)
        reject(new Error('芯烨打印代理连接失败'))
        this.closeCallback()
      }
      this._websocket.onclose = () => {
        openChange?.(false)
        this.closeCallback()
      }
      this._websocket.onmessage = (e: MessageEvent) => {
        const parsed = this.isJSON(e.data)
        if (!parsed) return
        this.routeMessage(parsed)
      }
    })
  }

  /**
   * 消息路由：reqId 命中挂起请求且 apiName 与请求一致时按响应处理，
   * 其余（事件推送 printDone/printProgress、或同名 reqId 不同类型消息）走事件监听。
   * apiName 校验是竞态关键：打印执行极快时 printDone 可能与受理 ack 乱序写出，
   * 仅按 reqId 匹配会把 printDone 误当受理响应消费掉，导致完成事件丢失、前端超时误报。
   */
  private routeMessage(msg: XpMessage & Partial<XpAck>) {
    const reqId = msg.reqId
    const pending = reqId ? this.promisePool[reqId] : undefined
    if (pending && msg.apiName === pending.apiName) {
      clearTimeout(pending.timeoutCallback)
      delete this.promisePool[reqId!]
      pending.resolve(msg as XpAck)
      return
    }
    this.eventListeners.forEach((listener) => listener(msg as XpAck & { apiName: string }))
  }

  /** 发送指令并等待同 reqId 响应；未连接时直接返回 errorCode 23（连接断开） */
  send(content: { apiName: string; [key: string]: unknown }, timeout: number | null = null): Promise<XpAck> {
    const reqId = `xp_${Date.now()}_${++this.reqSeq}`
    const timeoutCallback = setTimeout(() => {
      const req = this.promisePool[reqId]
      if (req) {
        delete this.promisePool[reqId]
        req.resolve({ reqId, errorCode: 22, info: '打印超时' })
      }
    }, timeout !== null ? timeout : this.options.timeout)

    return new Promise((resolve) => {
      this.promisePool[reqId] = { apiName: content.apiName, resolve, timeoutCallback }
      if (this._websocket && this._websocket.readyState === 1) {
        this._websocket.send(JSON.stringify({ ...content, reqId }))
      } else {
        clearTimeout(timeoutCallback)
        delete this.promisePool[reqId]
        resolve({ reqId, errorCode: 23, info: '芯烨打印代理未连接' })
      }
    })
  }

  addEventListener(callback: XpEventListener): XpEventListener | undefined {
    if (typeof callback !== 'function') return undefined
    this.eventListeners.delete(callback)
    this.eventListeners.add(callback)
    return callback
  }

  removeEventListener(callback: XpEventListener) {
    this.eventListeners.delete(callback)
  }

  /** 当前是否已建立连接 */
  isOpen(): boolean {
    return this._websocket !== undefined && this._websocket.readyState === 1
  }

  /** 手动关闭连接 */
  close() {
    this.customClose = true
    if (this._websocket && this._websocket.readyState === 1) {
      this.eventListeners.clear()
      this.openChangeCallback?.(false)
      this._websocket.close()
    }
    this.customClose = false
  }
}
