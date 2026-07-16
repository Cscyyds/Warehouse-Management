<template>
  <ListTemplate
    title="司机档案"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    :columns="columns"
    :table-data="tableData"
    :show-index="true"
    @page-change="loadData"
    @sort-change="handleSortChange"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="姓名/电话/驾驶证号" clearable style="width:200px" />
        </el-form-item>
        <el-form-item label="司机类型">
          <el-select v-model="searchForm.driver_type" clearable placeholder="全部" style="width:130px">
            <el-option label="内部员工" value="INTERNAL_EMPLOYEE" />
            <el-option label="外部个体" value="EXTERNAL_INDIVIDUAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" clearable placeholder="全部" style="width:100px">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="INACTIVE" />
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
    <template #col-driver_type="{ row }">
      <span>{{ driverTypeLabel(row.driver_type) }}</span>
    </template>
    <template #col-status="{ row }">
      <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">
        {{ row.status === 'ACTIVE' ? '启用' : '停用' }}
      </el-tag>
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
import { searchDrivers, deleteDriver, type DriverItem } from '@/api'
import ListTemplate, { type Column } from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<DriverItem[]>([])
const searchForm = reactive({ keyword: '', driver_type: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const loading = ref(false)

const columns: Column[] = [
  { prop: 'driver_name', label: '司机姓名', minWidth: 120, sortable: true },
  { prop: 'driver_type', label: '司机类型', width: 110, align: 'center' },
  { prop: 'driver_phone', label: '联系电话', width: 140 },
  { prop: 'driver_license_no', label: '驾驶证号', minWidth: 150 },
  { prop: 'license_expire_date', label: '驾驶证到期', width: 130 },
  { prop: 'status', label: '状态', width: 90, align: 'center' },
  { prop: 'remark', label: '备注', minWidth: 160 },
  { prop: 'created_at', label: '创建时间', width: 170, sortable: true },
]

function driverTypeLabel(v: string) {
  return v === 'INTERNAL_EMPLOYEE' ? '内部员工' : v === 'EXTERNAL_INDIVIDUAL' ? '外部个体' : v
}

async function loadData() {
  loading.value = true
  try {
    const res = await searchDrivers({
      page: pagination.page,
      page_size: pagination.pageSize,
      keyword: searchForm.keyword || undefined,
      driver_type: searchForm.driver_type || undefined,
      status: searchForm.status || undefined,
      sort_by: sortBy.value || undefined,
      sort_order: sortOrder.value || undefined,
    })
    tableData.value = res.data.driver
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { keyword: '', driver_type: '', status: '' }); handleSearch() }

function handleAdd() {
  router.push('/delivery/driver/add')
}

function handleEdit(row: DriverItem) {
  sessionStorage.setItem('editData:driver', JSON.stringify(row))
  router.push({ path: '/delivery/driver/add', query: { id: row.driver_id, mode: 'edit' } })
}

async function handleDelete(row: DriverItem) {
  try {
    await ElMessageBox.confirm(
      `确认删除司机「${row.driver_name}」？被有效物流记录或未完成任务引用的司机无法删除。`,
      '提示',
      { confirmButtonText: '确认删除', type: 'warning' }
    )
    await deleteDriver(row.driver_id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e: any) {
    if (e?.response?.data?.detail) ElMessage.error(e.response.data.detail)
  }
}

onMounted(() => { loadData() })
</script>
