<template>
  <ListTemplate
    title="计量单位"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="单位名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
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
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column prop="name" label="单位名称" min-width="140" />
        <el-table-column prop="companyName" label="绑定公司" min-width="160" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.companyName }">{{ row.companyName || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column prop="updateTime" label="更新时间" width="160" />
        <el-table-column prop="status" label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '正常' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right" align="center">
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
import { getProductUnitPageList, deleteProductUnit, type ProductUnitItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<ProductUnitItem[]>([])
const searchForm = reactive({ name: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: ProductUnitItem[] = [
  { id: '1', name: '个', companyId: '1', companyName: '百诺全屋五金', status: '正常', remark: '', createTime: '2024-01-01 09:00', updateTime: '2026-04-20 09:00' },
  { id: '2', name: '套', companyId: '1', companyName: '百诺全屋五金', status: '正常', remark: '', createTime: '2024-01-01 09:05', updateTime: '2026-04-20 09:05' },
  { id: '3', name: '箱', companyId: '1', companyName: '百诺全屋五金', status: '正常', remark: '标准包装箱', createTime: '2024-01-01 09:10', updateTime: '2026-04-20 09:10' },
  { id: '4', name: '包', companyId: '1', companyName: '百诺全屋五金', status: '正常', remark: '', createTime: '2024-01-01 09:15', updateTime: '2026-04-20 09:15' },
  { id: '5', name: '米', companyId: '1', companyName: '百诺全屋五金', status: '停用', remark: '', createTime: '2024-01-01 09:20', updateTime: '2025-10-01 09:20' },
]

async function loadData() {
  try {
    const res = await getProductUnitPageList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
    tableData.value = res.data.list
    pagination.total = res.data.total
    const opts = res.data.list.map(u => ({ label: u.name, value: u.id }))
    sessionStorage.setItem('optionsCache:productUnit', JSON.stringify(opts))
  } catch {
    const { name, status } = searchForm
    const filtered = fallbackData.filter(r => {
      if (name && !r.name.includes(name)) return false
      if (status && r.status !== status) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
    if (!sessionStorage.getItem('optionsCache:productUnit')) {
      const opts = fallbackData.map(u => ({ label: u.name, value: u.id }))
      sessionStorage.setItem('optionsCache:productUnit', JSON.stringify(opts))
    }
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', status: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'productUnit' } }) }
function handleEdit(row: ProductUnitItem) {
  sessionStorage.setItem('editData:productUnit', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'productUnit', id: row.id, mode: 'edit' } })
}

async function handleDelete(row: ProductUnitItem) {
  try {
    await ElMessageBox.confirm(`确认删除计量单位「${row.name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteProductUnit(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
