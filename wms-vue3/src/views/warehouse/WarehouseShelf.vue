<template>
  <ListTemplate
    title="放货货位"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="货位编号"><el-input v-model="searchForm.location_no" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="货位名称"><el-input v-model="searchForm.location_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="简码"><el-input v-model="searchForm.simple_code" placeholder="请输入" clearable style="width:100px" /></el-form-item>
        <el-form-item label="货位类型">
          <el-select v-model="searchForm.location_type" placeholder="请选择" clearable style="width:100px">
            <el-option label="货架" value="货架" />
            <el-option label="托盘" value="托盘" />
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
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="location_name" label="货位名称" min-width="130" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.location_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="location_no" label="货位编号" min-width="100" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="simple_code" label="简码" min-width="80" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="location_type_label" label="货位类型" width="80" align="center">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.location_type_label }">{{ row.location_type_label || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="parent_name" label="上级名称" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.parent_name }">{{ row.parent_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="sort_no" label="排序号" width="70" align="center" sortable="custom" />
        <el-table-column prop="status" label="状态" width="70" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getWarehouseTree, searchLocations, deleteLocation, type LocationItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<Partial<LocationItem>[]>([])
const searchForm = reactive({ location_no: '', location_name: '', simple_code: '', location_type: '', status: '' as string | number })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

/** 是否有搜索条件 */
function hasSearchFilters(): boolean {
  return !!(searchForm.location_no || searchForm.location_name || searchForm.simple_code || searchForm.location_type || searchForm.status !== '')
}

/** 从仓库树中递归提取所有货位节点 */
function flattenLocationsFromTree(
  nodes: { warehouse_id?: string; location_id?: string; location_name?: string; children?: unknown[] }[]
): Partial<LocationItem>[] {
  const result: Partial<LocationItem>[] = []
  const walk = (items: { location_id?: string; location_name?: string; children?: unknown[] }[]) => {
    for (const item of items) {
      if (item.location_id) {
        result.push({ location_id: item.location_id, location_name: item.location_name || '' })
      }
      if (item.children && Array.isArray(item.children)) {
        walk(item.children as { location_id?: string; location_name?: string; children?: unknown[] }[])
      }
    }
  }
  for (const wh of nodes) {
    if (wh.children && Array.isArray(wh.children)) {
      walk(wh.children as { location_id?: string; location_name?: string; children?: unknown[] }[])
    }
  }
  return result
}

/** 将搜索树节点(id/name/status/type)归一化为表格行 */
function normalizeSearchNode(node: { id: string; name: string; status: number; type: string }): Partial<LocationItem> {
  return {
    location_id: node.id,
    location_name: node.name,
    status: node.status,
    location_type_label: node.type === '货位' ? undefined : node.type,
  }
}

async function loadData() {
  try {
    if (hasSearchFilters()) {
      // 有搜索条件 → 调用 location search 接口
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.location_no) { searchField.push('location_no'); searchValue.location_no = searchForm.location_no }
      if (searchForm.location_name) { searchField.push('location_name'); searchValue.location_name = searchForm.location_name }
      if (searchForm.simple_code) { searchField.push('simple_code'); searchValue.simple_code = searchForm.simple_code }
      if (searchForm.location_type) { searchField.push('location_type_label'); searchValue.location_type_label = searchForm.location_type }
      if (searchForm.status !== '') { searchField.push('status'); searchValue.status = Number(searchForm.status) }
      const res = await searchLocations({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.location.map(normalizeSearchNode)
      pagination.total = res.data.total
    } else {
      // 无搜索条件 → 从仓库树中提取货位
      const res = await getWarehouseTree({ page: 1 })
      tableData.value = flattenLocationsFromTree(res.data.warehouse as { warehouse_id: string; children?: unknown[] }[])
      pagination.total = tableData.value.length
    }
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { location_no: '', location_name: '', simple_code: '', location_type: '', status: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'warehouseShelf' } }) }

function handleEdit(row: Partial<LocationItem>) {
  sessionStorage.setItem('editData:warehouseShelf', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'warehouseShelf', id: row.location_id, mode: 'edit' } })
}

async function handleDelete(row: Partial<LocationItem>) {
  try {
    await ElMessageBox.confirm(`确认删除货位「${row.location_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteLocation(row.location_id!)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
