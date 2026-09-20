<template>
  <el-card shadow="never" class="settings-card" v-loading="loading">
    <template #header>
      <div class="settings-header">
        <div class="settings-title">
          <span class="card-title">同步设置</span>
          <span class="settings-hint">修改即时生效（扫描器 ≤60 秒内按新值判定），无需重启</span>
        </div>
      </div>
    </template>

    <el-form label-position="top" class="settings-form">
      <div class="settings-grid">
        <el-form-item>
          <template #label>
            同步间隔（秒）
            <span class="bound-hint">{{ settings?.interval_bounds ? `${settings.interval_bounds.min} ~ ${settings.interval_bounds.max}` : '' }}</span>
          </template>
          <el-input-number
            v-model="form.sync_interval_seconds"
            :min="settings?.interval_bounds?.min ?? 300"
            :max="settings?.interval_bounds?.max ?? 172800"
            :step="60"
            :disabled="!canManage"
            controls-position="right"
            style="width: 100%"
          />
          <p class="field-tip">多久同步一次新单据。当前：{{ formatInterval(form.sync_interval_seconds) }}</p>
        </el-form-item>

        <el-form-item>
          <template #label>
            分片跨度（天）
            <span class="bound-hint">{{ settings?.window_bounds ? `${settings.window_bounds.min} ~ ${settings.window_bounds.max}` : '' }}</span>
          </template>
          <el-input-number
            v-model="form.sync_window_days"
            :min="settings?.window_bounds?.min ?? 1"
            :max="settings?.window_bounds?.max ?? 180"
            :disabled="!canManage"
            controls-position="right"
            style="width: 100%"
          />
          <p class="field-tip">每轮同步查询的时间跨度。跨度越大单片单据越多、越慢。</p>
        </el-form-item>

        <el-form-item class="settings-actions">
          <el-button
            v-perm="'POST /api/v1/tenant-production/sync/settings/update'"
            type="primary"
            :loading="saving"
            @click="save"
          >保存</el-button>
          <el-button v-if="canManage" @click="reload">重置</el-button>
        </el-form-item>
      </div>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getProductionSyncSettings,
  updateProductionSyncSettings,
  type ProductionSyncSettingsResult,
} from '@/api/modules/production'
import { usePermissionStore } from '@/stores/permission'

const emit = defineEmits<{ (e: 'saved'): void }>()

const permissionStore = usePermissionStore()

/** 无 perm_production_manage（仅查看权限）的用户：设置只读展示，输入框禁用、操作按钮隐藏 */
const canManage = computed(() =>
  permissionStore.hasUrlPerm('POST /api/v1/tenant-production/sync/settings/update'),
)

const loading = ref(false)
const saving = ref(false)
const settings = ref<ProductionSyncSettingsResult | null>(null)
const form = reactive<{ sync_interval_seconds: number | undefined; sync_window_days: number | undefined }>({
  sync_interval_seconds: undefined,
  sync_window_days: undefined,
})

function formatInterval(seconds?: number): string {
  if (!seconds) return '—'
  if (seconds >= 60 && seconds % 60 === 0) return `每 ${seconds / 60} 分钟`
  return `每 ${seconds} 秒`
}

function applySettings(data: ProductionSyncSettingsResult) {
  settings.value = data
  form.sync_interval_seconds = data.sync_interval_seconds
  form.sync_window_days = data.sync_window_days
}

async function load() {
  loading.value = true
  try {
    const res = await getProductionSyncSettings()
    applySettings(res.data)
  } catch {
    settings.value = null
  } finally {
    loading.value = false
  }
}

function reload() {
  load()
}

/** 用 GET 返回的 bounds 前置校验，避免无效请求 */
function validate(): string | null {
  const ib = settings.value?.interval_bounds
  const wb = settings.value?.window_bounds
  if (form.sync_interval_seconds == null && form.sync_window_days == null) return '请至少填写一项设置'
  if (form.sync_interval_seconds != null && ib
    && (form.sync_interval_seconds < ib.min || form.sync_interval_seconds > ib.max)) {
    return `同步间隔须在 ${ib.min}~${ib.max} 秒之间`
  }
  if (form.sync_window_days != null && wb
    && (form.sync_window_days < wb.min || form.sync_window_days > wb.max)) {
    return `分片跨度须在 ${wb.min}~${wb.max} 天之间`
  }
  return null
}

async function save() {
  const invalid = validate()
  if (invalid) { ElMessage.warning(invalid); return }
  saving.value = true
  try {
    const res = await updateProductionSyncSettings({
      sync_interval_seconds: form.sync_interval_seconds,
      sync_window_days: form.sync_window_days,
    })
    // 以响应回显值刷新表单
    form.sync_interval_seconds = res.data.sync_interval_seconds
    form.sync_window_days = res.data.sync_window_days
    ElMessage.success('同步设置已保存')
    // 通知父级刷新（概览头部会展示同步间隔）
    emit('saved')
  } catch {
    // 全局拦截器已弹错
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.settings-card { border-radius: var(--radius-md); }
.settings-header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.settings-title { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.card-title { font-weight: 600; }
.settings-hint { font-size: 12px; color: var(--text-tertiary); }
/* 两个字段并排；操作区作为第三列跟在字段右侧，避免底部再拉一条分隔线 */
.settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)) auto; gap: 0 32px; align-items: start; }
.settings-grid :deep(.el-form-item) { margin-bottom: 0; }
.settings-grid :deep(.el-input-number) { width: 100%; }
.settings-actions { align-self: end; padding-bottom: 2px; }
.settings-actions :deep(.el-form-item__content) { flex-wrap: nowrap; }
.bound-hint { margin-left: 6px; font-size: 12px; color: var(--text-tertiary); font-weight: 400; }
.field-tip { margin: 6px 0 0; font-size: 12px; color: var(--text-tertiary); line-height: 1.6; }
@media (max-width: 1100px) {
  .settings-grid { grid-template-columns: 1fr; gap: 16px 0; }
  .settings-actions { align-self: stretch; }
}
</style>
