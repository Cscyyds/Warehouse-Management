<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  PRODUCTION_DOC_OPTIONS,
  fetchProductionBills,
  querySyncStatus,
  triggerProductionSync,
} from '@/api/productionManagement'
import type { FetchBillsResult, SyncDocState, SyncStatusData } from '@/types/productionManagement'

const props = defineProps<{
  tenantId: string
  enabled: boolean
  /** 父级控制：抽屉打开且当前停留在本 Tab 时为 true，用于启停轮询 */
  active: boolean
  /** 父级写操作版本号：变化时重新拉取状态（避免 enabled 快照过期） */
  dataVersion: number
}>()

const POLL_INTERVAL = 8000
const MAX_FETCH_BILLS = 50

const loading = ref(false)
const status = ref<SyncStatusData | null>(null)
const polling = ref(false)
const triggering = ref(false)
const triggerDocKey = ref('')
let timer: number | null = null

const fetchOpen = ref(false)
const fetching = ref(false)
const fetchDocKey = ref('')
const fetchText = ref('')
const fetchResult = ref<FetchBillsResult | null>(null)

/** 模块是否启用：父级 enabled 为 false 时立即收紧（不等下一次状态响应），
 *  避免「在配置 Tab 关掉模块后，本 Tab 仍按过期 status 显示可用按钮」 */
const moduleEnabled = computed(() => (props.enabled ? (status.value?.enabled ?? true) : false))
const docs = computed<SyncDocState[]>(() => status.value?.docs || [])
const docOptions = computed(() =>
  docs.value.length
    ? docs.value.map((item) => ({ value: item.doc_key, label: item.doc_name }))
    : PRODUCTION_DOC_OPTIONS,
)

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function load() {
  loading.value = true
  try {
    status.value = await querySyncStatus(props.tenantId)
  } catch (error) {
    ElMessage.error(errorMessage(error, '同步状态加载失败'))
  } finally {
    loading.value = false
  }
}

function stopPolling() {
  if (timer !== null) { clearInterval(timer); timer = null }
}

function startPolling() {
  stopPolling()
  timer = window.setInterval(load, POLL_INTERVAL)
}

/** 父级写操作（如关闭模块）后刷新状态快照 */
watch(() => props.dataVersion, () => { load() })

watch(() => props.active, (active) => {
  if (active) {
    load()
    if (polling.value) startPolling()
  } else {
    stopPolling()
  }
})

onMounted(() => {
  load()
  if (props.active && polling.value) startPolling()
})

onBeforeUnmount(stopPolling)

function phaseClass(phase: string) {
  if (phase === 'BACKFILL') return 'is-info'
  if (phase === 'INCREMENTAL') return 'is-success'
  return 'is-muted'
}

function phaseLabel(phase: string) {
  if (phase === 'BACKFILL') return '回填中'
  if (phase === 'INCREMENTAL') return '增量'
  if (phase === 'RECONCILE') return '对账'
  return phase || '—'
}

function progressPercent(row: SyncDocState) {
  if (!row.slice_total || row.slice_total <= 0) return 0
  return Math.min(100, Math.round((row.slice_done / row.slice_total) * 100))
}

async function trigger(mode: 'INCREMENTAL' | 'FULL') {
  if (mode === 'FULL') {
    try {
      await ElMessageBox.confirm(
        '全量同步将从头重推回填窗口，耗时较长且会重复调用 ERP 接口。确认继续？',
        '全量同步确认',
        { type: 'warning', confirmButtonText: '确认全量' },
      )
    } catch {
      return
    }
  }
  triggering.value = true
  try {
    const data = await triggerProductionSync({
      tenant_id: props.tenantId,
      doc_key: triggerDocKey.value || undefined,
      mode,
    })
    ElMessage.success(`已投递 ${data.dispatched} 个轮次任务，后台异步执行`)
    polling.value = true
    if (props.active) startPolling()
  } catch (error) {
    ElMessage.error(errorMessage(error, '触发同步失败'))
  } finally {
    triggering.value = false
  }
}

function openFetch() {
  fetchDocKey.value = docOptions.value[0]?.value || ''
  fetchText.value = ''
  fetchResult.value = null
  fetchOpen.value = true
}

async function submitFetch() {
  if (!fetchDocKey.value) { ElMessage.warning('请选择要补录的单据类型'); return }
  const nos = fetchText.value.split('\n').map((item) => item.trim()).filter(Boolean)
  if (!nos.length) { ElMessage.warning('请至少输入一个 ERP 单号（每行一个）'); return }
  if (nos.length > MAX_FETCH_BILLS) { ElMessage.warning(`单次最多补录 ${MAX_FETCH_BILLS} 张单号`); return }
  fetching.value = true
  try {
    const data = await fetchProductionBills({
      tenant_id: props.tenantId,
      doc_key: fetchDocKey.value,
      erp_bill_nos: JSON.stringify(nos),
    })
    fetchResult.value = data
    ElMessage.success(`补录完成：请求 ${data.requested} 张，落库 ${data.fetched} 张`)
    load()
  } catch (error) {
    ElMessage.error(errorMessage(error, '按单号补录失败'))
  } finally {
    fetching.value = false
  }
}
</script>

<template>
  <div class="sync-status-tab">
    <el-alert
      v-if="!moduleEnabled"
      class="tab-notice"
      type="warning"
      show-icon
      :closable="false"
      title="模块已关闭，租户端生产页面不可访问"
      description="请在「模块配置」中开启生产模块后再触发同步。"
    />

    <div class="sync-toolbar">
      <div class="sync-toolbar__left">
        <el-select v-model="triggerDocKey" clearable placeholder="全部 13 单据" class="doc-select">
          <el-option v-for="item in docOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-button type="primary" :loading="triggering" :disabled="!moduleEnabled" @click="trigger('INCREMENTAL')">增量同步</el-button>
        <el-button :loading="triggering" :disabled="!moduleEnabled" @click="trigger('FULL')">全量同步</el-button>
        <el-button :disabled="!moduleEnabled" @click="openFetch">按单号补录</el-button>
      </div>
      <div class="sync-toolbar__right">
        <span v-if="polling && active" class="polling-hint"><i class="polling-dot" />自动刷新中（{{ POLL_INTERVAL / 1000 }}s）</span>
        <el-button link type="primary" :loading="loading" @click="load">手动刷新</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="docs" stripe table-layout="fixed" empty-text="暂无同步状态，开启模块后会自动初始化 13 个单据">
      <el-table-column label="单据" min-width="150" fixed="left">
        <template #default="scope"><div class="table-person"><strong>{{ scope.row.doc_name }}</strong><span>{{ scope.row.doc_key }}</span></div></template>
      </el-table-column>
      <el-table-column label="相位" width="140">
        <template #default="scope">
          <span class="status-pill" :class="phaseClass(scope.row.phase)">{{ phaseLabel(scope.row.phase) }}</span>
          <el-progress
            v-if="scope.row.phase === 'BACKFILL' && scope.row.slice_total > 0"
            :percentage="progressPercent(scope.row)"
            :stroke-width="4"
            class="slice-progress"
          />
          <span v-if="scope.row.backfill_done === 0" class="backfill-badge">回填未完成</span>
        </template>
      </el-table-column>
      <el-table-column label="水位" width="150">
        <template #default="scope"><span class="mono-label">{{ scope.row.watermark_end || '—' }}</span></template>
      </el-table-column>
      <el-table-column label="下次调度" width="150">
        <template #default="scope"><span class="mono-label">{{ scope.row.next_run_at || '—' }}</span></template>
      </el-table-column>
      <el-table-column label="最近成功" width="150">
        <template #default="scope"><span class="mono-label">{{ scope.row.last_success_at || '—' }}</span></template>
      </el-table-column>
      <el-table-column label="连续失败" width="90" align="center">
        <template #default="scope"><span class="status-pill" :class="scope.row.consecutive_failures >= 1 ? 'is-danger' : 'is-muted'">{{ scope.row.consecutive_failures }}</span></template>
      </el-table-column>
      <el-table-column label="未绑品号" width="94" align="center">
        <template #default="scope">
          <el-tooltip :disabled="scope.row.unbound_prd_count <= 0" content="存在未绑定 WMS 产品的明细，请通知租户补齐产品档案（货号需与 ERP 品号一致）" placement="top">
            <span class="status-pill" :class="scope.row.unbound_prd_count > 0 ? 'is-warning' : 'is-muted'">{{ scope.row.unbound_prd_count }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="最近错误" min-width="200">
        <template #default="scope">
          <el-tooltip v-if="scope.row.last_error_msg" :content="scope.row.last_error_msg" placement="top">
            <span class="error-msg">{{ scope.row.last_error_msg }}</span>
          </el-tooltip>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column label="执行" width="90" align="center">
        <template #default="scope">
          <el-tooltip :disabled="!scope.row.claimed_by" :content="`worker：${scope.row.claimed_by}，租约至 ${scope.row.lease_until || '—'}`" placement="top">
            <span class="status-pill" :class="scope.row.claimed_by ? 'is-info' : 'is-muted'">{{ scope.row.claimed_by ? '执行中' : '空闲' }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="fetchOpen" title="按单号补录" width="560px" :close-on-click-modal="false">
      <div class="dialog-notice">
        <span class="mono-label">MANUAL FETCH</span>
        <p>逐张直查 ERP 强制落库，同步等待结果。适用于批量接口关闭、漏单核对或超对账窗口的远期单，单次最多 {{ MAX_FETCH_BILLS }} 张。</p>
      </div>
      <el-form label-position="top" class="dense-form">
        <el-form-item label="单据类型" required>
          <el-select v-model="fetchDocKey" placeholder="选择单据">
            <el-option v-for="item in docOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="ERP 单号（每行一个）" required>
          <el-input v-model="fetchText" type="textarea" :rows="6" placeholder="ML24230147&#10;ML24230148" />
        </el-form-item>
      </el-form>
      <div v-if="fetchResult" class="fetch-result">
        <div class="fetch-result__summary">
          <span>请求 <strong>{{ fetchResult.requested }}</strong> 张</span>
          <span>落库 <strong>{{ fetchResult.fetched }}</strong> 张</span>
          <span>未找到 <strong>{{ fetchResult.missing.length }}</strong> 张</span>
        </div>
        <div v-if="fetchResult.missing.length" class="fetch-result__missing">
          <span class="mono-label">ERP 未找到</span>
          <div class="missing-tags"><el-tag v-for="no in fetchResult.missing" :key="no" size="small" type="danger" effect="plain">{{ no }}</el-tag></div>
        </div>
      </div>
      <template #footer>
        <el-button @click="fetchOpen = false">关闭</el-button>
        <el-button type="primary" :loading="fetching" @click="submitFetch">开始补录</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.sync-status-tab { display: grid; gap: 16px; }
.sync-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.sync-toolbar__left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sync-toolbar__right { display: flex; align-items: center; gap: 12px; }
.doc-select { width: 180px; }
.polling-hint { display: inline-flex; align-items: center; gap: 6px; color: #2b8a66; font-size: 11px; }
.polling-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--signal-green); box-shadow: 0 0 0 4px rgba(43, 138, 102, 0.12); }
.slice-progress { margin-top: 6px; }
.backfill-badge { display: inline-block; margin-top: 6px; padding: 2px 6px; color: #b0642a; border: 1px solid #f0d5b5; background: #fff5e4; border-radius: 999px; font-size: 9px; font-weight: 750; }
.status-pill.is-warning { color: #b0642a; border-color: #f0d5b5; background: #fff5e4; }
.error-msg { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ad3e3e; font-size: 11px; vertical-align: bottom; }
.fetch-result { margin-top: 4px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; background: #f7f9fb; }
.fetch-result__summary { display: flex; gap: 20px; color: #68798c; font-size: 12px; }
.fetch-result__summary strong { color: var(--cargo-ink); font-size: 16px; }
.fetch-result__missing { margin-top: 12px; }
.fetch-result__missing .mono-label { color: #ad3e3e; }
.missing-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
</style>
