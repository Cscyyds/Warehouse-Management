<template>
  <ListTemplate
    title="产品类别"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="类别名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品编码"><el-input v-model="searchForm.code" placeholder="请输入" clearable style="width:130px" /></el-form-item>
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
        row-key="id"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        row-class-name="table-row"
      >
        <el-table-column prop="code" label="产品编码" width="130" />
        <el-table-column prop="name" label="类别名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="companyName" label="绑定公司" min-width="140" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.companyName }">{{ row.companyName || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="sort" label="排序号" width="80" align="center" />
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="updateTime" label="更新时间" width="160" />
        <el-table-column prop="status" label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '正常' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleAddChild(row)">新增子类</el-button>
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
import { getProductCategoryTree, deleteProductCategory, type ProductCategoryItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<ProductCategoryItem[]>([])
const searchForm = reactive({ name: '', code: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 50, total: 0 })

const fallbackData: ProductCategoryItem[] = [
  { id: '1', code: 'PC001', name: '五金配件', parentId: '', parentName: '', companyId: '1', companyName: '百诺全屋五金', sort: 1, status: '正常', remark: '', createTime: '2024-01-01', updateTime: '2026-04-20', children: [
    { id: '1-1', code: 'PC001-1', name: '铰链', parentId: '1', parentName: '五金配件', companyId: '1', companyName: '百诺全屋五金', sort: 1, status: '正常', remark: '', createTime: '2024-01-01', updateTime: '2026-04-20' },
    { id: '1-2', code: 'PC001-2', name: '滑轨', parentId: '1', parentName: '五金配件', companyId: '1', companyName: '百诺全屋五金', sort: 2, status: '正常', remark: '', createTime: '2024-01-01', updateTime: '2026-04-20' },
  ]},
  { id: '2', code: 'PC002', name: '装饰材料', parentId: '', parentName: '', companyId: '1', companyName: '百诺全屋五金', sort: 2, status: '正常', remark: '', createTime: '2024-01-01', updateTime: '2026-04-20', children: [
    { id: '2-1', code: 'PC002-1', name: '把手', parentId: '2', parentName: '装饰材料', companyId: '1', companyName: '百诺全屋五金', sort: 1, status: '正常', remark: '', createTime: '2024-01-01', updateTime: '2026-04-20' },
  ]},
]

function filterTree(nodes: ProductCategoryItem[]): ProductCategoryItem[] {
  const { name, code, status } = searchForm
  if (!name && !code && !status) return nodes
  return nodes.reduce<ProductCategoryItem[]>((acc, node) => {
    const children = node.children ? filterTree(node.children) : []
    const match = (!name || node.name.includes(name)) && (!code || node.code.includes(code)) && (!status || node.status === status)
    if (match || children.length) acc.push({ ...node, children: children.length ? children : undefined })
    return acc
  }, [])
}

async function loadData() {
  try {
    const res = await getProductCategoryTree()
    tableData.value = res.data
    pagination.total = res.data.length
  } catch {
    tableData.value = filterTree(fallbackData)
    pagination.total = tableData.value.length
  }
}

function handleSearch() { loadData() }
function handleReset() { Object.assign(searchForm, { name: '', code: '', status: '' }); loadData() }

function handleAdd() {
  router.push({ path: '/common/add', query: { type: 'productCategory' } })
}

function handleAddChild(row: ProductCategoryItem) {
  sessionStorage.setItem('presetData:productCategory', JSON.stringify({ parentId: row.id, parentName: row.name }))
  router.push({ path: '/common/add', query: { type: 'productCategory' } })
}

function handleEdit(row: ProductCategoryItem) {
  sessionStorage.setItem('editData:productCategory', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'productCategory', id: row.id, mode: 'edit' } })
}

async function handleDelete(row: ProductCategoryItem) {
  try {
    await ElMessageBox.confirm(`确认删除类别「${row.name}」？删除后其子类别也将一并删除。`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteProductCategory(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
