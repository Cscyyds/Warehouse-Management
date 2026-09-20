<template>
  <ListTemplate
    ref="listTemplateRef"
    title="组合产品资料"
    layout-key="product-combined"
    show-tree
    tree-title="产品类别"
    tree-perm-endpoint="GET /api/v1/tenant-product-categories/list"
    :tree-data="categoryTree"
    tree-node-key="category_id"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @tree-node-click="handleCategoryClick"
    @tree-refresh="fetchCategoryTree"
    @page-change="loadData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="产品名称 / 编码 / 品号"
            clearable
            style="width:200px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>

    <template #actions>
      <el-button
        v-perm="'POST /api/v1/tenant-products/create'"
        type="primary"
        @click="handleAdd"
      >
        <el-icon><Plus /></el-icon>新增组合产品
      </el-button>
      <span class="combined-hint"></span>
    </template> 

    <template #table>
      <el-table
        border
        :data="tableData"
        stripe
        size="small"
        style="width:100%"
        row-class-name="table-row"
        v-loading="loading"
        @sort-change="handleSortChange"
      >
        <el-table-column
          type="index"
          :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1"
          label=""
          width="55"
          align="center"
        />
        <el-table-column prop="product_code" label="产品编码" min-width="160" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.product_code }">{{ row.product_code || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="product_name" label="产品名称" min-width="200" show-overflow-tooltip sortable="custom">
          <template #default="{ row }">
            <span
              v-perm="'GET /api/v1/tenant-products/components/preview'"
              class="cell-link"
              @click="goDetail(row)"
            >{{ row.product_name || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="category_name" label="产品类别" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.category_name }">{{ row.category_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="unit_name" label="计量单位" width="100" align="center">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.unit_name }">{{ row.unit_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="factory_price" label="出厂价" width="120" align="right" sortable="custom">
          <template #default="{ row }">{{ formatMoney(row.factory_price) }}</template>
        </el-table-column>
        <el-table-column prop="min_sale_price" label="最低销售金额" width="140" align="right" sortable="custom">
          <template #default="{ row }">{{ formatMoney(row.min_sale_price) }}</template>
        </el-table-column>
        <el-table-column prop="component_count" label="子产品数" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="Number(row.component_count) > 0 ? 'primary' : 'info'">
              {{ Number(row.component_count) || 0 }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="product_status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.product_status === 'ON_SALE' ? 'success' : 'info'" size="small">
              {{ productStatusLabel(row.product_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              v-perm="'POST /api/v1/tenant-products/components/create'"
              link
              type="primary"
              size="small"
              @click="goBind(row)"
            >绑定子产品</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { getProductCategoryTree, getCombinedProducts, searchCombinedProducts } from '@/api'
import type { CombinedProductListItem, ProductCategoryItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import { global_opt_width } from '@/utils/data'

defineOptions({ name: 'ProductCombined' })

const router = useRouter()
const listTemplateRef = ref<any>(null)

const tableData = ref<CombinedProductListItem[]>([])
const loading = ref(false)
const categoryTree = ref<any[]>([])
const searchForm = reactive({ keyword: '', category_id: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

let loadRequestSequence = 0
let categoryTreeRequest: Promise<void> | undefined
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

const PRODUCT_STATUS_LABEL: Record<string, string> = {
  ON_SALE: '在售',
  OFF_SALE: '停售',
  DISCONTINUED: '停产',
}

function productStatusLabel(status?: string | null): string {
  if (!status) return '-'
  return PRODUCT_STATUS_LABEL[status] || status
}

/** 金额展示：无效值回落 '-'，其余两位小数 */
function formatMoney(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (Number.isNaN(num)) return '-'
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function flattenTree(nodes: ProductCategoryItem[]): any[] {
  return nodes.map(n => ({
    category_id: n.category_id,
    name: n.name,
    children: n.children ? flattenTree(n.children) : undefined,
  }))
}

function fetchCategoryTree(): Promise<void> {
  if (categoryTreeRequest) return categoryTreeRequest
  const request = performFetchCategoryTree()
  categoryTreeRequest = request
  request.then(
    () => { if (categoryTreeRequest === request) categoryTreeRequest = undefined },
    () => { if (categoryTreeRequest === request) categoryTreeRequest = undefined },
  )
  return request
}

async function performFetchCategoryTree(): Promise<void> {
  try {
    // silent：无产品类别权限的账号该请求必 403，属预期边界；左树置空降级，
    // 右侧列表退化为不过滤类别的全量组合产品查询（见 performLoadData）
    const res = await getProductCategoryTree({ silent: true })
    categoryTree.value = flattenTree(res.data)
    // 刻意不默认选中第一个类别：
    // 1) components/list 的 category_id 是可选参数（不传即全租户组合产品），无需像产品资料页那样兜底；
    // 2) 若默认按某类别过滤，"新增组合产品后跳回本页"会因新产品的类别不在该过滤内而看不到，
    //    与「保存后这条产品出现在本页表格中」的预期直接冲突。
    // 需要按类别收窄时，用户点左树即可。
  } catch {
    categoryTree.value = []
  }
}

async function performLoadData(): Promise<number> {
  const requestSequence = ++loadRequestSequence
  loading.value = true
  try {
    const keyword = searchForm.keyword.trim()
    if (keyword) {
      // 搜索接口只接受 keyword + page（无类别过滤与排序）
      const res = await searchCombinedProducts({ keyword, page: pagination.page })
      if (requestSequence !== loadRequestSequence) return pagination.total
      tableData.value = res.data.products || []
      pagination.total = res.data.total ?? 0
    } else {
      const res = await getCombinedProducts({
        category_id: searchForm.category_id || undefined,
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      if (requestSequence !== loadRequestSequence) return pagination.total
      tableData.value = res.data.products || []
      pagination.total = res.data.total ?? 0
    }
    return pagination.total
  } catch {
    if (requestSequence !== loadRequestSequence) return pagination.total
    tableData.value = []
    pagination.total = 0
    return 0
  } finally {
    if (requestSequence === loadRequestSequence) loading.value = false
  }
}

function loadData(): Promise<number> {
  return performLoadData()
}

function handleSearch() {
  pagination.page = 1
  void loadData()
}

function handleReset() {
  searchForm.keyword = ''
  pagination.page = 1
  void loadData()
}

function handleCategoryClick(data: any) {
  searchForm.category_id = data?.category_id || ''
  searchForm.keyword = ''
  pagination.page = 1
  void loadData()
}

function goDetail(row: CombinedProductListItem) {
  router.push({ name: 'ProductCombinedDetail', params: { id: row.product_id } })
}

/** 操作列「绑定子产品」：进入独立的子产品绑定页（同 goDetail 目标页，页面内含绑定表与结构树） */
function goBind(row: CombinedProductListItem) {
  goDetail(row)
}

/**
 * 新增组合产品。
 *
 * 后端没有独立的"新增组合产品"接口——组合产品就是普通产品带 `is_combined=1`，
 * 走 `POST /tenant-products/create`。故此处复用「产品资料」新增表单，
 * 通过 presetData 通道预置 `is_combined=1`，并用 returnTo 让保存后回到本页
 * （而非产品资料的默认落点），便于接着进详情页绑定子产品。
 */
function handleAdd() {
  sessionStorage.setItem('presetData:productInfo', JSON.stringify({ is_combined: 1 }))
  router.push({
    path: '/common/add',
    query: { type: 'productInfo', returnTo: '/product/combined' },
  })
}

onMounted(async () => {
  await fetchCategoryTree()
  await loadData()
})

// keep-alive 激活时刷新表格，保证「新增组合产品 → 保存回跳本页」后能看到新数据。
// 首次挂载时 mounted 与 activated 会先后触发，故跳过第一次激活，避免重复请求。
let skipFirstActivate = true
onActivated(() => {
  if (skipFirstActivate) {
    skipFirstActivate = false
    return
  }
  void loadData()
})
</script>

<style scoped>
.combined-hint {
  font-size: 13px;
  color: var(--text-secondary);
}
.cell-link {
  color: var(--primary);
  cursor: pointer;
}
.cell-link:hover {
  text-decoration: underline;
}
.cell-empty {
  color: var(--text-tertiary);
}
</style>
