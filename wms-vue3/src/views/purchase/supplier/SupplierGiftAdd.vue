<template>
  <div class="add-template-page">
    <div class="page-header">
      <div class="page-header-left">
        <el-icon class="back-icon" @click="router.back()"><ArrowLeft /></el-icon>
        <span class="back-label" @click="router.back()">返回</span>
        <span class="header-divider">/</span>
        <h3>新增/调减供应商赠送金额</h3>
      </div>
      <div class="header-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </div>
    </div>
    <div class="page-body">
      <el-form ref="formRef" :model="formData" label-position="top" size="default">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="单据编号">
              <el-input v-model="formData.billNo" placeholder="保存后自动生成" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="供应商" prop="supplierId" :rules="[{ required: true, message: '请选择供应商', trigger: 'change' }]">
              <el-input v-model="formData.supplierName" placeholder="点击选择供应商" readonly @click="selectDialogVisible = true">
                <template #suffix>
                  <el-icon style="cursor:pointer" @click.stop="selectDialogVisible = true"><Search /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="变动金额（正数=新增，负数=调减）" prop="amount" :rules="amountRules">
              <el-input-number v-model="formData.amount" :precision="2" :step="100" style="width:100%" placeholder="输入金额，负数代表调减" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="formData.remark" type="textarea" :rows="3" placeholder="请输入备注" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>

    <SupplierSelectDialog v-model="selectDialogVisible" @confirm="onSupplierConfirm" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Search } from '@element-plus/icons-vue'
import { addSupplierGiftLog } from '@/api'
import type { SupplierItem } from '@/api'
import SupplierSelectDialog from '@/views/purchase/SupplierSelectDialog.vue'

const router = useRouter()
const route = useRoute()
const formRef = ref()
const submitting = ref(false)
const selectDialogVisible = ref(false)

const formData = reactive({
  billNo: '',
  supplierId: '',
  supplierName: '',
  amount: 0 as number,
  remark: '',
})

// 从详情页跳入时预填供应商（query 带 supplier_id / supplier_name）
onMounted(() => {
  const qid = route.query.supplier_id as string | undefined
  const qname = route.query.supplier_name as string | undefined
  if (qid) { formData.supplierId = qid; formData.supplierName = qname || '' }
})

// 金额校验：不能为 0（后端要求 amount 非 0）
const amountRules = [
  { required: true, message: '请输入变动金额', trigger: 'blur' },
  {
    validator: (_rule: unknown, value: number, callback: (e?: Error) => void) => {
      if (value === 0 || value === null || value === undefined) return callback(new Error('金额不能为0（正数新增，负数调减）'))
      callback()
    },
    trigger: 'blur',
  },
]

function onSupplierConfirm(supplier: SupplierItem) {
  formData.supplierId = supplier.supplier_id
  formData.supplierName = supplier.supplier_name
}

function handleReset() {
  formRef.value?.resetFields()
  Object.assign(formData, { billNo: '', supplierId: '', supplierName: '', amount: 0, remark: '' })
}

async function handleSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    const res = await addSupplierGiftLog({
      supplier_id: formData.supplierId,
      amount: formData.amount,
      remark: formData.remark || undefined,
    })
    ElMessage.success(`保存成功，单据号：${res.data.bill_no}，当前赠送余额：${res.data.new_balance}`)
    router.push('/purchase/supplier/gift')
  } catch {
    // request 拦截器已统一弹错，这里不重复提示
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.add-template-page { background: var(--bg-white, #fff); border-radius: var(--radius-md, 8px); box-shadow: var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.04)); }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; border-bottom: 1px solid var(--border-light, #ebeef5); }
.page-header-left { display: flex; align-items: center; gap: 8px; }
.back-icon { cursor: pointer; color: var(--text-secondary, #909399); font-size: 16px; transition: color var(--transition-fast, .2s); }
.back-icon:hover { color: var(--primary, #409eff); }
.back-label { cursor: pointer; font-size: 14px; color: var(--text-secondary, #909399); transition: color var(--transition-fast, .2s); }
.back-label:hover { color: var(--primary, #409eff); }
.header-divider { color: var(--text-tertiary, #c0c4cc); font-size: 14px; margin: 0 2px; }
.page-header h3 { font-size: 15px; font-weight: 600; color: var(--text-primary, #303133); }
.header-actions { display: flex; gap: 8px; }
.page-body { padding: 20px 24px; }
</style>
