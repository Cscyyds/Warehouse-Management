<template>
  <div class="add-template-page">
    <div class="page-header">
      <div class="page-header-left">
        <el-icon class="back-icon" @click="router.back()"><ArrowLeft /></el-icon>
        <span class="back-label" @click="router.back()">返回</span>
        <span class="header-divider">/</span>
        <h3>新增赠送金额</h3>
      </div>
      <div class="header-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </div>
    </div>
    <div class="page-body">
      <el-form ref="formRef" :model="formData" label-width="110px" label-position="top" size="default">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="单据编号">
              <el-input v-model="formData.orderNo" placeholder="保存后自动生成" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户" prop="customerName" :rules="[{ required: true, message: '请选择客户', trigger: 'blur' }]">
              <el-input
                v-model="formData.customerName"
                placeholder="点击选择客户"
                readonly
                @click="selectDialogVisible = true"
              >
                <template #suffix>
                  <el-icon style="cursor:pointer" @click.stop="selectDialogVisible = true"><Search /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="赠送金额" prop="giftAmount" :rules="[{ required: true, message: '请输入赠送金额', trigger: 'blur' }]">
              <el-input-number v-model="formData.giftAmount" :min="0" :precision="2" style="width:100%" />
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

    <CustomerSelectDialog
      v-model="selectDialogVisible"
      @confirm="onCustomerConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Search } from '@element-plus/icons-vue'
import { createGiftAmount, type GiftAmountRecord } from '@/api'
import { type CustomerItem } from '@/api'
import CustomerSelectDialog from './CustomerSelectDialog.vue'

const router = useRouter()
const formRef = ref()
const submitting = ref(false)
const selectDialogVisible = ref(false)

const formData = reactive<GiftAmountRecord>({
  orderNo: '',
  customerName: '',
  giftAmount: 0,
  remark: '',
})

function onCustomerConfirm(customer: CustomerItem) {
  formData.customerName = customer.name
}

function handleReset() {
  formRef.value?.resetFields()
  formData.orderNo = ''
  formData.customerName = ''
  formData.giftAmount = 0
  formData.remark = ''
}

async function handleSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    await createGiftAmount(formData)
    ElMessage.success('保存成功')
    router.push('/customer/finance/gift')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    submitting.value = false
  }
}
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
</style>