<template>
  <ListTemplate
    title="配送任务"
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
        <el-form-item label="关键词"><el-input v-model="searchForm.keyword" placeholder="任务编号/车牌号/司机" clearable style="width:200px" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:110px">
            <el-option label="待装车" value="WAIT_LOAD" />
            <el-option label="装车中" value="LOADING" />
            <el-option label="待发车" value="WAIT_DEPARTURE" />
            <el-option label="配送中" value="DELIVERING" />
            <el-option label="已完成" value="FINISHED" />
            <el-option label="已取消" value="CANCELLED" />
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
      <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
    </template>
    <template #col-actions="{ row }">
      <el-button link type="primary" size="small" @click="handleDetail(row)">详情</el-button>
      <el-button v-if="canCancel(row.status)" link type="danger" size="small" @click="handleCancel(row)">取消</el-button>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getDeliveryTaskList, cancelDeliveryTask, type DeliveryTaskItem } from '@/api'
import ListTemplate, { type Column } from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<DeliveryTaskItem[]>([])
const searchForm = reactive({ keyword: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const loading = ref(false)

const columns: Column[] = [
  { prop: 'delivery_task_no', label: '任务编号', minWidth: 160, sortable: true, sortKey: 'deliveryTaskNo' },
  { prop: 'license_plate', label: '车牌号', width: 130 },
  { prop: 'vehicle_name', label: '车辆名称', width: 130 },
  { prop: 'driver_name', label: '司机', width: 100 },
  { prop: 'status', label: '状态', width: 100, align: 'center' },
  { prop: 'plan_departure_time', label: '计划发车时间', width: 200 },
  { prop: 'created_at', label: '创建时间', width: 200, sortable: true, sortKey: 'createdAt' },
]

const STATUS_MAP: Record<string, { label: string; type: string }> = {
  WAIT_LOAD: { label: '待装车', type: '' },
  LOADING: { label: '装车中', type: 'primary' },
  WAIT_DEPARTURE: { label: '待发车', type: 'warning' },
  DELIVERING: { label: '配送中', type: 'success' },
  FINISHED: { label: '已完成', type: 'info' },
  CANCELLED: { label: '已取消', type: 'danger' },
}

function statusLabel(s: string) { return STATUS_MAP[s]?.label || s }
function statusTagType(s: string) { return (STATUS_MAP[s]?.type || '') as '' | 'success' | 'warning' | 'info' | 'danger' | 'primary' }
function canCancel(s: string) { return ['WAIT_LOAD', 'LOADING'].includes(s) }

async function loadData() {
  loading.value = true
  try {
    const res = await getDeliveryTaskList({
      page: pagination.page,
      page_size: pagination.pageSize,
      keyword: searchForm.keyword || undefined,
      status: searchForm.status || undefined,
      sort_by: sortBy.value || undefined,
      sort_order: sortOrder.value || undefined,
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
function handleAdd() { router.push('/delivery/task/add') }
function handleDetail(row: DeliveryTaskItem) {
  router.push({ path: '/delivery/task/detail', query: { id: row.delivery_task_id } })
}

async function handleCancel(row: DeliveryTaskItem) {
  try {
    await ElMessageBox.confirm(`确认取消配送任务「${row.delivery_task_no}」？`, '提示', { confirmButtonText: '确认取消', type: 'warning' })
    await cancelDeliveryTask(row.delivery_task_id)
    ElMessage.success('取消成功')
    loadData()
  } catch (e: any) {
    if (e?.response?.data?.detail) ElMessage.error(e.response.data.detail)
  }
}

onMounted(() => { loadData() })
</script>
