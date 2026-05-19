<template>
  <ListTemplate
    title="用户管理"
    show-tree
    show-import
    show-export
    :tree-data="orgTree"
    :import-columns="importColumns"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="用户列表"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @tree-node-click="handleOrgClick"
    @tree-refresh="fetchOrgTree"
    @page-change="loadData"
    @add="handleAdd"
    @import="handleImport"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="账号"><el-input v-model="searchForm.account" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item label="昵称"><el-input v-model="searchForm.nickname" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item label="手机"><el-input v-model="searchForm.phone" placeholder="请输入" clearable style="width:130px" /></el-form-item>
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
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column prop="account" label="登录账号" width="110" />
        <el-table-column prop="nickname" label="用户昵称" width="110" />
        <el-table-column prop="name" label="员工姓名" width="110" />
        <el-table-column prop="orgName" label="归属机构" width="140" show-overflow-tooltip />
        <el-table-column prop="companyName" label="公司" width="110">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.companyName }">{{ row.companyName || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" width="150">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.email }">{{ row.email || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="phone" label="手机" width="130">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.phone }">{{ row.phone || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="officePhone" label="办公电话" width="110">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.officePhone }">{{ row.officePhone || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="updateTime" label="更新时间" width="150" />
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
                  <el-dropdown-item command="view">详情</el-dropdown-item>
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
import { Plus, MoreFilled } from '@element-plus/icons-vue'
import { getPersonnelList, updateUserStatus, deletePersonnel, type UserItem } from '@/api'
import { getOrgTree } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const orgTree = ref<any[]>([])
const tableData = ref<UserItem[]>([])
const selectedIds = ref<string[]>([])

const searchForm = reactive({
  account: '', nickname: '', name: '', phone: '', status: '', orgId: ''
})

const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackPersonnelData: UserItem[] = [
  { id: '1', account: '1002', nickname: '肖伟', name: '肖伟', orgId: '0', orgName: '总经办', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 10:33', updateTime: '2026-04-23 10:33', createUserId: '1', createUserName: '管理员' },
  { id: '2', account: 'wangqf', nickname: '王琪锋', name: '王琪锋', orgId: '4-2', orgName: '售后部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 09:26', updateTime: '2026-04-23 09:26', createUserId: '1', createUserName: '管理员' },
  { id: '3', account: 'lixd', nickname: '李晓东', name: '李晓东', orgId: '4-2', orgName: '售后部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '18588694560', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 09:25', updateTime: '2026-04-23 09:25', createUserId: '1', createUserName: '管理员' },
  { id: '4', account: 'yuhj', nickname: '余辉建', name: '余辉建', orgId: '4-2', orgName: '售后部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '15623279212', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 09:23', updateTime: '2026-04-23 09:23', createUserId: '1', createUserName: '管理员' },
  { id: '5', account: '1021', nickname: '优优', name: '李菲', orgId: '4-1', orgName: '采购部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '17671632618', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 10:06', updateTime: '2025-10-04 10:06', createUserId: '1', createUserName: '管理员' },
]

async function fetchOrgTree() {
  try {
    const res = await getOrgTree()
    orgTree.value = res.data.tree
  } catch {
    orgTree.value = [
      { id: 'root', name: '百诺全屋五金配套服务商', children: [
        { id: '0', name: '总经办', children: [
          { id: '1', name: '销售部' },
          { id: '2', name: '仓储物流部' },
          { id: '3', name: '客服部' },
          { id: '4', name: '产品部', children: [
            { id: '4-1', name: '采购部' },
            { id: '4-2', name: '售后部' }
          ]},
          { id: '5', name: '行政部' },
          { id: '6', name: '财务部' }
        ]}
      ]}
    ]
  }
}

async function loadData() {
  try {
    const params = { ...searchForm, page: pagination.page, pageSize: pagination.pageSize }
    const res = await getPersonnelList(params as any)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const allData = fallbackPersonnelData
    const { account, nickname, name, phone, status, orgId } = searchForm
    const filtered = allData.filter(u => {
      if (account && !u.account.includes(account)) return false
      if (nickname && !u.nickname.includes(nickname)) return false
      if (name && !u.name.includes(name)) return false
      if (phone && !u.phone.includes(phone)) return false
      if (status && u.status !== status) return false
      if (orgId && u.orgId !== orgId) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { account: '', nickname: '', name: '', phone: '', status: '', orgId: '' }); handleSearch() }
function handleOrgClick(data: any) { searchForm.orgId = data.id === 'root' ? '' : data.id; handleSearch() }
function handleSelectionChange(val: UserItem[]) { selectedIds.value = val.map(v => v.id) }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'personnel' } }) }
function handleEdit(row: UserItem) {
  sessionStorage.setItem('editData:personnel', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'personnel', id: row.id, mode: 'edit' } })
}

async function handleStop(row: UserItem) {
  const newStatus = row.status === '正常' ? '停用' : '启用'
  try {
    await ElMessageBox.confirm(`确认${newStatus}用户 ${row.nickname}？`, '提示')
    await updateUserStatus(row.id, newStatus)
    ElMessage.success(`${newStatus}成功`)
    loadData()
  } catch {}
}

async function handleDelete(row: UserItem) {
  try {
    await ElMessageBox.confirm(`确认删除用户 ${row.nickname}？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deletePersonnel(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

function handleRowCommand(command: string, row: UserItem) {
  if (command === 'stop' || command === 'start') handleStop(row)
  else if (command === 'view') ElMessage.info(`查看详情: ${row.nickname}`)
}

const importColumns = [
  { key: 'account', label: '登录账号' },
  { key: 'nickname', label: '用户昵称' },
  { key: 'name', label: '员工姓名' },
  { key: 'phone', label: '手机' },
  { key: 'email', label: '邮箱' },
  { key: 'orgName', label: '归属机构' },
  { key: 'status', label: '状态' },
]

const exportColumns = [
  { key: 'account', label: '登录账号' },
  { key: 'nickname', label: '用户昵称' },
  { key: 'name', label: '员工姓名' },
  { key: 'orgName', label: '归属机构' },
  { key: 'companyName', label: '公司' },
  { key: 'email', label: '邮箱' },
  { key: 'phone', label: '手机' },
  { key: 'officePhone', label: '办公电话' },
  { key: 'status', label: '状态' },
  { key: 'updateTime', label: '更新时间' },
]

function handleImport(data: any[]) {
  // TODO: 调用后端导入接口
  ElMessage.success(`已解析 ${data.length} 条数据，请对接后端接口`)
  console.log('导入数据:', data)
}

onMounted(() => { fetchOrgTree(); loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
