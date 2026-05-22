<template>
  <ListTemplate
    title="二级管理员"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="账号"><el-input v-model="searchForm.account" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="昵称"><el-input v-model="searchForm.nickname" placeholder="请输入" clearable style="width:130px" /></el-form-item>
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
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column prop="account" label="登录账号" width="130" />
        <el-table-column prop="nickname" label="用户昵称" width="120" />
        <el-table-column prop="email" label="电子邮箱" min-width="160">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.email }">{{ row.email || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号码" width="130">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.phone }">{{ row.phone || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="officePhone" label="办公电话" width="120">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.officePhone }">{{ row.officePhone || '-' }}</span></template>
        </el-table-column>
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
            <el-dropdown trigger="click" @command="(cmd: string) => handleRowCommand(cmd, row)">
              <el-button link type="primary" size="small">
                <el-icon :size="14"><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :command="row.status === '正常' ? 'stop' : 'start'">
                    {{ row.status === '正常' ? '停用' : '启用' }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <AdminSelectDialog v-model="selectDialogVisible" @success="loadData" />
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MoreFilled } from '@element-plus/icons-vue'
import { getAdminList, updateAdminStatus, deleteAdmin, type AdminItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import AdminSelectDialog from './components/AdminSelectDialog.vue'

const router = useRouter()
const tableData = ref<AdminItem[]>([])
const selectDialogVisible = ref(false)

const searchForm = reactive({ account: '', nickname: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: AdminItem[] = [
  { id: '1', account: 'admin_wh', nickname: '张仓管', email: 'zhangcg@example.com', phone: '13800001111', officePhone: '027-88001111', status: '正常', createTime: '2023-04-09 10:00', updateTime: '2026-04-23 10:00', createUserId: '1', createUserName: '管理员' },
  { id: '2', account: 'admin_sales', nickname: '李销售', email: 'lixs@example.com', phone: '13800002222', officePhone: '', status: '正常', createTime: '2023-04-09 10:05', updateTime: '2026-04-23 10:05', createUserId: '1', createUserName: '管理员' },
  { id: '3', account: 'admin_purchase', nickname: '王采购', email: '', phone: '13800003333', officePhone: '027-88003333', status: '正常', createTime: '2023-04-09 10:10', updateTime: '2025-10-04 10:10', createUserId: '1', createUserName: '管理员' },
  { id: '4', account: 'admin_finance', nickname: '赵财务', email: 'zhaocw@example.com', phone: '13800004444', officePhone: '', status: '正常', createTime: '2023-04-09 10:15', updateTime: '2025-07-21 10:15', createUserId: '1', createUserName: '管理员' },
  { id: '5', account: 'admin_cs', nickname: '孙客服', email: '', phone: '', officePhone: '', status: '停用', createTime: '2023-04-09 10:20', updateTime: '2024-02-22 10:20', createUserId: '1', createUserName: '管理员' },
]

async function loadData() {
  try {
    const params = { ...searchForm, page: pagination.page, pageSize: pagination.pageSize }
    const res = await getAdminList(params)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { account, nickname, status } = searchForm
    const filtered = fallbackData.filter(r => {
      if (account && !r.account.includes(account)) return false
      if (nickname && !r.nickname.includes(nickname)) return false
      if (status && r.status !== status) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { account: '', nickname: '', status: '' }); handleSearch() }
function handleAdd() { selectDialogVisible.value = true }
function handleEdit(row: AdminItem) {
  sessionStorage.setItem('editData:admin', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'admin', id: row.id, mode: 'edit' } })
}

async function handleToggleStatus(row: AdminItem) {
  const newStatus = row.status === '正常' ? '停用' : '启用'
  try {
    await ElMessageBox.confirm(`确认${newStatus}管理员「${row.nickname}」？`, '提示')
    await updateAdminStatus(row.id, newStatus)
    ElMessage.success(`${newStatus}成功`)
    loadData()
  } catch {}
}

async function handleDelete(row: AdminItem) {
  try {
    await ElMessageBox.confirm(`确认删除管理员「${row.nickname}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteAdmin(row.id)
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
