<template>
  <el-button
    v-if="!tradeMode.isTianxin && canCreate"
    type="warning"
    plain
    :icon="Wallet"
    :loading="creating"
    :disabled="disabled || creating"
    @click="handleCreatePayment"
  >一键创建付款单</el-button>
</template>

<script setup lang="ts">
import { computed, ref, onDeactivated, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Wallet } from '@element-plus/icons-vue'
import { searchUnpaidOrdersForSupplier } from '@/api/modules/finance'
import { fetchAllPages } from '@/api/utils/fetchAllPages'
import { buildSearchParams } from '@/utils/data'
import { showErrorDialog } from '@/utils/errorFeedback'
import { usePermissionStore } from '@/stores/permission'
import { useTradeModeStore } from '@/stores/tradeMode'

const props = defineProps<{
  formData: Record<string, any>
  editId?: string
  disabled?: boolean
}>()
const router = useRouter()
const permissionStore = usePermissionStore()
const tradeMode = useTradeModeStore()
const creating = ref(false)
let requestSequence = 0

const settlement = computed(() => {
  const raw = props.formData.payment_method_value || props.formData.payment_method
  return ({ 月结: 'MONTHLY', 现结: 'CASH', 现金: 'CASH', 挂账: 'CREDIT', 预付款: 'PREPAYMENT', 预存款: 'PREPAYMENT' } as Record<string, string>)[raw] || raw
})
const targetType = computed(() => settlement.value === 'MONTHLY' ? 'monthlyPaymentOrder' : 'paymentOrder')
const createEndpoint = computed(() => settlement.value === 'MONTHLY'
  ? 'POST /api/v1/tenant-finance/monthly-payment-orders/create'
  : 'POST /api/v1/tenant-finance/payment-orders/create')
const canCreate = computed(() => permissionStore.hasUrlPerm(createEndpoint.value))

async function handleCreatePayment() {
  if (props.disabled || creating.value || tradeMode.isTianxin || !canCreate.value) return
  const fd = props.formData
  const orderId = props.editId || fd.purchase_order_id
  if (!orderId || !fd.supplier_id || !fd.order_no) {
    ElMessage.warning('请先完整加载采购订单及供应商信息')
    return
  }
  if (Number(fd.is_audited) !== 1) {
    ElMessage.warning('采购订单审核通过后才能创建付款单')
    return
  }
  if (!['CASH', 'MONTHLY', 'CREDIT', 'PREPAYMENT'].includes(settlement.value)) {
    ElMessage.warning('无法识别采购订单结算方式，请重新加载详情')
    return
  }
  const sequence = ++requestSequence
  creating.value = true
  try {
    // 详情不提供可靠的待付金额；复用选单接口，以后端付款资格和最新余额为准。
    // 搜索是模糊匹配且可能被订阅限制分页，必须按业务 ID 精确选中。
    const res = await fetchAllPages({
      fetchPage: page => searchUnpaidOrdersForSupplier({
        supplier_id: fd.supplier_id,
        settlement_type: settlement.value === 'MONTHLY' ? 'MONTHLY' : 'OTHER',
        ...buildSearchParams({ order_no: fd.order_no }),
        ...page,
      }),
      pick: data => data.list,
      assign: (data, items) => { data.list = items },
    })
    if (sequence !== requestSequence || props.disabled) return
    const order = res.data.list.find(item => item.purchase_order_id === orderId && item.supplier_id === fd.supplier_id)
    if (!order || !Number.isFinite(Number(order.pending_payable_amount)) || Number(order.pending_payable_amount) <= 0) {
      ElMessage.warning('该订单已付清或暂不符合付款条件，请核对采购状态及待付金额')
      return
    }
    const type = targetType.value
    const preset = {
      supplier_id: order.supplier_id,
      supplier_name: order.supplier_name,
      supplier_id_label: order.supplier_name,
      remark: fd.remark || '',
      // 科目、实际付款方式和账户由用户在目标单据确认，不把采购结算方式当成付款方式。
      ...(type === 'monthlyPaymentOrder' ? {
        purchase_order_id: order.purchase_order_id,
        purchase_order_id_label: order.order_no,
        order_no: order.order_no,
        initial_payment_amount: order.pending_payable_amount,
      } : {
        items: [{
          purchase_order_id: order.purchase_order_id,
          order_no: order.order_no,
          payment_method_display: order.payment_method_display,
          pending_payable_amount: order.pending_payable_amount,
          payment_amount: order.pending_payable_amount,
          remark: '',
        }],
      }),
    }
    sessionStorage.setItem(`presetData:${type}`, JSON.stringify(preset))
    await router.push({ path: '/common/add', query: { type } })
  } catch (err: any) {
    if (sequence === requestSequence && !err?.__handledMessage) showErrorDialog(err?.message || '获取可付款订单失败，请稍后重试')
  } finally {
    if (sequence === requestSequence) creating.value = false
  }
}

function cancelPendingCreate() { requestSequence++; creating.value = false }
onDeactivated(cancelPendingCreate)
onUnmounted(cancelPendingCreate)
</script>
