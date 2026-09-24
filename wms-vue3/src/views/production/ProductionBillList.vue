<template>
  <ListTemplate
    :title="docConfig?.name || '生产单据'"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    :columns="columns"
    :table-data="tableData"
    pagination-mode="server"
    row-key="wms_bill_id"
    :show-index="true"
    :show-selection="true"
    :show-add="false"
    @page-change="loadData"
    @sort-change="handleSortChange"
    @selection-change="handleSelectionChange"
  >
    <template #actions>
      <!-- 批量打印（天心分支）：勾选多张单据下发打印任务，到"打印任务"窗口统一打印
           （选芯烨型号时直打标签，未选时下载 PDF）；任务创建走扫码枪后端 print_task 表
           （来源 PRODUCTION_BILL_PRINT，任务名由后端按「单据类别 单号」生成） -->
      <el-button
        v-perm="selectedBills.length > 1 ? 'POST /api/v1/tenant-wms/print-tasks' : `GET /api/v1/tenant-production/${docKey}/print/pdf`"
        type="primary"
        :disabled="!selectedBills.length"
        :loading="batchPrintLoading || !!printingId"
        @click="handleBatchPrint"
      >
        <el-icon><Printer /></el-icon>{{ selectedBills.length > 1 ? '批量打印' : '打印' }}{{ selectedBills.length ? `（${selectedBills.length}）` : '' }}
      </el-button>
      <el-button
        v-perm="'POST /api/v1/tenant-production/wms-status/batch-update'"
        @click="batchVisible = true"
      >
        <el-icon><Operation /></el-icon>批量变更仓库作业状态
      </el-button>
      <el-button :loading="loading" @click="loadData">
        <el-icon><Refresh /></el-icon>刷新
      </el-button>
    </template>

    <template #search>
      <el-form inline size="default">
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
        <el-form-item
          v-perm="`GET /api/v1/tenant-production/${docKey}/search`"
          :label="'关键字'"
        >
          <el-input
            v-model="keyword"
            :placeholder="docConfig?.headerSearchPlaceholder || '搜索'"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <span v-if="isSearching" class="search-scope-note">搜索模式：仅按关键字匹配表头，日期与排序不参与</span>
        </el-form-item>
      </el-form>
    </template>

    <template #col-erp_bill_no="{ row }">
      <el-link
        v-perm="`GET /api/v1/tenant-production/${docKey}/detail`"
        type="primary"
        :underline="false"
        @click="goDetail(row)"
      >{{ row.erp_bill_no }}</el-link>
    </template>

    <template #col-total_qty="{ row }">
      <span class="num-cell">{{ formatQty(row.total_qty) }}</span>
    </template>

    <template #col-erp_lock_status="{ row }">
      <el-tag :type="isLocked(row) ? 'danger' : 'info'" size="small">
        {{ isLocked(row) ? '已锁定' : '未锁定' }}
      </el-tag>
    </template>

    <template #col-actions="{ row }">
      <el-button
        v-perm="`GET /api/v1/tenant-production/${docKey}/detail`"
        link
        type="primary"
        size="small"
        @click="goDetail(row)"
      >详情</el-button>
      <!-- 箱贴标签打印（天心分支）：下发单据到打印任务（与批量同链路），到"打印任务"
           窗口统一打印（选芯烨型号时直打 100×70mm 箱贴，未选时下载 PDF）。
           打印实现为天心渠道专用，其他渠道后端返回业务失败提示，不在前端按渠道隐藏入口 -->
      <el-button
        v-perm="'POST /api/v1/tenant-wms/print-tasks'"
        link
        type="primary"
        size="small"
        :disabled="batchPrintLoading || (!!printingId && printingId !== row.wms_bill_id)"
        :loading="printingId === row.wms_bill_id"
        @click="handlePrintRow(row)"
      >打印</el-button>
      <!-- 锁单/解锁：直接推送天心 ERP 锁单指令（幂等拦截与 ERP 失败由后端按业务失败返回）。
           托工缴回单/托工退回单在天心无单据别，后端不支持，隐藏入口 -->
      <el-button
        v-if="lockSupported"
        v-perm="'POST /api/v1/tenant-production/bill-lock/update'"
        link
        :type="isLocked(row) ? 'warning' : 'success'"
        size="small"
        :loading="lockLoadingId === row.wms_bill_id"
        @click="toggleLock(row)"
      >{{ isLocked(row) ? '解锁' : '上锁' }}</el-button>
    </template>
  </ListTemplate>

  <!-- 批量变更仓库作业状态：预选当前单据类别，执行成功后刷新本页 -->
  <WmsStatusBatchDialog v-model="batchVisible" :default-doc-key="docKey" @done="loadData" />
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Operation, Printer, Refresh } from '@element-plus/icons-vue'
import ListTemplate, { type Column } from '@/views/common/ListTemplate.vue'
import WmsStatusBatchDialog from './components/WmsStatusBatchDialog.vue'
import { useTableSort } from '@/composables/useTableSort'
import { PRODUCTION_DOC_CONFIG_MAP, type ProductionColumn } from '@/config/productionDocConfig'
import {
  isBillLockSupported,
  listProductionBills,
  searchProductionBills,
  updateProductionBillLockStatus,
  type ProductionBillLockResult,
  type ProductionBillQuery,
  type ProductionBillRow,
  type ProductionSortField,
} from '@/api/modules/production'
import {
  BIZ_TYPE_PRODUCTION_BILL_LABEL,
  PRINT_TASK_SOURCE_PRODUCTION_BILL_PRINT,
  createPrintTasks,
} from '@/api/modules/printTask'
import type { ApiResponse } from '@/utils/request'

const route = useRoute()
const router = useRouter()

// fullPath 已隔离缓存实例，单据身份不能跟随其他标签的全局路由变化。
const docKey = String(route.meta.docKey || route.params.docKey || '')
const docConfig = computed(() => PRODUCTION_DOC_CONFIG_MAP[docKey])

const tableData = ref<ProductionBillRow[]>([])
const loading = ref(false)
const batchVisible = ref(false)
const keyword = ref('')
const dateRange = ref<[string, string] | null>(null)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { handleSortChange, sortParams } = useTableSort(loadData)

/** 关键字搜索走后端 search 接口：只按关键字匹配表头，日期与排序都不参与。
 *  进入搜索态时禁用日期筛选并提示实际生效范围，避免控件状态与结果不一致。 */
const isSearching = computed(() => keyword.value.trim().length > 0)

/** 列表列 = 公共前置列 + 映射区表头列 + 公共后置列 */
const columns = computed<Column[]>(() => {
  const mapping: ProductionColumn[] = docConfig.value?.headerColumns || []
  return [
    { prop: 'erp_bill_no', label: 'ERP 单号', minWidth: 150, sortable: true, priority: 'high' },
    { prop: 'erp_bill_date', label: '单据日期', width: 200, sortable: true },
    ...mapping,
    { prop: 'item_count', label: '明细数', width: 80, align: 'center' },
    { prop: 'total_qty', label: '数量合计', width: 100, align: 'right' },
    { prop: 'erp_lock_status', label: '锁单状态', width: 90, align: 'center' },
    { prop: 'synced_at', label: '同步时间', width: 160, sortable: true, priority: 'low' },
  ] as Column[]
})

/** 锁单/解锁：托工缴回单与托工退回单在天心无单据别（BIL_ID），后端不支持 */
const lockSupported = computed(() => isBillLockSupported(docKey))
const lockLoadingId = ref('')

/** 箱贴标签打印（天心分支）：单张/批量统一下发打印任务（行内按钮防重入） */
const printingId = ref('')

/* —— 批量打印（天心分支）：勾选多张单据下发打印任务，到"打印任务"窗口统一打印 —— */

const selectedBills = ref<ProductionBillRow[]>([])
const batchPrintLoading = ref(false)

function handleSelectionChange(rows: ProductionBillRow[]) {
  selectedBills.value = rows
}

/** 生成批次号（重试复用可幂等）：优先 crypto.randomUUID，非安全上下文降级随机串 */
function makeBatchNo(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function handleBatchPrint() {
  const bills = selectedBills.value.filter((row) => row.wms_bill_id)
  if (!bills.length || batchPrintLoading.value || printingId.value) return
  if (bills.length === 1) {
    await handlePrintPdf(bills[0])
    return
  }
  const docName = docConfig.value?.name || '生产单据'
  batchPrintLoading.value = true
  try {
    try {
      await ElMessageBox.confirm(
        `将把勾选的 ${bills.length} 张${docName}加入打印任务（箱贴标签，天心分支版式），` +
          '到「仓库管理 → 打印任务」窗口统一下载 PDF 打印。是否继续？',
        '批量打印',
        { confirmButtonText: '加入打印任务', cancelButtonText: '取消' },
      )
    } catch {
      return
    }
    const result = await createPrintTasks(
      PRINT_TASK_SOURCE_PRODUCTION_BILL_PRINT,
      bills.map((row) => ({
        biz_type: BIZ_TYPE_PRODUCTION_BILL_LABEL,
        biz_id: row.wms_bill_id,
        biz_desc: String(row.erp_bill_no || row.wms_bill_id),
        params: { doc_key: docKey },
      })),
      makeBatchNo(),
    )
    const skipped = result.skipped.length
    const invalid = result.invalid.length
    let message = `已加入打印任务：${result.created.length} 张单据`
    if (skipped) message += `，跳过 ${skipped} 张（已存在待打印任务）`
    if (invalid) message += `，失败 ${invalid} 张（${result.invalid[0]?.reason || '单据无效'}）`
    if (invalid) {
      if (result.created.length) ElMessage.warning(message)
      else ElMessage.error(message)
    } else if (result.created.length) ElMessage.success(message)
    else ElMessage.info(message)
    if (result.created.length) {
      try {
        await ElMessageBox.confirm(
          `${message}。是否现在前往打印任务页面？`,
          '批量打印任务已创建',
          { confirmButtonText: '前往打印任务', cancelButtonText: '留在本页' },
        )
        router.push('/warehouse/print-task')
      } catch { /* 留在本页 */ }
    }
  } catch {
    /* printTask 拦截器已提示后端文案 */
  } finally {
    batchPrintLoading.value = false
  }
}

/** 行内打印：单张单据下发箱贴打印任务（与批量同链路，到打印任务窗口统一打印） */
async function handlePrintRow(row: ProductionBillRow) {
  if (!row.wms_bill_id || printingId.value || batchPrintLoading.value) return
  const docName = docConfig.value?.name || '生产单据'
  printingId.value = row.wms_bill_id
  try {
    await ElMessageBox.confirm(
      `将把${docName}「${row.erp_bill_no || row.wms_bill_id}」加入打印任务（箱贴标签，天心分支版式），` +
        '到「仓库管理 → 打印任务」窗口统一打印。是否继续？',
      '打印',
      { confirmButtonText: '加入打印任务', cancelButtonText: '取消' },
    )
  } catch {
    printingId.value = ''
    return
  }
  try {
    await dispatchBillPrintTasks([row])
  } catch {
    /* printTask 拦截器已提示后端文案 */
  } finally {
    printingId.value = ''
  }
}

function isLocked(row: ProductionBillRow): boolean {
  return Number(row.erp_lock_status) === 1
}

/** 上锁/解锁：先确认再推送（直接影响天心 ERP 中单据的可操作性）。
 *  幂等拦截（目标状态与原状态相同）与 ERP 调用失败后端均返回 success=false，
 *  message 为可直接展示的文案，按 warning 提示并原位修正行状态。 */
async function toggleLock(row: ProductionBillRow) {
  const target: 0 | 1 = isLocked(row) ? 0 : 1
  const action = target === 1 ? '上锁' : '解锁'
  try {
    await ElMessageBox.confirm(
      `确认对单据「${row.erp_bill_no}」执行${action}？` +
        (target === 1 ? '上锁后天心 ERP 中该单据将不可再操作。' : '解锁后天心 ERP 中该单据将恢复可操作。'),
      `${action}确认`,
      { confirmButtonText: `确认${action}`, cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  lockLoadingId.value = row.wms_bill_id
  try {
    const res = await updateProductionBillLockStatus(
      { doc_key: docKey, wms_bill_id: row.wms_bill_id, lock_status: target },
      { silent: true },
    )
    ElMessage.success(res.message || `${action}成功`)
    await loadData()
  } catch (error) {
    const payload = (error as { response?: { data?: ApiResponse<ProductionBillLockResult> } })?.response?.data
    if (payload?.message) {
      ElMessage.warning(payload.message)
      if (payload.data) row.erp_lock_status = payload.data.erp_lock_status
    } else {
      ElMessage.error(error instanceof Error ? error.message : `${action}失败`)
    }
  } finally {
    lockLoadingId.value = ''
  }
}

function formatQty(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : String(value)
}

async function loadData() {
  loading.value = true
  try {
    const kw = keyword.value.trim()
    if (kw) {
      const res = await searchProductionBills(docKey, kw, pagination.page, pagination.pageSize)
      tableData.value = res.data.bills
      pagination.total = res.data.total
      // 订阅到期时后端同样会压缩 page_size，以响应值为准（否则第 2 页之后不可达）
      if (res.data.page_size) pagination.pageSize = res.data.page_size
    } else {
      const query: ProductionBillQuery = {
        page: pagination.page,
        page_size: pagination.pageSize,
        date_start: dateRange.value?.[0] || undefined,
        date_end: dateRange.value?.[1] || undefined,
      }
      // useTableSort 回传的是列 column-key（字符串），收窄到后端排序白名单类型
      if (sortParams.sort_by) query.sort_by = sortParams.sort_by as ProductionSortField
      if (sortParams.sort_order) query.sort_order = sortParams.sort_order as 'ASC' | 'DESC'
      const res = await listProductionBills(docKey, query)
      tableData.value = res.data.bills
      pagination.total = res.data.total
      // 订阅到期时后端会把 page_size 压到 ≤10，以响应值为准渲染分页器
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
  keyword.value = ''
  dateRange.value = null
  pagination.page = 1
  loadData()
}

function goDetail(row: ProductionBillRow) {
  router.push(`/production/${docKey}/detail/${row.wms_bill_id}`)
}

onMounted(loadData)
</script>

<style scoped>
.num-cell { font-variant-numeric: tabular-nums; }
.search-scope-note { margin-left: 10px; font-size: 12px; color: var(--text-tertiary); }
</style>
