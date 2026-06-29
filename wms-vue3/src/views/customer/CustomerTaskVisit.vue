<template>
  <ListTemplate
    title="拜访任务单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="客户名称"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="任务类型">
          <el-select v-model="searchForm.taskType" placeholder="请选择" clearable style="width:110px">
            <el-option label="上门拜访" value="上门拜访" />
            <el-option label="电话回访" value="电话回访" />
            <el-option label="视频会议" value="视频会议" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="searchForm.auditStatus" placeholder="请选择" clearable style="width:100px">
            <el-option label="待审核" value="0" />
            <el-option label="审核通过" value="1" />
            <el-option label="已完成" value="2" />
            <el-option label="已驳回" value="3" />
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
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange" @sort-change="handleSortChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="customer_name" label="客户" min-width="150" show-overflow-tooltip sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.customer_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="contact_name" label="联系人" width="90" sortable="custom" />
        <el-table-column prop="contact_phone" label="电话" width="120" sortable="custom" />
        <el-table-column prop="visit_address" label="拜访地址" min-width="160" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.visit_address }">{{ row.visit_address || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="task_type_name" label="任务类型" width="100" sortable="custom" />
        <el-table-column prop="salesman_user_name" label="销售员" width="90" sortable="custom" />
        <el-table-column prop="visit_time" label="拜访时间" width="160" sortable="custom" />
        <el-table-column prop="complete_time" label="完成时间" width="160" sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.complete_time }">{{ row.complete_time || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="audit_status" label="审核状态" width="90" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="auditTagType(row.audit_status)" size="small">{{ row.audit_status_name || auditStatusLabel(row.audit_status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="70" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '正常' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="success" size="small" :disabled="row.audit_status !== 2" @click="handleAudit(row, 1)">通过</el-button>
            <el-button link type="warning" size="small" :disabled="row.audit_status !== 2" @click="handleAudit(row, 3)">驳回</el-button>
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
import { getVisitTaskList, searchVisitTasks, auditVisitTask, deleteVisitTask, type VisitTaskItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<VisitTaskItem[]>([])
const selectedIds = ref<string[]>([])
const searchForm = reactive({ customerName: '', taskType: '', auditStatus: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

function auditStatusLabel(status: number): string {
  const map: Record<number, string> = { 0: '待审核', 1: '审核通过', 2: '已完成', 3: '已驳回' }
  return map[status] || '未知'
}

function auditTagType(status: number): 'success' | 'danger' | 'warning' | 'info' {
  if (status === 1) return 'success'
  if (status === 3) return 'danger'
  if (status === 2) return 'warning'
  return 'info'
}

async function loadData() {
  try {
    let res
    if (searchForm.customerName || searchForm.taskType || searchForm.auditStatus) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.customerName) {
        searchField.push('customer_name')
        searchValue.customer_name = searchForm.customerName
      }
      if (searchForm.taskType) {
        searchField.push('task_type_name')
        searchValue.task_type_name = searchForm.taskType
      }
      if (searchForm.auditStatus) {
        searchField.push('audit_status')
        searchValue.audit_status = Number(searchForm.auditStatus)
      }
      res = await searchVisitTasks({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page
      })
    } else {
      res = await getVisitTaskList({ page: pagination.page })
    }
    tableData.value = res.data.visit_task
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { customerName: '', taskType: '', auditStatus: '' }); handleSearch() }
function handleSelectionChange(val: VisitTaskItem[]) { selectedIds.value = val.map(v => v.visit_task_id) }
function handleAdd() { router.push('/customer/task/visit/add') }
function handleEdit(row: VisitTaskItem) {
  sessionStorage.setItem('editData:customerVisit', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'customerVisit', id: row.visit_task_id, mode: 'edit' } })
}

async function handleAudit(row: VisitTaskItem, status: number) {
  const label = status === 1 ? '通过' : '驳回'
  try {
    await ElMessageBox.confirm(`确认${label}该拜访任务？`, '审核确认', { confirmButtonText: `确认${label}`, type: 'warning' })
    await auditVisitTask({
      visit_task_id: row.visit_task_id,
      audit_status: status,
    })
    ElMessage.success(`${label}成功`)
    loadData()
  } catch {}
}

async function handleDelete(row: VisitTaskItem) {
  try {
    await ElMessageBox.confirm(`确认删除拜访任务单「${row.visit_task_id}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteVisitTask(row.visit_task_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
