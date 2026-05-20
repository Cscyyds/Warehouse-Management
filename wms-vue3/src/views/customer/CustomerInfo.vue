<template>
  <ListTemplate
    title="正式客户信息"
    show-import
    show-export
    :import-columns="importColumns"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="正式客户列表"
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
            <el-option label="代理商" value="代理商" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属区域">
          <el-select v-model="searchForm.areaId" placeholder="请选择" clearable style="width:110px">
            <el-option label="华南区" value="1" />
            <el-option label="华北区" value="2" />
            <el-option label="华东区" value="3" />
          </el-select>
        </el-form-item>
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
        <el-table-column prop="salesUserName" label="销售员" width="90" />
        <el-table-column prop="settleType" label="是否月结" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.settleType === '是' ? 'primary' : 'info'" size="small">{{ row.settleType || '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="creditAmount" label="授信额度" width="100" align="right">
          <template #default="{ row }">{{ row.creditAmount ? row.creditAmount.toLocaleString() : '-' }}</template>
        </el-table-column>
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
import { getCustomerList, deleteCustomer, type CustomerItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<CustomerItem[]>([])
const selectedIds = ref<string[]>([])
const searchForm = reactive({ name: '', type: '', areaId: '', status: '', isFormal: true })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: CustomerItem[] = [
  { id: '1', code: 'C001', name: '广州百诺建材有限公司', shortName: '百诺建材', type: '批发客户', category: '', areaId: '1', areaName: '华南区', source: '顺丰物流', level: '大型', industry: '建材行业', contactPerson: '张总', contactPhone: '13800138001', contactEmail: '', province: '广东', city: '广州', district: '', address: '广州市天河区某某路1号', creditCode: '', taxNo: '', bankName: '', bankAccount: '', openingBank: '', invoiceTitle: '', invoicePhone: '', invoiceAddress: '', settleType: '是', creditAmount: 500000, creditDays: 30, status: '正常', isFormal: true, isNewDevelop: false, salesUserId: '1', salesUserName: '李销售', remark: '', createTime: '2024-03-01 09:00', updateTime: '2026-04-20 09:00', createUserId: '1', createUserName: '管理员' },
  { id: '2', code: 'C002', name: '深圳鑫源五金贸易', shortName: '鑫源五金', type: 'VIP客户', category: '', areaId: '1', areaName: '华南区', source: '德邦物流', level: '中型', industry: '五金行业', contactPerson: '王经理', contactPhone: '13900139002', contactEmail: '', province: '广东', city: '深圳', district: '', address: '深圳市南山区某某路2号', creditCode: '', taxNo: '', bankName: '', bankAccount: '', openingBank: '', invoiceTitle: '', invoicePhone: '', invoiceAddress: '', settleType: '否', creditAmount: 0, creditDays: 0, status: '正常', isFormal: true, isNewDevelop: false, salesUserId: '2', salesUserName: '陈销售', remark: '', createTime: '2024-03-05 10:00', updateTime: '2026-04-18 10:00', createUserId: '1', createUserName: '管理员' },
]

async function loadData() {
  try {
    const res = await getCustomerList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
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
function handleReset() { Object.assign(searchForm, { name: '', type: '', areaId: '', status: '', isFormal: true }); handleSearch() }
function handleSelectionChange(val: CustomerItem[]) { selectedIds.value = val.map(v => v.id) }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'customerInfo' } }) }
function handleEdit(row: CustomerItem) {
  sessionStorage.setItem('editData:customerInfo', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'customerInfo', id: row.id, mode: 'edit' } })
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
  { key: 'address', label: '详细地址' }, { key: 'contactPerson', label: '负责人' },
  { key: 'contactPhone', label: '联系电话' }, { key: 'type', label: '客户类型' },
  { key: 'areaName', label: '所属区域' }, { key: 'level', label: '客户规模' },
  { key: 'salesUserName', label: '销售员' }, { key: 'settleType', label: '是否月结' },
  { key: 'creditAmount', label: '授信额度' }, { key: 'status', label: '状态' },
]

const exportColumns = [
  { key: 'name', label: '客户名称' }, { key: 'city', label: '所在城市' },
  { key: 'address', label: '详细地址' }, { key: 'contactPerson', label: '负责人' },
  { key: 'contactPhone', label: '联系电话' }, { key: 'type', label: '客户类型' },
  { key: 'areaName', label: '所属区域' }, { key: 'level', label: '客户规模' },
  { key: 'salesUserName', label: '销售员' }, { key: 'settleType', label: '是否月结' },
  { key: 'creditAmount', label: '授信额度' }, { key: 'updateTime', label: '更新时间' },
  { key: 'status', label: '状态' },
]

function handleImport(data: any[]) {
  ElMessage.success(`已解析 ${data.length} 条数据，请对接后端接口`)
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
