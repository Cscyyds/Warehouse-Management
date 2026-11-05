<template>
  <span>{{ bill.erp_lock_status === 1 ? '已上锁' : bill.erp_lock_status === 0 ? '已解锁' : '待刷新' }}</span>
  <el-button v-if="mode.isTianxin" v-perm="`POST /api/v1/tenant-trade/${docKey}/bill-lock/update`"
    link type="warning" :loading="busy" :disabled="busy || !known || !!bill.deleted_flag || !!bill.erp_deleted_flag" @click="change">
    {{ bill.erp_lock_status === 1 ? '解锁' : '上锁' }}
  </el-button>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTradeModeStore } from '@/stores/tradeMode'
import { updateTradeBillLock, type TradeDocKey } from '@/api/modules/trade'
const props = defineProps<{ docKey: TradeDocKey; bill: Record<string, any> }>()
const emit = defineEmits<{ changed: [] }>()
const mode = useTradeModeStore()
const busy = ref(false)
const known = computed(() => props.bill.erp_lock_status === 0 || props.bill.erp_lock_status === 1)
async function change() {
  if (busy.value || !known.value) return
  const target = props.bill.erp_lock_status === 1 ? 0 : 1
  const billId = props.bill.wms_bill_id
  const doc = props.docKey
  busy.value = true
  try {
    try {
      await ElMessageBox.confirm(target === 0 ? '解锁后，ERP将允许修改此单据。是否继续？' : '是否上锁此单据？', '确认操作')
    } catch { return }
    try {
      const result = await updateTradeBillLock(doc, billId, target)
      ElMessage.success(result.message || '操作成功')
    } finally {
      // 远端可能已成功而响应中断，始终重新读取，不能乐观翻转本地状态。
      emit('changed')
    }
  } catch { /* 请求层展示具体业务错误 */ }
  finally { busy.value = false }
}
</script>
