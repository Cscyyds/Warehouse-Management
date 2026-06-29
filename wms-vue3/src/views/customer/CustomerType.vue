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
            <el-option label="正常" value="1" />
            <el-option label="停用" value="0" />
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
    <template #col-status="{ row }">
      <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '正常' : '停用' }}</el-tag>
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
import { getCustomerTypeList, searchCustomerTypes, deleteCustomerType, type CustomerTypeItem } from '@/api'
import ListTemplate, { type Column } from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<CustomerTypeItem[]>([])
const searchForm = reactive({ name: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

const columns: Column[] = [
  { prop: 'type_name', label: '名称', minWidth: 160, sortable: true },
  { prop: 'status', label: '状态', width: 80, align: 'center', sortable: true },
  { prop: 'created_by_name', label: '创建人', width: 120, sortable: true },
  { prop: 'created_at', label: '创建时间', width: 180, sortable: true },
]

async function loadData() {
  try {
    let res
    if (searchForm.name || searchForm.status) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.name) {
        searchField.push('type_name')
        searchValue.type_name = searchForm.name
      }
      if (searchForm.status) {
        searchField.push('status')
        searchValue.status = Number(searchForm.status)
      }
      res = await searchCustomerTypes({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page
      })
    } else {
      res = await getCustomerTypeList({ page: pagination.page })
    }
    tableData.value = res.data.customer_type
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
  router.push({ path: '/common/add', query: { type: 'customerType', id: row.customer_type_id, mode: 'edit' } })
}

async function handleDelete(row: CustomerTypeItem) {
  try {
    await ElMessageBox.confirm(`确认删除客户类型「${row.type_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteCustomerType(row.customer_type_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>


