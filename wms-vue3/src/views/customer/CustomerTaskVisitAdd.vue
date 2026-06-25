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
            <el-form-item label="客户" prop="customer_id" :rules="[{ required: true, message: '请选择客户', trigger: 'change' }]">
              <el-input
                v-model="formData.customer_name"
                placeholder="点击选择客户"
                readonly
                @click="customerDialogVisible = true"
              >
                <template #suffix>
                  <el-icon style="cursor:pointer" @click.stop="customerDialogVisible = true"><Search /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="联系人" prop="contact_name" :rules="[{ required: true, message: '请输入联系人', trigger: 'blur' }]">
              <el-input v-model="formData.contact_name" placeholder="请输入联系人" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="电话" prop="contact_phone" :rules="[{ required: true, message: '请输入联系电话', trigger: 'blur' }]">
              <el-input v-model="formData.contact_phone" placeholder="请输入联系电话" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="拜访地址" prop="visit_address" :rules="[{ required: true, message: '请输入拜访地址', trigger: 'blur' }]">
              <el-input v-model="formData.visit_address" placeholder="请输入拜访地址" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="任务类型" prop="task_type" :rules="[{ required: true, message: '请选择任务类型', trigger: 'change' }]">
              <el-select v-model="formData.task_type" placeholder="请选择任务类型" style="width:100%">
                <el-option label="上门拜访" value="上门拜访" />
                <el-option label="电话回访" value="电话回访" />
                <el-option label="视频会议" value="视频会议" />
                <el-option label="其他" value="其他" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="销售员" prop="salesman_user_id" :rules="[{ required: true, message: '请选择销售员', trigger: 'change' }]">
              <el-input
                v-model="formData.salesman_user_name"
                placeholder="点击选择销售员"
                readonly
                @click="employeeDialogVisible = true"
              >
                <template #suffix>
                  <el-icon style="cursor:pointer" @click.stop="employeeDialogVisible = true"><Search /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="拜访时间">
              <el-date-picker v-model="formData.visit_time" type="datetime" placeholder="请选择拜访时间" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="拜访计划" prop="visit_plan" :rules="[{ required: true, message: '请输入拜访计划', trigger: 'blur' }]">
              <el-input v-model="formData.visit_plan" type="textarea" :rows="3" placeholder="请输入拜访计划" />
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
      v-model="customerDialogVisible"
      @confirm="onCustomerConfirm"
    />
    <EmployeeSelectDialog
      v-model="employeeDialogVisible"
      @confirm="onEmployeeConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Search } from '@element-plus/icons-vue'
import { createVisitTask, type CustomerItem, type UserItem } from '@/api'
import CustomerSelectDialog from './CustomerSelectDialog.vue'
import EmployeeSelectDialog from './EmployeeSelectDialog.vue'

const router = useRouter()
const formRef = ref()
const submitting = ref(false)
const customerDialogVisible = ref(false)
const employeeDialogVisible = ref(false)

const formData = reactive({
  customer_id: '',
  customer_name: '',
  contact_name: '',
  contact_phone: '',
  visit_address: '',
  task_type: '上门拜访',
  salesman_user_id: '',
  salesman_user_name: '',
  visit_time: '',
  visit_plan: '',
  remark: '',
})

function onCustomerConfirm(customer: CustomerItem) {
  formData.customer_id = customer.customer_id
  formData.customer_name = customer.customer_name
  formData.contact_name = customer.company_leader_name || ''
  formData.contact_phone = customer.leader_phone || ''
  formData.visit_address = customer.detail_address || ''
}

function onEmployeeConfirm(employee: UserItem) {
  formData.salesman_user_id = employee.user_id
  formData.salesman_user_name = employee.user_name
}

function handleReset() {
  formRef.value?.resetFields()
  Object.assign(formData, {
    customer_id: '', customer_name: '', contact_name: '', contact_phone: '',
    visit_address: '', task_type: '上门拜访', salesman_user_id: '', salesman_user_name: '',
    visit_time: '', visit_plan: '', remark: ''
  })
}

async function handleSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    await createVisitTask({
      task_type: formData.task_type,
      customer_id: formData.customer_id,
      contact_name: formData.contact_name,
      contact_phone: formData.contact_phone,
      visit_address: formData.visit_address,
      salesman_user_id: formData.salesman_user_id,
      visit_plan: formData.visit_plan,
      status: 1,
      visit_time: formData.visit_time || undefined,
      remark: formData.remark || undefined,
    })
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
