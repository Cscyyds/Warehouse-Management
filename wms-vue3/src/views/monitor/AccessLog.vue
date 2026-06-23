<template>
  <ListTemplate
    title="访问日志"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="日志标题"><el-input v-model="searchForm.title" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="日志类型">
          <el-select v-model="searchForm.logType" placeholder="全部" clearable style="width:120px">
            <el-option label="查询日志" value="查询日志" />
            <el-option label="修改日志" value="修改日志" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作用户"><el-input v-model="searchForm.operator" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="异常">
          <el-select v-model="searchForm.isException" placeholder="全部" clearable style="width:100px">
            <el-option label="是" value="true" />
            <el-option label="否" value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button type="danger" plain @click="handleClear">
        <el-icon><Delete /></el-icon>清空日志
      </el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="title" label="日志标题" min-width="140" show-overflow-tooltip />
        <el-table-column prop="requestUrl" label="请求地址" min-width="180" show-overflow-tooltip />
        <el-table-column prop="logType" label="日志类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.logType === '修改日志' ? 'warning' : 'info'" size="small">{{ row.logType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作用户" width="100" />
        <el-table-column prop="isException" label="异常" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isException ? 'danger' : 'success'" size="small">{{ row.isException ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="businessType" label="业务类型" width="100" />
        <el-table-column prop="businessKey" label="业务主键" width="100" show-overflow-tooltip />
        <el-table-column prop="operateTime" label="操作时间" width="160" />
        <el-table-column prop="clientIp" label="客户端IP" width="130" />
        <el-table-column prop="deviceName" label="设备名称" width="110" show-overflow-tooltip />
        <el-table-column prop="browserName" label="浏览器名" width="110" show-overflow-tooltip />
        <el-table-column prop="responseTime" label="响应时间" width="90" align="center">
          <template #default="{ row }">
            {{ row.responseTime }}ms
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { getAccessLogList, deleteAccessLog, clearAccessLogs, type AccessLogItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const tableData = ref<AccessLogItem[]>([])
const searchForm = reactive({ title: '', logType: '', operator: '', isException: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: AccessLogItem[] = [
  { id: '1', title: '查询人员列表', requestUrl: '/api/system/personnel/list', logType: '查询日志', operator: '管理员', isException: false, businessType: '人事管理', businessKey: '-', operateTime: '2026-05-19 09:12', clientIp: '192.168.1.100', deviceName: 'Windows 11', browserName: 'Chrome 125', responseTime: 45 },
  { id: '2', title: '修改用户状态', requestUrl: '/api/system/personnel/status', logType: '修改日志', operator: '管理员', isException: false, businessType: '人事管理', businessKey: 'USR001', operateTime: '2026-05-19 09:08', clientIp: '192.168.1.100', deviceName: 'Windows 11', browserName: 'Chrome 125', responseTime: 120 },
  { id: '3', title: '查询角色列表', requestUrl: '/api/system/role/list', logType: '查询日志', operator: '张三', isException: false, businessType: '角色管理', businessKey: '-', operateTime: '2026-05-19 08:55', clientIp: '192.168.1.101', deviceName: 'macOS 15', browserName: 'Safari 18', responseTime: 38 },
  { id: '4', title: '删除字典数据', requestUrl: '/api/system/dict-data/5', logType: '修改日志', operator: '管理员', isException: true, businessType: '字典管理', businessKey: 'DICT005', operateTime: '2026-05-19 08:42', clientIp: '192.168.1.100', deviceName: 'Windows 11', browserName: 'Chrome 125', responseTime: 502 },
  { id: '5', title: '查询参数配置', requestUrl: '/api/system/param/list', logType: '查询日志', operator: '李四', isException: false, businessType: '参数设置', businessKey: '-', operateTime: '2026-05-19 08:30', clientIp: '192.168.1.105', deviceName: 'Windows 10', browserName: 'Edge 125', responseTime: 52 },
]

async function loadData() {
  try {
    const params = { ...searchForm, page: pagination.page, pageSize: pagination.pageSize }
    const res = await getAccessLogList(params)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { title, logType, operator, isException } = searchForm
    const filtered = fallbackData.filter(r => {
      if (title && !r.title.includes(title)) return false
      if (logType && r.logType !== logType) return false
      if (operator && !r.operator.includes(operator)) return false
      if (isException && String(r.isException) !== isException) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { title: '', logType: '', operator: '', isException: '' })
  handleSearch()
}
function handleAdd() {}

async function handleDelete(row: AccessLogItem) {
  try {
    await ElMessageBox.confirm('确认删除该日志？', '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteAccessLog(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

async function handleClear() {
  try {
    await ElMessageBox.confirm('确认清空全部访问日志？此操作不可恢复。', '提示', { confirmButtonText: '确认清空', type: 'warning' })
    await clearAccessLogs()
    ElMessage.success('日志已清空')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>