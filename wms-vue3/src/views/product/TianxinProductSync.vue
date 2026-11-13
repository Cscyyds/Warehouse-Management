<template>
  <div class="prd-sync-page">
    <div class="page-head">
      <div class="page-head-main">
        <h2 class="page-title">天心产品同步</h2>
        <span class="page-sub"></span>
      </div>
      <!-- 工具栏口径对齐借入还出/贸易列表页：主动作在标题右侧，点击后再进弹窗填参数 -->
      <div class="page-actions">
        <el-button
          v-perm="'POST /api/v1/tenant-products/sync/refresh'"
          type="warning"
          :loading="syncing"
          @click="openSyncDialog"
        >
          <el-icon><Refresh /></el-icon>手动同步
        </el-button>
        <el-button type="info" plain @click="jumpToFailures">
          <el-icon><Warning /></el-icon>同步失败记录
        </el-button>
      </div>
    </div>

    <!-- ── 最近一次手动同步结果（同步完成后出现，可收起） ─────── -->
    <el-card v-if="syncResult" shadow="never" class="section-card">
      <template #header>
        <div class="card-head">
          <span class="card-title">最近一次手动同步</span>
          <span class="card-hint">{{ lastSyncAt ? `完成于 ${lastSyncAt}` : '' }}</span>
          <el-button class="card-head-close" link size="small" @click="syncResult = null">收起</el-button>
        </div>
      </template>

      <div class="sync-result">
        <el-alert
          :type="syncResultHasProblem ? 'warning' : 'success'"
          :closable="false"
          show-icon
          :title="syncResultTitle"
        />
        <div v-if="syncStats" class="stats-grid">
          <div class="stat"><span class="stat-label">新建</span><span class="stat-value">{{ syncStats.created }}</span></div>
          <div class="stat"><span class="stat-label">更新</span><span class="stat-value">{{ syncStats.updated }}</span></div>
          <div class="stat"><span class="stat-label">未变化</span><span class="stat-value">{{ syncStats.skipped }}</span></div>
          <div class="stat"><span class="stat-label">失败</span><span class="stat-value">{{ syncStats.failed }}</span></div>
          <div class="stat"><span class="stat-label">状态翻转</span><span class="stat-value">{{ syncStats.status_flipped }}</span></div>
          <div class="stat"><span class="stat-label">ERP 已消失</span><span class="stat-value">{{ missingMarked }}</span></div>
        </div>
        <div v-if="syncProblemItems.length" class="sync-problems">
          <div class="problems-head">未成功明细（{{ syncProblemItems.length }}，完整原因见下方失败记录）</div>
          <div v-for="(it, i) in syncProblemItems.slice(0, 8)" :key="i" class="problem-line">
            {{ it.prd_no }}<span v-if="it.reasons && it.reasons.length">：{{ it.reasons.join('；') }}</span>
          </div>
          <div v-if="syncProblemItems.length > 8" class="problem-more">… 其余 {{ syncProblemItems.length - 8 }} 条请到失败记录查看</div>
        </div>
      </div>
    </el-card>

    <!-- ── 失败记录 / 导入清单 ───────────────────────────────── -->
    <el-card ref="tabsCardRef" shadow="never" class="section-card">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="同步失败记录" name="failures">
          <el-form inline size="default" class="filter-form">
            <el-form-item label="最近失败时间">
              <el-date-picker
                v-model="failureDateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始"
                end-placeholder="结束"
                value-format="YYYY-MM-DD"
                style="width: 240px"
              />
            </el-form-item>
            <el-form-item label="天心品号">
              <el-input v-model="failurePrdNo" placeholder="模糊匹配" clearable style="width: 150px" @keyup.enter="searchFailures" />
            </el-form-item>
            <el-form-item label="最近动作">
              <el-select v-model="failureAction" placeholder="全部" clearable style="width: 120px">
                <el-option v-for="o in PRODUCT_IMPORT_ACTION_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="searchFailures">查询</el-button>
              <el-button @click="resetFailures">重置</el-button>
            </el-form-item>
          </el-form>


          <el-table v-loading="failureLoading" :data="failureRows" border size="small" style="width: 100%">
            <el-table-column prop="prd_no" label="天心品号" min-width="130" show-overflow-tooltip />
            <el-table-column prop="last_action" label="最近动作" width="100" align="center">
              <template #default="{ row }">{{ actionLabel(row.last_action) }}</template>
            </el-table-column>
            <el-table-column label="失败原因" min-width="320" show-overflow-tooltip>
              <template #default="{ row }">{{ (row.fail_reasons || []).join('；') || '-' }}</template>
            </el-table-column>
            <el-table-column prop="last_failed_at" label="最近失败时间" width="160" />
            <el-table-column prop="last_synced_at" label="最近成功时间" width="160" />
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-perm="'GET /api/v1/tenant-products/sync-failures/detail'"
                  link
                  type="primary"
                  size="small"
                  @click="openFailureDetail(row)"
                >详情</el-button>
              </template>
            </el-table-column>
            <template #empty>暂无同步失败记录 —— 修复成功的品号会自动从这里清除</template>
          </el-table>
          <el-pagination
            class="pager"
            background
            layout="total, sizes, prev, pager, next"
            :total="failureTotal"
            :page-sizes="[20, 50, 100, 200]"
            :current-page="failurePage"
            :page-size="failurePageSize"
            @current-change="onFailurePageChange"
            @size-change="onFailureSizeChange"
          />
        </el-tab-pane>

        <el-tab-pane label="天心导入产品清单" name="imports">
          <el-form inline size="default" class="filter-form">
            <el-form-item label="同步时间">
              <el-date-picker
                v-model="importDateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始"
                end-placeholder="结束"
                value-format="YYYY-MM-DD"
                style="width: 240px"
              />
            </el-form-item>
            <el-form-item label="搜索">
              <el-select v-model="importSearchField" style="width: 120px">
                <el-option label="天心品号" value="prd_no" />
                <el-option label="产品名称" value="product_name" />
                <el-option label="产品编码" value="product_code" />
              </el-select>
              <el-input v-model="importSearchValue" placeholder="模糊匹配" clearable style="width: 150px" @keyup.enter="searchImports" />
            </el-form-item>
            <el-form-item label="最近动作">
              <el-select v-model="importAction" placeholder="全部" clearable style="width: 120px">
                <el-option v-for="o in PRODUCT_IMPORT_ACTION_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="待翻转">
              <el-switch v-model="pendingOnly" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="searchImports">查询</el-button>
              <el-button @click="resetImports">重置</el-button>
            </el-form-item>
          </el-form>

          <el-alert
            type="info"
            :closable="false"
            show-icon
            class="tab-alert"
            title="「待翻转」= 首轮登记但尚未落库的停用状态（天心 NOUSE_DD 非空）：首轮只登记，次轮起自动把产品置为停产；系统绝不会因 ERP 侧消失而自动删除本地产品。"
          />

          <el-table v-loading="importLoading" :data="importRows" border size="small" style="width: 100%">
            <el-table-column prop="prd_no" label="天心品号" min-width="130" show-overflow-tooltip />
            <el-table-column prop="product_code" label="产品编码" min-width="120" show-overflow-tooltip />
            <el-table-column prop="product_name" label="产品名称" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">
                <span v-if="row.product_name">{{ row.product_name }}</span>
                <el-tag v-else type="warning" size="small">未建产品</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="specification" label="规格" min-width="120" show-overflow-tooltip />
            <el-table-column prop="last_action" label="最近动作" width="100" align="center">
              <template #default="{ row }">{{ actionLabel(row.last_action) }}</template>
            </el-table-column>
            <el-table-column prop="last_sync_status" label="同步状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="row.last_sync_status === 'FAILED' ? 'danger' : 'success'" size="small">
                  {{ row.last_sync_status === 'FAILED' ? '失败' : '成功' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="pending_status" label="待翻转" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.pending_status" type="warning" size="small">{{ row.pending_status }}</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="last_synced_at" label="最近同步时间" width="160" />
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-perm="'GET /api/v1/tenant-products/tianxin-imports/detail'"
                  link
                  type="primary"
                  size="small"
                  @click="openImportDetail(row)"
                >详情</el-button>
              </template>
            </el-table-column>
            <template #empty>暂无导入记录</template>
          </el-table>
          <el-pagination
            class="pager"
            background
            layout="total, sizes, prev, pager, next"
            :total="importTotal"
            :page-sizes="[20, 50, 100, 200]"
            :current-page="importPage"
            :page-size="importPageSize"
            @current-change="onImportPageChange"
            @size-change="onImportSizeChange"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- ── 手动同步弹窗：模式 + 品号 + 提交（对齐贸易/借入还出页的手动同步交互） ── -->
    <el-dialog
      v-model="syncDialogVisible"
      title="手动同步 · 天心产品资料"
      width="580px"
      :close-on-click-modal="false"
      class="sync-dialog"
    >
      <el-radio-group v-model="syncMode" class="sync-mode-switch" :disabled="syncing">
        <el-radio-button value="WINDOW">全量快照同步</el-radio-button>
        <el-radio-button value="BILL_NOS">按品号补录</el-radio-button>
      </el-radio-group>

      <!-- 状态卡：随所选模式变化，说明本次点击会发生什么 -->
      <div class="sync-mode" :class="syncMode === 'BILL_NOS' ? 'is-topup' : 'is-full'">
        <div class="sync-mode-icon">
          <el-icon>
            <Refresh v-if="syncMode === 'WINDOW'" />
            <EditPen v-else />
          </el-icon>
        </div>
        <div class="sync-mode-body">
          <div class="sync-mode-title">{{ syncModeTitle }}</div>
          <div class="sync-mode-desc">{{ syncModeDesc }}</div>
        </div>
      </div>

      <div v-if="syncMode === 'BILL_NOS'" class="sync-field">
        <div class="sync-field-head">
          <span class="sync-field-label">补录品号 <span class="sync-badge is-required">必填</span></span>
          <el-button v-if="itemNosText" link type="primary" size="small" @click="itemNosText = ''">清空</el-button>
        </div>
        <el-input
          v-model="itemNosText"
          type="textarea"
          :rows="6"
          resize="none"
          :disabled="syncing"
          placeholder="每行一个天心品号（PRD_NO），也支持逗号 / 顿号分隔，可直接从 Excel 粘贴。"
        />
        <div class="sync-counter">
          <span>已解析 <b>{{ itemNos.length }}</b> 个 <span class="limit">/ 上限 {{ TOPUP_LIMIT }}</span></span>
          <span v-if="itemNosOverLimit" class="danger">超出上限，请删减后再提交</span>
          <span v-else-if="!itemNos.length" class="hint">尚未填入品号</span>
          <span v-else-if="itemNosDupCount > 0" class="ok">已自动去除 {{ itemNosDupCount }} 个重复品号</span>
        </div>
      </div>

      <template #footer>
        <el-button :disabled="syncing" @click="syncDialogVisible = false">取消</el-button>
        <el-button type="warning" :loading="syncing" :disabled="!canSubmitSync" @click="handleSync">开始同步</el-button>
      </template>
    </el-dialog>

    <!-- ── 失败详情 ─────────────────────────────────────────── -->
    <el-dialog v-model="failureDetailVisible" title="同步失败详情" width="720px" :close-on-click-modal="false">
      <div v-loading="failureDetailLoading">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="天心品号">{{ failureDetail?.prd_no || '-' }}</el-descriptions-item>
          <el-descriptions-item label="最近动作">{{ actionLabel(failureDetail?.last_action) }}</el-descriptions-item>
          <el-descriptions-item label="最近失败时间">{{ failureDetail?.last_failed_at || '-' }}</el-descriptions-item>
          <el-descriptions-item label="最近成功时间">{{ failureDetail?.last_synced_at || '-' }}</el-descriptions-item>
          <el-descriptions-item label="关联产品" :span="2">
            <template v-if="failureDetail?.product_snapshot">
              {{ failureDetail.product_snapshot.product_name }}（{{ failureDetail.product_snapshot.product_code || '-' }}）
            </template>
            <span v-else class="empty-text">未关联本地产品</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-alert
          v-if="failureDetail?.hint"
          type="warning"
          :closable="false"
          show-icon
          class="detail-alert"
          :title="failureDetail.hint"
        />

        <div class="detail-head">失败原因（{{ failureDetail?.fail_reasons?.length || 0 }} 条）</div>
        <div v-if="failureDetail?.fail_reasons?.length" class="reason-list">
          <div v-for="(r, i) in failureDetail.fail_reasons" :key="i" class="reason-line">{{ r }}</div>
        </div>
        <el-empty v-else description="无原因明细" :image-size="60" />

        <div class="detail-head">最近失败轮原始报文（PRDT）</div>
        <pre class="raw-json">{{ prettyJson(failureDetail?.raw_json) }}</pre>
      </div>
      <template #footer>
        <el-button @click="failureDetailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- ── 导入详情 ─────────────────────────────────────────── -->
    <el-dialog v-model="importDetailVisible" title="天心导入产品详情" width="820px" :close-on-click-modal="false">
      <div v-loading="importDetailLoading">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="天心品号">{{ importDetail?.prd_no || '-' }}</el-descriptions-item>
          <el-descriptions-item label="最近动作">{{ actionLabel(importDetail?.last_action) }}</el-descriptions-item>
          <el-descriptions-item label="同步状态">
            <el-tag :type="importDetail?.last_sync_status === 'FAILED' ? 'danger' : 'success'" size="small">
              {{ importDetail?.last_sync_status === 'FAILED' ? '失败' : '成功' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="待翻转状态">{{ importDetail?.pending_status || '-' }}</el-descriptions-item>
          <el-descriptions-item label="首次同步">{{ importDetail?.first_synced_at || '-' }}</el-descriptions-item>
          <el-descriptions-item label="最近同步">{{ importDetail?.last_synced_at || '-' }}</el-descriptions-item>
          <el-descriptions-item label="ERP 修改时间">{{ importDetail?.erp_modify_date || '-' }}</el-descriptions-item>
          <el-descriptions-item label="最近失败时间">{{ importDetail?.last_failed_at || '-' }}</el-descriptions-item>
        </el-descriptions>

        <template v-if="importDetail?.fail_reasons?.length">
          <div class="detail-head">失败原因</div>
          <div class="reason-list">
            <div v-for="(r, i) in importDetail.fail_reasons" :key="i" class="reason-line">{{ r }}</div>
          </div>
        </template>

        <div class="detail-head">字段映射对照（ERP 值 vs 库内现值）</div>
        <el-table v-if="mappingRows.length" :data="mappingRows" border size="small" style="width: 100%">
          <el-table-column prop="label" label="字段" width="110" />
          <el-table-column prop="erp" label="ERP 值" min-width="180" show-overflow-tooltip />
          <el-table-column prop="local" label="库内现值" min-width="180" show-overflow-tooltip />
          <el-table-column label="结果" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.match ? 'success' : 'danger'" size="small">{{ row.match ? '一致' : '差异' }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="无映射对照数据" :image-size="60" />

        <div class="detail-head">原始报文（PRDT）</div>
        <pre class="raw-json">{{ prettyJson(importDetail?.raw_json) }}</pre>
      </div>
      <template #footer>
        <el-button @click="importDetailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 天心产品资料同步（2026-10-30 全新 7 接口）。
 * - 手动同步：全量快照（WINDOW）/ 按品号补录（BILL_NOS ≤50）；
 * - 失败记录：list/search + detail（原因/原始报文/未挂中类提示）；无重试按钮（自动恢复）；
 * - 导入清单：list/search + detail（原始报文 + 映射对照差异 + 履历）；pending_only = 待翻转观察清单。
 * 权限：7 个端点各有独立 perm_api_prod_sync_* 码（带 TIANXIN + 总开关标注，非天心租户整页不可见）。
 */
import { computed, onActivated, onMounted, ref } from 'vue'
import { ElCard, ElMessage } from 'element-plus'
import { EditPen, Refresh, Warning } from '@element-plus/icons-vue'
import { TOPUP_LIMIT, countBillNoSegments, isTopupOverLimit, parseBillNos } from '@/config/tradeTopup'
import {
  PRODUCT_IMPORT_ACTION_OPTIONS,
  getProductImportDetail,
  getProductSyncFailureDetail,
  listProductImports,
  listProductSyncFailures,
  refreshProductSync,
  searchProductImports,
  searchProductSyncFailures,
  type ProductImportDetailResult,
  type ProductImportRow,
  type ProductSyncFailureDetailResult,
  type ProductSyncFailureRow,
  type ProductSyncRefreshResult,
} from '@/api/modules/productSync'

// ── 手动同步 ──
const syncMode = ref<'WINDOW' | 'BILL_NOS'>('WINDOW')
const itemNosText = ref('')
const syncing = ref(false)
const syncResult = ref<ProductSyncRefreshResult | null>(null)
/** 弹窗开关 + 本次完成时间（结果卡副标题用；接口不回时间，取前端完成时刻） */
const syncDialogVisible = ref(false)
const lastSyncAt = ref('')

const itemNos = computed(() => parseBillNos(itemNosText.value))
const itemNosOverLimit = computed(() => isTopupOverLimit(itemNos.value.length))
const itemNosDupCount = computed(() => Math.max(0, countBillNoSegments(itemNosText.value) - itemNos.value.length))

/** 弹窗状态卡文案：说清「点下去会发生什么」，全量模式额外点明会绕过排期 */
const syncModeTitle = computed(() =>
  syncMode.value === 'WINDOW' ? '全量快照同步 · ERP 全部产品' : `按品号补录 · ${itemNos.value.length} 个品号`,
)
const syncModeDesc = computed(() =>
  syncMode.value === 'WINDOW'
    ? '立即拉取天心 PRDT 全量快照并逐条比对（约 35~60 秒），绕过每小时排期，执行期间不会重复开跑；完成后自动排下一轮。'
    : '逐品号直查天心，与自动轮排期无关，用于个别产品刚在 ERP 改完想立即刷新；单次最多 50 个品号。',
)
/** 全量模式无需填参，直接可提交；补录模式必须填且不超限 */
const canSubmitSync = computed(
  () => syncMode.value === 'WINDOW' || (itemNos.value.length > 0 && !itemNosOverLimit.value),
)

const syncStats = computed(() => (syncResult.value?.mode === 'WINDOW' ? syncResult.value.stats : null))
const missingMarked = computed(() => (syncResult.value?.mode === 'WINDOW' ? syncResult.value.missing_marked : 0))
/** 未成功明细（WINDOW：failed；BILL_NOS：failed + rejected） */
const syncProblemItems = computed(() => {
  const data = syncResult.value
  if (!data) return []
  if (data.mode === 'WINDOW') return data.failed || []
  return [...(data.failed || []), ...(data.rejected || [])]
})
const syncResultHasProblem = computed(() => {
  const data = syncResult.value
  if (!data) return false
  if (data.mode === 'WINDOW') return (data.failed?.length || 0) > 0 || data.status === 'FAILED'
  return (data.failed?.length || 0) + (data.rejected?.length || 0) > 0
})
const syncResultTitle = computed(() => {
  const data = syncResult.value
  if (!data) return ''
  if (data.mode === 'WINDOW') {
    return data.status === 'FAILED'
      ? '同步未完成：本轮已导入部分生效，剩余部分系统将自动重试'
      : '全量同步完成'
  }
  return `补录完成：成功 ${data.synced?.length || 0}，未变化 ${data.skipped?.length || 0}，失败 ${(data.failed?.length || 0) + (data.rejected?.length || 0)}`
})

function openSyncDialog() {
  syncMode.value = 'WINDOW'
  syncDialogVisible.value = true
}

/** 表头「同步失败记录」= 切到失败记录 Tab 并滚过去（结果卡展开时该 Tab 可能被推到首屏外） */
function jumpToFailures() {
  activeTab.value = 'failures'
  if (!failureRows.value.length) loadFailures()
  tabsCardRef.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function stampNow(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function handleSync() {
  if (syncing.value) return
  if (syncMode.value === 'BILL_NOS') {
    if (!itemNos.value.length) {
      ElMessage.warning('请先填入需要补录的天心品号')
      return
    }
    if (itemNosOverLimit.value) {
      ElMessage.warning(`单次补录上限 ${TOPUP_LIMIT} 个品号，请删减后重试`)
      return
    }
  }
  syncing.value = true
  try {
    const res = await refreshProductSync(syncMode.value === 'BILL_NOS' ? itemNos.value : undefined)
    syncResult.value = res.data
    lastSyncAt.value = stampNow()
    syncDialogVisible.value = false
    ElMessage.success(res.message || '同步完成')
    // 同步后刷新两个清单（失败/待翻转状态可能变化）
    loadFailures()
    if (activeTab.value === 'imports') loadImports()
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 409) {
      ElMessage.warning((error as Error)?.message || '已有同步任务正在处理，请稍后查看结果')
    } else {
      ElMessage.error((error as Error)?.message || '同步失败，请稍后重试')
    }
  } finally {
    syncing.value = false
  }
}

// ── Tab ──
const activeTab = ref<'failures' | 'imports'>('failures')
/** 失败记录/导入清单卡片（表头「同步失败记录」按钮滚动锚点） */
const tabsCardRef = ref<InstanceType<typeof ElCard> | null>(null)
function handleTabChange(name: string | number) {
  if (name === 'failures' && !failureRows.value.length) loadFailures()
  if (name === 'imports' && !importRows.value.length) loadImports()
}

// ── 失败记录 ──
const failureDateRange = ref<[string, string] | null>(null)
const failurePrdNo = ref('')
const failureAction = ref('')
const failureRows = ref<ProductSyncFailureRow[]>([])
const failureLoading = ref(false)
const failureTotal = ref(0)
const failurePage = ref(1)
const failurePageSize = ref(20)

async function loadFailures() {
  failureLoading.value = true
  try {
    const base = {
      page: failurePage.value,
      page_size: failurePageSize.value,
      date_from: failureDateRange.value?.[0] || undefined,
      date_to: failureDateRange.value?.[1] || undefined,
    }
    const fields: string[] = []
    const values: Record<string, string> = {}
    if (failurePrdNo.value.trim()) { fields.push('prd_no'); values.prd_no = failurePrdNo.value.trim() }
    if (failureAction.value) { fields.push('last_action'); values.last_action = failureAction.value }
    const res = fields.length
      ? await searchProductSyncFailures(fields, values, base)
      : await listProductSyncFailures(base)
    failureRows.value = res.data.records || []
    failureTotal.value = res.data.total || 0
    if (res.data.page_size) failurePageSize.value = res.data.page_size
  } catch {
    failureRows.value = []
    failureTotal.value = 0
  } finally {
    failureLoading.value = false
  }
}

function searchFailures() {
  failurePage.value = 1
  loadFailures()
}

function resetFailures() {
  failureDateRange.value = null
  failurePrdNo.value = ''
  failureAction.value = ''
  failurePage.value = 1
  loadFailures()
}

function onFailurePageChange(page: number) {
  failurePage.value = page
  loadFailures()
}

function onFailureSizeChange(size: number) {
  failurePageSize.value = size
  failurePage.value = 1
  loadFailures()
}

const failureDetailVisible = ref(false)
const failureDetailLoading = ref(false)
const failureDetail = ref<ProductSyncFailureDetailResult | null>(null)

async function openFailureDetail(row: ProductSyncFailureRow) {
  failureDetailVisible.value = true
  failureDetailLoading.value = true
  failureDetail.value = null
  try {
    const res = await getProductSyncFailureDetail(row.prd_no)
    failureDetail.value = res.data
  } catch (error: unknown) {
    failureDetailVisible.value = false
    ElMessage.error((error as Error)?.message || '查询失败详情失败')
  } finally {
    failureDetailLoading.value = false
  }
}

// ── 导入清单 ──
const importDateRange = ref<[string, string] | null>(null)
const importSearchField = ref<'prd_no' | 'product_name' | 'product_code'>('prd_no')
const importSearchValue = ref('')
const importAction = ref('')
const pendingOnly = ref(false)
const importRows = ref<ProductImportRow[]>([])
const importLoading = ref(false)
const importTotal = ref(0)
const importPage = ref(1)
const importPageSize = ref(20)

async function loadImports() {
  importLoading.value = true
  try {
    const base = {
      page: importPage.value,
      page_size: importPageSize.value,
      date_from: importDateRange.value?.[0] || undefined,
      date_to: importDateRange.value?.[1] || undefined,
      pending_only: pendingOnly.value,
    }
    // search 接口支持「关键字模糊 + last_action 等值」组合；list 接口也支持 last_action，
    // 但两者不能混用 ⇒ 只要出现任一搜索条件就走 search（否则 last_action 会被静默丢弃）。
    const fields: string[] = []
    const values: Record<string, string> = {}
    const keyword = importSearchValue.value.trim()
    if (keyword) { fields.push(importSearchField.value); values[importSearchField.value] = keyword }
    if (importAction.value) { fields.push('last_action'); values.last_action = importAction.value }
    const res = fields.length
      ? await searchProductImports(fields, values, base)
      : await listProductImports(base)
    importRows.value = res.data.records || []
    importTotal.value = res.data.total || 0
    if (res.data.page_size) importPageSize.value = res.data.page_size
  } catch {
    importRows.value = []
    importTotal.value = 0
  } finally {
    importLoading.value = false
  }
}

function searchImports() {
  importPage.value = 1
  loadImports()
}

function resetImports() {
  importDateRange.value = null
  importSearchValue.value = ''
  importAction.value = ''
  pendingOnly.value = false
  importPage.value = 1
  loadImports()
}

function onImportPageChange(page: number) {
  importPage.value = page
  loadImports()
}

function onImportSizeChange(size: number) {
  importPageSize.value = size
  importPage.value = 1
  loadImports()
}

const importDetailVisible = ref(false)
const importDetailLoading = ref(false)
const importDetail = ref<ProductImportDetailResult | null>(null)

const mappingRows = computed(() => {
  const cmp = importDetail.value?.mapping_compare
  if (!cmp) return []
  const rows: { label: string; erp: string; local: string; match: boolean }[] = []
  if (cmp.name) rows.push({ label: '产品名称', erp: cmp.name.erp_value || '-', local: cmp.name.local_value || '-', match: !!cmp.name.match })
  if (cmp.specification) rows.push({ label: '规格', erp: cmp.specification.erp_value || '-', local: cmp.specification.local_value || '-', match: !!cmp.specification.match })
  if (cmp.unit) rows.push({ label: '单位', erp: cmp.unit.erp_value || '-', local: cmp.unit.local_value || '-', match: !!cmp.unit.match })
  if (cmp.category) {
    rows.push({
      label: '分类（中类）',
      erp: cmp.category.erp_idx1 || '-',
      local: cmp.category.local_category
        ? `${cmp.category.local_category.name || '-'}${cmp.category.local_category.external_code ? `（${cmp.category.local_category.external_code}）` : ''}`
        : '-',
      match: !!cmp.category.match,
    })
  }
  return rows
})

async function openImportDetail(row: ProductImportRow) {
  importDetailVisible.value = true
  importDetailLoading.value = true
  importDetail.value = null
  try {
    const res = await getProductImportDetail(row.prd_no)
    importDetail.value = res.data
  } catch (error: unknown) {
    importDetailVisible.value = false
    ElMessage.error((error as Error)?.message || '查询导入详情失败')
  } finally {
    importDetailLoading.value = false
  }
}

// ── 公共格式化 ──
function actionLabel(action: string | null | undefined): string {
  if (!action) return '-'
  return PRODUCT_IMPORT_ACTION_OPTIONS.find((o) => o.value === action)?.label || action
}

function prettyJson(value: unknown): string {
  if (value == null) return '—'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

onMounted(() => {
  loadFailures()
  loadImports()
})

// keep-alive 复用同一实例：onMounted 不再执行，回到本页时补一次刷新（自动轮可能已改变状态）
let skipFirstActivate = true
onActivated(() => {
  if (skipFirstActivate) {
    skipFirstActivate = false
    return
  }
  loadFailures()
  if (activeTab.value === 'imports') loadImports()
})
</script>

<style scoped>
.prd-sync-page { display: flex; flex-direction: column; gap: 12px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.page-head-main { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; min-width: 0; }
.page-title { margin: 0; font-size: 18px; font-weight: 700; color: var(--text-primary); }
.page-sub { font-size: 12px; color: var(--text-secondary); }
/* 工具栏口径对齐 ListTemplate：按钮间距 8px，去掉 el-button 默认左外边距 */
.page-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.page-actions :deep(.el-button + .el-button) { margin-left: 0; }
.section-card { border-radius: var(--radius-md); }
.card-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.card-title { font-weight: 600; }
.card-hint { font-size: 12px; color: var(--text-tertiary); }
.card-head-close { margin-left: auto; }

/* ── 手动同步弹窗（模式切换 + 状态卡 + 品号输入）──
   弹窗内容经 Teleport 挂到 body，但插槽内元素仍由本组件编译，
   故自有 class 带 scopeId，可用 :deep() 穿透到 el-input 内部。 */
.sync-mode-switch { margin-bottom: 12px; }
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
.sync-mode.is-full {
  border-color: var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
}
.sync-mode.is-topup {
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
.sync-mode.is-full .sync-mode-icon { color: var(--el-color-warning); background: var(--el-color-warning-light-8); }
.sync-mode.is-topup .sync-mode-icon { color: var(--el-color-primary); background: var(--el-color-primary-light-8); }
.sync-mode-body { min-width: 0; }
.sync-mode-title { font-size: 14px; font-weight: 600; color: var(--el-text-color-primary); }
.sync-mode-desc { margin-top: 2px; font-size: 12px; line-height: 1.5; color: var(--el-text-color-secondary); }

.sync-field { margin-top: 14px; }
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
.sync-counter { display: flex; align-items: center; gap: 12px; margin-top: 8px; font-size: 12px; color: var(--text-secondary); }
.sync-counter b { color: var(--el-color-primary); }
.sync-counter .limit { color: var(--text-tertiary); }
.sync-counter .danger { color: var(--el-color-danger); }
.sync-counter .ok { color: var(--el-color-success); }
.sync-counter .hint { color: var(--el-text-color-placeholder); }

.sync-result { display: flex; flex-direction: column; gap: 10px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.stat { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-page); }
.stat-label { font-size: 12px; color: var(--text-secondary); }
.stat-value { font-size: 18px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.sync-problems { padding: 10px 12px; border-radius: var(--radius-sm); background: var(--el-color-warning-light-9); }
.problems-head { font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); }
.problem-line { font-size: 12px; line-height: 1.7; color: var(--text-secondary); word-break: break-all; }
.problem-more { margin-top: 4px; font-size: 12px; color: var(--text-tertiary); }

.filter-form { margin-bottom: 4px; }
.tab-alert { margin-bottom: 10px; }
.pager { margin-top: 12px; justify-content: flex-end; }

.detail-alert { margin: 12px 0 0; }
.detail-head { margin: 14px 0 8px; font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.reason-list { display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow: auto; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--bg-page); }
.reason-line { font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: var(--text-primary); }
.raw-json {
  margin: 0;
  padding: 12px;
  max-height: 320px;
  overflow: auto;
  border-radius: var(--radius-sm);
  background: var(--bg-page);
  border: 1px solid var(--border-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}
.empty-text { color: var(--text-tertiary); }
</style>
