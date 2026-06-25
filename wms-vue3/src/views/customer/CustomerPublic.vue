<template>
  <ListTemplate
    title="公海客户"
    :show-add="false"
    show-import
    show-export
    :import-columns="importColumns"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="公海客户列表"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
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
        <el-table-column prop="area_name" label="所属区域" width="100" />
        <el-table-column prop="company_leader_name" label="负责人" width="90" />
        <el-table-column prop="company_phone" label="联系电话" width="120" />
        <el-table-column prop="customer_type_name" label="客户类型" width="100" />
        <el-table-column prop="customer_tag" label="客户标签" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small">{{ row.customer_tag }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="detail_address" label="详细地址" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleConvert(row)">转为有效客户</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getOpenPoolCustomerList, searchOpenPoolCustomers, convertOpenPoolLead, type OpenPoolCustomerItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const tableData = ref<OpenPoolCustomerItem[]>([])
const selectedIds = ref<string[]>([])
const searchForm = reactive({ name: '', type: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

async function loadData() {
  try {
    let res
    if (searchForm.name || searchForm.type) {
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
      res = await searchOpenPoolCustomers({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page
      })
    } else {
      res = await getOpenPoolCustomerList({ page: pagination.page })
    }
    tableData.value = res.data.customers
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', type: '' }); handleSearch() }
function handleSelectionChange(val: OpenPoolCustomerItem[]) { selectedIds.value = val.map(v => v.customer_id) }

async function handleConvert(row: OpenPoolCustomerItem) {
  try {
    await ElMessageBox.confirm(`确认将「${row.customer_name}」转为有效客户？`, '提示', { confirmButtonText: '确认转换', type: 'warning' })
    await convertOpenPoolLead({
      lead_id: row.customer_id,
      customer_name: row.customer_name,
      area_id: '',
      detail_address: row.detail_address || '',
      company_leader_name: row.company_leader_name || '',
      leader_phone: row.company_phone || '',
      customer_type_id: '',
      region_id: '',
      logistics_company_id: '',
      is_monthly_settlement: 0
    })
    ElMessage.success('转换成功')
    loadData()
  } catch {}
}

const importColumns = [
  { key: 'customer_name', label: '客户名称' },
  { key: 'area_name', label: '所属区域' },
  { key: 'company_leader_name', label: '负责人' },
  { key: 'company_phone', label: '联系电话' },
  { key: 'customer_type_name', label: '客户类型' },
]

const exportColumns = [
  { key: 'customer_name', label: '客户名称' },
  { key: 'area_name', label: '所属区域' },
  { key: 'company_leader_name', label: '负责人' },
  { key: 'company_phone', label: '联系电话' },
  { key: 'customer_type_name', label: '客户类型' },
  { key: 'customer_tag', label: '客户标签' },
  { key: 'detail_address', label: '详细地址' },
]

function handleImport(data: any[]) {
  ElMessage.success(`已解析 ${data.length} 条数据，请对接后端接口`)
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
