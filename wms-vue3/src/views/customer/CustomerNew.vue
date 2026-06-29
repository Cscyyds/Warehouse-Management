<template>
  <ListTemplate
    title="新开拓客户"
    show-import
    show-export
    :import-columns="importColumns"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="新开拓客户列表"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
    @import="handleImport"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="客户名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户类型">
          <el-select v-model="searchForm.type" placeholder="请选择" clearable style="width:110px">
            <el-option label="零售客户" value="零售客户" />
            <el-option label="批发客户" value="批发客户" />
            <el-option label="VIP客户" value="VIP客户" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:100px">
            <el-option label="有效" value="1" />
            <el-option label="停用" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>

    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange" @sort-change="handleSortChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="lead_name" label="客户名称" min-width="150" show-overflow-tooltip sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.lead_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="city" label="所在城市" width="100" sortable="custom" />
        <el-table-column prop="contact_name" label="负责人" width="90" sortable="custom" />
        <el-table-column prop="contact_phone" label="联系电话" width="120" sortable="custom" />
        <el-table-column prop="customer_type_name" label="客户类型" width="100" sortable="custom" />
        <el-table-column prop="area_name" label="所属区域" width="90" sortable="custom" />
        <el-table-column prop="updated_at" label="更新时间" width="160" sortable="custom" />
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'warning'" size="small">{{ row.status === 1 ? '有效' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="success" size="small" :disabled="row.status !== 1" @click="handleConvert(row)">转为有效客户</el-button>
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

import { getCustomerLeadList, searchCustomerLeads, convertCustomerLeadToCustomer, deleteCustomerLead, type CustomerLeadItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<CustomerLeadItem[]>([])
const selectedIds = ref<string[]>([])
const searchForm = reactive({ name: '', type: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

async function loadData() {
  try {
    let res
    if (searchForm.name || searchForm.type || searchForm.status) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.name) {
        searchField.push('lead_name')
        searchValue.lead_name = searchForm.name
      }
      if (searchForm.type) {
        searchField.push('customer_type_name')
        searchValue.customer_type_name = searchForm.type
      }
      if (searchForm.status) {
        searchField.push('status')
        searchValue.status = Number(searchForm.status)
      }
      res = await searchCustomerLeads({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    } else {
      res = await getCustomerLeadList({
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    }
    tableData.value = res.data.customer_lead
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', type: '', status: '' }); handleSearch() }
function handleSelectionChange(val: CustomerLeadItem[]) { selectedIds.value = val.map(v => v.lead_id) }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'customerNew' } }) }
function handleEdit(row: CustomerLeadItem) {
  sessionStorage.setItem('editData:customerNew', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'customerNew', id: row.lead_id, mode: 'edit' } })
}

async function handleConvert(row: CustomerLeadItem) {
  try {
    await ElMessageBox.confirm(`确认将「${row.lead_name}」转为有效客户？`, '提示', { confirmButtonText: '确认转换', type: 'warning' })
    await convertCustomerLeadToCustomer({
      lead_id: row.lead_id,
      is_monthly_settlement: 0,
      monthly_days: 0,
      settlement_day: 0
    })
    ElMessage.success('转换成功')
    loadData()
  } catch {}
}

async function handleDelete(row: CustomerLeadItem) {
  try {
    await ElMessageBox.confirm(`确认删除客户「${row.lead_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteCustomerLead(row.lead_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

const importColumns = [
  { key: 'lead_name', label: '客户名称' }, { key: 'city', label: '所在城市' },
  { key: 'contact_name', label: '负责人' }, { key: 'contact_phone', label: '联系电话' },
  { key: 'customer_type_name', label: '客户类型' }, { key: 'area_name', label: '所属区域' },
]

const exportColumns = [
  { key: 'lead_name', label: '客户名称' }, { key: 'city', label: '所在城市' },
  { key: 'contact_name', label: '负责人' }, { key: 'contact_phone', label: '联系电话' },
  { key: 'customer_type_name', label: '客户类型' }, { key: 'area_name', label: '所属区域' },
  { key: 'status', label: '状态' }, { key: 'updated_at', label: '更新时间' },
]

function handleImport(data: any[]) {
  ElMessage.success(`已解析 ${data.length} 条数据，请对接后端接口`)
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
