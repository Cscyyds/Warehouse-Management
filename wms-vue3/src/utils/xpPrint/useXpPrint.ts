/**
 * 芯烨标签打印组合式封装（镜像 nmPrint/useNmPrint 的结构与实战行为）
 * 职责：打印代理连接管理、连接方式选择（USB 线 / WiFi，用户可选并持久化）、
 *       代理状态查询、TSPL 脚本直打全流程（提交 → 代理串行执行 → 完成上报）
 * 用法：const xp = useXpPrint(); await xp.ensureReady(); await xp.print({ tsplCommands, qty })
 *       WiFi：await xp.selectConnection('net', '192.168.1.100', 9100)（真实探测后切换）
 *
 * ⚠ 与 useNmPrint 一致采用模块级共享单例：WebSocket 与连接状态全应用唯一，
 * 组件卸载不关闭连接。自研代理虽无"多连接卡死"问题，但保持一致的连接
 * 管理，避免多弹窗重复建连。
 *
 * 协议说明见 XpSocket.ts 头注释；代理串行队列保证并发提交按序执行。
 * 份数（qty）经协议传递，由代理重复写入脚本（后端脚本固定 PRINT 1,1，
 * 与精臣"份数由前端提交时控制"的职责划分一致）。
 * 连接方式（connect 指令）为代理 v1.1.0+ 能力：旧代理自动降级为仅 USB。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { XpSocket, type XpAck, type XpConnMode, type XpDiscoveredDevice } from './XpSocket'
import { XP_AGENT_DOWNLOAD_URL } from '@/config/downloads'

// 局域网发现：SDK 内部等 3 秒 + 代理侧 6 秒墙钟兜底，这里再留足余量
const DISCOVER_REQUEST_TIMEOUT_MS = 15000

// 安装包下载地址集中在 @/config/downloads（已从 public/downloads/ 迁到百度云 BOS），
// 此处按原名再导出，调用方（PrintLabelDialog / WarehousePrintTask）无需改动。
export { XP_AGENT_DOWNLOAD_URL }

/** 代理错误码与中文提示（对齐精臣 describePrintError 模式；错误码定义见代理协议）。
 *  文案保持连接方式中立：USB / WiFi 的针对性提示由代理 info（含具体原因）或
 *  ensureReady 按当前模式补充，避免"WiFi 模式提示插拔 USB"的误导。 */
export const XP_ERROR_MESSAGES: Record<number, string> = {
  0: '成功',
  1: '未检测到芯烨打印机，请检查打印机连接（USB 线或 WiFi 网络）后重试',
  2: '打印机连接失败，请检查连接（USB 重新插拔 / WiFi 网络）后重试',
  3: '打印数据写入失败，请重试',
  4: '打印中异常，请检查打印机后重试',
  5: '未检测到标签纸，请重新安装后再试',
  6: '打印机开盖，请关闭上盖后再继续打印',
  7: '打印参数缺失，请刷新页面后重试',
  8: '打印队列繁忙，请稍后再试',
  22: '通讯超时，请稍后再试',
  23: '芯烨打印代理连接断开，请重新连接再试',
}

/** 根据错误码取中文提示；未知码回落到 info 或通用文案 */
export function describeXpError(errorCode: number, info?: string): string {
  return XP_ERROR_MESSAGES[errorCode] || info || `打印异常（错误码 ${errorCode}）`
}

/* ———— 连接方式选择（用户可选 USB 线 / WiFi，按浏览器持久化） ———— */
const LS_KEY_MODE = 'xp_conn_mode'
const LS_KEY_HOST = 'xp_net_host'
const LS_KEY_PORT = 'xp_net_port'

function loadSavedMode(): XpConnMode {
  return localStorage.getItem(LS_KEY_MODE) === 'net' ? 'net' : 'usb'
}
function loadSavedHost(): string {
  return (localStorage.getItem(LS_KEY_HOST) || '').trim()
}
function loadSavedPort(): number {
  const port = Number(localStorage.getItem(LS_KEY_PORT))
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 9100
}

/* ———— 模块级共享单例（全应用唯一连接与状态） ———— */
const socket = new XpSocket()
const serviceConnected = ref(false)
const connecting = ref(false)
/** 代理版本（低于协议版本时前端提示升级） */
const agentVersion = ref('')
/** 当前连接方式：usb / net（用户选择后持久化，代理切换） */
const connMode = ref<XpConnMode>(loadSavedMode())
/** WiFi 连接目标（net 模式生效） */
const netHost = ref(loadSavedHost())
const netPort = ref(loadSavedPort())
/** 已连接的芯烨打印机名称（空表示代理未连接打印机；NET 模式形如 "WiFi打印机 192.168.1.100:9100"） */
const printerName = ref('')
const printerList = ref<string[]>([])
/** 最近一次失败原因（模块级共享：selectConnection 与 print 流程都会写入） */
const printError = ref('')
/** 局域网发现进行中（弹窗按钮 loading 用） */
const discovering = ref(false)
/** 最近一次发现到的设备（弹窗下拉用；模块级共享，组件重挂载后仍保留） */
const discoveredDevices = ref<XpDiscoveredDevice[]>([])
/** 进行中的服务探测（并发调用共享同一结果，避免重复建连） */
let connectPromise: Promise<boolean> | null = null

export interface XpPrintOptions {
  /** 打印份数（与后端 print_qty 同值；由代理重复写入脚本实现） */
  qty: number
  /** 完成等待超时（毫秒），默认 60000 */
  doneTimeoutMs?: number
}

/**
 * 拉取代理状态（代理版本 + 连接方式 + 连接状态）。
 * 重试语义：仅对通讯失败（errorCode≠0）重试后返回 null；打印机未连接
 * （connected=false，USB 瞬时占用/休眠唤醒、WiFi 瞬断）照常重试，但重试
 * 耗尽后仍返回最后响应——代理在线与打印机在线是两件事，调用方据
 * connected/printerName 区分"未装代理"与"打印机未连"。
 */
async function refreshStatus(retries = 3): Promise<XpAck | null> {
  let last: XpAck | null = null
  for (let attempt = 0; ; attempt++) {
    const res = await socket.send({ apiName: 'getStatus' })
    if (res.errorCode !== 0) {
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500))
        continue
      }
      return null
    }
    last = res
    if (res.connected || attempt >= retries - 1) break
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  serviceConnected.value = true
  agentVersion.value = last!.agentVersion || ''
  // 注意：不回写 connMode——connMode 是用户本地持久化的"意愿方式"，
  // 代理回报的是"现状"；两者不一致由 ensureReady 检测并重新下发 connect。
  printerList.value = Array.isArray(last!.printers) ? last!.printers : []
  printerName.value = last!.printerName || ''
  return last
}

/**
 * 选择本次连接方式并让代理做真实探测：
 * - usb：代理枚举本机 USB 打印机（已插线即成功）；
 * - net：代理对 host:port 做真实开闭端口探测（TSPL 可达才判定成功）。
 * 旧版代理（<1.1.0）不认识 connect 指令（errorCode=7）：USB 选择视为成功
 * （旧代理本就只走 USB）；WiFi 选择提示需升级代理。
 */
async function selectConnection(mode: XpConnMode, host?: string, port?: number): Promise<boolean> {
  if (!socket.isOpen() && !(await connectService())) {
    printError.value = 'agent-missing'
    return false
  }
  const nextHost = (host ?? netHost.value).trim()
  const nextPort = port ?? netPort.value
  const res = await socket.send(
    mode === 'net' ? { apiName: 'connect', mode, host: nextHost, port: nextPort } : { apiName: 'connect', mode },
    15000,
  )
  if (res.errorCode === 7) {
    // 旧版代理：无 connect 能力
    if (mode === 'usb') return true
    printError.value = '当前打印代理版本过低（<1.1.0），不支持 WiFi 连接，请升级代理后重试'
    ElMessage.error(printError.value)
    return false
  }
  if (res.errorCode !== 0 || !res.connected) {
    printError.value = describeXpError(res.errorCode, res.info)
    return false
  }
  connMode.value = mode
  if (mode === 'net') {
    netHost.value = nextHost
    netPort.value = nextPort
  }
  localStorage.setItem(LS_KEY_MODE, mode)
  localStorage.setItem(LS_KEY_HOST, netHost.value)
  localStorage.setItem(LS_KEY_PORT, String(netPort.value))
  printerName.value = res.printerName || ''
  printerList.value = Array.isArray(res.printers) ? res.printers : []
  return true
}

/** 探测并连接打印代理；未安装时 serviceConnected 保持 false */
async function connectService(): Promise<boolean> {
  if (socket.isOpen()) {
    serviceConnected.value = true
    return true
  }
  if (connectPromise) return connectPromise
  connecting.value = true
  connectPromise = (async () => {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1200))
        try {
          await Promise.race([socket.open(onOpenChange), new Promise((resolve) => setTimeout(resolve, 2500))])
        } catch {
          continue
        }
        if (socket.isOpen()) {
          const status = await refreshStatus()
          if (status) return true
        }
      }
      serviceConnected.value = false
      return false
    } finally {
      connecting.value = false
      connectPromise = null
    }
  })()
  return connectPromise
}

function onOpenChange(open: boolean) {
  if (!open) {
    serviceConnected.value = false
    printerName.value = ''
    return
  }
  serviceConnected.value = true
  // 断线自动重连成功后补一次状态查询
  void refreshStatus(1)
}

/**
 * 局域网发现（弹窗「搜索设备」）：让代理广播一次 SDK 的设备发现，返回同一局域网里的打印机。
 *
 * 注意：
 *  - SDK 只回 MAC / IP / 掩码 / 网关 / dhcp，**没有型号、没有 SN** → 界面只能显示「IP + MAC」；
 *  - 未搜到设备时 errorCode 仍是 0、devices 为空数组 —— 这是"没搜到"，不是错误；
 *  - 失败时 printError 写入可读原因（含代理 info），由调用方决定怎么提示。
 */
async function discoverDevices(): Promise<XpDiscoveredDevice[]> {
  if (discovering.value) return discoveredDevices.value
  printError.value = ''
  if (!socket.isOpen() && !(await connectService())) {
    printError.value = 'agent-missing'
    return []
  }
  discovering.value = true
  try {
    const res = await socket.send({ apiName: 'discover' }, DISCOVER_REQUEST_TIMEOUT_MS)
    if (res.errorCode !== 0) {
      const raw = res.info || ''
      // 代理 1.1.0 及更早版本没有 discover 指令（errorCode 7 + "不支持的指令"）：
      // 给一句能指导操作的提示，别把 "不支持的指令：discover" 这种原始文案丢给用户。
      printError.value = raw.includes('不支持的指令')
        ? '当前打印代理版本较低，不支持搜索设备；请点「下载安装包」更新代理后重试'
        : (raw || describeXpError(res.errorCode, res.info))
      return []
    }
    discoveredDevices.value = Array.isArray(res.devices) ? res.devices : []
    return discoveredDevices.value
  } catch (err) {
    printError.value = err instanceof Error ? err.message : '搜索打印机失败'
    return []
  } finally {
    discovering.value = false
  }
}

export function useXpPrint() {
  const printing = ref(false)

  const ready = computed(() => serviceConnected.value && !!printerName.value)

  /** 一键就绪：连代理 → 查状态；本地选择的连接方式与代理不一致时（如代理重启后回落），静默重新下发选择 */
  async function ensureReady(stepLog?: (msg: string) => void): Promise<boolean> {
    const log: (msg: string) => void = stepLog ?? ((msg) => console.log('%c[芯烨打印]', 'color:#409eff;font-weight:bold', msg))
    printError.value = ''
    log(`[1] 代理连接状态: ${serviceConnected.value ? '已连' : '未连'}，连接方式: ${connMode.value === 'net' ? `WiFi ${netHost.value}:${netPort.value}` : 'USB'}`)
    if (ready.value) { log('[1] 全部就绪（代理+打印机）'); return true }
    if (!await connectService()) {
      printError.value = 'agent-missing'
      log('[1] FAIL: 芯烨打印代理连接失败（未安装或未启动）')
      return false
    }
    log('[2] 代理已连接，查询打印机状态...')
    let status = await refreshStatus()
    if (status && status.connMode && status.connMode !== connMode.value) {
      log(`[2] 代理连接方式(${status.connMode})与本地选择(${connMode.value})不一致，重新下发...`)
      const applied = await selectConnection(connMode.value, netHost.value, netPort.value)
      if (!applied) return false
      status = await refreshStatus()
    }
    if (!status || !printerName.value) {
      printError.value = 'printer-not-connected'
      log('[3] FAIL: 未检测到芯烨打印机')
      return false
    }
    log(`[3] 打印机已连接: ${printerName.value}（${connMode.value === 'net' ? 'WiFi' : 'USB'}，代理版本 ${agentVersion.value || '未知'}）`)
    return true
  }

  /**
   * 直打 TSPL 脚本：提交（受理即返回，代理串行队列执行）→ 等待 printDone 完成上报。
   * 份数由代理重复写入脚本；连接方式沿用代理当前状态（connect 已选定）；
   * 失败时错误码经 describeXpError 转中文提示。
   */
  async function print(tsplCommands: string[], options: XpPrintOptions): Promise<boolean> {
    const qty = Math.max(1, Math.floor(options.qty || 1))
    if (!tsplCommands.length) return false
    if (!await ensureReady()) {
      ElMessage.error(printError.value === 'agent-missing'
        ? '未检测到芯烨打印代理，请安装/启动后重试'
        : printError.value === 'printer-not-connected'
          ? (connMode.value === 'net'
              ? `未连接到 WiFi 打印机，请确认打印机已开机接入网络且 IP ${netHost.value}:${netPort.value} 正确`
              : '未检测到芯烨打印机，请检查打印机电源与 USB 线连接后重试')
          : printError.value || '打印机未就绪')
      return false
    }

    printing.value = true
    printError.value = ''
    let cleanupDoneListener: (() => void) | undefined
    try {
      // 提交任务：受理响应 errorCode=0 表示已入队
      const submitRes = await socket.send({ apiName: 'print', tspl: tsplCommands, qty })
      if (submitRes.errorCode !== 0) {
        printError.value = describeXpError(submitRes.errorCode, submitRes.info)
        ElMessage.error(printError.value)
        return false
      }
      const submitReqId = submitRes.reqId || ''

      // 等待 printDone 完成上报（按 reqId 关联；超时兜底）
      const doneRes = await new Promise<XpAck>((resolveDone) => {
        const timer = setTimeout(() => {
          resolveDone({ reqId: submitReqId, errorCode: 22, info: '打印完成上报超时（任务仍在代理队列，请稍后查看打印机）' })
        }, options.doneTimeoutMs ?? 60000)
        const listener = (msg: XpAck & { apiName: string }) => {
          if (msg.apiName === 'printDone' && msg.reqId === submitReqId) {
            clearTimeout(timer)
            resolveDone(msg)
          }
        }
        socket.addEventListener(listener)
        cleanupDoneListener = () => socket.removeEventListener(listener)
      })

      if (doneRes.errorCode !== 0) {
        printError.value = describeXpError(doneRes.errorCode, doneRes.info)
        ElMessage.error(printError.value)
        return false
      }
      return true
    } catch (err) {
      printError.value = err instanceof Error ? err.message : '打印失败'
      ElMessage.error(printError.value)
      return false
    } finally {
      cleanupDoneListener?.()
      printing.value = false
    }
  }

  onBeforeUnmount(() => {
    /* 共享连接保持打开（与 useNmPrint 一致） */
  })

  return {
    serviceConnected, connecting, printing, ready, discovering,
    agentVersion, printerName, printerList, printError, discoveredDevices,
    connMode, netHost, netPort,
    connectService, refreshStatus, ensureReady, print, selectConnection, discoverDevices,
    XP_AGENT_DOWNLOAD_URL,
  }
}
