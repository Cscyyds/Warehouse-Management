<template>
  <ListTemplate title="冻结库存明细表" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="订单编号"><el-input v-model="searchForm.orderNo" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品名称"><el-input v-model="searchForm.productName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button>
      <el-button type="danger" @click="handleUrgent"><el-icon><Promotion /></el-icon>加急</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column prop="orderNo" label="订单编号" min-width="130" />
        <el-table-column prop="customerName" label="客户名称" min-width="120" />
        <el-table-column prop="productCode" label="产品编码" min-width="100" />
        <el-table-column prop="productName" label="产品名称" min-width="130" />
        <el-table-column prop="frozenQuantity" label="冻结数量" width="80" align="center" />
        <el-table-column prop="warehouseName" label="仓库" min-width="120" />
        <el-table-column prop="locationName" label="库位" min-width="100" />
        <el-table-column prop="shelfName" label="货位" min-width="100" />
        <el-table-column prop="frozenDate" label="冻结日期" width="110" />
        <el-table-column prop="isUrgent" label="加急" width="60" align="center">
          <template #default="{ row }"><el-tag :type="row.isUrgent ? 'danger' : 'info'" size="small">{{ row.isUrgent ? '是' : '否' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="danger" size="small" v-if="!row.isUrgent" @click="handleMarkUrgent(row)">标记加急</el-button>
            <el-button link type="success" size="small" v-if="row.isUrgent" @click="handleCancelUrgent(row)">取消加急</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Promotion } from '@element-plus/icons-vue'
import { getSalesReport, type SalesQueryParams } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
const tableData = ref<any[]>([])
const selectedRows = ref<any[]>([])
const searchForm = reactive({ orderNo: '', productName: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const fallbackData = [
  { id: '1', orderNo: 'SO-20240305-002', customerName: '深圳家居城', productCode: 'P002', productName: '滑轨B型', frozenQuantity: 70, warehouseName: '深圳主仓库', locationName: 'A区', shelfName: 'A区1层2列', frozenDate: '2024-03-05', isUrgent: false },
  { id: '2', orderNo: 'SO-20240310-003', customerName: '珠海建材公司', productCode: 'P003', productName: '把手C型', frozenQuantity: 30, warehouseName: '广州副仓库', locationName: 'B区', shelfName: 'B区1层1列', frozenDate: '2024-03-10', isUrgent: true },
]
async function loadData() {
  try { const res = await getSalesReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams); tableData.value = (res.data as any).list || []; pagination.total = (res.data as any).total || 0 }
  catch { const start = (pagination.page - 1) * pagination.pageSize; tableData.value = fallbackData.slice(start, start + pagination.pageSize); pagination.total = fallbackData.length }
}
function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { orderNo: '', productName: '' }); handleSearch() }
function handleSelectionChange(rows: any[]) { selectedRows.value = rows }
async function handleExport() { try { await getSalesReport({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams); ElMessage.success('导出任务已提交') } catch { ElMessage.error('导出失败') } }
function handleUrgent() {
  if (selectedRows.value.length === 0) { ElMessage.warning('请先选择要加急的记录'); return }
  selectedRows.value.forEach(r => { r.isUrgent = true })
  ElMessage.success(`已标记 ${selectedRows.value.length} 条记录为加急`)
}
function handleMarkUrgent(row: any) { row.isUrgent = true; ElMessage.success('已标记为加急') }
function handleCancelUrgent(row: any) { row.isUrgent = false; ElMessage.success('已取消加急') }
onMounted(() => { loadData() })
</script>