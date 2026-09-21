<template>
  <el-dialog
    :model-value="modelValue"
    title="批量作业状态变更"
    width="680px"
    :append-to-body="false"
    :close-on-click-modal="false"
    @update:model-value="handleVisibleChange"
    @open="onOpen"
  >
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="tip-alert"
      title="按「单据类别 + 单据日期区间」批量变更作业状态"
      description="已完成：未作业明细置为已作业并清零剩余量；待作业：还原应作业余量。已真实扫码作业过、以及 ERP 漂移冲突的明细一律跳过，不会被覆盖。"
    />

    <el-form label-width="92px" class="batch-form">
      <el-form-item label="单据类别" required>
        <el-select v-model="form.docKey" placeholder="请选择单据类别" style="width: 100%">
          <el-option v-for="d in PRODUCTION_DOCS" :key="d.docKey" :label="d.name" :value="d.docKey" />
          <el-option :label="`全部（${PRODUCTION_DOCS.length} 类单据）`" :value="ALL_DOC_KEY" divided />
        </el-select>
        <p v-if="isAllDocs" class="field-tip">
          后端接口只接受单类别，选「全部」时前端会按 13 类单据依次执行后汇总，耗时随类别数线性增加。
        </p>
      </el-form-item>

      <el-form-item label="单据日期" required>
        <el-date-picker
          v-model="form.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
        <p class="field-tip">闭区间（含结束当天全天）；按 ERP 单据日期过滤，不是同步时间。</p>
      </el-form-item>

      <el-form-item label="动作状态" required>
        <el-radio-group v-model="form.targetStatus">
          <el-radio value="COMPLETED">已完成</el-radio>
          <el-radio value="PENDING">待作业</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <p v-if="spanWarning" class="span-warning">{{ spanWarning }}</p>
    <p v-if="progressText" class="progress-text">{{ progressText }}</p>

    <div
      v-if="runItems.length > 0"
      class="result-box"
      :class="{ 'has-skip': totals.skipped > 0, 'has-fail': failedCount > 0 }"
    >
      <div class="result-title">
        动作状态：{{ statusText }} · {{ scopeLabel }}
      </div>
      <div class="result-stats">
        <span>表头变更 <b>{{ totals.bills }}</b> 张</span>
        <span>明细变更 <b>{{ totals.items }}</b> 条</span>
        <span>跳过 <b>{{ totals.skipped }}</b> 条</span>
        <span v-if="failedCount > 0">失败 <b>{{ failedCount }}</b> 类</span>
      </div>
      <ul class="result-list">
        <li v-for="item in runItems" :key="item.docKey">
          <span class="result-doc">{{ item.docName }}</span>
          <span v-if="item.ok" class="result-ok">
            表头 {{ item.affected_bills }} 张 · 明细 {{ item.affected_items }} 条 · 跳过 {{ item.skipped_items }} 条
          </span>
          <span v-else class="result-fail">{{ item.error }}</span>
        </li>
      </ul>
      <div v-if="totals.skipped > 0" class="result-note">
        已作业 / 冲突明细不会被覆盖，属预期行为。
      </div>
    </div>

    <template #footer>
      <el-button :disabled="submitting" @click="handleVisibleChange(false)">关闭</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">确认执行</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 批量变更生产单据 WMS 作业状态
 * 源接口：nuomi_wms/docs/20_生产管理_批量作业状态变更与未同步品号查询接口指引.md §2
 *   POST /api/v1/tenant-production/wms-status/batch-update（perm_production_manage）
 *
 * 后端安全边界（前端无需干预）：actual_qty>0 的已作业明细与 wms_drift_flag=1 的
 * ERP 漂移冲突明细强制跳过并计入 skipped_items；已是目标状态的明细幂等跳过。
 * 单事务同步执行，无异步任务 ID，因此只需按钮防重、无需轮询。
 *
 * ⚠️ 「全部」是前端能力：后端 doc_key 只接受 13 类之一（未知 404，无 ALL 分支），
 *    故选「全部」时按 PRODUCTION_DOCS 顺序**串行**逐类调用再汇总（串行是必须的：
 *    后端有 IP 令牌桶 5req/s，且 POST 不参与 429 自动重试）。
 */
import { computed, h, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  PRODUCTION_DOCS,
  PRODUCTION_DOC_NAME,
  batchUpdateProductionWmsStatus,
  type ProductionWmsStatusBatchResult,
  type ProductionWmsTargetStatus,
} from '@/api/modules/production'

/** 「全部」哨兵值：不进请求体，仅用于前端展开成 13 个 doc_key */
const ALL_DOC_KEY = '__ALL__'

interface BatchRunItem {
  docKey: string
  docName: string
  ok: boolean
  affected_bills: number
  affected_items: number
  skipped_items: number
  /** 失败原因（成功时为空串） */
  error: string
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  /** 从某个单据列表页打开时预填的单据类别 */
  defaultDocKey?: string
}>(), {
  defaultDocKey: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'done'): void
}>()

const submitting = ref(false)
const progressText = ref('')
const runItems = ref<BatchRunItem[]>([])

const form = reactive<{
  docKey: string
  dateRange: [string, string] | null
  targetStatus: ProductionWmsTargetStatus
}>({
  docKey: '',
  dateRange: null,
  targetStatus: 'COMPLETED',
})

const isAllDocs = computed(() => form.docKey === ALL_DOC_KEY)
const statusText = computed(() => (form.targetStatus === 'COMPLETED' ? '已完成' : '待作业'))
const scopeLabel = computed(() => (isAllDocs.value
  ? `全部 ${PRODUCTION_DOCS.length} 类单据`
  : (PRODUCTION_DOC_NAME[form.docKey] || form.docKey || '—')))

const totals = computed(() => runItems.value.reduce((acc, item) => {
  if (item.ok) {
    acc.bills += item.affected_bills
    acc.items += item.affected_items
    acc.skipped += item.skipped_items
  }
  return acc
}, { bills: 0, items: 0, skipped: 0 }))
const failedCount = computed(() => runItems.value.filter(item => !item.ok).length)

/** 日期跨度提示：后端不会拒绝大区间，但耗时与单据量成正比，建议分批 */
const spanWarning = computed(() => {
  const range = form.dateRange
  if (!range?.[0] || !range?.[1]) return ''
  const start = new Date(`${range[0]}T00:00:00`).getTime()
  const end = new Date(`${range[1]}T00:00:00`).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return ''
  const days = Math.round((end - start) / 86_400_000) + 1
  if (days <= 92) return ''
  const suffix = isAllDocs.value ? '，叠加 13 类单据依次执行后耗时更长' : ''
  return `所选区间共 ${days} 天，跨度较大。后端单事务同步执行，建议按月或按季度分批提交，避免超时${suffix}。`
})

function onOpen() {
  runItems.value = []
  progressText.value = ''
  form.dateRange = null
  form.targetStatus = 'COMPLETED'
  form.docKey = props.defaultDocKey || ''
}

function handleVisibleChange(value: boolean) {
  emit('update:modelValue', value)
}

/** 切换单据类别时清掉上一次的执行结果，避免旧结果被误读为本次结果 */
watch(() => form.docKey, () => {
  if (runItems.value.length > 0) runItems.value = []
})

function validate(): string | null {
  if (!form.docKey) return '请选择单据类别'
  if (!form.dateRange?.[0] || !form.dateRange?.[1]) return '请选择单据日期区间'
  if (form.dateRange[0] > form.dateRange[1]) return '开始日期不能晚于结束日期'
  return null
}

/** 二次确认：批量覆盖明细状态，提交前必须让用户完整看到三要素 */
async function confirmSubmit(): Promise<boolean> {
  const [start, end] = form.dateRange as [string, string]
  const lines = [
    h('p', { style: 'margin:0 0 6px;' }, `单据类别：${scopeLabel.value}`),
    h('p', { style: 'margin:0 0 6px;' }, `单据日期：${start} 至 ${end}（闭区间，含结束当天）`),
    h('p', { style: 'margin:0;' }, `动作状态：${statusText.value}`),
  ]
  if (isAllDocs.value) {
    lines.push(h('p', { style: 'margin:8px 0 0;color:var(--el-color-warning);' },
      `将按 ${PRODUCTION_DOCS.length} 类单据依次执行，请勿中途关闭窗口。`))
  }
  try {
    await ElMessageBox.confirm(h('div', { style: 'line-height:1.9;' }, lines), '批量变更确认', {
      confirmButtonText: '确认执行',
      cancelButtonText: '取消',
      type: 'warning',
      center: false,
    })
    return true
  } catch {
    return false
  }
}

async function submit() {
  const invalid = validate()
  if (invalid) {
    ElMessage.warning(invalid)
    return
  }
  if (!await confirmSubmit()) return

  const [start, end] = form.dateRange as [string, string]
  const docKeys = isAllDocs.value ? PRODUCTION_DOCS.map(d => d.docKey) : [form.docKey]
  submitting.value = true
  runItems.value = []

  const collected: BatchRunItem[] = []
  for (let i = 0; i < docKeys.length; i++) {
    const key = docKeys[i]
    const name = PRODUCTION_DOC_NAME[key] || key
    if (docKeys.length > 1) progressText.value = `正在处理 ${i + 1}/${docKeys.length}：${name}`
    try {
      // 多类别时关掉全局 toast，由下方结果区按类别统一呈现
      const res = await batchUpdateProductionWmsStatus(
        { doc_key: key, date_start: start, date_end: end, target_status: form.targetStatus },
        { silent: docKeys.length > 1 },
      )
      collected.push({ docKey: key, docName: name, ok: true, ...(res.data as ProductionWmsStatusBatchResult), error: '' })
    } catch (err) {
      collected.push({
        docKey: key,
        docName: name,
        ok: false,
        affected_bills: 0,
        affected_items: 0,
        skipped_items: 0,
        error: err instanceof Error ? err.message : '执行失败',
      })
    }
    // 逐类回填，让用户看到进度而不是等到全部结束
    runItems.value = [...collected]
  }

  progressText.value = ''
  submitting.value = false
  // 只要有一类成功就通知父级刷新（部分成功同样需要刷新）
  if (collected.some(item => item.ok)) emit('done')
}
</script>

<style scoped>
.tip-alert { margin-bottom: 16px; }
.batch-form :deep(.el-form-item) { margin-bottom: 18px; }
.field-tip { margin: 6px 0 0; font-size: 12px; color: var(--text-tertiary); line-height: 1.6; }
.span-warning {
  margin: 0 0 12px; padding: 8px 12px;
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: var(--radius-sm);
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  font-size: 12px; line-height: 1.7;
}
.progress-text {
  margin: 0 0 12px; font-size: 12px; color: var(--primary);
  font-variant-numeric: tabular-nums;
}
.result-box {
  padding: 12px 14px; border-radius: var(--radius-sm);
  border: 1px solid var(--el-color-success-light-5);
  background: var(--el-color-success-light-9);
}
.result-box.has-skip {
  border-color: var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
}
.result-box.has-fail {
  border-color: var(--el-color-danger-light-5);
  background: var(--el-color-danger-light-9);
}
.result-title { font-size: 13px; font-weight: 600; color: var(--text-primary); line-height: 1.7; }
.result-stats { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 8px; font-size: 12px; color: var(--text-secondary); }
.result-stats b { color: var(--text-primary); font-variant-numeric: tabular-nums; }
.result-list {
  margin: 10px 0 0; padding: 0; list-style: none;
  max-height: 168px; overflow-y: auto;
  font-size: 12px; line-height: 1.9;
}
.result-list li { display: flex; gap: 10px; }
.result-doc { flex: 0 0 116px; color: var(--text-secondary); }
.result-ok { color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.result-fail { color: var(--el-color-danger); }
.result-note { margin-top: 8px; font-size: 12px; color: var(--text-tertiary); }
</style>
