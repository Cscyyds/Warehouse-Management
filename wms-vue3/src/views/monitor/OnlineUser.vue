<template>
  <ListTemplate
    title="在线用户"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="用户名称"><el-input v-model="searchForm.userName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="用户类型">
          <el-select v-model="searchForm.userType" placeholder="全部" clearable style="width:120px">
            <el-option label="管理员" value="管理员" />
            <el-option label="普通用户" value="普通用户" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <span />
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="index" label="序号" width="55" align="center" :index="(i: number) => i + 1" />
        <el-table-column prop="userName" label="用户名称" min-width="120" />
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column prop="lastAccessTime" label="最后访问" width="160" />
        <el-table-column prop="timeout" label="超时时间" width="100" align="center" />
        <el-table-column prop="clientHost" label="客户主机" width="140" />
        <el-table-column prop="userType" label="用户类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.userType === '管理员' ? 'danger' : ''" size="small">{{ row.userType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="deviceType" label="设备类型" width="110" />
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="danger" size="small" @click="handleForceLogout(row)">强制下线</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getOnlineUserList, forceLogout, type OnlineUserItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const tableData = ref<OnlineUserItem[]>([])
const searchForm = reactive({ userName: '', userType: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: OnlineUserItem[] = [
  { id: '1', userName: '管理员', createTime: '2026-05-19 08:00', lastAccessTime: '2026-05-19 09:15', timeout: '30分钟', clientHost: '192.168.1.100', userType: '管理员', deviceType: 'Windows PC' },
  { id: '2', userName: '张三', createTime: '2026-05-19 08:30', lastAccessTime: '2026-05-19 09:10', timeout: '30分钟', clientHost: '192.168.1.101', userType: '普通用户', deviceType: 'macOS' },
  { id: '3', userName: '李四', createTime: '2026-05-19 08:45', lastAccessTime: '2026-05-19 09:05', timeout: '30分钟', clientHost: '192.168.1.105', userType: '普通用户', deviceType: 'Windows PC' },
  { id: '4', userName: '王五', createTime: '2026-05-19 09:00', lastAccessTime: '2026-05-19 09:12', timeout: '30分钟', clientHost: '192.168.1.110', userType: '普通用户', deviceType: 'Android' },
]

async function loadData() {
  try {
    const params = { ...searchForm, page: pagination.page, pageSize: pagination.pageSize }
    const res = await getOnlineUserList(params)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { userName, userType } = searchForm
    const filtered = fallbackData.filter(r => {
      if (userName && !r.userName.includes(userName)) return false
      if (userType && r.userType !== userType) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { userName: '', userType: '' })
  handleSearch()
}
function handleAdd() {}

async function handleForceLogout(row: OnlineUserItem) {
  try {
    await ElMessageBox.confirm(`确认强制下线用户「${row.userName}」？`, '提示', { confirmButtonText: '确认', type: 'warning' })
    await forceLogout(row.id)
    ElMessage.success('已强制下线')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>