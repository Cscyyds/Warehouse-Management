<template>
  <ListTemplate
    title="在线用户"
    :show-add="false"
    :show-export="false"
    :show-import="false"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="用户姓名">
          <el-input v-model="searchForm.userName" placeholder="请输入" clearable style="width:160px" @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item label="排序字段">
          <el-select v-model="searchForm.sortBy" placeholder="默认" clearable style="width:150px">
            <el-option v-for="f in SORT_FIELD_OPTIONS" :key="f.value" :label="f.label" :value="f.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序方式">
          <el-select v-model="searchForm.sortOrder" style="width:110px">
            <el-option label="降序" value="DESC" />
            <el-option label="升序" value="ASC" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button @click="handleRefresh"><el-icon><Refresh /></el-icon>刷新</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" v-loading="loading">
        <el-table-column type="index" label="" width="55" align="center" :index="indexMethod" />
        <el-table-column prop="user_name" label="用户名称" min-width="120">
          <template #default="{ row }">{{ row.user_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="login_name" label="登录账号" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.login_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="user_type_label" label="用户类型" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="userTypeTagType(row.user_type)" size="small">{{ row.user_type_label || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="client_ip" label="客户端IP" width="150">
          <template #default="{ row }">{{ row.client_ip || '-' }}</template>
        </el-table-column>
        <el-table-column prop="device_name" label="设备名称" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.device_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="browser_name" label="浏览器名" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.browser_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="created_at" label="登录时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column prop="updated_at" label="最后活跃时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.updated_at) }}</template>
        </el-table-column>
        <template #empty>
          <el-empty :description="loading ? '加载中...' : '暂无当日在线用户'" />
        </template>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { getTodayOnlineUsers, getTodayOnlineUsersByName, type OnlineUserItem } from '@/api/modules/monitor'

/** 排序字段下拉（接口 40 sort_by 白名单） */
const SORT_FIELD_OPTIONS = [
  { label: '最后活跃时间', value: 'updated_at' },
  { label: '登录时间', value: 'created_at' },
  { label: '用户名称', value: 'user_name' },
  { label: '登录账号', value: 'login_name' },
  { label: '用户ID', value: 'user_id' },
  { label: '客户端IP', value: 'client_ip' },
  { label: '设备名称', value: 'device_name' },
  { label: '浏览器名', value: 'browser_name' },
]

const tableData = ref<OnlineUserItem[]>([])
const loading = ref(false)
const searchForm = reactive({
  userName: '',
  sortBy: 'updated_at',
  sortOrder: 'DESC',
})
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

/** 表格序号（按分页连续编号） */
function indexMethod(index: number): number {
  return (pagination.page - 1) * pagination.pageSize + index + 1
}

async function loadData() {
  loading.value = true
  try {
    const userName = searchForm.userName.trim()
    // 接口 41：按姓名模糊查询当日在线员工
    if (userName) {
      const res = await getTodayOnlineUsersByName({
        user_name: userName,
        page: pagination.page,
      })
      tableData.value = res.data.online || []
      pagination.total = res.data.total || 0
      return
    }
    // 接口 40：查询当日在线员工列表
    const res = await getTodayOnlineUsers({
      page: pagination.page,
      sort_by: searchForm.sortBy || undefined,
      sort_order: searchForm.sortOrder || undefined,
    })
    tableData.value = res.data.online || []
    pagination.total = res.data.total || 0
  } catch (e) {
    // 错误提示由 request 拦截器统一弹窗；这里清空表格并归零总数
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  loadData()
}

function handleReset() {
  Object.assign(searchForm, { userName: '', sortBy: 'updated_at', sortOrder: 'DESC' })
  handleSearch()
}

function handleRefresh() {
  loadData()
}

/** 用户类型 → 标签颜色（按后端 user_type 枚举着色；显示文案直接用后端返回的 user_type_label） */
function userTypeTagType(userType: string | null | undefined): 'danger' | 'warning' | 'info' {
  if (userType === 'ADMIN') return 'danger'
  if (userType === 'SUPER_ADMIN' || userType === 'EXECUTIVE') return 'warning'
  return 'info'
}

/** ISO 字符串 → 本地显示（去掉毫秒/T） */
function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  return String(value).replace('T', ' ').replace(/\.\d+$/, '').replace(/\+00:00$/, '').replace(/Z$/, '')
}

onMounted(() => { loadData() })
</script>
