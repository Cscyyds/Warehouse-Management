<template>
  <el-card v-perm="`GET /api/v1/tenant-${domain}/erp-operations/list`" shadow="never">
    <template #header>ERP处理记录 <el-button link :loading="loading" @click="load">刷新</el-button></template>
    <el-table :data="items" size="small" v-loading="loading">
      <el-table-column label="动作" width="90"><template #default="{ row }">{{ row.action === 'FINISH' ? '完成收尾' : row.action === 'MANUAL_UNLOCK' ? '人工解锁' : row.action === 'MANUAL_LOCK' ? '人工上锁' : '上锁' }}</template></el-table-column>
      <el-table-column label="阶段" width="150"><template #default="{ row }">{{ phases[row.phase] || row.phase }}</template></el-table-column>
      <el-table-column label="状态" width="100"><template #default="{ row }">{{ statuses[row.status] || row.status }}</template></el-table-column>
      <el-table-column prop="last_error_message" label="处理说明" />
      <el-table-column label="操作" width="190"><template #default="{ row }">
        <el-button v-if="['FAILED', 'RETRY'].includes(row.status) && !['APPROVE_INFLIGHT','SOURCE_CHANGED','MANUAL_INFLIGHT'].includes(row.phase)"
          v-perm="`POST /api/v1/tenant-${domain}/erp-operations/retry`" link :disabled="busy" @click="retry(row.task_id)">重试</el-button>
        <template v-if="['FAILED','NEEDS_REVIEW','SUPERSEDED','RUNNING'].includes(row.status) && ['APPROVE_INFLIGHT','SOURCE_CHANGED','MANUAL_INFLIGHT'].includes(row.phase)">
          <el-button v-perm="`POST /api/v1/tenant-${domain}/erp-operations/resolve`" link :disabled="busy" @click="resolve(row, true)">{{ row.phase === 'MANUAL_INFLIGHT' ? 'ERP实际已上锁' : row.action === 'LOCK' ? '确认ERP已上锁' : '已核实审核成功' }}</el-button>
          <el-button v-perm="`POST /api/v1/tenant-${domain}/erp-operations/resolve`" link :disabled="busy" @click="resolve(row, false)">{{ row.phase === 'MANUAL_INFLIGHT' ? 'ERP实际已解锁' : row.action === 'LOCK' ? '核对后重新上锁' : '核对未审后接续' }}</el-button>
        </template>
      </template></el-table-column>
    </el-table>
  </el-card>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, post } from '@/utils/request'
import { usePermissionStore } from '@/stores/permission'
const props = defineProps<{ domain: 'trade' | 'production'; billId: string }>()
const items = ref<Record<string, any>[]>([])
const loading = ref(false)
const busy = ref(false)
const phases: Record<string, string> = { LOCK_PENDING: '待上锁', UNLOCK_PENDING: '待解锁', APPROVE_PENDING: '待审核', APPROVE_INFLIGHT: '审核结果待核对', SOURCE_CHANGED: '源单变化待核对', MANUAL_INFLIGHT: '人工锁解待核对', DONE: '处理完成' }
const statuses: Record<string, string> = { NEEDS_REVIEW: '需核对', PENDING: '等待执行', RUNNING: '执行中', RETRY: '等待重试', SUCCEEDED: '成功', FAILED: '需处理', SUPERSEDED: '已被后续作业替代' }
let generation = 0
async function load() {
  const current = ++generation
  items.value = []
  if (!props.billId || !usePermissionStore().hasUrlPerm(`GET /api/v1/tenant-${props.domain}/erp-operations/list`)) return
  loading.value = true
  try {
    const res = await get<{items: Record<string, any>[]}>(`/api/v1/tenant-${props.domain}/erp-operations/list`, { wms_bill_id: props.billId })
    if (current === generation) items.value = res.data.items
  } finally { if (current === generation) loading.value = false }
}
async function retry(taskId: string) {
  busy.value = true
  try {
    await post(`/api/v1/tenant-${props.domain}/erp-operations/retry`, { task_id: taskId })
    ElMessage.success('已安排重试')
    await load()
  } catch { /* 请求层已提示业务错误 */ } finally { busy.value = false }
}
async function resolve(row: Record<string, any>, approved: boolean) {
  if (busy.value) return
  busy.value = true
  try {
    let evidence: string
    try {
      const result = await ElMessageBox.prompt(row.phase === 'MANUAL_INFLIGHT' ? '请在ERP核实当前实际锁态，确认请求已结束，并填写核对凭证。' : row.action === 'LOCK' ? '请核对当前单据内容和ERP锁态，填写凭证；确认后按所选方式处理。' : approved ? '请先在ERP确认终审成功，并填写核对凭证或工单号。' : '请先在ERP确认尚未终审，再填写核对依据；提交后系统会补审。', '核对ERP审核结果', { inputValidator: value => !!value && value.trim().length >= 5 || '请填写至少5字的核对依据' })
      evidence = result.value
    } catch { return }
    await post(`/api/v1/tenant-${props.domain}/erp-operations/resolve`, { task_id: row.task_id, approved, evidence, expected_source_hash: row.current_source_hash, ...(row.phase === 'MANUAL_INFLIGHT' ? { lock_status: approved ? 1 : 0 } : {}) })
    ElMessage.success('已记录核对结果')
    await load()
  } catch { /* 请求层已提示业务错误 */ } finally { busy.value = false }
}
watch(() => [props.billId, props.domain], () => { void load().catch(() => {}) }, { immediate: true })
</script>
