<template>
  <el-dialog
    title="付款单明细管理"
    :model-value="modelValue"
    width="1000px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div v-loading="loading" class="item-dialog-body">
      <div class="order-info">
        <el-tag type="info" size="small">{{ order?.payment_no || '-' }}</el-tag>
        <span class="info-text">供应商：{{ order?.supplier_name || '-' }}</span>
        <span class="info-text">付款总额：{{ detail?.total_payment_amount || '-' }}</span>
        <span class="info-text">订单总额：{{ detail?.total_order_amount || '-' }}</span>
      </div>

      <el-button type="primary" size="small" @click="handleAddItems" style="margin-bottom:8px">
        <el-icon><Plus /></el-icon>新增付款明细
      </el-button>

      <el-table :data="detail?.items || []" size="small" border style="width:100%">
        <el-table-column type="index" label="" width="50" align="center" />
        <el-table-column prop="order_no" label="采购订单号" width="180" show-overflow-tooltip />
        <el-table-column prop="order_amount" label="订单金额" width="120" align="right" show-overflow-tooltip />
        <el-table-column prop="payment_amount" label="付款金额" width="120" align="right" show-overflow-tooltip />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEditItem(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDeleteItem(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 选择可付款采购订单 -->
    <UnpaidOrderSelectDialog
      v-model="unpaidDialogVisible"
      :supplier-id="order?.supplier_id || ''"
      :exclude-order-ids="existingOrderIds"
      @confirmMultiple="onUnpaidOrdersConfirmed"
    />

    <!-- 编辑明细 -->
    <el-dialog
      v-model="itemFormVisible"
      title="编辑付款明细"
      width="460px"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form :model="itemForm" label-width="100px" size="default">
        <el-form-item label="采购订单号">
          <el-input :model-value="itemForm.order_no" disabled />
        </el-form-item>
        <el-form-item label="付款金额" required>
          <el-input-number v-model="itemForm.payment_amount" :min="0.01" :precision="2" controls-position="right" style="width:100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="itemForm.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitItemEdit">确定</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { global_opt_width } from '@/utils/data'
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  getPaymentOrderDetail,
  addPaymentOrderItems, updatePaymentOrderItem, deletePaymentOrderItem,
  type PaymentOrderListItem, type PaymentOrderDetail, type PaymentOrderItem,
  type UnpaidOrderListItem
} from '@/api'
import UnpaidOrderSelectDialog from './UnpaidOrderSelectDialog.vue'

const props = defineProps<{
  modelValue: boolean
  order: PaymentOrderListItem | null
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'changed': []
}>()

const loading = ref(false)
const submitting = ref(false)
const detail = ref<PaymentOrderDetail | null>(null)
const unpaidDialogVisible = ref(false)
const itemFormVisible = ref(false)

const itemForm = reactive({ payment_item_id: '', order_no: '', payment_amount: 0, remark: '' })

const existingOrderIds = computed(() =>
  (detail.value?.items ?? []).map(i => i.purchase_order_id)
)

async function onOpen() {
  detail.value = null
  if (!props.order?.payment_order_id) return
  await loadDetail()
}

async function loadDetail() {
  if (!props.order?.payment_order_id) return
  loading.value = true
  try {
    const res = await getPaymentOrderDetail(props.order.payment_order_id)
    detail.value = res.data
  } catch {
    detail.value = null
  } finally {
    loading.value = false
  }
}

function handleAddItems() {
  if (!props.order?.supplier_id) {
    ElMessage.warning('付款单缺少供应商信息')
    return
  }
  unpaidDialogVisible.value = true
}

async function onUnpaidOrdersConfirmed(orders: UnpaidOrderListItem[]) {
  if (orders.length === 0) return
  submitting.value = true
  try {
    const items = orders.map(o => ({
      purchase_order_id: o.purchase_order_id,
      payment_amount: o.pending_payable_amount
    }))
    await addPaymentOrderItems(props.order!.payment_order_id, items)
    ElMessage.success('付款明细已新增')
    await loadDetail()
    emit('changed')
  } catch {
    // error handled by interceptor
  } finally {
    submitting.value = false
  }
}

function handleEditItem(row: PaymentOrderItem) {
  Object.assign(itemForm, {
    payment_item_id: row.payment_item_id,
    order_no: row.order_no,
    payment_amount: Number(row.payment_amount) || 0,
    remark: row.remark || ''
  })
  itemFormVisible.value = true
}

async function submitItemEdit() {
  if (itemForm.payment_amount <= 0) { ElMessage.warning('付款金额必须大于0'); return }
  submitting.value = true
  try {
    await updatePaymentOrderItem(itemForm.payment_item_id, {
      payment_amount: String(itemForm.payment_amount),
      remark: itemForm.remark || undefined
    })
    ElMessage.success('明细已更新')
    itemFormVisible.value = false
    await loadDetail()
    emit('changed')
  } catch {
    // error handled by interceptor
  } finally {
    submitting.value = false
  }
}

async function handleDeleteItem(row: PaymentOrderItem) {
  try {
    await ElMessageBox.confirm(`确认删除采购订单「${row.order_no}」的付款明细？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deletePaymentOrderItem(row.payment_item_id)
    ElMessage.success('删除成功')
    await loadDetail()
    emit('changed')
  } catch {
    // cancelled or error
  }
}
</script>

<style scoped>
.item-dialog-body { min-height: 300px; }
.order-info { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.order-info .info-text { font-size: 13px; color: var(--text-secondary); }
</style>
