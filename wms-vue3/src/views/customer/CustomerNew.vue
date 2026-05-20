<template>
  <ListTemplate
    title="新开拓客户"
    show-import
    show-export
    :import-columns="importColumns"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="新开拓客户列表"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
    @import="handleImport"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="客户名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户类型">
          <el-select v-model="searchForm.type" placeholder="请选择" clearable style="width:110px">
            <el-option label="零售客户" value="零售客户" />
            <el-option label="批发客户" value="批发客户" />
            <el-option label="VIP客户" value="VIP客户" />
          </el-select>
        </el-form-item>
        <el-form-item label="转换状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:100px">
            <el-option label="未转换" value="未转换" />
            <el-option label="已转换" value="已转换" />
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
        <el-table-column prop="name" label="客户名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="city" label="所在城市" width="100" />
        <el-table-column prop="contactPerson" label="负责人" width="90" />
        <el-table-column prop="contactPhone" label="联系电话" width="120" />
        <el-table-column prop="type" label="客户类型" width="100" />
        <el-table-column prop="areaName" label="所属区域" width="90" />
        <el-table-column prop="level" label="客户规模" width="80" align="center" />
        <el-table-column prop="updateTime" label="更新时间" width="160" />
        <el-table-column prop="status" label="转换状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '已转换' ? 'success' : 'warning'" size="small">{{ row.status || '未转换' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="success" size="small" :disabled="row.status === '已转换'" @click="handleConvert(row)">转为有效客户</el-button>
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
import { getNewDevelopList, convertToFormal, deleteCustomer, type CustomerItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<CustomerItem[]>([])
const selectedIds = ref<string[]>([])
const searchForm = reactive({ name: '', type: '', status: '', isNewDevelop: true })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: CustomerItem[] = [
  { id: '20', code: 'N001', name: '中山某装饰公司', shortName: '某装饰公司', type: '零售客户', category: '', areaId: '1', areaName: '华南区', source: '', level: '小型', industry: '', contactPerson: '赵总', contactPhone: '13500135001', contactEmail: '', province: '广东', city: '中山', district: '', address: '中山市石岐区某路8号', creditCode: '', taxNo: '', bankName: '', bankAccount: '', openingBank: '', invoiceTitle: '', invoicePhone: '', invoiceAddress: '', settleType: '否', creditAmount: 0, creditDays: 0, status: '未转换', isFormal: false, isNewDevelop: true, salesUserId: '2', salesUserName: '陈销售', remark: '', createTime: '2026-03-15 09:00', updateTime: '2026-04-10 09:00', createUserId: '2', createUserName: '陈销售' },
  { id: '21', code: 'N002', name: '珠海某工程公司', shortName: '某工程公司', type: '批发客户', category: '', areaId: '1', areaName: '华南区', source: '', level: '中型', industry: '', contactPerson: '孙经理', contactPhone: '13400134002', contactEmail: '', province: '广东', city: '珠海', district: '', address: '珠海市香洲区某路10号', creditCode: '', taxNo: '', bankName: '', bankAccount: '', openingBank: '', invoiceTitle: '', invoicePhone: '', invoiceAddress: '', settleType: '否', creditAmount: 0, creditDays: 0, status: '已转换', isFormal: false, isNewDevelop: true, salesUserId: '1', salesUserName: '李销售', remark: '', createTime: '2026-02-20 10:00', updateTime: '2026-04-01 10:00', createUserId: '1', createUserName: '李销售' },
]

async function loadData() {
  try {
    const res = await getNewDevelopList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
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
function handleReset() { Object.assign(searchForm, { name: '', type: '', status: '', isNewDevelop: true }); handleSearch() }
function handleSelectionChange(val: CustomerItem[]) { selectedIds.value = val.map(v => v.id) }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'customerNew' } }) }
function handleEdit(row: CustomerItem) {
  sessionStorage.setItem('editData:customerNew', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'customerNew', id: row.id, mode: 'edit' } })
}

async function handleConvert(row: CustomerItem) {
  try {
    await ElMessageBox.confirm(`确认将「${row.name}」转为有效客户？`, '提示', { confirmButtonText: '确认转换', type: 'warning' })
    await convertToFormal(row.id)
    ElMessage.success('转换成功')
    loadData()
  } catch {}
}

async function handleDelete(row: CustomerItem) {
  try {
    await ElMessageBox.confirm(`确认删除客户「${row.name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteCustomer(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

const importColumns = [
  { key: 'name', label: '客户名称' }, { key: 'city', label: '所在城市' },
  { key: 'contactPerson', label: '负责人' }, { key: 'contactPhone', label: '联系电话' },
  { key: 'type', label: '客户类型' }, { key: 'areaName', label: '所属区域' },
  { key: 'level', label: '客户规模' }, { key: 'salesUserName', label: '销售员' },
]

const exportColumns = [
  { key: 'name', label: '客户名称' }, { key: 'city', label: '所在城市' },
  { key: 'contactPerson', label: '负责人' }, { key: 'contactPhone', label: '联系电话' },
  { key: 'type', label: '客户类型' }, { key: 'areaName', label: '所属区域' },
  { key: 'level', label: '客户规模' }, { key: 'salesUserName', label: '销售员' },
  { key: 'status', label: '转换状态' }, { key: 'updateTime', label: '更新时间' },
]

function handleImport(data: any[]) {
  ElMessage.success(`已解析 ${data.length} 条数据，请对接后端接口`)
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
