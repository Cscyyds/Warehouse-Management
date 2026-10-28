<template>
  <ListTemplate
    ref="listTemplateRef"
    title="产品资料"
    layout-key="product-info"
    show-tree
    tree-title="产品类别"
    tree-perm-endpoint="GET /api/v1/tenant-product-categories/list"
    :tree-data="categoryTree"
    tree-node-key="category_id"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @tree-node-click="handleCategoryClick"
    @tree-refresh="fetchCategoryTree"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="产品名称"><el-input v-model="searchForm.product_name" placeholder="请输入" clearable style="width:160px" /></el-form-item>
        <el-form-item label="产品编码"><el-input v-model="searchForm.product_code" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="货号"><el-input v-model="searchForm.item_no" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item label="供应商"><el-input v-model="searchForm.supplier_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.product_status" placeholder="请选择" clearable style="width:110px">
            <el-option label="在售" value="ON_SALE" />
            <el-option label="停售" value="OFF_SALE" />
            <el-option label="停产" value="DISCONTINUED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button v-perm="'POST /api/v1/tenant-products/create'" type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
      <el-button v-perm="'POST /api/v1/tenant-products/import'" @click="openImport('upload')"><el-icon><Upload /></el-icon>批量导入</el-button>
      <el-dropdown v-if="canBatchTools" trigger="click" @command="openRecord">
        <el-button>导入记录 ▾</el-button><template #dropdown><el-dropdown-menu>
          <el-dropdown-item command="product" :disabled="!permission.hasUrlPerm('GET /api/v1/import-tasks/product/list')">产品创建记录</el-dropdown-item>
          <el-dropdown-item command="product-update" :disabled="!batchAllowed || !permission.hasUrlPerm('GET /api/v1/import-tasks/product-update/list')">资料更新记录</el-dropdown-item>
          <el-dropdown-item command="product-supplier" :disabled="!batchAllowed || !permission.hasUrlPerm('GET /api/v1/import-tasks/product-supplier/list')">供应商维护记录</el-dropdown-item>
          <el-dropdown-item command="product-sale-price" :disabled="!batchAllowed || !permission.hasUrlPerm('GET /api/v1/import-tasks/product-sale-price/list')">客户定价记录</el-dropdown-item>
        </el-dropdown-menu></template>
      </el-dropdown>
      <el-button v-else v-perm="'GET /api/v1/import-tasks/product/list'" @click="openImport('records')">导入记录</el-button>
      <el-button :disabled="!selectedProducts.length" @click="productPrintOpen = true"><el-icon><Printer /></el-icon>产品打印</el-button>
      <el-tooltip v-if="canBatchTools" :disabled="batchAllowed" :content="batchReason" placement="top"><span><el-dropdown :disabled="!batchAllowed" trigger="click" @command="(kind: MaintenanceKind) => openMaintenance(kind, 'upload')"><el-button :disabled="!batchAllowed">批量维护 ▾</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="product-update">产品资料批量更新</el-dropdown-item><el-dropdown-item command="product-supplier">产品供应商批量维护</el-dropdown-item><el-dropdown-item command="product-sale-price">客户定价批量维护</el-dropdown-item></el-dropdown-menu></template></el-dropdown></span></el-tooltip>
      <el-tooltip v-if="canBatchTools" :disabled="batchAllowed" :content="batchReason" placement="top"><span><el-dropdown :disabled="!batchAllowed || exporting" trigger="click" @command="handleExport"><el-button :loading="exporting" :disabled="!batchAllowed">{{ exporting ? '正在生成文件…' : '导出 ▾' }}</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="selected-data" :disabled="!selectedProducts.length">导出选中资料</el-dropdown-item><el-dropdown-item command="all-data">导出全部资料</el-dropdown-item><el-dropdown-item command="selected-positions" :disabled="!selectedProducts.length">导出选中位置</el-dropdown-item><el-dropdown-item command="all-positions">导出全部位置</el-dropdown-item></el-dropdown-menu></template></el-dropdown></span></el-tooltip>
    </template>
    <template #table>
      <el-alert v-if="productFields.hiddenPaths.value.length" title="部分信息受角色权限限制，已隐藏" type="info" :closable="false" show-icon />
      <el-alert v-if="canBatchTools && batchToolsEnabled && !batchAllowed" :title="batchReason" type="warning" :closable="false"><el-button link type="primary" :loading="accessChecking" @click="checkBatchAccess()">重新核对权限</el-button></el-alert>
      <p class="selection-caption">已选择本页 {{ selectedProducts.length }} 项；勾选用于导出，批量上传按文件内容处理。</p>
      <el-table ref="productTableRef" border :data="initialLoading ? skeletonRows : tableData" :class="{ 'table-skeleton': initialLoading }" stripe size="small" style="width:100%" row-class-name="table-row" v-loading="loading && !initialLoading" @sort-change="handleSortChange" @selection-change="onProductSelectionChange">
        <el-table-column type="selection" width="40" fixed="left" />
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" fixed="left" />
        <el-table-column prop="product_code" label="产品编码" min-width="180" show-overflow-tooltip fixed="left" sortable="custom" />
        <el-table-column prop="product_name" label="产品名称" :width="220" show-overflow-tooltip fixed="left" sortable="custom">
          <template #default="{ row }">
            <span v-perm="'GET /api/v1/tenant-products/detail'" class="cell-link" :class="{ 'is-empty': !row.product_name }" @click="handleEdit(row)">{{ row.product_name || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="item_no" label="货号" min-width="140" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.item_no }">{{ row.item_no || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="product_type_name" column-key="product_type" label="产品类型" min-width="110" align="center" show-overflow-tooltip sortable="custom">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.product_type_name || row.product_type || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category_name" label="产品类别" min-width="110" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="specification" label="产品规格" min-width="110" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.specification }">{{ row.specification || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="color" label="颜色" min-width="80" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.color }">{{ row.color || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="unit_name" label="计量单位" min-width="80" show-overflow-tooltip align="center" sortable="custom" />
        <el-table-column v-if="productFields.canView('products[].factory_price')" prop="factory_price" label="出厂价" width="100" align="right" sortable="custom">
          <template #default="{ row }">{{ row.factory_price ?? '—' }}</template>
        </el-table-column>
        <el-table-column v-if="productFields.canView('products[].min_sale_price')" prop="min_sale_price" label="最低售价" width="100" align="right" sortable="custom">
          <template #default="{ row }">{{ row.min_sale_price ?? '—' }}</template>
        </el-table-column>
        <el-table-column v-if="productFields.canView('products[].available_stock')" prop="available_stock" label="可用库存" width="110" align="right">
          <template #default="{ row }">{{ formatAmount(row.available_stock) }}</template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="170" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column prop="product_status_name" column-key="product_status" label="状态" min-width="110" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.product_status === 'ON_SALE' ? 'success' : 'info'" size="small">{{ row.product_status_name || row.product_status || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sale_mode_name" column-key="sale_mode" label="经营模式" min-width="110" align="center" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.sale_mode_name || row.sale_mode || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button v-perm="'POST /api/v1/tenant-products/update'" link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button v-perm="'POST /api/v1/tenant-products/delete'" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
  <ProductDeletePreviewDialog
    v-model="deleteDialogVisible"
    :product="deleteTarget"
    @success="handleDeleteSuccess"
  />
  <BatchImportDialog
    v-model="importDialogVisible"
    title="批量导入产品"
    task-type="product"
    :initial-tab="importInitialTab"
    :template-url="productTemplateUrl"
    template-name="产品导入模板.xlsx"
    template-note="请使用已确认的正式模板；客户类型名称与客户类型销售价按分号逐项对应，两列同空保持原有行为。最低销售金额须不低于预设出厂价。"
    :import-fn="importProducts"
    @success="handleImportSuccess"
  />
  <PrintLabelDialog v-model="productPrintOpen" kind="product" :rows="productPrintRows" />
  <BatchImportDialog v-model="updateDialogVisible" title="产品资料批量更新" task-type="product-update" :initial-tab="maintenanceTab" :template-url="IMPORT_TEMPLATES['product-update']" template-name="产品资料批量更新模板.xlsx" accept=".xlsx" :upload-allowed="batchAllowed" :check-access="checkBatchAccess" submit-label="提交更新" rules="仅更新已有产品，按产品编码定位，最多5000行；产品名称(核对)须填原名称。空白不修改原值，不支持清空。若需改名，名称核对填旧名，产品名称填新名。任一行错误整批不写入。仅填写编码而无更新内容也会失败。文件不受当前勾选范围限制；有关联变更的产品应放在同一批。" :import-fn="importProductUpdates" @success="handleImportSuccess" />
  <ProductRelationImportDialog v-model="relationDialogVisible" :kind="relationKind" :initial-tab="maintenanceTab" :allowed="batchAllowed" :check-access="checkBatchAccess" @success="handleImportSuccess" />
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Printer, Upload } from '@element-plus/icons-vue'
import PrintLabelDialog from '@/components/PrintLabelDialog.vue'
import { z } from 'zod'
import { useRouter } from 'vue-router'
import { getProductList, searchProduct, getProductCategoryTree, importProducts, type ProductItem, type ProductCategoryItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSkeleton } from '@/composables/useTableSkeleton'
import BatchImportDialog from '@/views/common/BatchImportDialog.vue'
import { useTableSort } from '@/composables/useTableSort'
import ProductDeletePreviewDialog from './ProductDeletePreviewDialog.vue'
import ProductRelationImportDialog from './ProductRelationImportDialog.vue'
import { importProductUpdates } from '@/api/modules/batchImport'
import { exportProductData, type ProductRelationKind } from '@/api/modules/productBatch'
import { usePermissionStore } from '@/stores/permission'
import { useSensitiveFieldStore } from '@/stores/sensitiveField'
import { useSensitiveFields } from '@/composables/useSensitiveFields'
import { downloadXlsx } from '@/utils/download'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'
import { IMPORT_TEMPLATES } from '@/config/importTemplates'
import { useAgentPage } from '@/composables/useAgentPage'
import type { WmsAgentActionDefinition } from '@/agent/types'

defineOptions({ name: 'ProductInfo' })

/* —— 产品条码打印 —— */
const selectedProducts = ref<ProductItem[]>([])
const productPrintOpen = ref(false)
const productPrintRows = computed(() => selectedProducts.value.map((item) => ({
  id: item.product_id,
  title: item.product_name,
  subtitle: item.product_code,
})))

function onProductSelectionChange(rows: ProductItem[]) {
  selectedProducts.value = rows
}

const router = useRouter()
const listTemplateRef = ref<any>()
const tableData = ref<ProductItem[]>([])
const loading = ref(false)
/** 首屏骨架：仅首次加载出骨架，翻页/切回标签页仍用遮罩 */
const { initialLoading, skeletonRows } = useTableSkeleton(loading)
const categoryTree = ref<any[]>([])
const searchForm = reactive({ product_name: '', product_code: '', item_no: '', supplier_name: '', product_status: '', category_id: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
let loadRequestSequence = 0
let inFlightLoad: { key: string; promise: Promise<number> } | undefined
let categoryTreeRequest: Promise<void> | undefined
const productTableRef = ref<any>()
const { sortBy, sortOrder, handleSortChange, clearRestrictedSort } = useTableSort(loadData, prop => !['factory_price', 'min_sale_price', 'available_stock'].includes(prop) || (productFields.confirmed.value && productFields.canView(`products[].${prop}`)))
const permission = usePermissionStore(), sensitiveStore = useSensitiveFieldStore()
const pageSession = localStorage.getItem('token')
const productListInterface = computed(() => searchForm.product_name.trim() || searchForm.product_code.trim() || searchForm.item_no.trim() || searchForm.supplier_name.trim() || searchForm.product_status || !searchForm.category_id ? '/tenant-products/search' : '/tenant-products/list')
const productFields = useSensitiveFields({ interfacePath: () => productListInterface.value })
type MaintenanceKind = 'product-update' | ProductRelationKind
const batchToolsEnabled = import.meta.env.VITE_PRODUCT_BATCH_TOOLS_ENABLED === 'true'
const canBatchTools = computed(() => permission.hasUrlPerm('POST /api/v1/tenant-products/update/import'))
const accessAllowed = ref(false), accessChecking = ref(false), accessMessage = ref('正在核对字段权限')
const batchAllowed = computed(() => batchToolsEnabled && accessAllowed.value)
const batchReason = computed(() => batchToolsEnabled ? accessMessage.value : '批量维护与导出暂未开放，请联系管理员')
let accessRequest: Promise<boolean> | undefined
function checkBatchAccess(showMessage = true): Promise<boolean> {
  if (!batchToolsEnabled || !canBatchTools.value) { if (showMessage) ElMessage.warning(batchReason.value); return Promise.resolve(false) }
  if (accessRequest) return accessRequest
  accessChecking.value = true
  const accessRevision = sensitiveStore.revision
  accessRequest = (async () => {
    const states = await Promise.all(['/tenant-products/detail', '/tenant-products/stock-warning/query', '/tenant-products/components/preview'].map(path => sensitiveStore.load(path, true)))
    const ready = states.every(state => state.status === 'ready') && pageSession === localStorage.getItem('token') && accessRevision === sensitiveStore.revision
    accessAllowed.value = ready && states.every(state => !state.fields.length)
    accessMessage.value = ready ? accessAllowed.value ? '' : '当前角色存在产品字段限制，暂不能批量维护或导出完整资料' : '字段权限状态未确认，暂不能批量维护或导出'
    if (!accessAllowed.value && showMessage) ElMessage.warning(accessMessage.value)
    return accessAllowed.value
  })().finally(() => { accessChecking.value = false; accessRequest = undefined })
  return accessRequest
}
watch(() => sensitiveStore.revision, () => { accessAllowed.value = false; void checkBatchAccess(false) })
const updateDialogVisible = ref(false), relationDialogVisible = ref(false), maintenanceTab = ref<'upload' | 'records'>('upload'), relationKind = ref<ProductRelationKind>('product-supplier'), exporting = ref(false)
async function openMaintenance(kind: MaintenanceKind, tab: 'upload' | 'records') {
  if (!await checkBatchAccess()) return
  maintenanceTab.value = tab
  if (kind === 'product-update') updateDialogVisible.value = true
  else { relationKind.value = kind; relationDialogVisible.value = true }
}
function openRecord(kind: 'product' | MaintenanceKind) { if (kind === 'product') openImport('records'); else void openMaintenance(kind, 'records') }
async function handleExport(command: string) {
  if (exporting.value) return
  const all = command.startsWith('all-'), positions = command.endsWith('-positions')
  const ids = all ? undefined : selectedProducts.value.map(product => product.product_id)
  if (!all && !ids?.length) { ElMessage.warning('请先勾选需要导出的产品'); return }
  exporting.value = true
  try {
    if (!await checkBatchAccess()) return
    if (all) await ElMessageBox.confirm('将导出本租户全部产品，不仅是当前筛选结果。位置导出中，没有位置记录的产品不会产生数据行。', '确认全量导出', { type: 'warning', confirmButtonText: '导出全部', cancelButtonText: '取消' })
    await downloadXlsx({ request: () => exportProductData(ids, positions), fileName: positions ? '产品位置导出.xlsx' : '产品资料导出.xlsx' })
  } catch { /* 取消不提交；下载模块已提示实际错误。 */ }
  finally { exporting.value = false }
}

// 删除预览弹窗
const deleteDialogVisible = ref(false)
const deleteTarget = ref<ProductItem | null>(null)

function flattenTree(nodes: ProductCategoryItem[]): any[] {
  const result: any[] = []
  nodes.forEach(n => {
    result.push({ category_id: n.category_id, name: n.name, children: n.children ? flattenTree(n.children) : undefined })
  })
  return result
}

function findFirstQueryableCategoryId(nodes: any[]): string {
  for (const node of nodes) {
    if (node.children?.length) {
      const childId = findFirstQueryableCategoryId(node.children)
      if (childId) return childId
    }
    if (node.category_id) return node.category_id
  }
  return ''
}

function fetchCategoryTree(): Promise<void> {
  if (categoryTreeRequest) return categoryTreeRequest
  const request = performFetchCategoryTree()
  categoryTreeRequest = request
  request.then(
    () => { if (categoryTreeRequest === request) categoryTreeRequest = undefined },
    () => { if (categoryTreeRequest === request) categoryTreeRequest = undefined },
  )
  return request
}

async function performFetchCategoryTree(): Promise<void> {
  try {
    // silent：无产品类别权限的账号此请求必 403，属预期边界；左树置空降级即可，
    // 不弹「权限不足」打扰（右侧列表会降级为全量查询，见 performLoadData）
    const res = await getProductCategoryTree({ silent: true })
    categoryTree.value = flattenTree(res.data)
    sessionStorage.setItem('treeCache:productCategory', JSON.stringify(res.data))
    if (!searchForm.category_id && categoryTree.value.length > 0) {
      searchForm.category_id = findFirstQueryableCategoryId(categoryTree.value)
    }
    await nextTick()
    if (searchForm.category_id) {
      listTemplateRef.value?.setTreeCurrentKey(searchForm.category_id)
    }
  } catch {
    categoryTree.value = []
  }
}

function getLoadKey(): string {
  return JSON.stringify({
    ...searchForm,
    page: pagination.page,
    pageSize: pagination.pageSize,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  })
}

function loadData(signal?: AbortSignal): Promise<number> {
  const key = getLoadKey()
  if (inFlightLoad?.key === key) return inFlightLoad.promise
  const promise = performLoadData(signal)
  inFlightLoad = { key, promise }
  promise.then(
    () => { if (inFlightLoad?.promise === promise) inFlightLoad = undefined },
    () => { if (inFlightLoad?.promise === promise) inFlightLoad = undefined },
  )
  return promise
}

async function performLoadData(signal?: AbortSignal): Promise<number> {
  const requestSequence = ++loadRequestSequence
  selectedProducts.value = []
  loading.value = true
  try {
    await productFields.refresh()
    if (requestSequence !== loadRequestSequence || pageSession !== localStorage.getItem('token') || signal?.aborted) return pagination.total
    if (clearRestrictedSort()) productTableRef.value?.clearSort()
    const hasSearch = searchForm.product_name.trim() || searchForm.product_code.trim() || searchForm.item_no.trim() || searchForm.supplier_name.trim() || searchForm.product_status
    if (hasSearch) {
      const fields: string[] = []
      const values: Record<string, string> = {}
      if (searchForm.product_name.trim()) { fields.push('product_name'); values['product_name'] = searchForm.product_name.trim() }
      if (searchForm.product_code.trim()) { fields.push('product_code'); values['product_code'] = searchForm.product_code.trim() }
      if (searchForm.item_no.trim()) { fields.push('item_no'); values['item_no'] = searchForm.item_no.trim() }
      if (searchForm.supplier_name.trim()) { fields.push('supplier_name'); values['supplier_name'] = searchForm.supplier_name.trim() }
      if (searchForm.product_status) { fields.push('product_status'); values['product_status'] = searchForm.product_status }
      const res = await searchProduct({
        search_field: JSON.stringify(fields),
        search_value: JSON.stringify(values),
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      }, { signal })
      if (requestSequence !== loadRequestSequence || pageSession !== localStorage.getItem('token')) return pagination.total
      productFields.setResponse(res.data)
      if (clearRestrictedSort()) { productTableRef.value?.clearSort(); return performLoadData(signal) }
      tableData.value = res.data.products || []
      pagination.total = res.data.total ?? 0
    } else if (searchForm.category_id) {
      const res = await getProductList({ category_id: searchForm.category_id, page: pagination.page, page_size: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined }, { signal })
      if (requestSequence !== loadRequestSequence || pageSession !== localStorage.getItem('token')) return pagination.total
      productFields.setResponse(res.data)
      if (clearRestrictedSort()) { productTableRef.value?.clearSort(); return performLoadData(signal) }
      tableData.value = res.data.products || []
      pagination.total = res.data.total ?? 0
    } else {
      // 无分类可用（典型：无产品类别权限导致左树加载失败）。此前直接清空表格，
      // 会把「有产品列表权限」的账号也连坐成整页无数据。降级为 search 接口空条件
      // 全量分页查询（/tenant-products/list 的 category_id 为后端必传，不能兜底）
      const res = await searchProduct({
        search_field: '[]',
        search_value: '{}',
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      }, { signal })
      if (requestSequence !== loadRequestSequence || pageSession !== localStorage.getItem('token')) return pagination.total
      productFields.setResponse(res.data)
      if (clearRestrictedSort()) { productTableRef.value?.clearSort(); return performLoadData(signal) }
      tableData.value = res.data.products || []
      pagination.total = res.data.total ?? 0
    }
    return pagination.total
  } catch (error) {
    if (signal?.aborted) throw signal.reason
    if (requestSequence !== loadRequestSequence || pageSession !== localStorage.getItem('token')) return pagination.total
    tableData.value = []
    pagination.total = 0
    if (signal) throw error
    return 0
  } finally {
    if (requestSequence === loadRequestSequence) loading.value = false
  }
}

/** 库存数量格式化，与仓库库存页保持一致的两位小数展示 */
function formatAmount(value: unknown): string {
  const num = Number(value)
  if (!value && value !== 0) return '-'
  if (Number.isNaN(num)) return '-'
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, {
    product_name: '',
    product_code: '',
    item_no: '',
    supplier_name: '',
    product_status: '',
    category_id: findFirstQueryableCategoryId(categoryTree.value)
  })
  listTemplateRef.value?.setTreeCurrentKey(searchForm.category_id)
  handleSearch()
}
function handleCategoryClick(data: any) {
  searchForm.category_id = data.category_id
  listTemplateRef.value?.setTreeCurrentKey(searchForm.category_id)
  handleSearch()
}
function handleAdd() { router.push({ path: '/common/add', query: { type: 'productInfo' } }) }
function handleEdit(row: ProductItem) {
  sessionStorage.setItem('editData:productInfo', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'productInfo', id: row.product_id, mode: 'edit' } })
}

function handleDelete(row: ProductItem) {
  deleteTarget.value = row
  deleteDialogVisible.value = true
}

function handleDeleteSuccess() {
  deleteDialogVisible.value = false
  deleteTarget.value = null
  loadData()
}

// 批量导入
const importDialogVisible = ref(false)
const importInitialTab = ref<'upload' | 'records'>('upload')
const productTemplateUrl = IMPORT_TEMPLATES.product

function openImport(tab: 'upload' | 'records') {
  importInitialTab.value = tab
  importDialogVisible.value = true
}

function handleImportSuccess() {
  loadData()
}

const productSearchSchema = z.object({
  productName: z.string().trim().optional(),
  productCode: z.string().trim().optional(),
  itemNo: z.string().trim().optional(),
  supplierName: z.string().trim().optional(),
  productStatus: z.enum(['ON_SALE', 'OFF_SALE', 'DISCONTINUED']).optional(),
  page: z.number().int().positive().optional(),
})

const productSearchAction = {
  id: 'product.search',
  title: '查询产品资料',
  description: '按产品名称、编码、货号、供应商和状态查询产品资料；没有条件时查询当前选中的产品类别。',
  inputSchema: productSearchSchema,
  inputGuide: 'productName?: string, productCode?: string, itemNo?: string, supplierName?: string, productStatus?: ON_SALE|OFF_SALE|DISCONTINUED, page?: positive integer',
  risk: 'read',
  confirmation: 'none',
  execute: async (input, context) => {
    context.signal.throwIfAborted()
    if (!searchForm.category_id && categoryTree.value.length === 0) await fetchCategoryTree()
    Object.assign(searchForm, {
      product_name: input.productName ?? '',
      product_code: input.productCode ?? '',
      item_no: input.itemNo ?? '',
      supplier_name: input.supplierName ?? '',
      product_status: input.productStatus ?? '',
    })
    pagination.page = input.page ?? 1
    const total = await loadData(context.signal)
    return {
      total,
      visible: tableData.value.length,
      categoryName: searchForm.category_id
        ? categoryTree.value.find((item) => item.category_id === searchForm.category_id)?.name
        : undefined,
      products: tableData.value.slice(0, 3),
    }
  },
  summarizeResult: ({ total, visible, categoryName, products }) => [
    `产品查询完成，共 **${total}** 条，当前页显示 **${visible}** 条${categoryName ? `，当前类别为 **${categoryName}**` : ''}。`,
    '',
    '| 产品编码 | 产品名称 | 规格 | 单位 | 状态 |',
    '| --- | --- | --- | --- | --- |',
    ...products.map((product) =>
      `| ${product.product_code || '-'} | ${product.product_name || '-'} | ${product.specification || '-'} | ${product.unit_name || '-'} | ${product.product_status_name || product.product_status || '-'} |`,
    ),
  ].join('\n'),
} satisfies WmsAgentActionDefinition<
  z.infer<typeof productSearchSchema>,
  { total: number; visible: number; categoryName?: string; products: ProductItem[] }
>

useAgentPage(
  {
    id: 'product.info.list',
    title: '产品资料',
    routePath: '/product/info',
    description: '产品编码、名称、规格、类别和状态查询页面。',
    getContext: () => ({
      selectedCategoryId: searchForm.category_id,
      visibleProducts: tableData.value.slice(0, 10).map((product) => ({
        productId: product.product_id,
        productCode: product.product_code,
        productName: product.product_name,
        status: product.product_status,
      })),
    }),
  },
  [productSearchAction],
)

onMounted(async () => {
  void checkBatchAccess(false)
  await fetchCategoryTree()
  loadData()
})

// 激活刷新由 ListTemplate 统一处理：keep-alive 只保留页面状态（分页/查询
// 条件/分类树展开选中/滚动位置），每次切回本页 ListTemplate 会 emit
// pageChange → loadData 重取数据，无需本页再写 onActivated。
</script>

<style scoped>
.selection-caption { color: var(--text-secondary); font-size: 12px; margin: 0 0 12px; }
.cell-empty { color: var(--text-tertiary); }
:deep(.el-table--small .el-table__cell) { padding: 8px 12px !important; }
:deep(.el-table--small th.el-table__cell) { padding: 10px 12px !important; }
</style>
