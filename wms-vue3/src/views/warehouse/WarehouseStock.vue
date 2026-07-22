<template>
  <ListTemplate
    title="产品库存"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    :show-add="false"
    @page-change="loadData"
    @sort-change="handleSortChange"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="编码/名称/规格/颜色/类别/货位/条码"
            clearable
            style="width:280px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
        <el-form-item v-if="searchForm.keyword">
          <span class="search-tip">已按关键词「{{ searchForm.keyword }}」跨产品/条码/位置模糊搜索</span>
        </el-form-item>
      </el-form>
    </template>
    <template #table>
      <el-table
        :data="tableData"
        stripe
        size="small"
        style="width:100%"
        class="warehouse-text-table"
        row-class-name="table-row"
        show-summary
        :summary-method="getSummaries"
        :default-sort="{ prop: 'stock_amount', order: 'descending' }"
        @sort-change="handleSortChange"
      >
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="product_code" label="产品编码" min-width="100" show-overflow-tooltip sortable="custom" column-key="product_code" />
        <el-table-column prop="product_name" label="产品名称" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link class="cell-link" type="primary" @click="openDetail(row)">
              <span class="cell-text" :class="{ 'cell-empty': !row.product_name }">{{ row.product_name || '-' }}</span>
            </el-link>
          </template>
        </el-table-column>
        <el-table-column prop="category_name" label="产品类别" min-width="140" show-overflow-tooltip />
        <el-table-column prop="specification" label="规格" min-width="120" show-overflow-tooltip />
        <el-table-column prop="color" label="颜色" width="80" show-overflow-tooltip />
        <el-table-column prop="unit_name" label="单位" width="70" align="center" show-overflow-tooltip />
        <el-table-column prop="avg_cost_price" label="平均成本" width="100" align="right" show-overflow-tooltip>
          <template #default="{ row }">{{ formatAmount(row.avg_cost_price) }}</template>
        </el-table-column>
        <el-table-column prop="stock_warning_qty" label="预警量" width="90" align="right" show-overflow-tooltip>
          <template #default="{ row }">{{ formatAmount(row.stock_warning_qty) }}</template>
        </el-table-column>
        <el-table-column prop="available_stock" label="可用库存" width="100" align="right" sortable="custom" column-key="available_stock">
          <template #default="{ row }">
            <span :class="{ 'cell-warning': isBelowWarning(row) }">{{ formatAmount(row.available_stock) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="warehouse_stock" label="仓库库存" width="100" align="right" sortable="custom" column-key="warehouse_stock">
          <template #default="{ row }">{{ formatAmount(row.warehouse_stock) }}</template>
        </el-table-column>
        <el-table-column prop="stock_amount" label="库存金额" width="120" align="right" sortable="custom" column-key="stock_amount">
          <template #default="{ row }">{{ formatAmount(row.stock_amount) }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">库存明细</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  getProductInventoryList,
  searchProductInventory,
  type ProductInventoryItem,
} from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import { createAmountSummary } from '@/composables/useTableSummary'
import { global_opt_width } from '@/utils/data'

const tableData = ref<ProductInventoryItem[]>([])
const getSummaries = createAmountSummary(['stock_amount'])
const searchForm = reactive({ keyword: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const loading = ref(false)

const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
// 后端默认按库存金额降序，前端同步初始排序态
sortBy.value = 'stock_amount'
sortOrder.value = 'DESC'

/** 是否处于关键词搜索模式 */
function isSearchMode(): boolean {
  return !!searchForm.keyword.trim()
}

async function loadData() {
  loading.value = true
  try {
    if (isSearchMode()) {
      // 接口36：产品库存搜索（单关键词跨产品/条码/位置模糊匹配）
      const res = await searchProductInventory({
        keyword: searchForm.keyword.trim(),
        page: pagination.page,
        page_size: pagination.pageSize,
      })
      tableData.value = res.data.products
      pagination.total = res.data.total
    } else {
      // 接口34：产品库存列表
      const res = await getProductInventoryList({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.list
      pagination.total = res.data.total
    }
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { searchForm.keyword = ''; pagination.page = 1; loadData() }

/** 金额/数量格式化：保留2位小数，千分位 */
function formatAmount(value: unknown): string {
  const num = Number(value)
  if (!value && value !== 0) return '-'
  if (Number.isNaN(num)) return '-'
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 可用库存低于预警量 → 高亮 */
function isBelowWarning(row: ProductInventoryItem): boolean {
  const avail = Number(row.available_stock)
  const warn = Number(row.stock_warning_qty)
  if (Number.isNaN(avail) || Number.isNaN(warn) || warn <= 0) return false
  return avail < warn
}

// ── 库存明细：跳转独立页面（接口35） ──
const router = useRouter()
function openDetail(row: ProductInventoryItem) {
  router.push({
    name: 'WarehouseStockDetail',
    query: { productId: row.product_id, code: row.product_code, name: row.product_name },
  })
}

onMounted(() => { loadData() })
</script>

<style scoped>
.warehouse-text-table :deep(.el-table__cell .cell) {
  min-width: 0;
}

.cell-link {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;
}

.cell-link :deep(.el-link__inner) {
  display: inline-block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.cell-empty {
  color: var(--text-tertiary);
}

.cell-warning { color: var(--el-color-warning); font-weight: 600; }

.search-tip {
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 明细弹窗统计卡 */
.detail-stats {
  display: flex;
  gap: 12px;
}

.stat-card {
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  background: var(--bg-page);
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}
</style>
