<template>
  <ListTemplate
    title="字典管理"
    :loading="loading"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
  >
    <template #actions>
      <!-- 字典管理无新增按钮 -->
    </template>
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="字典名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="字典类型"><el-input v-model="searchForm.type" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:90px">
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
    <template #table>
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @sort-change="handleSortChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="name" label="字典名称" min-width="140" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="字典类型" min-width="160" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="isSystem" label="系统字典" width="90" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.isSystem ? 'danger' : 'info'" size="small">{{ row.isSystem ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updateTime" label="更新时间" width="160" sortable="custom">
          <template #default="{ row }">{{ formatTableDate(row.updateTime) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注信息" min-width="140" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="70" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.status === '正常' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleDictData(row)">字典数据</el-button>
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
import { getDictList, deleteDict, type DictItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'

const router = useRouter()
const loading = ref(false)
const tableData = ref<DictItem[]>([])

const searchForm = reactive({ name: '', type: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

async function loadData() {
  loading.value = true
  try {
    const params = { ...searchForm, page: pagination.page, page_size: pagination.pageSize, pageSize: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined }
    const res = await getDictList(params)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', type: '', status: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'dict' } }) }
function handleEdit(row: DictItem) {
  sessionStorage.setItem('editData:dict', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'dict', id: row.id, mode: 'edit' } })
}
function handleDictData(row: DictItem) { router.push({ path: '/system/dict-data', query: { dictId: row.id, dictType: row.type } }) }

async function handleDelete(row: DictItem) {
  try {
    await ElMessageBox.confirm(`确认删除字典「${row.name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteDict(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
