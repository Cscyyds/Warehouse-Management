<template>
  <el-dialog :model-value="Boolean(bill && action)" :title="label" width="460px"
    :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving"
    @update:model-value="(value: boolean) => !value && close()">
    <p>{{ displayAction === 'unaudit' || displayAction === 'cancelSend' || displayAction === 'send' ? displayBill?.bill_no : `${label}单据 ${displayBill?.bill_no}？` }}</p>
    <el-alert v-if="error" class="wms-native-error" :title="error" type="error" :closable="false" show-icon />
    <template #footer>
      <el-button :disabled="saving" @click="close">取消</el-button>
      <el-button :type="displayAction === 'delete' ? 'danger' : 'primary'" :loading="saving"
        @click="submit">确认</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  auditNativeBills, cancelSendNativeBills, deleteNativeBills, isReplayed, sendNativeBills,
  unauditNativeBills, type NativeDocKey, type NativeHeaderRow,
} from '@/api/modules/productionNative'
import { BILL_ACTIONS, type BillAction } from '@/config/productionNativeDocConfig'
import { nativeError, useNativeRequestId } from '../nativeBillForm'

const props = defineProps<{ docKey: NativeDocKey; bill: NativeHeaderRow | null; action: BillAction | null }>()
const emit = defineEmits<{ close: []; done: [action: BillAction]; stale: [] }>()
const error = ref('')
const saving = ref(false)
const request = useNativeRequestId()
const displayBill = ref<NativeHeaderRow | null>(null)
const displayAction = ref<BillAction | null>(null)
const label = computed(() => BILL_ACTIONS.find(item => item.key === displayAction.value)?.label || '')

watch(() => [props.bill, props.action] as const, ([bill, action]) => {
  if (!bill || !action) return
  displayBill.value = bill
  displayAction.value = action
  error.value = ''
}, { immediate: true })

function close() {
  if (!saving.value) emit('close')
}

async function submit() {
  const { bill, action, docKey } = props
  if (!bill || !action || saving.value) return
  saving.value = true
  error.value = ''
  const target = { bill_id: bill.bill_id, expected_version: bill.version }
  const payload = { request_id: request.id([action, target]), items: [target] }
  const options = { silent: true }
  try {
    const result = action === 'approve' || action === 'reject'
      ? await auditNativeBills(docKey, { ...payload, action: action === 'approve' ? 'PASS' : 'REJECT' }, options)
      : await ({ unaudit: unauditNativeBills, send: sendNativeBills, cancelSend: cancelSendNativeBills, delete: deleteNativeBills }[action])(
        docKey, payload, options)
    request.clear()
    if (!isReplayed(result.data)) ElMessage.success(result.message)
    emit('done', action)
  } catch (err) {
    const info = nativeError(err)
    error.value = info.message
    if (info.code === 'VERSION_CONFLICT') emit('stale')
  } finally {
    saving.value = false
  }
}
</script>
