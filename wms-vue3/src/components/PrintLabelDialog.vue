<script setup lang="ts">
/**
 * 通用标签打印弹窗（产品条码 / 货位条码 / 塑料盒条码共用）
 *
 * 双模式：
 *  - 勾选多条：提交到「打印任务」队列（后端持久化，来源=REPRINT 补打），由打印任务
 *    页面选打印机后出纸；中途关页面/断网不会丢任务。
 *  - 单条：本页直打，流程为 选打印机型号 → 选标签规格 → 选硬件打印模式与纸张类型 → 预览/打印
 * 数据链：型号/规格来自主后端（接口25/26）；打印数据来自扫码枪后端 print 接口；
 *         按响应 sdk_type 分流——JC（精臣）本地 SDK 绘制直打；XP（芯烨）TSPL 脚本
 *         经本机打印代理直打（预览为后端内联 base64 PDF）；情况B 直接展示临时 PDF
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { getVisiblePrinterList, getVisiblePrinterDetail, type PrinterModelItem, type PrinterLabelSpecItem } from '@/api'
import { printPlasticBox, printProductBarcode, printLocationBarcode, deletePrintTempFiles, type BarcodePrintResult, type PrintData } from '@/api'
import { useNmPrint, PRINT_SERVICE_DOWNLOAD_URL, USB_DRIVER_DOWNLOAD_URL } from '@/utils/nmPrint/useNmPrint'
import { useXpPrint, XP_AGENT_DOWNLOAD_URL } from '@/utils/xpPrint/useXpPrint'
import type { XpDiscoveredDevice } from '@/utils/xpPrint/XpSocket'
import { mapBackendPrintData } from '@/utils/nmPrint/printDataMapper'
import {
  createPrintTasks,
  PRINT_TASK_SOURCE_REPRINT,
  type CreatePrintTasksResult,
  type PrintTaskCreateItem,
} from '@/api/modules/printTask'

export type PrintKind = 'product' | 'location' | 'plasticBox'

interface PrintRow {
  id: string
  /** 弹窗顶部展示的主文本（产品名/货位名/塑料盒名） */
  title: string
  /** 次要文本（编码等） */
  subtitle?: string
}

const props = defineProps<{
  modelValue: boolean
  kind: PrintKind
  rows: PrintRow[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** 打印成功后回调（业务页可刷新打印统计） */
  printed: [count: number]
}>()

const KIND_META: Record<PrintKind, { title: string; previewApiName: string }> = {
  product: { title: '产品条码打印', previewApiName: '产品条码打印接口' },
  location: { title: '货位条码打印', previewApiName: '货位条码打印接口' },
  plasticBox: { title: '塑料盒条码打印', previewApiName: '塑料盒条码打印接口' },
}

/** 弹窗 kind → 打印任务 biz_type（与后端 BIZ_TYPE_LABELS 一致） */
const KIND_BIZ_TYPE: Record<PrintKind, string> = {
  product: 'PRODUCT',
  plasticBox: 'PLASTIC_BOX',
  location: 'LOCATION',
}

/**
 * 勾选多条 → 走打印任务队列（后端持久化，防丢），由「打印任务」页面统一出纸；
 * 单条仍在本页直打。两种模式的参数需求不同，模板按此分流。
 */
const isBatchMode = computed(() => props.rows.length > 1)

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const nm = useNmPrint()
const xp = useXpPrint()
const router = useRouter()

/* —— 芯烨连接方式选择（USB 线 / WiFi 网络；仅选中芯烨型号时展示）——
 * xpModeChoice 是用户的选择（未应用），xp.connMode 是代理当前生效的方式：
 * USB 切换即时探测应用；WiFi 填好 IP 后自动探测（也可点「测试连接」手动重试）；打印前强制两者一致。 */
const xpModeChoice = ref<'usb' | 'net'>(xp.connMode.value)
const xpTesting = ref(false)
const xpApplyError = ref('')

/**
 * 代理的状态类错误码（`printError` 里的哨兵值）转中文。
 * 不做映射会把内部码直接漏到界面上（截图里那行红色的 `agent-missing` 就是）。
 */
function describeXpStatusError(raw: string): string {
  if (raw === 'agent-missing') return '未检测到芯烨打印代理，请先点「下载安装包」安装并启动'
  if (raw === 'printer-not-connected') return '未检测到芯烨打印机，请检查打印机电源与连接'
  return raw || '连接失败，请检查后重试'
}

/** 把选择下发给代理并真实探测（USB=枚举；WiFi=开闭端口），成功后代理持久切换 */
async function applyXpMode(): Promise<boolean> {
  xpTesting.value = true
  xpApplyError.value = ''
  try {
    const ok = await xp.selectConnection(xpModeChoice.value, xp.netHost.value, xp.netPort.value)
    if (!ok) xpApplyError.value = describeXpStatusError(xp.printError.value)
    return ok
  } finally {
    xpTesting.value = false
  }
}

/**
 * WiFi 自动探测：地址已知时自动下发一次 connect，不必每次手点「测试连接」。
 *
 * ⚠️ 能力边界：浏览器**无法扫描局域网**（拿不到本机 IP、不能发 UDP 广播），代理目前也只认
 * `connect(mode,host,port)`（指令集：getStatus / connect / print），没有"发现打印机"的指令。
 * 所以这里能自动化的只是「用已保存/已填写的地址去探测」；要真正做到"自动发现同一 WiFi 下的
 * 打印机"，需要代理侧新增一条扫描指令（遍历本机网段并发探测 9100 端口）。
 */
async function xpAutoDetectPrinter(): Promise<void> {
  if (xpModeChoice.value !== 'net') return
  if (!xp.netHost.value.trim()) return
  if (xp.ready.value) return
  await applyXpMode()
}

/** USB 无需参数，切换即应用；WiFi 只要地址已知就自动探测一次（无地址则不打扰，等用户填/点测试） */
watch(xpModeChoice, (mode) => {
  if (mode === 'usb') {
    void applyXpMode()
    return
  }
  void xpAutoDetectPrinter()
})

async function onXpTest() {
  if (xpModeChoice.value === 'net' && !xp.netHost.value.trim()) {
    ElMessage.warning('请先填写打印机的 IP 地址')
    return
  }
  if (await applyXpMode()) {
    ElMessage.success(xpModeChoice.value === 'net' ? `WiFi 连接成功：${xp.printerName.value}` : 'USB 打印机连接成功')
  } else {
    ElMessage.warning(xpApplyError.value)
  }
}

/* —— 局域网发现（「搜索设备」）——
 * SDK 只回 MAC / IP / 掩码 / 网关 / dhcp，**没有型号与 SN**，所以列表只能显示「IP + MAC」。 */
/** 搜索结果的选中值（mac 优先，回退 ip） */
const pickedDevice = ref('')
/** 搜索后的一次性提示（未搜到原因 / 已自动连接） */
const discoverHint = ref('')

/** 「搜索设备」：广播一次发现；只有一台时直接自动连接，多台让用户在下拉里挑 */
async function onDiscoverDevices() {
  discoverHint.value = ''
  pickedDevice.value = ''
  const devices = await xp.discoverDevices()
  if (!devices.length) {
    // 有明确失败原因就直接透出（如"代理版本较低不支持搜索"），否则才给"没搜到"的排查指引
    discoverHint.value = xp.printError.value
      ? (xp.printError.value === 'agent-missing'
          ? '未检测到芯烨打印代理，请先安装并启动代理后重试'
          : xp.printError.value)
      : '未搜索到打印机：请确认打印机与本机连在同一个 WiFi；云打印版固件的 WiFi 只连云服务器，不支持本机发现'
    return
  }
  ElMessage.success(`搜索到 ${devices.length} 台设备`)
  if (devices.length === 1) {
    await pickDiscoveredDevice(devices[0])
    return
  }
  discoverHint.value = '请在上方下拉里选择要连接的打印机'
}

/** 选中一台设备：填入 IP（端口沿用当前值）→ 自动连接一次 */
async function pickDiscoveredDevice(device: XpDiscoveredDevice) {
  pickedDevice.value = device.mac || device.ip
  xp.netHost.value = device.ip
  if (await applyXpMode()) {
    discoverHint.value = `已填入 ${device.ip} 并连接成功`
    ElMessage.success(`已连接：${xp.printerName.value || device.ip}`)
  } else {
    discoverHint.value = `已填入 ${device.ip}，但连接失败：${xpApplyError.value || '请检查打印机网络'}`
    ElMessage.warning(xpApplyError.value || '连接失败，请检查打印机网络')
  }
}

async function onPickDiscoveredDevice(value: string) {
  const device = xp.discoveredDevices.value.find((item) => (item.mac || item.ip) === value)
  if (device) await pickDiscoveredDevice(device)
}

/* —— 型号 / 规格 —— */
const modelLoading = ref(false)
const modelOptions = ref<PrinterModelItem[]>([])
const modelCode = ref('')
const specLoading = ref(false)
const specOptions = ref<PrinterLabelSpecItem[]>([])
const specId = ref('')

const currentModel = computed(() => modelOptions.value.find((item) => item.model_code === modelCode.value) || null)
const currentSpec = computed(() => specOptions.value.find((item) => item.spec_id === specId.value) || null)
/** 硬件打印模式选项来自型号支持列表（中文） */
const printModeOptions = computed(() => currentModel.value?.supported_print_modes ?? [])
/** 纸张类型选项来自型号支持列表（中文） */
const labelTypeOptions = computed(() => currentModel.value?.supported_label_types ?? [])

const printModeHardware = ref('')
const labelType = ref('')
const printQty = ref(1)
const density = ref(0)

/* —— 打印状态 —— */
const preparing = ref(false)
const printingNow = ref(false)
/** 情况B：临时 PDF 地址（批量时一行一个，需全部展示与清理） */
const pdfUrls = ref<string[]>([])
const pdfExpireSeconds = ref(0)
/** 批量打印进行中的行进度（逐张出纸耗时长，不给反馈会被当成卡死） */
const batchHint = ref('')
/** 情况A：SDK 预览图（精臣） */
const previewImage = ref('')
/** 情况C：芯烨内联预览 PDF（base64 data URI） */
const previewPdfBase64 = ref('')
let disposed = false
let previewRequest = 0
let specRequest = 0

const canSubmit = computed(() => {
  if (!props.rows.length || printQty.value <= 0) return false
  // 批量入队只需份数：型号/规格等属于直打参数，由「打印任务」页面选择
  if (isBatchMode.value) return true
  return !modelLoading.value && !specLoading.value && !!modelCode.value && !!specId.value && !!printModeHardware.value && !!labelType.value
})

async function loadModels() {
  modelLoading.value = true
  try {
    const res = await getVisiblePrinterList({ page: 1, page_size: 100, sort_by: 'model_name', sort_order: 'ASC' })
    modelOptions.value = res.data.list || []
  } catch {
    modelOptions.value = []
  } finally {
    modelLoading.value = false
  }
}

async function loadSpecs(modelCodeValue: string) {
  const request = ++specRequest
  specOptions.value = []
  specId.value = ''
  specLoading.value = false
  if (!modelCodeValue) return
  specLoading.value = true
  try {
    const res = await getVisiblePrinterDetail(modelCodeValue)
    if (disposed || request !== specRequest) return
    specOptions.value = res.data.label_specs || []
    const model = res.data
    // 默认值：默认规格、默认浓度、型号支持的第一个模式/纸张
    const defaultSpec = specOptions.value.find((item) => item.is_default === 1) || specOptions.value[0]
    if (defaultSpec) specId.value = defaultSpec.spec_id
    density.value = model.density_default
    printModeHardware.value = model.supported_print_modes?.[0] || ''
    labelType.value = model.supported_label_types?.[0] || ''
  } catch {
    if (request === specRequest) specOptions.value = []
  } finally {
    if (request === specRequest) specLoading.value = false
  }
}

watch(modelCode, (value) => { void loadSpecs(value) })

function resetPrintState() {
  pdfUrls.value = []
  previewImage.value = ''
  previewPdfBase64.value = ''
  pdfExpireSeconds.value = 0
  printQty.value = 1
}

/** 调对应业务类型的打印接口（print_mode 由调用方指定；行由调用方传入，批量时逐行取数） */
async function callPrintApi(printMode: 'PREVIEW' | 'PRINT', row: PrintRow): Promise<BarcodePrintResult> {
  const common = {
    printer_model_code: modelCode.value,
    label_spec_id: specId.value,
    print_mode: printMode,
    print_mode_hardware: printModeHardware.value,
    label_type: labelType.value,
    print_qty: printQty.value,
    density: density.value || undefined,
  }
  if (props.kind === 'plasticBox') return printPlasticBox(row.id, common)
  if (props.kind === 'location') return printLocationBarcode(row.id, common)
  return printProductBarcode(row.id, common)
}

/** 预览：PREVIEW 调后端；按 sdk_type 分流——JC 走本地 SDK 生图，XP 渲染内联 base64 PDF，情况B 展示 PDF 链接 */
async function handlePreview() {
  if (!canSubmit.value || preparing.value || printingNow.value || nm.printing.value || xp.printing.value) return
  preparing.value = true
  const request = ++previewRequest
  try {
    // 打印机探测仅限精臣；芯烨由 xp 代理自行保证（xp.print/useXpPrint 内部自检代理与打印机）
    if (selectedBrand.value !== '芯烨' && currentModel.value?.has_preview_capability === 1 && !await nm.detectPrinter(undefined, '预览')) {
      if (!disposed && request === previewRequest) ElMessage.warning(nm.printError.value)
      return
    }
    if (disposed || request !== previewRequest || !open.value) return
    // 预览只看第一条（标签内容逐条不同，核对版式用）；全部条目由「打印」逐条出纸
    const result = await callPrintApi('PREVIEW', props.rows[0])
    if (disposed || request !== previewRequest || !open.value) return
    if (result.printer_has_preview_capability && result.print_data) {
      if (result.sdk_type === 'XP') {
        // 芯烨：浏览器无法渲染 TSPL，预览为后端内联 PDF（生成失败时为 null，不阻塞打印）
        xpLog('预览：后端返回 TSPL 脚本 + 内联预览 PDF')
        if (result.preview_pdf_base64) {
          previewPdfBase64.value = `data:application/pdf;base64,${result.preview_pdf_base64}`
          previewImage.value = ''
          pdfUrls.value = []
        } else {
          xpLog('预览：后端 PDF 生成失败（降级），可直接打印')
          ElMessage.warning('预览暂不可用（预览图生成失败），可直接点击打印')
        }
        return
      }
      if (result.sdk_type === 'JC') {
        sdkLog('预览：后端返回 SDK 数据，开始本地生成预览图...')
        try {
          const image = await nm.preview(normalizePages(result.print_data))
          if (image) {
            previewImage.value = image
            previewPdfBase64.value = ''
            pdfUrls.value = []
            return
          }
          sdkLog('预览：SDK 未返回图像数据（ImageData 为空）')
        } catch (err) {
          // SDK 阶段失败原因透出（未装打印服务/打印机未连接/绘制报错），不阻塞 PDF 分支
          const msg = err instanceof Error ? err.message : '本地预览失败'
          sdkLog(`预览失败: ${msg}`)
          ElMessage.warning(msg)
          if (!result.pdf_url) return
        }
      } else {
        sdkLog(`预览：未知 sdk_type=${result.sdk_type}，不喂精臣 SDK`)
        if (!result.pdf_url) return
      }
    } else {
      sdkLog(`预览：后端未走 SDK 分支（has_preview=${result.printer_has_preview_capability}, print_data=${result.print_data ? '有' : '无'}）`)
    }
    if (result.pdf_url) {
      pdfUrls.value = [result.pdf_url]
      pdfExpireSeconds.value = result.expire_seconds || 300
      previewImage.value = ''
      previewPdfBase64.value = ''
    } else if (!previewImage.value && !previewPdfBase64.value) {
      ElMessage.warning('预览生成失败：SDK 未返回预览图且无 PDF 可展示，请查看 Console [精臣打印]/[芯烨打印] 日志')
    }
  } catch {
    /* 拦截器已提示 */
  } finally {
    preparing.value = false
  }
}

/** 后端 print_data（像素/字符串枚举）→ SDK LabelPage（毫米/数字枚举） */
function normalizePages(printData: PrintData) {
  return [mapBackendPrintData(printData)]
}

/** SDK 逐步诊断日志（F12 Console 可见） */
function sdkLog(msg: string) { console.log('%c[精臣打印]', 'color:#e6a23c;font-weight:bold', msg) }
function xpLog(msg: string) { console.log('%c[芯烨打印]', 'color:#409eff;font-weight:bold', msg) }

/**
 * 精臣 nm.print() 在 startJob 受理后即返回，真正出纸由设备 commitJob 信号异步驱动，
 * 且 useNmPrint 的 jobContext 是模块级单例——批量时必须等上一张收尾再提交下一张，
 * 否则会覆盖掉前一张还没画完的页。
 */
async function waitNmJobSettled(timeoutMs = 120000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (nm.printing.value && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  if (nm.printing.value) sdkLog('等待出纸收尾超时，中止后续打印')
  return !nm.printing.value
}

/** 单条标签直打：JC 走本地 SDK，XP 走本机代理；'pdf' 表示该打印机无生图能力、只拿到临时 PDF */
async function printRowDirect(result: BarcodePrintResult): Promise<'ok' | 'pdf' | 'fail'> {
  if (result.printer_has_preview_capability && result.print_data) {
    if (result.sdk_type === 'XP') {
      xpLog(`开始打印：${result.print_data.tspl_commands?.length ?? 0} 行 TSPL 指令 × ${printQty.value} 份（${xp.connMode.value === 'net' ? 'WiFi' : 'USB'}）`)
      return await xp.print(result.print_data.tspl_commands || [], { qty: printQty.value }) ? 'ok' : 'fail'
    }
    if (result.sdk_type === 'JC') {
      try {
        const pages = normalizePages(result.print_data)
        sdkLog(`转换后页数据: 画板 ${pages[0].InitDrawingBoardParam.width}×${pages[0].InitDrawingBoardParam.height}mm, ${pages[0].elements.length} 个元素（原始 ${result.print_data.elements?.length ?? 0} 个）`)
        const accepted = await nm.print(pages, {
          quantity: printQty.value,
          density: density.value,
          labelType: labelType.value,
          printModeHardware: printModeHardware.value,
        })
        return accepted && await waitNmJobSettled() ? 'ok' : 'fail'
      } catch (err) {
        sdkLog(`打印异常: ${err instanceof Error ? (err.stack || err.message) : String(err)}`)
        return 'fail'
      }
    }
    // 防御：后端新增品牌而前端未适配时，绝不把非 JC 数据喂给精臣 SDK
    ElMessage.error(`暂不支持该打印机的直打（sdk_type=${result.sdk_type}），请联系管理员`)
    return 'fail'
  }
  if (result.pdf_url) return 'pdf'
  ElMessage.error('打印数据生成异常（无直打数据且无 PDF），请重试或联系管理员')
  return 'fail'
}

/* —— 批量入队：勾选多条时提交打印任务，由「打印任务」页面统一出纸 —— */

/**
 * 本批次的幂等键：一次提交生成一次，**失败重试复用同一值**——后端按
 * (company, biz_type, biz_id) 幂等，重复提交只会被跳过，不会重复入队。
 */
let batchNo = ''

function ensureBatchNo(): string {
  if (!batchNo) {
    batchNo = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
  return batchNo
}

/** 提交结果反馈：成功条数 + 未提交原因，并提供跳转到打印任务页 */
async function reportBatchResult(result: CreatePrintTasksResult) {
  const failed = [...result.skipped, ...result.invalid]
  const reasons = [...new Set(failed.map((item) => item.reason))].filter(Boolean)

  if (!result.created.length) {
    ElMessageBox.alert(
      `没有任务被提交${reasons.length ? `：${reasons.slice(0, 3).join('；')}` : '，请稍后重试'}`,
      '提交失败',
      { confirmButtonText: '知道了', type: 'warning' },
    ).catch(() => undefined)
    return
  }

  const failedNote = failed.length ? `，另有 ${failed.length} 条未提交（${reasons.slice(0, 2).join('；')}）` : ''
  try {
    await ElMessageBox.confirm(
      `已提交 ${result.created.length} 条打印任务${failedNote}。请到「打印任务」页面选择打印机后出纸。`,
      failed.length ? '部分提交成功' : '已进入打印队列',
      { confirmButtonText: '去打印任务页', cancelButtonText: '留在本页', type: failed.length ? 'warning' : 'success' },
    )
    await router.push('/warehouse/print-task')
  } catch { /* 用户选择留在本页 */ }
}

/** 批量提交到打印任务队列（来源=补打）：不在本页出纸，任务已持久化，不怕中途关页面丢失 */
async function submitBatchAsTasks() {
  const rows = props.rows
  try {
    await ElMessageBox.confirm(
      `将把 ${rows.length} 条标签提交到打印任务队列（每条 ${printQty.value} 份），由「打印任务」页面统一出纸。`,
      '提交到打印队列',
      { confirmButtonText: '确认提交', cancelButtonText: '取消' },
    )
  } catch { return }

  printingNow.value = true
  try {
    const items: PrintTaskCreateItem[] = rows.map((row) => ({
      biz_type: KIND_BIZ_TYPE[props.kind],
      biz_id: row.id,
      biz_desc: [row.title, row.subtitle].filter(Boolean).join(' ') || row.id,
      print_qty: printQty.value,
    }))
    const result = await createPrintTasks(PRINT_TASK_SOURCE_REPRINT, items, ensureBatchNo())
    batchNo = '' // 本批次已落库，下一批重新取幂等键
    open.value = false
    emit('printed', result.created.length)
    await reportBatchResult(result)
  } catch {
    /* 拦截器已提示；保留 batchNo，用户重试时复用同一幂等键 */
  } finally {
    printingNow.value = false
  }
}

/** 正式打印：逐条「取数 → 直打」；任一条失败即停——打印机故障不会自愈，继续只会刷出一串失败 */
async function handlePrint() {
  if (!canSubmit.value || preparing.value || printingNow.value || nm.printing.value || xp.printing.value) {
    if (!printingNow.value) sdkLog(`点击打印但条件不满足：model=${modelCode.value} spec=${specId.value} mode=${printModeHardware.value} label=${labelType.value} rows=${props.rows.length} qty=${printQty.value}`)
    return
  }
  // 勾选多条：进入打印任务队列排队并持久化，不在本页逐条直打
  if (isBatchMode.value) {
    await submitBatchAsTasks()
    return
  }
  const rows = props.rows
  sdkLog(`【入口】点击了打印按钮，共 ${rows.length} 条`)
  printingNow.value = true
  const pdfs: string[] = []
  let printed = 0
  let failedIndex = -1
  let failReason = ''
  try {
    // 打印机探测仅限精臣；芯烨由 xp 代理自行保证（xp.print 内部自检代理与打印机）
    if (selectedBrand.value !== '芯烨' && currentModel.value?.has_preview_capability === 1 && !await nm.detectPrinter(undefined, '打印')) {
      ElMessage.warning(nm.printError.value)
      return
    }
    // 芯烨：用户切了连接方式但未点测试时，整批开始前对齐一次（逐条对齐会反复重连代理）
    if (selectedBrand.value === '芯烨' && xpModeChoice.value !== xp.connMode.value && !await applyXpMode()) {
      ElMessage.warning(`连接方式切换失败：${xpApplyError.value || '请检查打印机连接'}`)
      return
    }
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      batchHint.value = rows.length > 1 ? `正在打印第 ${index + 1}/${rows.length} 条：${row.title}` : ''
      let result: BarcodePrintResult
      try {
        result = await callPrintApi('PRINT', row)
      } catch {
        // 接口错误拦截器已提示，这里只负责定位失败的是哪一条
        failedIndex = index
        failReason = '打印数据获取失败'
        break
      }
      const outcome = await printRowDirect(result)
      if (outcome === 'fail') {
        failedIndex = index
        failReason = selectedBrand.value === '芯烨' ? describeXpStatusError(xp.printError.value) : nm.printError.value
        break
      }
      if (outcome === 'pdf') {
        if (result.pdf_url) {
          if (!pdfs.length) pdfExpireSeconds.value = result.expire_seconds || 300
          pdfs.push(result.pdf_url)
        }
        continue
      }
      printed += 1
    }
    if (failedIndex >= 0) {
      pdfUrls.value = pdfs
      ElMessageBox.alert(
        `已打印 ${printed} 条，第 ${failedIndex + 1} 条「${rows[failedIndex].title}」失败${failReason ? `：${failReason}` : ''}。`
        + `请检查打印机后重试（重试会从头打印全部 ${rows.length} 条），或关闭后只勾选未打印的产品。`,
        '打印中断',
        { confirmButtonText: '知道了', type: 'warning' },
      ).catch(() => undefined)
      return
    }
    if (pdfs.length) {
      pdfUrls.value = pdfs
      ElMessage.success(`该打印机无自动生图能力，已生成 ${pdfs.length} 个临时 PDF，请下载后打印`)
      return
    }
    ElMessage.success(`已打印：${printed} 条标签 × ${printQty.value} 份`)
    emit('printed', printed)
    open.value = false
  } catch (err) {
    sdkLog(`【异常】handlePrint 捕获: ${err instanceof Error ? (err.stack || err.message) : String(err)}`)
    /* 其他错误由拦截器提示 */
  } finally {
    printingNow.value = false
    batchHint.value = ''
  }
}

/** 弹窗关闭时清理未使用的临时 PDF 与内联预览 */
async function cleanupPdf() {
  previewPdfBase64.value = ''
  const urls = pdfUrls.value
  if (!urls.length) return
  pdfUrls.value = []
  try {
    await deletePrintTempFiles(urls)
  } catch {
    /* 清理失败由过期机制兜底 */
  }
}

watch(open, (visible) => {
  if (!visible) void cleanupPdf()
})

/** 打印服务未安装引导（按当前所选型号品牌决定显示哪个服务的引导）
 *  ⚠️ 必须带"已选型号"这个前置条件：未选型号时我们不探测任何服务，
 *     若还显示"未检测到本机打印服务"就是无中生有的报警。 */
const selectedBrand = computed(() => (currentModel.value?.brand || '').trim())
const nmGuideVisible = computed(() => !!selectedBrand.value && selectedBrand.value !== '芯烨' && !nm.serviceConnected.value && !nm.connecting.value)
const xpGuideVisible = computed(() => selectedBrand.value === '芯烨' && !xp.serviceConnected.value && !xp.connecting.value)

/* —— 常驻服务操作区：状态 + 检测 + 下载 ——
 * 三条规则：
 *  ① 检测/下载入口**常驻**（原来下载链接只写在"服务未检测到"的提示条里，已连接/未选型号时
 *     用户拿不到安装包，无法自主下载）；
 *  ② **未选型号时什么都不连**：连哪个服务取决于型号品牌，所以先让用户选型号，
 *     选完再由 watch(selectedBrand) 去连对应服务（打开弹窗就连接会造成"还没选型号却显示已连接"）；
 *  ③ 检测与下载都跟着**所选型号的品牌**走：选精臣型号只测/只给精臣，选芯烨型号只测/只给芯烨。 */
const isXpBrand = computed(() => selectedBrand.value === '芯烨')
/** 当前品牌对应的服务名（状态文案用） */
const svcBrandLabel = computed(() => (isXpBrand.value ? '芯烨打印代理' : '本机打印服务'))
const svcChecking = computed(() => (isXpBrand.value ? xp.connecting.value : nm.connecting.value))
const svcConnected = computed(() => (isXpBrand.value ? xp.serviceConnected.value : nm.serviceConnected.value))
const svcStateText = computed(() => {
  // 未选型号：还没探测过，不能报"未检测到"（那是误导），直接引导选型号
  if (!selectedBrand.value) return '请先选择打印机型号，再检测/连接对应的打印服务'
  if (svcChecking.value) return `正在检测${svcBrandLabel.value}…`
  const printer = isXpBrand.value ? xp.printerName.value : nm.printerName.value
  if (!svcConnected.value) return `未检测到${svcBrandLabel.value}`
  return `${svcBrandLabel.value}已连接${printer ? `：${printer}` : ''}`
})

/** 下载按钮的目标：按所选型号品牌给对应主安装包（精臣=打印服务，芯烨=打印代理） */
const primaryDownloadUrl = computed(() => (isXpBrand.value ? XP_AGENT_DOWNLOAD_URL : PRINT_SERVICE_DOWNLOAD_URL))
/** USB 虚拟串口驱动只有 Win7 的精臣机型偶发需要，作为次级文字链保留（不占按钮位） */
const showUsbDriverLink = computed(() => !isXpBrand.value && !!selectedBrand.value)

/**
 * 触发下载。安装包在云上（跨域），而 `<a download>` 对跨域 URL 会被浏览器忽略，
 * 因此统一新开标签（与仓库内其它云下载链接口径一致，也避免把 SPA 顶掉）。
 */
function handleDownload(url: string) {
  if (!url) return
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.download = url.split('/').pop() || ''
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/** 「下载」按钮：未选型号时无法确定该给哪个品牌的包，先提示（避免让用户错下 36MB 的安装包） */
function onDownloadInstaller() {
  if (!selectedBrand.value) {
    ElMessage.warning('请先选择打印机型号，以确定需要下载的安装包')
    return
  }
  handleDownload(primaryDownloadUrl.value)
}

/**
 * 按所选型号品牌检测对应服务（调用方必须先确保 brand 非空）。
 * 只测该品牌那一个：装错服务、或对没装的那个服务做无意义重连，都是噪音。
 */
async function detectServiceForBrand(brand: string, options: { silent?: boolean } = {}) {
  const target: 'jc' | 'xp' = brand === '芯烨' ? 'xp' : 'jc'
  if (target === 'xp') {
    // connectService 内部已带状态查询（refreshStatus），成功即代表代理在线
    const ok = await xp.connectService()
    // 代理在线后再按当前连接方式把打印机也探一遍：WiFi 用已保存/已填的地址自动 connect，USB 由状态查询覆盖
    if (ok) await xpAutoDetectPrinter()
    if (!options.silent) {
      if (!ok) ElMessage.warning('未检测到芯烨打印代理，请点「下载安装包」安装后重试')
      else if (xp.ready.value) ElMessage.success(`芯烨打印机已连接：${xp.printerName.value}`)
      else ElMessage.warning(describeXpStatusError(xp.printError.value))
    }
  } else {
    const ok = await nm.connectService()
    if (!options.silent) {
      if (ok) ElMessage.success('本机打印服务已连接')
      else ElMessage.warning(nm.serviceError.value || '未检测到本机打印服务，请点「下载安装包」安装并启动后重试')
    }
  }
}

/** 常驻「检测服务」按钮：按当前型号品牌检测（未选型号先提示，避免猜品牌） */
function onDetectService() {
  if (!selectedBrand.value) {
    ElMessage.warning('请先选择打印机型号，再检测对应的打印服务')
    return
  }
  void detectServiceForBrand(selectedBrand.value)
}

/** 型号品牌变化时自动按新品牌检测（选芯烨型号即测芯烨代理，选精臣型号即测精臣服务） */
watch(selectedBrand, (brand, prev) => {
  if (!brand || brand === prev) return
  void detectServiceForBrand(brand, { silent: true })
})

/* 打开弹窗：只重置预览态 + 载入型号列表，**不连接任何服务**。
 * 连哪个服务取决于型号品牌，而打开时通常还没选型号 —— 由 watch(selectedBrand) 在选完后连接。
 * 若上次已选型号（组件未卸载、modelCode 仍在），则直接按该品牌连一次。
 * 注意必须放在 selectedBrand 之后——`immediate: true` 会同步执行回调，
 * 提前引用未初始化的 computed 会直接踩 TDZ 报错。 */
watch(open, (visible) => {
  if (!visible) return
  resetPrintState()
  // 批量入队不在本页直打：型号列表与打印服务探测都无意义，跳过
  if (isBatchMode.value) return
  if (!modelOptions.value.length) void loadModels()
  if (selectedBrand.value) void detectServiceForBrand(selectedBrand.value, { silent: true })
}, { immediate: true })

onMounted(() => { void loadModels() })

onBeforeUnmount(() => {
  disposed = true
  previewRequest++
  specRequest++
})
</script>

<template>
  <el-dialog v-model="open" :title="KIND_META[kind].title" width="640px" :close-on-click-modal="false" :close-on-press-escape="!printingNow">
    <!-- 待打印清单 -->
    <div class="print-rows">
      <div class="print-rows__head"><span class="mono-label"></span><strong>{{ rows.length }} 条</strong></div>
      <ul>
        <li v-for="row in rows.slice(0, 5)" :key="row.id">
          <strong>{{ row.title }}</strong>
          <span v-if="row.subtitle" class="print-rows__sub">{{ row.subtitle }}</span>
        </li>
        <li v-if="rows.length > 5" class="print-rows__more">…等 {{ rows.length }} 条</li>
      </ul>
    </div>

    <!-- 批量入队说明：勾选多条时打印在「打印任务」页执行，本页只负责提交 -->
    <el-alert v-if="isBatchMode" type="info" :closable="false" class="batch-queue-alert">
      <template #title>
        已勾选 {{ rows.length }} 条，将提交到打印任务队列排队并持久化（中途关闭页面也不会丢）。
        出纸请到「打印任务」页面，在那里选择打印机与标签规格。
      </template>
    </el-alert>

    <!-- 打印机选择（仅单条直打需要；批量入队由「打印任务」页选打印机） -->
    <el-form label-position="top" class="dense-form">
      <div v-if="!isBatchMode" class="form-row">
        <el-form-item label="打印机型号">
          <el-select v-model="modelCode" :loading="modelLoading" placeholder="选择打印机型号" filterable>
            <el-option v-for="item in modelOptions" :key="item.model_code" :label="item.model_name" :value="item.model_code" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签规格">
          <el-select v-model="specId" :loading="specLoading" :disabled="!modelCode" placeholder="选择标签规格">
            <el-option v-for="item in specOptions" :key="item.spec_id" :label="`${item.spec_name}（${item.width_mm}×${item.height_mm}mm）`" :value="item.spec_id" />
          </el-select>
        </el-form-item>
      </div>
      <div v-if="!isBatchMode" class="form-row">
        <el-form-item label="打印模式">
          <el-select v-model="printModeHardware" :disabled="!modelCode" placeholder="打印模式">
            <el-option v-for="item in printModeOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="纸张类型">
          <el-select v-model="labelType" :disabled="!modelCode" placeholder="纸张类型">
            <el-option v-for="item in labelTypeOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
      </div>
      <div class="form-row">
        <el-form-item label="打印份数">
          <el-input-number v-model="printQty" :min="1" :max="100" controls-position="right" />
        </el-form-item>
        <el-form-item v-if="!isBatchMode" label="打印浓度">
          <el-input-number v-model="density" :min="currentModel?.density_min ?? 1" :max="currentModel?.density_max ?? 15" controls-position="right" :disabled="!modelCode" />
        </el-form-item>
      </div>
      <!-- 芯烨连接方式：USB 线 / WiFi 网络（仅芯烨型号展示）。
           用 el-form-item 包裹，标签风格与上方「打印模式」「纸张类型」等字段完全一致
           （原先自定义的 .xp-conn__label 字号/颜色/对齐都和表单项不同）。 -->
      <template v-if="!isBatchMode && selectedBrand === '芯烨'">
        <el-form-item label="连接方式">
          <el-radio-group v-model="xpModeChoice" :disabled="xpTesting || xp.printing.value">
            <el-radio-button value="usb">USB 线连接</el-radio-button>
            <el-radio-button value="net">WiFi 网络连接</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="xpModeChoice === 'net'" label="打印机地址">
          <div class="xp-conn__addr">
            <el-input v-model="xp.netHost.value" class="xp-conn__ip" placeholder="打印机 IP，如 192.168.1.100" />
            <span class="xp-conn__colon">:</span>
            <el-input-number v-model="xp.netPort.value" class="xp-conn__port" :min="1" :max="65535" controls-position="right" />
            <el-button :loading="xp.discovering.value" @click="onDiscoverDevices">搜索设备</el-button>
            <el-button :loading="xpTesting" @click="onXpTest">测试连接</el-button>
          </div>
          <!-- 搜索结果（SDK 只给 IP/MAC，没有型号）：选中即填入地址并自动连接 -->
          <el-select
            v-if="xp.discoveredDevices.value.length"
            v-model="pickedDevice"
            class="xp-conn__found"
            placeholder="选择搜索到的打印机"
            @change="onPickDiscoveredDevice"
          >
            <el-option
              v-for="device in xp.discoveredDevices.value"
              :key="device.mac || device.ip"
              :label="`${device.ip}　${device.mac}`"
              :value="device.mac || device.ip"
            />
          </el-select>
          <span v-if="discoverHint" class="xp-conn__hint">{{ discoverHint }}</span>
        </el-form-item>
        <p class="xp-conn__status" :class="{
          'is-ok': !xpTesting && xp.ready.value,
          'is-warn': !xpTesting && !xp.ready.value && xp.serviceConnected.value && !xpApplyError,
          'is-err': !xpTesting && !!xpApplyError,
        }">
          <template v-if="xpTesting">正在{{ xpModeChoice === 'net' ? '探测 WiFi 打印机' : '检测 USB 打印机' }}…</template>
          <template v-else-if="xpApplyError">{{ xpApplyError }}</template>
          <template v-else-if="xp.ready.value">已连接：{{ xp.printerName.value }}（{{ xp.connMode.value === 'net' ? 'WiFi' : 'USB' }}）</template>
          <template v-else-if="xp.printError.value === 'agent-missing'">
            未检测到芯烨打印代理：请先点下方「下载安装包」安装并启动代理，再点「检测服务」
          </template>
          <template v-else-if="xpModeChoice === 'net'">
            打印机未连接：请确认打印机与本机连在同一个 WiFi，并填入打印机的 IP（可从打印机自检页或路由器后台查看）后点「测试连接」
          </template>
          <template v-else>打印机未连接：请检查打印机电源与 USB 线</template>
        </p>
      </template>
    </el-form>

    <!-- 服务操作区（常驻）：状态 + 检测 + 下载 —— 用户随时可自主下载，不再只在"未安装"时才给入口 -->
    <div v-if="!isBatchMode" class="svc-bar">
      <span
        class="svc-bar__state"
        :class="{ 'is-ok': !!selectedBrand && !svcChecking && svcConnected, 'is-warn': !!selectedBrand && !svcChecking && !svcConnected }"
        role="status"
      >
        <el-icon v-if="svcChecking" class="is-loading" aria-hidden="true"><Loading /></el-icon>
        {{ svcStateText }}
      </span>
      <div class="svc-bar__actions">
        <span v-if="showUsbDriverLink" class="svc-bar__hint">
          <a :href="USB_DRIVER_DOWNLOAD_URL" target="_blank" rel="noopener noreferrer">USB驱动（仅Win7）</a>
        </span>
        <el-button size="small" :loading="svcChecking" @click="onDetectService">检测服务</el-button>
        <el-button size="small" type="primary" plain @click="onDownloadInstaller">下载安装包</el-button>
      </div>
    </div>

    <!-- 服务未连接时的原因与操作引导（安装包入口在下方常驻的服务条里，这里只讲为什么不可用） -->
    <el-alert v-if="!isBatchMode && nmGuideVisible" type="warning" :closable="false" class="service-alert">
      <template #title>
        {{ nm.serviceError.value || '未检测到本机打印服务（情况A 打印需要）' }}。
        请点下方「下载安装包」安装并启动服务，再点「检测服务」重试；无自动生图能力的打印机（情况B）可直接下载 PDF。
      </template>
    </el-alert>
    <el-alert v-if="!isBatchMode && xpGuideVisible" type="warning" :closable="false" class="service-alert">
      <template #title>
        未检测到芯烨本机打印代理（芯烨直打需要）。请点下方「下载安装包」安装后，再点「检测服务」重试。
      </template>
    </el-alert>

    <!-- 预览 / PDF 结果 -->
    <div v-if="previewImage" class="preview-box">
      <img :src="previewImage" alt="打印预览" />
      <span class="mono-label"></span>
    </div>
    <div v-if="previewPdfBase64" class="preview-box preview-pdf">
      <iframe :src="previewPdfBase64" title="芯烨标签预览" />
    </div>
    <el-alert v-if="pdfUrls.length" type="success" :closable="false">
      <template #title>
        已生成 {{ pdfUrls.length }} 个临时 PDF（{{ Math.round(pdfExpireSeconds / 60) }} 分钟内有效）：
        <a v-for="(url, index) in pdfUrls" :key="url" :href="url" target="_blank" rel="noopener">下载第 {{ index + 1 }} 个</a>
      </template>
    </el-alert>

    <!-- 打印进度 -->
    <p v-if="printingNow && isBatchMode" class="print-progress">正在提交到打印任务队列…</p>
    <p v-else-if="batchHint" class="print-progress">{{ batchHint }}</p>
    <p v-else-if="nm.progress.value" class="print-progress">{{ nm.progress.value.detail }}</p>
    <p v-else-if="xp.printing.value" class="print-progress">芯烨打印机执行中，请稍候…</p>

    <template #footer>
      <el-button :disabled="printingNow" @click="open = false">取消</el-button>
      <el-button v-if="!isBatchMode" :loading="preparing" :disabled="!canSubmit || printingNow || nm.printing.value" @click="handlePreview">预览</el-button>
      <el-button type="primary" :loading="printingNow" :disabled="!canSubmit || preparing || nm.printing.value" @click="handlePrint">
        {{ isBatchMode ? '提交到打印队列' : '打印' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 颜色一律走主题变量（html.dark 里会整组覆盖 --bg-page、--border-color、--text-* 与状态色），
   不要写死 #f8fafc / #8795a4 这类浅色值，否则暗色主题下会出现亮底白字块。
   ⚠️ 本注释里不要出现 "--text-*" 与斜杠的连写（`星号+斜杠` 会提前闭合注释，整块 CSS 解析失败）。 */
.print-rows { border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; background: var(--bg-page); }
.print-rows__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.print-rows ul { list-style: none; margin: 0; padding: 0; }
.print-rows li { display: flex; gap: 10px; align-items: baseline; padding: 3px 0; font-size: 13px; }
.print-rows__sub { color: var(--text-secondary); font-size: 12px; }
.print-rows__more { color: var(--text-secondary); }
.batch-queue-alert { margin-bottom: 12px; }
.service-alert { margin-bottom: 12px; }
.svc-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-page); }
.svc-bar__state { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary); }
.svc-bar__state.is-ok { color: var(--success); }
.svc-bar__state.is-warn { color: var(--warning); }
.svc-bar__actions { display: flex; align-items: center; gap: 8px; flex: none; }
.svc-bar__hint { font-size: 12px; color: var(--text-secondary); }
.svc-bar__hint a { color: var(--text-secondary); text-decoration: underline; }
.preview-box { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 12px; padding: 12px; border: 1px dashed var(--border-color); border-radius: 8px; }
.preview-box img { max-width: 100%; max-height: 240px; }
.preview-pdf iframe { width: 100%; height: 260px; border: 0; border-radius: 6px; }
.print-progress { margin: 10px 0 0; color: var(--text-secondary); font-size: 12px; text-align: center; }
.xp-conn__addr { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.xp-conn__ip { width: 220px; }
.xp-conn__colon { color: var(--text-secondary); }
.xp-conn__port { width: 120px; }
.xp-conn__found { margin-top: 8px; width: 100%; max-width: 460px; }
.xp-conn__hint { display: block; margin-top: 8px; font-size: 12px; color: var(--text-secondary); }
.xp-conn__status { margin: 0 0 12px; font-size: 12px; color: var(--text-secondary); }
.xp-conn__status.is-ok { color: var(--success); }
.xp-conn__status.is-warn { color: var(--warning); }
.xp-conn__status.is-err { color: var(--danger); }
</style>
