<template>
  <ListTemplate
    title="物流条码"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="物流单号"><el-input v-model="searchForm.businessNo" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="出库单"><el-input v-model="searchForm.outboundNo" placeholder="请输入" clearable style="width:120px" /></el-form-item>
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
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column prop="barcode" label="物流单号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="businessNo" label="出库单号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="printDate" label="打印日期" width="110" />
        <el-table-column prop="createUserName" label="创建人" width="80" />
        <el-table-column prop="createTime" label="创建时间" width="160" />
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
import { getLogisticsBarcodeList, deleteBarcode, batchPrintBarcode, type BarcodeItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<BarcodeItem[]>([])
const selectedRows = ref<BarcodeItem[]>([])
const searchForm = reactive({ businessNo: '', outboundNo: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: BarcodeItem[] = [
  { id: '7', barcode: 'LG-20240320-001', type: '物流', businessType: '物流发货', businessNo: 'SO-20240310', productId: '', productCode: '', productName: '', batchNo: '', spec: '', quantity: 0, unit: '', warehouseId: '1', warehouseName: '深圳主仓库', locationId: '', locationName: '', shelfId: '', shelfName: '', status: '正常', printCount: 1, remark: '', createTime: '2024-03-20 09:00', updateTime: '2024-03-20 09:00', createUserId: '1', createUserName: '管理员' },
  { id: '8', barcode: 'LG-20240325-002', type: '物流', businessType: '物流发货', businessNo: 'SO-20240315', productId: '', productCode: '', productName: '', batchNo: '', spec: '', quantity: 0, unit: '', warehouseId: '1', warehouseName: '深圳主仓库', locationId: '', locationName: '', shelfId: '', shelfName: '', status: '正常', printCount: 2, remark: '', createTime: '2024-03-25 10:00', updateTime: '2024-03-25 10:00', createUserId: '1', createUserName: '管理员' },
]

async function loadData() {
  try {
    const res = await getLogisticsBarcodeList({ ...searchForm, type: '物流', page: pagination.page, pageSize: pagination.pageSize })
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { businessNo, outboundNo } = searchForm
    const filtered = fallbackData.filter(r => {
      if (businessNo && !r.barcode.includes(businessNo)) return false
      if (outboundNo && !r.businessNo.includes(outboundNo)) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { businessNo: '', outboundNo: '' }); handleSearch() }
function handleSelectionChange(rows: BarcodeItem[]) { selectedRows.value = rows }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'warehouseBarcodeLogistics' } }) }
function handleEdit(row: BarcodeItem) {
  sessionStorage.setItem('editData:warehouseBarcodeLogistics', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'warehouseBarcodeLogistics', id: row.id, mode: 'edit' } })
}

async function handleDelete(row: BarcodeItem) {
  try {
    await ElMessageBox.confirm(`确认删除物流条码「${row.barcode}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
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