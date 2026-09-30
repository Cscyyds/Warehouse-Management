<script setup lang="ts">
/**
 * 生产管理 · 同步失败记录 Tab（平台管理员排障用）
 *
 * 数据源：trade_sync_reject（天心单据校验失败自动落表；同单至多一条，成功导入自动清除）。
 * 平台侧三接口（平台管理员 JWT 鉴权，不受租户总开关限制）：
 *   GET /platform-trade/sync-rejects/list|search|detail（side 必传，严格分侧）
 * 与租户侧的差异：额外返回 raw_error（平台排障原始报错，决策点②），且无重导入入口
 * （重导入由租户侧自行操作，平台只读观测）。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getPlatformSyncRejectDetail,
  listPlatformSyncRejects,
  searchPlatformSyncRejects,
  type PlatformSyncRejectDetailResult,
  type PlatformSyncRejectRow,
  type TradeRejectSide,
} from '@/api/platformTrade'

const props = defineProps<{ tenantId: string }>()

const SIDES: Array<{ label: string; value: TradeRejectSide }> = [
  { label: '采购侧（进货单 / 进货退回单）', value: 'purchase' },
  { label: '销售侧（销货单 / 销货退回单）', value: 'sales' },
]

const DOC_KEY_OPTIONS: Record<TradeRejectSide, Array<{ label: string; value: string }>> = {
  purchase: [
    { label: '进货单', value: 'trade-purchase-order' },
    { label: '进货退回单', value: 'trade-purchase-return' },
  ],
  sales: [
    { label: '销货单', value: 'trade-sales-order' },
    { label: '销货退回单', value: 'trade-sales-return' },
  ],
}

// 拒绝表 trigger_type 实际只写 AUTO / MANUAL 两值（record_reject 归一化：非 MANUAL 一律归
// AUTO，重启重扫亦归 AUTO；手动同步/重试归 MANUAL），不设查不到的选项
const TRIGGER_TYPE_OPTIONS = [
  { label: '自动轮次', value: 'AUTO' },
  { label: '手动同步', value: 'MANUAL' },
]

const pageSize = 20
const side = ref<TradeRejectSide>('purchase')
const loading = ref(false)
const rows = ref<PlatformSyncRejectRow[]>([])
const total = ref(0)
const page = ref(1)

const dateRange = ref<[string, string] | null>(null)
const filters = reactive<{ erp_bill_no: string; doc_key: string; trigger_type: string }>({
  erp_bill_no: '',
  doc_key: '',
  trigger_type: '',
})

const docKeyOptions = computed(() => DOC_KEY_OPTIONS[side.value])

/** 排序白名单（后端仅支持 created_at / erp_bill_no / doc_key），白名单外不传避免 400 */
const REJECT_SORT_FIELDS = new Set(['created_at', 'erp_bill_no', 'doc_key'])
const sortBy = ref('')
const sortOrder = ref('')

/** reasons 在 list/search 返回中是 JSON 数组字符串，解析失败时原样透出（不因脏数据丢行） */
function parseReasons(raw: unknown): string {
  const text = String(raw ?? '')
  if (!text) return '—'
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.length ? parsed.map(String).join('；') : '—'
  } catch {
    // 非 JSON 字符串按原文展示
  }
  return text
}

function triggerLabel(value: unknown) {
  return TRIGGER_TYPE_OPTIONS.find((o) => o.value === value)?.label || String(value ?? '—')
}

async function load() {
  if (!props.tenantId) return
  loading.value = true
  try {
    const base = {
      page: page.value,
      page_size: pageSize,
      date_from: dateRange.value?.[0] || undefined,
      date_to: dateRange.value?.[1] || undefined,
      sort_by: REJECT_SORT_FIELDS.has(sortBy.value) ? sortBy.value : undefined,
      sort_order: REJECT_SORT_FIELDS.has(sortBy.value) ? (sortOrder.value || undefined) : undefined,
    }
    const fields: string[] = []
    const values: Record<string, string> = {}
    if (filters.erp_bill_no.trim()) { fields.push('erp_bill_no'); values.erp_bill_no = filters.erp_bill_no.trim() }
    if (filters.doc_key) { fields.push('doc_key'); values.doc_key = filters.doc_key }
    if (filters.trigger_type) { fields.push('trigger_type'); values.trigger_type = filters.trigger_type }
    const data = fields.length
      ? await searchPlatformSyncRejects(props.tenantId, side.value, fields, values, base)
      : await listPlatformSyncRejects(props.tenantId, side.value, base)
    rows.value = data.records || []
    total.value = data.total || 0
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(error instanceof Error ? error.message : '同步失败记录加载失败')
  } finally {
    loading.value = false
  }
}

function handleSortChange({ prop, order }: { prop: string | null; order: string | null }) {
  sortBy.value = order ? (prop || '') : ''
  sortOrder.value = order === 'ascending' ? 'ASC' : order === 'descending' ? 'DESC' : ''
  applyFilters()
}

function applyFilters() { page.value = 1; load() }
function resetFilters() {
  dateRange.value = null
  Object.assign(filters, { erp_bill_no: '', doc_key: '', trigger_type: '' })
  sortBy.value = ''
  sortOrder.value = ''
  applyFilters()
}
function changePage(next: number) { page.value = next; load() }

function switchSide(next: TradeRejectSide) {
  side.value = next
  filters.doc_key = ''
  sortBy.value = ''
  sortOrder.value = ''
  applyFilters()
}

// ── 详情（reasons 数组 + raw_error 原始报错）──
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<PlatformSyncRejectDetailResult | null>(null)

async function openDetail(row: PlatformSyncRejectRow) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getPlatformSyncRejectDetail(props.tenantId, side.value, row.reject_id)
  } catch (error) {
    detailVisible.value = false
    ElMessage.error(error instanceof Error ? error.message : '失败记录详情加载失败')
  } finally {
    detailLoading.value = false
  }
}

watch(() => props.tenantId, () => { page.value = 1; load() })
onMounted(load)
</script>

<template>
  <div class="trade-reject-tab">
    <div class="reject-side-bar">
      <el-radio-group :model-value="side" @update:model-value="switchSide($event as TradeRejectSide)">
        <el-radio-button v-for="item in SIDES" :key="item.value" :value="item.value">{{ item.label }}</el-radio-button>
      </el-radio-group>
      <span class="reject-side-hint">严格分侧查询；重导入由租户侧自行操作，本页只读观测。</span>
    </div>

    <section class="filter-deck filter-deck--compact">
      <div class="filter-grid filter-grid--reject">
        <label><span>ERP 单号</span>
          <el-input v-model="filters.erp_bill_no" clearable placeholder="模糊匹配" @keyup.enter="applyFilters" />
        </label>
        <label><span>单据线</span>
          <el-select v-model="filters.doc_key" clearable placeholder="全部单据">
            <el-option v-for="item in docKeyOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </label>
        <label><span>触发方式</span>
          <el-select v-model="filters.trigger_type" clearable placeholder="全部方式">
            <el-option v-for="item in TRIGGER_TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </label>
        <label><span>被拒时间</span>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </label>
        <div class="filter-actions filter-actions--bottom">
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" :loading="loading" @click="applyFilters">查询记录</el-button>
        </div>
      </div>
    </section>

    <el-table v-loading="loading" :data="rows" stripe table-layout="fixed" empty-text="该侧暂无失败记录" @sort-change="handleSortChange">
      <el-table-column label="最近被拒时间" width="160" sortable="custom" prop="created_at">
        <template #default="scope"><span class="mono-label">{{ scope.row.created_at || '—' }}</span></template>
      </el-table-column>
      <el-table-column label="ERP 单号" min-width="150" sortable="custom" prop="erp_bill_no" show-overflow-tooltip>
        <template #default="scope"><span class="mono-label">{{ scope.row.erp_bill_no }}</span></template>
      </el-table-column>
      <el-table-column label="单据线" width="110" sortable="custom" prop="doc_key">
        <template #default="scope">{{ scope.row.doc_key_name || scope.row.doc_key }}</template>
      </el-table-column>
      <el-table-column label="被拒原因" min-width="240" show-overflow-tooltip>
        <template #default="scope">{{ parseReasons(scope.row.reasons) }}</template>
      </el-table-column>
      <el-table-column label="触发方式" width="96" align="center">
        <template #default="scope">{{ triggerLabel(scope.row.trigger_type) }}</template>
      </el-table-column>
      <el-table-column label="轮次" width="72" align="right">
        <template #default="scope"><span class="mono-label">{{ scope.row.round_id ?? '—' }}</span></template>
      </el-table-column>
      <el-table-column label="原始报错" width="96" align="center">
        <template #default="scope">
          <el-tag v-if="scope.row.raw_error" size="small" type="danger" effect="plain" class="raw-tag">有</el-tag>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="76" fixed="right">
        <template #default="scope"><el-button link type="primary" @click="openDetail(scope.row)">详情</el-button></template>
      </el-table-column>
    </el-table>

    <div class="detail-pagination">
      <el-pagination
        v-if="total > pageSize"
        background
        layout="total, prev, pager, next"
        :page-size="pageSize"
        :total="total"
        :current-page="page"
        @current-change="changePage"
      />
    </div>

    <el-dialog v-model="detailVisible" title="同步失败记录详情（平台排障）" width="680px" :close-on-click-modal="false">
      <div v-loading="detailLoading" class="reject-detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="ERP 单号">{{ detail?.erp_bill_no || '—' }}</el-descriptions-item>
          <el-descriptions-item label="单据线">{{ detail?.doc_key_name || detail?.doc_key || '—' }}</el-descriptions-item>
          <el-descriptions-item label="触发方式">{{ triggerLabel(detail?.trigger_type) }}</el-descriptions-item>
          <el-descriptions-item label="同步轮次">{{ detail?.round_id ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="最近被拒时间" :span="2">{{ detail?.created_at || '—' }}</el-descriptions-item>
        </el-descriptions>
        <div class="reject-block-head">被拒原因（{{ detail?.reasons?.length || 0 }} 条）</div>
        <div v-if="detail?.reasons?.length" class="reject-block">
          <div v-for="(r, i) in detail.reasons" :key="i" class="reject-block-line">{{ r }}</div>
        </div>
        <el-empty v-else description="无原因明细" :image-size="60" />
        <template v-if="detail?.raw_error">
          <div class="reject-block-head">原始报错（raw_error，仅平台侧可见）</div>
          <pre class="reject-raw">{{ detail.raw_error }}</pre>
        </template>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.trade-reject-tab { display: grid; gap: 16px; }
.reject-side-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; }
.reject-side-hint { color: #8a98a7; font-size: 11px; }
.filter-grid--reject { grid-template-columns: 1.1fr 1fr 0.8fr 1.4fr auto; align-items: end; }
.raw-tag { cursor: default; }
.reject-detail { min-height: 140px; }
.reject-block-head { margin: 14px 0 8px; font-size: 12px; font-weight: 700; color: #526b87; }
.reject-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
  overflow: auto;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f7f9fb;
  border: 1px solid var(--line);
}
.reject-block-line { font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }
.reject-raw {
  margin: 0;
  max-height: 240px;
  overflow: auto;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fdf3f3;
  border: 1px solid #f0d5d5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: #ad3e3e;
}
@media (max-width: 1180px) {
  .filter-grid--reject { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
