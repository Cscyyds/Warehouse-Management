<template>
  <el-dialog
    title="员工选择"
    :model-value="modelValue"
    width="960px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div class="select-layout">
      <div class="left-panel">
        <div class="filter-bar">
          <el-tree-select
            v-model="filter.orgId"
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
          <el-select
            v-model="filter.postCode"
            placeholder="按岗位筛选"
            clearable
            filterable
            style="width: 160px"
            @change="handleSearch"
          >
            <el-option v-for="p in postList" :key="p.post_code" :label="p.post_name" :value="p.post_code" />
          </el-select>
        </div>
        <el-form :model="filter" inline size="small" class="filter-form">
          <el-form-item label="员工姓名">
            <el-input v-model="filter.name" placeholder="请输入" clearable style="width:140px" @keyup.enter="handleSearch" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" size="small" @click="handleSearch">查询</el-button>
            <el-button size="small" @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>
        <el-table
          ref="tableRef"
          :data="list"
          size="small"
          row-key="user_id"
          style="width:100%"
          height="360"
          highlight-current-row
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
        >
          <el-table-column type="selection" width="40" />
          <el-table-column type="index" label="" width="55" align="center" />
          <el-table-column prop="user_name" label="员工姓名" min-width="120" show-overflow-tooltip />
          <el-table-column prop="login_name" label="登录账号" width="120" show-overflow-tooltip />
          <el-table-column prop="org_name" label="所属组织" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.org_name || '-' }}</template>
          </el-table-column>
          <el-table-column prop="post_name" label="岗位" width="100" show-overflow-tooltip>
            <template #default="{ row }">{{ row.post_name || '-' }}</template>
          </el-table-column>
          <el-table-column prop="role_name" label="角色" width="100" show-overflow-tooltip>
            <template #default="{ row }">{{ row.role_name || '-' }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="70" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '正常' : '停用' }}</el-tag>
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
      <div class="right-panel">
        <div class="right-title">当前已选择 {{ selected.length }} 项：</div>
        <ul class="selected-list">
          <li v-for="item in selected" :key="item.user_id" class="selected-item">
            <span class="selected-name">{{ item.user_name }}</span>
          </li>
          <li v-if="selected.length === 0" class="empty-tip">暂未选择</li>
        </ul>
      </div>
    </div>
    <template #footer>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { getUserList, searchUsers, getOrgTree, getPostList, type UserItem, type PostItem } from '@/api'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [user: UserItem]
}>()

const tableRef = ref()
const list = ref<UserItem[]>([])
const selected = ref<UserItem[]>([])
const filter = reactive({ name: '', orgId: '', postCode: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const orgTree = ref<any[]>([])
const postList = ref<PostItem[]>([])

async function loadFilterOptions() {
  const tasks: Promise<void>[] = []
  if (!orgTree.value.length) {
    tasks.push(
      getOrgTree().then(res => { orgTree.value = res.data.org || [] }).catch(() => {})
    )
  }
  if (!postList.value.length) {
    tasks.push(
      getPostList({ page: 1 }).then(res => { postList.value = res.data.post || [] }).catch(() => {})
    )
  }
  await Promise.all(tasks)
}

async function onOpen() {
  selected.value = []
  await loadFilterOptions()
  loadData()
}

async function loadData() {
  try {
    const hasName = !!filter.name
    const hasPost = !!filter.postCode
    // 有姓名或岗位筛选时走搜索接口；否则走列表接口（按组织查询）
    if (hasName || hasPost) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (hasName) { searchField.push('user_name'); searchValue.user_name = filter.name }
      if (hasPost) { searchField.push('post_code'); searchValue.post_code = filter.postCode }
      const res = await searchUsers({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        org_id: filter.orgId || undefined
      })
      list.value = res.data.user ?? []
      pagination.total = res.data.total ?? 0
    } else {
      // 无关键字时按组织查询；未选组织时取根节点
      let orgId = filter.orgId
      if (!orgId && orgTree.value.length > 0) {
        orgId = orgTree.value[0].org_code
      }
      if (!orgId) {
        list.value = []
        pagination.total = 0
        return
      }
      const res = await getUserList({ page: pagination.page, org_id: orgId })
      list.value = res.data.user ?? []
      pagination.total = res.data.total ?? 0
    }
  } catch {
    list.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  filter.name = ''
  filter.orgId = ''
  filter.postCode = ''
  handleSearch()
}
function handleSelectionChange(val: UserItem[]) { selected.value = val }

function handleRowClick(row: UserItem) {
  tableRef.value?.clearSelection()
  tableRef.value?.toggleRowSelection(row, true)
}

function handleConfirm() {
  if (selected.value.length === 0) { ElMessage.warning('请选择一个员工'); return }
  if (selected.value.length > 1) { ElMessage.warning('只能选择一个员工'); return }
  emit('confirm', selected.value[0])
  handleClose()
}

function handleClose() { emit('update:modelValue', false) }
</script>

<style scoped>
.select-layout { display: flex; gap: 12px; height: 480px; overflow: hidden; }
.left-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.filter-bar { display: flex; align-items: center; gap: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; flex-shrink: 0; }
.filter-form { flex-shrink: 0; padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.pagination-bar { flex-shrink: 0; padding-top: 8px; display: flex; justify-content: flex-end; }
.right-panel { flex-shrink: 0; width: 160px; border-left: 1px solid var(--el-border-color-light); padding: 0 10px; display: flex; flex-direction: column; overflow: hidden; }
.right-title { font-size: 13px; font-weight: 500; color: var(--el-text-color-primary); margin-bottom: 8px; flex-shrink: 0; }
.selected-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
.selected-item { padding: 5px 4px; font-size: 12px; color: var(--el-text-color-regular); }
.empty-tip { font-size: 12px; color: var(--el-text-color-placeholder); text-align: center; padding: 20px 0; }
</style>
