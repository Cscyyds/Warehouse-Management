<template>
  <ListTemplate
    title="物流公司管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    :columns="columns"
    :table-data="tableData"
    :show-index="true"
    @page-change="loadData"
    @add="handleAdd"
    @sort-change="handleSortChange"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="公司名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:160px" /></el-form-item>
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
import { getLogisticsCompanyList, searchLogisticsCompanies, deleteLogisticsCompany, type LogisticsCompanyItem } from '@/api'
import ListTemplate, { type Column } from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<LogisticsCompanyItem[]>([])
const searchForm = reactive({ name: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const loading = ref(false)

const columns: Column[] = [
  { prop: 'company_name', label: '公司名称', minWidth: 180, sortable: true },
  { prop: 'sort_no', label: '排序号', width: 100, align: 'center', sortable: true },
  { prop: 'status', label: '状态', width: 80, align: 'center', sortable: true },
  { prop: 'remark', label: '备注', minWidth: 160 },
  { prop: 'created_at', label: '创建时间', width: 180, sortable: true },
]

async function loadData() {
  loading.value = true
  try {
    let res
    if (searchForm.name || searchForm.status) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.name) {
        searchField.push('company_name')
        searchValue.company_name = searchForm.name
      }
      if (searchForm.status) {
        searchField.push('status')
        searchValue.status = Number(searchForm.status)
      }
      res = await searchLogisticsCompanies({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    } else {
      res = await getLogisticsCompanyList({
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    }
    tableData.value = res.data.logistics_company
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', status: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'logisticsCompany' } }) }
function handleEdit(row: LogisticsCompanyItem) {
  sessionStorage.setItem('editData:logisticsCompany', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'logisticsCompany', id: row.logistics_company_id, mode: 'edit' } })
}

async function handleDelete(row: LogisticsCompanyItem) {
  try {
    await ElMessageBox.confirm(`确认删除物流公司「${row.company_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteLogisticsCompany(row.logistics_company_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>
