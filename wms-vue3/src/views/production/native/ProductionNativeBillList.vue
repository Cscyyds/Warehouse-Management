<template>
  <ListTemplate :title="title" v-model:page="page" v-model:page-size="pageSize"
    :total="total" :loading="loading" :columns="columns" :table-data="rows"
    pagination-mode="server" row-key="bill_id" :show-add="false" :actions-width="250"
    @page-change="load" @sort-change="changeSort">
    <template #actions>
      <el-button v-perm="nativePermission('POST', docKey, 'create')" type="primary" @click="router.push(`${path}/create`)">
        <el-icon><Plus /></el-icon>新建
      </el-button>
      <el-button :loading="loading" @click="load()"><el-icon><Refresh /></el-icon>刷新</el-button>
    </template>
    <template #search>
      <el-form inline @submit.prevent="search">
        <el-form-item label="查询字段">
          <el-select v-model="field" style="width: 135px">
            <el-option v-for="option in searchFields" :key="option.value" :value="option.value" :label="option.label" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-date-picker v-if="field === 'bill_date'" v-model="dateRange" type="daterange"
            value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" />
          <el-input v-else v-model="keyword" clearable maxlength="191" placeholder="请输入查询内容" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit">查询</el-button>
          <el-button @click="reset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #col-bill_no="{ row }">
      <el-link type="primary" :underline="false" @click="openDetail(row)">{{ row.bill_no }}</el-link>
    </template>
    <template #col-created_at="{ row }">{{ formatNativeDateTime(row.created_at) }}</template>
    <template #col-send_at="{ row }">{{ formatNativeDateTime(row.send_at) }}</template>
    <template #col-audit_status_name="{ row }">
      <el-tag size="small" :type="row.audit_status === 1 ? 'success' : row.audit_status === 3 ? 'danger' : 'info'">{{ row.audit_status_name }}</el-tag>
    </template>
    <template #col-warehouse_status_name="{ row }">
      <el-tag size="small" :type="row.warehouse_status === 3 ? 'success' : row.warehouse_status === 1 ? 'warning' : 'info'">{{ row.warehouse_status_name }}</el-tag>
    </template>
    <template #col-business_status_name="{ row }">
      <el-tag size="small" :type="row.business_status === 'EXCEPTION' ? 'danger' : 'info'">{{ row.business_status_name }}</el-tag>
    </template>
    <template #col-actions="{ row }">
      <el-button link type="primary" @click="openDetail(row)">详情</el-button>
      <template v-for="action in BILL_ACTIONS" :key="action.key">
        <el-button v-if="canRunBillAction(action.key, row)" v-perm="nativePermission('POST', docKey, action.endpoint)"
          link :type="action.key === 'delete' ? 'danger' : 'primary'" @click="selectAction(row, action.key)">{{ action.label }}</el-button>
      </template>
    </template>
  </ListTemplate>
  <BillActionDialog :doc-key="docKey" :bill="target" :action="selectedAction"
    @close="closeAction" @done="finishAction" @stale="refreshStaleAction" />
</template>

<script setup lang="ts">
import { showErrorDialog } from '@/utils/errorFeedback'
import { onActivated, onMounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { listNativeBills, searchNativeBills, type NativeDocKey, type NativeHeaderRow, type NativeListQuery, type NativeSearchCondition } from '@/api/modules/productionNative'
import { BILL_ACTIONS, canRunBillAction, nativeBillColumns, nativeBillPath, nativePermission, type BillAction } from '@/config/productionNativeDocConfig'
import BillActionDialog from './components/BillActionDialog.vue'
import { formatNativeDateTime, nativeError } from './nativeBillForm'

const route = useRoute()
const router = useRouter()
const docKey = route.meta.docKey as NativeDocKey
const title = String(route.meta.title)
const path = nativeBillPath(docKey)
const columns = nativeBillColumns(docKey)
const rows = shallowRef<NativeHeaderRow[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const loading = ref(false)
const field = ref('bill_no')
const keyword = ref('')
const dateRange = ref<[string, string] | null>(null)
const condition = shallowRef<NativeSearchCondition>()
const target = ref<NativeHeaderRow | null>(null)
const selectedAction = ref<BillAction | null>(null)
let sort: NativeListQuery = {}
let queryId = 0

const searchFields = [
  { value: 'bill_no', label: '单据编号' }, { value: 'product_code', label: '产品编码' },
  { value: 'product_name', label: '产品名称' }, { value: 'remark', label: '备注' },
  { value: 'created_by_name', label: '创建人' }, { value: 'bill_date', label: '单据日期' },
  ...(docKey === 'production-return' ? [{ value: 'source_picking_no', label: '来源领料单号' }] : []),
]

async function load() {
  const current = ++queryId
  loading.value = true
  try {
    const query = { page: page.value, page_size: pageSize.value, ...sort }
    const options = { silent: true }
    const { data } = condition.value
      ? await searchNativeBills(docKey, { ...query, condition: condition.value }, options)
      : await listNativeBills(docKey, query, options)
    if (current !== queryId) return
    const lastPage = Math.max(1, Math.ceil(data.total / data.page_size))
    if (page.value > lastPage) { page.value = lastPage; await load(); return }
    rows.value = data.items
    total.value = data.total
    page.value = data.page
    pageSize.value = data.page_size
  } catch (err) {
    if (current === queryId) showErrorDialog(nativeError(err).message)
  } finally {
    if (current === queryId) loading.value = false
  }
}

function search() {
  const [start, end] = dateRange.value || []
  const value = field.value === 'bill_date' ? (start && end ? { start_time: start, end_time: end } : '') : keyword.value.trim()
  condition.value = value ? { fields: [field.value], values: { [field.value]: value } } : undefined
  page.value = 1
  void load()
}

function reset() {
  field.value = 'bill_no'
  keyword.value = ''
  dateRange.value = null
  search()
}

function changeSort({ prop, order }: { prop: string; order: string | null }) {
  sort = order ? { sort_by: prop, sort_order: order === 'ascending' ? 'asc' : 'desc' } : {}
  page.value = 1
  void load()
}

function openDetail(row: NativeHeaderRow) {
  void router.push(`${path}/detail/${encodeURIComponent(row.bill_id)}`)
}

function selectAction(bill: NativeHeaderRow, action: BillAction) {
  target.value = bill
  selectedAction.value = action
}

function closeAction() {
  target.value = null
  selectedAction.value = null
}

function finishAction() {
  closeAction()
  void load()
}

function refreshStaleAction() {
  finishAction()
  showErrorDialog('单据已更新，请确认最新状态后重新操作')
}

onMounted(load)
onActivated(() => { if (!loading.value) void load() })
</script>
