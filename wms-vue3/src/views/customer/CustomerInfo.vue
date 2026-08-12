<template>
  <ListTemplate
    title="正式客户信息"
    show-export
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="正式客户列表"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="客户名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户类型">
          <el-select v-model="searchForm.typeName" placeholder="请选择" clearable style="width:110px">
            <el-option label="零售客户" value="零售客户" />
            <el-option label="批发客户" value="批发客户" />
            <el-option label="VIP客户" value="VIP客户" />
            <el-option label="代理商" value="代理商" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人"><el-input v-model="searchForm.leaderName" placeholder="请输入" clearable style="width:110px" /></el-form-item>
        <el-form-item label="销售员"><el-input v-model="searchForm.salesmanName" placeholder="请输入" clearable style="width:110px" /></el-form-item>
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
      <el-button @click="importDialogVisible = true"><el-icon><Upload /></el-icon>批量导入</el-button>
    </template>
    <template #table>
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange" @sort-change="handleSortChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="customer_name" label="客户名称" min-width="150" show-overflow-tooltip sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.customer_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="area_name" label="所属区域" min-width="120" show-overflow-tooltip />
        <el-table-column prop="detail_address" label="详细地址" min-width="180" show-overflow-tooltip />
        <el-table-column prop="company_leader_name" label="负责人" min-width="90" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="leader_phone" label="联系电话" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="customer_type_name" label="客户类型" min-width="100" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="customer_scale" label="客户规模" show-overflow-tooltip width="80" align="center" sortable="custom" />
        <el-table-column prop="salesman_user_name" label="销售员" min-width="90" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="is_monthly_settlement" label="是否月结" width="80" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.is_monthly_settlement === 1 ? 'primary' : 'info'" size="small">{{ row.is_monthly_settlement === 1 ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="credit_amount" label="授信额度" width="100" align="right" sortable="custom">
          <template #default="{ row }">{{ row.credit_amount ? Number(row.credit_amount).toLocaleString() : '-' }}</template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="200" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="70" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '正常' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
  <BatchImportDialog
    v-model="importDialogVisible"
    title="批量导入客户"
    :template-url="customerTemplateUrl"
    template-name="客户导入模板.xlsx"
    :import-fn="importCustomers"
    @success="handleImportSuccess"
  />
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { z } from 'zod'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Upload } from '@element-plus/icons-vue'
import { getCustomerList, searchCustomers, deleteCustomer, importCustomers, type CustomerItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import BatchImportDialog from '@/views/common/BatchImportDialog.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'
import { useAgentPage } from '@/composables/useAgentPage'
import type { WmsAgentActionDefinition } from '@/agent/types'

const router = useRouter()
const tableData = ref<CustomerItem[]>([])
const selectedIds = ref<string[]>([])
const searchForm = reactive({ name: '', typeName: '', leaderName: '', salesmanName: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
let loadRequestSequence = 0
let inFlightLoad: { key: string; promise: Promise<number> } | undefined
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const loading = ref(false)

function getLoadKey(): string {
  return JSON.stringify({
    name: searchForm.name,
    typeName: searchForm.typeName,
    leaderName: searchForm.leaderName,
    salesmanName: searchForm.salesmanName,
    status: searchForm.status,
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
    let res
    if (searchForm.name || searchForm.typeName || searchForm.leaderName || searchForm.salesmanName || searchForm.status) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.name) {
        searchField.push('customer_name')
        searchValue.customer_name = searchForm.name
      }
      if (searchForm.typeName) {
        searchField.push('customer_type_name')
        searchValue.customer_type_name = searchForm.typeName
      }
      if (searchForm.leaderName) {
        searchField.push('company_leader_name')
        searchValue.company_leader_name = searchForm.leaderName
      }
      if (searchForm.salesmanName) {
        searchField.push('salesman_user_name')
        searchValue.salesman_user_name = searchForm.salesmanName
      }
      if (searchForm.status) {
        searchField.push('status')
        searchValue.status = Number(searchForm.status)
      }
      res = await searchCustomers({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      }, { signal })
    } else {
      res = await getCustomerList({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      }, { signal })
    }
    if (requestSequence !== loadRequestSequence) return pagination.total
    tableData.value = res.data.customer ?? []
    pagination.total = res.data.total ?? 0
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
function handleReset() { Object.assign(searchForm, { name: '', typeName: '', leaderName: '', salesmanName: '', status: '' }); handleSearch() }
function handleSelectionChange(val: CustomerItem[]) { selectedIds.value = val.map(v => v.customer_id) }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'customerInfo' } }) }
function handleEdit(row: CustomerItem) {
  sessionStorage.setItem('editData:customerInfo', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'customerInfo', id: row.customer_id, mode: 'edit' } })
}

async function handleDelete(row: CustomerItem) {
  try {
    await ElMessageBox.confirm(`确认删除客户「${row.customer_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteCustomer(row.customer_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

const importDialogVisible = ref(false)
const customerTemplateUrl = `${import.meta.env.BASE_URL}templates/customer-import-template.xlsx`

function handleImportSuccess() {
  importDialogVisible.value = false
  loadData()
}

const exportColumns = [
  { key: 'customer_name', label: '客户名称' }, { key: 'city', label: '所在城市' },
  { key: 'detail_address', label: '详细地址' }, { key: 'company_leader_name', label: '负责人' },
  { key: 'leader_phone', label: '联系电话' }, { key: 'customer_type_name', label: '客户类型' },
  { key: 'area_name', label: '所属区域' }, { key: 'customer_scale', label: '客户规模' },
  { key: 'salesman_user_name', label: '销售员' }, { key: 'is_monthly_settlement', label: '是否月结' },
  { key: 'credit_amount', label: '授信额度' }, { key: 'updated_at', label: '更新时间' },
  { key: 'status', label: '状态' },
]

const customerSearchSchema = z.object({
  customerName: z.string().trim().optional(),
  customerTypeName: z.string().trim().optional(),
  leaderName: z.string().trim().optional(),
  salesmanName: z.string().trim().optional(),
  status: z.union([z.literal(0), z.literal(1)]).optional(),
  page: z.number().int().positive().optional(),
})

const customerSearchAction = {
  id: 'customer.search',
  title: '查询正式客户',
  description: '按客户名称、客户类型、负责人、销售员和状态查询正式客户，并更新当前表格。',
  inputSchema: customerSearchSchema,
  inputGuide: 'customerName?: string, customerTypeName?: string, leaderName?: string, salesmanName?: string, status?: 0|1, page?: positive integer',
  risk: 'read',
  confirmation: 'none',
  execute: async (input, context) => {
    Object.assign(searchForm, {
      name: input.customerName ?? '',
      typeName: input.customerTypeName ?? '',
      leaderName: input.leaderName ?? '',
      salesmanName: input.salesmanName ?? '',
      status: input.status === undefined ? '' : String(input.status),
    })
    pagination.page = input.page ?? 1
    const total = await loadData(context.signal)
    return {
      total,
      visible: tableData.value.length,
      customers: tableData.value.slice(0, 3).map((customer) => ({
        customerName: customer.customer_name,
        leaderName: customer.company_leader_name,
        leaderPhone: customer.leader_phone,
        customerType: customer.customer_type_name,
      })),
    }
  },
  summarizeResult: ({ total, visible, customers }) => {
    const markdownCell = (value: unknown) => String(value || '-').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ')
    const rows = customers.map((customer) =>
      `| ${markdownCell(customer.customerName)} | ${markdownCell(customer.leaderName)} | ${markdownCell(customer.leaderPhone)} | ${markdownCell(customer.customerType)} |`,
    )
    return [
      `客户查询完成，共 **${total}** 条，当前页显示 **${visible}** 条。`,
      '',
      '| 客户名称 | 负责人 | 联系电话 | 客户类型 |',
      '| --- | --- | --- | --- |',
      ...rows,
    ].join('\n')
  },
} satisfies WmsAgentActionDefinition<
  z.infer<typeof customerSearchSchema>,
  {
    total: number
    visible: number
    customers: Array<{
      customerName?: string
      leaderName?: string
      leaderPhone?: string
      customerType?: string
    }>
  }
>

useAgentPage(
  {
    id: 'customer.info.list',
    title: '正式客户信息',
    routePath: '/customer/info',
    description: '正式客户查询列表。当前 MVP 只开放只读查询 Action。',
    getContext: () => ({
      filters: { ...searchForm },
      page: pagination.page,
      visibleCount: tableData.value.length,
      total: pagination.total,
    }),
  },
  [customerSearchAction],
)

onMounted(() => { loadData() })
</script>
