/**
 * 精臣标签打印组合式封装
 * 职责：打印服务连接管理、打印机选择连接、批量打印全流程（startJob → 逐页绘制提交 → endJob）
 * 用法：const printer = useNmPrint(); await printer.connect(); await printer.print(pages)
 *
 * ⚠ 连接必须是全局单例：打印服务（jcprinter.exe）在多个客户端并发连接时会卡死
 * （实测：一个浏览器标签页泄漏 7 条连接后，服务对所有新指令不再应答），
 * 因此 WebSocket、连接状态、打印机状态均为模块级共享，组件卸载也不关闭连接。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { NmSocket, printServiceReady, type PrintListener, type SdkMessage } from './Socket'
import { NMPrint, describePrintError, type LabelPage } from './NMPrint'

export const PRINT_SERVICE_DOWNLOAD_URL = `${import.meta.env.BASE_URL}downloads/jcPrinterSdk_4.0.6_20251120.exe`
/** USB 虚拟串口驱动（仅 Win7 老机型需要） */
export const USB_DRIVER_DOWNLOAD_URL = `${import.meta.env.BASE_URL}downloads/driver/USB-Driver-Installer-1.0.3.0.exe`

/** SDK startJob 纸张类型数值枚举（后端/弹窗用中文，SDK 用数字） */
export const LABEL_TYPE_TO_CODE: Record<string, number> = {
  '间隙纸': 1, '黑标纸': 2, '连续纸': 3, '定孔纸': 4, '过孔纸': 4, '透明纸': 5, '标牌': 6, '黑标间隙纸': 10,
}

/** SDK startJob 打印模式数值枚举 */
export const PRINT_MODE_TO_CODE: Record<string, number> = {
  '热敏': 1, '热转印': 2,
}

/* ———— 模块级共享单例（全应用唯一连接与状态） ———— */
const socket = new NmSocket()
const sdk = new NMPrint(socket)
const serviceConnected = ref(false)
const sdkInited = ref(false)
const connecting = ref(false)
/** 已连接的打印机名称（空表示未连接打印机） */
const printerName = ref('')
const printerList = ref<Array<{ name: string; port: number }>>([])
/** 进行中的服务探测（并发调用共享同一结果，避免重复建连） */
let connectPromise: Promise<boolean> | null = null

/** 打印选项：硬件参数来自打印机型号配置与用户在弹窗中的选择 */
export interface PrintJobOptions {
  /** 每页打印份数（与后端 print_qty 同值） */
  quantity: number
  /** 浓度（后端 printer_config.density_default 或用户选择） */
  density: number
  /** 纸张类型中文值（如“间隙纸”） */
  labelType: string
  /** 硬件打印模式中文值（如“热敏”） */
  printModeHardware: string
}

export interface PrintProgress {
  /** 已完成页数（从 1 计） */
  page: number
  total: number
  detail: string
}

/** 初始化 SDK 并同步连接状态；打印服务偶发忽略新连接的首条指令（实测复现），超时错误码 22 需重试 */
async function initSdkAndSync(): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 600))
    try {
      const res = await sdk.initSdk()
      if (res.resultAck?.errorCode === 0) {
        sdkInited.value = true
        serviceConnected.value = true
        return true
      }
      // 非超时错误（服务异常等）重试无意义，直接结束
      if (res.resultAck?.errorCode !== 22) break
    } catch {
      break
    }
  }
  sdkInited.value = false
  serviceConnected.value = false
  return false
}

function onOpenChange(open: boolean) {
  if (!open) {
    serviceConnected.value = false
    printerName.value = ''
    return
  }
  if (sdkInited.value) {
    serviceConnected.value = true
    return
  }
  // 断线自动重连成功但 SDK 尚未初始化：补 initSdk，让"未检测到打印服务"提示自动消失
  void initSdkAndSync()
}

/** 探测并连接打印服务；服务启动慢/首次握手偶发失败时自动重试，未安装时 serviceConnected 保持 false */
async function connectService(): Promise<boolean> {
  if (printServiceReady(socket)) {
    // 连接已建立（可能来自断线自动重连）但 SDK 未初始化时补一次 initSdk
    serviceConnected.value = sdkInited.value || await initSdkAndSync()
    return serviceConnected.value
  }
  if (connectPromise) return connectPromise
  connecting.value = true
  connectPromise = (async () => {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1200))
        try {
          // open() 失败会 reject；后台自动重连也可能先建成，open() 内部会直接复用已连接的 socket
          await Promise.race([socket.open(onOpenChange), new Promise((resolve) => setTimeout(resolve, 2500))])
        } catch {
          continue
        }
        if (printServiceReady(socket) && await initSdkAndSync()) return true
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

/** 拉取 USB 打印机列表；打印服务对设备的枚举是瞬时的（设备被占用/休眠唤醒期间返回空），空列表时自动重试 */
async function refreshPrinters(retries = 3): Promise<Array<{ name: string; port: number }>> {
  for (let attempt = 0; ; attempt++) {
    const res = await sdk.getAllPrinters()
    if (res.resultAck?.errorCode !== 0 && attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      continue
    }
    if (res.resultAck?.errorCode !== 0) return []
    // 打印服务返回 info = { "<name>": "<port>" } 形态（端口为字符串）
    let raw: Record<string, unknown> | undefined
    try {
      raw = res.resultAck?.info ? JSON.parse(res.resultAck.info) : (res.result as Record<string, unknown>)
    } catch {
      raw = undefined
    }
    const list = Object.entries(raw ?? {}).map(([name, port]) => ({ name, port: Number(port) }))
    if (!list.length && attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      continue
    }
    printerList.value = list
    return list
  }
}

/** 连接指定打印机（不传则连列表第一台） */
async function connectPrinter(target?: { name: string; port: number }): Promise<boolean> {
  let printer = target
  if (!printer) {
    const list = printerList.value.length ? printerList.value : await refreshPrinters()
    printer = list[0]
  }
  if (!printer) return false
  const res = await sdk.selectPrinter(printer.name, printer.port)
  const ok = res.resultAck?.errorCode === 0
  if (ok) printerName.value = printer.name
  else ElMessage.error(describePrintError(res.resultAck?.errorCode ?? 0, res.resultAck?.info))
  return ok
}

export function useNmPrint() {
  const printing = ref(false)
  const progress = ref<PrintProgress | null>(null)
  const printError = ref('')

  const ready = computed(() => serviceConnected.value && sdkInited.value && !!printerName.value)

  let messageListener: PrintListener | undefined
  /** 打印流转所需的临时状态 */
  let jobContext: { total: number; quantity: number; pages: LabelPage[]; next: number } | null = null

  /** 一键就绪：连服务 → initSdk → 连打印机；stepLog 用于逐步诊断输出（默认输出到 Console） */
  async function ensureReady(stepLog?: (msg: string) => void): Promise<boolean> {
    const log: (msg: string) => void = stepLog ?? ((msg) => console.log('%c[精臣打印]', 'color:#e6a23c;font-weight:bold', msg))
    printError.value = ''
    log(`[1] 服务连接状态: ${serviceConnected.value ? '已连' : '未连'}`)
    if (ready.value) { log('[1] 全部就绪（服务+SDK+打印机）'); return true }
    if (!await connectService()) {
      printError.value = 'print-service-missing'
      log('[1] FAIL: 打印服务连接失败（未安装或未启动）')
      return false
    }
    log(`[2] SDK 初始化完成，枚举打印机...`)
    const list = await refreshPrinters()
    log(`[2] getAllPrinters 返回 ${list.length} 台: ${list.map((p) => `${p.name}@${p.port}`).join(', ') || '（空）'}`)
    if (!printerName.value && !await connectPrinter()) {
      printError.value = 'printer-not-connected'
      log('[3] FAIL: 打印机连接失败')
      return false
    }
    log(`[3] 打印机已连接: ${printerName.value}`)
    return true
  }

  /**
   * 批量打印全部页（页数据来自后端 print_data，前端原样透传）。
   * 内部流程：startJob（count=总份数）→ 逐页绘制提交 → 由 commitJob ok 上报驱动后续页 → 全部完成 endJob
   */
  async function print(pages: LabelPage[], options: PrintJobOptions): Promise<boolean> {
    const quantity = Math.max(1, Math.floor(options.quantity || 1))
    if (!pages.length) return false
    if (!await ensureReady()) {
      // ensureReady 内部已写 printError 并输出 Console 诊断日志，此处补一次界面提示
      ElMessage.error(printError.value === 'print-service-missing'
        ? '未检测到本机打印服务，请安装/启动打印服务后重试'
        : printError.value === 'printer-not-connected'
          ? '未检测到打印机，请检查打印机电源与 USB 连接后重试'
          : printError.value || '打印机未就绪')
      return false
    }

    const labelTypeCode = LABEL_TYPE_TO_CODE[options.labelType]
    const printModeCode = PRINT_MODE_TO_CODE[options.printModeHardware]
    if (!labelTypeCode || !printModeCode) {
      printError.value = `硬件参数不支持：纸张「${options.labelType}」/模式「${options.printModeHardware}」`
      ElMessage.error(printError.value)
      return false
    }

    printing.value = true
    printError.value = ''
    progress.value = { page: 0, total: pages.length, detail: '开始打印任务' }
    jobContext = { total: pages.length, quantity, pages, next: 0 }
    /** 绘制提交进行中标记，防止 "commitJob ok!" 信号重入导致并发绘制 */
    let drawing = false
    /** 兜底：个别机型不发就绪信号时，超时后主动绘制首页 */
    let goSignalFallback: ReturnType<typeof setTimeout> | undefined

    // 设备主动上报驱动页流转（官方协议：startJob 后设备先推 "commitJob ok!" 就绪信号，
    // 每页 commit 后再推一次驱动下一页；进度上报 printPages=当前页 / printCopies=当前份）
    const log: (msg: string) => void = (msg) => console.log('%c[精臣打印]', 'color:#e6a23c;font-weight:bold', msg)
    messageListener = sdk.addPrintListener(async (msg: SdkMessage) => {
      const ack = msg.resultAck
      if (!ack) return
      if (ack.errorCode !== 0) {
        printError.value = describePrintError(ack.errorCode, ack.info)
        ElMessage.error(printError.value)
        log(`[6] FAIL 设备上报错误: ${printError.value}`)
        await cleanupJob()
        return
      }
      const ctx = jobContext
      if (!ctx) return
      if (ack.info === 'commitJob ok!' && ctx.next < ctx.total && !drawing) {
        clearTimeout(goSignalFallback)
        drawing = true
        try {
          log(`[6] 收到 commitJob ok 信号（第 ${ctx.next + 1} 页就绪），开始绘制`)
          await submitNextPage(log)
        } finally {
          drawing = false
        }
        return
      }
      if (ack.printCopies != null && ack.printPages != null) {
        progress.value = { page: ack.printPages, total: ctx.total, detail: `第 ${ack.printPages} 页 · 第 ${ack.printCopies}/${ctx.quantity} 份` }
        if (ack.printCopies === ctx.quantity && ack.printPages === ctx.total) {
          const endRes = await sdk.endJob()
          if (endRes.resultAck?.errorCode !== 0) {
            printError.value = describePrintError(endRes.resultAck?.errorCode ?? 0, endRes.resultAck?.info)
          }
          progress.value = { page: ctx.total, total: ctx.total, detail: '打印完成' }
          log('[6] 全部页完成，endJob 已发送')
          await cleanupJob()
        }
      }
    })

    try {
      log(`[4] startJob(浓度=${options.density}, 纸张=${options.labelType}→${labelTypeCode}, 模式=${options.printModeHardware}→${printModeCode}, 总份数=${pages.length * quantity})`)
      const startRes = await sdk.startJob(options.density, labelTypeCode, printModeCode, pages.length * quantity)
      if (startRes.resultAck?.errorCode !== 0) {
        printError.value = describePrintError(startRes.resultAck?.errorCode ?? 0, startRes.resultAck?.info)
        ElMessage.error(printError.value)
        log(`[4] FAIL: ${printError.value}`)
        await cleanupJob()
        return false
      }
      log('[4] startJob 成功，等待设备就绪信号（commitJob ok）...')
      goSignalFallback = setTimeout(() => {
        const ctx = jobContext
        if (ctx && ctx.next === 0 && !drawing) {
          log('[4] 未收到就绪信号，超时后主动绘制首页')
          drawing = true
          submitNextPage(log).finally(() => { drawing = false })
        }
      }, 6000)
      // 页流转由设备上报（listener）驱动，直至 endJob
      return true
    } catch (err) {
      printError.value = err instanceof Error ? err.message : '打印失败'
      ElMessage.error(printError.value)
      log(`[X] 异常: ${printError.value}`)
      await cleanupJob()
      return false
    }
  }

  /** 绘制并提交下一页：设备打印画板缓存，commitJob 的 printData 恒为 null */
  async function submitNextPage(stepLog?: (msg: string) => void) {
    const log = stepLog ?? (() => {})
    const ctx = jobContext
    if (!ctx || ctx.next >= ctx.total) return
    const page = ctx.pages[ctx.next]
    ctx.next++
    log(`[5] 绘制第 ${ctx.next}/${ctx.total} 页：画板 ${page.InitDrawingBoardParam.width}×${page.InitDrawingBoardParam.height}mm，${page.elements.length} 个元素`)
    const board = await sdk.InitDrawingBoard(page.InitDrawingBoardParam)
    if (board.resultAck?.errorCode !== 0) {
      printError.value = describePrintError(board.resultAck?.errorCode ?? 0, board.resultAck?.info)
      ElMessage.error(printError.value)
      await cleanupJob()
      return
    }
    for (const element of page.elements) {
      const res = await sdk.drawElement(element)
      if (res.resultAck?.errorCode !== 0) {
        printError.value = describePrintError(res.resultAck?.errorCode ?? 0, res.resultAck?.info)
        ElMessage.error(printError.value)
        log(`[5] FAIL 绘制元素 ${element.type}: ${printError.value}`)
        await cleanupJob()
        return
      }
    }
    log(`[5] 第 ${ctx.next} 页绘制完成，提交 commitJob(printData=null)...`)
    await sdk.commitJob(ctx.quantity)
  }

  async function cleanupJob() {
    if (messageListener) {
      sdk.removePrintListener(messageListener)
      messageListener = undefined
    }
    jobContext = null
    printing.value = false
    // 设备连接是独占的：任务结束（无论成败）显式释放，避免占用导致后续 getAllPrinters 返回空
    try {
      await sdk.closePrinter()
    } catch {
      /* 释放失败不阻塞流程，下次 connectPrinter 会重新选择 */
    }
    printerName.value = ''
  }

  /** 生成第一页预览图（base64）；官方预览链路只需服务连接+SDK 初始化，无需连接打印机（失败抛出具体原因） */
  async function preview(pages: LabelPage[]): Promise<string | null> {
    printError.value = ''
    if (!await connectService()) {
      printError.value = 'print-service-missing'
      throw new Error('未检测到本机打印服务，请安装/启动打印服务后重试')
    }
    return await sdk.generatePreviewImage(pages)
  }

  onBeforeUnmount(() => {
    // 仅清理本实例的任务监听器；共享连接保持打开（服务多连接会卡死，见文件头说明）
    if (messageListener) sdk.removePrintListener(messageListener)
  })

  return {
    serviceConnected, sdkInited, connecting, printing, ready,
    printerName, printerList, progress, printError,
    connectService, refreshPrinters, connectPrinter, ensureReady,
    print, preview, PRINT_SERVICE_DOWNLOAD_URL,
  }
}
