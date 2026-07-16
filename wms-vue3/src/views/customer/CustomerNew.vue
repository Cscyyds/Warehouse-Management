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
    :loading="loading"
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
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange" @sort-change="handleSortChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="lead_name" label="客户名称" min-width="150" show-overflow-tooltip sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.lead_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="area_name" label="所属区域" min-width="90" show-overflow-tooltip />
        <el-table-column prop="contact_name" label="负责人" min-width="90" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="contact_phone" label="联系电话" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="customer_type_name" label="客户类型" min-width="100" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="updated_at" label="更新时间" width="160" sortable="custom">
          <template #default="{ row }">{{ formatTableDate(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'warning'" size="small">{{ row.status === 1 ? '有效' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button link type="success" size="small" :disabled="row.status !== 1" @click="handleConvert(row)">转为有效客户</el-button>
              <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <el-dialog v-model="convertDialogVisible" title="转为有效客户" width="520px" :close-on-click-modal="false">
    <el-form :model="convertForm" label-width="100px" ref="convertFormRef" :rules="convertFormRules">
      <el-form-item label="客户名称">
        <span>{{ convertForm.customer_name }}</span>
      </el-form-item>
      <el-form-item label="所属区域" prop="region_id">
        <el-select v-model="convertForm.region_id" placeholder="请选择所属区域" style="width:100%">
          <el-option v-for="r in regionOptions" :key="r.value" :label="r.label" :value="r.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="物流公司" prop="logistics_company_id">
        <el-select v-model="convertForm.logistics_company_id" placeholder="请选择物流公司" style="width:100%">
          <el-option v-for="l in logisticsOptions" :key="l.value" :label="l.label" :value="l.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="跟单员" prop="follower_user_id">
        <el-input
          v-model="convertForm.follower_user_name"
          placeholder="点击选择跟单员"
          readonly
          style="width:100%"
          @click="openEmployeeDialog('follower')"
        >
          <template #suffix>
            <el-icon style="cursor:pointer" @click.stop="openEmployeeDialog('follower')"><Search /></el-icon>
          </template>
        </el-input>
      </el-form-item>
      <el-form-item label="销售员" prop="salesman_user_id">
        <el-input
          v-model="convertForm.salesman_user_name"
          placeholder="点击选择销售员"
          readonly
          style="width:100%"
          @click="openEmployeeDialog('salesman')"
        >
          <template #suffix>
            <el-icon style="cursor:pointer" @click.stop="openEmployeeDialog('salesman')"><Search /></el-icon>
          </template>
        </el-input>
      </el-form-item>
      <el-form-item label="是否月结">
        <el-radio-group v-model="convertForm.is_monthly_settlement">
          <el-radio :value="1">是</el-radio>
          <el-radio :value="0">否</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="授信额度">
        <el-input-number v-model="convertForm.credit_amount" :min="0" :precision="2" style="width:100%" />
      </el-form-item>
      <el-form-item label="月结天数" v-if="convertForm.is_monthly_settlement === 1">
        <el-input-number v-model="convertForm.monthly_days" :min="0" :precision="0" style="width:100%" />
      </el-form-item>
      <el-form-item label="结算日" v-if="convertForm.is_monthly_settlement === 1">
        <el-input-number v-model="convertForm.settlement_day" :min="0" :precision="0" style="width:100%" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="convertDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="convertLoading" @click="submitConvert">确认转换</el-button>
    </template>
  </el-dialog>

  <EmployeeSelectDialog
    v-model="employeeDialogVisible"
    @confirm="onEmployeeConfirm"
  />
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Search } from '@element-plus/icons-vue'

import {
  getCustomerLeadList,
  searchCustomerLeads,
  convertCustomerLeadToCustomer,
  deleteCustomerLead,
  getCustomerRegionList,
  getLogisticsCompanyList,
  type CustomerLeadItem,
  type UserItem,
} from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import EmployeeSelectDialog from './EmployeeSelectDialog.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'

const router = useRouter()
const tableData = ref<CustomerLeadItem[]>([])
const selectedIds = ref<string[]>([])
const searchForm = reactive({ name: '', type: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const loading = ref(false)

async function loadData() {
  loading.value = true
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
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    } else {
      res = await getCustomerLeadList({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    }
    tableData.value = res.data.customer_lead
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
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

const convertDialogVisible = ref(false)
const convertLoading = ref(false)
const convertFormRef = ref<FormInstance>()
const regionOptions = ref<{ label: string; value: string }[]>([])
const logisticsOptions = ref<{ label: string; value: string }[]>([])
const convertForm = reactive({
  lead_id: '',
  customer_name: '',
  area_id: '',
  detail_address: '',
  company_leader_name: '',
  leader_phone: '',
  customer_type_id: '',
  region_id: '',
  logistics_company_id: '',
  is_monthly_settlement: 0 as number,
  credit_amount: 0 as number,
  monthly_days: 0 as number,
  settlement_day: 0 as number,
  customer_scale: '',
  remark: '',
  follower_user_id: '',
  follower_user_name: '',
  salesman_user_id: '',
  salesman_user_name: '',
})
const convertFormRules: FormRules = {
  region_id: [{ required: true, message: '请选择所属区域', trigger: 'change' }],
  logistics_company_id: [{ required: true, message: '请选择物流公司', trigger: 'change' }],
}

async function loadRegionOptions() {
  try {
    const res = await getCustomerRegionList({ page: 1 })
    regionOptions.value = (res.data.region || []).map((r: any) => ({ label: r.region_name, value: r.region_id }))
  } catch {
    regionOptions.value = []
  }
}

async function loadLogisticsOptions() {
  try {
    const res = await getLogisticsCompanyList({ page: 1 })
    logisticsOptions.value = (res.data.logistics_company || []).map((l: any) => ({ label: l.company_name, value: l.logistics_company_id }))
  } catch {
    logisticsOptions.value = []
  }
}

function handleConvert(row: CustomerLeadItem) {
  convertForm.lead_id = row.lead_id
  convertForm.customer_name = row.lead_name
  convertForm.area_id = row.area_id || ''
  convertForm.detail_address = row.detail_address || ''
  convertForm.company_leader_name = row.contact_name || ''
  convertForm.leader_phone = row.contact_phone || ''
  convertForm.customer_type_id = row.customer_type_id || ''
  convertForm.region_id = row.region_id || ''
  convertForm.logistics_company_id = ''
  convertForm.is_monthly_settlement = 0
  convertForm.credit_amount = 0
  convertForm.monthly_days = 0
  convertForm.settlement_day = 0
  convertForm.customer_scale = row.customer_scale || ''
  convertForm.remark = row.remark || ''
  convertForm.follower_user_id = ''
  convertForm.follower_user_name = ''
  convertForm.salesman_user_id = ''
  convertForm.salesman_user_name = ''
  convertDialogVisible.value = true
  convertFormRef.value?.clearValidate()
  if (regionOptions.value.length === 0) loadRegionOptions()
  if (logisticsOptions.value.length === 0) loadLogisticsOptions()
}

const employeeDialogVisible = ref(false)
const employeeSelectTarget = ref<'follower' | 'salesman'>('follower')

function openEmployeeDialog(target: 'follower' | 'salesman') {
  employeeSelectTarget.value = target
  employeeDialogVisible.value = true
}

function onEmployeeConfirm(employee: UserItem) {
  if (employeeSelectTarget.value === 'follower') {
    convertForm.follower_user_id = employee.user_id
    convertForm.follower_user_name = employee.user_name
    return
  }
  convertForm.salesman_user_id = employee.user_id
  convertForm.salesman_user_name = employee.user_name
}

async function submitConvert() {
  if (!convertFormRef.value) return
  const valid = await convertFormRef.value.validate().catch(() => false)
  if (!valid) return
  convertLoading.value = true
  try {
    await convertCustomerLeadToCustomer({
      lead_id: convertForm.lead_id,
      customer_name: convertForm.customer_name,
      area_id: convertForm.area_id,
      detail_address: convertForm.detail_address,
      company_leader_name: convertForm.company_leader_name,
      leader_phone: convertForm.leader_phone,
      customer_type_id: convertForm.customer_type_id,
      region_id: convertForm.region_id,
      logistics_company_id: convertForm.logistics_company_id,
      is_monthly_settlement: convertForm.is_monthly_settlement,
      credit_amount: convertForm.credit_amount,
      monthly_days: convertForm.is_monthly_settlement === 1 ? convertForm.monthly_days : 0,
      settlement_day: convertForm.is_monthly_settlement === 1 ? convertForm.settlement_day : 0,
      customer_scale: convertForm.customer_scale || undefined,
      remark: convertForm.remark || undefined,
      follower_user_id: convertForm.follower_user_id || undefined,
      salesman_user_id: convertForm.salesman_user_id || undefined,
    })
    ElMessage.success('转换成功')
    convertDialogVisible.value = false
    loadData()
  } catch {
    // 错误已由请求拦截器处理
  } finally {
    convertLoading.value = false
  }
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
.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.cell-empty { color: var(--text-tertiary); }
</style>
