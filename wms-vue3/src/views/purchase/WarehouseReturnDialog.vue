<template>
  <el-dialog
    :title="title"
    :model-value="modelValue"
    width="1000px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 12px"
    >
      仓库退回用于纠正仓库已处理（有实际入库/出库数量）的单据，操作后将创建异常单并暂停该明细的流转。若仓库尚未处理，请改用"撤销发送"。
    </el-alert>

    <el-alert
      v-if="!hasSelectableItems"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 12px"
    >
      当前单据暂无可退回明细。只有实际数量大于 0 且未处于仓库退回中的明细才允许勾选。
    </el-alert>

    <el-table
      ref="tableRef"
      :data="list"
      size="small"
      row-key="itemKey"
      style="width: 100%"
      height="340"
      v-loading="loading"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="40" :selectable="canSelect" />
      <el-table-column type="index" label="" width="50" align="center" />
      <el-table-column prop="product_code" label="产品编码" width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.product_code || '-' }}</template>
      </el-table-column>
      <el-table-column prop="product_name" label="产品名称" min-width="130" show-overflow-tooltip />
      <el-table-column prop="unit_name" label="单位" width="70" show-overflow-tooltip>
        <template #default="{ row }">{{ row.unit_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="actualQty" label="实际数量" width="90" align="right" />
      <el-table-column label="退回数量" width="150" align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="returnQtyMap[row.itemKey]"
            :min="1"
            :max="Math.max(1, Number(row.actualQty))"
            :precision="0"
            size="small"
            controls-position="right"
            style="width: 100%"
            :disabled="!canSelect(row)"
            @click.stop
          />
        </template>
      </el-table-column>
      <el-table-column label="备注" width="150">
        <template #default="{ row }">
          <el-input
            v-model="remarkMap[row.itemKey]"
            size="small"
            placeholder="选填"
            :disabled="!canSelect(row)"
            @click.stop
          />
        </template>
      </el-table-column>
    </el-table>

    <el-form :model="form" label-width="120px" style="margin-top: 16px">
      <el-form-item label="剩余数量处理">
        <el-radio-group v-model="form.remainingQtyHandleMode">
          <el-radio :value="1">结束后释放</el-radio>
          <el-radio :value="0">结束后入库</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="整单退回备注">
        <el-input
          v-model="form.returnRemark"
          type="textarea"
          :rows="2"
          maxlength="500"
          show-word-limit
          placeholder="选填"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <span style="font-size: 12px; color: var(--el-text-color-secondary); margin-right: auto;">
        已选 {{ selected.length }} 条明细
      </span>
      <el-button type="primary" :loading="submitting" :disabled="!hasSelectableItems" @click="handleConfirm">确认退回</el-button>
      <el-button @click="handleClose">取消</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 仓库退回弹窗（入库单 / 退货单共用）
 * 父组件传入已拉取的明细列表（含 actual_in_stock_qty / actual_return_qty），
 * 用户勾选要退回的明细并填写退回数量，提交时通过 confirm 事件回传。
 */
const props = defineProps<{
  modelValue: boolean
  /** 弹窗标题 */
  title: string
  /** 业务类型：inbound=入库单 / return=退货单 */
  bizType: 'inbound' | 'return'
  /** 明细列表，由父组件从详情接口拉取后传入 */
  items: Record<string, any>[]
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [payload: {
    items: Array<{ itemKey: string; return_qty: number; remark?: string }>
    remaining_qty_handle_mode: 0 | 1
    return_remark?: string
  }]
}>()

const tableRef = ref()
const loading = ref(false)
const submitting = ref(false)
const selected = ref<Record<string, any>[]>([])
// 每行退回数量，key 为 itemKey
const returnQtyMap = reactive<Record<string, number>>({})
const remarkMap = reactive<Record<string, string>>({})
const form = reactive<{ remainingQtyHandleMode: 0 | 1; returnRemark: string }>({
  remainingQtyHandleMode: 1,
  returnRemark: ''
})

/** 归一化明细：统一字段名，便于模板渲染 */
const list = computed(() => {
  const idField = props.bizType === 'inbound' ? 'purchase_receipt_item_id' : 'purchase_return_item_id'
  const actualField = props.bizType === 'inbound' ? 'actual_in_stock_qty' : 'actual_return_qty'
  return props.items.map((row) => ({
    ...row,
    itemKey: String(row[idField] || ''),
    actualQty: Number(row[actualField] || 0)
  }))
})

const hasSelectableItems = computed(() => list.value.some((row) => canSelect(row)))

/** 可选条件：实际数量 > 0 且该明细未处于退回中（item_warehouse_return_status === 0） */
function canSelect(row: Record<string, any>): boolean {
  return row.actualQty > 0 && Number(row.item_warehouse_return_status || 0) === 0
}

function onOpen() {
  selected.value = []
  Object.keys(returnQtyMap).forEach((k) => delete returnQtyMap[k])
  Object.keys(remarkMap).forEach((k) => delete remarkMap[k])
  form.remainingQtyHandleMode = 1
  form.returnRemark = ''
  // 初始化默认退回数量为 1（不超出实际数量）
  list.value.forEach((row) => {
    if (row.itemKey && canSelect(row)) {
      returnQtyMap[row.itemKey] = 1
    }
  })
}

function handleSelectionChange(rows: Record<string, any>[]) {
  selected.value = rows
}

function handleConfirm() {
  if (!hasSelectableItems.value) {
    ElMessage.warning('当前单据暂无可退回明细')
    return
  }
  if (selected.value.length === 0) {
    ElMessage.warning('请至少选择一条明细')
    return
  }
  const result: Array<{ itemKey: string; return_qty: number; remark?: string }> = []
  for (const row of selected.value) {
    const key = row.itemKey
    const qty = Number(returnQtyMap[key] || 0)
    if (qty <= 0) {
      ElMessage.warning('退回数量必须大于 0')
      return
    }
    if (qty > Number(row.actualQty)) {
      ElMessage.warning(`退回数量不能超过实际数量（${row.actualQty}）`)
      return
    }
    const item: { itemKey: string; return_qty: number; remark?: string } = { itemKey: key, return_qty: qty }
    const remark = remarkMap[key]
    if (remark) item.remark = remark
    result.push(item)
  }
  submitting.value = true
  emit('confirm', {
    items: result,
    remaining_qty_handle_mode: form.remainingQtyHandleMode,
    return_remark: form.returnRemark || undefined
  })
  submitting.value = false
  handleClose()
}

function handleClose() {
  emit('update:modelValue', false)
}
</script>

<style scoped>
:deep(.el-dialog__body) { padding-top: 12px; }
</style>
