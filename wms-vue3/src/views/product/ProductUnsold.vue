<template>
  <ListTemplate :title="pageTitle" :show-add="false" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="搜索字段">
          <el-select v-model="searchForm.search_field" style="width:120px">
            <el-option label="产品名称" value="product_name" />
            <el-option label="产品编号" value="product_code" />
            <el-option label="供应商名称" value="supplier_name" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词"><el-input v-model="searchForm.keyword" placeholder="请输入" clearable style="width:160px" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #table>
      <el-alert v-if="fields.hiddenPaths.value.length" title="部分信息受角色权限限制，已隐藏" type="info" :closable="false" />
      <el-table ref="tableRef" border :data="initialLoading ? skeletonRows : tableData" :class="{ 'table-skeleton': initialLoading }" stripe size="small" style="width:100%" row-class-name="table-row" v-loading="loading && !initialLoading" show-summary :summary-method="getSummaries" @sort-change="handleSortChange">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="product_code" label="产品编号" show-overflow-tooltip min-width="100" column-key="created_at" sortable="custom" />
        <el-table-column prop="product_name" label="产品名称" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="cell-link" @click="handleEdit(row)">{{ row.product_name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="category_name" label="产品类别" show-overflow-tooltip min-width="90" />
        <el-table-column prop="specification" label="规格" min-width="80" show-overflow-tooltip />
        <el-table-column prop="unit_name" label="单位" show-overflow-tooltip width="60" />
        <el-table-column prop="last_sale_date" label="最后购买日期" width="170" column-key="last_sale_date" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ row.last_sale_date ? formatTableDate(row.last_sale_date) : '从未销售' }}</template>
        </el-table-column>
        <el-table-column v-if="fields.canView('items[].warehouse_stock')" prop="warehouse_stock" label="可用库存" show-overflow-tooltip width="100" align="right" column-key="warehouse_stock" sortable="custom" />
        <el-table-column v-if="fields.canView('items[].amount')" prop="amount" label="金额" show-overflow-tooltip width="100" align="right" column-key="amount" sortable="custom" />
        <el-table-column prop="suppliers" label="供应商" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatSupplierNames(row.suppliers) }}
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getSlowMovingProducts, searchSlowMovingProducts, type SlowMovingItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSkeleton } from '@/composables/useTableSkeleton'
import { formatTableDate } from '@/utils/date'
import { useSensitiveFields } from '@/composables/useSensitiveFields'
import { useTableSort } from '@/composables/useTableSort'
import { createAmountSummary } from '@/composables/useTableSummary'

const router = useRouter()
const tableData = ref<SlowMovingItem[]>([])
const loading = ref(false)
/** 首屏骨架：仅首次加载出骨架，翻页/切回标签页仍用遮罩 */
const { initialLoading, skeletonRows } = useTableSkeleton(loading)
const thresholdMonths = ref<number | null>(null)
const searchForm = reactive({ keyword: '', search_field: 'product_name' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const pageSession = localStorage.getItem('token')
const tableRef = ref<any>()
let loadSequence = 0
const interfacePath = computed(() => searchForm.keyword.trim() ? '/tenant-products/slow-moving/search' : '/tenant-products/slow-moving/query')
const fields = useSensitiveFields({ interfacePath: () => interfacePath.value })
const { sortBy: sortField, sortOrder, handleSortChange, clearRestrictedSort } = useTableSort(loadData, prop => !['warehouse_stock', 'amount', 'avg_cost_price'].includes(prop) || (fields.confirmed.value && fields.canView(`items[].${prop}`)))
const getSummaries = createAmountSummary(['amount'], prop => fields.confirmed.value && fields.canView(`items[].${prop}`))

const pageTitle = computed(() =>
  thresholdMonths.value != null
    ? `滞销产品表（认定标准：${thresholdMonths.value}个月未销售）`
    : '滞销产品表'
)

async function loadData() {
  loading.value = true
  const sequence = ++loadSequence
  try {
    await fields.refresh()
    if (sequence !== loadSequence || pageSession !== localStorage.getItem('token')) return
    if (clearRestrictedSort()) tableRef.value?.clearSort()
    const baseParams = {
      page: pagination.page,
      page_size: pagination.pageSize,
      sort_by: sortField.value || undefined,
      sort_order: sortOrder.value || undefined,
    }
    const res = searchForm.keyword.trim()
      ? await searchSlowMovingProducts({ keyword: searchForm.keyword.trim(), search_field: searchForm.search_field, ...baseParams })
      : await getSlowMovingProducts(baseParams)
    if (sequence !== loadSequence || pageSession !== localStorage.getItem('token')) return
    fields.setResponse(res.data)
    if (clearRestrictedSort()) { tableRef.value?.clearSort(); return loadData() }
    tableData.value = res.data.items || []
    pagination.total = res.data.total ?? 0
    thresholdMonths.value = res.data.threshold_months ?? null
  } catch {
    if (sequence !== loadSequence) return
    tableData.value = []
    pagination.total = 0
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { keyword: '', search_field: 'product_name' }); handleSearch() }
function handleEdit(row: SlowMovingItem) {
  router.push({ path: '/common/add', query: { type: 'productInfo', id: row.product_id, mode: 'edit', readonly: '1' } })
}
function formatSupplierNames(suppliers?: SlowMovingItem['suppliers']) {
  return suppliers?.map((s) => s.supplier_name).join('、') || '-'
}

onMounted(() => { loadData() })
</script>
