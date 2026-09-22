<template>
  <el-dialog :model-value="modelValue" :title="title" width="min(1120px, 94vw)" top="5vh" :close-on-click-modal="false" :close-on-press-escape="!uploading" :show-close="!uploading" class="batch-import-dialog" @update:model-value="close">
    <div ref="workspaceRef" class="import-workspace">
      <el-tabs v-show="!selectedTask" v-model="tab">
        <el-tab-pane label="上传文件" name="upload" :disabled="uploading" />
        <el-tab-pane label="导入记录" name="records" :disabled="uploading || !canViewList" />
      </el-tabs>
      <section v-show="!selectedTask && tab === 'upload'" class="upload-panel">
        <el-alert v-if="!canUpload" title="当前账号或业务模式不允许上传，可查看已有导入记录。" type="warning" show-icon :closable="false" />
        <template v-else>
          <p class="upload-intro">按模板填写后上传，后台完成校验后统一写入。任一行校验失败，整批数据都不会导入。</p>
          <div class="template-card">
            <el-icon :size="26"><Document /></el-icon>
            <div><strong>{{ templateName }}</strong><p>{{ templateNote }}</p></div>
            <a :href="templateUrl" :download="templateName" class="template-download"><el-icon><Download /></el-icon>下载模板</a>
          </div>
          <el-upload ref="uploadRef" drag :auto-upload="false" :show-file-list="false" :accept="accept" :limit="1" :disabled="uploading" :on-change="handleFileChange" :on-exceed="handleExceed">
            <el-icon class="upload-icon"><UploadFilled /></el-icon>
            <div>点击选择或拖拽 Excel 文件到此处</div>
            <p class="upload-hint">支持 {{ accept }}，单文件不超过 10 MB</p>
          </el-upload>
          <div v-if="selectedFile" class="file-ready">
            <span><strong>{{ selectedFile.name }}</strong><small>{{ importFileSize(selectedFile.size) }}</small></span>
            <el-button link type="danger" :disabled="uploading" @click="clearFile">移除</el-button>
          </div>
          <el-alert v-if="uploading" title="正在上传并检查文件结构，请勿关闭或重复提交。" type="info" :closable="false" show-icon />
          <el-alert v-if="submitError" :title="submitError" type="error" :closable="false" show-icon />
          <el-alert v-if="uncertainSubmission" title="尚未确认任务是否已受理，请先查看导入记录再决定是否重新上传，避免重复导入。" type="warning" :closable="false" show-icon />
          <el-table v-if="quickErrors.length" :data="quickErrors" border max-height="240" class="quick-errors">
            <el-table-column prop="sheet" label="工作表" width="120" />
            <el-table-column prop="row" label="行号" width="80" />
            <el-table-column prop="name" label="名称 / 位置" min-width="160" />
            <el-table-column prop="reason" label="错误原因" min-width="280" />
          </el-table>
          <el-alert v-if="acceptedTask && !canViewDetail" :title="`任务已提交：${acceptedTask}`" description="当前账号没有任务详情查询权限，请联系管理员授权后查看结果。请勿重复上传。" type="warning" :closable="false" show-icon />
        </template>
      </section>
      <section v-if="recordsMounted" v-show="!selectedTask && tab === 'records'">
        <ImportTaskList v-if="canViewList" :task-type="taskType" :active="modelValue && !selectedTask && tab === 'records'" :can-view-detail="canViewDetail" @select="openDetail" @completed="handleCompleted" />
        <el-alert v-else title="没有导入记录查询权限，请联系管理员授权。" type="warning" :closable="false" />
      </section>
      <ImportTaskDetail v-if="selectedTask && canViewDetail" :task-type="taskType" :task-id="selectedTask" :active="modelValue" :can-upload="canUpload" :can-view-records="canViewList" @back="backToRecords" @reupload="reupload" @completed="handleCompleted" />
    </div>
    <template #footer>
      <span class="footer-hint">任务提交后，关闭窗口不影响后台执行</span>
      <el-button :disabled="uploading" @click="close">关闭</el-button>
      <el-button v-if="!selectedTask && tab === 'upload' && canUpload" type="primary" :disabled="!selectedFile" :loading="uploading" @click="handleSubmit">{{ uploading ? '提交中…' : '提交导入' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { ElMessage, type UploadFile, type UploadInstance } from 'element-plus'
import { Document, Download, UploadFilled } from '@element-plus/icons-vue'
import { IMPORT_TASK_APIS, type ImportTaskType, type ImportTaskSubmission } from '@/api/modules/batchImport'
import type { ApiResponse, RequestConfig } from '@/utils/request'
import { usePermissionStore } from '@/stores/permission'
import { useTradeModeGate } from '@/composables/useTradeModeGate'
import { importFileSize, importRequestError } from '@/utils/importTask'
import ImportTaskList from './ImportTaskList.vue'
import ImportTaskDetail from './ImportTaskDetail.vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  taskType: ImportTaskType
  initialTab?: 'upload' | 'records'
  templateUrl: string
  templateName: string
  templateNote?: string
  accept?: string
  importFn: (file: File, config?: RequestConfig) => Promise<ApiResponse<ImportTaskSubmission>>
}>(), { initialTab: 'upload', templateNote: '请使用最新模板填写数据，保持工作表和表头不变', accept: '.xlsx,.xls' })
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; success: [] }>()
const permission = usePermissionStore()
const { canWritePurchaseSales } = useTradeModeGate()
const apis = computed(() => IMPORT_TASK_APIS[props.taskType])
const canViewList = computed(() => permission.hasUrlPerm(`GET ${apis.value.list}`))
const canViewDetail = computed(() => permission.hasUrlPerm(`GET ${apis.value.detail}`))
const canUpload = computed(() => permission.hasUrlPerm(`POST ${apis.value.submit}`) && (!['sales-order', 'purchase-order'].includes(props.taskType) || canWritePurchaseSales.value))
const tab = ref<'upload' | 'records'>('upload')
const recordsMounted = ref(false)
const selectedTask = ref('')
const acceptedTask = ref('')
const selectedFile = ref<File | null>(null)
const uploadRef = ref<UploadInstance>()
const workspaceRef = ref<HTMLElement>()
let listScrollTop = 0
const uploading = ref(false)
const submitError = ref('')
const uncertainSubmission = ref(false)
const quickErrors = ref<Array<{ sheet: string; row: unknown; name: unknown; reason: unknown }>>([])
const completed = new Set<string>()
let disposed = false
let submissionVersion = 0
onScopeDispose(() => { disposed = true; submissionVersion++ })

watch(() => [props.modelValue, props.taskType], ([visible], previous) => {
  if (props.taskType !== previous?.[1]) {
    recordsMounted.value = false
    acceptedTask.value = ''
    uploading.value = false
    submissionVersion++
  }
  if (visible) {
    selectedTask.value = ''
    tab.value = props.initialTab
    if (tab.value === 'records') recordsMounted.value = true
    clearFile()
  }
}, { immediate: true })
watch(tab, value => { if (value === 'records') recordsMounted.value = true }, { immediate: true })

function close() { if (!uploading.value) emit('update:modelValue', false) }
async function openDetail(id: string) {
  if (!canViewDetail.value) return
  listScrollTop = tab.value === 'records' ? workspaceRef.value?.scrollTop ?? 0 : 0
  selectedTask.value = id
  await nextTick()
  workspaceRef.value?.scrollTo({ top: 0 })
}
async function backToRecords() {
  selectedTask.value = ''
  tab.value = canViewList.value ? 'records' : 'upload'
  await nextTick()
  workspaceRef.value?.scrollTo({ top: listScrollTop })
}
function reupload() { selectedTask.value = ''; tab.value = 'upload'; clearFile() }
function clearFile() {
  selectedFile.value = null
  uploadRef.value?.clearFiles()
  submitError.value = ''
  uncertainSubmission.value = false
  quickErrors.value = []
}
function handleFileChange(file: UploadFile) {
  const raw = file.raw
  if (!raw) return
  if (!props.accept.split(',').some(extension => raw.name.toLowerCase().endsWith(extension.trim().toLowerCase()))) {
    clearFile(); ElMessage.warning(`仅支持 ${props.accept} 文件`); return
  }
  if (!raw.size || raw.size > 10 * 1024 * 1024) {
    clearFile(); ElMessage.warning('文件不能为空且不能超过 10 MB'); return
  }
  selectedFile.value = raw
  submitError.value = ''
  uncertainSubmission.value = false
  quickErrors.value = []
  acceptedTask.value = ''
}
function handleExceed() { ElMessage.warning('每次只能上传一个文件，请先移除已选文件') }

async function handleSubmit() {
  if (!selectedFile.value || uploading.value || !canUpload.value) return
  uploading.value = true
  submitError.value = ''
  uncertainSubmission.value = false
  quickErrors.value = []
  const version = ++submissionVersion
  try {
    const response = await props.importFn(selectedFile.value, { silent: true })
    if (disposed || version !== submissionVersion) return
    const id = response.data?.import_task_id
    if (!id) {
      submitError.value = '提交响应缺少任务编号，无法确认任务状态。'
      uncertainSubmission.value = true
      return
    }
    acceptedTask.value = id
    clearFile()
    ElMessage.success('任务已提交，正在后台处理')
    openDetail(id)
  } catch (error) {
    if (disposed || version !== submissionVersion) return
    submitError.value = importRequestError(error)
    const response = (error as { response?: { status?: number; data?: { data?: { errors?: unknown } } } }).response
    uncertainSubmission.value = !response || (response.status ?? 0) >= 500
    const raw = response?.data?.data?.errors
    const groups = Array.isArray(raw) ? { '': raw } : raw && typeof raw === 'object' ? raw : {}
    const sheetNames: Record<string, string> = { sales_order: '销售主单', sales_order_item: '销售明细', purchase_order: '采购主单', purchase_order_item: '采购明细' }
    for (const [sheet, rows] of Object.entries(groups)) {
      if (!Array.isArray(rows)) continue
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue
        quickErrors.value.push({ sheet: sheetNames[sheet] || sheet, row: row.row ?? '—', name: row.name ?? row.label ?? '—', reason: row.reason ?? row.error ?? (Array.isArray(row.errors) ? row.errors.join('；') : '') })
      }
    }
  } finally {
    if (!disposed && version === submissionVersion) uploading.value = false
  }
}
function handleCompleted(id: string) {
  if (completed.has(id)) return
  completed.add(id)
  emit('success')
  if (id === acceptedTask.value) ElMessage.success('导入完成，业务列表已刷新')
}
</script>

<style scoped>
.import-workspace { max-height: 72vh; overflow-y: auto; padding: 0 2px; }
.upload-panel { max-width: 740px; margin: 0 auto; padding: 8px 0 24px; }
.upload-intro { color: var(--text-secondary); margin-bottom: 20px; font-size: 13px; line-height: 1.8; }
.template-card { display: flex; align-items: center; gap: 14px; padding: 18px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 20px; background: var(--bg-page); }
.template-card > div { flex: 1; min-width: 0; }
.template-card strong { font-size: 14px; }
.template-card p { color: var(--text-secondary); font-size: 12px; margin-top: 4px; }
.template-download { display: inline-flex; align-items: center; gap: 4px; color: var(--el-color-primary); white-space: nowrap; text-decoration: none; }
.upload-icon { color: var(--el-color-primary); font-size: 42px; margin-bottom: 12px; }
.upload-hint { color: var(--text-secondary); font-size: 12px; margin-top: 8px; }
.file-ready { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--el-color-primary-light-9); border-radius: 8px; margin-top: 12px; gap: 12px; }
.file-ready strong { font-size: 14px; overflow-wrap: anywhere; } .file-ready small { display: block; color: var(--text-secondary); margin-top: 4px; }
.upload-panel :deep(.el-alert), .quick-errors { margin-top: 16px; }
.footer-hint { color: var(--text-secondary); font-size: 12px; margin-right: auto; }
:global(.batch-import-dialog .el-dialog__footer) { display: flex; align-items: center; gap: 12px; padding: 16px 24px !important; border-top: 1px solid var(--border-color); }
:global(.batch-import-dialog .el-dialog__footer .el-button + .el-button) { margin-left: 0; }
@media (max-width: 768px) {
  :global(.batch-import-dialog) { width: 100vw !important; height: 100dvh; margin: 0 !important; border-radius: 0 !important; }
  .import-workspace { max-height: calc(100dvh - 150px); }
  .footer-hint { display: none; }
  .template-card { flex-wrap: wrap; }
}
</style>
