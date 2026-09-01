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
    </template>
    <template #table>
      <el-table border v-loading="loading" :data="treeTableData" stripe size="small" style="width:100%" row-key="row_key" :tree-props="{ children: 'children' }" default-expand-all row-class-name="table-row">
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
            <el-button v-if="row.node_type !== 'warehouse'" link type="success" size="small" @click="handlePrintLocation(row)">打印</el-button>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import PrintLabelDialog from '@/components/PrintLabelDialog.vue'
import { getWarehouseTree, searchWarehouses, searchLocations, getWarehouseDetail, getLocationDetail, getWmsAssociation, deleteWarehouse, deleteLocation, previewWarehouseDelete, previewLocationDelete, type WarehouseItem, type LocationItem } from '@/api'
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
/** 当前选中的节点ID */
const selectedNodeId = ref<string | null>(null)
const selectedNodeType = ref<'all' | 'warehouse' | 'location' | null>(null)

/** 树形表格数据：完整嵌套树 */
const treeTableData = ref<any[]>([])
const emptyDescription = computed(() => searchMode.value === 'location' && hasLocationSearchFilters() ? '暂无匹配货位数据' : '暂无仓库数据')

/* —— 货位条码打印 —— */
const locationPrintOpen = ref(false)
const locationPrintRows = ref<Array<{ id: string; title: string; subtitle?: string }>>([])

function handlePrintLocation(row: any) {
  locationPrintRows.value = [{
    id: row.location_id || row.id,
    title: row.node_name || row.location_name || '',
    subtitle: row.location_no || row.simple_code || '',
  }]
  locationPrintOpen.value = true
}

/** 加载侧边栏树数据 */
async function loadTreeData() {
  try {
    const res = await getWarehouseTree({ page: 1 })
    const warehouses = (res.data.warehouse as any[]) || []
    const normalize = (nodes: any[]): any[] => nodes.map(n => ({
      id: n.warehouse_id || n.location_id || n.id,
      name: n.warehouse_name || n.location_name || n.name,
      node_type: n.warehouse_id ? 'warehouse' : 'location',
      children: n.children?.length ? normalize(n.children) : []
    }))
    const tree = normalize(warehouses)
    sidebarTree.value = [{ id: '__all__', name: '全部', node_type: 'all', children: tree }]
  } catch {
    sidebarTree.value = [{ id: '__all__', name: '全部', node_type: 'all', children: [] }]
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

function includesIgnoreCase(source: unknown, keyword: string): boolean {
  return String(source || '').toLowerCase().includes(keyword.trim().toLowerCase())
}

function matchesWarehouseSearch(warehouse: any): boolean {
  if (searchForm.warehouse_name && !includesIgnoreCase(warehouse.warehouse_name, searchForm.warehouse_name)) return false
  if (searchForm.warehouse_no && !includesIgnoreCase(warehouse.warehouse_no, searchForm.warehouse_no)) return false
  if (searchForm.warehouse_region && String(warehouse.warehouse_region_label || warehouse.warehouse_region || '') !== searchForm.warehouse_region) return false
  if (searchForm.warehouse_type && String(warehouse.warehouse_type_label || warehouse.warehouse_type || '') !== searchForm.warehouse_type) return false
  if (searchForm.status !== '' && Number(warehouse.status) !== Number(searchForm.status)) return false
  return true
}

function matchesLocationSearch(location: any): boolean {
  if (searchForm.location_name && !includesIgnoreCase(location.location_name, searchForm.location_name)) return false
  if (searchForm.location_no && !includesIgnoreCase(location.location_no, searchForm.location_no)) return false
  if (searchForm.simple_code && !includesIgnoreCase(location.simple_code, searchForm.simple_code)) return false
  if (searchForm.location_type && String(location.location_type_label || location.location_type || '') !== searchForm.location_type) return false
  if (searchForm.status !== '' && Number(location.status) !== Number(searchForm.status)) return false
  return true
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

/** 收集嵌套树中所有节点的ID（按类型分组） */
function collectIds(nodes: any[], warehouseIds: string[], locationIds: string[]) {
  for (const node of nodes) {
    if (node.type === '仓库') warehouseIds.push(node.id)
    else if (node.type === '货位') locationIds.push(node.id)
    if (node.children?.length) collectIds(node.children, warehouseIds, locationIds)
  }
}

/** 递归构建完整嵌套树：接口12的嵌套结构 + 接口10/11的详情字段 */
function buildTree(rawChildren: any[], whMap: Map<string, any>, locMap: Map<string, any>): any[] {
  return rawChildren.map((c: any) => {
    const isWarehouse = c.type === '仓库'
    const detail = isWarehouse ? whMap.get(c.id) : locMap.get(c.id)
    return {
      ...detail,
      row_key: `node_${c.id}`,
      node_type: isWarehouse ? 'warehouse' : 'location',
      node_name: c.name,
      status: c.status,
      children: c.children?.length ? buildTree(c.children, whMap, locMap) : [],
    }
  })
}

/** 递归构建仓库表格行（顶层是仓库详情，子级用接口12的嵌套树+详情） */
async function buildWarehouseTree(warehouseIds: string[]): Promise<any[]> {
  // 1. 批量拉取仓库详情
  const whResults = await Promise.all(
    warehouseIds.map(id => getWarehouseDetail(id).catch(() => null))
  )

  // 2. 对每个仓库，调用接口12获取下级嵌套树
  const assocResults = await Promise.all(
    warehouseIds.map(id => getWmsAssociation({ target_id: id }).catch(() => null))
  )

  // 3. 收集所有需要拉取详情的ID
  const allWarehouseIds: string[] = []
  const allLocationIds: string[] = []
  const assocTrees: any[] = []

  for (const res of assocResults) {
    const target = (res?.data as any)?.target
    if (target?.children?.length) {
      collectIds(target.children, allWarehouseIds, allLocationIds)
      assocTrees.push(target.children)
    } else {
      assocTrees.push([])
    }
  }

  // 4. 批量拉取所有子级的详情
  const [childWhResults, childLocResults] = await Promise.all([
    Promise.all(allWarehouseIds.map(id => getWarehouseDetail(id).catch(() => null))),
    Promise.all(allLocationIds.map(id => getLocationDetail(id).catch(() => null))),
  ])

  const whMap = new Map<string, any>()
  ;[...whResults, ...childWhResults].forEach((r: any) => {
    if (r?.data?.warehouse_id) whMap.set(r.data.warehouse_id, r.data)
  })

  const locMap = new Map<string, any>()
  childLocResults.forEach((r: any) => {
    if (r?.data?.location_id) locMap.set(r.data.location_id, r.data)
  })

  // 5. 构建完整嵌套树
  return warehouseIds.map((id, idx) => {
    const wh = whMap.get(id)
    if (!wh) return null
    const childTree = assocTrees[idx] || []
    return {
      ...wh,
      row_key: `wh_${wh.warehouse_id}`,
      node_type: 'warehouse',
      node_name: wh.warehouse_name,
      status: wh.status,
      children: buildTree(childTree, whMap, locMap),
    }
  }).filter(Boolean)
}

function collectLocationIdsFromTree(node: any, ids: Set<string>) {
  if (node?.id) ids.add(String(node.id))
  if (Array.isArray(node?.children)) {
    node.children.forEach((child: any) => collectLocationIdsFromTree(child, ids))
  }
}

function buildLocationNodeTree(node: any, locMap: Map<string, any>): any {
  const detail = locMap.get(node.id) || {}
  return {
    ...detail,
    row_key: `loc_${node.id}`,
    node_type: 'location',
    location_id: node.id,
    location_name: detail.location_name || node.name,
    node_name: detail.location_name || node.name,
    status: detail.status ?? node.status,
    children: Array.isArray(node.children) ? node.children.map((child: any) => buildLocationNodeTree(child, locMap)) : [],
  }
}

async function buildLocationSubtree(locationId: string): Promise<any[]> {
  const res = await getWmsAssociation({ target_id: locationId })
  const target = (res.data as any)?.target
  if (!target?.id) return []
  const ids = new Set<string>()
  collectLocationIdsFromTree(target, ids)
  const results = await Promise.all(Array.from(ids).map(id => getLocationDetail(id).catch(() => null)))
  const locMap = new Map<string, any>()
  results.forEach((r: any) => {
    if (r?.data?.location_id) locMap.set(r.data.location_id, r.data)
  })
  return [buildLocationNodeTree(target, locMap)]
}

async function buildLocationSearchRows(nodes: Array<{ id: string; name: string; status: number; type: string }>): Promise<any[]> {
  const results = await Promise.all(nodes.map(node => getLocationDetail(node.id).catch(() => null)))
  return results
    .map((result: any, index) => {
      const detail = result?.data
      const rawNode = nodes[index]
      if (!detail && !rawNode) return null
      return {
        ...(detail || {}),
        row_key: `loc_search_${rawNode.id}_${index}`,
        node_type: 'location',
        location_id: detail?.location_id || rawNode.id,
        location_name: detail?.location_name || rawNode.name,
        node_name: detail?.location_name || rawNode.name,
        status: detail?.status ?? rawNode.status ?? 0,
        children: [],
      }
    })
    .filter(Boolean)
}

async function loadData() {
  loading.value = true
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
      })
      const nodes = (res.data.location as Array<{ id: string; name: string; status: number; type: string }>) || []
      treeTableData.value = await buildLocationSearchRows(nodes)
      pagination.total = res.data.total
      await focusTreeNode(nodes[0]?.id || null)
      return
    }
    if (hasWarehouseSearchFilters()) {
      // 有搜索条件 → 调用 search 接口
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
      })
      pagination.total = res.data.total
      const nodes = res.data.warehouse as { id: string; name: string }[]
      const ids = nodes.map(n => n.id)
      treeTableData.value = await buildWarehouseTree(ids)
      return
    }
    if (selectedNodeType.value === 'location' && selectedNodeId.value) {
      treeTableData.value = await buildLocationSubtree(selectedNodeId.value)
      pagination.total = treeTableData.value.length
      return
    }
    if (selectedNodeId.value && selectedNodeId.value !== '__all__') {
      // 选中了某个仓库 → 只构建该仓库的树
      treeTableData.value = await buildWarehouseTree([selectedNodeId.value])
      pagination.total = 1
    } else {
      // 无搜索条件 → 调用 query 接口获取仓库列表
      const res = await getWarehouseTree({ page: pagination.page, page_size: pagination.pageSize })
      pagination.total = res.data.total
      const nodes = res.data.warehouse as { warehouse_id: string }[]
      const ids = nodes.map(n => n.warehouse_id)
      treeTableData.value = await buildWarehouseTree(ids)
    }
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
