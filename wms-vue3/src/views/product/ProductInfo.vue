<template>
  <ListTemplate
    ref="listTemplateRef"
    title="产品资料"
    layout-key="product-info"
    show-tree
    tree-title="产品类别"
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
        <el-form-item label="品号"><el-input v-model="searchForm.item_no" placeholder="请输入" clearable style="width:120px" /></el-form-item>
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
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
      <el-button @click="importDialogVisible = true"><el-icon><Upload /></el-icon>批量导入</el-button>
    </template>
    <template #table>
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" v-loading="loading" @sort-change="handleSortChange">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" fixed="left" />
        <el-table-column prop="product_code" label="产品编码" min-width="180" show-overflow-tooltip fixed="left" sortable="custom" />
        <el-table-column prop="product_name" label="产品名称" min-width="160" show-overflow-tooltip fixed="left" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.product_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="item_no" label="品号" min-width="140" show-overflow-tooltip sortable="custom">
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
        <el-table-column prop="factory_price" label="出厂价" width="100" align="right" sortable="custom">
          <template #default="{ row }">{{ row.factory_price || '-' }}</template>
        </el-table-column>
        <el-table-column prop="min_sale_price" label="最低售价" width="100" align="right" sortable="custom">
          <template #default="{ row }">{{ row.min_sale_price || '-' }}</template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="170" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column prop="product_status_name" column-key="product_status" label="状态" min-width="110" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.product_status === 'ON_SALE' ? 'success' : 'info'" size="small">{{ row.product_status_name || row.product_status || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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
    :template-url="productTemplateUrl"
    template-name="产品导入模板.xlsx"
    :import-fn="importProducts"
    @success="handleImportSuccess"
  />
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onActivated, nextTick } from 'vue'
import { z } from 'zod'
import { useRouter } from 'vue-router'
import { Plus, Upload } from '@element-plus/icons-vue'
import { getProductList, searchProduct, getProductCategoryTree, importProducts, type ProductItem, type ProductCategoryItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import BatchImportDialog from '@/views/common/BatchImportDialog.vue'
import { useTableSort } from '@/composables/useTableSort'
import ProductDeletePreviewDialog from './ProductDeletePreviewDialog.vue'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'
import { useAgentPage } from '@/composables/useAgentPage'
import type { WmsAgentActionDefinition } from '@/agent/types'

defineOptions({ name: 'ProductInfo' })

const router = useRouter()
const listTemplateRef = ref<any>()
const tableData = ref<ProductItem[]>([])
const loading = ref(false)
const categoryTree = ref<any[]>([])
const searchForm = reactive({ product_name: '', product_code: '', item_no: '', supplier_name: '', product_status: '', category_id: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
let loadRequestSequence = 0
let inFlightLoad: { key: string; promise: Promise<number> } | undefined
let categoryTreeRequest: Promise<void> | undefined
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

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
    const res = await getProductCategoryTree()
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
  loading.value = true
  try {
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
      if (requestSequence !== loadRequestSequence) return pagination.total
      tableData.value = res.data.products || []
      pagination.total = res.data.total ?? 0
    } else if (searchForm.category_id) {
      const res = await getProductList({ category_id: searchForm.category_id, page: pagination.page, page_size: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined }, { signal })
      if (requestSequence !== loadRequestSequence) return pagination.total
      tableData.value = res.data.products || []
      pagination.total = res.data.total ?? 0
    } else {
      if (requestSequence !== loadRequestSequence) return pagination.total
      tableData.value = []
      pagination.total = 0
    }
    return pagination.total
  } catch (error) {
    if (signal?.aborted) throw signal.reason
    if (requestSequence !== loadRequestSequence) return pagination.total
    tableData.value = []
    pagination.total = 0
    if (signal) throw error
    return 0
  } finally {
    if (requestSequence === loadRequestSequence) loading.value = false
  }
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
const productTemplateUrl = `${import.meta.env.BASE_URL}templates/product-import-template.xlsx`

function handleImportSuccess() {
  importDialogVisible.value = false
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
  description: '按产品名称、编码、品号、供应商和状态查询产品资料；没有条件时查询当前选中的产品类别。',
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
  await fetchCategoryTree()
  loadData()
})

// keep-alive 激活时：只刷新表格数据，不重置分类树（保持展开/选中状态）
onActivated(() => {
  if (searchForm.category_id) {
    loadData()
  }
})
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
:deep(.el-table--small .el-table__cell) { padding: 8px 12px !important; }
:deep(.el-table--small th.el-table__cell) { padding: 10px 12px !important; }
</style>
