<script setup lang="ts">
/**
 * 通用标签打印弹窗（产品条码 / 货位条码 / 塑料盒条码共用）
 * 流程：选打印机型号 → 选标签规格 → 选硬件打印模式与纸张类型 → 预览/打印
 * 数据链：型号/规格来自主后端（接口25/26）；打印数据来自扫码枪后端 print 接口；
 *         按响应 sdk_type 分流——JC（精臣）本地 SDK 绘制直打；XP（芯烨）TSPL 脚本
 *         经本机打印代理直打（预览为后端内联 base64 PDF）；情况B 直接展示临时 PDF
 */
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { getVisiblePrinterList, getVisiblePrinterDetail, type PrinterModelItem, type PrinterLabelSpecItem } from '@/api'
import { printPlasticBox, printProductBarcode, printLocationBarcode, deletePrintTempFiles, type BarcodePrintResult, type PrintData } from '@/api'
import { useNmPrint, PRINT_SERVICE_DOWNLOAD_URL, USB_DRIVER_DOWNLOAD_URL } from '@/utils/nmPrint/useNmPrint'
import { useXpPrint, XP_AGENT_DOWNLOAD_URL } from '@/utils/xpPrint/useXpPrint'
import { mapBackendPrintData } from '@/utils/nmPrint/printDataMapper'

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

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const nm = useNmPrint()
const xp = useXpPrint()

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
/** 情况B：临时 PDF 地址 */
const pdfUrl = ref('')
const pdfExpireSeconds = ref(0)
/** 情况A：SDK 预览图（精臣） */
const previewImage = ref('')
/** 情况C：芯烨内联预览 PDF（base64 data URI） */
const previewPdfBase64 = ref('')

const canSubmit = computed(() =>
  !!modelCode.value && !!specId.value && !!printModeHardware.value && !!labelType.value && props.rows.length > 0 && printQty.value > 0,
)

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
  specOptions.value = []
  specId.value = ''
  if (!modelCodeValue) return
  specLoading.value = true
  try {
    const res = await getVisiblePrinterDetail(modelCodeValue)
    specOptions.value = res.data.label_specs || []
    const model = res.data
    // 默认值：默认规格、默认浓度、型号支持的第一个模式/纸张
    const defaultSpec = specOptions.value.find((item) => item.is_default === 1) || specOptions.value[0]
    if (defaultSpec) specId.value = defaultSpec.spec_id
    density.value = model.density_default
    printModeHardware.value = model.supported_print_modes?.[0] || ''
    labelType.value = model.supported_label_types?.[0] || ''
  } catch {
    specOptions.value = []
  } finally {
    specLoading.value = false
  }
}

watch(modelCode, (value) => { void loadSpecs(value) })

watch(open, (visible) => {
  if (!visible) return
  resetPrintState()
  void loadModels()
  // 提前探测本机打印服务（按所选型号品牌决定真正用到哪个；未安装时引导安装，不阻塞情况B）
  void nm.connectService()
  void xp.connectService()
}, { immediate: true })

function resetPrintState() {
  pdfUrl.value = ''
  previewImage.value = ''
  previewPdfBase64.value = ''
  pdfExpireSeconds.value = 0
  printQty.value = 1
}

/** 调对应业务类型的打印接口（print_mode 由调用方指定） */
async function callPrintApi(printMode: 'PREVIEW' | 'PRINT'): Promise<BarcodePrintResult> {
  const common = {
    printer_model_code: modelCode.value,
    label_spec_id: specId.value,
    print_mode: printMode,
    print_mode_hardware: printModeHardware.value,
    label_type: labelType.value,
    print_qty: printQty.value,
    density: density.value || undefined,
  }
  const row = props.rows[0]
  if (props.kind === 'plasticBox') return printPlasticBox(row.id, common)
  if (props.kind === 'location') return printLocationBarcode(row.id, common)
  return printProductBarcode(row.id, common)
}

/** 预览：PREVIEW 调后端；按 sdk_type 分流——JC 走本地 SDK 生图，XP 渲染内联 base64 PDF，情况B 展示 PDF 链接 */
async function handlePreview() {
  if (!canSubmit.value) return
  preparing.value = true
  try {
    if (currentModel.value?.has_preview_capability === 1 && !await nm.detectPrinter(undefined, '预览')) {
      ElMessage.warning(nm.printError.value)
      return
    }
    const result = await callPrintApi('PREVIEW')
    if (result.printer_has_preview_capability && result.print_data) {
      if (result.sdk_type === 'XP') {
        // 芯烨：浏览器无法渲染 TSPL，预览为后端内联 PDF（生成失败时为 null，不阻塞打印）
        xpLog('预览：后端返回 TSPL 脚本 + 内联预览 PDF')
        if (result.preview_pdf_base64) {
          previewPdfBase64.value = `data:application/pdf;base64,${result.preview_pdf_base64}`
          previewImage.value = ''
          pdfUrl.value = ''
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
            pdfUrl.value = ''
            return
          }
          sdkLog('预览：SDK 未返回图像数据（ImageData 为空）')
        } catch (err) {
          // SDK 阶段失败原因透出（未装打印服务/打印机未连接/绘制报错），不阻塞 PDF 分支
          const msg = err instanceof Error ? err.message : '本地预览失败'
          sdkLog(`预览失败: ${msg}`)
          ElMessage.warning(msg)
        }
      } else {
        sdkLog(`预览：未知 sdk_type=${result.sdk_type}，不喂精臣 SDK`)
        if (!result.pdf_url) return
      }
    } else {
      sdkLog(`预览：后端未走 SDK 分支（has_preview=${result.printer_has_preview_capability}, print_data=${result.print_data ? '有' : '无'}）`)
    }
    if (result.pdf_url) {
      pdfUrl.value = result.pdf_url
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

/** 正式打印：PRINT 模式调后端；按 sdk_type 分流——JC 走本地 SDK，XP 走本机代理直打，情况B 提示下载 PDF */
async function handlePrint() {
  if (!canSubmit.value) { sdkLog(`点击打印但条件不满足：model=${modelCode.value} spec=${specId.value} mode=${printModeHardware.value} label=${labelType.value} rows=${props.rows.length} qty=${printQty.value}`); return }
  sdkLog('【入口】点击了打印按钮')
  printingNow.value = true
  try {
    if (currentModel.value?.has_preview_capability === 1 && !await nm.detectPrinter(undefined, '打印')) {
      ElMessage.warning(nm.printError.value)
      return
    }
    const result = await callPrintApi('PRINT')
    if (result.printer_has_preview_capability && result.print_data) {
      if (result.sdk_type === 'XP') {
        // 芯烨：TSPL 脚本经本机打印代理直打（份数由代理重复写入实现）
        xpLog(`开始打印流程：${result.print_data.tspl_commands?.length ?? 0} 行 TSPL 指令 × ${printQty.value} 份`)
        const ok = await xp.print(result.print_data.tspl_commands || [], { qty: printQty.value })
        if (ok) {
          ElMessage.success(`已提交打印：${props.rows.length} 张标签 × ${printQty.value} 份`)
          emit('printed', props.rows.length)
          open.value = false
        }
        return
      }
      if (result.sdk_type === 'JC') {
        try {
          sdkLog('开始打印流程...')
          const pages = normalizePages(result.print_data)
          sdkLog(`转换后页数据: 画板 ${pages[0].InitDrawingBoardParam.width}×${pages[0].InitDrawingBoardParam.height}mm, ${pages[0].elements.length} 个元素（原始 ${result.print_data.elements?.length ?? 0} 个）`)
          const ok = await nm.print(pages, {
            quantity: printQty.value,
            density: density.value,
            labelType: labelType.value,
            printModeHardware: printModeHardware.value,
          })
          if (ok) {
            ElMessage.success(`已提交打印：${props.rows.length} 张标签 × ${printQty.value} 份`)
            emit('printed', props.rows.length)
            open.value = false
          }
          return
        } catch (err) {
          sdkLog(`打印异常: ${err instanceof Error ? err.message : String(err)}`)
          throw err
        }
      }
      // 防御：后端新增品牌而前端未适配时，绝不把非 JC 数据喂给精臣 SDK
      ElMessage.error(`暂不支持该打印机的直打（sdk_type=${result.sdk_type}），请联系管理员`)
      sdkLog(`【出口】未知 sdk_type=${result.sdk_type}，已拦截`)
      return
    }
    if (result.pdf_url) {
      pdfUrl.value = result.pdf_url
      pdfExpireSeconds.value = result.expire_seconds || 300
      ElMessage.success('该打印机无自动生图能力，请下载 PDF 后打印')
    } else {
      sdkLog(`【出口】打印流程结束但未走任何分支：capability=${result.printer_has_preview_capability}, print_data=${result.print_data ? '有' : '无'}, pdf_url=${result.pdf_url}`)
    }
  } catch (err) {
    sdkLog(`【异常】handlePrint 捕获: ${err instanceof Error ? (err.stack || err.message) : String(err)}`)
    /* 其他错误由拦截器提示 */
  } finally {
    printingNow.value = false
  }
}

/** 弹窗关闭时清理未使用的临时 PDF 与内联预览 */
async function cleanupPdf() {
  previewPdfBase64.value = ''
  if (!pdfUrl.value) return
  try {
    await deletePrintTempFiles([pdfUrl.value])
  } catch {
    /* 清理失败由过期机制兜底 */
  }
  pdfUrl.value = ''
}

watch(open, (visible) => {
  if (!visible) void cleanupPdf()
})

/** 打印服务未安装引导（按当前所选型号品牌决定显示哪个服务的引导；未选型号时两者都可能需要） */
const selectedBrand = computed(() => (currentModel.value?.brand || '').trim())
const nmGuideVisible = computed(() => selectedBrand.value !== '芯烨' && !nm.serviceConnected.value && !nm.connecting.value)
const xpGuideVisible = computed(() => selectedBrand.value === '芯烨' && !xp.serviceConnected.value && !xp.connecting.value)

/** 服务未检测到时手动重新探测（提示条上的"重新检测"按钮） */
async function retryServiceDetect() {
  if (selectedBrand.value === '芯烨') {
    await xp.connectService()
    return
  }
  await nm.connectService()
}

onMounted(() => { void loadModels() })
</script>

<template>
  <el-dialog v-model="open" :title="KIND_META[kind].title" width="640px" :close-on-click-modal="false">
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

    <!-- 打印机选择 -->
    <el-form label-position="top" class="dense-form">
      <div class="form-row">
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
      <div class="form-row">
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
        <el-form-item label="打印浓度">
          <el-input-number v-model="density" :min="currentModel?.density_min ?? 1" :max="currentModel?.density_max ?? 15" controls-position="right" :disabled="!modelCode" />
        </el-form-item>
      </div>
    </el-form>

    <!-- 打印服务引导（按品牌：精臣打印服务 / 芯烨打印代理） -->
    <el-alert v-if="nm.connecting.value" type="info" :closable="false" class="service-alert">
      <template #title>
        <span class="service-checking" role="status">
          <el-icon class="is-loading" aria-hidden="true"><Loading /></el-icon>
          正在检测本机打印服务，请稍候…
        </span>
      </template>
    </el-alert>
    <el-alert v-else-if="nmGuideVisible" type="warning" :closable="false" class="service-alert">
      <template #title>
        {{ nm.serviceError.value || '未检测到本机打印服务（情况A 打印需要）' }}；
        <a :href="PRINT_SERVICE_DOWNLOAD_URL" download>下载打印服务</a>、
        <a :href="USB_DRIVER_DOWNLOAD_URL" download>下载USB驱动（仅Win7需要）</a>。
        如已安装，请启动打印服务后重新检测。无自动生图能力的打印机（情况B）可直接下载 PDF。
        <el-button size="small" type="primary" link @click="retryServiceDetect">重新检测</el-button>
      </template>
    </el-alert>
    <el-alert v-if="xpGuideVisible" type="warning" :closable="false" class="service-alert">
      <template #title>
        未检测到芯烨本机打印代理（芯烨直打需要）；<a :href="XP_AGENT_DOWNLOAD_URL" download>下载芯烨打印代理</a>
        安装后点击重新检测。期间可使用预览（后端生成）确认标签内容。
        <el-button size="small" type="primary" link :loading="xp.connecting.value" @click="retryServiceDetect">重新检测</el-button>
      </template>
    </el-alert>
    <el-alert v-else-if="nm.serviceConnected.value" title="已连接本机打印服务" type="success" show-icon :closable="false" class="service-alert" />

    <!-- 预览 / PDF 结果 -->
    <div v-if="previewImage" class="preview-box">
      <img :src="previewImage" alt="打印预览" />
      <span class="mono-label"></span>
    </div>
    <div v-if="previewPdfBase64" class="preview-box preview-pdf">
      <iframe :src="previewPdfBase64" title="芯烨标签预览" />
    </div>
    <el-alert v-if="pdfUrl" type="success" :closable="false">
      <template #title>
        临时 PDF 已生成（{{ Math.round(pdfExpireSeconds / 60) }} 分钟内有效）：
        <a :href="pdfUrl" target="_blank" rel="noopener">下载 PDF 打印</a>
      </template>
    </el-alert>

    <!-- 打印进度 -->
    <p v-if="nm.progress.value" class="print-progress">{{ nm.progress.value.detail }}</p>
    <p v-if="xp.printing.value" class="print-progress">芯烨打印机执行中，请稍候…</p>

    <template #footer>
      <el-button @click="open = false">取消</el-button>
      <el-button :loading="preparing" :disabled="!canSubmit || printingNow || nm.printing.value" @click="handlePreview">预览</el-button>
      <el-button type="primary" :loading="printingNow" :disabled="!canSubmit || preparing || nm.printing.value" @click="handlePrint">打印</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.print-rows { border: 1px solid var(--line, #e4e7ed); border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; background: #f8fafc; }
.print-rows__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.print-rows ul { list-style: none; margin: 0; padding: 0; }
.print-rows li { display: flex; gap: 10px; align-items: baseline; padding: 3px 0; font-size: 13px; }
.print-rows__sub { color: #8795a4; font-size: 12px; }
.print-rows__more { color: #8795a4; }
.service-alert { margin-bottom: 12px; }
.service-checking { display: inline-flex; align-items: center; gap: 8px; }
.preview-box { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 12px; padding: 12px; border: 1px dashed var(--line, #dcdfe6); border-radius: 8px; }
.preview-box img { max-width: 100%; max-height: 240px; }
.preview-pdf iframe { width: 100%; height: 260px; border: 0; border-radius: 6px; }
.print-progress { margin: 10px 0 0; color: #586a7d; font-size: 12px; text-align: center; }
</style>
