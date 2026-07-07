<template>
  <ListTemplate :title="pageTitle" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
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
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" v-loading="loading" @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="product_code" label="产品编号" min-width="100" column-key="created_at" sortable="custom" />
        <el-table-column prop="product_name" label="产品名称" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.product_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="category_name" label="产品类别" min-width="90" />
        <el-table-column prop="specification" label="规格" min-width="80" show-overflow-tooltip />
        <el-table-column prop="unit_name" label="单位" width="60" />
        <el-table-column prop="last_sale_date" label="最后销售时间" width="170" column-key="last_sale_date" sortable="custom">
          <template #default="{ row }">{{ row.last_sale_date ? formatTableDate(row.last_sale_date) : '从未销售' }}</template>
        </el-table-column>
        <el-table-column prop="available_stock" label="可用库存" width="100" align="right" column-key="available_stock" sortable="custom" />
        <el-table-column prop="amount" label="金额" width="100" align="right" column-key="amount" sortable="custom" />
        <el-table-column prop="suppliers" label="供应商" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.suppliers?.map((s: { supplier_name: string }) => s.supplier_name).join('、') || '-' }}
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
import { formatTableDate } from '@/utils/date'

const router = useRouter()
const tableData = ref<SlowMovingItem[]>([])
const loading = ref(false)
const thresholdMonths = ref<number | null>(null)
const searchForm = reactive({ keyword: '', search_field: 'product_name' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const sortField = ref('')
const sortOrder = ref('')

const pageTitle = computed(() =>
  thresholdMonths.value != null
    ? `滞销产品表（认定标准：${thresholdMonths.value}个月未销售）`
    : '滞销产品表'
)

function handleSortChange({ prop, order, column }: { prop: string | null; order: string | null; column?: { columnKey?: string | null } }) {
  if (order) {
    sortField.value = column?.columnKey || prop || ''
    sortOrder.value = order === 'ascending' ? 'ASC' : 'DESC'
  } else {
    sortField.value = ''
    sortOrder.value = ''
  }
  loadData()
}

async function loadData() {
  loading.value = true
  try {
    const baseParams = {
      page: pagination.page,
      sort_field: sortField.value || undefined,
      sort_order: sortOrder.value || undefined,
    }
    const res = searchForm.keyword.trim()
      ? await searchSlowMovingProducts({ keyword: searchForm.keyword.trim(), search_field: searchForm.search_field, ...baseParams })
      : await getSlowMovingProducts(baseParams)
    tableData.value = res.data.items || []
    pagination.total = res.data.total ?? 0
    thresholdMonths.value = res.data.threshold_months ?? null
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { keyword: '', search_field: 'product_name' }); handleSearch() }
function handleEdit(row: SlowMovingItem) {
  router.push({ path: '/common/add', query: { type: 'productInfo', id: row.product_id, mode: 'edit' } })
}
onMounted(() => { loadData() })
</script>
