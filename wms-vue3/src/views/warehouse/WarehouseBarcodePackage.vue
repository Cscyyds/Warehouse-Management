<template>
  <ListTemplate
    title="包装条码"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="条形码编码"><el-input v-model="searchForm.barcode" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品编码"><el-input v-model="searchForm.productCode" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item label="产品名称"><el-input v-model="searchForm.productName" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item label="包装单号"><el-input v-model="searchForm.businessNo" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
      <el-button @click="handleBatchPrint"><el-icon><Printer /></el-icon>批量打印</el-button>
    </template>
    <template #table>
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="barcode" label="条形码编码" min-width="130" show-overflow-tooltip />
        <el-table-column prop="productCode" label="产品编码" min-width="100" />
        <el-table-column prop="productName" label="产品名称" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.productName }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="spec" label="产品规格" min-width="100" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.spec }">{{ row.spec || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="packageType" label="包装类型" min-width="100">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.packageType }">{{ row.packageType || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="quantity" label="包装数量" width="90" align="center" />
        <el-table-column prop="unit" label="计量单位" width="80" />
        <el-table-column prop="printDate" label="打印日期" width="110">
          <template #default="{ row }">{{ formatTableDate(row.printDate) }}</template>
        </el-table-column>
        <el-table-column prop="businessNo" label="包装单号" min-width="110" show-overflow-tooltip />
        <el-table-column prop="createUserName" label="创建人" width="80" />
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Printer } from '@element-plus/icons-vue'
import { getInboundBarcodeList, deleteBarcode, batchPrintBarcode, type BarcodeItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { formatTableDate } from '@/utils/date'

const router = useRouter()
const tableData = ref<BarcodeItem[]>([])
const selectedRows = ref<BarcodeItem[]>([])
const searchForm = reactive({ barcode: '', productCode: '', productName: '', businessNo: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const loading = ref(false)

async function loadData() {
  loading.value = true
  try {
    const res = await getInboundBarcodeList({ ...searchForm, type: '包装', page: pagination.page, page_size: pagination.pageSize, pageSize: pagination.pageSize })
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
function handleReset() { Object.assign(searchForm, { barcode: '', productCode: '', productName: '', businessNo: '' }); handleSearch() }
function handleSelectionChange(rows: BarcodeItem[]) { selectedRows.value = rows }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'warehouseBarcodePackage' } }) }
function handleEdit(row: BarcodeItem) {
  sessionStorage.setItem('editData:warehouseBarcodePackage', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'warehouseBarcodePackage', id: row.id, mode: 'edit' } })
}

async function handleDelete(row: BarcodeItem) {
  try {
    await ElMessageBox.confirm(`确认删除包装条码「${row.barcode}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteBarcode(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

async function handleBatchPrint() {
  if (selectedRows.value.length === 0) { ElMessage.warning('请先选择要打印的条码'); return }
  try {
    await batchPrintBarcode(selectedRows.value.map(r => r.id))
    ElMessage.success('打印任务已提交')
  } catch { ElMessage.error('打印失败') }
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
