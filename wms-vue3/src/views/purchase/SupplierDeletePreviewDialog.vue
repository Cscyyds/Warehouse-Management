<template>
  <el-dialog
    title="删除供应商预览"
    :model-value="modelValue"
    width="640px"
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
          <div class="preview-target">
            <span class="label">删除供应商：</span>
            <el-tag type="danger" size="small">{{ supplier?.supplier_name || '-' }}</el-tag>
            <span v-if="supplier?.supplier_code" class="target-code">{{ supplier.supplier_code }}</span>
          </div>
          <div class="preview-stats">
            <div class="stat-item">
              <span class="stat-num" :class="{ 'has-impact': productCount > 0 }">{{ loading ? '-' : productCount }}</span>
              <span class="stat-label">关联产品数</span>
            </div>
          </div>
          <div v-if="productCount > 0 && !loading" class="cascade-hint">
            该供应商作为主供应商被 {{ productCount }} 个产品引用。
          </div>
        </div>
      </div>

      <!-- 产品迁移 -->
      <div v-if="productCount > 0" class="migrate-section">
        <div class="section-title">
          <el-icon><Switch /></el-icon>
          <span>主供应商迁移（可选）</span>
          <el-checkbox v-model="migrateChecked">启用迁移</el-checkbox>
        </div>
        <div class="migrate-hint">删除前可将该供应商作为主供应商的产品迁移到其他供应商，未勾选则关联产品将受影响。</div>

        <div v-if="migrateChecked" class="migrate-row">
          <div class="migrate-row-body">
            <span class="target-label">迁移到：</span>
            <el-select
              v-model="targetSupplierId"
              placeholder="请选择目标供应商"
              clearable
              filterable
              style="width:360px"
            >
              <el-option
                v-for="opt in supplierOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
        </div>
      </div>

      <!-- 无关联时提示 -->
      <div v-if="!loading && productCount === 0" class="safe-hint">
        <el-icon color="var(--el-color-success)"><CircleCheck /></el-icon>
        <span>该供应商无关联产品，可安全删除。</span>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="danger" :loading="submitting" @click="handleConfirm">
        {{ migrateChecked ? '迁移并删除' : '确认删除' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { WarningFilled, Switch, CircleCheck } from '@element-plus/icons-vue'
import {
  deleteSupplier,
  migrateProductSupplier,
  getSupplierList,
  queryProductSuppliers,
  type SupplierItem
} from '@/api'

const props = defineProps<{
  modelValue: boolean
  /** 待删除的供应商（至少含 supplier_id / supplier_name） */
  supplier?: SupplierItem | null
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'success': []
}>()

const loading = ref(false)
const submitting = ref(false)
const productCount = ref(0)
const productIds = ref<string[]>([])
const supplierOptions = ref<{ label: string; value: string }[]>([])
const migrateChecked = ref(false)
const targetSupplierId = ref<string | null>(null)

async function onOpen() {
  resetState()
  if (!props.supplier?.supplier_id) {
    ElMessage.warning('未指定删除的供应商')
    handleClose()
    return
  }
  loading.value = true
  const supplierId = props.supplier.supplier_id
  await Promise.allSettled([
    loadProductCount(supplierId),
    loadSupplierOptions(supplierId)
  ])
  loading.value = false
}

function resetState() {
  productCount.value = 0
  productIds.value = []
  supplierOptions.value = []
  migrateChecked.value = false
  targetSupplierId.value = null
}

/** 统计该供应商作为主供应商的产品数量，并缓存产品 ID 列表 */
async function loadProductCount(supplierId: string) {
  try {
    const res = await queryProductSuppliers(supplierId)
    const products = res.data.products ?? []
    productCount.value = products.length
    productIds.value = products.map((p: any) => p.product_id).filter(Boolean)
  } catch {
    productCount.value = 0
    productIds.value = []
  }
}

/** 加载供应商选项列表（排除当前待删供应商） */
async function loadSupplierOptions(excludeId: string) {
  try {
    const res = await getSupplierList({ page: 1, page_size: 999 })
    const all = res.data.supplier || []
    supplierOptions.value = all
      .filter((s: SupplierItem) => s.supplier_id !== excludeId)
      .map((s: SupplierItem) => ({ label: s.supplier_name, value: s.supplier_id }))
  } catch {
    supplierOptions.value = []
  }
}

function validate(): boolean {
  if (migrateChecked.value && !targetSupplierId.value) {
    ElMessage.warning('请选择目标供应商')
    return false
  }
  if (migrateChecked.value && targetSupplierId.value === props.supplier?.supplier_id) {
    ElMessage.warning('迁移目标不能与当前删除的供应商相同')
    return false
  }
  if (migrateChecked.value && productIds.value.length === 0) {
    ElMessage.warning('未获取到需要迁移的产品列表，请关闭弹窗后重试')
    return false
  }
  return true
}

async function handleConfirm() {
  if (!props.supplier?.supplier_id) return
  if (!validate()) return
  submitting.value = true
  const supplierId = props.supplier.supplier_id
  try {
    // 若启用迁移，先执行（接口31）
    if (migrateChecked.value && targetSupplierId.value) {
      await migrateProductSupplier({
        source_supplier_id: supplierId,
        change_message: JSON.stringify([{ new_supplier: targetSupplierId.value, change_products: productIds.value }])
      })
    }
    // 删除供应商
    await deleteSupplier(supplierId)
    ElMessage.success('删除成功')
    emit('success')
    handleClose()
  } catch {
    // 请求拦截器已统一提示错误
  } finally {
    submitting.value = false
  }
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
.section-title .el-checkbox { margin-left: auto; font-weight: 400; }
.preview-section { margin-bottom: 20px; }
.preview-card { background: var(--el-fill-color-light); border-radius: 8px; padding: 12px 14px; }
.preview-target { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.preview-target .label { font-size: 13px; color: var(--text-secondary); }
.preview-target .target-code { font-size: 12px; color: var(--text-tertiary); }
.preview-stats { display: flex; gap: 24px; padding: 8px 0; border-top: 1px dashed var(--el-border-color-lighter); }
.stat-item { display: flex; flex-direction: column; align-items: center; }
.stat-num { font-size: 24px; font-weight: 700; color: var(--el-color-success); }
.stat-num.has-impact { color: var(--el-color-danger); }
.stat-label { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
.cascade-hint { font-size: 13px; color: var(--text-secondary); margin-top: 8px; }

.migrate-section { border-top: 1px solid var(--el-border-color-lighter); padding-top: 16px; }
.migrate-hint { font-size: 12px; color: var(--text-tertiary); margin-bottom: 10px; }
.migrate-row { border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 8px 12px; }
.migrate-row-body { display: flex; align-items: center; gap: 8px; }
.target-label { font-size: 13px; color: var(--text-secondary); white-space: nowrap; }

.safe-hint { display: flex; align-items: center; gap: 8px; padding: 16px; background: var(--el-fill-color-light); border-radius: 8px; font-size: 13px; color: var(--el-color-success); margin-top: 12px; }
</style>
