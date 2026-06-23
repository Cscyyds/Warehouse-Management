<template>
  <ListTemplate title="滞销产品表" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="产品编码"><el-input v-model="searchForm.productCode" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品名称"><el-input v-model="searchForm.productName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品类别"><el-input v-model="searchForm.categoryName" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item label="滞销天数(≥)"><el-input-number v-model="searchForm.unsoldDays" :min="0" style="width:120px" /></el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="productCode" label="产品编码" min-width="100" />
        <el-table-column prop="productName" label="产品名称" min-width="130" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="产品类别" min-width="80" />
        <el-table-column prop="spec" label="规格" min-width="80" />
        <el-table-column prop="unit" label="单位" width="60" />
        <el-table-column prop="stockQuantity" label="库存数量" width="80" align="center" />
        <el-table-column prop="lastSaleDate" label="最后销售日期" width="120" />
        <el-table-column prop="unsoldDays" label="滞销天数" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.unsoldDays >= 180 ? 'danger' : row.unsoldDays >= 90 ? 'warning' : 'info'" size="small">{{ row.unsoldDays }}天</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="stockAmount" label="库存金额" width="90" align="center" />
        <el-table-column prop="warehouseName" label="所在仓库" min-width="120" />
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getUnsoldProductList } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'

const tableData = ref<any[]>([])
const getSummaries = createAmountSummary(['stockAmount'])
const searchForm = reactive({ productCode: '', productName: '', categoryName: '', unsoldDays: 0 })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const fallbackData = [
  { productCode: 'P010', productName: '老款铰链X型', categoryName: '五金配件', spec: '35x30mm', unit: '个', stockQuantity: 500, lastSaleDate: '2023-10-15', unsoldDays: 218, stockAmount: 3500, warehouseName: '深圳主仓库' },
  { productCode: 'P011', productName: '旧款滑轨Y型', categoryName: '五金配件', spec: '250mm', unit: '套', stockQuantity: 200, lastSaleDate: '2023-11-20', unsoldDays: 182, stockAmount: 2800, warehouseName: '广州副仓库' },
  { productCode: 'P012', productName: '过时把手Z型', categoryName: '门控五金', spec: '60mm', unit: '个', stockQuantity: 80, lastSaleDate: '2024-01-05', unsoldDays: 136, stockAmount: 960, warehouseName: '深圳主仓库' },
]

async function loadData() {
  try {
    const res = await getUnsoldProductList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as any)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { productCode, productName, categoryName, unsoldDays } = searchForm
    const filtered = fallbackData.filter(r => {
      if (productCode && !r.productCode.includes(productCode)) return false
      if (productName && !r.productName.includes(productName)) return false
      if (categoryName && !r.categoryName.includes(categoryName)) return false
      if (unsoldDays && r.unsoldDays < unsoldDays) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { productCode: '', productName: '', categoryName: '', unsoldDays: 0 }); handleSearch() }
async function handleExport() {
  try { await getUnsoldProductList({ ...searchForm, page: 1, pageSize: 9999 } as any); ElMessage.success('导出任务已提交') }
  catch { ElMessage.error('导出失败') }
}
onMounted(() => { loadData() })
</script>
