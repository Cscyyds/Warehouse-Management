<template>
  <ListTemplate
    class="sensitive-permission-page"
    :class="{ 'awaiting-role': !roleId }"
    title="敏感字段权限"
    :show-add="false"
    :show-filter-toggle="false"
    :loading="loading"
    v-model:page="page"
    v-model:page-size="pageSize"
    :total="filtered.length"
  >
    <template #actions-left>
      <div v-if="roleId" class="role-selector">
        <el-form-item label="角色" class="role-control">
          <el-select
            :model-value="roleId"
            :loading="rolesLoading"
            :disabled="loading || busy"
            filterable
            clearable
            placeholder="选择要配置的角色"
            @update:model-value="selectRole"
          >
            <el-option v-for="role in roles" :key="role.role_code" :label="role.role_name" :value="role.role_code" />
          </el-select>
        </el-form-item>
        <div v-if="ready" class="role-summary" aria-live="polite">
          <span>该角色已限制 {{ configuredCount }} 项</span>
          <span v-if="changes.count" class="pending-count">未保存 {{ changes.count }} 项</span>
        </div>
      </div>
    </template>

    <template #actions>
      <div v-if="roleId" class="configuration-actions">
        <el-dropdown trigger="click" :disabled="!roleId || busy || loading" @command="handleConfigurationCommand">
          <el-button>更多操作 <el-icon><ArrowDown /></el-icon></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="reload">重新加载</el-dropdown-item>
              <el-dropdown-item
                command="clear"
                divided
                :disabled="!ready || !canSave || !payload.length"
                class="clear-command"
              >清空该角色的全部限制</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="!ready || busy || !changes.count || unknownIds.length > 0 || !canSave"
          @click="save()"
        >{{ changes.count ? `保存 ${changes.count} 项变更` : '保存配置' }}</el-button>
      </div>
    </template>

    <template #search>
      <el-form v-if="roleId" inline class="field-filters">
        <el-form-item label="模块">
          <el-select v-model="moduleFilter" clearable placeholder="全部模块" class="module-filter">
            <el-option v-for="item in modules" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="字段名称">
          <el-input v-model="keyword" clearable placeholder="搜索字段名称" class="keyword-filter" />
        </el-form-item>
        <el-form-item label="字段类型">
          <el-select v-model="fieldKind" class="kind-filter">
            <el-option label="全部字段" value="all" />
            <el-option label="原始字段" value="original" />
            <el-option label="派生字段" value="derived" />
          </el-select>
        </el-form-item>
        <el-form-item><el-checkbox v-model="restrictedOnly">仅看已限制</el-checkbox></el-form-item>
      </el-form>
    </template>

    <template #table>
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
      <el-alert v-if="unknownIds.length" :title="`有 ${unknownIds.length} 项配置的字段定义暂不可用，请重新加载核对`" type="warning" :closable="false" show-icon>
        <el-button link type="primary" :disabled="busy" @click="removeUnavailable">核对并移除这些限制</el-button>
      </el-alert>
      <section v-if="!roleId" class="role-start" aria-labelledby="role-start-title">
        <div class="role-start-main">
          <p class="role-start-label">字段权限配置</p>
          <h4 id="role-start-title">先选择要配置的角色</h4>
          <p class="role-start-description">字段查看和编辑限制按角色生效。选择角色后，可以查看现有配置并统一调整。</p>
          <el-select
            class="role-start-select"
            :model-value="roleId"
            :loading="rolesLoading"
            :disabled="rolesLoading || busy"
            filterable
            placeholder="搜索或选择角色"
            @update:model-value="selectRole"
          >
            <el-option v-for="role in roles" :key="role.role_code" :label="role.role_name" :value="role.role_code" />
          </el-select>
        </div>
        <div class="role-start-context" aria-live="polite">
          <div class="role-start-stat">
            <strong>{{ rolesLoading ? '正在加载' : roles.length }}</strong>
            <span>{{ rolesLoading ? '正在获取可配置角色' : '个可配置角色' }}</span>
          </div>
          <div class="role-start-rule">
            <strong>保存后生效</strong>
            <span>选择和调整过程中不会影响当前业务页面</span>
          </div>
        </div>
      </section>
      <el-table
        v-else
        :data="paged"
        stripe
        size="small"
        row-key="field_id"
        :empty-text="loading ? '正在加载字段权限' : '没有符合筛选条件的字段'"
      >
        <el-table-column prop="module_name" label="模块" width="112" />
        <el-table-column prop="field_label" label="业务字段" min-width="170">
          <template #default="{ row }">
            <div class="field-heading">
              <span class="field-name">{{ row.field_label }}</span>
              <el-tag v-if="changedFieldIds.has(row.field_id)" type="warning" size="small" effect="plain">未保存</el-tag>
            </div>
            <p v-if="row.is_derived && row.derived_from_field_labels.length" class="dependency">
              依赖 {{ row.derived_from_field_labels.join('、') }}
            </p>
          </template>
        </el-table-column>
        <el-table-column label="限制状态" width="260">
          <template #default="{ row }">
            <span v-if="row.is_derived" class="derived-status">权限随依赖字段生效</span>
            <el-select
              v-else
              class="restriction-select"
              :aria-label="`${row.field_label}的限制状态`"
              :model-value="draft[row.field_id] ?? 0"
              :disabled="!ready || busy || !canSave"
              @update:model-value="(value: 0 | RestrictionType) => changeRestriction(row, value)"
            >
              <el-option label="不限制" :value="0" />
              <el-option label="不可查看不可编辑" :value="1" />
              <el-option label="可查看但不可修改" :value="2" />
            </el-select>
          </template>
        </el-table-column>
      </el-table>
      <p v-if="ready && changes.count" class="scope-note">保存会包含该角色在其他模块和分页中的未保存变更。</p>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { confirmAction } from '@/utils/actionDialog'
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { getRoleList, getRoleDetail, type RoleItem, type RoleListResponse } from '@/api/modules/role'
import { fetchAllPages } from '@/api/utils/fetchAllPages'
import { getSensitiveFieldTree, getRoleSensitivePermissions, saveRoleSensitivePermissions,
  type SensitiveFieldModule, type SensitiveFieldNode, type RoleSensitivePermission, type RestrictionType } from '@/api/modules/sensitiveField'
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
const changedFieldIds = computed(() => {
  const { added, changed, removed } = changes.value
  return new Set([...added, ...changed, ...removed].map(item => item.field_id))
})
const configuredCount = computed(() => snapshot.value.length)
const knownFields = computed(() => new Set(fields.value.filter(field => !field.is_derived).map(field => field.field_id)))
const unknownIds = computed(() => payload.value.filter(item => !knownFields.value.has(item.field_id)).map(item => item.field_id))
const filtered = computed(() => fields.value.filter(field => (!moduleFilter.value || field.module === moduleFilter.value)
  && (!keyword.value || field.field_label.includes(keyword.value.trim())) && (!restrictedOnly.value || !!draft[field.field_id])
  && (fieldKind.value === 'all' || (fieldKind.value === 'derived' ? field.is_derived : !field.is_derived))))
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
watch([moduleFilter, keyword, restrictedOnly, fieldKind, pageSize], () => { page.value = 1 })
watch(() => filtered.value.length, total => {
  page.value = Math.min(page.value, Math.max(1, Math.ceil(total / pageSize.value)))
})
const session = localStorage.getItem('token')
let requestId = 0, disposed = false
const current = (id: number, role: string) => !disposed && id === requestId && role === roleId.value && session === localStorage.getItem('token')
function replaceDraft(permissions: RoleSensitivePermission[]) {
  for (const key of Object.keys(draft)) delete draft[key]
  for (const item of permissions) draft[item.field_id] = item.restriction_type
}
function validateTree(value: unknown): SensitiveFieldModule[] {
  if (!Array.isArray(value) || value.some(group => !group || typeof group.module !== 'string' || !Array.isArray(group.fields)
    || group.fields.some((field: SensitiveFieldNode) => !field || !field.field_id || typeof field.is_derived !== 'boolean' || !Array.isArray(field.derived_from_field_labels)))) {
    throw new Error('字段配置未完整返回，请联系管理员确认服务版本后重新加载')
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
    await confirmAction('当前角色有未保存修改。', '离开当前配置', { confirmButtonText: '保存后继续', cancelButtonText: '放弃修改', distinguishCancelAndClose: true, type: 'warning' })
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
function handleConfigurationCommand(command: 'reload' | 'clear') {
  if (command === 'reload') void reload()
  if (command === 'clear') void clearAll()
}
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
      await confirmAction([change.unhidden.length ? `解除隐藏：${names(change.unhidden)}` : '', change.newlyHidden.length > 1 ? `新增隐藏：${names(change.newlyHidden)}` : ''].filter(Boolean).join('；'), '确认字段影响', { type: 'warning', confirmButtonText: '确认保存', cancelButtonText: '返回检查' })
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
    await confirmAction(`将清空该角色全部 ${count} 项字段限制。`, '清空全部限制', { type: 'warning', confirmButtonText: '清空并保存', cancelButtonText: '取消' })
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
    await confirmAction(`将从完整草稿中移除 ${ids.length} 项不可用字段限制：${ids.join('、')}。保存后生效。`, '核对不可用字段', { type: 'warning' })
    if (!current(version, id)) return
    for (const fieldId of ids) delete draft[fieldId]
  } catch { /* 保留原限制。 */ }
  finally { confirming.value = false }
}
function changeRestriction(field: SensitiveFieldNode, value: 0 | RestrictionType) { if (busy.value || !ready.value || !canSave.value) return; draft[field.field_id] = value }
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
onDeactivated(() => { requestId++; loading.value = false; window.removeEventListener('beforeunload', beforeUnload) })
onBeforeUnmount(() => { disposed = true; requestId++; window.removeEventListener('beforeunload', beforeUnload) })
</script>
<style scoped>
.sensitive-permission-page :deep(.toolbar-actions) {
  width: 100%;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px 20px;
}
.role-selector,
.role-summary,
.configuration-actions,
.field-filters,
.field-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}
.role-control {
  margin: 0;
}
.role-control :deep(.el-select) {
  width: min(260px, 60vw);
}
.awaiting-role :deep(.el-pagination) {
  display: none;
}
.role-start {
  min-height: 320px;
  padding: clamp(28px, 5vw, 64px);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-page);
  display: grid;
  grid-template-columns: minmax(280px, 560px) minmax(220px, 320px);
  align-items: center;
  justify-content: center;
  gap: clamp(32px, 7vw, 96px);
}
.role-start-label {
  margin: 0 0 8px;
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
}
.role-start h4 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(20px, 2.2vw, 28px);
  line-height: 1.35;
}
.role-start-description {
  max-width: 520px;
  margin: 12px 0 24px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.7;
}
.role-start-select {
  width: min(420px, 100%);
}
.role-start-context {
  padding-left: clamp(24px, 4vw, 48px);
  border-left: 1px solid var(--border-color);
  display: grid;
  gap: 28px;
}
.role-start-stat,
.role-start-rule {
  display: grid;
  gap: 6px;
}
.role-start-stat strong {
  color: var(--text-primary);
  font-size: 28px;
  line-height: 1.2;
}
.role-start-rule strong {
  color: var(--text-primary);
  font-size: 15px;
}
.role-start-context span {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
.role-summary,
.scope-note,
.dependency,
.derived-status {
  color: var(--text-secondary);
  font-size: 12px;
}
.pending-count {
  color: var(--el-color-warning-dark-2);
  font-weight: 600;
}
.configuration-actions :deep(.el-button .el-icon) {
  margin-left: 4px;
}
.clear-command:not(.is-disabled) {
  color: var(--el-color-danger);
}
.field-filters :deep(.el-form-item) {
  margin: 0;
}
.module-filter,
.kind-filter {
  width: 130px;
}
.keyword-filter {
  width: 180px;
}
.field-name {
  font-weight: 500;
}
.restriction-select {
  width: min(220px, 100%);
}
.dependency {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
}
.scope-note {
  margin: 12px 0 0;
}
:deep(.el-alert) {
  margin-bottom: 12px;
}
@media (max-width: 760px) {
  .role-start {
    min-height: 0;
    padding: 24px;
    grid-template-columns: 1fr;
    gap: 28px;
  }
  .role-start-context {
    padding: 24px 0 0;
    border-top: 1px solid var(--border-color);
    border-left: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
  }
}
@media (max-width: 480px) {
  .role-start-context {
    grid-template-columns: 1fr;
  }
}
</style>
