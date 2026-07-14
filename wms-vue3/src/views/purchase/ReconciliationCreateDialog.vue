<template>
  <el-dialog
    title="新增采购对账单"
    :model-value="modelValue"
    width="720px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" label-position="top">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="供应商" prop="supplier_id">
            <el-select
              v-model="form.supplier_id"
              filterable
              placeholder="请选择供应商"
              style="width: 100%"
              @change="handleSupplierChange"
            >
              <el-option
                v-for="s in supplierOptions"
                :key="s.supplier_id"
                :label="s.supplier_name"
                :value="s.supplier_id"
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
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="折扣比例(%)">
            <el-input-number v-model="form.discount_rate" :min="0" :max="100" :precision="2" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="抵扣金额">
            <el-input-number v-model="form.deduction_amount" :precision="2" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="备注">
            <el-input v-model="form.remark" placeholder="选填" />
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 采购单选择 -->
      <el-form-item label="采购订单" prop="purchase_order_ids">
        <div class="order-select-area">
          <el-button size="small" :disabled="!form.supplier_id" @click="showOrderPicker = true">
            选择采购单
          </el-button>
          <span class="order-count">已选 {{ form.purchase_order_ids.length }} 单</span>
        </div>
        <el-table v-if="selectedOrders.length" :data="selectedOrders" size="small" style="width: 100%; margin-top: 8px" max-height="180">
          <el-table-column prop="order_no" label="采购单号" min-width="140" />
          <el-table-column prop="payable_amount" label="应付金额" width="120" align="right" />
          <el-table-column prop="paid_amount" label="已付金额" width="120" align="right" />
          <el-table-column label="" width="60" align="center">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="removeOrder($index)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-form-item>

      <!-- 退货单选择（可选） -->
      <el-form-item label="退货单（可选）">
        <div class="order-select-area">
          <el-button size="small" :disabled="!form.supplier_id" @click="showReturnPicker = true">
            选择退货单
          </el-button>
          <span class="order-count">已选 {{ form.purchase_return_ids.length }} 单</span>
        </div>
        <el-table v-if="selectedReturns.length" :data="selectedReturns" size="small" style="width: 100%; margin-top: 8px" max-height="180">
          <el-table-column prop="return_no" label="退货单号" min-width="140" />
          <el-table-column prop="return_amount" label="退货金额" width="120" align="right" />
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

    <!-- 采购单选择弹窗 -->
    <OrderPickerDialog
      v-model="showOrderPicker"
      :supplier-id="form.supplier_id"
      :excluded-ids="form.purchase_order_ids"
      @select="handleOrderSelect"
    />

    <!-- 退货单选择弹窗 -->
    <ReturnPickerDialog
      v-model="showReturnPicker"
      :supplier-id="form.supplier_id"
      :excluded-ids="form.purchase_return_ids"
      @select="handleReturnSelect"
    />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { getSupplierList, createPurchaseReconciliation } from '@/api'
import OrderPickerDialog from './ReconciliationOrderPicker.vue'
import ReturnPickerDialog from './ReconciliationReturnPicker.vue'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'success'): void
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const showOrderPicker = ref(false)
const showReturnPicker = ref(false)
const supplierOptions = ref<Array<{ supplier_id: string; supplier_name: string }>>([])

const form = reactive({
  supplier_id: '',
  reconciliation_date: '',
  discount_rate: 0,
  deduction_amount: 0,
  remark: '',
  purchase_order_ids: [] as string[],
  purchase_return_ids: [] as string[]
})

const selectedOrders = ref<Array<{ purchase_order_id: string; order_no: string; payable_amount: string; paid_amount: string }>>([])
const selectedReturns = ref<Array<{ purchase_return_id: string; return_no: string; return_amount: string }>>([])

const rules: FormRules = {
  supplier_id: [{ required: true, message: '请选择供应商', trigger: 'change' }],
  reconciliation_date: [{ required: true, message: '请选择对账日期', trigger: 'change' }],
  purchase_order_ids: [{ type: 'array', required: true, min: 1, message: '请至少选择一个采购单', trigger: 'change' }]
}

function handleSupplierChange() {
  form.purchase_order_ids = []
  form.purchase_return_ids = []
  selectedOrders.value = []
  selectedReturns.value = []
}

function handleOrderSelect(orders: Array<{ purchase_order_id: string; order_no: string; payable_amount: string; paid_amount: string }>) {
  orders.forEach(o => {
    if (!form.purchase_order_ids.includes(o.purchase_order_id)) {
      form.purchase_order_ids.push(o.purchase_order_id)
      selectedOrders.value.push(o)
    }
  })
}

function handleReturnSelect(returns: Array<{ purchase_return_id: string; return_no: string; return_amount: string }>) {
  returns.forEach(r => {
    if (!form.purchase_return_ids.includes(r.purchase_return_id)) {
      form.purchase_return_ids.push(r.purchase_return_id)
      selectedReturns.value.push(r)
    }
  })
}

function removeOrder(idx: number) {
  form.purchase_order_ids.splice(idx, 1)
  selectedOrders.value.splice(idx, 1)
}

function removeReturn(idx: number) {
  form.purchase_return_ids.splice(idx, 1)
  selectedReturns.value.splice(idx, 1)
}

async function handleSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await createPurchaseReconciliation({
      supplier_id: form.supplier_id,
      reconciliation_date: form.reconciliation_date,
      purchase_order_ids: form.purchase_order_ids,
      discount_rate: form.discount_rate || undefined,
      deduction_amount: form.deduction_amount || undefined,
      remark: form.remark || undefined,
      purchase_return_ids: form.purchase_return_ids.length ? form.purchase_return_ids : undefined
    })
    ElMessage.success('采购对账单创建成功')
    emit('update:modelValue', false)
    emit('success')
  } catch (err: any) {
    ElMessage.error(err?.message || '创建失败')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    const res = await getSupplierList({ page: 1 })
    supplierOptions.value = (res.data.supplier || []).map((s: any) => ({
      supplier_id: s.supplier_id,
      supplier_name: s.supplier_name
    }))
  } catch {}
})
</script>

<style scoped>
.order-select-area {
  display: flex;
  align-items: center;
  gap: 12px;
}
.order-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
