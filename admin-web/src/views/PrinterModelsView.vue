<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import {
  createPrinterLabelSpec,
  createPrinterModel,
  deletePrinterLabelSpec,
  deletePrinterModel,
  queryPrinterLabelSpecs,
  queryPrinterModels,
  searchPrinterModels,
  updatePrinterLabelSpec,
  updatePrinterModel,
  type PrinterLabelSpecPayload,
  type PrinterLabelSpecRow,
  type PrinterModelPayload,
  type PrinterModelRow,
} from '@/api/platformPrinters'

const PRINT_MODE_OPTIONS = ['热敏', '热转印']
const LABEL_TYPE_OPTIONS = ['间隙纸', '黑标纸', '连续纸', '透明纸', '黑标间隙纸']
const CONNECTION_OPTIONS = ['USB', 'WiFi', '蓝牙']
const MODEL_SORT_FIELDS = [
  ['created_at', '创建时间'], ['updated_at', '更新时间'], ['model_name', '型号名称'], ['brand', '品牌'],
]

/* —— 型号列表 —— */
const loading = ref(false)
const rows = ref<PrinterModelRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filters = reactive({ model_name: '', brand: '', sort_by: 'created_at', sort_order: 'DESC' })

/* —— 型号表单 —— */
const modelDialogOpen = ref(false)
const modelSaving = ref(false)
const editingModelCode = ref('')
const modelForm = reactive<PrinterModelPayload>({
  model_name: '', brand: '精臣',
  supported_print_modes: ['热敏'], supported_label_types: ['间隙纸'], connection_types: ['USB'],
  density_min: 1, density_max: 5, density_default: 3,
  dpi: 203, has_preview_capability: 1, status: 1, remark: '',
})
const modelDialogTitle = computed(() => (editingModelCode.value ? '编辑打印机型号' : '新增打印机型号'))

/* —— 标签规格 —— */
const specDrawerOpen = ref(false)
const specLoading = ref(false)
const specRows = ref<PrinterLabelSpecRow[]>([])
const specTotal = ref(0)
const currentModel = ref<PrinterModelRow | null>(null)
const specDialogOpen = ref(false)
const specSaving = ref(false)
const editingSpecId = ref('')
const specForm = reactive({ spec_name: '', width_mm: 50, height_mm: 30, is_default: 0, status: 1 })
const specDialogTitle = computed(() => (editingSpecId.value ? '编辑标签规格' : '新增标签规格'))

function joinList(value?: string[]) {
  return value?.length ? value.join('、') : '—'
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function load() {
  loading.value = true
  try {
    const name = filters.model_name.trim()
    const brand = filters.brand.trim()
    const common = { page: page.value, page_size: pageSize, sort_by: filters.sort_by, sort_order: filters.sort_order }
    const searchField: string[] = []
    const searchValue: Record<string, string> = {}
    if (name) { searchField.push('model_name'); searchValue.model_name = name }
    if (brand) { searchField.push('brand'); searchValue.brand = brand }
    const data = searchField.length
      ? await searchPrinterModels({ ...common, search_field: searchField, search_value: searchValue })
      : await queryPrinterModels(common)
    rows.value = data.list
    total.value = data.total
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(errorMessage(error, '打印机型号加载失败'))
  } finally {
    loading.value = false
  }
}

function applyFilters() { page.value = 1; load() }
function resetFilters() {
  Object.assign(filters, { model_name: '', brand: '', sort_by: 'created_at', sort_order: 'DESC' })
  applyFilters()
}
function changePage(next: number) { page.value = next; load() }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—' }

function openCreateModel() {
  editingModelCode.value = ''
  Object.assign(modelForm, {
    model_name: '', brand: '精臣',
    supported_print_modes: ['热敏'], supported_label_types: ['间隙纸'], connection_types: ['USB'],
    density_min: 1, density_max: 5, density_default: 3,
    dpi: 203, has_preview_capability: 1, status: 1, remark: '',
  })
  modelDialogOpen.value = true
}

function openEditModel(row: PrinterModelRow) {
  editingModelCode.value = row.model_code
  Object.assign(modelForm, {
    model_name: row.model_name, brand: row.brand,
    supported_print_modes: [...(row.supported_print_modes || [])],
    supported_label_types: [...(row.supported_label_types || [])],
    connection_types: [...(row.connection_types || [])],
    density_min: row.density_min, density_max: row.density_max, density_default: row.density_default,
    dpi: row.dpi, has_preview_capability: row.has_preview_capability, status: row.status, remark: row.remark || '',
  })
  modelDialogOpen.value = true
}

/** 后端会重复校验，这里先做同规则前置校验以减少无效请求 */
function validateModelForm(): string | null {
  if (!modelForm.model_name.trim()) return '型号名称不能为空'
  if (!modelForm.brand.trim()) return '品牌不能为空'
  if (!modelForm.supported_print_modes.length) return '支持的打印模式不能为空'
  if (!modelForm.supported_label_types.length) return '支持的纸张类型不能为空'
  if (!modelForm.connection_types.length) return '支持的连接方式不能为空'
  if (modelForm.density_min <= 0) return '浓度最小值必须大于 0'
  if (modelForm.density_min > modelForm.density_max) return '浓度最小值不能大于浓度最大值'
  if (modelForm.density_default < modelForm.density_min || modelForm.density_default > modelForm.density_max) {
    return '默认浓度值必须位于最小浓度与最大浓度之间'
  }
  if (modelForm.dpi <= 0) return '打印分辨率必须大于 0'
  return null
}

async function submitModel() {
  const invalid = validateModelForm()
  if (invalid) { ElMessage.warning(invalid); return }
  modelSaving.value = true
  try {
    const payload: PrinterModelPayload = {
      ...modelForm,
      model_name: modelForm.model_name.trim(),
      brand: modelForm.brand.trim(),
      remark: modelForm.remark?.trim() || '',
    }
    if (editingModelCode.value) {
      await updatePrinterModel(editingModelCode.value, payload)
      ElMessage.success('打印机型号更新成功')
    } else {
      await createPrinterModel(payload)
      ElMessage.success('打印机型号创建成功')
    }
    modelDialogOpen.value = false
    load()
  } catch (error) {
    ElMessage.error(errorMessage(error, '打印机型号保存失败'))
  } finally {
    modelSaving.value = false
  }
}

async function removeModel(row: PrinterModelRow) {
  const specCount = row.label_spec_count ?? 0
  const tip = specCount > 0
    ? `删除型号「${row.model_name}」会同时删除其下 ${specCount} 个标签规格，确认继续？`
    : `确认删除型号「${row.model_name}」？`
  try {
    await ElMessageBox.confirm(tip, '删除确认', { type: 'warning', confirmButtonText: '确认删除' })
  } catch {
    return
  }
  try {
    const data = await deletePrinterModel(row.model_code)
    ElMessage.success(data.deleted_label_specs_count > 0
      ? `删除成功，同时删除 ${data.deleted_label_specs_count} 个标签规格`
      : '删除成功')
    load()
  } catch (error) {
    ElMessage.error(errorMessage(error, '打印机型号删除失败'))
  }
}

async function loadSpecs() {
  if (!currentModel.value) return
  specLoading.value = true
  try {
    const data = await queryPrinterLabelSpecs(currentModel.value.model_code)
    specRows.value = data.list
    specTotal.value = data.total
  } catch (error) {
    specRows.value = []
    specTotal.value = 0
    ElMessage.error(errorMessage(error, '标签规格加载失败'))
  } finally {
    specLoading.value = false
  }
}

function openSpecs(row: PrinterModelRow) {
  currentModel.value = row
  specDrawerOpen.value = true
  loadSpecs()
}

function openCreateSpec() {
  editingSpecId.value = ''
  Object.assign(specForm, { spec_name: '', width_mm: 50, height_mm: 30, is_default: 0, status: 1 })
  specDialogOpen.value = true
}

function openEditSpec(row: PrinterLabelSpecRow) {
  editingSpecId.value = row.spec_id
  Object.assign(specForm, {
    spec_name: row.spec_name,
    width_mm: Number(row.width_mm),
    height_mm: Number(row.height_mm),
    is_default: row.is_default,
    status: row.status,
  })
  specDialogOpen.value = true
}

async function submitSpec() {
  if (!specForm.spec_name.trim()) { ElMessage.warning('规格名称不能为空'); return }
  if (Number(specForm.width_mm) <= 0 || Number(specForm.height_mm) <= 0) {
    ElMessage.warning('标签宽度和高度必须为正数')
    return
  }
  specSaving.value = true
  try {
    const payload: PrinterLabelSpecPayload = {
      spec_name: specForm.spec_name.trim(),
      width_mm: Number(specForm.width_mm),
      height_mm: Number(specForm.height_mm),
      is_default: specForm.is_default,
      status: specForm.status,
    }
    if (editingSpecId.value) {
      await updatePrinterLabelSpec(editingSpecId.value, payload)
      ElMessage.success('标签规格更新成功')
    } else {
      await createPrinterLabelSpec(currentModel.value!.model_code, payload)
      ElMessage.success('标签规格创建成功')
    }
    specDialogOpen.value = false
    loadSpecs()
    load()
  } catch (error) {
    ElMessage.error(errorMessage(error, '标签规格保存失败'))
  } finally {
    specSaving.value = false
  }
}

async function removeSpec(row: PrinterLabelSpecRow) {
  // 后端约束：每个型号必须保留至少一个有效规格
  const validCount = specRows.value.filter((item) => item.status === 1).length
  if (row.status === 1 && validCount <= 1) {
    ElMessage.warning('该型号必须保留至少一个有效标签规格，无法删除最后一个')
    return
  }
  try {
    await ElMessageBox.confirm(`确认删除标签规格「${row.spec_name}」？`, '删除确认', { type: 'warning', confirmButtonText: '确认删除' })
  } catch {
    return
  }
  try {
    const data = await deletePrinterLabelSpec(row.spec_id)
    ElMessage.success(data.new_default_spec_id ? '删除成功，默认规格已自动迁移' : '删除成功')
    loadSpecs()
    load()
  } catch (error) {
    ElMessage.error(errorMessage(error, '标签规格删除失败'))
  }
}

onMounted(load)
</script>

<template>
  <div class="page-stack">
    <PageHeader
      eyebrow="PRINTER CONFIG"
      title="打印机配置"
      description="维护标签打印机型号参数与标签规格，配置将下发给全部租客员工查看使用。"
      marker="PLATFORM"
    />

    <section class="filter-deck">
      <div class="filter-deck__head">
        <div><span class="mono-label">QUERY CONTROL</span><h2>查询条件</h2></div>
        <div class="filter-actions">
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" :loading="loading" @click="applyFilters">查询型号</el-button>
        </div>
      </div>
      <div class="filter-grid">
        <label><span>型号名称</span><el-input v-model="filters.model_name" clearable placeholder="模糊匹配型号名称" @keyup.enter="applyFilters" /></label>
        <label><span>品牌</span><el-input v-model="filters.brand" clearable placeholder="模糊匹配品牌" @keyup.enter="applyFilters" /></label>
        <label><span>排序字段</span><el-select v-model="filters.sort_by"><el-option v-for="item in MODEL_SORT_FIELDS" :key="item[0]" :label="item[1]" :value="item[0]" /></el-select></label>
        <label><span>排序方向</span><el-segmented v-model="filters.sort_order" :options="[{ label: '降序', value: 'DESC' }, { label: '升序', value: 'ASC' }]" /></label>
      </div>
    </section>

    <section class="data-panel">
      <div class="data-panel__head">
        <div><span class="mono-label">PRINTER MODELS</span><h2>打印机型号</h2></div>
        <div class="panel-head-actions">
          <span class="record-count"><strong>{{ total }}</strong> 个型号</span>
          <el-button type="primary" @click="openCreateModel">新增型号</el-button>
        </div>
      </div>
      <el-table v-loading="loading" :data="rows" stripe table-layout="fixed" empty-text="暂无打印机型号，点击「新增型号」开始配置">
        <el-table-column prop="model_name" label="型号名称" min-width="170" show-overflow-tooltip />
        <el-table-column prop="brand" label="品牌" width="86" />
        <el-table-column label="打印模式" width="104"><template #default="scope">{{ joinList(scope.row.supported_print_modes) }}</template></el-table-column>
        <el-table-column label="纸张类型" min-width="180" show-overflow-tooltip><template #default="scope">{{ joinList(scope.row.supported_label_types) }}</template></el-table-column>
        <el-table-column label="连接方式" width="112"><template #default="scope">{{ joinList(scope.row.connection_types) }}</template></el-table-column>
        <el-table-column label="浓度范围" width="126" align="center"><template #default="scope"><span class="mono-label">{{ scope.row.density_min }}–{{ scope.row.density_max }} / {{ scope.row.density_default }}</span></template></el-table-column>
        <el-table-column label="分辨率" width="88" align="center"><template #default="scope"><span class="mono-label">{{ scope.row.dpi }} DPI</span></template></el-table-column>
        <el-table-column label="预览能力" width="92" align="center"><template #default="scope"><span class="status-pill" :class="scope.row.has_preview_capability === 1 ? 'is-success' : 'is-muted'">{{ scope.row.has_preview_capability === 1 ? '支持' : '不支持' }}</span></template></el-table-column>
        <el-table-column label="标签规格" width="92" align="center"><template #default="scope"><el-button link type="primary" @click="openSpecs(scope.row)">{{ scope.row.label_spec_count ?? 0 }} 个</el-button></template></el-table-column>
        <el-table-column label="状态" width="80" align="center"><template #default="scope"><span class="status-pill" :class="scope.row.status === 1 ? 'is-success' : 'is-danger'">{{ scope.row.status === 1 ? '启用' : '停用' }}</span></template></el-table-column>
        <el-table-column label="创建时间" width="150"><template #default="scope">{{ formatDate(scope.row.created_at) }}</template></el-table-column>
        <el-table-column label="操作" width="168" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="openSpecs(scope.row)">规格</el-button>
            <el-button link type="primary" @click="openEditModel(scope.row)">编辑</el-button>
            <el-button link type="danger" @click="removeModel(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-bar">
        <span>型号删除后其下标签规格将一并失效</span>
        <el-pagination background layout="prev, pager, next" :page-size="pageSize" :total="total" :current-page="page" @current-change="changePage" />
      </div>
    </section>

    <el-dialog v-model="modelDialogOpen" :title="modelDialogTitle" width="720px" :close-on-click-modal="false">
      <el-form label-position="top" class="dense-form">
        <div class="form-row">
          <el-form-item label="型号名称" required><el-input v-model="modelForm.model_name" maxlength="100" placeholder="例如：精臣B3S标签打印机" /></el-form-item>
          <el-form-item label="品牌" required><el-input v-model="modelForm.brand" maxlength="50" placeholder="例如：精臣" /></el-form-item>
        </div>
        <div class="form-row">
          <el-form-item label="支持的打印模式" required>
            <el-select v-model="modelForm.supported_print_modes" multiple filterable allow-create placeholder="选择或输入打印模式">
              <el-option v-for="item in PRINT_MODE_OPTIONS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="支持的连接方式" required>
            <el-select v-model="modelForm.connection_types" multiple filterable allow-create placeholder="选择或输入连接方式">
              <el-option v-for="item in CONNECTION_OPTIONS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="支持的纸张类型" required>
          <el-select v-model="modelForm.supported_label_types" multiple filterable allow-create placeholder="选择或输入纸张类型">
            <el-option v-for="item in LABEL_TYPE_OPTIONS" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <div class="form-row form-row--triple">
          <el-form-item label="浓度最小值" required><el-input-number v-model="modelForm.density_min" :min="1" controls-position="right" /></el-form-item>
          <el-form-item label="浓度最大值" required><el-input-number v-model="modelForm.density_max" :min="1" controls-position="right" /></el-form-item>
          <el-form-item label="默认浓度值" required><el-input-number v-model="modelForm.density_default" :min="1" controls-position="right" /></el-form-item>
        </div>
        <div class="form-row form-row--triple">
          <el-form-item label="打印分辨率(DPI)" required><el-input-number v-model="modelForm.dpi" :min="1" controls-position="right" /></el-form-item>
          <el-form-item label="预览能力"><el-switch v-model="modelForm.has_preview_capability" :active-value="1" :inactive-value="0" inline-prompt active-text="支持" inactive-text="不支持" /></el-form-item>
          <el-form-item label="启用状态"><el-switch v-model="modelForm.status" :active-value="1" :inactive-value="0" inline-prompt active-text="启用" inactive-text="停用" /></el-form-item>
        </div>
        <el-form-item label="备注"><el-input v-model="modelForm.remark" type="textarea" :rows="3" maxlength="500" placeholder="选填" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="modelDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="modelSaving" @click="submitModel">保存型号</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="specDrawerOpen" size="720px" class="detail-drawer">
      <template #header>
        <div class="tenant-drawer-title">
          <span class="mono-label">LABEL SPECS</span>
          <h3>{{ currentModel?.model_name }} · 标签规格</h3>
        </div>
      </template>
      <div class="spec-drawer-body">
        <div class="spec-drawer-actions">
          <span class="record-count"><strong>{{ specTotal }}</strong> 个规格</span>
          <el-button type="primary" @click="openCreateSpec">新增规格</el-button>
        </div>
        <el-table v-loading="specLoading" :data="specRows" stripe table-layout="fixed" empty-text="该型号暂无标签规格">
          <el-table-column prop="spec_name" label="规格名称" min-width="140" show-overflow-tooltip />
          <el-table-column label="标签宽度" width="100" align="center"><template #default="scope"><span class="mono-label">{{ scope.row.width_mm }} mm</span></template></el-table-column>
          <el-table-column label="标签高度" width="100" align="center"><template #default="scope"><span class="mono-label">{{ scope.row.height_mm }} mm</span></template></el-table-column>
          <el-table-column label="默认规格" width="92" align="center"><template #default="scope"><span class="status-pill" :class="scope.row.is_default === 1 ? 'is-info' : 'is-muted'">{{ scope.row.is_default === 1 ? '默认' : '否' }}</span></template></el-table-column>
          <el-table-column label="状态" width="80" align="center"><template #default="scope"><span class="status-pill" :class="scope.row.status === 1 ? 'is-success' : 'is-danger'">{{ scope.row.status === 1 ? '启用' : '停用' }}</span></template></el-table-column>
          <el-table-column label="操作" width="118" fixed="right">
            <template #default="scope">
              <el-button link type="primary" @click="openEditSpec(scope.row)">编辑</el-button>
              <el-button link type="danger" @click="removeSpec(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <p class="spec-drawer-hint">同一型号下规格名称与标签尺寸均需唯一，且必须保留至少一个有效规格。</p>
      </div>
    </el-drawer>

    <el-dialog v-model="specDialogOpen" :title="specDialogTitle" width="560px" :close-on-click-modal="false">
      <el-form label-position="top" class="dense-form">
        <el-form-item label="规格名称" required><el-input v-model="specForm.spec_name" maxlength="100" placeholder="例如：50x30mm" /></el-form-item>
        <div class="form-row">
          <el-form-item label="标签宽度(mm)" required><el-input-number v-model="specForm.width_mm" :min="0.01" :precision="2" :step="1" controls-position="right" /></el-form-item>
          <el-form-item label="标签高度(mm)" required><el-input-number v-model="specForm.height_mm" :min="0.01" :precision="2" :step="1" controls-position="right" /></el-form-item>
        </div>
        <div class="form-row">
          <el-form-item label="设为默认规格"><el-switch v-model="specForm.is_default" :active-value="1" :inactive-value="0" inline-prompt active-text="默认" inactive-text="普通" /></el-form-item>
          <el-form-item label="启用状态"><el-switch v-model="specForm.status" :active-value="1" :inactive-value="0" inline-prompt active-text="启用" inactive-text="停用" /></el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="specDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="specSaving" @click="submitSpec">保存规格</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.panel-head-actions { display: flex; align-items: center; gap: 16px; }
.spec-drawer-body { display: grid; gap: 16px; }
.spec-drawer-actions { display: flex; align-items: center; justify-content: space-between; }
.spec-drawer-hint { margin: 0; color: #8795a4; font-size: 12px; }
.form-row--triple { grid-template-columns: repeat(3, minmax(0, 1fr)); }
</style>
