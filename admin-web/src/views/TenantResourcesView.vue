<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import FlowRail from '@/components/FlowRail.vue'
import ResultReceipt from '@/components/ResultReceipt.vue'
import { createOrganization, createPost, createUser } from '@/api/platformTenantResources'
import { useCreationContextStore } from '@/stores/creationContext'

const context = useCreationContextStore()
const activeTab = ref('organization')
const loading = ref(false)
const result = ref<Record<string, unknown> | null>(null)
const resultTitle = ref('等待创建基础资料')
const resultKey = ref('')

const organizationForm = reactive({ tenant_id: '', org_name: '', org_full_name: '', sort_no: 0, org_type: 'DEPARTMENT', parent_id: '', leader_name: '', contact_address: '', email: '', post_code: '', remark: '' })
const postForm = reactive({ tenant_id: '', post_name: '', post_category: 'OTHER', sort_no: 0, remark: '' })
const userForm = reactive({ tenant_id: '', org_id: '', post_id: '', user_name: '', password: '', mobile: '', email: '', sort_no: 0, user_type: 'EMPLOYEE', role_id: '' })

const flowSteps = computed(() => [
  { key: 'organization', label: '组织', note: context.organizations[0]?.id || '生成 org_code', ready: context.organizations.length > 0 },
  { key: 'post', label: '岗位', note: context.posts[0]?.id || '生成 post_code', ready: context.posts.length > 0 },
  { key: 'user', label: '员工', note: result.value?.login_name ? String(result.value.login_name) : '生成登录账号', ready: Boolean(result.value?.login_name) },
])

function showResult(title: string, key: string, data: object) {
  resultTitle.value = title
  resultKey.value = key
  result.value = { ...data }
}

function requireFields(values: Array<[unknown, string]>) {
  const missing = values.find(([value]) => value === undefined || value === null || String(value).trim() === '')
  if (missing) { ElMessage.warning(`请填写${missing[1]}`); return false }
  return true
}

async function run(task: () => Promise<void>) {
  if (loading.value) return
  loading.value = true
  try { await task() } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建失败')
  } finally { loading.value = false }
}

function submitOrganization() {
  if (!requireFields([[organizationForm.tenant_id, '租客编码'], [organizationForm.org_name, '组织简称'], [organizationForm.org_type, '组织类型']])) return
  run(async () => {
    const data = await createOrganization({
      ...organizationForm,
      org_full_name: organizationForm.org_full_name || undefined,
      parent_id: organizationForm.parent_id || undefined,
      leader_name: organizationForm.leader_name || undefined,
      contact_address: organizationForm.contact_address || undefined,
      email: organizationForm.email || undefined,
      post_code: organizationForm.post_code || undefined,
      remark: organizationForm.remark || undefined,
    })
    context.addOrganization(data.org_code, data.org_name)
    postForm.tenant_id ||= data.company_id
    userForm.tenant_id ||= data.company_id
    userForm.org_id = data.org_code
    activeTab.value = 'post'
    showResult('组织创建结果', 'org_code', data)
    ElMessage.success('组织已创建，编码已接力到员工表单')
  })
}

function submitPost() {
  if (!requireFields([[postForm.tenant_id, '租客编码'], [postForm.post_name, '岗位名称']])) return
  run(async () => {
    const data = await createPost({ ...postForm, post_category: postForm.post_category || undefined, remark: postForm.remark || undefined })
    context.addPost(data.post_code, data.post_name)
    userForm.tenant_id ||= data.company_id
    userForm.post_id = data.post_code
    activeTab.value = 'user'
    showResult('岗位创建结果', 'post_code', data)
    ElMessage.success('岗位已创建，编码已接力到员工表单')
  })
}

function submitUser() {
  if (!requireFields([[userForm.tenant_id, '租客编码'], [userForm.org_id, '所属组织'], [userForm.role_id, '绑定角色'], [userForm.user_name, '员工姓名'], [userForm.password, '初始密码']])) return
  if (userForm.password.length < 6) { ElMessage.warning('初始密码至少 6 位'); return }
  run(async () => {
    const data = await createUser({
      ...userForm,
      post_id: userForm.post_id || undefined,
      mobile: userForm.mobile || undefined,
      email: userForm.email || undefined,
    })
    userForm.password = ''
    showResult('员工创建结果', 'login_name', data)
    ElMessage.success('员工已创建，登录账号已生成')
  })
}
</script>

<template>
  <div class="page-stack">
    <PageHeader eyebrow="TENANT RESOURCE SETUP" title="租客基础资料" description="按人员落位的真实依赖，先建组织与岗位，再创建并绑定员工。" marker="ORG → POST → USER" />
    <FlowRail :steps="flowSteps" :active="activeTab" />

    <section class="workspace-split">
      <div class="operation-card operation-card--tabs">
        <el-tabs v-model="activeTab" class="resource-tabs">
          <el-tab-pane label="组织" name="organization">
            <div class="tab-intro"><span class="step-badge">01</span><div><h2>创建组织</h2><p>建立租客内部可用于人员归属的组织节点。</p></div></div>
            <el-form label-position="top" class="dense-form">
              <div class="form-row"><el-form-item label="租客编码"><el-select v-model="organizationForm.tenant_id" filterable allow-create placeholder="选择或输入 tenant_id"><el-option v-for="item in context.tenants" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item><el-form-item label="组织类型"><el-select v-model="organizationForm.org_type"><el-option label="省级" value="PROVINCE" /><el-option label="市级" value="CITY" /><el-option label="部门" value="DEPARTMENT" /></el-select></el-form-item></div>
              <div class="form-row"><el-form-item label="组织简称"><el-input v-model="organizationForm.org_name" placeholder="例如：销售部" /></el-form-item><el-form-item label="组织全称"><el-input v-model="organizationForm.org_full_name" placeholder="选填" /></el-form-item></div>
              <div class="form-row"><el-form-item label="上级组织"><el-select v-model="organizationForm.parent_id" clearable filterable allow-create placeholder="顶级组织留空"><el-option v-for="item in context.organizations" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item><el-form-item label="排序号"><el-input-number v-model="organizationForm.sort_no" :min="0" controls-position="right" /></el-form-item></div>
              <div class="form-row"><el-form-item label="负责人"><el-input v-model="organizationForm.leader_name" placeholder="选填" /></el-form-item><el-form-item label="联系邮箱"><el-input v-model="organizationForm.email" placeholder="选填" /></el-form-item></div>
              <div class="form-row"><el-form-item label="联系地址"><el-input v-model="organizationForm.contact_address" placeholder="选填" /></el-form-item><el-form-item label="邮政编码"><el-input v-model="organizationForm.post_code" placeholder="选填" /></el-form-item></div>
              <el-form-item label="备注"><el-input v-model="organizationForm.remark" type="textarea" :rows="2" /></el-form-item>
              <el-button type="primary" :loading="loading" @click="submitOrganization">创建组织</el-button>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="岗位" name="post">
            <div class="tab-intro"><span class="step-badge">02</span><div><h2>创建岗位</h2><p>定义员工在组织中的工作位置。</p></div></div>
            <el-form label-position="top" class="dense-form">
              <div class="form-row"><el-form-item label="租客编码"><el-select v-model="postForm.tenant_id" filterable allow-create placeholder="选择或输入 tenant_id"><el-option v-for="item in context.tenants" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item><el-form-item label="岗位名称"><el-input v-model="postForm.post_name" placeholder="例如：仓库主管" /></el-form-item></div>
              <div class="form-row"><el-form-item label="岗位分类"><el-select v-model="postForm.post_category"><el-option label="高层" value="SENIOR" /><el-option label="中层" value="MIDDLE" /><el-option label="基层" value="JUNIOR" /><el-option label="其他" value="OTHER" /></el-select></el-form-item><el-form-item label="排序号"><el-input-number v-model="postForm.sort_no" :min="0" controls-position="right" /></el-form-item></div>
              <el-form-item label="备注"><el-input v-model="postForm.remark" type="textarea" :rows="3" /></el-form-item>
              <el-button type="primary" :loading="loading" @click="submitPost">创建岗位</el-button>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="员工" name="user">
            <div class="tab-intro"><span class="step-badge">03</span><div><h2>创建员工</h2><p>绑定组织、岗位和角色，并生成员工登录账号。</p></div></div>
            <el-form label-position="top" class="dense-form">
              <div class="form-row"><el-form-item label="租客编码"><el-select v-model="userForm.tenant_id" filterable allow-create placeholder="选择或输入 tenant_id"><el-option v-for="item in context.tenants" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item><el-form-item label="员工姓名"><el-input v-model="userForm.user_name" /></el-form-item></div>
              <div class="form-row"><el-form-item label="所属组织"><el-select v-model="userForm.org_id" filterable allow-create placeholder="必填 org_code"><el-option v-for="item in context.organizations" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item><el-form-item label="所属岗位"><el-select v-model="userForm.post_id" clearable filterable allow-create placeholder="选填 post_code"><el-option v-for="item in context.posts" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item></div>
              <div class="form-row"><el-form-item label="绑定角色"><el-select v-model="userForm.role_id" filterable allow-create placeholder="必填 role_code"><el-option v-for="item in context.roles" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item><el-form-item label="用户类型"><el-select v-model="userForm.user_type"><el-option label="员工" value="EMPLOYEE" /><el-option label="高管" value="EXECUTIVE" /></el-select></el-form-item></div>
              <div class="form-row"><el-form-item label="初始密码"><el-input v-model="userForm.password" type="password" show-password autocomplete="new-password" placeholder="至少 6 位，创建后立即清空" /></el-form-item><el-form-item label="排序号"><el-input-number v-model="userForm.sort_no" :min="0" controls-position="right" /></el-form-item></div>
              <div class="form-row"><el-form-item label="手机号"><el-input v-model="userForm.mobile" placeholder="选填" /></el-form-item><el-form-item label="邮箱"><el-input v-model="userForm.email" placeholder="选填" /></el-form-item></div>
              <el-button type="primary" :loading="loading" @click="submitUser">创建员工并生成账号</el-button>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </div>
      <ResultReceipt :title="resultTitle" :data="result" :primary-key="resultKey" />
    </section>
  </div>
</template>
