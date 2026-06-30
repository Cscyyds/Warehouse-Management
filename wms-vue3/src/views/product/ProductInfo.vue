<template>
  <ListTemplate
    ref="listTemplateRef"
    title="产品资料"
    show-tree
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
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" v-loading="loading" @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" fixed="left" />
        <el-table-column prop="product_code" label="产品编码" width="120" fixed="left" sortable="custom" />
        <el-table-column prop="item_no" label="品号" width="100" sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.item_no }">{{ row.item_no || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="product_name" label="产品名称" min-width="160" show-overflow-tooltip fixed="left" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.product_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="product_type_name" label="产品类型" width="90" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.product_type_name || row.product_type || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category_name" label="产品类别" width="110" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="specification" label="产品规格" width="110" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.specification }">{{ row.specification || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="color" label="颜色" width="80" sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.color }">{{ row.color || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="unit_name" label="计量单位" width="80" align="center" sortable="custom" />
        <el-table-column prop="factory_price" label="出厂价" width="100" align="right" sortable="custom">
          <template #default="{ row }">{{ row.factory_price || '-' }}</template>
        </el-table-column>
        <el-table-column prop="min_sale_price" label="最低售价" width="100" align="right" sortable="custom">
          <template #default="{ row }">{{ row.min_sale_price || '-' }}</template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="170" sortable="custom" />
        <el-table-column prop="product_status_name" label="状态" width="70" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.product_status === 'ON_SALE' ? 'success' : 'info'" size="small">{{ row.product_status_name || row.product_status || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right" align="center">
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
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { getProductList, searchProduct, getProductCategoryTree, type ProductItem, type ProductCategoryItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import ProductDeletePreviewDialog from './ProductDeletePreviewDialog.vue'

const router = useRouter()
const listTemplateRef = ref<any>()
const tableData = ref<ProductItem[]>([])
const loading = ref(false)
const categoryTree = ref<any[]>([])
const searchForm = reactive({ product_name: '', product_code: '', item_no: '', product_status: '', category_id: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
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

async function fetchCategoryTree() {
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

async function loadData() {
  loading.value = true
  try {
    const hasSearch = searchForm.product_name.trim() || searchForm.product_code.trim() || searchForm.item_no.trim() || searchForm.product_status
    if (hasSearch) {
      const fields: string[] = []
      const values: Record<string, string> = {}
      if (searchForm.product_name.trim()) { fields.push('product_name'); values['product_name'] = searchForm.product_name.trim() }
      if (searchForm.product_code.trim()) { fields.push('product_code'); values['product_code'] = searchForm.product_code.trim() }
      if (searchForm.item_no.trim()) { fields.push('item_no'); values['item_no'] = searchForm.item_no.trim() }
      if (searchForm.product_status) { fields.push('product_status'); values['product_status'] = searchForm.product_status }
      const res = await searchProduct({
        search_field: JSON.stringify(fields),
        search_value: JSON.stringify(values),
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.products || []
      pagination.total = res.data.total ?? 0
    } else if (searchForm.category_id) {
      const res = await getProductList({ category_id: searchForm.category_id, page: pagination.page, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined })
      tableData.value = res.data.products || []
      pagination.total = res.data.total ?? 0
    } else {
      tableData.value = []
      pagination.total = 0
    }
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, {
    product_name: '',
    product_code: '',
    item_no: '',
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

onMounted(async () => {
  await fetchCategoryTree()
  loadData()
})
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
:deep(.el-table--small .el-table__cell) { padding: 8px 12px; }
:deep(.el-table--small th.el-table__cell) { padding: 10px 12px; }
</style>
