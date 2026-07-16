<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { createEnumMapping, deleteEnumMapping, getEnumMappingDetail, listEnumMappings, updateEnumMapping } from '@/api/enumMappings'
import type { EnumMapping } from '@/types/platform'

const loading = ref(false)
const saving = ref(false)
const rows = ref<EnumMapping[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const dialogOpen = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const detailOpen = ref(false)
const detail = ref<EnumMapping | null>(null)
const filters = reactive({ mapping_group: '', status: undefined as number | undefined, company_id: '' })
const form = reactive({ mapping_id: '', mapping_group: '', input_value: '', standard_value: '', display_label: '', is_canonical: 0, sort_no: 0, status: 1, company_id: 'all', remark: '' })

async function load() {
  loading.value = true
  try {
    const data = await listEnumMappings({
      mapping_group: filters.mapping_group.trim() || undefined,
      status: filters.status,
      company_id: filters.company_id.trim() || undefined,
      page: page.value,
    })
    rows.value = data.items
    total.value = data.total
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(error instanceof Error ? error.message : '枚举映射加载失败')
  } finally { loading.value = false }
}

function applyFilters() { page.value = 1; load() }
function resetFilters() { Object.assign(filters, { mapping_group: '', status: undefined, company_id: '' }); applyFilters() }
function changePage(next: number) { page.value = next; load() }
function resetForm() { Object.assign(form, { mapping_id: '', mapping_group: '', input_value: '', standard_value: '', display_label: '', is_canonical: 0, sort_no: 0, status: 1, company_id: 'all', remark: '' }) }

function openCreate() {
  dialogMode.value = 'create'
  resetForm()
  if (filters.mapping_group) form.mapping_group = filters.mapping_group
  dialogOpen.value = true
}

async function openEdit(row: EnumMapping) {
  saving.value = true
  try {
    const data = await getEnumMappingDetail(row.mapping_id)
    dialogMode.value = 'edit'
    Object.assign(form, { ...data, remark: data.remark || '' })
    dialogOpen.value = true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '详情加载失败')
  } finally { saving.value = false }
}

async function openDetail(row: EnumMapping) {
  saving.value = true
  try {
    detail.value = await getEnumMappingDetail(row.mapping_id)
    detailOpen.value = true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '详情加载失败')
  } finally { saving.value = false }
}

async function save() {
  const required = dialogMode.value === 'create'
    ? [form.mapping_group, form.input_value, form.standard_value, form.display_label, form.company_id]
    : [form.mapping_id, form.display_label, form.company_id]
  if (required.some((value) => !String(value).trim())) { ElMessage.warning('请填写所有必填字段'); return }
  saving.value = true
  try {
    if (dialogMode.value === 'create') {
      await createEnumMapping({
        mapping_group: form.mapping_group.trim(), input_value: form.input_value.trim(), standard_value: form.standard_value.trim(),
        display_label: form.display_label.trim(), is_canonical: form.is_canonical, sort_no: form.sort_no,
        company_id: form.company_id.trim(), remark: form.remark,
      })
      ElMessage.success('枚举映射已创建')
    } else {
      await updateEnumMapping({
        mapping_id: form.mapping_id, display_label: form.display_label.trim(), is_canonical: form.is_canonical,
        sort_no: form.sort_no, status: form.status, company_id: form.company_id.trim(), remark: form.remark,
      })
      ElMessage.success('枚举映射已更新')
    }
    dialogOpen.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally { saving.value = false }
}

async function toggleStatus(row: EnumMapping) {
  const next = row.status === 1 ? 0 : 1
  try {
    await ElMessageBox.confirm(`确认${next === 1 ? '启用' : '停用'}“${row.display_label}”？`, '状态变更', { type: 'warning', confirmButtonText: next === 1 ? '启用' : '停用' })
    await updateEnumMapping({ mapping_id: row.mapping_id, status: next })
    ElMessage.success(next === 1 ? '已启用' : '已停用')
    await load()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error instanceof Error ? error.message : '状态修改失败')
  }
}

async function remove(row: EnumMapping) {
  try {
    await ElMessageBox.confirm(`将物理删除“${row.display_label}”，历史数据可能无法正确展示。此操作不可撤销。`, '删除枚举映射', { type: 'error', confirmButtonText: '确认物理删除', cancelButtonText: '取消' })
    await deleteEnumMapping(row.mapping_id)
    ElMessage.success('枚举映射已删除')
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    await load()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  }
}

function formatDate(value?: string | null) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—' }
onMounted(load)
</script>

<template>
  <div class="page-stack">
    <PageHeader eyebrow="ENUM REGISTRY" title="枚举映射" description="维护业务输入、标准存储值与中文展示之间的映射关系。" marker="FULL CRUD" />

    <section class="filter-deck filter-deck--compact">
      <div class="filter-grid filter-grid--mapping">
        <label><span>映射分组</span><el-input v-model="filters.mapping_group" clearable placeholder="例如 ROLE_TYPE_MAPPING" @keyup.enter="applyFilters" /></label>
        <label><span>状态</span><el-select v-model="filters.status" clearable placeholder="全部状态"><el-option label="启用" :value="1" /><el-option label="停用" :value="0" /></el-select></label>
        <label><span>适用范围</span><el-input v-model="filters.company_id" clearable placeholder="all 或租客 ID" @keyup.enter="applyFilters" /></label>
        <div class="filter-actions filter-actions--bottom"><el-button @click="resetFilters">重置</el-button><el-button type="primary" :loading="loading" @click="applyFilters">查询</el-button></div>
      </div>
    </section>

    <section class="data-panel">
      <div class="data-panel__head"><div><span class="mono-label">MAPPING RECORDS</span><h2>映射条目</h2></div><div class="panel-actions"><span class="record-count"><strong>{{ total }}</strong> 条</span><el-button type="primary" @click="openCreate">新增映射</el-button></div></div>
      <el-table v-loading="loading" :data="rows" stripe empty-text="没有枚举映射，点击右上角新增">
        <el-table-column prop="mapping_group" label="映射分组" min-width="205" show-overflow-tooltip><template #default="scope"><code class="table-code">{{ scope.row.mapping_group }}</code></template></el-table-column>
        <el-table-column prop="input_value" label="输入值" min-width="120" show-overflow-tooltip />
        <el-table-column prop="standard_value" label="标准值" min-width="130" show-overflow-tooltip><template #default="scope"><code class="table-code">{{ scope.row.standard_value }}</code></template></el-table-column>
        <el-table-column prop="display_label" label="展示标签" min-width="120" />
        <el-table-column label="规范代表" width="98"><template #default="scope"><span class="status-pill" :class="scope.row.is_canonical === 1 ? 'is-info' : ''">{{ scope.row.is_canonical === 1 ? '是' : '否' }}</span></template></el-table-column>
        <el-table-column prop="sort_no" label="排序" width="72" />
        <el-table-column prop="company_id" label="适用范围" min-width="145" show-overflow-tooltip />
        <el-table-column label="状态" width="82"><template #default="scope"><span class="status-pill" :class="scope.row.status === 1 ? 'is-success' : 'is-muted'">{{ scope.row.status === 1 ? '启用' : '停用' }}</span></template></el-table-column>
        <el-table-column label="操作" width="224" fixed="right"><template #default="scope"><el-button link type="primary" @click="openDetail(scope.row)">详情</el-button><el-button link type="primary" @click="openEdit(scope.row)">编辑</el-button><el-button link :type="scope.row.status === 1 ? 'warning' : 'success'" @click="toggleStatus(scope.row)">{{ scope.row.status === 1 ? '停用' : '启用' }}</el-button><el-button link type="danger" @click="remove(scope.row)">删除</el-button></template></el-table-column>
      </el-table>
      <div class="pagination-bar"><span>物理删除前，优先考虑停用条目</span><el-pagination background layout="prev, pager, next" :page-size="pageSize" :total="total" :current-page="page" @current-change="changePage" /></div>
    </section>

    <el-dialog v-model="dialogOpen" :title="dialogMode === 'create' ? '新增枚举映射' : '编辑枚举映射'" width="680px" class="mapping-dialog" destroy-on-close>
      <div class="dialog-notice"><span class="mono-label">{{ dialogMode === 'create' ? 'NEW MAPPING' : form.mapping_id }}</span><p>{{ dialogMode === 'create' ? '输入值与标准值创建后不可修改。' : '输入值和标准值已锁定；如需变更，请删除后重建。' }}</p></div>
      <el-form label-position="top" class="dense-form">
        <div class="form-row"><el-form-item label="映射分组" required><el-input v-model="form.mapping_group" :disabled="dialogMode === 'edit'" placeholder="ROLE_TYPE_MAPPING" /></el-form-item><el-form-item label="适用范围" required><el-input v-model="form.company_id" placeholder="all 或逗号分隔租客 ID" /></el-form-item></div>
        <div class="form-row"><el-form-item label="输入值" required><el-input v-model="form.input_value" :disabled="dialogMode === 'edit'" /></el-form-item><el-form-item label="标准存储值" required><el-input v-model="form.standard_value" :disabled="dialogMode === 'edit'" class="mono-input" /></el-form-item></div>
        <div class="form-row"><el-form-item label="展示标签" required><el-input v-model="form.display_label" /></el-form-item><el-form-item label="排序号"><el-input-number v-model="form.sort_no" :min="0" controls-position="right" /></el-form-item></div>
        <div class="form-row"><el-form-item label="规范代表"><el-switch v-model="form.is_canonical" :active-value="1" :inactive-value="0" inline-prompt active-text="是" inactive-text="否" /></el-form-item><el-form-item v-if="dialogMode === 'edit'" label="状态"><el-switch v-model="form.status" :active-value="1" :inactive-value="0" inline-prompt active-text="启用" inactive-text="停用" /></el-form-item></div>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" placeholder="选填；编辑时清空可移除备注" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogOpen = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">{{ dialogMode === 'create' ? '创建映射' : '保存修改' }}</el-button></template>
    </el-dialog>

    <el-drawer v-model="detailOpen" title="枚举映射详情" size="520px">
      <div v-if="detail" class="mapping-detail">
        <div class="detail-hero"><span class="status-pill" :class="detail.status === 1 ? 'is-success' : 'is-muted'">{{ detail.status === 1 ? '启用' : '停用' }}</span><h3>{{ detail.display_label }}</h3><code>{{ detail.mapping_id }}</code></div>
        <dl><template v-for="(value, key) in detail" :key="key"><dt>{{ key }}</dt><dd>{{ key.toString().endsWith('_at') ? formatDate(String(value || '')) : (value ?? '—') }}</dd></template></dl>
      </div>
    </el-drawer>
  </div>
</template>
