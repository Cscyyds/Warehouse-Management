<template>
  <ListTemplate
    title="科目管理"
    layout-key="account-subject"
    show-tree
    :tree-data="subjectTree"
    tree-node-key="subject_id"
    tree-label-key="name"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @tree-node-click="handleTreeNodeClick"
    @tree-refresh="loadTree"
    @page-change="handlePageChange"
  >
    <template #search>
      <el-form :model="searchForm" size="default">
        <el-row :gutter="16">
          <el-col :span="12" :xs="24">
            <el-form-item label="科目名称">
              <el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item label="备注">
              <el-input v-model="searchForm.remark" placeholder="请输入" clearable style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item>
              <el-button type="primary" @click="handleSearch">查询</el-button>
              <el-button @click="handleReset">重置</el-button>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </template>
    <template #actions>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>新增下级科目表
      </el-button>
    </template>
    <template #table>
      <div v-if="selectedNode && !isSearchMode" class="node-breadcrumb">
        <el-icon><FolderOpened /></el-icon>
        <span>{{ selectedNode.name }}</span>
        <el-tag size="small" :type="selectedNode.status === 1 ? 'success' : 'warning'" style="margin-left:8px">
          {{ selectedNode.status === 1 ? '启用' : '停用' }}
        </el-tag>
        <span v-if="selectedNode.remark" class="breadcrumb-remark">— {{ selectedNode.remark }}</span>
        <el-button link size="small" style="margin-left:auto" @click="handleEdit(selectedNode)">编辑此科目</el-button>
      </div>
      <el-table border :data="pagedData" stripe size="small" style="width:100%" v-loading="loading">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="name" label="科目名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="cell-link" @click="handleNodeSelect(row)">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'warning'" size="small">
              {{ row.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="下级数量" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.children?.length" type="info" size="small">{{ row.children.length }}</el-tag>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_by_name" label="创建人" width="100" show-overflow-tooltip />
        <el-table-column prop="created_at" label="创建时间" width="170" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link size="small" @click="handleToggleStatus(row)">
              {{ row.status === 1 ? '停用' : '启用' }}
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <!-- 新增/编辑对话框 -->
  <el-dialog
    v-model="dialogVisible"
    :title="dialogMode === 'add' ? '新增科目' : '编辑科目'"
    width="500px"
    :close-on-click-modal="false"
    @closed="resetForm"
  >
    <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px" size="default">
      <el-form-item label="科目名称" prop="name">
        <el-input v-model="formData.name" placeholder="请输入科目名称" clearable />
      </el-form-item>
      <el-form-item label="上级科目">
        <el-tree-select
          v-model="formData.parent_id"
          :data="subjectTree"
          :props="{ label: 'name', children: 'children', value: 'subject_id' }"
          placeholder="不选则为顶级科目"
          clearable
          check-strictly
          style="width:100%"
        />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="formData.remark" type="textarea" :rows="3" placeholder="请输入备注（可选）" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>

  <!-- 删除预览对话框 -->
  <el-dialog v-model="deletePreviewVisible" title="删除确认" width="480px" :close-on-click-modal="false">
    <div class="delete-preview">
      <el-alert :title="deletePreview?.summary || ''" type="warning" :closable="false" show-icon style="margin-bottom:12px" />
      <template v-if="deletePreview && deletePreview.cascade_count > 0">
        <p class="preview-label">将被级联删除的下级科目：</p>
        <el-table border :data="flattenTree(deletePreview.cascade_items)" size="small" max-height="200">
          <el-table-column prop="name" label="科目名称" show-overflow-tooltip />
          <el-table-column prop="status" label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'warning'" size="small">
                {{ row.status === 1 ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </div>
    <template #footer>
      <el-button @click="deletePreviewVisible = false">取消</el-button>
      <el-button type="danger" :loading="submitting" @click="confirmDelete">确认删除</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { Plus, FolderOpened } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  getAccountSubjectTree,
  searchAccountSubjects,
  createAccountSubject,
  updateAccountSubject,
  deleteAccountSubject,
  getAccountSubjectDeletePreview,
  type AccountSubjectNode,
  type AccountSubjectDeletePreview,
} from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'

const subjectTree = ref<AccountSubjectNode[]>([])
const selectedNode = ref<AccountSubjectNode | null>(null)
const loading = ref(false)
const searchForm = reactive({ name: '', remark: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const isSearchMode = computed(() => !!(searchForm.name.trim() || searchForm.remark.trim()))

// 右侧展示的原始列表（未分页）
const currentList = ref<AccountSubjectNode[]>([])

// 客户端分页切片
const pagedData = computed(() => {
  const start = (pagination.page - 1) * pagination.pageSize
  return currentList.value.slice(start, start + pagination.pageSize)
})

// 对话框
const dialogVisible = ref(false)
const dialogMode = ref<'add' | 'edit'>('add')
const submitting = ref(false)
const formRef = ref<FormInstance>()
const editingSubjectId = ref('')
const formData = reactive({ name: '', parent_id: '' as string | undefined, remark: '' })
const formRules: FormRules = {
  name: [{ required: true, message: '请输入科目名称', trigger: 'blur' }],
}

// 删除预览
const deletePreviewVisible = ref(false)
const deletePreview = ref<AccountSubjectDeletePreview | null>(null)
const pendingDeleteId = ref('')

async function loadTree() {
  loading.value = true
  try {
    const res = await getAccountSubjectTree({ page_size: 100 })
    subjectTree.value = res.data?.items || []
    refreshCurrentList()
  } catch {
    subjectTree.value = []
  } finally {
    loading.value = false
  }
}

function refreshCurrentList() {
  if (selectedNode.value) {
    // 从最新树中重新找选中节点，以同步最新 children
    const found = findNodeById(subjectTree.value, selectedNode.value.subject_id)
    selectedNode.value = found || null
    currentList.value = found?.children || []
  } else {
    currentList.value = subjectTree.value
  }
  pagination.total = currentList.value.length
  pagination.page = 1
}

function findNodeById(nodes: AccountSubjectNode[], id: string): AccountSubjectNode | null {
  for (const node of nodes) {
    if (node.subject_id === id) return node
    if (node.children?.length) {
      const found = findNodeById(node.children, id)
      if (found) return found
    }
  }
  return null
}

async function loadSearch() {
  loading.value = true
  try {
    const fields: string[] = []
    const values: Record<string, string> = {}
    if (searchForm.name.trim()) { fields.push('name'); values['name'] = searchForm.name.trim() }
    if (searchForm.remark.trim()) { fields.push('remark'); values['remark'] = searchForm.remark.trim() }
    const res = await searchAccountSubjects({
      search_field: JSON.stringify(fields),
      search_value: JSON.stringify(values),
      page: pagination.page,
      page_size: pagination.pageSize,
    })
    // 搜索返回剪枝树，展平后展示
    currentList.value = flattenTree(res.data?.items || [])
    pagination.total = res.data?.total ?? 0
  } catch {
    currentList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handlePageChange() {
  if (isSearchMode.value) loadSearch()
  // 本地分页无需重新请求
}

function handleSearch() {
  pagination.page = 1
  selectedNode.value = null
  loadSearch()
}

function handleReset() {
  Object.assign(searchForm, { name: '', remark: '' })
  selectedNode.value = null
  loadTree()
}

function handleTreeNodeClick(node: AccountSubjectNode) {
  Object.assign(searchForm, { name: '', remark: '' })
  selectedNode.value = node
  currentList.value = node.children || []
  pagination.total = currentList.value.length
  pagination.page = 1
}

/** 点击右侧列表中的科目名称，切换左侧树并展示其子级 */
function handleNodeSelect(row: AccountSubjectNode) {
  if (row.children?.length) {
    handleTreeNodeClick(row)
  } else {
    handleEdit(row)
  }
}

function handleAdd() {
  dialogMode.value = 'add'
  formData.parent_id = selectedNode.value?.subject_id || ''
  dialogVisible.value = true
}

function handleEdit(row: AccountSubjectNode) {
  dialogMode.value = 'edit'
  editingSubjectId.value = row.subject_id
  formData.name = row.name
  formData.parent_id = (!row.parent_id || row.parent_id === '0') ? '' : row.parent_id
  formData.remark = row.remark || ''
  dialogVisible.value = true
}

function resetForm() {
  formRef.value?.clearValidate()
  Object.assign(formData, { name: '', parent_id: '', remark: '' })
  editingSubjectId.value = ''
}

async function handleSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    const parentId = formData.parent_id || undefined
    if (dialogMode.value === 'add') {
      await createAccountSubject({ name: formData.name, parent_id: parentId, remark: formData.remark || undefined })
      ElMessage.success('科目创建成功')
    } else {
      await updateAccountSubject(editingSubjectId.value, { name: formData.name, remark: formData.remark || undefined })
      ElMessage.success('科目更新成功')
    }
    dialogVisible.value = false
    loadTree()
  } finally {
    submitting.value = false
  }
}

async function handleToggleStatus(row: AccountSubjectNode) {
  try {
    await updateAccountSubject(row.subject_id, { status: row.status === 1 ? 0 : 1 })
    ElMessage.success(row.status === 1 ? '已停用' : '已启用')
    loadTree()
  } catch {}
}

async function handleDelete(row: AccountSubjectNode) {
  pendingDeleteId.value = row.subject_id
  try {
    const res = await getAccountSubjectDeletePreview(row.subject_id)
    deletePreview.value = res.data
    deletePreviewVisible.value = true
  } catch {}
}

async function confirmDelete() {
  submitting.value = true
  try {
    await deleteAccountSubject(pendingDeleteId.value)
    ElMessage.success('删除成功')
    deletePreviewVisible.value = false
    loadTree()
  } finally {
    submitting.value = false
  }
}

function flattenTree(nodes: AccountSubjectNode[]): AccountSubjectNode[] {
  const result: AccountSubjectNode[] = []
  function walk(list: AccountSubjectNode[]) {
    for (const node of list) {
      result.push(node)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return result
}

onMounted(loadTree)
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
.node-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-page);
  border-radius: var(--radius-sm);
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}
.breadcrumb-remark { color: var(--text-secondary); font-weight: 400; font-size: 13px; }
.delete-preview .preview-label { font-size: 13px; color: var(--el-text-color-regular); margin: 0 0 8px; }
:deep(.el-table--small .el-table__cell) { padding: 8px 12px !important; }
:deep(.el-table--small th.el-table__cell) { padding: 10px 12px !important; }
</style>
