<template>
  <ListTemplate
    title="产品类别"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    show-tree
    tree-title="产品类别"
    :tree-data="sidebarTree"
    tree-width="210px"
    @page-change="loadData"
    @add="handleAdd"
    @tree-node-click="handleTreeNodeClick"
    @tree-refresh="loadData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="类别名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="类别编码"><el-input v-model="searchForm.code" placeholder="请输入" clearable style="width:130px" /></el-form-item>
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
      <el-table
        :data="tableData"
        stripe
        size="small"
        style="width:100%"
        row-key="category_id"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        row-class-name="table-row"
      >
        <el-table-column prop="category_code" label="类别编码" width="130" />
        <el-table-column prop="name" label="类别名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="sort_no" label="排序号" width="80" align="center" />
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="160" />
        <el-table-column prop="status" label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <div class="row-actions">
              <el-tooltip content="新增子类" placement="top">
                <el-button link type="primary" size="small" @click="handleAddChild(row)"><el-icon><FolderAdd /></el-icon></el-button>
              </el-tooltip>
              <el-tooltip content="编辑" placement="top">
                <el-button link type="primary" size="small" @click="handleEdit(row)"><el-icon><Edit /></el-icon></el-button>
              </el-tooltip>
              <el-tooltip content="删除" placement="top">
                <el-button link type="danger" size="small" @click="handleDelete(row)"><el-icon><Delete /></el-icon></el-button>
              </el-tooltip>
            </div>
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
import { Plus, FolderAdd, Edit, Delete } from '@element-plus/icons-vue'
import { getProductCategoryList, deleteProductCategory, type ProductCategoryItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const allData = ref<ProductCategoryItem[]>([])
const tableData = ref<ProductCategoryItem[]>([])
const searchForm = reactive({ name: '', code: '', status: '' as number | '' })
const pagination = reactive({ page: 1, pageSize: 50, total: 0 })
const selectedNodeId = ref<string | null>(null)

const sidebarTree = ref<any[]>([])

function buildSidebarTree(data: ProductCategoryItem[]) {
  sidebarTree.value = [{ category_id: '__all__', name: '全部', children: data }]
}

function findSubtree(nodes: ProductCategoryItem[], id: string): ProductCategoryItem | null {
  for (const node of nodes) {
    if (node.category_id === id) return node
    if (node.children) {
      const found = findSubtree(node.children, id)
      if (found) return found
    }
  }
  return null
}

function filterTree(nodes: ProductCategoryItem[]): ProductCategoryItem[] {
  const { name, code, status } = searchForm
  if (!name && !code && status === '') return nodes
  return nodes.reduce<ProductCategoryItem[]>((acc, node) => {
    const children = node.children ? filterTree(node.children) : []
    const match = (!name || node.name.includes(name)) && (!code || node.category_code.includes(code)) && (status === '' || node.status === status)
    if (match || children.length) acc.push({ ...node, children: children.length ? children : undefined })
    return acc
  }, [])
}

function applyFilter() {
  const base = selectedNodeId.value && selectedNodeId.value !== '__all__'
    ? (() => { const n = findSubtree(allData.value, selectedNodeId.value!); return n ? [n] : allData.value })()
    : allData.value
  tableData.value = filterTree(base)
  pagination.total = tableData.value.length
}

async function loadData() {
  try {
    const res = await getProductCategoryList()
    allData.value = res.data.product_category
  } catch {
    allData.value = []
  }
  sessionStorage.setItem('treeCache:productCategory', JSON.stringify(allData.value))
  buildSidebarTree(allData.value)
  applyFilter()
}

function handleSearch() { applyFilter() }
function handleReset() { Object.assign(searchForm, { name: '', code: '', status: '' }); applyFilter() }

function handleTreeNodeClick(data: any) {
  selectedNodeId.value = data.category_id
  applyFilter()
}

function handleAdd() {
  router.push({ path: '/common/add', query: { type: 'productCategory' } })
}

function handleAddChild(row: ProductCategoryItem) {
  sessionStorage.setItem('presetData:productCategory', JSON.stringify({ parent_id: row.category_id, parent_name: row.name }))
  router.push({ path: '/common/add', query: { type: 'productCategory' } })
}

function handleEdit(row: ProductCategoryItem) {
  sessionStorage.setItem('editData:productCategory', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'productCategory', id: row.category_id, mode: 'edit' } })
}

async function handleDelete(row: ProductCategoryItem) {
  try {
    await ElMessageBox.confirm(`确认删除类别「${row.name}」？若有子类别或关联产品将无法删除。`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteProductCategory(row.category_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
.row-actions { display: flex; align-items: center; justify-content: center; gap: 2px; }
</style>
