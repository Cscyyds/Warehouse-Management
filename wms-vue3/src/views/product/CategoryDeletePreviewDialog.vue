<template>
  <el-dialog
    title="删除类别预览"
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
            <span class="label">删除类别：</span>
            <el-tag type="danger" size="small">{{ category?.name || '-' }}</el-tag>
            <span v-if="category?.category_code" class="target-code">{{ category.category_code }}</span>
          </div>
          <div class="preview-summary">删除该类别后，其子类别及关联产品将受到影响。</div>
          <div class="preview-stats">
            <div class="stat-item">
              <span class="stat-num" :class="{ 'has-impact': productCount > 0 }">{{ loading ? '-' : productCount }}</span>
              <span class="stat-label">关联产品数</span>
            </div>
            <div class="stat-item">
              <span class="stat-num" :class="{ 'has-impact': childCount > 0 }">{{ loading ? '-' : childCount }}</span>
              <span class="stat-label">子类别数</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 产品迁移 -->
      <div v-if="productCount > 0" class="migrate-section">
        <div class="section-title">
          <el-icon><Switch /></el-icon>
          <span>产品迁移（可选）</span>
          <el-checkbox v-model="migrateChecked">启用迁移</el-checkbox>
        </div>
        <div class="migrate-hint">删除前可将该类别下的产品迁移到其他类别，未勾选则关联产品将一并受影响。</div>

        <div v-if="migrateChecked" class="migrate-row">
          <div class="migrate-row-body">
            <span class="target-label">迁移到：</span>
            <el-tree-select
              v-model="targetCategoryId"
              :data="categoryTreeOptions"
              :props="{ label: 'name', children: 'children', value: 'category_id' }"
              placeholder="请选择目标类别"
              clearable
              filterable
              check-strictly
              style="width:360px"
            />
          </div>
        </div>
      </div>

      <!-- 无产品时提示 -->
      <div v-if="!loading && productCount === 0 && childCount === 0" class="safe-hint">
        <el-icon color="var(--el-color-success)"><CircleCheck /></el-icon>
        <span>该类别无子类别和关联产品，可安全删除。</span>
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
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { WarningFilled, Switch, CircleCheck } from '@element-plus/icons-vue'
import {
  deleteProductCategory,
  migrateProductCategory,
  getProductCategoryTree,
  getProductList,
  type ProductCategoryItem
} from '@/api'

const props = defineProps<{
  modelValue: boolean
  /** 待删除的类别（至少含 category_id / name） */
  category?: ProductCategoryItem | null
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'success': []
}>()

const loading = ref(false)
const submitting = ref(false)
const productCount = ref(0)
const productIds = ref<string[]>([])
const childCount = ref(0)
const categoryTreeOptions = ref<any[]>([])
const migrateChecked = ref(false)
const targetCategoryId = ref<string | null>(null)

async function onOpen() {
  resetState()
  if (!props.category?.category_id) {
    ElMessage.warning('未指定删除的类别')
    handleClose()
    return
  }
  loading.value = true
  const categoryId = props.category.category_id
  await Promise.allSettled([
    loadProductCount(categoryId),
    loadChildCount(categoryId),
    loadCategoryTree(categoryId)
  ])
  loading.value = false
}

function resetState() {
  productCount.value = 0
  productIds.value = []
  childCount.value = 0
  categoryTreeOptions.value = []
  migrateChecked.value = false
  targetCategoryId.value = null
}

/** 统计该类别下的产品数量，并缓存产品 ID 列表 */
async function loadProductCount(categoryId: string) {
  try {
    const res = await getProductList({ category_id: categoryId, page: 1, page_size: 999 })
    const products = res.data.products ?? []
    productCount.value = res.data.total ?? products.length
    productIds.value = products.map((p: any) => p.product_id).filter(Boolean)
  } catch {
    productCount.value = 0
    productIds.value = []
  }
}

/** 统计子类别数量 */
async function loadChildCount(categoryId: string) {
  try {
    const res = await import('@/api').then(m => m.getProductCategoryList())
    const all = res.data.categories || []
    function countChildren(nodes: any[], targetId: string): number {
      let count = 0
      for (const node of nodes) {
        if (node.parent_id === targetId) count++
        if (node.children?.length) count += countChildren(node.children, targetId)
      }
      return count
    }
    childCount.value = countChildren(all, categoryId)
  } catch {
    childCount.value = 0
  }
}

/** 加载类别树（排除当前待删节点及其后代） */
async function loadCategoryTree(excludeId: string) {
  try {
    const fullTree = await getProductCategoryTree()
    function filterOut(nodes: any[]): any[] {
      return nodes
        .filter(n => n.category_id !== excludeId)
        .map(n => ({ ...n, children: n.children ? filterOut(n.children) : undefined }))
    }
    categoryTreeOptions.value = filterOut(fullTree.data as any[])
  } catch {
    categoryTreeOptions.value = []
  }
}

function validate(): boolean {
  if (migrateChecked.value && !targetCategoryId.value) {
    ElMessage.warning('请选择目标类别')
    return false
  }
  if (migrateChecked.value && targetCategoryId.value === props.category?.category_id) {
    ElMessage.warning('迁移目标不能与当前删除的类别相同')
    return false
  }
  if (migrateChecked.value && productIds.value.length === 0) {
    ElMessage.warning('未获取到需要迁移的产品列表，请关闭弹窗后重试')
    return false
  }
  return true
}

async function handleConfirm() {
  if (!props.category?.category_id) return
  if (!validate()) return
  submitting.value = true
  const categoryId = props.category.category_id
  try {
    // 若启用迁移，先执行（接口30）
    if (migrateChecked.value && targetCategoryId.value) {
      await migrateProductCategory({
        source_category_id: categoryId,
        change_message: JSON.stringify([{ new_category: targetCategoryId.value, change_products: productIds.value }])
      })
    }
    // 删除类别
    await deleteProductCategory(categoryId)
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
.preview-summary { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 8px; }
.preview-stats { display: flex; gap: 24px; padding: 8px 0; border-top: 1px dashed var(--el-border-color-lighter); }
.stat-item { display: flex; flex-direction: column; align-items: center; }
.stat-num { font-size: 24px; font-weight: 700; color: var(--el-color-success); }
.stat-num.has-impact { color: var(--el-color-danger); }
.stat-label { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }

.migrate-section { border-top: 1px solid var(--el-border-color-lighter); padding-top: 16px; }
.migrate-hint { font-size: 12px; color: var(--text-tertiary); margin-bottom: 10px; }
.migrate-row { border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 8px 12px; }
.migrate-row-body { display: flex; align-items: center; gap: 8px; }
.target-label { font-size: 13px; color: var(--text-secondary); white-space: nowrap; }

.safe-hint { display: flex; align-items: center; gap: 8px; padding: 16px; background: var(--el-fill-color-light); border-radius: 8px; font-size: 13px; color: var(--el-color-success); margin-top: 12px; }
</style>
