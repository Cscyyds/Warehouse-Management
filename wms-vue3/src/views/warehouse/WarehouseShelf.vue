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
        <el-form-item label="货位名称"><el-input v-model="searchForm.spot_name" placeholder="请输入" clearable style="width:160px" /></el-form-item>
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
        <el-table-column prop="spot_name" label="货位名称" min-width="160" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.spot_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip sortable="custom">
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
import { getStagingSpotList, searchStagingSpots, deleteStagingSpot, type StagingSpotItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<StagingSpotItem[]>([])
const searchForm = reactive({ spot_name: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

/** 是否有搜索条件 */
function hasSearchFilters(): boolean {
  return !!searchForm.spot_name
}

async function loadData() {
  try {
    if (hasSearchFilters()) {
      // 有搜索条件 → 调用 search 接口
      const res = await searchStagingSpots({
        search_field: JSON.stringify(['spot_name']),
        search_value: JSON.stringify({ spot_name: searchForm.spot_name }),
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.items
      pagination.total = res.data.total
    } else {
      // 无搜索条件 → 调用 query 接口
      const res = await getStagingSpotList({
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
function handleReset() { Object.assign(searchForm, { spot_name: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'warehouseShelf' } }) }

function handleEdit(row: StagingSpotItem) {
  // 不存 sessionStorage 缓存，让 AddTemplate 走 loadDetail 路径获取完整字段
  router.push({ path: '/common/add', query: { type: 'warehouseShelf', id: row.spot_id, mode: 'edit' } })
}

async function handleDelete(row: StagingSpotItem) {
  try {
    await ElMessageBox.confirm(`确认删除放货货位「${row.spot_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteStagingSpot(row.spot_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
