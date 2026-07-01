<template>
  <ListTemplate
    title="正式客户信息"
    show-import
    show-export
    :import-columns="importColumns"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="正式客户列表"
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
          <el-select v-model="searchForm.typeName" placeholder="请选择" clearable style="width:110px">
            <el-option label="零售客户" value="零售客户" />
            <el-option label="批发客户" value="批发客户" />
            <el-option label="VIP客户" value="VIP客户" />
            <el-option label="代理商" value="代理商" />
          </el-select>
        </el-form-item>
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
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange" @sort-change="handleSortChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="customer_name" label="客户名称" min-width="150" show-overflow-tooltip sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.customer_name }}</el-link>
          </template>
        </el-table-column>
                <el-table-column prop="area_name" label="所属区域" width="120" sortable="custom" />
        <el-table-column prop="company_leader_name" label="负责人" width="90" sortable="custom" />
        <el-table-column prop="leader_phone" label="联系电话" width="120" sortable="custom" />
        <el-table-column prop="customer_type_name" label="客户类型" width="100" sortable="custom" />
        <el-table-column prop="customer_scale" label="客户规模" width="80" align="center" sortable="custom" />
        <el-table-column prop="salesman_user_name" label="销售员" width="90" sortable="custom" />
        <el-table-column prop="is_monthly_settlement" label="是否月结" width="80" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.is_monthly_settlement === 1 ? 'primary' : 'info'" size="small">{{ row.is_monthly_settlement === 1 ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="credit_amount" label="授信额度" width="100" align="right" sortable="custom">
          <template #default="{ row }">{{ row.credit_amount ? Number(row.credit_amount).toLocaleString() : '-' }}</template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="160" sortable="custom" />
        <el-table-column prop="status" label="状态" width="70" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '正常' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
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
import { Plus } from '@element-plus/icons-vue'
import { getCustomerList, searchCustomers, deleteCustomer, type CustomerItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<CustomerItem[]>([])
const selectedIds = ref<string[]>([])
const searchForm = reactive({ name: '', typeName: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

async function loadData() {
  try {
    let res
    if (searchForm.name || searchForm.typeName || searchForm.status) {
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
      if (searchForm.status) {
        searchField.push('status')
        searchValue.status = Number(searchForm.status)
      }
      res = await searchCustomers({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page
      })
    } else {
      res = await getCustomerList({ page: pagination.page })
    }
    tableData.value = res.data.customer ?? res.data.customer ?? []
    pagination.total = res.data.total ?? 0
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', typeName: '', status: '' }); handleSearch() }
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

const importColumns = [
  { key: 'customer_name', label: '客户名称' }, { key: 'city', label: '所在城市' },
  { key: 'detail_address', label: '详细地址' }, { key: 'company_leader_name', label: '负责人' },
  { key: 'leader_phone', label: '联系电话' }, { key: 'customer_type_name', label: '客户类型' },
  { key: 'area_name', label: '所属区域' }, { key: 'customer_scale', label: '客户规模' },
  { key: 'salesman_user_name', label: '销售员' }, { key: 'is_monthly_settlement', label: '是否月结' },
  { key: 'credit_amount', label: '授信额度' }, { key: 'status', label: '状态' },
]

const exportColumns = [
  { key: 'customer_name', label: '客户名称' }, { key: 'city', label: '所在城市' },
  { key: 'detail_address', label: '详细地址' }, { key: 'company_leader_name', label: '负责人' },
  { key: 'leader_phone', label: '联系电话' }, { key: 'customer_type_name', label: '客户类型' },
  { key: 'area_name', label: '所属区域' }, { key: 'customer_scale', label: '客户规模' },
  { key: 'salesman_user_name', label: '销售员' }, { key: 'is_monthly_settlement', label: '是否月结' },
  { key: 'credit_amount', label: '授信额度' }, { key: 'updated_at', label: '更新时间' },
  { key: 'status', label: '状态' },
]

function handleImport(data: any[]) {
  ElMessage.success(`已解析 ${data.length} 条数据，请对接后端接口`)
}

onMounted(() => { loadData() })
</script>
