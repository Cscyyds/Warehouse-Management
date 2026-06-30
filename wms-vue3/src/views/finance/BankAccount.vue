<template>
  <ListTemplate
    ref="listTemplateRef"
    title="银行账户"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="账户名称"><el-input v-model="searchForm.account_name" placeholder="请输入" clearable style="width:160px" /></el-form-item>
        <el-form-item label="账户账号"><el-input v-model="searchForm.account_no" placeholder="请输入" clearable style="width:160px" /></el-form-item>
        <el-form-item label="开户银行"><el-input v-model="searchForm.bank_name" placeholder="请输入" clearable style="width:150px" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.account_status" placeholder="请选择" clearable style="width:110px">
            <el-option label="正常" value="NORMAL" />
            <el-option label="停用" value="DISABLED" />
            <el-option label="销户" value="CLOSED" />
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
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" v-loading="loading" @sort-change="handleSortChange">
        <el-table-column type="index" label="" width="55" align="center" fixed="left" />
        <el-table-column prop="account_name" label="账户名称" min-width="160" show-overflow-tooltip fixed="left" sortable="custom">
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.account_name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="account_no" label="账户账号" width="180" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="bank_name" label="开户银行" min-width="140" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="opening_balance" label="期初金额" width="130" align="right" sortable="custom">
          <template #default="{ row }">{{ row.opening_balance || '-' }}</template>
        </el-table-column>
        <el-table-column prop="account_status_name" label="状态" width="80" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.account_status)" size="small">{{ statusLabel(row.account_status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="open_date" label="开户时间" width="120" sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.open_date }">{{ row.open_date || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="close_date" label="销户时间" width="120" sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.close_date }">{{ row.close_date || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" sortable="custom" />
        <el-table-column label="操作" width="120" fixed="right" align="center">
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
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getBankAccountList, searchBankAccounts, deleteBankAccount, type BankAccountListItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const listTemplateRef = ref<any>()
const tableData = ref<BankAccountListItem[]>([])
const loading = ref(false)
const searchForm = reactive({ account_name: '', account_no: '', bank_name: '', account_status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

function statusTagType(status?: string) {
  if (status === 'NORMAL') return 'success'
  if (status === 'CLOSED') return 'info'
  return 'warning'
}

/** 状态英文标准值 → 中文（不依赖后端是否返回 account_status_name） */
const STATUS_LABEL: Record<string, string> = { NORMAL: '正常', DISABLED: '停用', CLOSED: '销户' }
function statusLabel(status?: string) {
  if (!status) return '-'
  return STATUS_LABEL[status] || status
}

async function loadData() {
  loading.value = true
  try {
    const hasSearch = searchForm.account_name.trim() || searchForm.account_no.trim() || searchForm.bank_name.trim() || searchForm.account_status
    if (hasSearch) {
      const fields: string[] = []
      const values: Record<string, string> = {}
      if (searchForm.account_name.trim()) { fields.push('account_name'); values['account_name'] = searchForm.account_name.trim() }
      if (searchForm.account_no.trim()) { fields.push('account_no'); values['account_no'] = searchForm.account_no.trim() }
      if (searchForm.bank_name.trim()) { fields.push('bank_name'); values['bank_name'] = searchForm.bank_name.trim() }
      if (searchForm.account_status) { fields.push('account_status'); values['account_status'] = searchForm.account_status }
      const res = await searchBankAccounts({
        search_field: JSON.stringify(fields),
        search_value: JSON.stringify(values),
        page: pagination.page,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.items || []
      pagination.total = res.data.total ?? 0
    } else {
      const res = await getBankAccountList({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.items || []
      pagination.total = res.data.total ?? 0
    }
  } catch {
    // 请求拦截器已统一提示错误，这里保留兜底空表防空白
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { account_name: '', account_no: '', bank_name: '', account_status: '' })
  handleSearch()
}
function handleAdd() { router.push({ path: '/common/add', query: { type: 'bankAccount' } }) }
function handleEdit(row: BankAccountListItem) {
  sessionStorage.setItem('editData:bankAccount', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'bankAccount', id: row.bank_account_id, mode: 'edit' } })
}

async function handleDelete(row: BankAccountListItem) {
  try {
    await ElMessageBox.confirm(`确认删除银行账户「${row.account_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteBankAccount(row.bank_account_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {
    // 用户取消或请求失败（失败已由拦截器提示）
  }
}

onMounted(loadData)
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
:deep(.el-table--small .el-table__cell) { padding: 8px 12px; }
:deep(.el-table--small th.el-table__cell) { padding: 10px 12px; }
</style>
