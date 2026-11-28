<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { querySyncSettings, updateSyncSettings, type SyncModule, type SyncSetting, type SyncValues } from '@/api/tenantMode'
const props = defineProps<{ tenantId: string; dataVersion: number }>()
const loading = ref(false)
const loaded = ref(false)
const saving = ref<SyncModule | null>(null)
const rows = ref<SyncSetting[]>([])
const forms = reactive<Partial<Record<SyncModule, SyncValues>>>({})
const errorText = ref('')
let generation = 0
const moduleLabels: Record<SyncModule, string> = { PURCHASE_SALES: '采购销售', BORROW: '借出借入', OTHER_INBOUND: '其他入库', PRODUCTION: '生产' }
const fields: Array<{ key: keyof SyncValues; label: string; min: number; max?: number }> = [
  { key: 'sync_interval_seconds', label: '同步间隔（秒）', min: 300, max: 172800 },
  { key: 'sync_window_days', label: '分片跨度（天）', min: 1, max: 180 },
  { key: 'initial_backfill_days', label: '首次回填（天）', min: 1 },
  { key: 'reconcile_days', label: '对账回看（天）', min: 1 },
]
async function load() {
  const current = ++generation
  loaded.value = false
  loading.value = true
  errorText.value = ''
  rows.value = []
  try {
    const data = await querySyncSettings(props.tenantId)
    if (current !== generation) return
    rows.value = data.settings
    for (const row of data.settings) forms[row.module_code] = { ...row.effective }
    loaded.value = true
  } catch (error) {
    if (current === generation) errorText.value = error instanceof Error ? error.message : '同步参数加载失败'
  } finally {
    if (current === generation) loading.value = false
  }
}
async function save(module: SyncModule) {
  const form = forms[module]
  if (!loaded.value || saving.value || !form) return
  for (const field of fields) {
    const value = form[field.key]
    if (!Number.isSafeInteger(value) || value < field.min || (field.max != null && value > field.max)) {
      ElMessage.warning(`${field.label}须为${field.min}以上${field.max ? '、不超过' + field.max : ''}的整数`)
      return
    }
  }
  const current = generation
  const payload = { tenant_id: props.tenantId, module_code: module, ...form }
  saving.value = module
  errorText.value = ''
  try {
    const data = await updateSyncSettings(payload)
    if (current !== generation) return
    forms[module] = { ...data.effective }
    rows.value = rows.value.map(row => row.module_code === module ? data : row)
    ElMessage.success('同步参数已保存')
  } catch (error) {
    if (current === generation) errorText.value = error instanceof Error ? error.message : '同步参数保存失败'
  } finally {
    saving.value = null
  }
}
watch(() => [props.tenantId, props.dataVersion], load, { immediate: true })
</script>

<template>
  <div v-loading="loading" class="sync-parameters">
    <el-alert type="info" :closable="false" title="四类模块分别维护同步参数；保存参数不会切换租户模式。空存储值按服务端 effective 默认值显示。" />
    <el-alert v-if="errorText" type="error" :closable="false" :title="errorText" />
    <el-button :disabled="loading || saving !== null" @click="load">刷新参数</el-button>
    <section v-for="row in rows" :key="row.module_code" class="operation-card">
      <h3>{{ moduleLabels[row.module_code] }}</h3>
      <el-form v-if="forms[row.module_code]" label-position="top" :disabled="!loaded || saving !== null">
        <el-form-item v-for="field in fields" :key="field.key" :label="field.label">
          <el-input-number v-model="forms[row.module_code]![field.key]" :min="field.min" :max="field.max" :precision="0" />
          <span v-if="row[field.key] == null" class="default-note">服务端默认 {{ row.effective[field.key] }}</span>
        </el-form-item>
        <el-button type="primary" :loading="saving === row.module_code" :disabled="!loaded || saving !== null" @click="save(row.module_code)">保存{{ moduleLabels[row.module_code] }}参数</el-button>
      </el-form>
    </section>
  </div>
</template>
<style scoped>
.sync-parameters { display: grid; gap: 16px; }
.default-note { margin-left: 12px; color: #667085; }
</style>
