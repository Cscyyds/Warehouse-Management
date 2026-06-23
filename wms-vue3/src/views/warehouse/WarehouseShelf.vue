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
        <el-form-item label="完整编号"><el-input v-model="searchForm.code" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="货位名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="货位类型">
          <el-select v-model="searchForm.type" placeholder="请选择" clearable style="width:100px">
            <el-option label="货架" value="货架" />
            <el-option label="地堆" value="地堆" />
            <el-option label="托盘" value="托盘" />
          </el-select>
        </el-form-item>
        <el-form-item label="库位状态">
          <el-select v-model="searchForm.locationStatus" placeholder="请选择" clearable style="width:100px">
            <el-option label="正常" value="正常" />
            <el-option label="停用" value="停用" />
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
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="code" label="完整编号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="warehouseName" label="上级仓库" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.warehouseName }">{{ row.warehouseName || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="货位名称" min-width="120" />
        <el-table-column prop="locationStatus" label="库位状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.locationStatus === '正常' ? 'success' : 'info'" size="small">{{ row.locationStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序号" width="70" align="center" />
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column prop="updateTime" label="更新时间" width="160" />
        <el-table-column prop="status" label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '正常' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
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
import { getShelfList, deleteShelf, type ShelfItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<ShelfItem[]>([])
const searchForm = reactive({ code: '', name: '', type: '', locationStatus: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: ShelfItem[] = [
  { id: '1', code: 'SH-SZ-001-A01', name: 'A区1层1列', locationId: '1', locationName: '深圳主仓库A区', warehouseId: '1', warehouseName: '深圳主仓库', layer: 1, column: 1, maxCapacity: 100, usedCapacity: 45, sort: 1, status: '正常', createTime: '2024-01-15 09:00', updateTime: '2026-04-20 09:00' },
  { id: '2', code: 'SH-SZ-001-A02', name: 'A区1层2列', locationId: '1', locationName: '深圳主仓库A区', warehouseId: '1', warehouseName: '深圳主仓库', layer: 1, column: 2, maxCapacity: 100, usedCapacity: 30, sort: 2, status: '正常', createTime: '2024-01-15 09:05', updateTime: '2026-04-20 09:05' },
  { id: '3', code: 'SH-GZ-002-B01', name: 'B区1层1列', locationId: '2', locationName: '广州副仓库B区', warehouseId: '2', warehouseName: '广州副仓库', layer: 1, column: 1, maxCapacity: 80, usedCapacity: 20, sort: 1, status: '停用', createTime: '2024-02-20 10:00', updateTime: '2025-08-01 10:00' },
]

async function loadData() {
  try {
    const res = await getShelfList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { code, name, type, locationStatus } = searchForm
    const filtered = fallbackData.filter(r => {
      if (code && !r.code.includes(code)) return false
      if (name && !r.name.includes(name)) return false
      if (locationStatus && r.status !== locationStatus) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { code: '', name: '', type: '', locationStatus: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'warehouseShelf' } }) }
function handleEdit(row: ShelfItem) {
  sessionStorage.setItem('editData:warehouseShelf', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'warehouseShelf', id: row.id, mode: 'edit' } })
}

async function handleDelete(row: ShelfItem) {
  try {
    await ElMessageBox.confirm(`确认删除货位「${row.name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteShelf(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>