<template>
  <section class="task-detail" v-loading="loading && !detail">
    <header class="detail-heading">
      <el-button link type="primary" @click="emit('back')">← {{ canViewRecords ? '返回导入记录' : '返回上传' }}</el-button>
      <el-button :loading="loading" @click="refresh">刷新状态</el-button>
    </header>
    <el-alert v-if="error" :title="`状态更新失败：${error}`" description="这不代表导入失败。可刷新状态，或返回导入记录查看。" type="error" show-icon :closable="false" />
    <template v-if="detail">
      <div class="file-heading">
        <h3>{{ detail.file_name || '未命名文件' }}</h3>
        <el-tag :type="importStatusType(detail.status)" disable-transitions>{{ IMPORT_STATUS_LABELS[detail.status] || detail.status_name }}</el-tag>
      </div>
      <el-alert :title="statusMessage" :type="bannerType" :closable="false" show-icon />
      <el-steps v-if="detail.status !== 'FAILED_SYSTEM'" class="task-stages" :active="activeStep" :process-status="detail.status === 'FAILED_VALIDATION' ? 'error' : detail.status === 'PENDING' ? 'wait' : 'process'" finish-status="success" align-center>
        <el-step title="已提交" /><el-step title="数据校验" /><el-step title="写入数据" /><el-step title="完成" />
      </el-steps>
      <div v-if="detail.status === 'VALIDATING'" class="validation-progress">
        <span>{{ importProgressText(detail) }}</span><el-progress :percentage="importProgress(detail)" :stroke-width="8" />
      </div>
      <div class="task-counts">
        <div><span>总行数</span><strong>{{ detail.total_count }}</strong></div>
        <div><span>已校验</span><strong>{{ detail.processed_count }}</strong></div>
        <div><span>已导入</span><strong :class="{ positive: detail.status === 'SUCCESS' }">{{ detail.success_count }}</strong></div>
        <div><span>异常行</span><strong :class="{ negative: detail.error_count > 0 }">{{ detail.error_count }}</strong></div>
      </div>
      <p v-if="sheets.length" class="sheet-totals">主单 {{ detail.order_total ?? 0 }} 行 / 明细 {{ detail.item_total ?? 0 }} 行；总行数为两个工作表合计。</p>
      <el-descriptions :column="isMobile ? 1 : 2" border size="small" class="task-metadata">
        <el-descriptions-item label="任务编号"><span class="task-id">{{ detail.import_task_id }}</span><el-button link size="small" @click="copyId">复制</el-button></el-descriptions-item>
        <el-descriptions-item label="提交人">{{ detail.created_by_name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="文件大小">{{ importFileSize(detail.file_size) }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ detail.created_at || '—' }}</el-descriptions-item>
        <el-descriptions-item label="开始时间">{{ detail.started_at || '—' }}</el-descriptions-item>
        <el-descriptions-item label="结束时间">{{ detail.finished_at || '—' }}</el-descriptions-item>
      </el-descriptions>
      <section class="error-section">
        <div class="error-heading"><h4>错误明细</h4><span v-if="!detail.is_finished">校验过程中持续更新，当前结果并非最终结果</span></div>
        <el-tabs v-if="sheets.length" :model-value="activeSheet" @update:model-value="changeSheet">
          <el-tab-pane v-for="sheet in sheets" :key="sheet.key" :name="sheet.key" :label="`${sheet.label}（${detail[sheet.key]?.invalid_count ?? 0}）`" />
        </el-tabs>
        <el-table v-loading="loading && !data" :data="errors.rows" border max-height="300" :empty-text="detail.is_finished ? '无行级错误记录' : '暂未发现行级错误，任务仍在处理中'">
          <el-table-column prop="row" label="Excel 行号" width="110" />
          <el-table-column prop="name" label="名称 / 标识" min-width="180" />
          <el-table-column prop="reason" label="错误原因" min-width="360"><template #default="{ row }"><span class="error-reason">{{ row.reason }}</span></template></el-table-column>
        </el-table>
        <el-pagination v-if="errors.total > 0" class="error-pagination" :current-page="page" :page-size="pageSize" :total="errors.total" :page-sizes="[20, 50, 100, 200]" layout="total, sizes, prev, pager, next" @update:current-page="page = $event" @update:page-size="changePageSize" />
      </section>
      <div class="detail-actions">
        <a v-if="fileUrl" :href="fileUrl" target="_blank" rel="noopener noreferrer" class="original-file">查看原文件</a>
        <span v-else class="muted">原文件暂不可用</span>
        <el-button v-if="canUpload && detail.is_finished" @click="emit('reupload')">{{ detail.status === 'SUCCESS' ? '继续上传' : '修正后重新上传' }}</el-button>
      </div>
    </template>
    <el-empty v-else-if="!loading && !error" description="暂无任务详情" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getImportTaskDetail, type ImportTaskType, type ImportTaskDetail, type ImportSheetKey } from '@/api/modules/batchImport'
import { useImportTaskQuery } from '@/composables/useImportTaskQuery'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { IMPORT_STATUS_LABELS, importStatusType, importProgressText, importProgress, importSheets, importErrorPage, importFileUrl, importFileSize } from '@/utils/importTask'

const { isMobile } = useBreakpoint()
const props = defineProps<{ taskType: ImportTaskType; taskId: string; active: boolean; canUpload: boolean; canViewRecords: boolean }>()
const emit = defineEmits<{ back: []; reupload: []; completed: [id: string] }>()
const page = ref(1)
const pageSize = ref(50)
const sheets = computed(() => importSheets(props.taskType))
const activeSheet = ref<ImportSheetKey | undefined>(sheets.value[0]?.key)
const detail = shallowRef<ImportTaskDetail | null>(null)
watch(() => [props.taskType, props.taskId], () => {
  page.value = 1
  activeSheet.value = sheets.value[0]?.key
  detail.value = null
}, { flush: 'sync' })
const { data, loading, error, refresh } = useImportTaskQuery({
  key: () => JSON.stringify([props.taskType, props.taskId, page.value, pageSize.value, activeSheet.value]),
  enabled: () => props.active && !!props.taskId,
  request: signal => getImportTaskDetail(props.taskType, props.taskId, page.value, pageSize.value, { silent: true, signal }),
  interval: result => result.is_finished ? 0 : 2000,
})
watch(data, result => {
  if (!result) return
  detail.value = result
  if (result.status === 'SUCCESS') emit('completed', result.import_task_id)
  const total = importErrorPage(result, activeSheet.value).total
  const lastPage = Math.max(1, Math.ceil(total / pageSize.value))
  if (page.value > lastPage) page.value = lastPage
})
const errors = computed(() => data.value ? importErrorPage(data.value, activeSheet.value) : { rows: [], total: detail.value ? importErrorPage(detail.value, activeSheet.value).total : 0 })
const fileUrl = computed(() => importFileUrl(detail.value?.file_url ?? null))
const activeStep = computed(() => ({ PENDING: 1, VALIDATING: 1, WRITING: 2, SUCCESS: 4, FAILED_VALIDATION: 1, FAILED_SYSTEM: 1 })[detail.value?.status ?? 'PENDING'])
const bannerType = computed(() => detail.value?.status === 'SUCCESS' ? 'success' : detail.value?.is_finished ? 'error' : 'info')
const statusMessage = computed(() => {
  const task = detail.value
  if (!task) return ''
  if (task.status === 'FAILED_VALIDATION') return '本次导入全部驳回，未写入数据。请修正异常行后重新上传。'
  if (task.status === 'FAILED_SYSTEM') return task.error_message || '后台处理失败，数据已回滚。请联系管理员核查后重新上传。'
  if (task.status === 'SUCCESS') return `导入完成，已成功写入 ${task.success_count} 行数据。`
  return `${importProgressText(task)}。关闭窗口不影响后台执行，可稍后从导入记录查看。`
})
function changeSheet(value: string | number) { activeSheet.value = value as ImportSheetKey; page.value = 1 }
function changePageSize(value: number) { pageSize.value = value; page.value = 1 }
async function copyId() {
  try { await navigator.clipboard.writeText(props.taskId); ElMessage.success('任务编号已复制') }
  catch { ElMessage.warning('复制失败，请选择任务编号手动复制') }
}
</script>

<style scoped>
.task-detail { min-height: 280px; }
.detail-heading, .file-heading, .error-heading, .detail-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.detail-heading { margin-bottom: 16px; }
.file-heading { margin: 16px 0; }
.file-heading h3 { font-size: 18px; overflow-wrap: anywhere; }
.task-stages { margin: 24px 0; }
.validation-progress { margin: 16px 0; font-size: 13px; }
.task-counts { display: grid; grid-template-columns: repeat(4, 1fr); margin: 20px 0 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-page); }
.task-counts > div { padding: 14px 20px; border-right: 1px solid var(--border-color); }
.task-counts > div:last-child { border: 0; }
.task-counts span { display: block; color: var(--text-secondary); font-size: 13px; }
.task-counts strong { font-size: 24px; font-variant-numeric: tabular-nums; }
.positive { color: var(--el-color-success); } .negative { color: var(--el-color-danger); }
.sheet-totals, .muted { font-size: 12px; color: var(--text-secondary); }
.sheet-totals { margin-bottom: 12px; }
.task-metadata { margin: 16px 0 24px; }
.task-id { font-family: Consolas, monospace; overflow-wrap: anywhere; }
.error-heading { margin-bottom: 12px; }
.error-heading h4 { font-size: 14px; } .error-heading span { color: var(--text-secondary); font-size: 12px; }
.error-reason { white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }
.error-pagination { justify-content: flex-end; margin-top: 16px; overflow-x: auto; }
.detail-actions { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-color); }
.original-file { color: var(--el-color-primary); text-decoration: none; }
@media (max-width: 768px) { .task-counts { grid-template-columns: repeat(2, 1fr); } .task-counts > div { padding: 12px; } .file-heading, .error-heading { align-items: flex-start; flex-direction: column; } }
</style>
