<template>
  <el-dialog
    title="收款单明细管理"
    :model-value="modelValue"
    width="1000px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div v-loading="loading" class="item-dialog-body">
      <div class="order-info">
        <el-tag type="info" size="small">{{ order?.receipt_no || '-' }}</el-tag>
        <span class="info-text">客户：{{ order?.customer_name || '-' }}</span>
        <span class="info-text">收款总额：{{ detail?.total_receipt_amount || '-' }}</span>
        <span class="info-text">订单总额：{{ detail?.total_order_amount || '-' }}</span>
      </div>

      <el-button type="primary" size="small" @click="handleAddItems" style="margin-bottom:8px">
        <el-icon><Plus /></el-icon>新增收款明细
      </el-button>

      <el-table :data="detail?.items || []" size="small" border style="width:100%">
        <el-table-column type="index" label="" width="50" align="center" />
        <el-table-column prop="order_no" label="销售订单号" width="180" show-overflow-tooltip />
        <el-table-column prop="order_amount" label="订单金额" width="120" align="right" show-overflow-tooltip />
        <el-table-column prop="collection_amount" label="收款金额" width="120" align="right" show-overflow-tooltip />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEditItem(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDeleteItem(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 选择销售订单 -->
    <SalesOrderSelectDialog
      v-model="soDialogVisible"
      :customer-id="order?.customer_id || ''"
      @confirm="onSalesOrderConfirmed"
    />

    <!-- 编辑明细 -->
    <el-dialog
      v-model="itemFormVisible"
      title="编辑收款明细"
      width="460px"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form :model="itemForm" label-width="100px" size="default">
        <el-form-item label="销售订单号">
          <el-input :model-value="itemForm.order_no" disabled />
        </el-form-item>
        <el-form-item label="收款金额" required>
          <el-input-number v-model="itemForm.collection_amount" :min="0.01" :precision="2" controls-position="right" style="width:100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="itemForm.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitItemEdit">确定</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { global_opt_width } from '@/utils/data'
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  getCollectionReceiptDetail,
  addCollectionReceiptItems, updateCollectionReceiptItem, deleteCollectionReceiptItem,
  type CollectionReceiptListItem, type CollectionReceiptDetail, type CollectionReceiptItem
} from '@/api'
import SalesOrderSelectDialog from '@/views/sales/SalesOrderSelectDialog.vue'

const props = defineProps<{
  modelValue: boolean
  order: CollectionReceiptListItem | null
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'changed': []
}>()

const loading = ref(false)
const submitting = ref(false)
const detail = ref<CollectionReceiptDetail | null>(null)
const soDialogVisible = ref(false)
const itemFormVisible = ref(false)

const itemForm = reactive({ receipt_item_id: '', order_no: '', collection_amount: 0, remark: '' })

async function onOpen() {
  detail.value = null
  if (!props.order?.receipt_id) return
  await loadDetail()
}

async function loadDetail() {
  if (!props.order?.receipt_id) return
  loading.value = true
  try {
    const res = await getCollectionReceiptDetail(props.order.receipt_id)
    detail.value = res.data
  } catch {
    detail.value = null
  } finally {
    loading.value = false
  }
}

function handleAddItems() {
  soDialogVisible.value = true
}

async function onSalesOrderConfirmed(order: any) {
  submitting.value = true
  try {
    const items = [{
      sales_order_id: order.sales_order_id,
      collection_amount: order.receivable_amount || '0'
    }]
    await addCollectionReceiptItems(props.order!.receipt_id, items)
    ElMessage.success('收款明细已新增')
    await loadDetail()
    emit('changed')
  } catch {
    // error handled by interceptor
  } finally {
    submitting.value = false
  }
}

function handleEditItem(row: CollectionReceiptItem) {
  Object.assign(itemForm, {
    receipt_item_id: row.receipt_item_id,
    order_no: row.order_no,
    collection_amount: Number(row.collection_amount) || 0,
    remark: row.remark || ''
  })
  itemFormVisible.value = true
}

async function submitItemEdit() {
  if (itemForm.collection_amount <= 0) { ElMessage.warning('收款金额必须大于0'); return }
  submitting.value = true
  try {
    await updateCollectionReceiptItem(itemForm.receipt_item_id, {
      collection_amount: String(itemForm.collection_amount),
      remark: itemForm.remark || undefined
    })
    ElMessage.success('明细已更新')
    itemFormVisible.value = false
    await loadDetail()
    emit('changed')
  } catch {
    // error handled by interceptor
  } finally {
    submitting.value = false
  }
}

async function handleDeleteItem(row: CollectionReceiptItem) {
  try {
    await ElMessageBox.confirm(`确认删除销售订单「${row.order_no}」的收款明细？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteCollectionReceiptItem(row.receipt_item_id)
    ElMessage.success('删除成功')
    await loadDetail()
    emit('changed')
  } catch {
    // cancelled or error
  }
}
</script>

<style scoped>
.item-dialog-body { min-height: 300px; }
.order-info { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.order-info .info-text { font-size: 13px; color: var(--text-secondary); }
</style>
