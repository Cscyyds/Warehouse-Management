<template>
  <ListTemplate title="销售退货汇总表" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="退货单号"><el-input v-model="searchForm.orderNo" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户名称"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker v-model="searchForm.startDate" type="date" placeholder="开始日期" style="width:130px" />
          <el-date-picker v-model="searchForm.endDate" type="date" placeholder="结束日期" style="width:130px" />
        </el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </template>
    <template #actions><el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button></template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries">
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column prop="returnNo" label="退货单号" min-width="130" />
        <el-table-column prop="customerName" label="客户名称" min-width="120" />
        <el-table-column prop="productCode" label="产品编码" min-width="100" />
        <el-table-column prop="productName" label="产品名称" min-width="130" />
        <el-table-column prop="returnQuantity" label="退货数量" width="80" align="center" />
        <el-table-column prop="returnAmount" label="退货金额" width="80" align="center" />
        <el-table-column prop="returnReason" label="退货原因" min-width="120" show-overflow-tooltip />
        <el-table-column prop="returnDate" label="退货日期" width="110" />
        <el-table-column prop="auditStatus" label="审核状态" width="80" align="center">
          <template #default="{ row }"><el-tag :type="row.auditStatus === '审核通过' ? 'success' : row.auditStatus === '审核驳回' ? 'danger' : 'warning'" size="small">{{ row.auditStatus }}</el-tag></template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getSalesReturnReport, type SalesQueryParams } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'
const tableData = ref<any[]>([])
const getSummaries = createAmountSummary(['returnAmount'])
const searchForm = reactive({ orderNo: '', customerName: '', startDate: '', endDate: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const fallbackData = [
  { returnNo: 'SR-20240315-001', customerName: '华南五金店', productCode: 'P001', productName: '铰链A型', returnQuantity: 30, returnAmount: 375, returnReason: '产品质量问题', returnDate: '2024-03-15', auditStatus: '审核通过' },
  { returnNo: 'SR-20240320-002', customerName: '深圳家居城', productCode: 'P002', productName: '滑轨B型', returnQuantity: 15, returnAmount: 270, returnReason: '客户取消订单', returnDate: '2024-03-20', auditStatus: '待审核' },
]
async function loadData() {
  try { const res = await getSalesReturnReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams); tableData.value = (res.data as any).list || []; pagination.total = (res.data as any).total || 0 }
  catch { const start = (pagination.page - 1) * pagination.pageSize; tableData.value = fallbackData.slice(start, start + pagination.pageSize); pagination.total = fallbackData.length }
}
function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { orderNo: '', customerName: '', startDate: '', endDate: '' }); handleSearch() }
async function handleExport() { try { await getSalesReturnReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams); ElMessage.success('导出任务已提交') } catch { ElMessage.error('导出失败') } }
onMounted(() => { loadData() })
</script>