<template>
  <div class="bill-detail" v-loading="loading">
    <header class="page-header">
      <div class="header-title">
        <el-button text @click="router.push(path)"><el-icon><ArrowLeft /></el-icon>返回</el-button>
        <h2>{{ title }}</h2>
      </div>
      <div v-if="bill" class="actions">
        <el-button v-if="bill.allowed_actions?.can_edit" v-perm="permission('update')" :disabled="!!editor" @click="openEditor('header')">编辑表头</el-button>
        <template v-for="action in BILL_ACTIONS" :key="action.key">
          <el-button v-if="canRunBillAction(action.key, bill)" v-perm="permission(action.endpoint)"
            :type="action.key === 'delete' ? 'danger' : action.key === 'approve' || action.key === 'send' ? 'primary' : 'default'"
            :disabled="!!editor" @click="selectedAction = action.key">{{ action.label }}</el-button>
        </template>
        <el-button :loading="loading" :disabled="!!editor" @click="load">刷新</el-button>
      </div>
    </header>
    <div class="page-body">
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
      <template v-if="bill">
        <el-card shadow="never">
          <template #header>单据信息</template>
          <el-descriptions border :column="3">
            <el-descriptions-item label="单据编号">{{ bill.bill_no }}</el-descriptions-item>
            <el-descriptions-item label="单据日期">{{ bill.bill_date }}</el-descriptions-item>
            <el-descriptions-item label="版本">{{ bill.version }}</el-descriptions-item>
            <el-descriptions-item label="审核状态">{{ bill.audit_status_name }}</el-descriptions-item>
            <el-descriptions-item label="仓库状态">{{ bill.warehouse_status_name }}</el-descriptions-item>
            <el-descriptions-item label="业务状态">{{ bill.business_status_name }}</el-descriptions-item>
            <el-descriptions-item label="创建人">{{ bill.created_by_name || '—' }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatNativeDateTime(bill.created_at) }}</el-descriptions-item>
            <el-descriptions-item label="审核人">{{ bill.audit_by_name || '—' }}</el-descriptions-item>
            <el-descriptions-item label="审核时间">{{ formatNativeDateTime(bill.audit_at) }}</el-descriptions-item>
            <el-descriptions-item label="发送人">{{ bill.send_by_name || '—' }}</el-descriptions-item>
            <el-descriptions-item label="发送时间">{{ formatNativeDateTime(bill.send_at) }}</el-descriptions-item>
            <el-descriptions-item v-if="isReturn" label="来源领料单号">{{ bill.source_picking_no || '—' }}</el-descriptions-item>
            <el-descriptions-item label="审核备注">{{ bill.audit_remark || '—' }}</el-descriptions-item>
            <el-descriptions-item label="备注">{{ bill.remark || '—' }}</el-descriptions-item>
          </el-descriptions>
          <div v-if="blockers.length && canManage" class="blockers">
            <el-alert v-for="text in blockers" :key="text" :title="text" type="warning" :closable="false" show-icon />
          </div>
        </el-card>
        <el-card shadow="never">
          <template #header>
            <div class="section-header">
              <span>单据明细</span>
              <div class="actions">
                <el-input v-model="itemFilter" clearable placeholder="搜索产品编码 / 名称" aria-label="搜索明细" class="item-filter" />
                <el-button v-if="bill.allowed_actions?.can_append_items" v-perm="permission('items/create')"
                  type="primary" :disabled="!!editor" @click="openEditor('add')">新增明细</el-button>
              </div>
            </div>
          </template>
          <div class="summary">
            <span v-for="metric in metrics" :key="metric.prop">{{ metric.label }} <strong>{{ quantitySum(bill.items.map(row => row[metric.prop])) }}</strong></span>
            <span>暂停行数 <strong>{{ bill.items.filter(row => row.exception_status === 'PAUSED').length }}</strong></span>
          </div>
          <el-alert v-if="editor === 'edit' && editorError" class="line-edit-feedback" :title="editorError"
            type="error" show-icon :closable="false" />
          <el-table class="wms-detail-items" :data="visibleItems" row-key="item_id" border>
            <el-table-column prop="line_no" label="项次" width="65" />
            <el-table-column prop="product_code" label="产品编码" min-width="125" show-overflow-tooltip />
            <el-table-column prop="product_name" label="产品名称" min-width="175" show-overflow-tooltip />
            <el-table-column label="单位" width="75">
              <template #default="{ row }">{{ row.unit_name?.trim() || '-' }}</template>
            </el-table-column>
            <el-table-column label="长度" :width="editingLength ? 182 : 110">
              <template #default="{ row }">
                <div v-if="isEditingLine(row) && editingLength" class="length-entry">
                  <el-input v-model="lineForm.length" aria-label="长度" size="small" inputmode="decimal" maxlength="19" :disabled="busy" />
                  <el-select v-model="lineForm.lengthUnit" aria-label="长度单位" size="small" :disabled="busy">
                    <el-option v-for="unit in NATIVE_LENGTH_UNITS" :key="unit" :label="unit" :value="unit" />
                  </el-select>
                </div>
                <span v-else>{{ formatNativeLength(row) }}</span>
              </template>
            </el-table-column>
            <el-table-column v-for="metric in metrics" :key="metric.prop" :prop="metric.prop" :label="metric.label" width="105">
              <template #default="{ row }">
                <el-input v-if="metric.prop === quantityProp && isEditingLine(row) && canChangeQuantity(row)"
                  v-model="lineForm.qty" :aria-label="quantityLabel" size="small" inputmode="decimal" maxlength="19" :disabled="busy" />
                <span v-else>{{ row[metric.prop] }}</span>
              </template>
            </el-table-column>
            <el-table-column v-if="isPicking" label="先进先出" width="90">
              <template #default="{ row }">
                <el-switch v-if="isEditingLine(row) && canEditLineMetadata(row)" v-model="lineForm.xjxc"
                  aria-label="先进先出" :active-value="1" :inactive-value="0" :disabled="busy" />
                <span v-else>{{ row.xjxc === 1 ? '是' : row.xjxc === 0 ? '否' : '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="130" :show-overflow-tooltip="editor !== 'edit'">
              <template #default="{ row }">
                <el-input v-if="isEditingLine(row) && canEditLineMetadata(row)" v-model="lineForm.remark"
                  aria-label="明细备注" size="small" maxlength="500" :disabled="busy" />
                <span v-else>{{ row.remark }}</span>
              </template>
            </el-table-column>
            <el-table-column label="明细状态" min-width="135" show-overflow-tooltip>
              <template #default="{ row }">
                <el-tag v-if="row.exception_status === 'PAUSED'" type="warning" size="small">暂停</el-tag>
                <span v-else>{{ row.warehouse_task_status === 0 ? '未完成' : row.warehouse_task_status === 1 ? '已完成' : row.warehouse_task_status === 3 ? '冲减完成' : '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column v-if="canManage" label="操作" width="125" fixed="right">
              <template #default="{ row }">
                <template v-if="isEditingLine(row)">
                  <el-button v-perm="permission('items/update')" link type="primary" :loading="saving"
                    :disabled="busy" @click="saveEditor">保存</el-button>
                  <el-button link :disabled="busy" @click="closeEditor">取消</el-button>
                </template>
                <template v-else>
                  <el-button v-if="canEditLine(row)" v-perm="permission('items/update')" link type="primary"
                    :disabled="!!editor" @click="openEditor('edit', row)">编辑</el-button>
                  <el-button v-if="canDeleteLine(row)" v-perm="permission('items/delete')" link type="danger"
                    :disabled="!!editor || busy" @click="deleteLine(row)">删除</el-button>
                </template>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="editor === 'edit' && needsPreview && sourceId" class="line-edit-feedback line-edit-preview">
            <el-button v-perm="nativePermission('POST', docKey, 'calculate-deduction')"
              :loading="previewing" :disabled="busy" @click="preview">预计算冲减</el-button>
            <DeductionPreviewPanel :result="currentPreview" :labels="previewLabels(previewRows)" />
          </div>
        </el-card>
        <OperationLogPanel v-perm="nativePermission('GET', docKey, 'operations/list')" :doc-key="docKey" :bill-id="billId" :version="bill.version" />
      </template>
    </div>
  </div>

  <BillActionDialog :doc-key="docKey" :bill="selectedAction ? bill : null" :action="selectedAction"
    @close="selectedAction = null" @done="actionDone" @stale="actionStale" />

  <el-dialog v-if="editor === 'header' || editor === 'add'" :class="{ 'native-stockin-add-dialog': editor === 'add' && docKey === 'finished-goods-stockin', 'native-stockin-product-dialog': editor === 'add' && docKey === 'finished-goods-stockin' && pickingProducts }"
    :model-value="true" :title="editorTitle" :width="editor === 'add' ? 'min(980px, 94vw)' : 'min(540px, 94vw)'"
    :close-on-click-modal="false" :close-on-press-escape="!busy" :show-close="!busy" :before-close="beforeEditorClose"
    @update:model-value="(value: boolean) => !value && closeEditor()">
    <div v-loading="sourceLoading">
      <el-alert v-if="editorError" :title="editorError" type="error" :closable="false" show-icon />
      <el-form v-if="editor === 'header'" label-position="top" :disabled="busy" @submit.prevent="saveEditor">
        <el-form-item label="单据日期" required>
          <el-date-picker v-model="headerDate" type="date" value-format="YYYY-MM-DD" :clearable="false" />
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="headerRemark" type="textarea" maxlength="500" show-word-limit /></el-form-item>
      </el-form>
      <NativeBillItemEditor v-else-if="editor === 'add'" v-model="drafts" v-model:picking-products="pickingProducts"
        :doc-key="docKey" :sources="sources" :disabled="busy" inline-product-picker />
      <DeductionPreviewPanel v-if="editor === 'add' && needsPreview" :result="currentPreview" :labels="previewLabels(previewRows)" />
    </div>
    <template v-if="!pickingProducts" #footer>
      <el-button :disabled="busy" @click="closeEditor">取消</el-button>
      <el-button v-if="needsPreview && sourceId" :loading="previewing" :disabled="busy" @click="preview">预计算冲减</el-button>
      <el-button type="primary" :loading="saving" :disabled="busy" @click="saveEditor">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { confirmAction } from '@/utils/actionDialog'
import { showErrorDialog } from '@/utils/errorFeedback'
import { computed, onActivated, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import {
  appendNativeItems, calculateDeduction, deleteNativeItems, getNativeBillDetail, isReplayed, NATIVE_LENGTH_UNITS,
  updateNativeBillHeader, updateNativeItems, type DeductionPreviewResult, type NativeDetailResult,
  type NativeBatchResult, type NativeDocKey, type NativeItemRow, type NativeWriteResult,
} from '@/api/modules/productionNative'
import { BILL_ACTIONS, canRunBillAction, nativeBillPath, nativePermission, type BillAction } from '@/config/productionNativeDocConfig'
import { usePermissionStore } from '@/stores/permission'
import type { ApiResponse } from '@/utils/request'
import BillActionDialog from './components/BillActionDialog.vue'
import DeductionPreviewPanel from './components/DeductionPreviewPanel.vue'
import NativeBillItemEditor from './components/NativeBillItemEditor.vue'
import OperationLogPanel from './components/OperationLogPanel.vue'
import { formatNativeDateTime, formatNativeLength, draftError, draftPayload, nativeError, previewItems, previewLabels, quantitySum, useNativeRequestId, validQuantity, type DraftLine } from './nativeBillForm'

type Editor = 'header' | 'add' | 'edit' | 'remove'
const editorNames = { header: '编辑表头', add: '新增明细', edit: '编辑明细', remove: '删除明细' }
const route = useRoute()
const router = useRouter()
const permissions = usePermissionStore()
const docKey = route.meta.docKey as NativeDocKey
const billId = String(route.params.billId)
const title = String(route.meta.title)
const path = nativeBillPath(docKey)
const isReturn = docKey === 'production-return'
const isPicking = docKey === 'production-picking'
const quantityLabel = isReturn ? '退料数量' : '数量'
const permission = (action: string) => nativePermission('POST', docKey, action)
const canManage = computed(() => permissions.hasUrlPerm(permission('items/update')))
const quantityProp = isReturn ? 'return_qty' : 'qty'
const metrics = [
  { prop: quantityProp, label: quantityLabel },
  { prop: 'remaining_qty', label: isReturn ? '待实退' : isPicking ? '待领' : '待缴库' },
  { prop: 'actual_qty', label: isPicking ? '已领' : isReturn ? '已实退' : '已缴库' },
  ...(isReturn ? [{ prop: 'deducted_out_qty', label: '待领冲减' }, { prop: 'finalized_deduction_qty', label: '已固化冲减' }] : []),
]

const bill = ref<NativeDetailResult | null>(null)
const loading = ref(false)
const error = ref('')
const itemFilter = ref('')
const selectedAction = ref<BillAction | null>(null)
const editor = ref<Editor | null>(null)
const pickingProducts = ref(false)
const editorTitle = computed(() => pickingProducts.value ? (docKey === 'finished-goods-stockin' ? '产品选择' : '选择产品') : editor.value ? editorNames[editor.value] : '')
const editorVersion = ref(0)
const editorError = ref('')
const saving = ref(false)
const previewing = ref(false)
const sourceLoading = ref(false)
const sourceVersion = ref<number>()
const busy = computed(() => saving.value || previewing.value || sourceLoading.value)
const headerDate = ref('')
const headerRemark = ref('')
const drafts = ref<DraftLine[]>([])
const sources = ref<NativeItemRow[]>([])
const line = ref<NativeItemRow | null>(null)
const lineForm = reactive({ qty: '', length: '', lengthUnit: 'mm', xjxc: 0, remark: '' })
const previewResult = ref<DeductionPreviewResult | null>(null)
const previewSignature = ref('')
const request = useNativeRequestId()
const sourceId = computed(() => bill.value?.source_picking_id)
const visibleItems = computed(() => {
  const keyword = itemFilter.value.trim().toLowerCase()
  return (bill.value?.items || []).filter(row => isEditingLine(row) || !keyword || [row.product_code, row.product_name, row.remark]
    .some(value => value?.toLowerCase().includes(keyword)))
})
const blockers = computed(() => [...new Set(Object.entries(bill.value?.blocked_reasons_messages ?? bill.value?.blocked_reason_messages ?? {})
  .filter(([key]) => key === 'send' || key === 'cancel_send')
  .map(([, value]) => String(value)).filter(text => text.includes('不足') || text.includes('不一致')))])
const oldQuantity = computed(() => String((isReturn ? line.value?.return_qty : line.value?.qty) ?? ''))
const changedQuantity = computed(() => lineForm.qty.trim() !== oldQuantity.value)
const needsPreview = computed(() => isReturn && (editor.value === 'add' ||
  (editor.value === 'edit' && Boolean(line.value) && changedQuantity.value && bill.value?.warehouse_status === 0 && line.value?.resource_state !== 'FINALIZED')))
const previewRows = computed<DraftLine[]>(() => {
  if (editor.value === 'add') return drafts.value
  const row = line.value
  if (!row?.source_picking_item_id) return []
  return [{
    key: row.item_id, productId: row.product_id, productCode: row.product_code, productName: row.product_name,
    unitName: row.unit_name ?? '', sourceItemId: row.source_picking_item_id, qty: lineForm.qty, length: '', lengthApplicable: false, lengthUnit: 'mm',
    xjxc: 0, remark: '',
  }]
})
const previewKey = computed(() => JSON.stringify([sourceId.value, previewItems(previewRows.value)]))
const currentPreview = computed(() => previewKey.value === previewSignature.value ? previewResult.value : null)

function noHistory(row: NativeItemRow) {
  return ![row.actual_qty, row.confirmed_release_qty, row.finalized_deduction_qty]
    .some(qty => qty != null && Number(qty) > 0)
}

function canEditLineMetadata(row: NativeItemRow) {
  return bill.value?.warehouse_status === 0 && noHistory(row)
}

function isEditingLine(row: NativeItemRow) {
  return editor.value === 'edit' && row.item_id === line.value?.item_id
}

function canEditLength(row: NativeItemRow) {
  return !isReturn && canEditLineMetadata(row) && (row.length_dimension == null || row.length_dimension === 'LENGTH')
}

const editingLength = computed(() => editor.value === 'edit' && !!line.value && canEditLength(line.value))

function canChangeQuantity(row: NativeItemRow) {
  return bill.value?.allowed_actions?.can_update_item_qty === true &&
    (Number(row.remaining_qty ?? 0) > 0 || (isReturn && ['HELD', 'RELEASED'].includes(row.resource_state ?? '')))
}

function canEditLine(row: NativeItemRow) {
  return bill.value?.allowed_actions?.can_append_items === true && row.exception_status !== 'PAUSED'
    && (canEditLineMetadata(row) || canChangeQuantity(row))
}

function canDeleteLine(row: NativeItemRow) {
  const provisional = isReturn && ['HELD', 'RELEASED'].includes(row.resource_state ?? '')
  return bill.value?.allowed_actions?.can_append_items === true && (bill.value?.items.length ?? 0) > 1
    && row.exception_status !== 'PAUSED' && noHistory(row) && (provisional || row.warehouse_task_status === 0)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await getNativeBillDetail(docKey, billId, { silent: true })
    bill.value = data
  } catch (err) {
    bill.value = null
    error.value = nativeError(err).message
  } finally {
    loading.value = false
  }
}

function actionDone(action: BillAction) {
  selectedAction.value = null
  if (action === 'delete') { void router.replace(path); return }
  void load()
}

function actionStale() {
  selectedAction.value = null
  showErrorDialog('单据已更新，请确认最新状态后重新操作')
  void load()
}

async function openEditor(mode: Editor, row?: NativeItemRow) {
  if (!bill.value || busy.value || editor.value) return
  pickingProducts.value = mode === 'add' && docKey === 'finished-goods-stockin'
  editor.value = mode
  editorVersion.value = bill.value.version
  editorError.value = ''
  line.value = row ?? null
  drafts.value = []
  sources.value = []
  sourceVersion.value = undefined
  previewResult.value = null
  headerDate.value = bill.value.bill_date
  headerRemark.value = bill.value.remark ?? ''
  if (row) {
    const [length, unit] = (row.length ?? '').split(',')
    Object.assign(lineForm, {
      qty: oldQuantity.value, length: String(row.length_value ?? length ?? ''),
      lengthUnit: row.length_unit || unit || 'mm', xjxc: row.xjxc ?? 0, remark: row.remark ?? '',
    })
  }
  const needsSource = isReturn && (mode === 'add' ||
    (mode === 'edit' && (bill.value.warehouse_status !== 0 || row?.resource_state === 'FINALIZED')))
  if (!needsSource) return
  if (!sourceId.value) { editorError.value = '当前退料单缺少来源领料单'; return }
  sourceLoading.value = true
  try {
    const { data } = await getNativeBillDetail('production-picking', sourceId.value, { silent: true })
    sourceVersion.value = data.version
    sources.value = data.items.filter(candidate => !bill.value?.items.some(item => item.source_picking_item_id === candidate.item_id))
  } catch (err) {
    editorError.value = nativeError(err).message
  } finally {
    sourceLoading.value = false
  }
}

async function deleteLine(row: NativeItemRow) {
  if (!bill.value || busy.value || editor.value) return
  try {
    await confirmAction(`确定删除第 ${row.line_no} 行“${row.product_name}”吗？`, '删除明细', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning', confirmButtonClass: 'el-button--danger',
    })
  } catch {
    return
  }
  if (!bill.value || busy.value || editor.value) return
  await openEditor('remove', row)
  await saveEditor()
}

function closeEditor() {
  if (!busy.value) editor.value = null
}

function beforeEditorClose(done: () => void) {
  if (busy.value) return
  if (pickingProducts.value && (docKey !== 'finished-goods-stockin' || drafts.value.length > 0)) {
    pickingProducts.value = false
    return
  }
  done()
}

async function preview() {
  if (busy.value || !sourceId.value || !needsPreview.value) return
  editorError.value = draftError(previewRows.value, true)
  if (editorError.value) return
  previewing.value = true
  previewResult.value = null
  try {
    const key = previewKey.value
    const items = previewItems(previewRows.value)
    const { data } = await calculateDeduction({
      source_picking_id: sourceId.value, items, exclude_return_item_id: editor.value === 'edit' ? line.value?.item_id : undefined,
    }, { silent: true })
    if (data.items.length !== items.length) throw new Error('未返回完整预计算结果，请减少明细后重试')
    previewSignature.value = key
    previewResult.value = data
  } catch (err) {
    editorError.value = nativeError(err).message
  } finally {
    previewing.value = false
  }
}

function editFields(row: NativeItemRow) {
  const payload: Record<string, unknown> = {}
  if (canChangeQuantity(row) && changedQuantity.value) {
    if (!validQuantity(lineForm.qty.trim())) throw new Error('请输入大于 0、最多四位小数的数量')
    payload[quantityProp] = lineForm.qty.trim()
  }
  if (canEditLineMetadata(row)) {
    if (lineForm.remark !== (row.remark ?? '')) payload.remark = lineForm.remark.trim() || null
    if (isPicking && lineForm.xjxc !== (row.xjxc ?? 0)) payload.xjxc = lineForm.xjxc
    if (canEditLength(row)) {
      const [originalLength, originalUnit] = (row.length ?? '').split(',')
      const previous = String(row.length_value ?? originalLength ?? '')
      if (lineForm.length.trim() !== previous || lineForm.lengthUnit !== (row.length_unit || originalUnit || 'mm')) {
        const length = lineForm.length.trim()
        if (length && !/^\d{1,12}(?:\.\d{1,6})?$/.test(length)) throw new Error('长度格式不正确')
        payload.length = length ? `${length},${lineForm.lengthUnit}` : null
      }
    }
  }
  return payload
}

async function saveEditor() {
  const mode = editor.value
  if (!mode || !bill.value || busy.value || pickingProducts.value) return
  editorError.value = ''
  if (needsPreview.value && !currentPreview.value?.can_submit) {
    editorError.value = '请先通过冲减预计算'
    return
  }
  saving.value = true
  const base = { bill_id: billId, expected_version: editorVersion.value }
  const options = { silent: true }
  try {
    let result: ApiResponse<NativeWriteResult | NativeBatchResult>
    if (mode === 'header') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(headerDate.value)) throw new Error('请填写单据日期')
      const payload = { ...base, bill_date: headerDate.value, remark: headerRemark.value.trim() }
      result = await updateNativeBillHeader(docKey, { ...payload, request_id: request.id([mode, payload]) }, options)
    } else if (mode === 'add') {
      const invalid = draftError(drafts.value, isReturn)
      if (invalid) throw new Error(invalid)
      const payload = { ...base, items: draftPayload(drafts.value, isReturn, isPicking), expected_source_version: currentPreview.value?.source_version }
      result = await appendNativeItems(docKey, { ...payload, request_id: request.id([mode, payload]) }, options)
    } else {
      const row = line.value
      if (!row) return
      const target = { item_id: row.item_id, expected_item_version: row.version }
      if (mode === 'remove') {
        const payload = { ...base, items: [target] }
        result = await deleteNativeItems(docKey, { ...payload, request_id: request.id([mode, payload]) }, options)
      } else {
        const updates = editFields(row)
        if (!Object.keys(updates).length) { editor.value = null; return }
        const expectedSourceVersion = currentPreview.value?.source_version ?? sourceVersion.value
        if (isReturn && updates.return_qty !== undefined && expectedSourceVersion === undefined) {
          throw new Error('未取得来源领料单版本，请重新打开明细后重试')
        }
        const payload = { ...base, items: [{ ...target, ...updates }], expected_source_version: expectedSourceVersion }
        result = await updateNativeItems(docKey, { ...payload, request_id: request.id([mode, payload]) }, options)
      }
    }
    request.clear()
    editor.value = null
    if (!isReplayed(result.data)) ElMessage.success(result.message)
    await load()
  } catch (err) {
    const info = nativeError(err)
    editorError.value = info.message
    if (mode === 'remove' && info.code !== 'VERSION_CONFLICT') {
      editor.value = null
      showErrorDialog(info.message)
    } else if (info.code === 'VERSION_CONFLICT') {
      editor.value = null
      showErrorDialog(info.message)
      await load()
    }
  } finally {
    saving.value = false
  }
}

onMounted(load)
onActivated(() => { if (!loading.value && !editor.value && !selectedAction.value) void load() })
</script>

<style scoped>
.bill-detail { display: flex; flex-direction: column; gap: 12px; }
.page-header, .section-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.page-header { background: var(--el-bg-color); padding: 12px 16px; }
.header-title, .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.actions :deep(.el-button + .el-button) { margin-left: 0; }
.header-title h2 { margin: 0; font-size: 18px; }
.page-body { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.page-body :deep(.el-card__header) { font-weight: 600; }
.page-body :deep(.el-descriptions__label),
.page-body :deep(.el-descriptions__content) { font-size: var(--font-table); }
.summary { display: flex; flex-wrap: wrap; gap: 10px 24px; padding: 0 0 12px; color: var(--el-text-color-secondary); }
.summary strong { color: var(--el-text-color-primary); margin-left: 4px; }
.blockers { display: grid; gap: 8px; margin-top: 12px; }
.item-filter { width: 220px; }
.length-entry { display: grid; grid-template-columns: minmax(0, 1fr) 66px; gap: 6px; }
.line-edit-feedback { margin-block: 8px; }
.line-edit-preview { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
.line-edit-preview > .el-button { justify-self: start; }
</style>

<style>
.native-stockin-add-dialog .el-dialog__header { border-bottom: 1px solid var(--el-border-color-lighter); padding-bottom: 16px; }
.native-stockin-add-dialog .inline-product-actions { border-top: 1px solid var(--el-border-color-lighter); margin-top: 16px; }
.native-stockin-add-dialog .inline-product-actions .selected-count { margin-right: 8px; }
.native-stockin-product-dialog { height: 730px; max-height: 90vh; margin-top: 5vh !important; display: flex; flex-direction: column; }
.native-stockin-product-dialog .el-dialog__body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.native-stockin-product-dialog .el-dialog__body > div { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.native-stockin-product-dialog .inline-product-selector { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.native-stockin-product-dialog .inline-product-selector .el-table { flex: 1; min-height: 0; }
</style>
