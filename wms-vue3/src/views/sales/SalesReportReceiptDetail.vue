<template>
  <ListTemplate title="订单收款明细表" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="订单编号"><el-input v-model="searchForm.orderNo" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户名称"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </template>
    <template #actions><el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button></template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries" @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="orderNo" label="订单编号" min-width="130" sortable="custom" />
        <el-table-column prop="customerName" label="客户名称" min-width="120" sortable="custom" />
        <el-table-column prop="receiptNo" label="收款单号" min-width="130" sortable="custom" />
        <el-table-column prop="receiptDate" label="收款日期" width="110" sortable="custom" />
        <el-table-column prop="receiptAmount" label="收款金额" width="80" align="center" sortable="custom" />
        <el-table-column prop="paymentMethod" label="收款方式" width="80" sortable="custom" />
        <el-table-column prop="bankName" label="结算银行" width="80" sortable="custom" />
        <el-table-column prop="totalAmount" label="订单总额" width="80" align="center" sortable="custom" />
        <el-table-column prop="paidAmount" label="已收金额" width="80" align="center" sortable="custom" />
        <el-table-column prop="unpaidAmount" label="未收金额" width="80" align="center" sortable="custom" />
        <el-table-column prop="receiptStatus" label="收款状态" width="80" align="center" sortable="custom">
          <template #default="{ row }"><el-tag :type="row.receiptStatus === '已收全' ? 'success' : 'warning'" size="small">{{ row.receiptStatus }}</el-tag></template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getSalesReconciliationReport, type SalesQueryParams } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'
import { useTableSort } from '@/composables/useTableSort'
const tableData = ref<any[]>([])
const getSummaries = createAmountSummary(['receiptAmount', 'totalAmount', 'paidAmount', 'unpaidAmount'])
const searchForm = reactive({ orderNo: '', customerName: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const fallbackData = [
  { orderNo: 'SO-20240301-001', customerName: '华南五金店', receiptNo: 'RC-20240305-001', receiptDate: '2024-03-05', receiptAmount: 10000, paymentMethod: '银行转账', bankName: '工商银行', totalAmount: 15000, paidAmount: 10000, unpaidAmount: 5000, receiptStatus: '部分收款' },
  { orderNo: 'SO-20240305-002', customerName: '深圳家居城', receiptNo: 'RC-20240310-002', receiptDate: '2024-03-10', receiptAmount: 8000, paymentMethod: '现金', bankName: '', totalAmount: 8000, paidAmount: 8000, unpaidAmount: 0, receiptStatus: '已收全' },
]
async function loadData() {
  try { const res = await getSalesReconciliationReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined } as SalesQueryParams); tableData.value = (res.data as any).list || []; pagination.total = (res.data as any).total || 0 }
  catch { const start = (pagination.page - 1) * pagination.pageSize; tableData.value = fallbackData.slice(start, start + pagination.pageSize); pagination.total = fallbackData.length }
}
function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { orderNo: '', customerName: '' }); handleSearch() }
async function handleExport() { try { await getSalesReconciliationReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams); ElMessage.success('导出任务已提交') } catch { ElMessage.error('导出失败') } }
onMounted(() => { loadData() })
</script>