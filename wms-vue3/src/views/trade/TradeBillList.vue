<template>
  <ListTemplate
    :title="docConfig?.name || '贸易单据'"
    compact-header
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    :columns="columns"
    :table-data="tableData"
    pagination-mode="server"
    row-key="wms_bill_id"
    :show-index="true"
    :show-add="false"
    @page-change="loadData"
    @sort-change="handleSortChange"
  >
    <template #search>
      <div class="trade-filter">
        <!-- 第一行：日期区间 + 主操作。沿用全站列表页的 inline 表单口径，
             这样本页筛选区与其它 40+ 列表页看起来是同一套东西。 -->
        <el-form inline size="default" class="trade-filter-main">
          <el-form-item label="单据日期">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始"
              end-placeholder="结束"
              value-format="YYYY-MM-DD"
              style="width: 240px"
              :disabled="isSearching"
              @change="handleSearch"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 第二行：多字段搜索，条件横向排开、超宽自动换行。必须独立成行；
             若塞回 inline 表单的某个 form-item 里，inline 按垂直居中对齐兄弟项，
             会把日期行/查询按钮挤成阶梯状（2026-09-21 用户反馈的现场）。 -->
        <div
          v-perm="`GET /api/v1/tenant-trade/${docKey}/search`"
          class="trade-filter-adv"
        >
          <span class="trade-filter-adv-label">搜索</span>
          <div class="trade-filter-adv-body">
            <div v-for="(cond, idx) in searchConditions" :key="idx" class="trade-filter-cond">
              <el-select
                v-model="cond.field"
                placeholder="选择字段"
                filterable
                class="trade-filter-field"
                @change="cond.value = ''"
              >
                <el-option
                  v-for="f in searchableFields"
                  :key="f"
                  :label="fieldLabel(f)"
                  :value="f"
                />
              </el-select>
              <!-- 值控件跟随字段类型：日期给选择器、仓库状态给枚举下拉，
                   否则用户要对着 LIKE 匹配手打 yyyy-mm-dd 或裸码值。 -->
              <el-date-picker
                v-if="isDateField(cond.field)"
                v-model="cond.value"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                clearable
                class="trade-filter-value"
                @change="handleSearch"
              />
              <el-select
                v-else-if="enumOptions(cond.field)"
                v-model="cond.value"
                placeholder="选择值"
                clearable
                class="trade-filter-value"
                @change="handleSearch"
              >
                <el-option
                  v-for="o in enumOptions(cond.field) || []"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value"
                />
              </el-select>
              <el-input
                v-else
                v-model="cond.value"
                placeholder="输入值"
                clearable
                class="trade-filter-value"
                @keyup.enter="handleSearch"
              />
              <el-button
                v-if="searchConditions.length > 1"
                link
                type="danger"
                @click="removeCondition(idx)"
              >删除</el-button>
            </div>
            <div class="trade-filter-adv-foot">
              <el-button link type="primary" @click="addCondition">+ 添加条件</el-button>
              <span v-if="isSearching" class="search-scope-note">搜索模式：多字段 AND 组合，仅顶部「单据日期」区间不参与</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #actions>
      <!-- 手动同步 = 批量补录：**同一个接口、同一个弹窗**，按「是否填单号」自动切换两种模式：
             不填 = 窗口同步（WINDOW）；填了 = 按单号补录（BILL_NOS）。故只保留一个入口。 -->
      <el-button
        v-perm="`POST /api/v1/tenant-trade/${docKey}/sync/refresh`"
        type="warning"
        :disabled="syncCooldown"
        @click="openSyncDialog"
      >
        <el-icon><Refresh /></el-icon>手动同步
      </el-button>
    </template>

    <template #col-erp_bill_no="{ row }">
      <el-link
        v-perm="`GET /api/v1/tenant-trade/${docKey}/detail`"
        type="primary"
        :underline="false"
        @click="goDetail(row)"
      >{{ row.erp_bill_no }}</el-link>
    </template>

    <template #col-total_qty="{ row }">
      <span class="num-cell">{{ formatQty(row.total_qty) }}</span>
    </template>

    <template #col-warehouse_status="{ row }">
      <span>{{ WAREHOUSE_STATUS_LABELS[row.warehouse_status] ?? row.warehouse_status }}</span>
    </template>

    <template #col-actions="{ row }">
      <el-button
        v-perm="`GET /api/v1/tenant-trade/${docKey}/detail`"
        link
        type="primary"
        size="small"
        @click="goDetail(row)"
      >详情</el-button>
    </template>
  </ListTemplate>

  <!-- 手动同步弹窗（含批量补录）：模式由「是否填单号」驱动，界面实时反馈将要执行的动作 -->
  <el-dialog
    v-model="syncDialogVisible"
    :title="`手动同步 · ${docConfig?.name || ''}`"
    width="580px"
    :close-on-click-modal="false"
    class="sync-dialog"
    @opened="focusSyncInput"
  >
    <!-- 状态指示：单号必填，未填时明确提示"等待填入单号"并禁用提交 -->
    <div class="sync-mode" :class="syncHasInput ? 'is-ready' : 'is-empty'">
      <div class="sync-mode-icon">
        <el-icon><DocumentAdd /></el-icon>
      </div>
      <div class="sync-mode-body">
        <div class="sync-mode-title">
          {{ syncHasInput ? `按单号补录（${syncBillNos.length} 张）` : '等待填入单号' }}
        </div>
        <div class="sync-mode-desc">
          {{ syncHasInput
            ? '逐张直查这些单号，与增量窗口无关 —— 用于补回漏同步的单据。'
            : '单号必填：请粘贴或输入需要补录的 ERP 单号后再提交。' }}
        </div>
      </div>
    </div>

    <div class="sync-field">
      <div class="sync-field-head">
        <span class="sync-field-label">补录单号 <span class="sync-badge is-required">必填</span></span>
        <el-button v-if="syncText" link type="primary" size="small" @click="syncText = ''">清空</el-button>
      </div>
      <el-input
        ref="syncInputRef"
        v-model="syncText"
        type="textarea"
        :rows="8"
        resize="none"
        placeholder="每行一个 ERP 单号，也支持逗号 / 顿号分隔，可直接从 Excel 粘贴。"
      />
      <div class="sync-counter">
        <span class="sync-count">
          已解析 <b>{{ syncBillNos.length }}</b> 张
          <span class="sync-limit">/ 上限 {{ TOPUP_LIMIT }}</span>
        </span>
        <span v-if="syncOverLimit" class="sync-over">超出上限 {{ TOPUP_LIMIT }} 张，请删减后再提交</span>
        <span v-else-if="!syncHasInput" class="sync-hint">尚未填入单号</span>
        <span v-else-if="syncDupCount > 0" class="sync-ok">已自动去除 {{ syncDupCount }} 个重复单号</span>
      </div>
    </div>

    <template #footer>
      <el-button :disabled="syncing" @click="syncDialogVisible = false">取消</el-button>
      <el-button
        type="primary"
        :loading="syncing"
        :disabled="!canSubmitSync"
        @click="handleSubmitSync"
      >{{ submitLabel }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 贸易数据列表（天心侧，可嵌入）：
 * 由 4 个 WMS 采购/销售页面在 TIANXIN 贸易模式下就地渲染（同一页面切换数据源），
 * 不再作为独立路由页面。docKey 由父页面按 TRADE_SHARED_PAGES 传入。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElNotification } from 'element-plus'
import { DocumentAdd, Refresh } from '@element-plus/icons-vue'
import ListTemplate, { type Column } from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import { TRADE_DOC_CONFIG_MAP, TRADE_DATE_SEARCH_FIELDS, WAREHOUSE_STATUS_LABELS, getTradeEnumOptions, type TradeColumn } from '@/config/tradeDocConfig'
import { TOPUP_LIMIT, countBillNoSegments, isTopupOverLimit, parseBillNos } from '@/config/tradeTopup'
import {
  listTradeBills,
  searchTradeBills,
  refreshTradeBills,
  getHeaderSearchFields,
  getHeaderSortFields,
  type TradeBillQuery,
  type TradeBillRow,
  type TradeDocKey,
  type TradeSyncRefreshResult,
} from '@/api/modules/trade'

const props = defineProps<{ docKey: TradeDocKey }>()

const router = useRouter()

const docKey = computed(() => props.docKey)
const docConfig = computed(() => TRADE_DOC_CONFIG_MAP[docKey.value])

const tableData = ref<TradeBillRow[]>([])
const loading = ref(false)
const dateRange = ref<[string, string] | null>(null)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { handleSortChange, sortParams } = useTableSort(loadData)

// ── 多字段搜索（doc 2.2.3：search_field JSON 数组 + search_value JSON 对象，AND 组合） ──
interface SearchCondition { field: string; value: string }
const searchConditions = ref<SearchCondition[]>([{ field: '', value: '' }])

/**
 * 当前单据可搜索字段白名单（已过滤黑名单）。
 * 刻意隐藏 erp_bill_date：顶部「单据日期」走 /list 的 date_from/date_to（真区间），
 * 搜索条件里只能 LIKE 单日，两者互斥且重复。erp_modify_date/synced_at/cls_date
 * 顶部区间盖不到，保留。代价：搜索模式下暂不能按单据日期过滤，需 /search 支持日期参数。
 */
const searchableFields = computed(() =>
  getHeaderSearchFields(docKey.value).filter((f) => f !== 'erp_bill_date'),
)

/** 表头排序白名单（/search 与 /list 共用）；非白名单字段后端直接抛 400 */
const headerSortFields = computed(() => new Set(getHeaderSortFields(docKey.value)))

/** 字段名 → 中文标签（从列配置 + 公共字段映射） */
const FIELD_LABELS: Record<string, string> = {
  erp_bill_no: 'ERP 单号', erp_bill_date: '单据日期', erp_modify_date: 'ERP 修改时间',
  synced_at: '同步时间', ps_id: '单据ID', cus_no: '客户编号', sal_no: '销售编号',
  rem: '备注', bil_type: '单据类别', dep: '部门代码', dep_name: '部门名称',
  usr: '操作者', cls_date: '分类日期', lz_cls_id: '流转分类',
  warehouse_status: '仓库状态', total_qty: '数量合计',
  supplier_name: '供应商', employee_name: '经办人',
  customer_name: '客户', source_os_no: '来源单号',
  transfer_os_no: '转传单号', apply_os_no: '申请单号',
  ck_cls_id: '出库类别', cus_os_no: '客户单号',
}
function fieldLabel(field: string): string {
  return FIELD_LABELS[field] || field
}

/** 该字段的搜索值是否用日期选择器录入 */
function isDateField(field: string): boolean {
  return TRADE_DATE_SEARCH_FIELDS.has(field)
}

/** 该字段的枚举候选；null = 非枚举字段，走文本框 */
function enumOptions(field: string) {
  return getTradeEnumOptions(docKey.value, field)
}

/** 有效搜索条件（字段和值都非空）。日期选择器清空给 null、下拉清空给 undefined，
 *  故在此统一规范化为已 trim 的字符串，下游不再各自 .trim()。 */
const activeConditions = computed(() =>
  searchConditions.value
    .filter((c) => c.field && c.value != null && String(c.value).trim())
    .map((c) => ({ field: c.field, value: String(c.value).trim() })),
)
const isSearching = computed(() => activeConditions.value.length > 0)

function addCondition() {
  searchConditions.value.push({ field: '', value: '' })
}
function removeCondition(idx: number) {
  searchConditions.value.splice(idx, 1)
}

// ── 手动同步 = 按单号补录（doc 2.2.7） ──
// 接口：POST /api/v1/tenant-trade/{docKey}/sync/refresh
//   传 bill_nos   → 按单号补录（BILL_NOS，上限 50）
//   不传 bill_nos → 按增量窗口同步（WINDOW）
// ★ 产品约束：**单号必填**，未填不允许提交 ⇒ UI 只暴露补录这一条路径，
//   窗口同步交给定时轮次（celery beat）自动执行，无需人工触发。
// 结果提示与错误处理共用下面两个函数，避免重复实现分支。
const syncing = ref(false)
const syncCooldown = ref(false)

/** 同步问题明细预览（纯文本，避免 ERP 侧文本走 HTML 渲染）：前 3 条单号（原因），超出折叠计数 */
function syncIssueSummary(items: { bill_no: string; reasons?: string[] }[] | undefined): string {
  if (!items?.length) return ''
  const preview = items
    .slice(0, 3)
    .map(i => `${i.bill_no}${i.reasons?.length ? `（${i.reasons.join('；')}）` : ''}`)
    .join('；')
  return items.length > 3 ? `${preview} 等 ${items.length} 张` : preview
}

/**
 * 统一的同步/补录结果提示（WINDOW 与 BILL_NOS 共用）。
 * BILL_NOS 分支后端不回 stats，只回 synced_bills/skipped_bills/rejected/failed_bills，
 * 其计数已写进 message（「补录完成：成功 N，未变化 M，被拒 K，处理失败 J」），故成功分支直接透出 message。
 */
function notifySyncResult(data: TradeSyncRefreshResult | undefined, msg: string) {
  const rejected = data?.rejected || []
  const failed = data?.failed_bills || []
  const stats = data?.stats
  // 200 壳失败（FAILED / 凭证缺失 / ERP 通信异常）：提示完整 message 与明细，不吞掉
  if (data?.status === 'FAILED' || /未完成|未配置|连接失败|通信异常/.test(msg)) {
    ElNotification({
      type: 'warning',
      title: '同步未完全成功',
      message: [msg, syncIssueSummary(rejected) && `被拒：${syncIssueSummary(rejected)}`, syncIssueSummary(failed) && `失败：${syncIssueSummary(failed)}`]
        .filter(Boolean)
        .join('\n') || '请稍后重试',
      duration: 8000,
    })
  } else if (rejected.length || failed.length) {
    // 成功但有被拒/失败明细：完整展示，避免“同步完成”掩盖被拒单（doc 2.2.7）
    ElNotification({
      type: 'warning',
      title: '同步完成（存在被拒明细）',
      message: [
        stats ? `新建 ${stats.created}，更新 ${stats.updated}，未变化 ${stats.skipped}，被拒 ${stats.rejected}` : msg,
        syncIssueSummary(rejected) && `被拒：${syncIssueSummary(rejected)}`,
        syncIssueSummary(failed) && `失败：${syncIssueSummary(failed)}`,
      ].filter(Boolean).join('\n'),
      duration: 8000,
    })
  } else {
    ElMessage.success(
      stats
        ? `同步完成：新建 ${stats.created}，更新 ${stats.updated}，未变化 ${stats.skipped}，被拒 ${stats.rejected}`
        : msg || '同步完成',
    )
  }
}

/**
 * 统一的同步/补录错误处理。
 * 409：BUSY / DEFERRED，均为「稍后重试」而非错误 → warning + 3 秒冷却（防连点）。
 */
function notifySyncError(error: unknown, fallback: string) {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === 409) {
    // 文案已在全局拦截器归一化到 error.message（含 DEFERRED 的 covered_until）
    ElMessage.warning((error as Error)?.message || '同步进行中，请稍后重试')
    syncCooldown.value = true
    setTimeout(() => { syncCooldown.value = false }, 3000)
  } else {
    // 200 壳失败/其他错误：接口按 silent=true 调用，全局不弹，此处兜底展示
    const msg = (error as Error)?.message
    if (msg) ElMessage.error(msg)
    else ElMessage.error(fallback)
  }
}

// ── 手动同步 = 批量补录（同一接口的两种模式） ──
// 不传 bill_nos → 按增量窗口同步（WINDOW）；传 bill_nos → 按单号逐张补录（BILL_NOS，上限 50）。
// 输入解析与上限判定在 config/tradeTopup.ts（纯函数，已单测）。
const syncDialogVisible = ref(false)
const syncText = ref('')
const syncInputRef = ref<{ focus: () => void } | null>(null)

const syncBillNos = computed(() => parseBillNos(syncText.value))
const syncOverLimit = computed(() => isTopupOverLimit(syncBillNos.value.length))
/** 去重前的有效段数（用于提示「已自动去除 N 个重复单号」） */
const syncSegmentCount = computed(() => countBillNoSegments(syncText.value))
const syncDupCount = computed(
  () => Math.max(0, syncSegmentCount.value - syncBillNos.value.length),
)

/** 是否已填入单号。**单号必填** —— 未填不允许提交（见 handleSubmitSync 的硬约束），
 *  故不存在"空提交 → 走窗口同步"这条路径；窗口同步由定时轮次（celery beat）负责。 */
const syncHasInput = computed(() => syncBillNos.value.length > 0)
/** 提交按钮文案：未填时直接告知先填单号，避免用户以为按钮坏了 */
const submitLabel = computed(() =>
  syncHasInput.value ? `补录 ${syncBillNos.value.length} 张` : '请先填入单号',
)
/** 单号必填 + 不超限 + 不在提交中，才允许点击 */
const canSubmitSync = computed(
  () => syncHasInput.value && !syncOverLimit.value && !syncing.value,
)

function openSyncDialog() {
  syncText.value = ''
  syncDialogVisible.value = true
}

/** 弹窗打开后自动聚焦输入框，省掉一次点击 */
function focusSyncInput() {
  syncInputRef.value?.focus()
}

/** 提交补录：单号必填，故恒传 bill_nos（不再有"不传 = 窗口同步"这条 UI 路径） */
async function handleSubmitSync() {
  const nos = syncBillNos.value
  // 单号必填（前端硬约束；后端亦要求非空，空数组会返回「bill_nos 为空列表」）
  if (!nos.length) {
    ElMessage.warning('请先填入需要补录的 ERP 单号')
    return
  }
  // 前端预校验上限，避免白跑一次请求撞后端 400
  if (syncOverLimit.value) {
    ElMessage.warning(`单次补录上限 ${TOPUP_LIMIT} 张单号，当前 ${nos.length} 张，请删减后重试`)
    return
  }
  syncing.value = true
  try {
    const res = await refreshTradeBills(docKey.value, nos)
    notifySyncResult(res.data as TradeSyncRefreshResult, res.message || '')
    syncDialogVisible.value = false
    await loadData()
  } catch (error: unknown) {
    notifySyncError(error, '补录失败')
  } finally {
    syncing.value = false
  }
}

// ── 列配置 ──
const columns = computed<Column[]>(() => {
  const mapping: TradeColumn[] = docConfig.value?.headerColumns || []
  return [
    { prop: 'erp_bill_no', label: 'ERP 单号', minWidth: 150, sortable: true, priority: 'high' },
    { prop: 'erp_bill_date', label: '单据日期', width: 120, sortable: true },
    ...mapping,
    { prop: 'total_qty', label: '数量合计', width: 100, align: 'right', sortable: true },
    { prop: 'synced_at', label: '同步时间', width: 160, sortable: true, priority: 'low' },
  ] as Column[]
})

function formatQty(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : String(value)
}

// ── 数据加载 ──
async function loadData() {
  loading.value = true
  try {
    if (isSearching.value) {
      // 多字段搜索模式：后端支持排序，但字段不在排序白名单内会直接 400，故过滤后再传。
      const fields = activeConditions.value.map((c) => c.field)
      const values: Record<string, string> = {}
      for (const c of activeConditions.value) values[c.field] = c.value.trim()
      const sortQuery: { sort_by?: string; sort_order?: 'ASC' | 'DESC' } = {}
      if (sortParams.sort_by && headerSortFields.value.has(sortParams.sort_by)) {
        sortQuery.sort_by = sortParams.sort_by
        if (sortParams.sort_order) sortQuery.sort_order = sortParams.sort_order as 'ASC' | 'DESC'
      }
      const res = await searchTradeBills(docKey.value, fields, values, {
        page: pagination.page,
        page_size: pagination.pageSize,
        ...sortQuery,
      })
      tableData.value = res.data.records
      pagination.total = res.data.total
      if (res.data.page_size) pagination.pageSize = res.data.page_size
    } else {
      const query: TradeBillQuery = {
        page: pagination.page,
        page_size: pagination.pageSize,
        date_from: dateRange.value?.[0] || undefined,
        date_to: dateRange.value?.[1] || undefined,
      }
      if (sortParams.sort_by) query.sort_by = sortParams.sort_by
      if (sortParams.sort_order) query.sort_order = sortParams.sort_order as 'ASC' | 'DESC'
      const res = await listTradeBills(docKey.value, query)
      tableData.value = res.data.records
      pagination.total = res.data.total
      if (res.data.page_size) pagination.pageSize = res.data.page_size
    }
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
  searchConditions.value = [{ field: '', value: '' }]
  dateRange.value = null
  pagination.page = 1
  loadData()
}

function goDetail(row: TradeBillRow) {
  router.push(`/trade/${docKey.value}/detail/${row.wms_bill_id}`)
}

onMounted(loadData)
</script>

<style scoped>
.num-cell { font-variant-numeric: tabular-nums; }

/* ── 筛选区：日期行 + 多字段搜索行，两行式排布 ──
   原来把「可增删的多行条件块」塞进 el-form inline 的单个 form-item：inline 布局按垂直居中
   对齐兄弟项，日期行、条件行、查询按钮互相错位，「+ 添加条件」还会居中悬挂在条件下方。
   现拆成两块 —— 主行沿用全站 inline 口径（与其它列表页一致），条件块独立成行、顶对齐。 */
.trade-filter { display: flex; flex-direction: column; gap: 10px; }
.trade-filter-adv { display: flex; align-items: flex-start; gap: 8px; }
.trade-filter-adv-label {
  flex: none;
  padding-right: 6px;
  font-size: var(--font-label);
  /* 与 default 尺寸输入框同高，标签基线与首行条件对齐（勿写死 32px） */
  line-height: var(--el-component-size);
  color: var(--el-text-color-regular);
}
.trade-filter-adv-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
/* 条件项可收缩：容器变窄时先压缩输入框，而不是换行成「一行一个条件」。
   视口够宽但内容面板被树面板挤窄时，靠的就是这条撑住横向排布。 */
.trade-filter-cond { display: flex; align-items: center; min-width: 0; gap: 8px; }
.trade-filter-field { flex: none; width: 150px; }
.trade-filter-value { width: 200px; min-width: 110px; }
.trade-filter-adv-foot { display: flex; align-items: center; flex-wrap: wrap; gap: 2px; }
.search-scope-note { margin-left: 10px; font-size: 12px; color: var(--text-tertiary); }

/* 小屏：与 ListTemplate 的 960px 断点同口径，但条件仍横向排布 ——
   靠收缩适配（字段固定 130px、输入框吃剩余宽度），不退回一列一个。 */
@media (max-width: 960px) {
  .trade-filter-adv { flex-direction: column; gap: 6px; }
  .trade-filter-adv-label { line-height: 1.5; }
  .trade-filter-adv-body { width: 100%; gap: 6px; }
  .trade-filter-field { width: 130px; }
  .trade-filter-value { flex: 1 1 auto; width: auto; min-width: 120px; }
}

/* ── 手动同步弹窗（含批量补录） ──
   注：el-dialog 的内容经 Teleport 挂到 body，但**插槽内的元素仍是本组件编译的**，
   故 .sync-field 这类自有元素带 scopeId，可用 `.sync-field :deep(...)` 穿透到
   el-input 内部（而非依赖挂在 el-dialog 根上的类）。 */

/* 状态卡：未填单号 = 等待态（弱化）；已填 = 就绪态（accent 高亮） */
.sync-mode {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
  transition: background-color .2s ease, border-color .2s ease;
}
.sync-mode.is-ready {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}
.sync-mode-icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  font-size: 17px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
}
.sync-mode.is-ready .sync-mode-icon {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-8);
}
.sync-mode-body { min-width: 0; }
.sync-mode-title { font-size: 14px; font-weight: 600; color: var(--el-text-color-primary); }
.sync-mode-desc { margin-top: 2px; font-size: 12px; line-height: 1.5; color: var(--el-text-color-secondary); }

.sync-field { margin-top: 16px; }
.sync-field-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.sync-field-label { font-size: 13px; font-weight: 500; color: var(--el-text-color-regular); }
.sync-badge {
  margin-left: 6px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 400;
  border-radius: 4px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
  border: 1px solid var(--el-border-color-lighter);
}
.sync-badge.is-required {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
}
.sync-field :deep(.el-textarea__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
}
.sync-counter { display: flex; align-items: center; gap: 10px; margin-top: 8px; font-size: 12px; }
.sync-count { color: var(--el-text-color-secondary); }
.sync-count b { color: var(--el-color-primary); font-weight: 600; }
.sync-limit { color: var(--el-text-color-placeholder); }
.sync-over { color: var(--el-color-danger); }
.sync-ok { color: var(--el-color-success); }
.sync-hint { color: var(--el-text-color-placeholder); }
</style>
