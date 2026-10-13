<template>
  <ListTemplate
    title="外部品号"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    @page-change="loadData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="外部品号"><el-input v-model="searchForm.external_item_no" placeholder="请输入" clearable style="width:150px" /></el-form-item>
        <el-form-item label="持有人"><el-input v-model="searchForm.holder" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="searchForm.remark" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item label="产品编码"><el-input v-model="searchForm.product_code" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品名称"><el-input v-model="searchForm.product_name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="货号"><el-input v-model="searchForm.item_no" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button v-perm="'POST /api/v1/tenant-products/external-item-nos/create'" type="primary" @click="openCreate"><el-icon><Plus /></el-icon>绑定外部品号</el-button>
    </template>
    <template #table>
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" v-loading="loading" @sort-change="handleSortChange">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" fixed="left" />
        <el-table-column prop="external_item_no" label="外部品号" min-width="150" show-overflow-tooltip sortable="custom" fixed="left" />
        <el-table-column prop="holder" label="持有人" min-width="130" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="product_code" label="产品编码" min-width="160" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.product_code }">{{ row.product_code || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="product_name" label="产品名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.product_name }">{{ row.product_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="item_no" label="货号" min-width="130" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.item_no }">{{ row.item_no || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button v-perm="'POST /api/v1/tenant-products/external-item-nos/update'" link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button v-perm="'POST /api/v1/tenant-products/external-item-nos/delete'" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <!-- 绑定外部品号：先选产品，再批量录入品号/持有人/备注 -->
  <el-dialog v-model="createDialog.visible" title="绑定外部品号" width="860px" :close-on-click-modal="false" destroy-on-close>
    <!-- 标签顶部对齐：水平 label-width 对四字标签+必填星号太紧，「品」会换行被表格盖住 -->
    <el-form label-position="top">
      <el-form-item label="绑定产品" required>
        <div v-if="createDialog.product" class="product-chip">
          <span>{{ createDialog.product.product_name }}</span>
          <el-divider direction="vertical" />
          <span>{{ createDialog.product.product_code }}</span>
          <template v-if="createDialog.product.item_no">
            <el-divider direction="vertical" />
            <span>货号：{{ createDialog.product.item_no }}</span>
          </template>
          <el-button link type="primary" size="small" @click="productDialog = true">重选</el-button>
        </div>
        <el-button v-else @click="productDialog = true"><el-icon><Search /></el-icon>选择产品</el-button>
      </el-form-item>
    </el-form>
    <el-table border :data="createDialog.rows" size="small" style="width:100%">
      <el-table-column type="index" label="#" width="48" align="center" />
      <el-table-column label="外部品号" min-width="180">
        <template #default="{ row, $index }">
          <el-input v-model="row.external_item_no" :class="{ 'is-row-error': rowErrors[$index]?.external_item_no }" maxlength="64" placeholder="必填，≤64字符" @input="clearRowError($index, 'external_item_no')" />
          <div v-if="rowErrors[$index]?.external_item_no" class="row-error">{{ rowErrors[$index].external_item_no }}</div>
        </template>
      </el-table-column>
      <el-table-column label="持有人" min-width="150">
        <template #default="{ row, $index }">
          <el-input v-model="row.holder" :class="{ 'is-row-error': rowErrors[$index]?.holder }" maxlength="64" placeholder="必填，≤64字符" @input="clearRowError($index, 'holder')" />
          <div v-if="rowErrors[$index]?.holder" class="row-error">{{ rowErrors[$index].holder }}</div>
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="200">
        <template #default="{ row, $index }">
          <el-input v-model="row.remark" maxlength="500" placeholder="选填，≤500字符" @input="clearRowError($index, 'remark')" />
          <div v-if="rowErrors[$index]?.remark" class="row-error">{{ rowErrors[$index].remark }}</div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="70" align="center">
        <template #default="{ $index }">
          <el-button link type="danger" size="small" :disabled="createDialog.rows.length <= 1" @click="removeCreateRow($index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="add-row-bar">
      <el-button size="small" @click="addCreateRow"><el-icon><Plus /></el-icon>添加一行</el-button>
      <span class="add-row-tip">同一产品下「外部品号 + 持有人」组合不可重复；同一外部品号绑到其他产品请分别绑定</span>
    </div>
    <el-alert v-if="batchError" type="error" :closable="false" show-icon>
      <template #title>{{ batchError.message }}</template>
      <div v-for="line in batchError.lines" :key="line">{{ line }}</div>
    </el-alert>
    <template #footer>
      <el-button @click="createDialog.visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitCreate">确认绑定</el-button>
    </template>
  </el-dialog>

  <!-- 编辑：产品不可换绑（后端限制），仅改品号/持有人/备注 -->
  <el-dialog v-model="editDialog.visible" title="编辑外部品号" width="560px" :close-on-click-modal="false" destroy-on-close>
    <el-descriptions v-if="editDialog.row" :column="1" border size="small" class="edit-product-info">
      <el-descriptions-item label="产品">{{ editDialog.row.product_name || '-' }}（{{ editDialog.row.product_code || '-' }}）</el-descriptions-item>
      <el-descriptions-item label="货号">{{ editDialog.row.item_no || '-' }}</el-descriptions-item>
    </el-descriptions>
    <el-form v-if="editDialog.row" :model="editDialog.form" label-position="top">
      <el-form-item label="外部品号" required>
        <el-input v-model="editDialog.form.external_item_no" maxlength="64" placeholder="必填，≤64字符" />
      </el-form-item>
      <el-form-item label="持有人" required>
        <el-input v-model="editDialog.form.holder" maxlength="64" placeholder="必填，≤64字符" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="editDialog.form.remark" type="textarea" :rows="2" maxlength="500" placeholder="清空即删除备注" />
      </el-form-item>
    </el-form>
    <el-alert v-if="batchError" type="error" :closable="false" show-icon>
      <template #title>{{ batchError.message }}</template>
      <div v-for="line in batchError.lines" :key="line">{{ line }}</div>
    </el-alert>
    <template #footer>
      <el-button @click="editDialog.visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitEdit">保存</el-button>
    </template>
  </el-dialog>

  <ProductSelectDialog v-model="productDialog" @confirm="onProductSelected" />
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import {
  getExternalItemNoList,
  searchExternalItemNos,
  createExternalItemNos,
  updateExternalItemNos,
  deleteExternalItemNo,
  type ExternalItemNoItem,
  type ExternalItemNoPageParams,
  type ProductItem,
} from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import ProductSelectDialog from './ProductSelectDialog.vue'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'

defineOptions({ name: 'ProductExternalItemNo' })

const tableData = ref<ExternalItemNoItem[]>([])
const loading = ref(false)
const searchForm = reactive({ external_item_no: '', holder: '', remark: '', product_code: '', product_name: '', item_no: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

/** 后端排序白名单：external_item_no/holder/created_at */
const SORTABLE_FIELDS: ReadonlySet<string> = new Set(['external_item_no', 'holder', 'created_at'])

function sortParams(): { sort_by?: ExternalItemNoPageParams['sort_by']; sort_order?: string } {
  const field = sortBy.value && SORTABLE_FIELDS.has(sortBy.value) ? sortBy.value : undefined
  return { sort_by: field as ExternalItemNoPageParams['sort_by'], sort_order: field ? sortOrder.value : undefined }
}

function hasSearchFilters(): boolean {
  return Object.values(searchForm).some(v => v.trim())
}

async function loadData() {
  loading.value = true
  try {
    const base = { page: pagination.page, page_size: pagination.pageSize, ...sortParams() }
    const res = hasSearchFilters()
      ? await searchExternalItemNos({
        ...base,
        search_field: JSON.stringify(Object.keys(searchForm).filter(k => searchForm[k as keyof typeof searchForm].trim())),
        search_value: JSON.stringify(Object.fromEntries(
          Object.entries(searchForm).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]),
        )),
      })
      : await getExternalItemNoList(base)
    tableData.value = res.data.external_item_nos || []
    pagination.total = res.data.total ?? 0
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { external_item_no: '', holder: '', remark: '', product_code: '', product_name: '', item_no: '' })
  handleSearch()
}

/* —— 批量驳回错误解析：后端 400 detail = {message, errors: [{index, label, errors}]} —— */
interface BatchError { message: string; lines: string[] }
const batchError = ref<BatchError | null>(null)

function extractBatchError(err: unknown): BatchError {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (detail && typeof detail === 'object' && Array.isArray((detail as { errors?: unknown }).errors)) {
    const d = detail as { message?: unknown; errors: Array<{ index?: number; label?: string; errors?: string[] }> }
    return {
      message: String(d.message || '部分数据校验失败，操作已全部取消'),
      lines: d.errors.map(e => `${e.label || `第${(e.index ?? 0) + 1}条`}：${(e.errors || []).join('；')}`),
    }
  }
  if (typeof detail === 'string' && detail) return { message: detail, lines: [] }
  return { message: (err as Error)?.message || '请求失败', lines: [] }
}

/* —— 绑定（批量新增） —— */
interface CreateRow { external_item_no: string; holder: string; remark: string }
const createDialog = reactive<{ visible: boolean; product: ProductItem | null; rows: CreateRow[] }>({
  visible: false, product: null, rows: [],
})
const productDialog = ref(false)
const submitting = ref(false)
const rowErrors = ref<Record<number, { external_item_no?: string; holder?: string; remark?: string }>>({})

function blankRow(): CreateRow { return { external_item_no: '', holder: '', remark: '' } }

function openCreate() {
  createDialog.product = null
  createDialog.rows = [blankRow()]
  rowErrors.value = {}
  batchError.value = null
  createDialog.visible = true
}

function addCreateRow() { createDialog.rows.push(blankRow()) }

function removeCreateRow(index: number) {
  createDialog.rows.splice(index, 1)
  rowErrors.value = {}
}

function clearRowError(index: number, field: 'external_item_no' | 'holder' | 'remark') {
  if (rowErrors.value[index]?.[field]) delete rowErrors.value[index]![field]
}

function onProductSelected(product: ProductItem) {
  createDialog.product = product
}

/** 行级预校验：必填/长度 + 批内「品号+持有人」组合去重（与后端口径一致，先拦一道省一次往返） */
function validateCreateRows(): boolean {
  rowErrors.value = {}
  const seen = new Map<string, number>()
  createDialog.rows.forEach((row, idx) => {
    const errs: { external_item_no?: string; holder?: string; remark?: string } = {}
    const no = row.external_item_no.trim()
    const holder = row.holder.trim()
    if (!no) errs.external_item_no = '请输入外部品号'
    if (!holder) errs.holder = '请输入持有人'
    if (no && holder) {
      const key = `${no}\u0001${holder}`
      if (seen.has(key)) errs.external_item_no = `与第${seen.get(key)! + 1}条的品号+持有人组合重复`
      else seen.set(key, idx)
    }
    if (Object.keys(errs).length) rowErrors.value[idx] = errs
  })
  return Object.keys(rowErrors.value).length === 0
}

async function submitCreate() {
  if (!createDialog.product) { ElMessage.warning('请先选择要绑定的产品'); return }
  if (!validateCreateRows()) { ElMessage.warning('请先修正表格中标红的行'); return }
  submitting.value = true
  batchError.value = null
  try {
    const items = createDialog.rows.map(row => ({
      external_item_no: row.external_item_no.trim(),
      holder: row.holder.trim(),
      remark: row.remark.trim() || null,
    }))
    const res = await createExternalItemNos(createDialog.product.product_id, items, { silent: true })
    ElMessage.success(`成功绑定 ${res.data.created_count} 条外部品号`)
    createDialog.visible = false
    pagination.page = 1
    loadData()
  } catch (err) {
    batchError.value = extractBatchError(err)
  } finally {
    submitting.value = false
  }
}

/* —— 编辑（单条，走批量接口） —— */
const editDialog = reactive<{ visible: boolean; row: ExternalItemNoItem | null; form: { external_item_no: string; holder: string; remark: string } }>({
  visible: false, row: null, form: { external_item_no: '', holder: '', remark: '' },
})

function openEdit(row: ExternalItemNoItem) {
  editDialog.row = row
  editDialog.form = { external_item_no: row.external_item_no || '', holder: row.holder || '', remark: row.remark || '' }
  batchError.value = null
  editDialog.visible = true
}

async function submitEdit() {
  if (!editDialog.row) return
  const no = editDialog.form.external_item_no.trim()
  const holder = editDialog.form.holder.trim()
  if (!no) { ElMessage.warning('请输入外部品号'); return }
  if (!holder) { ElMessage.warning('请输入持有人'); return }
  submitting.value = true
  batchError.value = null
  try {
    await updateExternalItemNos([{
      external_item_no_id: editDialog.row.external_item_no_id,
      external_item_no: no,
      holder,
      // 键存在且为 null = 清空备注（不传该键 = 保持原值）
      remark: editDialog.form.remark.trim() || null,
    }], { silent: true })
    ElMessage.success('保存成功')
    editDialog.visible = false
    loadData()
  } catch (err) {
    batchError.value = extractBatchError(err)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: ExternalItemNoItem) {
  try {
    await ElMessageBox.confirm(
      `确认删除外部品号「${row.external_item_no}」（持有人：${row.holder}）？`,
      '提示',
      { confirmButtonText: '确认删除', type: 'warning' },
    )
    await deleteExternalItemNo(row.external_item_no_id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
.product-chip { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.add-row-bar { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
.add-row-tip { color: var(--text-tertiary); font-size: 12px; }
.row-error { color: var(--el-color-danger); font-size: 12px; line-height: 1.4; margin-top: 2px; }
:deep(.is-row-error .el-input__wrapper) { box-shadow: 0 0 0 1px var(--el-color-danger) inset; }
.edit-product-info { margin-bottom: 16px; }
</style>
