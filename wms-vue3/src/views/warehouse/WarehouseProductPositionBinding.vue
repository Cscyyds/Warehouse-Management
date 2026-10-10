<template>
  <ListTemplate
    title="位置管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    :show-add="false"
    @page-change="loadData"
  >
    <template #search>
      <!-- 四维模糊组合搜索（AND 交集，至少一项；全空回落 list 浏览，规避后端全空 400） -->
      <el-form
        v-perm="'GET /api/v1/tenant-wms/product-position-bindings/search'"
        :model="searchForm"
        inline
        size="default"
      >
        <el-form-item label="塑料盒"><el-input v-model="searchForm.box_keyword" placeholder="编码/名称" clearable style="width:150px" @keyup.enter="handleSearch" @clear="handleSearch" /></el-form-item>
        <el-form-item label="产品"><el-input v-model="searchForm.product_keyword" placeholder="品号/编码/名称" clearable style="width:150px" @keyup.enter="handleSearch" @clear="handleSearch" /></el-form-item>
        <el-form-item label="货位"><el-input v-model="searchForm.location_keyword" placeholder="编号/名称" clearable style="width:150px" @keyup.enter="handleSearch" @clear="handleSearch" /></el-form-item>
        <el-form-item label="仓库"><el-input v-model="searchForm.warehouse_keyword" placeholder="编号/名称（含子树货位）" clearable style="width:170px" @keyup.enter="handleSearch" @clear="handleSearch" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <!-- 批量加入打印任务：按位置编码提交到「打印任务」队列（来源=补打）统一出纸。
           接口级由 scanner 侧权限把关，同库位/合包打印按钮策略，不挂 v-perm -->
      <el-button :disabled="loading || !selectedRows.length" @click="handleBatchPrint">
        <el-icon><Printer /></el-icon>位置打印{{ selectedRows.length ? `（${selectedRows.length}）` : '' }}
      </el-button>
    </template>
    <template #table>
      <el-table border :data="tableData" stripe size="small" style="width:100%" @sort-change="handleSortChange" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="40" align="center" />
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="warehouse_no" label="仓库" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="cell-two-line">
              <span>{{ row.warehouse_name || '-' }}</span>
              <span class="cell-sub">{{ row.warehouse_no || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="location_no" label="货位编号" min-width="110" sortable="custom" show-overflow-tooltip />
        <el-table-column prop="location_name" label="货位名称" min-width="110" show-overflow-tooltip>
          <template #default="{ row }"><span>{{ row.location_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="floor_no" label="层" width="70" align="center" sortable="custom" />
        <el-table-column prop="position_no" label="位" width="70" align="center" sortable="custom" />
        <el-table-column prop="position_code" label="位置编码" min-width="120" sortable="custom" show-overflow-tooltip />
        <el-table-column prop="item_no" label="品号" min-width="120" sortable="custom" show-overflow-tooltip />
        <el-table-column prop="product_code" label="产品编码" min-width="120" sortable="custom" show-overflow-tooltip />
        <el-table-column prop="product_name" label="产品名称" min-width="150" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }"><span>{{ row.product_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="has_plastic_box" label="塑料盒" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.has_plastic_box ? 'success' : 'info'" size="small">{{ row.has_plastic_box ? '有' : '无' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="box_code" label="盒编码" min-width="120" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.box_code }">{{ row.box_code || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="box_name" label="盒名称" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.box_name }">{{ row.box_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="created_at" label="绑定时间" width="160" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
  <!-- kind=position：勾选多条入打印任务队列；单条走本页直打（弹窗原生双模式） -->
  <PrintLabelDialog v-model="printOpen" kind="position" :rows="printRows" />
</template>

<script setup lang="ts">
/**
 * 位置管理（原「绑定关系台账」，只读）：产品-货位-塑料盒绑定关系浏览与组合搜索（2026-09-29 批次）。
 * 仅返回"有产品绑定"的格子，不含库存数量与产品规格；盒子软删时按"无盒"展示。
 * list = 浏览（无条件）；search = 四维模糊 AND（至少一项，全空后端 400 —— 前端以
 * hasSearchFilters() 分流，全空自然走 list，不会触发）。排序白名单外字段不传避免 400。
 * 打印：勾选位置（按位置编码）批量提交打印任务（PRODUCT_POSITION / 补打），
 *       到「打印任务」页统一出纸；链路复用 PrintLabelDialog。
 */
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Printer } from '@element-plus/icons-vue'
import ListTemplate from '@/views/common/ListTemplate.vue'
import PrintLabelDialog from '@/components/PrintLabelDialog.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'
import {
  BINDING_SORT_FIELDS,
  getProductPositionBindings,
  searchProductPositionBindings,
  type ProductPositionBindingItem,
} from '@/api'

const tableData = ref<ProductPositionBindingItem[]>([])
const searchForm = reactive({ box_keyword: '', product_keyword: '', location_keyword: '', warehouse_keyword: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const loading = ref(false)
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const BINDING_SORT_SET = new Set<string>(BINDING_SORT_FIELDS)

function hasSearchFilters(): boolean {
  return !!(searchForm.box_keyword.trim() || searchForm.product_keyword.trim()
    || searchForm.location_keyword.trim() || searchForm.warehouse_keyword.trim())
}

async function loadData() {
  loading.value = true
  try {
    const base = {
      page: pagination.page,
      page_size: pagination.pageSize,
      // 后端排序白名单外的字段直接 400，故过滤后再传
      sort_by: BINDING_SORT_SET.has(sortBy.value) ? sortBy.value : undefined,
      sort_order: sortBy.value ? (sortOrder.value || undefined) : undefined,
    }
    const res = hasSearchFilters()
      ? await searchProductPositionBindings({
          ...base,
          box_keyword: searchForm.box_keyword.trim() || undefined,
          product_keyword: searchForm.product_keyword.trim() || undefined,
          location_keyword: searchForm.location_keyword.trim() || undefined,
          warehouse_keyword: searchForm.warehouse_keyword.trim() || undefined,
        })
      : await getProductPositionBindings(base)
    tableData.value = res.data.list
    pagination.total = res.data.total
    if (res.data.page_size) pagination.pageSize = res.data.page_size
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { box_keyword: '', product_keyword: '', location_keyword: '', warehouse_keyword: '' })
  handleSearch()
}

/* —— 批量加入打印任务（按位置编码）：与后端 _MAX_ITEMS_PER_BATCH=100 对齐 —— */
const selectedRows = ref<ProductPositionBindingItem[]>([])
const printOpen = ref(false)
const printRows = ref<Array<{ id: string; title: string; subtitle?: string }>>([])

function handleSelectionChange(rows: ProductPositionBindingItem[]) {
  selectedRows.value = rows
}

function handleBatchPrint() {
  if (!selectedRows.value.length) return
  if (selectedRows.value.length > 100) {
    ElMessage.warning('单次最多提交 100 个位置，请减少勾选数量后重试')
    return
  }
  printRows.value = selectedRows.value.map((row) => ({
    id: row.position_id,
    title: row.position_code,
    subtitle: [row.location_no, row.product_name || row.item_no].filter(Boolean).join(' · '),
  }))
  printOpen.value = true
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-two-line { display: flex; flex-direction: column; line-height: 1.3; }
.cell-sub { font-size: 11px; color: var(--text-tertiary); }
.cell-empty { color: var(--text-tertiary); }
</style>
