<template>
  <ListTemplate title="采购建议表" :loading="loading" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
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
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="productCode" label="产品编码" show-overflow-tooltip min-width="100" />
        <el-table-column prop="productName" label="产品名称" min-width="130" show-overflow-tooltip />
        <el-table-column prop="spec" label="规格" show-overflow-tooltip min-width="80" />
        <el-table-column prop="unit" label="单位" show-overflow-tooltip width="60" />
        <el-table-column prop="currentStock" label="当前库存" show-overflow-tooltip width="80" align="center" />
        <el-table-column prop="safetyStock" label="安全库存" show-overflow-tooltip width="80" align="center" />
        <el-table-column prop="avgSalesQty" label="月均销量" show-overflow-tooltip width="80" align="center" />
        <el-table-column prop="suggestQty" label="建议采购量" width="90" align="center">
          <template #default="{ row }">
            <span style="color: var(--el-color-danger); font-weight: 600;">{{ row.suggestQty }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="supplierName" label="建议供应商" min-width="130" show-overflow-tooltip />
        <el-table-column prop="lastPurchasePrice" label="上次采购价" show-overflow-tooltip width="90" align="center" />
        <el-table-column prop="lastPurchaseDate" label="上次采购日期" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.lastPurchaseDate) }}</template>
        </el-table-column>
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
import { formatTableDate } from '@/utils/date'

const tableData = ref<any[]>([])
const loading = ref(false)
const searchForm = reactive({ productCode: '', productName: '', supplierName: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
async function loadData() {
  loading.value = true
  try {
    const res = await getPurchaseSuggestionList({ ...searchForm, page: pagination.page, page_size: pagination.pageSize, pageSize: pagination.pageSize } as any)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
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
