<template>
  <ListTemplate
    title="角色管理"
    :loading="loading"
    :show-add="showAdd"
    :perm-endpoints="{ add: 'POST /api/v1/tenant-roles' }"
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
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @sort-change="handleSortChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="role_name" label="角色名称" min-width="120" sortable="custom">
          <template #default="{ row }">
            <span v-perm="'GET /api/v1/tenant-roles/detail'" class="cell-link" @click="handleEdit(row)">{{ row.role_name }}</span>
          </template>
        </el-table-column>
        <!-- 角色编码（role_code）为内部系统编码，不面向用户展示：见 Organization.vue 机构编码同款处理 -->
        <!-- <el-table-column prop="role_code" label="角色编码" width="160" sortable="custom" show-overflow-tooltip /> -->
        <el-table-column prop="role_type_label" column-key="role_type" label="角色类型" width="100" align="center" sortable="custom" show-overflow-tooltip />
        <el-table-column prop="sort_no" label="排序号" min-width="90" align="center" sortable="custom" show-overflow-tooltip />
        <el-table-column prop="is_system" label="系统角色" width="90" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="isSystemRole(row) ? 'danger' : 'info'" size="small">{{ isSystemRole(row) ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注信息" min-width="140" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="70" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <!-- 系统角色（is_system=1）租客侧只读：编辑/删除/启停均置灰，点击角色名可查看详情 -->
            <el-tooltip :disabled="!isSystemRole(row)" content="系统角色不支持修改，仅支持查看详情" placement="top">
              <el-button v-perm="'POST /api/v1/tenant-roles/update'" link type="primary" size="small" :disabled="isSystemRole(row)" @click="handleEdit(row)">编辑</el-button>
            </el-tooltip>
            <el-tooltip :disabled="!isSystemRole(row)" content="系统角色不支持删除，仅支持查看详情" placement="top">
              <el-button v-perm="'POST /api/v1/tenant-roles/delete'" link type="danger" size="small" :disabled="isSystemRole(row)" @click="handleDelete(row)">删除</el-button>
            </el-tooltip>
            <el-tooltip :disabled="!isSystemRole(row)" content="系统角色不支持启停，仅支持查看详情" placement="top">
              <el-dropdown trigger="click" :disabled="isSystemRole(row)" @command="(cmd: string) => handleRowCommand(cmd, row)">
                <el-button link type="primary" size="small" :disabled="isSystemRole(row)">
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
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { global_opt_width } from '@/utils/data'
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MoreFilled } from '@element-plus/icons-vue'
import { getRoleList, searchRoles, deleteRole, updateRoleStatus, type RoleItem } from '@/api'
import { usePermissionStore } from '@/stores/permission'
import { useUserStore } from '@/stores/user'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const tableData = ref<RoleItem[]>([])

// 新增角色仅管理员可见：进入页面即拉取自身信息（幂等，会话内只发一次）。
// 判定未完成（profileLoaded=false）时先放行，避免管理员的按钮闪烁；
// 判定完成：管理员显示，普通主管/员工隐藏（后端接口级权限仍兜底）
userStore.loadProfile()
const showAdd = computed(() => userStore.isAdmin || !userStore.profileLoaded)

const searchForm = reactive({ role_name: '', role_code: '', status: '' as number | string })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

async function loadData() {
  loading.value = true
  try {
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
        page_size: pagination.pageSize,
      sort_by: sortBy.value || undefined,
      sort_order: sortOrder.value || undefined,
    })
    tableData.value = res.data.role || []
    pagination.total = res.data.total || 0
  } else {
    const res = await getRoleList({ page: pagination.page, page_size: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined })
    tableData.value = res.data.role || []
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
function handleReset() { Object.assign(searchForm, { role_name: '', role_code: '', status: '' }); handleSearch() }
function handleAdd() {
  // 清掉编辑入口写入的行缓存：避免「先点编辑、再点新增」时新增页读到上一次的角色数据
  // （角色类型下拉的存量回显依赖该缓存判断，残留会让新增页多出「管理员」选项）
  sessionStorage.removeItem('editData:role')
  router.push({ path: '/common/add', query: { type: 'role' } })
}

/** 系统角色判定：后端 is_system=1 的角色租客侧不可修改/删除（接口返回 403） */
function isSystemRole(row: RoleItem): boolean {
  return Number((row as any)?.is_system) === 1
}

function handleEdit(row: RoleItem) {
  sessionStorage.setItem('editData:role', JSON.stringify(row))
  // 系统角色不支持编辑，但允许查看详情：以只读态复用编辑页渲染（表单全部禁用、隐藏保存按钮）
  if (isSystemRole(row)) {
    router.push({ path: '/common/add', query: { type: 'role', id: row.role_code, mode: 'edit', readonly: '1' } })
    return
  }
  router.push({ path: '/common/add', query: { type: 'role', id: row.role_code, mode: 'edit' } })
}

async function handleToggleStatus(row: RoleItem) {
  // 兜底：系统角色启停走的是角色更新接口，后端会 403，前端直接拦截避免报错弹窗
  if (isSystemRole(row)) { ElMessage.warning('系统角色不支持启停，仅支持查看详情'); return }
  const newStatus = row.status === 1 ? 0 : 1
  const actionText = newStatus === 1 ? '启用' : '停用'
  try {
    await ElMessageBox.confirm(`确认${actionText}角色「${row.role_name}」？`, '提示')
    await updateRoleStatus(row.role_code, newStatus)
    ElMessage.success(`${actionText}成功`)
    // 停用/启用可能涉及登录人自身角色：刷新权限集合，保证守卫/菜单与后端一致
    await usePermissionStore().load(true)
    loadData()
  } catch {}
}

async function handleDelete(row: RoleItem) {
  // 兜底：系统角色删除按钮已置灰，此处防止其它入口（如后续新增的批量删除）误触发
  if (isSystemRole(row)) { ElMessage.warning('系统角色不支持删除，仅支持查看详情'); return }
  try {
    await ElMessageBox.confirm(`确认删除角色「${row.role_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteRole(row.role_code)
    ElMessage.success('删除成功')
    // 删除可能涉及登录人自身角色：刷新权限集合，保证守卫/菜单与后端一致
    await usePermissionStore().load(true)
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
