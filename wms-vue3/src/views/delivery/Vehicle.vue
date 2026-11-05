<template>
  <ListTemplate
    title="车辆管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    :columns="columns"
    :table-data="tableData"
    pagination-mode="server"
    :show-index="true"
    @page-change="loadData"
    @add="handleAdd"
    @sort-change="handleSortChange"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="关键词"><el-input v-model="searchForm.keyword" placeholder="车牌号/车辆名称" clearable style="width:180px" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:100px">
            <el-option label="空闲" value="IDLE" />
            <el-option label="使用中" value="IN_USE" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button v-perm="'POST /api/v1/tenant/vehicle/create'" type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
    </template>
    <template #col-status="{ row }">
      <el-tag :type="row.status === 'IDLE' ? 'success' : 'warning'" size="small">{{ row.status === 'IDLE' ? '空闲' : '使用中' }}</el-tag>
    </template>
    <template #col-actions="{ row }">
      <el-button v-perm="'POST /api/v1/tenant/vehicle/update'" link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
      <el-button v-perm="'POST /api/v1/tenant/vehicle/delete'" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getVehicleList, deleteVehicle, type VehicleItem } from '@/api'
import ListTemplate, { type Column } from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<VehicleItem[]>([])
const searchForm = reactive({ keyword: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const loading = ref(false)

const columns: Column[] = [
  // 后端 /tenant/vehicle/list 无排序参数，以下列不支持升降序，仅展示
  { prop: 'license_plate', label: '车牌号', minWidth: 140 },
  { prop: 'vehicle_name', label: '车辆名称', minWidth: 160 },
  { prop: 'status', label: '状态', width: 100, align: 'center' },
  { prop: 'remark', label: '备注', minWidth: 180 },
  { prop: 'created_at', label: '创建时间', width: 180 },
]

async function loadData() {
  loading.value = true
  try {
    const res = await getVehicleList({
      page: pagination.page,
      page_size: pagination.pageSize,
      keyword: searchForm.keyword || undefined,
      status: searchForm.status || undefined,
    })
    tableData.value = res.data.items
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { keyword: '', status: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'vehicle' } }) }
function handleEdit(row: VehicleItem) {
  sessionStorage.setItem('editData:vehicle', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'vehicle', id: row.vehicle_id, mode: 'edit' } })
}

async function handleDelete(row: VehicleItem) {
  try {
    await ElMessageBox.confirm(`确认删除车辆「${row.vehicle_name}（${row.license_plate}）」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteVehicle(row.vehicle_id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e: any) {
    if (e?.response?.data?.detail) {
      ElMessage.error(e.response.data.detail)
    }
  }
}

onMounted(() => { loadData() })
</script>
