<template>
  <ListTemplate
    title="二级管理员"
    :loading="loading"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    :show-add="false"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="账号"><el-input v-model="searchForm.login_name" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="searchForm.user_name" placeholder="请输入" clearable style="width:130px" /></el-form-item>
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
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @sort-change="handleSortChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="login_name" label="登录账号" min-width="180" show-overflow-tooltip sortable="custom">
          <template #default="{ row }">
            <span class="cell-link" @click="handleEdit(row)">{{ row.login_name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="user_name" label="姓名" min-width="100" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="org_name" label="所属组织" min-width="140" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.org_name }">{{ row.org_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="role_name" label="角色" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.role_name }">{{ row.role_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="mobile" label="手机号码" width="130" sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.mobile }">{{ row.mobile || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="email" label="电子邮箱" min-width="160" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.email }">{{ row.email || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="70" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <!-- 增删改走旧接口（未在权限字典登记），靠 fail-open 放行、后端接口级权限兜底 -->
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
import { getAdminList, searchAdmins, deleteAdmin, updateAdminStatus, type AdminItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'

const router = useRouter()
const loading = ref(false)
const tableData = ref<AdminItem[]>([])

const searchForm = reactive<{ login_name: string; user_name: string; status: number | '' }>({
  login_name: '', user_name: '', status: ''
})
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

async function loadData() {
  loading.value = true
  try {
    const hasSearch = searchForm.login_name || searchForm.user_name || searchForm.status !== ''
    if (hasSearch) {
      const searchFields: string[] = []
      const searchValue: Record<string, string> = {}
      if (searchForm.login_name) { searchFields.push('login_name'); searchValue.login_name = searchForm.login_name }
      if (searchForm.user_name) { searchFields.push('user_name'); searchValue.user_name = searchForm.user_name }
      if (searchForm.status !== '') { searchFields.push('status'); searchValue.status = String(searchForm.status) }

      const res = await searchAdmins({
        search_field: JSON.stringify(searchFields),
        search_value: JSON.stringify(searchValue),
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
        page: pagination.page,
        page_size: pagination.pageSize,
      })
      tableData.value = res.data.user || []
      pagination.total = res.data.total || 0
    } else {
      const res = await getAdminList({
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
        page: pagination.page,
        page_size: pagination.pageSize,
      })
      tableData.value = res.data.user || []
      pagination.total = res.data.total || 0
    }
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { login_name: '', user_name: '', status: '' })
  handleSearch()
}
function handleEdit(row: AdminItem) {
  sessionStorage.setItem('editData:admin', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'admin', id: row.user_id, mode: 'edit' } })
}

async function handleToggleStatus(row: AdminItem) {
  const newStatus = row.status === 1 ? 0 : 1
  const action = newStatus === 1 ? '启用' : '停用'
  try {
    await ElMessageBox.confirm(`确认${action}管理员「${row.user_name}」？`, '提示')
    await updateAdminStatus(row.user_id, newStatus)
    ElMessage.success(`${action}成功`)
    loadData()
  } catch {}
}

async function handleDelete(row: AdminItem) {
  try {
    await ElMessageBox.confirm(`确认删除管理员「${row.user_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteAdmin(row.user_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

function handleRowCommand(command: string, row: AdminItem) {
  if (command === 'stop' || command === 'start') handleToggleStatus(row)
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
