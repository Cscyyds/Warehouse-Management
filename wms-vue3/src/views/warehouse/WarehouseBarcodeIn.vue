<template>
  <ListTemplate
    title="入库条码"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="条形码编码"><el-input v-model="searchForm.barcode" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品编码"><el-input v-model="searchForm.productCode" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item label="产品名称"><el-input v-model="searchForm.productName" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item label="入库单"><el-input v-model="searchForm.businessNo" placeholder="请输入" clearable style="width:120px" /></el-form-item>
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
        <el-table-column prop="barcode" label="条形码编码" min-width="130" show-overflow-tooltip />
        <el-table-column prop="productCode" label="产品编码" min-width="100" />
        <el-table-column prop="productName" label="产品名称" min-width="130" show-overflow-tooltip />
        <el-table-column prop="spec" label="产品规格" min-width="100" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.spec }">{{ row.spec || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="companyName" label="绑定公司" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.companyName }">{{ row.companyName || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="color" label="颜色" width="70" />
        <el-table-column prop="unit" label="计量单位" width="80" />
        <el-table-column prop="origin" label="原产地" min-width="80" />
        <el-table-column prop="quantity" label="数量" width="70" align="center" />
        <el-table-column prop="printDate" label="打印日期" width="110" />
        <el-table-column prop="businessNo" label="入库单" min-width="110" show-overflow-tooltip />
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

const router = useRouter()
const tableData = ref<BarcodeItem[]>([])
const selectedRows = ref<BarcodeItem[]>([])
const searchForm = reactive({ barcode: '', productCode: '', productName: '', businessNo: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: BarcodeItem[] = [
  { id: '1', barcode: 'IN-20240301-001', type: '入库', businessType: '采购入库', businessNo: 'PO-20240301', productId: '1', productCode: 'P001', productName: '铰链A型', batchNo: 'B001', spec: '40x35mm', quantity: 50, unit: '个', warehouseId: '1', warehouseName: '深圳主仓库', locationId: '1', locationName: '深圳主仓库A区', shelfId: '1', shelfName: 'A区1层1列', status: '正常', printCount: 1, remark: '', createTime: '2024-03-01 09:00', updateTime: '2024-03-01 09:00', createUserId: '1', createUserName: '管理员' },
  { id: '2', barcode: 'IN-20240302-002', type: '入库', businessType: '采购入库', businessNo: 'PO-20240302', productId: '2', productCode: 'P002', productName: '滑轨B型', batchNo: 'B002', spec: '300mm', quantity: 30, unit: '套', warehouseId: '1', warehouseName: '深圳主仓库', locationId: '1', locationName: '深圳主仓库A区', shelfId: '2', shelfName: 'A区1层2列', status: '正常', printCount: 2, remark: '', createTime: '2024-03-02 10:00', updateTime: '2024-03-02 10:00', createUserId: '1', createUserName: '管理员' },
]

async function loadData() {
  try {
    const res = await getInboundBarcodeList({ ...searchForm, type: '入库', page: pagination.page, pageSize: pagination.pageSize })
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { barcode, productCode, productName, businessNo } = searchForm
    const filtered = fallbackData.filter(r => {
      if (barcode && !r.barcode.includes(barcode)) return false
      if (productCode && !r.productCode.includes(productCode)) return false
      if (productName && !r.productName.includes(productName)) return false
      if (businessNo && !r.businessNo.includes(businessNo)) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { barcode: '', productCode: '', productName: '', businessNo: '' }); handleSearch() }
function handleSelectionChange(rows: BarcodeItem[]) { selectedRows.value = rows }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'warehouseBarcodeIn' } }) }
function handleEdit(row: BarcodeItem) {
  sessionStorage.setItem('editData:warehouseBarcodeIn', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'warehouseBarcodeIn', id: row.id, mode: 'edit' } })
}

async function handleDelete(row: BarcodeItem) {
  try {
    await ElMessageBox.confirm(`确认删除入库条码「${row.barcode}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
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