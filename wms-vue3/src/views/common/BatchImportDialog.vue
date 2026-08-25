<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="620px"
    :close-on-click-modal="false"
    class="batch-import-dialog"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
    @closed="handleClosed"
  >
    <div class="batch-import">
      <p class="dialog-subtitle">按模板填写后上传 .xlsx 文件，导入失败将返回全部错误明细</p>

      <el-steps :active="stepActive" finish-status="success" align-center class="import-steps">
        <el-step title="下载模板" />
        <el-step title="上传文件" />
        <el-step title="导入结果" />
      </el-steps>

      <!-- ① 模板下载卡片 -->
      <div class="template-card">
        <div class="template-icon">
          <el-icon :size="20"><Document /></el-icon>
        </div>
        <div class="template-info">
          <div class="template-name">{{ templateName }}</div>
          <div class="template-desc">{{ templateNote }}</div>
        </div>
        <a :href="templateUrl" :download="templateName" class="template-download-btn">
          <el-icon :size="14"><Download /></el-icon>
          <span>下载</span>
        </a>
      </div>

      <!-- ② 文件上传（拖拽区） -->
      <el-upload
        ref="uploadRef"
        class="batch-upload"
        drag
        :auto-upload="false"
        :show-file-list="false"
        :accept="accept"
        :limit="1"
        :on-exceed="handleExceed"
        :on-change="handleFileChange"
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-title">点击或拖拽 {{ accept }} 文件到此处</div>
        <div class="upload-hint">仅支持 {{ accept }} 格式，单文件不超过 {{ maxSizeLabel }}</div>
      </el-upload>

      <!-- 已选文件状态 -->
      <div v-if="selectedFile" class="file-ready">
        <div class="file-icon">
          <el-icon :size="18"><Document /></el-icon>
        </div>
        <div class="file-info">
          <div class="file-name">{{ selectedFile.name }}</div>
          <div class="file-desc">{{ formatSize(selectedFile.size) }} · 已就绪</div>
        </div>
        <el-button link type="danger" size="small" @click="clearFile">
          <el-icon :size="13"><Close /></el-icon>移除
        </el-button>
      </div>

      <!-- ③ 导入结果 -->
      <div v-if="result" class="import-result">
        <div class="result-banner" :class="result.ok ? 'is-success' : 'is-failure'">
          <el-icon :size="18"><SuccessFilled v-if="result.ok" /><WarningFilled v-else /></el-icon>
          <span class="result-message">{{ result.message }}</span>
        </div>
        <div v-if="result.data" class="result-stats">
          <div class="stat-card">
            <span class="stat-label">总行数</span>
            <span class="stat-value">{{ sheetStats.total_rows ?? '-' }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">成功</span>
            <span class="stat-value is-success">{{ sheetStats.success_count ?? 0 }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">失败</span>
            <span class="stat-value is-failure">{{ sheetStats.failure_count ?? 0 }}</span>
          </div>
        </div>
        <div v-if="errorRows.length > 0" class="result-errors">
          <div class="errors-title">错误明细（{{ errorRows.length }} 条）：</div>
          <el-table :data="errorRows" border size="small" max-height="240" style="width: 100%">
            <el-table-column
              v-for="col in errorColumns"
              :key="col.prop"
              :prop="col.prop"
              :label="col.label"
              :width="col.width"
              show-overflow-tooltip
            />
          </el-table>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
      <el-tooltip :disabled="!!selectedFile" content="请先选择 Excel 文件" placement="top">
        <span>
          <el-button type="primary" :disabled="!selectedFile" :loading="uploading" @click="handleSubmit">
            {{ uploading ? '导入中...' : '开始导入' }}
          </el-button>
        </span>
      </el-tooltip>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { Download, UploadFilled, Document, Close, SuccessFilled, WarningFilled } from '@element-plus/icons-vue'
import type { BatchImportResult, PurchaseOrderImportResult } from '@/api'

const MAX_FILE_SIZE = 10 * 1024 * 1024

/** 导入结果 data（兼容单 Sheet 扁平统计 与 采购订单双 Sheet 分表统计） */
type ImportResultData = BatchImportResult | PurchaseOrderImportResult

interface Props {
  modelValue: boolean
  title: string
  templateUrl: string
  templateName: string
  /** 模板卡片副标题（如"含 12 个必填表头"） */
  templateNote?: string
  accept?: string
  /** 上传函数：接收选中的 File，返回后端响应（如 importProducts/importCustomers/importPurchaseOrders） */
  importFn: (file: File, config?: import('@/utils/request').RequestConfig) => Promise<{ message: string; data: ImportResultData }>
}

const props = withDefaults(defineProps<Props>(), {
  templateNote: '请按模板格式填写数据，保持表头不变',
  accept: '.xlsx,.xls',
})

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  /** 导入成功（含部分失败）时触发，用于刷新列表 */
  success: []
}>()

const uploadRef = ref()
const selectedFile = ref<File | null>(null)
const uploading = ref(false)
const result = ref<{ ok: boolean; message: string; data?: ImportResultData } | null>(null)
const errorRows = ref<Array<Record<string, unknown>>>([])
const errorColumns = ref<Array<{ prop: string; label: string; width?: number }>>([])

const maxSizeLabel = computed(() => `${MAX_FILE_SIZE / 1024 / 1024} MB`)

/** 双 Sheet（采购订单）统计：合并主单/明细两表的总行数、通过、失败 */
const sheetStats = computed<{ total_rows?: number; success_count?: number; failure_count?: number }>(() => {
  const d = result.value?.data
  if (d && typeof d === 'object' && 'purchase_order' in d && 'purchase_order_item' in d) {
    const po = (d as PurchaseOrderImportResult).purchase_order
    const item = (d as PurchaseOrderImportResult).purchase_order_item
    if (po && item) {
      return {
        total_rows: (Number(po.total) || 0) + (Number(item.total) || 0),
        success_count: (Number(po.valid_count) || 0) + (Number(item.valid_count) || 0),
        failure_count: (Number(po.invalid_count) || 0) + (Number(item.invalid_count) || 0),
      }
    }
  }
  const b = d as BatchImportResult | undefined
  return { total_rows: b?.total_rows, success_count: b?.success_count, failure_count: b?.failure_count }
})

/** 步骤进度：未选文件=0(下载模板)，已选=1(上传文件)，导入后=2(导入结果) */
const stepActive = computed(() => {
  if (result.value) return 2
  if (selectedFile.value) return 1
  return 0
})

function handleFileChange(file: UploadFile) {
  const raw = file.raw as File
  if (raw.size > MAX_FILE_SIZE) {
    ElMessage.warning(`文件大小超过 ${maxSizeLabel.value}，请压缩后重试`)
    uploadRef.value?.clearFiles()
    return
  }
  selectedFile.value = raw
  result.value = null
  errorRows.value = []
}

function handleExceed() {
  ElMessage.warning('每次只能上传一个文件，请先移除已选文件')
}

function clearFile() {
  selectedFile.value = null
  result.value = null
  errorRows.value = []
  uploadRef.value?.clearFiles()
}

function handleClosed() {
  clearFile()
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * 错误明细拍平：兼容单 Sheet（errors 为数组）与双 Sheet（errors 按工作表分组），
 * 分组时给每条错误注入 sheet 字段，便于表格区分来源工作表。
 */
function flattenErrors(raw: ImportResultData | undefined): Array<Record<string, unknown>> {
  if (!raw || typeof raw !== 'object') return []
  const errors = (raw as { errors?: unknown }).errors
  if (Array.isArray(errors)) return errors
  if (errors && typeof errors === 'object') {
    const out: Array<Record<string, unknown>> = []
    for (const [sheet, list] of Object.entries(errors as Record<string, unknown>)) {
      if (Array.isArray(list)) {
        list.forEach(e => out.push({ sheet, ...(e as Record<string, unknown>) }))
      }
    }
    return out
  }
  return []
}

/** 根据 errors 首项字段推断展示列（后端各接口 errors 结构不完全一致） */
function inferErrorColumns(errors: Array<Record<string, unknown>>) {
  const first = errors[0] ?? {}
  const cols: Array<{ prop: string; label: string; width?: number }> = []
  if ('sheet' in first) cols.push({ prop: 'sheet', label: '工作表', width: 110 })
  if ('row' in first) cols.push({ prop: 'row', label: '行号', width: 80 })
  if ('name' in first) cols.push({ prop: 'name', label: '名称', width: 140 })
  if ('field' in first) cols.push({ prop: 'field', label: '字段', width: 140 })
  if ('label' in first) cols.push({ prop: 'label', label: '错误位置', width: 160 })
  if ('reason' in first) {
    cols.push({ prop: 'reason', label: '错误原因' })
  } else if ('error' in first) {
    cols.push({ prop: 'error', label: '错误原因' })
  } else if (Array.isArray(first.errors)) {
    cols.push({ prop: 'errors', label: '错误原因' })
  }
  errorColumns.value = cols
}

async function handleSubmit() {
  if (!selectedFile.value || uploading.value) return
  uploading.value = true
  result.value = null
  errorRows.value = []
  try {
    // silent: true → 拦截器不弹全局错误 toast，错误统一在弹窗内 banner + 表格展示
    const res = await props.importFn(selectedFile.value, { silent: true })
    const data = (res.data ?? {}) as ImportResultData
    const errors = flattenErrors(data)
    result.value = { ok: true, message: res.message || '导入完成', data }
    errorRows.value = errors
    if (errors.length > 0) inferErrorColumns(errors)
    ElMessage.success(res.message || '导入成功')
    emit('success')
  } catch (e: unknown) {
    // request 拦截器已统一弹错（ElMessage）；此处只更新弹窗内的失败 banner + 错误明细表格
    const err = e as { response?: { data?: { message?: string; data?: ImportResultData } } }
    const resData = err.response?.data
    const errors = flattenErrors(resData?.data)
    // banner 文案：直接用后端的 message（纯文本，由 request 拦截器已去掉 <br/>），不再拼接详细错误
    result.value = {
      ok: false,
      message: resData?.message || '导入失败',
      data: resData?.data,
    }
    errorRows.value = errors
    if (errors.length > 0) inferErrorColumns(errors)
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.batch-import {
  padding-top: 4px;
}
.dialog-subtitle {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary, #606266);
}
.import-steps {
  margin-bottom: 20px;
}
.import-steps :deep(.el-step__title) {
  font-size: 13px;
}

/* ① 模板下载卡片 */
.template-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
  border: 1px solid var(--border-color, #dcdfe6);
  border-radius: 8px;
  background: var(--bg-white, #fff);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.template-card:hover {
  border-color: var(--el-color-primary, #409eff);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-7, #c6e2ff);
}
.template-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--el-color-primary-light-9, #ecf5ff);
  color: var(--el-color-primary, #409eff);
}
.template-info {
  flex: 1;
  min-width: 0;
}
.template-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #303133);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.template-desc {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-secondary, #909399);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.template-download-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 7px 14px;
  border-radius: 6px;
  background: var(--el-color-primary, #409eff);
  color: #fff;
  font-size: 13px;
  text-decoration: none;
  transition: background 0.2s;
}
.template-download-btn:hover {
  background: var(--el-color-primary-light-3, #79bbff);
}

/* ② 拖拽上传区 */
.batch-upload :deep(.el-upload) {
  width: 100%;
}
.batch-upload :deep(.el-upload-dragger) {
  width: 100%;
  padding: 28px 16px;
  border-radius: 8px;
  border: 1px dashed var(--border-color, #dcdfe6);
  background: var(--bg-page, #f5f7fa);
  transition: border-color 0.2s, background 0.2s;
}
.batch-upload :deep(.el-upload-dragger:hover) {
  border-color: var(--el-color-primary, #409eff);
  background: var(--el-color-primary-light-9, #ecf5ff);
}
.upload-icon {
  font-size: 34px;
  color: var(--el-color-primary-light-5, #a0cfff);
  margin-bottom: 8px;
}
.upload-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #303133);
}
.upload-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary, #c0c4cc);
}

/* 已选文件状态 */
.file-ready {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 10px 14px;
  border: 1px solid var(--el-color-success-light-5, #b3e19d);
  border-radius: 8px;
  background: var(--el-color-success-light-9, #f0f9eb);
}
.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 6px;
  background: var(--el-color-success-light-8, #e1f3d8);
  color: var(--el-color-success, #67c23a);
}
.file-info {
  flex: 1;
  min-width: 0;
}
.file-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #303133);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-secondary, #909399);
}

/* ③ 导入结果 */
.import-result {
  margin-top: 16px;
}
.result-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
}
.result-banner.is-success {
  background: var(--el-color-success-light-9, #f0f9eb);
  color: var(--el-color-success, #67c23a);
}
.result-banner.is-failure {
  background: var(--el-color-danger-light-9, #fef0f0);
  color: var(--el-color-danger, #f56c6c);
}
.result-message {
  color: var(--text-primary, #303133);
}
.result-stats {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}
.stat-card {
  flex: 1;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--bg-page, #f5f7fa);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.stat-label {
  font-size: 12px;
  color: var(--text-secondary, #909399);
}
.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #303133);
}
.stat-value.is-success {
  color: var(--el-color-success, #67c23a);
}
.stat-value.is-failure {
  color: var(--el-color-danger, #f56c6c);
}
.result-errors {
  margin-top: 12px;
}
.errors-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #303133);
  margin-bottom: 8px;
}

/* 底部按钮区：dialog 通过 Teleport 渲染到 body，scoped :deep 匹配不到，
   故用 :global + 自定义 dialog class 强制生效，保证按钮有间距、不贴边 */
:global(.batch-import-dialog .el-dialog__footer) {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  padding: 16px 24px !important;
}
:global(.batch-import-dialog .el-dialog__footer .el-button + .el-button) {
  margin-left: 0;
}
</style>
