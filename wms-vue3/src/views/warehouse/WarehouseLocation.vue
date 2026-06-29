<template>
  <ListTemplate
    title="库位管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
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
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="warehouse_name" label="仓库名称" min-width="130" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.warehouse_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="warehouse_no" label="仓库编号" min-width="100" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="warehouse_region_label" label="仓库区域" min-width="80" align="center">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.warehouse_region_label }">{{ row.warehouse_region_label || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="warehouse_type_label" label="仓库类型" min-width="80" align="center">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.warehouse_type_label }">{{ row.warehouse_type_label || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="warehouse_address" label="仓库地址" min-width="150" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.warehouse_address }">{{ row.warehouse_address || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="contact_name" label="联系人" min-width="80">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.contact_name }">{{ row.contact_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="contact_phone" label="联系电话" min-width="110">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.contact_phone }">{{ row.contact_phone || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="70" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" sortable="custom" />
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
import { getWarehouseTree, searchWarehouses, getWarehouseDetail, deleteWarehouse, type WarehouseItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<Partial<WarehouseItem>[]>([])
const searchForm = reactive({ warehouse_name: '', warehouse_no: '', warehouse_region: '', warehouse_type: '', status: '' as string | number })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

/** 是否有搜索条件 */
function hasSearchFilters(): boolean {
  return !!(searchForm.warehouse_name || searchForm.warehouse_no || searchForm.warehouse_region || searchForm.warehouse_type || searchForm.status !== '')
}

/** 将搜索树节点(id/name/status/type)归一化为表格行 */
function normalizeSearchNode(node: { id: string; name: string; status: number; type: string }): Partial<WarehouseItem> {
  return {
    warehouse_id: node.id,
    warehouse_name: node.name,
    status: node.status,
    warehouse_type_label: node.type === '仓库' ? undefined : node.type,
  }
}

/** 对一批仓库ID批量拉取详情，返回完整字段数组 */
async function fetchWarehouseDetails(warehouseIds: string[]): Promise<Partial<WarehouseItem>[]> {
  const results = await Promise.all(
    warehouseIds.map(id => getWarehouseDetail(id).catch(() => null))
  )
  return results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map(r => r.data)
}

async function loadData() {
  try {
    if (hasSearchFilters()) {
      // 有搜索条件 → 调用 search 接口，再批量补调详情获取完整字段
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
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      pagination.total = res.data.total
      const nodes = res.data.warehouse as { id: string; name: string; status: number; type: string }[]
      const ids = nodes.map(n => n.id)
      const details = await fetchWarehouseDetails(ids)
      // detail 能取到的用 detail，取不到的回退到搜索节点
      tableData.value = nodes.map(node => {
        const detail = details.find(d => d.warehouse_id === node.id)
        return detail || normalizeSearchNode(node)
      })
    } else {
      // 无搜索条件 → 调用 query 接口获取仓库ID列表，再批量补调详情
      const res = await getWarehouseTree({
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      pagination.total = res.data.total
      const nodes = res.data.warehouse as { warehouse_id: string; warehouse_name: string }[]
      const ids = nodes.map(n => n.warehouse_id)
      const details = await fetchWarehouseDetails(ids)
      tableData.value = details
    }
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { warehouse_name: '', warehouse_no: '', warehouse_region: '', warehouse_type: '', status: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'warehouseLocation' } }) }

function handleEdit(row: Partial<WarehouseItem>) {
  // 不存 sessionStorage 缓存，让 AddTemplate 走 loadDetail 路径
  // loadDetail 中会用 _label 字段将英文枚举值回填为中文，保证 select 正确回显
  router.push({ path: '/common/add', query: { type: 'warehouseLocation', id: row.warehouse_id, mode: 'edit' } })
}

async function handleDelete(row: Partial<WarehouseItem>) {
  try {
    await ElMessageBox.confirm(`确认删除仓库「${row.warehouse_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteWarehouse(row.warehouse_id!)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
