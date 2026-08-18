<template>
  <ListTemplate
    title="客户授信余额表"
    :show-add="false"
    show-export
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="客户授信余额表"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    @page-change="loadData"
  >
    <template #actions>
      <el-button type="primary" @click="openAddDialog()">
        <el-icon><Plus /></el-icon>新增授信额度
      </el-button>
    </template>
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="客户名称"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户ID"><el-input v-model="searchForm.customerId" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #table>
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" highlight-current-row show-summary :summary-method="getSummaries" @sort-change="handleSortChange" @row-click="handleRowClick">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="customer_name" label="客户名称" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="credit_amount" label="授信余额" width="130" align="right" sortable="custom">
          <template #default="{ row }">{{ row.credit_amount?.toLocaleString() ?? '-' }}</template>
        </el-table-column>
        <!-- used/remaining 为虚拟计算字段，后端白名单不支持排序，仅展示 -->
        <el-table-column prop="used_credit_amount" label="已用额度" width="130" align="right">
          <template #default="{ row }">{{ row.used_credit_amount?.toLocaleString() ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="remaining_credit_amount" label="可用余额" width="130" align="right">
          <template #default="{ row }">
            <span :class="{ 'amount-warning': row.remaining_credit_amount < 0 }">{{ row.remaining_credit_amount?.toLocaleString() ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click.stop="openAddDialog(row)">新增授信</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <!-- 新增/调减授信额度弹窗 -->
  <el-dialog v-model="addDialogVisible" title="新增授信额度" width="520px" :close-on-click-modal="false" @closed="handleDialogClosed">
    <el-form ref="formRef" :model="addForm" label-width="100px" class="credit-add-form">
      <el-form-item label="客户" prop="customerId" :rules="[{ required: true, message: '请选择客户', trigger: 'change' }]">
        <el-input v-model="addForm.customerName" placeholder="点击选择客户" readonly @click="selectDialogVisible = true">
          <template #suffix>
            <el-icon style="cursor:pointer" @click.stop="selectDialogVisible = true"><Search /></el-icon>
          </template>
        </el-input>
      </el-form-item>
      <el-form-item label="变动金额" prop="amount" :rules="amountRules">
        <el-input-number v-model="addForm.amount" :precision="2" :step="100" style="width:100%" placeholder="正数=新增，负数=调减" />
        <div class="amount-tip">正数增加授信额度，负数调减授信额度，不能为 0</div>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="addForm.remark" type="textarea" :rows="3" placeholder="请输入备注" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="addDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>

  <CustomerSelectDialog v-model="selectDialogVisible" @confirm="onCustomerConfirm" />
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { getCreditSummaryList, searchCreditSummary, addCreditLog, type CreditSummaryItem, type CustomerItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import CustomerSelectDialog from '@/views/customer/CustomerSelectDialog.vue'
import { createAmountSummary } from '@/composables/useTableSummary'
import { useTableSort } from '@/composables/useTableSort'

const tableData = ref<CreditSummaryItem[]>([])
const getSummaries = createAmountSummary(['credit_amount', 'used_credit_amount', 'remaining_credit_amount'])
const searchForm = reactive({ customerName: '', customerId: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const router = useRouter()
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const loading = ref(false)

// ---------- 新增/调减授信额度 ----------
const addDialogVisible = ref(false)
const selectDialogVisible = ref(false)
const submitting = ref(false)
const formRef = ref()
const addForm = reactive({
  customerId: '',
  customerName: '',
  amount: 0 as number,
  remark: '',
})

const amountRules = [
  { required: true, message: '请输入变动金额', trigger: 'blur' },
  {
    validator: (_rule: unknown, value: number, callback: (e?: Error) => void) => {
      if (value === 0 || value === null || value === undefined) return callback(new Error('金额不能为0（正数新增，负数调减）'))
      callback()
    },
    trigger: 'blur',
  },
]

function openAddDialog(row?: CreditSummaryItem) {
  addForm.customerId = row?.customer_id ?? ''
  addForm.customerName = row?.customer_name ?? ''
  addForm.amount = 0
  addForm.remark = ''
  addDialogVisible.value = true
}

function onCustomerConfirm(customer: CustomerItem) {
  addForm.customerId = customer.customer_id
  addForm.customerName = customer.customer_name
}

function handleDialogClosed() {
  formRef.value?.resetFields()
}

async function handleSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    const res = await addCreditLog({
      customer_id: addForm.customerId,
      amount: addForm.amount,
      remark: addForm.remark || undefined,
    })
    ElMessage.success(`操作成功，单据号：${res.data.bill_no}，当前授信余额：${res.data.new_credit_amount.toLocaleString()}`)
    addDialogVisible.value = false
    loadData()
  } catch {
    // request 拦截器已统一弹错，这里不重复提示
  } finally {
    submitting.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    let res
    if (searchForm.customerName || searchForm.customerId) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.customerName) {
        searchField.push('customer_name')
        searchValue.customer_name = searchForm.customerName
      }
      if (searchForm.customerId) {
        searchField.push('customer_id')
        searchValue.customer_id = searchForm.customerId
      }
      res = await searchCreditSummary({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    } else {
      res = await getCreditSummaryList({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    }
    tableData.value = res.data.customers
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleRowClick(row: { customer_id: string }) {
  router.push(`/customer/finance/credit/${row.customer_id}`)
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { customerName: '', customerId: '' }); handleSearch() }

const exportColumns = [
  { key: 'customer_name', label: '客户名称' },
  { key: 'credit_amount', label: '授信余额' }, { key: 'used_credit_amount', label: '已用额度' },
  { key: 'remaining_credit_amount', label: '可用余额' },
]

onMounted(() => { loadData() })
</script>

<style scoped>
.amount-warning { color: var(--el-color-danger); }
.amount-tip { width: 100%; font-size: 12px; color: var(--text-secondary, #909399); line-height: 1.6; margin-top: 4px; }
:deep(.credit-add-form .el-form-item__label) { white-space: nowrap; }
:deep(.el-table__footer-wrapper tbody td) {
  background: color-mix(in srgb, var(--el-color-primary-light-9) 45%, transparent);
  font-weight: 600;
}

:deep(.el-table__footer-wrapper tbody td .cell) {
  color: var(--el-text-color-primary);
}

:deep(.el-table__footer-wrapper tbody td:last-child) {
  background: color-mix(in srgb, var(--el-color-warning-light-8) 70%, transparent);
}

:deep(.el-table__footer-wrapper tbody td:last-child .cell) {
  color: var(--el-color-warning-dark-2);
  font-size: 16px;
  font-weight: 700;
}
</style>
