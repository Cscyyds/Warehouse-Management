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
            :props="{ label: 'name', children: 'children', value: 'org_code' }"
            node-key="org_code"
            placeholder="按组织筛选"
            clearable
            check-strictly
            filterable
            style="width: 180px"
            @change="handleSearch"
          />
          <el-input
            v-model="filterForm.user_name"
            placeholder="按姓名筛选"
            clearable
            style="width: 160px"
            @change="handleSearch"
            @clear="handleSearch"
          />
          <el-input
            v-model="filterForm.mobile"
            placeholder="按手机筛选"
            clearable
            style="width: 160px"
            @change="handleSearch"
            @clear="handleSearch"
          />
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
          class="select-dialog-table"
          ref="tableRef"
          :data="tableData"
          stripe
          size="small"
          style="width:100%"
          height="100%"
          row-class-name="table-row"
          @row-click="handleRowClick"
        >
          <el-table-column type="index" :index="indexMethod" label="" width="55" align="center" />
          <el-table-column prop="login_name" label="登录账号" width="110" show-overflow-tooltip />
          <el-table-column prop="user_name" label="姓名" width="100" show-overflow-tooltip />
          <el-table-column prop="org_name" label="归属机构" min-width="120" show-overflow-tooltip />
          <el-table-column prop="mobile" label="手机号码" width="120">
            <template #default="{ row }">{{ row.mobile || '-' }}</template>
          </el-table-column>
          <el-table-column prop="updated_at" label="更新时间" width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ formatTableDate(row.updated_at) }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="70" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" :width="global_opt_width" align="center" fixed="right">
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
          <li v-for="user in selectedUsers" :key="user.user_id" class="selected-item">
            <span class="selected-name">{{ user.user_name }}（{{ user.login_name }}）</span>
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
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { getPersonnelList, type UserItem } from '@/api'
import { getOrgTree } from '@/api'
import { createAdmin } from '@/api'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'
import { useDialogOpenReload, useRemoteDialogPagination } from '@/composables/useRemoteDialogPagination'

const emit = defineEmits<{ (e: 'success'): void }>()

const visible = defineModel<boolean>({ default: false })
const submitting = ref(false)

const orgTree = ref<any[]>([])

const filterForm = reactive({ orgId: '', user_name: '', mobile: '' })
const searchForm = reactive({ account: '', nickname: '', name: '', phone: '' })
const tableData = ref<UserItem[]>([])
const selectedUsers = ref<UserItem[]>([])
const { loading, pagination, clearPaginationTotal, resetPage, indexMethod, withMinLoading } = useRemoteDialogPagination()

useDialogOpenReload({
  visible: () => visible.value,
  reset: () => {
    selectedUsers.value = []
    Object.assign(searchForm, { account: '', nickname: '', name: '', phone: '' })
    Object.assign(filterForm, { orgId: '', user_name: '', mobile: '' })
    resetPage()
  },
  load: init,
})

async function init() {
  await fetchOrgTree()
  loadData()
}

async function fetchOrgTree() {
  try {
    const res = await getOrgTree()
    orgTree.value = res.data.org || []
    // 首次加载时取根节点 org_code 作为默认查询条件
    if (!filterForm.orgId && orgTree.value.length > 0) {
      filterForm.orgId = orgTree.value[0].org_code
    }
  } catch {
    orgTree.value = []
  }
}

async function loadData() {
  // query 接口要求 org_id 必填，未选择组织时不查询
  if (!filterForm.orgId) {
    tableData.value = []
    clearPaginationTotal()
    return
  }
  try {
    const params = {
      ...searchForm,
      orgId: filterForm.orgId || undefined,
      user_name: filterForm.user_name || undefined,
      mobile: filterForm.mobile || undefined,
      page: pagination.page,
        page_size: pagination.pageSize,
      pageSize: pagination.pageSize,
    }
    const res = await withMinLoading(() => getPersonnelList(params))
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function handleSearch() { resetPage(); loadData() }
function handleReset() {
  Object.assign(searchForm, { account: '', nickname: '', name: '', phone: '' })
  Object.assign(filterForm, { orgId: '', user_name: '', mobile: '' })
  handleSearch()
}

function isSelected(row: UserItem) {
  return selectedUsers.value.some(u => u.user_id === row.user_id)
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
  selectedUsers.value = selectedUsers.value.filter(u => u.user_id !== user.user_id)
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
          login_name: user.login_name,
          user_name: user.user_name,
          email: user.email,
          mobile: user.mobile,
          status: 1,
        } as any)
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
