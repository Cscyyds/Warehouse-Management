<template>
  <el-dialog v-model="visible" :title="`打印${catalogue?.title || '单据'}`" width="1520px" top="3vh"
    class="pdf-export-dialog" :close-on-click-modal="false" append-to-body>
    <div v-if="defaultsLoading" class="pdf-default-status" role="status">正在读取公司默认打印方案…</div>
    <el-alert v-else-if="defaultsError" :title="defaultsError" type="error" :closable="false" show-icon>
      <el-button link type="primary" @click="loadDefaults">重新加载默认方案</el-button>
    </el-alert>
    <PdfExportEditor v-else-if="initialShownFields" ref="editorRef" :model-value="visible"
      :kind="kind" :bill-id="billId" :bill-no="billNo" :preview-fetcher="previewFetcher"
      :initial-shown-fields="initialShownFields" />
    <template #footer>
      <el-button :disabled="submitting" @click="visible = false">取消</el-button>
      <el-button :disabled="!ready || submitting" @click="editorRef?.resetAll()">恢复默认勾选</el-button>
      <el-button type="primary" :loading="submitting" :disabled="!ready || submitting" @click="onConfirm">确认下载</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { getPdfCatalogue, shownToHidden, type PdfDocKind } from '@/config/pdfExportOptions'
import { getEffectivePdfPrintSetting } from '@/api/modules/pdfPrintSettings'
import { resolvePdfPrintSetting, validatePdfShownFields } from '@/utils/pdfPrintSettings'
import { buildPdfExportSnapshot, type PdfExportSnapshot } from '@/utils/pdfExport'
import type { PdfPreviewRequest } from '@/utils/pdfPreview'
import { showErrorDialog } from '@/utils/errorFeedback'
import PdfExportEditor from './PdfExportEditor.vue'

const props = defineProps<{
  modelValue: boolean
  kind: PdfDocKind
  billId: string
  billNo?: string | null
  previewFetcher?: (request: PdfPreviewRequest) => Promise<Blob>
}>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [snapshot: PdfExportSnapshot]
}>()
const visible = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
const catalogue = computed(() => getPdfCatalogue(props.kind))
const editorRef = ref<InstanceType<typeof PdfExportEditor>>()
const initialShownFields = ref<string[] | null>(null)
const defaultsLoading = ref(false)
const defaultsError = ref('')
const submitting = ref(false)
const ready = computed(() => !defaultsLoading.value && !defaultsError.value && initialShownFields.value !== null)
let loadSequence = 0

async function loadDefaults() {
  if (!props.modelValue || !catalogue.value) return
  const sequence = ++loadSequence
  const session = localStorage.getItem('token')
  const kind = props.kind
  defaultsLoading.value = true
  defaultsError.value = ''
  initialShownFields.value = null
  try {
    const response = await getEffectivePdfPrintSetting(kind)
    if (sequence !== loadSequence || !props.modelValue) return
    if (session !== localStorage.getItem('token')) { defaultsError.value = '登录会话已变化，请重新打开打印'; return }
    initialShownFields.value = resolvePdfPrintSetting(catalogue.value!, response.data)
  } catch (error: any) {
    if (sequence === loadSequence) defaultsError.value = error?.message || '读取公司默认方案失败，请重新加载'
  } finally {
    if (sequence === loadSequence) defaultsLoading.value = false
  }
}

function onConfirm() {
  if (!ready.value || submitting.value || !editorRef.value || !catalogue.value) return
  try {
    const shown = validatePdfShownFields(catalogue.value, editorRef.value.getShownFields())
    emit('confirm', buildPdfExportSnapshot({
      kind: props.kind, billId: props.billId, billNo: props.billNo,
      hideFields: shownToHidden(catalogue.value, shown), hideSections: [],
    }))
  } catch (error: any) { showErrorDialog(error.message) }
}

function finish() { submitting.value = false; editorRef.value?.finish() }
function startSubmitting() { submitting.value = true; editorRef.value?.startSubmitting() }
defineExpose({ finish, startSubmitting })

// 当前打开期间的临时勾选不会被其他用户的保存覆盖。
watch(() => [props.modelValue, props.kind, props.billId] as const, ([open]) => {
  if (open) void loadDefaults()
  else { loadSequence++; defaultsLoading.value = false; initialShownFields.value = null; submitting.value = false }
}, { immediate: true })
onDeactivated(() => { loadSequence++; visible.value = false })
onBeforeUnmount(() => { loadSequence++ })
</script>

<style scoped>
.pdf-default-status { min-height: 320px; display: grid; place-items: center; color: var(--text-secondary); }
</style>
