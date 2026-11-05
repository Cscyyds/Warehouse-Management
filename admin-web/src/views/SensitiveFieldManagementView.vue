<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { querySensitiveFields, searchSensitiveFields, createSensitiveField, updateSensitiveField, deleteSensitiveField, querySensitiveMappings, searchSensitiveMappings, createSensitiveMapping, updateSensitiveMapping, deleteSensitiveMapping, allSensitiveFields, FIELD_SEARCH_KEYS, MAPPING_SEARCH_KEYS } from '@/api/sensitiveFields'
import type { SensitiveFieldDefinition, SensitiveInterfaceMapping, SensitiveModule, SensitiveMappingPayload } from '@/types/sensitiveFields'
import { searchParams, fieldUpdateDelta, mappingUpdateDelta, validMappingPath, validParameterPath } from '@/utils/sensitiveManagement'
import { SENSITIVE_INTERFACE_PATHS } from '@/config/sensitiveInterfacePaths.generated'

const modules = [{ value: 'PRODUCT', label: '产品' }, { value: 'PURCHASE', label: '采购' }, { value: 'SALES', label: '销售' }, { value: 'CRM', label: '客户' }, { value: 'INVENTORY', label: '库存' }]
const tab = ref('fields'), fields = shallowRef<SensitiveFieldDefinition[]>([]), mappings = shallowRef<SensitiveInterfaceMapping[]>([])
const fieldPage = ref(1), mapPage = ref(1), fieldTotal = ref(0), mapTotal = ref(0), pageSize = 20
const loading = ref(false), saving = ref(false), error = ref(''), savedMessage = ref('')
const fieldFilters = reactive({ module: '' as SensitiveModule | '', is_derived: undefined as number | undefined, key: 'field_label', keyword: '' })
const mapFilters = reactive({ module: '' as SensitiveModule | '', field_id: '', io_type: '', interface_path: '', key: 'interface_name', keyword: '' })
const candidates = shallowRef<SensitiveFieldDefinition[]>([]), candidatesReady = ref(false), candidatesLoading = ref(false)
const activeCandidates = computed(() => candidates.value.filter(item => item.status === 1))
const fieldDialog = ref(false), mapDialog = ref(false), editingField = shallowRef<SensitiveFieldDefinition | null>(null), editingMap = shallowRef<SensitiveInterfaceMapping | null>(null)
const fieldForm = reactive({ module: 'PRODUCT' as SensitiveModule, field_code: '', field_label: '', is_derived: 0, derived_from_field_ids: [] as string[], description: '', sort_no: 0, status: 1 })
const mapForm = reactive({ field_id: '', interface_path: '', interface_name: '', io_type: 'OUTPUT' as 'OUTPUT' | 'INPUT', param_name: '', sort_no: 0, status: 1 })
const dependencyCandidates = computed(() => activeCandidates.value.filter(item => item.field_id !== editingField.value?.field_id))
const mapField = computed(() => candidates.value.find(item => item.field_id === mapForm.field_id))
const session = localStorage.getItem('zhixing-wms-admin-auth')
let fieldSequence = 0, mapSequence = 0, candidateSequence = 0, disposed = false
const currentSession = () => !disposed && session === localStorage.getItem('zhixing-wms-admin-auth')
const message = (e: unknown) => e instanceof Error ? e.message : '操作未完成，请重试'

async function loadFields() {
  const sequence = ++fieldSequence
  loading.value = true; error.value = ''
  try {
    const params = { module: fieldFilters.module || undefined, is_derived: fieldFilters.is_derived, page: fieldPage.value, page_size: pageSize }
    const data = fieldFilters.keyword.trim() ? await searchSensitiveFields({ ...params, ...searchParams(fieldFilters.key, fieldFilters.keyword, FIELD_SEARCH_KEYS), sort_by: 'field_id', sort_order: 'ASC' }) : await querySensitiveFields(params)
    if (sequence !== fieldSequence || !currentSession()) return
    if (!Array.isArray(data.fields)) throw new Error('字段列表返回不完整，请重试')
    fields.value = data.fields; fieldTotal.value = data.total
    if (!data.fields.length && fieldPage.value > 1 && data.total > 0) { fieldPage.value = Math.ceil(data.total / pageSize); void loadFields() }
  } catch (e) { if (sequence === fieldSequence && currentSession()) error.value = message(e) }
  finally { if (sequence === fieldSequence) loading.value = false }
}
async function loadMappings() {
  const sequence = ++mapSequence
  loading.value = true; error.value = ''
  try {
    const common = { module: mapFilters.module || undefined, io_type: mapFilters.io_type || undefined, page: mapPage.value, page_size: pageSize }
    if (mapFilters.keyword.trim() && (mapFilters.field_id || mapFilters.interface_path.trim())) throw new Error('请先清空字段和精确路径筛选，再使用模糊搜索')
    const data = mapFilters.keyword.trim() ? await searchSensitiveMappings({ ...common, ...searchParams(mapFilters.key, mapFilters.keyword, MAPPING_SEARCH_KEYS), sort_by: 'interface_path', sort_order: 'ASC' }) : await querySensitiveMappings({ ...common, field_id: mapFilters.field_id || undefined, interface_path: mapFilters.interface_path.trim() || undefined })
    if (sequence !== mapSequence || !currentSession()) return
    if (!Array.isArray(data.interface_fields)) throw new Error('映射列表返回不完整，请重试')
    mappings.value = data.interface_fields; mapTotal.value = data.total
    if (!data.interface_fields.length && mapPage.value > 1 && data.total > 0) { mapPage.value = Math.ceil(data.total / pageSize); void loadMappings() }
  } catch (e) { if (sequence === mapSequence && currentSession()) error.value = message(e) }
  finally { if (sequence === mapSequence) loading.value = false }
}
async function loadCandidates() {
  const sequence = ++candidateSequence
  candidatesReady.value = false; candidatesLoading.value = true
  try { const result = await allSensitiveFields(); if (currentSession() && sequence === candidateSequence) { candidates.value = result; candidatesReady.value = true } }
  catch (e) { if (currentSession() && sequence === candidateSequence) ElMessage.error(message(e)) }
  finally { if (sequence === candidateSequence) candidatesLoading.value = false }
}
function search() { if (tab.value === 'fields') { fieldPage.value = 1; void loadFields() } else { mapPage.value = 1; void loadMappings() } }
function reset() { if (tab.value === 'fields') Object.assign(fieldFilters, { module: '', is_derived: undefined, key: 'field_label', keyword: '' }); else Object.assign(mapFilters, { module: '', field_id: '', io_type: '', interface_path: '', key: 'interface_name', keyword: '' }); search() }
watch(tab, value => { fieldSequence++; mapSequence++; loading.value = false; error.value = ''; if (value === 'fields') void loadFields(); else void loadMappings() })
function showMappings(field: SensitiveFieldDefinition) { mapFilters.field_id = field.field_id; mapFilters.keyword = ''; mapFilters.interface_path = ''; mapFilters.module = ''; mapPage.value = 1; if (tab.value === 'mappings') void loadMappings(); else tab.value = 'mappings' }

async function openField(row?: SensitiveFieldDefinition) {
  editingField.value = row ? JSON.parse(JSON.stringify(row)) : null
  Object.assign(fieldForm, { module: row?.module ?? 'PRODUCT', field_code: row?.field_code ?? '', field_label: row?.field_label ?? '', is_derived: row?.is_derived ? 1 : 0, derived_from_field_ids: [...(row?.derived_from_field_ids ?? [])], description: row?.description ?? '', sort_no: row?.sort_no ?? 0, status: row?.status ?? 1 })
  fieldDialog.value = true
  await loadCandidates()
}
async function saveField() {
  if (saving.value || !candidatesReady.value) return
  const form = { ...fieldForm, field_label: fieldForm.field_label.trim(), derived_from_field_ids: fieldForm.is_derived ? [...fieldForm.derived_from_field_ids] : [] }
  if (!form.field_label || form.field_label.length > 128 || form.description.length > 512 || !Number.isSafeInteger(form.sort_no)) { ElMessage.warning('请核对字段名称、说明长度及整数排序号'); return }
  if (!editingField.value && (!/^[a-z][a-z0-9_]{0,63}$/.test(form.field_code) || !modules.some(item => item.value === form.module))) { ElMessage.warning('请选择模块，英文标识须以小写字母开头，最多64位'); return }
  const original = editingField.value
  if (form.is_derived && (!form.derived_from_field_ids.length || form.derived_from_field_ids.some(id => id === original?.field_id || !activeCandidates.value.some(item => item.field_id === id)))) { ElMessage.warning('派生字段须选择有效且不含自身的依赖字段'); return }
  if (original && !original.is_derived && form.is_derived && original.permission_count > 0) { ElMessage.warning('此原始字段仍有有效角色限制，暂不能转为派生字段'); return }
  const delta = original ? fieldUpdateDelta(original, form) : form
  if (original && Object.keys(delta).length === 1) { ElMessage.info('没有需要保存的变更'); return }
  saving.value = true
  try {
    if (original && (original.status !== form.status || !!original.is_derived !== !!form.is_derived || JSON.stringify(original.derived_from_field_ids) !== JSON.stringify(form.derived_from_field_ids))) {
      await ElMessageBox.confirm(`该字段有 ${original.mapping_count} 个有效使用位置、${original.permission_count} 项有效角色限制配置。${form.status === 0 ? '停用将使相关过滤与修改限制失效，可能扩大数据查看和修改范围。' : '启用或依赖调整可能使既有限制重新生效，并影响依赖字段。'}`, '确认字段影响', { type: 'warning', confirmButtonText: '确认保存', cancelButtonText: '返回检查' })
    }
    if (!currentSession()) return
    const { status: _status, ...createPayload } = form
    const result = original ? await updateSensitiveField(delta) : await createSensitiveField(createPayload)
    if (!currentSession()) return
    fieldDialog.value = false; savedMessage.value = `字段已保存（${result.field_id}）。请刷新相关业务数据验证权限效果。`
    await Promise.all([loadFields(), loadCandidates()])
  } catch (e) { if (e !== 'cancel' && e !== 'close') { ElMessage.error(message(e)); void loadFields() } }
  finally { saving.value = false }
}
async function removeField(row: SensitiveFieldDefinition) {
  if (saving.value) return
  saving.value = true
  try {
    const latest = (await querySensitiveFields({ field_id: row.field_id, page: 1, page_size: 20 })).fields.find(item => item.field_id === row.field_id)
    if (!latest) throw new Error('字段已变化，请刷新列表')
    if (latest.mapping_count || latest.permission_count) throw new Error('字段仍有有效映射或角色限制，请先处理引用后再删除')
    await ElMessageBox.confirm(`将删除字段「${row.field_label}」。当前无有效映射和角色限制，提交时仍由系统复核。`, '删除字段', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    if (!currentSession()) return
    await deleteSensitiveField(row.field_id); savedMessage.value = '字段已删除，请核对相关业务页面。'; await Promise.all([loadFields(), loadCandidates()])
  } catch (e) { if (e !== 'cancel' && e !== 'close') { ElMessage.error(message(e)); void loadFields() } }
  finally { saving.value = false }
}
async function openMapping(row?: SensitiveInterfaceMapping) {
  editingMap.value = row ? JSON.parse(JSON.stringify(row)) : null
  Object.assign(mapForm, { field_id: row?.field_id ?? mapFilters.field_id, interface_path: row?.interface_path ?? '', interface_name: row?.interface_name ?? '', io_type: row?.io_type ?? 'OUTPUT', param_name: row?.param_name ?? '', sort_no: row?.sort_no ?? 0, status: row?.status ?? 1 })
  mapDialog.value = true; await loadCandidates()
}
async function saveMapping() {
  if (saving.value || !candidatesReady.value) return
  const form: SensitiveMappingPayload = { ...mapForm, interface_path: mapForm.interface_path.trim(), interface_name: mapForm.interface_name.trim(), param_name: mapForm.param_name.trim() }
  if (!mapField.value || mapField.value.status !== 1) { ElMessage.warning('请选择已启用的字段；字段停用时请先恢复字段'); return }
  if (mapField.value.is_derived && form.io_type === 'INPUT') { ElMessage.warning('派生字段不能登记为修改输入'); return }
  if (!validMappingPath(form.interface_path!) || !validParameterPath(form.param_name!) || !form.interface_name || form.interface_name.length > 128 || !Number.isSafeInteger(form.sort_no)) { ElMessage.warning('请核对接口内部路径、参数路径、中文名及整数排序号'); return }
  const original = editingMap.value, delta = original ? mappingUpdateDelta(original, form) : form
  if (original && Object.keys(delta).length === 1) { ElMessage.info('没有需要保存的变更'); return }
  saving.value = true
  try {
    await ElMessageBox.confirm(`映射「${form.interface_name}」将影响全部租户在此接口的字段限制。${form.status === 0 ? '停用会解除该接口的相关限制，可能扩大数据可见或可修改范围。' : '保存后请用受限测试角色验证实际效果。'}`, '确认接口映射影响', { type: 'warning', confirmButtonText: '确认保存', cancelButtonText: '返回检查' })
    if (!currentSession()) return
    const { status: _status, ...createPayload } = form
    if (original) await updateSensitiveMapping(delta); else await createSensitiveMapping(createPayload)
    if (!currentSession()) return
    mapDialog.value = false; savedMessage.value = '接口映射已保存，请按下方说明验证实际权限效果。'
    await Promise.all([loadMappings(), loadCandidates()])
  } catch (e) { if (e !== 'cancel' && e !== 'close') { ElMessage.error(message(e)); void loadMappings() } }
  finally { saving.value = false }
}
async function removeMapping(row: SensitiveInterfaceMapping) {
  if (saving.value) return
  saving.value = true
  try {
    await ElMessageBox.confirm(`删除「${row.interface_name}」的「${row.param_name}」映射会解除该接口的对应限制，可能扩大数据查看或修改范围。`, '删除接口映射', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    if (!currentSession()) return
    await deleteSensitiveMapping(row.mapping_id); savedMessage.value = '映射已删除，请验证此接口的字段访问结果。'; await Promise.all([loadMappings(), loadCandidates()])
  } catch (e) { if (e !== 'cancel' && e !== 'close') ElMessage.error(message(e)) }
  finally { saving.value = false }
}
onMounted(() => { void loadFields(); void loadCandidates() })
onBeforeUnmount(() => { disposed = true; fieldSequence++; mapSequence++; candidateSequence++ })
</script>

<template>
  <div class="page-stack">
    <PageHeader eyebrow="SENSITIVE FIELD REGISTRY" title="敏感字段管理" description="维护业务字段定义和接口映射，租户按角色设置查看与修改限制。" />
    <el-tabs v-model="tab"><el-tab-pane label="字段定义" name="fields" /><el-tab-pane label="接口映射" name="mappings" /></el-tabs>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-alert v-if="savedMessage" :title="savedMessage" description="请使用受限测试角色查询实际接口，确认隐藏字段未返回、受限修改被拒绝，再核对租户字段树的影响范围。" type="success" closable @close="savedMessage = ''" />
    <section class="filter-deck filter-deck--compact">
      <el-form inline @submit.prevent="search">
        <el-form-item label="模块"><el-select v-if="tab === 'fields'" v-model="fieldFilters.module" clearable style="width:140px"><el-option v-for="item in modules" :key="item.value" :label="item.label" :value="item.value" /></el-select><el-select v-else v-model="mapFilters.module" clearable style="width:140px"><el-option v-for="item in modules" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
        <template v-if="tab === 'fields'">
          <el-form-item label="字段类型"><el-select v-model="fieldFilters.is_derived" clearable style="width:140px"><el-option label="原始字段" :value="0" /><el-option label="派生字段" :value="1" /></el-select></el-form-item>
          <el-form-item label="搜索"><el-select v-model="fieldFilters.key" style="width:140px"><el-option label="字段中文名" value="field_label" /><el-option label="英文标识" value="field_code" /><el-option label="字段编号" value="field_id" /><el-option label="说明" value="description" /></el-select><el-input v-model="fieldFilters.keyword" clearable placeholder="输入关键字" style="width:200px" /></el-form-item>
        </template>
        <template v-else>
          <el-form-item label="字段"><el-select v-model="mapFilters.field_id" :disabled="!!mapFilters.keyword.trim()" filterable clearable style="width:220px"><el-option v-for="item in candidates" :key="item.field_id" :label="item.field_label" :value="item.field_id" /></el-select></el-form-item>
          <el-form-item label="方向"><el-select v-model="mapFilters.io_type" clearable style="width:150px"><el-option label="查看输出" value="OUTPUT" /><el-option label="修改输入" value="INPUT" /></el-select></el-form-item>
          <el-form-item label="精确接口路径"><el-input v-model="mapFilters.interface_path" :disabled="!!mapFilters.keyword.trim()" clearable style="width:240px" /></el-form-item>
          <el-form-item label="模糊搜索"><el-select v-model="mapFilters.key" style="width:130px"><el-option label="接口中文名" value="interface_name" /><el-option label="接口路径" value="interface_path" /><el-option label="参数路径" value="param_name" /><el-option label="字段编号" value="field_id" /></el-select><el-input v-model="mapFilters.keyword" :disabled="!!mapFilters.field_id || !!mapFilters.interface_path.trim()" placeholder="清空精确筛选后可搜索" clearable style="width:220px" /></el-form-item>
        </template>
        <el-form-item><el-button @click="reset">重置</el-button><el-button type="primary" native-type="submit" :loading="loading">查询</el-button></el-form-item>
      </el-form>
    </section>
    <section class="data-panel">
      <div class="data-panel__head"><h2>{{ tab === 'fields' ? '业务字段定义' : '字段接口映射' }}</h2><div class="panel-actions"><span>{{ tab === 'fields' ? fieldTotal : mapTotal }} 条</span><el-button type="primary" :disabled="saving" @click="tab === 'fields' ? openField() : openMapping()">{{ tab === 'fields' ? '新增字段' : '新增映射' }}</el-button></div></div>
      <el-table v-if="tab === 'fields'" v-loading="loading" :data="fields" stripe row-key="field_id" empty-text="暂无符合条件的字段">
        <el-table-column prop="module_name" label="模块" width="90" /><el-table-column prop="field_label" label="字段名称" min-width="170" /><el-table-column prop="field_code" label="英文标识" min-width="150" show-overflow-tooltip />
        <el-table-column label="类型/依赖" min-width="210"><template #default="{ row }"><el-tag :type="row.is_derived ? 'info' : 'primary'" size="small">{{ row.is_derived ? '派生' : '原始' }}</el-tag><p v-if="row.is_derived">{{ row.derived_from_field_labels.join('、') }}</p></template></el-table-column>
        <el-table-column label="有效使用位置" width="110"><template #default="{ row }"><el-button link type="primary" @click="showMappings(row)">{{ row.mapping_count }}</el-button></template></el-table-column><el-table-column prop="permission_count" label="有效角色限制" width="110" />
        <el-table-column label="状态" width="80"><template #default="{ row }"><el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '停用' }}</el-tag></template></el-table-column><el-table-column prop="sort_no" label="排序" width="70" /><el-table-column prop="updated_by_name" label="更新人" width="100" /><el-table-column prop="updated_at" label="更新时间" width="170" />
        <el-table-column label="操作" width="140" fixed="right"><template #default="{ row }"><el-button link type="primary" :disabled="saving" @click="openField(row)">编辑</el-button><el-tooltip :disabled="!row.mapping_count && !row.permission_count" content="请先处理有效映射与角色限制"><span><el-button link type="danger" :disabled="saving || !!row.mapping_count || !!row.permission_count" @click="removeField(row)">删除</el-button></span></el-tooltip></template></el-table-column>
      </el-table>
      <el-table v-else v-loading="loading" :data="mappings" stripe row-key="mapping_id" empty-text="暂无符合条件的映射">
        <el-table-column prop="field_label" label="业务字段" min-width="160" /><el-table-column prop="interface_name" label="接口中文名" min-width="180" /><el-table-column prop="interface_path" label="接口内部路径" min-width="270" show-overflow-tooltip /><el-table-column label="方向" width="100"><template #default="{ row }">{{ row.io_type === 'INPUT' ? '修改输入' : '查看输出' }}</template></el-table-column><el-table-column prop="param_name" label="参数路径" min-width="240" show-overflow-tooltip /><el-table-column label="状态" width="80"><template #default="{ row }">{{ row.status === 1 ? '启用' : '停用' }}</template></el-table-column><el-table-column prop="sort_no" label="排序" width="70" /><el-table-column prop="updated_by_name" label="更新人" width="100" /><el-table-column prop="updated_at" label="更新时间" width="170" /><el-table-column prop="mapping_id" label="映射编号" min-width="180" show-overflow-tooltip /><el-table-column label="操作" width="140" fixed="right"><template #default="{ row }"><el-button link type="primary" :disabled="saving" @click="openMapping(row)">编辑</el-button><el-button link type="danger" :disabled="saving" @click="removeMapping(row)">删除</el-button></template></el-table-column>
      </el-table>
      <div class="pagination-bar"><span>停用会使相应限制失效；保存后请使用测试角色验证</span><el-pagination v-if="tab === 'fields'" background layout="total, prev, pager, next" :page-size="pageSize" :total="fieldTotal" :current-page="fieldPage" @current-change="(value: number) => { fieldPage = value; loadFields() }" /><el-pagination v-else background layout="total, prev, pager, next" :page-size="pageSize" :total="mapTotal" :current-page="mapPage" @current-change="(value: number) => { mapPage = value; loadMappings() }" /></div>
    </section>
    <el-dialog v-model="fieldDialog" :title="editingField ? '编辑业务字段' : '新增业务字段'" width="min(720px,94vw)" :close-on-click-modal="false" :show-close="!saving" :close-on-press-escape="!saving">
      <el-alert v-if="editingField" :title="`有效使用位置 ${editingField.mapping_count} 个，有效角色限制配置 ${editingField.permission_count} 项`" type="info" :closable="false" />
      <el-alert v-if="!candidatesReady && !candidatesLoading" title="依赖候选加载失败，暂不能保存" type="error" :closable="false"><el-button @click="loadCandidates">重新加载候选</el-button></el-alert>
      <el-form label-position="top" :disabled="saving" class="dense-form">
        <div class="form-row"><el-form-item label="模块" required><el-select v-model="fieldForm.module" :disabled="!!editingField"><el-option v-for="item in modules" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item><el-form-item label="英文标识" required><el-input v-model="fieldForm.field_code" :disabled="!!editingField" maxlength="64" placeholder="小写字母开头" /></el-form-item></div>
        <el-form-item label="字段中文名" required><el-input v-model="fieldForm.field_label" maxlength="128" show-word-limit /></el-form-item>
        <div class="form-row"><el-form-item label="字段类型"><el-select v-model="fieldForm.is_derived"><el-option label="原始字段" :value="0" /><el-option label="派生字段" :value="1" :disabled="!!editingField && !editingField.is_derived && editingField.permission_count > 0" /></el-select></el-form-item><el-form-item label="排序号"><el-input-number v-model="fieldForm.sort_no" :precision="0" /></el-form-item></div>
        <el-form-item v-if="fieldForm.is_derived" label="依赖字段" required><el-select v-model="fieldForm.derived_from_field_ids" multiple filterable :loading="candidatesLoading" placeholder="选择已启用的依赖字段"><el-option v-for="item in dependencyCandidates" :key="item.field_id" :label="`${item.module_name} / ${item.field_label}`" :value="item.field_id" /></el-select></el-form-item>
        <el-form-item label="说明"><el-input v-model="fieldForm.description" type="textarea" maxlength="512" show-word-limit /></el-form-item><el-form-item v-if="editingField" label="状态"><el-switch v-model="fieldForm.status" :active-value="1" :inactive-value="0" inline-prompt active-text="启用" inactive-text="停用" /></el-form-item>
      </el-form><template #footer><el-button :disabled="saving" @click="fieldDialog = false">取消</el-button><el-button type="primary" :disabled="!candidatesReady" :loading="saving" @click="saveField">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="mapDialog" :title="editingMap ? '编辑接口映射' : '新增接口映射'" width="min(760px,94vw)" :close-on-click-modal="false" :show-close="!saving" :close-on-press-escape="!saving">
      <el-alert title="路径候选仅供选择，不能证明该字段已命中；保存后请在实际接口验证。" type="info" :closable="false" />
      <el-form label-position="top" :disabled="saving" class="dense-form">
        <el-form-item label="业务字段" required><el-select v-model="mapForm.field_id" filterable :loading="candidatesLoading"><el-option v-for="item in activeCandidates" :key="item.field_id" :label="`${item.module_name} / ${item.field_label}`" :value="item.field_id" /></el-select><span>{{ mapField?.module_name || '模块由字段自动确定' }}</span></el-form-item>
        <el-form-item label="接口内部路径" required><el-select v-model="mapForm.interface_path" filterable allow-create default-first-option placeholder="例如 /tenant-products/detail"><el-option v-for="path in SENSITIVE_INTERFACE_PATHS" :key="path" :label="path" :value="path" /></el-select></el-form-item>
        <el-form-item label="接口功能中文名" required><el-input v-model="mapForm.interface_name" maxlength="128" /></el-form-item>
        <div class="form-row"><el-form-item label="方向" required><el-select v-model="mapForm.io_type"><el-option label="查看输出 OUTPUT" value="OUTPUT" /><el-option label="修改输入 INPUT" value="INPUT" :disabled="mapField?.is_derived" /></el-select></el-form-item><el-form-item label="排序号"><el-input-number v-model="mapForm.sort_no" :precision="0" /></el-form-item></div>
        <el-form-item label="参数路径" required><el-input v-model="mapForm.param_name" placeholder="factory_price / products[].factory_price / [].total_sales_amount" /></el-form-item><el-form-item v-if="editingMap" label="状态"><el-switch v-model="mapForm.status" :active-value="1" :inactive-value="0" inline-prompt active-text="启用" inactive-text="停用" /></el-form-item>
      </el-form><template #footer><el-button :disabled="saving" @click="mapDialog = false">取消</el-button><el-button type="primary" :disabled="!candidatesReady" :loading="saving" @click="saveMapping">保存</el-button></template>
    </el-dialog>
  </div>
</template>
<style scoped>
.panel-actions { display: flex; align-items: center; gap: 16px; } .dense-form { margin-top: 16px; } .dense-form .el-select { width: 100%; } .form-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; } .el-table p { margin: 6px 0; color: var(--el-text-color-secondary); font-size: 12px; } @media(max-width: 720px) { .form-row { grid-template-columns: 1fr; } }
</style>
