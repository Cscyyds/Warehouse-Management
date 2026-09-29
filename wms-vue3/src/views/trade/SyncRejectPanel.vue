<template>
  <div class="sync-reject-panel">
    <!-- 筛选区：日期区间（按最近被拒时间，截止日含全天）+ 单号模糊 + 单据线/触发方式等值 -->
    <el-form inline size="default" class="reject-filter">
      <el-form-item label="被拒时间">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始"
          end-placeholder="结束"
          value-format="YYYY-MM-DD"
          style="width: 240px"
          @change="handleSearch"
        />
      </el-form-item>
      <el-form-item label="ERP 单号">
        <el-input
          v-model="erpBillNo"
          placeholder="模糊匹配"
          clearable
          style="width: 180px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
      </el-form-item>
      <el-form-item label="单据线">
        <el-select v-model="docKeyFilter" placeholder="全部" clearable style="width: 190px" @change="handleSearch">
          <el-option v-for="o in docKeyOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="触发方式">
        <el-select v-model="triggerType" placeholder="全部" clearable style="width: 130px" @change="handleSearch">
          <el-option v-for="o in TRIGGER_TYPE_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 工具条：一键重试全部（不传单号 = 本侧全量）+ 刷新 -->
    <div class="reject-toolbar">
      <el-button
        v-perm="retryPerm"
        type="warning"
        :loading="retryingAll"
        :disabled="retryCooldown || !pagination.total"
        @click="handleRetryAll"
      >
        <el-icon><RefreshRight /></el-icon>一键重试全部（{{ pagination.total }}）
      </el-button>
      <el-button :loading="loading" @click="loadData">
        <el-icon><Refresh /></el-icon>刷新
      </el-button>
      <span class="reject-toolbar-hint">重试成功的单据会自动从失败列表消失；量多时转后台处理，可稍后刷新查看进度</span>
    </div>

    <el-table
      v-loading="loading"
      :data="tableData"
      border
      size="small"
      row-key="reject_id"
      style="width: 100%"
      @sort-change="handleSortChange"
    >
      <el-table-column prop="erp_bill_no" label="ERP 单号" min-width="150" sortable="custom" show-overflow-tooltip />
      <el-table-column prop="doc_key_name" label="单据线" width="120" sortable="custom" column-key="doc_key" show-overflow-tooltip />
      <el-table-column prop="reasonsText" label="被拒原因" min-width="260" show-overflow-tooltip />
      <el-table-column prop="trigger_type" label="触发方式" width="100" align="center">
        <template #default="{ row }">{{ triggerTypeLabel(row.trigger_type) }}</template>
      </el-table-column>
      <el-table-column prop="round_id" label="同步轮次" width="90" align="right">
        <template #default="{ row }">{{ row.round_id ?? '-' }}</template>
      </el-table-column>
      <el-table-column prop="created_at" label="最近被拒时间" width="160" sortable="custom" />
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
          <el-button
            v-perm="retryPerm"
            link
            type="warning"
            size="small"
            :disabled="retryCooldown || retryingIds.has(row.erp_bill_no)"
            @click="handleRetryOne(row)"
          >重试</el-button>
        </template>
      </el-table-column>
      <template #empty>暂无失败记录 —— 被拒单据重试成功后会自动从这里清除</template>
    </el-table>

    <el-pagination
      class="reject-pagination"
      background
      layout="total, sizes, prev, pager, next"
      :total="pagination.total"
      :page-sizes="[20, 50, 100, 200]"
      :current-page="pagination.page"
      :page-size="pagination.pageSize"
      @current-change="onPageChange"
      @size-change="onSizeChange"
    />

    <!-- 详情弹窗：reasons 为完整数组逐条展示 -->
    <el-dialog
      v-model="detailVisible"
      title="同步失败记录详情"
      width="640px"
      :close-on-click-modal="false"
    >
      <div v-loading="detailLoading" class="reject-detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="ERP 单号">{{ detail?.erp_bill_no || '-' }}</el-descriptions-item>
          <el-descriptions-item label="单据线">{{ detail?.doc_key_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="触发方式">{{ triggerTypeLabel(detail?.trigger_type) }}</el-descriptions-item>
          <el-descriptions-item label="同步轮次">{{ detail?.round_id ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="最近被拒时间" :span="2">{{ detail?.created_at || '-' }}</el-descriptions-item>
        </el-descriptions>
        <div class="reject-detail-reasons-head">被拒原因（{{ detail?.reasons?.length || 0 }} 条）</div>
        <div v-if="detail?.reasons?.length" class="reject-detail-reasons">
          <div v-for="(r, i) in detail.reasons" :key="i" class="reject-detail-reason">{{ r }}</div>
        </div>
        <el-empty v-else description="无原因明细" :image-size="60" />
      </div>
      <template #footer>
        <el-button
          v-perm="retryPerm"
          type="warning"
          :disabled="retryCooldown || detailLoading || !detail?.erp_bill_no"
          @click="handleRetryFromDetail"
        >重试该单</el-button>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 天心同步失败（拒绝）记录面板（按侧查询 + 重导入）。
 * 宿主：TradeBillList 的抽屉（天心四单据页），side 由 docKey 推导；
 * 数据源 trade_sync_reject（同单至多一条，成功导入自动清除）。
 * 行为要点（2026-09-28 批次）：
 *   - reasons 在 list/search 返回中是 JSON 数组字符串，此处统一解析；detail 已是数组；
 *   - retry 不传单号 = 一键全量；大批量超 120 秒转后台（无 results），提示后手动刷新列表看进度；
 *   - 409（15 分钟内有在途任务 / 等锁超时）→ warning + 3 秒冷却，防连点白跑。
 */
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { Refresh, RefreshRight } from '@element-plus/icons-vue'
import { useTableSort } from '@/composables/useTableSort'
import { TRADE_DOC_NAME, TRADE_DOCS, rejectDocKeyOfDocKey } from '@/api/modules/trade'
import {
  getTradeSyncRejectDetail,
  listTradeSyncRejects,
  retryTradeSyncRejects,
  searchTradeSyncRejects,
  type TradeSyncRejectDetailResult,
  type TradeSyncRejectQuery,
  type TradeSyncRejectRetryItem,
  type TradeSyncRejectRow,
  type TradeSyncSide,
} from '@/api/modules/trade'

const props = defineProps<{ side: TradeSyncSide }>()

/** 失败记录里的 doc_key 带 trade- 前缀；筛选下拉按本侧两条单据线生成 */
const docKeyOptions = computed(() =>
  TRADE_DOCS
    .filter((d) => d.docKey.startsWith(props.side))
    .map((d) => ({ value: rejectDocKeyOfDocKey(d.docKey), label: TRADE_DOC_NAME[d.docKey] || d.name })),
)

// 拒绝表 trigger_type 实际只写 AUTO / MANUAL 两值（import_service.record_reject 归一化，
// 重启重扫归 AUTO、手动/重试归 MANUAL），不设 RESTART 等查不到的选项
const TRIGGER_TYPE_OPTIONS = [
  { value: 'AUTO', label: '自动轮次' },
  { value: 'MANUAL', label: '手动同步' },
]
function triggerTypeLabel(value: unknown): string {
  return TRIGGER_TYPE_OPTIONS.find((o) => o.value === value)?.label || String(value ?? '-')
}

// ── 端点（v-perm 用，随 side 变化）──
const retryPerm = computed(() => `POST /api/v1/tenant-trade/${props.side}/sync-rejects/retry`)

// ── 筛选与分页 ──
const dateRange = ref<[string, string] | null>(null)
const erpBillNo = ref('')
const docKeyFilter = ref('')
const triggerType = ref('')
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const loading = ref(false)
const tableData = ref<(TradeSyncRejectRow & { reasonsText: string })[]>([])
const { handleSortChange, sortParams } = useTableSort(loadData)

/** 排序白名单（后端仅支持 created_at / erp_bill_no / doc_key），白名单外不传避免 400 */
const REJECT_SORT_FIELDS = new Set(['created_at', 'erp_bill_no', 'doc_key'])

/** reasons 为 JSON 数组字符串，解析失败时原样透出（不因脏数据丢行） */
function parseReasons(raw: unknown): string {
  const text = String(raw ?? '')
  if (!text) return '-'
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.length ? parsed.map(String).join('；') : '-'
  } catch {
    // 非 JSON 字符串按原文展示
  }
  return text
}

/** 有效搜索条件：单号走 LIKE 模糊，单据线/触发方式等值 */
const activeConditions = computed(() => {
  const fields: string[] = []
  const values: Record<string, string> = {}
  if (erpBillNo.value.trim()) { fields.push('erp_bill_no'); values.erp_bill_no = erpBillNo.value.trim() }
  if (docKeyFilter.value) { fields.push('doc_key'); values.doc_key = docKeyFilter.value }
  if (triggerType.value) { fields.push('trigger_type'); values.trigger_type = triggerType.value }
  return { fields, values }
})

async function loadData() {
  loading.value = true
  try {
    const { fields, values } = activeConditions.value
    const base = {
      page: pagination.page,
      page_size: pagination.pageSize,
      date_from: dateRange.value?.[0] || undefined,
      date_to: dateRange.value?.[1] || undefined,
    }
    // 后端排序白名单外的字段直接 400，故过滤后再传
    const sortQuery: Pick<TradeSyncRejectQuery, 'sort_by' | 'sort_order'> = {}
    if (sortParams.sort_by && REJECT_SORT_FIELDS.has(sortParams.sort_by)) {
      sortQuery.sort_by = sortParams.sort_by as TradeSyncRejectQuery['sort_by']
      if (sortParams.sort_order) sortQuery.sort_order = sortParams.sort_order as 'ASC' | 'DESC'
    }
    const res = fields.length
      ? await searchTradeSyncRejects(props.side, fields, values, { ...base, ...sortQuery })
      : await listTradeSyncRejects(props.side, { ...base, ...sortQuery })
    tableData.value = (res.data.records || []).map((r) => ({ ...r, reasonsText: parseReasons(r.reasons) }))
    pagination.total = res.data.total || 0
    if (res.data.page_size) pagination.pageSize = res.data.page_size
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  loadData()
}

function handleReset() {
  dateRange.value = null
  erpBillNo.value = ''
  docKeyFilter.value = ''
  triggerType.value = ''
  pagination.page = 1
  loadData()
}

function onPageChange(page: number) {
  pagination.page = page
  loadData()
}

function onSizeChange(size: number) {
  pagination.pageSize = size
  pagination.page = 1
  loadData()
}

// ── 详情 ──
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<TradeSyncRejectDetailResult | null>(null)

async function openDetail(row: TradeSyncRejectRow) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await getTradeSyncRejectDetail(props.side, row.reject_id)
    detail.value = res.data
  } catch (error: unknown) {
    detailVisible.value = false
    ElMessage.error((error as Error)?.message || '查询失败记录详情失败')
  } finally {
    detailLoading.value = false
  }
}

// ── 重试（指定单号 / 一键全量）──
const retryingAll = ref(false)
const retryingIds = reactive(new Set<string>())
const retryCooldown = ref(false)

/** 单张结果摘要（前 3 条单号+原因，超出折叠计数），复用手动同步的口径 */
function retryIssueSummary(items: TradeSyncRejectRetryItem[]): string {
  const preview = items
    .slice(0, 3)
    .map((i) => `${i.erp_bill_no}${i.reasons?.length ? `（${i.reasons.join('；')}）` : ''}`)
    .join('；')
  return items.length > 3 ? `${preview} 等 ${items.length} 张` : preview
}

/**
 * 成功分支提示。results 为空 = 本侧本就无失败单据（后端 retried_total=0 的正常成功），
 * 非「转后台」——转后台走的是业务失败分支（见 isRetryBackgroundError）。
 */
function notifyRetryResult(message: string, results: TradeSyncRejectRetryItem[] | undefined) {
  if (!results || results.length === 0) {
    ElMessage.info(message || '当前无同步失败单据，无需重试')
    return
  }
  const rejected = results.filter((r) => r.action === 'rejected')
  const failed = results.filter((r) => r.action === 'failed')
  const okCount = results.length - rejected.length - failed.length
  if (rejected.length || failed.length) {
    ElNotification({
      type: 'warning',
      title: '重试完成（存在未消化的单据）',
      message: [
        message || `成功 ${okCount} 张，仍失败 ${rejected.length + failed.length} 张`,
        rejected.length && `仍被拒：${retryIssueSummary(rejected)}`,
        failed.length && `处理失败：${retryIssueSummary(failed)}`,
      ].filter(Boolean).join('\n'),
      duration: 8000,
    })
  } else {
    ElMessage.success(message || `重试完成：成功 ${okCount} 张，失败记录已全部消化`)
  }
}

/**
 * 「转后台」识别：后端超过门面等待窗口（120 秒）时返回的是**业务失败**
 * （HTTP 200 + success=false，message="{侧}失败单据重导入仍在处理"，
 * data 为引导文案且 extractErrorMessage 会优先取 data 字符串），任务在后台继续执行不丢数据。
 */
const RETRY_BACKGROUND_RE = /仍在处理|稍后在失败记录列表/

function isRetryBackgroundError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status && status !== 200) return false
  return RETRY_BACKGROUND_RE.test((error as Error)?.message || '')
}

function notifyRetryBackground(message: string) {
  ElNotification({
    type: 'warning',
    title: '重导入已转入后台处理',
    message: `${message || '任务仍在后台执行，无需重复提交'}。请稍后点击「刷新」查看失败列表，剩余条数减少即消化进度。`,
    duration: 8000,
  })
}

/** 409 = 单飞检查（15 分钟内有在途任务）或等锁超时：warning + 冷却，不按错误弹 */
function notifyRetryError(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === 409) {
    ElMessage.warning((error as Error)?.message || '已有同步任务正在处理，请稍后查看结果')
    retryCooldown.value = true
    setTimeout(() => { retryCooldown.value = false }, 3000)
  } else {
    const msg = (error as Error)?.message
    ElMessage.error(msg || '重试失败')
  }
}

async function doRetry(billNos?: string[]) {
  try {
    const res = await retryTradeSyncRejects(props.side, billNos)
    notifyRetryResult(res.message || '', res.data?.results)
    await loadData()
  } catch (error: unknown) {
    if (isRetryBackgroundError(error)) {
      // 转后台：立即刷新一次失败列表（remaining 数即消化进度），之后由用户手动刷新
      notifyRetryBackground((error as Error)?.message || '')
      await loadData()
    } else {
      notifyRetryError(error)
    }
  }
}

async function handleRetryOne(row: TradeSyncRejectRow) {
  retryingIds.add(row.erp_bill_no)
  try {
    await doRetry([row.erp_bill_no])
  } finally {
    retryingIds.delete(row.erp_bill_no)
  }
}

function handleRetryAll() {
  const tips = [
    `将重试 ${props.side === 'purchase' ? '采购' : '销售'}侧全部被拒单据（当前列表口径共 ${pagination.total} 张），不设业务上限。`,
    '重试按单张串行推进，量多时会超过等待窗口转入后台继续执行，不丢数据。',
    '重试成功后单据自动从失败列表消失；仍被拒的单保留最新一次被拒原因。',
  ]
  ElMessageBox.confirm(
    h('div', { style: 'white-space: pre-line; line-height: 1.7; font-size: 13px;' }, tips.join('\n')),
    '确认一键重试全部失败单据？',
    { confirmButtonText: '开始重试', cancelButtonText: '取消', type: 'warning' },
  )
    .then(async () => {
      retryingAll.value = true
      try {
        await doRetry(undefined)
      } finally {
        retryingAll.value = false
      }
    })
    .catch(() => {})
}

async function handleRetryFromDetail() {
  const billNo = detail.value?.erp_bill_no
  if (!billNo) return
  await handleRetryOne({ erp_bill_no: billNo } as TradeSyncRejectRow)
  // 重试后该单若已消化，详情关闭；仍被拒则详情仍在列表中
  detailVisible.value = false
}

watch(() => props.side, () => {
  docKeyFilter.value = ''
  pagination.page = 1
  loadData()
})

onMounted(loadData)
</script>

<style scoped>
.sync-reject-panel { display: flex; flex-direction: column; gap: 12px; }
.reject-filter { margin-bottom: 0; }
.reject-toolbar { display: flex; align-items: center; gap: 4px; }
.reject-toolbar-hint { margin-left: 10px; font-size: 12px; color: var(--el-text-color-secondary); }
.reject-pagination { justify-content: flex-end; }

.reject-detail { min-height: 120px; }
.reject-detail-reasons-head { margin: 14px 0 8px; font-size: 13px; font-weight: 600; color: var(--el-text-color-regular); }
.reject-detail-reasons {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 260px;
  overflow: auto;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}
.reject-detail-reason { font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }
</style>
