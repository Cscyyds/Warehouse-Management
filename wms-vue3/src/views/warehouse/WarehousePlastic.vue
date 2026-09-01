<template>
  <ListTemplate
    title="塑料盒管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="塑料盒名称"><el-input v-model="searchForm.box_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="塑料盒编码"><el-input v-model="searchForm.box_code" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="searchForm.remark" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button v-perm="'POST /api/v1/tenant-plastic-boxes'" type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
      <el-button :disabled="!selectedBoxes.length" @click="printOpen = true"><el-icon><Printer /></el-icon>塑料盒打印</el-button>
    </template>
    <template #table>
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @sort-change="handleSortChange" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="box_name" label="塑料盒名称" min-width="120" sortable="custom">
          <template #default="{ row }">
            <span v-perm="'GET /api/v1/tenant-plastic-boxes/detail'" class="cell-link" @click="handleEdit(row)">{{ row.box_name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="box_code" label="塑料盒编码" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="200" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button v-perm="'POST /api/v1/tenant-plastic-boxes/update'" link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button v-perm="'POST /api/v1/tenant-plastic-boxes/delete'" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
  <PrintLabelDialog v-model="printOpen" kind="plasticBox" :rows="printRows" />
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Printer } from '@element-plus/icons-vue'
import PrintLabelDialog from '@/components/PrintLabelDialog.vue'
import { getPlasticBoxList, searchPlasticBoxes, deletePlasticBox, type PlasticBoxItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'

const router = useRouter()
const tableData = ref<PlasticBoxItem[]>([])
const searchForm = reactive({ box_name: '', box_code: '', remark: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const loading = ref(false)
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

/* —— 塑料盒条码打印 —— */
const selectedBoxes = ref<PlasticBoxItem[]>([])
const printOpen = ref(false)
const printRows = computed(() => selectedBoxes.value.map((item) => ({
  id: item.box_id,
  title: item.box_name,
  subtitle: item.box_code,
})))

function onSelectionChange(rows: PlasticBoxItem[]) {
  selectedBoxes.value = rows
}

/** 是否有搜索条件 */
function hasSearchFilters(): boolean {
  return !!(searchForm.box_name || searchForm.box_code || searchForm.remark)
}

async function loadData() {
  loading.value = true
  try {
    if (hasSearchFilters()) {
      // 有搜索条件 → 调用 search 接口
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.box_name) { searchField.push('box_name'); searchValue.box_name = searchForm.box_name }
      if (searchForm.box_code) { searchField.push('box_code'); searchValue.box_code = searchForm.box_code }
      if (searchForm.remark) { searchField.push('remark'); searchValue.remark = searchForm.remark }
      const res = await searchPlasticBoxes({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.items
      pagination.total = res.data.total
    } else {
      // 无搜索条件 → 调用 query 接口
      const res = await getPlasticBoxList({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.items
      pagination.total = res.data.total
    }
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { box_name: '', box_code: '', remark: '' }); handleSearch() }
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
