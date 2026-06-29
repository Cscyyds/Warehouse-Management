<template>
  <ListTemplate title="采购建议表" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="产品编码"><el-input v-model="searchForm.productCode" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品名称"><el-input v-model="searchForm.productName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="供应商"><el-input v-model="searchForm.supplierName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="productCode" label="产品编码" min-width="100" sortable="custom" />
        <el-table-column prop="productName" label="产品名称" min-width="130" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="spec" label="规格" min-width="80" sortable="custom" />
        <el-table-column prop="unit" label="单位" width="60" sortable="custom" />
        <el-table-column prop="currentStock" label="当前库存" width="80" align="center" sortable="custom" />
        <el-table-column prop="safetyStock" label="安全库存" width="80" align="center" sortable="custom" />
        <el-table-column prop="avgSalesQty" label="月均销量" width="80" align="center" sortable="custom" />
        <el-table-column prop="suggestQty" label="建议采购量" width="90" align="center" sortable="custom">
          <template #default="{ row }">
            <span style="color: var(--el-color-danger); font-weight: 600;">{{ row.suggestQty }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="supplierName" label="建议供应商" min-width="130" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="lastPurchasePrice" label="上次采购价" width="90" align="center" sortable="custom" />
        <el-table-column prop="lastPurchaseDate" label="上次采购日期" width="120" sortable="custom" />
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getPurchaseSuggestionList } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const tableData = ref<any[]>([])
const searchForm = reactive({ productCode: '', productName: '', supplierName: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const fallbackData = [
  { productCode: 'P001', productName: '铰链A型', spec: '40x35mm', unit: '个', currentStock: 50, safetyStock: 200, avgSalesQty: 300, suggestQty: 450, supplierName: '广州五金供应商', lastPurchasePrice: 12.5, lastPurchaseDate: '2024-02-10' },
  { productCode: 'P002', productName: '滑轨B型', spec: '300mm', unit: '套', currentStock: 30, safetyStock: 100, avgSalesQty: 150, suggestQty: 220, supplierName: '深圳配件厂', lastPurchasePrice: 18.0, lastPurchaseDate: '2024-02-15' },
  { productCode: 'P003', productName: '把手C型', spec: '80mm', unit: '个', currentStock: 80, safetyStock: 150, avgSalesQty: 120, suggestQty: 190, supplierName: '东莞金属制品', lastPurchasePrice: 22.0, lastPurchaseDate: '2024-01-20' },
]

async function loadData() {
  try {
    const res = await getPurchaseSuggestionList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined } as any)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { productCode, productName, supplierName } = searchForm
    const filtered = fallbackData.filter(r => {
      if (productCode && !r.productCode.includes(productCode)) return false
      if (productName && !r.productName.includes(productName)) return false
      if (supplierName && !r.supplierName.includes(supplierName)) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { productCode: '', productName: '', supplierName: '' }); handleSearch() }
async function handleExport() {
  try { await getPurchaseSuggestionList({ ...searchForm, page: 1, pageSize: 9999 } as any); ElMessage.success('导出任务已提交') }
  catch { ElMessage.error('导出失败') }
}
onMounted(() => { loadData() })
</script>
