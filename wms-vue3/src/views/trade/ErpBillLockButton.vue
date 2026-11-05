<template>
  <!-- link：列表操作列内联形态（与其他操作按钮同为 small link，不重复展示状态）
       button：详情页顶部操作区形态（状态标签 + 常规按钮），与生产单据详情页一致 -->
  <span class="erp-bill-lock" :class="`is-${variant}`">
    <el-tag v-if="variant === 'button'" :type="statusTagType" size="small">{{ statusText }}</el-tag>
    <el-button
      v-if="canOperate"
      v-perm="lockPermission"
      :link="variant === 'link'"
      :size="variant === 'link' ? 'small' : undefined"
      :type="variant === 'link' ? (locked ? 'warning' : 'success') : undefined"
      :loading="busy"
      :disabled="busy || !known || !!bill.deleted_flag || !!bill.erp_deleted_flag"
      @click="change"
    >
      <el-icon v-if="variant === 'button'"><component :is="locked ? Unlock : Lock" /></el-icon>
      {{ locked ? '解锁' : '上锁' }}
    </el-button>
  </span>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Lock, Unlock } from '@element-plus/icons-vue'
import { useTradeModeStore } from '@/stores/tradeMode'
import { resolveErpDoc } from '@/config/erpDocFamily'
import { isTradeBillLockSupported, updateTradeBillLock, type TradeDocKey } from '@/api/modules/trade'
import { updateBorrowBillLock } from '@/api/modules/borrow'

const props = withDefaults(defineProps<{
  /** 单据 docKey（贸易 5 类 / 借出借入 4 类） */
  docKey: string
  bill: Record<string, any>
  /** link = 列表操作列；button = 详情页顶部操作区 */
  variant?: 'link' | 'button'
}>(), { variant: 'link' })
const emit = defineEmits<{ changed: [] }>()

const mode = useTradeModeStore()
const busy = ref(false)

const familyKey = computed(() => resolveErpDoc(props.docKey)?.family.key)
/** 支持锁单的单据：贸易侧除销售订单外；借出借入四单据均支持 */
const supported = computed(() =>
  familyKey.value === 'borrow'
  || (familyKey.value === 'trade' && isTradeBillLockSupported(props.docKey)),
)
/** 贸易侧沿用模式门（非天心模式不渲染）；借出借入无该模式开关，只看权限 */
const canOperate = computed(() =>
  supported.value && (familyKey.value === 'borrow' || mode.isTianxin),
)
const lockPermission = computed(() =>
  familyKey.value === 'borrow'
    ? 'POST /api/v1/tenant-borrow/bill-lock/update'
    : `POST /api/v1/tenant-trade/${props.docKey}/bill-lock/update`,
)

const locked = computed(() => props.bill.erp_lock_status === 1)
const known = computed(() => props.bill.erp_lock_status === 0 || props.bill.erp_lock_status === 1)
const statusText = computed(() =>
  props.bill.erp_lock_status === 1 ? '已上锁' : props.bill.erp_lock_status === 0 ? '已解锁' : '待刷新',
)
const statusTagType = computed<'danger' | 'info'>(() => (locked.value ? 'danger' : 'info'))

async function change() {
  if (busy.value || !known.value) return
  const target = props.bill.erp_lock_status === 1 ? 0 : 1
  const billId = props.bill.wms_bill_id
  busy.value = true
  try {
    try {
      await ElMessageBox.confirm(target === 0 ? '解锁后，ERP将允许修改此单据。是否继续？' : '是否上锁此单据？', '确认操作')
    } catch { return }
    try {
      const result = familyKey.value === 'borrow'
        ? await updateBorrowBillLock({ doc_key: props.docKey, wms_bill_id: billId, lock_status: target })
        : await updateTradeBillLock(props.docKey as TradeDocKey, billId, target)
      ElMessage.success(result.message || '操作成功')
    } finally {
      // 远端可能已成功而响应中断，始终重新读取，不能乐观翻转本地状态。
      emit('changed')
    }
  } catch (error: unknown) {
    // 借出借入接口 silent，请求层不弹错，由组件兜底；贸易接口由请求层统一提示
    if (familyKey.value === 'borrow') {
      ElMessage.error((error as Error)?.message || '操作失败，请稍后重试')
    }
  } finally { busy.value = false }
}
</script>
<style scoped>
.erp-bill-lock { display: inline-flex; align-items: center; gap: 8px; }
</style>
