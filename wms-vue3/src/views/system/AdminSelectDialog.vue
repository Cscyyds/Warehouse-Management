<template>
  <el-dialog
    title="选择用户"
    :model-value="modelValue"
    width="1000px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div class="select-layout">
      <div class="left-panel">
        <el-form :model="leftFilter" inline size="small" class="filter-form">
          <el-form-item>
            <el-select v-model="leftFilter.orgId" placeholder="按组织" clearable style="width:110px">
              <el-option v-for="o in orgOptions" :key="o.id" :label="o.name" :value="o.id" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select v-model="leftFilter.positionId" placeholder="按岗位" clearable style="width:110px">
              <el-option v-for="p in positionOptions" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select v-model="leftFilter.roleId" placeholder="按角色" clearable style="width:110px">
              <el-option v-for="r in roleOptions" :key="r.id" :label="r.name" :value="r.id" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-input v-model="leftFilter.keyword" placeholder="账号/姓名" clearable style="width:110px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" size="small" @click="handleSearch">查询</el-button>
            <el-button size="small" @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>
        <el-table
          ref="tableRef"
          :data="userList"
          size="small"
          row-key="user_id"
          style="width:100%"
          height="360"
          class="left-table"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="40" />
          <el-table-column prop="login_name" label="账号" width="100" show-overflow-tooltip />
          <el-table-column prop="user_name" label="姓名" width="90" show-overflow-tooltip />
          <el-table-column prop="org_name" label="组织" min-width="100" show-overflow-tooltip />
          <el-table-column prop="post_name" label="岗位" width="90" show-overflow-tooltip />
          <el-table-column prop="status" label="状态" width="70" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
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
        <div class="right-title">已选择 {{ selectedUsers.length }} 人：</div>
        <ul class="selected-list">
          <li v-for="user in selectedUsers" :key="user.user_id" class="selected-item">
            <span class="selected-name">{{ user.user_name }}（{{ user.login_name }}）</span>
          </li>
          <li v-if="selectedUsers.length === 0" class="empty-tip">暂未选择</li>
        </ul>
      </div>
    </div>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { getPersonnelList, type UserItem } from '@/api'
import { getRoleAll } from '@/api'
import { getPositionList, type PositionItem } from '@/api'
import { getOrgTree } from '@/api'

interface OrgOption { id: string; name: string }

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [users: UserItem[]]
}>()

const tableRef = ref()
const userList = ref<UserItem[]>([])
const selectedUsers = ref<UserItem[]>([])
const orgOptions = ref<OrgOption[]>([])
const positionOptions = ref<PositionItem[]>([])
const roleOptions = ref<{ id: string; name: string }[]>([])

const leftFilter = reactive({ orgId: '', positionId: '', roleId: '', keyword: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

async function onOpen() {
  await Promise.all([fetchOrgOptions(), fetchPositionOptions(), fetchRoleOptions()])
  loadData()
}

async function fetchOrgOptions() {
  try {
    const res = await getOrgTree()
    function flatten(nodes: any[]): OrgOption[] {
      return nodes.flatMap(n => [{ id: n.id, name: n.name }, ...flatten(n.children || [])])
    }
    orgOptions.value = flatten(res.data.tree || [])
  } catch {
    orgOptions.value = [{ id: '0', name: '总经办' }, { id: '4-1', name: '采购部' }, { id: '4-2', name: '售后部' }]
  }
}

async function fetchPositionOptions() {
  try {
    const res = await getPositionList({ page: 1, pageSize: 999 })
    positionOptions.value = res.data.list
  } catch {
    positionOptions.value = []
  }
}

async function fetchRoleOptions() {
  try {
    const res = await getRoleAll()
    roleOptions.value = res.data
  } catch {
    roleOptions.value = []
  }
}

async function loadData() {
  try {
    const res = await getPersonnelList({
      account: leftFilter.keyword || undefined,
      orgId: leftFilter.orgId || undefined,
      positionId: leftFilter.positionId || undefined,
      roleId: leftFilter.roleId || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    userList.value = res.data.list
    pagination.total = res.data.total
  } catch {
    userList.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(leftFilter, { orgId: '', positionId: '', roleId: '', keyword: '' })
  handleSearch()
}

function handleSelectionChange(val: UserItem[]) {
  selectedUsers.value = val
}

function handleConfirm() {
  if (selectedUsers.value.length === 0) {
    ElMessage.warning('请至少选择一名用户')
    return
  }
  emit('confirm', selectedUsers.value)
  handleClose()
}

function handleClose() {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.select-layout { display: flex; gap: 12px; height: 480px; overflow: hidden; }
.left-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.filter-form { flex-shrink: 0; padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.pagination-bar { flex-shrink: 0; padding-top: 8px; display: flex; justify-content: flex-end; }
.right-panel { flex-shrink: 0; width: 160px; border-left: 1px solid var(--el-border-color-light); padding: 0 10px; display: flex; flex-direction: column; overflow: hidden; }
.right-title { font-size: 13px; font-weight: 500; color: var(--el-text-color-primary); margin-bottom: 8px; flex-shrink: 0; }
.selected-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
.selected-item { padding: 5px 4px; font-size: 12px; }
.selected-name { color: var(--el-text-color-regular); }
.empty-tip { font-size: 12px; color: var(--el-text-color-placeholder); text-align: center; padding: 20px 0; }
</style>
