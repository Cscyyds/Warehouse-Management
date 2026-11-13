<template>
  <ListTemplate title="敏感字段权限" :show-add="false" :loading="loading" v-model:page="page" v-model:page-size="pageSize" :total="filtered.length">
    <template #actions>
      <el-button :disabled="busy || loading" @click="reload">重新加载</el-button>
      <el-button :disabled="!ready || busy || !canSave" @click="clearAll">清空全部限制</el-button>
      <el-button type="primary" :loading="saving" :disabled="!ready || !changes.count || unknownIds.length > 0 || !canSave" @click="save()">保存全部配置</el-button>
    </template>
    <template #search>
      <el-form inline>
        <el-form-item label="模块"><el-select v-model="moduleFilter" clearable placeholder="全部模块" style="width:140px"><el-option v-for="item in modules" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
        <el-form-item label="字段名称"><el-input v-model="keyword" clearable placeholder="搜索业务字段" style="width:180px" /></el-form-item>
        <el-form-item><el-checkbox v-model="restrictedOnly">仅看已限制</el-checkbox></el-form-item>
        <el-form-item><el-select v-model="fieldKind" style="width:130px"><el-option label="全部字段" value="all" /><el-option label="原始字段" value="original" /><el-option label="派生字段" value="derived" /></el-select></el-form-item>
      </el-form>
    </template>
    <template #table>
      <div class="role-selector">
        <span>角色</span><el-select :model-value="roleId" :loading="rolesLoading" :disabled="loading || busy" filterable clearable placeholder="选择需要配置的角色" style="width:min(360px, 65vw)" @update:model-value="selectRole">
          <el-option v-for="role in roles" :key="role.role_code" :label="role.role_name" :value="role.role_code" />
        </el-select>
        <span class="summary">已配置限制 {{ configuredCount }} 项 / 未保存变更 {{ changes.count }} 项</span>
      </div>
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
      <el-alert v-if="unknownIds.length" :title="`有 ${unknownIds.length} 项配置的字段定义暂不可用，请重新加载核对`" type="warning" :closable="false" show-icon>
        <el-button link type="primary" :disabled="busy" @click="removeUnavailable">核对并移除这些限制</el-button>
      </el-alert>
      <el-alert v-if="ready && changes.count" :title="`本次变更：新增 ${changes.added.length} 项，调整 ${changes.changed.length} 项，取消 ${changes.removed.length} 项`" type="info" show-icon :closable="false" />
      <el-empty v-if="!roleId" description="选择角色后，可以设置它能查看和修改的字段" />
      <el-table v-else :data="paged" border stripe size="small" row-key="field_id" :empty-text="loading ? '正在加载字段配置' : '当前条件下暂无字段'">
        <el-table-column prop="module_name" label="模块" width="100" />
        <el-table-column prop="field_label" label="业务字段" min-width="190"><template #default="{ row }"><strong>{{ row.field_label }}</strong><p v-if="row.is_derived" class="dependency">依赖：{{ row.derived_from_field_labels.join('、') || '—' }}</p></template></el-table-column>
        <el-table-column label="限制状态" min-width="215"><template #default="{ row }">
          <el-tag v-if="row.is_derived" type="info">自动联动 · 只读</el-tag>
          <el-select v-else :model-value="draft[row.field_id] ?? 0" :disabled="!ready || busy || !canSave" @update:model-value="(value: 0 | RestrictionType) => changeRestriction(row, value)">
            <el-option label="不限制" :value="0" /><el-option label="不可查看不可编辑" :value="1" /><el-option label="可查看但不可修改" :value="2" />
          </el-select>
        </template></el-table-column>
        <el-table-column label="影响范围" min-width="250"><template #default="{ row }">
          <el-button link type="primary" @click="showImpact(row, 'view')">查看时涉及</el-button><el-button link type="primary" @click="showImpact(row, 'update')">修改时涉及</el-button>
          <el-button link type="primary" @click="showDerived(row)">连带隐藏</el-button>
        </template></el-table-column>
      </el-table>
      <p class="scope-note">筛选只改变当前显示，保存会提交该角色的全部限制。保存前会检查配置变化，请避免多人同时编辑同一角色。</p>
    </template>
  </ListTemplate>
  <el-drawer v-model="impactVisible" :title="impactTitle" size="min(640px, 94vw)"><SensitiveImpactList :value="impactGroups" /></el-drawer>
  <el-drawer v-model="derivedVisible" :title="derivedTitle" size="min(680px, 94vw)">
    <div v-loading="derivedLoading">
      <el-alert v-if="derivedError" :title="derivedError" type="error" :closable="false" /><el-button v-if="derivedError && derivedTarget" @click="showDerived(derivedTarget)">重试加载</el-button>
      <el-empty v-else-if="!derivedLoading && !derivedFields.length" description="没有登记依赖此字段的派生字段" />
      <article v-for="field in derivedFields" :key="field.field_id" class="derived-field"><h3>{{ field.field_label }}</h3><p>依赖链：{{ field.depend_full_chain.join('、') }}</p><SensitiveImpactList :value="field.bound_view_permissions" /></article>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import ListTemplate from '@/views/common/ListTemplate.vue'
import SensitiveImpactList from '@/views/common/SensitiveImpactList.vue'
import { getRoleList, getRoleDetail, type RoleItem, type RoleListResponse } from '@/api/modules/role'
import { fetchAllPages } from '@/api/utils/fetchAllPages'
import { getSensitiveFieldTree, getRoleSensitivePermissions, saveRoleSensitivePermissions, getDerivedSensitiveFields,
  type SensitiveFieldModule, type SensitiveFieldNode, type SensitiveImpactGroup, type DerivedSensitiveField, type RoleSensitivePermission, type RestrictionType } from '@/api/modules/sensitiveField'
import { validateRolePermissions, permissionFingerprint, permissionsFromDraft, permissionChanges } from '@/utils/sensitivePermissionDraft'
import { importRequestError } from '@/utils/importTask'
import { usePermissionStore } from '@/stores/permission'
import { useSensitiveFieldStore } from '@/stores/sensitiveField'

const route = useRoute(), permission = usePermissionStore(), sensitiveStore = useSensitiveFieldStore()
const roles = shallowRef<RoleItem[]>([]), rolesLoading = ref(false), roleId = ref('')
const tree = shallowRef<SensitiveFieldModule[]>([]), snapshot = shallowRef<RoleSensitivePermission[]>([])
const draft = reactive<Record<string, 0 | RestrictionType>>({})
const loading = ref(false), saving = ref(false), confirming = ref(false), ready = ref(false), error = ref('')
const busy = computed(() => saving.value || confirming.value)
const page = ref(1), pageSize = ref(20), moduleFilter = ref(''), keyword = ref(''), restrictedOnly = ref(false), fieldKind = ref('all')
const canSave = computed(() => permission.hasUrlPerm('POST /api/v1/tenant-roles/sensitive-permissions'))
const modules = [{ value: 'PRODUCT', label: '产品' }, { value: 'PURCHASE', label: '采购' }, { value: 'SALES', label: '销售' }, { value: 'CRM', label: '客户' }, { value: 'INVENTORY', label: '库存' }]
const fields = computed(() => tree.value.flatMap(group => group.fields.map(field => ({ ...field, module: group.module, module_name: group.module_name }))))
const payload = computed(() => permissionsFromDraft(draft))
const changes = computed(() => permissionChanges(snapshot.value, payload.value))
const configuredCount = computed(() => payload.value.length)
const knownFields = computed(() => new Set(fields.value.filter(field => !field.is_derived).map(field => field.field_id)))
const unknownIds = computed(() => payload.value.filter(item => !knownFields.value.has(item.field_id)).map(item => item.field_id))
const filtered = computed(() => fields.value.filter(field => (!moduleFilter.value || field.module === moduleFilter.value)
  && (!keyword.value || field.field_label.includes(keyword.value.trim())) && (!restrictedOnly.value || !!draft[field.field_id])
  && (fieldKind.value === 'all' || (fieldKind.value === 'derived' ? field.is_derived : !field.is_derived))))
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
watch([moduleFilter, keyword, restrictedOnly, fieldKind, pageSize], () => { page.value = 1 })
const session = localStorage.getItem('token')
let requestId = 0, disposed = false
const current = (id: number, role: string) => !disposed && id === requestId && role === roleId.value && session === localStorage.getItem('token')
function replaceDraft(permissions: RoleSensitivePermission[]) {
  for (const key of Object.keys(draft)) delete draft[key]
  for (const item of permissions) draft[item.field_id] = item.restriction_type
}
function validateTree(value: unknown): SensitiveFieldModule[] {
  const validGroups = (groups: unknown) => Array.isArray(groups) && groups.every(group => group && typeof group.owner === 'string' && Array.isArray(group.permissions)
    && group.permissions.every((item: unknown) => !!item && typeof item === 'object' && typeof (item as Record<string, unknown>).param_name === 'string' && typeof (item as Record<string, unknown>).interface_path === 'string'))
  if (!Array.isArray(value) || value.some(group => !group || typeof group.module !== 'string' || !Array.isArray(group.fields)
    || group.fields.some((field: SensitiveFieldNode) => !field || !field.field_id || typeof field.is_derived !== 'boolean' || !validGroups(field.view_interfaces) || !validGroups(field.update_interfaces) || !Array.isArray(field.derived_from_field_labels)))) {
    throw new Error('字段影响范围未完整返回，请联系管理员确认服务版本后重新加载')
  }
  const ids = value.flatMap(group => group.fields.map((field: SensitiveFieldNode) => field.field_id))
  if (new Set(ids).size !== ids.length) throw new Error('字段树存在重复字段，请重新加载核对')
  return value
}
async function loadRole(id: string) {
  const version = ++requestId
  ready.value = false; loading.value = !!id; error.value = ''; snapshot.value = []; replaceDraft([]); tree.value = []; page.value = 1
  if (!id) return
  try {
    const [fieldsResponse, roleResponse] = await Promise.all([getSensitiveFieldTree(undefined, { silent: true }), getRoleSensitivePermissions(id, { silent: true })])
    if (!current(version, id)) return
    if (roleResponse.data?.role_id !== id) throw new Error('角色配置返回不一致，请重新加载')
    const permissions = validateRolePermissions(roleResponse.data.permissions)
    tree.value = validateTree(fieldsResponse.data?.tree)
    snapshot.value = permissions; replaceDraft(permissions); ready.value = true
  } catch (e) { if (current(version, id)) error.value = importRequestError(e) }
  finally { if (current(version, id)) loading.value = false }
}
async function resolveDraft(): Promise<boolean> {
  if (busy.value) return false
  if (!changes.value.count) return true
  try {
    await ElMessageBox.confirm('当前角色有未保存修改。', '离开当前配置', { confirmButtonText: '保存后继续', cancelButtonText: '放弃修改', distinguishCancelAndClose: true, type: 'warning' })
    return await save()
  } catch (action) { if (action === 'cancel') { replaceDraft(snapshot.value); return true } return false }
}
async function selectRole(value: string) {
  const id = value || ''
  if (confirming.value || id === roleId.value || !await resolveDraft() || confirming.value) return
  roleId.value = id
  await loadRole(id)
}
async function reload() { if (await resolveDraft()) await loadRole(roleId.value) }
async function save(impactConfirmed = false): Promise<boolean> {
  if (!ready.value || busy.value || !roleId.value || !canSave.value || unknownIds.value.length) return false
  const id = roleId.value, version = requestId, target = payload.value
  const change = permissionChanges(snapshot.value, target)
  if (!change.count) return true
  saving.value = true; error.value = ''
  let posted = false
  try {
    if (!impactConfirmed && (change.unhidden.length || change.newlyHidden.length > 1)) {
      const names = (items: RoleSensitivePermission[]) => items.map(item => fields.value.find(field => field.field_id === item.field_id)?.field_label || item.field_label || item.field_id).join('、')
      await ElMessageBox.confirm([change.unhidden.length ? `解除隐藏：${names(change.unhidden)}` : '', change.newlyHidden.length > 1 ? `新增隐藏：${names(change.newlyHidden)}` : ''].filter(Boolean).join('；'), '确认字段影响', { type: 'warning', confirmButtonText: '确认保存', cancelButtonText: '返回检查' })
    }
    const latest = await getRoleSensitivePermissions(id, { silent: true })
    if (!current(version, id)) return false
    if (latest.data?.role_id !== id || permissionFingerprint(validateRolePermissions(latest.data.permissions)) !== permissionFingerprint(snapshot.value)) throw new Error('此角色配置已被其他人修改。请重新加载后核对，当前草稿已保留。')
    await saveRoleSensitivePermissions(id, target, { silent: true }); posted = true
    const saved = await getRoleSensitivePermissions(id, { silent: true })
    if (!current(version, id)) return false
    if (saved.data?.role_id !== id) throw new Error('保存后回查角色不一致')
    const actual = validateRolePermissions(saved.data.permissions)
    if (permissionFingerprint(actual) !== permissionFingerprint(target)) throw new Error('保存后回查与提交内容不一致，请重新加载核对')
    snapshot.value = actual; replaceDraft(actual)
    sensitiveStore.invalidate()
    ElMessage.success('字段限制已保存，请刷新相关业务页面验证')
    return true
  } catch (e) {
    if (e !== 'cancel' && e !== 'close' && current(version, id)) {
      error.value = `${posted ? '保存请求已成功，但回查未确认，请重新加载核对。' : ''}${importRequestError(e)}`
      if (posted) ready.value = false
    }
    return false
  } finally { if (!disposed) saving.value = false }
}
async function clearAll() {
  if (!ready.value || busy.value || !canSave.value || !payload.value.length) return
  const id = roleId.value, version = requestId, count = payload.value.length
  let accepted = false
  confirming.value = true
  try {
    await ElMessageBox.confirm(`将清空该角色全部 ${count} 项字段限制。`, '清空全部限制', { type: 'warning', confirmButtonText: '清空并保存', cancelButtonText: '取消' })
    if (!current(version, id)) return
    for (const key of Object.keys(draft)) draft[key] = 0
    accepted = true
  } catch { /* 取消确认时保留当前草稿。 */ }
  finally { confirming.value = false }
  if (accepted) await save(true)
}
async function removeUnavailable() {
  if (busy.value) return
  const id = roleId.value, version = requestId, ids = [...unknownIds.value]
  confirming.value = true
  try {
    await ElMessageBox.confirm(`将从完整草稿中移除 ${ids.length} 项不可用字段限制：${ids.join('、')}。保存后生效。`, '核对不可用字段', { type: 'warning' })
    if (!current(version, id)) return
    for (const fieldId of ids) delete draft[fieldId]
  } catch { /* 保留原限制。 */ }
  finally { confirming.value = false }
}
const impactVisible = ref(false), impactTitle = ref(''), impactGroups = shallowRef<SensitiveImpactGroup[]>([])
function showImpact(field: SensitiveFieldNode, side: 'view' | 'update') { impactTitle.value = `${field.field_label} · ${side === 'view' ? '查看' : '修改'}影响范围`; impactGroups.value = side === 'view' ? field.view_interfaces : field.update_interfaces; impactVisible.value = true }
const derivedVisible = ref(false), derivedLoading = ref(false), derivedError = ref(''), derivedTitle = ref('')
const derivedFields = shallowRef<DerivedSensitiveField[]>([]), derivedTarget = shallowRef<SensitiveFieldNode>()
let derivedVersion = 0
async function showDerived(field: SensitiveFieldNode) {
  const version = ++derivedVersion
  derivedTarget.value = field; derivedVisible.value = true; derivedLoading.value = true; derivedError.value = ''; derivedFields.value = []; derivedTitle.value = `${field.field_label} · 连带隐藏范围`
  try {
    const response = await getDerivedSensitiveFields(field.field_id, { silent: true })
    if (disposed || version !== derivedVersion || session !== localStorage.getItem('token')) return
    if (!Array.isArray(response.data?.derived_fields)) throw new Error('连带影响返回不完整，请重试')
    derivedFields.value = response.data.derived_fields
  } catch (e) { if (!disposed && version === derivedVersion) derivedError.value = importRequestError(e) }
  finally { if (version === derivedVersion) derivedLoading.value = false }
}
function changeRestriction(field: SensitiveFieldNode, value: 0 | RestrictionType) { if (busy.value || !ready.value || !canSave.value) return; draft[field.field_id] = value; if (value === 1) void showDerived(field) }
onBeforeRouteLeave(resolveDraft)
function beforeUnload(event: BeforeUnloadEvent) { if (changes.value.count || saving.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  rolesLoading.value = true
  try {
    const response = await fetchAllPages<RoleListResponse, RoleItem>({ fetchPage: getRoleList, pick: data => data.role, assign: (data, list) => { data.role = list } })
    if (disposed || session !== localStorage.getItem('token')) return
    roles.value = response.data.role
    const requested = typeof route.query.role_id === 'string' ? route.query.role_id : ''
    if (requested && !roles.value.some(role => role.role_code === requested)) { const item = await getRoleDetail(requested); if (item.data.role?.[0]) roles.value = [...roles.value, item.data.role[0]] }
    if (requested) { roleId.value = requested; await loadRole(requested) }
  } catch (e) { error.value = importRequestError(e) }
  finally { rolesLoading.value = false }
})
let activatedOnce = false
onActivated(() => {
  window.addEventListener('beforeunload', beforeUnload)
  if (activatedOnce && roleId.value && !changes.value.count) void loadRole(roleId.value)
  activatedOnce = true
})
onDeactivated(() => { requestId++; derivedVersion++; loading.value = false; derivedLoading.value = false; window.removeEventListener('beforeunload', beforeUnload) })
onBeforeUnmount(() => { disposed = true; requestId++; derivedVersion++; window.removeEventListener('beforeunload', beforeUnload) })
</script>
<style scoped>
.role-selector { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; } .summary, .scope-note, .dependency { font-size: 12px; color: var(--text-secondary); }
.dependency { margin: 6px 0 0; } .scope-note { line-height: 1.8; margin-top: 14px; } :deep(.el-alert) { margin-bottom: 12px; } .derived-field { padding: 12px 0; border-bottom: 1px solid var(--border-color); } .derived-field > p { color: var(--text-secondary); font-size: 12px; }
</style>
