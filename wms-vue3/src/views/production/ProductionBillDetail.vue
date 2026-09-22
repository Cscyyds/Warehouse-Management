<template>
  <div class="prod-detail">
    <div class="detail-topbar">
      <el-button link type="primary" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>返回{{ docConfig?.name || '列表' }}
      </el-button>
      <span class="detail-title">{{ docConfig?.name || '生产单据' }}详情</span>
      <span class="detail-billno">{{ bill?.erp_bill_no || billId }}</span>
      <span class="topbar-lock">
        <el-tag v-if="!lockSupported" type="info" size="small">该单据类型不支持锁单</el-tag>
        <template v-else>
          <el-tag :type="isLocked ? 'danger' : 'info'" size="small">
            {{ isLocked ? '已锁定' : '未锁定' }}
          </el-tag>
          <el-button
            v-perm="'POST /api/v1/tenant-production/bill-lock/update'"
            size="small"
            :type="isLocked ? 'warning' : 'primary'"
            :loading="lockLoading"
            @click="toggleLock"
          >{{ isLocked ? '解锁' : '上锁' }}</el-button>
        </template>
      </span>
    </div>

    <!-- 实时核验失败警示：TIMEOUT/ERROR/SKIPPED 时展示的是本地数据，可能不是最新（接口文档 §4.3） -->
    <el-alert
      v-if="refreshMeta?.stale"
      type="warning"
      show-icon
      :closable="false"
      title="ERP 实时核验未完成，当前展示的是本地数据，可能不是最新"
      :description="erpRefresh?.message || refreshMeta.fallbackTip"
      class="refresh-alert"
    />

    <!-- 表头信息 -->
    <el-card shadow="never" class="section-card" v-loading="loading">
      <template #header><span class="card-title">单据表头</span></template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="ERP 单号">{{ bill?.erp_bill_no || '-' }}</el-descriptions-item>
        <el-descriptions-item label="单据日期">{{ bill?.erp_bill_date || '-' }}</el-descriptions-item>
        <el-descriptions-item label="ERP 修改时间">{{ bill?.erp_modify_date || '-' }}</el-descriptions-item>
        <el-descriptions-item>
          <template #label>
            <span class="label-tip">
              同步时间
              <el-tooltip
                placement="top"
                content="ERP 数据最后一次发生变更并同步到 WMS 的时间；ERP 内容没变时打开详情不会刷新它。每次打开详情都会实时向 ERP 核验一次，结果见「本次核验」"
              >
                <el-icon class="label-tip__icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          {{ bill?.synced_at || '-' }}
        </el-descriptions-item>
        <el-descriptions-item>
          <template #label>
            <span class="label-tip">
              本次核验
              <el-tooltip
                placement="top"
                content="每次打开详情，后端都会先向 ERP 单张直查最新数据后再返回，此处为该次核验的结果"
              >
                <el-icon class="label-tip__icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-tooltip v-if="erpRefresh" placement="top" :content="refreshTip">
            <el-tag :type="refreshMeta?.tagType || 'info'" size="small">{{ refreshMeta?.label || '未知' }}</el-tag>
          </el-tooltip>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="ERP 已删">
          <el-tag :type="bill?.erp_deleted_flag === 1 ? 'danger' : 'info'" size="small">
            {{ bill?.erp_deleted_flag === 1 ? '是' : '否' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item>
          <template #label>
            <span class="label-tip">
              锁单状态
              <el-tooltip
                placement="top"
                content="ERP 侧锁单状态：已锁定时天心 ERP 内该单据不可再操作。WMS 扫码出库后会自动上锁；在此可手动上锁/解锁（直接推送天心锁单指令），解锁后下次扫码出库会重新自动上锁"
              >
                <el-icon class="label-tip__icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-tag :type="isLocked ? 'danger' : 'info'" size="small">
            {{ isLocked ? '已锁定（ERP 不可操作）' : '未锁定' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="明细总数">{{ itemTotal }}</el-descriptions-item>
        <el-descriptions-item
          v-for="col in docConfig?.headerColumns || []"
          :key="col.prop"
          :label="col.label"
        >{{ formatCell(bill?.[col.prop]) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 明细 -->
    <el-card shadow="never" class="section-card">
      <template #header>
        <div class="items-header">
          <span class="card-title">单据明细（{{ itemsDisplayTotal }}）</span>
          <div class="items-toolbar">
            <el-input
              v-model="itemKeyword"
              v-perm="`GET /api/v1/tenant-production/${docKey}/items/search`"
              :placeholder="docConfig?.itemSearchPlaceholder || '搜索明细'"
              clearable
              size="small"
              style="width: 220px"
              @keyup.enter="doItemSearch"
              @clear="exitSearch"
            />
            <el-button
              v-perm="`GET /api/v1/tenant-production/${docKey}/items/search`"
              size="small"
              type="primary"
              @click="doItemSearch"
            >搜索</el-button>
            <el-tooltip placement="top">
              <template #content>
                「ERP 已删」指该明细已在天心 ERP 侧删除，同步时被打上删除标记。<br />
                默认不展示；开启后可看到这些行（带「已删」标记，且不能勾选删除）。
              </template>
              <span class="include-deleted">
                <el-switch
                  v-model="includeDeleted"
                  size="small"
                  :disabled="searchMode"
                  @change="loadDetail"
                />
                <span class="include-deleted__label">显示 ERP 已删明细</span>
              </span>
            </el-tooltip>
            <el-button
              v-perm="`POST /api/v1/tenant-production/${docKey}/items/delete`"
              size="small"
              type="danger"
              :disabled="selectedIds.length === 0"
              @click="batchDelete"
            >批量删除（{{ selectedIds.length }}）</el-button>
          </div>
        </div>
      </template>

      <el-alert
        v-if="searchMode"
        type="info"
        :closable="false"
        :title="`明细搜索模式：关键字「${itemKeyword}」，共 ${searchTotal} 条（服务端分页，仅含有效明细）`"
        class="search-alert"
      />
      <el-alert
        v-else-if="serverItems"
        type="info"
        :closable="false"
        :title="`该单据共 ${itemTotal} 条明细，已启用服务端分页（第 ${itemsPage} 页）；切换到「含ERP已删」可一次查看全部`"
        class="search-alert"
      />

      <el-table
        v-loading="loading || searchLoading"
        :data="displayItems"
        border
        size="small"
        row-key="wms_item_id"
        style="width: 100%"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="42" :selectable="canSelect" />
        <el-table-column prop="erp_item_seq" label="项次" width="60" align="center" />
        <el-table-column
          v-for="col in docConfig?.itemColumns || []"
          :key="col.prop"
          :prop="col.prop"
          :label="col.label"
          :width="col.width"
          :min-width="col.minWidth"
          :align="col.align || 'left'"
          show-overflow-tooltip
        >
          <template #default="{ row }">{{ formatCell(row[col.prop]) }}</template>
        </el-table-column>
        <el-table-column label="产品档案" min-width="170">
          <template #default="{ row }">
            <template v-if="row.product">
              <div class="prod-name">{{ row.product.product_name }}</div>
              <div class="prod-sub">{{ row.product.product_code }}</div>
            </template>
            <el-tag v-else type="warning" size="small">未绑定产品档案</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="includeDeleted" label="ERP 状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.erp_deleted === 1 ? 'danger' : 'info'" size="small">
              {{ row.erp_deleted === 1 ? '已删' : '有效' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="synced_at" label="同步时间" width="160" />
      </el-table>

      <el-pagination
        v-if="searchMode || serverItems"
        class="items-pagination"
        background
        layout="total, prev, pager, next"
        :total="searchMode ? searchTotal : itemsTotal"
        :page-size="searchMode ? searchPageSize : itemsPageSize"
        :current-page="searchMode ? searchPage : itemsPage"
        @current-change="onItemsPageChange"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, QuestionFilled } from '@element-plus/icons-vue'
import { PRODUCTION_DOC_CONFIG_MAP } from '@/config/productionDocConfig'
import {
  deleteProductionItems,
  getProductionBillDetail,
  isBillLockSupported,
  listProductionItems,
  searchProductionItems,
  updateProductionBillLockStatus,
  type ProductionErpRefresh,
  type ProductionItemRow,
  type ProductionItemsDeleteResult,
  type ProductionBillLockResult,
} from '@/api/modules/production'
import type { ApiResponse } from '@/utils/request'

const route = useRoute()
const router = useRouter()

const docKey = computed(() => String(route.params.docKey || ''))
const billId = computed(() => String(route.params.billId || ''))
const docConfig = computed(() => PRODUCTION_DOC_CONFIG_MAP[docKey.value])

/** 一次渲染的明细行数上限：超过则改用 items/list 服务端分页
 *  （详情接口最多带 100000 条，超出即截断，页面上原本没有继续加载入口） */
const ITEMS_CLIENT_LIMIT = 200

const loading = ref(false)
const bill = ref<Record<string, unknown> | null>(null)
const detailItems = ref<ProductionItemRow[]>([])
const itemTotal = ref(0)
const includeDeleted = ref(false)

/** 本次打开详情时后端实时直查 ERP 的结果（接口 4.3 erp_refresh），随每次 loadDetail 更新 */
const erpRefresh = ref<ProductionErpRefresh | null>(null)
const erpRefreshAt = ref('')

interface RefreshMeta {
  label: string
  tagType: 'success' | 'danger' | 'warning'
  /** true = 未能核验（降级本地数据），顶部出警示条 */
  stale?: boolean
  /** message 缺省时的兜底说明 */
  fallbackTip: string
}

const REFRESH_META: Record<ProductionErpRefresh['status'], RefreshMeta> = {
  SYNCED: { label: '已是最新', tagType: 'success', fallbackTip: 'ERP 数据有变更，已同步后返回' },
  UNCHANGED: { label: '已是最新', tagType: 'success', fallbackTip: 'ERP 数据与本地一致（同步时间为数据最后变更时间，故不更新）' },
  ERP_DELETED: { label: 'ERP 已删', tagType: 'danger', fallbackTip: 'ERP 侧已查无此单，已按删除同步' },
  TIMEOUT: { label: '核验超时', tagType: 'warning', stale: true, fallbackTip: 'ERP 直查超时' },
  ERROR: { label: '核验失败', tagType: 'warning', stale: true, fallbackTip: 'ERP 直查失败' },
  SKIPPED: { label: '未核验', tagType: 'warning', stale: true, fallbackTip: '当前渠道未接入实时直查' },
}

const refreshMeta = computed(() => (erpRefresh.value ? REFRESH_META[erpRefresh.value.status] ?? null : null))

/** 核验标签悬浮说明：后端 message 优先，兜底固定文案，附核验时间 */
const refreshTip = computed(() => {
  if (!erpRefresh.value) return ''
  const msg = erpRefresh.value.message || refreshMeta.value?.fallbackTip || ''
  return msg ? `${msg}（核验时间 ${erpRefreshAt.value}）` : ''
})

function nowText(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 服务端分页态（items/list）：仅有效明细、且明细总数超过阈值时启用 */
const serverItems = ref(false)
const itemsRows = ref<ProductionItemRow[]>([])
const itemsTotal = ref(0)
const itemsPage = ref(1)
const itemsPageSize = ref(20)

const itemKeyword = ref('')
const searchMode = ref(false)
const searchLoading = ref(false)
const searchItems = ref<ProductionItemRow[]>([])
const searchTotal = ref(0)
const searchPage = ref(1)
const searchPageSize = ref(20)

const selected = ref<ProductionItemRow[]>([])
const selectedIds = computed(() => selected.value.map((r) => r.wms_item_id))

const displayItems = computed(() => {
  if (searchMode.value) return searchItems.value
  return serverItems.value ? itemsRows.value : detailItems.value
})

/** 标题里的明细条数：搜索/分页态用服务端 total，客户端态用已加载条数 */
const itemsDisplayTotal = computed(() => {
  if (searchMode.value) return searchTotal.value
  return serverItems.value ? itemsTotal.value : detailItems.value.length
})

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function canSelect(row: ProductionItemRow): boolean {
  // ERP 已删行不参与软删除
  return row.erp_deleted !== 1
}

// ---------- 锁单状态展示 / 上锁解锁 ----------

/** 托工缴回单与托工退回单在天心无单据别（BIL_ID），后端不支持锁单，仅展示说明 */
const lockSupported = computed(() => isBillLockSupported(docKey.value))
const isLocked = computed(() => Number(bill.value?.erp_lock_status) === 1)
const lockLoading = ref(false)

/** 上锁/解锁：确认后推送天心锁单指令；成功只原位更新表头状态（loadDetail 会再打一次
 *  ERP 实时核验，代价高且无必要）。幂等拦截（原状态即目标状态）与 ERP 失败均按
 *  业务失败返回，message 可直接展示。 */
async function toggleLock() {
  const target: 0 | 1 = isLocked.value ? 0 : 1
  const action = target === 1 ? '上锁' : '解锁'
  try {
    await ElMessageBox.confirm(
      `确认对单据「${bill.value?.erp_bill_no || billId.value}」执行${action}？` +
        (target === 1 ? '上锁后天心 ERP 中该单据将不可再操作。' : '解锁后天心 ERP 中该单据将恢复可操作。'),
      `${action}确认`,
      { confirmButtonText: `确认${action}`, cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  lockLoading.value = true
  try {
    const res = await updateProductionBillLockStatus(
      { doc_key: docKey.value, wms_bill_id: billId.value, lock_status: target },
      { silent: true },
    )
    ElMessage.success(res.message || `${action}成功`)
    if (bill.value) bill.value = { ...bill.value, erp_lock_status: res.data.erp_lock_status }
  } catch (error) {
    const payload = (error as { response?: { data?: ApiResponse<ProductionBillLockResult> } })?.response?.data
    if (payload?.message) {
      ElMessage.warning(payload.message)
      if (bill.value && payload.data) {
        bill.value = { ...bill.value, erp_lock_status: payload.data.erp_lock_status }
      }
    } else {
      ElMessage.error(error instanceof Error ? error.message : `${action}失败`)
    }
  } finally {
    lockLoading.value = false
  }
}

function onSelectionChange(rows: ProductionItemRow[]) {
  selected.value = rows
}

async function loadDetail() {
  if (!billId.value) return
  loading.value = true
  searchMode.value = false
  try {
    const res = await getProductionBillDetail(docKey.value, billId.value, includeDeleted.value)
    bill.value = res.data.bill
    detailItems.value = res.data.items
    itemTotal.value = res.data.item_total
    erpRefresh.value = res.data.erp_refresh ?? null
    erpRefreshAt.value = nowText()
    // 大单据改走 items/list 服务端分页；
    // 「含ERP已删」依赖详情返回全量（items/list 不支持 include_deleted），该模式保持客户端渲染
    serverItems.value = !includeDeleted.value && res.data.item_total > ITEMS_CLIENT_LIMIT
    if (serverItems.value) {
      await loadItemsPage(1)
    } else {
      itemsRows.value = []
      itemsTotal.value = 0
      itemsPage.value = 1
    }
  } catch {
    bill.value = null
    detailItems.value = []
    itemTotal.value = 0
    serverItems.value = false
    erpRefresh.value = null
    erpRefreshAt.value = ''
  } finally {
    loading.value = false
  }
}

/** items/list 服务端分页（接口 4.4，仅有效明细） */
async function loadItemsPage(page: number) {
  searchLoading.value = true
  try {
    const res = await listProductionItems(docKey.value, billId.value, page, itemsPageSize.value)
    itemsRows.value = res.data.items
    itemsTotal.value = res.data.total
    itemsPage.value = res.data.page || page
    // 订阅到期时后端会压缩 page_size，以响应值为准（否则后续页不可达）
    if (res.data.page_size) itemsPageSize.value = res.data.page_size
  } catch {
    itemsRows.value = []
    itemsTotal.value = 0
  } finally {
    searchLoading.value = false
  }
}

/** 分页器：搜索态走搜索分页，否则走 items/list 服务端分页 */
function onItemsPageChange(page: number) {
  if (searchMode.value) { onSearchPageChange(page); return }
  loadItemsPage(page)
}

async function doItemSearch() {
  const kw = itemKeyword.value.trim()
  if (!kw) { exitSearch(); return }
  searchLoading.value = true
  searchMode.value = true
  searchPage.value = 1
  try {
    const res = await searchProductionItems(docKey.value, kw, {
      billId: billId.value,
      page: 1,
      pageSize: searchPageSize.value,
    })
    searchItems.value = res.data.items
    searchTotal.value = res.data.total
    searchPage.value = res.data.page || 1
    // 订阅到期时后端会把 page_size 压到 ≤10，分页器必须按响应值算，否则后面几页不可达
    if (res.data.page_size) searchPageSize.value = res.data.page_size
  } catch {
    searchItems.value = []
    searchTotal.value = 0
  } finally {
    searchLoading.value = false
  }
}

async function onSearchPageChange(page: number) {
  searchPage.value = page
  searchLoading.value = true
  try {
    const res = await searchProductionItems(docKey.value, itemKeyword.value.trim(), {
      billId: billId.value,
      page,
      pageSize: searchPageSize.value,
    })
    searchItems.value = res.data.items
    searchTotal.value = res.data.total
    if (res.data.page_size) searchPageSize.value = res.data.page_size
  } catch {
    searchItems.value = []
  } finally {
    searchLoading.value = false
  }
}

function exitSearch() {
  searchMode.value = false
  itemKeyword.value = ''
  searchItems.value = []
  searchTotal.value = 0
}

/** 失败明细摘要：展示前 3 条（单号 + 原因），超出折叠计数 */
function failureSummary(failed: ProductionItemsDeleteResult['failed']): string {
  const preview = failed.slice(0, 3).map((f) => `${f.wms_item_id}（${f.reason}）`).join('；')
  return failed.length > 3 ? `${preview} 等 ${failed.length} 条` : preview
}

async function batchDelete() {
  if (!selectedIds.value.length) return
  try {
    await ElMessageBox.confirm(
      `确认软删除选中的 ${selectedIds.value.length} 条明细？删除后列表/详情不再显示，且无法在本页恢复。`,
      '批量软删除',
      { confirmButtonText: '确认删除', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    const res = await deleteProductionItems(docKey.value, selectedIds.value)
    const { succeeded, failed } = res.data
    if (failed && failed.length) {
      ElMessage.warning(`已删除 ${succeeded} 条；${failed.length} 条失败：${failureSummary(failed)}`)
    } else {
      ElMessage.success(`已软删除 ${succeeded} 条明细`)
    }
    selected.value = []
    await loadDetail()
  } catch (error) {
    // 全部失败时后端返回 success=false，结果（succeeded/failed）仍挂在 error.response.data.data 上；
    // 该请求已置 silent，故在此统一展示，避免只看到笼统的「未软删除任何明细」
    const payload = (error as { response?: { data?: { data?: ProductionItemsDeleteResult } } })
      ?.response?.data?.data
    if (payload && Array.isArray(payload.failed) && payload.failed.length) {
      ElMessage.error(`未删除任何明细：${failureSummary(payload.failed)}`)
      if (payload.succeeded > 0) await loadDetail()
    } else if (payload) {
      ElMessage.error('删除失败，请稍后重试')
    } else {
      ElMessage.error(error instanceof Error ? error.message : '删除失败')
    }
  }
}

function goBack() {
  router.push(`/production/${docKey.value}`)
}

onMounted(loadDetail)
</script>

<style scoped>
.prod-detail { display: flex; flex-direction: column; gap: 12px; }
.detail-topbar { display: flex; align-items: center; gap: 12px; }
.detail-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.detail-billno { font-family: monospace; color: var(--text-secondary); }
/* 顶栏右侧锁单状态 + 操作（顶栏整体靠左，此块推到最右） */
.topbar-lock { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; }
.section-card { border-radius: var(--radius-md); }
/* 单据表头：EP descriptions 默认 14px、small 档仅 ~12px，宽屏下明显小于
   正文/表格（--font-table 为 clamp(14px…16px)），这里与表格字号对齐 */
.section-card :deep(.el-descriptions__label),
.section-card :deep(.el-descriptions__content) { font-size: var(--font-table); }
.card-title { font-weight: 600; }
.items-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.items-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
/* 「显示 ERP 已删明细」开关：文案移到开关外，避免 inline-prompt 把状态当标签、看不出是可点的开关 */
.include-deleted { display: inline-flex; align-items: center; gap: 6px; }
.include-deleted__label { font-size: 12px; color: var(--text-secondary); }
.search-alert { margin-bottom: 10px; }
.refresh-alert { margin-bottom: 2px; }
/* 表头「同步时间 / 本次核验」标签旁的说明图标：弱化展示，悬浮出提示 */
.label-tip { display: inline-flex; align-items: center; gap: 2px; }
.label-tip__icon { font-size: 13px; color: var(--text-secondary, #909399); cursor: help; }
.items-pagination { margin-top: 12px; justify-content: flex-end; }
.prod-name { font-size: 13px; color: var(--text-primary); }
.prod-sub { font-size: 12px; color: var(--text-secondary); font-family: monospace; }
</style>
