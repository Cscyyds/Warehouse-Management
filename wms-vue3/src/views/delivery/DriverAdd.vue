<template>
  <div class="add-template-page">
    <div class="page-header">
      <div class="page-header-left">
        <el-icon class="back-icon" @click="router.back()"><ArrowLeft /></el-icon>
        <span class="back-label" @click="router.back()">返回</span>
        <span class="header-divider">/</span>
        <h3>{{ isEdit ? '编辑司机档案' : '新增司机档案' }}</h3>
      </div>
      <div class="header-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </div>
    </div>

    <div class="page-body">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="110px" size="default">
        <el-row :gutter="16">
          <el-col :span="24">
            <div class="form-section-title"><span class="section-line" />基本信息</div>
          </el-col>

          <!-- 司机类型：编辑时只读 -->
          <el-col :span="12">
            <el-form-item label="司机类型" prop="driver_type">
              <el-select v-model="formData.driver_type" placeholder="请选择" style="width:100%" :disabled="isEdit" @change="onDriverTypeChange">
                <el-option label="内部员工" value="INTERNAL_EMPLOYEE" />
                <el-option label="外部个体" value="EXTERNAL_INDIVIDUAL" />
              </el-select>
            </el-form-item>
          </el-col>

          <!-- 状态 -->
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-select v-model="formData.status" style="width:100%">
                <el-option label="启用" value="ACTIVE" />
                <el-option label="停用" value="INACTIVE" />
              </el-select>
            </el-form-item>
          </el-col>

          <!-- 内部员工：选择员工 -->
          <template v-if="formData.driver_type === 'INTERNAL_EMPLOYEE'">
            <el-col :span="12">
              <el-form-item label="绑定员工" prop="user_id">
                <div class="input-suffix-wrapper">
                  <el-input
                    v-model="formData.user_display"
                    placeholder="点击选择员工"
                    readonly
                    style="width:100%"
                    @click="userDialogVisible = true"
                  >
                    <template #suffix>
                      <el-icon class="input-suffix-icon" @click.stop="userDialogVisible = true"><Search /></el-icon>
                    </template>
                  </el-input>
                </div>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="司机姓名">
                <el-input v-model="formData.driver_name" readonly placeholder="由员工信息带出" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="联系电话">
                <el-input v-model="formData.driver_phone" readonly placeholder="由员工信息带出" />
              </el-form-item>
            </el-col>
          </template>

          <!-- 外部个体：手工填写 -->
          <template v-if="formData.driver_type === 'EXTERNAL_INDIVIDUAL'">
            <el-col :span="12">
              <el-form-item label="司机姓名" prop="driver_name">
                <el-input v-model="formData.driver_name" placeholder="请输入司机姓名" maxlength="64" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="联系电话" prop="driver_phone">
                <el-input v-model="formData.driver_phone" placeholder="请输入联系电话" maxlength="32" />
              </el-form-item>
            </el-col>
          </template>

          <!-- 驾驶证（选填） -->
          <el-col :span="12">
            <el-form-item label="驾驶证号" prop="driver_license_no">
              <el-input v-model="formData.driver_license_no" placeholder="选填，最长64位" maxlength="64" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="驾驶证到期" prop="license_expire_date">
              <el-date-picker
                v-model="formData.license_expire_date"
                type="date"
                placeholder="选填"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                style="width:100%"
              />
            </el-form-item>
          </el-col>

          <!-- 备注 -->
          <el-col :span="24">
            <el-form-item label="备注" prop="remark">
              <el-input v-model="formData.remark" type="textarea" :rows="3" placeholder="选填，最长255位" maxlength="255" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>
  </div>

  <!-- 员工选择弹窗 -->
  <el-dialog v-model="userDialogVisible" title="选择员工" width="500px" :close-on-click-modal="false" destroy-on-close>
    <el-form inline size="default" style="margin-bottom:12px">
      <el-form-item>
        <el-input v-model="userSearch" placeholder="姓名/手机号" clearable style="width:200px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadUserOptions">查询</el-button>
      </el-form-item>
    </el-form>
    <el-table border :data="userOptions" highlight-current-row @current-change="handleUserSelect" max-height="300">
      <el-table-column prop="user_name" label="姓名" width="120" show-overflow-tooltip />
      <el-table-column prop="phone" label="手机号" min-width="140" show-overflow-tooltip />
    </el-table>
    <template #footer>
      <el-button @click="userDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmUserSelect">确认</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Search } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { createDriver, updateDriver, type DriverItem } from '@/api'
import { get } from '@/utils/request'

const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const submitting = ref(false)

const isEdit = route.query.mode === 'edit'
const driverId = route.query.id as string | undefined

const formData = reactive({
  driver_type: 'EXTERNAL_INDIVIDUAL',
  user_id: '',
  user_display: '',
  driver_name: '',
  driver_phone: '',
  driver_license_no: '',
  license_expire_date: '',
  status: 'ACTIVE',
  remark: '',
})

const rules: FormRules = {
  driver_type: [{ required: true, message: '请选择司机类型', trigger: 'change' }],
  user_id: [{ required: true, message: '请选择绑定员工', trigger: 'change',
    validator: (_rule: any, _val: any, cb: any) => {
      if (formData.driver_type === 'INTERNAL_EMPLOYEE' && !formData.user_id) cb(new Error('请选择绑定员工'))
      else cb()
    }
  }],
  driver_name: [{ required: true, message: '请输入司机姓名', trigger: 'blur',
    validator: (_rule: any, _val: any, cb: any) => {
      if (formData.driver_type === 'EXTERNAL_INDIVIDUAL' && !formData.driver_name.trim()) cb(new Error('请输入司机姓名'))
      else cb()
    }
  }],
  driver_phone: [{ required: true, message: '请输入联系电话', trigger: 'blur',
    validator: (_rule: any, _val: any, cb: any) => {
      if (formData.driver_type === 'EXTERNAL_INDIVIDUAL' && !formData.driver_phone.trim()) cb(new Error('请输入联系电话'))
      else cb()
    }
  }],
}

function onDriverTypeChange() {
  formData.user_id = ''
  formData.user_display = ''
  formData.driver_name = ''
  formData.driver_phone = ''
  formRef.value?.clearValidate()
}

function handleReset() {
  if (isEdit) {
    loadEditData()
  } else {
    Object.assign(formData, {
      driver_type: 'EXTERNAL_INDIVIDUAL', user_id: '', user_display: '',
      driver_name: '', driver_phone: '', driver_license_no: '',
      license_expire_date: '', status: 'ACTIVE', remark: '',
    })
  }
  formRef.value?.clearValidate()
}

function loadEditData() {
  const raw = sessionStorage.getItem('editData:driver')
  if (!raw) return
  const row: DriverItem = JSON.parse(raw)
  Object.assign(formData, {
    driver_type: row.driver_type,
    user_id: row.user_id || '',
    user_display: row.user_id ? `${row.driver_name}（${row.driver_phone}）` : '',
    driver_name: row.driver_name,
    driver_phone: row.driver_phone,
    driver_license_no: row.driver_license_no || '',
    license_expire_date: row.license_expire_date || '',
    status: row.status,
    remark: row.remark || '',
  })
}

async function handleSubmit() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    if (isEdit && driverId) {
      await updateDriver({
        driver_id: driverId,
        user_id: formData.driver_type === 'INTERNAL_EMPLOYEE' ? formData.user_id : undefined,
        driver_name: formData.driver_type === 'EXTERNAL_INDIVIDUAL' ? formData.driver_name : undefined,
        driver_phone: formData.driver_type === 'EXTERNAL_INDIVIDUAL' ? formData.driver_phone : undefined,
        driver_license_no: formData.driver_license_no || undefined,
        license_expire_date: formData.license_expire_date || undefined,
        status: formData.status,
        remark: formData.remark || undefined,
      })
      ElMessage.success('修改成功')
    } else {
      await createDriver({
        driver_type: formData.driver_type,
        user_id: formData.driver_type === 'INTERNAL_EMPLOYEE' ? formData.user_id : undefined,
        driver_name: formData.driver_type === 'EXTERNAL_INDIVIDUAL' ? formData.driver_name : undefined,
        driver_phone: formData.driver_type === 'EXTERNAL_INDIVIDUAL' ? formData.driver_phone : undefined,
        driver_license_no: formData.driver_license_no || undefined,
        license_expire_date: formData.license_expire_date || undefined,
        status: formData.status,
        remark: formData.remark || undefined,
      })
      ElMessage.success('创建成功')
    }
    router.push('/delivery/driver')
  } catch (e: any) {
    if (e?.response?.data?.detail) ElMessage.error(e.response.data.detail)
  } finally {
    submitting.value = false
  }
}

// ═══════════ 员工选择 ═══════════
const userDialogVisible = ref(false)
const userSearch = ref('')
const userOptions = ref<{ user_id: string; user_name: string; phone: string }[]>([])
let selectedUser: { user_id: string; user_name: string; phone: string } | null = null

async function loadUserOptions() {
  try {
    const res = await get<any>('/api/v1/tenant-users/query', { keyword: userSearch.value || undefined, page: 1 })
    userOptions.value = (res.data as any).user || []
  } catch { userOptions.value = [] }
}

function handleUserSelect(row: { user_id: string; user_name: string; phone: string } | null) {
  selectedUser = row
}

function confirmUserSelect() {
  if (selectedUser) {
    formData.user_id = selectedUser.user_id
    formData.user_display = `${selectedUser.user_name}（${selectedUser.phone}）`
    formData.driver_name = selectedUser.user_name
    formData.driver_phone = selectedUser.phone
    formRef.value?.clearValidate('user_id')
  }
  userDialogVisible.value = false
}

onMounted(() => {
  if (isEdit) loadEditData()
})
</script>

<style scoped>
.add-template-page { background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-xs); padding: 0; }
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
.add-template-page :deep(.el-form-item) { margin-bottom: 16px; }
.add-template-page :deep(.el-form-item__label) { font-size: 14px; color: var(--text-secondary); }
.form-section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 4px 0 14px; padding-left: 4px; }
.section-line { width: 4px; height: 16px; background: var(--primary-gradient); border-radius: 2px; flex-shrink: 0; }
.input-suffix-wrapper { width: 100%; }
.input-suffix-icon { cursor: pointer; color: var(--text-tertiary); }
.input-suffix-icon:hover { color: var(--primary); }
</style>
