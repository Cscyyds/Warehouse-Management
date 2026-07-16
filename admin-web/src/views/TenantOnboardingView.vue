<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import FlowRail from '@/components/FlowRail.vue'
import ResultReceipt from '@/components/ResultReceipt.vue'
import { createTenant, createTenantSubscription } from '@/api/platformTenants'
import { useCreationContextStore } from '@/stores/creationContext'
import type { SubscriptionInfo, TenantInfo } from '@/types/platform'

const context = useCreationContextStore()
const tenantFormRef = ref<FormInstance>()
const subscriptionFormRef = ref<FormInstance>()
const creatingTenant = ref(false)
const creatingSubscription = ref(false)
const activeStep = ref('tenant')
const tenantResult = ref<TenantInfo | null>(null)
const subscriptionResult = ref<SubscriptionInfo | null>(null)

const tenantForm = reactive({ tenant_name: '', contact_name: '', contact_phone: '', contact_email: '' })
const subscriptionForm = reactive({ tenant_id: '', start_at: '', end_at: '', max_user_count: 20, max_warehouse_count: 5, storage_quota_gb: 50 })

const tenantRules: FormRules = {
  tenant_name: [{ required: true, message: '请输入租客名称', trigger: 'blur' }],
  contact_name: [{ required: true, message: '请输入联系人', trigger: 'blur' }],
  contact_phone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  contact_email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
}

const subscriptionRules: FormRules = {
  tenant_id: [{ required: true, message: '请输入租客编码', trigger: 'blur' }],
  start_at: [{ required: true, message: '请选择开始日期', trigger: 'change' }],
  end_at: [{ required: true, message: '请选择结束日期', trigger: 'change' }],
}

const flowSteps = computed(() => [
  { key: 'tenant', label: '创建租客', note: tenantResult.value?.tenant_code || '生成 tenant_code', ready: Boolean(tenantResult.value) },
  { key: 'subscription', label: '配置订阅', note: subscriptionResult.value ? '订阅已创建' : '设置期限与额度', ready: Boolean(subscriptionResult.value) },
])
const tenantReceipt = computed(() => tenantResult.value ? { ...tenantResult.value } : null)
const subscriptionReceipt = computed(() => subscriptionResult.value ? { ...subscriptionResult.value } : null)

async function submitTenant() {
  if (!await tenantFormRef.value?.validate().catch(() => false)) return
  creatingTenant.value = true
  try {
    tenantResult.value = await createTenant({
      ...tenantForm,
      tenant_name: tenantForm.tenant_name.trim(),
      contact_name: tenantForm.contact_name.trim(),
      contact_phone: tenantForm.contact_phone.trim(),
      contact_email: tenantForm.contact_email.trim() || undefined,
    })
    context.addTenant(tenantResult.value.tenant_code, tenantResult.value.tenant_name)
    subscriptionForm.tenant_id = tenantResult.value.tenant_code
    activeStep.value = 'subscription'
    ElMessage.success('租客已创建，编码已带入订阅表单')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建租客失败')
  } finally {
    creatingTenant.value = false
  }
}

async function submitSubscription() {
  if (!await subscriptionFormRef.value?.validate().catch(() => false)) return
  if (subscriptionForm.end_at < subscriptionForm.start_at) {
    ElMessage.warning('结束日期不能早于开始日期')
    return
  }
  creatingSubscription.value = true
  try {
    subscriptionResult.value = await createTenantSubscription({ ...subscriptionForm })
    ElMessage.success('租客订阅已创建')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建订阅失败')
  } finally {
    creatingSubscription.value = false
  }
}
</script>

<template>
  <div class="page-stack">
    <PageHeader eyebrow="TENANT ONBOARDING" title="租客开通" description="先建立租客编码，再为该编码配置可用期限与资源额度。" marker="02 / PLATFORM" />
    <FlowRail :steps="flowSteps" :active="activeStep" />

    <section class="operation-grid">
      <div class="operation-card">
        <div class="card-heading"><span class="step-badge">01</span><div><h2>创建平台租客</h2><p>生成平台内唯一的租客业务编码。</p></div></div>
        <el-form ref="tenantFormRef" :model="tenantForm" :rules="tenantRules" label-position="top" class="dense-form">
          <el-form-item label="租客名称" prop="tenant_name"><el-input v-model="tenantForm.tenant_name" maxlength="100" show-word-limit placeholder="例如：华东配送中心" /></el-form-item>
          <div class="form-row">
            <el-form-item label="联系人" prop="contact_name"><el-input v-model="tenantForm.contact_name" placeholder="负责人姓名" /></el-form-item>
            <el-form-item label="联系电话" prop="contact_phone"><el-input v-model="tenantForm.contact_phone" placeholder="手机或座机" /></el-form-item>
          </div>
          <el-form-item label="联系邮箱" prop="contact_email"><el-input v-model="tenantForm.contact_email" placeholder="选填，用于接收平台通知" /></el-form-item>
          <el-button type="primary" :loading="creatingTenant" @click="submitTenant">创建租客并生成编码</el-button>
        </el-form>
      </div>
      <ResultReceipt title="租客创建结果" :data="tenantReceipt" primary-key="tenant_code" />
    </section>

    <section class="operation-grid">
      <div class="operation-card">
        <div class="card-heading"><span class="step-badge">02</span><div><h2>创建租客订阅</h2><p>设置使用期限和平台资源上限。</p></div></div>
        <el-form ref="subscriptionFormRef" :model="subscriptionForm" :rules="subscriptionRules" label-position="top" class="dense-form">
          <el-form-item label="租客编码" prop="tenant_id">
            <el-select v-model="subscriptionForm.tenant_id" filterable allow-create default-first-option placeholder="选择本次创建的租客，或输入已知编码">
              <el-option v-for="item in context.tenants" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" />
            </el-select>
          </el-form-item>
          <div class="form-row">
            <el-form-item label="开始日期" prop="start_at"><el-date-picker v-model="subscriptionForm.start_at" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" /></el-form-item>
            <el-form-item label="结束日期" prop="end_at"><el-date-picker v-model="subscriptionForm.end_at" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" /></el-form-item>
          </div>
          <div class="form-row form-row--three">
            <el-form-item label="最大用户数"><el-input-number v-model="subscriptionForm.max_user_count" :min="1" :max="100000" controls-position="right" /></el-form-item>
            <el-form-item label="最大仓库数"><el-input-number v-model="subscriptionForm.max_warehouse_count" :min="1" :max="10000" controls-position="right" /></el-form-item>
            <el-form-item label="存储配额（GB）"><el-input-number v-model="subscriptionForm.storage_quota_gb" :min="1" :max="100000" controls-position="right" /></el-form-item>
          </div>
          <el-button type="primary" :loading="creatingSubscription" @click="submitSubscription">创建订阅</el-button>
        </el-form>
      </div>
      <ResultReceipt title="订阅创建结果" :data="subscriptionReceipt" primary-key="tenant_id" />
    </section>
  </div>
</template>
