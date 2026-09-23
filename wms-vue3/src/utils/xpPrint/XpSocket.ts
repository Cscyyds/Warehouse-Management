/**
 * 芯烨本机打印代理 WebSocket 连接管理（端口 37990）。
 *
 * 与精臣服务的差异：协议带 `reqId` 关联请求与响应，支持并发提交打印任务；
 * 打印为代理内排队异步执行，受理立即响应（errorCode=0 表示已入队），
 * 完成与进度经 `printDone` / `printProgress` 事件推送（按 reqId 关联）。
 *
 * 重连策略（与 nmPrint/Socket.ts 对齐并加强）：失败后指数退避自动重连
 * （3s 起步、30s 封顶）；从未连上过时最多自动重连 maxReconnectAttempts 次，
 * 之后停止（等待用户手动重试），避免代理未安装时空转占用资源；
 * 连上过再断线（如代理重启）则持续按退避节奏保活重连。
 */

/** 连接方式：usb（USB 线）/ net（WiFi/网口，代理经 NET,IP,端口 直连） */
export type XpConnMode = 'usb' | 'net'

/** 局域网发现到的一台设备（SDK 只给到这些字段，没有型号/SN） */
export interface XpDiscoveredDevice {
  ip: string
  mac: string
  mask?: string
  gateway?: string
  dhcp?: boolean
}

/** 代理接口返回结构 */
export interface XpAck {
  reqId?: string
  errorCode: number
  info?: string
  /** getStatus/connect 字段 */
  agentVersion?: string
  /** 当前连接方式（v1.1.0+ 代理返回；旧版代理无此字段，视为 usb） */
  connMode?: XpConnMode
  connected?: boolean
  /** USB 模式：本机枚举到的打印机设备名；NET 模式恒为空数组 */
  printers?: string[]
  printerName?: string
  /** NET 模式：打印机目标 host:port */
  netTarget?: string
  /** NET 模式：TCP 端口可达性（轻量探测） */
  netReachable?: boolean
  paperOut?: boolean
  coverOpen?: boolean
  busy?: boolean
  /** printProgress 字段 */
  done?: number
  total?: number
  /** DLL 原始返回码（排查用） */
  rawCode?: number
  /** discover 字段：局域网发现到的设备列表（仅 IPv4） */
  devices?: XpDiscoveredDevice[]
  /** discover 字段：SDK 回调的原始 JSON 文本（上限 10 条，现场核对字段用） */
  raw?: string[]
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

/** 指数退避封顶（毫秒） */
const MAX_RECONNECT_DELAY = 30000

export class XpSocket {
  /** 重连间隔基数 / 请求超时 / 建连超时（毫秒）；从未连上时最多自动重连 maxReconnectAttempts 次 */
  options = { resetTime: 3000, timeout: 10000, connectTimeout: 2500, maxReconnectAttempts: 3 }
  private customClose = false
  private reconnectTimer?: ReturnType<typeof setTimeout>
  /** 连续自动重连次数（连上成功后清零） */
  private reconnectAttempts = 0
  /** 本次页面生命周期内是否连上过；连上过再断线则不限次保活重连 */
  private everConnected = false
  private promisePool: Record<string, PendingRequest> = {}
  private eventListeners = new Set<XpEventListener>()
  private openChangeCallback: ((open: boolean) => void) | null = null
  private openingPromise: Promise<{ ws: XpSocket }> | null = null
  private disconnect?: (error: Error) => void
  private reqSeq = 0
  _websocket?: WebSocket

  constructor(options: Partial<{ resetTime: number; timeout: number; connectTimeout: number; maxReconnectAttempts: number }> = {}) {
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

  /** 断线后自动重连：指数退避；从未连上且用尽次数后放弃（不阻止后续手动 open） */
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

  /** 打开连接；openChange 通知连接状态。并发调用共享同一次建连（openingPromise 去重） */
  open(openChange?: (open: boolean) => void): Promise<{ ws: XpSocket }> {
    if (openChange) this.openChangeCallback = openChange
    if (this._websocket?.readyState === 1) {
      this.openChangeCallback?.(true)
      return Promise.resolve({ ws: this })
    }
    if (this.openingPromise) return this.openingPromise
    this.customClose = false
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined

    let ws: WebSocket
    try {
      ws = new WebSocket(XP_AGENT_WS_URL)
    } catch (error) {
      this.openChangeCallback?.(false)
      this.closeCallback()
      return Promise.reject(error)
    }
    this._websocket = ws
    this.openingPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => disconnect(new Error('芯烨打印代理连接超时')), this.options.connectTimeout)
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
        for (const [reqId, request] of Object.entries(this.promisePool)) {
          request.resolve({ reqId, errorCode: 23, info: '芯烨打印代理连接断开' })
          clearTimeout(request.timeoutCallback)
          delete this.promisePool[reqId]
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
      // error 后通常紧跟 close，两者共用一次清理，避免安排两次重连
      ws.onerror = () => disconnect(new Error('芯烨打印代理连接失败'))
      ws.onclose = () => disconnect(new Error('芯烨打印代理连接关闭'))
      ws.onmessage = (e: MessageEvent) => {
        if (this._websocket !== ws) return
        const parsed = this.isJSON(e.data)
        if (!parsed) return
        this.routeMessage(parsed)
      }
    })
    return this.openingPromise
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
    const ws = this._websocket
    if (ws?.readyState !== 1) {
      return Promise.resolve({ reqId: `xp_${Date.now()}_${++this.reqSeq}`, errorCode: 23, info: '芯烨打印代理未连接' })
    }
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
      ws.send(JSON.stringify({ ...content, reqId }))
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

  /** 手动关闭连接；同时清除挂起的自动重连定时器 */
  close() {
    this.customClose = true
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined
    this.disconnect?.(new Error('芯烨打印代理连接已关闭'))
  }
}
