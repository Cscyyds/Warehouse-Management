<template>
  <ListTemplate
    title="访问日志"
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
        <el-form-item label="搜索字段">
          <el-select v-model="searchForm.field" placeholder="请选择" style="width:150px">
            <el-option v-for="f in SEARCH_FIELD_OPTIONS" :key="f.value" :label="f.label" :value="f.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索内容">
          <el-input v-model="searchForm.value" placeholder="请输入" clearable style="width:180px" @keyup.enter="handleSearch" />
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
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button @click="handleRefresh"><el-icon><Refresh /></el-icon>刷新</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" v-loading="loading">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="log_title" label="日志标题" min-width="140" show-overflow-tooltip />
        <el-table-column prop="request_path" label="请求地址" min-width="180" show-overflow-tooltip />
        <el-table-column prop="log_type" label="日志类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="logTypeTagType(row.log_type)" size="small">{{ row.log_type || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator_user_name" label="操作用户" width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ row.operator_user_name || row.operator_user_id || '-' }}</template>
        </el-table-column>
        <el-table-column prop="success" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'" size="small">{{ row.success ? '成功' : '失败' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operated_at" label="操作时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.operated_at) }}</template>
        </el-table-column>
        <el-table-column prop="client_ip" label="客户端IP" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.client_ip || '-' }}</template>
        </el-table-column>
        <el-table-column prop="device_name" label="设备名称" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.device_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="browser_name" label="浏览器名" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.browser_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="response_time_ms" label="响应时间" width="100" align="center">
          <template #default="{ row }">{{ row.response_time_ms != null ? `${row.response_time_ms}ms` : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <!-- 操作日志详情 -->
  <el-dialog v-model="detailVisible" title="操作日志详情" width="760px" :close-on-click-modal="false">
    <el-descriptions :column="2" border size="small" v-loading="detailLoading">
      <el-descriptions-item label="日志ID">{{ detailData?.log_id || '-' }}</el-descriptions-item>
      <el-descriptions-item label="日志标题">{{ detailData?.log_title || '-' }}</el-descriptions-item>
      <el-descriptions-item label="请求地址" :span="2">{{ detailData?.request_path || '-' }}</el-descriptions-item>
      <el-descriptions-item label="日志类型">{{ detailData?.log_type || '-' }}</el-descriptions-item>
      <el-descriptions-item label="操作状态">
        <el-tag v-if="detailData" :type="detailData.success ? 'success' : 'danger'" size="small">{{ detailData.success ? '成功' : '失败' }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="操作用户ID">{{ detailData?.operator_user_id || '-' }}</el-descriptions-item>
      <el-descriptions-item label="操作用户名称">{{ detailData?.operator_user_name || '-' }}</el-descriptions-item>
      <el-descriptions-item label="操作用户身份">{{ detailData?.operator_identity || '-' }}</el-descriptions-item>
      <el-descriptions-item label="租客ID">{{ detailData?.tenant_id || '-' }}</el-descriptions-item>
      <el-descriptions-item label="操作时间">{{ formatDateTime(detailData?.operated_at) }}</el-descriptions-item>
      <el-descriptions-item label="响应时间">{{ detailData?.response_time_ms != null ? `${detailData.response_time_ms}ms` : '-' }}</el-descriptions-item>
      <el-descriptions-item label="客户端IP">{{ detailData?.client_ip || '-' }}</el-descriptions-item>
      <el-descriptions-item label="设备名称">{{ detailData?.device_name || '-' }}</el-descriptions-item>
      <el-descriptions-item label="浏览器名" :span="2">{{ detailData?.browser_name || '-' }}</el-descriptions-item>
      <el-descriptions-item label="操作详情" :span="2">
        <pre class="detail-pre">{{ formatDetail(detailData?.detail) }}</pre>
      </el-descriptions-item>
    </el-descriptions>
    <template #footer>
      <el-button @click="detailVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import ListTemplate from '@/views/common/ListTemplate.vue'
import {
  getOperationLogList,
  getOperationLogDetail,
  searchOperationLogs,
  OPERATION_LOG_SORT_FIELDS,
  OPERATION_LOG_SEARCH_FIELDS,
  type OperationLogItem,
} from '@/api'

/** 排序字段下拉（接口 37/39 白名单） */
const SORT_FIELD_OPTIONS = [
  { label: '操作时间', value: 'operated_at' },
  { label: '响应时间', value: 'response_time_ms' },
  { label: '状态', value: 'success' },
  { label: '日志类型', value: 'log_type' },
  { label: '操作用户ID', value: 'operator_user_id' },
  { label: '用户身份', value: 'operator_identity' },
  { label: '请求地址', value: 'request_path' },
  { label: '日志标题', value: 'log_title' },
]

/** 搜索字段下拉（接口 39 白名单，不支持 time） */
const SEARCH_FIELD_OPTIONS = [
  { label: '日志标题', value: 'log_title' },
  { label: '请求地址', value: 'request_path' },
  { label: '日志类型', value: 'log_type' },
  { label: '操作用户名称', value: 'operator_user_name' },
  { label: '操作详情', value: 'detail' },
]

const tableData = ref<OperationLogItem[]>([])
const loading = ref(false)
const searchForm = reactive({
  field: '' as string,
  value: '',
  sortBy: 'operated_at',
  sortOrder: 'DESC',
})
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailData = ref<OperationLogItem | null>(null)

async function loadData() {
  loading.value = true
  try {
    const hasSearch = searchForm.field && searchForm.value.trim()
    const res = hasSearch
      ? await searchOperationLogs({
          search_field: JSON.stringify([searchForm.field]),
          search_value: JSON.stringify({ [searchForm.field]: searchForm.value.trim() }),
          page: pagination.page,
          sort_by: searchForm.sortBy || undefined,
          sort_order: searchForm.sortOrder || undefined,
        })
      : await getOperationLogList({
          page: pagination.page,
          sort_by: searchForm.sortBy || undefined,
          sort_order: searchForm.sortOrder || undefined,
        })
    tableData.value = res.data.log || []
    pagination.total = res.data.total || 0
  } catch (e) {
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
  Object.assign(searchForm, { field: '', value: '', sortBy: 'operated_at', sortOrder: 'DESC' })
  handleSearch()
}

function handleRefresh() {
  loadData()
}

async function handleDetail(row: OperationLogItem) {
  detailVisible.value = true
  detailLoading.value = true
  detailData.value = null
  try {
    const res = await getOperationLogDetail(row.log_id)
    detailData.value = res.data.log
  } catch (e) {
    ElMessage.error('获取日志详情失败')
  } finally {
    detailLoading.value = false
  }
}

/** 日志类型 → 标签颜色 */
function logTypeTagType(logType: string): 'info' | 'warning' | 'success' | 'danger' | 'primary' {
  const t = (logType || '').trim()
  if (t.includes('删除')) return 'danger'
  if (t.includes('修改') || t.includes('更新')) return 'warning'
  if (t.includes('创建') || t.includes('新增')) return 'success'
  if (t.includes('登录') || t.includes('登陆')) return 'primary'
  return 'info'
}

/** ISO 字符串 → 本地显示（去掉毫秒/T） */
function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  return String(value).replace('T', ' ').replace(/\.\d+$/, '').replace(/\+00:00$/, '').replace(/Z$/, '')
}

/** 尝试美化 detail（JSON 则格式化，否则原样返回） */
function formatDetail(detail: string | null | undefined): string {
  if (!detail) return '-'
  try {
    return JSON.stringify(JSON.parse(detail), null, 2)
  } catch {
    return detail
  }
}

onMounted(() => { loadData() })
</script>

<style scoped>
.detail-pre {
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 260px;
  overflow: auto;
  margin: 0;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
