<template>
  <ListTemplate
    title="拜访任务单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="客户名称"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="任务类型">
          <el-select v-model="searchForm.visitType" placeholder="请选择" clearable style="width:110px">
            <el-option label="上门拜访" value="上门拜访" />
            <el-option label="电话回访" value="电话回访" />
            <el-option label="视频会议" value="视频会议" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="searchForm.auditStatus" placeholder="请选择" clearable style="width:100px">
            <el-option label="待审核" value="待审核" />
            <el-option label="已通过" value="已通过" />
            <el-option label="已驳回" value="已驳回" />
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
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column prop="customerName" label="客户" min-width="150" show-overflow-tooltip />
        <el-table-column prop="contactPerson" label="联系人" width="90" />
        <el-table-column prop="contactPhone" label="电话" width="120" />
        <el-table-column prop="customerAddress" label="拜访地址" min-width="160" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.customerAddress }">{{ row.customerAddress || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="visitType" label="任务类型" width="100" />
        <el-table-column prop="salesUserName" label="销售员" width="90" />
        <el-table-column prop="visitDate" label="拜访时间" width="120" />
        <el-table-column prop="visitEndTime" label="完成时间" width="120">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.visitEndTime }">{{ row.visitEndTime || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="auditStatus" label="审核状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="auditTagType(row.auditStatus)" size="small">{{ row.auditStatus || '待审核' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '正常' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="warning" size="small" :disabled="row.auditStatus === '已通过'" @click="handleAudit(row, '已通过')">通过</el-button>
            <el-button link type="danger" size="small" :disabled="row.auditStatus === '已驳回'" @click="handleAudit(row, '已驳回')">驳回</el-button>
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
import { getVisitList, auditVisit, deleteVisit, type VisitItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<VisitItem[]>([])
const selectedIds = ref<string[]>([])
const searchForm = reactive({ customerName: '', visitType: '', auditStatus: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: VisitItem[] = [
  { id: '1', visitNo: 'VT2026001', title: '季度拜访', customerId: '1', customerName: '广州百诺建材有限公司', customerAddress: '广州市天河区某某路1号', contactPerson: '张总', contactPhone: '13800138001', visitType: '上门拜访', visitMode: '', salesUserId: '1', salesUserName: '李销售', visitDate: '2026-04-25', visitStartTime: '', visitEndTime: '2026-04-25', content: '', result: '', remark: '', status: '正常', auditStatus: '已通过', auditOpinion: '', auditUserId: '', auditUserName: '', auditTime: '', createTime: '2026-04-20 09:00', updateTime: '2026-04-22 09:00', createUserId: '1', createUserName: '李销售' },
  { id: '2', visitNo: 'VT2026002', title: '新客户跟进', customerId: '2', customerName: '深圳鑫源五金贸易', customerAddress: '深圳市南山区某某路2号', contactPerson: '王经理', contactPhone: '13900139002', visitType: '电话回访', visitMode: '', salesUserId: '2', salesUserName: '陈销售', visitDate: '2026-05-10', visitStartTime: '', visitEndTime: '', content: '', result: '', remark: '', status: '正常', auditStatus: '待审核', auditOpinion: '', auditUserId: '', auditUserName: '', auditTime: '', createTime: '2026-04-28 10:00', updateTime: '2026-04-28 10:00', createUserId: '2', createUserName: '陈销售' },
]

function auditTagType(status: string) {
  if (status === '已通过') return 'success'
  if (status === '已驳回') return 'danger'
  return 'warning'
}

async function loadData() {
  try {
    const res = await getVisitList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { customerName, visitType, auditStatus } = searchForm
    const filtered = fallbackData.filter(r => {
      if (customerName && !r.customerName.includes(customerName)) return false
      if (visitType && r.visitType !== visitType) return false
      if (auditStatus && r.auditStatus !== auditStatus) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { customerName: '', visitType: '', auditStatus: '' }); handleSearch() }
function handleSelectionChange(val: VisitItem[]) { selectedIds.value = val.map(v => v.id) }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'customerVisit' } }) }
function handleEdit(row: VisitItem) {
  sessionStorage.setItem('editData:customerVisit', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'customerVisit', id: row.id, mode: 'edit' } })
}

async function handleAudit(row: VisitItem, status: string) {
  const label = status === '已通过' ? '通过' : '驳回'
  try {
    await ElMessageBox.confirm(`确认${label}该拜访任务？`, '审核确认', { confirmButtonText: `确认${label}`, type: 'warning' })
    await auditVisit(row.id, status, '')
    ElMessage.success(`${label}成功`)
    loadData()
  } catch {}
}

async function handleDelete(row: VisitItem) {
  try {
    await ElMessageBox.confirm(`确认删除拜访任务「${row.title}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteVisit(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
