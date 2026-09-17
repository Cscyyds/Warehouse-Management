/**
 * 芯烨标签打印组合式封装（镜像 nmPrint/useNmPrint 的结构与实战行为）
 * 职责：打印代理连接管理、代理状态查询、TSPL 脚本直打全流程（提交 → 代理串行执行 → 完成上报）
 * 用法：const xp = useXpPrint(); await xp.ensureReady(); await xp.print({ tsplCommands, qty })
 *
 * ⚠ 与 useNmPrint 一致采用模块级共享单例：WebSocket 与连接状态全应用唯一，
 * 组件卸载不关闭连接。自研代理虽无"多连接卡死"问题，但保持一致的连接
 * 管理，避免多弹窗重复建连。
 *
 * 协议说明见 XpSocket.ts 头注释；代理串行队列保证并发提交按序执行。
 * 份数（qty）经协议传递，由代理重复写入脚本（后端脚本固定 PRINT 1,1，
 * 与精臣"份数由前端提交时控制"的职责划分一致）。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { XpSocket, type XpAck } from './XpSocket'

export const XP_AGENT_DOWNLOAD_URL = `${import.meta.env.BASE_URL}downloads/xprinter-agent-1.0.0.exe`

/** 代理错误码与中文提示（对齐精臣 describePrintError 模式；错误码定义见代理协议） */
export const XP_ERROR_MESSAGES: Record<number, string> = {
  0: '成功',
  1: '未检测到芯烨打印机，请检查打印机电源与 USB 连接后重试',
  2: '打印机端口打开失败，请重新插拔 USB 后重试',
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

/* ———— 模块级共享单例（全应用唯一连接与状态） ———— */
const socket = new XpSocket()
const serviceConnected = ref(false)
const connecting = ref(false)
/** 代理版本（低于协议版本时前端提示升级） */
const agentVersion = ref('')
/** 已连接的芯烨打印机名称（空表示代理未连接打印机） */
const printerName = ref('')
const printerList = ref<string[]>([])
/** 进行中的服务探测（并发调用共享同一结果，避免重复建连） */
let connectPromise: Promise<boolean> | null = null

export interface XpPrintOptions {
  /** 打印份数（与后端 print_qty 同值；由代理重复写入脚本实现） */
  qty: number
  /** 完成等待超时（毫秒），默认 60000 */
  doneTimeoutMs?: number
}

/** 拉取代理状态（代理版本 + USB 打印机列表 + 在线状态）；空列表自动重试（应对 USB 瞬时占用/休眠唤醒） */
async function refreshStatus(retries = 3): Promise<XpAck | null> {
  for (let attempt = 0; ; attempt++) {
    const res = await socket.send({ apiName: 'getStatus' })
    if (res.errorCode !== 0 && attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      continue
    }
    if (res.errorCode !== 0) return null
    if (!res.connected && attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      continue
    }
    serviceConnected.value = true
    agentVersion.value = res.agentVersion || ''
    printerList.value = Array.isArray(res.printers) ? res.printers : []
    printerName.value = res.printerName || printerList.value[0] || ''
    return res
  }
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

export function useXpPrint() {
  const printing = ref(false)
  const printError = ref('')

  const ready = computed(() => serviceConnected.value && !!printerName.value)

  /** 一键就绪：连代理 → 查状态（打印机列表）；stepLog 用于逐步诊断输出 */
  async function ensureReady(stepLog?: (msg: string) => void): Promise<boolean> {
    const log: (msg: string) => void = stepLog ?? ((msg) => console.log('%c[芯烨打印]', 'color:#409eff;font-weight:bold', msg))
    printError.value = ''
    log(`[1] 代理连接状态: ${serviceConnected.value ? '已连' : '未连'}`)
    if (ready.value) { log('[1] 全部就绪（代理+打印机）'); return true }
    if (!await connectService()) {
      printError.value = 'agent-missing'
      log('[1] FAIL: 芯烨打印代理连接失败（未安装或未启动）')
      return false
    }
    log('[2] 代理已连接，查询打印机状态...')
    const status = await refreshStatus()
    if (!status || !printerName.value) {
      printError.value = 'printer-not-connected'
      log('[3] FAIL: 未检测到芯烨打印机')
      return false
    }
    log(`[3] 打印机已连接: ${printerName.value}（代理版本 ${agentVersion.value || '未知'}）`)
    return true
  }

  /**
   * 直打 TSPL 脚本：提交（受理即返回，代理串行队列执行）→ 等待 printDone 完成上报。
   * 份数由代理重复写入脚本；失败时错误码经 describeXpError 转中文提示。
   */
  async function print(tsplCommands: string[], options: XpPrintOptions): Promise<boolean> {
    const qty = Math.max(1, Math.floor(options.qty || 1))
    if (!tsplCommands.length) return false
    if (!await ensureReady()) {
      ElMessage.error(printError.value === 'agent-missing'
        ? '未检测到芯烨打印代理，请安装/启动后重试'
        : printError.value === 'printer-not-connected'
          ? '未检测到芯烨打印机，请检查打印机电源与 USB 连接后重试'
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
    serviceConnected, connecting, printing, ready,
    agentVersion, printerName, printerList, printError,
    connectService, refreshStatus, ensureReady, print,
    XP_AGENT_DOWNLOAD_URL,
  }
}
