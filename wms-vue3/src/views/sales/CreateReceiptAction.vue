<template>
  <el-dropdown trigger="click" @command="handleCommand">
    <el-button type="warning" plain :icon="Wallet">
      一键创建
      <el-icon class="el-icon--right"><ArrowDown /></el-icon>
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="receipt">创建收款单</el-dropdown-item>
        <el-dropdown-item command="order">创建订货单</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Wallet, ArrowDown } from '@element-plus/icons-vue'
import { ensureSalesOrderAudited } from '@/config/formConfigs'

interface Props {
  formData: Record<string, any>
  dynamicTableData: Record<string, any[]>
  isEdit: boolean
  isReadonly: boolean
  /** 当前激活的 tab（AddTemplate 的 activeTab.value），用于一键创建订货单跳转后恢复原 tab */
  activeTab?: string
  /** 当前编辑中的销售订单 ID（新增态为 undefined） */
  editId?: string
}
const props = defineProps<Props>()
const router = useRouter()

/** 下拉菜单分发：收款单 / 订货单两条一键创建路径（均要求销售订单已审核通过） */
function handleCommand(command: 'receipt' | 'order') {
  // 业务拦截：未审核（0/2/3）的销售订单不允许创建订货单/收款单
  if (!ensureSalesOrderAudited(props.formData)) return
  if (command === 'receipt') handleCreateReceipt()
  else if (command === 'order') handleCreateOrder()
}

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

/** 一键创建订货单主入口：把当前销售订单全部明细（数量按订单数量）带入客户订货单预填页 */
async function handleCreateOrder() {
  const fd = props.formData
  const customerId = fd.customer_id
  if (!customerId) {
    ElMessage.warning('创建订货单需先在主表选择客户')
    return
  }

  const rows = (props.dynamicTableData?.items || []).filter((r: any) => r.product_id && Number(r.qty) > 0)
  if (!rows.length) {
    ElMessage.warning('当前订单没有可用的明细行，请先添加产品')
    return
  }

  try {
    await ElMessageBox.confirm(
      `将把当前订单全部 ${rows.length} 条明细（数量按订单数量）带入客户订货单，是否继续？`,
      '一键创建订货单',
      { confirmButtonText: '去生单', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  // 1) 快照当前编辑/创建状态，供保存订货单后返回销售订单页恢复（与「缺货一键生单」共用同一恢复通道）
  try {
    const snapshot = JSON.stringify({
      formData: fd || {},
      dynamicTableData: props.dynamicTableData || {},
      activeTab: props.activeTab,
    })
    sessionStorage.setItem(`salesOrderEditRestore:salesOrder:${props.editId || 'new'}`, snapshot)
  } catch {
    // 序列化失败（如循环引用）则放弃快照恢复
  }

  // 2) 写入客户订货单预填数据：全部明细，数量按订单数量
  const preset = {
    customer_id: customerId,
    customer_name: fd.customer_name || '',
    items: rows.map((r: any) => ({
      product_id: r.product_id,
      product_code: r.product_code || '',
      product_name: r.product_name || '',
      unit_id: r.unit_id || undefined,
      unit_name: r.unit_name || undefined,
      qty: Number(r.qty) || 1,
      project_name: '',
      line_remark: '',
    })),
  }
  sessionStorage.setItem('customerOrderPrefillFromSales', JSON.stringify(preset))

  // 3) 跳转新增客户订货单预填页
  const soId = props.editId ? `&soId=${props.editId}` : ''
  router.push(`/sales/customer-order/create?prefill=1&from=salesOrder${soId}`)
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
