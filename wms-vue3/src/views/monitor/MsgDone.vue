<template>
  <ListTemplate
    title="已完成消息"
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
        <el-table-column prop="finishTime" label="完成时间" width="160" />
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
import { getDoneMessageList, deleteMessage, type MessageItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const tableData = ref<MessageItem[]>([])
const searchForm = reactive({ title: '', type: '', receiver: '', priority: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const typeTagMap: Record<string, string> = { '系统通知': 'info', '业务提醒': 'warning', '审批消息': '' }
const priorityTagMap: Record<string, string> = { '高': 'danger', '中': 'warning', '低': 'info' }

const fallbackData: MessageItem[] = [
  { id: '10', title: '入库单审批通过', content: '入库单 IN-2026012 已审批通过，请安排入库操作。', type: '审批消息', templateId: 'T001', templateName: '审批通知模板', receiver: 'user01', receiverName: '张三', status: '已完成', priority: '高', createTime: '2026-05-18 09:00', finishTime: '2026-05-18 10:30' },
  { id: '11', title: '月度报表生成完成', content: '2026年4月月度销售报表已生成，请前往报表中心查看。', type: '系统通知', templateId: 'T003', templateName: '系统通知模板', receiver: 'user02', receiverName: '李四', status: '已完成', priority: '低', createTime: '2026-05-01 08:00', finishTime: '2026-05-01 08:05' },
  { id: '12', title: '客户授信额度调整', content: '客户「百诺五金」授信额度已调整为 50 万元，生效日期：2026-05-15。', type: '业务提醒', templateId: 'T002', templateName: '业务提醒模板', receiver: 'user03', receiverName: '王五', status: '已完成', priority: '中', createTime: '2026-05-15 14:00', finishTime: '2026-05-15 16:00' },
]

async function loadData() {
  try {
    const params = { ...searchForm, page: pagination.page, pageSize: pagination.pageSize }
    const res = await getDoneMessageList(params)
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
