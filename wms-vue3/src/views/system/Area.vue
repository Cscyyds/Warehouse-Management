<template>
  <ListTemplate
    title="行政区划"
    :loading="loading"
    :perm-endpoints="{ add: 'POST /api/v1/tenant-areas' }"
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
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" row-key="area_id" border default-expand-all :tree-props="{ children: 'children' }" @sort-change="handleSortChange">
        <el-table-column prop="area_name" label="区划名称" min-width="180" sortable="custom">
          <template #default="{ row }">
            <span class="cell-link" @click="handleEdit(row)">{{ row.area_name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="area_code" label="区划编码" width="130" sortable="custom" show-overflow-tooltip />
        <el-table-column prop="area_type_label" column-key="area_type" label="区划类型" width="140" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ areaTypeText(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="parent_name" label="上级区划" width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.parent_name || row.parent_id === '0' }">{{ (!row.parent_name || row.parent_id === '0') ? '-' : row.parent_name }}</span></template>
        </el-table-column>
        <el-table-column prop="sort_no" label="排序号" min-width="90" align="center" sortable="custom" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="90" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="200" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button v-perm="'POST /api/v1/tenant-areas/update'" link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button v-perm="'POST /api/v1/tenant-areas/delete'" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'

const router = useRouter()
const loading = ref(false)
const tableData = ref<AreaItem[]>([])

const searchForm = reactive<{ area_name: string; area_code: string; area_type: string; status: number | '' }>({
  area_name: '', area_code: '', area_type: '', status: ''
})
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

/** 统计树形节点的总数量（用于分页 total 显示真实行数） */
function countNodes(nodes: AreaItem[]): number {
  return nodes.reduce((sum, n) => sum + 1 + (n.children && n.children.length ? countNodes(n.children) : 0), 0)
}

/** 区划类型枚举 → 中文显示名（兼容标准枚举与历史脏数据 PROVINCE/DISTRICT 等） */
const AREA_TYPE_LABELS: Record<string, string> = {
  COUNTRY: '国家',
  PROVINCE_MUNICIPALITY: '省份直辖市',
  PROVINCE: '省份直辖市',
  CITY: '地市',
  DISTRICT_COUNTY: '区县',
  DISTRICT: '区县',
}
function areaTypeText(row: AreaItem): string {
  return AREA_TYPE_LABELS[row.area_type] || row.area_type_label || row.area_type || '-'
}

async function loadData() {
  loading.value = true
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
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.area || []
      pagination.total = countNodes(tableData.value)
    } else {
      const res = await getAreaList({ page: pagination.page, page_size: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined })
      tableData.value = res.data.area || []
      pagination.total = countNodes(tableData.value)
    }
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
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
