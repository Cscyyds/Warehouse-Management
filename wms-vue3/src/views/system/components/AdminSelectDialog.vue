<template>
  <el-dialog
    v-model="visible"
    title="用户选择"
    width="1300px"
    :close-on-click-modal="false"
    destroy-on-close
    class="admin-select-dialog"
  >
    <div class="dialog-body">
      <!-- 主区域 -->
      <div class="main-panel">
        <!-- 筛选下拉行 -->
        <div class="filter-bar">
          <el-tree-select
            v-model="filterForm.orgId"
            :data="orgTree"
            :props="{ label: 'name', children: 'children', value: 'id' }"
            node-key="id"
            placeholder="按组织筛选"
            clearable
            check-strictly
            filterable
            style="width: 180px"
            @change="handleSearch"
          />
          <el-select
            v-model="filterForm.positionId"
            placeholder="按岗位筛选"
            clearable
            filterable
            style="width: 160px"
            @change="handleSearch"
          >
            <el-option v-for="p in positionList" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
          <el-select
            v-model="filterForm.roleId"
            placeholder="按角色筛选"
            clearable
            filterable
            style="width: 160px"
            @change="handleSearch"
          >
            <el-option v-for="r in roleList" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </div>

        <!-- 关键字搜索行 -->
        <el-form :model="searchForm" inline size="small" class="search-bar">
          <el-form-item label="账号">
            <el-input v-model="searchForm.account" placeholder="请输入" clearable style="width:100px" />
          </el-form-item>
          <el-form-item label="昵称">
            <el-input v-model="searchForm.nickname" placeholder="请输入" clearable style="width:100px" />
          </el-form-item>
          <el-form-item label="姓名">
            <el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:100px" />
          </el-form-item>
          <el-form-item label="手机">
            <el-input v-model="searchForm.phone" placeholder="请输入" clearable style="width:110px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>

        <el-table
          ref="tableRef"
          :data="tableData"
          stripe
          size="small"
          style="width:100%"
          height="360"
          row-class-name="table-row"
          @row-click="handleRowClick"
        >
          <el-table-column type="index" label="序号" width="55" align="center" />
          <el-table-column prop="account" label="登录账号" width="110" />
          <el-table-column prop="nickname" label="用户昵称" width="100" />
          <el-table-column prop="name" label="员工姓名" width="100" />
          <el-table-column prop="orgName" label="归属机构" min-width="120" show-overflow-tooltip />
          <el-table-column prop="companyName" label="归属公司" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ row.companyName || '-' }}</template>
          </el-table-column>
          <el-table-column prop="phone" label="手机号码" width="120">
            <template #default="{ row }">{{ row.phone || '-' }}</template>
          </el-table-column>
          <el-table-column prop="updateTime" label="更新时间" width="150" />
          <el-table-column prop="status" label="状态" width="70" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === '正常' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="60" align="center" fixed="right">
            <template #default="{ row }">
              <el-button
                link
                :type="isSelected(row) ? 'danger' : 'primary'"
                size="small"
                @click.stop="toggleSelect(row)"
              >{{ isSelected(row) ? '取消' : '选择' }}</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-bar">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            small
            @change="loadData"
          />
        </div>
      </div>

      <!-- 右侧已选面板 -->
      <div class="right-panel">
        <div class="right-title">当前已选择 {{ selectedUsers.length }} 项：</div>
        <ul class="selected-list">
          <li v-for="user in selectedUsers" :key="user.id" class="selected-item">
            <span class="selected-name">{{ user.nickname }}（{{ user.account }}）</span>
            <el-icon class="remove-btn" @click="removeSelected(user)"><Close /></el-icon>
          </li>
          <li v-if="selectedUsers.length === 0" class="empty-tip">暂未选择</li>
        </ul>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button type="primary" :loading="submitting" @click="handleConfirm">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { getPersonnelList, type UserItem } from '@/api'
import { getOrgTree } from '@/api'
import { getRoleAll, type RoleItem } from '@/api'
import { getPositionList, type PositionItem } from '@/api'
import { createAdmin } from '@/api'

const emit = defineEmits<{ (e: 'success'): void }>()

const visible = defineModel<boolean>({ default: false })
const submitting = ref(false)

const orgTree = ref<any[]>([])
const roleList = ref<RoleItem[]>([])
const positionList = ref<PositionItem[]>([])

const filterForm = reactive({ orgId: '', positionId: '', roleId: '' })
const searchForm = reactive({ account: '', nickname: '', name: '', phone: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const tableData = ref<UserItem[]>([])
const selectedUsers = ref<UserItem[]>([])

const fallbackData: UserItem[] = [
  { id: '1', account: '1002', nickname: '肖伟', name: '肖伟', orgId: '0', orgName: '总经办', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 10:33', updateTime: '2026-04-23 10:33', createUserId: '1', createUserName: '管理员' },
  { id: '2', account: 'wangqf', nickname: '王琪锋', name: '王琪锋', orgId: '4-2', orgName: '售后部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 09:26', updateTime: '2026-04-23 09:26', createUserId: '1', createUserName: '管理员' },
  { id: '3', account: 'lixd', nickname: '李晓东', name: '李晓东', orgId: '4-2', orgName: '售后部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '18588694560', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 09:25', updateTime: '2026-04-23 09:25', createUserId: '1', createUserName: '管理员' },
  { id: '4', account: 'yuhj', nickname: '余辉建', name: '余辉建', orgId: '4-2', orgName: '售后部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '15623279212', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 09:23', updateTime: '2026-04-23 09:23', createUserId: '1', createUserName: '管理员' },
  { id: '5', account: '1021', nickname: '优优', name: '李菲', orgId: '4-1', orgName: '采购部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '17671632618', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 10:06', updateTime: '2025-10-04 10:06', createUserId: '1', createUserName: '管理员' },
]

async function init() {
  await Promise.all([fetchOrgTree(), fetchRoles(), fetchPositions()])
  loadData()
}

async function fetchOrgTree() {
  try {
    const res = await getOrgTree()
    orgTree.value = res.data.tree
  } catch {
    orgTree.value = [{ id: 'root', name: '百诺全屋五金配套服务商', children: [{ id: '0', name: '总经办', children: [{ id: '1', name: '销售部' }, { id: '2', name: '仓储物流部' }, { id: '3', name: '客服部' }, { id: '4', name: '产品部', children: [{ id: '4-1', name: '采购部' }, { id: '4-2', name: '售后部' }] }, { id: '5', name: '行政部' }, { id: '6', name: '财务部' }] }] }]
  }
}

async function fetchRoles() {
  try {
    const res = await getRoleAll()
    roleList.value = res.data
  } catch {
    roleList.value = [
      { id: '1', code: 'ROLE_ADMIN', name: '系统管理员', roleType: '管理员', sort: 1, isSystem: true, userType: '管理员', dataScope: '全部', businessScope: '全部', status: '正常', remark: '', createTime: '', updateTime: '', createUserId: '', createUserName: '' },
      { id: '2', code: 'ROLE_WAREHOUSE', name: '仓库管理员', roleType: '员工', sort: 2, isSystem: false, userType: '员工', dataScope: '本部门', businessScope: '仓储', status: '正常', remark: '', createTime: '', updateTime: '', createUserId: '', createUserName: '' },
    ]
  }
}

async function fetchPositions() {
  try {
    const res = await getPositionList({ page: 1, pageSize: 999 })
    positionList.value = res.data.list
  } catch {
    positionList.value = []
  }
}

async function loadData() {
  try {
    const params = {
      ...searchForm,
      orgId: filterForm.orgId || undefined,
      positionId: filterForm.positionId || undefined,
      roleId: filterForm.roleId || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    }
    const res = await getPersonnelList(params)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { account, nickname, name, phone } = searchForm
    const { orgId, roleId } = filterForm
    const filtered = fallbackData.filter(u => {
      if (account && !u.account.includes(account)) return false
      if (nickname && !u.nickname.includes(nickname)) return false
      if (name && !u.name.includes(name)) return false
      if (phone && !u.phone.includes(phone)) return false
      if (orgId && u.orgId !== orgId) return false
      if (roleId && u.roleId !== roleId) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { account: '', nickname: '', name: '', phone: '' })
  Object.assign(filterForm, { orgId: '', positionId: '', roleId: '' })
  handleSearch()
}

function isSelected(row: UserItem) {
  return selectedUsers.value.some(u => u.id === row.id)
}

function toggleSelect(row: UserItem) {
  if (isSelected(row)) {
    removeSelected(row)
  } else {
    selectedUsers.value.push(row)
  }
}

function handleRowClick(row: UserItem) {
  toggleSelect(row)
}

function removeSelected(user: UserItem) {
  selectedUsers.value = selectedUsers.value.filter(u => u.id !== user.id)
}

async function handleConfirm() {
  if (selectedUsers.value.length === 0) {
    ElMessage.warning('请至少选择一名用户')
    return
  }
  submitting.value = true
  try {
    // 前端循环调用，后端批量接口就绪后替换为 batchCreateAdmin(selectedUsers.value.map(...))
    const results = await Promise.allSettled(
      selectedUsers.value.map(user =>
        createAdmin({
          account: user.account,
          nickname: user.nickname,
          email: user.email,
          phone: user.phone,
          officePhone: user.officePhone,
          status: '正常',
        })
      )
    )
    const failed = results.filter(r => r.status === 'rejected').length
    if (failed === 0) {
      ElMessage.success(`成功添加 ${selectedUsers.value.length} 名二级管理员`)
    } else {
      ElMessage.warning(`共 ${selectedUsers.value.length} 条，${failed} 条失败`)
    }
    emit('success')
    handleClose()
  } finally {
    submitting.value = false
  }
}

function handleClose() {
  visible.value = false
}

watch(visible, (val) => {
  if (val) {
    selectedUsers.value = []
    Object.assign(searchForm, { account: '', nickname: '', name: '', phone: '' })
    Object.assign(filterForm, { orgId: '', positionId: '', roleId: '' })
    pagination.page = 1
    init()
  }
})
</script>

<style scoped>
.dialog-body {
  display: flex;
  gap: 0;
  height: 640px;
  overflow: hidden;
}

.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 12px;
  overflow: hidden;
  min-width: 0;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}

.search-bar {
  flex-shrink: 0;
  padding: 8px 0 4px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 8px;
}
.search-bar :deep(.el-form-item) { margin-bottom: 6px; margin-right: 8px; }

.pagination-bar {
  flex-shrink: 0;
  padding: 8px 0 0;
  display: flex;
  justify-content: flex-end;
}

.right-panel {
  flex-shrink: 0;
  width: 180px;
  border-left: 1px solid var(--el-border-color-light);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.right-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
  flex-shrink: 0;
}

.selected-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.selected-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 4px;
  border-radius: 4px;
  font-size: 12px;
}
.selected-item:hover { background: var(--el-fill-color-light); }

.selected-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-regular);
}

.remove-btn {
  flex-shrink: 0;
  cursor: pointer;
  color: var(--el-text-color-placeholder);
  margin-left: 4px;
}
.remove-btn:hover { color: var(--el-color-danger); }

.empty-tip {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  text-align: center;
  padding: 20px 0;
}
</style>
