<template>
  <el-dialog
    title="冲减记录"
    :model-value="modelValue"
    width="900px"
    :close-on-click-modal="true"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <el-table
      :data="records"
      size="small"
      style="width:100%"
      v-loading="loading"
    >
      <el-table-column type="index" label="" width="50" align="center" />
      <el-table-column prop="receipt_no" label="入库单号" width="150" show-overflow-tooltip />
      <el-table-column prop="deduction_qty" label="冲减数量" width="110" align="right" show-overflow-tooltip />
      <el-table-column prop="receipt_item_status_after_name" label="冲减后状态" width="120" align="center">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.receipt_item_status_after)" size="small">
            {{ row.receipt_item_status_after_name || getStatusLabel(row.receipt_item_status_after) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="purchase_receipt_item_id" label="入库明细ID" width="150" show-overflow-tooltip />
      <el-table-column prop="created_by_name" label="操作人" width="100" show-overflow-tooltip />
      <el-table-column prop="created_at" label="操作时间" width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
      </el-table-column>
    </el-table>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getPurchaseReturnItemDeductionRecords, type DeductionRecord } from '@/api'
import { formatTableDate } from '@/utils/date'

const props = defineProps<{
  modelValue: boolean
  purchaseReturnItemId: string
}>()

defineEmits<{
  'update:modelValue': [val: boolean]
}>()

const loading = ref(false)
const records = ref<DeductionRecord[]>([])

async function onOpen() {
  if (!props.purchaseReturnItemId) return
  loading.value = true
  try {
    const res = await getPurchaseReturnItemDeductionRecords({ purchase_return_item_id: props.purchaseReturnItemId })
    records.value = res.data.records || []
  } catch {
    records.value = []
  } finally {
    loading.value = false
  }
}

function getStatusLabel(status: number): string {
  switch (status) {
    case 0: return '未变更'
    case 1: return '入库已完成'
    case 3: return '已被全部冲减'
    default: return String(status)
  }
}

function getStatusType(status: number): '' | 'success' | 'warning' | 'info' {
  switch (status) {
    case 0: return ''
    case 1: return 'success'
    case 3: return 'info'
    default: return ''
  }
}
</script>
