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
        <el-form-item label="计划发车日期">
          <el-date-picker
            v-model="searchForm.departureRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            range-separator="至"
            clearable
            style="width:240px"
          />
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
import { z } from 'zod'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getDeliveryTaskList, cancelDeliveryTask, type DeliveryTaskItem } from '@/api'
import ListTemplate, { type Column } from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import { useAgentPage } from '@/composables/useAgentPage'
import type { WmsAgentActionDefinition } from '@/agent/types'

const router = useRouter()
const tableData = ref<DeliveryTaskItem[]>([])
const searchForm = reactive({ keyword: '', status: '', departureRange: [] as string[] })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const loading = ref(false)
let loadRequestSequence = 0
let inFlightLoad: { key: string; promise: Promise<number> } | undefined

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

function getLoadKey(): string {
  return JSON.stringify({
    ...searchForm,
    page: pagination.page,
    pageSize: pagination.pageSize,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  })
}

function loadData(signal?: AbortSignal): Promise<number> {
  const key = getLoadKey()
  if (inFlightLoad?.key === key) return inFlightLoad.promise
  const promise = performLoadData(signal)
  inFlightLoad = { key, promise }
  promise.then(
    () => { if (inFlightLoad?.promise === promise) inFlightLoad = undefined },
    () => { if (inFlightLoad?.promise === promise) inFlightLoad = undefined },
  )
  return promise
}

async function performLoadData(signal?: AbortSignal): Promise<number> {
  const requestSequence = ++loadRequestSequence
  loading.value = true
  try {
    const res = await getDeliveryTaskList({
      page: pagination.page,
      page_size: pagination.pageSize,
      keyword: searchForm.keyword || undefined,
      status: searchForm.status || undefined,
      start_date: searchForm.departureRange[0] || undefined,
      end_date: searchForm.departureRange[1] || undefined,
      sort_by: sortBy.value || undefined,
      sort_order: sortOrder.value || undefined,
    }, { signal })
    if (requestSequence !== loadRequestSequence) return pagination.total
    tableData.value = res.data.items
    pagination.total = res.data.total
    return pagination.total
  } catch (error) {
    if (signal?.aborted) throw signal.reason
    if (requestSequence !== loadRequestSequence) return pagination.total
    tableData.value = []
    pagination.total = 0
    if (signal) throw error
    return 0
  } finally {
    if (requestSequence === loadRequestSequence) loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { keyword: '', status: '', departureRange: [] }); handleSearch() }
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

const deliveryTaskSearchSchema = z.object({
  keyword: z.string().trim().optional(),
  status: z.enum(['WAIT_LOAD', 'LOADING', 'WAIT_DEPARTURE', 'DELIVERING', 'FINISHED', 'CANCELLED']).optional(),
  departureStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  departureEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.number().int().positive().optional(),
})

const deliveryTaskSearchAction = {
  id: 'delivery-task.search',
  title: '查询配送任务',
  description: '按任务关键词、状态和计划发车日期查询配送任务。',
  inputSchema: deliveryTaskSearchSchema,
  inputGuide: 'keyword?: string, status?: WAIT_LOAD|LOADING|WAIT_DEPARTURE|DELIVERING|FINISHED|CANCELLED, departureStart?: YYYY-MM-DD, departureEnd?: YYYY-MM-DD, page?: positive integer',
  risk: 'read',
  confirmation: 'none',
  execute: async (input, context) => {
    context.signal.throwIfAborted()
    Object.assign(searchForm, {
      keyword: input.keyword ?? '',
      status: input.status ?? '',
      departureRange: input.departureStart || input.departureEnd
        ? [input.departureStart ?? '', input.departureEnd ?? '']
        : [],
    })
    pagination.page = input.page ?? 1
    const total = await loadData(context.signal)
    return { total, visible: tableData.value.length, tasks: tableData.value.slice(0, 3) }
  },
  summarizeResult: ({ total, visible, tasks }) => [
    `配送任务查询完成，共 **${total}** 条，当前页显示 **${visible}** 条。`,
    '',
    '| 任务编号 | 司机 | 车辆 | 状态 | 计划发车时间 | 配送数量 |',
    '| --- | --- | --- | --- | --- | ---: |',
    ...tasks.map((task) =>
      `| ${task.delivery_task_no || '-'} | ${task.driver_name || '-'} | ${task.license_plate || task.vehicle_name || '-'} | ${statusLabel(task.status)} | ${task.plan_departure_time || '-'} | ${task.delivery_quantity ?? '-'} |`,
    ),
  ].join('\n'),
} satisfies WmsAgentActionDefinition<
  z.infer<typeof deliveryTaskSearchSchema>,
  { total: number; visible: number; tasks: DeliveryTaskItem[] }
>

useAgentPage(
  {
    id: 'delivery.task.list',
    title: '配送任务',
    routePath: '/delivery/task',
    description: '配送任务、车辆、司机、状态和计划发车日期查询页面。',
    getContext: () => ({
      filters: { ...searchForm },
      visibleTasks: tableData.value.slice(0, 10).map((task) => ({
        deliveryTaskId: task.delivery_task_id,
        deliveryTaskNo: task.delivery_task_no,
        status: task.status,
        driverName: task.driver_name,
        planDepartureTime: task.plan_departure_time,
      })),
    }),
  },
  [deliveryTaskSearchAction],
)

onMounted(() => { loadData() })
</script>
