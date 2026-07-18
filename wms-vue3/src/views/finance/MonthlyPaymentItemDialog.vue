<template>
  <el-dialog
    title="月结付款单明细管理"
    :model-value="modelValue"
    width="1100px"
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

      <el-tabs v-model="activeTab">
        <el-tab-pane label="付款明细" name="items">
          <el-button type="primary" size="small" @click="handleAddItem" style="margin-bottom:8px">
            <el-icon><Plus /></el-icon>新增付款明细
          </el-button>
          <el-table :data="detail?.items || []" size="small" border style="width:100%">
            <el-table-column type="index" label="" width="50" align="center" />
            <el-table-column prop="order_no" label="采购订单号" width="180" show-overflow-tooltip />
            <el-table-column prop="order_amount" label="订单金额" show-overflow-tooltip width="120" align="right" />
            <el-table-column prop="payment_amount" label="付款金额" show-overflow-tooltip width="120" align="right" />
            <el-table-column prop="paid_amount" label="已付金额" width="120" align="right">
              <template #default="{ row }">{{ row.paid_amount || '-' }}</template>
            </el-table-column>
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
        </el-tab-pane>

        <el-tab-pane label="退货明细" name="returnItems">
          <el-button type="primary" size="small" @click="handleAddReturn" style="margin-bottom:8px">
            <el-icon><Plus /></el-icon>新增退货明细
          </el-button>
          <el-table :data="detail?.return_items || []" size="small" border style="width:100%">
            <el-table-column type="index" label="" width="50" align="center" />
            <el-table-column prop="return_no" label="退货单号" width="180" show-overflow-tooltip />
            <el-table-column prop="return_amount" label="退货金额" show-overflow-tooltip width="120" align="right" />
            <el-table-column prop="actual_credit_adjust_amount" label="实际调增授信" show-overflow-tooltip width="130" align="right" />
            <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.remark || '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="handleEditReturn(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="handleDeleteReturn(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 待付款采购订单选择弹窗 -->
    <UnpaidOrderSelectDialog
      v-model="poDialogVisible"
      :supplier-id="order?.supplier_id || ''"
      :exclude-order-ids="existingOrderIds"
      @confirmMultiple="onPurchaseOrderConfirmed"
    />

    <!-- 退货单选择弹窗 -->
    <PurchaseReturnSelectDialog
      v-model="returnDialogVisible"
      :multiple="true"
      @confirmMultiple="onReturnConfirmed"
    />

    <!-- 编辑付款明细表单 -->
    <el-dialog
      v-model="itemFormVisible"
      title="编辑付款明细"
      width="480px"
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

    <!-- 编辑退货明细表单 -->
    <el-dialog
      v-model="returnFormVisible"
      title="编辑退货明细"
      width="480px"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form :model="returnForm" label-width="100px" size="default">
        <el-form-item label="退货单号">
          <el-input :model-value="returnForm.return_no" disabled />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="returnForm.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="returnFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitReturnEdit">确定</el-button>
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
  getMonthlyPaymentOrderDetail,
  addMonthlyPaymentItems, updateMonthlyPaymentItem, deleteMonthlyPaymentItem,
  addMonthlyPaymentReturnItems, updateMonthlyPaymentReturnItem, deleteMonthlyPaymentReturnItem,
  type MonthlyPaymentOrderListItem, type MonthlyPaymentOrderDetail,
  type MonthlyPaymentItem, type MonthlyPaymentReturnItem,
  type UnpaidOrderListItem, type PurchaseReturnListItem
} from '@/api'
import UnpaidOrderSelectDialog from './UnpaidOrderSelectDialog.vue'
import PurchaseReturnSelectDialog from './PurchaseReturnSelectDialog.vue'

const props = defineProps<{
  modelValue: boolean
  order: MonthlyPaymentOrderListItem | null
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'changed': []
}>()

const loading = ref(false)
const submitting = ref(false)
const activeTab = ref('items')
const detail = ref<MonthlyPaymentOrderDetail | null>(null)

const poDialogVisible = ref(false)
const returnDialogVisible = ref(false)
const itemFormVisible = ref(false)
const returnFormVisible = ref(false)

const itemForm = reactive({ monthly_payment_item_id: '', order_no: '', payment_amount: 0, remark: '' })
const returnForm = reactive({ monthly_return_id: '', return_no: '', remark: '' })

const existingOrderIds = computed(() => (detail.value?.items || []).map((i: any) => i.purchase_order_id || i.order_id).filter(Boolean))

async function onOpen() {
  detail.value = null
  activeTab.value = 'items'
  if (!props.order?.monthly_payment_id) return
  await loadDetail()
}

async function loadDetail() {
  if (!props.order?.monthly_payment_id) return
  loading.value = true
  try {
    const res = await getMonthlyPaymentOrderDetail(props.order.monthly_payment_id)
    detail.value = res.data
  } catch {
    detail.value = null
  } finally {
    loading.value = false
  }
}

// ========== 付款明细 ==========
function handleAddItem() {
  poDialogVisible.value = true
}

async function onPurchaseOrderConfirmed(orders: UnpaidOrderListItem[]) {
  if (orders.length === 0) return
  submitting.value = true
  try {
    const items = orders.map(o => ({
      purchase_order_id: o.purchase_order_id,
      payment_amount: o.pending_payable_amount || o.payable_amount || '0',
    }))
    await addMonthlyPaymentItems(props.order!.monthly_payment_id, items)
    ElMessage.success('付款明细已新增')
    await loadDetail()
    emit('changed')
  } catch {
    // error handled by interceptor
  } finally {
    submitting.value = false
  }
}

function handleEditItem(row: MonthlyPaymentItem) {
  Object.assign(itemForm, {
    monthly_payment_item_id: row.monthly_payment_item_id,
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
    await updateMonthlyPaymentItem(itemForm.monthly_payment_item_id, {
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

async function handleDeleteItem(row: MonthlyPaymentItem) {
  try {
    await ElMessageBox.confirm(`确认删除采购订单「${row.order_no}」的付款明细？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteMonthlyPaymentItem(row.monthly_payment_item_id)
    ElMessage.success('删除成功')
    await loadDetail()
    emit('changed')
  } catch {
    // cancelled or error
  }
}

// ========== 退货明细 ==========
function handleAddReturn() {
  returnDialogVisible.value = true
}

async function onReturnConfirmed(items: PurchaseReturnListItem[]) {
  if (items.length === 0) return
  submitting.value = true
  try {
    const returnItems = items.map(r => ({
      purchase_return_id: r.purchase_return_id,
      remark: ''
    }))
    await addMonthlyPaymentReturnItems(props.order!.monthly_payment_id, returnItems)
    ElMessage.success('退货明细已新增')
    await loadDetail()
    emit('changed')
  } catch {
    // error handled by interceptor
  } finally {
    submitting.value = false
  }
}

function handleEditReturn(row: MonthlyPaymentReturnItem) {
  Object.assign(returnForm, {
    monthly_return_id: row.monthly_return_id,
    return_no: row.return_no,
    remark: row.remark || ''
  })
  returnFormVisible.value = true
}

async function submitReturnEdit() {
  submitting.value = true
  try {
    await updateMonthlyPaymentReturnItem(returnForm.monthly_return_id, {
      remark: returnForm.remark || undefined
    })
    ElMessage.success('退货明细已更新')
    returnFormVisible.value = false
    await loadDetail()
    emit('changed')
  } catch {
    // error handled by interceptor
  } finally {
    submitting.value = false
  }
}

async function handleDeleteReturn(row: MonthlyPaymentReturnItem) {
  try {
    await ElMessageBox.confirm(`确认删除退货单「${row.return_no}」的退货明细？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteMonthlyPaymentReturnItem(row.monthly_return_id)
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
