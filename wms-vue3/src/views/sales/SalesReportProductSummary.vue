<template>
  <ListTemplate title="产品销售汇总表" layout-key="sales-report-product-summary" v-model:page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" :loading="loading" @page-change="loadData">
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="产品编码"><el-input v-model="searchForm.product_code" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品名称"><el-input v-model="searchForm.product_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </template>
    <template #actions><el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button></template>
    <template #table>
      <el-table :data="tableData" stripe border size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries" @sort-change="handleSortChange">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="product_code" label="产品编码" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="product_name" label="产品名称" min-width="160" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="category_name" label="产品类别" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="specification" label="规格" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="unit_name" label="单位" width="60" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="color" label="颜色" width="80" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="actual_sales_qty" label="销售数量" width="100" show-overflow-tooltip align="center" sortable="custom" />
        <el-table-column prop="actual_sales_amount" label="销售金额" width="110" show-overflow-tooltip align="right" sortable="custom" />
        <el-table-column prop="actual_cost_amount" label="成本金额" width="110" show-overflow-tooltip align="right" sortable="custom" />
        <el-table-column prop="actual_profit_amount" label="利润金额" width="110" show-overflow-tooltip align="right" sortable="custom" />
        <el-table-column prop="gross_margin_rate" label="毛利率" width="90" show-overflow-tooltip align="center" sortable="custom" />
        <el-table-column prop="sales_share" label="销售占比" width="90" show-overflow-tooltip align="center" sortable="custom" />
      </el-table>
    </template>
  </ListTemplate>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { z } from 'zod'
import { getProductSalesSummary, type ProductSalesSummaryItem } from '@/api/modules/sales'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'
import { useTableSort } from '@/composables/useTableSort'
import { useAgentPage } from '@/composables/useAgentPage'
import type { WmsAgentActionDefinition } from '@/agent/types'
const loading = ref(false)
const tableData = ref<any[]>([])
const getSummaries = createAmountSummary(['actual_sales_amount', 'actual_cost_amount', 'actual_profit_amount'])
const searchForm = reactive({ product_code: '', product_name: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
let loadRequestSequence = 0
let inFlightLoad: { key: string; promise: Promise<number> } | undefined
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
function getLoadKey(): string {
  return JSON.stringify({ search: searchForm, page: pagination.page, pageSize: pagination.pageSize, sortBy: sortBy.value, sortOrder: sortOrder.value })
}
function loadData(signal?: AbortSignal): Promise<number> {
  const key = getLoadKey()
  if (inFlightLoad?.key === key) return inFlightLoad.promise
  const promise = performLoadData(signal)
  inFlightLoad = { key, promise }
  promise.then(
    () => { if (inFlightLoad?.promise === promise) inFlightLoad = undefined },
    () => { if (inFlightLoad?.promise === promise) inFlightLoad = undefined },
  )
  return promise
}
async function performLoadData(signal?: AbortSignal): Promise<number> {
  const requestSequence = ++loadRequestSequence
  loading.value = true
  try {
    const res = await getProductSalesSummary({
      page: pagination.page,
        page_size: pagination.pageSize,
      sort_by: sortBy.value || undefined,
      sort_order: sortOrder.value || undefined,
      product_code: searchForm.product_code || undefined,
      product_name: searchForm.product_name || undefined
    }, signal ? { signal } : undefined)
    if (requestSequence !== loadRequestSequence) return pagination.total
    tableData.value = res.data.items ?? []
    pagination.total = res.data.total || 0
    return pagination.total
  } catch (error) {
    if (signal?.aborted) throw error
    if (requestSequence !== loadRequestSequence) return pagination.total
    tableData.value = []
    pagination.total = 0
    return 0
  } finally { if (requestSequence === loadRequestSequence) loading.value = false }
}
function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { product_code: '', product_name: '' }); handleSearch() }
async function handleExport() { ElMessage.success('导出任务已提交') }

const productSalesSummarySearchSchema = z.object({
  productName: z.string().trim().optional(),
  productCode: z.string().trim().optional(),
  rankBy: z.enum(['quantity', 'amount', 'profit']).optional(),
  page: z.number().int().positive().optional(),
})

function markdownCell(value: unknown): string {
  return (String(value ?? '-').trim() || '-').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

const productSalesSummarySearchAction = {
  id: 'product-sales-summary.search',
  title: '查询产品销售汇总',
  description: '按产品查询累计销售数量、销售金额、成本、利润和毛利率，并支持按销量、销售额或利润排序。',
  inputSchema: productSalesSummarySearchSchema,
  inputGuide: 'productName?: string, productCode?: string, rankBy?: quantity|amount|profit, page?: positive integer',
  risk: 'read',
  confirmation: 'none',
  execute: async (input, context) => {
    context.signal.throwIfAborted()
    Object.assign(searchForm, {
      product_name: input.productName ?? '',
      product_code: input.productCode ?? '',
    })
    const rankingColumns = { quantity: 'actual_sales_qty', amount: 'actual_sales_amount', profit: 'actual_profit_amount' } as const
    sortBy.value = rankingColumns[input.rankBy ?? 'quantity']
    sortOrder.value = 'DESC'
    pagination.page = input.page ?? 1
    const total = await loadData(context.signal)
    return { total, visible: tableData.value.length, products: tableData.value.slice(0, 3) }
  },
  summarizeResult: ({ total, visible, products }) => [
    `产品销售汇总查询完成，共 **${total}** 条，当前页显示 **${visible}** 条。`,
    '',
    '| 产品 | 销售数量 | 销售金额 | 利润金额 | 毛利率 |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...products.map((product) =>
      `| ${markdownCell(product.product_name)} | ${markdownCell(product.actual_sales_qty)} | ${markdownCell(product.actual_sales_amount)} | ${markdownCell(product.actual_profit_amount)} | ${markdownCell(product.gross_margin_rate)} |`,
    ),
  ].join('\n'),
} satisfies WmsAgentActionDefinition<
  z.infer<typeof productSalesSummarySearchSchema>,
  { total: number; visible: number; products: ProductSalesSummaryItem[] }
>

useAgentPage(
  {
    id: 'sales.product-summary.list',
    title: '产品销售汇总表',
    routePath: '/sales/report/product-summary',
    description: '按产品累计汇总销售数量、金额、成本、利润和毛利率。',
    getContext: () => ({
      visibleProducts: tableData.value.slice(0, 10).map((product) => ({
        productCode: product.product_code,
        productName: product.product_name,
        salesQuantity: product.actual_sales_qty,
        salesAmount: product.actual_sales_amount,
        profitAmount: product.actual_profit_amount,
      })),
    }),
  },
  [productSalesSummarySearchAction],
)
onMounted(() => { loadData() })
</script>
