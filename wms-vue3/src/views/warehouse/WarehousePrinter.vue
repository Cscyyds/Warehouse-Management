<template>
  <ListTemplate
    title="打印机管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="打印机名称"><el-input v-model="searchForm.printer_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="IP地址"><el-input v-model="searchForm.ip_address" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="端口号"><el-input v-model="searchForm.port" placeholder="请输入" clearable style="width:90px" /></el-form-item>
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
        <el-table-column prop="printer_name" label="打印机名称" min-width="130" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.printer_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="ip_address" label="IP地址" min-width="130" sortable="custom" />
        <el-table-column prop="port" label="端口号" width="80" align="center" sortable="custom" />
        <el-table-column prop="created_by_name" label="创建人" width="100" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.created_by_name }">{{ row.created_by_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" sortable="custom" />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
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
import { getPrinterList, searchPrinters, deletePrinter, type PrinterItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<PrinterItem[]>([])
const searchForm = reactive({ printer_name: '', ip_address: '', port: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

/** 是否有搜索条件 */
function hasSearchFilters(): boolean {
  return !!(searchForm.printer_name || searchForm.ip_address || searchForm.port)
}

async function loadData() {
  try {
    if (hasSearchFilters()) {
      // 有搜索条件 → 调用 search 接口
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.printer_name) { searchField.push('printer_name'); searchValue.printer_name = searchForm.printer_name }
      if (searchForm.ip_address) { searchField.push('ip_address'); searchValue.ip_address = searchForm.ip_address }
      if (searchForm.port) { searchField.push('port'); searchValue.port = Number(searchForm.port) }
      const res = await searchPrinters({
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
      const res = await getPrinterList({
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
function handleReset() { Object.assign(searchForm, { printer_name: '', ip_address: '', port: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'warehousePrinter' } }) }

function handleEdit(row: PrinterItem) {
  // 不存 sessionStorage 缓存，让 AddTemplate 走 loadDetail 路径获取完整字段
  router.push({ path: '/common/add', query: { type: 'warehousePrinter', id: row.printer_id, mode: 'edit' } })
}

async function handleDelete(row: PrinterItem) {
  try {
    await ElMessageBox.confirm(`确认删除打印机「${row.printer_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deletePrinter(row.printer_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
