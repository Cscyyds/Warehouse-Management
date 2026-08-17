<template>
  <div class="customer-gift-usage">
    <el-card class="customer-summary">
      <el-descriptions title="客户赠送概况" :column="4" border>
        <el-descriptions-item label="客户名称">{{ customerSummary?.customer_name ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="赠送余额">{{ formatAmount(customerSummary?.gift_amount) }}</el-descriptions-item>
        <el-descriptions-item label="累计已使用">{{ formatAmount(customerSummary?.cumulative_used_gift_amount) }}</el-descriptions-item>
        <el-descriptions-item label="累计已新增">{{ formatAmount(customerSummary?.cumulative_added_gift_amount) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card class="usage-table" style="margin-top: 16px">
      <el-table
        :data="tableData"
        v-loading="loading"
        border
        stripe
        @sort-change="handleSortChange"
      >
        <el-table-column prop="bill_no" label="单据编号" show-overflow-tooltip width="180" />
        <el-table-column prop="biz_type" label="业务类型" show-overflow-tooltip width="120" />
        <el-table-column prop="record_type" label="变动类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.record_type === 'ADD' ? 'success' : 'danger'">{{ row.record_type === 'ADD' ? '增加' : '使用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="signed_amount" label="金额" width="130" align="right" column-key="amount" sortable="custom">
          <template #default="{ row }">{{ formatAmount(row.signed_amount) }}</template>
        </el-table-column>
        <!-- before_amount/after_amount 为余额快照，后端无排序字段，仅展示 -->
        <el-table-column prop="before_amount" label="变动前余额" width="130" align="right">
          <template #default="{ row }">{{ formatAmount(row.before_amount) }}</template>
        </el-table-column>
        <el-table-column prop="after_amount" label="变动后余额" width="130" align="right">
          <template #default="{ row }">{{ formatAmount(row.after_amount) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150">
          <template #default="{ row }">{{ row.remark ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="created_by_name" label="操作人" show-overflow-tooltip width="120" />
        <el-table-column prop="created_at" label="时间" width="180" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        :page-size="pagination.page_size"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="loadData"
        style="margin-top: 16px; justify-content: flex-end"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getGiftUsageList, type GiftUsageItem } from '@/api'
import { formatTableDate } from '@/utils/date'

const route = useRoute()
const customerId = route.params.customerId as string

const loading = ref(false)
const tableData = ref<GiftUsageItem[]>([])
const customerSummary = ref<{
  customer_id: string
  customer_name: string
  gift_amount: number
  cumulative_used_gift_amount: number
  cumulative_added_gift_amount: number
} | null>(null)

const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
})

const sortBy = ref('')
const sortOrder = ref('')

async function loadData() {
  loading.value = true
  try {
    const res = await getGiftUsageList({
      customer_id: customerId,
      page: pagination.value.page,
      sort_by: sortBy.value || undefined,
      sort_order: sortOrder.value || undefined,
    })
    if (res.data) {
      customerSummary.value = res.data.customer_summary
      tableData.value = res.data.items ?? []
      pagination.value.total = res.data.total
      pagination.value.page_size = res.data.page_size
    }
  } finally {
    loading.value = false
  }
}

function handleSortChange(sort: { prop: string; order: string; column?: { columnKey?: string | null } }) {
  sortBy.value = sort.column?.columnKey || (sort.prop ?? '')
  sortOrder.value = sort.order === 'ascending' ? 'asc' : sort.order === 'descending' ? 'desc' : ''
  pagination.value.page = 1
  loadData()
}

function formatAmount(val: number | undefined): string {
  if (val == null) return '-'
  return val.toLocaleString()
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.customer-gift-usage {
  padding: 16px;
}
</style>
