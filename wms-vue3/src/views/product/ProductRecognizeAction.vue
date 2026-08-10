<template>
  <div class="product-recognize-action">
    <!-- 未选图时显示普通入口；选图后原位切换为可展开的真实图片叠层 -->
    <el-tooltip v-if="!previewUrls.length" content="从图片填写产品资料" placement="top" :show-after="300">
      <el-button
        class="recognize-entry-button"
        :loading="recognizing"
        :icon="Camera"
        circle
        @click="triggerSelect"
      />
    </el-tooltip>
    <div
      v-else
      class="recognize-image-entry"
      :class="`is-${previewUrls.length}-image`"
    >
      <button
        type="button"
        class="recognize-image-stack"
        :aria-label="`预览已选择的 ${previewUrls.length} 张产品图片`"
        :disabled="recognizing"
        @click="openImagePreview"
      >
        <span class="recognize-stack-photos" aria-hidden="true">
          <img
            v-for="(url, index) in previewUrls"
            :key="url"
            :src="url"
            alt=""
            :data-preview-index="index"
            class="recognize-stack-photo"
            :class="`is-photo-${index + 1}`"
          />
        </span>
      </button>
      <button
        v-for="(_, index) in previewUrls"
        :key="`delete-${index}`"
        type="button"
        class="recognize-photo-delete"
        :class="`is-delete-${index + 1}`"
        :aria-label="`删除第 ${index + 1} 张图片`"
        :disabled="recognizing"
        @click.stop="removeSelectedImage(index)"
      >
        <el-icon><Close /></el-icon>
      </button>
      <el-popover
        v-model:visible="actionPanelVisible"
        trigger="hover"
        :disabled="recognizing"
        placement="bottom-end"
        :width="260"
        :show-arrow="true"
        :show-after="180"
        :hide-after="100"
        popper-class="product-recognize-popper"
      >
        <template #reference>
          <button
            type="button"
            class="recognize-stack-badge"
            :aria-label="currentFiles.length < MAX_IMAGE_COUNT ? '继续添加图片' : '图片已达到上限，悬停可打开识别操作'"
            :aria-expanded="actionPanelVisible"
            :disabled="recognizing"
            @click="triggerAddImage"
          >
            <el-icon><Plus /></el-icon>
          </button>
        </template>
        <div class="recognize-quick-panel">
          <div class="recognize-quick-heading">
            <span>图片识别</span>
            <span class="recognize-quick-count">{{ currentFiles.length }}/{{ MAX_IMAGE_COUNT }}</span>
          </div>
          <div class="recognize-quick-tip">点击图片可放大预览，悬停可展开查看</div>
          <div class="recognize-quick-actions">
            <el-button :disabled="recognizing" @click="triggerSelect">重新选择</el-button>
            <el-button type="primary" :loading="recognizing" @click="startRecognize">开始识别</el-button>
          </div>
        </div>
      </el-popover>
      <transition name="recognize-progress-fade">
        <div v-if="recognizing" class="recognize-progress-panel" role="status" aria-live="polite">
          <div class="recognize-progress-heading">
            <span class="recognize-progress-stage">
              <el-icon class="is-loading"><Loading /></el-icon>
              {{ recognizeProgressStage }}
            </span>
            <span>{{ recognizeProgress }}%</span>
          </div>
          <el-progress
            :percentage="recognizeProgress"
            :stroke-width="7"
            :show-text="false"
          />
          <div class="recognize-progress-meta">
            已用时 {{ recognizeElapsedSeconds }} 秒，请勿关闭当前页面
          </div>
        </div>
      </transition>
    </div>
    <el-image-viewer
      v-if="imagePreviewVisible"
      :url-list="previewUrls"
      :initial-index="imagePreviewInitialIndex"
      :hide-on-click-modal="true"
      :infinite="false"
      @close="imagePreviewVisible = false"
    />
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      multiple
      class="recognize-file-input"
      @change="onFileChange"
    />

  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Camera, Close, Loading, Plus } from '@element-plus/icons-vue'
import { recognizeProductImages, type RecognizeField } from '@/api/modules/product'

interface Props {
  /** AddTemplate 的表单数据（reactive 引用，回填直接修改） */
  formData: Record<string, any>
  /** AddTemplate 单独维护的动态表格数据（客户价格、关联供应商） */
  dynamicTableData: Record<string, any[]>
  isEdit: boolean
  isReadonly: boolean
}
const props = defineProps<Props>()

/** 识别字段中文标签（与后端 service 保持一致） */
const FIELD_LABELS: Record<string, string> = {
  product_name: '产品名称',
  item_no: '品号',
  specification: '规格',
  origin_place: '原产地',
  color: '颜色',
  remark: '备注',
  unit_weight: '单位重量',
  package_qty: '包装数量',
  factory_price: '预设出厂价',
  weight_tolerance: '称重误差',
  convert_ratio: '换算比例',
  stock_warning_qty: '库存预警数量',
  production_cycle_days: '生产周期(天)',
  gross_profit_ctrl_rate: '毛利控制比例',
  category_id: '产品类别',
  unit_id: '计量单位',
  assist_unit_id: '辅助单位',
  product_type: '产品类型',
  product_status: '产品状态',
  is_weighing: '是否称重',
  is_combined: '是否组合产品',
  fifo_flag: '是否先进先出',
  sale_prices: '客户价格',
  product_suppliers: '关联供应商',
}

/** A 级字段：自由文本直填 */
const GROUP_A = new Set(['product_name', 'item_no', 'specification', 'origin_place', 'color', 'remark'])
/** B 级字段：数值校验（key -> 表单默认值，等于默认值视为用户未改） */
const GROUP_B_DEFAULTS: Record<string, number> = {
  unit_weight: 0,
  package_qty: 0,
  factory_price: 0,
  weight_tolerance: 0,
  convert_ratio: 1,
  stock_warning_qty: 0,
  production_cycle_days: 0,
  gross_profit_ctrl_rate: 0,
}
/** C 级字段：字典 ID */
const GROUP_C = new Set(['category_id', 'unit_id', 'assist_unit_id'])
/** 受控枚举字段 */
const GROUP_ENUM = new Set(['product_type', 'product_status'])
/** 是/否字段及新增表单默认值 */
const GROUP_BOOLEAN_DEFAULTS: Record<string, number> = {
  is_weighing: 0,
  is_combined: 0,
  fifo_flag: 1,
}
const GROUP_COLLECTION = new Set(['sale_prices', 'product_suppliers'])

const ENUM_INPUT_MAP: Record<string, Record<string, string>> = {
  product_type: {
    GOODS: 'GOODS', 实物商品: 'GOODS', 实物: 'GOODS',
    VIRTUAL: 'VIRTUAL', 虚拟商品: 'VIRTUAL', 虚拟: 'VIRTUAL',
  },
  product_status: {
    ON_SALE: 'ON_SALE', 在售: 'ON_SALE',
    OFF_SALE: 'OFF_SALE', 停售: 'OFF_SALE',
    DISCONTINUED: 'DISCONTINUED', 停产: 'DISCONTINUED',
  },
}

interface ResultItem {
  key: string
  label: string
  value: string
  initialValue: string
  rawValue: unknown
  kind: 'scalar' | 'collection'
  confidence: 'high' | 'medium' | 'low'
  /** fill=将回填；skip=表单已有值，不覆盖 */
  state: 'fill' | 'skip'
}

const MAX_IMAGE_COUNT = 3
const MAX_IMAGE_MB = 5
const RECOGNIZE_DURATION_KEY = 'productRecognize:averageDuration'

const fileInputRef = ref<HTMLInputElement | null>(null)
const actionPanelVisible = ref(false)
const imagePreviewVisible = ref(false)
const imagePreviewInitialIndex = ref(0)
const previewUrls = ref<string[]>([])
const currentFiles = ref<File[]>([])
const recognizing = ref(false)
const recognizeProgress = ref(0)
const recognizeProgressStage = ref('正在准备图片')
const recognizeElapsedSeconds = ref(0)
const selectionMode = ref<'replace' | 'append'>('replace')
let recognizeProgressTimer: number | null = null

onBeforeUnmount(releasePreviewUrl)
onBeforeUnmount(stopRecognizeProgressTimer)

function triggerSelect() {
  if (props.isEdit || props.isReadonly) return
  actionPanelVisible.value = false
  selectionMode.value = 'replace'
  fileInputRef.value?.click()
}

function triggerAddImage() {
  if (recognizing.value || currentFiles.value.length >= MAX_IMAGE_COUNT) return
  actionPanelVisible.value = false
  selectionMode.value = 'append'
  fileInputRef.value?.click()
}

function openImagePreview(event: MouseEvent) {
  if (recognizing.value || !previewUrls.value.length) return
  actionPanelVisible.value = false
  const target = event.target as HTMLElement | null
  const clickedImage = target?.closest<HTMLElement>('[data-preview-index]')
  const clickedIndex = Number(clickedImage?.dataset.previewIndex)
  imagePreviewInitialIndex.value = Number.isInteger(clickedIndex)
    && clickedIndex >= 0
    && clickedIndex < previewUrls.value.length
    ? clickedIndex
    : Math.max(0, previewUrls.value.length - 1)
  imagePreviewVisible.value = true
}

function removeSelectedImage(index: number) {
  if (recognizing.value || index < 0 || index >= previewUrls.value.length) return
  actionPanelVisible.value = false
  const [removedUrl] = previewUrls.value.splice(index, 1)
  currentFiles.value.splice(index, 1)
  if (removedUrl) URL.revokeObjectURL(removedUrl)
  if (!previewUrls.value.length) {
    imagePreviewVisible.value = false
    imagePreviewInitialIndex.value = 0
  } else if (imagePreviewInitialIndex.value >= previewUrls.value.length) {
    imagePreviewInitialIndex.value = previewUrls.value.length - 1
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  const retainedCount = selectionMode.value === 'append' ? currentFiles.value.length : 0
  if (retainedCount + files.length > MAX_IMAGE_COUNT) {
    ElMessage.warning(`最多上传 ${MAX_IMAGE_COUNT} 张图片`)
    input.value = ''
    return
  }
  if (files.some(file => !file.type.startsWith('image/'))) {
    ElMessage.warning('请选择图片文件')
    input.value = ''
    return
  }
  const oversizedFile = files.find(file => file.size > MAX_IMAGE_MB * 1024 * 1024)
  if (oversizedFile) {
    ElMessage.warning(`每张图片不能超过 ${MAX_IMAGE_MB}MB：${oversizedFile.name}`)
    input.value = ''
    return
  }
  if (selectionMode.value === 'replace') resetSelectedImages()
  currentFiles.value = [...currentFiles.value, ...files]
  previewUrls.value = [...previewUrls.value, ...files.map(file => URL.createObjectURL(file))]
  actionPanelVisible.value = false
  input.value = ''
}

function resetSelectedImages() {
  actionPanelVisible.value = false
  imagePreviewVisible.value = false
  releasePreviewUrl()
  currentFiles.value = []
}

function releasePreviewUrl() {
  previewUrls.value.forEach(url => URL.revokeObjectURL(url))
  previewUrls.value = []
}

async function startRecognize() {
  if (!currentFiles.value.length) {
    ElMessage.warning('请先选择图片')
    return
  }
  actionPanelVisible.value = false
  recognizing.value = true
  const progressStartedAt = startRecognizeProgress()
  try {
    const res = await recognizeProductImages(currentFiles.value)
    await completeRecognizeProgress(progressStartedAt)
    const data = res.data
    const warnings = data?.warnings || []
    const resultFields = buildResultItems(data?.fields || {})
    actionPanelVisible.value = false
    if (resultFields.length === 0) {
      ElMessage.warning(
        warnings.length
          ? `未识别到可回填字段：${warnings.join('；')}`
          : '该图片未识别到可填写的产品字段，请手动填写'
      )
      resetSelectedImages()
      return
    }
    applyRecognizedFields(resultFields)
    if (warnings.length) ElMessage.warning(warnings.join('；'))
    resetSelectedImages()
  } catch (e: any) {
    recognizeProgressStage.value = '识别未完成'
    // 响应拦截器已统一提示，这里仅兜底
    if (!e?.__handledMessage) ElMessage.error('图片识别失败，请稍后重试')
  } finally {
    stopRecognizeProgressTimer()
    recognizing.value = false
  }
}

function startRecognizeProgress(): number {
  stopRecognizeProgressTimer()
  const startedAt = performance.now()
  const expectedDuration = getExpectedRecognizeDuration()
  recognizeProgress.value = 4
  recognizeElapsedSeconds.value = 0
  recognizeProgressStage.value = '正在提交图片'
  recognizeProgressTimer = window.setInterval(() => {
    const elapsed = performance.now() - startedAt
    const ratio = elapsed / expectedDuration
    const estimated = ratio <= 1
      ? 4 + 81 * ratio
      : 85 + 7 * (1 - Math.exp(-(ratio - 1)))
    recognizeProgress.value = Math.min(92, Math.max(recognizeProgress.value, Math.round(estimated)))
    recognizeElapsedSeconds.value = Math.max(1, Math.floor(elapsed / 1000))
    if (recognizeProgress.value < 14) recognizeProgressStage.value = '正在提交图片'
    else if (recognizeProgress.value < 82) recognizeProgressStage.value = 'AI 正在识别图片'
    else recognizeProgressStage.value = '正在等待并整理结果'
  }, 400)
  return startedAt
}

async function completeRecognizeProgress(startedAt: number) {
  const elapsed = Math.max(1, performance.now() - startedAt)
  saveRecognizeDuration(elapsed)
  stopRecognizeProgressTimer()
  recognizeElapsedSeconds.value = Math.max(1, Math.round(elapsed / 1000))
  recognizeProgressStage.value = '识别完成'
  recognizeProgress.value = 100
  await new Promise(resolve => window.setTimeout(resolve, 220))
}

function getExpectedRecognizeDuration(): number {
  const imageCount = currentFiles.value.length
  const totalMb = currentFiles.value.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024
  const fallback = 22000 + Math.max(0, imageCount - 1) * 7000 + totalMb * 500
  try {
    const history = JSON.parse(localStorage.getItem(RECOGNIZE_DURATION_KEY) || '{}') as Record<string, number>
    const historical = Number(history[String(imageCount)])
    return Number.isFinite(historical) && historical > 0
      ? Math.min(120000, Math.max(8000, historical))
      : fallback
  } catch {
    return fallback
  }
}

function saveRecognizeDuration(duration: number) {
  const imageCount = currentFiles.value.length
  try {
    const history = JSON.parse(localStorage.getItem(RECOGNIZE_DURATION_KEY) || '{}') as Record<string, number>
    const previous = Number(history[String(imageCount)])
    const bounded = Math.min(120000, Math.max(3000, duration))
    history[String(imageCount)] = Number.isFinite(previous) && previous > 0
      ? Math.round(previous * 0.7 + bounded * 0.3)
      : Math.round(bounded)
    localStorage.setItem(RECOGNIZE_DURATION_KEY, JSON.stringify(history))
  } catch {
    // 隐私模式或存储空间不可用时退回本次会话的默认估算，不影响识别。
  }
}

function stopRecognizeProgressTimer() {
  if (recognizeProgressTimer === null) return
  window.clearInterval(recognizeProgressTimer)
  recognizeProgressTimer = null
}

function buildResultItems(fields: Record<string, RecognizeField>): ResultItem[] {
  const items: ResultItem[] = []
  for (const [key, field] of Object.entries(fields)) {
    const label = FIELD_LABELS[key] || key
    const kind = GROUP_COLLECTION.has(key) ? 'collection' : 'scalar'
    const value = formatRecognizeValue(key, field)
    items.push({
      key,
      label,
      value,
      initialValue: value,
      rawValue: field?.value,
      kind,
      confidence: field?.confidence || 'medium',
      state: shouldFill(key) ? 'fill' : 'skip',
    })
  }
  return items
}

function formatRecognizeValue(key: string, field: RecognizeField): string {
  const raw = field?.value
  if (key === 'product_suppliers' && Array.isArray(raw)) {
    return raw.map(row => String(row?.supplier_name || row?.supplier_id || '')).filter(Boolean).join('、')
  }
  if (key === 'sale_prices' && Array.isArray(raw)) {
    return raw.map(row => {
      const typeName = row?.customer_type_name || row?.customer_type_id || '客户类型'
      return `${typeName}: ${row?.sale_price ?? ''}`
    }).join('；')
  }
  if (field?.label) return field.label
  return raw === null || raw === undefined ? '' : String(raw)
}

/** 覆盖保护：判断识别值是否应回填到表单（用户已手填/非法值则不回填） */
function shouldFill(key: string): boolean {
  if (GROUP_COLLECTION.has(key)) {
    return !(props.dynamicTableData[key]?.length > 0)
  }
  const raw = props.formData[key]
  const isEmpty = raw === undefined || raw === null || raw === ''
  if (isEmpty) return true
  if (GROUP_A.has(key) || GROUP_C.has(key) || GROUP_ENUM.has(key)) return false
  // B 级数值：等于表单默认值视为用户未改，可回填
  if (key in GROUP_B_DEFAULTS) {
    return Number(raw) === GROUP_B_DEFAULTS[key]
  }
  if (key in GROUP_BOOLEAN_DEFAULTS) {
    return Number(raw) === GROUP_BOOLEAN_DEFAULTS[key]
  }
  return false
}

function applyRecognizedFields(resultFields: ResultItem[]) {
  const skipped: string[] = []
  let filled = 0
  for (const item of resultFields) {
    if (item.kind === 'collection') {
      if (!Array.isArray(item.rawValue) || item.rawValue.length === 0) continue
    } else if (!(item.value || '').trim()) {
      continue
    }
    if (!applyField(item)) {
      skipped.push(item.label)
      continue
    }
    filled++
  }
  if (filled > 0) {
    ElMessage.success(`识别完成，已自动回填 ${filled} 个字段`)
  }
  if (skipped.length) {
    ElMessage.warning(`以下字段未回填：${skipped.join('、')}`)
  }
  if (filled === 0 && skipped.length === 0) {
    ElMessage.info('没有可回填的内容')
  }
}

/** 单字段回填：返回 false 表示未写入（用户已有值或字典未命中） */
function applyField(item: ResultItem): boolean {
  const { key } = item
  if (GROUP_COLLECTION.has(key)) {
    if (props.dynamicTableData[key]?.length > 0 || !Array.isArray(item.rawValue)) return false
    props.dynamicTableData[key] = item.rawValue.map(row => ({ ...row }))
    return true
  }

  const edited = item.value.trim() !== item.initialValue.trim()
  const resolvedValue = edited ? item.value.trim() : item.rawValue
  const current = props.formData[key]
  const hasValue = current !== undefined && current !== null && current !== ''

  // A 级：自由文本直填
  if (GROUP_A.has(key)) {
    if (hasValue) return false
    props.formData[key] = String(resolvedValue ?? '').trim()
    return true
  }

  // B 级：数值校验
  if (key in GROUP_B_DEFAULTS) {
    const num = Number(resolvedValue)
    if (Number.isNaN(num)) return false
    if (hasValue && Number(current) !== GROUP_B_DEFAULTS[key]) return false
    props.formData[key] = num
    return true
  }

  // C 级：字典 ID（category_id 额外回显 _label）
  if (GROUP_C.has(key)) {
    if (hasValue) return false
    let id = String(resolvedValue ?? '').trim()
    let display = item.initialValue
    if (edited) {
      if (key === 'category_id') {
        const matched = matchCategoryFromCache(item.value)
        if (!matched) return false
        id = matched.id
        display = matched.display
      } else {
        const matched = matchUnitFromCache(item.value)
        if (!matched) return false
        id = matched.id
        display = matched.display
      }
    }
    if (!id) return false
    props.formData[key] = id
    if (key === 'category_id') {
      // input-suffix 回显字段约定为 {key}_label
      props.formData.category_id_label = display
    }
    return true
  }

  if (GROUP_ENUM.has(key)) {
    if (hasValue) return false
    const normalized = edited
      ? normalizeEnumInput(key, item.value)
      : String(resolvedValue ?? '').trim()
    if (!normalized) return false
    props.formData[key] = normalized
    return true
  }

  if (key in GROUP_BOOLEAN_DEFAULTS) {
    if (hasValue && Number(current) !== GROUP_BOOLEAN_DEFAULTS[key]) return false
    const normalized = edited ? normalizeBooleanInput(item.value) : Number(resolvedValue)
    if (normalized !== 0 && normalized !== 1) return false
    props.formData[key] = normalized
    return true
  }
  return false
}

function normalizeEnumInput(key: string, value: string): string | null {
  const trimmed = value.trim()
  return ENUM_INPUT_MAP[key]?.[trimmed] || ENUM_INPUT_MAP[key]?.[trimmed.toUpperCase()] || null
}

function normalizeBooleanInput(value: string): number | null {
  const normalized = value.trim().toLowerCase()
  if (['1', '是', '有', 'true', 'yes', '启用'].includes(normalized)) return 1
  if (['0', '否', '无', 'false', 'no', '禁用'].includes(normalized)) return 0
  return null
}

/** 从 sessionStorage 类别树缓存中按名称匹配（后端未命中时的前端兜底） */
function matchCategoryFromCache(name: string): { id: string; display: string } | null {
  const raw = sessionStorage.getItem('treeCache:productCategory')
  if (!raw) return null
  let tree: any[]
  try { tree = JSON.parse(raw) } catch { return null }
  const normalized = name.replace(/\s/g, '').toLowerCase()
  const walk = (nodes: any[]): any | null => {
    for (const n of nodes || []) {
      const cand = String(n?.name || '').replace(/\s/g, '').toLowerCase()
      if (cand && (cand === normalized || cand.includes(normalized) || normalized.includes(cand))) {
        return n
      }
      if (n?.children?.length) {
        const hit = walk(n.children)
        if (hit) return hit
      }
    }
    return null
  }
  const hit = walk(tree)
  if (!hit) return null
  return { id: String(hit.category_id ?? hit.id), display: hit.name }
}

/** 从 sessionStorage 单位选项缓存中按名称匹配 */
function matchUnitFromCache(name: string): { id: string; display: string } | null {
  const raw = sessionStorage.getItem('optionsCache:productUnit')
  if (!raw) return null
  let opts: Array<{ label: string; value: string | number }>
  try { opts = JSON.parse(raw) } catch { return null }
  const normalized = name.replace(/\s/g, '').toLowerCase()
  const hit = opts.find(o => String(o.label).replace(/\s/g, '').toLowerCase() === normalized)
    || opts.find(o => {
      const cand = String(o.label).replace(/\s/g, '').toLowerCase()
      return cand && normalized && (cand.includes(normalized) || normalized.includes(cand))
    })
  if (!hit) return null
  return { id: String(hit.value), display: hit.label }
}
</script>

<style scoped>
.product-recognize-action {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
}

.recognize-entry-button {
  flex-shrink: 0;
  color: var(--info);
  border-color: color-mix(in srgb, var(--info) 45%, transparent);
  background: transparent;
}

.recognize-entry-button:hover,
.recognize-entry-button:focus-visible {
  color: var(--info);
  border-color: var(--info);
  background: var(--info-light);
}

.recognize-image-entry {
  position: relative;
  width: 82px;
  height: 56px;
  margin: -12px 4px;
  flex-shrink: 0;
  transition: width 260ms ease;
}

.recognize-progress-panel {
  position: absolute;
  top: calc(100% + 13px);
  right: 0;
  z-index: 20;
  width: 248px;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-bg-color);
  box-shadow: var(--el-box-shadow-light);
}

.recognize-progress-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.recognize-progress-stage {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.recognize-progress-stage .el-icon {
  color: var(--el-color-primary);
  font-size: 15px;
}

.recognize-progress-meta {
  margin-top: 7px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 16px;
}

.recognize-progress-fade-enter-active,
.recognize-progress-fade-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.recognize-progress-fade-enter-from,
.recognize-progress-fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.recognize-image-stack {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  cursor: pointer;
}

.recognize-image-stack:disabled {
  cursor: wait;
  opacity: 0.65;
}

.recognize-stack-photos {
  position: absolute;
  inset: 0;
}

.recognize-stack-photo {
  position: absolute;
  top: -7px;
  left: 8px;
  width: 58px;
  height: 70px;
  box-sizing: border-box;
  border: 2px solid #fff;
  border-radius: 3px;
  background: var(--el-fill-color-light);
  box-shadow: 0 3px 9px rgba(25, 35, 48, 0.24);
  object-fit: cover;
  transform-origin: 50% 76%;
  transition: left 260ms ease, transform 260ms ease, box-shadow 260ms ease;
}

.recognize-stack-photo.is-photo-1 {
  z-index: 1;
  transform: rotate(-7deg);
}

.recognize-stack-photo.is-photo-2 {
  top: -6px;
  left: 12px;
  z-index: 2;
  transform: rotate(4deg);
}

.recognize-stack-photo.is-photo-3 {
  top: -5px;
  left: 15px;
  z-index: 3;
  transform: rotate(-2deg);
}

.recognize-photo-delete {
  position: absolute;
  top: -13px;
  left: 52px;
  z-index: 6;
  display: flex;
  width: 20px;
  height: 20px;
  padding: 0;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--el-bg-color, #fff);
  border-radius: 50%;
  color: #fff;
  background: rgba(48, 49, 51, 0.82);
  box-shadow: 0 2px 5px rgba(25, 35, 48, 0.24);
  cursor: pointer;
  opacity: 0;
  outline: 0;
  pointer-events: none;
  transform: scale(0.78);
  transition: left 260ms ease, opacity 160ms ease, transform 180ms ease, background 160ms ease;
}

.recognize-photo-delete.is-delete-2 {
  left: 56px;
}

.recognize-photo-delete.is-delete-3 {
  left: 59px;
}

.recognize-image-entry:hover .recognize-photo-delete,
.recognize-image-entry:focus-within .recognize-photo-delete {
  opacity: 1;
  pointer-events: auto;
  transform: scale(1);
}

.recognize-photo-delete:hover,
.recognize-photo-delete:focus-visible {
  background: var(--el-color-danger);
}

.recognize-photo-delete:disabled {
  cursor: wait;
  opacity: 0.55;
}

.recognize-image-entry.is-1-image .recognize-stack-photo.is-photo-1 {
  left: 10px;
  transform: rotate(-4deg);
}

.recognize-stack-badge {
  position: absolute;
  right: 0;
  bottom: -1px;
  z-index: 4;
  display: flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--el-bg-color, #fff);
  border-radius: 50%;
  color: #fff;
  background: var(--el-text-color-secondary, #909399);
  box-shadow: 0 2px 5px rgba(25, 35, 48, 0.2);
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  padding: 0;
  outline: 0;
  cursor: pointer;
  transition: opacity 180ms ease, transform 260ms ease;
}

.recognize-stack-badge:disabled {
  cursor: wait;
  opacity: 0.65;
}

.recognize-stack-badge .el-icon {
  font-size: 17px;
}

.recognize-image-entry:hover,
.recognize-image-entry:focus-within {
  width: 138px;
}

.recognize-image-entry.is-3-image:hover,
.recognize-image-entry.is-3-image:focus-within {
  width: 204px;
}

.recognize-image-entry:hover .recognize-stack-photo,
.recognize-image-entry:focus-within .recognize-stack-photo {
  box-shadow: 0 5px 13px rgba(25, 35, 48, 0.28);
}

.recognize-image-entry.is-2-image:hover .is-photo-1,
.recognize-image-entry.is-2-image:focus-within .is-photo-1 {
  left: 3px;
  transform: rotate(-8deg);
}

.recognize-image-entry.is-2-image:hover .is-photo-2,
.recognize-image-entry.is-2-image:focus-within .is-photo-2 {
  left: 72px;
  transform: rotate(8deg);
}

.recognize-image-entry.is-2-image:hover .is-delete-1,
.recognize-image-entry.is-2-image:focus-within .is-delete-1 {
  left: 49px;
}

.recognize-image-entry.is-2-image:hover .is-delete-2,
.recognize-image-entry.is-2-image:focus-within .is-delete-2 {
  left: 117px;
}

.recognize-image-entry.is-3-image:hover .is-photo-1,
.recognize-image-entry.is-3-image:focus-within .is-photo-1 {
  left: 3px;
  transform: rotate(-8deg);
}

.recognize-image-entry.is-3-image:hover .is-photo-2,
.recognize-image-entry.is-3-image:focus-within .is-photo-2 {
  left: 70px;
  transform: rotate(3deg);
}

.recognize-image-entry.is-3-image:hover .is-photo-3,
.recognize-image-entry.is-3-image:focus-within .is-photo-3 {
  left: 139px;
  transform: rotate(8deg);
}

.recognize-image-entry.is-3-image:hover .is-delete-1,
.recognize-image-entry.is-3-image:focus-within .is-delete-1 {
  left: 49px;
}

.recognize-image-entry.is-3-image:hover .is-delete-2,
.recognize-image-entry.is-3-image:focus-within .is-delete-2 {
  left: 116px;
}

.recognize-image-entry.is-3-image:hover .is-delete-3,
.recognize-image-entry.is-3-image:focus-within .is-delete-3 {
  left: 184px;
}

.recognize-image-entry.is-1-image:hover .is-photo-1,
.recognize-image-entry.is-1-image:focus-within .is-photo-1 {
  left: 5px;
  transform: rotate(-6deg);
}

.recognize-image-entry.is-1-image:hover .is-delete-1,
.recognize-image-entry.is-1-image:focus-within .is-delete-1 {
  left: 52px;
}

.recognize-image-entry:hover .recognize-stack-badge,
.recognize-image-entry:focus-within .recognize-stack-badge {
  transform: translateX(4px) scale(1.05);
}

.recognize-image-stack:focus-visible::after {
  position: absolute;
  inset: -6px;
  border: 2px solid var(--el-color-primary);
  border-radius: 8px;
  content: '';
}

.recognize-file-input {
  display: none;
}

.recognize-quick-panel {
  padding: 2px;
}

.recognize-quick-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
}

.recognize-quick-count {
  padding: 1px 7px;
  border-radius: 10px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  font-size: 12px;
  font-weight: 600;
}

.recognize-quick-tip {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}

.recognize-quick-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.recognize-quick-actions .el-button {
  min-width: 0;
  flex: 1;
  padding-right: 8px;
  padding-left: 8px;
}

.recognize-quick-actions .el-button + .el-button {
  margin-left: 0;
}

</style>
