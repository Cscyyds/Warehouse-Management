<template>
  <div class="add-template-page">
    <div class="page-header">
      <div class="page-header-left">
        <el-icon class="back-icon" @click="router.back()"><ArrowLeft /></el-icon>
        <span class="back-label" @click="router.back()">返回</span>
        <span class="header-divider">/</span>
        <h3>新增预收款单</h3>
      </div>
      <div class="header-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </div>
    </div>

    <div class="page-body">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px" label-position="top" size="default">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="收款日期" prop="receipt_date">
              <el-date-picker
                v-model="form.receipt_date"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择"
                style="width:100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="收款方式" prop="receipt_method">
              <el-select v-model="form.receipt_method" placeholder="请选择" style="width:100%" @change="onMethodChange">
                <el-option label="现金" value="CASH" />
                <el-option label="银行转账" value="TRANSFER" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="银行账户" prop="bank_account_id">
              <el-select v-model="form.bank_account_id" placeholder="银行转账时必填" clearable style="width:100%" :loading="bankLoading">
                <el-option
                  v-for="b in bankOptions"
                  :key="b.bank_account_id"
                  :label="b.account_name"
                  :value="b.bank_account_id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="科目">
              <el-select v-model="form.subject_id" placeholder="请选择（选填）" clearable style="width:100%" :loading="subjectLoading">
                <el-option
                  v-for="s in subjectOptions"
                  :key="s.subject_id"
                  :label="s.name"
                  :value="s.subject_id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item label="备注">
              <el-input v-model="form.remark" placeholder="选填" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="预收明细" prop="items">
          <div class="items-header">
            <el-button size="small" type="primary" plain @click="customerDialogVisible = true">
              <el-icon><Plus /></el-icon>添加客户
            </el-button>
            <span class="items-hint">至少添加一条明细</span>
          </div>
          <el-table v-if="items.length" :data="items" size="small" border style="width:100%;margin-top:8px">
            <el-table-column type="index" label="" width="50" align="center" />
            <el-table-column prop="customer_name" label="客户" min-width="140" show-overflow-tooltip />
            <el-table-column label="预收金额 *" width="150">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.prepayment_amount"
                  :min="0.01"
                  :precision="2"
                  controls-position="right"
                  style="width:100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="赠送金额" width="150">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.gift_amount"
                  :min="0"
                  :precision="2"
                  controls-position="right"
                  style="width:100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="140">
              <template #default="{ row }">
                <el-input v-model="row.remark" placeholder="选填" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="" width="70" align="center" fixed="right">
              <template #default="{ $index }">
                <el-button link type="danger" size="small" @click="removeItem($index)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>
      </el-form>
    </div>

    <CustomerSelectDialog
      v-model="customerDialogVisible"
      :multiple="true"
      @confirmMultiple="onCustomersConfirmed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { ArrowLeft, Plus } from '@element-plus/icons-vue'
import { createPrecollectionOrder, getBankAccountList, getAccountSubjectTree } from '@/api'
import CustomerSelectDialog from '@/views/customer/CustomerSelectDialog.vue'

const router = useRouter()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const customerDialogVisible = ref(false)
const bankLoading = ref(false)
const subjectLoading = ref(false)
const bankOptions = ref<Array<{ bank_account_id: string; account_name: string }>>([])
const subjectOptions = ref<Array<{ subject_id: string; name: string }>>([])

const form = reactive({
  receipt_date: '',
  receipt_method: '',
  subject_id: '',
  bank_account_id: '',
  remark: '',
})

type ItemRow = {
  customer_id: string
  customer_name: string
  prepayment_amount: number
  gift_amount: number
  remark: string
}
const items = ref<ItemRow[]>([])

const rules: FormRules = {
  receipt_date: [{ required: true, message: '请选择收款日期', trigger: 'change' }],
  receipt_method: [{ required: true, message: '请选择收款方式', trigger: 'change' }],
  bank_account_id: [
    {
      validator: (_rule, _value, callback) => {
        if (form.receipt_method === 'TRANSFER' && !form.bank_account_id) {
          callback(new Error('银行转账方式必须选择银行账户'))
        } else {
          callback()
        }
      },
      trigger: 'change',
    },
  ],
}

function onMethodChange() {
  if (form.receipt_method !== 'TRANSFER') form.bank_account_id = ''
  formRef.value?.validateField('bank_account_id')
}

function onCustomersConfirmed(customers: Array<{ customer_id: string; customer_name: string }>) {
  customers.forEach(c => {
    if (!items.value.find(i => i.customer_id === c.customer_id)) {
      items.value.push({ customer_id: c.customer_id, customer_name: c.customer_name, prepayment_amount: 0, gift_amount: 0, remark: '' })
    }
  })
}

function removeItem(idx: number) {
  items.value.splice(idx, 1)
}

function handleReset() {
  formRef.value?.resetFields()
  Object.assign(form, { receipt_date: '', receipt_method: '', subject_id: '', bank_account_id: '', remark: '' })
  items.value = []
}

async function handleSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (items.value.length === 0) {
    ElMessage.warning('请至少添加一条预收明细')
    return
  }
  const invalidIdx = items.value.findIndex(i => !i.prepayment_amount || i.prepayment_amount <= 0)
  if (invalidIdx !== -1) {
    ElMessage.warning(`第 ${invalidIdx + 1} 行预收金额必须大于 0`)
    return
  }

  submitting.value = true
  try {
    await createPrecollectionOrder({
      receipt_date: form.receipt_date,
      receipt_method: form.receipt_method,
      subject_id: form.subject_id || undefined,
      bank_account_id: form.bank_account_id || undefined,
      remark: form.remark || undefined,
      items: JSON.stringify(items.value.map(i => ({
        customer_id: i.customer_id,
        prepayment_amount: String(i.prepayment_amount),
        gift_amount: String(i.gift_amount || 0),
        remark: i.remark || undefined,
      }))),
    })
    ElMessage.success('预收款单创建成功')
    router.push('/finance/precollection')
  } catch (err: any) {
    ElMessage.error(err?.message || '创建失败')
  } finally {
    submitting.value = false
  }
}

async function loadBankAccounts() {
  bankLoading.value = true
  try {
    const res = await getBankAccountList({ page: 1, page_size: 100 })
    bankOptions.value = (res.data.items || []).map((b: any) => ({ bank_account_id: b.bank_account_id, account_name: b.account_name }))
  } catch {
    bankOptions.value = []
  } finally {
    bankLoading.value = false
  }
}

async function loadSubjects() {
  subjectLoading.value = true
  try {
    const res = await getAccountSubjectTree({ page: 1, page_size: 100 })
    const flatten = (nodes: any[]): any[] => nodes.flatMap(n => [n, ...(n.children ? flatten(n.children) : [])])
    subjectOptions.value = flatten(res.data?.items || []).map((n: any) => ({ subject_id: n.subject_id, name: n.name }))
  } catch {
    subjectOptions.value = []
  } finally {
    subjectLoading.value = false
  }
}

onMounted(() => {
  loadBankAccounts()
  loadSubjects()
  // 读取预设数据（如从销售订单一键创建预收款单带入的预填数据）
  const presetKey = 'presetData:precollectionOrder'
  const preset = sessionStorage.getItem(presetKey)
  if (preset) {
    sessionStorage.removeItem(presetKey)
    const data = JSON.parse(preset)
    if (data.receipt_method) form.receipt_method = data.receipt_method
    if (data.bank_account_id) form.bank_account_id = data.bank_account_id
    if (data.remark) form.remark = data.remark
    // 预填预收明细行（从销售订单客户带入）
    if (Array.isArray(data.items) && data.items.length) {
      items.value = data.items.map((row: any) => ({
        customer_id: row.customer_id || '',
        customer_name: row.customer_name || '',
        prepayment_amount: Number(row.prepayment_amount) || 0,
        gift_amount: Number(row.gift_amount) || 0,
        remark: row.remark || '',
      }))
    }
  }
})
</script>

<style scoped>
.add-template-page { background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-xs); }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; border-bottom: 1px solid var(--border-light); }
.page-header-left { display: flex; align-items: center; gap: 8px; }
.back-icon { cursor: pointer; color: var(--text-secondary); font-size: 16px; transition: color var(--transition-fast); }
.back-icon:hover { color: var(--primary); }
.back-label { cursor: pointer; font-size: 14px; color: var(--text-secondary); transition: color var(--transition-fast); }
.back-label:hover { color: var(--primary); }
.header-divider { color: var(--text-tertiary); font-size: 14px; margin: 0 2px; }
.page-header h3 { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.header-actions { display: flex; gap: 8px; }
.page-body { padding: 20px 24px; }
.items-header { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.items-hint { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
