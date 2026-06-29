<template>
  <ListTemplate
    title="塑料盒管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="塑料盒名称"><el-input v-model="searchForm.box_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="塑料盒编码"><el-input v-model="searchForm.box_code" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="关联货位"><el-input v-model="searchForm.location_name" placeholder="请输入" clearable style="width:120px" /></el-form-item>
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
        <el-table-column prop="box_name" label="塑料盒名称" min-width="120" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.box_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="box_code" label="塑料盒编码" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="location_name" label="关联货位" min-width="120" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.location_name }">{{ row.location_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="floor_no" label="层数" width="70" align="center" sortable="custom" />
        <el-table-column prop="position_no" label="位置" width="70" align="center" sortable="custom" />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
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
import { getPlasticBoxList, searchPlasticBoxes, deletePlasticBox, type PlasticBoxItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<PlasticBoxItem[]>([])
const searchForm = reactive({ box_name: '', box_code: '', location_id: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

/** 关联货位下拉树数据 */
const locationTreeData = ref<any[]>([])

/** 加载仓库树并归一化为 { id, name, children } 格式 */
async function loadLocationTreeData() {
  try {
    const res = await getWarehouseTree({ page: 1 })
    const warehouses = (res.data.warehouse as any[]) || []
    const normalize = (nodes: any[]): any[] => nodes.map(n => ({
      id: n.warehouse_id || n.location_id || n.id,
      name: n.warehouse_name || n.location_name || n.name,
      children: n.children?.length ? normalize(n.children) : []
    }))
    locationTreeData.value = normalize(warehouses)
  } catch {
    locationTreeData.value = []
  }
}

/** 是否有搜索条件 */
function hasSearchFilters(): boolean {
  return !!(searchForm.box_name || searchForm.box_code || searchForm.location_id)
}

async function loadData() {
  try {
    if (hasSearchFilters()) {
      // 有搜索条件 → 调用 search 接口
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.box_name) { searchField.push('box_name'); searchValue.box_name = searchForm.box_name }
      if (searchForm.box_code) { searchField.push('box_code'); searchValue.box_code = searchForm.box_code }
      if (searchForm.location_name) { searchField.push('location_name'); searchValue.location_name = searchForm.location_name }
      const res = await searchPlasticBoxes({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.items
      pagination.total = res.data.total
    } else {
      // 无搜索条件 → 调用 query 接口
      const res = await getPlasticBoxList({
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.items
      pagination.total = res.data.total
    }
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { box_name: '', box_code: '', location_id: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'warehousePlastic' } }) }

function handleEdit(row: PlasticBoxItem) {
  sessionStorage.setItem('editData:warehousePlastic', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'warehousePlastic', id: row.box_id, mode: 'edit' } })
}

async function handleDelete(row: PlasticBoxItem) {
  try {
    await ElMessageBox.confirm(`确认删除塑料盒「${row.box_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deletePlasticBox(row.box_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
