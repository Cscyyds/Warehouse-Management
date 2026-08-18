<template>
  <div class="add-template-page">
    <div class="page-header">
      <div class="page-header-left">
        <el-icon class="back-icon" @click="router.back()"><ArrowLeft /></el-icon>
        <span class="back-label" @click="router.back()">返回</span>
        <span class="header-divider">/</span>
        <h3>新增销售对账单</h3>
      </div>
      <div class="header-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </div>
    </div>

    <div class="page-body">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" label-position="top" size="default">
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="对账类型">
              <el-segmented v-model="reconciliationType" :options="typeOptions" @change="handleTypeChange" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="客户" prop="customer_id">
              <el-input
                v-model="form.customer_name"
                placeholder="点击选择客户"
                readonly
                @click="customerDialogVisible = true"
              >
                <template #suffix>
                  <el-icon style="cursor:pointer" @click.stop="customerDialogVisible = true"><Search /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="对账日期" prop="reconciliation_date">
              <el-date-picker
                v-model="form.reconciliation_date"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择"
                style="width:100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="折扣比例(%)">
              <el-input-number v-model="form.discount_rate" :min="0" :max="100" :precision="2" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="抵扣金额">
              <el-input-number v-model="form.deduction_amount" :precision="2" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item label="备注">
              <el-input v-model="form.remark" placeholder="选填" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="销售订单" prop="sales_order_ids">
          <div class="order-select-area">
            <el-button size="small" :disabled="!form.customer_id" @click="showOrderPicker = true">选择销售单</el-button>
            <span class="order-count">已选 {{ selectedOrders.length }} 单</span>
          </div>
          <el-table border v-if="selectedOrders.length" :data="selectedOrders" size="small" style="width:100%;margin-top:8px" max-height="200">
            <el-table-column prop="sales_order_no" label="销售单号" min-width="160" show-overflow-tooltip />
            <el-table-column prop="receivable_amount" label="应收金额" width="130" align="right" show-overflow-tooltip />
            <el-table-column label="" width="70" align="center">
              <template #default="{ $index }">
                <el-button link type="danger" size="small" @click="removeOrder($index)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>

        <!-- 退货单仅月结对账时可选择，其他结算方式对账不涉及退货单 -->
        <el-form-item v-if="reconciliationType === 'MONTHLY'" label="退货单（可选）">
          <div class="order-select-area">
            <el-button size="small" :disabled="!form.customer_id" @click="showReturnPicker = true">选择退货单</el-button>
            <span class="order-count">已选 {{ selectedReturns.length }} 单</span>
          </div>
          <el-table border v-if="selectedReturns.length" :data="selectedReturns" size="small" style="width:100%;margin-top:8px" max-height="200">
            <el-table-column prop="return_no" label="退货单号" min-width="160" show-overflow-tooltip />
            <el-table-column prop="return_amount" label="退货金额" width="130" align="right" show-overflow-tooltip />
            <el-table-column label="" width="70" align="center">
              <template #default="{ $index }">
                <el-button link type="danger" size="small" @click="removeReturn($index)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>
      </el-form>
    </div>

    <CustomerSelectDialog
      v-model="customerDialogVisible"
      @confirm="onCustomerConfirm"
    />
    <OrderPickerDialog
      v-model="showOrderPicker"
      :customer-id="form.customer_id"
      :excluded-ids="form.sales_order_ids"
      :settlement-method="reconciliationType"
      @select="handleOrderSelect"
    />
    <ReturnPickerDialog
      v-if="reconciliationType === 'MONTHLY'"
      v-model="showReturnPicker"
      :customer-id="form.customer_id"
      :excluded-ids="form.sales_return_ids"
      :settlement-method="reconciliationType"
      @select="handleReturnSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { ArrowLeft, Search } from '@element-plus/icons-vue'
import { createSalesReconciliation, type UnpaidSalesOrderItem, type PayableSalesReturnItem } from '@/api'
import type { CustomerItem } from '@/api'
import CustomerSelectDialog from '@/views/customer/CustomerSelectDialog.vue'
import OrderPickerDialog from './SalesReconciliationOrderPicker.vue'
import ReturnPickerDialog from './SalesReconciliationReturnPicker.vue'

const router = useRouter()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const customerDialogVisible = ref(false)
const showOrderPicker = ref(false)
const showReturnPicker = ref(false)

const form = reactive({
  customer_id: '',
  customer_name: '',
  reconciliation_date: '',
  discount_rate: 0,
  deduction_amount: 0,
  remark: '',
  sales_order_ids: [] as string[],
  sales_return_ids: [] as string[],
})

// 对账类型：月结对账 / 其他结算方式对账（决定销售单结算方式筛选 + 退货单是否可选）
const reconciliationType = ref<'MONTHLY' | 'OTHER'>('MONTHLY')
const typeOptions = [
  { label: '月结对账', value: 'MONTHLY' },
  { label: '其他结算方式对账', value: 'OTHER' },
]

function handleTypeChange() {
  // 切换对账类型时清空已选销售单/退货单（结算方式条件已变化）
  form.sales_order_ids = []
  form.sales_return_ids = []
  selectedOrders.value = []
  selectedReturns.value = []
}

const selectedOrders = ref<Array<{ sales_order_id: string; sales_order_no: string; receivable_amount: string }>>([])
const selectedReturns = ref<Array<{ sales_return_id: string; return_no: string; return_amount: string }>>([])

const rules: FormRules = {
  customer_id: [{ required: true, message: '请选择客户', trigger: 'change' }],
  reconciliation_date: [{ required: true, message: '请选择对账日期', trigger: 'change' }],
  sales_order_ids: [{ type: 'array', required: true, min: 1, message: '请至少选择一个销售单', trigger: 'change' }],
}

function onCustomerConfirm(customer: CustomerItem) {
  if (form.customer_id !== customer.customer_id) {
    form.sales_order_ids = []
    form.sales_return_ids = []
    selectedOrders.value = []
    selectedReturns.value = []
  }
  form.customer_id = customer.customer_id
  form.customer_name = customer.customer_name
}

function handleOrderSelect(orders: UnpaidSalesOrderItem[]) {
  orders.forEach(o => {
    if (!form.sales_order_ids.includes(o.sales_order_id)) {
      form.sales_order_ids.push(o.sales_order_id)
      selectedOrders.value.push({
        sales_order_id: o.sales_order_id,
        sales_order_no: o.sales_order_no,
        receivable_amount: o.receivable_amount,
      })
    }
  })
}

function handleReturnSelect(returns: PayableSalesReturnItem[]) {
  returns.forEach(r => {
    if (!form.sales_return_ids.includes(r.sales_return_id)) {
      form.sales_return_ids.push(r.sales_return_id)
      selectedReturns.value.push({
        sales_return_id: r.sales_return_id,
        return_no: r.return_no,
        return_amount: r.return_amount,
      })
    }
  })
}

function removeOrder(idx: number) {
  form.sales_order_ids.splice(idx, 1)
  selectedOrders.value.splice(idx, 1)
}

function removeReturn(idx: number) {
  form.sales_return_ids.splice(idx, 1)
  selectedReturns.value.splice(idx, 1)
}

function handleReset() {
  formRef.value?.resetFields()
  reconciliationType.value = 'MONTHLY'
  Object.assign(form, {
    customer_id: '',
    customer_name: '',
    reconciliation_date: '',
    discount_rate: 0,
    deduction_amount: 0,
    remark: '',
    sales_order_ids: [],
    sales_return_ids: [],
  })
  selectedOrders.value = []
  selectedReturns.value = []
}

async function handleSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    await createSalesReconciliation({
      customer_id: form.customer_id,
      reconciliation_date: form.reconciliation_date,
      sales_order_ids: form.sales_order_ids,
      discount_rate: form.discount_rate || undefined,
      deduction_amount: form.deduction_amount || undefined,
      remark: form.remark || undefined,
      sales_return_ids: form.sales_return_ids.length ? form.sales_return_ids : undefined,
    })
    ElMessage.success('销售对账单创建成功')
    router.push('/sales/reconciliation')
  } catch (err: any) {
    ElMessage.error(err?.message || '创建失败')
  } finally {
    submitting.value = false
  }
}
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
.order-select-area { display: flex; align-items: center; gap: 12px; }
.order-count { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
