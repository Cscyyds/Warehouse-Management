<template>
  <div class="ext-item-no-panel">
    <div class="panel-toolbar">
      <div class="product-chip">
        <span class="chip-tag">当前产品</span>
        <span class="chip-name" :title="productName">{{ productName || '-' }}</span>
        <el-divider direction="vertical" />
        <span>{{ productCode || '-' }}</span>
        <template v-if="itemNo">
          <el-divider direction="vertical" />
          <span>货号：{{ itemNo }}</span>
        </template>
      </div>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜品号 / 持有人 / 备注" clearable :prefix-icon="Search" class="keyword-input" />
        <el-button v-if="!readonly" v-perm="'POST /api/v1/tenant-products/external-item-nos/create'" type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>绑定外部品号
        </el-button>
      </div>
    </div>

    <el-table border :data="pagedRows" stripe size="small" style="width:100%" v-loading="loading" @sort-change="handleSortChange">
      <el-table-column type="index" :index="rowIndex" label="" width="55" align="center" />
      <el-table-column prop="external_item_no" label="外部品号" min-width="160" show-overflow-tooltip sortable="custom" />
      <el-table-column prop="holder" label="持有人" min-width="140" show-overflow-tooltip sortable="custom" />
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip>
        <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="170" sortable="custom" show-overflow-tooltip>
        <template #default="{ row }">{{ formatTableDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column v-if="!readonly" label="操作" :width="global_opt_width" align="center">
        <template #default="{ row }">
          <el-button v-perm="'POST /api/v1/tenant-products/external-item-nos/update'" link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button v-perm="'POST /api/v1/tenant-products/external-item-nos/delete'" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty v-if="permissionDenied" description="暂无外部品号查看权限，请联系管理员开通" :image-size="72" />
        <el-empty v-else-if="loadFailed" description="外部品号加载失败" :image-size="72">
          <el-button size="small" type="primary" plain @click="loadRows">重新加载</el-button>
        </el-empty>
        <el-empty v-else-if="!productCode" description="产品信息加载中，就绪后自动查询" :image-size="72" />
        <el-empty v-else description="该产品暂无外部品号" :image-size="72" />
      </template>
    </el-table>
    <div v-if="filteredRows.length > pagination.pageSize" class="panel-pagination">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="filteredRows.length"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        background
      />
    </div>
  </div>

  <!-- 绑定外部品号：产品固定为当前编辑的产品，仅批量录入品号/持有人/备注 -->
  <el-dialog v-model="createDialog.visible" title="绑定外部品号" width="760px" :close-on-click-modal="false" destroy-on-close>
    <el-form label-position="top">
      <el-form-item label="绑定产品">
        <div class="product-chip">
          <span class="chip-name">{{ productName || '-' }}</span>
          <el-divider direction="vertical" />
          <span>{{ productCode || '-' }}</span>
          <template v-if="itemNo">
            <el-divider direction="vertical" />
            <span>货号：{{ itemNo }}</span>
          </template>
        </div>
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
      <el-table-column label="备注" min-width="180">
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
      <span class="add-row-tip">同一产品下「外部品号 + 持有人」组合不可重复</span>
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
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import {
  getExternalItemNoList,
  searchExternalItemNos,
  createExternalItemNos,
  updateExternalItemNos,
  deleteExternalItemNo,
  type ExternalItemNoItem,
  type ExternalItemNoListResponse,
} from '@/api'
import { fetchAllPages } from '@/api/utils/fetchAllPages'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'

defineOptions({ name: 'ProductExternalItemNoPanel' })

const props = withDefaults(defineProps<{
  /** 当前产品业务ID（prd_） */
  productId: string
  /** 当前产品编码：search 接口无 product_id 维度，用 product_code LIKE 做服务端预过滤 */
  productCode: string
  productName?: string
  itemNo?: string
  /** 只读详情态：隐藏全部维护入口 */
  readonly?: boolean
}>(), {
  productName: '',
  itemNo: '',
  readonly: false,
})

/* —— 数据加载：search(product_code) 预过滤 + 前端按 product_id 精确过滤 ——
 * search 的产品维度是 LIKE 匹配，可能命中编码含当前编码子串的其他产品，
 * 因此拿到结果后必须按 product_id 等值过滤，保证只展示当前产品的绑定记录。 */
const allRows = ref<ExternalItemNoItem[]>([])
const loading = ref(false)
const loadFailed = ref(false)
const permissionDenied = ref(false)

function pickOwn(rows: ExternalItemNoItem[] | undefined | null): ExternalItemNoItem[] {
  return (rows || []).filter(r => r.product_id === props.productId)
}

async function fetchBySearch(): Promise<ExternalItemNoItem[]> {
  const res = await fetchAllPages<ExternalItemNoListResponse, ExternalItemNoItem>({
    fetchPage: ({ page, page_size }) => searchExternalItemNos({
      page,
      page_size,
      search_field: JSON.stringify(['product_code']),
      search_value: JSON.stringify({ product_code: props.productCode.trim() }),
    }, { silent: true }),
    pick: data => data.external_item_nos,
    assign: (data, items) => { data.external_item_nos = items },
  })
  return pickOwn(res.data.external_item_nos)
}

/** search 不可用（如无该接口权限）时降级：全量分页拉取后前端过滤 */
async function fetchByQueryAll(): Promise<ExternalItemNoItem[]> {
  const res = await fetchAllPages<ExternalItemNoListResponse, ExternalItemNoItem>({
    fetchPage: ({ page, page_size }) => getExternalItemNoList({ page, page_size }, { silent: true }),
    pick: data => data.external_item_nos,
    assign: (data, items) => { data.external_item_nos = items },
  })
  return pickOwn(res.data.external_item_nos)
}

async function loadRows() {
  if (!props.productId || !props.productCode) return
  loading.value = true
  loadFailed.value = false
  permissionDenied.value = false
  try {
    allRows.value = await fetchBySearch()
  } catch {
    try {
      allRows.value = await fetchByQueryAll()
    } catch (queryErr: any) {
      allRows.value = []
      // 两个查询口都失败：403 视为无查看权限（静默展示提示，不弹全局错误），
      // 其余视为加载失败（提供重试入口）
      permissionDenied.value = queryErr?.response?.status === 403
      loadFailed.value = !permissionDenied.value
    }
  } finally {
    loading.value = false
    pagination.page = 1
  }
}

watch(() => [props.productId, props.productCode] as const, () => { void loadRows() }, { immediate: true })

/* —— 客户端关键字过滤 / 排序 / 分页（单产品记录量小，均在内存完成） —— */
const keyword = ref('')
const pagination = reactive({ page: 1, pageSize: 20 })
const sortState = reactive<{ prop: string; order: 'ascending' | 'descending' | null }>({ prop: '', order: null })

const filteredRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  let rows = allRows.value
  if (kw) {
    rows = rows.filter(r =>
      (r.external_item_no || '').toLowerCase().includes(kw) ||
      (r.holder || '').toLowerCase().includes(kw) ||
      (r.remark || '').toLowerCase().includes(kw))
  }
  const { prop, order } = sortState
  if (prop && order) {
    const dir = order === 'ascending' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      const va = String((a as Record<string, unknown>)[prop] ?? '')
      const vb = String((b as Record<string, unknown>)[prop] ?? '')
      // 品号/持有人走中文友好排序；创建时间为 ISO 串，字典序即时间序
      return prop === 'created_at' ? va.localeCompare(vb) * dir : va.localeCompare(vb, 'zh-CN') * dir
    })
  }
  return rows
})

const pagedRows = computed(() =>
  filteredRows.value.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize))

function rowIndex(idx: number): number {
  return (pagination.page - 1) * pagination.pageSize + idx + 1
}

function handleSortChange({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  sortState.prop = prop || ''
  sortState.order = order || null
  pagination.page = 1
}

watch(keyword, () => { pagination.page = 1 })

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

/* —— 绑定（批量新增，产品固定为当前产品） —— */
interface CreateRow { external_item_no: string; holder: string; remark: string }
const createDialog = reactive<{ visible: boolean; rows: CreateRow[] }>({ visible: false, rows: [] })
const submitting = ref(false)
const rowErrors = ref<Record<number, { external_item_no?: string; holder?: string; remark?: string }>>({})

function blankRow(): CreateRow { return { external_item_no: '', holder: '', remark: '' } }

function openCreate() {
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
  if (!validateCreateRows()) { ElMessage.warning('请先修正表格中标红的行'); return }
  submitting.value = true
  batchError.value = null
  try {
    const items = createDialog.rows.map(row => ({
      external_item_no: row.external_item_no.trim(),
      holder: row.holder.trim(),
      remark: row.remark.trim() || null,
    }))
    const res = await createExternalItemNos(props.productId, items, { silent: true })
    ElMessage.success(`成功绑定 ${res.data.created_count} 条外部品号`)
    createDialog.visible = false
    pagination.page = 1
    loadRows()
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
    loadRows()
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
    loadRows()
  } catch {}
}
</script>

<style scoped>
.product-chip { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; color: var(--text-secondary); }
.chip-tag {
  flex-shrink: 0;
  padding: 1px 8px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-page);
}
.chip-name { color: var(--text-primary); font-weight: 600; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.toolbar-right { display: flex; align-items: center; gap: 8px; }
.keyword-input { width: 200px; }
.cell-empty { color: var(--text-tertiary); }
.panel-pagination { display: flex; justify-content: flex-end; margin-top: 12px; }
.add-row-bar { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
.add-row-tip { color: var(--text-tertiary); font-size: 12px; }
.row-error { color: var(--el-color-danger); font-size: 12px; line-height: 1.4; margin-top: 2px; }
:deep(.is-row-error .el-input__wrapper) { box-shadow: 0 0 0 1px var(--el-color-danger) inset; }
</style>
