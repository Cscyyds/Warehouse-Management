/**
 * 页面：打印任务（独立窗口，路由 /warehouse/print-task）
 *
 * 方案：《PDA打印任务中转落地方案与实施清单.md》v3.0 §8——PDA 所有打印操作下发
 * 任务到后端，本页面是打码电脑上的任务出口：进入加载一次 + 手动【刷新】（无轮询）；
 * 自带打印机型号/标签规格选择、预览（多标签逐张切换）、单条/批量打印、取消、
 * 手动"确认已打印"兜底。打印数据按 biz_type 路由到既有打印接口（printTask.ts 注册表）。
 * 页面自包含，不依赖也不修改 PrintLabelDialog 等既有组件。
 */
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Printer, Close, CircleCheck, ArrowDown } from '@element-plus/icons-vue'
import type { PrintTaskItem } from '@/api/modules/printTask'
import {
  BIZ_TYPE_PRODUCTION_BILL_LABEL,
  cancelPrintTask,
  fetchTaskPrintData,
  listPrintTasks,
  markPrintTaskPrinted,
  type PrintableLabel,
} from '@/api/modules/printTask'
import { PRODUCTION_DOC_NAME, printProductionBillsPdf } from '@/api/modules/production'
import { downloadPdf } from '@/utils/download'
import { getVisiblePrinterDetail, getVisiblePrinterList, type PrinterLabelSpecItem, type PrinterModelItem } from '@/api/modules/printerModel'
import { useNmPrint, PRINT_SERVICE_DOWNLOAD_URL, USB_DRIVER_DOWNLOAD_URL } from '@/utils/nmPrint/useNmPrint'
import { useXpPrint, XP_AGENT_DOWNLOAD_URL } from '@/utils/xpPrint/useXpPrint'
import type { XpDiscoveredDevice } from '@/utils/xpPrint/XpSocket'
import { mapBackendPrintData } from '@/utils/nmPrint/printDataMapper'
import type { PrintCommonParams } from '@/api/modules/scannerPrint'

const nm = useNmPrint()
const xp = useXpPrint()

/* —— 列表状态（无轮询：进入加载 + 手动刷新） —— */

type StatusTab = 'PENDING' | 'PRINTED' | 'CANCELED'
const activeStatus = ref<StatusTab>('PENDING')
const bizTypeFilter = ref('')
const tasks = ref<PrintTaskItem[]>([])
const loading = ref(false)
const lastRefreshAt = ref('')
const selection = ref<PrintTaskItem[]>([])

const BIZ_TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'MERGE_PACKAGE', label: '合包条码' },
  { value: 'PLASTIC_BOX', label: '塑料盒条码' },
  { value: 'PRODUCT', label: '产品条码' },
  { value: 'LOCATION', label: '货位条码' },
  { value: 'PRODUCT_POSITION', label: '位置条码' },
  { value: 'PLASTIC_BOX_OUTBOUND', label: '出库条码' },
  { value: 'INBOUND_PURCHASE', label: '采购入库条码' },
  { value: 'INBOUND_SALES_RETURN', label: '销售退货条码' },
  { value: 'PRODUCTION_INBOUND', label: '生产入库条码' },
  { value: BIZ_TYPE_PRODUCTION_BILL_LABEL, label: '生产单据箱贴' },
]

/** PDF 型任务（生产单据箱贴，天心分支）：标签 PDF 由主工程生成后下载打印，
 *  不走标签打印机直打链路，预览/打印均无需先选打印机型号与标签规格 */
function isPdfLabelTask(task: PrintTaskItem): boolean {
  return task.biz_type === BIZ_TYPE_PRODUCTION_BILL_LABEL
}

const statusTabName = computed<Record<StatusTab, string>>(() => ({ PENDING: '待打印', PRINTED: '已打印', CANCELED: '已取消' }))

async function refresh() {
  loading.value = true
  try {
    const res = await listPrintTasks({
      status: activeStatus.value,
      biz_type: bizTypeFilter.value || undefined,
      page: 1,
      page_size: 100,
    })
    tasks.value = res.list || []
    selection.value = []
    lastRefreshAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}

watch([activeStatus, bizTypeFilter], () => { void refresh() })
onMounted(() => { void refresh() })

/* —— 打印设置（自包含，选择结果记忆在 localStorage） —— */

const PRINTER_CONFIG_KEY = 'wms-print-task-printer-config'

const modelOptions = ref<PrinterModelItem[]>([])
const modelCode = ref('')
const specOptions = ref<PrinterLabelSpecItem[]>([])
const specId = ref('')
const printModeHardware = ref('')
const labelType = ref('')
const density = ref<number>(8)
const modelLoading = ref(false)
const specLoading = ref(false)
const advancedOpen = ref<string[]>([])

const currentModel = computed(() => modelOptions.value.find((item) => item.model_code === modelCode.value) || null)
const settingsReady = computed(() => !!(modelCode.value && specId.value && printModeHardware.value && labelType.value))

function restorePrinterConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRINTER_CONFIG_KEY) || '{}')
    if (saved.modelCode) modelCode.value = saved.modelCode
    if (saved.printModeHardware) printModeHardware.value = saved.printModeHardware
    if (saved.labelType) labelType.value = saved.labelType
    if (typeof saved.density === 'number') density.value = saved.density
  } catch { /* 忽略损坏的本地配置 */ }
}

function persistPrinterConfig() {
  localStorage.setItem(PRINTER_CONFIG_KEY, JSON.stringify({
    modelCode: modelCode.value,
    printModeHardware: printModeHardware.value,
    labelType: labelType.value,
    density: density.value,
  }))
}

async function loadModels() {
  modelLoading.value = true
  try {
    const res = await getVisiblePrinterList({ page: 1, page_size: 50 })
    modelOptions.value = res.data.list || []
    if (!modelCode.value && modelOptions.value.length) modelCode.value = modelOptions.value[0].model_code
  } catch {
    /* 拦截器已提示 */
  } finally {
    modelLoading.value = false
  }
}

async function loadSpecs(modelCodeValue: string) {
  specOptions.value = []
  specId.value = ''
  if (!modelCodeValue) return
  specLoading.value = true
  try {
    const res = await getVisiblePrinterDetail(modelCodeValue)
    specOptions.value = res.data.label_specs || []
    const model = res.data
    const defaultSpec = specOptions.value.find((item) => item.is_default === 1) || specOptions.value[0]
    if (defaultSpec) specId.value = defaultSpec.spec_id
    if (!printModeHardware.value || !model.supported_print_modes?.includes(printModeHardware.value)) {
      printModeHardware.value = model.supported_print_modes?.[0] || ''
    }
    if (!labelType.value || !model.supported_label_types?.includes(labelType.value)) {
      labelType.value = model.supported_label_types?.[0] || ''
    }
    density.value = model.density_default
  } catch {
    /* 拦截器已提示 */
  } finally {
    specLoading.value = false
    persistPrinterConfig()
  }
}

watch(modelCode, (value) => { void loadSpecs(value) })

const selectedBrand = computed(() => (currentModel.value?.brand || '').trim())
/** 生产单据箱贴直打就绪：已选芯烨型号且型号/规格设置齐备；否则箱贴任务回落 PDF 下载 */
const billLabelDirectPrint = computed(() => selectedBrand.value === '芯烨' && settingsReady.value)
const nmGuideVisible = computed(() => selectedBrand.value !== '芯烨' && !nm.serviceConnected.value && !nm.connecting.value)
const xpGuideVisible = computed(() => selectedBrand.value === '芯烨' && !xp.serviceConnected.value && !xp.connecting.value)

interface PrintServiceState {
  name: string
  /** 本机服务/代理本身是否已连上（不代表打印机就绪） */
  connected: boolean
  /** 打印机侧补充；两个服务语义不同：精臣仅打印时占用设备，芯烨由代理常驻上报连接结果 */
  printerNote: string
}

/** 本机打印服务状态：名称与状态都取各 hook 的实测结果，连上几个显示几个，不做额外设备探测 */
const serviceStates = computed<PrintServiceState[]>(() => {
  const list: PrintServiceState[] = []
  if (nm.serviceConnected.value || nm.connecting.value) {
    list.push({
      name: '精臣打印服务',
      connected: nm.serviceConnected.value,
      printerNote: nm.printerName.value ? `打印机 ${nm.printerName.value}` : '',
    })
  }
  if (xp.serviceConnected.value || xp.connecting.value) {
    list.push({
      name: '芯烨打印代理',
      connected: xp.serviceConnected.value,
      printerNote: xp.printerName.value ? `打印机 ${xp.printerName.value}` : '未检测到打印机',
    })
  }
  return list
})

async function retryServiceDetect() {
  if (selectedBrand.value === '芯烨') await xp.connectService()
  else await nm.connectService()
}

function buildParams(printMode: 'PREVIEW' | 'PRINT', qty: number): PrintCommonParams {
  return {
    printer_model_code: modelCode.value,
    label_spec_id: specId.value,
    print_mode: printMode,
    print_mode_hardware: printModeHardware.value,
    label_type: labelType.value,
    print_qty: Math.max(1, Math.floor(qty || 1)),
    density: density.value || undefined,
  }
}

/* —— 芯烨连接方式选择（USB 线 / WiFi 网络；仅选中芯烨型号时展示）——
 * 与 PrintLabelDialog（产品/货位/塑料盒打印弹窗）同一套逻辑：
 * xpModeChoice 是用户的选择（未应用），xp.connMode 是代理当前生效的方式：
 * USB 切换即时探测应用；WiFi 填好 IP 后自动探测（也可点「测试连接」手动重试）；
 * 打印前强制两者一致。没有这块连接入口时代理上打印机从未建连，直打必失败。 */
const xpModeChoice = ref<'usb' | 'net'>(xp.connMode.value)
const xpTesting = ref(false)
const xpApplyError = ref('')
/** 搜索结果的选中值（mac 优先，回退 ip） */
const pickedDevice = ref('')
/** 搜索后的一次性提示（未搜到原因 / 已自动连接） */
const discoverHint = ref('')

/** 代理的状态类错误码（printError 哨兵值）转中文，避免把 agent-missing 这类内部码漏到界面 */
function describeXpStatusError(raw: string): string {
  if (raw === 'agent-missing') return '未检测到芯烨打印代理，请先下载安装包并启动'
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

/** WiFi 自动探测：地址已知时自动下发一次 connect，不必每次手点「测试连接」 */
async function xpAutoDetectPrinter(): Promise<void> {
  if (xpModeChoice.value !== 'net') return
  if (!xp.netHost.value.trim()) return
  if (xp.ready.value) return
  await applyXpMode()
}

/** USB 无需参数，切换即应用；WiFi 只要地址已知就自动探测一次 */
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

/** 「搜索设备」：广播一次发现；只有一台时直接自动连接，多台让用户在下拉里挑 */
async function onDiscoverDevices() {
  discoverHint.value = ''
  pickedDevice.value = ''
  const devices = await xp.discoverDevices()
  if (!devices.length) {
    discoverHint.value = xp.printError.value
      ? describeXpStatusError(xp.printError.value)
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

// 选芯烨型号时代理在线后自动按当前方式把打印机探一遍（WiFi 用已存地址，USB 由状态查询覆盖）
watch(selectedBrand, (brand) => {
  if (brand !== '芯烨') return
  void xp.connectService().then((ok) => {
    if (ok) void xpAutoDetectPrinter()
  })
})

/* —— 预览（多标签逐张切换） —— */

interface PreviewView {
  key: string
  label: string
  kind: 'pdf' | 'image' | 'none'
  /** 弹窗内嵌显示用的地址：内联 base64 转出的 blob: URL，或后端返回的远端 PDF URL */
  src: string
  /** 点击预览区后在新标签页单独展示 PDF 的地址；image / none 为空 */
  openUrl: string
  note: string
}

const previewVisible = ref(false)
const previewPreparing = ref(false)
const previewingTaskId = ref('')
const previewTask = ref<PrintTaskItem | null>(null)
const previewViews = ref<PreviewView[]>([])
const previewIndex = ref(0)
const currentView = computed(() => previewViews.value[previewIndex.value])

/** 预览期间创建的 blob URL：重建预览或关闭弹窗时统一释放 */
let previewBlobUrls: string[] = []

function releasePreviewBlobUrls() {
  previewBlobUrls.forEach((url) => URL.revokeObjectURL(url))
  previewBlobUrls = []
}

/**
 * 内联 PDF（base64）转 blob URL。
 * 不用 data: URL——iframe 内嵌 PDF 在 Chrome 下用 blob 更稳，且 data: 不允许顶层跳转，
 * 转成 blob 后"点击预览区开新标签页"才能直接用同一个地址。
 */
function base64PdfToBlobUrl(base64: string): string {
  // 后端返回纯 base64；这里兼容万一带上 data: 前缀的情况，否则 atob 会直接抛错
  const pure = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64
  const binary = atob(pure)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  previewBlobUrls.push(url)
  return url
}

/** 点击预览区：新标签页只显示该 PDF（可放大、下载、打印） */
function openPdfInNewTab(view?: PreviewView) {
  if (!view?.openUrl) return
  const opened = window.open(view.openUrl, '_blank', 'noopener,noreferrer')
  if (!opened) {
    ElMessage.warning('浏览器拦截了新标签页，请允许本站弹出窗口后重新点击预览')
    return
  }
  // 已交给新标签页的 blob URL 不再回收，避免那边放大/翻页时读不到数据
  if (view.openUrl.startsWith('blob:')) {
    previewBlobUrls = previewBlobUrls.filter((url) => url !== view.openUrl)
  }
}

async function buildPreviewViews(labels: PrintableLabel[]): Promise<PreviewView[]> {
  releasePreviewBlobUrls()
  const views: PreviewView[] = []
  for (const item of labels) {
    // PDF 型任务（生产单据箱贴）：blob 直接转 URL 内嵌预览，点击可开新标签页打印
    if (item.pdfBlob) {
      const url = URL.createObjectURL(item.pdfBlob)
      previewBlobUrls.push(url)
      views.push({ key: item.key, label: item.label, kind: 'pdf', src: url, openUrl: url, note: '' })
      continue
    }
    const result = item.result
    if (result.sdk_type === 'XP' && result.preview_pdf_base64) {
      const url = base64PdfToBlobUrl(result.preview_pdf_base64)
      views.push({ key: item.key, label: item.label, kind: 'pdf', src: url, openUrl: url, note: '' })
      continue
    }
    if (result.sdk_type === 'JC' && result.print_data) {
      try {
        const image = await nm.preview([mapBackendPrintData(result.print_data)])
        if (image) {
          views.push({ key: item.key, label: item.label, kind: 'image', src: image, openUrl: '', note: '' })
          continue
        }
      } catch { /* 降级到 PDF */ }
    }
    if (result.pdf_url) {
      // 情况 B（打印机无预览能力）：后端返回 BOS 临时 PDF，直接内嵌展示，不再要求点击下载
      views.push({ key: item.key, label: item.label, kind: 'pdf', src: result.pdf_url, openUrl: result.pdf_url, note: '' })
      continue
    }
    views.push({ key: item.key, label: item.label, kind: 'none', src: '', openUrl: '', note: '预览生成失败，可直接打印' })
  }
  return views
}

async function doPreview(task: PrintTaskItem) {
  if (!isPdfLabelTask(task) && !settingsReady.value) { ElMessage.warning('请先选择打印机型号与标签规格'); return }
  previewPreparing.value = true
  previewingTaskId.value = task.print_task_id
  try {
    const labels = await fetchTaskPrintData(task, buildParams('PREVIEW', task.print_qty))
    previewViews.value = await buildPreviewViews(labels)
    previewIndex.value = 0
    previewTask.value = task
    previewVisible.value = true
  } catch {
    /* 拦截器已提示 */
  } finally {
    previewPreparing.value = false
    previewingTaskId.value = ''
  }
}

// 弹窗关闭即释放内联 PDF 的 blob URL
watch(previewVisible, (visible) => { if (!visible) releasePreviewBlobUrls() })
onBeforeUnmount(releasePreviewBlobUrls)

/* —— 打印执行 —— */

const printingTaskId = ref('')
const batchPrinting = ref(false)

/** 单张标签直打：XP 走本机代理 TSPL，JC 走本地 SDK；情况B（仅 pdf_url）返回 'pdf' 交由调用方处理 */
async function printLabel(label: PrintableLabel, params: PrintCommonParams): Promise<'ok' | 'pdf' | 'fail'> {
  const result = label.result
  if (result.printer_has_preview_capability && result.print_data) {
    if (result.sdk_type === 'XP') {
      // 连接方式选择与代理生效方式不一致时，先应用（如用户切了 WiFi 但未点测试）——
      // 与 PrintLabelDialog 同口径；代理上无打印机连接时 xp.print 内部自检会拦截
      if (xpModeChoice.value !== xp.connMode.value) {
        if (!await applyXpMode()) {
          ElMessage.error(`连接方式切换失败：${xpApplyError.value || '请检查打印机连接'}`)
          return 'fail'
        }
      }
      const ok = await xp.print(result.print_data.tspl_commands || [], { qty: label.qty || params.print_qty })
      return ok ? 'ok' : 'fail'
    }
    if (result.sdk_type === 'JC') {
      try {
        const ok = await nm.print([mapBackendPrintData(result.print_data)], {
          quantity: label.qty || params.print_qty,
          density: density.value,
          labelType: labelType.value,
          printModeHardware: printModeHardware.value,
        })
        return ok ? 'ok' : 'fail'
      } catch {
        return 'fail'
      }
    }
    ElMessage.error(`暂不支持该打印机的直打（sdk_type=${result.sdk_type}），请联系管理员`)
    return 'fail'
  }
  if (result.pdf_url) return 'pdf'
  ElMessage.error('打印数据生成异常（无直打数据且无 PDF），请重试或联系管理员')
  return 'fail'
}

/** 执行一个任务的完整打印：取数据 → 逐张出纸 → 全部成功回写 PRINTED */
async function executePrintTask(task: PrintTaskItem): Promise<boolean> {
  printingTaskId.value = task.print_task_id
  try {
    let labels: PrintableLabel[]
    try {
      // 箱贴直打就绪时传 true：箱贴改走 TSPL 直打（否则保持 PDF 下载分支）
      labels = await fetchTaskPrintData(task, buildParams('PRINT', task.print_qty), billLabelDirectPrint.value)
    } catch {
      printingTaskId.value = ''
      return false
    }
    // 生产单据箱贴（PDF 型任务，未选直打型号时）：下载整单箱贴 PDF，由操作员用本机/系统打印机打印。
    // 页面无法感知实际出纸结果，与"无直打能力打印机"同一口径：不自动回写，
    // 操作员打印完成后在任务行【更多】→【确认已打印】闭环
    const pdfLabels = labels.filter((label) => label.pdfBlob)
    if (pdfLabels.length) {
      for (const label of pdfLabels) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await downloadPdf({
            request: () => Promise.resolve(label.pdfBlob!),
            fileName: label.pdfFileName || `${task.task_no}.pdf`,
            successMessage: '箱贴 PDF 已开始下载',
          })
        } catch { /* downloadPdf 已提示错误文案 */ }
      }
      ElMessage.info(`任务 ${task.task_no}：PDF 打印完成后请在【更多】→【确认已打印】回写状态`)
      return true
    }
    const pdfLinks: string[] = []
    let failed = 0
    for (const label of labels) {
      const outcome = await printLabel(label, buildParams('PRINT', task.print_qty))
      if (outcome === 'fail') { failed += 1; break }
      if (outcome === 'pdf' && label.result.pdf_url) pdfLinks.push(label.result.pdf_url)
    }
    if (failed > 0) {
      ElMessage.error(`任务 ${task.task_no} 打印失败，任务保持待打印，处理完打印机问题后可重试`)
      printingTaskId.value = ''
      return false
    }
    if (pdfLinks.length > 0) {
      // 存在仅 PDF 的标签（该打印机无直打能力）：不回写状态，操作员下载打印完
      // 后点行内【更多】→【确认已打印】完成闭环
      ElMessageBox.alert(
        `已生成 PDF 标签 ${pdfLinks.length} 张，请下载打印后在任务行点击【更多】→【确认已打印】。`,
        '请下载 PDF 打印',
        { confirmButtonText: '知道了' },
      ).catch(() => undefined)
      printingTaskId.value = ''
      return true
    }
    await confirmPrinted(task)
    return true
  } finally {
    printingTaskId.value = ''
  }
}

/** 回写已打印；失败时提示手动兜底（行内按钮幂等） */
async function confirmPrinted(task: PrintTaskItem) {
  try {
    await markPrintTaskPrinted(task.print_task_id)
    ElMessage.success(`任务 ${task.task_no} 已打印完成`)
    task.status = 'PRINTED'
    selection.value = selection.value.filter((item) => item.print_task_id !== task.print_task_id)
  } catch {
    ElMessage.warning(`已出纸但状态回写失败，请点击任务 ${task.task_no} 行的【更多】→【确认已打印】重试`)
  }
}

async function printOne(task: PrintTaskItem) {
  if (!isPdfLabelTask(task) && !settingsReady.value) { ElMessage.warning('请先选择打印机型号与标签规格'); return }
  if (task.is_generative) {
    try {
      await ElMessageBox.confirm(
        `任务 ${task.task_no}（${task.biz_type_desc}）在打印时才生成新条码记录，重试会产生新条码。请确认打印机就绪后继续。`,
        '生成式打印确认',
        { confirmButtonText: '开始打印', cancelButtonText: '取消', type: 'warning' },
      )
    } catch { return }
  }
  await executePrintTask(task)
}

/** 批量执行生产单据箱贴任务：按 doc_key 分组，每组调主工程合并接口下载一份 PDF
 *  （多张单据连续输出同一文件）。下载完成后可选一键回写 PRINTED——页面无法感知
 *  实际出纸结果，默认不自动回写，由操作员显式确认 */
async function batchPrintPdfTasks(pdfTasks: PrintTaskItem[]): Promise<PrintTaskItem[]> {
  const groups = new Map<string, PrintTaskItem[]>()
  for (const task of pdfTasks) {
    const docKey = task.print_params?.doc_key || ''
    if (!docKey) {
      ElMessage.error(`任务 ${task.task_no} 缺少单据类型（doc_key），请取消后重新下发`)
      continue
    }
    groups.set(docKey, [...(groups.get(docKey) || []), task])
  }
  const downloaded: PrintTaskItem[] = []
  for (const [docKey, group] of groups) {
    const docName = PRODUCTION_DOC_NAME[docKey] || '生产单据'
    // eslint-disable-next-line no-await-in-loop
    const ok = await downloadPdf({
      request: () => printProductionBillsPdf(docKey, group.map((task) => task.biz_id)),
      fileName: `${docName}_箱贴批量${group.length}张单据.pdf`,
      successMessage: `${docName}箱贴 PDF 已开始下载（${group.length} 张单据合并为一份）`,
    }).then(() => true).catch(() => false)
    if (ok) downloaded.push(...group)
  }
  if (!downloaded.length) return []
  try {
    await ElMessageBox.confirm(
      `已下载 ${downloaded.length} 张单据的箱贴 PDF。打印完成后是否将这些任务标记为已打印？`,
      '批量打印完成',
      { confirmButtonText: '全部标记已打印', cancelButtonText: '稍后手动确认', type: 'success' },
    )
  } catch {
    return downloaded
  }
  let marked = 0
  for (const task of downloaded) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await markPrintTaskPrinted(task.print_task_id)
      marked += 1
      task.status = 'PRINTED'
    } catch { /* 拦截器已提示，剩余任务继续回写 */ }
  }
  if (marked) ElMessage.success(`已回写 ${marked} 个任务为已打印`)
  return downloaded
}

async function batchPrint() {
  const pending = selection.value.filter((task) => task.status === 'PENDING')
  if (!pending.length) { ElMessage.warning('请先勾选待打印任务'); return }
  // 生产单据箱贴默认为 PDF 型任务（不占标签打印机、无需选型号）；已选芯烨直打型号时
  // 转入直打组：逐张取 TSPL 指令经本机代理出标签
  const pdfTasks = pending.filter((task) => isPdfLabelTask(task) && !billLabelDirectPrint.value)
  const printerTasks = pending.filter((task) => !isPdfLabelTask(task) || billLabelDirectPrint.value)
  if (printerTasks.length && !settingsReady.value) { ElMessage.warning('请先选择打印机型号与标签规格'); return }
  const generativeCount = printerTasks.filter((task) => task.is_generative).length
  try {
    await ElMessageBox.confirm(
      `将打印 ${pending.length} 个任务` +
        (pdfTasks.length ? `，其中 ${pdfTasks.length} 个为生产单据箱贴（按单据类型分组合并下载 PDF）` : '') +
        (generativeCount ? `，其中 ${generativeCount} 个为入库类，打印时才生成新条码` : '') +
        '。请确认打印机就绪。',
      '批量打印',
      { confirmButtonText: '开始打印', cancelButtonText: '取消' },
    )
  } catch { return }
  batchPrinting.value = true
  let success = 0
  let failed = 0
  if (pdfTasks.length) {
    const okTasks = await batchPrintPdfTasks(pdfTasks)
    success += okTasks.length
    failed += pdfTasks.length - okTasks.length
  }
  for (const task of printerTasks) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await executePrintTask(task)
    if (ok) success += 1
    else failed += 1
  }
  batchPrinting.value = false
  if (failed > 0) ElMessage.warning(`批量打印结束：成功 ${success} 个，失败 ${failed} 个（失败任务保持待打印）`)
  else ElMessage.success(`批量打印完成：${success} 个任务`)
  void refresh()
}

/* —— 取消 / 手动确认 —— */

async function cancelTask(task: PrintTaskItem) {
  try {
    const { value } = await ElMessageBox.prompt('取消原因（可选，留空直接确认）：', `取消任务 ${task.task_no}`, {
      confirmButtonText: '确认取消',
      cancelButtonText: '返回',
      inputPlaceholder: '取消原因（可选）',
    })
    await cancelPrintTask(task.print_task_id, value || undefined)
    ElMessage.success(`任务 ${task.task_no} 已取消`)
    task.status = 'CANCELED'
    selection.value = selection.value.filter((item) => item.print_task_id !== task.print_task_id)
  } catch {
    /* 用户关闭或拦截器已提示 */
  }
}

async function manualConfirmPrinted(task: PrintTaskItem) {
  await confirmPrinted(task)
}

/** 行内【更多】下拉：低频的收尾操作不占按钮位 */
async function onRowAction(command: string, task: PrintTaskItem) {
  if (command === 'confirm') await manualConfirmPrinted(task)
  else if (command === 'cancel') await cancelTask(task)
}

/* —— 展示辅助 —— */

function summaryText(task: PrintTaskItem): string {
  const summary = task.summary || {}
  const parts: string[] = []
  const product = String(summary.product_name || '')
  const spec = String(summary.specification || '')
  if (product) parts.push(product)
  if (spec) parts.push(spec)
  const qtyKeys = ['merge_qty', 'qty', 'in_stock_qty', 'outbound_qty']
  for (const key of qtyKeys) {
    if (summary[key] !== undefined && summary[key] !== null && String(summary[key]) !== '') {
      parts.push(`${key === 'merge_qty' ? '每包' : key === 'in_stock_qty' ? '入库量' : key === 'qty' ? '数量' : '出库量'} ${summary[key]}`)
      break
    }
  }
  const orderNo = String(summary.order_no || summary.doc_name || '')
  if (orderNo) parts.push(orderNo)
  return parts.join(' · ')
}

function statusTagType(status: string): 'success' | 'info' | 'warning' {
  if (status === 'PRINTED') return 'success'
  if (status === 'CANCELED') return 'info'
  return 'warning'
}

onMounted(() => {
  restorePrinterConfig()
  void loadModels()
  // 提前探测本机打印服务（未安装时显示引导条，不阻塞列表）
  void nm.connectService()
  void xp.connectService()
})
</script>

<template>
  <div class="print-task-page">
    <!-- 标题栏：状态 Tab + 类型筛选 + 刷新（无轮询，全手动） -->
    <div class="page-header">
      <div class="page-header__left">
        <h2 class="page-title">打印任务</h2>
        <span class="page-sub">下发的条码/箱贴打印任务在此打印；数据仅在点击刷新时更新</span>
      </div>
      <div class="page-header__right">
        <el-select v-model="bizTypeFilter" style="width: 150px">
          <el-option v-for="item in BIZ_TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-button type="primary" :icon="Refresh" :loading="loading" @click="refresh()">刷新</el-button>
      </div>
    </div>

    <el-tabs v-model="activeStatus" class="status-tabs">
      <el-tab-pane :label="statusTabName.PENDING" name="PENDING" />
      <el-tab-pane :label="statusTabName.PRINTED" name="PRINTED" />
      <el-tab-pane :label="statusTabName.CANCELED" name="CANCELED" />
    </el-tabs>

    <!-- 打印设置（仅待打印 Tab）：打印机型号/规格/份数 + 高级选项 + 服务状态 -->
    <el-card v-if="activeStatus === 'PENDING'" shadow="never" class="settings-card">
      <el-form label-position="top" class="dense-form settings-form">
        <div class="form-row">
          <el-form-item label="打印机型号">
            <el-select v-model="modelCode" :loading="modelLoading" placeholder="选择打印机型号" filterable style="width: 100%">
              <el-option v-for="item in modelOptions" :key="item.model_code" :label="`${item.model_name}（${item.brand}）`" :value="item.model_code" />
            </el-select>
          </el-form-item>
          <el-form-item label="标签规格">
            <el-select v-model="specId" :loading="specLoading" :disabled="!modelCode" placeholder="选择标签规格" style="width: 100%">
              <el-option v-for="item in specOptions" :key="item.spec_id" :label="`${item.spec_name}（${item.width_mm}×${item.height_mm}mm）`" :value="item.spec_id" />
            </el-select>
          </el-form-item>
          <el-form-item label="份数说明">
            <div class="qty-note">打印份数以各任务下发的份数为准（见列表"份数"列）</div>
          </el-form-item>
        </div>
        <!-- 芯烨连接方式：USB 线 / WiFi 网络（仅选中芯烨型号时展示，与产品打印弹窗同一套交互） -->
        <template v-if="selectedBrand === '芯烨'">
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
              未检测到芯烨打印代理：请先点上方提示条里的下载链接安装并启动代理，再点重新检测
            </template>
            <template v-else-if="xpModeChoice === 'net'">
              打印机未连接：请确认打印机与本机连在同一个 WiFi，并填入打印机的 IP（可从打印机自检页或路由器后台查看）后点「测试连接」
            </template>
            <template v-else>打印机未连接：请检查打印机电源与 USB 线</template>
          </p>
        </template>
        <el-collapse v-model="advancedOpen" class="advanced-collapse">
          <el-collapse-item title="高级选项（打印模式 / 纸张类型 / 浓度）" name="adv">
            <div class="form-row">
              <el-form-item label="打印模式">
                <el-select v-model="printModeHardware" :disabled="!modelCode" style="width: 100%">
                  <el-option v-for="item in (currentModel?.supported_print_modes || [])" :key="item" :label="item" :value="item" />
                </el-select>
              </el-form-item>
              <el-form-item label="纸张类型">
                <el-select v-model="labelType" :disabled="!modelCode" style="width: 100%">
                  <el-option v-for="item in (currentModel?.supported_label_types || [])" :key="item" :label="item" :value="item" />
                </el-select>
              </el-form-item>
              <el-form-item label="打印浓度">
                <el-input-number v-model="density" :min="currentModel?.density_min ?? 1" :max="currentModel?.density_max ?? 15" controls-position="right" :disabled="!modelCode" />
              </el-form-item>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-form>
      <el-alert v-if="nmGuideVisible" type="warning" :closable="false" class="service-alert">
        <template #title>
          未检测到本机打印服务（精臣直打需要）；<a :href="PRINT_SERVICE_DOWNLOAD_URL" download target="_blank" rel="noopener noreferrer">下载打印服务</a>、
          <a :href="USB_DRIVER_DOWNLOAD_URL" download target="_blank" rel="noopener noreferrer">下载USB驱动（仅Win7需要）</a> 安装后点击重新检测。
          <el-button size="small" type="primary" link :loading="nm.connecting.value" @click="retryServiceDetect()">重新检测</el-button>
        </template>
      </el-alert>
      <el-alert v-if="xpGuideVisible" type="warning" :closable="false" class="service-alert">
        <template #title>
          未检测到芯烨本机打印代理（芯烨直打需要）；<a :href="XP_AGENT_DOWNLOAD_URL" download target="_blank" rel="noopener noreferrer">下载芯烨打印代理</a> 安装后点击重新检测。期间可使用预览确认标签内容。
          <el-button size="small" type="primary" link :loading="xp.connecting.value" @click="retryServiceDetect()">重新检测</el-button>
        </template>
      </el-alert>
      <div v-for="item in serviceStates" :key="item.name" :class="item.connected ? 'service-ok' : 'service-pending'">{{ item.name }}：{{ item.connected ? '已连接' : '检测中' }}{{ item.printerNote ? ` · ${item.printerNote}` : '' }}</div>
      <el-alert
        v-if="selectedBrand === '芯烨' && xp.serviceConnected && !xp.printerName"
        type="info" :closable="false" class="service-alert"
        title="芯烨代理已在线但打印机未连接：请在上方「连接方式」选择 USB 或 WiFi 并完成连接后再打印"
      />
    </el-card>

    <!-- 任务表格 -->
    <el-card shadow="never" class="table-card">
      <div v-if="activeStatus === 'PENDING'" class="table-toolbar">
        <el-button type="primary" :icon="Printer" :loading="batchPrinting" :disabled="!selection.length" @click="batchPrint()">
          打印选中（{{ selection.length }}）
        </el-button>
        <span class="table-meta">共 {{ tasks.length }} 条{{ lastRefreshAt ? ` · 最后刷新 ${lastRefreshAt}` : '' }}</span>
      </div>
      <div v-else class="table-toolbar">
        <span class="table-meta">共 {{ tasks.length }} 条{{ lastRefreshAt ? ` · 最后刷新 ${lastRefreshAt}` : '' }}</span>
      </div>
      <el-table
        :data="tasks"
        v-loading="loading"
        row-key="print_task_id"
        empty-text="暂无打印任务，PDA 操作后点击刷新"
        @selection-change="(rows: PrintTaskItem[]) => selection = rows"
      >
        <el-table-column v-if="activeStatus === 'PENDING'" type="selection" width="42" :selectable="(row: PrintTaskItem) => row.status === 'PENDING'" />
        <el-table-column prop="task_no" label="任务号" width="130" />
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.biz_type_desc }}</el-tag>
            <el-tag v-if="row.is_generative" size="small" type="warning" effect="plain" class="tag-gap">生成式</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="biz_desc" label="条码 / 对象" min-width="150" show-overflow-tooltip />
        <el-table-column label="内容摘要" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ summaryText(row) || '--' }}</template>
        </el-table-column>
        <el-table-column prop="print_qty" label="份数" width="60" align="center" />
        <el-table-column label="来源" width="120">
          <template #default="{ row }">
            <div>{{ row.source_desc }}</div>
            <div class="batch-hint">批次 {{ String(row.batch_id || '').slice(0, 8) }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="created_by_name" label="创建人" width="90" show-overflow-tooltip />
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column v-if="activeStatus !== 'PENDING'" label="完成信息" width="170">
          <template #default="{ row }">
            <div v-if="row.status === 'PRINTED'">{{ row.printed_by_name || '' }} {{ row.printed_at || '' }}</div>
            <div v-else-if="row.cancel_reason" class="batch-hint" :title="row.cancel_reason">取消原因：{{ row.cancel_reason }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ row.status === 'PENDING' ? '待打印' : row.status === 'PRINTED' ? '已打印' : '已取消' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="244" fixed="right">
          <template #default="{ row }">
            <div v-if="row.status === 'PENDING'" class="row-actions">
              <el-button size="small" link type="primary" :loading="previewingTaskId === row.print_task_id" @click="doPreview(row)">预览</el-button>
              <el-button size="small" link type="primary" :loading="printingTaskId === row.print_task_id" :disabled="batchPrinting" @click="printOne(row)">打印</el-button>
              <el-dropdown trigger="click" placement="bottom-end" @command="(command: string) => onRowAction(command, row)">
                <el-button size="small" link type="info" class="row-actions__more">
                  更多<el-icon class="row-actions__caret"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="confirm" :icon="CircleCheck">确认已打印</el-dropdown-item>
                    <el-dropdown-item command="cancel" :icon="Close" divided>取消任务</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <span v-else class="row-actions__empty">--</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 预览弹窗：多标签逐张切换 -->
    <el-dialog v-model="previewVisible" :title="`标签预览 · ${previewTask?.task_no || ''}（${previewTask?.biz_type_desc || ''}）`" width="680px" :close-on-click-modal="false">
      <div v-if="previewViews.length > 1" class="preview-pager">
        <el-button size="small" :disabled="previewIndex === 0" @click="previewIndex -= 1">上一张</el-button>
        <span class="preview-pager__label">第 {{ previewIndex + 1 }} / {{ previewViews.length }} 张 · {{ currentView?.label }}</span>
        <el-button size="small" :disabled="previewIndex >= previewViews.length - 1" @click="previewIndex += 1">下一张</el-button>
      </div>
      <div class="preview-box">
        <div v-if="currentView?.kind === 'pdf'" class="preview-doc" title="点击在新标签页打开完整 PDF" @click="openPdfInNewTab(currentView)">
          <iframe class="preview-doc__frame" :src="currentView.src" title="标签预览" />
        </div>
        <img v-else-if="currentView?.kind === 'image'" :src="currentView.src" alt="打印预览" class="preview-image" />
        <div v-else class="preview-link">{{ currentView?.note || '预览生成失败，可直接打印' }}</div>
      </div>
      <p v-if="currentView?.kind === 'pdf'" class="preview-tip">点击预览图可在新标签页打开完整 PDF（可放大、下载）</p>
      <p v-if="xp.printing.value || nm.printing.value" class="print-progress">打印机执行中，请稍候…</p>
      <template #footer>
        <el-button @click="previewVisible = false">关闭</el-button>
        <el-button type="primary" :loading="!!printingTaskId" :disabled="!previewTask" @click="previewTask && printOne(previewTask)">直接打印</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.print-task-page { padding: 4px 0 20px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
.page-title { margin: 0; font-size: 20px; }
.page-sub { color: #8795a4; font-size: 12px; margin-left: 10px; }
.page-header__right { display: flex; gap: 10px; align-items: center; }
.status-tabs { margin-bottom: 4px; }
.settings-card { margin-bottom: 12px; }
.settings-form .form-row { display: grid; grid-template-columns: 2fr 2fr 1fr; gap: 14px; }
.advanced-collapse { border: 0; margin-top: -6px; }
.advanced-collapse :deep(.el-collapse-item__header) { font-size: 13px; color: #8795a4; height: 36px; }
.advanced-collapse .form-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
.service-alert { margin-top: 10px; }
.service-ok { margin-top: 8px; color: #2e7d32; font-size: 12px; }
.service-pending { margin-top: 8px; color: #8795a4; font-size: 12px; }
/* 芯烨连接方式区（与 PrintLabelDialog 同名同款） */
.xp-conn__addr { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.xp-conn__ip { width: 220px; }
.xp-conn__colon { color: #8795a4; }
.xp-conn__port { width: 120px; }
.xp-conn__found { margin-top: 8px; width: 100%; max-width: 460px; }
.xp-conn__hint { display: block; margin-top: 8px; font-size: 12px; color: #8795a4; }
.xp-conn__status { margin: 0 0 4px; font-size: 12px; color: #8795a4; }
.xp-conn__status.is-ok { color: #2e7d32; }
.xp-conn__status.is-warn { color: #e6a23c; }
.xp-conn__status.is-err { color: #f56c6c; }
.qty-note { color: #8795a4; font-size: 12px; line-height: 32px; }
.table-card { margin-bottom: 0; }
.table-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.table-meta { color: #8795a4; font-size: 12px; }
.tag-gap { margin-left: 4px; }
.batch-hint { color: #8795a4; font-size: 12px; }
/* 行内操作：预览 / 打印 / 更多（下拉）统一为项目通用的 link 文字按钮，强制单行不折行。
   实测最坏情况（预览与打印同时转圈）需要 209px，列宽 244 减去 --table-cell-px*2 后
   内容区 228px，留有余量。 */
.row-actions { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; }
.row-actions :deep(.el-button + .el-button) { margin-left: 0; }
.row-actions__more { padding-left: 6px; padding-right: 6px; }
/* 全局对 link 按钮内的图标有 18px !important，这里收小以免「更多」的行高被撑高 */
.row-actions__caret { margin-left: 2px; font-size: 12px !important; }
.row-actions__empty { color: #c0c4cc; }
.preview-pager { display: flex; justify-content: center; align-items: center; gap: 12px; margin-bottom: 10px; }
.preview-pager__label { font-size: 13px; color: #586a7d; }
.preview-box { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border: 1px dashed #dcdfe6; border-radius: 8px; }
.preview-doc { width: 100%; cursor: pointer; border-radius: 6px; overflow: hidden; }
/* pointer-events: none —— 点击落在容器上开新标签页；内嵌 PDF 只作展示（放大/翻页去新标签页） */
.preview-doc__frame { display: block; width: 100%; height: 380px; border: 0; background: #fff; pointer-events: none; }
.preview-tip { margin: 8px 0 0; color: #8795a4; font-size: 12px; text-align: center; }
.preview-image { max-width: 100%; max-height: 300px; }
.preview-link { padding: 30px 10px; color: #586a7d; font-size: 13px; }
.print-progress { margin: 10px 0 0; color: #586a7d; font-size: 12px; text-align: center; }
@media (max-width: 900px) {
  .settings-form .form-row { grid-template-columns: 1fr; }
  .advanced-collapse .form-row { grid-template-columns: 1fr; }
}
</style>
