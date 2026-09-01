<template>
  <el-dialog
    title="预收款明细管理"
    :model-value="modelValue"
    width="1000px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div v-loading="loading" class="item-dialog-body">
      <div class="order-info">
        <el-tag type="info" size="small">{{ order?.precollection_no || '-' }}</el-tag>
        <span class="info-text">收款日期：{{ order?.receipt_date || '-' }}</span>
        <span class="info-text">实收合计：{{ order?.total_actual_amount || '-' }}</span>
        <span class="info-text">预收合计：{{ order?.total_prepayment_amount || '-' }}</span>
        <span class="info-text">赠送合计：{{ order?.total_gift_amount || '-' }}</span>
      </div>

      <el-button v-perm="'POST /api/v1/tenant-finance/precollection-orders/items/add'" type="primary" size="small" @click="handleAdd" style="margin-bottom:8px">
        <el-icon><Plus /></el-icon>新增明细
      </el-button>

      <el-table :data="list" size="small" border style="width:100%" v-loading="loading">
        <el-table-column type="index" label="" width="50" align="center" />
        <el-table-column prop="customer_name" label="客户" min-width="140" show-overflow-tooltip />
        <el-table-column prop="actual_amount" label="实收金额" show-overflow-tooltip width="120" align="right" />
        <el-table-column prop="prepayment_amount" label="预收金额" show-overflow-tooltip width="120" align="right" />
        <el-table-column prop="gift_amount" label="赠送金额" show-overflow-tooltip width="110" align="right" />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button v-perm="'POST /api/v1/tenant-finance/precollection-orders/items/update'" link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button v-perm="'POST /api/v1/tenant-finance/precollection-orders/items/delete'" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 选客户弹窗 -->
    <CustomerSelectDialog
      v-model="customerDialogVisible"
      :multiple="true"
      @confirmMultiple="onCustomersConfirmed"
    />

    <!-- 新增/编辑明细表单 -->
    <el-dialog
      v-model="formDialogVisible"
      :title="formMode === 'add' ? '新增明细' : '编辑明细'"
      width="480px"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form :model="form" label-width="100px" size="default">
        <el-form-item label="客户">
          <el-input :model-value="form.customer_name" disabled />
        </el-form-item>
        <el-form-item label="预收金额" required>
          <el-input-number v-model="form.prepayment_amount" :min="0.01" :precision="2" controls-position="right" style="width:100%" />
        </el-form-item>
        <el-form-item label="赠送金额">
          <el-input-number v-model="form.gift_amount" :min="0" :precision="2" controls-position="right" style="width:100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
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
  getPrecollectionOrderDetail, addPrecollectionItems, updatePrecollectionItem, deletePrecollectionItem,
  type PrecollectionOrderListItem, type PrecollectionLineItem
} from '@/api'
import CustomerSelectDialog from '@/views/customer/CustomerSelectDialog.vue'

const props = defineProps<{
  modelValue: boolean
  order: PrecollectionOrderListItem | null
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'changed': []
}>()

const loading = ref(false)
const submitting = ref(false)
const list = ref<PrecollectionLineItem[]>([])
const pendingCustomers = ref<Array<{ customer_id: string; customer_name: string }>>([])
const customerDialogVisible = ref(false)
const formDialogVisible = ref(false)
const formMode = ref<'add' | 'edit'>('add')
const form = reactive({
  precollection_item_id: '',
  customer_id: '',
  customer_name: '',
  prepayment_amount: 0,
  gift_amount: 0,
  remark: ''
})

async function onOpen() {
  list.value = []
  pendingCustomers.value = []
  if (!props.order?.precollection_order_id) return
  await loadItems()
}

async function loadItems() {
  if (!props.order?.precollection_order_id) return
  loading.value = true
  try {
    const res = await getPrecollectionOrderDetail(props.order.precollection_order_id)
    list.value = res.data.items || []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

function handleAdd() { customerDialogVisible.value = true }

function onCustomersConfirmed(customers: Array<{ customer_id: string; customer_name: string }>) {
  if (customers.length === 0) return
  pendingCustomers.value = [...customers]
  fillNextPending()
}

function fillNextPending() {
  const next = pendingCustomers.value.shift()
  if (!next) return
  formMode.value = 'add'
  Object.assign(form, { precollection_item_id: '', customer_id: next.customer_id, customer_name: next.customer_name, prepayment_amount: 0, gift_amount: 0, remark: '' })
  formDialogVisible.value = true
}

function handleEdit(row: PrecollectionLineItem) {
  formMode.value = 'edit'
  Object.assign(form, {
    precollection_item_id: row.precollection_item_id || '',
    customer_id: row.customer_id,
    customer_name: row.customer_name || '',
    prepayment_amount: Number(row.prepayment_amount) || 0,
    gift_amount: Number(row.gift_amount) || 0,
    remark: row.remark || ''
  })
  formDialogVisible.value = true
}

async function handleSubmit() {
  if (form.prepayment_amount <= 0) { ElMessage.warning('预收金额必须大于0'); return }
  if (form.gift_amount < 0) { ElMessage.warning('赠送金额不能为负'); return }
  submitting.value = true
  try {
    if (formMode.value === 'add') {
      await addPrecollectionItems(props.order!.precollection_order_id, [{
        customer_id: form.customer_id,
        prepayment_amount: String(form.prepayment_amount),
        gift_amount: String(form.gift_amount),
        remark: form.remark || undefined
      }])
      ElMessage.success('明细已新增')
    } else {
      await updatePrecollectionItem({
        precollection_item_id: form.precollection_item_id,
        customer_id: form.customer_id,
        prepayment_amount: String(form.prepayment_amount),
        gift_amount: String(form.gift_amount),
        remark: form.remark || undefined
      })
      ElMessage.success('明细已更新')
    }
    formDialogVisible.value = false
    await loadItems()
    emit('changed')
    if (formMode.value === 'add' && pendingCustomers.value.length > 0) fillNextPending()
  } catch {
    // 请求拦截器已统一提示错误
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: PrecollectionLineItem) {
  if (!row.precollection_item_id) return
  try {
    await ElMessageBox.confirm(`确认删除客户「${row.customer_name || ''}」的预收明细？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deletePrecollectionItem(row.precollection_item_id)
    ElMessage.success('删除成功')
    await loadItems()
    emit('changed')
  } catch {
    // 用户取消或请求失败
  }
}
</script>

<style scoped>
.item-dialog-body { min-height: 200px; }
.order-info { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.order-info .info-text { font-size: 13px; color: var(--text-secondary); }
</style>
