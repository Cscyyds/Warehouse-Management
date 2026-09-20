<template>
  <div class="add-template-page">
    <div class="page-header">
      <div class="page-header-left">
        <el-icon class="back-icon" @click="router.back()"><ArrowLeft /></el-icon>
        <span class="back-label" @click="router.back()">返回</span>
        <span class="header-divider">/</span>
        <h3>子产品绑定</h3>
      </div>
      <div class="header-actions">
        <!-- 一键跳转该组合产品的产品资料详情（编辑态），带 returnTo 便于保存后回到本页 -->
        <el-button
          v-perm="'GET /api/v1/tenant-products/detail'"
          :disabled="!root?.product_id"
          @click="goProductProfile"
        >查看产品资料</el-button>
        <el-button @click="loadAll">刷新</el-button>
        <el-button
          v-perm="'POST /api/v1/tenant-products/components/create'"
          type="primary"
          :loading="saving"
          :disabled="!dirtyRowCount"
          @click="handleSave"
        >保存绑定（{{ dirtyRowCount }}）</el-button>
      </div>
    </div>

    <div class="page-body" v-loading="loading">
      <!-- 产品信息 -->
      <div class="form-section-title"><span class="section-line" />产品信息</div>
      <el-form label-position="top">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="产品编码">
              <el-input :model-value="root?.product_code || '-'" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="产品名称">
              <div class="name-edit-row">
                <el-input
                  v-model="rootName"
                  maxlength="100"
                  placeholder="请输入产品名称"
                  @keyup.enter="handleSaveName"
                />
                <el-button
                  v-perm="'POST /api/v1/tenant-products/update'"
                  type="primary"
                  plain
                  :loading="savingName"
                  :disabled="!nameDirty || !root?.product_id"
                  @click="handleSaveName"
                >保存</el-button>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <el-alert
        v-if="root && root.is_combined !== 1"
        class="combo-alert"
        type="warning"
        :closable="false"
        show-icon
        title="该产品当前不是组合产品"
        description="普通产品无法绑定子产品。请点击右上角「查看产品资料」，把「是否为组合产品」改为「是」后再回到本页。"
      />

      <!-- 直接子产品绑定 -->
      <div class="form-section-title">
        <span class="section-line" />直接子产品绑定
        <span class="section-hint">共 {{ rows.length }} 项</span>
      </div>
      <div class="dynamic-table-wrapper">
        <div v-if="!rows.length" class="dynamic-table-empty">
          <el-empty description="暂无子产品绑定" :image-size="56">
            <el-button v-if="canBind" size="small" @click="openProductPicker">+ 添加子产品</el-button>
          </el-empty>
        </div>
        <template v-else>
          <el-table :data="rows" border size="small" style="width:100%">
            <el-table-column type="index" label="" width="55" align="center" />
            <el-table-column label="子产品编码" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="table-cell-display table-cell-code">{{ row.component_product_code || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="子产品名称" min-width="190" show-overflow-tooltip>
              <template #default="{ row }">
                <span
                  v-if="row.component_is_combined === 1"
                  class="cell-link"
                  @click="goChildDetail(row)"
                >{{ row.component_product_name || '-' }}</span>
                <span v-else class="table-cell-display">{{ row.component_product_name || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="数量" width="110" align="center">
              <template #default="{ row }">
                <el-input
                  v-model="row.num"
                  class="table-cell-input"
                  size="small"
                  placeholder="必填"
                  @input="onNumInput(row)"
                />
              </template>
            </el-table-column>
            <el-table-column label="子产品单价" width="130" align="center">
              <template #default="{ row }">
                <el-input
                  v-model="row.unit_price"
                  class="table-cell-input"
                  size="small"
                  placeholder="必填"
                  @input="markDirty(row)"
                />
              </template>
            </el-table-column>
            <el-table-column label="最低销售金额" width="130" align="right">
              <template #default="{ row }">
                <span class="table-cell-display">{{ formatMoney(row.min_sale_price) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="90" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="row.component_is_combined === 1 ? 'warning' : 'info'">
                  {{ row.component_is_combined === 1 ? '组合' : '普通' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="140">
              <template #default="{ row }">
                <el-input
                  v-model="row.remark"
                  class="table-cell-input"
                  size="small"
                  placeholder="选填"
                  @input="markDirty(row)"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" :width="global_opt_width" align="center">
              <template #default="{ row, $index }">
                <!-- 未落库的新增行仅从本地移除，不需要"删除绑定"权限；
                     已落库行解除绑定属于服务端删除操作，按权限收口 -->
                <el-button
                  v-if="row.__isNew"
                  text
                  type="danger"
                  size="small"
                  :icon="Delete"
                  @click="handleRemove(row, $index)"
                />
                <el-button
                  v-else
                  v-perm="'POST /api/v1/tenant-products/components/delete'"
                  text
                  type="danger"
                  size="small"
                  :icon="Delete"
                  @click="handleRemove(row, $index)"
                />
              </template>
            </el-table-column>
          </el-table>
          <el-button v-if="canBind" class="add-row-btn" size="small" @click="openProductPicker">+ 添加子产品</el-button>
        </template>
      </div>
      <div class="row-hint">
        子产品单价为必填，且不得低于该子产品当前的最低销售金额（后端校验）；数量须为正整数。
        组合产品可作为子产品被绑定（支持多层嵌套，后端含循环引用检测）。
      </div>

      <!-- 完整组合结构（递归只读）：星图 / 表格 双视图 -->
      <div class="form-section-title">
        <span class="section-line" />完整组合结构
        <el-radio-group v-if="treeRows.length" v-model="treeViewMode" size="small" class="tree-view-switch">
          <el-radio-button value="graph">结构星图</el-radio-button>
          <el-radio-button value="table">表格</el-radio-button>
        </el-radio-group>
      </div>
      <div class="dynamic-table-wrapper">
        <div v-if="!treeRows.length" class="dynamic-table-empty">
          <el-empty description="暂无组合结构" :image-size="56" />
        </div>
        <ComboStructureGraph
          v-else-if="treeViewMode === 'graph' && graphRoot"
          :root="graphRoot"
          :nodes="treeRows"
          @navigate="goBindingById"
        />
        <el-table
          v-else
          :data="treeRows"
          row-key="component_id"
          :tree-props="{ children: 'components' }"
          border
          size="small"
          style="width:100%"
          default-expand-all
        >
          <el-table-column prop="component_product_code" label="子产品编码" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="table-cell-display">{{ row.component_product_code || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="component_product_name" label="子产品名称" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="table-cell-display">{{ row.component_product_name || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="层级" width="90" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.__depth === 1 ? 'primary' : 'info'">第 {{ row.__depth }} 层</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="数量" width="100" align="center">
            <template #default="{ row }">
              <span class="table-cell-display">{{ row.num ?? '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="子产品单价" width="130" align="right">
            <template #default="{ row }">
              <span class="table-cell-display">{{ formatMoney(row.unit_price) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="100" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.component_is_combined === 1 ? 'warning' : 'info'">
                {{ row.component_is_combined === 1 ? '组合' : '普通' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <ProductSelectDialog
      v-model="pickerVisible"
      multiple
      :exclude-ids="boundProductIds"
      @confirm-multiple="onProductsPicked"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Delete } from '@element-plus/icons-vue'
import {
  previewComponentTree,
  bindProductComponents,
  updateProductComponents,
  deleteProductComponent,
  getProductDetail,
  updateProduct,
} from '@/api'
import type { ComponentTreeNode, ProductItem } from '@/api'
import ProductSelectDialog from './ProductSelectDialog.vue'
import ComboStructureGraph from './ComboStructureGraph.vue'
import { global_opt_width } from '@/utils/data'

defineOptions({ name: 'ProductCombinedDetail' })

const route = useRoute()
const router = useRouter()

const productId = computed(() => String(route.params.id || ''))

interface RowState {
  component_id?: string
  component_product_id: string
  component_product_code?: string | null
  component_product_name?: string | null
  component_is_combined?: number
  /** 数量：与 AddTemplate 明细表一致用普通输入框，故允许字符串中间态，提交前统一转 Number 校验 */
  num: number | string
  unit_price: string
  remark: string
  /** 子产品当前最低销售金额（前端预校验用；未知为 undefined 时交给后端兜底） */
  min_sale_price?: string | null
  /** 未落库的新增行 */
  __isNew?: boolean
  /** 是否被改动（仅用于提示与保存按钮计数） */
  __dirty?: boolean
}

const loading = ref(false)
const saving = ref(false)
const root = ref<{ product_id: string; product_name: string; product_code: string; is_combined: number } | null>(null)
/** 产品名称编辑态：与 root.product_name 分离，便于判断是否有改动 */
const rootName = ref('')
const savingName = ref(false)
const rows = ref<RowState[]>([])
/** 原始值快照，用于判断已有行是否真的改动（避免原值回传被后端判为"实际变更"） */
const originalMap = new Map<string, { num: number; unit_price: string; remark: string }>()
const treeRows = ref<Array<ComponentTreeNode & { __depth: number }>>([])
const pickerVisible = ref(false)

/** 完整组合结构视图模式：星图 / 表格（localStorage 记忆用户偏好） */
const TREE_VIEW_KEY = 'wms.comboTree.viewMode'
const treeViewMode = ref<'graph' | 'table'>(
  localStorage.getItem(TREE_VIEW_KEY) === 'table' ? 'table' : 'graph'
)
watch(treeViewMode, v => localStorage.setItem(TREE_VIEW_KEY, v))

/** 星图根节点入参（数据未加载完成时为 null，组件不渲染） */
const graphRoot = computed(() => root.value
  ? {
      product_id: root.value.product_id,
      product_name: root.value.product_name,
      product_code: root.value.product_code,
    }
  : null
)

const dirtyRowCount = computed(() => rows.value.filter(r => r.__isNew || r.__dirty).length)
/** 仅组合产品可绑定子产品 */
const canBind = computed(() => root.value?.is_combined === 1)

/** 产品名称是否有改动（去空格后比较，避免仅空白差异误判） */
const nameDirty = computed(() => {
  const current = rootName.value.trim()
  const original = String(root.value?.product_name ?? '').trim()
  return current !== original
})

function formatMoney(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (Number.isNaN(num)) return '-'
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function markDirty(row: RowState) {
  if (row.__isNew) return
  const snapshot = row.component_id ? originalMap.get(row.component_id) : undefined
  if (!snapshot) {
    row.__dirty = true
    return
  }
  row.__dirty =
    Number(row.num) !== snapshot.num ||
    String(row.unit_price ?? '') !== snapshot.unit_price ||
    String(row.remark ?? '') !== snapshot.remark
}

/** 数量输入：只保留数字（明细表用普通输入框，需自行约束） */
function onNumInput(row: RowState) {
  const digits = String(row.num ?? '').replace(/[^\d]/g, '')
  if (String(row.num ?? '') !== digits) row.num = digits
  markDirty(row)
}

/** 递归展开组合树，附加层级用于展示 */
function buildTreeRows(nodes: ComponentTreeNode[], depth = 1): Array<ComponentTreeNode & { __depth: number }> {
  return nodes.map((node) => ({
    ...node,
    __depth: depth,
    components: node.components?.length ? buildTreeRows(node.components, depth + 1) : [],
  }))
}

/** 批量补齐子产品当前最低销售金额（前端预校验 unit_price 下限用），失败不阻塞 */
async function fillMinSalePrices(targetRows: RowState[]) {
  const pending = targetRows.filter(r => r.component_product_id && r.min_sale_price === undefined)
  if (!pending.length) return
  await Promise.all(pending.map(async (row) => {
    try {
      const res = await getProductDetail(row.component_product_id)
      row.min_sale_price = (res.data as any)?.min_sale_price ?? null
    } catch {
      row.min_sale_price = undefined
    }
  }))
}

async function loadAll() {
  if (!productId.value) return
  loading.value = true
  try {
    const res = await previewComponentTree(productId.value)
    const data = res.data
    root.value = {
      product_id: data.product_id,
      product_name: data.product_name,
      product_code: data.product_code,
      is_combined: data.is_combined,
    }
    rootName.value = data.product_name || ''
    const direct = data.components || []
    treeRows.value = buildTreeRows(direct)
    const nextRows: RowState[] = direct.map(node => ({
      component_id: node.component_id,
      component_product_id: node.component_product_id,
      component_product_code: node.component_product_code ?? null,
      component_product_name: node.component_product_name ?? null,
      component_is_combined: node.component_is_combined,
      num: Number(node.num) || 1,
      unit_price: node.unit_price === null || node.unit_price === undefined ? '' : String(node.unit_price),
      remark: node.remark ?? '',
      min_sale_price: undefined,
    }))
    rows.value = nextRows
    originalMap.clear()
    nextRows.forEach((row) => {
      if (row.component_id) {
        originalMap.set(row.component_id, {
          num: Number(row.num),
          unit_price: String(row.unit_price ?? ''),
          remark: String(row.remark ?? ''),
        })
      }
    })
    void fillMinSalePrices(nextRows)
  } catch {
    root.value = null
    rows.value = []
    treeRows.value = []
  } finally {
    loading.value = false
  }
}

/** 已绑定的子产品ID：传给产品选择弹窗，命中的行置灰且不可勾选（避免重复绑定） */
const boundProductIds = computed(() =>
  rows.value.map(r => r.component_product_id).filter((id): id is string => !!id)
)

function openProductPicker() {
  pickerVisible.value = true
}

function onProductsPicked(products: ProductItem[]) {
  if (!products?.length) return
  const existing = new Set(rows.value.map(r => r.component_product_id))
  const added: RowState[] = []
  products.forEach((product) => {
    const pid = String((product as any).product_id || '')
    if (!pid || existing.has(pid)) return
    if (pid === productId.value) {
      ElMessage.warning('不允许将组合产品自身绑定为子产品')
      return
    }
    existing.add(pid)
    added.push({
      component_product_id: pid,
      component_product_code: (product as any).product_code ?? null,
      component_product_name: (product as any).product_name ?? null,
      component_is_combined: Number((product as any).is_combined) === 1 ? 1 : 0,
      num: 1,
      // 预填子产品当前最低销售金额作为单价初值（满足后端 ≥min_sale_price 的下限）
      unit_price: (product as any).min_sale_price != null ? String((product as any).min_sale_price) : '',
      remark: '',
      min_sale_price: (product as any).min_sale_price ?? null,
      __isNew: true,
    })
  })
  if (!added.length) return
  rows.value = [...rows.value, ...added]
  void fillMinSalePrices(added)
}

/** 提交前校验：数量正整数、单价必填且（已知下限时）≥ 子产品最低销售金额 */
function validateRows(target: RowState[]) {
  target.forEach((row, idx) => {
    const label = `第${idx + 1}行${row.component_product_name ? `「${row.component_product_name}」` : ''}`
    const num = Number(row.num)
    if (!Number.isInteger(num) || num <= 0) throw new Error(`${label}：数量必须为正整数`)
    const priceRaw = String(row.unit_price ?? '').trim()
    if (priceRaw === '') throw new Error(`${label}：子产品单价不得为空`)
    const price = Number(priceRaw)
    if (Number.isNaN(price)) throw new Error(`${label}：子产品单价必须为数字`)
    if (price < 0) throw new Error(`${label}：子产品单价不得为负`)
    const minSale = row.min_sale_price === null || row.min_sale_price === undefined || row.min_sale_price === ''
      ? null
      : Number(row.min_sale_price)
    if (minSale !== null && !Number.isNaN(minSale) && price < minSale) {
      throw new Error(`${label}：子产品单价（${price}）不得低于其最低销售金额（${minSale}）`)
    }
  })
}

async function handleSave() {
  const newRows = rows.value.filter(r => r.__isNew)
  const changedRows = rows.value.filter(r => !r.__isNew && r.__dirty)
  if (!newRows.length && !changedRows.length) {
    ElMessage.info('没有需要保存的改动')
    return
  }
  try {
    validateRows([...newRows, ...changedRows])
  } catch (err: any) {
    ElMessage.error(err?.message || '校验未通过')
    return
  }
  saving.value = true
  try {
    if (newRows.length) {
      await bindProductComponents(productId.value, newRows.map(r => ({
        product_id: r.component_product_id,
        num: Number(r.num),
        unit_price: String(r.unit_price).trim(),
        remark: r.remark || undefined,
      })))
    }
    if (changedRows.length) {
      await updateProductComponents(changedRows.map(r => ({
        component_id: String(r.component_id),
        num: Number(r.num),
        unit_price: String(r.unit_price).trim(),
        remark: r.remark ?? '',
      })))
    }
    ElMessage.success('绑定已保存')
    await loadAll()
  } catch {
    // 错误提示由请求层统一处理
  } finally {
    saving.value = false
  }
}

async function handleRemove(row: RowState, index: number) {
  // 未落库的新增行：直接移出本地列表，无需确认
  if (!row.component_id) {
    rows.value.splice(index, 1)
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认解除「${row.component_product_name || '该子产品'}」的绑定？解除后该产品不再属于本组合。`,
      '解除绑定',
      { type: 'warning', confirmButtonText: '确认解除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await deleteProductComponent(row.component_id)
    ElMessage.success('已解除绑定')
    await loadAll()
  } catch {
    // 错误提示由请求层统一处理
  }
}

function goChildDetail(row: RowState) {
  if (!row.component_product_id) return
  router.push({ name: 'ProductCombinedDetail', params: { id: row.component_product_id } })
}

/** 星图中点击「进入该产品」：按产品 ID 跳转其子产品绑定页（与 goChildDetail 同逻辑） */
function goBindingById(targetId: string) {
  if (!targetId || targetId === productId.value) return
  router.push({ name: 'ProductCombinedDetail', params: { id: targetId } })
}

/**
 * 产品名称就地重命名：只提交 product_id + product_name（后端 max_length=100、传入不得为空）。
 * 与「保存绑定」分离——改名属产品资料维护，走 /tenant-products/update，与绑定接口互不影响。
 */
async function handleSaveName() {
  const productId = root.value?.product_id
  if (!productId) return
  if (!nameDirty.value) {
    ElMessage.info('产品名称未改动')
    return
  }
  const nextName = rootName.value.trim()
  if (!nextName) {
    ElMessage.warning('产品名称不能为空')
    return
  }
  if (nextName.length > 100) {
    ElMessage.warning('产品名称不能超过 100 个字符')
    return
  }
  savingName.value = true
  try {
    await updateProduct({ product_id: productId, product_name: nextName })
    // 本地同步，避免为一次改名重拉整棵树
    if (root.value) root.value.product_name = nextName
    rootName.value = nextName
    ElMessage.success('产品名称已更新')
  } catch {
    // 错误提示由请求层统一处理；保持编辑态供用户修改后重试
  } finally {
    savingName.value = false
  }
}

/** 一键跳转该产品的产品资料详情（编辑态），returnTo 回跳本页 */
function goProductProfile() {
  const productId = root.value?.product_id
  if (!productId) return
  router.push({
    path: '/common/add',
    query: { type: 'productInfo', id: productId, mode: 'edit', returnTo: route.fullPath },
  })
}

onMounted(loadAll)
</script>

<style scoped>
/* ── 页面壳：与「新增产品资料」(AddTemplate) 保持一致的版式 ── */
.add-template-page { background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-xs); padding: 0; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 28px; border-bottom: 1px solid var(--border-light); }
.page-header-left { display: flex; align-items: center; gap: 8px; }
.back-icon { cursor: pointer; color: var(--text-secondary); font-size: 18px; transition: color var(--transition-fast); }
.back-icon:hover { color: var(--primary); }
.back-label { cursor: pointer; font-size: var(--font-base); color: var(--text-secondary); transition: color var(--transition-fast); }
.back-label:hover { color: var(--primary); }
.header-divider { color: var(--text-tertiary); font-size: var(--font-base); margin: 0 2px; }
.page-header h3 { font-size: var(--font-h3); font-weight: 700; color: var(--text-primary); }
.header-actions { display: flex; gap: 8px; }
.page-body { padding: 24px 28px; }

.add-template-page :deep(.el-form-item) { margin-bottom: 22px !important; }
.add-template-page :deep(.el-form-item__label) { font-size: var(--font-label); color: var(--text-secondary); }

/* ── 分节标题：左侧渐变竖条（同 AddTemplate） ── */
.form-section-title { display: flex; align-items: center; gap: 8px; font-size: var(--font-h3); font-weight: 600; color: var(--text-primary); margin: 28px 0 16px; padding-left: 4px; }
.form-section-title:first-child { margin-top: 4px; }
.section-line { width: 4px; height: 18px; background: var(--primary-gradient); border-radius: 2px; flex-shrink: 0; }
.section-hint { font-size: 13px; font-weight: 400; color: var(--text-secondary); }

/* ── 明细表：去掉外框、只留行分隔线（同 AddTemplate .dynamic-table-wrapper） ── */
.dynamic-table-wrapper { width: 100%; }
.dynamic-table-wrapper :deep(.el-table) { border: none; }
.dynamic-table-wrapper :deep(.el-table th) { border-bottom: 1px solid var(--border-color); }
.dynamic-table-wrapper :deep(.el-table td) { border-bottom: 1px solid var(--border-light); }

/* 可编辑单元格：透明底 + 仅下边框，聚焦变主色（同 AddTemplate） */
.table-cell-input :deep(.el-input__wrapper) {
  box-shadow: none;
  border: none;
  border-bottom: 1px solid var(--border-color);
  border-radius: 0;
  padding: 1px 4px;
  background: transparent;
}
.table-cell-input :deep(.el-input__wrapper:hover),
.table-cell-input :deep(.el-input__wrapper.is-focus) {
  border-bottom-color: var(--primary);
}
/* 只读文本单元格：display:inline-block 会自成一个盒子，使 .cell 的
   text-overflow:ellipsis 失效 —— 长文本按 max-content 撑宽后溢出列边界，
   顶到右侧「数量」输入框上（同 index.scss 里 .cell-link 的成因）。
   故此处必须自带裁剪 + 省略；box-sizing 让 max-width:100% 把左右 padding
   也计入，否则仍会比列宽多出 8px。 */
.table-cell-display {
  display: inline-block;
  box-sizing: border-box;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 1px 4px;
  color: var(--text-secondary, #606266);
  font-size: 12px;
}
/* 子产品编码：加粗突出（须置于 .table-cell-display 之后，同优先级靠顺序覆盖 color） */
.table-cell-code { color: var(--text-primary); font-weight: 600; }

.dynamic-table-empty { border: 1px dashed var(--border-color); border-radius: 6px; padding: 16px 0; }
.add-row-btn { margin-top: 8px; }

.combo-alert { margin-top: 4px; margin-bottom: 4px; }
/* 产品名称就地编辑：输入框 + 保存按钮同行，按钮不参与拉伸 */
.name-edit-row { display: flex; gap: 8px; align-items: center; width: 100%; }
.name-edit-row :deep(.el-input) { flex: 1; }
.name-edit-row .el-button { flex-shrink: 0; }
.row-hint { margin-top: 10px; font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
.cell-link { color: var(--primary); cursor: pointer; }
.cell-link:hover { text-decoration: underline; }
/* 完整组合结构：星图/表格切换按钮右对齐 */
.tree-view-switch { margin-left: auto; }
</style>
