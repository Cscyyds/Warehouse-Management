<template>
  <el-dialog
    title="销售对账单详情"
    :model-value="modelValue"
    width="860px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div v-loading="loading" class="detail-body">
      <template v-if="detail">
        <section class="info-section">
          <el-descriptions :column="3" size="small" border>
            <el-descriptions-item label="单据编号">{{ detail.reconciliation_no }}</el-descriptions-item>
            <el-descriptions-item label="客户">{{ detail.customer_name }}</el-descriptions-item>
            <el-descriptions-item label="对账日期">{{ detail.reconciliation_date }}</el-descriptions-item>
            <el-descriptions-item label="对账月份">{{ detail.reconciliation_month }}</el-descriptions-item>
            <el-descriptions-item label="折扣比例">{{ detail.discount_rate }}%</el-descriptions-item>
            <el-descriptions-item label="抵扣金额">{{ detail.deduction_amount }}</el-descriptions-item>
            <el-descriptions-item label="审核状态">
              <el-tag :type="auditTagType(detail.audit_status ?? 0)" size="small">
                {{ auditStatusLabel(detail.audit_status ?? 0) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="创建人">{{ detail.created_by_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="备注">{{ detail.remark || '-' }}</el-descriptions-item>
          </el-descriptions>
        </section>

        <section class="amount-section">
          <div class="amount-item">
            <span class="amount-label">本次对账金额</span>
            <span class="amount-value">{{ formatMoney(detail.reconciliation_amount) }}</span>
          </div>
          <div class="amount-item">
            <span class="amount-label">折扣金额</span>
            <span class="amount-value">{{ formatMoney(detail.discount_amount) }}</span>
          </div>
          <div class="amount-item">
            <span class="amount-label">抵扣金额</span>
            <span class="amount-value">{{ formatMoney(detail.deduction_amount) }}</span>
          </div>
          <div class="amount-item primary">
            <span class="amount-label">应收金额</span>
            <span class="amount-value">{{ formatMoney(detail.receivable_amount) }}</span>
          </div>
        </section>

        <section class="table-section">
          <header class="section-header">
            <span class="section-title">销售订单明细（{{ detail.sales_orders.length }}）</span>
            <el-button v-if="isEditable" size="small" @click="showOrderPicker = true">添加</el-button>
          </header>
          <el-table :data="detail.sales_orders" size="small" stripe style="width:100%">
            <el-table-column prop="sales_order_no" label="销售单号" min-width="160" />
            <el-table-column prop="receivable_amount" label="应收金额" width="140" align="right" />
            <el-table-column v-if="isEditable" label="" width="70" align="center">
              <template #default="{ row }">
                <el-popconfirm title="确认移除该销售单？" @confirm="handleRemoveOrder(row.sales_order_id)">
                  <template #reference>
                    <el-button link type="danger" size="small" :loading="removing">移除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </section>

        <section class="table-section">
          <header class="section-header">
            <span class="section-title">退货单明细（{{ detail.sales_returns.length }}）</span>
            <el-button v-if="isEditable" size="small" @click="showReturnPicker = true">添加</el-button>
          </header>
          <el-table :data="detail.sales_returns" size="small" stripe style="width:100%">
            <el-table-column prop="return_no" label="退货单号" min-width="160" />
            <el-table-column prop="return_amount" label="退货金额" width="140" align="right" />
            <el-table-column v-if="isEditable" label="" width="70" align="center">
              <template #default="{ row }">
                <el-popconfirm title="确认移除该退货单？" @confirm="handleRemoveReturn(row.sales_return_id)">
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

    <OrderPickerDialog
      v-model="showOrderPicker"
      :customer-id="detail?.customer_id || ''"
      :excluded-ids="detail?.sales_orders.map(o => o.sales_order_id) || []"
      @select="handleAddOrders"
    />
    <ReturnPickerDialog
      v-model="showReturnPicker"
      :customer-id="detail?.customer_id || ''"
      :excluded-ids="detail?.sales_returns.map(r => r.sales_return_id) || []"
      @select="handleAddReturns"
    />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getSalesReconciliationDetail,
  addSalesReconciliationOrders,
  addSalesReconciliationReturns,
  removeSalesReconciliationOrders,
  removeSalesReconciliationReturns,
  type SalesReconciliationItem,
  type SalesOrderListItemV2,
  type SalesReturnListItem,
} from '@/api'
import OrderPickerDialog from './SalesReconciliationOrderPicker.vue'
import ReturnPickerDialog from './SalesReconciliationReturnPicker.vue'

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
const detail = ref<SalesReconciliationItem | null>(null)

const isEditable = computed(() => detail.value?.audit_status === 0)

function formatMoney(val: string | number | null | undefined) {
  if (val == null || val === '') return '-'
  const n = Number(val)
  return isNaN(n) ? String(val) : n.toFixed(2)
}

function auditStatusLabel(status: number) {
  const map: Record<number, string> = { 0: '未审核', 1: '审核通过', 2: '已反审核', 3: '审核失败' }
  return map[status] ?? '未知'
}

function auditTagType(status: number) {
  const map: Record<number, string> = { 0: 'warning', 1: 'success', 2: 'info', 3: 'danger' }
  return map[status] ?? 'info'
}

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
    const res = await getSalesReconciliationDetail(props.reconciliationId)
    detail.value = res.data
  } catch {
    ElMessage.error('加载详情失败')
  } finally {
    loading.value = false
  }
}

async function handleAddOrders(orders: SalesOrderListItemV2[]) {
  if (!detail.value) return
  try {
    const res = await addSalesReconciliationOrders(
      detail.value.reconciliation_id,
      orders.map(o => o.sales_order_id)
    )
    detail.value = res.data
    ElMessage.success('销售明细新增成功')
    emit('updated')
  } catch (err: any) {
    ElMessage.error(err?.message || '添加失败')
  }
}

async function handleAddReturns(returns: SalesReturnListItem[]) {
  if (!detail.value) return
  try {
    const res = await addSalesReconciliationReturns(
      detail.value.reconciliation_id,
      returns.map(r => r.sales_return_id)
    )
    detail.value = res.data
    ElMessage.success('退货明细新增成功')
    emit('updated')
  } catch (err: any) {
    ElMessage.error(err?.message || '添加失败')
  }
}

async function handleRemoveOrder(salesOrderId: string) {
  if (!detail.value) return
  removing.value = true
  try {
    const res = await removeSalesReconciliationOrders(detail.value.reconciliation_id, [salesOrderId])
    detail.value = res.data
    ElMessage.success('已移除')
    emit('updated')
  } catch (err: any) {
    ElMessage.error(err?.message || '移除失败')
  } finally {
    removing.value = false
  }
}

async function handleRemoveReturn(salesReturnId: string) {
  if (!detail.value) return
  removing.value = true
  try {
    const res = await removeSalesReconciliationReturns(detail.value.reconciliation_id, [salesReturnId])
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
.detail-body { min-height: 200px; }
.info-section { margin-bottom: 20px; }
.amount-section {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
  padding: 14px 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}
.amount-item { display: flex; flex-direction: column; gap: 4px; }
.amount-label { font-size: 12px; color: var(--el-text-color-secondary); }
.amount-value { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--el-text-color-primary); }
.amount-item.primary .amount-value { color: var(--el-color-primary); }
.table-section { margin-bottom: 16px; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.section-title { font-size: 13px; font-weight: 600; color: var(--el-text-color-primary); }
</style>
