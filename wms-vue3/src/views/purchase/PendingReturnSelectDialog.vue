<template>
  <el-dialog
    title="选择退货明细"
    :model-value="modelValue"
    width="1100px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <el-form :model="filter" inline size="small" class="filter-form">
      <el-form-item label="产品名称">
        <el-input v-model="filter.productName" placeholder="请输入" clearable style="width:150px" @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item label="采购单号">
        <el-input v-model="filter.orderNo" placeholder="请输入" clearable style="width:150px" @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" size="small" @click="handleSearch">查询</el-button>
        <el-button size="small" @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table
      ref="tableRef"
      :data="list"
      size="small"
      row-key="purchase_order_item_id"
      reserve-selection
      style="width:100%"
      height="380"
      v-loading="loading"
      @selection-change="handleSelectionChange"
      @row-click="handleRowClick"
    >
      <el-table-column type="selection" width="40" />
      <el-table-column type="index" label="" width="50" align="center" />
      <el-table-column prop="purchase_order_no" label="采购单号" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row.purchase_order_no || '-' }}</template>
      </el-table-column>
      <el-table-column prop="product_code" label="产品编码" width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.product_code || '-' }}</template>
      </el-table-column>
      <el-table-column prop="product_name" label="产品名称" min-width="130" show-overflow-tooltip />
      <el-table-column prop="category_name" label="产品类型" width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ row.category_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="specification" label="规格" width="90" show-overflow-tooltip>
        <template #default="{ row }">{{ row.specification || '-' }}</template>
      </el-table-column>
      <el-table-column prop="color" label="颜色" width="80" show-overflow-tooltip>
        <template #default="{ row }">{{ row.color || '-' }}</template>
      </el-table-column>
      <el-table-column prop="unit_name" label="单位" width="70" show-overflow-tooltip>
        <template #default="{ row }">{{ row.unit_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="purchase_price" label="采购单价" width="100" align="right" />
      <el-table-column prop="remaining" label="可退数量" width="90" align="right" />
      <el-table-column label="退货单价" width="130" align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="returnPriceMap[row.purchase_order_item_id]"
            :min="0.01"
            :precision="2"
            size="small"
            controls-position="right"
            style="width:100%"
            @click.stop
          />
        </template>
      </el-table-column>
      <el-table-column label="退货数量" width="130" align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="returnQtyMap[row.purchase_order_item_id]"
            :min="1"
            :precision="0"
            size="small"
            controls-position="right"
            style="width:100%"
            @click.stop
          />
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-bar">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        small
        @change="handlePageChange"
      />
    </div>

    <template #footer>
      <span style="font-size:12px; color:var(--el-text-color-secondary); margin-right:auto;">
        已选 {{ selected.length }} 条明细
      </span>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getAvailableOrderItems,
  searchAvailableOrderItems,
  type AvailableOrderItem
} from '@/api'
import { buildSearchParams, unwrapListData } from '@/utils/data'

const props = defineProps<{
  modelValue: boolean
  supplierId: string
  returnType?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [items: Array<{
    purchase_order_id: string
    purchase_order_item_id: string
    purchase_order_no: string
    return_price: number
    return_qty: number
    remaining: number
    product_name: string
    product_code: string
    category_name: string
    specification: string
    color: string
    unit_name: string
    purchase_price: string
  }>]
}>()

const tableRef = ref()
const loading = ref(false)
const list = ref<AvailableOrderItem[]>([])
const selected = ref<AvailableOrderItem[]>([])
const returnPriceMap = reactive<Record<string, number>>({})
const returnQtyMap = reactive<Record<string, number>>({})
const filter = reactive({ productName: '', orderNo: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

function onOpen() {
  selected.value = []
  filter.productName = ''
  filter.orderNo = ''
  pagination.page = 1
  Object.keys(returnPriceMap).forEach(k => delete returnPriceMap[k])
  Object.keys(returnQtyMap).forEach(k => delete returnQtyMap[k])
  loadData()
}

async function loadData() {
  if (!props.supplierId) {
    ElMessage.warning('请先选择供应商')
    return
  }
  const returnType = String(props.returnType || '').trim()
  if (returnType !== '月结' && returnType !== '其他') {
    ElMessage.warning('请先选择供应商并确认其结算类型')
    list.value = []
    pagination.total = 0
    return
  }
  loading.value = true
  const minDelay = new Promise(resolve => setTimeout(resolve, 200))
  try {
    const hasSearch = filter.productName || filter.orderNo
    let res
    if (hasSearch) {
      const { search_field, search_value } = buildSearchParams({
        product_name: filter.productName,
        purchase_order_no: filter.orderNo
      })
      res = await searchAvailableOrderItems({
        supplier_id: props.supplierId,
        return_type: returnType,
        search_field,
        search_value,
        page: pagination.page
      })
    } else {
      res = await getAvailableOrderItems({
        supplier_id: props.supplierId,
        return_type: returnType,
        page: pagination.page
      })
    }
    const { items, total, page_size } = unwrapListData<any>(res)
    // 列表接口返回嵌套结构 { order_no, children: [...] }，搜索接口返回扁平结构
    // 统一展平：children 存在则展开并合并父级 order_no/order_date
    const flatItems: AvailableOrderItem[] = []
    for (const item of items) {
      if (item.children && Array.isArray(item.children)) {
        for (const child of item.children) {
          flatItems.push({
            ...child,
            purchase_order_no: item.order_no || child.purchase_order_no || '',
            order_date: item.order_date || child.order_date || null,
          } as AvailableOrderItem)
        }
      } else {
        flatItems.push(item as AvailableOrderItem)
      }
    }
    list.value = flatItems
    pagination.total = total
    pagination.pageSize = page_size
    list.value.forEach(row => {
      const key = row.purchase_order_item_id
      if (key && returnQtyMap[key] === undefined) {
        returnQtyMap[key] = 1
      }
      if (key && returnPriceMap[key] === undefined) {
        returnPriceMap[key] = Number(row.purchase_price) || 0
      }
    })
  } catch {
    list.value = []
    pagination.total = 0
  } finally {
    await minDelay
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { filter.productName = ''; filter.orderNo = ''; handleSearch() }

function handlePageChange() {
  loadData()
}

function handleSelectionChange(val: AvailableOrderItem[]) {
  selected.value = val
}

function handleRowClick(row: AvailableOrderItem) {
  tableRef.value?.toggleRowSelection(row)
}

function handleConfirm() {
  if (selected.value.length === 0) {
    ElMessage.warning('请至少选择一条明细')
    return
  }
  const missingPrice = selected.value.find(row => {
    const key = row.purchase_order_item_id
    return !returnPriceMap[key] || returnPriceMap[key] <= 0
  })
  if (missingPrice) {
    ElMessage.warning(`产品「${missingPrice.product_name}」的退货单价不能为空`)
    return
  }
  const result = selected.value.map(row => {
    const key = row.purchase_order_item_id
    return {
      purchase_order_id: row.purchase_order_id || '',
      purchase_order_item_id: row.purchase_order_item_id || '',
      purchase_order_no: row.purchase_order_no || '',
      return_price: returnPriceMap[key],
      return_qty: returnQtyMap[key] || 1,
      remaining: Number(row.remaining) || 0,
      product_name: row.product_name || '',
      product_code: row.product_code || '',
      category_name: row.category_name || '',
      specification: row.specification || '',
      color: row.color || '',
      unit_name: '',
      purchase_price: row.purchase_price || ''
    }
  })
  emit('confirm', result)
  handleClose()
}

function handleClose() { emit('update:modelValue', false) }
</script>

<style scoped>
.filter-form { padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.pagination-bar { padding-top: 8px; display: flex; justify-content: flex-end; }
</style>
