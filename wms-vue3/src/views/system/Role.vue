<template>
  <ListTemplate
    title="角色管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="角色名称"><el-input v-model="searchForm.role_name" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="角色编码"><el-input v-model="searchForm.role_code" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:90px">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="role_name" label="角色名称" min-width="120" />
        <el-table-column prop="role_code" label="角色编码" width="160" />
        <el-table-column prop="role_type_label" label="角色类型" width="100" align="center" />
        <el-table-column prop="sort_no" label="排序号" width="80" align="center" />
        <el-table-column prop="is_system" label="系统角色" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_system === 1 ? 'danger' : 'info'" size="small">{{ row.is_system === 1 ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注信息" min-width="140" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            <el-dropdown trigger="click" @command="(cmd: string) => handleRowCommand(cmd, row)">
              <el-button link type="primary" size="small">
                <el-icon :size="14"><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :command="row.status === 1 ? 'stop' : 'start'">
                    {{ row.status === 1 ? '停用' : '启用' }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
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
import { MoreFilled } from '@element-plus/icons-vue'
import { getRoleList, searchRoles, deleteRole, updateRoleStatus, type RoleItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<RoleItem[]>([])

const searchForm = reactive({ role_name: '', role_code: '', status: '' as number | string })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

async function loadData() {
  const hasSearch = searchForm.role_name || searchForm.role_code || searchForm.status !== ''
  if (hasSearch) {
    const searchFields: string[] = []
    const searchValue: Record<string, string> = {}
    if (searchForm.role_name) { searchFields.push('role_name'); searchValue.role_name = searchForm.role_name }
    if (searchForm.role_code) { searchFields.push('role_code'); searchValue.role_code = searchForm.role_code }
    if (searchForm.status !== '') { searchFields.push('status'); searchValue.status = String(searchForm.status) }
    const res = await searchRoles({
      search_field: JSON.stringify(searchFields),
      search_value: JSON.stringify(searchValue),
      page: pagination.page,
    })
    tableData.value = res.data.role || []
    pagination.total = res.data.total || 0
  } else {
    const res = await getRoleList({ page: pagination.page })
    tableData.value = res.data.role || []
    pagination.total = res.data.total || 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { role_name: '', role_code: '', status: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'role' } }) }
function handleEdit(row: RoleItem) {
  sessionStorage.setItem('editData:role', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'role', id: row.role_code, mode: 'edit' } })
}

async function handleToggleStatus(row: RoleItem) {
  const newStatus = row.status === 1 ? 0 : 1
  const actionText = newStatus === 1 ? '启用' : '停用'
  try {
    await ElMessageBox.confirm(`确认${actionText}角色「${row.role_name}」？`, '提示')
    await updateRoleStatus(row.role_code, newStatus)
    ElMessage.success(`${actionText}成功`)
    loadData()
  } catch {}
}

async function handleDelete(row: RoleItem) {
  try {
    await ElMessageBox.confirm(`确认删除角色「${row.role_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteRole(row.role_code)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

function handleRowCommand(command: string, row: RoleItem) {
  if (command === 'stop' || command === 'start') handleToggleStatus(row)
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
