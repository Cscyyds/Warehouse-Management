<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ApiError } from '@/api/http'
import { PRODUCTION_DOC_OPTIONS } from '@/api/productionManagement'
import { updateTenantMode, type ModeUpdateResult, type TenantMode, type TenantModeInfo } from '@/api/tenantMode'

const props = defineProps<{ tenantId: string; info: TenantModeInfo | null; loaded: boolean }>()
const emit = defineEmits<{ (e: 'changed'): void }>()
const targetMode = ref<TenantMode | ''>('')
const preview = ref<ModeUpdateResult | null>(null)
const busy = ref(false)
const errorText = ref('')
const blockers = ref<Record<string, number>>({})
let generation = 0
watch(() => [props.tenantId, props.info] as const, () => {
  generation++
  targetMode.value = props.info?.tenant_mode ?? ''
  preview.value = null
  errorText.value = ''
  blockers.value = {}
}, { immediate: true })
watch(targetMode, () => { generation++; preview.value = null; blockers.value = {}; errorText.value = '' })
const canSubmit = computed(() => props.loaded && !busy.value && !!preview.value?.can_switch
  && preview.value.tenant_id === props.tenantId && preview.value.tenant_mode === targetMode.value
  && preview.value.tenant_mode_revision === props.info?.tenant_mode_revision)
const blockerRows = computed(() => Object.entries(blockers.value).filter(([, count]) => count > 0))
const moduleLabels: Record<string, string> = { PURCHASE_SALES: '采购销售', FINANCE: '财务', BORROW: '借出借入', OTHER_INBOUND: '其他入库', PRODUCTION: '生产' }
const blockerLabels: Record<string, string> = {
  'local.purchase_receipts': '未完成的采购入库单', 'local.purchase_returns': '未完成的采购退货单',
  'local.sales_orders': '未完成的销售订单', 'local.sales_returns': '未完成的销售退货单',
  'local.payables': '未结清应付或退款', 'local.receivables': '未结清应收或退款',
  'local.purchase_refunds': '未完成的采购退款', 'local.sales_refunds': '未完成的销售退款',
  'local.held_returns': '仍占用来源数量的退料', 'local.production_exceptions': '未关闭的生产异常',
  'local.production_requests': '未结束的原生生产操作', 'local.delivery_tasks': '未结束的配送任务',
  'local.delivery_loads': '未结束的装车作业', 'tianxin.other_inbound': '未完成的天心其他入库单',
  erp_operations: '未结束的 ERP 操作', erp_manual_leases: '仍在占用的 ERP 操作',
  sync_jobs: '未结束的同步任务', sync_leases: '仍在执行的同步作业',
  business_imports: '未结束的业务导入', simple_requests: '未结束的简易库存操作',
  'local.pending_print_tasks': '待生成标签的打印任务',
}
const docLabels: Record<string, string> = {
  ...Object.fromEntries(PRODUCTION_DOC_OPTIONS.map(doc => [doc.value, doc.label])),
  'trade-purchase-order': '采购订单', 'trade-purchase-return': '采购退货单',
  'trade-sales-return': '销售退货单', 'trade-outbound-order': '出库单',
  'borrow-in-order': '借入单', 'borrow-in-return': '借入还出单',
  'lend-out-order': '借出单', 'lend-out-return': '借出还入单',
}
function blockerLabel(key: string) {
  if (blockerLabels[key]) return blockerLabels[key]
  const doc = key.split('.').pop() || key
  return docLabels[doc] ? `未完成的${key.startsWith('tianxin.') ? '天心' : '本地'}${docLabels[doc]}` : key
}
const readinessLabels: Record<string, string> = {
  TIANXIN_CREDENTIAL_NOT_READY: '天心凭证尚未配置完整',
  SYNC_QUEUE_NOT_CONFIGURED: '同步队列尚未配置',
}

async function submit(dryRun: boolean) {
  if (!props.loaded || !props.info || !targetMode.value || busy.value || (!dryRun && !canSubmit.value)) return
  const current = generation
  const payload = { tenant_id: props.tenantId, tenant_mode: targetMode.value,
    expected_revision: props.info.tenant_mode_revision, dry_run: dryRun }
  busy.value = true
  errorText.value = ''
  try {
    const result = await updateTenantMode(payload)
    if (current !== generation) return
    blockers.value = result.switch_blockers
    if (dryRun) {
      preview.value = result
    } else {
      preview.value = null
      ElMessage.success('租户模式已保存')
      emit('changed')
    }
  } catch (error) {
    if (current !== generation) return
    preview.value = null
    errorText.value = error instanceof Error ? error.message : '模式操作失败'
    if (error instanceof ApiError) {
      const details = error.details as { switch_blockers?: Record<string, number>; error_code?: string } | null
      blockers.value = details?.switch_blockers ?? {}
      if (details?.error_code === 'TENANT_MODE_VERSION_CONFLICT' || details?.error_code === 'TENANT_MODE_BUSY') {
        ElMessage.warning(errorText.value)
        emit('changed')
      }
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="mode-config">
    <el-alert type="info" :closable="false" show-icon title="租户统一业务模式"
      description="模式统一决定采购销售、财务、借出借入、其他入库及生产能力。切换前请预览影响并处理未完成业务。" />
    <el-alert v-if="!loaded" type="warning" :closable="false" title="模式信息尚未加载成功，请刷新后操作" />
    <template v-if="info">
      <p>当前模式：<strong>{{ info.tenant_mode === 'LOCAL' ? '本地' : info.tenant_mode === 'TIANXIN' ? '天心' : '待迁移' }}</strong> · 版本 {{ info.tenant_mode_revision }}</p>
      <p>可用模块：{{ info.available_modules.map(code => moduleLabels[code] || code).join('、') || '暂无' }}</p>
      <template v-if="info.tenant_mode === 'TIANXIN'">
        <p>{{ info.sync_ready ? '同步准备条件已满足，实际连通情况请查看同步结果。' : '同步准备条件尚未满足。' }}</p>
        <ul><li v-for="reason in info.sync_readiness_reasons" :key="reason">{{ readinessLabels[reason] || reason }}</li></ul>
      </template>
    </template>
    <el-form label-position="top">
      <el-form-item label="目标租户模式">
        <el-select v-model="targetMode" :disabled="!loaded || busy" placeholder="请选择模式">
          <el-option label="本地（LOCAL）" value="LOCAL" />
          <el-option label="天心（TIANXIN）" value="TIANXIN" />
        </el-select>
      </el-form-item>
      <el-button :loading="busy" :disabled="!loaded || !targetMode || busy" @click="submit(true)">预览切换影响</el-button>
      <el-button type="primary" :disabled="!canSubmit" @click="submit(false)">确认保存模式</el-button>
    </el-form>
    <el-alert v-if="errorText" type="error" :closable="false" :title="errorText" />
    <el-alert v-if="preview" :type="preview.can_switch ? 'success' : 'warning'" :closable="false"
      :title="preview.can_switch ? '预览通过，可以确认保存；提交时将再次检查版本和未完成业务。' : '存在未完成业务，暂不能切换租户模式。'" />
    <ul v-if="blockerRows.length"><li v-for="[key, count] in blockerRows" :key="key">{{ blockerLabel(key) }}：{{ count }}</li></ul>
  </section>
</template>

<style scoped>
.mode-config { display: grid; gap: 16px; max-width: 860px; }
p { margin: 0; }
</style>
