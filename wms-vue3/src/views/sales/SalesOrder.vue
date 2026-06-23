<template>
  <ListTemplate
    title="销售订单"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
    :show-export="true"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="销售订单"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="单据编号"><el-input v-model="searchForm.orderNo" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="客户名称"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="单据类型">
          <el-select v-model="searchForm.orderType" placeholder="请选择" clearable style="width:100px">
            <el-option label="正常销售" value="正常销售" />
            <el-option label="样品销售" value="样品销售" />
            <el-option label="赠送" value="赠送" />
          </el-select>
        </el-form-item>
        <el-form-item label="冻结状态">
          <el-select v-model="searchForm.isFrozen" placeholder="请选择" clearable style="width:90px">
            <el-option label="已冻结" :value="true" />
            <el-option label="未冻结" :value="false" />
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
      <el-button @click="handleBatchPrint"><el-icon><Printer /></el-icon>批量打印</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="40" fixed="left" />
        <el-table-column type="index" label="" width="55" align="center" fixed="left" />
        <el-table-column prop="orderNo" label="销售单号" min-width="140" show-overflow-tooltip fixed="left" />
        <el-table-column prop="orderType" label="单据类型" width="90" />
        <el-table-column prop="customerName" label="客户名称" min-width="120" />
        <el-table-column prop="settleType" label="结算方式" width="90" />
        <el-table-column prop="settleBank" label="结算银行" min-width="110" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.settleBank }">{{ row.settleBank || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="销售金额" width="90" align="right" />
        <el-table-column prop="prepayAmount" label="使用预付款金额" width="120" align="right">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.prepayAmount }">{{ row.prepayAmount ?? '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="giftAmount" label="使用赠送金额" width="110" align="right">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.giftAmount }">{{ row.giftAmount ?? '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="roundingAmount" label="抹零金额" width="80" align="right">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.roundingAmount }">{{ row.roundingAmount ?? '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="receivableAmount" label="应收金额" width="90" align="right" />
        <el-table-column prop="customerRemark" label="客户备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.customerRemark }">{{ row.customerRemark || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="单据状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '正常' ? 'success' : 'info'" size="small">{{ row.status || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="outboundDate" label="出库日期" width="100" align="center">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.outboundDate }">{{ row.outboundDate || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="sendDate" label="发送日期" width="100" align="center">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.sendDate }">{{ row.sendDate || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="salesperson" label="销售员" width="80" align="center">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.salesperson }">{{ row.salesperson || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="picker" label="拣货人" width="80" align="center">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.picker }">{{ row.picker || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="printCount" label="打印次数" width="80" align="center">
          <template #default="{ row }">{{ row.printCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column prop="lastPrintTime" label="最后打印时间" width="150" align="center">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.lastPrintTime }">{{ row.lastPrintTime || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="creator" label="创建者" width="80" align="center" />
        <el-table-column prop="createTime" label="创建时间" width="110" align="center">
          <template #default="{ row }">{{ row.createTime ? row.createTime.slice(0, 10) : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="warning" size="small" v-if="!row.isFrozen" @click="handleFreeze(row)">冻结</el-button>
            <el-button link type="success" size="small" v-if="row.isFrozen" @click="handleUnfreeze(row)">解冻</el-button>
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
import { Plus, Printer } from '@element-plus/icons-vue'
import { getSalesOrderList, deleteSalesOrder, freezeSalesOrder, unfreezeSalesOrder, type SalesQueryParams } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<any[]>([])
const selectedRows = ref<any[]>([])
const searchForm = reactive({ orderNo: '', customerName: '', orderType: '', isFrozen: undefined as boolean | undefined })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const exportColumns = [
  { key: 'orderNo', label: '单据编号' }, { key: 'orderType', label: '单据类型' }, { key: 'settleType', label: '结算方式' },
  { key: 'customerName', label: '客户名称' }, { key: 'city', label: '所在城市' }, { key: 'receiver', label: '收货人' },
  { key: 'receiverPhone', label: '收货人电话' }, { key: 'totalAmount', label: '销售金额' }, { key: 'receivableAmount', label: '应收金额' },
  { key: 'isFrozen', label: '冻结状态' }, { key: 'warehouseSendStatus', label: '仓库状态' }, { key: 'createTime', label: '创建时间' }
]

const fallbackData: any[] = [
  { id: '1', orderNo: 'SO-20240301-001', orderType: '正常销售', settleType: '月结', customerName: '华南五金店', city: '广州', isMonthlySettle: true, creditAmount: 50000, currentBalance: 12000, remainingCredit: 38000, receiver: '李经理', receiverPhone: '13800000001', deliveryAddress: '广州市天河区', actualDeliveryAddress: '广州市天河区1号', totalAmount: 15000, receivableAmount: 15000, isFrozen: false, warehouseSendStatus: '', status: '正常', createTime: '2024-03-01 09:00' },
  { id: '2', orderNo: 'SO-20240305-002', orderType: '正常销售', settleType: '现结', customerName: '深圳家居城', city: '深圳', isMonthlySettle: false, creditAmount: 30000, currentBalance: 5000, remainingCredit: 25000, receiver: '王总', receiverPhone: '13800000002', deliveryAddress: '深圳市南山区', actualDeliveryAddress: '深圳市南山区2号', totalAmount: 8000, receivableAmount: 8000, isFrozen: true, warehouseSendStatus: '已发送', status: '正常', createTime: '2024-03-05 10:00' },
  { id: '3', orderNo: 'SO-20240310-003', orderType: '样品销售', settleType: '月结', customerName: '珠海建材公司', city: '珠海', isMonthlySettle: true, creditAmount: 20000, currentBalance: 8000, remainingCredit: 12000, receiver: '张总', receiverPhone: '13800000003', deliveryAddress: '珠海市香洲区', actualDeliveryAddress: '', totalAmount: 500, receivableAmount: 500, isFrozen: false, warehouseSendStatus: '已退回', status: '停用', createTime: '2024-03-10 11:00' },
]

async function loadData() {
  try {
    const res = await getSalesOrderList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize } as SalesQueryParams)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { orderNo, customerName, orderType } = searchForm
    const filtered = fallbackData.filter(r => {
      if (orderNo && !r.orderNo.includes(orderNo)) return false
      if (customerName && !r.customerName.includes(customerName)) return false
      if (orderType && r.orderType !== orderType) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { orderNo: '', customerName: '', orderType: '', isFrozen: undefined }); handleSearch() }
function handleSelectionChange(rows: any[]) { selectedRows.value = rows }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'salesOrder' } }) }
function handleEdit(row: any) {
  sessionStorage.setItem('editData:salesOrder', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'salesOrder', id: row.id, mode: 'edit' } })
}

async function handleFreeze(row: any) {
  try {
    await ElMessageBox.confirm(`确认冻结销售订单「${row.orderNo}」？`, '提示', { confirmButtonText: '确认冻结', type: 'warning' })
    await freezeSalesOrder(row.id)
    ElMessage.success('冻结成功')
    loadData()
  } catch {}
}

async function handleUnfreeze(row: any) {
  try {
    await ElMessageBox.confirm(`确认解冻销售订单「${row.orderNo}」？`, '提示', { confirmButtonText: '确认解冻', type: 'warning' })
    await unfreezeSalesOrder(row.id)
    ElMessage.success('解冻成功')
    loadData()
  } catch {}
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除销售订单「${row.orderNo}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteSalesOrder(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

function handleBatchPrint() {
  if (selectedRows.value.length === 0) { ElMessage.warning('请先选择要打印的订单'); return }
  ElMessage.success('打印任务已提交')
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>