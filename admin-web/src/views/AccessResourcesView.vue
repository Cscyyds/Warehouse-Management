<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import FlowRail from '@/components/FlowRail.vue'
import ResultReceipt from '@/components/ResultReceipt.vue'
import { createApiResource, createButton, createMenu, createPermission, createRole } from '@/api/platformAccessResources'
import { listEnumMappings } from '@/api/enumMappings'
import {
  flattenPermissionMenus,
  queryPlatformApis,
  queryPlatformButtons,
  queryPlatformMenus,
  queryPlatformPermissions,
  queryPlatformTenants,
} from '@/api/platformQueries'
import type { PermissionOwner } from '@/types/platform'
import { useCreationContextStore, type CreatedRef } from '@/stores/creationContext'

const context = useCreationContextStore()
const activeTab = ref('menu')
/** 权限归属：菜单/按钮/API/权限资源链须保持同一归属，查询与创建均按此过滤 */
const permissionOwner = ref<PermissionOwner>('WMS_PLATFORM')
const ownerOptions: Array<{ value: PermissionOwner; label: string }> = [
  { value: 'WMS_PLATFORM', label: 'WMS 平台' },
  { value: 'WMS_SCANNER', label: 'WMS 扫码枪' },
]
const loading = ref(false)
const result = ref<Record<string, unknown> | null>(null)
const resultTitle = ref('等待创建资源')
const resultKey = ref('')
const optionsLoading = ref(false)
const tenantOptions = ref<CreatedRef[]>([])
const menuOptions = ref<CreatedRef[]>([])
const buttonOptions = ref<CreatedRef[]>([])
const parentButtonOptions = ref<CreatedRef[]>([])
const apiOptions = ref<CreatedRef[]>([])
const permissionOptions = ref<CreatedRef[]>([])
const permissionTypeOptions = ref([
  { value: 'MENU', label: '菜单' },
  { value: 'BUTTON', label: '按钮' },
  { value: 'API', label: '接口' },
])
const roleTypeOptions = ref([
  { value: 'MANAGER', label: '主管' },
  { value: 'EMPLOYEE', label: '员工' },
  { value: 'ADMIN', label: '管理员' },
])

const menuForm = reactive({ menu_name: '', menu_status: 1 })
const buttonForm = reactive({ button_name: '', button_status: 1, menu_id: '', parent_id: '' })
const apiForm = reactive({ api_name: '', api_path: '', api_function: '', http_method: 'POST', button_id: '', api_status: 1 })
const permissionForm = reactive({ perm_name: '', perm_type: 'API', function_id: '', sort_no: 0 })
const roleForm = reactive({ tenant_id: '', role_name: '', role_type: 'EMPLOYEE', sort_no: 0, remark: '', permission_id: [] as string[] })

const flowSteps = computed(() => [
  { key: 'menu', label: '菜单', note: last(context.menus, 'menu_id'), ready: context.menus.length > 0 },
  { key: 'button', label: '按钮', note: last(context.buttons, 'button_id'), ready: context.buttons.length > 0 },
  { key: 'api', label: 'API', note: last(context.apis, 'api_id'), ready: context.apis.length > 0 },
  { key: 'permission', label: '权限', note: last(context.permissions, 'perm_code'), ready: context.permissions.length > 0 },
  { key: 'role', label: '角色', note: last(context.roles, 'role_code'), ready: context.roles.length > 0 },
])

const functionOptions = computed<CreatedRef[]>(() => {
  if (permissionForm.perm_type === 'MENU') return menuOptions.value
  if (permissionForm.perm_type === 'BUTTON') return buttonOptions.value
  return apiOptions.value
})

function addOption(target: CreatedRef[], item: CreatedRef) {
  if (!target.some((current) => current.id === item.id)) target.unshift(item)
}

async function loadAccessOptions() {
  optionsLoading.value = true
  try {
    const owner = permissionOwner.value
    const [tenants, menus, buttons, apis, permissions, permissionTypes, roleTypes] = await Promise.all([
      queryPlatformTenants(),
      queryPlatformMenus({ permission_owner: owner }),
      queryPlatformButtons({ permission_owner: owner }),
      queryPlatformApis({ permission_owner: owner }),
      queryPlatformPermissions({ permission_owner: owner }),
      listEnumMappings({ mapping_group: 'PERMISSION_TYPE_MAPPING', status: 1, company_id: 'all', page: 1, page_size: 100 }),
      listEnumMappings({ mapping_group: 'ROLE_TYPE_MAPPING', status: 1, company_id: 'all', page: 1, page_size: 100 }),
    ])
    tenantOptions.value = tenants.tenant.map((item) => ({ id: item.tenant_code, name: item.tenant_name }))
    menuOptions.value = menus.menu.map((item) => ({ id: item.menu_id, name: item.menu_name }))
    buttonOptions.value = buttons.button.map((item) => ({ id: item.button_id, name: item.button_name }))
    parentButtonOptions.value = [...buttonOptions.value]
    apiOptions.value = apis.api.map((item) => ({ id: item.api_id, name: item.api_name }))
    permissionOptions.value = flattenPermissionMenus(permissions.menus).map((item) => ({ id: item.perm_code, name: item.perm_name }))
    if (permissionTypes.items.length) {
      permissionTypeOptions.value = permissionTypes.items.map((item) => ({ value: item.standard_value, label: item.display_label }))
    }
    if (roleTypes.items.length) {
      roleTypeOptions.value = roleTypes.items.map((item) => ({ value: item.standard_value, label: item.display_label }))
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '权限资源选项加载失败')
  } finally {
    optionsLoading.value = false
  }
}

/** 切换权限归属：清空跨归属的级联选择，并按新归属重载全部可选项 */
function handleOwnerChange() {
  buttonForm.menu_id = ''
  buttonForm.parent_id = ''
  parentButtonOptions.value = []
  apiForm.button_id = ''
  permissionForm.function_id = ''
  roleForm.permission_id = []
  void loadAccessOptions()
}

async function handleTenantDropdownVisible(visible: boolean) {
  if (!visible || optionsLoading.value) return
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

onMounted(loadAccessOptions)

async function loadParentButtons(menuId: string) {
  buttonForm.parent_id = ''
  if (!menuId) {
    parentButtonOptions.value = []
    return
  }
  optionsLoading.value = true
  try {
    const data = await queryPlatformButtons({ menu_id: menuId, permission_owner: permissionOwner.value })
    parentButtonOptions.value = data.button.map((item) => ({ id: item.button_id, name: item.button_name }))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '父按钮选项加载失败')
  } finally {
    optionsLoading.value = false
  }
}

function last(items: CreatedRef[], fallback: string) {
  return items[0]?.id || fallback
}

function showResult(title: string, key: string, data: object) {
  resultTitle.value = title
  resultKey.value = key
  result.value = { ...data }
}

async function run(task: () => Promise<void>) {
  if (loading.value) return
  loading.value = true
  try { await task() } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建失败')
  } finally { loading.value = false }
}

function requireFields(values: Array<[unknown, string]>) {
  const missing = values.find(([value]) => value === undefined || value === null || String(value).trim() === '')
  if (missing) {
    ElMessage.warning(`请填写${missing[1]}`)
    return false
  }
  return true
}

function submitMenu() {
  if (!requireFields([[menuForm.menu_name, '菜单名称']])) return
  run(async () => {
    const data = await createMenu({ ...menuForm, menu_name: menuForm.menu_name.trim(), permission_owner: permissionOwner.value })
    context.addMenu(data.menu_id, data.menu_name)
    addOption(menuOptions.value, { id: data.menu_id, name: data.menu_name })
    buttonForm.menu_id = data.menu_id
    activeTab.value = 'button'
    showResult('菜单创建结果', 'menu_id', data)
    ElMessage.success('菜单已创建，ID 已接力到按钮表单')
  })
}

function submitButton() {
  if (!requireFields([[buttonForm.button_name, '按钮名称'], [buttonForm.menu_id, '所属菜单']])) return
  run(async () => {
    const data = await createButton({ ...buttonForm, parent_id: buttonForm.parent_id || undefined, permission_owner: permissionOwner.value })
    context.addButton(data.button_id, data.button_name)
    addOption(buttonOptions.value, { id: data.button_id, name: data.button_name })
    if (data.menu_id === buttonForm.menu_id) addOption(parentButtonOptions.value, { id: data.button_id, name: data.button_name })
    apiForm.button_id = data.button_id
    activeTab.value = 'api'
    showResult('按钮创建结果', 'button_id', data)
    ElMessage.success('按钮已创建，ID 已接力到 API 表单')
  })
}

function submitApi() {
  if (!requireFields([[apiForm.api_name, '接口名称'], [apiForm.api_path, '接口路径'], [apiForm.button_id, '所属按钮']])) return
  if (!apiForm.api_path.startsWith('/')) {
    ElMessage.warning('接口路径必须以 / 开头')
    return
  }
  run(async () => {
    const data = await createApiResource({ ...apiForm, api_function: apiForm.api_function || undefined, permission_owner: permissionOwner.value })
    context.addApi(data.api_id, data.api_name)
    addOption(apiOptions.value, { id: data.api_id, name: data.api_name })
    permissionForm.perm_type = 'API'
    permissionForm.function_id = data.api_id
    activeTab.value = 'permission'
    showResult('API 创建结果', 'api_id', data)
    ElMessage.success('API 已注册，ID 已接力到权限表单')
  })
}

function submitPermission() {
  if (!requireFields([[permissionForm.perm_name, '权限名称'], [permissionForm.perm_type, '权限类型'], [permissionForm.function_id, '功能 ID']])) return
  run(async () => {
    const data = await createPermission({ ...permissionForm, permission_owner: permissionOwner.value })
    context.addPermission(data.perm_code, data.perm_name)
    addOption(permissionOptions.value, { id: data.perm_code, name: data.perm_name })
    roleForm.permission_id = [data.perm_code]
    activeTab.value = 'role'
    showResult('权限创建结果', 'perm_code', data)
    ElMessage.success('权限已创建，编码已接力到角色表单')
  })
}

function submitRole() {
  const adminRole = roleForm.role_type === 'ADMIN'
  if (!requireFields([[roleForm.role_name, '角色名称'], [adminRole ? 'all' : roleForm.tenant_id, '租客编码']])) return
  if (!adminRole && roleForm.permission_id.length === 0) {
    ElMessage.warning('非管理员角色至少绑定一个权限')
    return
  }
  run(async () => {
    const data = await createRole({
      ...roleForm,
      tenant_id: adminRole ? 'all' : roleForm.tenant_id,
      remark: roleForm.remark || undefined,
      permission_id: adminRole ? undefined : roleForm.permission_id,
    })
    context.addRole(data.role_code, data.role_name)
    showResult('角色创建结果', 'role_code', data)
    ElMessage.success('权限资源链已完成')
  })
}
</script>

<template>
  <div class="page-stack">
    <PageHeader eyebrow="ACCESS ORCHESTRATION" title="权限资源" description="沿着资源依赖顺序注册菜单、按钮、接口、权限和角色，可按 WMS 平台或扫码枪归属分别创建。" marker="5-STAGE CHAIN" />
    <FlowRail :steps="flowSteps" :active="activeTab" />

    <section class="workspace-split">
      <div class="operation-card operation-card--tabs">
        <div class="owner-bar">
          <span class="owner-bar__title">权限归属</span>
          <el-radio-group v-model="permissionOwner" @change="handleOwnerChange">
            <el-radio-button v-for="item in ownerOptions" :key="item.value" :value="item.value">{{ item.label }}</el-radio-button>
          </el-radio-group>
          <span class="owner-bar__hint">菜单、按钮、API、权限须保持同一归属，切换后选项将按新归属重新过滤</span>
        </div>
        <el-tabs v-model="activeTab" class="resource-tabs">
          <el-tab-pane label="菜单" name="menu">
            <div class="tab-intro"><span class="step-badge">01</span><div><h2>创建菜单</h2><p>定义权限体系最上层的页面入口。</p></div></div>
            <el-form label-position="top" class="dense-form">
              <el-form-item label="菜单名称"><el-input v-model="menuForm.menu_name" maxlength="100" placeholder="例如：采购管理" /></el-form-item>
              <el-form-item label="启用状态"><el-switch v-model="menuForm.menu_status" :active-value="1" :inactive-value="0" inline-prompt active-text="启用" inactive-text="停用" /></el-form-item>
              <el-button type="primary" :loading="loading" @click="submitMenu">创建菜单</el-button>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="按钮" name="button">
            <div class="tab-intro"><span class="step-badge">02</span><div><h2>创建按钮</h2><p>把页面操作归入已创建的菜单。</p></div></div>
            <el-form label-position="top" class="dense-form">
              <div class="form-row"><el-form-item label="按钮名称"><el-input v-model="buttonForm.button_name" placeholder="例如：新增供应商" /></el-form-item><el-form-item label="所属菜单 ID"><el-select v-model="buttonForm.menu_id" filterable :loading="optionsLoading" placeholder="选择可用菜单" @change="loadParentButtons"><el-option v-for="item in menuOptions" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item></div>
              <div class="form-row"><el-form-item label="父按钮 ID（可选）"><el-select v-model="buttonForm.parent_id" clearable filterable :loading="optionsLoading" placeholder="选择同菜单父按钮"><el-option v-for="item in parentButtonOptions" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item><el-form-item label="启用状态"><el-switch v-model="buttonForm.button_status" :active-value="1" :inactive-value="0" inline-prompt active-text="启用" inactive-text="停用" /></el-form-item></div>
              <el-button type="primary" :loading="loading" @click="submitButton">创建按钮</el-button>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="API" name="api">
            <div class="tab-intro"><span class="step-badge">03</span><div><h2>注册 API 功能</h2><p>将后端操作与页面按钮建立归属关系。</p></div></div>
            <el-form label-position="top" class="dense-form">
              <div class="form-row"><el-form-item label="接口名称"><el-input v-model="apiForm.api_name" placeholder="例如：新增供应商接口" /></el-form-item><el-form-item label="所属按钮 ID"><el-select v-model="apiForm.button_id" filterable :loading="optionsLoading" placeholder="选择可用按钮"><el-option v-for="item in buttonOptions" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item></div>
              <div class="form-row"><el-form-item label="HTTP 方法"><el-select v-model="apiForm.http_method"><el-option v-for="method in ['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD']" :key="method" :label="method" :value="method" /></el-select></el-form-item><el-form-item label="接口路径"><el-input v-model="apiForm.api_path" class="mono-input" placeholder="/tenant-suppliers/create" /></el-form-item></div>
              <el-form-item label="功能描述"><el-input v-model="apiForm.api_function" type="textarea" :rows="3" placeholder="说明该接口完成的具体操作" /></el-form-item>
              <el-form-item label="启用状态"><el-switch v-model="apiForm.api_status" :active-value="1" :inactive-value="0" inline-prompt active-text="启用" inactive-text="停用" /></el-form-item>
              <el-button type="primary" :loading="loading" @click="submitApi">注册 API</el-button>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="权限" name="permission">
            <div class="tab-intro"><span class="step-badge">04</span><div><h2>创建权限</h2><p>把一个已启用资源包装为可分配权限。</p></div></div>
            <el-form label-position="top" class="dense-form">
              <div class="form-row"><el-form-item label="权限名称"><el-input v-model="permissionForm.perm_name" placeholder="例如：查看供应商列表" /></el-form-item><el-form-item label="权限类型"><el-select v-model="permissionForm.perm_type" :loading="optionsLoading" @change="permissionForm.function_id = ''"><el-option v-for="item in permissionTypeOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item></div>
              <div class="form-row"><el-form-item label="功能 ID"><el-select v-model="permissionForm.function_id" filterable :loading="optionsLoading" placeholder="选择可用功能"><el-option v-for="item in functionOptions" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item><el-form-item label="排序号"><el-input-number v-model="permissionForm.sort_no" :min="0" controls-position="right" /></el-form-item></div>
              <el-button type="primary" :loading="loading" @click="submitPermission">创建权限</el-button>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="角色" name="role">
            <div class="tab-intro"><span class="step-badge">05</span><div><h2>创建角色</h2><p>将权限集合交付给租客内的人员角色。</p></div></div>
            <el-form label-position="top" class="dense-form">
              <div class="form-row"><el-form-item label="角色名称"><el-input v-model="roleForm.role_name" placeholder="例如：仓库主管" /></el-form-item><el-form-item label="角色类型"><el-select v-model="roleForm.role_type" :loading="optionsLoading"><el-option v-for="item in roleTypeOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item></div>
              <div class="form-row"><el-form-item label="租客编码"><el-select v-model="roleForm.tenant_id" :disabled="roleForm.role_type === 'ADMIN'" filterable :loading="optionsLoading" :placeholder="roleForm.role_type === 'ADMIN' ? '管理员角色固定为 all' : '选择可用租客'" @visible-change="handleTenantDropdownVisible"><el-option v-for="item in tenantOptions" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item><el-form-item label="排序号"><el-input-number v-model="roleForm.sort_no" :min="0" controls-position="right" /></el-form-item></div>
              <el-form-item v-if="roleForm.role_type !== 'ADMIN'" label="绑定权限"><el-select v-model="roleForm.permission_id" multiple filterable :loading="optionsLoading" placeholder="选择可用权限"><el-option v-for="item in permissionOptions" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" /></el-select></el-form-item>
              <el-form-item label="备注"><el-input v-model="roleForm.remark" type="textarea" :rows="3" placeholder="选填" /></el-form-item>
              <el-button type="primary" :loading="loading" @click="submitRole">创建角色</el-button>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </div>
      <ResultReceipt :title="resultTitle" :data="result" :primary-key="resultKey" />
    </section>
  </div>
</template>
