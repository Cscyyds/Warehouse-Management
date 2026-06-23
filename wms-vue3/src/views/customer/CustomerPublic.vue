<template>
  <ListTemplate
    title="公海客户"
    :show-add="false"
    show-import
    show-export
    :import-columns="importColumns"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="公海客户列表"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
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
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="name" label="客户名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="city" label="所在城市" width="100" />
        <el-table-column prop="contactPerson" label="负责人" width="90" />
        <el-table-column prop="contactPhone" label="联系电话" width="120" />
        <el-table-column prop="type" label="客户类型" width="100" />
        <el-table-column prop="areaName" label="所属区域" width="90" />
        <el-table-column prop="level" label="客户规模" width="80" align="center" />
        <el-table-column prop="updateTime" label="更新时间" width="160" />
        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleConvert(row)">转为有效客户</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getPublicSeaList, claimCustomer, type CustomerItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const tableData = ref<CustomerItem[]>([])
const selectedIds = ref<string[]>([])
const searchForm = reactive({ name: '', type: '', isFormal: false })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: CustomerItem[] = [
  { id: '10', code: 'P001', name: '东莞某五金厂', shortName: '某五金厂', type: '零售客户', category: '', areaId: '1', areaName: '华南区', source: '', level: '中型', industry: '', contactPerson: '陈老板', contactPhone: '13700137001', contactEmail: '', province: '广东', city: '东莞', district: '', address: '东莞市长安镇某路3号', creditCode: '', taxNo: '', bankName: '', bankAccount: '', openingBank: '', invoiceTitle: '', invoicePhone: '', invoiceAddress: '', settleType: '否', creditAmount: 0, creditDays: 0, status: '正常', isFormal: false, isNewDevelop: false, salesUserId: '', salesUserName: '', remark: '', createTime: '2024-06-01 09:00', updateTime: '2026-03-10 09:00', createUserId: '1', createUserName: '管理员' },
  { id: '11', code: 'P002', name: '佛山某建材商行', shortName: '某建材商行', type: '批发客户', category: '', areaId: '1', areaName: '华南区', source: '', level: '小型', industry: '', contactPerson: '李经理', contactPhone: '13600136002', contactEmail: '', province: '广东', city: '佛山', district: '', address: '佛山市禅城区某路5号', creditCode: '', taxNo: '', bankName: '', bankAccount: '', openingBank: '', invoiceTitle: '', invoicePhone: '', invoiceAddress: '', settleType: '否', creditAmount: 0, creditDays: 0, status: '正常', isFormal: false, isNewDevelop: false, salesUserId: '', salesUserName: '', remark: '', createTime: '2024-07-01 10:00', updateTime: '2026-02-20 10:00', createUserId: '1', createUserName: '管理员' },
]

async function loadData() {
  try {
    const res = await getPublicSeaList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { name, type } = searchForm
    const filtered = fallbackData.filter(r => {
      if (name && !r.name.includes(name)) return false
      if (type && r.type !== type) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', type: '', isFormal: false }); handleSearch() }
function handleSelectionChange(val: CustomerItem[]) { selectedIds.value = val.map(v => v.id) }

async function handleConvert(row: CustomerItem) {
  try {
    await ElMessageBox.confirm(`确认将「${row.name}」转为有效客户？`, '提示', { confirmButtonText: '确认转换', type: 'warning' })
    await claimCustomer(row.id)
    ElMessage.success('转换成功')
    loadData()
  } catch {}
}

const importColumns = [
  { key: 'name', label: '客户名称' }, { key: 'city', label: '所在城市' },
  { key: 'contactPerson', label: '负责人' }, { key: 'contactPhone', label: '联系电话' },
  { key: 'type', label: '客户类型' }, { key: 'areaName', label: '所属区域' },
]

const exportColumns = [
  { key: 'name', label: '客户名称' }, { key: 'city', label: '所在城市' },
  { key: 'contactPerson', label: '负责人' }, { key: 'contactPhone', label: '联系电话' },
  { key: 'type', label: '客户类型' }, { key: 'areaName', label: '所属区域' },
  { key: 'level', label: '客户规模' }, { key: 'updateTime', label: '更新时间' },
]

function handleImport(data: any[]) {
  ElMessage.success(`已解析 ${data.length} 条数据，请对接后端接口`)
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
