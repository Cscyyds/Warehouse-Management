<template>
  <el-button type="warning" plain :icon="Wallet" @click="handleCreateReceipt">一键创建收款单</el-button>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Wallet } from '@element-plus/icons-vue'

interface Props {
  formData: Record<string, any>
  dynamicTableData: Record<string, any[]>
  isEdit: boolean
  isReadonly: boolean
}
const props = defineProps<Props>()
const router = useRouter()

type SettlementMethod = 'CASH' | 'MONTHLY' | 'CREDIT' | 'PREPAYMENT' | string

/**
 * 结算方式 -> 收款单业务 路由映射
 * CASH(现结)       -> 收款单     /common/add?type=collectionReceipt
 * MONTHLY(月结)    -> 月结收款单 /finance/gift/add
 * CREDIT(挂账)     -> 其他收款单 /common/add?type=otherReceipt
 * PREPAYMENT(预付款) -> 预收款单 /finance/precollection/add
 */
const ROUTE_MAP: Record<SettlementMethod, { label: string; build: () => void }> = {
  CASH: { label: '收款单', build: buildCollectionReceiptPreset },
  MONTHLY: { label: '月结收款单', build: buildMonthlyReceiptPreset },
  CREDIT: { label: '其他收款单', build: buildOtherReceiptPreset },
  PREPAYMENT: { label: '预收款单', build: buildPrecollectionPreset },
}

/** 结算方式中文显示名 -> 标准值（后端契约：枚举字段返回双份，settlement_method 为中文，settlement_method_value 为标准值） */
const SETTLEMENT_METHOD_VALUE_MAP: Record<string, string> = {
  现结: 'CASH',
  月结: 'MONTHLY',
  挂账: 'CREDIT',
  预付款: 'PREPAYMENT',
}

/** 解析结算方式标准值：优先 *_value，其次中文映射，最后原样返回 */
function resolveSettlementMethod(fd: Record<string, any>): string {
  const std = fd.settlement_method_value
  if (std) return String(std)
  const raw = fd.settlement_method
  return SETTLEMENT_METHOD_VALUE_MAP[raw] || raw
}

/** 销售订单有结算银行时默认银行转账，否则默认现金 */
function inferCollectionMethod(hasBank: boolean): string {
  return hasBank ? '银行转账' : '现金'
}
function inferReceiptMethod(hasBank: boolean): string {
  return hasBank ? 'TRANSFER' : 'CASH'
}

/** 一键创建收款单主入口 */
function handleCreateReceipt() {
  const fd = props.formData
  const settlement = resolveSettlementMethod(fd)

  if (!settlement) {
    ElMessage.warning('请先选择结算方式')
    return
  }
  const customerId = fd.customer_id
  if (!customerId) {
    ElMessage.warning('请先选择客户')
    return
  }

  const route = ROUTE_MAP[settlement]
  if (!route) {
    ElMessage.warning(`不支持的结算方式：${settlement}`)
    return
  }

  route.build()
}

/** 构建收款单预填数据并跳转 */
function buildCollectionReceiptPreset() {
  const fd = props.formData
  const hasBank = !!fd.settlement_bank_id
  const preset = {
    customer_id: fd.customer_id,
    customer_id_label: fd.customer_name,
    collection_method: inferCollectionMethod(hasBank),
    bank_account_id: fd.settlement_bank_id || '',
    // items 明细行：当前销售订单
    items: [{
      sales_order_id: fd.sales_order_id,
      order_no: fd.sales_order_no,
      receivable_amount: fd.receivable_amount || fd.total_sales_amount || '0',
      collection_amount: fd.receivable_amount || '0',
      remark: '',
    }],
  }
  savePreset('collectionReceipt', preset)
  router.push({ path: '/common/add', query: { type: 'collectionReceipt' } })
}

/** 构建月结收款单预填数据并跳转 */
function buildMonthlyReceiptPreset() {
  const fd = props.formData
  const hasBank = !!fd.settlement_bank_id
  const preset = {
    customer_id: fd.customer_id,
    customer_name: fd.customer_name,
    receipt_method: inferReceiptMethod(hasBank),
    bank_account_id: fd.settlement_bank_id || '',
    items: [{
      sales_order_id: fd.sales_order_id,
      order_no: fd.sales_order_no,
      order_amount: fd.receivable_amount || '0',
      pending_receivable_amount: '0',
      receipt_amount: Number(fd.receivable_amount || '0'),
      remark: '',
    }],
  }
  savePreset('monthlyReceiptOrder', preset)
  router.push('/finance/gift/add')
}

/** 构建其他收款单预填数据并跳转 */
function buildOtherReceiptPreset() {
  const fd = props.formData
  const hasBank = !!fd.settlement_bank_id
  const preset = {
    receipt_type: 'CUSTOMER_RECEIPT',
    customer_id: fd.customer_id,
    customer_id_label: fd.customer_name,
    collection_method: inferCollectionMethod(hasBank),
    bank_account_id: fd.settlement_bank_id || '',
    actual_receipt_amount: String(fd.receivable_amount || '0'),
  }
  savePreset('otherReceipt', preset)
  router.push({ path: '/common/add', query: { type: 'otherReceipt' } })
}

/** 构建预收款单预填数据并跳转 */
function buildPrecollectionPreset() {
  const fd = props.formData
  const hasBank = !!fd.settlement_bank_id
  const preset = {
    receipt_method: inferReceiptMethod(hasBank),
    bank_account_id: fd.settlement_bank_id || '',
    items: [{
      customer_id: fd.customer_id,
      customer_name: fd.customer_name,
      prepayment_amount: Number(fd.receivable_amount || '0'),
      gift_amount: 0,
      remark: '',
    }],
  }
  savePreset('precollectionOrder', preset)
  router.push('/finance/precollection/add')
}

/** 统一写入 sessionStorage presetData 通道 */
function savePreset(type: string, data: Record<string, any>) {
  sessionStorage.setItem(`presetData:${type}`, JSON.stringify(data))
}
</script>

<style scoped>
.el-button {
  font-size: 13px;
}
</style>
