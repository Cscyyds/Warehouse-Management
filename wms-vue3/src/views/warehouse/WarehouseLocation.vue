<template>
  <ListTemplate
    ref="listTemplateRef"
    title="库位管理"
    layout-key="warehouse-location"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    show-tree
    tree-title="仓库货位"
    tree-perm-endpoint="GET /api/v1/tenant-warehouses/query"
    :tree-data="sidebarTree"
    tree-node-key="id"
    tree-label-key="name"

    @page-change="loadData"
    @add="handleAdd"
    @tree-node-click="handleTreeNodeClick"
    @tree-refresh="loadTreeData"
  >
    <template #search>
      <div class="location-filter-panel">
        <el-radio-group v-model="searchMode" class="filter-mode-tabs" @change="handleSearchModeChange">
          <el-radio-button label="warehouse">仓库搜索</el-radio-button>
          <el-radio-button label="location">货位搜索</el-radio-button>
        </el-radio-group>

        <el-form v-if="searchMode === 'warehouse'" :model="searchForm" inline size="default" class="filter-form">
          <el-form-item label="仓库名称"><el-input v-model="searchForm.warehouse_name" placeholder="请输入" clearable style="width:160px" /></el-form-item>
          <el-form-item label="仓库编号"><el-input v-model="searchForm.warehouse_no" placeholder="请输入" clearable style="width:160px" /></el-form-item>
          <el-form-item label="仓库区域">
            <el-select v-model="searchForm.warehouse_region" placeholder="请选择" clearable style="width:130px">
              <el-option label="东北" value="东北" />
              <el-option label="华东" value="华东" />
              <el-option label="华中" value="华中" />
              <el-option label="华南" value="华南" />
              <el-option label="西南" value="西南" />
              <el-option label="西北" value="西北" />
            </el-select>
          </el-form-item>
          <el-form-item label="仓库类型">
            <el-select v-model="searchForm.warehouse_type" placeholder="请选择" clearable style="width:130px">
              <el-option label="自营仓库" value="自营仓库" />
              <el-option label="合作仓库" value="合作仓库" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:110px">
              <el-option label="启用" :value="1" />
              <el-option label="停用" :value="0" />
            </el-select>
          </el-form-item>
          <el-form-item class="filter-actions">
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>

        <el-form v-else :model="searchForm" inline size="default" class="filter-form">
          <el-form-item label="货位名称"><el-input v-model="searchForm.location_name" placeholder="请输入" clearable style="width:160px" /></el-form-item>
          <el-form-item label="货位编号"><el-input v-model="searchForm.location_no" placeholder="请输入" clearable style="width:160px" /></el-form-item>
          <el-form-item label="简码"><el-input v-model="searchForm.simple_code" placeholder="请输入" clearable style="width:140px" /></el-form-item>
          <el-form-item label="货位类型">
            <el-select v-model="searchForm.location_type" placeholder="请选择" clearable style="width:130px">
              <el-option label="货架" value="货架" />
              <el-option label="托盘" value="托盘" />
            </el-select>
          </el-form-item>
          <el-form-item label="库位状态">
            <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:110px">
              <el-option label="启用" :value="1" />
              <el-option label="停用" :value="0" />
            </el-select>
          </el-form-item>
          <el-form-item class="filter-actions">
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </template>
    <template #actions>
      <el-button v-perm="'POST /api/v1/tenant-warehouses'" type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增仓库</el-button>
      <el-button
        :disabled="loading || !selectedLocations.length"
        @click="handlePrintLocations(selectedLocations)"
      >
        <el-icon><Printer /></el-icon>{{ selectedLocations.length > 1 ? '批量打印' : '库位打印' }}{{ selectedLocations.length ? `（${selectedLocations.length}）` : '' }}
      </el-button>
    </template>
    <template #table>
      <el-table ref="locationTableRef" border v-loading="loading" :data="treeTableData" stripe size="small" style="width:100%" row-key="row_key" :tree-props="{ children: 'children', checkStrictly: true }" default-expand-all row-class-name="table-row" @selection-change="handleLocationSelectionChange">
        <el-table-column type="selection" width="40" :selectable="isPrintableLocation" />
        <el-table-column prop="node_name" label="仓库名称/货位名称" min-width="220">
          <template #default="{ row }">
            <span class="cell-link" @click="handleEdit(row)">{{ row.node_name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="库位状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="340" fixed="right" align="center">
          <template #default="{ row }">
            <el-button v-if="row.node_type !== 'warehouse'" v-perm="'POST /api/v1/tenant-wms/locations/print'" link type="success" size="small" @click="handlePrintLocations([row])">打印</el-button>
            <el-button v-perm="'POST /api/v1/tenant-locations'" link type="success" size="small" @click="handleAddChild(row)">新增下级库位</el-button>
            <el-button v-perm="row.node_type === 'warehouse' ? 'POST /api/v1/tenant-warehouses/update' : 'POST /api/v1/tenant-locations/update'" link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button v-perm="row.node_type === 'warehouse' ? 'POST /api/v1/tenant-warehouses/delete' : 'POST /api/v1/tenant-locations/delete'" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="emptyDescription" />
        </template>
      </el-table>
    </template>
  </ListTemplate>
  <PrintLabelDialog v-model="locationPrintOpen" kind="location" :rows="locationPrintRows" />
</template>

<script setup lang="ts">
import { global_opt_width } from '@/utils/data'
import { ref, reactive, onMounted, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type TableInstance } from 'element-plus'
import { Plus, Printer } from '@element-plus/icons-vue'
import PrintLabelDialog from '@/components/PrintLabelDialog.vue'
import { getWarehouseTree, searchWarehouses, searchLocations, getWmsAssociation, deleteWarehouse, deleteLocation, previewWarehouseDelete, previewLocationDelete } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const searchForm = reactive({
  warehouse_name: '',
  warehouse_no: '',
  warehouse_region: '',
  warehouse_type: '',
  location_name: '',
  location_no: '',
  simple_code: '',
  location_type: '',
  status: '' as string | number,
})
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const loading = ref(false)
const searchMode = ref<'warehouse' | 'location'>('warehouse')
const listTemplateRef = ref<InstanceType<typeof ListTemplate> | null>(null)

/** 侧边栏树数据 */
const sidebarTree = ref<any[]>([])
/** 侧边树导航需要完整仓库层级，一次性取足够大的仓库数（不带详情，请求体很轻） */
const SIDEBAR_TREE_PAGE_SIZE = 200
/** 当前选中的节点ID */
const selectedNodeId = ref<string | null>(null)
const selectedNodeType = ref<'all' | 'warehouse' | 'location' | null>(null)

/** 树形表格数据：完整嵌套树 */
const treeTableData = ref<any[]>([])
const emptyDescription = computed(() => searchMode.value === 'location' && hasLocationSearchFilters() ? '暂无匹配货位数据' : '暂无仓库数据')

/* —— 货位条码打印 —— */
const locationTableRef = ref<TableInstance>()
const selectedLocations = ref<any[]>([])
const locationPrintOpen = ref(false)
const locationPrintRows = ref<Array<{ id: string; title: string; subtitle?: string }>>([])

function isPrintableLocation(row: any): boolean {
  return row.node_type === 'location' && !!(row.location_id || row.id)
}

function handleLocationSelectionChange(rows: any[]) {
  selectedLocations.value = rows.filter(isPrintableLocation)
}

function handlePrintLocations(rows: any[]) {
  const locations = rows.filter(isPrintableLocation)
  if (!locations.length) return
  if (locations.length > 100) {
    ElMessage.warning('单次最多提交 100 个库位，请减少勾选数量后重试')
    return
  }
  locationPrintRows.value = locations.map((row) => ({
    id: row.location_id || row.id,
    title: row.node_name || row.location_name || '',
    subtitle: row.location_no || row.simple_code || '',
  }))
  locationPrintOpen.value = true
}

/**
 * 将树接口返回的节点统一转换为表格行。
 *
 * 后端 with_detail=true 时节点已内联完整详情字段（含 warehouse_id / location_id / status
 * 及各枚举中文标签），因此这里只需补 row_key / node_type / node_name，
 * 无需再对每个节点调用 detail 接口补拉——那是页面进入时请求量爆炸的根因。
 */
function toTreeRow(node: any): any {
  const isWarehouse = !node.location_id && !!node.warehouse_id
  const nodeId = String(isWarehouse ? node.warehouse_id : (node.location_id || node.id || ''))
  return {
    ...node,
    row_key: `${isWarehouse ? 'wh' : 'loc'}_${nodeId}`,
    node_type: isWarehouse ? 'warehouse' : 'location',
    node_name: isWarehouse
      ? String(node.warehouse_name || node.name || '')
      : String(node.location_name || node.name || ''),
    status: node.status ?? 0,
    children: Array.isArray(node.children) ? node.children.map(toTreeRow) : [],
  }
}

/** 把树接口返回的节点数组整体转换为表格树行 */
function buildTreeRows(nodes: any[]): any[] {
  return Array.isArray(nodes) ? nodes.map(toTreeRow) : []
}

/** 把树接口结果转换为侧边栏树（仅保留 id/name/层级，不携带详情字段） */
function buildSidebarTree(nodes: any[]): any[] {
  const normalize = (list: any[]): any[] => list.map(n => ({
    id: n.warehouse_id || n.location_id || n.id,
    name: n.warehouse_name || n.location_name || n.name,
    node_type: n.warehouse_id ? 'warehouse' : 'location',
    children: Array.isArray(n.children) && n.children.length ? normalize(n.children) : [],
  }))
  return [{ id: '__all__', name: '全部', node_type: 'all', children: normalize(nodes) }]
}

/** 加载侧边栏树数据（不带详情，保持轻量） */
async function loadTreeData() {
  try {
    const res = await getWarehouseTree({ page: 1, page_size: SIDEBAR_TREE_PAGE_SIZE })
    sidebarTree.value = buildSidebarTree((res.data.warehouse as any[]) || [])
  } catch {
    sidebarTree.value = buildSidebarTree([])
  }
}

function clearWarehouseSearchFields() {
  searchForm.warehouse_name = ''
  searchForm.warehouse_no = ''
  searchForm.warehouse_region = ''
  searchForm.warehouse_type = ''
}

function clearLocationSearchFields() {
  searchForm.location_name = ''
  searchForm.location_no = ''
  searchForm.simple_code = ''
  searchForm.location_type = ''
}

/** 是否有仓库搜索条件 */
function hasWarehouseSearchFilters(): boolean {
  return searchMode.value === 'warehouse'
    && !!(searchForm.warehouse_name || searchForm.warehouse_no || searchForm.warehouse_region || searchForm.warehouse_type || searchForm.status !== '')
}

function hasLocationSearchFilters(): boolean {
  return searchMode.value === 'location'
    && !!(searchForm.location_name || searchForm.location_no || searchForm.simple_code || searchForm.location_type || searchForm.status !== '')
}

function findNodePath(nodes: any[], targetId: string, trail: string[] = []): string[] | null {
  for (const node of nodes) {
    const nextTrail = [...trail, String(node.id)]
    if (String(node.id) === targetId) return nextTrail
    const found = Array.isArray(node.children) ? findNodePath(node.children, targetId, nextTrail) : null
    if (found) return found
  }
  return null
}

async function focusTreeNode(locationId: string | null) {
  if (!locationId) return
  const path = findNodePath(sidebarTree.value, locationId)
  if (!path) return
  await nextTick()
  listTemplateRef.value?.expandTreeToKey?.(locationId)
  listTemplateRef.value?.setTreeCurrentKey?.(locationId)
}

async function loadData() {
  loading.value = true
  locationTableRef.value?.clearSelection()
  selectedLocations.value = []
  try {
    if (hasLocationSearchFilters()) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.location_name) { searchField.push('location_name'); searchValue.location_name = searchForm.location_name }
      if (searchForm.location_no) { searchField.push('location_no'); searchValue.location_no = searchForm.location_no }
      if (searchForm.simple_code) { searchField.push('simple_code'); searchValue.simple_code = searchForm.simple_code }
      if (searchForm.location_type) { searchField.push('location_type_label'); searchValue.location_type_label = searchForm.location_type }
      if (searchForm.status !== '') { searchField.push('status'); searchValue.status = Number(searchForm.status) }
      const res = await searchLocations({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        page_size: pagination.pageSize,
        with_detail: true,
      })
      const nodes = (res.data.location as any[]) || []
      treeTableData.value = buildTreeRows(nodes)
      pagination.total = res.data.total
      await focusTreeNode(nodes[0]?.id || null)
      return
    }
    if (hasWarehouseSearchFilters()) {
      // 有搜索条件 → 调用 search 接口（节点自带详情，无需逐条补拉）
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.warehouse_name) { searchField.push('warehouse_name'); searchValue.warehouse_name = searchForm.warehouse_name }
      if (searchForm.warehouse_no) { searchField.push('warehouse_no'); searchValue.warehouse_no = searchForm.warehouse_no }
      if (searchForm.warehouse_region) { searchField.push('warehouse_region_label'); searchValue.warehouse_region_label = searchForm.warehouse_region }
      if (searchForm.warehouse_type) { searchField.push('warehouse_type_label'); searchValue.warehouse_type_label = searchForm.warehouse_type }
      if (searchForm.status !== '') { searchField.push('status'); searchValue.status = Number(searchForm.status) }
      const res = await searchWarehouses({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        page_size: pagination.pageSize,
        with_detail: true,
      })
      pagination.total = res.data.total
      treeTableData.value = buildTreeRows((res.data.warehouse as any[]) || [])
      return
    }
    if (selectedNodeId.value && selectedNodeId.value !== '__all__') {
      // 选中某个仓库或货位 → 只查该节点及其下级（根节点与全部子节点均自带详情）
      const res = await getWmsAssociation({ target_id: selectedNodeId.value, with_detail: true })
      const target = (res.data as any)?.target
      treeTableData.value = target ? buildTreeRows([target]) : []
      pagination.total = treeTableData.value.length
      return
    }
    // 无搜索条件 → 按仓库分页查询（避免一次性拉取全部仓库的全部货位）
    const res = await getWarehouseTree({ page: pagination.page, page_size: pagination.pageSize, with_detail: true })
    pagination.total = res.data.total
    treeTableData.value = buildTreeRows((res.data.warehouse as any[]) || [])
  } catch {
    treeTableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearchModeChange(mode: 'warehouse' | 'location') {
  if (mode === 'warehouse') {
    clearLocationSearchFields()
  } else {
    clearWarehouseSearchFields()
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, {
    warehouse_name: '',
    warehouse_no: '',
    warehouse_region: '',
    warehouse_type: '',
    location_name: '',
    location_no: '',
    simple_code: '',
    location_type: '',
    status: '',
  })
  handleSearch()
}

/** 新增仓库 */
function handleAdd() { router.push({ path: '/common/add', query: { type: 'warehouseLocation' } }) }

/** 新增下级库位（仓库或货位均可作为父级） */
function handleAddChild(row: any) {
  const parentId = row.node_type === 'warehouse' ? row.warehouse_id : row.location_id
  sessionStorage.setItem('presetData:warehouseLocationChild', JSON.stringify({ parent_id: parentId }))
  router.push({ path: '/common/add', query: { type: 'warehouseLocationChild' } })
}

/** 侧边栏树节点点击 */
function handleTreeNodeClick(data: any) {
  if (data.node_type === 'all') {
    selectedNodeId.value = null
    selectedNodeType.value = 'all'
  } else if (data.node_type === 'warehouse') {
    selectedNodeId.value = data.id
    selectedNodeType.value = 'warehouse'
  } else if (data.node_type === 'location') {
    selectedNodeId.value = data.id
    selectedNodeType.value = 'location'
  }
  pagination.page = 1
  loadData()
}

/** 编辑仓库或货位 */
function handleEdit(row: any) {
  if (row.node_type === 'warehouse') {
    router.push({ path: '/common/add', query: { type: 'warehouseLocation', id: row.warehouse_id, mode: 'edit' } })
  } else {
    router.push({ path: '/common/add', query: { type: 'warehouseLocationChild', id: row.location_id, mode: 'edit' } })
  }
}

/** 删除仓库或货位 */
async function handleDelete(row: any) {
  try {
    let summary = ''
    if (row.node_type === 'warehouse') {
      try {
        const preview = await previewWarehouseDelete(row.warehouse_id)
        summary = (preview.data as any)?.summary || ''
      } catch {}
      await ElMessageBox.confirm(
        summary || `确认删除仓库「${row.warehouse_name}」？删除后其下货位也将被移除。`,
        '删除确认',
        { confirmButtonText: '确认删除', type: 'warning' }
      )
      await deleteWarehouse(row.warehouse_id)
    } else {
      try {
        const preview = await previewLocationDelete(row.location_id)
        summary = (preview.data as any)?.summary || ''
      } catch {}
      await ElMessageBox.confirm(
        summary || `确认删除货位「${row.location_name}」？`,
        '删除确认',
        { confirmButtonText: '确认删除', type: 'warning' }
      )
      await deleteLocation(row.location_id)
    }
    ElMessage.success('删除成功')
    loadTreeData()
    loadData()
  } catch {}
}

onMounted(() => { loadTreeData(); loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }

.location-filter-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.filter-mode-tabs {
  align-self: flex-start;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  align-items: center;
}

.filter-form :deep(.el-form-item) {
  margin: 0;
}

.filter-form :deep(.el-form-item__label) {
  white-space: nowrap;
}

.filter-actions {
  margin-left: 4px !important;
}
</style>
