<template>
  <div class="personnel-page">
    <div class="org-tree-panel">
      <div class="org-header">
        <span class="org-title">组织机构</span>
        <div class="org-actions">
          <el-tooltip content="刷新"><el-icon :size="16" class="action-icon"><Refresh /></el-icon></el-tooltip>
        </div>
      </div>
      <div class="org-tree-container">
        <el-tree
          ref="treeRef"
          :data="orgTree"
          :props="{ label: 'name', children: 'children' }"
          node-key="id"
          default-expand-all
          highlight-current
          @node-click="handleOrgClick"
        >
          <template #default="{ node, data }">
            <span class="tree-node">
              <el-icon v-if="data.children && data.children.length" :size="16" class="tree-folder-icon">
                <FolderOpened v-if="node.expanded" />
                <Folder v-else />
              </el-icon>
              <el-icon v-else :size="16" class="tree-leaf-icon"><Document /></el-icon>
              <span class="tree-label">{{ data.name }}</span>
            </span>
          </template>
        </el-tree>
      </div>
    </div>
    <div class="user-panel">
      <div class="panel-header">
        <h3>用户管理</h3>
      </div>
      <div class="toolbar-row">
        <div class="toolbar-search">
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
        </div>
        <div class="toolbar-actions">
          <el-button text><el-icon><Download /></el-icon>导出</el-button>
          <el-button text><el-icon><Upload /></el-icon>导入</el-button>
          <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
        </div>
      </div>
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
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, FolderOpened, Folder, Document, Download, Upload, Plus, MoreFilled } from '@element-plus/icons-vue'
import { getPersonnelList, updateUserStatus, deletePersonnel, type UserItem } from '@/api'
import { getOrgTree } from '@/api'

const router = useRouter()
const treeRef = ref()
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
    { id: '6', account: '1028', nickname: '萧萧', name: '小白', orgId: '4-1', orgName: '采购部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 09:44', updateTime: '2025-10-04 09:44', createUserId: '1', createUserName: '管理员' },
    { id: '7', account: '1029', nickname: '米米', name: '吴天真', orgId: '4-2', orgName: '售后部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 08:06', updateTime: '2025-10-04 08:06', createUserId: '1', createUserName: '管理员' },
    { id: '8', account: '1032', nickname: '玲玲', name: '朝爱玲', orgId: '4-2', orgName: '售后部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 11:53', updateTime: '2025-07-21 11:53', createUserId: '1', createUserName: '管理员' },
    { id: '9', account: '1055', nickname: '李泽民', name: '李泽民', orgId: '4-2', orgName: '售后部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '960067208@qq.com', phone: '18163367025', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 11:49', updateTime: '2025-07-21 11:49', createUserId: '1', createUserName: '管理员' },
    { id: '10', account: '1015', nickname: '蔡锋', name: '蔡锋', orgId: '4-2', orgName: '售后部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 11:45', updateTime: '2025-07-21 11:45', createUserId: '1', createUserName: '管理员' },
    { id: '11', account: '1022', nickname: '新兵', name: '邵新兵', orgId: '4-2', orgName: '售后部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '15102794280', officePhone: '15102794280', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 08:07', updateTime: '2024-07-08 08:07', createUserId: '1', createUserName: '管理员' },
    { id: '12', account: 'xuwei', nickname: '徐伟', name: '徐伟', orgId: '4-2', orgName: '售后部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '15168775118', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 09:45', updateTime: '2024-02-22 09:45', createUserId: '1', createUserName: '管理员' },
    { id: '13', account: '1014', nickname: '田康', name: '田康', orgId: '4-1', orgName: '采购部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 14:24', updateTime: '2023-09-16 14:24', createUserId: '1', createUserName: '管理员' },
    { id: '14', account: '1005', nickname: '吴细兰', name: '采购', orgId: '6', orgName: '财务部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 09:31', updateTime: '2023-07-01 09:31', createUserId: '1', createUserName: '管理员' },
    { id: '15', account: '1011', nickname: '仓库主管', name: '陈祖伟', orgId: '4-1', orgName: '采购部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 11:05', updateTime: '2023-04-09 11:05', createUserId: '1', createUserName: '管理员' },
    { id: '16', account: '1020', nickname: '段盛强', name: '段盛强', orgId: '4-1', orgName: '采购部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 11:01', updateTime: '2023-04-09 11:01', createUserId: '1', createUserName: '管理员' },
    { id: '17', account: '1101', nickname: '客服', name: '客服', orgId: '3', orgName: '客服部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '', officePhone: '', sort: 0, status: '停用', lastLoginIp: '', createTime: '2023-04-09 10:57', updateTime: '2023-04-09 10:57', createUserId: '1', createUserName: '管理员' },
    { id: '18', account: '1001', nickname: '管理员', name: '管理员', orgId: '0', orgName: '总经办', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 10:55', updateTime: '2023-04-09 10:55', createUserId: '1', createUserName: '管理员' },
    { id: '19', account: '1003', nickname: '张三', name: '张三', orgId: '2', orgName: '仓储物流部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '13800138000', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 10:50', updateTime: '2023-04-09 10:50', createUserId: '1', createUserName: '管理员' },
    { id: '20', account: '1004', nickname: '李四', name: '李四', orgId: '1', orgName: '销售部', companyId: '1', companyName: '', positionId: '', roleId: '', email: '', phone: '', officePhone: '', sort: 0, status: '正常', lastLoginIp: '', createTime: '2023-04-09 10:45', updateTime: '2023-04-09 10:45', createUserId: '1', createUserName: '管理员' }
  ]

function getFallbackPersonnelData(): UserItem[] {
  return fallbackPersonnelData
}

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
    const allData = getFallbackPersonnelData()
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
function handleReset() { Object.assign(searchForm, { account: '', nickname: '', name: '', phone: '', status: '', orgId: '' }); treeRef.value?.setCurrentKey(null); handleSearch() }
function handleOrgClick(data: any) { searchForm.orgId = data.id === 'root' ? '' : data.id; handleSearch() }
function handleSelectionChange(val: UserItem[]) { selectedIds.value = val.map(v => v.id) }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'personnel' } }) }
function handleEdit(row: UserItem) { router.push({ path: '/common/add', query: { type: 'personnel', id: row.id, mode: 'edit' } }) }
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
function handleView(row: UserItem) { ElMessage.info(`查看详情: ${row.nickname}`) }

function handleRowCommand(command: string, row: UserItem) {
  if (command === 'stop' || command === 'start') handleStop(row)
  else if (command === 'view') handleView(row)
}

onMounted(() => { fetchOrgTree(); loadData() })
</script>

<style scoped>
.personnel-page { display: flex; gap: 16px; height: 100%; padding: 4px; background: var(--bg-page); border-radius: var(--radius-lg); }

/* ── 组织机构面板 ── */
.org-tree-panel { width: 260px; background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden; }
.org-header { padding: 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); }
.org-title { font-weight: 600; color: var(--text-primary); }
.org-tree-container { flex: 1; overflow-y: auto; padding: 8px 0; }
.tree-node { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.tree-label { font-size: 13px; }
.tree-folder-icon { color: var(--text-tertiary); transition: color 0.2s; }
.tree-leaf-icon { color: var(--text-tertiary); transition: color 0.2s; }
.tree-node:hover .tree-folder-icon,
.tree-node:hover .tree-leaf-icon { color: var(--primary); }

/* ── 用户面板 ── */
.user-panel { flex: 1; background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; padding: 16px; overflow: hidden; }

/* ── 标题 ── */
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.panel-header h3 { font-size: 16px; font-weight: 600; color: var(--text-primary); }

/* ── 工具栏: 左搜索 + 右操作 ── */
.toolbar-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
.toolbar-search { flex: 1; min-width: 0; }
.toolbar-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; margin-left: 16px; padding-top: 2px; }
.toolbar-search :deep(.el-form-item) { margin-bottom: 0; margin-right: 10px; }
.toolbar-search :deep(.el-form-item:last-child) { margin-right: 0; }
.toolbar-search :deep(.el-form-item__label) { font-size: 13px; padding-right: 6px; }

/* ── 表格 ── */
.personnel-page :deep(.el-table) { --el-table-border-color: transparent; }
.personnel-page :deep(.el-table th.el-table__cell) { background: var(--bg-page); color: var(--text-primary); font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--border-color); }
.personnel-page :deep(.el-table td.el-table__cell) { border-bottom: 1px solid var(--border-light); }
.personnel-page :deep(.el-table .table-row:hover > td.el-table__cell) { background-color: var(--bg-hover); }
.personnel-page :deep(.el-table__body tr.el-table__row--striped td.el-table__cell) { background: var(--bg-page); }
.cell-empty { color: var(--text-tertiary); }

/* ── 操作列 ── */
.personnel-page :deep(.el-button--small) { font-size: 13px; }
</style>
