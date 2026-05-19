<template>
  <ListTemplate
    title="未完成消息"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="消息标题"><el-input v-model="searchForm.title" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="消息类型">
          <el-select v-model="searchForm.type" placeholder="全部" clearable style="width:120px">
            <el-option label="系统通知" value="系统通知" />
            <el-option label="业务提醒" value="业务提醒" />
            <el-option label="审批消息" value="审批消息" />
          </el-select>
        </el-form-item>
        <el-form-item label="接收人"><el-input v-model="searchForm.receiver" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="searchForm.priority" placeholder="全部" clearable style="width:100px">
            <el-option label="高" value="高" />
            <el-option label="中" value="中" />
            <el-option label="低" value="低" />
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
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column prop="title" label="消息标题" min-width="160" show-overflow-tooltip />
        <el-table-column prop="type" label="消息类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="typeTagMap[row.type] || ''" size="small">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="templateName" label="消息模板" width="130" show-overflow-tooltip />
        <el-table-column prop="receiverName" label="接收人" width="100" />
        <el-table-column prop="priority" label="优先级" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="priorityTagMap[row.priority]" size="small">{{ row.priority }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="消息内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleMarkDone(row)">标为完成</el-button>
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
import { getPendingMessageList, deleteMessage, markMessageDone, type MessageItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const tableData = ref<MessageItem[]>([])
const searchForm = reactive({ title: '', type: '', receiver: '', priority: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const typeTagMap: Record<string, string> = { '系统通知': 'info', '业务提醒': 'warning', '审批消息': '' }
const priorityTagMap: Record<string, string> = { '高': 'danger', '中': 'warning', '低': 'info' }

const fallbackData: MessageItem[] = [
  { id: '1', title: '采购订单待审批', content: '采购订单 PO-2026001 等待您的审批，请及时处理。', type: '审批消息', templateId: 'T001', templateName: '审批通知模板', receiver: 'user01', receiverName: '张三', status: '未完成', priority: '高', createTime: '2026-05-19 08:30' },
  { id: '2', title: '库存不足预警', content: '产品「螺丝M8」库存低于安全库存，当前库存：50，安全库存：100。', type: '业务提醒', templateId: 'T002', templateName: '库存预警模板', receiver: 'user02', receiverName: '李四', status: '未完成', priority: '高', createTime: '2026-05-19 09:00' },
  { id: '3', title: '系统维护通知', content: '系统将于今晚 22:00 进行例行维护，预计持续 2 小时，请提前做好准备。', type: '系统通知', templateId: 'T003', templateName: '系统通知模板', receiver: 'all', receiverName: '全体用户', status: '未完成', priority: '中', createTime: '2026-05-19 10:00' },
  { id: '4', title: '销售订单超期提醒', content: '销售订单 SO-2026045 已超期未发货，请尽快处理。', type: '业务提醒', templateId: 'T002', templateName: '业务提醒模板', receiver: 'user03', receiverName: '王五', status: '未完成', priority: '中', createTime: '2026-05-18 15:00' },
]

async function loadData() {
  try {
    const params = { ...searchForm, page: pagination.page, pageSize: pagination.pageSize }
    const res = await getPendingMessageList(params)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { title, type, receiver, priority } = searchForm
    const filtered = fallbackData.filter(r => {
      if (title && !r.title.includes(title)) return false
      if (type && r.type !== type) return false
      if (receiver && !r.receiverName.includes(receiver)) return false
      if (priority && r.priority !== priority) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { title: '', type: '', receiver: '', priority: '' }); handleSearch() }
function handleAdd() {}

async function handleMarkDone(row: MessageItem) {
  try {
    await ElMessageBox.confirm(`确认将消息「${row.title}」标记为已完成？`, '提示', { confirmButtonText: '确认', type: 'info' })
    await markMessageDone(row.id)
    ElMessage.success('已标记为完成')
    loadData()
  } catch {}
}

async function handleDelete(row: MessageItem) {
  try {
    await ElMessageBox.confirm(`确认删除消息「${row.title}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteMessage(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>
