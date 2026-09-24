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
  cancelPrintTask,
  fetchTaskPrintData,
  listPrintTasks,
  markPrintTaskPrinted,
  type PrintableLabel,
} from '@/api/modules/printTask'
import { getVisiblePrinterDetail, getVisiblePrinterList, type PrinterLabelSpecItem, type PrinterModelItem } from '@/api/modules/printerModel'
import { useNmPrint, PRINT_SERVICE_DOWNLOAD_URL, USB_DRIVER_DOWNLOAD_URL } from '@/utils/nmPrint/useNmPrint'
import { useXpPrint, XP_AGENT_DOWNLOAD_URL } from '@/utils/xpPrint/useXpPrint'
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
]

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
const nmGuideVisible = computed(() => selectedBrand.value !== '芯烨' && !nm.serviceConnected.value && !nm.connecting.value)
const xpGuideVisible = computed(() => selectedBrand.value === '芯烨' && !xp.serviceConnected.value && !xp.connecting.value)

interface PrintServiceState {
  name: string
  /** 本机服务/代理本身是否已连上（不代表打印机就绪） */
  connected: boolean
  /** 打印机侧补充；两个服务语义不同：精臣仅打印时占用设备，芯烨由代理常驻上报连接结果 */
  printerNote: string
}

const serviceStates = computed<PrintServiceState[]>(() => {
  const list: PrintServiceState[] = []
  if (selectedBrand.value === '精臣' && (nm.serviceConnected.value || nm.connecting.value)) {
    list.push({
      name: '精臣打印服务',
      connected: nm.serviceConnected.value,
      printerNote: nm.printerName.value ? `打印机 ${nm.printerName.value}` : '',
    })
  }
  if (selectedBrand.value === '芯烨' && (xp.serviceConnected.value || xp.connecting.value)) {
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
  if (!settingsReady.value) { ElMessage.warning('请先选择打印机型号与标签规格'); return }
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
      labels = await fetchTaskPrintData(task, buildParams('PRINT', task.print_qty))
    } catch {
      printingTaskId.value = ''
      return false
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
  if (!settingsReady.value) { ElMessage.warning('请先选择打印机型号与标签规格'); return }
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

async function batchPrint() {
  const pending = selection.value.filter((task) => task.status === 'PENDING')
  if (!pending.length) { ElMessage.warning('请先勾选待打印任务'); return }
  if (!settingsReady.value) { ElMessage.warning('请先选择打印机型号与标签规格'); return }
  const generativeCount = pending.filter((task) => task.is_generative).length
  try {
    await ElMessageBox.confirm(
      `将按顺序打印 ${pending.length} 个任务${generativeCount ? `（其中 ${generativeCount} 个为入库类，打印时才生成新条码）` : ''}。请确认打印机就绪。`,
      '批量打印',
      { confirmButtonText: '开始打印', cancelButtonText: '取消' },
    )
  } catch { return }
  batchPrinting.value = true
  let success = 0
  let failed = 0
  for (const task of pending) {
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
        <span class="page-sub">PDA 下发的条码打印任务在此打印；数据仅在点击刷新时更新</span>
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
