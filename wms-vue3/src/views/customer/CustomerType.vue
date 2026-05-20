<template>
  <ListTemplate
    title="客户类型设定"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="类型名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
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
    <template #actions>
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column prop="name" label="客户类型名称" min-width="160" />
        <el-table-column prop="orgName" label="所属组织" min-width="140" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.orgName }">{{ row.orgName || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="createUserName" label="创建人" width="100" />
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
import { getCustomerTypeItemList, deleteCustomerType, type CustomerTypeItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<CustomerTypeItem[]>([])
const searchForm = reactive({ name: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: CustomerTypeItem[] = [
  { id: '1', name: '零售客户', orgId: '1', orgName: '销售部', status: '正常', createTime: '2024-01-10 09:00', updateTime: '2026-04-20 09:00', createUserId: '1', createUserName: '管理员' },
  { id: '2', name: '批发客户', orgId: '1', orgName: '销售部', status: '正常', createTime: '2024-01-10 09:05', updateTime: '2026-04-20 09:05', createUserId: '1', createUserName: '管理员' },
  { id: '3', name: 'VIP客户', orgId: '1', orgName: '销售部', status: '正常', createTime: '2024-01-10 09:10', updateTime: '2026-04-20 09:10', createUserId: '1', createUserName: '管理员' },
  { id: '4', name: '代理商', orgId: '1', orgName: '销售部', status: '停用', createTime: '2024-01-10 09:15', updateTime: '2025-10-01 09:15', createUserId: '1', createUserName: '管理员' },
]

async function loadData() {
  try {
    const res = await getCustomerTypeItemList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { name, status } = searchForm
    const filtered = fallbackData.filter(r => {
      if (name && !r.name.includes(name)) return false
      if (status && r.status !== status) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', status: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'customerType' } }) }
function handleEdit(row: CustomerTypeItem) {
  sessionStorage.setItem('editData:customerType', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'customerType', id: row.id, mode: 'edit' } })
}

async function handleDelete(row: CustomerTypeItem) {
  try {
    await ElMessageBox.confirm(`确认删除客户类型「${row.name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteCustomerType(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
