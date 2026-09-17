<template>
  <!-- 知识库导入：独立上传 xlsx 文件，走 PDF 编排路由校验落批次 → commit 提交索引。
       入口：产品文档拆分页面 → 「知识库导入」按钮。
       接口：POST /api/v1/plugin/pdf/jobs/manual_upload/import-knowledge/file
       权限：knowledge:manage（后端校验） -->
  <div class="knowledge-import">
    <el-card shadow="never" class="import-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">知识库导入</span>
          <el-tag type="info" size="small">两步式：校验 → 提交索引</el-tag>
        </div>
      </template>

      <!-- 步骤①：上传文件 -->
      <div class="step-section">
        <div class="step-header">
          <el-steps :active="stepActive" finish-status="success" simple>
            <el-step title="上传文件" />
            <el-step title="校验数据" />
            <el-step title="提交索引" />
          </el-steps>
        </div>

        <el-upload
          ref="uploadRef"
          class="upload-area"
          drag
          :auto-upload="false"
          :limit="1"
          accept=".xlsx"
          :on-change="onFileChange"
          :on-remove="onFileRemove"
          :file-list="fileList"
        >
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            将 xlsx 文件拖到此处，或 <em>点击选择</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              仅支持 .xlsx 格式，文件须含「图册记录表」工作表，大小不超过 100MB
            </div>
          </template>
        </el-upload>

        <div class="action-row">
          <el-button
            type="primary"
            :loading="uploading"
            :disabled="!selectedFile"
            @click="uploadExcel"
          >
            <el-icon><Upload /></el-icon>
            校验导入
          </el-button>
          <el-button :disabled="!selectedFile || uploading" @click="resetUpload">
            <el-icon><RefreshLeft /></el-icon>
            清空
          </el-button>
        </div>
      </div>

      <!-- 步骤②：校验结果 -->
      <div v-if="batch" class="result-section">
        <el-divider content-position="left">校验结果</el-divider>

        <el-descriptions :column="4" border size="default" class="batch-info">
          <el-descriptions-item label="批次状态">
            <el-tag :type="statusTagType" size="small">{{ batch.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="总行数">{{ batch.total_rows }}</el-descriptions-item>
          <el-descriptions-item label="有效行">
            <span class="valid-count">{{ batch.valid_rows }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="错误行">
            <span :class="{ 'error-count': batch.error_rows > 0 }">{{ batch.error_rows }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="警告行">{{ batch.warning_rows }}</el-descriptions-item>
          <el-descriptions-item label="已提交">{{ batch.committed_rows }}</el-descriptions-item>
          <el-descriptions-item label="已索引">{{ batch.indexed_rows }}</el-descriptions-item>
          <el-descriptions-item label="目标空间">{{ batch.target_space_code }}</el-descriptions-item>
        </el-descriptions>

        <el-alert
          v-if="batch.error_message"
          :title="batch.error_message"
          type="error"
          show-icon
          :closable="false"
          class="error-alert"
        />

        <div class="action-row">
          <el-button
            type="success"
            :loading="committing"
            :disabled="!committable"
            @click="commitImport"
          >
            <el-icon><Check /></el-icon>
            提交索引
          </el-button>
          <el-button
            :loading="refreshing"
            :disabled="!importId"
            @click="refreshBatch"
          >
            <el-icon><Refresh /></el-icon>
            刷新状态
          </el-button>
          <el-button
            v-if="batch.error_rows > 0"
            :loading="fetchingRows"
            @click="fetchErrorRows"
          >
            <el-icon><Warning /></el-icon>
            查看错误明细
          </el-button>
          <span v-if="!committable && batch.status" class="hint-text">
            状态 {{ batch.status }} 不可提交（需 validated）
          </span>
        </div>

        <!-- commit 结果 -->
        <div v-if="commitResult" class="commit-result">
          <el-alert type="success" :closable="false" show-icon>
            <template #title>
              已提交：{{ commitResult.committed_rows }} 行落库，状态 {{ commitResult.status }}
              <span v-if="dispatchFailedCount > 0" class="dispatch-warning">
                （{{ dispatchFailedCount }} 个索引任务投递失败）
              </span>
            </template>
          </el-alert>
        </div>

        <!-- 错误行明细 -->
        <el-table
          v-if="errorRows.length"
          :data="errorRows"
          size="small"
          border
          max-height="300"
          class="error-table"
        >
          <el-table-column prop="row_no" label="行号" width="80" align="center" />
          <el-table-column label="错误信息">
            <template #default="{ row }">
              <span class="error-detail">{{ (row.errors || []).join('；') }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
/**
 * 知识库导入（正式功能页）
 *
 * 两步式导入：
 *   ① POST /api/v1/plugin/pdf/jobs/manual_upload/import-knowledge/file
 *      校验落批次，返回 import_id
 *   ② POST /api/v1/knowledge/admin/imports/{import_id}/commit
 *      提交 + 投递索引任务
 *
 * 与调试页（kb-import-test）的差异：
 *   - 走 PDF 编排路由（后端自动补「记录状态」空值为「已发布」）
 *   - 去掉请求目标切换、日志面板、适配开关等调试元素
 *   - UI 正式化：步骤条、状态标签、交互反馈
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  UploadFilled,
  Upload,
  RefreshLeft,
  Check,
  Refresh,
  Warning,
} from '@element-plus/icons-vue'
import type { UploadFile, UploadInstance } from 'element-plus'

defineOptions({ name: 'KnowledgeImport' })

// ── 常量 ──
const JOB_ID = 'manual_upload' // 溯源用占位符，后端不校验存在性
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

// ── 文件选择 ──
const uploadRef = ref<UploadInstance>()
const fileList = ref<UploadFile[]>([])
const selectedFile = ref<File | null>(null)

// ── 步骤状态 ──
const uploading = ref(false)
const committing = ref(false)
const refreshing = ref(false)
const fetchingRows = ref(false)

// ── 批次数据 ──
const batch = ref<any>(null)
const commitResult = ref<any>(null)
const errorRows = ref<any[]>([])

// ── 计算属性 ──
const importId = computed(() => String(batch.value?.import_id || ''))
const committable = computed(() => batch.value?.status === 'validated')
const dispatchFailedCount = computed(() =>
  Array.isArray(commitResult.value?.dispatch_failed_job_ids)
    ? commitResult.value.dispatch_failed_job_ids.length
    : 0
)
const statusTagType = computed(() => {
  const s = batch.value?.status
  if (s === 'validated') return 'success'
  if (s === 'committed') return 'primary'
  if (s === 'validation_failed') return 'danger'
  return 'info'
})
const stepActive = computed(() => {
  if (!batch.value) return 0
  if (batch.value.status === 'validated') return 1
  if (batch.value.status === 'committed') return 2
  return 1
})

// ── 请求头 ──
function authHeaders(extra: Record<string, string> = {}) {
  const token = localStorage.getItem('token') || ''
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra }
}

// ── 文件选择回调 ──
function onFileChange(file: UploadFile) {
  const raw = file.raw
  if (!raw) return

  // 校验文件类型
  if (!/\.xlsx$/i.test(raw.name)) {
    ElMessage.error('仅支持 .xlsx 格式文件')
    uploadRef.value?.clearFiles()
    return
  }

  // 校验文件大小
  if (raw.size > MAX_FILE_SIZE) {
    ElMessage.error('文件超过 100MB 上限')
    uploadRef.value?.clearFiles()
    return
  }

  selectedFile.value = raw
  fileList.value = [file]
}

function onFileRemove() {
  selectedFile.value = null
  fileList.value = []
}

function resetUpload() {
  uploadRef.value?.clearFiles()
  selectedFile.value = null
  fileList.value = []
  batch.value = null
  commitResult.value = null
  errorRows.value = []
}

// ── 步骤①：校验导入 ──
async function uploadExcel() {
  if (!selectedFile.value || uploading.value) return

  uploading.value = true
  batch.value = null
  commitResult.value = null
  errorRows.value = []

  try {
    const form = new FormData()
    form.append('file', selectedFile.value)

    const url = `/api/v1/plugin/pdf/jobs/${JOB_ID}/import-knowledge/file`
    const r = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    })
    const d = await r.json().catch(() => ({}))

    if (!r.ok) {
      throw new Error(typeof d?.detail === 'string' ? d.detail : `HTTP ${r.status}`)
    }

    batch.value = d
    ElMessage.success(`校验完成：${d.valid_rows ?? '?'}/${d.total_rows ?? '?'} 行有效`)

    // 如果有错误行，自动拉取明细
    if (d.error_rows > 0) {
      await fetchErrorRows()
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '上传校验失败')
  } finally {
    uploading.value = false
  }
}

// ── 步骤②：提交索引 ──
async function commitImport() {
  if (!committable.value || committing.value) return

  committing.value = true
  try {
    const url = `/api/v1/knowledge/admin/imports/${encodeURIComponent(importId.value)}/commit`
    const r = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
    })
    const d = await r.json().catch(() => ({}))

    if (!r.ok) {
      throw new Error(typeof d?.detail === 'string' ? d.detail : `HTTP ${r.status}`)
    }

    commitResult.value = d
    batch.value = { ...batch.value, ...d }

    const failed = dispatchFailedCount.value
    ElMessage.success(
      `已提交：${d.committed_rows ?? '?'} 行落库${failed ? `（${failed} 个索引任务投递失败）` : ''}`
    )
  } catch (e: any) {
    ElMessage.error(e?.message || '提交失败')
  } finally {
    committing.value = false
  }
}

// ── 刷新批次状态 ──
async function refreshBatch() {
  if (!importId.value || refreshing.value) return

  refreshing.value = true
  try {
    const url = `/api/v1/knowledge/admin/imports/${encodeURIComponent(importId.value)}`
    const r = await fetch(url, { headers: authHeaders() })
    const d = await r.json().catch(() => ({}))

    if (!r.ok) {
      throw new Error(typeof d?.detail === 'string' ? d.detail : `HTTP ${r.status}`)
    }

    batch.value = { ...batch.value, ...d }
    ElMessage.success(`批次状态：${d.status}（索引 ${d.indexed_rows ?? 0}/${d.committed_rows ?? '?'}）`)
  } catch (e: any) {
    ElMessage.error(e?.message || '刷新失败')
  } finally {
    refreshing.value = false
  }
}

// ── 拉取错误行明细 ──
async function fetchErrorRows() {
  if (!importId.value || fetchingRows.value) return

  fetchingRows.value = true
  try {
    const url = `/api/v1/knowledge/admin/imports/${encodeURIComponent(importId.value)}/rows?status=error`
    const r = await fetch(url, { headers: authHeaders() })
    const d = await r.json().catch(() => ({}))

    if (r.ok && Array.isArray(d.rows)) {
      errorRows.value = d.rows
      if (d.rows.length) {
        ElMessage.warning(`${d.rows.length} 行校验失败，见下方明细`)
      }
    }
  } catch {
    // 明细拉取失败静默
  } finally {
    fetchingRows.value = false
  }
}
</script>

<style scoped>
.knowledge-import {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.import-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.step-section {
  margin-bottom: 24px;
}

.step-header {
  margin-bottom: 20px;
}

.upload-area {
  margin-bottom: 16px;
}

.upload-area :deep(.el-upload-dragger) {
  padding: 40px 20px;
  border-radius: 8px;
  transition: border-color 0.3s;
}

.upload-area :deep(.el-upload-dragger:hover) {
  border-color: var(--el-color-primary);
}

.action-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.hint-text {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.result-section {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.batch-info {
  margin-bottom: 16px;
}

.valid-count {
  color: var(--el-color-success);
  font-weight: 600;
}

.error-count {
  color: var(--el-color-danger);
  font-weight: 600;
}

.error-alert {
  margin-bottom: 16px;
}

.commit-result {
  margin-top: 16px;
}

.dispatch-warning {
  color: var(--el-color-warning);
  font-size: 13px;
}

.error-table {
  margin-top: 16px;
}

.error-detail {
  color: var(--el-color-danger);
  font-size: 13px;
}
</style>
