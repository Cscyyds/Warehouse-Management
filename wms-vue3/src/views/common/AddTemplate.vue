<template>
  <div class="add-template-page">
    <div class="page-header">
      <div class="page-header-left">
        <el-icon class="back-icon" @click="handleCancel"><ArrowLeft /></el-icon>
        <span class="back-label" @click="handleCancel">返回</span>
        <span class="header-divider">/</span>
        <h3>{{ pageTitle }}</h3>
      </div>
      <div class="header-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </div>
    </div>
    <div class="page-body" v-loading="loading">
      <el-tabs v-if="config" v-model="activeTab">
        <el-tab-pane v-for="(tab, idx) in config.tabs" :key="idx" :name="String(idx)">
          <template #label>
            <span class="tab-label-wrap">
              {{ tab.label }}
              <el-badge v-if="tabErrors[idx]" :value="tabErrors[idx]" type="danger" class="tab-err-badge" />
            </span>
          </template>
          <el-form
            :ref="(el: any) => setFormRef(idx, el)"
            :model="formData"
            :label-width="config?.labelWidth || '120px'"
            :label-position="config?.labelPosition ?? 'right'"
            size="default"
          >
            <el-row :gutter="16">
              <template v-for="field in tab.fields" :key="field.key">
                <el-col v-if="field.type === 'section'" :span="field.span || 24">
                  <div class="form-section-title">
                    <span class="section-line" />
                    {{ field.label }}
                  </div>
                </el-col>
                <el-col v-else-if="!['dynamic-table', 'embedded-table', 'image-upload', 'file-upload'].includes(field.type)" v-show="isFieldVisible(field)" :span="field.span || 12">
                  <el-form-item
                    :label="field.label"
                    :prop="field.key"
                    :rules="getFieldRules(field)"
                  >
                    <el-input
                      v-if="field.type === 'input'"
                      v-model="formData[field.key]"
                      :placeholder="field.placeholder"
                      :disabled="field.disabled || (isEdit && field.disabledInEdit)"
                    />
                    <el-input
                      v-else-if="field.type === 'textarea'"
                      v-model="formData[field.key]"
                      type="textarea"
                      :rows="field.rows || 3"
                      :placeholder="field.placeholder"
                      :disabled="field.disabled || (isEdit && field.disabledInEdit)"
                    />
                    <el-select
                      v-else-if="field.type === 'select'"
                      v-model="formData[field.key]"
                      :placeholder="field.placeholder"
                      :clearable="field.clearable !== false"
                      :filterable="field.filterable"
                      :multiple="field.multiple"
                      :allow-create="field.allowCreate"
                      :disabled="field.disabled || (isEdit && field.disabledInEdit)"
                    >
                      <el-option v-for="opt in (fieldOptions[field.key] ?? field.options)" :key="opt.value" :label="opt.label" :value="opt.value" />
                    </el-select>
                    <el-radio-group v-else-if="field.type === 'radio'" v-model="formData[field.key]" :disabled="field.disabled || (isEdit && field.disabledInEdit)">
                      <el-radio v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</el-radio>
                    </el-radio-group>
                    <el-checkbox-group v-else-if="field.type === 'checkbox-group'" v-model="formData[field.key]" class="role-checkbox-group">
                      <el-checkbox-button v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</el-checkbox-button>
                    </el-checkbox-group>
                    <el-tree-select
                      v-else-if="field.type === 'tree-select'"
                      v-model="formData[field.key]"
                      :data="field.treeData || []"
                      :props="field.treeProps || { label: 'name', children: 'children', value: 'id' }"
                      :placeholder="field.placeholder"
                      :check-strictly="field.checkStrictly"
                      :clearable="field.clearable !== false"
                      :filterable="field.filterable"
                      :disabled="field.disabled || (isEdit && field.disabledInEdit)"
                    />
                    <el-date-picker
                      v-else-if="field.type === 'date'"
                      v-model="formData[field.key]"
                      type="date"
                      :placeholder="field.placeholder"
                      :clearable="field.clearable !== false"
                      :disabled="field.disabled || (isEdit && field.disabledInEdit)"
                      style="width:100%"
                    />
                    <el-input-number
                      v-else-if="field.type === 'number'"
                      v-model="formData[field.key]"
                      :placeholder="field.placeholder"
                      :disabled="field.disabled || (isEdit && field.disabledInEdit)"
                      style="width:100%"
                    />
                    <div v-else-if="field.type === 'input-suffix'" class="input-suffix-wrapper">
                      <el-input
                        v-model="formData[field.key + '_label']"
                        :placeholder="field.placeholder"
                        readonly
                        @click="field.dialogType ? openSelectDialog(field.key) : toggleSuffixDropdown(field.key)"
                      >
                        <template #suffix>
                          <el-icon class="input-suffix-icon" :size="18" @click.stop="field.dialogType ? openSelectDialog(field.key) : toggleSuffixDropdown(field.key)"><component :is="field.suffixIcon || 'Search'" /></el-icon>
                        </template>
                      </el-input>
                      <div v-if="!field.dialogType && suffixDropdownVisible[field.key]" class="suffix-dropdown-panel" @click.stop>
                        <el-tree
                          :data="field.treeData || []"
                          :props="{ label: 'name', children: 'children' }"
                          node-key="id"
                          highlight-current
                          @node-click="(data: any) => onSuffixTreeSelect(field.key, data)"
                        />
                      </div>
                    </div>
                  </el-form-item>
                </el-col>
                <el-col v-if="field.type === 'image-upload'" :span="field.span || 24" :key="'img-' + field.key">
                  <el-form-item :label="field.label">
                    <div class="image-upload-wrapper">
                      <el-upload
                        v-model:file-list="imageFileMap[field.key]"
                        list-type="picture-card"
                        :auto-upload="false"
                        :limit="field.maxImages || 9"
                        :on-exceed="() => ElMessage.warning(`最多上传 ${field.maxImages || 9} 张图片`)"
                        accept="image/*"
                      >
                        <el-icon><Plus /></el-icon>
                      </el-upload>
                    </div>
                  </el-form-item>
                </el-col>
                <el-col v-if="field.type === 'file-upload'" :span="field.span || 24" :key="'file-' + field.key">
                  <el-form-item :label="field.label">
                    <div class="file-upload-wrapper">
                      <el-upload
                        v-model:file-list="fileFileMap[field.key]"
                        :auto-upload="false"
                        :limit="field.maxFiles || 5"
                        :on-exceed="() => ElMessage.warning(`最多上传 ${field.maxFiles || 5} 个文件`)"
                      >
                        <el-button type="primary" plain>
                          <el-icon><Upload /></el-icon>
                          <span>点击上传</span>
                        </el-button>
                        <template #tip>
                          <div class="el-upload__tip">最多上传{{ field.maxFiles || 5 }}个文件</div>
                        </template>
                      </el-upload>
                    </div>
                  </el-form-item>
                </el-col>
                <el-col v-if="field.type === 'dynamic-table'" :span="24" :key="'dt-' + field.key">
                  <el-form-item :label="field.label">
                    <div class="dynamic-table-wrapper">
                      <div v-if="!dynamicTableData[field.key]?.length" class="dynamic-table-empty">
                        <el-empty description="暂无数据" :image-size="56">
                          <el-button size="small" @click="addDynamicRow(field.key)">+ {{ field.addLabel || '新增' }}</el-button>
                        </el-empty>
                      </div>
                      <template v-else>
                        <el-table :data="dynamicTableData[field.key]" border size="small" style="width:100%">
                          <el-table-column v-if="field.showIndex" type="index" label="序号" width="60" align="center" />
                          <el-table-column v-for="col in field.columns" :key="col.key" :label="col.label" :width="col.width">
                            <template #default="{ row }">
                              <el-input v-if="!col.type || col.type === 'input'" v-model="row[col.key]" size="small" class="table-cell-input" />
                              <el-select v-else-if="col.type === 'select'" v-model="row[col.key]" size="small" class="table-cell-input">
                                <el-option v-for="opt in col.options" :key="opt.value" :label="opt.label" :value="opt.value" />
                              </el-select>
                              <el-tree-select
                                v-else-if="col.type === 'tree-select'"
                                v-model="row[col.key]"
                                :data="col.treeData || []"
                                :props="col.treeProps || { label: 'name', children: 'children', value: 'id' }"
                                size="small"
                                style="width:100%"
                              />
                            </template>
                          </el-table-column>
                          <el-table-column label="操作" width="60" align="center">
                            <template #default="{ $index }">
                              <el-button text type="danger" size="small" :icon="Delete" @click="removeDynamicRow(field.key, $index)" />
                            </template>
                          </el-table-column>
                        </el-table>
                        <el-button class="add-row-btn" size="small" @click="addDynamicRow(field.key)">+ {{ field.addLabel || '新增' }}</el-button>
                      </template>
                    </div>
                  </el-form-item>
                </el-col>
                <el-col v-if="field.type === 'embedded-table'" :span="24" :key="'et-' + field.key">
                  <el-form-item :label="field.label">
                    <el-table :data="field.tableData" border size="small" style="width:100%">
                      <el-table-column v-for="col in field.columns" :key="col.key" :label="col.label">
                        <template #default="{ row }">
                          <el-checkbox v-if="col.type === 'checkbox'" v-model="row.checked" />
                          <el-input v-else-if="col.type === 'input'" v-model="row[col.key]" size="small" />
                          <el-select v-else-if="col.type === 'select'" v-model="row[col.key]" size="small" :clearable="false">
                            <el-option v-for="opt in col.options" :key="opt.value" :label="opt.label" :value="opt.value" />
                          </el-select>
                          <el-tag v-else-if="col.type === 'tag'" size="small">{{ row[col.key] }}</el-tag>
                          <span v-else>{{ row[col.key] }}</span>
                        </template>
                      </el-table-column>
                    </el-table>
                  </el-form-item>
                </el-col>
              </template>
            </el-row>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      <SupplierSelectDialog v-if="currentDialogType === 'supplier'" v-model="dialogVisible[dialogFieldKey]" :multiple="currentDialogMultiple" @confirm="onSupplierConfirm" @confirm-multiple="onSupplierMultipleConfirm" />
      <EmployeeSelectDialog v-else-if="currentDialogType === 'employee'" v-model="dialogVisible[dialogFieldKey]" @confirm="onEmployeeConfirm" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Delete, Upload } from '@element-plus/icons-vue'
import { getSceneConfig, type FieldConfig } from '@/config/formConfigs'
import type { FormItemRule } from 'element-plus'
import SupplierSelectDialog from '@/views/purchase/SupplierSelectDialog.vue'
import EmployeeSelectDialog from '@/views/customer/EmployeeSelectDialog.vue'

const route = useRoute()
const router = useRouter()
const activeTab = ref('0')
const submitting = ref(false)
const loading = ref(false)
const formRefs = ref<Record<number, any>>({})
const dynamicTableData = reactive<Record<string, any[]>>({})
const suffixDropdownVisible = reactive<Record<string, boolean>>({})
const dialogVisible = reactive<Record<string, boolean>>({})
const dialogFieldKey = ref<string>('')
const imageFileMap = reactive<Record<string, any[]>>({})
const fileFileMap = reactive<Record<string, any[]>>({})
const fieldOptions = reactive<Record<string, { label: string; value: string | number }[]>>({})
const tabErrors = reactive<Record<number, number>>({})

const config = computed(() => {
  const type = route.query.type as string
  return getSceneConfig(type)
})

const isEdit = computed(() => route.query.mode === 'edit')
const editId = computed(() => route.query.id as string | undefined)

// 当前打开弹窗的字段对应的 dialogType（用于条件渲染对应弹窗组件）
const currentDialogType = computed(() => {
  if (!config.value || !dialogFieldKey.value) return ''
  for (const tab of config.value.tabs) {
    const field = tab.fields.find(f => f.key === dialogFieldKey.value)
    if (field) return field.dialogType || ''
  }
  return ''
})

// 当前打开弹窗的字段是否多选模式
const currentDialogMultiple = computed(() => {
  if (!config.value || !dialogFieldKey.value) return false
  for (const tab of config.value.tabs) {
    const field = tab.fields.find(f => f.key === dialogFieldKey.value)
    if (field) return !!field.multiple
  }
  return false
})

const pageTitle = computed(() => {
  if (!config.value) return '加载中...'
  return isEdit.value ? (config.value.editTitle || config.value.title) : config.value.title
})

const formData = reactive<Record<string, any>>({})

function setFormRef(idx: number, el: any) { if (el) formRefs.value[idx] = el }

function toggleSuffixDropdown(key: string) {
  suffixDropdownVisible[key] = !suffixDropdownVisible[key]
}

function onSuffixTreeSelect(key: string, data: any) {
  // 优先使用业务ID（如 category_id），不存在时回退到 id
  formData[key] = data.category_id ?? data.id
  formData[key + '_label'] = data.name
  suffixDropdownVisible[key] = false
}

function openSelectDialog(key: string) {
  dialogFieldKey.value = key
  dialogVisible[key] = true
}

function onSupplierConfirm(supplier: any) {
  const key = dialogFieldKey.value
  if (!key) return
  formData[key] = supplier.supplier_id
  formData[key + '_label'] = supplier.supplier_name
}

function onSupplierMultipleConfirm(suppliers: Array<{ supplier_id: string; supplier_name: string; supplier_model: string }>) {
  const key = dialogFieldKey.value
  if (!key) return
  // 存储选中的供应商数组，供 submitCreate/submitUpdate 后调用 addProductSupplier
  formData[key] = suppliers
  formData[key + '_label'] = suppliers.map(s => s.supplier_name).join('、')
}

function onEmployeeConfirm(user: any) {
  const key = dialogFieldKey.value
  if (!key) return
  formData[key] = user.user_id
  formData[key + '_label'] = user.user_name
}

function closeSuffixDropdowns(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.input-suffix-wrapper')) {
    Object.keys(suffixDropdownVisible).forEach(k => { suffixDropdownVisible[k] = false })
  }
}

function isFieldVisible(field: FieldConfig): boolean {
  if (!field.visible) return true
  return field.visible(formData)
}

function getFieldRules(field: FieldConfig): FormItemRule[] {
  const rules: FormItemRule[] = []
  if (field.required) {
    const selectTypes = ['select', 'date', 'tree-select', 'input-suffix', 'radio']
    const isSelect = selectTypes.includes(field.type)
    rules.push({
      required: true,
      message: `${isSelect ? '请选择' : '请输入'}${field.label}`,
      trigger: isSelect ? ['blur', 'change'] : 'blur'
    })
  }
  if (field.rules) (field.rules as FormItemRule[]).forEach(r => rules.push(r))
  return rules
}

function addDynamicRow(key: string) {
  if (!dynamicTableData[key]) dynamicTableData[key] = []
  dynamicTableData[key].push({})
}

async function removeDynamicRow(key: string, index: number) {
  try {
    await ElMessageBox.confirm('确认删除该行？', '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger'
    })
    dynamicTableData[key]?.splice(index, 1)
  } catch {}
}

function handleCancel() { router.back() }

function handleReset() {
  Object.keys(formRefs.value).forEach(idx => {
    formRefs.value[Number(idx)]?.resetFields()
  })
  Object.keys(tabErrors).forEach(k => { delete tabErrors[Number(k)] })
}

async function handleSubmit() {
  if (!config.value) return
  Object.keys(tabErrors).forEach(k => { delete tabErrors[Number(k)] })
  const results = await Promise.allSettled(
    config.value.tabs.map((_, idx) => {
      const ref = formRefs.value[idx]
      return ref ? ref.validate() : Promise.resolve()
    })
  )
  const firstError = results.findIndex(r => r.status === 'rejected')
  if (firstError >= 0) {
    results.forEach((r, idx) => {
      if (r.status === 'rejected') {
        const errs = (r as PromiseRejectedResult).reason
        tabErrors[idx] = errs ? Object.keys(errs).length : 1
      }
    })
    activeTab.value = String(firstError)
    ElMessage.warning('请检查表单填写')
    return
  }
  submitting.value = true
  try {
    // 过滤掉 input-suffix 的 _label 显示字段，只提交业务字段
    const submitData: Record<string, any> = {}
    Object.entries(formData).forEach(([k, v]) => {
      if (!k.endsWith('_label')) submitData[k] = v
    })
    Object.keys(dynamicTableData).forEach(key => {
      submitData[key] = dynamicTableData[key]
    })
    Object.keys(imageFileMap).forEach(key => {
      submitData[key] = imageFileMap[key].map(f => f.url || '').filter(Boolean).join(',')
    })
    // 收集待上传的 File 对象（图片 + 附件）
    const files: Record<string, File[]> = {}
    Object.keys(imageFileMap).forEach(key => {
      const raws = imageFileMap[key].map((f: any) => f.raw).filter(Boolean)
      if (raws.length) files[key] = raws
    })
    Object.keys(fileFileMap).forEach(key => {
      const raws = fileFileMap[key].map((f: any) => f.raw).filter(Boolean)
      if (raws.length) files[key] = raws
    })
    if (isEdit.value && editId.value) {
      if (config.value.submitUpdate) {
        await config.value.submitUpdate(editId.value, submitData, files)
      }
    } else {
      if (config.value.submitCreate) {
        await config.value.submitCreate(submitData, files)
      }
    }
    ElMessage.success('保存成功')
    if (config.value?.successRoute) router.push(config.value.successRoute)
  } catch {
    ElMessage.error('保存失败')
  } finally {
    submitting.value = false
  }
}

function initFormDefaults() {
  if (!config.value) return
  config.value.tabs.forEach(tab => {
    tab.fields.forEach(field => {
      if (field.type === 'dynamic-table') dynamicTableData[field.key] = []
      if (field.type === 'image-upload') imageFileMap[field.key] = []
      if (field.type === 'file-upload') fileFileMap[field.key] = []
      if (field.defaultValue !== undefined) formData[field.key] = field.defaultValue
      else if (field.type === 'checkbox-group') formData[field.key] = []
      else if (!['section', 'dynamic-table', 'embedded-table', 'image-upload', 'file-upload'].includes(field.type)) formData[field.key] = ''
    })
  })
}

async function loadEditData() {
  if (!config.value || !editId.value) return
  loading.value = true
  try {
    let data: Record<string, any> | null = null
    const cacheKey = `editData:${config.value.type}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      data = JSON.parse(cached)
      sessionStorage.removeItem(cacheKey)
    } else if (config.value.loadDetail) {
      data = await config.value.loadDetail(editId.value)
    }
    if (data) {
      Object.assign(formData, data)
      config.value.tabs.forEach(tab => {
        tab.fields.forEach(field => {
          if (field.type === 'dynamic-table' && data![field.key]) {
            dynamicTableData[field.key] = data![field.key]
          }
          if (field.type === 'input-suffix') {
            // 优先使用显式声明的 labelKey（如 supplier_name），否则按 camelCase 约定回退
            const nameKey = field.labelKey || field.key.replace(/Id$/, 'Name')
            if (data![nameKey] !== undefined) formData[field.key + '_label'] = data![nameKey]
          }
          if (field.type === 'image-upload' && data![field.key]) {
            const raw = data![field.key]
            const urls: string[] = typeof raw === 'string' ? raw.split(',').filter(Boolean) : (Array.isArray(raw) ? raw : [])
            imageFileMap[field.key] = urls.map((url, i) => ({ name: `image-${i}`, url }))
          }
          if (field.type === 'file-upload' && data![field.key]) {
            const raw = data![field.key]
            const fileList: Array<{ name: string; url: string }> = Array.isArray(raw)
              ? raw.map((item: any) => ({ name: item.file_name || item.name || 'file', url: item.file_url || item.url || '' }))
              : []
            fileFileMap[field.key] = fileList
          }
          // 多选字段：后端可能返回 str | null，统一成数组以保证 el-select multiple 回显正常
          if (field.multiple) {
            const v = formData[field.key]
            if (!Array.isArray(v)) formData[field.key] = v ? [v] : []
          }
        })
      })
    }
  } catch {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

async function loadTreeData() {
  if (!config.value) return
  const promises: Promise<void>[] = []
  config.value.tabs.forEach(tab => {
    tab.fields.forEach(field => {
      if (field.loadTreeData) {
        promises.push(
          field.loadTreeData().then(data => {
            field.treeData = data
          }).catch(() => {})
        )
      }
      if (field.loadOptions) {
        promises.push(
          field.loadOptions().then(opts => {
            fieldOptions[field.key] = opts
          }).catch(() => {})
        )
      }
      if (field.type === 'dynamic-table' && field.columns) {
        field.columns.forEach((col: any) => {
          if (col.loadOptions) {
            promises.push(
              col.loadOptions().then((opts: any) => {
                col.options = opts
              }).catch(() => {})
            )
          }
        })
      }
    })
  })
  await Promise.allSettled(promises)
}

onMounted(async () => {
  document.addEventListener('click', closeSuffixDropdowns)
  if (!config.value) {
    ElMessage.warning('未找到对应的表单配置')
    return
  }
  initFormDefaults()
  try { await loadTreeData() } catch {}
  if (isEdit.value && editId.value) {
    await loadEditData()
  } else {
    // 读取预设数据（如点击"新增子类"时传入的父类别信息）
    const presetKey = `presetData:${config.value.type}`
    const preset = sessionStorage.getItem(presetKey)
    if (preset) {
      sessionStorage.removeItem(presetKey)
      const presetData = JSON.parse(preset)
      Object.assign(formData, presetData)
      // 为 input-suffix 字段设置 _label 显示值
      config.value.tabs.forEach(tab => {
        tab.fields.forEach(field => {
          if (field.type === 'input-suffix' && presetData[field.key] !== undefined) {
            const labelKey = field.key + '_label'
            if (presetData[labelKey] !== undefined) {
              formData[labelKey] = presetData[labelKey]
            }
          }
        })
      })
    }
  }
})

onUnmounted(() => {
  document.removeEventListener('click', closeSuffixDropdowns)
})
</script>

<style scoped>
.add-template-page { background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-xs); padding: 0; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; border-bottom: 1px solid var(--border-light); }
.page-header-left { display: flex; align-items: center; gap: 8px; }
.back-icon { cursor: pointer; color: var(--text-secondary); font-size: 16px; transition: color var(--transition-fast); }
.back-icon:hover { color: var(--primary); }
.back-label { cursor: pointer; font-size: 14px; color: var(--text-secondary); transition: color var(--transition-fast); }
.back-label:hover { color: var(--primary); }
.header-divider { color: var(--text-tertiary); font-size: 14px; margin: 0 2px; }
.page-header h3 { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.header-actions { display: flex; gap: 8px; }
.page-body { padding: 20px 24px; }
.add-template-page :deep(.el-tabs__header) { margin-bottom: 16px; }
.add-template-page :deep(.el-form-item) { margin-bottom: 16px; }
.add-template-page :deep(.el-form-item__label) { font-size: 14px; color: var(--text-secondary); }
.form-section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 24px 0 14px; padding-left: 4px; }
.form-section-title:first-child { margin-top: 4px; }
.section-line { width: 4px; height: 16px; background: var(--primary-gradient); border-radius: 2px; flex-shrink: 0; }
.input-suffix-icon { cursor: pointer; color: var(--text-tertiary); }
.input-suffix-icon:hover { color: var(--primary); }
.input-suffix-wrapper { position: relative; width: 100%; }
.suffix-dropdown-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 9999;
  background: var(--bg-white);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: var(--shadow-md);
  min-width: 220px;
  max-height: 300px;
  overflow-y: auto;
  padding: 8px 0;
}
.dynamic-table-wrapper { width: 100%; }
.dynamic-table-wrapper :deep(.el-table) { border: none; }
.dynamic-table-wrapper :deep(.el-table th) { border-bottom: 1px solid var(--border-color); }
.dynamic-table-wrapper :deep(.el-table td) { border-bottom: 1px solid var(--border-light); }
.table-cell-input :deep(.el-input__wrapper) {
  box-shadow: none;
  border: none;
  border-bottom: 1px solid var(--border-color);
  border-radius: 0;
  padding: 1px 4px;
  background: transparent;
}
.table-cell-input :deep(.el-input__wrapper:hover),
.table-cell-input :deep(.el-input__wrapper.is-focus) {
  border-bottom-color: var(--primary);
}
.dynamic-table-empty { border: 1px dashed var(--border-color); border-radius: 6px; padding: 16px 0; }
.add-row-btn { margin-top: 8px; }
.role-checkbox-group { display: flex; flex-wrap: wrap; gap: 8px; }
.tab-label-wrap { display: inline-flex; align-items: center; gap: 6px; }
.add-template-page :deep(.tab-err-badge .el-badge__content) { font-size: 11px; }
.image-upload-wrapper :deep(.el-upload--picture-card) { width: 100px; height: 100px; }
.image-upload-wrapper :deep(.el-upload-list--picture-card .el-upload-list__item) { width: 100px; height: 100px; }
</style>
