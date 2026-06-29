<template>
  <ListTemplate
    title="机构管理"
    show-tree
    tree-title="组织架构"
    :tree-data="orgTree"
    tree-node-key="org_code"
    tree-label-key="name"
    :total="pagination.total"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    @tree-node-click="handleOrgClick"
    @tree-refresh="fetchOrgTree"
    @page-change="fetchOrgTree"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="机构简称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:160px" @keyup.enter="handleSearch" /></el-form-item>
        <el-form-item label="机构编码"><el-input v-model="searchForm.code" placeholder="请输入" clearable style="width:160px" @keyup.enter="handleSearch" /></el-form-item>
        <el-form-item label="机构类型">
          <el-select v-model="searchForm.type" placeholder="请选择" clearable style="width:160px" @change="handleSearch">
            <el-option v-for="item in orgTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
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
      <el-table v-loading="loading" :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" row-key="org_code" default-expand-all :tree-props="{ children: 'children' }">
        <el-table-column prop="name" label="机构简称" min-width="220" show-overflow-tooltip />
        <el-table-column prop="org_code" label="机构编码" width="200" show-overflow-tooltip>
          <template #default="{ row }"><span class="mono-text">{{ row.org_code }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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
import { Plus } from '@element-plus/icons-vue'
import { getOrgTree, searchOrg, deleteOrg, previewDeleteOrg, getOrgTypeOptions, type OrgTreeNode } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const orgTree = ref<OrgTreeNode[]>([])
const tableData = ref<OrgTreeNode[]>([])
const loading = ref(false)
const orgTypeOptions = ref<{ label: string; value: string }[]>([])

const searchForm = reactive({ name: '', code: '', type: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(() => handleSearch())

function countNodes(nodes: OrgTreeNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + (n.children ? countNodes(n.children) : 0), 0)
}

async function fetchOrgTree() {
  loading.value = true
  try {
    const res = await getOrgTree()
    orgTree.value = res.data.org || []
    tableData.value = res.data.org || []
    pagination.total = res.data.total ?? countNodes(orgTree.value)
  } catch {
    orgTree.value = []
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

async function handleSearch() {
  const fields: string[] = []
  const values: Record<string, string> = {}
  const name = searchForm.name.trim()
  const code = searchForm.code.trim()
  const type = searchForm.type
  if (name) { fields.push('org_name'); values['org_name'] = name }
  if (code) { fields.push('org_code'); values['org_code'] = code }
  if (type) { fields.push('org_type'); values['org_type'] = type }
  if (fields.length === 0) { fetchOrgTree(); return }
  loading.value = true
  try {
    const res = await searchOrg({
      search_field: JSON.stringify(fields),
      search_value: JSON.stringify(values),
      page: 1,
      sort_by: sortBy.value || undefined,
      sort_order: sortOrder.value || undefined,
    })
    tableData.value = res.data.org || []
    pagination.total = res.data.total ?? countNodes(tableData.value)
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleReset() {
  searchForm.name = ''
  searchForm.code = ''
  searchForm.type = ''
  fetchOrgTree()
}

// 点击左侧树节点：仅展示该节点子树
function handleOrgClick(data: OrgTreeNode) {
  if (!data?.org_code) { tableData.value = orgTree.value; return }
  tableData.value = [data]
}

function handleAdd() {
  router.push({ path: '/common/add', query: { type: 'organization' } })
}

function handleEdit(row: OrgTreeNode) {
  router.push({ path: '/common/add', query: { type: 'organization', id: row.org_code, mode: 'edit' } })
}

async function handleDelete(row: OrgTreeNode) {
  try {
    // 先预览删除影响
    let summary = `确认删除机构【${row.name}】？`
    try {
      const preview = await previewDeleteOrg(row.org_code)
      if (preview.data?.summary) summary = preview.data.summary + '，确认删除？'
    } catch {}
    await ElMessageBox.confirm(summary, '删除确认', { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' })
    await deleteOrg(row.org_code)
    ElMessage.success('删除成功')
    fetchOrgTree()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') { /* 错误已由拦截器提示 */ }
  }
}

onMounted(() => {
  fetchOrgTree()
  getOrgTypeOptions().then(opts => { orgTypeOptions.value = opts })
})
</script>

<style scoped>
.mono-text { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 12px; color: var(--text-secondary); }
</style>
