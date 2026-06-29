<template>
  <ListTemplate
    title="行政区划"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="区划名称"><el-input v-model="searchForm.area_name" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="区划编码"><el-input v-model="searchForm.area_code" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="区划类型">
          <el-select v-model="searchForm.area_type" placeholder="请选择" clearable style="width:120px">
            <el-option label="国家" value="国家" />
            <el-option label="省份直辖市" value="省份直辖市" />
            <el-option label="地市" value="地市" />
            <el-option label="区县" value="区县" />
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
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" row-key="area_id" border @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="area_name" label="区划名称" min-width="140" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.area_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="area_code" label="区划编码" width="130" sortable="custom" />
        <el-table-column prop="area_type_label" label="区划类型" width="110" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.area_type_label || row.area_type || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="parent_name" label="上级区划" width="120" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.parent_name || row.parent_id === '0' }">{{ (!row.parent_name || row.parent_id === '0') ? '-' : row.parent_name }}</span></template>
        </el-table-column>
        <el-table-column prop="sort_no" label="排序号" width="80" align="center" sortable="custom" />
        <el-table-column prop="status" label="状态" width="70" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="160" sortable="custom" />
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            <el-dropdown trigger="click" @command="(cmd: string) => handleRowCommand(cmd, row)">
              <el-button link type="primary" size="small"><el-icon :size="14"><MoreFilled /></el-icon></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :command="row.status === 1 ? 'stop' : 'start'">{{ row.status === 1 ? '停用' : '启用' }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
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
import { MoreFilled } from '@element-plus/icons-vue'
import { getAreaList, searchAreas, deleteArea, updateAreaStatus, type AreaItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<AreaItem[]>([])

const searchForm = reactive<{ area_name: string; area_code: string; area_type: string; status: number | '' }>({
  area_name: '', area_code: '', area_type: '', status: ''
})
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

/** 将树形数据展平为一维数组，便于表格展示 */
function flattenTree(tree: AreaItem[]): AreaItem[] {
  const result: AreaItem[] = []
  function walk(nodes: AreaItem[]) {
    for (const node of nodes) {
      result.push(node)
      if (node.children && node.children.length > 0) {
        walk(node.children)
      }
    }
  }
  walk(tree)
  return result
}

async function loadData() {
  try {
    const hasSearch = searchForm.area_name || searchForm.area_code || searchForm.area_type || searchForm.status !== ''
    if (hasSearch) {
      const searchFields: string[] = []
      const searchValue: Record<string, string> = {}
      if (searchForm.area_name) { searchFields.push('area_name'); searchValue.area_name = searchForm.area_name }
      if (searchForm.area_code) { searchFields.push('area_code'); searchValue.area_code = searchForm.area_code }
      if (searchForm.area_type) { searchFields.push('area_type'); searchValue.area_type = searchForm.area_type }
      if (searchForm.status !== '') { searchFields.push('status'); searchValue.status = String(searchForm.status) }

      const res = await searchAreas({
        search_field: JSON.stringify(searchFields),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = flattenTree(res.data.area || [])
      pagination.total = res.data.total || 0
    } else {
      const res = await getAreaList({ page: pagination.page, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined })
      tableData.value = flattenTree(res.data.area || [])
      pagination.total = res.data.total || 0
    }
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { area_name: '', area_code: '', area_type: '', status: '' })
  handleSearch()
}
function handleAdd() { router.push({ path: '/common/add', query: { type: 'area' } }) }
function handleEdit(row: AreaItem) {
  sessionStorage.setItem('editData:area', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'area', id: row.area_id, mode: 'edit' } })
}

async function handleToggleStatus(row: AreaItem) {
  const newStatus = row.status === 1 ? 0 : 1
  const actionText = newStatus === 1 ? '启用' : '停用'
  try {
    await ElMessageBox.confirm(`确认${actionText}区划「${row.area_name}」？`, '提示')
    await updateAreaStatus(row.area_id, newStatus)
    ElMessage.success(`${actionText}成功`)
    loadData()
  } catch {}
}

async function handleDelete(row: AreaItem) {
  try {
    await ElMessageBox.confirm(`确认删除区划「${row.area_name}」？删除后其下级区划也将被删除。`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteArea(row.area_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

function handleRowCommand(command: string, row: AreaItem) {
  if (command === 'stop' || command === 'start') handleToggleStatus(row)
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
