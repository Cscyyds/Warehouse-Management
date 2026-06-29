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
        <el-table-column prop="detail_address" label="详细地址" min-width="180" show-overflow-tooltip sortable="custom" />
        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleConvert(row)">转为有效客户</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <!-- 转为有效客户对话框 -->
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
      <el-form-item label="授信额度" v-if="convertForm.is_monthly_settlement === 1">
        <el-input-number v-model="convertForm.credit_amount" :min="0" :precision="2" style="width:100%" />
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
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import {
  getOpenPoolCustomerList, searchOpenPoolCustomers, convertOpenPoolLead,
  getCustomerRegionList, getLogisticsCompanyList,
  type OpenPoolCustomerItem, type UserItem,
} from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import EmployeeSelectDialog from './EmployeeSelectDialog.vue'
import { useTableSort } from '@/composables/useTableSort'

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

// ---- 转为有效客户对话框 ----
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
  follower_user_id: '',
  follower_user_name: '',
  salesman_user_id: '',
  salesman_user_name: '',
})
const convertFormRules: FormRules = {
  region_id: [{ required: true, message: '请选择所属区域', trigger: 'change' }],
  logistics_company_id: [{ required: true, message: '请选择物流公司', trigger: 'change' }],
  follower_user_id: [{
    validator: (_rule, _value, callback) => {
      if (!convertForm.follower_user_id && !convertForm.salesman_user_id) {
        callback(new Error('请至少绑定跟单员或销售员其中之一'))
      } else {
        callback()
      }
    },
    trigger: 'change',
  }],
}

async function loadRegionOptions() {
  try {
    const res = await getCustomerRegionList({ page: 1 })
    regionOptions.value = (res.data.region || []).map((r: any) => ({ label: r.region_name, value: r.region_id }))
  } catch { regionOptions.value = [] }
}

async function loadLogisticsOptions() {
  try {
    const res = await getLogisticsCompanyList({ page: 1 })
    logisticsOptions.value = (res.data.logistics_company || []).map((l: any) => ({ label: l.company_name, value: l.logistics_company_id }))
  } catch { logisticsOptions.value = [] }
}

function handleConvert(row: OpenPoolCustomerItem) {
  convertForm.lead_id = row.customer_id
  convertForm.customer_name = row.customer_name
  convertForm.area_id = row.area_id || ''
  convertForm.detail_address = row.detail_address || ''
  convertForm.company_leader_name = row.company_leader_name || ''
  convertForm.leader_phone = row.leader_phone || row.company_phone || ''
  convertForm.customer_type_id = row.customer_type_id || ''
  convertForm.region_id = ''
  convertForm.logistics_company_id = ''
  convertForm.is_monthly_settlement = 0
  convertForm.credit_amount = 0
  convertForm.follower_user_id = ''
  convertForm.follower_user_name = ''
  convertForm.salesman_user_id = ''
  convertForm.salesman_user_name = ''
  convertDialogVisible.value = true
  convertFormRef.value?.clearValidate()
  // 加载下拉选项
  if (regionOptions.value.length === 0) loadRegionOptions()
  if (logisticsOptions.value.length === 0) loadLogisticsOptions()
}

// ---- 员工选择对话框 ----
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
  } else {
    convertForm.salesman_user_id = employee.user_id
    convertForm.salesman_user_name = employee.user_name
  }
  convertFormRef.value?.validateField('follower_user_id')
}

async function submitConvert() {
  if (!convertFormRef.value) return
  await convertFormRef.value.validate(async (valid) => {
    if (!valid) return
    convertLoading.value = true
    try {
      await convertOpenPoolLead({
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
        credit_amount: convertForm.is_monthly_settlement === 1 ? convertForm.credit_amount : undefined,
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
  })
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
