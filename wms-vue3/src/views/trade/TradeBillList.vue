<template>
  <ListTemplate
    :title="docConfig?.name || '贸易单据'"
    compact-header
    filter-default-collapsed
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
          <!-- 归档三态筛选（2026-11-18 批次）：默认 0 只看正常单，清空=全部；
               仅 list 端点支持 archived 参数，搜索态禁用（与日期区间同口径） -->
          <el-form-item label="归档状态">
            <el-select
              v-model="archivedFilter"
              clearable
              placeholder="全部"
              style="width: 130px"
              :disabled="isSearching"
              @change="handleSearch"
            >
              <el-option label="正常单" :value="0" />
              <el-option label="历史归档" :value="1" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 第二行：全部可搜索字段常驻，短输入框按宽度自动分列（无「+ 添加条件」）。
             独立成行是因为 inline 表单按垂直居中对齐兄弟项，塞进上一行会把日期/按钮挤成阶梯状。 -->
        <el-form
          v-perm="`GET ${docEndpoint}/search`"
          class="trade-filter-grid"
          label-width="6.5em"
          size="default"
        >
          <el-form-item v-for="field in searchableFields" :key="field" :label="fieldLabel(field)">
            <!-- 控件跟随字段类型：日期给选择器、仓库状态给枚举下拉，
                 否则用户要对着 LIKE 匹配手打 yyyy-mm-dd 或裸码值。 -->
            <el-date-picker
              v-if="isDateField(field)"
              v-model="searchValues[field]"
              type="date"
              value-format="YYYY-MM-DD"
              clearable
              @change="handleSearch"
            />
            <el-select
              v-else-if="enumOptions(field)"
              v-model="searchValues[field]"
              clearable
              @change="handleSearch"
            >
              <el-option
                v-for="o in enumOptions(field) || []"
                :key="o.value"
                :label="o.label"
                :value="o.value"
              />
            </el-select>
            <el-input
              v-else
              v-model="searchValues[field]"
              clearable
              @keyup.enter="handleSearch"
              @clear="handleSearch"
            />
          </el-form-item>
        </el-form>
        <div v-if="isSearching" class="search-scope-note">
          搜索模式：按已填写的字段 AND 组合，「单据日期」区间与「归档状态」筛选不参与
        </div>
      </div>
    </template>

    <template #actions>
      <!-- 手动同步 = 批量补录：**同一个接口、同一个弹窗**，按「是否填单号」自动切换两种模式：
             不填 = 窗口同步（WINDOW）；填了 = 按单号补录（BILL_NOS）。故只保留一个入口。 -->
      <el-button
        v-perm="`POST ${docEndpoint}/sync/refresh`"
        type="warning"
        :disabled="syncCooldown"
        @click="openSyncDialog"
      >
        <el-icon><Refresh /></el-icon>手动同步
      </el-button>
      <!-- 重启自动同步：侧级操作（一侧管两条单据线），端点按侧而非 docKey，
           采购两页显示采购侧入口、销售两页显示销售侧入口，两侧互不影响。 -->
      <el-button
        v-perm="restartPerm"
        type="warning"
        plain
        :disabled="restartCooldown"
        @click="openRestartDialog"
      >
        <el-icon><RefreshRight /></el-icon>重启自动同步
      </el-button>
      <el-button
        v-perm="rejectListPerm"
        type="info"
        plain
        @click="rejectDrawerVisible = true"
      >
        <el-icon><Warning /></el-icon>同步失败记录
      </el-button>
    </template>

    <template #col-erp_bill_no="{ row }">
      <el-link
        v-perm="`GET ${docEndpoint}/detail`"
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

    <template #col-erp_lock_status="{ row }">
      <span v-if="family?.key === 'trade'">{{ row.erp_lock_status === 1 ? '已上锁' : row.erp_lock_status === 0 ? '已解锁' : '待刷新' }}</span>
      <span v-else>{{ ERP_LOCK_STATUS_LABELS[row.erp_lock_status] ?? row.erp_lock_status ?? '-' }}</span>
    </template>

    <!-- 历史归档标记（2026-11-18 批次，三族共用）：1=早于正式开启时间首次导入，不可再作业 -->
    <template #col-wms_archive_flag="{ row }">
      <el-tag v-if="Number(row.wms_archive_flag) === 1" type="info" size="small">历史归档</el-tag>
      <span v-else>-</span>
    </template>

    <!-- 借出借入专用：结案标记（cls_id ← 天心 CLS_ID，T/F → 中文） -->
    <template #col-cls_id="{ row }">
      <span>{{ CLS_ID_LABELS[String(row.cls_id ?? '').trim().toUpperCase()] ?? (row.cls_id || '-') }}</span>
    </template>

    <!-- 出库单专用：结转销货标记（clssa T/F → 中文） -->
    <template #col-clssa="{ row }">
      <span>{{ row.clssa === 'T' ? '是' : row.clssa === 'F' ? '否' : (row.clssa ?? '-') }}</span>
    </template>

    <template #col-actions="{ row }">
      <!-- 整列操作包成一行 flex：详情与上锁/解锁同一基线、同一字号、统一 12px 间距 -->
      <span class="row-actions">
        <el-button
          v-perm="`GET ${docEndpoint}/detail`"
          link
          type="primary"
          size="small"
          @click="goDetail(row)"
        >详情</el-button>
        <!-- 贸易/其他入库：锁单入口（与借出借入同一操作列口径：small link 按钮、同字号同行） -->
        <ErpBillLockButton v-if="lockSupported" :doc-key="docKey" :bill="row" @changed="loadData" />
        <!-- 借出借入：网站手动上锁/解锁（镜像生产 bill-lock；幂等文案由后端 message 透出）；
             历史归档单禁用（后端同样 400 拒绝，双保险） -->
        <el-tooltip v-if="family?.key === 'borrow'" :disabled="Number(row.wms_archive_flag || 0) !== 1" content="历史归档单不支持锁单/解锁操作">
          <span>
            <el-button
              v-perm="'POST /api/v1/tenant-borrow/bill-lock/update'"
              link
              :type="String(row.erp_lock_status) === '1' ? 'warning' : 'success'"
              size="small"
              :loading="lockingId === row.wms_bill_id"
              :disabled="Number(row.wms_archive_flag || 0) === 1"
              @click="toggleBillLock(row)"
            >{{ String(row.erp_lock_status) === '1' ? '解锁' : '上锁' }}</el-button>
          </span>
        </el-tooltip>
      </span>
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
        :placeholder="syncPlaceholder"
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

  <!-- 重启自动同步弹窗：固定重扫范围，提交前二次确认 -->
  <!-- 标题不带侧别：同一弹窗在采购/销售侧复用，侧别由正文与提交确认文案承担 -->
  <el-dialog
    v-model="restartDialogVisible"
    title="重启自动同步"
    width="min(620px, calc(100vw - 24px))"
    :close-on-click-modal="false"
  >
    <template #header="{ titleId, titleClass }">
      <div class="restart-header">
        <span class="restart-header-icon" aria-hidden="true"><el-icon><RefreshRight /></el-icon></span>
        <div>
          <h2 :id="titleId" :class="titleClass">重启自动同步</h2>
          <p>{{ restartScopeLabel }} · {{ restartDocLines.length }} 条单据线</p>
        </div>
      </div>
    </template>

    <div class="restart-content">
      <section>
        <div class="restart-range-heading">
          <h3>重扫范围</h3>
          <span>从所选起始日重扫至今</span>
        </div>
        <el-radio-group v-model="restartDays" class="restart-range-options" aria-label="重扫范围" :disabled="restarting">
          <el-radio
            v-for="{ days, startDate } in restartDateOptions"
            :key="days"
            :value="days"
            class="restart-range-option"
          >
            <span class="restart-range-duration">前 <strong>{{ days }}</strong> 天</span>
            <span class="restart-range-date"><time :datetime="startDate">{{ startDate }}</time> 起</span>
          </el-radio>
        </el-radio-group>
      </section>

      <div class="restart-docs">
        <span>涉及单据</span>
        <strong>{{ restartDocLinesLabel }}</strong>
      </div>

      <section class="restart-tips">
        <h3><el-icon aria-hidden="true"><InfoFilled /></el-icon>重扫说明</h3>
        <ul>
          <li>已入库且内容未变更的单据会自动跳过。</li>
          <li>每轮重扫 31 天，约 10 分钟。回填期间暂停每日对账，完成后恢复，并补处理 90 天回看窗口内的删单。</li>
          <li>早于所选起始日的被拒单据仍需补录，或等待 ERP 侧修改。</li>
        </ul>
      </section>
    </div>
    <template #footer>
      <el-button :disabled="restarting" @click="restartDialogVisible = false">取消</el-button>
      <el-button type="warning" :loading="restarting" :disabled="!restartDate" @click="handleRestart">确认重启</el-button>
    </template>
  </el-dialog>

  <!-- 同步失败记录抽屉：按侧查询与重导入，side 由 docKey 推导、familyKey 决定端点与 doc_key 前缀 -->
  <el-drawer v-model="rejectDrawerVisible" size="72%" :title="`同步失败记录 · ${sideLabel}侧`">
    <SyncRejectPanel v-if="family" :side="syncSide" :family-key="family.key" />
  </el-drawer>
</template>

<script setup lang="ts">
import { confirmAction } from '@/utils/actionDialog'
import { showMessage } from '@/utils/messageFeedback'
import { showErrorDialog } from '@/utils/errorFeedback'
import ErpBillLockButton from './ErpBillLockButton.vue'
/**
 * ERP 单据列表（天心侧，家族通用）：
 * - trade 族：由 4 个 WMS 采购/销售页面在 TIANXIN 模式下就地渲染（docKey 由宿主页传入），
 *   出库单 CK 则挂在独立页 /trade/outbound-order；
 * - borrow 族：借出借入四单据独立页（/borrow/*）各自挂一个实例。
 * docKey 决定家族（basePath / URL 段 / 侧名 / 白名单），见 config/erpDocFamily.ts。
 */
import { computed, h, onActivated, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DocumentAdd, InfoFilled, Refresh, RefreshRight, Warning } from '@element-plus/icons-vue'
import ListTemplate, { type Column } from '@/views/common/ListTemplate.vue'
import SyncRejectPanel from '@/views/trade/SyncRejectPanel.vue'
import { useTableSort } from '@/composables/useTableSort'
import {
  TRADE_DATE_SEARCH_FIELDS,
  WAREHOUSE_STATUS_LABELS,
  ERP_LOCK_STATUS_LABELS,
  CLS_ID_LABELS,
  getTradeEnumOptions,
  type TradeColumn,
} from '@/config/tradeDocConfig'
import { resolveErpDoc, erpDocConfig, erpSideDocs, erpSideSegment, erpDocLineName, erpDetailPath } from '@/config/erpDocFamily'
import { TOPUP_LIMIT, countBillNoSegments, isTopupOverLimit, parseBillNos } from '@/config/tradeTopup'
import {
  erpApiOfDocKey,
  type ErpBillQuery,
  type ErpBillRow,
  type ErpSyncRefreshResult,
} from '@/api/modules/erpBill'
import { updateBorrowBillLock } from '@/api/modules/borrow'
import { isTradeBillLockSupported, type TradeDocKey } from '@/api/modules/trade'

/** 家族通用：trade 族传 4 单据 docKey 或 outbound-order；borrow 族传 borrow-in-order 等 */
const props = defineProps<{ docKey: string }>()

const router = useRouter()

const docKey = computed(() => props.docKey)
/** {family, doc}：family 提供 basePath/侧名/单据线，doc 提供 URL 段 */
const docMeta = computed(() => resolveErpDoc(docKey.value))
const family = computed(() => docMeta.value?.family || null)
const tradeDocKey = computed<TradeDocKey | null>(() =>
  family.value?.key === 'trade' ? docKey.value as TradeDocKey : null,
)
/** 该单据是否支持上锁/解锁（销售订单无该功能；其他入库单管线恒支持） */
const lockSupported = computed(() =>
  family.value?.key === 'other-inbound' || (!!tradeDocKey.value && isTradeBillLockSupported(tradeDocKey.value)),
)
const docConfig = computed(() => erpDocConfig(docKey.value))
const api = computed(() => erpApiOfDocKey(docKey.value))
/** 当前单据的接口前缀（v-perm 模板与同步端点共用）；其他入库 segment 为空串 → 直接用 basePath */
const docEndpoint = computed(() => {
  const base = family.value?.basePath || ''
  const seg = docMeta.value?.doc.segment ?? docKey.value
  return seg ? `${base}/${seg}` : base
})

const tableData = ref<ErpBillRow[]>([])
const loading = ref(false)
const dateRange = ref<[string, string] | null>(null)
/** 归档三态筛选：默认 0 只看正常单（Q3），undefined=全部；仅 list 分支携带（search 端点无此参数） */
const archivedFilter = ref<0 | 1 | undefined>(0)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { handleSortChange, sortParams } = useTableSort(loadData)

// ── 多字段搜索（doc 2.2.3：search_field JSON 数组 + search_value JSON 对象，AND 组合） ──
/** 字段名 → 搜索值。可搜索字段全部常驻筛选区，故不再需要「条件行」数组与增删操作。 */
const searchValues = reactive<Record<string, string>>({})

/**
 * 当前单据可搜索字段白名单（已过滤黑名单），逐个铺开成筛选项。
 * 刻意隐藏 erp_bill_date：「单据日期」走 /list 的 date_from/date_to（真区间），
 * 搜索条件里只能 LIKE 单日，两者互斥且重复。erp_modify_date/synced_at/cls_date
 * 日期区间盖不到，保留。代价：搜索模式下暂不能按单据日期过滤，需 /search 支持日期参数。
 * 顺序跟随表格列（列里没有的字段靠后）——字段常驻可见后，这里就是筛选项的排布顺序。
 */
const searchableFields = computed<string[]>(() => {
  const allowed = Array.from(
    new Set((api.value?.headerSearchFields(docKey.value) || []).filter((f) => f !== 'erp_bill_date')),
  )
  const inTable = columns.value.map((c) => c.prop).filter((p) => allowed.includes(p))
  return [...inTable, ...allowed.filter((f) => !inTable.includes(f))]
})

/** 表头排序白名单（/search 与 /list 共用）；非白名单字段后端直接抛 400 */
const headerSortFields = computed(() => new Set(api.value?.headerSortFields(docKey.value) || []))

/** 字段名 → 中文标签（从列配置 + 公共字段映射；新增字段必须在此登记，否则搜索区显示裸字段名） */
const FIELD_LABELS: Record<string, string> = {
  erp_bill_no: 'ERP 单号', erp_bill_date: '单据日期', erp_modify_date: 'ERP 修改时间',
  synced_at: '同步时间', ps_id: '单据ID', cus_no: '客户编号', sal_no: '销售编号',
  rem: '备注', bil_type: '单据类别', dep: '部门代码', dep_name: '部门名称',
  usr: '操作者', cls_date: '分类日期', lz_cls_id: '流转分类',
  warehouse_status: '仓库状态', total_qty: '数量合计',
  supplier_name: '供应商', employee_name: '经办人',
  customer_name: '客户', source_os_no: '来源单号',
  transfer_os_no: '转传单号', apply_os_no: '申请单号',
  ck_cls_id: '出库类别', cus_os_no: '客户单号', ck_id: '单据别',
  // 借出借入专用（不改贸易四单据的既有标签）
  // cls_id：天心 CLS_ID = 结案标记（T/F），此前误标「单据分类」（backend registry.py:125）
  bl_id: '单据别', cls_id: '结案标记', est_dd: '预定日期', pay_dd: '付款日期',
  rep_bl_no: '还款计划单号', erp_lock_status: '锁单状态',
  // 其他入库专用（bill_no 为 XC 搜索白名单的 API 字段名，映射后端 erp_bill_no 列）
  bill_no: 'ERP 单号', chk_man: '审核人', prd_no: '品号', prd_name: '品名',
  spc: '规格', wh: '仓库',
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

/** 有效搜索条件（值非空的字段）。日期选择器清空给 null、下拉清空给 undefined，
 *  故在此统一规范化为已 trim 的字符串，下游不再各自 .trim()。 */
const activeConditions = computed(() =>
  searchableFields.value
    .filter((f) => searchValues[f] != null && String(searchValues[f]).trim())
    .map((f) => ({ field: f, value: String(searchValues[f]).trim() })),
)
const isSearching = computed(() => activeConditions.value.length > 0)

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
function notifySyncResult(data: ErpSyncRefreshResult | undefined, msg: string) {
  if (data?.status === 'SKIPPED') {
    ElMessage.warning(msg || '本次同步未执行，请核对租户模式和同步准备条件')
    return
  }
  const rejected = data?.rejected || []
  const failed = data?.failed_bills || []
  const stats = data?.stats
  // 200 壳失败（FAILED / 凭证缺失 / ERP 通信异常）：提示完整 message 与明细，不吞掉
  if (data?.status === 'FAILED' || /未完成|未配置|连接失败|通信异常/.test(msg)) {
    showErrorDialog(msg || '同步未完成，请核对失败原因后重试', {
      title: '同步未完全成功',
      details: [
        ...rejected.map(item => `被拒：${syncIssueSummary([item])}`),
        ...failed.map(item => `失败：${syncIssueSummary([item])}`),
      ],
    })
  } else if (rejected.length || failed.length) {
    // 成功但有被拒/失败明细：完整展示，避免“同步完成”掩盖被拒单（doc 2.2.7）
    showErrorDialog(stats ? `新建 ${stats.created}，更新 ${stats.updated}，未变化 ${stats.skipped}，被拒 ${stats.rejected}` : msg || '部分单据同步失败', {
      title: '同步完成（存在被拒明细）',
      details: [
        ...rejected.map(item => `被拒：${syncIssueSummary([item])}`),
        ...failed.map(item => `失败：${syncIssueSummary([item])}`),
      ],
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
    if (msg) showErrorDialog(msg)
    else showErrorDialog(fallback)
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
    const res = await api.value!.refresh(docKey.value, nos)
    notifySyncResult(res.data as ErpSyncRefreshResult, res.message || '')
    syncDialogVisible.value = false
    await loadData()
  } catch (error: unknown) {
    notifySyncError(error, '补录失败')
  } finally {
    syncing.value = false
  }
}

// ── 侧级同步操作（restart / 同步失败记录）──
// 端点按「侧」组织：trade=purchase|sales（销售侧含出库单，共三线），borrow=in|out（各两线）；
// 同侧的单据页共享入口，两侧互不影响。家族差异全部来自 config/erpDocFamily.ts。
const syncSide = computed(() => docMeta.value?.doc.side || '')
const sideLabel = computed(() => family.value?.sideLabels[syncSide.value] || '')
/** 补录输入框提示：销售管理侧（SA/SB/CK）用指定文案，其余家族/侧保持原提示 */
const syncPlaceholder = computed(() =>
  syncSide.value === 'sales'
    ? '每行一个单号，也可用逗号或分号分隔'
    : '每行一个 ERP 单号，也支持逗号 / 顿号分隔，可直接从 Excel 粘贴。',
)
const restartPerm = computed(() => `POST ${family.value?.basePath}${erpSideSegment(family.value?.key, syncSide.value)}/sync/restart`)
const rejectListPerm = computed(() => `GET ${family.value?.basePath}${erpSideSegment(family.value?.key, syncSide.value)}/sync-rejects/list`)
/** 本侧全部单据线（trade 销售侧 = SA/SB/CK 三条；借出借入各两侧各两条） */
const restartDocLines = computed(() =>
  family.value ? erpSideDocs(family.value.key, syncSide.value) : [],
)
const restartDocLinesLabel = computed(() => restartDocLines.value.map((d) => d.name).join('、'))
const restartScopeLabel = computed(() => family.value?.key === 'other-inbound' ? sideLabel.value : `${sideLabel.value}侧`)

const rejectDrawerVisible = ref(false)

const RESTART_DAY_OPTIONS = [30, 60, 90] as const
const restartDialogVisible = ref(false)
const restartDays = ref<typeof RESTART_DAY_OPTIONS[number] | null>(null)
const restartOpenedAt = ref(new Date())
const restarting = ref(false)
const restartCooldown = ref(false)

const restartDateOptions = computed(() => RESTART_DAY_OPTIONS.map(days => {
  const start = new Date(restartOpenedAt.value)
  start.setDate(start.getDate() - days)
  const month = String(start.getMonth() + 1).padStart(2, '0')
  const day = String(start.getDate()).padStart(2, '0')
  return { days, startDate: `${start.getFullYear()}-${month}-${day}` }
}))
const restartDate = computed(() => restartDateOptions.value.find(({ days }) => days === restartDays.value)?.startDate)

function openRestartDialog() {
  restartOpenedAt.value = new Date()
  restartDays.value = null
  restartDialogVisible.value = true
}

async function handleRestart() {
  const startTime = restartDate.value
  if (!startTime) {
    ElMessage.warning('请先选择重扫范围')
    return
  }
  const tips = [
    `将重启${sideLabel.value}侧自动同步：${restartDocLines.value.length} 条单据线（${restartDocLinesLabel.value}）的水位重置至 ${startTime}，重新扫至今。`,
    '已入库且内容未变更的单据自动跳过；重扫期间该侧每日对账暂停，完成后自动恢复。',
    '重启后不可中途取消，由重扫轮次自行推进完成。',
  ]
  try {
    await confirmAction(
      h('div', { style: 'white-space: pre-line; line-height: 1.7; font-size: 13px;' }, tips.join('\n')),
      `确认重启${sideLabel.value}侧自动同步？`,
      { confirmButtonText: '确认重启', cancelButtonText: '再想想', type: 'warning' },
    )
  } catch {
    return
  }
  restarting.value = true
  try {
    const res = await api.value!.restart(syncSide.value, startTime)
    // doc_lines：trade 带 trade- 前缀 / borrow 为裸 doc_key，统一由 erpDocLineName 归一化
    const lines = (res.data?.doc_lines || [])
      .map((line) => erpDocLineName(family.value!.key, String(line)))
      .join('、')
    showMessage(`自动同步已重启：${sideLabel.value}侧将自 ${res.data?.start_time || startTime} 起重新同步（${lines || restartDocLinesLabel.value}）；重扫期间该侧每日对账暂停，完成后自动恢复。`, 'success', 8000)
    restartDialogVisible.value = false
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 409) {
      // 本侧任一线有在途同步：warning + 冷却，防连点白跑
      ElMessage.warning((error as Error)?.message || '同步进行中，请稍后重试')
      restartCooldown.value = true
      setTimeout(() => { restartCooldown.value = false }, 3000)
    } else {
      // 400（时间越界）/403（开关未开/无权限）：接口 silent，此处兜底展示后端文案
      const msg = (error as Error)?.message
      if (msg) showErrorDialog(msg)
      else showErrorDialog('重启失败，请稍后重试')
    }
  } finally {
    restarting.value = false
  }
}

// ── 列配置 ──
const columns = computed<Column[]>(() => {
  // detailOnly 列（如借出借入的 est_dd/pay_dd）列表接口不返回，只在详情页展示
  const mapping = ((docConfig.value?.headerColumns || []) as TradeColumn[]).filter((c) => !c.detailOnly)
  // 公共列 sortable 按各单据排序白名单收敛（其他入库仅 erp_bill_date 可排；
  // 贸易/借出借入白名单含全部四列，行为不变）。非白名单排序后端 400 或静默回退，前端先拦。
  const sortable = (prop: string) => headerSortFields.value.has(prop)
  return [
    { prop: 'erp_bill_no', label: 'ERP 单号', minWidth: 150, sortable: sortable('erp_bill_no'), priority: 'high' },
    { prop: 'erp_bill_date', label: '单据日期', width: 120, sortable: sortable('erp_bill_date') },
    ...mapping,
    { prop: 'erp_lock_status', label: '锁单状态', width: 95 },
    { prop: 'wms_archive_flag', label: '归档', width: 90, priority: 'low' },
    { prop: 'total_qty', label: '数量合计', width: 100, align: 'right', sortable: sortable('total_qty') },
    { prop: 'synced_at', label: '同步时间', width: 160, sortable: sortable('synced_at'), priority: 'low' },
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
      const res = await api.value!.search(docKey.value, fields, values, {
        page: pagination.page,
        page_size: pagination.pageSize,
        ...sortQuery,
      })
      tableData.value = res.data.records
      pagination.total = res.data.total
      if (res.data.page_size) pagination.pageSize = res.data.page_size
    } else {
      const query: ErpBillQuery = {
        page: pagination.page,
        page_size: pagination.pageSize,
        date_from: dateRange.value?.[0] || undefined,
        date_to: dateRange.value?.[1] || undefined,
        ...(archivedFilter.value !== undefined ? { archived: archivedFilter.value } : {}),
      }
      if (sortParams.sort_by) query.sort_by = sortParams.sort_by
      if (sortParams.sort_order) query.sort_order = sortParams.sort_order as 'ASC' | 'DESC'
      const res = await api.value!.list(docKey.value, query)
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
  for (const f of searchableFields.value) searchValues[f] = ''
  dateRange.value = null
  archivedFilter.value = 0
  pagination.page = 1
  loadData()
}

function goDetail(row: ErpBillRow) {
  router.push(erpDetailPath(docKey.value, row.wms_bill_id))
}

// ── 借出借入：手动上锁/解锁（镜像生产 bill-lock；ERP 锁定为真实状态）──
const lockingId = ref('')

async function toggleBillLock(row: ErpBillRow) {
  const locked = String(row.erp_lock_status) === '1'
  const target: 0 | 1 = locked ? 0 : 1
  const actionText = locked ? '解锁' : '上锁'
  try {
    await confirmAction(
      h('div', { style: 'white-space: pre-line; line-height: 1.7; font-size: 13px;' },
        [
          `将对单据「${row.erp_bill_no}」执行${actionText}，并推送天心 ERP 锁单指令。`,
          locked
            ? '解锁后该单据在 ERP 内恢复可操作。'
            : '上锁后该单据在天心 ERP 内不可再操作（本地仅记录状态快照）。',
          '若目标状态与现状一致，系统不会重复推送 ERP，仅返回提示。',
        ].join('\n')),
      `确认${actionText}该单据？`,
      { confirmButtonText: `确认${actionText}`, cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  lockingId.value = row.wms_bill_id
  try {
    const res = await updateBorrowBillLock({
      doc_key: docKey.value,
      wms_bill_id: row.wms_bill_id,
      lock_status: target,
    })
    // 幂等拦截时 pushed=false，后端 message 已是可直接展示的提示（「这个单据原本的状态就是…」）
    ElMessage.success(res.message || `${actionText}成功`)
    await loadData()
  } catch (error: unknown) {
    showErrorDialog((error as Error)?.message || `${actionText}失败，请稍后重试`)
  } finally {
    lockingId.value = ''
  }
}

onMounted(loadData)

// keep-alive 缓存页：每次重新激活都重拉列表（跳过首次，避免与 mounted 双请求）。
// ListTemplate 的"激活即刷新"约定对自管数据的列表不生效，此处显式补上。
let skipFirstActivate = true
onActivated(() => {
  if (skipFirstActivate) {
    skipFirstActivate = false
    return
  }
  loadData()
})
</script>

<style scoped>
.num-cell { font-variant-numeric: tabular-nums; }
/* 操作列：详情 + 上锁/解锁 同一行、垂直居中（避免两个 inline 按钮基线错位） */
.row-actions { display: inline-flex; align-items: center; gap: 12px; }
.row-actions :deep(.el-button + .el-button) { margin-left: 0; }

/* ── 筛选区：日期行 + 全字段搜索区 ──
   第一行沿用全站 inline 口径；第二行是全部可搜索字段（常驻可见，无「+ 添加条件」），
   按可用宽度自动分列 —— 列宽下限保证输入框短，列数随宽度增加，行数不会堆高。
   行距不在这里给：全站 .el-form-item 已有 12px margin-bottom。 */
.trade-filter { display: flex; flex-direction: column; }
.trade-filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  column-gap: 20px;
}
.trade-filter-grid :deep(.el-form-item__content) { min-width: 0; }
/* 单日期选择器默认固定 220px，会溢出窄列，改为吃满单元格 */
.trade-filter-grid :deep(.el-date-editor) { width: 100%; }
.search-scope-note { font-size: 12px; color: var(--text-tertiary); }

/* 小屏：与 ListTemplate 的 960px 断点同口径，列再窄一档 */
@media (max-width: 960px) {
  .trade-filter-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    column-gap: 12px;
  }
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

/* ── 重启自动同步弹窗 ── */
.restart-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.restart-header-icon {
  display: grid;
  flex: none;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid var(--el-color-warning-light-7);
  border-radius: var(--radius-md);
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
  font-size: 21px;
}

.restart-header h2 { margin: 0; }
.restart-header p { margin: 2px 0 0; color: var(--el-text-color-regular); font-size: 12px; }
.restart-content { display: grid; gap: 16px; }

.restart-range-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 3px 12px;
  margin-bottom: 10px;
}

.restart-range-heading h3, .restart-tips h3 { margin: 0; color: var(--el-text-color-primary); font-size: 14px; }
.restart-range-heading > span { color: var(--el-text-color-regular); font-size: 12px; }

.restart-range-options {
  --el-color-primary: var(--primary-light);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.restart-range-option {
  position: relative;
  display: block;
  height: auto;
  min-width: 0;
  margin: 0;
  padding: 13px 12px 11px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-md);
  background: var(--el-fill-color-blank);
}

.restart-range-option:not(.is-disabled):hover { border-color: var(--primary-light); }
.restart-range-option.is-checked { border-color: var(--primary-light); background: var(--primary-bg); }
.restart-range-option:has(input:focus-visible) { outline: 2px solid var(--primary-light); outline-offset: 2px; }
.restart-range-option :deep(.el-radio__input) { position: absolute; top: 14px; right: 12px; }
.restart-range-option :deep(.el-radio__label) { display: grid; gap: 5px; padding: 0; }

.restart-range-duration {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding-right: 17px;
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1;
}

.restart-range-duration strong { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
.restart-range-date { color: var(--el-text-color-regular); font-size: 12px; font-variant-numeric: tabular-nums; }

.restart-docs {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding-block: 11px;
  border-block: 1px solid var(--el-border-color-lighter);
  font-size: 13px;
  line-height: 1.5;
}

.restart-docs > span { flex: none; color: var(--el-text-color-regular); }
.restart-docs strong { color: var(--el-text-color-primary); font-weight: 550; }

.restart-tips {
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-md);
  background: var(--el-fill-color-light);
  font-size: 13px;
  line-height: 1.55;
  color: var(--el-text-color-regular);
}

.restart-tips h3 { display: flex; align-items: center; gap: 6px; }
.restart-tips ul { display: grid; gap: 4px; margin: 7px 0 0; padding-left: 17px; }

@media (max-width: 480px) {
  .restart-range-options { grid-template-columns: minmax(0, 1fr); gap: 7px; }
  .restart-range-option { padding: 10px 35px 10px 12px; }
  .restart-range-option :deep(.el-radio__input) { top: 50%; transform: translateY(-50%); }
  .restart-range-option :deep(.el-radio__label) { grid-template-columns: 1fr auto; align-items: baseline; }
  .restart-range-duration { padding-right: 0; }
  .restart-range-duration strong { font-size: 22px; }
}
</style>
