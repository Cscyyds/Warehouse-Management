<template>
  <div class="add-template-page">
    <div class="page-header">
      <div class="page-header-left">
        <el-icon class="back-icon" @click="router.back()"><ArrowLeft /></el-icon>
        <span class="back-label" @click="router.back()">返回</span>
        <span class="header-divider">/</span>
        <h3>新增月结收款单</h3>
      </div>
      <div class="header-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </div>
    </div>

    <div class="page-body">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px" label-position="top" size="default">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="客户" prop="customer_name">
              <el-input :model-value="form.customer_name" placeholder="请选择月结客户" readonly @click="customerDialogVisible = true" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="收款日期" prop="receipt_date">
              <el-date-picker
                v-model="form.receipt_date"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择"
                style="width:100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="收款方式" prop="receipt_method">
              <el-select v-model="form.receipt_method" placeholder="请选择" style="width:100%" @change="onMethodChange">
                <el-option label="现金" value="CASH" />
                <el-option label="银行转账" value="TRANSFER" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="银行账户" prop="bank_account_id">
              <el-select v-model="form.bank_account_id" placeholder="银行转账时必填" clearable style="width:100%" :loading="bankLoading">
                <el-option
                  v-for="b in bankOptions"
                  :key="b.bank_account_id"
                  :label="b.account_name"
                  :value="b.bank_account_id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="科目">
              <el-select v-model="form.subject_id" placeholder="请选择（选填）" clearable style="width:100%" :loading="subjectLoading">
                <el-option
                  v-for="s in subjectOptions"
                  :key="s.subject_id"
                  :label="s.name"
                  :value="s.subject_id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item label="备注">
              <el-input v-model="form.remark" placeholder="选填" />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-section-title">
          <span class="section-line" />
          收款明细
        </div>
        <div v-if="!items.length" class="dynamic-table-empty">
          <el-empty description="暂无数据" :image-size="56">
            <el-button size="small" @click="soDialogVisible = true" :disabled="!form.customer_id">
              <el-icon><Plus /></el-icon>添加销售订单
            </el-button>
          </el-empty>
        </div>
        <template v-else>
          <el-table :data="items" size="small" border style="width:100%">
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column prop="order_no" label="销售订单号" width="180" show-overflow-tooltip />
            <el-table-column prop="order_amount" label="订单金额" width="110" align="right">
              <template #default="{ row }">{{ row.order_amount }}</template>
            </el-table-column>
            <el-table-column prop="pending_receivable_amount" label="待收金额" width="110" align="right">
              <template #default="{ row }">{{ row.pending_receivable_amount }}</template>
            </el-table-column>
            <el-table-column label="收款金额 *" width="150">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.receipt_amount"
                  :min="0.01"
                  :precision="2"
                  controls-position="right"
                  style="width:100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="140">
              <template #default="{ row }">
                <el-input v-model="row.remark" placeholder="选填" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="60" align="center" fixed="right">
              <template #default="{ $index }">
                <el-button text type="danger" size="small" :icon="Delete" @click="removeItem($index)" />
              </template>
            </el-table-column>
          </el-table>
          <el-button class="add-row-btn" size="small" @click="soDialogVisible = true" :disabled="!form.customer_id">
            <el-icon><Plus /></el-icon>添加销售订单
          </el-button>
        </template>
      </el-form>
    </div>

    <!-- 客户选择弹窗 -->
    <CustomerSelectDialog
      v-model="customerDialogVisible"
      @confirm="onCustomerConfirmed"
    />

    <!-- 月结销售订单选择弹窗 -->
    <MonthlySalesOrderSelectDialog
      v-model="soDialogVisible"
      :multiple="true"
      :customer-id="form.customer_id || ''"
      @confirmMultiple="onSalesOrdersConfirmed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { ArrowLeft, Plus, Delete } from '@element-plus/icons-vue'
import {
  createMonthlyReceiptOrder,
  getBankAccountList,
  getAccountSubjectTree,
  type CustomerItem,
  type UnpaidSalesOrderItem,
} from '@/api'
import CustomerSelectDialog from '@/views/customer/CustomerSelectDialog.vue'
import MonthlySalesOrderSelectDialog from '@/views/sales/MonthlySalesOrderSelectDialog.vue'

const router = useRouter()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const customerDialogVisible = ref(false)
const soDialogVisible = ref(false)
const bankLoading = ref(false)
const subjectLoading = ref(false)
const bankOptions = ref<Array<{ bank_account_id: string; account_name: string }>>([])
const subjectOptions = ref<Array<{ subject_id: string; name: string }>>([])

const form = reactive({
  customer_id: '',
  customer_name: '',
  receipt_date: '',
  receipt_method: '',
  subject_id: '',
  bank_account_id: '',
  remark: '',
})

type ItemRow = {
  sales_order_id: string
  order_no: string
  order_amount: string
  pending_receivable_amount: string
  receipt_amount: number
  remark: string
}
const items = ref<ItemRow[]>([])

const rules: FormRules = {
  customer_name: [{ required: true, message: '请选择月结客户', trigger: 'change' }],
  receipt_date: [{ required: true, message: '请选择收款日期', trigger: 'change' }],
  receipt_method: [{ required: true, message: '请选择收款方式', trigger: 'change' }],
  bank_account_id: [
    {
      validator: (_rule, _value, callback) => {
        if (form.receipt_method === 'TRANSFER' && !form.bank_account_id) {
          callback(new Error('银行转账方式必须选择银行账户'))
        } else {
          callback()
        }
      },
      trigger: 'change',
    },
  ],
}

function onMethodChange() {
  if (form.receipt_method !== 'TRANSFER') form.bank_account_id = ''
  formRef.value?.validateField('bank_account_id')
}

function onCustomerConfirmed(customer: CustomerItem) {
  if (customer.is_monthly_settlement !== 1) {
    ElMessage.warning('请选择月结客户')
    return
  }
  form.customer_id = customer.customer_id
  form.customer_name = customer.customer_name
  formRef.value?.validateField('customer_name')
}

function onSalesOrdersConfirmed(orders: UnpaidSalesOrderItem[]) {
  orders.forEach(o => {
    if (!items.value.find(i => i.sales_order_id === o.sales_order_id)) {
      items.value.push({
        sales_order_id: o.sales_order_id,
        order_no: o.sales_order_no,
        order_amount: o.receivable_amount || '0',
        pending_receivable_amount: '0',
        receipt_amount: 0,
        remark: '',
      })
    }
  })
}

async function removeItem(idx: number) {
  try {
    await ElMessageBox.confirm('确认删除该收款明细？', '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger'
    })
    items.value.splice(idx, 1)
  } catch {}
}

function handleReset() {
  formRef.value?.resetFields()
  Object.assign(form, { customer_id: '', customer_name: '', receipt_date: '', receipt_method: '', subject_id: '', bank_account_id: '', remark: '' })
  items.value = []
}

async function handleSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (items.value.length === 0) {
    ElMessage.warning('请至少添加一条收款明细')
    return
  }
  const invalidIdx = items.value.findIndex(i => !i.receipt_amount || i.receipt_amount <= 0)
  if (invalidIdx !== -1) {
    ElMessage.warning(`第 ${invalidIdx + 1} 行收款金额必须大于 0`)
    return
  }

  submitting.value = true
  try {
    await createMonthlyReceiptOrder({
      customer_id: form.customer_id,
      receipt_date: form.receipt_date,
      receipt_method: form.receipt_method,
      subject_id: form.subject_id || undefined,
      bank_account_id: form.bank_account_id || undefined,
      remark: form.remark || undefined,
      items: JSON.stringify(items.value.map(i => ({
        sales_order_id: i.sales_order_id,
        receipt_amount: String(i.receipt_amount),
        remark: i.remark || undefined,
      }))),
    })
    ElMessage.success('月结收款单创建成功')
    router.push('/finance/gift')
  } catch (err: any) {
    ElMessage.error(err?.message || '创建失败')
  } finally {
    submitting.value = false
  }
}

async function loadBankAccounts() {
  bankLoading.value = true
  try {
    const res = await getBankAccountList({ page: 1, page_size: 100 })
    bankOptions.value = (res.data.items || []).map((b: any) => ({ bank_account_id: b.bank_account_id, account_name: b.account_name }))
  } catch {
    bankOptions.value = []
  } finally {
    bankLoading.value = false
  }
}

async function loadSubjects() {
  subjectLoading.value = true
  try {
    const res = await getAccountSubjectTree({ page: 1, page_size: 100 })
    const flatten = (nodes: any[]): any[] => nodes.flatMap(n => [n, ...(n.children ? flatten(n.children) : [])])
    subjectOptions.value = flatten(res.data?.items || []).map((n: any) => ({ subject_id: n.subject_id, name: n.name }))
  } catch {
    subjectOptions.value = []
  } finally {
    subjectLoading.value = false
  }
}

onMounted(() => { loadBankAccounts(); loadSubjects() })
</script>

<style scoped>
.add-template-page { background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-xs); }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; border-bottom: 1px solid var(--border-light); }
.page-header-left { display: flex; align-items: center; gap: 8px; }
.back-icon { cursor: pointer; color: var(--text-secondary); font-size: 16px; transition: color var(--transition-fast); }
.back-icon:hover { color: var(--primary); }
.back-label { cursor: pointer; font-size: 14px; color: var(--text-secondary); transition: color var(--transition-fast); }
.back-label:hover { color: var(--primary); }
.header-divider { color: var(--text-tertiary); font-size: 14px; margin: 0 2px; }
.page-header h3 { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.header-actions { display: flex; gap: 8px; }
.page-body { padding: 20px 24px; }
.form-section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 24px 0 14px; padding-left: 4px; }
.form-section-title:first-child { margin-top: 4px; }
.section-line { width: 4px; height: 16px; background: var(--primary-gradient); border-radius: 2px; flex-shrink: 0; }
.dynamic-table-empty { width: 100%; box-sizing: border-box; border: 1px dashed var(--border-color); border-radius: 6px; padding: 16px 0; }
.add-row-btn { margin-top: 8px; }
</style>
