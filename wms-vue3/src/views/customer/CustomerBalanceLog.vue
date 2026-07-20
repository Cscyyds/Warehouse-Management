<template>
  <div class="customer-balance-log">
    <el-card class="customer-summary">
      <el-descriptions title="客户余额概况" :column="3" border>
        <el-descriptions-item label="客户名称">{{ customerName }}</el-descriptions-item>
        <el-descriptions-item label="当前余额">{{ Number(currentBalance).toLocaleString() }}</el-descriptions-item>
        <el-descriptions-item label="租户">{{ tenantInfo }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card style="margin-top: 16px">
      <el-form :model="searchForm" inline>
        <el-form-item label="业务类型">
          <el-select v-model="searchForm.biz_type" placeholder="全部" clearable style="width: 160px">
            <el-option label="销售订单" value="SALES_ORDER" />
            <el-option label="收款单" value="COLLECTION_RECEIPT" />
            <el-option label="月结收款" value="MONTHLY_COLLECTION" />
            <el-option label="退货" value="RETURN" />
            <el-option label="授信调整" value="CREDIT_ADJUST" />
            <el-option label="赠送调整" value="GIFT_ADJUST" />
            <el-option label="预付款调整" value="PREPAYMENT_ADJUST" />
          </el-select>
        </el-form-item>
        <el-form-item label="变动类型">
          <el-select v-model="searchForm.record_type" placeholder="全部" clearable style="width: 120px">
            <el-option label="增加" value="ADD" />
            <el-option label="使用" value="USE" />
          </el-select>
        </el-form-item>
        <el-form-item label="单据编号">
          <el-input v-model="searchForm.bill_no" placeholder="单据编号" clearable style="width: 180px" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="searchForm.remark" placeholder="备注关键词" clearable style="width: 160px" />
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="margin-top: 16px" v-loading="loading">
      <div v-if="dailyGroups.length === 0 && !loading" class="empty-state">暂无余额变动记录</div>

      <div v-for="group in dailyGroups" :key="group.date" class="daily-group">
        <div class="group-header">
          <span class="group-date">{{ group.date }}</span>
          <span class="group-summary">
            期初: <b>{{ Number(group.day_start_balance).toLocaleString() }}</b>
            &nbsp;&nbsp;期末: <b>{{ Number(group.day_end_balance).toLocaleString() }}</b>
            &nbsp;&nbsp;净变动:
            <b :class="group.day_change_amount >= 0 ? 'positive' : 'negative'">
              {{ group.day_change_amount >= 0 ? '+' : '' }}{{ Number(group.day_change_amount).toLocaleString() }}
            </b>
          </span>
        </div>

        <el-table :data="group.details" border stripe size="small">
          <el-table-column prop="bill_no" label="单据编号" show-overflow-tooltip width="180" />
          <el-table-column prop="biz_type" label="业务类型" show-overflow-tooltip width="130" />
          <el-table-column prop="record_type" label="变动类型" width="100">
            <template #default="{ row }">
              <el-tag :type="row.record_type === 'ADD' ? 'success' : 'danger'" size="small">
                {{ row.record_type === 'ADD' ? '增加' : '使用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="issued_amount" label="增加金额" width="120" align="right">
            <template #default="{ row }">{{ row.issued_amount ? Number(row.issued_amount).toLocaleString() : '-' }}</template>
          </el-table-column>
          <el-table-column prop="used_amount" label="使用金额" width="120" align="right">
            <template #default="{ row }">{{ row.used_amount ? Number(row.used_amount).toLocaleString() : '-' }}</template>
          </el-table-column>
          <el-table-column prop="before_amount" label="变动前" width="120" align="right">
            <template #default="{ row }">{{ Number(row.before_amount).toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="after_amount" label="变动后" width="120" align="right">
            <template #default="{ row }">{{ Number(row.after_amount).toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="140">
            <template #default="{ row }">{{ row.remark ?? '-' }}</template>
          </el-table-column>
          <el-table-column prop="created_by_name" label="操作人" show-overflow-tooltip width="100" />
          <el-table-column prop="created_at" label="时间" width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
          </el-table-column>
        </el-table>
      </div>

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
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getBalanceLogs, searchBalanceLogs, type DailyGroup } from '@/api'
import { formatTableDate } from '@/utils/date'

const route = useRoute()
const customerId = route.params.customerId as string

const loading = ref(false)
const dailyGroups = ref<DailyGroup[]>([])
const currentBalance = ref(0)
const customerName = ref('')
const tenantInfo = ref('')

const dateRange = ref<[string, string] | null>(null)
const searchForm = reactive({
  biz_type: '',
  record_type: '',
  bill_no: '',
  remark: '',
})

const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
})

async function loadData() {
  loading.value = true
  try {
    const hasSearch = searchForm.biz_type || searchForm.record_type || searchForm.bill_no || searchForm.remark || dateRange.value
    let res

    if (hasSearch) {
      const searchField: string[] = []
      const searchValue: string[] = []
      if (searchForm.biz_type) { searchField.push('biz_type'); searchValue.push(searchForm.biz_type) }
      if (searchForm.record_type) { searchField.push('record_type'); searchValue.push(searchForm.record_type) }
      if (searchForm.bill_no) { searchField.push('bill_no'); searchValue.push(searchForm.bill_no) }
      if (searchForm.remark) { searchField.push('remark'); searchValue.push(searchForm.remark) }
      if (dateRange.value?.[0]) { searchField.push('start_time'); searchValue.push(dateRange.value[0]) }
      if (dateRange.value?.[1]) { searchField.push('end_time'); searchValue.push(dateRange.value[1]) }

      res = await searchBalanceLogs({
        customer_id: customerId,
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.value.page,
      })
    } else {
      res = await getBalanceLogs({
        customer_id: customerId,
        page: pagination.value.page,
      })
    }

    if (res.data) {
      dailyGroups.value = res.data.daily_groups ?? []
      currentBalance.value = res.data.current_balance
      customerName.value = res.data.customer_name
      tenantInfo.value = `${res.data.tenant_name} (${res.data.tenant_code})`
      pagination.value.total = res.data.total
      pagination.value.page_size = res.data.page_size
    }
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.value.page = 1
  loadData()
}

function handleReset() {
  searchForm.biz_type = ''
  searchForm.record_type = ''
  searchForm.bill_no = ''
  searchForm.remark = ''
  dateRange.value = null
  pagination.value.page = 1
  loadData()
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.customer-balance-log {
  padding: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #909399;
}

.daily-group {
  margin-bottom: 20px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
}

.group-header {
  background: #f5f7fa;
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #ebeef5;
}

.group-date {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.group-summary {
  font-size: 13px;
  color: #606266;
}

.positive {
  color: #67c23a;
}

.negative {
  color: #f56c6c;
}
</style>
