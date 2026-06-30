<template>
  <el-dialog
    title="预付款明细管理"
    :model-value="modelValue"
    width="1000px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div v-loading="loading" class="item-dialog-body">
      <div class="order-info">
        <el-tag type="info" size="small">{{ order?.prepayment_no || '-' }}</el-tag>
        <span class="info-text">付款日期：{{ order?.payment_date || '-' }}</span>
        <span class="info-text">实付合计：{{ order?.total_actual_amount || '-' }}</span>
        <span class="info-text">预付合计：{{ order?.total_prepayment_amount || '-' }}</span>
        <span class="info-text">赠送合计：{{ order?.total_gift_amount || '-' }}</span>
      </div>

      <el-button type="primary" size="small" @click="handleAdd" style="margin-bottom:8px">
        <el-icon><Plus /></el-icon>新增明细
      </el-button>

      <el-table :data="list" size="small" border style="width:100%" v-loading="loading">
        <el-table-column type="index" label="" width="50" align="center" />
        <el-table-column prop="supplier_name" label="供应商" min-width="140" show-overflow-tooltip />
        <el-table-column prop="supplier_bank_account" label="供应商银行账号" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.supplier_bank_account || '-' }}</template>
        </el-table-column>
        <el-table-column prop="supplier_bank_name" label="供应商开户银行" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.supplier_bank_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="actual_amount" label="实付金额" width="110" align="right" />
        <el-table-column prop="prepayment_amount" label="预付金额" width="110" align="right" />
        <el-table-column prop="gift_amount" label="赠送金额" width="110" align="right" />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新增：选供应商 -->
    <SupplierSelectDialog
      v-model="supplierDialogVisible"
      :multiple="true"
      @confirmMultiple="onSupplierConfirmed"
    />

    <!-- 新增/编辑明细表单弹窗 -->
    <el-dialog
      v-model="formDialogVisible"
      :title="formMode === 'add' ? '新增明细' : '编辑明细'"
      width="520px"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form :model="form" label-width="120px" size="default">
        <el-form-item label="供应商">
          <el-input :model-value="form.supplier_name" disabled />
        </el-form-item>
        <el-form-item label="供应商银行账号">
          <el-input v-model="form.supplier_bank_account" placeholder="请输入供应商银行账号" clearable />
        </el-form-item>
        <el-form-item label="供应商开户银行">
          <el-input v-model="form.supplier_bank_name" placeholder="请输入开户银行" clearable />
        </el-form-item>
        <el-form-item label="实付金额" required>
          <el-input-number v-model="form.actual_amount" :min="0.01" :precision="2" controls-position="right" style="width:100%" />
        </el-form-item>
        <el-form-item label="预付金额" required>
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
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  getPrepaymentOrderDetail, addPrepaymentOrderItems, updatePrepaymentOrderItem, deletePrepaymentOrderItem,
  type PrepaymentOrderListItem, type PrepaymentLineItem
} from '@/api'
import SupplierSelectDialog from '@/views/purchase/SupplierSelectDialog.vue'

const props = defineProps<{
  modelValue: boolean
  order: PrepaymentOrderListItem | null
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'changed': []
}>()

const loading = ref(false)
const submitting = ref(false)
const list = ref<PrepaymentLineItem[]>([])

// 待新增的供应商队列（选完供应商后逐个填金额）
const pendingSuppliers = ref<Array<{ supplier_id: string; supplier_name: string }>>([])

const supplierDialogVisible = ref(false)
const formDialogVisible = ref(false)
const formMode = ref<'add' | 'edit'>('add')
const form = reactive({
  prepayment_item_id: '',
  supplier_id: '',
  supplier_name: '',
  supplier_bank_account: '',
  supplier_bank_name: '',
  actual_amount: 0,
  prepayment_amount: 0,
  gift_amount: 0,
  remark: ''
})

async function onOpen() {
  list.value = []
  pendingSuppliers.value = []
  if (!props.order?.prepayment_order_id) return
  await loadItems()
}

async function loadItems() {
  if (!props.order?.prepayment_order_id) return
  loading.value = true
  try {
    // 详情返回主表 + items，明细列表取 items
    const res = await getPrepaymentOrderDetail(props.order.prepayment_order_id)
    list.value = res.data.items || []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

function handleAdd() {
  supplierDialogVisible.value = true
}

/** 供应商多选确认后，逐个弹出金额表单 */
function onSupplierConfirmed(suppliers: Array<{ supplier_id: string; supplier_name: string }>) {
  if (suppliers.length === 0) return
  pendingSuppliers.value = [...suppliers]
  fillNextPending()
}

function fillNextPending() {
  const next = pendingSuppliers.value.shift()
  if (!next) return
  formMode.value = 'add'
  Object.assign(form, {
    prepayment_item_id: '',
    supplier_id: next.supplier_id,
    supplier_name: next.supplier_name,
    supplier_bank_account: '',
    supplier_bank_name: '',
    actual_amount: 0,
    prepayment_amount: 0,
    gift_amount: 0,
    remark: ''
  })
  formDialogVisible.value = true
}

function handleEdit(row: PrepaymentLineItem) {
  formMode.value = 'edit'
  Object.assign(form, {
    prepayment_item_id: row.prepayment_item_id || '',
    supplier_id: row.supplier_id,
    supplier_name: row.supplier_name || '',
    supplier_bank_account: row.supplier_bank_account || '',
    supplier_bank_name: row.supplier_bank_name || '',
    actual_amount: Number(row.actual_amount) || 0,
    prepayment_amount: Number(row.prepayment_amount) || 0,
    gift_amount: Number(row.gift_amount) || 0,
    remark: row.remark || ''
  })
  formDialogVisible.value = true
}

async function handleSubmit() {
  if (form.actual_amount <= 0) { ElMessage.warning('实付金额必须大于0'); return }
  if (form.prepayment_amount <= 0) { ElMessage.warning('预付金额必须大于0'); return }
  if (form.gift_amount < 0) { ElMessage.warning('赠送金额不能为负'); return }
  submitting.value = true
  try {
    if (formMode.value === 'add') {
      await addPrepaymentOrderItems(props.order!.prepayment_order_id, [{
        supplier_id: form.supplier_id,
        supplier_bank_account: form.supplier_bank_account || undefined,
        supplier_bank_name: form.supplier_bank_name || undefined,
        actual_amount: String(form.actual_amount),
        prepayment_amount: String(form.prepayment_amount),
        gift_amount: String(form.gift_amount),
        remark: form.remark || undefined
      }])
      ElMessage.success('明细已新增')
    } else {
      await updatePrepaymentOrderItem(form.prepayment_item_id, {
        supplier_bank_account: form.supplier_bank_account || undefined,
        supplier_bank_name: form.supplier_bank_name || undefined,
        actual_amount: String(form.actual_amount),
        prepayment_amount: String(form.prepayment_amount),
        gift_amount: String(form.gift_amount),
        remark: form.remark || undefined
      })
      ElMessage.success('明细已更新')
    }
    formDialogVisible.value = false
    await loadItems()
    emit('changed')
    // 若还有待填的供应商，继续下一个
    if (formMode.value === 'add' && pendingSuppliers.value.length > 0) fillNextPending()
  } catch {
    // 请求拦截器已统一提示错误
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: PrepaymentLineItem) {
  if (!row.prepayment_item_id) return
  try {
    await ElMessageBox.confirm(`确认删除供应商「${row.supplier_name || ''}」的明细？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deletePrepaymentOrderItem(row.prepayment_item_id)
    ElMessage.success('删除成功')
    await loadItems()
    emit('changed')
  } catch {
    // 用户取消或请求失败（失败已由拦截器提示）
  }
}
</script>

<style scoped>
.item-dialog-body { min-height: 200px; }
.order-info { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.order-info .info-text { font-size: 13px; color: var(--text-secondary); }
</style>
