<template>
  <ListTemplate
    title="塑料盒管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="塑料盒编号"><el-input v-model="searchForm.code" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="关联库位">
          <el-input v-model="searchForm.locationName" placeholder="请输入" clearable style="width:120px" />
        </el-form-item>
        <el-form-item label="关联货位">
          <el-input v-model="searchForm.shelfName" placeholder="请输入" clearable style="width:120px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:90px">
            <el-option label="正常" value="正常" />
            <el-option label="停用" value="停用" />
          </el-select>
        </el-form-item>
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
        <el-table-column prop="code" label="塑料盒编号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="locationName" label="关联库位" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.locationName }">{{ row.locationName || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="shelfName" label="关联货位" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.shelfName }">{{ row.shelfName || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="companyName" label="绑定公司" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.companyName }">{{ row.companyName || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="addQuantity" label="新增数量" width="80" align="center" />
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column prop="updateTime" label="更新时间" width="160" />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '正常' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
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
import { getPlasticBoxList, deletePlasticBox, batchPrintBoxLabel, type PlasticBoxItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<PlasticBoxItem[]>([])
const selectedRows = ref<PlasticBoxItem[]>([])
const searchForm = reactive({ code: '', locationName: '', shelfName: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: PlasticBoxItem[] = [
  { id: '1', code: 'BOX-SZ-001-001', rfid: 'RFID001', type: '标准', spec: '40x30x15cm', warehouseId: '1', warehouseName: '深圳主仓库', locationId: '1', locationName: '深圳主仓库A区', shelfId: '1', shelfName: 'A区1层1列', status: '正常', createTime: '2024-02-01 09:00', updateTime: '2026-04-20 09:00' },
  { id: '2', code: 'BOX-SZ-001-002', rfid: 'RFID002', type: '标准', spec: '40x30x15cm', warehouseId: '1', warehouseName: '深圳主仓库', locationId: '1', locationName: '深圳主仓库A区', shelfId: '2', shelfName: 'A区1层2列', status: '正常', createTime: '2024-02-01 09:05', updateTime: '2026-04-20 09:05' },
  { id: '3', code: 'BOX-GZ-002-001', rfid: 'RFID003', type: '大型', spec: '60x45x20cm', warehouseId: '2', warehouseName: '广州副仓库', locationId: '2', locationName: '广州副仓库B区', shelfId: '3', shelfName: 'B区1层1列', status: '停用', createTime: '2024-03-01 10:00', updateTime: '2025-08-01 10:00' },
]

async function loadData() {
  try {
    const res = await getPlasticBoxList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { code, status } = searchForm
    const filtered = fallbackData.filter(r => {
      if (code && !r.code.includes(code)) return false
      if (status && r.status !== status) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { code: '', locationName: '', shelfName: '', status: '' }); handleSearch() }
function handleSelectionChange(rows: PlasticBoxItem[]) { selectedRows.value = rows }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'warehousePlastic' } }) }
function handleEdit(row: PlasticBoxItem) {
  sessionStorage.setItem('editData:warehousePlastic', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'warehousePlastic', id: row.id, mode: 'edit' } })
}

async function handleDelete(row: PlasticBoxItem) {
  try {
    await ElMessageBox.confirm(`确认删除塑料盒「${row.code}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deletePlasticBox(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

async function handleBatchPrint() {
  if (selectedRows.value.length === 0) { ElMessage.warning('请先选择要打印的塑料盒'); return }
  try {
    await batchPrintBoxLabel(selectedRows.value.map(r => r.id))
    ElMessage.success('打印任务已提交')
  } catch { ElMessage.error('打印失败') }
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>