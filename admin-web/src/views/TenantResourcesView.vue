<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import FlowRail from '@/components/FlowRail.vue'
import ResultReceipt from '@/components/ResultReceipt.vue'
import { createOrganization, createPost, createUser } from '@/api/platformTenantResources'
import {
  queryPlatformTenants,
  queryTenantEnumMappings,
  queryTenantOrganizations,
  queryTenantPosts,
  queryTenantRoles,
  type OrganizationOptionRow,
  type TenantOptionRow,
} from '@/api/platformQueries'
import { useCreationContextStore } from '@/stores/creationContext'
import type { CreatedRef } from '@/stores/creationContext'

const context = useCreationContextStore()
const activeTab = ref('organization')
const loading = ref(false)
const result = ref<Record<string, unknown> | null>(null)
const resultTitle = ref('等待创建基础资料')
const resultKey = ref('')
const optionsLoading = ref(false)
const tenantOptions = ref<CreatedRef[]>([])
const organizationOptions = ref<CreatedRef[]>([])
const postOptions = ref<CreatedRef[]>([])
const roleOptions = ref<CreatedRef[]>([])
const organizationTypeOptions = ref([
  { value: 'PROVINCE', label: '省级' },
  { value: 'CITY', label: '市级' },
  { value: 'DEPARTMENT', label: '部门' },
])
const postCategoryOptions = ref([
  { value: 'SENIOR', label: '高层' },
  { value: 'MIDDLE', label: '中层' },
  { value: 'JUNIOR', label: '基层' },
  { value: 'OTHER', label: '其他' },
])
const userTypeOptions = ref([
  { value: 'EMPLOYEE', label: '员工' },
  { value: 'EXECUTIVE', label: '高管' },
])

const organizationForm = reactive({ tenant_id: '', org_name: '', org_full_name: '', sort_no: 0, org_type: 'DEPARTMENT', parent_id: '', leader_name: '', contact_address: '', email: '', post_code: '', remark: '' })
const postForm = reactive({ tenant_id: '', post_name: '', post_category: 'OTHER', sort_no: 0, remark: '' })
const userForm = reactive({ tenant_id: '', org_id: '', post_id: '', user_name: '', password: '', mobile: '', email: '', sort_no: 0, user_type: 'EMPLOYEE', role_id: '' })

/* —— 租户清单表格（租客基础资料页顶部展示） —— */
const tenantTableLoading = ref(false)
const tenantRows = ref<TenantOptionRow[]>([])
const tenantTotal = ref(0)
const tenantPage = ref(1)
const tenantPageSize = 20
const tenantKeyword = ref('')

async function loadTenantTable() {
  tenantTableLoading.value = true
  try {
    const data = await queryPlatformTenants({
      page: tenantPage.value,
      page_size: tenantPageSize,
      keyword: tenantKeyword.value.trim() || undefined,
    })
    tenantRows.value = data.tenant
    tenantTotal.value = data.total
  } catch (error) {
    tenantRows.value = []
    tenantTotal.value = 0
    ElMessage.error(error instanceof Error ? error.message : '租户清单加载失败')
  } finally {
    tenantTableLoading.value = false
  }
}

function applyTenantQuery() { tenantPage.value = 1; loadTenantTable() }
function resetTenantQuery() { tenantKeyword.value = ''; tenantPage.value = 1; loadTenantTable() }
function changeTenantPage(next: number) { tenantPage.value = next; loadTenantTable() }

const flowSteps = computed(() => [
  { key: 'organization', label: '组织', note: context.organizations[0]?.id || '生成 org_code', ready: context.organizations.length > 0 },
  { key: 'post', label: '岗位', note: context.posts[0]?.id || '生成 post_code', ready: context.posts.length > 0 },
  { key: 'user', label: '员工', note: result.value?.login_name ? String(result.value.login_name) : '生成登录账号', ready: Boolean(result.value?.login_name) },
])

function flattenOrganizations(items: OrganizationOptionRow[]): CreatedRef[] {
  return items.flatMap((item) => [
    { id: item.org_code, name: item.org_name },
    ...flattenOrganizations(item.children || []),
  ])
}

function addOption(target: CreatedRef[], item: CreatedRef) {
  if (!target.some((current) => current.id === item.id)) target.unshift(item)
}

async function loadTenants() {
  optionsLoading.value = true
  try {
    const data = await queryPlatformTenants()
    tenantOptions.value = data.tenant.map((item) => ({ id: item.tenant_code, name: item.tenant_name }))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '租客选项加载失败')
  } finally {
    optionsLoading.value = false
  }
}

function handleTenantDropdownVisible(visible: boolean) {
  if (visible && !optionsLoading.value) loadTenants()
}

async function loadOrganizationOptions(tenantId: string) {
  if (!tenantId || optionsLoading.value) return
  optionsLoading.value = true
  try {
    const data = await queryTenantOrganizations(tenantId)
    organizationOptions.value = flattenOrganizations(data.org)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '组织选项加载失败')
  } finally {
    optionsLoading.value = false
  }
}

async function loadPostOptions(tenantId: string) {
  if (!tenantId || optionsLoading.value) return
  optionsLoading.value = true
  try {
    const data = await queryTenantPosts(tenantId)
    postOptions.value = data.post
      .filter((item) => item.status === 1)
      .map((item) => ({ id: item.post_code, name: item.post_name }))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '岗位选项加载失败')
  } finally {
    optionsLoading.value = false
  }
}

async function loadRoleOptions(tenantId: string) {
  if (!tenantId || optionsLoading.value) return
  optionsLoading.value = true
  try {
    const data = await queryTenantRoles(tenantId)
    roleOptions.value = data.role
      .filter((item) => item.status === 1)
      .map((item) => ({ id: item.role_code, name: item.role_name }))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '角色选项加载失败')
  } finally {
    optionsLoading.value = false
  }
}

function handleOrganizationDropdownVisible(visible: boolean, tenantId: string) {
  if (visible) loadOrganizationOptions(tenantId)
}

function handlePostDropdownVisible(visible: boolean) {
  if (visible) loadPostOptions(userForm.tenant_id)
}

function handleRoleDropdownVisible(visible: boolean) {
  if (visible) loadRoleOptions(userForm.tenant_id)
}

async function loadTenantResources(tenantId: string) {
  organizationOptions.value = []
  postOptions.value = []
  roleOptions.value = []
  if (!tenantId) return
  optionsLoading.value = true
  try {
    const [organizations, posts, roles, organizationTypes, postCategories, userTypes] = await Promise.all([
      queryTenantOrganizations(tenantId),
      queryTenantPosts(tenantId),
      queryTenantRoles(tenantId),
      queryTenantEnumMappings(tenantId, 'ORG_TYPE_MAPPING'),
      queryTenantEnumMappings(tenantId, 'POST_CATEGORY_MAPPING'),
      queryTenantEnumMappings(tenantId, 'USER_TYPE_MAPPING'),
    ])
    organizationOptions.value = flattenOrganizations(organizations.org)
    postOptions.value = posts.post
      .filter((item) => item.status === 1)
      .map((item) => ({ id: item.post_code, name: item.post_name }))
    roleOptions.value = roles.role
      .filter((item) => item.status === 1)
      .map((item) => ({ id: item.role_code, name: item.role_name }))
    if (organizationTypes.items.length) {
      organizationTypeOptions.value = organizationTypes.items.map((item) => ({ value: item.standard_value, label: item.display_label }))
    }
    if (postCategories.items.length) {
      postCategoryOptions.value = postCategories.items.map((item) => ({ value: item.standard_value, label: item.display_label }))
    }
    if (userTypes.items.length) {
      userTypeOptions.value = userTypes.items.map((item) => ({ value: item.standard_value, label: item.display_label }))
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '租客关联选项加载失败')
  } finally {
    optionsLoading.value = false
  }
}

function handleTenantChange(tenantId: string) {
  organizationForm.tenant_id = tenantId
  postForm.tenant_id = tenantId
  userForm.tenant_id = tenantId
  organizationForm.parent_id = ''
  userForm.org_id = ''
  userForm.post_id = ''
  userForm.role_id = ''
  loadTenantResources(tenantId)
}

onMounted(() => { loadTenants(); loadTenantTable() })

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
    addOption(organizationOptions.value, { id: data.org_code, name: data.org_name })
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
    addOption(postOptions.value, { id: data.post_code, name: data.post_name })
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
    <PageHeader eyebrow="TENANT BASIC PROFILE" title="租客基础资料" description="先浏览平台已开通的租户清单，再为选定租户落位组织、岗位与员工。" marker="ORG → POST → USER" />

    <section class="filter-deck">
      <div class="filter-deck__head">
        <div><span class="mono-label">TENANT DIRECTORY</span><h2>租户检索</h2></div>
        <div class="filter-actions">
          <el-button @click="resetTenantQuery">重置</el-button>
          <el-button type="primary" :loading="tenantTableLoading" @click="applyTenantQuery">查询租户</el-button>
        </div>
      </div>
      <div class="filter-grid">
        <label><span>关键词</span><el-input v-model="tenantKeyword" clearable placeholder="租户编码 / 租户名称" @keyup.enter="applyTenantQuery" /></label>
      </div>
    </section>

    <section class="data-panel">
      <div class="data-panel__head">
        <div><span class="mono-label">TENANT ROSTER</span><h2>租户列表</h2></div>
        <span class="record-count"><strong>{{ tenantTotal }}</strong> 个租户</span>
      </div>
      <el-table v-loading="tenantTableLoading" :data="tenantRows" stripe table-layout="fixed" empty-text="暂无启用的租户">
        <el-table-column type="index" label="" width="64" />
        <el-table-column label="租户编码" min-width="200"><template #default="scope"><span class="table-code">{{ scope.row.tenant_code }}</span></template></el-table-column>
        <el-table-column prop="tenant_name" label="租户名称" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="110"><template #default><span class="status-pill is-success">启用</span></template></el-table-column>
      </el-table>
      <div class="pagination-bar">
        <span>仅展示已开通的租户</span>
        <el-pagination background layout="prev, pager, next" :page-size="tenantPageSize" :total="tenantTotal" :current-page="tenantPage" @current-change="changeTenantPage" />
      </div>
    </section>

    <FlowRail :steps="flowSteps" :active="activeTab" />

    <section class="workspace-split">
      <div class="operation-card operation-card--tabs">
        <el-tabs v-model="activeTab" class="resource-tabs">
          <el-tab-pane label="组织" name="organization">
            <div class="tab-intro"><span class="step-badge">01</span><div><h2>创建组织</h2><p>建立租客内部可用于人员归属的组织节点。</p></div></div>
            <el-form label-position="top" class="dense-form">
              <div class="form-row"><el-form-item label="租客编码"><el-select v-model="organizationForm.tenant_id" filterable :loading="optionsLoading" placeholder="选择可用租客" @visible-change="handleTenantDropdownVisible" @change="handleTenantChange"><el-option v-for="item in tenantOptions" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item><el-form-item label="组织类型"><el-select v-model="organizationForm.org_type" :loading="optionsLoading"><el-option v-for="item in organizationTypeOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item></div>
              <div class="form-row"><el-form-item label="组织简称"><el-input v-model="organizationForm.org_name" placeholder="例如：销售部" /></el-form-item><el-form-item label="组织全称"><el-input v-model="organizationForm.org_full_name" placeholder="选填" /></el-form-item></div>
              <div class="form-row"><el-form-item label="上级组织"><el-select v-model="organizationForm.parent_id" clearable filterable :loading="optionsLoading" placeholder="顶级组织留空" @visible-change="handleOrganizationDropdownVisible($event, organizationForm.tenant_id)"><el-option v-for="item in organizationOptions" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item><el-form-item label="排序号"><el-input-number v-model="organizationForm.sort_no" :min="0" controls-position="right" /></el-form-item></div>
              <div class="form-row"><el-form-item label="负责人"><el-input v-model="organizationForm.leader_name" placeholder="选填" /></el-form-item><el-form-item label="联系邮箱"><el-input v-model="organizationForm.email" placeholder="选填" /></el-form-item></div>
              <div class="form-row"><el-form-item label="联系地址"><el-input v-model="organizationForm.contact_address" placeholder="选填" /></el-form-item><el-form-item label="邮政编码"><el-input v-model="organizationForm.post_code" placeholder="选填" /></el-form-item></div>
              <el-form-item label="备注"><el-input v-model="organizationForm.remark" type="textarea" :rows="2" /></el-form-item>
              <el-button type="primary" :loading="loading" @click="submitOrganization">创建组织</el-button>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="岗位" name="post">
            <div class="tab-intro"><span class="step-badge">02</span><div><h2>创建岗位</h2><p>定义员工在组织中的工作位置。</p></div></div>
            <el-form label-position="top" class="dense-form">
              <div class="form-row"><el-form-item label="租客编码"><el-select v-model="postForm.tenant_id" filterable :loading="optionsLoading" placeholder="选择可用租客" @visible-change="handleTenantDropdownVisible" @change="handleTenantChange"><el-option v-for="item in tenantOptions" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item><el-form-item label="岗位名称"><el-input v-model="postForm.post_name" placeholder="例如：仓库主管" /></el-form-item></div>
              <div class="form-row"><el-form-item label="岗位分类"><el-select v-model="postForm.post_category" :loading="optionsLoading"><el-option v-for="item in postCategoryOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item><el-form-item label="排序号"><el-input-number v-model="postForm.sort_no" :min="0" controls-position="right" /></el-form-item></div>
              <el-form-item label="备注"><el-input v-model="postForm.remark" type="textarea" :rows="3" /></el-form-item>
              <el-button type="primary" :loading="loading" @click="submitPost">创建岗位</el-button>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="员工" name="user">
            <div class="tab-intro"><span class="step-badge">03</span><div><h2>创建员工</h2><p>绑定组织、岗位和角色，并生成员工登录账号。</p></div></div>
            <el-form label-position="top" class="dense-form">
              <div class="form-row"><el-form-item label="租客编码"><el-select v-model="userForm.tenant_id" filterable :loading="optionsLoading" placeholder="选择可用租客" @visible-change="handleTenantDropdownVisible" @change="handleTenantChange"><el-option v-for="item in tenantOptions" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item><el-form-item label="员工姓名"><el-input v-model="userForm.user_name" /></el-form-item></div>
              <div class="form-row"><el-form-item label="所属组织"><el-select v-model="userForm.org_id" filterable :loading="optionsLoading" placeholder="选择所属组织" @visible-change="handleOrganizationDropdownVisible($event, userForm.tenant_id)"><el-option v-for="item in organizationOptions" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item><el-form-item label="所属岗位"><el-select v-model="userForm.post_id" clearable filterable :loading="optionsLoading" placeholder="选择所属岗位" @visible-change="handlePostDropdownVisible"><el-option v-for="item in postOptions" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item></div>
              <div class="form-row"><el-form-item label="绑定角色"><el-select v-model="userForm.role_id" filterable :loading="optionsLoading" placeholder="选择可用角色" @visible-change="handleRoleDropdownVisible"><el-option v-for="item in roleOptions" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item><el-form-item label="用户类型"><el-select v-model="userForm.user_type" :loading="optionsLoading"><el-option v-for="item in userTypeOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item></div>
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
