<template>
  <ListTemplate
    title="库位管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    show-tree
    tree-title="仓库货位"
    :tree-data="sidebarTree"
    tree-node-key="id"
    tree-label-key="name"
    tree-width="210px"
    @page-change="loadData"
    @add="handleAdd"
    @tree-node-click="handleTreeNodeClick"
    @tree-refresh="loadTreeData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="仓库名称"><el-input v-model="searchForm.warehouse_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="仓库编号"><el-input v-model="searchForm.warehouse_no" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="仓库区域">
          <el-select v-model="searchForm.warehouse_region" placeholder="请选择" clearable style="width:100px">
            <el-option label="东北" value="东北" />
            <el-option label="华东" value="华东" />
            <el-option label="华中" value="华中" />
            <el-option label="华南" value="华南" />
            <el-option label="西南" value="西南" />
            <el-option label="西北" value="西北" />
          </el-select>
        </el-form-item>
        <el-form-item label="仓库类型">
          <el-select v-model="searchForm.warehouse_type" placeholder="请选择" clearable style="width:100px">
            <el-option label="自营仓库" value="自营仓库" />
            <el-option label="合作仓库" value="合作仓库" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:90px">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增仓库</el-button>
    </template>
    <template #table>
      <el-table v-loading="loading" :data="treeTableData" stripe size="small" style="width:100%" row-key="row_key" :tree-props="{ children: 'children' }" default-expand-all row-class-name="table-row">
        <el-table-column prop="node_name" label="名称" min-width="220">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.node_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="success" size="small" @click="handleAddChild(row)">新增下级库位</el-button>
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无仓库数据" />
        </template>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getWarehouseTree, searchWarehouses, getWarehouseDetail, getLocationDetail, getWmsAssociation, deleteWarehouse, deleteLocation, type WarehouseItem, type LocationItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const searchForm = reactive({ warehouse_name: '', warehouse_no: '', warehouse_region: '', warehouse_type: '', status: '' as string | number })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const loading = ref(false)

/** 侧边栏树数据 */
const sidebarTree = ref<any[]>([])
/** 当前选中的节点ID */
const selectedNodeId = ref<string | null>(null)

/** 树形表格数据：完整嵌套树 */
const treeTableData = ref<any[]>([])

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

/** 从侧边栏树中查找货位所属的仓库ID */
function findParentWarehouseId(nodes: any[], locationId: string): string | null {
  for (const node of nodes) {
    if (node.node_type === 'warehouse' && node.children?.length) {
      if (node.children.some((child: any) => child.id === locationId && child.node_type === 'location')) {
        return node.id
      }
      const found = findParentWarehouseId(node.children, locationId)
      if (found) return found
    }
  }
  return null
}

/** 是否有搜索条件 */
function hasSearchFilters(): boolean {
  return !!(searchForm.warehouse_name || searchForm.warehouse_no || searchForm.warehouse_region || searchForm.warehouse_type || searchForm.status !== '')
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

async function loadData() {
  loading.value = true
  try {
    if (hasSearchFilters()) {
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
      })
      pagination.total = res.data.total
      const nodes = res.data.warehouse as { id: string; name: string }[]
      const ids = nodes.map(n => n.id)
      // 选中了某个仓库 → 只构建该仓库的树
      const targetIds = selectedNodeId.value && selectedNodeId.value !== '__all__'
        ? [selectedNodeId.value]
        : ids
      treeTableData.value = await buildWarehouseTree(targetIds)
    } else if (selectedNodeId.value && selectedNodeId.value !== '__all__') {
      // 选中了某个仓库 → 只构建该仓库的树
      treeTableData.value = await buildWarehouseTree([selectedNodeId.value])
      pagination.total = 1
    } else {
      // 无搜索条件 → 调用 query 接口获取仓库列表
      const res = await getWarehouseTree({ page: pagination.page })
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

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { warehouse_name: '', warehouse_no: '', warehouse_region: '', warehouse_type: '', status: '' }); handleSearch() }

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
  } else if (data.node_type === 'warehouse') {
    selectedNodeId.value = data.id
  } else if (data.node_type === 'location') {
    const allNodes = sidebarTree.value[0]?.children || []
    const parentId = findParentWarehouseId(allNodes, data.id)
    selectedNodeId.value = parentId || data.id
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
    if (row.node_type === 'warehouse') {
      await ElMessageBox.confirm(`确认删除仓库「${row.warehouse_name}」？删除后其下货位也将被移除。`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
      await deleteWarehouse(row.warehouse_id)
    } else {
      await ElMessageBox.confirm(`确认删除货位「${row.location_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
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
</style>
