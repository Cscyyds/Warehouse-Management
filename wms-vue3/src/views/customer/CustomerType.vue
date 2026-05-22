<template>
  <ListTemplate
    title="客户类型管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :columns="columns"
    :table-data="tableData"
    :show-index="true"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="类型名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
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
    <template #col-remark="{ row }">
      <span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span>
    </template>
    <template #col-actions="{ row }">
      <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
      <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getCustomerTypeItemList, deleteCustomerType, type CustomerTypeItem } from '@/api'
import ListTemplate, { type Column } from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<CustomerTypeItem[]>([])
const searchForm = reactive({ name: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const columns: Column[] = [
  { prop: 'name', label: '名称', minWidth: 160 },
  { prop: 'remark', label: '备注', minWidth: 200, showOverflowTooltip: true },
]

async function loadData() {
  try {
    const res = await getCustomerTypeItemList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', status: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'customerType' } }) }
function handleEdit(row: CustomerTypeItem) {
  sessionStorage.setItem('editData:customerType', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'customerType', id: row.id, mode: 'edit' } })
}

async function handleDelete(row: CustomerTypeItem) {
  try {
    await ElMessageBox.confirm(`确认删除客户类型「${row.name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteCustomerType(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
