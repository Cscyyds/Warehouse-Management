<template>
  <el-dialog
    title="选择冲减入库明细"
    :model-value="modelValue"
    width="1200px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div class="deduction-header">
      <div class="deduction-info">
        <span>商品：<b>{{ productName }}</b></span>
        <span>退货数量：<b>{{ returnQty }}</b></span>
        <span>可退余量：<b>{{ remaining }}</b></span>
        <span>需冲减数量：<b class="text-danger">{{ requiredDeductionQty }}</b></span>
        <span>已选冲减合计：<b :class="deductionTotal >= requiredDeductionQty ? 'text-success' : 'text-warning'">{{ deductionTotal }}</b></span>
      </div>
    </div>

    <el-table
      :data="list"
      size="small"
      row-key="purchase_receipt_item_id"
      style="width:100%"
      height="360"
      v-loading="loading"
    >
      <el-table-column type="index" label="" width="50" align="center" />
      <el-table-column prop="receipt_no" label="入库单号" width="150" show-overflow-tooltip />
      <el-table-column prop="product_code" label="产品编码" width="120" show-overflow-tooltip />
      <el-table-column prop="product_name" label="产品名称" min-width="120" show-overflow-tooltip />
      <el-table-column prop="in_stock_qty" label="可冲减数量" width="110" align="right" />
      <el-table-column prop="planned_in_stock_qty" label="计划入库数" width="110" align="right" />
      <el-table-column prop="actual_in_stock_qty" label="已实际入库" width="110" align="right" />
      <el-table-column prop="warehouse_task_status" label="任务状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="getTaskStatusType(row.warehouse_task_status)" size="small">
            {{ getTaskStatusLabel(row.warehouse_task_status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="冲减数量" width="140" align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="deductionQtyMap[row.purchase_receipt_item_id]"
            :min="0"
            :max="Number(row.in_stock_qty)"
            :precision="4"
            size="small"
            controls-position="right"
            style="width:100%"
          />
        </template>
      </el-table-column>
    </el-table>

    <div class="deduction-footer-info">
      <span>已选冲减合计：<b :class="deductionTotal >= requiredDeductionQty ? 'text-success' : 'text-danger'">{{ deductionTotal }}</b></span>
      <span v-if="deductionTotal < requiredDeductionQty" class="text-danger">
        还差 {{ (requiredDeductionQty - deductionTotal).toFixed(4) }}
      </span>
      <span v-else class="text-success">已满足冲减要求</span>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :disabled="!canConfirm" @click="handleConfirm">确认冲减</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getAvailableReceiptItemsForDeduction,
  type AvailableDeductionReceiptItem,
  type ReceiptItemDeduction
} from '@/api'

const props = defineProps<{
  modelValue: boolean
  purchaseOrderItemId: string
  requiredDeductionQty: number
  returnQty: number | string
  remaining: number | string
  productName: string
  existingDeductions?: ReceiptItemDeduction[]
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [deductions: ReceiptItemDeduction[]]
}>()

const loading = ref(false)
const list = ref<AvailableDeductionReceiptItem[]>([])
const deductionQtyMap = reactive<Record<string, number>>({})

const deductionTotal = computed(() => {
  return Object.values(deductionQtyMap).reduce((sum, qty) => sum + (qty || 0), 0)
})

const canConfirm = computed(() => {
  return deductionTotal.value >= props.requiredDeductionQty && deductionTotal.value > 0
})

function onOpen() {
  Object.keys(deductionQtyMap).forEach(k => delete deductionQtyMap[k])
  loadData()
}

async function loadData() {
  if (!props.purchaseOrderItemId) {
    ElMessage.warning('缺少采购明细ID')
    return
  }
  loading.value = true
  const minDelay = new Promise(resolve => setTimeout(resolve, 200))
  try {
    const res = await getAvailableReceiptItemsForDeduction({ purchase_order_item_id: props.purchaseOrderItemId })
    list.value = res.data.items || []
    // 回填已有冲减数据
    if (props.existingDeductions && props.existingDeductions.length > 0) {
      props.existingDeductions.forEach(d => {
        if (d.purchase_receipt_item_id) {
          deductionQtyMap[d.purchase_receipt_item_id] = Number(d.deduction_qty) || 0
        }
      })
    }
    // 未回填的行初始化为 0
    list.value.forEach(row => {
      if (deductionQtyMap[row.purchase_receipt_item_id] === undefined) {
        deductionQtyMap[row.purchase_receipt_item_id] = 0
      }
    })
  } catch {
    list.value = []
  } finally {
    await minDelay
    loading.value = false
  }
}

function handleConfirm() {
  const deductions: ReceiptItemDeduction[] = []
  for (const row of list.value) {
    const qty = deductionQtyMap[row.purchase_receipt_item_id] || 0
    if (qty <= 0) continue
    if (qty > Number(row.in_stock_qty)) {
      ElMessage.warning(`入库单"${row.receipt_no}"的冲减数量不能超过可冲减数量 ${row.in_stock_qty}`)
      return
    }
    deductions.push({
      purchase_receipt_item_id: row.purchase_receipt_item_id,
      deduction_qty: qty
    })
  }
  if (deductions.length === 0) {
    ElMessage.warning('请至少为一条入库明细填写冲减数量')
    return
  }
  const total = deductions.reduce((sum, d) => sum + Number(d.deduction_qty), 0)
  if (total < props.requiredDeductionQty) {
    ElMessage.warning(`冲减合计 ${total} 不足，需要至少 ${props.requiredDeductionQty}`)
    return
  }
  emit('confirm', deductions)
  handleClose()
}

function handleClose() {
  emit('update:modelValue', false)
}

function getTaskStatusLabel(status: number): string {
  switch (status) {
    case 0: return '未完成'
    case 1: return '已完成'
    case 3: return '被全部冲减'
    default: return String(status)
  }
}

function getTaskStatusType(status: number): '' | 'success' | 'warning' | 'info' | 'danger' {
  switch (status) {
    case 0: return 'warning'
    case 1: return 'success'
    case 3: return 'info'
    default: return ''
  }
}
</script>

<style scoped>
.deduction-header { margin-bottom: 12px; padding: 10px 12px; background: var(--el-fill-color-light); border-radius: 4px; }
.deduction-info { display: flex; gap: 20px; flex-wrap: wrap; font-size: 13px; color: var(--el-text-color-regular); }
.deduction-info b { color: var(--el-text-color-primary); }
.text-danger { color: var(--el-color-danger) !important; }
.text-warning { color: var(--el-color-warning) !important; }
.text-success { color: var(--el-color-success) !important; }
.deduction-footer-info { padding: 10px 0 0; font-size: 13px; display: flex; gap: 16px; align-items: center; }
</style>
