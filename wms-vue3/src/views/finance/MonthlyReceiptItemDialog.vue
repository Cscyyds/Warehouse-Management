<template>
  <el-dialog
    title="月结收款单明细管理"
    :model-value="modelValue"
    width="1100px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div v-loading="loading" class="item-dialog-body">
      <div class="order-info">
        <el-tag type="info" size="small">{{ order?.receipt_no || '-' }}</el-tag>
        <span class="info-text">客户：{{ order?.customer_name || '-' }}</span>
        <span class="info-text">收款总额：{{ detail?.total_receipt_amount || '-' }}</span>
        <span class="info-text">订单总额：{{ detail?.total_order_amount || '-' }}</span>
      </div>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="收款明细" name="items">
          <el-button type="primary" size="small" @click="handleAddItem" style="margin-bottom:8px">
            <el-icon><Plus /></el-icon>新增收款明细
          </el-button>
          <el-table :data="detail?.items || []" size="small" border style="width:100%">
            <el-table-column type="index" label="" width="50" align="center" />
            <el-table-column prop="order_no" label="销售订单号" width="180" show-overflow-tooltip />
            <el-table-column prop="order_amount" label="订单金额" width="120" align="right" />
            <el-table-column prop="receipt_amount" label="收款金额" width="120" align="right" />
            <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.remark || '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="handleEditItem(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="handleDeleteItem(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="退货抵扣明细" name="returnItems">
          <el-button type="primary" size="small" @click="handleAddReturn" style="margin-bottom:8px">
            <el-icon><Plus /></el-icon>新增退货抵扣
          </el-button>
          <el-table :data="detail?.return_items || []" size="small" border style="width:100%">
            <el-table-column type="index" label="" width="50" align="center" />
            <el-table-column prop="return_no" label="退货单号" width="180" show-overflow-tooltip />
            <el-table-column prop="return_amount" label="退货金额" width="120" align="right" />
            <el-table-column prop="actual_credit_adjust_amount" label="实际调增授信" width="130" align="right" />
            <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.remark || '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="handleEditReturn(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="handleDeleteReturn(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 月结销售订单选择弹窗 -->
    <SalesOrderSelectDialog
      v-model="soDialogVisible"
      @confirm="onSalesOrderConfirmed"
    />

    <!-- 销售退货单选择弹窗 -->
    <SalesReturnSelectDialog
      v-model="returnDialogVisible"
      @confirm="onSalesReturnConfirmed"
    />

    <!-- 编辑收款明细表单 -->
    <el-dialog v-model="itemFormVisible" title="编辑收款明细" width="480px" :close-on-click-modal="false" append-to-body>
      <el-form :model="itemForm" label-width="100px" size="default">
        <el-form-item label="销售订单号">
          <el-input :model-value="itemForm.order_no" disabled />
        </el-form-item>
        <el-form-item label="收款金额" required>
          <el-input-number v-model="itemForm.receipt_amount" :min="0.01" :precision="2" controls-position="right" style="width:100%" />
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

    <!-- 编辑退货抵扣明细表单 -->
    <el-dialog v-model="returnFormVisible" title="编辑退货抵扣明细" width="480px" :close-on-click-modal="false" append-to-body>
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
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  getMonthlyReceiptOrderDetail,
  addMonthlyReceiptItems, updateMonthlyReceiptItem, deleteMonthlyReceiptItem,
  addMonthlyReceiptReturnItems, updateMonthlyReceiptReturnItem, deleteMonthlyReceiptReturnItem,
  type MonthlyReceiptListItem, type MonthlyReceiptDetail,
  type MonthlyReceiptItem as ReceiptItemType, type MonthlyReceiptReturnItem as ReceiptReturnItemType
} from '@/api'
import { type SalesOrderListItemV2 } from '@/api'
import { type SalesReturnItem } from '@/api/legacy'
import SalesOrderSelectDialog from '@/views/sales/SalesOrderSelectDialog.vue'
import SalesReturnSelectDialog from '@/views/sales/SalesReturnSelectDialog.vue'

const props = defineProps<{
  modelValue: boolean
  order: MonthlyReceiptListItem | null
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'changed': []
}>()

const loading = ref(false)
const submitting = ref(false)
const activeTab = ref('items')
const detail = ref<MonthlyReceiptDetail | null>(null)

const soDialogVisible = ref(false)
const returnDialogVisible = ref(false)
const itemFormVisible = ref(false)
const returnFormVisible = ref(false)

const itemForm = reactive({ monthly_receipt_item_id: '', order_no: '', receipt_amount: 0, remark: '' })
const returnForm = reactive({ monthly_receipt_return_id: '', return_no: '', remark: '' })

async function onOpen() {
  detail.value = null
  activeTab.value = 'items'
  if (!props.order?.monthly_receipt_id) return
  await loadDetail()
}

async function loadDetail() {
  if (!props.order?.monthly_receipt_id) return
  loading.value = true
  try {
    const res = await getMonthlyReceiptOrderDetail(props.order.monthly_receipt_id)
    detail.value = res.data
  } catch {
    detail.value = null
  } finally {
    loading.value = false
  }
}

// ========== 收款明细 ==========
function handleAddItem() { soDialogVisible.value = true }

async function onSalesOrderConfirmed(order: SalesOrderListItemV2) {
  submitting.value = true
  try {
    await addMonthlyReceiptItems(props.order!.monthly_receipt_id, [{
      sales_order_id: order.sales_order_id,
      receipt_amount: order.pending_receivable_amount || order.order_amount || '0',
    }])
    ElMessage.success('收款明细已新增')
    await loadDetail()
    emit('changed')
  } catch {
    // error handled by interceptor
  } finally {
    submitting.value = false
  }
}

function handleEditItem(row: ReceiptItemType) {
  Object.assign(itemForm, {
    monthly_receipt_item_id: row.monthly_receipt_item_id,
    order_no: row.order_no,
    receipt_amount: Number(row.receipt_amount) || 0,
    remark: row.remark || ''
  })
  itemFormVisible.value = true
}

async function submitItemEdit() {
  if (itemForm.receipt_amount <= 0) { ElMessage.warning('收款金额必须大于0'); return }
  submitting.value = true
  try {
    await updateMonthlyReceiptItem({
      monthly_receipt_item_id: itemForm.monthly_receipt_item_id,
      receipt_amount: String(itemForm.receipt_amount),
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

async function handleDeleteItem(row: ReceiptItemType) {
  try {
    await ElMessageBox.confirm(`确认删除销售订单「${row.order_no}」的收款明细？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteMonthlyReceiptItem(row.monthly_receipt_item_id)
    ElMessage.success('删除成功')
    await loadDetail()
    emit('changed')
  } catch {
    // cancelled or error
  }
}

// ========== 退货抵扣明细 ==========
function handleAddReturn() { returnDialogVisible.value = true }

async function onSalesReturnConfirmed(item: SalesReturnItem) {
  submitting.value = true
  try {
    const returnId = (item as any).sales_return_id || (item as any).id
    await addMonthlyReceiptReturnItems(props.order!.monthly_receipt_id, [{ sales_return_id: returnId }])
    ElMessage.success('退货抵扣明细已新增')
    await loadDetail()
    emit('changed')
  } catch {
    // error handled by interceptor
  } finally {
    submitting.value = false
  }
}

function handleEditReturn(row: ReceiptReturnItemType) {
  Object.assign(returnForm, {
    monthly_receipt_return_id: row.monthly_receipt_return_id,
    return_no: row.return_no,
    remark: row.remark || ''
  })
  returnFormVisible.value = true
}

async function submitReturnEdit() {
  submitting.value = true
  try {
    await updateMonthlyReceiptReturnItem({
      monthly_receipt_return_id: returnForm.monthly_receipt_return_id,
      remark: returnForm.remark || undefined
    })
    ElMessage.success('退货抵扣明细已更新')
    returnFormVisible.value = false
    await loadDetail()
    emit('changed')
  } catch {
    // error handled by interceptor
  } finally {
    submitting.value = false
  }
}

async function handleDeleteReturn(row: ReceiptReturnItemType) {
  try {
    await ElMessageBox.confirm(`确认删除退货单「${row.return_no}」的退货抵扣明细？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteMonthlyReceiptReturnItem(row.monthly_receipt_return_id)
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
