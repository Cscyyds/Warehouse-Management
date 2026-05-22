<template>
  <div class="add-template-page">
    <div class="page-header">
      <div class="page-header-left">
        <el-icon class="back-icon" @click="router.back()"><ArrowLeft /></el-icon>
        <span class="back-label" @click="router.back()">返回</span>
        <span class="header-divider">/</span>
        <h3>新增拜访任务</h3>
      </div>
      <div class="header-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </div>
    </div>
    <div class="page-body">
      <el-form ref="formRef" :model="formData" label-width="110px" label-position="top" size="default">
        <el-row :gutter="16">
          <el-col :span="8">
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
          <el-col :span="8">
            <el-form-item label="联系人">
              <el-input v-model="formData.contactPerson" placeholder="请输入联系人" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="电话">
              <el-input v-model="formData.contactPhone" placeholder="请输入联系电话" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="拜访地址">
              <el-input v-model="formData.customerAddress" placeholder="请输入拜访地址" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="任务类型">
              <el-select v-model="formData.visitType" placeholder="请选择任务类型" style="width:100%">
                <el-option label="上门拜访" value="上门拜访" />
                <el-option label="电话回访" value="电话回访" />
                <el-option label="视频会议" value="视频会议" />
                <el-option label="其他" value="其他" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="销售员">
              <el-input v-model="formData.salesUserName" placeholder="请输入销售员" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="拜访时间">
              <el-date-picker v-model="formData.visitDate" type="date" placeholder="请选择拜访时间" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="完成时间">
              <el-date-picker v-model="formData.visitEndTime" type="date" placeholder="请选择完成时间" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="状态">
              <el-radio-group v-model="formData.status">
                <el-radio value="正常">正常</el-radio>
                <el-radio value="停用">停用</el-radio>
              </el-radio-group>
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
import { createVisit, type VisitItem, type CustomerItem } from '@/api'
import CustomerSelectDialog from './CustomerSelectDialog.vue'

const router = useRouter()
const formRef = ref()
const submitting = ref(false)
const selectDialogVisible = ref(false)

const formData = reactive<Partial<VisitItem>>({
  customerId: '',
  customerName: '',
  contactPerson: '',
  contactPhone: '',
  customerAddress: '',
  visitType: '',
  salesUserName: '',
  visitDate: '',
  visitEndTime: '',
  status: '正常',
  remark: '',
})

function onCustomerConfirm(customer: CustomerItem) {
  formData.customerId = customer.id
  formData.customerName = customer.name
  formData.contactPerson = customer.contactPerson
  formData.contactPhone = customer.contactPhone
  formData.customerAddress = customer.address
}

function handleReset() {
  formRef.value?.resetFields()
  Object.assign(formData, {
    customerId: '', customerName: '', contactPerson: '', contactPhone: '',
    customerAddress: '', visitType: '', salesUserName: '', visitDate: '',
    visitEndTime: '', status: '正常', remark: ''
  })
}

async function handleSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    await createVisit(formData)
    ElMessage.success('保存成功')
    router.push('/customer/task/visit')
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
