<template>
  <div class="add-template-page">
    <header class="page-header">
      <div class="header-title">
        <el-button text @click="router.push(path)"><el-icon><ArrowLeft /></el-icon>返回</el-button>
        <h2>{{ title }}</h2>
      </div>
      <div>
        <el-button :disabled="busy" @click="reset">重置</el-button>
        <el-button type="primary" :loading="saving" :disabled="busy && !saving" @click="save">保存</el-button>
      </div>
    </header>
    <div class="page-body">
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
      <el-card shadow="never">
        <template #header>单据信息</template>
        <el-form label-position="top" inline :disabled="busy">
          <el-form-item label="单据日期" required>
            <el-date-picker v-model="billDate" type="date" value-format="YYYY-MM-DD" :clearable="false" />
          </el-form-item>
          <el-form-item v-if="isReturn" label="来源领料单" required>
            <el-button @click="openSources">{{ source?.bill_no || '选择来源领料单' }}</el-button>
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="remark" maxlength="500" placeholder="请输入备注" />
          </el-form-item>
        </el-form>
      </el-card>
      <el-card shadow="never">
        <template #header>
          <div class="section-header">
            <span>单据明细</span>
            <el-button v-if="isReturn" v-perm="nativePermission('POST', docKey, 'calculate-deduction')"
              :loading="previewing" :disabled="busy || !drafts.length" @click="preview">预计算冲减</el-button>
          </div>
        </template>
        <NativeBillItemEditor v-model="drafts" :doc-key="docKey" :sources="source?.items"
          :disabled="busy || (isReturn && !source)" />
      </el-card>
      <DeductionPreviewPanel v-if="isReturn" :result="currentPreview" :labels="previewLabels(drafts)" />
    </div>
  </div>

  <el-dialog v-model="sourcesVisible" title="选择来源领料单" width="min(790px, 94vw)" :show-close="!sourceBusy">
    <el-form inline @submit.prevent="searchSources">
      <el-form-item label="单据编号"><el-input v-model="sourceKeyword" clearable maxlength="191" /></el-form-item>
      <el-form-item label="仓库状态">
        <el-select v-model="sourceStatus" style="width: 145px" @change="searchSources">
          <el-option label="已发送仓库" :value="1" />
          <el-option label="出库完成" :value="3" />
        </el-select>
      </el-form-item>
      <el-form-item><el-button type="primary" native-type="submit">查询</el-button></el-form-item>
    </el-form>
    <el-alert v-if="sourceError" :title="sourceError" type="error" show-icon :closable="false" />
    <el-table v-loading="sourceBusy" :data="sourceRows" row-key="bill_id" empty-text="未找到可作为来源的领料单">
      <el-table-column prop="bill_no" label="单据编号" min-width="170" />
      <el-table-column prop="bill_date" label="单据日期" width="125" />
      <el-table-column prop="warehouse_status_name" label="仓库状态" width="130" />
      <el-table-column label="操作" width="80">
        <template #default="{ row }"><el-button link type="primary" @click="chooseSource(row)">选择</el-button></template>
      </el-table-column>
    </el-table>
    <el-pagination v-if="sourceTotal > sourceSize" v-model:current-page="sourcePage" :page-size="sourceSize"
      :total="sourceTotal" layout="total, prev, pager, next" @current-change="loadSources" />
  </el-dialog>
</template>

<script setup lang="ts">
import { confirmAction } from '@/utils/actionDialog'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import {
  calculateDeduction, createNativeBill, getNativeBillDetail, isReplayed, searchNativeBills,
  type DeductionPreviewResult, type NativeDetailResult, type NativeDocKey, type NativeHeaderRow,
} from '@/api/modules/productionNative'
import { nativeBillPath, nativePermission } from '@/config/productionNativeDocConfig'
import NativeBillItemEditor from './components/NativeBillItemEditor.vue'
import DeductionPreviewPanel from './components/DeductionPreviewPanel.vue'
import { draftError, draftPayload, nativeError, previewItems, previewLabels, today, useNativeRequestId, type DraftLine } from './nativeBillForm'

const route = useRoute()
const router = useRouter()
const docKey = route.meta.docKey as NativeDocKey
const title = String(route.meta.title)
const path = nativeBillPath(docKey)
const isReturn = docKey === 'production-return'
const billDate = ref(today())
const remark = ref('')
const drafts = ref<DraftLine[]>([])
const error = ref('')
const saving = ref(false)
const previewing = ref(false)
const busy = computed(() => saving.value || previewing.value)
const request = useNativeRequestId()
const source = ref<NativeDetailResult | null>(null)
const sourcesVisible = ref(false)
const sourceRows = ref<NativeHeaderRow[]>([])
const sourceKeyword = ref('')
const appliedKeyword = ref('')
const sourceStatus = ref<1 | 3>(1)
const sourcePage = ref(1)
const sourceSize = ref(20)
const sourceTotal = ref(0)
const sourceLoading = ref(false)
const choosing = ref(false)
const sourceBusy = computed(() => sourceLoading.value || choosing.value)
const sourceError = ref('')
const previewResult = ref<DeductionPreviewResult | null>(null)
const previewSignature = ref('')
const previewKey = computed(() => JSON.stringify([source.value?.bill_id, previewItems(drafts.value)]))
const currentPreview = computed(() => previewKey.value === previewSignature.value ? previewResult.value : null)
let sourceSequence = 0

function reset() {
  billDate.value = today()
  remark.value = ''
  drafts.value = []
  source.value = null
  previewResult.value = null
  error.value = ''
  request.clear()
}

function openSources() {
  sourcesVisible.value = true
  searchSources()
}

function searchSources() {
  sourcePage.value = 1
  appliedKeyword.value = sourceKeyword.value.trim()
  void loadSources()
}

async function loadSources() {
  const sequence = ++sourceSequence
  sourceLoading.value = true
  sourceError.value = ''
  const keyword = appliedKeyword.value
  try {
    const { data } = await searchNativeBills('production-picking', {
      page: sourcePage.value, page_size: sourceSize.value, warehouse_status: sourceStatus.value, business_status: 'NORMAL',
      condition: keyword ? { fields: ['audit_status', 'bill_no'], values: { audit_status: 1, bill_no: keyword } }
        : { fields: ['audit_status'], values: { audit_status: 1 } },
    }, { silent: true })
    if (sequence !== sourceSequence) return
    sourceRows.value = data.items
    sourceTotal.value = data.total
    sourceSize.value = data.page_size
  } catch (err) {
    if (sequence === sourceSequence) sourceError.value = nativeError(err).message
  } finally {
    if (sequence === sourceSequence) sourceLoading.value = false
  }
}

async function chooseSource(row: NativeHeaderRow) {
  if (sourceBusy.value) return
  if (source.value?.bill_id === row.bill_id) { sourcesVisible.value = false; return }
  choosing.value = true
  sourceError.value = ''
  try {
    if (drafts.value.length) {
      try { await confirmAction('切换来源会清空当前退料明细。', '切换来源', { type: 'warning' }) }
      catch { return }
    }
    const { data } = await getNativeBillDetail('production-picking', row.bill_id, { silent: true })
    if (!sourcesVisible.value) return
    if (data.audit_status !== 1 || ![1, 3].includes(data.warehouse_status) || data.business_status !== 'NORMAL') {
      sourceError.value = '该领料单状态已变化，请重新选择来源单'
      return
    }
    drafts.value = []
    previewResult.value = null
    source.value = data
    sourcesVisible.value = false
  } catch (err) {
    sourceError.value = nativeError(err).message
  } finally {
    choosing.value = false
  }
}

async function preview() {
  if (busy.value || !source.value) return
  error.value = draftError(drafts.value, true)
  if (error.value) return
  previewing.value = true
  previewResult.value = null
  try {
    const key = previewKey.value
    const items = previewItems(drafts.value)
    const { data } = await calculateDeduction({ source_picking_id: source.value.bill_id, items }, { silent: true })
    if (data.items.length !== items.length) throw new Error('未返回完整预计算结果，请减少明细后重试')
    previewSignature.value = key
    previewResult.value = data
  } catch (err) {
    error.value = nativeError(err).message
  } finally {
    previewing.value = false
  }
}

async function save() {
  if (busy.value) return
  error.value = !/^\d{4}-\d{2}-\d{2}$/.test(billDate.value) ? '请填写单据日期' : draftError(drafts.value, isReturn)
  if (!error.value && isReturn && (!source.value || !currentPreview.value?.can_submit)) {
    error.value = '请选择来源领料单并通过冲减预计算'
  }
  if (error.value) return
  const payload = {
    bill_date: billDate.value,
    remark: remark.value.trim() || undefined,
    items: draftPayload(drafts.value, isReturn, docKey === 'production-picking'),
    source_picking_id: source.value?.bill_id,
    expected_source_version: currentPreview.value?.source_version,
  }
  saving.value = true
  try {
    const result = await createNativeBill(docKey, { ...payload, request_id: request.id(payload) }, { silent: true })
    if (!result.data.bill_id) throw new Error('已提交，接口未返回单据编号。请在列表确认结果。')
    request.clear()
    if (!isReplayed(result.data)) ElMessage.success(result.message)
    const billId = result.data.bill_id
    reset()
    await router.push(`${path}/detail/${encodeURIComponent(billId)}`)
  } catch (err) {
    const info = nativeError(err)
    error.value = info.message
    if (info.code === 'VERSION_CONFLICT') previewResult.value = null
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.add-template-page { height: 100%; display: flex; flex-direction: column; }
.page-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; background: var(--el-bg-color); }
.header-title, .section-header { display: flex; align-items: center; gap: 12px; }
.header-title h2 { margin: 0; font-size: 18px; }
.section-header { justify-content: space-between; }
.page-body { display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 12px; padding: 12px 16px; overflow: auto; }
.el-pagination { margin-top: 12px; }
</style>
