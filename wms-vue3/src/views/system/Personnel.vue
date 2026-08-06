<template>
  <ListTemplate
    title="人事资料管理"
    layout-key="personnel"
    show-tree
    :loading="loading"
    :tree-data="orgTree"
    tree-node-key="org_code"
    tree-label-key="name"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @tree-node-click="handleOrgClick"
    @tree-refresh="fetchOrgTree"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="姓名"><el-input v-model="searchForm.user_name" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item label="账号"><el-input v-model="searchForm.login_name" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item label="手机"><el-input v-model="searchForm.mobile" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:90px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
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
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @sort-change="handleSortChange">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="login_name" label="登录账号" min-width="180" show-overflow-tooltip sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.login_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="user_name" label="员工姓名" min-width="100" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="org_name" label="所属组织" min-width="140" show-overflow-tooltip sortable="custom">
          <template #default="{ row }">
            <span :class="{ 'cell-empty': !row.org_name || row.org_name === '0' }">
              {{ (!row.org_name || row.org_name === '0') ? '高级管理员（无组织）' : row.org_name }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="post_name" label="岗位" min-width="120" show-overflow-tooltip sortable="custom">
          <template #default="{ row }">
            <span :class="{ 'cell-empty': !row.post_name || row.post_name === '0' }">
              {{ (!row.post_name || row.post_name === '0') ? '高级管理员（无岗位）' : row.post_name }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="role_name" label="角色" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.role_name }">{{ row.role_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="user_type_label" column-key="user_type" label="用户类型" min-width="100" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.user_type_label }">{{ row.user_type_label || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="mobile" label="手机" width="130" sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.mobile }">{{ row.mobile || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="160" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.email }">{{ row.email || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="200" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="70" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" align="center" fixed="right">
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
                    {{ row.status === 1 ? '禁用' : '启用' }}
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
import { Plus, MoreFilled } from '@element-plus/icons-vue'
import { z } from 'zod'
import { getUserList, searchUsers, deleteUser, updateManagedUser, type UserItem } from '@/api'
import { getOrgTree } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import { useAgentPage } from '@/composables/useAgentPage'
import type { WmsAgentActionDefinition } from '@/agent/types'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'

const router = useRouter()
const loading = ref(false)
const orgTree = ref<any[]>([])
const tableData = ref<UserItem[]>([])

const searchForm = reactive<{
  user_name: string
  login_name: string
  mobile: string
  status: number | ''
  org_id: string
}>({
  user_name: '', login_name: '', mobile: '', status: '', org_id: ''
})

const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
let loadRequestSequence = 0
let inFlightLoad: { key: string; promise: Promise<number> } | undefined
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

async function fetchOrgTree() {
  try {
    const res = await getOrgTree()
    orgTree.value = res.data.org || []
    // 首次加载时取根节点 org_code 作为默认查询条件
    if (!searchForm.org_id && orgTree.value.length > 0) {
      searchForm.org_id = orgTree.value[0].org_code
    }
  } catch {
    orgTree.value = []
  }
}

function getLoadKey(): string {
  return JSON.stringify({ search: searchForm, page: pagination.page, pageSize: pagination.pageSize, sortBy: sortBy.value, sortOrder: sortOrder.value })
}

function loadData(signal?: AbortSignal): Promise<number> {
  const key = getLoadKey()
  if (inFlightLoad?.key === key) return inFlightLoad.promise
  const promise = performLoadData(signal)
  inFlightLoad = { key, promise }
  promise.then(
    () => { if (inFlightLoad?.promise === promise) inFlightLoad = undefined },
    () => { if (inFlightLoad?.promise === promise) inFlightLoad = undefined },
  )
  return promise
}

async function performLoadData(signal?: AbortSignal): Promise<number> {
  const requestSequence = ++loadRequestSequence
  loading.value = true
  try {
  // query 接口要求 org_id 必填，未选择组织时不查询
  if (!searchForm.org_id) {
    tableData.value = []
    pagination.total = 0
    return 0
  }
    // 如果有搜索条件，走 search 接口；否则走 query 接口
    const hasSearch = searchForm.user_name || searchForm.login_name || searchForm.mobile || searchForm.status !== ''
    if (hasSearch) {
      const searchFields: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.user_name) { searchFields.push('user_name'); searchValue['user_name'] = searchForm.user_name }
      if (searchForm.login_name) { searchFields.push('login_name'); searchValue['login_name'] = searchForm.login_name }
      if (searchForm.mobile) { searchFields.push('mobile'); searchValue['mobile'] = searchForm.mobile }
      if (searchForm.status !== '') { searchFields.push('status'); searchValue['status'] = searchForm.status }

      const res = await searchUsers({
        search_field: JSON.stringify(searchFields),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      }, signal ? { signal } : undefined)
      if (requestSequence !== loadRequestSequence) return pagination.total
      tableData.value = res.data.user || []
      pagination.total = res.data.total || 0
    } else {
      const res = await getUserList({
        page: pagination.page,
        page_size: pagination.pageSize,
        org_id: searchForm.org_id,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      }, signal ? { signal } : undefined)
      if (requestSequence !== loadRequestSequence) return pagination.total
      tableData.value = res.data.user || []
      pagination.total = res.data.total || 0
    }
    return pagination.total
  } catch (error) {
    if (signal?.aborted) throw error
    if (requestSequence !== loadRequestSequence) return pagination.total
    tableData.value = []
    pagination.total = 0
    return 0
  } finally {
    if (requestSequence === loadRequestSequence) loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { user_name: '', login_name: '', mobile: '', status: '', org_id: '' })
  handleSearch()
}
function handleOrgClick(data: any) {
  searchForm.org_id = data.org_code || ''
  handleSearch()
}

function handleAdd() { router.push({ path: '/common/add', query: { type: 'personnel' } }) }
function handleEdit(row: UserItem) {
  sessionStorage.setItem('editData:personnel', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'personnel', id: row.user_id, mode: 'edit' } })
}

async function handleToggleStatus(row: UserItem) {
  const newStatus = row.status === 1 ? 0 : 1
  const action = newStatus === 1 ? '启用' : '禁用'
  try {
    await ElMessageBox.confirm(`确认${action}用户 ${row.user_name}？`, '提示')
    await updateManagedUser({ target_user_id: row.user_id, status: newStatus })
    ElMessage.success(`${action}成功`)
    loadData()
  } catch {}
}

async function handleDelete(row: UserItem) {
  try {
    await ElMessageBox.confirm(`确认删除用户 ${row.user_name}？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteUser(row.user_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

function handleRowCommand(command: string, row: UserItem) {
  if (command === 'stop' || command === 'start') handleToggleStatus(row)
}

const employeeSearchSchema = z.object({
  employeeName: z.string().trim().optional(),
  loginName: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  status: z.union([z.literal(0), z.literal(1)]).optional(),
  page: z.number().int().positive().optional(),
})

function markdownCell(value: unknown): string {
  return (String(value ?? '-').trim() || '-').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

const employeeSearchAction = {
  id: 'employee.search',
  title: '查询员工信息',
  description: '按员工姓名、登录账号、手机号和状态查询当前组织范围内的员工。',
  inputSchema: employeeSearchSchema,
  inputGuide: 'employeeName?: string, loginName?: string, mobile?: string, status?: 0|1, page?: positive integer',
  risk: 'read',
  confirmation: 'none',
  execute: async (input, context) => {
    context.signal.throwIfAborted()
    if (!searchForm.org_id) await fetchOrgTree()
    Object.assign(searchForm, {
      user_name: input.employeeName ?? '',
      login_name: input.loginName ?? '',
      mobile: input.mobile ?? '',
      status: input.status ?? '',
    })
    pagination.page = input.page ?? 1
    const total = await loadData(context.signal)
    return { total, visible: tableData.value.length, employees: tableData.value.slice(0, 3) }
  },
  summarizeResult: ({ total, visible, employees }) => [
    `员工查询完成，共 **${total}** 条，当前页显示 **${visible}** 条。`,
    '',
    '| 员工姓名 | 登录账号 | 所属组织 | 岗位 | 状态 |',
    '| --- | --- | --- | --- | --- |',
    ...employees.map((employee) =>
      `| ${markdownCell(employee.user_name)} | ${markdownCell(employee.login_name)} | ${markdownCell(employee.org_name || '高级管理员（无组织）')} | ${markdownCell(employee.post_name || '高级管理员（无岗位）')} | ${employee.status === 1 ? '启用' : '禁用'} |`,
    ),
  ].join('\n'),
} satisfies WmsAgentActionDefinition<
  z.infer<typeof employeeSearchSchema>,
  { total: number; visible: number; employees: UserItem[] }
>

useAgentPage(
  {
    id: 'system.personnel.list',
    title: '人事资料管理',
    routePath: '/system/personnel',
    description: '员工姓名、账号、组织、岗位和状态查询页面。',
    getContext: () => ({
      selectedOrganizationId: searchForm.org_id,
      visibleEmployees: tableData.value.slice(0, 10).map((employee) => ({
        userId: employee.user_id,
        userName: employee.user_name,
        loginName: employee.login_name,
        organizationName: employee.org_name,
        status: employee.status,
      })),
    }),
  },
  [employeeSearchAction],
)

onMounted(async () => { await fetchOrgTree(); loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
