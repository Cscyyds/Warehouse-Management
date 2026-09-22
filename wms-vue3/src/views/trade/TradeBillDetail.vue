<template>
  <div class="trade-detail">
    <div class="detail-topbar">
      <el-button link type="primary" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>返回{{ docConfig?.name || '列表' }}
      </el-button>
      <span class="detail-title">{{ docConfig?.name || '贸易单据' }}详情</span>
      <span class="detail-billno">{{ header?.erp_bill_no || billId }}</span>
    </div>

    <!-- 表头信息 -->
    <el-card shadow="never" class="section-card" v-loading="loading">
      <template #header><span class="card-title">单据表头</span></template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="ERP 单号">{{ formatCell(header?.erp_bill_no) }}</el-descriptions-item>
        <el-descriptions-item label="单据日期">{{ formatCell(header?.erp_bill_date) }}</el-descriptions-item>
        <el-descriptions-item label="ERP 修改时间">{{ formatCell(header?.erp_modify_date) }}</el-descriptions-item>
        <el-descriptions-item label="同步时间">{{ formatCell(header?.synced_at) }}</el-descriptions-item>
        <el-descriptions-item label="数量合计">{{ formatCell(header?.total_qty) }}</el-descriptions-item>
        <el-descriptions-item
          v-for="col in docConfig?.headerColumns || []"
          :key="col.prop"
          :label="col.label"
        >{{ formatHeaderCell(col.prop, header?.[col.prop]) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 明细 -->
    <el-card shadow="never" class="section-card">
      <template #header>
        <div class="items-header">
          <span class="card-title">单据明细（{{ itemsTotal }}）</span>
          <div class="items-toolbar">
            <el-select
              v-model="itemSearchField"
              v-perm="`GET /api/v1/tenant-trade/${docKey}/items/search`"
              placeholder="选择字段"
              filterable
              clearable
              size="small"
              style="width: 130px"
            >
              <el-option
                v-for="f in itemSearchableFields"
                :key="f"
                :label="itemFieldLabel(f)"
                :value="f"
              />
            </el-select>
            <el-input
              v-model="itemSearchValue"
              v-perm="`GET /api/v1/tenant-trade/${docKey}/items/search`"
              :placeholder="docConfig?.itemSearchPlaceholder || '搜索明细'"
              clearable
              size="small"
              style="width: 180px"
              @keyup.enter="doItemSearch"
              @clear="exitSearch"
            />
            <el-button size="small" type="primary" @click="doItemSearch">搜索</el-button>
          </div>
        </div>
      </template>

      <el-alert
        v-if="searchMode"
        type="info"
        :closable="false"
        :title="`明细搜索模式：${itemSearchField} = 「${itemSearchValue}」，共 ${searchTotal} 条（服务端分页）`"
        class="search-alert"
      />

      <el-table
        v-loading="loading || searchLoading"
        :data="displayItems"
        border
        size="small"
        row-key="wms_item_id"
        style="width: 100%"
      >
        <el-table-column prop="erp_item_seq" label="项次" width="60" align="center" />
        <el-table-column prop="prd_no" label="品号" min-width="120" show-overflow-tooltip />
        <el-table-column prop="prd_name" label="品名" min-width="150" show-overflow-tooltip />
        <el-table-column prop="product_name" label="产品档案" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.product_name">{{ row.product_name }}</span>
            <el-tag v-else type="warning" size="small">未绑定</el-tag>
          </template>
        </el-table-column>
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
        <el-table-column prop="location_no" label="货位编号" width="110" show-overflow-tooltip />
        <el-table-column prop="location_name" label="货位名称" width="120" show-overflow-tooltip />
      </el-table>

      <el-pagination
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
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { TRADE_DOC_CONFIG_MAP, TRADE_DOC_LIST_PATH, WAREHOUSE_STATUS_LABELS } from '@/config/tradeDocConfig'
import {
  getTradeBillDetail,
  searchTradeItems,
  getItemSortFields,
  type TradeItemRow,
  type TradeDocKey,
} from '@/api/modules/trade'

const route = useRoute()
const router = useRouter()

const docKey = computed(() => String(route.params.docKey || '') as TradeDocKey)
const billId = computed(() => String(route.params.billId || ''))
const docConfig = computed(() => TRADE_DOC_CONFIG_MAP[docKey.value])

const loading = ref(false)
const header = ref<Record<string, unknown> | null>(null)

// ── 明细分页（items/list，跨单；详情页内按当前单据过滤由后端 detail 返回） ──
const detailItems = ref<TradeItemRow[]>([])
const itemsTotal = ref(0)
const itemsPage = ref(1)
const itemsPageSize = ref(100)

// ── 明细搜索（items/search） ──
const itemSearchField = ref('')
const itemSearchValue = ref('')
const searchMode = ref(false)
const searchLoading = ref(false)
const searchItems = ref<TradeItemRow[]>([])
const searchTotal = ref(0)
const searchPage = ref(1)
const searchPageSize = ref(100)

/** 当前单据明细可搜索字段白名单 */
const itemSearchableFields = computed(() => getItemSortFields(docKey.value))

const ITEM_FIELD_LABELS: Record<string, string> = {
  erp_item_seq: '项次', erp_bill_no: 'ERP 单号', prd_no: '品号', prd_name: '品名',
  name_eng: '英文品名', spc: '规格', prd_mark: '长度', wh: '仓库', unit: '单位',
  qty: '数量', rem: '摘要', bat_no: '批号', free_id: '自由项',
  source_os_no: '来源单号', source_item_seq: '来源项次',
  product_name: '产品档案', location_no: '货位编号', location_name: '货位名称',
  planned_in_stock_qty: '预计入库量', in_stock_qty: '已入库量', actual_in_stock_qty: '实际入库量',
  warehouse_task_status: '仓库任务状态', pending_out_qty: '待出库量', out_qty: '已出库量',
  return_qty: '退回量', planned_return_qty: '预计退回量', deducted_receipt_qty: '已扣缴回量',
  confirmed_release_qty: '确认释放量', converted_receipt_qty: '转缴回量', actual_return_qty: '实际退回量',
  ck_no: '出库单号', ship_status: '出货状态', actual_out_qty: '实际出库量',
  pending_return_qty: '待退回量', returned_qty: '已退回量',
  so_os_no: '销货单号', deducted_out_qty: '已扣出库量',
}
function itemFieldLabel(field: string): string {
  return ITEM_FIELD_LABELS[field] || field
}

/** 详情接口一次返回全部明细，非搜索态走客户端分页（按 itemsPage 切片） */
const displayItems = computed(() => {
  if (searchMode.value) return searchItems.value
  const start = (itemsPage.value - 1) * itemsPageSize.value
  return detailItems.value.slice(start, start + itemsPageSize.value)
})

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

/** 表头单元格：仓库状态后端返回裸码值，需解码成中文；未知码值原样透出 */
function formatHeaderCell(prop: string, value: unknown): string {
  if (prop === 'warehouse_status' && value != null && value !== '') {
    return WAREHOUSE_STATUS_LABELS[String(value)] ?? String(value)
  }
  return formatCell(value)
}

// ── 加载详情（表头 + 全部明细） ──
async function loadDetail() {
  if (!billId.value) return
  loading.value = true
  searchMode.value = false
  try {
    const res = await getTradeBillDetail(docKey.value, billId.value)
    header.value = res.data.header
    detailItems.value = res.data.items || []
    itemsTotal.value = detailItems.value.length
    itemsPage.value = 1
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 404) {
      ElMessage.warning('单据不存在，可能已被删除或同步尚未到达')
      router.back()
      return
    }
    header.value = null
    detailItems.value = []
    itemsTotal.value = 0
  } finally {
    loading.value = false
  }
}

// ── 明细搜索 ──
async function doItemSearch() {
  const field = itemSearchField.value
  const value = itemSearchValue.value.trim()
  if (!field || !value) { exitSearch(); return }
  searchLoading.value = true
  searchMode.value = true
  searchPage.value = 1
  try {
    const res = await searchTradeItems(docKey.value, [field], { [field]: value }, {
      page: 1,
      page_size: searchPageSize.value,
    })
    searchItems.value = res.data.items
    searchTotal.value = res.data.total
    searchPage.value = res.data.page || 1
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
    const field = itemSearchField.value
    const value = itemSearchValue.value.trim()
    const res = await searchTradeItems(docKey.value, [field], { [field]: value }, {
      page,
      page_size: searchPageSize.value,
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
  itemSearchField.value = ''
  itemSearchValue.value = ''
  searchItems.value = []
  searchTotal.value = 0
}

function onItemsPageChange(page: number) {
  if (searchMode.value) { onSearchPageChange(page); return }
  // 详情接口一次返回全部明细，客户端分页
  itemsPage.value = page
}

function goBack() {
  // 回跳到共享的 WMS 采购/销售页面（天心模式下该页就地渲染天心列表）
  const listPath = TRADE_DOC_LIST_PATH[docKey.value]
  if (listPath) router.push(listPath)
  else router.back()
}

onMounted(loadDetail)
</script>

<style scoped>
.trade-detail { display: flex; flex-direction: column; gap: 12px; }
.detail-topbar { display: flex; align-items: center; gap: 12px; }
.detail-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.detail-billno { font-family: monospace; color: var(--text-secondary); }
.section-card { border-radius: var(--radius-md); }
.section-card :deep(.el-descriptions__label),
.section-card :deep(.el-descriptions__content) { font-size: var(--font-table); }
.card-title { font-weight: 600; }
.items-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.items-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.search-alert { margin-bottom: 10px; }
.items-pagination { margin-top: 12px; justify-content: flex-end; }
</style>
