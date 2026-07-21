<template>
  <el-dialog
    title="删除产品预览"
    :model-value="modelValue"
    width="720px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
    @closed="onClosed"
  >
    <div v-loading="loading" class="delete-preview-body">
      <!-- 删除影响预览 -->
      <div class="preview-section">
        <div class="section-title">
          <el-icon><WarningFilled /></el-icon>
          <span>删除影响预览</span>
        </div>
        <div class="preview-card">
          <div class="preview-product">
            <span class="label">删除产品：</span>
            <el-tag type="danger" size="small">{{ product?.product_name || '-' }}</el-tag>
            <span v-if="product?.product_code" class="product-code">{{ product.product_code }}</span>
          </div>
          <div v-if="preview?.summary" class="preview-summary">{{ preview.summary }}</div>
          <div class="preview-stats">
            <div class="stat-item">
              <span class="stat-num" :class="{ 'has-impact': preview?.cascade_count }">{{ preview?.cascade_count ?? '-' }}</span>
              <span class="stat-label">关联数据项</span>
            </div>
          </div>
          <div v-if="cascadeItems.length" class="cascade-list">
            <div class="cascade-list-title">受影响的关联数据：</div>
            <div v-for="item in cascadeItems" :key="item.id" class="cascade-item">
              <el-tag size="small" :type="cascadeTagType(item.type)">{{ item.type || '项' }}</el-tag>
              <span class="cascade-name">{{ item.name }}</span>
            </div>
          </div>
          <div v-else-if="!loading" class="cascade-empty">暂无关联数据，可安全删除。</div>
        </div>
      </div>

      <!-- 数据迁移勾选（仅辅助计量单位） -->
      <div v-if="!assistItem.disabled" class="migrate-section">
        <div class="section-title">
          <el-icon><Switch /></el-icon>
          <span>产品数据迁移（可选）</span>
        </div>
        <div class="migrate-hint">删除前可将该产品的辅助计量单位迁移到其他单位，未勾选将随产品一并软删除。</div>

        <div class="migrate-list">
          <div class="migrate-row" :class="{ disabled: assistItem.disabled }">
            <div class="migrate-row-head">
              <el-checkbox v-model="assistItem.checked" :disabled="assistItem.disabled">
                <span class="migrate-name">{{ assistItem.label }}</span>
              </el-checkbox>
              <span class="migrate-source">
                当前：<el-tag size="small" type="info">{{ assistItem.sourceName || '未设置' }}</el-tag>
              </span>
            </div>
            <div v-if="assistItem.checked && !assistItem.disabled" class="migrate-row-body">
              <span class="target-label">迁移到：</span>
              <el-select
                v-model="assistItem.targetId"
                :placeholder="assistItem.sourceName ? '请选择目标单位' : '请选择'"
                clearable
                filterable
                style="width:280px"
              >
                <el-option
                  v-for="opt in unitOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="danger" :loading="submitting" @click="handleConfirm">
        {{ checkedCount > 0 ? `迁移并删除` : '确认删除' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { WarningFilled, Switch } from '@element-plus/icons-vue'
import {
  previewDeleteProduct, getProductDetail,
  migrateProductAssistUnit,
  deleteProduct,
  getProductUnitList,
  type ProductDeletePreviewData, type ProductItem
} from '@/api'

const props = defineProps<{
  modelValue: boolean
  /** 待删除的产品（列表行，至少含 product_id / product_name） */
  product?: { product_id: string; product_name?: string; product_code?: string } | null
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'success': []
}>()

const loading = ref(false)
const submitting = ref(false)
const preview = ref<ProductDeletePreviewData | null>(null)
const productDetail = ref<ProductItem | null>(null)

/** 目标选择器数据源 */
const unitOptions = ref<{ label: string; value: string }[]>([])

/** 辅助计量单位迁移项（仅此一项） */
interface AssistMigrateItem {
  key: 'assistUnit'
  label: string
  checked: boolean
  disabled: boolean
  sourceId: string | null
  sourceName: string
  targetId: string | null
}
const assistItem = reactive<AssistMigrateItem>({
  key: 'assistUnit', label: '辅助计量单位', checked: false, disabled: true, sourceId: null, sourceName: '', targetId: null
})

const cascadeItems = computed(() => preview.value?.cascade_items ?? [])
const checkedCount = computed(() => (assistItem.checked && !assistItem.disabled) ? 1 : 0)

function cascadeTagType(type?: string) {
  if (!type) return 'info'
  if (type.includes('订单') || type.includes('单据')) return 'danger'
  if (type.includes('库存')) return 'warning'
  return 'info'
}

async function onOpen() {
  resetState()
  if (!props.product?.product_id) {
    ElMessage.warning('未指定删除的产品')
    handleClose()
    return
  }
  loading.value = true
  const productId = props.product.product_id
  await Promise.allSettled([
    loadPreview(productId),
    loadProductDetail(productId),
    loadUnitOptions()
  ])
  loading.value = false
  fillSourceFromDetail()
}

function resetState() {
  preview.value = null
  productDetail.value = null
  assistItem.checked = false
  assistItem.disabled = true
  assistItem.sourceId = null
  assistItem.sourceName = ''
  assistItem.targetId = null
}

async function loadPreview(productId: string) {
  try {
    const res = await previewDeleteProduct(productId)
    preview.value = res.data
  } catch {
    preview.value = null
  }
}

async function loadProductDetail(productId: string) {
  try {
    const res = await getProductDetail(productId)
    productDetail.value = res.data
  } catch {
    productDetail.value = null
  }
}

async function loadUnitOptions() {
  try {
    const res = await getProductUnitList()
    unitOptions.value = (res.data.unit || []).map(u => ({ label: u.unit_name, value: u.unit_id }))
  } catch {
    unitOptions.value = []
  }
}

function fillSourceFromDetail() {
  const d = productDetail.value
  if (!d) return
  assistItem.sourceId = d.assist_unit_id || null
  assistItem.sourceName = d.assist_unit_name || '未设置'
  assistItem.disabled = !d.assist_unit_id
}

/** 校验：已勾选项目标必填、且不等于源 */
function validate(): boolean {
  if (assistItem.checked && !assistItem.disabled) {
    if (!assistItem.targetId) {
      ElMessage.warning(`请为「${assistItem.label}」选择迁移目标`)
      return false
    }
    if (assistItem.sourceId && assistItem.targetId === assistItem.sourceId) {
      ElMessage.warning(`「${assistItem.label}」的迁移目标不能与当前值相同`)
      return false
    }
  }
  return true
}

async function handleConfirm() {
  if (!props.product?.product_id) return
  if (!validate()) return
  submitting.value = true
  const productId = props.product.product_id
  try {
    // 若勾选了辅助单位迁移，先执行（接口33）
    if (assistItem.checked && !assistItem.disabled) {
      await migrateProductAssistUnit({ source_assist_unit_id: assistItem.sourceId!, change_message: buildChangeMessage('new_assist_unit', assistItem.targetId!, productId) })
    }
    // 迁移成功后软删除产品（接口28）
    await deleteProduct(productId)
    ElMessage.success('删除成功')
    emit('success')
    handleClose()
  } catch {
    // 请求拦截器已统一提示错误，此处仅中止链路、保留弹窗
  } finally {
    submitting.value = false
  }
}

/** 构造各迁移接口的 change_message（后端实际契约，见 product.ts 注释） */
function buildChangeMessage(newKey: string, newId: string, productId: string): string {
  return JSON.stringify([{ [newKey]: newId, change_products: [productId] }])
}

function handleClose() {
  emit('update:modelValue', false)
}

function onClosed() {
  resetState()
}
</script>

<style scoped>
.delete-preview-body { padding: 0 4px; }
.section-title { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 10px; }
.section-title .el-icon { color: var(--primary); }
.preview-section { margin-bottom: 20px; }
.preview-card { background: var(--el-fill-color-light); border-radius: 8px; padding: 12px 14px; }
.preview-product { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.preview-product .label { font-size: 13px; color: var(--text-secondary); }
.preview-product .product-code { font-size: 12px; color: var(--text-tertiary); }
.preview-summary { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 8px; }
.preview-stats { display: flex; gap: 24px; padding: 8px 0; border-top: 1px dashed var(--el-border-color-lighter); }
.stat-item { display: flex; flex-direction: column; align-items: center; }
.stat-num { font-size: 24px; font-weight: 700; color: var(--el-color-success); }
.stat-num.has-impact { color: var(--el-color-danger); }
.stat-label { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
.cascade-list { margin-top: 8px; }
.cascade-list-title { font-size: 12px; color: var(--text-tertiary); margin-bottom: 6px; }
.cascade-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 13px; }
.cascade-name { color: var(--text-secondary); }
.cascade-empty { font-size: 13px; color: var(--el-color-success); margin-top: 8px; }

.migrate-section { border-top: 1px solid var(--el-border-color-lighter); padding-top: 16px; }
.migrate-hint { font-size: 12px; color: var(--text-tertiary); margin-bottom: 10px; }
.migrate-list { display: flex; flex-direction: column; gap: 8px; }
.migrate-row { border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 8px 12px; }
.migrate-row.disabled { background: var(--el-fill-color-lighter); opacity: 0.6; }
.migrate-row-head { display: flex; align-items: center; gap: 12px; }
.migrate-name { font-size: 13px; }
.migrate-source { margin-left: auto; font-size: 12px; color: var(--text-tertiary); }
.migrate-row-body { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding-left: 24px; }
.target-label { font-size: 13px; color: var(--text-secondary); white-space: nowrap; }
</style>
