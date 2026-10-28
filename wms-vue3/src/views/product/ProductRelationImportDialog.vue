<template>
  <el-dialog :model-value="modelValue" :title="title" width="min(1120px, 94vw)" top="5vh" :close-on-click-modal="false" :show-close="!submitting" :close-on-press-escape="!submitting" class="batch-import-dialog" @update:model-value="close">
    <el-alert v-if="!allowed" title="当前角色权限状态未确认或受限，暂不能使用此批量维护功能。" type="warning" :closable="false" show-icon />
    <div v-else class="import-workspace">
      <el-tabs v-show="!taskId" v-model="tab"><el-tab-pane label="上传文件" name="upload" :disabled="busy" /><el-tab-pane label="导入记录" name="records" :disabled="busy || !canList" /></el-tabs>
      <section v-show="!taskId && tab === 'upload'" class="upload-panel">
        <p class="upload-intro">{{ intro }}</p>
        <div class="template-card">
          <el-icon :size="26"><Document /></el-icon>
          <div><strong>{{ templateName }}</strong><p>{{ templateNote }}</p></div>
          <a v-if="templateUrl" :href="templateUrl" :download="templateName" class="template-download"><el-icon><Download /></el-icon>下载模板</a>
          <span v-else class="upload-hint">正式模板待提供，请使用已确认的业务文件</span>
        </div>
        <el-upload ref="uploadRef" drag accept=".xlsx" :auto-upload="false" :show-file-list="false" :limit="1" :disabled="busy || !canUpload" :on-change="chooseFile"><el-icon class="upload-icon"><UploadFilled /></el-icon><div>点击选择或拖拽 Excel 文件到此处</div><p class="upload-hint">支持 .xlsx，单文件不超过 10 MB</p></el-upload>
        <div v-if="file" class="file-ready"><span><strong>{{ file.name }}</strong><small>{{ importFileSize(file.size) }}</small></span><el-button link type="danger" :disabled="busy" @click="resetFile">移除</el-button></div>
        <el-alert v-if="previewing || submitting" title="正在上传并检查文件结构，请勿关闭或重复提交。" type="info" :closable="false" show-icon />
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
        <el-alert v-if="uncertain" title="尚未确认任务是否已受理，请先查看导入记录再决定是否重新上传，避免重复导入。" type="warning" :closable="false" show-icon />
        <div v-if="uncertain" class="uncertain-actions">
          <el-button v-if="canList" @click="tab = 'records'">查看导入记录</el-button>
          <el-button @click="acknowledge">已核对记录，允许重新提交</el-button>
        </div>
      </section>
      <section v-if="preview" v-show="!taskId && tab === 'upload'" class="preview-result">
        <div class="preview-counts"><span>文件总行数 {{ preview.total_rows }}</span><span>新增/恢复行 {{ preview.create_count }}</span><span>已有关系行 {{ preview.update_count }}</span><span>校验未通过 {{ preview.skipped_count }}</span></div>
        <el-alert v-if="preview.skipped_count" :title="`有 ${preview.skipped_count} 行未通过检查，尚未修改资料，请修正文件后重新预览。当前接口未返回错误行明细。`" type="error" :closable="false" />
        <el-alert v-if="truncated" title="当前仅返回部分明细，统计为文件全部结果。请确认订阅状态后重新预览，暂不能正式执行。" type="warning" :closable="false" />
        <el-tabs v-model="previewTab"><el-tab-pane :label="`新增/恢复（${preview.create_count}）`" name="create" /><el-tab-pane :label="`已有关系（${preview.update_count}）`" name="update" /></el-tabs>
        <el-table :data="previewRows" border size="small" max-height="320" empty-text="当前页签没有预览明细">
          <el-table-column prop="row_number" label="Excel行号" width="100" /><el-table-column prop="product.product_code" label="产品编码" min-width="150" /><el-table-column prop="product.product_name" label="产品名称" min-width="150" />
          <el-table-column :prop="kind === 'product-supplier' ? 'supplier_name' : 'customer_type_name'" :label="kind === 'product-supplier' ? '供应商' : '客户类型'" min-width="150" />
          <el-table-column v-if="previewTab === 'create'" label="维护内容" min-width="230"><template #default="{ row }"><el-tag v-if="row.revive_flag" type="warning" size="small">恢复{{ kind === 'product-supplier' ? '绑定' : '定价' }}</el-tag><span v-else>首次新增</span><p>{{ kind === 'product-supplier' ? `型号：${row.supplier_model ?? '—'}；采购价：${row.preset_purchase_price ?? '—'}` : `销售价：${row.sale_price ?? '—'}；备注：${row.remark ?? '—'}` }}</p></template></el-table-column>
          <el-table-column v-else label="修改前后" min-width="320"><template #default="{ row }"><p v-if="!row.changed_fields?.length">无变化，执行时跳过</p><p v-for="change in relationPreviewChanges(row)" :key="change.key"><strong>{{ change.label }}</strong>：{{ change.before ?? '—' }} → {{ change.after ?? '—' }}</p></template></el-table-column>
        </el-table>
        <el-pagination v-model:current-page="previewPage" :page-size="20" :total="previewTotal" layout="total, prev, pager, next" />
        <p class="muted">页码仅用于本次已返回明细的展示。预览不会锁定资料，执行时会按最新数据重新校验，实际结果以任务为准。</p>
      </section>
      <ImportTaskList v-if="recordsMounted && canList" v-show="!taskId && tab === 'records'" :task-type="kind" :active="modelValue && allowed && !taskId && tab === 'records'" :can-view-detail="canDetail" @select="taskId = $event" @completed="completed" />
      <ImportTaskDetail v-if="taskId && canDetail" :task-type="kind" :task-id="taskId" :active="modelValue && allowed" :can-upload="canUpload" :can-view-records="canList" @back="taskId = ''; tab = canList ? 'records' : 'upload'" @reupload="taskId = ''; tab = 'upload'; resetFile()" @completed="completed" />
    </div>
    <template #footer><span class="footer-hint">任务提交后，关闭窗口不影响后台执行</span><el-button :disabled="submitting" @click="close">关闭</el-button><el-button v-if="allowed && !taskId && tab === 'upload'" :loading="previewing" :disabled="!file || busy || !canUpload || uncertain" @click="runPreview">预览变更</el-button><el-button v-if="allowed && !taskId && tab === 'upload'" type="primary" :loading="submitting" :disabled="!canExecute || busy || !canUpload || uncertain" @click="submit">{{ submitting ? '提交中…' : '确认并提交' }}</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch, reactive } from 'vue'
import { ElMessage, ElMessageBox, type UploadFile, type UploadInstance } from 'element-plus'
import { Document, Download, UploadFilled } from '@element-plus/icons-vue'
import { previewProductRelations, type ProductRelationKind, type ProductRelationPreview } from '@/api/modules/productBatch'
import { IMPORT_TASK_APIS, importProductSuppliers, importProductSalePrices } from '@/api/modules/batchImport'
import { usePermissionStore } from '@/stores/permission'
import { IMPORT_TEMPLATES } from '@/config/importTemplates'
import { canSubmitRelationPreview, relationPreviewTruncated, relationPreviewChanges, validateProductRelationPreview } from '@/utils/productRelationPreview'
import { importFileSize, importRequestError } from '@/utils/importTask'
import ImportTaskList from '@/views/common/ImportTaskList.vue'
import ImportTaskDetail from '@/views/common/ImportTaskDetail.vue'
const props = withDefaults(defineProps<{ modelValue: boolean; kind: ProductRelationKind; initialTab?: 'upload' | 'records'; allowed: boolean; checkAccess: () => Promise<boolean> }>(), { initialTab: 'upload' })
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; success: [] }>()
const permission = usePermissionStore()
const title = computed(() => props.kind === 'product-supplier' ? '产品供应商批量维护' : '客户定价批量维护')
const intro = computed(() => `${props.kind === 'product-supplier' ? '预览新增、恢复和更新供应商绑定，确认后提交后台处理' : '预览新增、恢复和更新客户类型定价，确认后提交后台处理'}。按文件中的产品编码与名称核对处理，不受工具栏勾选范围限制，每行一个关系，最多 5000 行。空白单元格不修改原值，名称核对必须填写现有产品名称，任何行不通过时正式执行整批不写入。${props.kind === 'product-supplier' ? '新增或恢复绑定时采购价必填、大于 0 且最多两位小数；已有关系的型号和价格至少填写一项。' : '新增或恢复定价时价格必填且不低于产品最低销售金额；已有定价的价格或备注至少填写一项，空备注不会清空原备注。'}`)
const templateName = computed(() => `${title.value}模板.xlsx`)
const templateNote = '请使用最新模板填写数据，保持工作表和表头不变'
const templateUrl = computed(() => IMPORT_TEMPLATES[props.kind])
const apis = computed(() => IMPORT_TASK_APIS[props.kind])
const canList = computed(() => permission.hasUrlPerm(`GET ${apis.value.list}`)), canDetail = computed(() => permission.hasUrlPerm(`GET ${apis.value.detail}`))
const canUpload = computed(() => props.allowed && permission.hasUrlPerm(`POST ${apis.value.submit}`))
const file = shallowRef<File | null>(null), previewFile = shallowRef<File | null>(null), preview = shallowRef<ProductRelationPreview | null>(null)
const uploadRef = ref<UploadInstance>(), previewing = ref(false), submitting = ref(false), error = ref(''), taskId = ref('')
const tab = ref<'upload' | 'records'>('upload'), recordsMounted = ref(false), previewTab = ref('create'), previewPage = ref(1)
const acknowledging = ref(false)
const busy = computed(() => previewing.value || submitting.value || acknowledging.value), truncated = computed(() => !!preview.value && relationPreviewTruncated(preview.value))
const canExecute = computed(() => canSubmitRelationPreview(preview.value) && file.value === previewFile.value)
const previewList = computed(() => preview.value ? previewTab.value === 'create' ? preview.value.create_list : preview.value.update_list : [])
const previewTotal = computed(() => previewList.value.length), previewRows = computed(() => previewList.value.slice((previewPage.value - 1) * 20, previewPage.value * 20))
const uncertainTypes = reactive(new Set<ProductRelationKind>()), uncertain = computed(() => uncertainTypes.has(props.kind))
const completionIds = new Set<string>()
let version = 0, disposed = false, controller: AbortController | undefined
const session = localStorage.getItem('token')
const current = (id: number) => !disposed && id === version && props.modelValue && session === localStorage.getItem('token')
function resetFile() { file.value = null; previewFile.value = null; preview.value = null; previewPage.value = 1; error.value = ''; uploadRef.value?.clearFiles() }
watch(() => [props.modelValue, props.kind], ([visible]) => { version++; controller?.abort(); previewing.value = false; if (!submitting.value && visible) { resetFile(); taskId.value = ''; tab.value = props.initialTab; recordsMounted.value = tab.value === 'records' } }, { immediate: true })
watch(() => props.allowed, value => { if (!value) { version++; controller?.abort(); previewing.value = false; preview.value = null; previewFile.value = null } })
watch(tab, value => { if (value === 'records') recordsMounted.value = true })
watch(previewTab, () => { previewPage.value = 1 })
function chooseFile(upload: UploadFile) {
  if (busy.value || !upload.raw) return
  resetFile()
  if (!/\.xlsx$/i.test(upload.raw.name) || !upload.raw.size || upload.raw.size > 10 * 1024 * 1024) { error.value = '请选择非空的 xlsx 文件，且不超过10 MB'; return }
  file.value = upload.raw
}
async function runPreview() {
  if (!file.value || busy.value || !canUpload.value || uncertain.value) return
  const id = ++version, selected = file.value
  previewing.value = true; preview.value = null; previewFile.value = null; error.value = ''
  controller = new AbortController()
  try {
    if (!await props.checkAccess() || !current(id)) return
    const response = await previewProductRelations(props.kind, selected, { silent: true, signal: controller.signal })
    if (!current(id) || file.value !== selected) return
    preview.value = validateProductRelationPreview(response.data); previewFile.value = selected; previewPage.value = 1; previewTab.value = 'create'
  } catch (e) { if (current(id)) error.value = importRequestError(e) }
  finally { if (id === version) previewing.value = false }
}
async function submit() {
  if (!canExecute.value || !file.value || busy.value || !canUpload.value || uncertain.value) return
  const id = ++version, kind = props.kind, selected = file.value
  submitting.value = true; error.value = ''
  let sent = false
  try {
    if (!await props.checkAccess() || !current(id) || selected !== previewFile.value) return
    await ElMessageBox.confirm(`将处理文件「${selected.name}」中的全部 ${preview.value!.total_rows} 行，执行时会重新校验最新资料。`, '确认批量维护', { confirmButtonText: '确认提交', cancelButtonText: '返回检查', type: 'warning' })
    if (!current(id)) return
    sent = true
    const response = await (kind === 'product-supplier' ? importProductSuppliers : importProductSalePrices)(selected, { silent: true, timeout: 120000 })
    if (!current(id)) return
    if (!response.data?.import_task_id) { uncertainTypes.add(kind); throw new Error('暂未取得任务编号，请先核对导入记录') }
    resetFile(); taskId.value = response.data.import_task_id
    ElMessage.success('任务已提交，正在后台处理')
    if (!canDetail.value) { taskId.value = ''; error.value = '任务已受理，当前没有详情权限，请联系管理员查看结果。请勿重复上传。' }
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    if (current(id)) {
      error.value = importRequestError(e)
      const response = (e as { response?: { status?: number } }).response
      if (sent && (!response || (response.status ?? 0) >= 500)) uncertainTypes.add(kind)
      if (sent) previewFile.value = null
    }
  } finally { submitting.value = false }
}
async function acknowledge() {
  if (busy.value || !uncertain.value) return
  const id = version, kind = props.kind
  acknowledging.value = true
  try {
    await ElMessageBox.confirm('请确认此前文件没有被受理。重复提交可能再次执行全部变更。', '核对提交结果', { type: 'warning', confirmButtonText: '已确认未受理', cancelButtonText: '继续核对' })
    if (current(id) && props.kind === kind) uncertainTypes.delete(kind)
  } catch { /* 保留未知状态。 */ }
  finally { acknowledging.value = false }
}
function close() { if (!submitting.value) { version++; controller?.abort(); emit('update:modelValue', false) } }
function completed(id: string) { if (!completionIds.has(id)) { completionIds.add(id); emit('success') } }
onBeforeUnmount(() => { disposed = true; version++; controller?.abort() })
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
.upload-panel :deep(.el-alert) { margin-top: 16px; }
.uncertain-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.footer-hint { color: var(--text-secondary); font-size: 12px; margin-right: auto; }
.preview-result { margin: 16px 0 24px; }
.preview-counts { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; font-size: 13px; padding: 4px 0 12px; }
.preview-result :deep(.el-alert) { margin: 12px 0; }
.preview-result :deep(.el-table p) { margin: 6px 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.preview-result :deep(.el-pagination) { margin-top: 12px; justify-content: flex-end; }
.muted { color: var(--text-secondary); font-size: 12px; line-height: 1.8; margin-top: 8px; }
:global(.batch-import-dialog .el-dialog__footer) { display: flex; align-items: center; gap: 12px; padding: 16px 24px !important; border-top: 1px solid var(--border-color); }
:global(.batch-import-dialog .el-dialog__footer .el-button + .el-button) { margin-left: 0; }
@media (max-width: 768px) {
  :global(.batch-import-dialog) { width: 100vw !important; height: 100dvh; margin: 0 !important; border-radius: 0 !important; }
  .import-workspace { max-height: calc(100dvh - 150px); }
  .footer-hint { display: none; }
  .template-card { flex-wrap: wrap; }
}
</style>
