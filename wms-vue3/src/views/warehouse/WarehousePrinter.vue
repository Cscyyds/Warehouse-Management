<template>
  <ListTemplate
    title="打印机管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="打印机名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="IP地址"><el-input v-model="searchForm.ipAddress" placeholder="请输入" clearable style="width:130px" /></el-form-item>
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
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="id" label="打印机ID" min-width="80" sortable="custom" />
        <el-table-column prop="name" label="打印机名称" min-width="130" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="ipAddress" label="IP地址" min-width="130" sortable="custom" />
        <el-table-column prop="port" label="端口号" width="80" align="center" sortable="custom" />
        <el-table-column prop="companyName" label="绑定公司" min-width="120" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.companyName }">{{ row.companyName || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" sortable="custom" />
        <el-table-column prop="updateTime" label="更新时间" width="160" sortable="custom" />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="70" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.status === '正常' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="warning" size="small" @click="handleTestConnection(row)">测试</el-button>
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
import { Plus } from '@element-plus/icons-vue'
import { getPrinterList, deletePrinter, testPrinterConnection, type PrinterItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<PrinterItem[]>([])
const searchForm = reactive({ name: '', ipAddress: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

const fallbackData: PrinterItem[] = [
  { id: 'P001', name: '条码打印机1', code: 'PR-001', type: '条码', brand: '兄弟', model: 'QL-820NWB', ipAddress: '192.168.1.100', port: 9100, paperSize: '标签纸', status: '正常', isDefault: true, remark: 'A区专用', createTime: '2024-01-10 09:00', updateTime: '2026-04-20 09:00', createUserId: '1', createUserName: '管理员' },
  { id: 'P002', name: '标签打印机2', code: 'PR-002', type: '标签', brand: '得力', model: 'DL-888D', ipAddress: '192.168.1.101', port: 9100, paperSize: '标签纸', status: '正常', isDefault: false, remark: '', createTime: '2024-02-15 10:00', updateTime: '2026-04-20 10:00', createUserId: '1', createUserName: '管理员' },
  { id: 'P003', name: '物流打印机', code: 'PR-003', type: '物流', brand: '惠普', model: 'HP-LJ1020', ipAddress: '192.168.1.102', port: 9100, paperSize: 'A4', status: '停用', isDefault: false, remark: '待维修', createTime: '2024-03-20 11:00', updateTime: '2025-08-01 11:00', createUserId: '1', createUserName: '管理员' },
]

async function loadData() {
  try {
    const res = await getPrinterList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined })
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { name, ipAddress, status } = searchForm
    const filtered = fallbackData.filter(r => {
      if (name && !r.name.includes(name)) return false
      if (ipAddress && !r.ipAddress.includes(ipAddress)) return false
      if (status && r.status !== status) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', ipAddress: '', status: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'warehousePrinter' } }) }
function handleEdit(row: PrinterItem) {
  sessionStorage.setItem('editData:warehousePrinter', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'warehousePrinter', id: row.id, mode: 'edit' } })
}

async function handleTestConnection(row: PrinterItem) {
  try {
    const res = await testPrinterConnection(row.id)
    if (res.data.success) { ElMessage.success(`连接测试成功：${res.data.message}`) }
    else { ElMessage.warning(`连接测试失败：${res.data.message}`) }
  } catch { ElMessage.error('测试连接异常') }
}

async function handleDelete(row: PrinterItem) {
  try {
    await ElMessageBox.confirm(`确认删除打印机「${row.name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deletePrinter(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>