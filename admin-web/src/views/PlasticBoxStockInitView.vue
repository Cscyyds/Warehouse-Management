<script setup lang="ts">
/** 平台期初导入：提交 Excel，按租户查询异步任务及逐行校验结果。 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Upload } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { queryPlatformTenants } from '@/api/platformQueries'
import {
  importStockInit,
  type StockInitKind,
  queryStockInitImportTaskDetail,
  queryStockInitImportTasks,
  type StockInitTask,
  type StockInitTaskDetail,
  type StockInitTaskError,
  type StockInitTaskStatus,
} from '@/api/plasticBoxStockInit'

const props = withDefaults(defineProps<{ kind?: StockInitKind }>(), { kind: 'plastic-box' })
const isNoDoc = props.kind === 'no-doc'
const title = isNoDoc ? '无单据条码库存期初导入' : '塑料盒库存期初导入'
const templateFile = isNoDoc ? 'no-doc-barcode-stock-template.xlsx' : 'plastic-box-stock-init-template.xlsx'
const templateUrl = import.meta.env.BASE_URL + 'templates/' + templateFile
const headers = isNoDoc
  ? '产品编码 / 产品名称(核对) / 仓库名称 / 货位名称 / 位置编码 / 层数 / 位置号 / 数量'
  : '货位 / 塑料盒编码 / 品号 / 层数 / 位置 / 数量'
const columnCount = isNoDoc ? 8 : 6

/* —— 租户选择（先选租户再操作）—— */
const tenantOptions = ref<Array<{ id: string; name: string }>>([])
const selectedTenantId = ref('')
const loadingTenants = ref(false)

async function loadTenantList() {
  loadingTenants.value = true
  try {
    const data = await queryPlatformTenants()
    tenantOptions.value = data.tenant.map((item) => ({ id: item.tenant_code, name: item.tenant_name }))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '租客选项加载失败')
  } finally {
    loadingTenants.value = false
  }
}

/* —— Excel 上传 —— */
const fileInputRef = ref<HTMLInputElement>()
const selectedFile = ref<File | null>(null)
const uploading = ref(false)
let disposed = false

function pickFile() { fileInputRef.value?.click() }

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] || null
  if (file && !/\.xlsx$/i.test(file.name)) {
    ElMessage.warning('仅支持 .xlsx 文件，请重新选择')
    selectedFile.value = null
    input.value = ''
    return
  }
  selectedFile.value = file
}

function clearFile() {
  selectedFile.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
}

const canSubmit = computed(() => Boolean(selectedTenantId.value && selectedFile.value && !uploading.value))

async function handleSubmit() {
  if (!canSubmit.value || !selectedFile.value) return
  uploading.value = true
  try {
    const result = await importStockInit(props.kind, selectedTenantId.value, selectedFile.value)
    if (disposed) return
    ElMessage.success(`已受理导入任务 ${result.import_task_id}（${result.status_name}），逐行校验与写入在后台执行，请关注下方任务列表`)
    clearFile()
    statusFilter.value = ''
    page.value = 1
    await load()
  } catch (error) {
    if (disposed) return
    ElMessage.error(error instanceof Error ? error.message : '导入提交失败')
  } finally {
    uploading.value = false
  }
}

/* —— 任务列表 + 轮询 —— */
const ACTIVE_STATUSES: StockInitTaskStatus[] = ['PENDING', 'VALIDATING', 'WRITING']
const POLL_INTERVAL = 8000
const STATUS_PILL: Record<string, string> = {
  SUCCESS: 'is-success',
  FAILED_VALIDATION: 'is-danger',
  FAILED_SYSTEM: 'is-danger',
  PENDING: 'is-info',
  VALIDATING: 'is-info',
  WRITING: 'is-info',
}
const STATUS_TEXT: Record<string, string> = {
  PENDING: '待执行', VALIDATING: '校验中', WRITING: '写入中',
  SUCCESS: '成功', FAILED_VALIDATION: '校验驳回', FAILED_SYSTEM: '系统异常（已回滚）',
}

const loading = ref(false)
const rows = ref<StockInitTask[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const statusFilter = ref<StockInitTaskStatus | ''>('')

function isActive(row: StockInitTask) {
  return ACTIVE_STATUSES.includes(row.status)
}

let listRequest = 0

async function load(silent = false) {
  const request = ++listRequest
  const tenantId = selectedTenantId.value
  if (!tenantId) { rows.value = []; total.value = 0; stopPolling(); return }
  if (!silent) loading.value = true
  try {
    const data = await queryStockInitImportTasks(props.kind, {
      tenant_id: tenantId,
      status: statusFilter.value,
      page: page.value,
      page_size: pageSize,
    })
    if (request !== listRequest) return
    rows.value = data.list || []
    total.value = data.total || 0
    // 存在进行中任务 → 自动轮询；全部终态 → 停止
    if (rows.value.some(isActive)) startPolling()
    else stopPolling()
  } catch (error) {
    // 自动刷新失败时保留最后一次成功的结果，下次轮询继续尝试。
    if (request !== listRequest || silent) return
    rows.value = []
    total.value = 0
    stopPolling()
    ElMessage.error(error instanceof Error ? error.message : '任务列表加载失败')
  } finally {
    if (request === listRequest) loading.value = false
  }
}

let timer: number | null = null
const polling = ref(false)
function stopPolling() {
  if (timer !== null) { window.clearInterval(timer); timer = null }
  polling.value = false
}
function startPolling() {
  if (timer !== null) return
  polling.value = true
  timer = window.setInterval(() => { if (!loading.value) void load(true) }, POLL_INTERVAL)
}

function handleTenantChange() {
  page.value = 1
  rows.value = []
  total.value = 0
  detailOpen.value = false
  detail.value = null
  detailRequest += 1
  stopPolling()
  clearFile()
  void load()
}
function applyFilters() { page.value = 1; load() }
function changePage(next: number) { page.value = next; load() }

/* —— 错误明细弹窗（error_page 分页）—— */
const ERROR_PAGE_SIZE = 50
const detailOpen = ref(false)
const detailLoading = ref(false)
const detail = ref<StockInitTaskDetail | null>(null)
const errorPage = ref(1)

async function openDetail(row: StockInitTask) {
  detailOpen.value = true
  errorPage.value = 1
  detail.value = null
  await loadDetail(row.import_task_id, 1)
}

let detailRequest = 0
async function loadDetail(taskId: string, page: number) {
  const request = ++detailRequest
  const tenantId = selectedTenantId.value
  detailLoading.value = true
  try {
    const result = await queryStockInitImportTaskDetail(props.kind, {
      tenant_id: tenantId,
      import_task_id: taskId,
      error_page: page,
      error_page_size: ERROR_PAGE_SIZE,
    })
    if (request !== detailRequest || tenantId !== selectedTenantId.value || !detailOpen.value) return
    detail.value = result
    errorPage.value = page
  } catch (error) {
    if (request !== detailRequest || tenantId !== selectedTenantId.value || !detailOpen.value) return
    if (!detail.value) detailOpen.value = false
    ElMessage.error(error instanceof Error ? error.message : '任务详情加载失败')
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}

function changeErrorPage(next: number) {
  if (detail.value) void loadDetail(detail.value.import_task_id, next)
}

function statusPillClass(status: string) { return STATUS_PILL[status] || 'is-muted' }
function statusText(row: StockInitTask) { return STATUS_TEXT[row.status] || row.status_name || row.status }
function errorRowsOf(detail: StockInitTaskDetail): StockInitTaskError[] { return detail.errors || [] }

onMounted(() => {
  loadTenantList()
})
onBeforeUnmount(() => {
  disposed = true
  listRequest += 1
  detailRequest += 1
  stopPolling()
})
</script>

<template>
  <div class="page-stack">
    <PageHeader
      eyebrow="STOCK INIT"
      :title="title"
      description="为目标租户上传期初库存 Excel。任务在后台执行，任一行校验失败则整批驳回。"
      marker="UPLOAD"
    />

    <section class="filter-deck">
      <div class="filter-deck__head">
        <div><span class="mono-label">UPLOAD</span><h2>期初文件上传</h2></div>
        <div class="filter-actions">
          <a class="template-link" :href="templateUrl" :download="title + '模板.xlsx'">下载 Excel 模板（{{ columnCount }} 列）</a>
        </div>
      </div>
      <div class="filter-grid filter-grid--stock-init">
        <label><span>目标租客</span>
          <el-select
            v-model="selectedTenantId"
            filterable
            :loading="loadingTenants"
            :disabled="uploading"
            placeholder="选择租客"
            @change="handleTenantChange"
          >
            <el-option v-for="item in tenantOptions" :key="item.id" :label="`${item.name} · ${item.id}`" :value="item.id" />
          </el-select>
        </label>
        <label><span>期初 Excel（.xlsx）</span>
          <span class="file-field">
            <el-button :disabled="!selectedTenantId" @click="pickFile"><el-icon><Upload /></el-icon>选择文件</el-button>
            <span class="file-name" :title="selectedFile?.name">{{ selectedFile?.name || '未选择文件' }}</span>
            <el-button v-if="selectedFile" link type="danger" @click="clearFile">清除</el-button>
          </span>
          <input ref="fileInputRef" type="file" accept=".xlsx" class="hidden-file-input" @change="onFileChange" />
        </label>
        <div class="filter-actions filter-actions--bottom">
          <el-button type="primary" :loading="uploading" :disabled="!canSubmit" @click="handleSubmit">
            <el-icon><Upload /></el-icon>提交导入
          </el-button>
        </div>
      </div>
      <p class="upload-note">
        {{ columnCount }} 列表头均必填（{{ headers }}），每次提交 1–2000 行。
        <template v-if="isNoDoc">数量须大于 0，最多 4 位小数。产品名称、仓库、货位和层位须与系统记录一致，每个产品与位置的组合只能出现一次。</template>
        <template v-else>数量保留 2 位小数，层数与位置须为正整数。</template>
        逐行校验结果可在下方导入任务中查看。
      </p>
    </section>

    <section class="data-panel">
      <div class="data-panel__head">
        <div><span class="mono-label">IMPORT TASKS</span><h2>导入任务</h2></div>
        <div class="panel-head-right">
          <span v-if="polling" class="polling-hint"><span class="polling-dot" />自动刷新中（8s）</span>
          <el-button :loading="loading" :disabled="!selectedTenantId" @click="load()"><el-icon><Refresh /></el-icon>刷新</el-button>
        </div>
      </div>
      <div class="task-filter">
        <span class="mono-label">状态筛选</span>
        <el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 160px" @change="applyFilters">
          <el-option v-for="(text, key) in STATUS_TEXT" :key="key" :label="text" :value="key" />
        </el-select>
      </div>
      <el-table v-loading="loading" :data="rows" stripe table-layout="fixed" empty-text="该租客暂无导入任务">
        <el-table-column label="受理时间" width="160">
          <template #default="scope"><span class="mono-label">{{ scope.row.created_at || '—' }}</span></template>
        </el-table-column>
        <el-table-column label="任务 / 文件" min-width="220">
          <template #default="scope">
            <div class="table-person">
              <strong>{{ scope.row.file_name || '—' }}</strong>
              <span>{{ scope.row.import_task_id }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120" align="center">
          <template #default="scope"><span class="status-pill" :class="statusPillClass(scope.row.status)">{{ statusText(scope.row) }}</span></template>
        </el-table-column>
        <el-table-column label="进度（已处理/总行）" width="150" align="center">
          <template #default="scope"><span class="mono-label">{{ scope.row.processed_count }} / {{ scope.row.total_count }}</span></template>
        </el-table-column>
        <el-table-column label="成功 / 错误" width="110" align="center">
          <template #default="scope">
            <span class="mono-label">{{ scope.row.success_count }} / </span>
            <span class="mono-label" :class="{ 'error-count': scope.row.error_count > 0 }">{{ scope.row.error_count }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最近错误" min-width="220" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.latest_errors?.length">
              {{ scope.row.latest_errors.map((e: StockInitTaskError) => `第${e.row}行 ${e.reason}`).join('；') }}
            </span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="openDetail(scope.row)">详情</el-button>
            <a v-if="scope.row.file_url" class="table-link" :href="scope.row.file_url" target="_blank" rel="noopener">留档</a>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-bar">
        <span>{{ selectedTenantId ? '列表按受理时间倒序' : '请先选择目标租客' }}</span>
        <el-pagination background layout="prev, pager, next" :page-size="pageSize" :total="total" :current-page="page" @current-change="changePage" />
      </div>
    </section>

    <el-dialog v-model="detailOpen" title="导入任务详情" width="760px" :close-on-click-modal="false">
      <div v-loading="detailLoading" class="task-detail">
        <template v-if="detail">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="任务 ID">{{ detail.import_task_id }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <span class="status-pill" :class="statusPillClass(detail.status)">{{ statusText(detail) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="文件">{{ detail.file_name || '—' }}</el-descriptions-item>
            <el-descriptions-item label="进度"><span class="mono-label">{{ detail.processed_count }} / {{ detail.total_count }}</span></el-descriptions-item>
            <el-descriptions-item label="总行数 / 有效 / 无效">
              <span class="mono-label">{{ detail.total_rows ?? '—' }} / {{ detail.valid_count ?? '—' }} / {{ detail.invalid_count ?? '—' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="成功 / 错误">
              <span class="mono-label">{{ detail.success_count }} / {{ detail.error_count }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="受理时间">{{ detail.created_at || '—' }}</el-descriptions-item>
            <el-descriptions-item label="完成时间">{{ detail.finished_at || '—' }}</el-descriptions-item>
          </el-descriptions>
          <el-alert
            v-if="detail.status === 'FAILED_VALIDATION'"
            class="detail-alert"
            type="warning"
            :closable="false"
            show-icon
            title="校验驳回：存在错误行，本任务整单驳回、未写入任何库存；请修正后重新上传完整文件"
          />
          <el-alert
            v-else-if="detail.status === 'FAILED_SYSTEM'"
            class="detail-alert"
            type="error"
            :closable="false"
            show-icon
            title="系统异常：执行中发生错误，已回滚本次写入；可重新上传重试"
          />
          <div class="error-block-head">错误明细（{{ detail.error_total ?? 0 }} 条，第 {{ errorPage }} 页）</div>
          <el-table :data="errorRowsOf(detail)" stripe size="small" border empty-text="无错误明细">
            <el-table-column prop="row" label="行号" width="80" align="center" />
            <el-table-column prop="name" label="列名" width="140" show-overflow-tooltip />
            <el-table-column prop="reason" label="原因" min-width="320" show-overflow-tooltip />
          </el-table>
          <div class="detail-pagination">
            <el-pagination
              v-if="(detail.error_total ?? 0) > ERROR_PAGE_SIZE"
              background
              layout="prev, pager, next"
              :page-size="ERROR_PAGE_SIZE"
              :total="detail.error_total ?? 0"
              :current-page="errorPage"
              @current-change="changeErrorPage"
            />
          </div>
        </template>
      </div>
      <template #footer>
        <el-button @click="detailOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.filter-grid--stock-init { grid-template-columns: 1.2fr 1.6fr auto; align-items: end; }
.upload-note { margin: 12px 0 0; color: #8a98a7; font-size: 11px; line-height: 1.7; }
.template-link { color: #4a6fa5; font-size: 12px; text-decoration: none; }
.template-link:hover { text-decoration: underline; }
.file-field { display: flex; align-items: center; gap: 8px; }
.file-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: #526b87; }
.hidden-file-input { display: none; }
.task-filter { display: flex; align-items: center; gap: 10px; padding: 12px 24px 0; }
.panel-head-right { display: flex; align-items: center; gap: 14px; }
.polling-hint { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: #2f8a5b; }
.polling-dot { width: 7px; height: 7px; border-radius: 50%; background: #35b571; animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.error-count { color: #ad3e3e; }
.table-link { margin-left: 10px; font-size: 12px; color: #4a6fa5; text-decoration: none; }
.table-link:hover { text-decoration: underline; }
.task-detail { min-height: 160px; }
.detail-alert { margin: 12px 0; }
.error-block-head { margin: 14px 0 8px; font-size: 12px; font-weight: 700; color: #526b87; }
@media (max-width: 1180px) {
  .filter-grid--stock-init { grid-template-columns: 1fr; }
}
</style>
