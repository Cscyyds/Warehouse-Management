<template>
  <div class="detail-page">
    <div class="page-header">
      <div class="page-header-left">
        <el-icon class="back-icon" @click="router.back()"><ArrowLeft /></el-icon>
        <span class="back-label" @click="router.back()">返回</span>
        <span class="header-divider">/</span>
        <h3>供应商授信明细</h3>
      </div>
      <div class="header-actions">
        <el-button type="primary" :icon="Plus" @click="handleAdd">新增/调减</el-button>
      </div>
    </div>

    <!-- 供应商信息头 -->
    <div class="supplier-info">
      <span class="info-item"><label>供应商ID：</label>{{ supplierId || '-' }}</span>
      <span class="info-item"><label>供应商名称：</label>{{ supplierName || '-' }}</span>
      <span class="info-item"><label>编码：</label>{{ supplierCode || '-' }}</span>
    </div>

    <div class="page-body">
      <ListTemplate
        title="授信变动明细"
        show-export
        :export-columns="exportColumns"
        :export-data="tableData"
        :export-file-name="`供应商授信明细_${supplierName || supplierId}`"
        v-model:page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        @page-change="loadData"
      >
        <template #search>
          <el-form :model="searchForm" inline size="default" label-width="80px">
            <el-form-item label="变动类型">
              <el-select v-model="searchForm.recordType" placeholder="全部" clearable style="width:120px">
                <el-option label="增加/退回" value="ADD" />
                <el-option label="扣减" value="USE" />
              </el-select>
            </el-form-item>
            <el-form-item label="业务类型"><el-input v-model="searchForm.bizType" placeholder="如 SUPPLIER_CREDIT_MANUAL" clearable style="width:200px" /></el-form-item>
            <el-form-item label="创建时间">
              <el-date-picker v-model="searchForm.dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width:240px" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSearch">查询</el-button>
              <el-button @click="handleReset">重置</el-button>
            </el-form-item>
          </el-form>
        </template>
        <template #table>
          <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" :cell-style="{ padding: '4px 0' }" @sort-change="onSortChange">
            <el-table-column type="index" label="" width="55" align="center" />
            <el-table-column prop="log_id" label="流水ID" width="150" show-overflow-tooltip />
            <el-table-column prop="bill_no" label="单据编号" width="170" show-overflow-tooltip />
            <el-table-column prop="biz_type" label="业务类型" width="200" show-overflow-tooltip />
            <el-table-column prop="record_type" label="变动类型" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="recordTypeMeta(row).type" size="small">{{ recordTypeMeta(row).label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="amount" label="变动金额" width="120" align="right" sortable="custom">
              <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
            </el-table-column>
            <el-table-column prop="before_amount" label="变动前余额" width="120" align="right">
              <template #default="{ row }">{{ formatMoney(row.before_amount) }}</template>
            </el-table-column>
            <el-table-column prop="after_amount" label="变动后余额" width="120" align="right">
              <template #default="{ row }">
                <span :class="{ 'amount-warning': Number(row.after_amount) < 0 }">{{ formatMoney(row.after_amount) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="created_by_name" label="操作人" width="100" show-overflow-tooltip>
              <template #default="{ row }">{{ row.created_by_name || '-' }}</template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="160" />
            <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.remark || '-' }}</template>
            </el-table-column>
          </el-table>
        </template>
      </ListTemplate>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { ArrowLeft } from '@element-plus/icons-vue'
import { getSupplierCreditLogList, searchSupplierCreditLogs, type SupplierCreditLogItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const route = useRoute()
const router = useRouter()

const supplierId = computed(() => (route.query.supplier_id as string) || '')
const supplierName = computed(() => (route.query.supplier_name as string) || '')
const supplierCode = computed(() => (route.query.supplier_code as string) || '')

// ---------------- 金额格式化 ----------------
function formatMoney(value: unknown) {
  const amount = Number(value ?? 0)
  return isNaN(amount) ? '-' : amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 变动类型：按 record_type + biz_type 区分 增加/退回/扣减
 *  后端 record_type 仅 ADD/USE 两值；ADD 中 PURCHASE_ORDER_DE_AUDIT（反审核退回）为"退回"，其余 ADD 为"增加"，USE 为"扣减" */
function recordTypeMeta(row: { record_type: string; biz_type?: string }): { label: string; type: 'success' | 'danger' | 'warning' | 'info' } {
  const rt = row.record_type
  const bt = row.biz_type || ''
  if (rt === 'ADD' && bt.includes('DE_AUDIT')) return { label: '退回', type: 'danger' }
  if (rt === 'ADD') return { label: '增加', type: 'success' }
  if (rt === 'USE') return { label: '扣减', type: 'warning' }
  return { label: rt || '-', type: 'info' }
}

const tableData = ref<SupplierCreditLogItem[]>([])
const searchForm = reactive<{ recordType: string; bizType: string; dateRange: [string, string] | null }>({
  recordType: '', bizType: '', dateRange: null,
})
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange: onSortChange } = useTableSort(loadData)

const fallbackData: SupplierCreditLogItem[] = [
  { log_id: 'sbl_demo_1', supplier_id: '', biz_no: 'SG202606300001', bill_no: 'SG202606300001', biz_type: 'SUPPLIER_CREDIT_MANUAL', account_item: 'CREDIT', record_type: 'ADD', amount: '10000.00', before_amount: '0.00', after_amount: '10000.00', created_by_name: '示例', created_at: '', remark: '兜底数据' },
]

async function loadData() {
  if (!supplierId.value) {
    tableData.value = []
    pagination.total = 0
    return
  }
  const hasRange = !!searchForm.dateRange && (searchForm.dateRange[0] || searchForm.dateRange[1])
  try {
    // 有筛选条件走 search（固定 supplier_id），否则走 query
    if (searchForm.recordType || searchForm.bizType || hasRange) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.recordType) { searchField.push('record_type'); searchValue.record_type = searchForm.recordType }
      if (searchForm.bizType) { searchField.push('biz_type'); searchValue.biz_type = searchForm.bizType }
      if (searchForm.dateRange && searchForm.dateRange[0]) { searchField.push('start_time'); searchValue.start_time = searchForm.dateRange[0] }
      if (searchForm.dateRange && searchForm.dateRange[1]) { searchField.push('end_time'); searchValue.end_time = searchForm.dateRange[1] }
      const res = await searchSupplierCreditLogs({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        supplier_id: supplierId.value,
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.items ?? []
      pagination.total = res.data.total ?? 0
    } else {
      const res = await getSupplierCreditLogList({
        supplier_id: supplierId.value,
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
      tableData.value = res.data.items ?? []
      pagination.total = res.data.total ?? 0
    }
  } catch {
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = fallbackData.slice(start, start + pagination.pageSize)
    pagination.total = fallbackData.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { recordType: '', bizType: '', dateRange: null })
  handleSearch()
}

function handleAdd() {
  // 跳新增页，并预填供应商
  router.push({
    path: '/purchase/supplier/credit/add',
    query: { supplier_id: supplierId.value, supplier_name: supplierName.value },
  })
}

const exportColumns = [
  { key: 'log_id', label: '流水ID' }, { key: 'bill_no', label: '单据编号' },
  { key: 'biz_type', label: '业务类型' }, { key: 'record_type', label: '变动类型' },
  { key: 'amount', label: '变动金额' }, { key: 'before_amount', label: '变动前余额' },
  { key: 'after_amount', label: '变动后余额' }, { key: 'created_by_name', label: '操作人' },
  { key: 'created_at', label: '创建时间' }, { key: 'remark', label: '备注' },
]

onMounted(() => { loadData() })
</script>

<style scoped>
.detail-page { background: var(--bg-white, #fff); border-radius: var(--radius-md, 8px); box-shadow: var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.04)); }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; border-bottom: 1px solid var(--border-light, #ebeef5); }
.page-header-left { display: flex; align-items: center; gap: 8px; }
.back-icon { cursor: pointer; color: var(--text-secondary, #909399); font-size: 16px; transition: color var(--transition-fast, .2s); }
.back-icon:hover { color: var(--primary, #409eff); }
.back-label { cursor: pointer; font-size: 14px; color: var(--text-secondary, #909399); transition: color var(--transition-fast, .2s); }
.back-label:hover { color: var(--primary, #409eff); }
.header-divider { color: var(--text-tertiary, #c0c4cc); font-size: 14px; margin: 0 2px; }
.page-header h3 { font-size: 15px; font-weight: 600; color: var(--text-primary, #303133); }
.header-actions { display: flex; gap: 8px; }
.supplier-info { display: flex; gap: 32px; padding: 12px 24px; background: var(--el-fill-color-light, #fafafa); border-bottom: 1px solid var(--border-light, #ebeef5); flex-wrap: wrap; }
.info-item { font-size: 13px; color: var(--text-regular, #606266); }
.info-item label { color: var(--text-secondary, #909399); margin-right: 4px; }
.page-body { padding: 12px; }
.amount-warning { color: var(--el-color-danger); }
</style>
