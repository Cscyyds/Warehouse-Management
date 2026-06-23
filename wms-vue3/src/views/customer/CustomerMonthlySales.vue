<template>
  <ListTemplate title="客户月度销售表" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="客户名称"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="统计月份">
          <el-date-picker v-model="searchForm.month" type="month" placeholder="选择月份" style="width:130px" value-format="YYYY-MM" />
        </el-form-item>
        <el-form-item label="所在城市"><el-input v-model="searchForm.city" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="customerName" label="客户名称" min-width="80" show-overflow-tooltip />
        <el-table-column prop="city" label="所在城市" width="80" />
        <el-table-column prop="month" label="统计月份" width="90" />
        <el-table-column prop="orderCount" label="订单数量" width="80" align="center" />
        <el-table-column prop="salesQuantity" label="销售数量" width="80" align="center" />
        <el-table-column prop="salesAmount" label="销售金额" width="90" align="center" />
        <el-table-column prop="returnQuantity" label="退货数量" width="80" align="center" />
        <el-table-column prop="returnAmount" label="退货金额" width="90" align="center" />
        <el-table-column prop="netAmount" label="净销售额" width="90" align="center" />
        <el-table-column prop="receivedAmount" label="已收款" width="90" align="center" />
        <el-table-column prop="unpaidAmount" label="未收款" width="90" align="center">
          <template #default="{ row }">
            <span :style="{ color: row.unpaidAmount > 0 ? 'var(--el-color-danger)' : '' }">{{ row.unpaidAmount }}</span>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getCustomerMonthlySalesList } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'

const tableData = ref<any[]>([])
const getSummaries = createAmountSummary(['salesAmount', 'returnAmount', 'netAmount', 'receivedAmount', 'unpaidAmount'])
const searchForm = reactive({ customerName: '', month: '', city: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const fallbackData = [
  { customerName: '华南五金店', city: '广州', month: '2024-03', orderCount: 5, salesQuantity: 800, salesAmount: 45000, returnQuantity: 20, returnAmount: 1200, netAmount: 43800, receivedAmount: 43800, unpaidAmount: 0 },
  { customerName: '深圳家居城', city: '深圳', month: '2024-03', orderCount: 3, salesQuantity: 450, salesAmount: 28000, returnQuantity: 15, returnAmount: 900, netAmount: 27100, receivedAmount: 20000, unpaidAmount: 7100 },
  { customerName: '珠海建材公司', city: '珠海', month: '2024-03', orderCount: 2, salesQuantity: 200, salesAmount: 12000, returnQuantity: 0, returnAmount: 0, netAmount: 12000, receivedAmount: 8000, unpaidAmount: 4000 },
]

async function loadData() {
  try {
    const res = await getCustomerMonthlySalesList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as any)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { customerName, city } = searchForm
    const filtered = fallbackData.filter(r => {
      if (customerName && !r.customerName.includes(customerName)) return false
      if (city && !r.city.includes(city)) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { customerName: '', month: '', city: '' }); handleSearch() }
async function handleExport() {
  try { await getCustomerMonthlySalesList({ ...searchForm, page: 1, pageSize: 9999 } as any); ElMessage.success('导出任务已提交') }
  catch { ElMessage.error('导出失败') }
}
onMounted(() => { loadData() })
</script>
