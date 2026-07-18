<template>
  <el-dialog
    title="新增销售对账单"
    :model-value="modelValue"
    width="720px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" label-position="top">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="客户" prop="customer_id">
            <el-select
              v-model="form.customer_id"
              filterable
              remote
              :remote-method="fetchCustomers"
              :loading="customerLoading"
              placeholder="输入搜索客户"
              style="width:100%"
              @change="handleCustomerChange"
            >
              <el-option
                v-for="c in customerOptions"
                :key="c.customer_id"
                :label="c.customer_name"
                :value="c.customer_id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
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
        <el-col :span="8">
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
        <el-table v-if="selectedOrders.length" :data="selectedOrders" size="small" style="width:100%;margin-top:8px" max-height="180">
          <el-table-column prop="sales_order_no" label="销售单号" show-overflow-tooltip min-width="150" />
          <el-table-column prop="receivable_amount" label="应收金额" show-overflow-tooltip width="120" align="right" />
          <el-table-column label="" width="60" align="center">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="removeOrder($index)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-form-item>

      <el-form-item label="退货单（可选）">
        <div class="order-select-area">
          <el-button size="small" :disabled="!form.customer_id" @click="showReturnPicker = true">选择退货单</el-button>
          <span class="order-count">已选 {{ selectedReturns.length }} 单</span>
        </div>
        <el-table v-if="selectedReturns.length" :data="selectedReturns" size="small" style="width:100%;margin-top:8px" max-height="180">
          <el-table-column prop="return_no" label="退货单号" show-overflow-tooltip min-width="150" />
          <el-table-column prop="return_amount" label="退货金额" show-overflow-tooltip width="120" align="right" />
          <el-table-column label="" width="60" align="center">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="removeReturn($index)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确认创建</el-button>
    </template>

    <OrderPickerDialog
      v-model="showOrderPicker"
      :customer-id="form.customer_id"
      :excluded-ids="form.sales_order_ids"
      @select="handleOrderSelect"
    />
    <ReturnPickerDialog
      v-model="showReturnPicker"
      :customer-id="form.customer_id"
      :excluded-ids="form.sales_return_ids"
      @select="handleReturnSelect"
    />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { searchCustomers, createSalesReconciliation, type SalesOrderListItemV2, type SalesReturnListItem } from '@/api'
import type { CustomerItem } from '@/api/modules/customer'
import OrderPickerDialog from './SalesReconciliationOrderPicker.vue'
import ReturnPickerDialog from './SalesReconciliationReturnPicker.vue'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'success'): void
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const showOrderPicker = ref(false)
const showReturnPicker = ref(false)
const customerLoading = ref(false)
const customerOptions = ref<Array<{ customer_id: string; customer_name: string }>>([])

const form = reactive({
  customer_id: '',
  reconciliation_date: '',
  discount_rate: 0,
  deduction_amount: 0,
  remark: '',
  sales_order_ids: [] as string[],
  sales_return_ids: [] as string[],
})

const selectedOrders = ref<Array<{ sales_order_id: string; sales_order_no: string; receivable_amount: string }>>([])
const selectedReturns = ref<Array<{ sales_return_id: string; return_no: string; return_amount: string }>>([])

const rules: FormRules = {
  customer_id: [{ required: true, message: '请选择客户', trigger: 'change' }],
  reconciliation_date: [{ required: true, message: '请选择对账日期', trigger: 'change' }],
  sales_order_ids: [{ type: 'array', required: true, min: 1, message: '请至少选择一个销售单', trigger: 'change' }],
}

async function fetchCustomers(query: string) {
  if (!query) return
  customerLoading.value = true
  try {
    const res = await searchCustomers({
      search_field: JSON.stringify(['customer_name']),
      search_value: JSON.stringify({ customer_name: query }),
    })
    customerOptions.value = (res.data.customer || []).map((c: CustomerItem) => ({
      customer_id: c.customer_id,
      customer_name: c.customer_name,
    }))
  } catch {
    customerOptions.value = []
  } finally {
    customerLoading.value = false
  }
}

function handleCustomerChange() {
  form.sales_order_ids = []
  form.sales_return_ids = []
  selectedOrders.value = []
  selectedReturns.value = []
}

function handleOrderSelect(orders: SalesOrderListItemV2[]) {
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

function handleReturnSelect(returns: SalesReturnListItem[]) {
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
    emit('update:modelValue', false)
    emit('success')
  } catch (err: any) {
    ElMessage.error(err?.message || '创建失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.order-select-area { display: flex; align-items: center; gap: 12px; }
.order-count { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
