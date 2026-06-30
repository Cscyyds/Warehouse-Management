<template>
  <el-dialog
    title="员工选择"
    :model-value="modelValue"
    width="1000px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="select-layout">
      <!-- 左侧：组织机构树 -->
      <div class="org-tree-panel">
        <div class="tree-panel-header">
          <span class="tree-panel-title">组织机构</span>
          <el-tooltip content="刷新">
            <el-icon :size="16" class="action-icon" @click="fetchOrgTree"><Refresh /></el-icon>
          </el-tooltip>
        </div>
        <div class="tree-panel-body">
          <el-tree
            ref="treeRef"
            :data="orgTree"
            :props="{ label: 'name', children: 'children' }"
            node-key="org_code"
            highlight-current
            @node-click="handleOrgClick"
          >
            <template #default="{ node, data: nodeData }">
              <span class="tree-node">
                <el-icon v-if="nodeData.children && nodeData.children.length" :size="16" class="tree-folder-icon">
                  <FolderOpened v-if="node.expanded" />
                  <Folder v-else />
                </el-icon>
                <el-icon v-else :size="16" class="tree-leaf-icon"><Document /></el-icon>
                <span class="tree-label">{{ nodeData.name }}</span>
              </span>
            </template>
          </el-tree>
        </div>
      </div>

      <!-- 中间：搜索 + 表格 -->
      <div class="main-panel">
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
          v-loading="loading"
          @selection-change="handleSelectionChange"
          @select="handleSelect"
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

      <!-- 右侧：已选 -->
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
import { ref, reactive, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, FolderOpened, Folder, Document } from '@element-plus/icons-vue'
import { getUserList, searchUsers, getOrgTree, type UserItem } from '@/api'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [user: UserItem]
}>()

const tableRef = ref()
const treeRef = ref()
const loading = ref(false)
const list = ref<UserItem[]>([])
const selected = ref<UserItem[]>([])
const filter = reactive({ name: '', orgId: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const orgTree = ref<any[]>([])

// 监听弹窗打开：modelValue 变为 true 时立即重置并加载数据，不等动画结束
watch(() => props.modelValue, async (val) => {
  if (val) {
    selected.value = []
    filter.name = ''
    filter.orgId = ''
    pagination.page = 1
    loading.value = true
    // 加载组织树
    await fetchOrgTree()
    // 默认选中根节点
    if (orgTree.value.length > 0) {
      filter.orgId = orgTree.value[0].org_code
      nextTick(() => treeRef.value?.setCurrentKey(filter.orgId))
    }
    await loadData()
  }
}, { immediate: true })

async function fetchOrgTree() {
  try {
    const res = await getOrgTree()
    orgTree.value = res.data.org || []
  } catch {
    orgTree.value = []
  }
}

async function loadData() {
  if (!filter.orgId) {
    list.value = []
    pagination.total = 0
    return
  }
  loading.value = true
  // 保证加载动画至少展示 0.3s，避免数据返回过快导致闪烁
  const minDelay = new Promise(resolve => setTimeout(resolve, 300))
  try {
    if (filter.name) {
      const searchField: string[] = ['user_name']
      const searchValue: Record<string, unknown> = { user_name: filter.name }
      const res = await searchUsers({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        org_id: filter.orgId || undefined
      })
      await minDelay
      list.value = res.data.user ?? []
      pagination.total = res.data.total ?? 0
    } else {
      const res = await getUserList({ page: pagination.page, org_id: filter.orgId })
      await minDelay
      list.value = res.data.user ?? []
      pagination.total = res.data.total ?? 0
    }
  } catch {
    await minDelay
    list.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  filter.name = ''
  handleSearch()
}

function handleOrgClick(data: any) {
  filter.orgId = data.org_code || ''
  handleSearch()
}

function handleSelectionChange(val: UserItem[]) { selected.value = val }

// 单选限制：勾选某行时清除其他选中，仅保留当前行
function handleSelect(selection: UserItem[], row: UserItem) {
  if (selection.includes(row)) {
    tableRef.value?.clearSelection()
    tableRef.value?.toggleRowSelection(row, true)
  }
}

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

/* 左侧组织树面板 */
.org-tree-panel { flex-shrink: 0; width: 180px; background: var(--el-fill-color-lighter); border-radius: 4px; display: flex; flex-direction: column; overflow: hidden; }
.tree-panel-header { padding: 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--el-border-color-lighter); flex-shrink: 0; }
.tree-panel-title { font-weight: 600; font-size: 13px; color: var(--el-text-color-primary); }
.tree-panel-header .action-icon { cursor: pointer; color: var(--el-text-color-secondary); transition: color 0.2s; }
.tree-panel-header .action-icon:hover { color: var(--el-color-primary); }
.tree-panel-body { flex: 1; overflow-y: auto; padding: 4px 0; }
.tree-node { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.tree-label { font-size: 13px; }
.tree-folder-icon { color: var(--el-text-color-secondary); transition: color 0.2s; }
.tree-leaf-icon { color: var(--el-text-color-secondary); transition: color 0.2s; }
.tree-node:hover .tree-folder-icon,
.tree-node:hover .tree-leaf-icon { color: var(--el-color-primary); }

/* 中间主面板 */
.main-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.filter-form { flex-shrink: 0; padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.pagination-bar { flex-shrink: 0; padding-top: 8px; display: flex; justify-content: flex-end; }

/* 右侧已选面板 */
.right-panel { flex-shrink: 0; width: 140px; border-left: 1px solid var(--el-border-color-light); padding: 0 10px; display: flex; flex-direction: column; overflow: hidden; }
.right-title { font-size: 13px; font-weight: 500; color: var(--el-text-color-primary); margin-bottom: 8px; flex-shrink: 0; }
.selected-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
.selected-item { padding: 5px 4px; font-size: 12px; color: var(--el-text-color-regular); }
.empty-tip { font-size: 12px; color: var(--el-text-color-placeholder); text-align: center; padding: 20px 0; }
</style>
