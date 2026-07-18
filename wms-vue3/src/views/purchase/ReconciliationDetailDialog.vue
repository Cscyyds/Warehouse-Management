<template>
  <el-dialog
    title="采购对账单详情"
    :model-value="modelValue"
    width="860px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div v-loading="loading" class="detail-body">
      <template v-if="detail">
        <!-- 基本信息 -->
        <section class="info-section">
          <el-descriptions :column="3" size="small" border>
            <el-descriptions-item label="单据编号">{{ detail.reconciliation_no }}</el-descriptions-item>
            <el-descriptions-item label="供应商">{{ detail.supplier_name }}</el-descriptions-item>
            <el-descriptions-item label="对账日期">{{ detail.reconciliation_date }}</el-descriptions-item>
            <el-descriptions-item label="对账月份">{{ detail.reconciliation_month }}</el-descriptions-item>
            <el-descriptions-item label="折扣比例">{{ detail.discount_rate }}%</el-descriptions-item>
            <el-descriptions-item label="抵扣金额">{{ detail.deduction_amount }}</el-descriptions-item>
            <el-descriptions-item label="备注">{{ detail.remark || '-' }}</el-descriptions-item>
            <el-descriptions-item label="创建人">{{ detail.created_by_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ detail.created_at || '-' }}</el-descriptions-item>
          </el-descriptions>
        </section>

        <!-- 金额汇总 -->
        <section class="amount-section">
          <div class="amount-item">
            <span class="amount-label">本次对账金额</span>
            <span class="amount-value">{{ detail.reconciliation_amount }}</span>
          </div>
          <div class="amount-item">
            <span class="amount-label">折扣金额</span>
            <span class="amount-value">{{ detail.discount_amount }}</span>
          </div>
          <div class="amount-item primary">
            <span class="amount-label">应收金额</span>
            <span class="amount-value">{{ detail.receivable_amount }}</span>
          </div>
        </section>

        <!-- 采购订单明细 -->
        <section class="table-section">
          <header class="section-header">
            <span class="section-title">采购订单明细（{{ detail.purchase_orders.length }}）</span>
            <el-button v-if="isEditable" size="small" @click="showOrderPicker = true">添加</el-button>
          </header>
          <el-table :data="detail.purchase_orders" size="small" stripe style="width: 100%">
            <el-table-column prop="order_no" label="采购单号" show-overflow-tooltip min-width="150" />
            <el-table-column prop="payable_amount" label="应付金额" show-overflow-tooltip width="130" align="right" />
            <el-table-column prop="paid_amount" label="已付金额" show-overflow-tooltip width="130" align="right" />
            <el-table-column v-if="isEditable" label="" width="70" align="center">
              <template #default="{ row }">
                <el-popconfirm title="确认移除该采购单？" @confirm="handleRemoveOrder(row.purchase_order_id)">
                  <template #reference>
                    <el-button link type="danger" size="small" :loading="removing">移除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </section>

        <!-- 退货单明细 -->
        <section class="table-section">
          <header class="section-header">
            <span class="section-title">退货单明细（{{ detail.purchase_returns.length }}）</span>
            <el-button v-if="isEditable" size="small" @click="showReturnPicker = true">添加</el-button>
          </header>
          <el-table :data="detail.purchase_returns" size="small" stripe style="width: 100%">
            <el-table-column prop="return_no" label="退货单号" show-overflow-tooltip min-width="150" />
            <el-table-column prop="return_amount" label="退货金额" show-overflow-tooltip width="130" align="right" />
            <el-table-column v-if="isEditable" label="" width="70" align="center">
              <template #default="{ row }">
                <el-popconfirm title="确认移除该退货单？" @confirm="handleRemoveReturn(row.purchase_return_id)">
                  <template #reference>
                    <el-button link type="danger" size="small" :loading="removing">移除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </template>
    </div>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">关闭</el-button>
    </template>

    <!-- 采购单选择弹窗 -->
    <OrderPickerDialog
      v-model="showOrderPicker"
      :supplier-id="detail?.supplier_id || ''"
      :excluded-ids="detail?.purchase_orders.map(o => o.purchase_order_id) || []"
      @select="handleAddOrders"
    />

    <!-- 退货单选择弹窗 -->
    <ReturnPickerDialog
      v-model="showReturnPicker"
      :supplier-id="detail?.supplier_id || ''"
      :excluded-ids="detail?.purchase_returns.map(r => r.purchase_return_id) || []"
      @select="handleAddReturns"
    />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getPurchaseReconciliationDetail,
  addReconciliationPurchaseOrders,
  addReconciliationPurchaseReturns,
  removeReconciliationPurchaseOrders,
  removeReconciliationPurchaseReturns,
  type PurchaseReconciliationItem
} from '@/api'
import OrderPickerDialog from './ReconciliationOrderPicker.vue'
import ReturnPickerDialog from './ReconciliationReturnPicker.vue'

const props = defineProps<{
  modelValue: boolean
  reconciliationId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'updated'): void
}>()

const loading = ref(false)
const removing = ref(false)
const showOrderPicker = ref(false)
const showReturnPicker = ref(false)
const detail = ref<PurchaseReconciliationItem | null>(null)

const isEditable = computed(() => detail.value?.audit_status === 0)

watch(() => props.modelValue, async (visible) => {
  if (visible && props.reconciliationId) {
    await loadDetail()
  } else {
    detail.value = null
  }
})

async function loadDetail() {
  loading.value = true
  try {
    const res = await getPurchaseReconciliationDetail(props.reconciliationId)
    detail.value = res.data
  } catch {
    ElMessage.error('加载详情失败')
  } finally {
    loading.value = false
  }
}

async function handleAddOrders(orders: Array<{ purchase_order_id: string }>) {
  if (!detail.value) return
  try {
    const res = await addReconciliationPurchaseOrders(
      detail.value.reconciliation_id,
      orders.map(o => o.purchase_order_id)
    )
    detail.value = res.data
    ElMessage.success('采购明细新增成功')
    emit('updated')
  } catch (err: any) {
    ElMessage.error(err?.message || '添加失败')
  }
}

async function handleAddReturns(returns: Array<{ purchase_return_id: string }>) {
  if (!detail.value) return
  try {
    const res = await addReconciliationPurchaseReturns(
      detail.value.reconciliation_id,
      returns.map(r => r.purchase_return_id)
    )
    detail.value = res.data
    ElMessage.success('退货明细新增成功')
    emit('updated')
  } catch (err: any) {
    ElMessage.error(err?.message || '添加失败')
  }
}

async function handleRemoveOrder(purchaseOrderId: string) {
  if (!detail.value) return
  removing.value = true
  try {
    const res = await removeReconciliationPurchaseOrders(
      detail.value.reconciliation_id,
      [purchaseOrderId]
    )
    detail.value = res.data
    ElMessage.success('已移除')
    emit('updated')
  } catch (err: any) {
    ElMessage.error(err?.message || '移除失败')
  } finally {
    removing.value = false
  }
}

async function handleRemoveReturn(purchaseReturnId: string) {
  if (!detail.value) return
  removing.value = true
  try {
    const res = await removeReconciliationPurchaseReturns(
      detail.value.reconciliation_id,
      [purchaseReturnId]
    )
    detail.value = res.data
    ElMessage.success('已移除')
    emit('updated')
  } catch (err: any) {
    ElMessage.error(err?.message || '移除失败')
  } finally {
    removing.value = false
  }
}
</script>

<style scoped>
.detail-body {
  min-height: 200px;
}
.info-section {
  margin-bottom: 20px;
}
.amount-section {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
  padding: 14px 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}
.amount-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.amount-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.amount-value {
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}
.amount-item.primary .amount-value {
  color: var(--el-color-primary);
}
.table-section {
  margin-bottom: 16px;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>
