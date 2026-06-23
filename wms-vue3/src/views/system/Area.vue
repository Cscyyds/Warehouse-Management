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
        <el-form-item label="区域名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="区域类型">
          <el-select v-model="searchForm.type" placeholder="请选择" clearable style="width:110px">
            <el-option label="省" value="省" />
            <el-option label="市" value="市" />
            <el-option label="区/县" value="区/县" />
          </el-select>
        </el-form-item>
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
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="name" label="区域名称" min-width="140" />
        <el-table-column prop="type" label="区域类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注信息" min-width="140" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="sort" label="排序号" width="80" align="center" />
        <el-table-column prop="status" label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '正常' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updateTime" label="更新时间" width="160" />
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
import { getAreaList, deleteArea, type AreaItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<AreaItem[]>([])

const searchForm = reactive({ name: '', type: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: AreaItem[] = [
  { id: '1', code: '420000', name: '湖北省', parentId: '', type: '省', sort: 1, status: '正常', createTime: '2023-04-09 10:00', updateTime: '2026-04-23 10:00', createUserId: '1', createUserName: '管理员' },
  { id: '2', code: '420100', name: '武汉市', parentId: '1', type: '市', sort: 1, status: '正常', createTime: '2023-04-09 10:05', updateTime: '2026-04-23 10:05', createUserId: '1', createUserName: '管理员' },
  { id: '3', code: '420106', name: '武昌区', parentId: '2', type: '区/县', sort: 1, status: '正常', createTime: '2023-04-09 10:10', updateTime: '2025-10-04 10:10', createUserId: '1', createUserName: '管理员' },
  { id: '4', code: '440000', name: '广东省', parentId: '', type: '省', sort: 2, status: '正常', createTime: '2023-04-09 10:15', updateTime: '2025-07-21 10:15', createUserId: '1', createUserName: '管理员' },
  { id: '5', code: '440100', name: '广州市', parentId: '4', type: '市', sort: 1, status: '停用', createTime: '2023-04-09 10:20', updateTime: '2024-02-22 10:20', createUserId: '1', createUserName: '管理员' },
]

async function loadData() {
  try {
    const params = { ...searchForm, page: pagination.page, pageSize: pagination.pageSize }
    const res = await getAreaList(params)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { name, type, status } = searchForm
    const filtered = fallbackData.filter(r => {
      if (name && !r.name.includes(name)) return false
      if (type && r.type !== type) return false
      if (status && r.status !== status) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', type: '', status: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'area' } }) }
function handleEdit(row: AreaItem) {
  sessionStorage.setItem('editData:area', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'area', id: row.id, mode: 'edit' } })
}

async function handleDelete(row: AreaItem) {
  try {
    await ElMessageBox.confirm(`确认删除区域「${row.name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteArea(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
