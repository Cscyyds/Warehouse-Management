<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { createUser } from '@/api/platformTenantResources'
import {
  queryPlatformTenants,
  queryTenantOrganizations,
  queryTenantPosts,
  queryTenantEnumMappings,
  dedupeEnumMappings,
  type OrganizationOptionRow,
  type TenantOptionRow,
} from '@/api/platformQueries'
import {
  queryPlatformTenantEmployees,
  queryPlatformTenantRoles,
} from '@/api/platformTenantOverview'
import type { TenantEmployeeRow } from '@/types/tenantOverview'
import type { UserInfo } from '@/types/platform'

/* —— 租户清单 —— */
const tenantRows = ref<TenantOptionRow[]>([])
const tenantOptions = ref<{ id: string; name: string }[]>([])
const tenantLoading = ref(false)

/* —— 选中的租户 —— */
const selectedTenantId = ref('')
const selectedTenantName = ref('')

/* —— 员工列表 —— */
const employeeRows = ref<TenantEmployeeRow[]>([])
const employeeTotal = ref(0)
const employeePage = ref(1)
const employeePageSize = 20
const employeeLoading = ref(false)
const employeeKeyword = ref('')

/* —— 创建弹窗 —— */
const dialogVisible = ref(false)
const dialogLoading = ref(false)
const formRef = ref<FormInstance>()
const orgOptions = ref<{ id: string; name: string }[]>([])
const postOptions = ref<{ id: string; name: string }[]>([])
const roleOptions = ref<{ id: string; name: string; role_type: string; role_type_label?: string | null }[]>([])
const userTypeOptions = ref([
  { value: 'EMPLOYEE', label: '员工' },
  { value: 'EXECUTIVE', label: '高管' },
])
const optionsLoading = ref(false)

/* —— 当前角色类型联动 —— */
const currentRoleType = ref('')
const currentRoleTypeLabel = ref('')
const isAdminRole = computed(() => currentRoleType.value === 'ADMIN')

const createResult = ref<UserInfo | null>(null)

const createForm = reactive({
  tenant_id: '',
  org_id: '',
  post_id: '',
  role_id: '',
  user_name: '',
  password: '',
  mobile: '',
  email: '',
  sort_no: 0,
  user_type: 'EMPLOYEE',
})

/* —— 动态表单规则 —— */
const formRules = ref<FormRules>({
  tenant_id: [{ required: true, message: '请选择租客', trigger: 'change' }],
  org_id: [{ required: true, message: '请选择所属组织', trigger: 'change' }],
  role_id: [{ required: true, message: '请选择绑定角色', trigger: 'change' }],
  user_name: [{ required: true, message: '请输入员工姓名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入初始密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
})

/* —— 监听角色变化，动态调整「所属组织」是否必填 —— */
watch(
  () => createForm.role_id,
  (newRoleId) => {
    const role = roleOptions.value.find((r) => r.id === newRoleId)
    currentRoleType.value = role?.role_type || ''
    currentRoleTypeLabel.value = role?.role_type_label || ''
    if (currentRoleType.value === 'ADMIN') {
      // 管理员角色：组织 / 岗位都可选
      formRules.value.org_id = []
    } else {
      formRules.value.org_id = [{ required: true, message: '请选择所属组织', trigger: 'change' }]
    }
  },
)

const selectedTenantLabel = computed(() =>
  selectedTenantId.value
    ? tenantOptions.value.find((t) => t.id === selectedTenantId.value)
      ? `${tenantOptions.value.find((t) => t.id === selectedTenantId.value)?.name} · ${selectedTenantId.value}`
      : selectedTenantId.value
    : '未选择租客',
)

/* —— 租户清单加载 —— */
async function loadTenantList() {
  tenantLoading.value = true
  try {
    const data = await queryPlatformTenants({ page: 1, page_size: 100 })
    tenantRows.value = data.tenant
    tenantOptions.value = data.tenant.map((item) => ({ id: item.tenant_code, name: item.tenant_name }))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '租客清单加载失败')
  } finally {
    tenantLoading.value = false
  }
}

/* —— 员工列表加载 —— */
async function loadEmployees() {
  if (!selectedTenantId.value) {
    employeeRows.value = []
    employeeTotal.value = 0
    return
  }
  employeeLoading.value = true
  try {
    const data = await queryPlatformTenantEmployees({
      tenant_id: selectedTenantId.value,
      page: employeePage.value,
      page_size: employeePageSize,
      keyword: employeeKeyword.value.trim() || undefined,
    })
    employeeRows.value = data.user
    employeeTotal.value = data.total
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '员工列表加载失败')
    employeeRows.value = []
    employeeTotal.value = 0
  } finally {
    employeeLoading.value = false
  }
}

function handleTenantSelect(tenantId: string) {
  selectedTenantId.value = tenantId
  selectedTenantName.value = tenantOptions.value.find((t) => t.id === tenantId)?.name || ''
  employeePage.value = 1
  employeeKeyword.value = ''
  loadEmployees()
}

function applyEmployeeQuery() {
  employeePage.value = 1
  loadEmployees()
}

function resetEmployeeQuery() {
  employeeKeyword.value = ''
  employeePage.value = 1
  loadEmployees()
}

function handleEmployeePageChange(page: number) {
  employeePage.value = page
  loadEmployees()
}

/* —— 创建弹窗：租户关联选项加载 —— */
function flattenOrganizations(items: OrganizationOptionRow[]): { id: string; name: string }[] {
  return items.flatMap((item) => [
    { id: item.org_code, name: item.name },
    ...flattenOrganizations(item.children || []),
  ])
}

async function loadTenantResources(tenantId: string) {
  if (!tenantId) return
  optionsLoading.value = true
  try {
    const [organizations, posts, roles, userTypes] = await Promise.all([
      queryTenantOrganizations(tenantId),
      queryTenantPosts(tenantId),
      queryPlatformTenantRoles({
        tenant_id: tenantId,
        page: 1,
        page_size: 100,
        sort_by: 'sort_no',
        sort_order: 'ASC',
      }),
      queryTenantEnumMappings(tenantId, 'USER_TYPE_MAPPING'),
    ])
    orgOptions.value = flattenOrganizations(organizations.org)
    postOptions.value = posts.post
      .filter((item) => item.status === 1)
      .map((item) => ({ id: item.post_code, name: item.post_name }))
    roleOptions.value = roles.role
      .filter((item) => item.status === 1)
      .map((item) => ({
        id: item.role_code,
        name: item.role_name,
        role_type: item.role_type,
        role_type_label: item.role_type_label ?? null,
      }))
    if (userTypes.items.length) {
      userTypeOptions.value = dedupeEnumMappings(userTypes.items)
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '租客关联选项加载失败')
  } finally {
    optionsLoading.value = false
  }
}

/* —— 打开创建弹窗 —— */
function openCreateDialog() {
  if (!selectedTenantId.value) {
    ElMessage.warning('请先选择一个租客')
    return
  }
  createResult.value = null
  resetForm()
  createForm.tenant_id = selectedTenantId.value
  dialogVisible.value = true
  loadTenantResources(selectedTenantId.value)
}

function resetForm() {
  createForm.org_id = ''
  createForm.post_id = ''
  createForm.role_id = ''
  createForm.user_name = ''
  createForm.password = ''
  createForm.mobile = ''
  createForm.email = ''
  createForm.sort_no = 0
  createForm.user_type = 'EMPLOYEE'
}

/* —— 提交创建 —— */
async function submitCreate() {
  if (!await formRef.value?.validate().catch(() => false)) return
  dialogLoading.value = true
  try {
    const data = await createUser({
      ...createForm,
      // 管理员角色允许组织留空，留空时传 org_id=0
      org_id: createForm.org_id || '0',
      post_id: createForm.post_id || undefined,
      mobile: createForm.mobile || undefined,
      email: createForm.email || undefined,
    })
    createResult.value = data
    createForm.password = ''
    ElMessage.success('员工已创建，登录账号已生成')
    // 刷新列表
    loadEmployees()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建员工失败')
  } finally {
    dialogLoading.value = false
  }
}

function closeDialog() {
  dialogVisible.value = false
  createResult.value = null
  resetForm()
  // 重置回默认规则（组织必填）
  formRules.value.org_id = [{ required: true, message: '请选择所属组织', trigger: 'change' }]
  currentRoleType.value = ''
  currentRoleTypeLabel.value = ''
}

/* —— 状态映射 —— */
function statusLabel(status: number) {
  return status === 1 ? '正常' : '停用'
}

function statusType(status: number) {
  return status === 1 ? 'success' : 'danger'
}

onMounted(() => {
  loadTenantList()
})
</script>

<template>
  <div class="page-stack">
    <PageHeader
      eyebrow="TENANT USER MANAGEMENT"
      title="租客员工管理"
      description="选择平台租客，查看其下员工列表，并为租客创建管理员权限的员工账号。"
      marker="TENANT → USER"
    />

    <!-- 租客选择区 -->
    <section class="filter-deck">
      <div class="filter-deck__head">
        <div>
          <span class="mono-label">TENANT SELECTOR</span>
          <h2>选择租客</h2>
        </div>
        <div class="filter-actions">
          <el-button :loading="tenantLoading" @click="loadTenantList">刷新租客清单</el-button>
        </div>
      </div>
      <div class="filter-grid" style="grid-template-columns: 1fr;">
        <label>
          <span>租客</span>
          <el-select
            v-model="selectedTenantId"
            filterable
            :loading="tenantLoading"
            placeholder="选择要管理员工的租客"
            style="width: 100%;"
            @change="handleTenantSelect"
          >
            <el-option
              v-for="item in tenantOptions"
              :key="item.id"
              :label="`${item.name} · ${item.id}`"
              :value="item.id"
            />
          </el-select>
        </label>
      </div>
    </section>

    <!-- 员工列表 -->
    <section v-if="selectedTenantId" class="data-panel">
      <div class="data-panel__head">
        <div>
          <span class="mono-label">EMPLOYEE ROSTER</span>
          <h2>{{ selectedTenantName }} · 员工列表</h2>
        </div>
        <div class="panel-actions">
          <el-input
            v-model="employeeKeyword"
            clearable
            placeholder="搜索姓名 / 登录账号 / 手机号"
            style="width: 260px;"
            @keyup.enter="applyEmployeeQuery"
          />
          <el-button @click="resetEmployeeQuery">重置</el-button>
          <el-button type="primary" :loading="employeeLoading" @click="applyEmployeeQuery">查询</el-button>
          <el-button type="success" @click="openCreateDialog">+ 创建员工</el-button>
        </div>
      </div>

      <el-table
        v-loading="employeeLoading"
        :data="employeeRows"
        stripe
        table-layout="fixed"
        empty-text="该租客暂无员工，点击「创建员工」添加"
      >
        <el-table-column type="index" label="#" width="56" />
        <el-table-column label="员工" min-width="160">
          <template #default="scope">
            <div class="table-person">
              <strong>{{ scope.row.user_name }}</strong>
              <span>{{ scope.row.login_name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="组织" min-width="140" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.org_name || '—' }}</template>
        </el-table-column>
        <el-table-column label="岗位" min-width="120" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.post_name || '—' }}</template>
        </el-table-column>
        <el-table-column label="角色" min-width="140" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.role_name">{{ scope.row.role_name }}</span>
            <span v-else>—</span>
            <small v-if="scope.row.role_type" style="color: #8190a0; margin-left: 4px;">({{ scope.row.role_type }})</small>
          </template>
        </el-table-column>
        <el-table-column label="用户类型" width="100">
          <template #default="scope">{{ scope.row.user_type_label || scope.row.user_type || '—' }}</template>
        </el-table-column>
        <el-table-column label="手机号" width="130" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.mobile || '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="scope">
            <span class="status-pill" :class="scope.row.status === 1 ? 'is-success' : 'is-danger'">
              {{ statusLabel(scope.row.status) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="最近登录IP" width="130" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.last_login_ip || '—' }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="170" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.created_at || '—' }}</template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <span>共 <strong>{{ employeeTotal }}</strong> 名员工</span>
        <el-pagination
          background
          layout="prev, pager, next"
          :page-size="employeePageSize"
          :total="employeeTotal"
          :current-page="employeePage"
          @current-change="handleEmployeePageChange"
        />
      </div>
    </section>

    <section v-else class="data-panel">
      <div style="padding: 60px 24px; text-align: center; color: #8a98a7; font-size: 13px;">
        请先在上方选择一个租客，即可查看和管理其下员工
      </div>
    </section>

    <!-- 创建员工弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      title="创建租客员工（管理员权限）"
      width="680px"
      :close-on-click-modal="false"
      @close="closeDialog"
    >
      <!-- 创建结果回执 -->
      <div v-if="createResult" class="create-result">
        <el-alert type="success" :closable="false" show-icon style="margin-bottom: 16px;">
          <template #title>员工创建成功</template>
          <template #default>
            员工「{{ createResult.user_name }}」已创建，登录账号：<strong>{{ createResult.login_name }}</strong>
          </template>
        </el-alert>
        <dl class="result-detail-list">
          <dt>user_id</dt><dd>{{ createResult.user_id }}</dd>
          <dt>login_name</dt><dd>{{ createResult.login_name }}</dd>
          <dt>user_name</dt><dd>{{ createResult.user_name }}</dd>
          <dt>org_id</dt><dd>{{ createResult.org_id || '—' }}</dd>
          <dt>post_id</dt><dd>{{ createResult.post_id || '—' }}</dd>
          <dt>company_id</dt><dd>{{ createResult.company_id }}</dd>
          <dt>status</dt><dd>{{ createResult.status === 1 ? '正常' : '停用' }}</dd>
        </dl>
        <div style="text-align: right; margin-top: 16px;">
          <el-button @click="closeDialog">关闭</el-button>
          <el-button type="primary" @click="() => { createResult = null; resetForm(); }">继续创建</el-button>
        </div>
      </div>

      <!-- 创建表单 -->
      <div v-else>
        <div class="dialog-notice">
          <span class="mono-label">TARGET TENANT</span>
          <p>当前操作租客：<strong>{{ selectedTenantLabel }}</strong></p>
        </div>

        <el-form
          ref="formRef"
          :model="createForm"
          :rules="formRules"
          label-position="top"
          class="dense-form"
        >
          <div class="form-row">
            <el-form-item :label="isAdminRole ? '所属组织（管理员可留空）' : '所属组织'" prop="org_id" :required="!isAdminRole">
              <el-select
                v-model="createForm.org_id"
                :clearable="isAdminRole"
                filterable
                :loading="optionsLoading"
                :placeholder="isAdminRole ? '管理员可选填' : ''"
              >
                <el-option
                  v-for="item in orgOptions"
                  :key="item.id"
                  :label="`${item.name} · ${item.id}`"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="所属岗位（可选）">
              <el-select
                v-model="createForm.post_id"
                clearable
                filterable
                :loading="optionsLoading"
                placeholder="选填"
              >
                <el-option
                  v-for="item in postOptions"
                  :key="item.id"
                  :label="`${item.name} · ${item.id}`"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </div>

          <div class="form-row">
            <el-form-item label="绑定角色" prop="role_id">
              <el-select
                v-model="createForm.role_id"
                filterable
                :loading="optionsLoading"
                placeholder="选择可用角色"
              >
                <el-option
                  v-for="item in roleOptions"
                  :key="item.id"
                  :label="`${item.name} · ${item.id}${item.role_type_label ? '（' + item.role_type_label + '）' : ''}`"
                  :value="item.id"
                />
              </el-select>
              <div v-if="isAdminRole" class="role-type-hint">
                <el-tag size="small" type="warning" effect="light">管理员角色</el-tag>
                <span>已绑定管理员角色，「所属组织」与「所属岗位」均为可选</span>
              </div>
            </el-form-item>
            <el-form-item label="用户类型">
              <el-select v-model="createForm.user_type" :loading="optionsLoading">
                <el-option
                  v-for="item in userTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </div>

          <div class="form-row">
            <el-form-item label="员工姓名" prop="user_name">
              <el-input v-model="createForm.user_name" placeholder="例如：张三" />
            </el-form-item>
            <el-form-item label="初始密码" prop="password">
              <el-input
                v-model="createForm.password"
                type="password"
                show-password
                autocomplete="new-password"
                placeholder="至少 6 位"
              />
            </el-form-item>
          </div>

          <div class="form-row">
            <el-form-item label="手机号">
              <el-input v-model="createForm.mobile" placeholder="选填" />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input v-model="createForm.email" placeholder="选填" />
            </el-form-item>
          </div>

          <div class="form-row">
            <el-form-item label="排序号">
              <el-input-number v-model="createForm.sort_no" :min="0" controls-position="right" style="width: 100%;" />
            </el-form-item>
            <div></div>
          </div>
        </el-form>

        <div style="text-align: right; margin-top: 8px;">
          <el-button @click="closeDialog">取消</el-button>
          <el-button type="primary" :loading="dialogLoading" @click="submitCreate">
            创建员工并生成账号
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.create-result {
  padding: 4px 0;
}

.result-detail-list {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  margin: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}

.result-detail-list dt,
.result-detail-list dd {
  margin: 0;
  padding: 10px 13px;
  border-bottom: 1px solid var(--line);
  overflow-wrap: anywhere;
}

.result-detail-list dt {
  color: #718193;
  background: #f7f9fb;
  font-family: "Cascadia Mono", monospace;
  font-size: 10px;
}

.result-detail-list dd {
  color: #33475b;
  font-size: 12px;
  font-weight: 650;
}

.result-detail-list dt:last-of-type,
.result-detail-list dd:last-of-type {
  border-bottom: 0;
}

.role-type-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  color: #a66c18;
  font-size: 11px;
  line-height: 1.5;
}
</style>
