<template>
  <ListTemplate
    title="库位管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="完整编号"><el-input v-model="searchForm.code" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="仓库名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="仓库类型">
          <el-select v-model="searchForm.type" placeholder="请选择" clearable style="width:100px">
            <el-option label="主仓" value="主仓" />
            <el-option label="副仓" value="副仓" />
            <el-option label="临时仓" value="临时仓" />
          </el-select>
        </el-form-item>
        <el-form-item label="仓库状态">
          <el-select v-model="searchForm.warehouseStatus" placeholder="请选择" clearable style="width:100px">
            <el-option label="正常" value="正常" />
            <el-option label="冻结" value="冻结" />
            <el-option label="维修" value="维修" />
          </el-select>
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
        <el-table-column prop="code" label="完整编号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="areaName" label="区域" min-width="80" />
        <el-table-column prop="provinceCityArea" label="省市区" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.provinceCityArea }">{{ row.provinceCityArea || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="仓库名称" min-width="130" />
        <el-table-column prop="companyName" label="绑定公司" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.companyName }">{{ row.companyName || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="type" label="仓库类型" min-width="80" align="center" />
        <el-table-column prop="address" label="仓库地址" min-width="150" show-overflow-tooltip />
        <el-table-column prop="contactPerson" label="联系人" min-width="80" />
        <el-table-column prop="contactPhone" label="联系电话" min-width="110" />
        <el-table-column prop="warehouseStatus" label="仓库状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.warehouseStatus === '正常' ? 'success' : row.warehouseStatus === '冻结' ? 'warning' : 'info'" size="small">{{ row.warehouseStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column prop="updateTime" label="更新时间" width="160" />
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
import { getWarehouseList, deleteWarehouse, batchPrintShelfLabel, type WarehouseItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<WarehouseItem[]>([])
const selectedRows = ref<WarehouseItem[]>([])
const searchForm = reactive({ code: '', name: '', type: '', warehouseStatus: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: WarehouseItem[] = [
  { id: '1', code: 'WH-GD-SZ-001', name: '深圳主仓库', type: '主仓', address: '深圳市南山区科技园路1号', contactPerson: '张伟', contactPhone: '13800138001', areaSize: 5000, sort: 1, status: '正常', remark: '', createTime: '2024-01-10 09:00', updateTime: '2026-04-20 09:00', createUserId: '1', createUserName: '管理员' },
  { id: '2', code: 'WH-GD-GZ-002', name: '广州副仓库', type: '副仓', address: '广州市天河区黄埔大道2号', contactPerson: '李明', contactPhone: '13800138002', areaSize: 3000, sort: 2, status: '正常', remark: '', createTime: '2024-02-15 10:00', updateTime: '2026-04-20 10:00', createUserId: '1', createUserName: '管理员' },
  { id: '3', code: 'WH-ZH-TZ-003', name: '珠海临时仓', type: '临时仓', address: '珠海市香洲区人民路3号', contactPerson: '王芳', contactPhone: '13800138003', areaSize: 1000, sort: 3, status: '停用', remark: '暂未启用', createTime: '2024-03-20 11:00', updateTime: '2025-06-01 11:00', createUserId: '1', createUserName: '管理员' },
]

async function loadData() {
  try {
    const res = await getWarehouseList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { code, name, type, status } = searchForm
    const filtered = fallbackData.filter(r => {
      if (code && !r.code.includes(code)) return false
      if (name && !r.name.includes(name)) return false
      if (type && r.type !== type) return false
      if (status && r.status !== status) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { code: '', name: '', type: '', warehouseStatus: '', status: '' }); handleSearch() }
function handleSelectionChange(rows: WarehouseItem[]) { selectedRows.value = rows }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'warehouseLocation' } }) }
function handleEdit(row: WarehouseItem) {
  sessionStorage.setItem('editData:warehouseLocation', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'warehouseLocation', id: row.id, mode: 'edit' } })
}

async function handleDelete(row: WarehouseItem) {
  try {
    await ElMessageBox.confirm(`确认删除库位「${row.name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteWarehouse(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

async function handleBatchPrint() {
  if (selectedRows.value.length === 0) { ElMessage.warning('请先选择要打印的库位'); return }
  try {
    await batchPrintShelfLabel(selectedRows.value.map(r => r.id))
    ElMessage.success('打印任务已提交')
  } catch { ElMessage.error('打印失败') }
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>