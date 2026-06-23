<template>
  <ListTemplate
    title="消息模板管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="模板名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="模板编码"><el-input v-model="searchForm.code" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="消息类型">
          <el-select v-model="searchForm.type" placeholder="全部" clearable style="width:120px">
            <el-option label="系统通知" value="系统通知" />
            <el-option label="业务提醒" value="业务提醒" />
            <el-option label="审批消息" value="审批消息" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width:90px">
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
        <el-table-column prop="name" label="模板名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="code" label="模板编码" width="140" show-overflow-tooltip />
        <el-table-column prop="type" label="消息类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="typeTagMap[row.type] || ''" size="small">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="模板内容" min-width="220" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '正常' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" />
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

  <!-- 新增/编辑弹窗 -->
  <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" size="default">
      <el-form-item label="模板名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入模板名称" />
      </el-form-item>
      <el-form-item label="模板编码" prop="code">
        <el-input v-model="form.code" placeholder="请输入模板编码" />
      </el-form-item>
      <el-form-item label="消息类型" prop="type">
        <el-select v-model="form.type" placeholder="请选择消息类型" style="width:100%">
          <el-option label="系统通知" value="系统通知" />
          <el-option label="业务提醒" value="业务提醒" />
          <el-option label="审批消息" value="审批消息" />
        </el-select>
      </el-form-item>
      <el-form-item label="模板内容" prop="content">
        <el-input v-model="form.content" type="textarea" :rows="4" placeholder="请输入模板内容，可使用 {变量名} 作为占位符" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="form.status">
          <el-radio value="正常">正常</el-radio>
          <el-radio value="停用">停用</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getMessageTemplateList, createMessageTemplate, updateMessageTemplate, deleteMessageTemplate, type MessageTemplateItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const tableData = ref<MessageTemplateItem[]>([])
const searchForm = reactive({ name: '', code: '', type: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const typeTagMap: Record<string, string> = { '系统通知': 'info', '业务提醒': 'warning', '审批消息': '' }

const fallbackData: MessageTemplateItem[] = [
  { id: 'T001', name: '审批通知模板', code: 'APPROVE_NOTIFY', type: '审批消息', content: '您有一条待审批的{businessType}，单号：{billNo}，请及时处理。', status: '正常', createTime: '2026-01-01 00:00', updateTime: '2026-05-01 00:00' },
  { id: 'T002', name: '业务提醒模板', code: 'BIZ_REMIND', type: '业务提醒', content: '{content}', status: '正常', createTime: '2026-01-01 00:00', updateTime: '2026-05-01 00:00' },
  { id: 'T003', name: '系统通知模板', code: 'SYS_NOTIFY', type: '系统通知', content: '【系统通知】{content}', status: '正常', createTime: '2026-01-01 00:00', updateTime: '2026-05-01 00:00' },
  { id: 'T004', name: '库存预警模板', code: 'STOCK_WARN', type: '业务提醒', content: '产品「{productName}」库存低于安全库存，当前库存：{current}，安全库存：{safe}。', status: '正常', createTime: '2026-02-01 00:00', updateTime: '2026-05-01 00:00' },
]

async function loadData() {
  try {
    const params = { ...searchForm, page: pagination.page, pageSize: pagination.pageSize }
    const res = await getMessageTemplateList(params)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { name, code, type, status } = searchForm
    const filtered = fallbackData.filter(r => {
      if (name && !r.name.includes(name)) return false
      if (code && !r.code.includes(code)) return false
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
function handleReset() { Object.assign(searchForm, { name: '', code: '', type: '', status: '' }); handleSearch() }

// 弹窗
const dialogVisible = ref(false)
const submitting = ref(false)
const editId = ref<string | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({ name: '', code: '', type: '', content: '', status: '正常', remark: '' })
const rules: FormRules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入模板编码', trigger: 'blur' }],
  type: [{ required: true, message: '请选择消息类型', trigger: 'change' }],
  content: [{ required: true, message: '请输入模板内容', trigger: 'blur' }],
}
const dialogTitle = computed(() => editId.value ? '编辑消息模板' : '新增消息模板')

function handleAdd() {
  editId.value = null
  Object.assign(form, { name: '', code: '', type: '', content: '', status: '正常', remark: '' })
  dialogVisible.value = true
}

function handleEdit(row: MessageTemplateItem) {
  editId.value = row.id
  Object.assign(form, { name: row.name, code: row.code, type: row.type, content: row.content, status: row.status, remark: row.remark || '' })
  dialogVisible.value = true
}

async function handleSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    if (editId.value) {
      await updateMessageTemplate(editId.value, { ...form } as Partial<MessageTemplateItem>)
    } else {
      await createMessageTemplate({ ...form } as Partial<MessageTemplateItem>)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadData()
  } catch {
    ElMessage.error('保存失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: MessageTemplateItem) {
  try {
    await ElMessageBox.confirm(`确认删除模板「${row.name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteMessageTemplate(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>