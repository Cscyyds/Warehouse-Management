<template>
  <ListTemplate title="销量汇总表" :loading="loading" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="产品编码"><el-input v-model="searchForm.productCode" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品名称"><el-input v-model="searchForm.productName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker v-model="searchForm.startDate" type="date" placeholder="开始日期" style="width:130px" value-format="YYYY-MM-DD" />
          <el-date-picker v-model="searchForm.endDate" type="date" placeholder="结束日期" style="width:130px" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button>
    </template>
    <template #table>
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="productCode" label="产品编码" min-width="100" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品名称" min-width="130" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="产品类别" min-width="80" show-overflow-tooltip />
        <el-table-column prop="spec" label="规格" min-width="80" show-overflow-tooltip />
        <el-table-column prop="unit" label="单位" width="60" show-overflow-tooltip />
        <el-table-column prop="salesQuantity" label="销售数量" width="80" align="center" show-overflow-tooltip />
        <el-table-column prop="salesAmount" label="销售金额" width="90" align="center" show-overflow-tooltip />
        <el-table-column prop="returnQuantity" label="退货数量" width="80" align="center" show-overflow-tooltip />
        <el-table-column prop="returnAmount" label="退货金额" width="90" align="center" show-overflow-tooltip />
        <el-table-column prop="netQuantity" label="净销量" width="80" align="center" show-overflow-tooltip />
        <el-table-column prop="netAmount" label="净销售额" width="90" align="center" show-overflow-tooltip />
        <el-table-column prop="purchaseQuantity" label="采购数量" width="80" align="center" show-overflow-tooltip />
        <el-table-column prop="purchaseAmount" label="采购金额" width="90" align="center" show-overflow-tooltip />
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'

/**
 * 占位实现（2026-09-17 由 api/modules/purchase.ts 下沉至此）。
 *
 * 后端目前不存在 /api/v1/tenant-sales-summary/list 端点，权限 SQL 中
 * 也未登记该接口（无菜单/按钮/权限码），且本页当前没有路由入口，属未接线页面。
 * 注意：真正在用的销售汇总页是 views/sales/SalesReportProductSummary.vue
 * （走 GET /api/v1/tenant-sales-orders/product-sales-summary，已登记权限）。
 * 待后端报表接口就绪后：改回 `import { getXxxList } from '@/api'`，
 * 并在 nuomi_wms/docs/菜单按钮功能权限初始化SQL.md 追加 button/api/permission 三件套。
 */
async function getSalesSummaryList(
  _params: Record<string, unknown>
): Promise<{ data: { list: any[]; total: number } }> {
  return { data: { list: [], total: 0 } }
}

const tableData = ref<any[]>([])
const loading = ref(false)
const getSummaries = createAmountSummary(['salesAmount', 'returnAmount', 'netAmount', 'purchaseAmount'])
const searchForm = reactive({ productCode: '', productName: '', startDate: '', endDate: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
async function loadData() {
  loading.value = true
  try {
    const res = await getSalesSummaryList({ ...searchForm, page: pagination.page, page_size: pagination.pageSize, pageSize: pagination.pageSize } as any)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { productCode: '', productName: '', startDate: '', endDate: '' }); handleSearch() }
async function handleExport() {
  try { await getSalesSummaryList({ ...searchForm, page: 1, pageSize: 9999 } as any); ElMessage.success('导出任务已提交') }
  catch { ElMessage.error('导出失败') }
}
onMounted(() => { loadData() })
</script>
