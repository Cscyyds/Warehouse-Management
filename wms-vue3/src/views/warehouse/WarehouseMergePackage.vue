<template>
  <ListTemplate
    title="合包管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    :columns="columns"
    :table-data="tableData"
    pagination-mode="server"
    row-key="merge_package_id"
    :show-index="true"
    :show-selection="true"
    :show-add="false"
    :actions-width="140"
    @page-change="loadData"
    @sort-change="handleSortChange"
    @selection-change="handleSelectionChange"
  >
    <template #actions>
      <el-button type="primary" @click="openGeneration">生成合包条码</el-button>
      <el-button v-if="generateSelection.length" @click="generateOpen = true">查看生成结果</el-button>
      <!-- 补打：勾选 1 条本页直打（预览/打印），勾选多条入打印任务队列。
           扫码枪域端点暂未在网站权限字典登记（后端双注册 SQL 落地前不加 v-perm，
           接口级由 scanner 侧权限把关，同「打印任务」页策略） -->
      <el-button
        type="primary"
        :disabled="!selectedRows.length"
        @click="openPrintDialog()"
      >
        <el-icon><Printer /></el-icon>补打{{ selectedRows.length ? `（${selectedRows.length}）` : '' }}
      </el-button>
      <el-button :loading="loading" @click="loadData">
        <el-icon><Refresh /></el-icon>刷新
      </el-button>
    </template>

    <template #search>
      <el-form inline size="default">
        <el-form-item v-for="f in SEARCH_FIELDS" :key="f.key" :label="f.label">
          <el-input
            v-model="filters[f.key]"
            :placeholder="f.placeholder"
            clearable
            style="width: 150px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <span v-if="searchNote" class="search-scope-note">{{ searchNote }}</span>
        </el-form-item>
      </el-form>
    </template>

    <template #col-barcode_code="{ row }">
      <el-link type="primary" :underline="false" @click="goDetail(row)">{{ row.barcode_code }}</el-link>
    </template>

    <template #col-product_name="{ row }">
      <span>{{ row.product_name }}</span>
      <span v-if="row.product_specification" class="cell-sub">{{ row.product_specification }}</span>
    </template>

    <template #col-merge_qty="{ row }">
      <span class="num-cell">{{ formatQty(row.merge_qty) }}{{ row.unit_name ? ` ${row.unit_name}` : '' }}</span>
    </template>

    <template #col-warehouse_status="{ row }">
      <el-tag :type="warehouseStatusTagType(row.warehouse_status)" size="small">
        {{ row.warehouse_status_desc || MERGE_WAREHOUSE_STATUS_TEXT[row.warehouse_status || ''] || '-' }}
      </el-tag>
    </template>

    <template #col-barcode_status="{ row }">
      <el-tooltip
        v-if="row.barcode_status === 'INVALID' && row.invalid_reason"
        :content="row.invalid_reason"
        placement="top"
      >
        <el-tag type="danger" size="small">已失效</el-tag>
      </el-tooltip>
      <el-tag v-else-if="row.barcode_status" :type="row.barcode_status === 'VALID' ? 'success' : 'danger'" size="small">
        {{ row.barcode_status === 'VALID' ? '有效' : '已失效' }}
      </el-tag>
      <span v-else>-</span>
    </template>

    <template #col-source_name="{ row }">
      <span>{{ sourceLabel(row) }}</span>
    </template>

    <template #col-location_name="{ row }">
      <span>{{ row.location_name || '-' }}</span>
    </template>

    <template #col-bound_plastic_box_name="{ row }">
      <span>{{ formatPlasticBoxName(row.bound_plastic_box_code, row.bound_plastic_box_name) || '-' }}</span>
    </template>

    <template #col-printed_qty="{ row }">
      <span class="num-cell">{{ formatQty(row.printed_qty) }}</span>
    </template>

    <template #col-actions="{ row }">
      <el-button link type="primary" size="small" @click="goDetail(row)">详情</el-button>
      <el-button link type="primary" size="small" @click="openPrintDialog(row)">补打</el-button>
    </template>
  </ListTemplate>

  <!-- 补打弹窗：单条本页直打（预览/打印），多条提交打印任务队列 -->
  <PrintLabelDialog v-model="printOpen" kind="mergePackage" :rows="printRows" @printed="loadData" />
  <MergePackageGenerateDialog v-model="generateOpen" :items="generateSelection" @created="loadData" @print="queueGeneratedPrint" @closed="openGeneratedPrint" />
  <ProductSelectDialog v-model="generationProductsOpen" multiple product-type="GOODS" fixed-height="min(730px, 90vh)" @confirm-multiple="selectGenerationProducts" @closed="openSelectedGeneration" />
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Printer, Refresh } from '@element-plus/icons-vue'
import ListTemplate, { type Column } from '@/views/common/ListTemplate.vue'
import PrintLabelDialog from '@/components/PrintLabelDialog.vue'
import MergePackageGenerateDialog from './components/MergePackageGenerateDialog.vue'
import ProductSelectDialog from '@/views/product/ProductSelectDialog.vue'
import type { ProductItem } from '@/api/modules/product'
import { useTableSort } from '@/composables/useTableSort'
import { formatPlasticBoxName } from '@/utils/plasticBoxDisplay'
import {
  MERGE_SOURCE_TYPE_TEXT,
  MERGE_WAREHOUSE_STATUS_TEXT,
  queryMergePackages,
  searchMergePackages,
  type MergePackageListItem,
  type MergePackageListQuery,
  type MergePackageListResponse,
} from '@/api/modules/scannerMergePackage'

const router = useRouter()

const tableData = ref<MergePackageListItem[]>([])
const selectedRows = ref<MergePackageListItem[]>([])
const generateSelection = ref<ProductItem[]>([])
const generationProductsOpen = ref(false)
let selectedGenerationPending = false
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { handleSortChange, sortParams } = useTableSort(loadData)

/* —— 逐字段搜索 ——
 * 分两组，语义不同，不能混用：
 *
 * ① keyword 组（合包条码/产品/货号/规格/来源货位/来源塑料盒/创建人）：
 *    后端 search 的 keyword 是跨字段 OR 模糊，无逐字段参数；策略是取该组第一个有值的
 *    字段作为后端 keyword（该字段含关键词的行必在返回集内，不会漏），前端再按该组全部
 *    已填字段精确过滤当前页（AND、忽略大小写）。分页/总数按后端 keyword 匹配统计。
 *
 * ② 当前位置组（当前货位/当前塑料盒）：
 *    后端自 2026-11-25 起为这两列提供专属参数（current_location_keyword /
 *    current_box_keyword），服务端直接 AND 过滤，分页总数准确。因此**不参与 keyword
 *    取值、也不在前端二次过滤**——否则会与「来源货位/来源塑料盒」串味，
 *    把来源匹配但当前位置不匹配的行错误放进结果。
 *
 * 分流规则：keyword 组有值 → 走 search（附当前位置参数）；keyword 组为空但只填了
 * 当前位置 → 走 query（同样支持这两个参数），避免 search 的"至少一项"校验误判。
 * 两者都为空 → 走 query 浏览全部。 */

interface SearchFieldDef {
  key: string
  label: string
  placeholder: string
  match: (row: MergePackageListItem, kw: string) => boolean
  /** 有值表示该字段走专属后端参数，不参与 keyword 取值与前端过滤 */
  backendParam?: 'current_location_keyword' | 'current_box_keyword'
}

function includesIgnoreCase(value: unknown, kw: string): boolean {
  return value !== null && value !== undefined && String(value).toLowerCase().includes(kw.toLowerCase())
}

const SEARCH_FIELDS: SearchFieldDef[] = [
  { key: 'barcode', label: '合包条码', placeholder: '条码编号 / mpb_ ID', match: (row, kw) => includesIgnoreCase(row.barcode_code, kw) || includesIgnoreCase(row.merge_package_id, kw) },
  { key: 'productCode', label: '产品编码', placeholder: '产品编码', match: (row, kw) => includesIgnoreCase(row.product_code, kw) },
  { key: 'productName', label: '产品名称', placeholder: '产品名称', match: (row, kw) => includesIgnoreCase(row.product_name, kw) },
  { key: 'itemNo', label: '货号', placeholder: '货号', match: (row, kw) => includesIgnoreCase(row.product_item_no, kw) },
  { key: 'spec', label: '规格', placeholder: '规格', match: (row, kw) => includesIgnoreCase(row.product_specification, kw) },
  // 来源维度：与后端 keyword 的「来源货位名称/来源塑料盒名称」对齐（source_type 条件生效，
  // 不含编号）。注意与下方「当前位置」是两个不同维度。
  { key: 'sourceLocation', label: '来源货位', placeholder: '来源货位名称', match: (row, kw) => row.source_type === 'LOCATION' && includesIgnoreCase(row.source_name, kw) },
  { key: 'sourceBox', label: '来源塑料盒', placeholder: '来源塑料盒名称', match: (row, kw) => row.source_type === 'PLASTIC_BOX' && includesIgnoreCase(row.source_name, kw) },
  { key: 'creator', label: '创建人', placeholder: '创建人', match: (row, kw) => includesIgnoreCase(row.created_by_name, kw) },
  // 当前位置维度（置于末组，与上方「来源」区分）：后端专属参数服务端过滤
  // （货位匹配名称/编号，集散位在位时匹配集散位名称/编号；塑料盒匹配名称/编码）。
  // 此处 match 不参与前端过滤，仅为类型完整保留。
  { key: 'currentLocation', label: '当前货位', placeholder: '货位名称/编号', backendParam: 'current_location_keyword', match: () => true },
  { key: 'currentBox', label: '当前塑料盒', placeholder: '塑料盒名称/编码', backendParam: 'current_box_keyword', match: () => true },
]

const filters = reactive<Record<string, string>>(Object.fromEntries(SEARCH_FIELDS.map((f) => [f.key, ''])))
const searchNote = ref('')

/** keyword 组的已填条件（按 SEARCH_FIELDS 顺序，首个作为后端 keyword） */
const filledKeywordConditions = computed(() =>
  SEARCH_FIELDS
    .filter((field) => !field.backendParam)
    .map((field) => ({ field, kw: (filters[field.key] || '').trim() }))
    .filter((item) => item.kw.length > 0),
)

/** 当前位置组的已填条件：直接映射为后端参数名 */
const currentPlaceParams = computed<Pick<MergePackageListQuery, 'current_location_keyword' | 'current_box_keyword'>>(() => {
  const params: Pick<MergePackageListQuery, 'current_location_keyword' | 'current_box_keyword'> = {}
  for (const field of SEARCH_FIELDS) {
    if (!field.backendParam) continue
    const kw = (filters[field.key] || '').trim()
    if (kw) params[field.backendParam] = kw
  }
  return params
})

const columns: Column[] = [
  { prop: 'barcode_code', label: '合包条码', minWidth: 150, priority: 'high' },
  { prop: 'product_name', label: '产品名称', minWidth: 140, priority: 'high' },
  { prop: 'product_code', label: '产品编码', minWidth: 120 },
  { prop: 'product_item_no', label: '货号', minWidth: 110 },
  { prop: 'product_specification', label: '规格', minWidth: 110, priority: 'low' },
  { prop: 'merge_qty', label: '合包数量', width: 100, align: 'right' },
  { prop: 'warehouse_status', label: '仓库状态', width: 90, align: 'center' },
  { prop: 'barcode_status', label: '条码状态', width: 90, align: 'center' },
  { prop: 'source_name', label: '来源', minWidth: 120, priority: 'low' },
  // 搜索区每个字段都有对应可见列（品号→品号列；来源货位/来源塑料盒→来源列；
  // 当前货位/当前塑料盒为展示维度，后端暂不支持按当前位置搜索）
  { prop: 'location_name', label: '当前货位', minWidth: 130 },
  { prop: 'bound_plastic_box_name', label: '当前塑料盒', minWidth: 120 },
  { prop: 'inbound_doc_no', label: '入库单号', minWidth: 140, priority: 'low' },
  { prop: 'outbound_doc_no', label: '出库单号', minWidth: 140, priority: 'low' },
  { prop: 'printed_qty', label: '打印次数', width: 90, align: 'center', priority: 'low' },
  { prop: 'created_by_name', label: '创建人', width: 90, priority: 'low' },
  { prop: 'last_inbound_time', label: '最近入库时间', minWidth: 170 },
  { prop: 'created_at', label: '创建时间', minWidth: 160, sortable: true },
]

/* —— 补打（单条直打 / 多条入队，分流在 PrintLabelDialog 内按 rows.length 决定） —— */

const printOpen = ref(false)
const generateOpen = ref(false)
function openGeneration() {
  selectedGenerationPending = false
  generationProductsOpen.value = true
}
function selectGenerationProducts(products: ProductItem[]) {
  generateSelection.value = products.map(product => ({ ...product }))
  selectedGenerationPending = generateSelection.value.length > 0
}
function openSelectedGeneration() {
  if (!selectedGenerationPending) return
  selectedGenerationPending = false
  generateOpen.value = true
}
let pendingGeneratedPrint: { id: string; title: string; subtitle: string }[] | null = null
function queueGeneratedPrint(rows: { id: string; title: string; subtitle: string }[]) {
  pendingGeneratedPrint = rows
}
function openGeneratedPrint() {
  if (!pendingGeneratedPrint) return
  printRows.value = pendingGeneratedPrint
  pendingGeneratedPrint = null
  printOpen.value = true
}
const printRows = ref<{ id: string; title: string; subtitle?: string }[]>([])

function toPrintRow(row: MergePackageListItem) {
  return { id: row.merge_package_id, title: row.product_name, subtitle: row.barcode_code }
}

function openPrintDialog(row?: MergePackageListItem) {
  printRows.value = row ? [toPrintRow(row)] : selectedRows.value.map(toPrintRow)
  if (!printRows.value.length) return
  printOpen.value = true
}

function handleSelectionChange(rows: MergePackageListItem[]) {
  selectedRows.value = rows
}

/* —— 数据加载：有关键字走 search（模糊匹配），无关键字走 query 列表 —— */

async function loadData() {
  selectedRows.value = []
  loading.value = true
  searchNote.value = ''
  try {
    const query: MergePackageListQuery = {
      page: pagination.page,
      page_size: pagination.pageSize,
    }
    // useTableSort 回传的是列 column-key（字符串），收窄到后端排序白名单
    if (sortParams.sort_by) query.sort_by = sortParams.sort_by as 'created_at'
    if (sortParams.sort_order) query.sort_order = sortParams.sort_order as 'asc' | 'desc'

    // 当前位置维度：两列都有专属后端参数，服务端 AND 过滤（不进 keyword、不做前端过滤）
    Object.assign(query, currentPlaceParams.value)

    const conditions = filledKeywordConditions.value
    const hasPlaceFilter = Object.keys(currentPlaceParams.value).length > 0
    let res: MergePackageListResponse
    if (conditions.length) {
      res = await searchMergePackages(conditions[0].kw, query)
      // 前端按 keyword 组全部已填字段精确过滤（后端 keyword 是跨字段 OR 的超集）。
      // 当前位置组不在此过滤：后端已精确过滤，且其字段与 keyword 的「来源」语义
      // 不同，再拿本行展示值过滤会误杀（如来源货位与当前货位不同名时）。
      const refined = res.list.filter((row) => conditions.every(({ field, kw }) => field.match(row, kw)))
      const dropped = res.list.length - refined.length
      tableData.value = refined
      const primary = conditions[0].field.label
      const placeNote = hasPlaceFilter ? '，按当前货位/当前塑料盒过滤' : ''
      searchNote.value = (conditions.length > 1 || dropped
        ? `搜索模式：分页计数按「${primary}」的后端匹配统计，当前页已按全部 ${conditions.length} 个条件精确过滤` + (dropped ? `（滤除 ${dropped} 条）` : '')
        : `搜索模式：按「${primary}」匹配`) + placeNote
      pagination.total = res.total
    } else {
      // keyword 组为空：可能只填了当前位置，也可能无条件浏览。
      // query 接口同样支持这两个参数，且无 search 的"至少一项"限制，统一走它。
      res = await queryMergePackages(query)
      tableData.value = res.list
      pagination.total = res.total
      searchNote.value = hasPlaceFilter ? '搜索模式：按当前货位/当前塑料盒过滤' : ''
    }
    // 订阅到期时后端会把 page_size 压到 10，以响应值为准渲染分页器
    if (res.page_size) pagination.pageSize = res.page_size
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
  SEARCH_FIELDS.forEach((field) => { filters[field.key] = '' })
  pagination.page = 1
  loadData()
}

function goDetail(row: MergePackageListItem) {
  router.push(`/warehouse/merge-package/detail/${row.merge_package_id}`)
}

/* —— 展示辅助 —— */

function warehouseStatusTagType(status: string | null): 'info' | 'success' | 'warning' {
  if (status === 'INBOUND') return 'success'
  if (status === 'OUTBOUND') return 'warning'
  return 'info'
}

function sourceLabel(row: MergePackageListItem): string {
  const typeText = row.source_type ? (MERGE_SOURCE_TYPE_TEXT[row.source_type] || row.source_type) : ''
  return [typeText, row.source_name].filter(Boolean).join('：') || '-'
}

function formatQty(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : String(value)
}

onMounted(loadData)
</script>

<style scoped>
.num-cell { font-variant-numeric: tabular-nums; }
.cell-sub { display: block; font-size: 12px; color: var(--text-tertiary); }
.search-scope-note { margin-left: 10px; font-size: 12px; color: var(--text-tertiary); }
</style>
