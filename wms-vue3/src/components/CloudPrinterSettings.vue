<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { listCloudPrinters, saveCloudPrinter, deleteCloudPrinter, getCloudPrinterStatus, type CloudPrinter } from '@/api/modules/cloudPrint'
import { getVisiblePrinterList, getVisiblePrinterDetail, type PrinterModelItem, type PrinterLabelSpecItem } from '@/api/modules/printerModel'

const userStore = useUserStore()
void userStore.loadProfile()
const rows = ref<CloudPrinter[]>([])
const loading = ref(false)
const saving = ref(false)
const visible = ref(false)
const models = ref<PrinterModelItem[]>([])
const specs = ref<PrinterLabelSpecItem[]>([])
const emptyForm = () => ({ cloud_printer_id: '', name: '', sn: '', developer_user: '', ukey: '',
  printer_model_code: '', label_spec_id: '', qr_width_mm: 20, qr_height_mm: 20,
  qr_columns: 1 as 1 | 2, qr_row_width_mm: 20, status: 1 as 0 | 1 })
const form = reactive(emptyForm())
async function load() {
  loading.value = true
  try { rows.value = (await listCloudPrinters()).list } finally { loading.value = false }
}
async function edit(row?: CloudPrinter) {
  Object.assign(form, emptyForm(), row ? Object.fromEntries(Object.keys(emptyForm()).filter(key => key !== 'ukey').map(key => [key, row[key as keyof CloudPrinter]])) : {})
  specs.value = []
  visible.value = true
  try {
    const all: PrinterModelItem[] = []
    for (let page = 1; ; page++) {
      const result = (await getVisiblePrinterList({ page, page_size: 100 })).data
      all.push(...result.list)
      if (all.length >= result.total || !result.list.length) break
    }
    models.value = all.filter(model => model.brand === '芯烨')
    if (form.printer_model_code) await loadSpecs(form.printer_model_code, form.label_spec_id)
  } catch { /* API 已提示 */ }
}
async function loadSpecs(code: string, keep = '') {
  specs.value = []
  form.label_spec_id = ''
  if (!code) return
  const detail = (await getVisiblePrinterDetail(code)).data
  specs.value = detail.label_specs || []
  form.label_spec_id = specs.value.some(spec => spec.spec_id === keep) ? keep
    : (specs.value.find(spec => spec.is_default === 1) || specs.value[0])?.spec_id || ''
}
function adjustRowWidth() {
  form.qr_row_width_mm = form.qr_columns === 1 ? form.qr_width_mm : form.qr_width_mm * 2 + 4
}
async function save() {
  if (!form.name || !form.sn || !form.developer_user || !form.label_spec_id || (!form.cloud_printer_id && !form.ukey)) {
    ElMessage.warning('请填写设备名称、SN、开发者账号/密钥并选择条码规格'); return
  }
  saving.value = true
  try {
    await saveCloudPrinter({ ...form })
    form.ukey = ''
    visible.value = false
    ElMessage.success('云打印机已保存，网站和 PDA 刷新后即可选择')
    await load()
  } finally { saving.value = false }
}
async function remove(row: CloudPrinter) {
  try {
    await ElMessageBox.confirm(`删除云打印机「${row.name}」？`, '删除设备', { type: 'warning' })
    await deleteCloudPrinter(row.cloud_printer_id)
    await load()
  } catch { /* 取消或 API 已提示 */ }
}
async function status(row: CloudPrinter) {
  const result = await getCloudPrinterStatus(row.cloud_printer_id)
  ElMessage({ message: `${row.name}：${result.message}`, type: result.status === 1 ? 'success' : 'warning' })
}
onMounted(() => { void load() })
</script>

<template>
  <el-card shadow="never" v-loading="loading">
    <div class="toolbar"><h3>芯烨云打印机</h3><el-button @click="load">刷新</el-button><el-button v-if="userStore.isAdmin" type="primary" @click="edit()">新增云打印机</el-button></div>
    <p class="hint">租户管理员维护云设备，网站与 PDA 共用。开发者密钥只保存在后端；条码规格沿用型号配置，二维码规格独立保存。</p>
    <el-table :data="rows" border empty-text="暂无云打印机，请由租户管理员新增">
      <el-table-column prop="name" label="设备名称" min-width="150" />
      <el-table-column prop="sn" label="打印机编号 SN" min-width="160" />
      <el-table-column prop="developer_user" label="开发者账号" min-width="170" />
      <el-table-column label="二维码规格" min-width="180"><template #default="{ row }">{{ row.qr_width_mm }}×{{ row.qr_height_mm }}mm · {{ row.qr_columns === 2 ? '双排' : '单排' }} · 整行{{ row.qr_row_width_mm }}mm</template></el-table-column>
      <el-table-column label="状态" width="80"><template #default="{ row }">{{ row.status ? '启用' : '停用' }}</template></el-table-column>
      <el-table-column label="操作" min-width="200"><template #default="{ row }"><el-button link type="primary" @click="status(row)">查状态</el-button><el-button v-if="userStore.isAdmin" link type="primary" @click="edit(row)">编辑</el-button><el-button v-if="userStore.isAdmin" link type="danger" @click="remove(row)">删除</el-button></template></el-table-column>
    </el-table>
  </el-card>
  <el-dialog v-model="visible" :title="form.cloud_printer_id ? '编辑云打印机' : '新增云打印机'" width="640px" @closed="form.ukey = ''">
    <el-form label-width="120px" :disabled="saving">
      <el-form-item label="设备名称" required><el-input v-model="form.name" maxlength="100" /></el-form-item>
      <el-form-item label="打印机编号 SN" required><el-input v-model="form.sn" maxlength="64" /></el-form-item>
      <el-form-item label="开发者账号" required><el-input v-model="form.developer_user" maxlength="100" /></el-form-item>
      <el-form-item label="开发者密钥" :required="!form.cloud_printer_id"><el-input v-model="form.ukey" type="password" show-password autocomplete="new-password" :placeholder="form.cloud_printer_id ? '留空保留原密钥；修改账号须重填' : '条码云平台 UKEY'" /></el-form-item>
      <el-form-item label="打印机型号" required><el-select v-model="form.printer_model_code" @change="(code: string) => loadSpecs(code)"><el-option v-for="model in models" :key="model.model_code" :value="model.model_code" :label="model.model_name" /></el-select></el-form-item>
      <el-form-item label="条码标签规格" required><el-select v-model="form.label_spec_id"><el-option v-for="spec in specs" :key="spec.spec_id" :value="spec.spec_id" :label="`${spec.spec_name}（${spec.width_mm}×${spec.height_mm}mm）`" /></el-select></el-form-item>
      <el-form-item label="二维码单格尺寸"><el-input-number v-model="form.qr_width_mm" @change="adjustRowWidth" :min="10" :max="108" :precision="0" /><span> × </span><el-input-number v-model="form.qr_height_mm" :min="10" :max="110" :precision="0" /><span> mm</span></el-form-item>
      <el-form-item label="二维码排数"><el-radio-group v-model="form.qr_columns" @change="adjustRowWidth"><el-radio-button :value="1">单排</el-radio-button><el-radio-button :value="2">双排</el-radio-button></el-radio-group></el-form-item>
      <el-form-item label="二维码整行宽"><el-input-number v-model="form.qr_row_width_mm" :min="form.qr_width_mm * form.qr_columns" :max="108" :precision="0" :disabled="form.qr_columns === 1" /><span> mm（双排按纸卷实际宽度填写）</span></el-form-item>
      <el-form-item label="设备状态"><el-switch v-model="form.status" :active-value="1" :inactive-value="0" /></el-form-item>
    </el-form>
    <template #footer><el-button :disabled="saving" @click="visible = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
  </el-dialog>
</template>
<style scoped>
.toolbar { display:flex; align-items:center; gap:10px; } .toolbar h3 { flex:1; margin:0; }
.hint { color:var(--text-secondary); font-size:13px; margin:12px 0 20px; }
</style>
