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
        <el-form-item label="转换状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:100px">
            <el-option label="未转换" value="0" />
            <el-option label="已转换" value="1" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>

    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="customer_name" label="客户名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="city" label="所在城市" width="100" />
        <el-table-column prop="company_leader_name" label="负责人" width="90" />
        <el-table-column prop="leader_phone" label="联系电话" width="120" />
        <el-table-column prop="customer_type_name" label="客户类型" width="100" />
        <el-table-column prop="area_name" label="所属区域" width="90" />
        <el-table-column prop="salesman_user_name" label="销售员" width="90" />
        <el-table-column prop="updated_at" label="更新时间" width="160" />
        <el-table-column prop="converted_flag" label="转换状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.converted_flag === 1 ? 'success' : 'warning'" size="small">{{ row.converted_flag === 1 ? '已转换' : '未转换' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="success" size="small" :disabled="row.converted_flag === 1" @click="handleConvert(row)">转为有效客户</el-button>
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

const router = useRouter()
const tableData = ref<CustomerLeadItem[]>([])
const selectedIds = ref<string[]>([])
const searchForm = reactive({ name: '', type: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

async function loadData() {
  try {
    let res
    if (searchForm.name || searchForm.type || searchForm.status) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.name) {
        searchField.push('customer_name')
        searchValue.customer_name = searchForm.name
      }
      if (searchForm.type) {
        searchField.push('customer_type_name')
        searchValue.customer_type_name = searchForm.type
      }
      if (searchForm.status) {
        searchField.push('converted_flag')
        searchValue.converted_flag = Number(searchForm.status)
      }
      res = await searchCustomerLeads({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page
      })
    } else {
      res = await getCustomerLeadList({ page: pagination.page })
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
function handleSelectionChange(val: CustomerLeadItem[]) { selectedIds.value = val.map(v => v.customer_lead_id) }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'customerNew' } }) }
function handleEdit(row: CustomerLeadItem) {
  sessionStorage.setItem('editData:customerNew', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'customerNew', id: row.customer_lead_id, mode: 'edit' } })
}

async function handleConvert(row: CustomerLeadItem) {
  try {
    await ElMessageBox.confirm(`确认将「${row.customer_name}」转为有效客户？`, '提示', { confirmButtonText: '确认转换', type: 'warning' })
    await convertCustomerLeadToCustomer({
      customer_lead_id: row.customer_lead_id,
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
    await ElMessageBox.confirm(`确认删除客户「${row.customer_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteCustomerLead(row.customer_lead_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

const importColumns = [
  { key: 'customer_name', label: '客户名称' }, { key: 'city', label: '所在城市' },
  { key: 'company_leader_name', label: '负责人' }, { key: 'leader_phone', label: '联系电话' },
  { key: 'customer_type_name', label: '客户类型' }, { key: 'area_name', label: '所属区域' },
  { key: 'salesman_user_name', label: '销售员' },
]

const exportColumns = [
  { key: 'customer_name', label: '客户名称' }, { key: 'city', label: '所在城市' },
  { key: 'company_leader_name', label: '负责人' }, { key: 'leader_phone', label: '联系电话' },
  { key: 'customer_type_name', label: '客户类型' }, { key: 'area_name', label: '所属区域' },
  { key: 'salesman_user_name', label: '销售员' },
  { key: 'converted_flag', label: '转换状态' }, { key: 'updated_at', label: '更新时间' },
]

function handleImport(data: any[]) {
  ElMessage.success(`已解析 ${data.length} 条数据，请对接后端接口`)
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
