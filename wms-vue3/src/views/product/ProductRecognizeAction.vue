<template>
  <div class="product-recognize-action">
    <div class="recognize-entry-bar">
      <div class="recognize-entry-icon" aria-hidden="true">
        <el-icon><Picture /></el-icon>
      </div>
      <div class="recognize-entry-copy">
        <div class="recognize-entry-title">从图片填写产品资料</div>
        <div class="recognize-entry-description">上传1～2张同一产品的图片，识别后确认回填</div>
      </div>
      <el-button class="recognize-entry-button" :loading="recognizing" @click="triggerSelect">
        选择图片
      </el-button>
    </div>
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      multiple
      class="recognize-file-input"
      @change="onFileChange"
    />

    <!-- 预览窗口：选图后先预览，再点「开始识别」 -->
    <el-dialog
      v-model="previewVisible"
      title="图片预览"
      width="460px"
      append-to-body
      :close-on-click-modal="false"
      @closed="releasePreviewUrl"
    >
      <div v-if="previewUrls.length" class="recognize-preview-list">
        <div v-for="(url, index) in previewUrls" :key="url" class="recognize-preview">
          <img :src="url" :alt="`产品图片预览${index + 1}`" />
          <span class="recognize-preview-index">图片 {{ index + 1 }}</span>
        </div>
      </div>
      <div v-else class="recognize-preview recognize-preview-empty">暂无可预览的图片</div>
      <div class="recognize-preview-tip">已选择 {{ currentFiles.length }}/{{ MAX_IMAGE_COUNT }} 张，每张不超过 {{ MAX_IMAGE_MB }}MB</div>
      <template #footer>
        <el-button
          v-if="currentFiles.length < MAX_IMAGE_COUNT"
          :disabled="recognizing"
          @click="triggerAddImage"
        >添加图片</el-button>
        <el-button :disabled="recognizing" @click="previewVisible = false">取消</el-button>
        <el-button type="primary" :loading="recognizing" @click="startRecognize">开始识别</el-button>
      </template>
    </el-dialog>

    <!-- 识别结果确认：可编辑识别值，确认后回填表单 -->
    <el-dialog
      v-model="resultVisible"
      title="识别结果确认"
      width="560px"
      append-to-body
    >
      <div v-if="resultFields.length === 0" class="recognize-empty">
        未从图片中识别到可填写的字段{{ warnings.length ? '（详见下方提示）' : '' }}。
      </div>
      <el-scrollbar v-else max-height="380px">
        <div v-for="item in resultFields" :key="item.key" class="recognize-field-row">
          <span class="recognize-field-label">{{ item.label }}</span>
          <span class="recognize-conf" :class="'is-' + item.confidence">{{ confText(item.confidence) }}</span>
          <div v-if="item.kind === 'collection'" class="recognize-collection-value">
            {{ item.value }}
          </div>
          <el-input
            v-else
            v-model="item.value"
            size="small"
            class="recognize-field-value"
            :placeholder="item.label"
          />
          <span
            class="recognize-state"
            :class="item.state === 'skip' ? 'is-skip' : 'is-fill'"
          >{{ item.state === 'skip' ? '已有值，不覆盖' : '将回填' }}</span>
        </div>
      </el-scrollbar>
      <div v-if="warnings.length" class="recognize-warnings">
        <div v-for="(w, i) in warnings" :key="i" class="recognize-warning-line">{{ w }}</div>
      </div>
      <template #footer>
        <el-button @click="resultVisible = false">取消</el-button>
        <el-button type="primary" :disabled="resultFields.length === 0" @click="confirmFill">
          确认回填
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Picture } from '@element-plus/icons-vue'
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

const MAX_IMAGE_COUNT = 2
const MAX_IMAGE_MB = 5

const fileInputRef = ref<HTMLInputElement | null>(null)
const previewVisible = ref(false)
const previewUrls = ref<string[]>([])
const currentFiles = ref<File[]>([])
const recognizing = ref(false)
const resultVisible = ref(false)
const resultFields = ref<ResultItem[]>([])
const warnings = ref<string[]>([])

// 表单复位（新增页「重置」）时同步清理识别状态
watch(
  () => JSON.stringify(props.formData),
  () => {
    // 仅当表单被重置（整体清空）时收敛弹窗，避免每次回填都误触发
    if (!resultVisible.value && !previewVisible.value) return
  }
)

function triggerSelect() {
  if (props.isEdit || props.isReadonly) return
  resetSelectedImages()
  fileInputRef.value?.click()
}

function triggerAddImage() {
  if (recognizing.value || currentFiles.value.length >= MAX_IMAGE_COUNT) return
  fileInputRef.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  if (currentFiles.value.length + files.length > MAX_IMAGE_COUNT) {
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
  currentFiles.value = [...currentFiles.value, ...files]
  previewUrls.value = [...previewUrls.value, ...files.map(file => URL.createObjectURL(file))]
  previewVisible.value = true
  input.value = ''
}

function resetSelectedImages() {
  releasePreviewUrl()
  currentFiles.value = []
}

function releasePreviewUrl() {
  previewUrls.value.forEach(url => URL.revokeObjectURL(url))
  previewUrls.value = []
}

function confText(level: string): string {
  if (level === 'high') return '高置信'
  if (level === 'medium') return '中置信'
  return '低置信'
}

async function startRecognize() {
  if (!currentFiles.value.length) {
    ElMessage.warning('请先选择图片')
    return
  }
  recognizing.value = true
  try {
    const res = await recognizeProductImages(currentFiles.value)
    const data = res.data
    warnings.value = data?.warnings || []
    resultFields.value = buildResultItems(data?.fields || {})
    previewVisible.value = false
    if (resultFields.value.length === 0 && warnings.value.length === 0) {
      ElMessage.info('未从图片中识别到可填写的字段')
      return
    }
    resultVisible.value = true
  } catch (e: any) {
    // 响应拦截器已统一提示，这里仅兜底
    if (!e?.__handledMessage) ElMessage.error('图片识别失败，请稍后重试')
  } finally {
    recognizing.value = false
  }
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

function confirmFill() {
  const skipped: string[] = []
  let filled = 0
  for (const item of resultFields.value) {
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
  resultVisible.value = false
  if (filled > 0) {
    ElMessage.success(`已回填 ${filled} 个字段`)
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
  display: block;
  width: 100%;
}

.recognize-entry-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 72px;
  padding: 14px 16px 14px 18px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
}

.recognize-entry-bar::before {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--info);
  content: '';
}

.recognize-entry-icon {
  display: flex;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--info);
  background: var(--info-light);
  font-size: 22px;
}

.recognize-entry-copy {
  min-width: 0;
  flex: 1;
}

.recognize-entry-title {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.recognize-entry-description {
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 20px;
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

.recognize-file-input {
  display: none;
}

.recognize-preview-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.recognize-preview {
  position: relative;
  width: 100%;
  height: 320px;
  border-radius: 6px;
  border: 1px dashed #d9d9d9;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #fafafa;
}

.recognize-preview-list .recognize-preview {
  height: 280px;
}

.recognize-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.recognize-preview-empty {
  color: #999;
  font-size: 13px;
}

.recognize-preview-index {
  position: absolute;
  left: 8px;
  bottom: 8px;
  padding: 2px 7px;
  border-radius: 10px;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  font-size: 12px;
}

.recognize-preview-tip {
  margin-top: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-align: center;
}

.recognize-empty {
  padding: 20px 0;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

.recognize-field-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 2px;
}

.recognize-field-label {
  width: 96px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--text-primary);
  text-align: right;
}

.recognize-conf {
  flex-shrink: 0;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  line-height: 16px;
}

.recognize-conf.is-high {
  color: #389e0d;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
}

.recognize-conf.is-medium {
  color: #d46b08;
  background: #fff7e6;
  border: 1px solid #ffd591;
}

.recognize-conf.is-low {
  color: #8c8c8c;
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
}

.recognize-field-value {
  flex: 1;
}

.recognize-collection-value {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  font-size: 13px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.recognize-state {
  flex-shrink: 0;
  font-size: 12px;
  white-space: nowrap;
}

.recognize-state.is-fill {
  color: #389e0d;
}

.recognize-state.is-skip {
  color: #faad14;
}

.recognize-warnings {
  margin-top: 10px;
  padding: 8px 12px;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 4px;
}

.recognize-warning-line {
  font-size: 12px;
  color: #ad6800;
  line-height: 20px;
}

@media (max-width: 768px) {
  .recognize-entry-bar {
    flex-wrap: wrap;
  }

  .recognize-entry-copy {
    flex-basis: calc(100% - 56px);
  }

  .recognize-entry-button {
    width: 100%;
  }
}
</style>
