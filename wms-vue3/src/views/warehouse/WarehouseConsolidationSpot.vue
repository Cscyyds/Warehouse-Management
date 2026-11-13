<template>
  <ListTemplate
    ref="listTemplateRef"
    title="集散位管理"
    layout-key="consolidation-spot"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    show-tree
    tree-title="仓库集散位"
    tree-perm-endpoint="GET /api/v1/tenant-distribution-spots/query"
    :tree-data="sidebarTree"
    tree-node-key="id"
    tree-label-key="name"

    @page-change="loadData"
    @add="handleAdd"
    @tree-node-click="handleTreeNodeClick"
    @tree-refresh="loadTreeData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="集散位编号"><el-input v-model="searchForm.spot_no" placeholder="请输入" clearable style="width:150px" /></el-form-item>
        <el-form-item label="集散位名称"><el-input v-model="searchForm.spot_name" placeholder="请输入" clearable style="width:150px" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:110px">
            <el-option label="有效" :value="1" />
            <el-option label="无效" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button v-perm="'POST /api/v1/tenant-distribution-spots'" type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
      <el-button
        :disabled="loading || !selectedSpots.length"
        @click="handlePrintSpots(selectedSpots)"
      >
        <el-icon><Printer /></el-icon>{{ selectedSpots.length > 1 ? '批量打印' : '集散位打印' }}{{ selectedSpots.length ? `（${selectedSpots.length}）` : '' }}
      </el-button>
    </template>
    <template #table>
      <el-table ref="spotTableRef" border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @sort-change="handleSortChange" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="40" :selectable="isPrintableSpot" />
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="spot_no" label="集散位编号" min-width="110" sortable="custom">
          <template #default="{ row }">
            <span v-perm="'GET /api/v1/tenant-distribution-spots/detail'" class="cell-link" @click="handleDetail(row)">{{ row.spot_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="spot_name" label="集散位名称" min-width="110" show-overflow-tooltip />
        <el-table-column prop="simple_code" label="简码" min-width="80" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.simple_code }">{{ row.simple_code || '-' }}</span></template>
        </el-table-column>
        <el-table-column label="所属仓库" min-width="110" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !warehouseMap[row.warehouse_id] }">{{ warehouseMap[row.warehouse_id] || row.warehouse_id || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '有效' : '无效' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="product_count" label="在位产品数" width="100" align="right" />
        <el-table-column prop="total_stock_qty" label="库存合计" width="110" align="right">
          <template #default="{ row }">{{ formatQty(row.total_stock_qty) }}</template>
        </el-table-column>
        <el-table-column prop="package_count" label="在位合包数" width="100" align="right" />
        <el-table-column prop="remark" label="备注" min-width="100" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="280" fixed="right" align="center">
          <template #default="{ row }">
            <el-button v-if="isPrintableSpot(row)" v-perm="'POST /api/v1/tenant-wms/distribution-spots/print'" link type="success" size="small" @click="handlePrintSpots([row])">打印</el-button>
            <el-button v-perm="'POST /api/v1/tenant-distribution-spots/update'" link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button v-perm="'POST /api/v1/tenant-distribution-spots/delete'" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
  <PrintLabelDialog v-model="spotPrintOpen" kind="distributionSpot" :rows="spotPrintRows" />
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type TableInstance } from 'element-plus'
import { Plus, Printer } from '@element-plus/icons-vue'
import PrintLabelDialog from '@/components/PrintLabelDialog.vue'
import {
  getConsolidationSpotList,
  getConsolidationSpotAll,
  deleteConsolidationSpot,
  getWarehouseTreeAll,
  type ConsolidationSpotItem,
} from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'

const router = useRouter()
const tableData = ref<ConsolidationSpotItem[]>([])
const searchForm = reactive<{ spot_no: string; spot_name: string; status: number | '' }>({ spot_no: '', spot_name: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const loading = ref(false)
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

/** 左侧树：仓库（一级）→ 集散位（二级），不含货位层级 */
const sidebarTree = ref<any[]>([])
/** warehouse_id → 仓库名称映射（树与表格共享） */
const warehouseMap = reactive<Record<string, string>>({})
/** 树选中的仓库过滤（点集散位节点跳详情、不作为过滤条件） */
const treeWarehouseFilter = ref('')

/* —— 集散位条码打印（单个直打 / 多个入打印任务队列，与库位管理同构） —— */
const spotTableRef = ref<TableInstance>()
const selectedSpots = ref<ConsolidationSpotItem[]>([])
const spotPrintOpen = ref(false)
const spotPrintRows = ref<Array<{ id: string; title: string; subtitle?: string }>>([])

/** 可打印行：停用（status=0）集散位后端补打校验会 400，勾选框与行内按钮一并屏蔽 */
function isPrintableSpot(row: ConsolidationSpotItem): boolean {
  return row.status === 1 && !!row.distribution_spot_id
}

function handleSelectionChange(rows: ConsolidationSpotItem[]) {
  selectedSpots.value = rows.filter(isPrintableSpot)
}

function handlePrintSpots(rows: ConsolidationSpotItem[]) {
  const spots = rows.filter(isPrintableSpot)
  if (!spots.length) return
  if (spots.length > 100) {
    ElMessage.warning('单次最多提交 100 个集散位，请减少勾选数量后重试')
    return
  }
  spotPrintRows.value = spots.map((row) => ({
    id: row.distribution_spot_id,
    title: row.spot_name || row.spot_no || '',
    subtitle: row.spot_no || row.simple_code || '',
  }))
  spotPrintOpen.value = true
}

function formatQty(v: unknown): string {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'
}

/** 构建侧边栏树：全部 → 仓库 → 集散位（两级，集散位挂在直属仓库下） */
function buildSidebarTree(warehouses: any[], spots: ConsolidationSpotItem[]): any[] {
  const whNodes = warehouses.map(wh => {
    const whId = String(wh.warehouse_id || '')
    const children = spots
      .filter(sp => String(sp.warehouse_id || '') === whId)
      .map(sp => ({
        id: sp.distribution_spot_id,
        name: sp.spot_no,
        node_type: 'spot',
        status: sp.status,
      }))
    return {
      id: whId,
      name: String(wh.warehouse_name || ''),
      node_type: 'warehouse',
      children,
    }
  })
  return [{ id: '__all__', name: '全部', node_type: 'all', children: whNodes }]
}

/** 加载树数据：仓库层（只取仓库节点，不展开货位子树）+ 集散位层全量按 warehouse_id 挂载 */
async function loadTreeData() {
  try {
    const [whRes, spotRes] = await Promise.all([
      getWarehouseTreeAll(),
      getConsolidationSpotAll({ sort_by: 'spot_no', sort_order: 'ASC' }).catch(() => null),
    ])
    const warehouses = ((whRes.data.warehouse as any[]) || []).map((wh: any) => ({
      warehouse_id: wh.warehouse_id,
      warehouse_name: wh.warehouse_name || wh.name,
    }))
    warehouses.forEach(wh => { warehouseMap[String(wh.warehouse_id)] = String(wh.warehouse_name) })
    const spots = spotRes?.data?.items || []
    sidebarTree.value = buildSidebarTree(warehouses, spots)
  } catch {
    sidebarTree.value = buildSidebarTree([], [])
  }
}

/** 树节点点击：仓库 → 表格按仓库过滤；集散位 → 跳转详情页 */
function handleTreeNodeClick(data: any) {
  if (data.node_type === 'warehouse') {
    treeWarehouseFilter.value = String(data.id || '')
    handleSearch()
  } else if (data.node_type === 'spot') {
    router.push({ path: '/warehouse/consolidation-spot/detail', query: { id: String(data.id || '') } })
  } else {
    treeWarehouseFilter.value = ''
    handleSearch()
  }
}

/** 是否有搜索条件（编号/名称/状态） */
function hasSearchFilters(): boolean {
  return !!(searchForm.spot_no || searchForm.spot_name || searchForm.status !== '')
}

async function loadData() {
  loading.value = true
  spotTableRef.value?.clearSelection()
  selectedSpots.value = []
  try {
    const res = await getConsolidationSpotList({
      page: pagination.page,
      page_size: pagination.pageSize,
      sort_by: sortBy.value || undefined,
      sort_order: sortOrder.value || undefined,
      spot_no: searchForm.spot_no || undefined,
      spot_name: searchForm.spot_name || undefined,
      status: searchForm.status === '' ? undefined : Number(searchForm.status),
      warehouse_id: treeWarehouseFilter.value || undefined,
    })
    tableData.value = res.data.items
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { spot_no: '', spot_name: '', status: '' })
  treeWarehouseFilter.value = ''
  handleSearch()
}

function handleAdd() {
  // 左树选中了仓库时预填归属仓库（走 AddTemplate presetData 通道）
  if (treeWarehouseFilter.value) {
    sessionStorage.setItem('presetData:consolidationSpot', JSON.stringify({ warehouse_id: treeWarehouseFilter.value }))
  }
  router.push({ path: '/common/add', query: { type: 'consolidationSpot' } })
}

function handleEdit(row: ConsolidationSpotItem) {
  // 不存 sessionStorage 缓存，让 AddTemplate 走 loadDetail 路径获取完整字段
  router.push({ path: '/common/add', query: { type: 'consolidationSpot', id: row.distribution_spot_id, mode: 'edit' } })
}

function handleDetail(row: ConsolidationSpotItem) {
  router.push({ path: '/warehouse/consolidation-spot/detail', query: { id: row.distribution_spot_id } })
}

async function handleDelete(row: ConsolidationSpotItem) {
  try {
    await ElMessageBox.confirm(`确认删除集散位「${row.spot_no}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteConsolidationSpot(row.distribution_spot_id)
    ElMessage.success('删除成功')
    loadData()
    loadTreeData()
  } catch {}
}

onMounted(() => { loadTreeData(); loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
