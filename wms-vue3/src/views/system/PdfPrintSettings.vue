<template>
  <div class="pdf-settings-page">
    <header class="settings-header">
      <div><h2>打印设置</h2><p>为公司统一设置三类单据的默认显示字段。</p></div>
      <el-tag effect="plain">公司共用</el-tag>
    </header>
    <el-tabs v-model="activeKind" class="document-tabs">
      <el-tab-pane v-for="kind in kinds" :key="kind" :name="kind" :disabled="saving">
        <template #label><span>{{ PDF_PRINT_TITLES[kind] }}<span v-if="dirty(kind)" class="unsaved-dot" aria-label="有未保存修改" /></span></template>
      </el-tab-pane>
    </el-tabs>

    <div v-if="loading" class="settings-loading" role="status">正在读取公司默认方案…</div>
    <el-alert v-else-if="loadError" :title="loadError" type="error" :closable="false" show-icon>
      <el-button link type="primary" @click="reloadSettings">重新加载</el-button>
    </el-alert>
    <template v-else-if="currentSetting">
      <div class="settings-toolbar">
        <div class="setting-status">
          <el-tag :type="dirty(activeKind) ? 'warning' : 'info'" size="small" effect="plain">
            {{ dirty(activeKind) ? '有未保存修改' : currentSetting.source === 'system' ? '使用系统默认' : '使用公司默认' }}
          </el-tag>
          <span>{{ drafts[activeKind]?.length || 0 }} / {{ allFieldKeys(catalogue).length }} 个字段显示</span>
          <span v-if="currentSetting.updated_at">{{ currentSetting.updated_by_name }} · {{ formatTime(currentSetting.updated_at) }}</span>
        </div>
        <div class="settings-actions">
          <el-button :disabled="saving" @click="reloadSettings">重新加载</el-button>
          <el-button :disabled="!canManage || saving" @click="restoreBuiltin">恢复系统默认</el-button>
          <el-button :disabled="!dirty(activeKind) || saving" @click="discard">放弃修改</el-button>
          <el-button v-if="canManage" type="primary" :loading="saving" :disabled="!dirty(activeKind)" @click="save">保存当前设置</el-button>
        </div>
      </div>
      <el-alert v-if="saveError" :title="saveError" type="error" :closable="false" show-icon class="save-error" />
      <div class="preview-selector">
        <div><span class="selector-label">预览单据</span><strong>{{ samples[activeKind]?.no || (sampleLoads[activeKind] ? '正在选择预览示例…' : '暂无可用单据') }}</strong>
          <span v-if="samples[activeKind]" class="sample-party">{{ samples[activeKind]?.partyName }}</span></div>
        <el-button :disabled="saving || !canPreview" @click="sampleVisible = true">{{ samples[activeKind] ? '更换单据' : '选择单据预览' }}</el-button>
      </div>
      <p v-if="sampleErrors[activeKind]" class="settings-hint" role="alert">{{ sampleErrors[activeKind] }}
        <el-button link type="primary" @click="ensureDefaultSample(activeKind)">重试选择</el-button>
      </p>
      <p class="settings-hint">勾选表示默认显示。Logo、品牌名、公司名、单号和页码固定显示。{{ canPreview ? '预览使用当前勾选，保存后对公司用户生效。' : '当前账号没有该类单据的预览或查询权限，仍可维护默认字段。' }}</p>
      <PdfExportEditor :key="activeKind" :model-value="true" :kind="activeKind"
        :bill-id="samples[activeKind]?.id || ''" :bill-no="samples[activeKind]?.no"
        :initial-shown-fields="seeds[activeKind]" :configuration-mode="true"
        :disabled="!canManage || saving" :preview-fetcher="previewFetcher"
        @change="fields => drafts[activeKind] = fields" />
      <p class="settings-footnote">业务页面打印时仍可临时调整；临时调整不会修改公司默认方案。</p>
    </template>
    <PdfSampleSelectDialog v-model="sampleVisible" :kind="activeKind" @select="selectPreviewSample" />
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage } from 'element-plus'
import PdfExportEditor from '@/components/PdfExportEditor.vue'
import PdfSampleSelectDialog from '@/components/PdfSampleSelectDialog.vue'
import { getFirstPdfPreviewSample, type PdfPreviewSample } from '@/api/modules/pdfPreviewSamples'
import { getPdfPrintSettings, savePdfPrintSetting, type PdfPrintSetting } from '@/api/modules/pdfPrintSettings'
import { printPurchaseOrderPdf } from '@/api/modules/purchase'
import { printSalesOrderPdf } from '@/api/modules/sales'
import { printCustomerOrderPdf } from '@/api/modules/customerOrder'
import { allFieldKeys, defaultShownFields, PDF_CATALOGUES, type PdfDocKind } from '@/config/pdfExportOptions'
import { PDF_PRINT_ENDPOINTS, PDF_PRINT_TITLES, PDF_CATALOGUE_VERSION, resolvePdfPrintSetting, samePdfShownFields, validatePdfShownFields } from '@/utils/pdfPrintSettings'
import { usePermissionStore } from '@/stores/permission'
import { confirmAction } from '@/utils/actionDialog'
import type { PdfPreviewRequest } from '@/utils/pdfPreview'

const kinds: PdfDocKind[] = ['purchase', 'sales', 'customerOrder']
const activeKind = ref<PdfDocKind>('purchase')
const settings = reactive<Partial<Record<PdfDocKind, PdfPrintSetting>>>({})
const drafts = reactive<Partial<Record<PdfDocKind, string[]>>>({})
const seeds = reactive<Partial<Record<PdfDocKind, string[]>>>({})
const samples = reactive<Partial<Record<PdfDocKind, PdfPreviewSample>>>({})
const sampleLoads = reactive<Partial<Record<PdfDocKind, boolean>>>({})
const sampleErrors = reactive<Partial<Record<PdfDocKind, string>>>({})
const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
const sampleVisible = ref(false)
const permission = usePermissionStore()
const canManage = computed(() => permission.hasUrlPerm('POST /api/v1/tenant-pdf-print-settings/update'))
const listEndpoints: Record<PdfDocKind, string> = {
  purchase: 'GET /api/v1/tenant-purchase-orders/list', sales: 'GET /api/v1/tenant-sales-orders/list',
  customerOrder: 'GET /api/v1/tenant-customer-orders/list',
}
const canPreview = computed(() => permission.hasUrlPerm(PDF_PRINT_ENDPOINTS[activeKind.value]) && permission.hasUrlPerm(listEndpoints[activeKind.value]))
const catalogue = computed(() => PDF_CATALOGUES[activeKind.value])
const currentSetting = computed(() => settings[activeKind.value])
const anyDirty = computed(() => kinds.some(dirty))
let sequence = 0
let sampleGeneration = 0
let session = localStorage.getItem('token')

function cancelSampleLoads() {
  sampleGeneration++
  for (const kind of kinds) sampleLoads[kind] = false
}
function selectPreviewSample(sample: PdfPreviewSample) {
  samples[activeKind.value] = sample
  sampleErrors[activeKind.value] = ''
}
async function ensureDefaultSample(kind: PdfDocKind) {
  if (samples[kind] || sampleLoads[kind] || !settings[kind]
      || !permission.hasUrlPerm(PDF_PRINT_ENDPOINTS[kind]) || !permission.hasUrlPerm(listEndpoints[kind])) return
  const generation = sampleGeneration
  const token = localStorage.getItem('token')
  sampleLoads[kind] = true; sampleErrors[kind] = ''
  try {
    const sample = await getFirstPdfPreviewSample(kind)
    if (generation !== sampleGeneration || token !== localStorage.getItem('token') || samples[kind]) return
    if (sample) samples[kind] = sample
  } catch (err: any) {
    if (generation === sampleGeneration && token === localStorage.getItem('token')) {
      sampleErrors[kind] = `自动选择示例失败，字段设置仍可保存。${err?.message || '请重试或手动选择单据。'}`
    }
  } finally { if (generation === sampleGeneration) sampleLoads[kind] = false }
}

function dirty(kind: PdfDocKind): boolean {
  const saved = settings[kind]
  return !!saved && !samePdfShownFields(drafts[kind] || [], resolvePdfPrintSetting(PDF_CATALOGUES[kind], saved))
}
function formatTime(value: string) { return value.replace('T', ' ').slice(0, 19) }
async function confirmDiscard(): Promise<boolean> {
  if (!anyDirty.value) return true
  try { await confirmAction('存在未保存的默认方案修改，是否放弃这些修改？', '未保存修改', { confirmButtonText: '放弃修改', type: 'warning' }); return true }
  catch { return false }
}
async function loadSettings() {
  const current = ++sequence
  const token = localStorage.getItem('token')
  session = token
  loading.value = true; loadError.value = ''; saveError.value = ''
  try {
    const response = await getPdfPrintSettings()
    if (current !== sequence || token !== localStorage.getItem('token')) return
    const validated = kinds.map(kind => {
      const setting = response.data.items.find(item => item.doc_kind === kind)
      if (!setting) throw new Error('打印默认方案返回不完整，请重新加载')
      return { kind, setting, fields: resolvePdfPrintSetting(PDF_CATALOGUES[kind], setting) }
    })
    for (const { kind, setting, fields } of validated) { settings[kind] = setting; drafts[kind] = [...fields]; seeds[kind] = [...fields] }
    void ensureDefaultSample(activeKind.value)
  } catch (err: any) {
    if (current === sequence) loadError.value = err?.message || '读取公司打印方案失败，请重新加载'
  } finally { if (current === sequence) loading.value = false }
}
async function reloadSettings() { if (await confirmDiscard()) await loadSettings() }
function restoreBuiltin() { seeds[activeKind.value] = defaultShownFields(catalogue.value); drafts[activeKind.value] = [...seeds[activeKind.value]!] }
function discard() {
  const saved = currentSetting.value
  if (saved) { seeds[activeKind.value] = resolvePdfPrintSetting(catalogue.value, saved); drafts[activeKind.value] = [...seeds[activeKind.value]!] }
  saveError.value = ''
}
async function save() {
  if (!canManage.value || saving.value || !currentSetting.value) return
  const kind = activeKind.value
  const token = localStorage.getItem('token')
  try {
    const fields = validatePdfShownFields(PDF_CATALOGUES[kind], drafts[kind])
    saving.value = true; saveError.value = ''
    const response = await savePdfPrintSetting({ doc_kind: kind, shown_fields: fields,
      expected_revision: settings[kind]!.revision, catalogue_version: PDF_CATALOGUE_VERSION })
    if (token !== localStorage.getItem('token')) return
    const saved = resolvePdfPrintSetting(PDF_CATALOGUES[kind], response.data)
    settings[kind] = response.data; drafts[kind] = [...saved]; seeds[kind] = [...saved]
    ElMessage.success('公司默认打印方案已保存，下次打开打印时生效')
  } catch (err: any) { if (token === localStorage.getItem('token')) saveError.value = err?.message || '保存失败，修改已保留，请重试' }
  finally { saving.value = false }
}
function previewFetcher(request: PdfPreviewRequest): Promise<Blob> {
  const options = { hide_fields: request.hideFields, hide_sections: request.hideSections }
  if (request.kind === 'purchase') return printPurchaseOrderPdf(request.billId, options)
  if (request.kind === 'sales') return printSalesOrderPdf(request.billId, options)
  return printCustomerOrderPdf(request.billId, options)
}
function beforeUnload(event: BeforeUnloadEvent) { if (anyDirty.value) { event.preventDefault(); event.returnValue = '' } }

watch(activeKind, kind => { seeds[kind] = [...(drafts[kind] || [])]; saveError.value = '' })
watch([activeKind, () => !!currentSetting.value, canPreview], ([kind, ready, allowed]) => {
  if (ready && allowed) void ensureDefaultSample(kind)
})
onBeforeRouteLeave(async () => {
  if (saving.value || !await confirmDiscard()) return false
  // 页面会被 keep-alive 缓存；确认放弃后也要清掉草稿，返回时才能刷新公司方案。
  for (const kind of kinds) {
    if (settings[kind]) {
      const saved = resolvePdfPrintSetting(PDF_CATALOGUES[kind], settings[kind]!)
      drafts[kind] = [...saved]; seeds[kind] = [...saved]
    }
  }
  return true
})
onMounted(() => { window.addEventListener('beforeunload', beforeUnload); void loadSettings() })
let skipFirstActivate = true
onActivated(() => {
  if (skipFirstActivate) { skipFirstActivate = false; return }
  if (session !== localStorage.getItem('token')) {
    cancelSampleLoads()
    for (const kind of kinds) { delete settings[kind]; delete drafts[kind]; delete seeds[kind]; delete samples[kind]; delete sampleErrors[kind] }
    void loadSettings()
  } else if (!anyDirty.value) void loadSettings()
})
onDeactivated(() => { sequence++; cancelSampleLoads(); sampleVisible.value = false })
onBeforeUnmount(() => { sequence++; cancelSampleLoads(); window.removeEventListener('beforeunload', beforeUnload) })
</script>

<style scoped>
.pdf-settings-page { padding: 24px 28px; background: var(--bg-white); border-radius: var(--radius-md); color: var(--text-primary); }
.settings-header, .settings-toolbar, .preview-selector { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.settings-header h2 { margin: 0; font-size: 22px; font-weight: 650; }
.settings-header p { margin: 8px 0 0; color: var(--text-secondary); font-size: 13px; }
.document-tabs { margin-top: 20px; }
.unsaved-dot { display: inline-block; width: 6px; height: 6px; margin-left: 6px; border-radius: 50%; background: var(--el-color-warning); vertical-align: middle; }
.settings-toolbar { flex-wrap: wrap; margin: 6px 0 18px; }
.setting-status, .settings-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.setting-status { color: var(--text-secondary); font-size: 12px; }
.settings-actions .el-button + .el-button { margin-left: 0; }
.preview-selector { padding: 12px 16px; background: var(--el-fill-color-light); border: 1px solid var(--border-light); border-radius: 8px; }
.selector-label { margin-right: 16px; color: var(--text-secondary); font-size: 13px; }
.preview-selector strong { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.sample-party { margin-left: 12px; color: var(--text-secondary); font-size: 13px; }
.settings-hint, .settings-footnote { font-size: 12px; color: var(--text-secondary); line-height: 1.7; }
.settings-footnote { margin-bottom: 0; }
.settings-loading { min-height: 380px; display: grid; place-items: center; color: var(--text-secondary); }
.save-error { margin-bottom: 16px; }
@media (max-width: 768px) { .pdf-settings-page { padding: 16px; } .settings-header, .preview-selector { align-items: flex-start; } .settings-actions { width: 100%; } }
</style>
