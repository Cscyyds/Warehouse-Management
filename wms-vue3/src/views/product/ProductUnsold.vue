<template>
  <ListTemplate title="滞销产品表" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="产品编码"><el-input v-model="searchForm.product_code" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品名称"><el-input v-model="searchForm.product_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" v-loading="loading" @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="product_code" label="产品编码" min-width="100" sortable="custom" />
        <el-table-column prop="product_name" label="产品名称" min-width="130" show-overflow-tooltip sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.product_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="category_name" label="产品类别" min-width="80" sortable="custom" />
        <el-table-column prop="specification" label="规格" min-width="80" sortable="custom" />
        <el-table-column prop="unit_name" label="单位" width="60" sortable="custom" />
        <el-table-column prop="product_status_name" label="状态" width="80" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.product_status === 'DISCONTINUED' ? 'danger' : 'warning'" size="small">{{ row.product_status_name || row.product_status || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="factory_price" label="出厂价" width="90" align="right" sortable="custom" />
        <el-table-column prop="updated_at" label="更新时间" width="170" sortable="custom" />
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { searchProduct, type ProductItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<ProductItem[]>([])
const loading = ref(false)
const searchForm = reactive({ product_code: '', product_name: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

async function loadData() {
  loading.value = true
  try {
    const fields: string[] = ['product_status']
    const values: Record<string, string> = { product_status: 'DISCONTINUED' }
    if (searchForm.product_code.trim()) { fields.push('product_code'); values['product_code'] = searchForm.product_code.trim() }
    if (searchForm.product_name.trim()) { fields.push('product_name'); values['product_name'] = searchForm.product_name.trim() }
    const res = await searchProduct({
      search_field: JSON.stringify(fields),
      search_value: JSON.stringify(values),
      page: pagination.page,
      sort_by: sortBy.value || undefined,
      sort_order: sortOrder.value || undefined,
    })
    tableData.value = res.data.products || []
    pagination.total = res.data.total ?? 0
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { product_code: '', product_name: '' }); handleSearch() }
function handleEdit(row: ProductItem) {
  sessionStorage.setItem('editData:productInfo', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'productInfo', id: row.product_id, mode: 'edit' } })
}
onMounted(() => { loadData() })
</script>
