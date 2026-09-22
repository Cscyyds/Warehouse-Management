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
    :show-add="false"
    @page-change="loadData"
    @sort-change="handleSortChange"
  >
    <template #actions>
      <el-button
        v-perm="'POST /api/v1/tenant-production/wms-status/batch-update'"
        @click="batchVisible = true"
      >
        <el-icon><Operation /></el-icon>批量冻结 / 解冻
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

    <template #col-actions="{ row }">
      <el-button
        v-perm="`GET /api/v1/tenant-production/${docKey}/detail`"
        link
        type="primary"
        size="small"
        @click="goDetail(row)"
      >详情</el-button>
    </template>
  </ListTemplate>

  <!-- 批量冻结 / 解冻：预选当前单据类别，执行成功后刷新本页 -->
  <WmsStatusBatchDialog v-model="batchVisible" :default-doc-key="docKey" @done="loadData" />
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Operation, Refresh } from '@element-plus/icons-vue'
import ListTemplate, { type Column } from '@/views/common/ListTemplate.vue'
import WmsStatusBatchDialog from './components/WmsStatusBatchDialog.vue'
import { useTableSort } from '@/composables/useTableSort'
import { PRODUCTION_DOC_CONFIG_MAP, type ProductionColumn } from '@/config/productionDocConfig'
import {
  listProductionBills,
  searchProductionBills,
  type ProductionBillQuery,
  type ProductionBillRow,
  type ProductionSortField,
} from '@/api/modules/production'

const route = useRoute()
const router = useRouter()

const docKey = computed(() => String(route.meta.docKey || route.params.docKey || ''))
const docConfig = computed(() => PRODUCTION_DOC_CONFIG_MAP[docKey.value])

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
    { prop: 'synced_at', label: '同步时间', width: 160, sortable: true, priority: 'low' },
  ] as Column[]
})

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
      const res = await searchProductionBills(docKey.value, kw, pagination.page, pagination.pageSize)
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
      const res = await listProductionBills(docKey.value, query)
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
  router.push(`/production/${docKey.value}/detail/${row.wms_bill_id}`)
}

// 切换单据类型（同组件复用）时重置并重新加载
watch(docKey, () => {
  keyword.value = ''
  dateRange.value = null
  pagination.page = 1
  pagination.total = 0
  loadData()
})

onMounted(loadData)
</script>

<style scoped>
.num-cell { font-variant-numeric: tabular-nums; }
.search-scope-note { margin-left: 10px; font-size: 12px; color: var(--text-tertiary); }
</style>
