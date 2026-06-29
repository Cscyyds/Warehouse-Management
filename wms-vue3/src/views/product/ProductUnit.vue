<template>
  <ListTemplate
    title="计量单位"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="单位名称"><el-input v-model="searchForm.unit_name" placeholder="请输入" clearable style="width:160px" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:120px">
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
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" v-loading="loading" @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="unit_name" label="单位名称" min-width="140" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.unit_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="updated_at" label="更新时间" width="170" sortable="custom" />
        <el-table-column label="操作" width="120" fixed="right" align="center">
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
import { getProductUnitList, searchProductUnit, deleteProductUnit, type ProductUnitItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<ProductUnitItem[]>([])
const loading = ref(false)
const searchForm = reactive({ unit_name: '', status: '' as number | string })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

async function loadData() {
  loading.value = true
  try {
    const hasSearch = searchForm.unit_name.trim() || searchForm.status !== ''
    let res
    if (hasSearch) {
      const fields: string[] = []
      const values: Record<string, unknown> = {}
      if (searchForm.unit_name.trim()) {
        fields.push('unit_name')
        values['unit_name'] = searchForm.unit_name.trim()
      }
      if (searchForm.status !== '') {
        fields.push('status')
        values['status'] = Number(searchForm.status)
      }
      res = await searchProductUnit({
        search_field: JSON.stringify(fields),
        search_value: JSON.stringify(values),
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    } else {
      res = await getProductUnitList({ page: pagination.page, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined })
    }
    tableData.value = res.data.unit || []
    pagination.total = res.data.total ?? 0
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { unit_name: '', status: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'productUnit' } }) }
function handleEdit(row: ProductUnitItem) {
  sessionStorage.setItem('editData:productUnit', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'productUnit', id: row.unit_id, mode: 'edit' } })
}

async function handleDelete(row: ProductUnitItem) {
  try {
    await ElMessageBox.confirm(`确认删除计量单位「${row.unit_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteProductUnit(row.unit_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
