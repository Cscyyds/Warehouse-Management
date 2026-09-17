<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteTenantCredential,
  listTenantCredentials,
  testTenantCredential,
  updateTenantCredential,
} from '@/api/productionManagement'
import type { ChannelItem, CredentialField, CredentialView } from '@/types/productionManagement'

const props = defineProps<{
  tenantId: string
  channels: ChannelItem[]
}>()

const emit = defineEmits<{ (e: 'changed'): void }>()

const loading = ref(false)
const rows = ref<CredentialView[]>([])

const dialogOpen = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const saving = ref(false)
const testingForm = ref(false)
const testingRowId = ref('')
const editingRow = ref<CredentialView | null>(null)
const selectedChannel = ref('')
const formStatus = ref<0 | 1>(1)
const formRemark = ref('')
/** 动态表单模型：key = credential_fields[].key */
const formModel = reactive<Record<string, string>>({})

const currentFields = computed<CredentialField[]>(() => {
  const channel = props.channels.find((item) => item.channel_code === selectedChannel.value)
  return channel?.credential_fields || []
})

const dialogTitle = computed(() => (dialogMode.value === 'create' ? '新增渠道凭证' : '编辑渠道凭证'))

/** 覆盖测试需站点号 + 全部必填字段（含密码）齐备 */
const canTestForm = computed(() =>
  currentFields.value.every((field) => {
    const value = (formModel[field.key] || '').trim()
    return field.required ? value.length > 0 : true
  }) && currentFields.value.length > 0,
)

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function load() {
  loading.value = true
  try {
    const data = await listTenantCredentials(props.tenantId)
    rows.value = data.items
  } catch (error) {
    rows.value = []
    ElMessage.error(errorMessage(error, '渠道凭证加载失败'))
  } finally {
    loading.value = false
  }
}

function resetFormModel(fields: CredentialField[]) {
  Object.keys(formModel).forEach((key) => delete formModel[key])
  fields.forEach((field) => { formModel[field.key] = '' })
}

function fieldsOf(channelCode: string): CredentialField[] {
  return props.channels.find((item) => item.channel_code === channelCode)?.credential_fields || []
}

function openCreate() {
  dialogMode.value = 'create'
  editingRow.value = null
  const firstAvailable = props.channels.find((item) => item.available) || props.channels[0]
  selectedChannel.value = firstAvailable?.channel_code || ''
  resetFormModel(fieldsOf(selectedChannel.value))
  formStatus.value = 1
  formRemark.value = ''
  dialogOpen.value = true
}

function openEdit(row: CredentialView) {
  dialogMode.value = 'edit'
  editingRow.value = row
  selectedChannel.value = row.channel_code
  const fields = fieldsOf(row.channel_code)
  resetFormModel(fields)
  // 逐字段回填脱敏视图；密码永不回填（留空=沿用原密码）
  fields.forEach((field) => {
    if (field.secret) { formModel[field.key] = ''; return }
    const value = (row as unknown as Record<string, unknown>)[field.key]
    formModel[field.key] = value == null ? '' : String(value)
  })
  formStatus.value = row.status === 1 ? 1 : 0
  formRemark.value = row.remark || ''
  dialogOpen.value = true
}

function onChannelChange() {
  resetFormModel(fieldsOf(selectedChannel.value))
}

/** 除 api_base_url 外的字段拼进 auth_payload JSON */
function buildAuthPayload(): string {
  const payload: Record<string, string> = {}
  currentFields.value.forEach((field) => {
    if (field.key === 'api_base_url') return
    payload[field.key] = formModel[field.key] ?? ''
  })
  return JSON.stringify(payload)
}

function validateForm(): string | null {
  for (const field of currentFields.value) {
    if (!field.required) continue
    const value = (formModel[field.key] || '').trim()
    if (value) continue
    // 编辑态下密码留空表示沿用原密码，允许为空
    if (field.secret && dialogMode.value === 'edit' && editingRow.value?.pwd_configured) continue
    return `${field.label} 不能为空`
  }
  return null
}

async function save() {
  const invalid = validateForm()
  if (invalid) { ElMessage.warning(invalid); return }
  saving.value = true
  try {
    const data = await updateTenantCredential({
      tenant_id: props.tenantId,
      channel_code: selectedChannel.value,
      api_base_url: (formModel.api_base_url || '').trim(),
      auth_payload: buildAuthPayload(),
      status_flag: formStatus.value,
      remark: formRemark.value.trim(),
    })
    ElMessage.success(data.pwd_changed ? '渠道凭证已保存' : '渠道凭证已保存（密码沿用原值）')
    dialogOpen.value = false
    await load()
    emit('changed')
  } catch (error) {
    ElMessage.error(errorMessage(error, '渠道凭证保存失败'))
  } finally {
    saving.value = false
  }
}

async function testFromForm() {
  testingForm.value = true
  try {
    await testTenantCredential({
      api_base_url: (formModel.api_base_url || '').trim(),
      auth_payload: buildAuthPayload(),
    })
    ElMessage.success('天心渠道连通测试成功')
  } catch (error) {
    ElMessage.error(errorMessage(error, '连通测试失败'))
  } finally {
    testingForm.value = false
  }
}

async function testSaved(row: CredentialView) {
  testingRowId.value = row.credential_id
  try {
    await testTenantCredential({ tenant_id: props.tenantId, channel_code: row.channel_code })
    ElMessage.success('天心渠道连通测试成功')
  } catch (error) {
    ElMessage.error(errorMessage(error, '连通测试失败'))
  } finally {
    testingRowId.value = ''
  }
}

async function remove(row: CredentialView) {
  try {
    await ElMessageBox.confirm(
      `确认删除渠道「${row.channel_name || row.channel_code}」的凭证？删除后需重新录入。`,
      '删除凭证',
      { type: 'warning', confirmButtonText: '确认删除' },
    )
  } catch {
    return
  }
  try {
    await deleteTenantCredential({ tenant_id: props.tenantId, channel_code: row.channel_code })
    ElMessage.success('渠道凭证已删除')
    await load()
    emit('changed')
  } catch (error) {
    ElMessage.error(errorMessage(error, '渠道凭证删除失败'))
  }
}

onMounted(load)
</script>

<template>
  <div class="credential-tab">
    <div class="credential-toolbar">
      <span class="record-count"><strong>{{ rows.length }}</strong> 条凭证</span>
      <el-button type="primary" @click="openCreate">新增凭证</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" stripe table-layout="fixed" empty-text="暂无渠道凭证，点击「新增凭证」录入 ERP 登录信息">
      <el-table-column label="渠道" min-width="120">
        <template #default="scope">
          <div class="table-person"><strong>{{ scope.row.channel_name || scope.row.channel_code }}</strong><span>{{ scope.row.channel_code }}</span></div>
        </template>
      </el-table-column>
      <el-table-column label="站点号" min-width="160" show-overflow-tooltip>
        <template #default="scope"><code class="table-code">{{ scope.row.api_base_url || '—' }}</code></template>
      </el-table-column>
      <el-table-column prop="comp_no" label="账套" width="110" show-overflow-tooltip />
      <el-table-column prop="usr" label="账号" width="120" show-overflow-tooltip />
      <el-table-column label="三要素" width="86" align="center">
        <template #default="scope"><span class="status-pill" :class="scope.row.configured ? 'is-success' : 'is-danger'">{{ scope.row.configured ? '齐全' : '缺失' }}</span></template>
      </el-table-column>
      <el-table-column label="密码" width="86" align="center">
        <template #default="scope"><span class="status-pill" :class="scope.row.pwd_configured ? 'is-success' : 'is-muted'">{{ scope.row.pwd_configured ? '已配' : '未配' }}</span></template>
      </el-table-column>
      <el-table-column label="状态" width="120" align="center">
        <template #default="scope">
          <span class="status-pill" :class="scope.row.status === 1 ? 'is-success' : 'is-danger'">{{ scope.row.status === 1 ? '启用' : '停用' }}</span>
          <span v-if="scope.row.in_use" class="in-use-tag">使用中</span>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="160">
        <template #default="scope">{{ scope.row.updated_at || '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="scope">
          <el-button link type="primary" @click="openEdit(scope.row)">编辑</el-button>
          <el-button link type="primary" :loading="testingRowId === scope.row.credential_id" @click="testSaved(scope.row)">测试</el-button>
          <el-tooltip :disabled="!scope.row.in_use" content="该渠道正被启用中的模块使用，请先关闭模块或切换渠道" placement="top">
            <span><el-button link type="danger" :disabled="scope.row.in_use" @click="remove(scope.row)">删除</el-button></span>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogOpen" :title="dialogTitle" width="620px" :close-on-click-modal="false" destroy-on-close>
      <el-form label-position="top" class="dense-form">
        <el-form-item label="接入渠道" required>
          <el-select v-model="selectedChannel" placeholder="选择渠道" :disabled="dialogMode === 'edit'" @change="onChannelChange">
            <el-option
              v-for="item in channels"
              :key="item.channel_code"
              :label="item.channel_name"
              :value="item.channel_code"
              :disabled="!item.available"
            >
              <span>{{ item.channel_name }}</span>
              <span v-if="!item.available" class="channel-reserved">预留占位</span>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item v-for="field in currentFields" :key="field.key" :label="field.label" :required="field.required">
          <el-input
            v-model="formModel[field.key]"
            :type="field.secret ? 'password' : 'text'"
            :show-password="field.secret"
            :placeholder="field.secret && dialogMode === 'edit' ? '留空表示不修改原密码' : ''"
            autocomplete="new-password"
          />
        </el-form-item>

        <div class="form-row">
          <el-form-item label="凭证状态">
            <el-switch v-model="formStatus" :active-value="1" :inactive-value="0" inline-prompt active-text="启用" inactive-text="停用" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="formRemark" maxlength="200" placeholder="选填" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button :loading="testingForm" :disabled="!canTestForm" @click="testFromForm">测试连通</el-button>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存凭证</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.credential-tab { display: grid; gap: 16px; }
.credential-toolbar { display: flex; align-items: center; justify-content: space-between; }
.in-use-tag { margin-left: 6px; padding: 2px 6px; color: #265fbf; border: 1px solid #cbdcff; background: #eef4ff; border-radius: 999px; font-size: 9px; font-weight: 750; }
.channel-reserved { margin-left: 8px; color: #b0642a; font-size: 11px; }
</style>
