<template>
  <SyncSettingsLayout :loading="loading">
    <SyncIntervalPanel
      v-model="form.sync_interval_seconds"
      :current-interval="settings?.sync_interval_seconds"
      :interval-bounds="intervalBounds"
      :can-manage="canManage"
      :loading="loading"
      :saving="saving"
      :is-dirty="isDirty"
      @reload="load"
      @reset="resetSettings"
      @save="save"
    />

    <template #details>
      <section class="panel runtime-panel">
        <div class="panel-heading">
          <span class="panel-icon"><el-icon><Connection /></el-icon></span>
          <h3>查询范围与开启时间</h3>
        </div>

        <div v-if="settings">
          <label v-if="canManage" class="field-label window-label" for="production-sync-window">分片跨度（天）</label>
          <p v-else class="field-label">分片跨度（天）</p>
          <el-input-number
            v-if="canManage"
            id="production-sync-window"
            v-model="form.sync_window_days"
            :min="windowBounds.min"
            :max="windowBounds.max"
            :disabled="saving || loading"
            controls-position="right"
          />
          <span v-else class="data-value">{{ settings.sync_window_days }} 天</span>
          <p class="field-note">每轮同步查询的时间跨度。跨度越大，单片查询耗时可能越长。</p>
        </div>

        <dl class="runtime-details">
          <div>
            <dt>单据正式开启时间</dt>
            <dd class="data-value">{{ settings ? (settings.formal_start_at || '未设置') : '—' }}</dd>
            <dd v-if="settings && !settings.formal_start_at" class="field-note">历史单据将按正常流程导入，请联系平台设置。</dd>
          </div>
          <div>
            <dt>销售退回单开启时间</dt>
            <dd class="data-value">{{ settings ? (settings.sales_return_formal_start_at || '未设置') : '—' }}</dd>
            <dd v-if="settings" class="field-note">
              {{ settings.sales_return_formal_start_at ? '跟随贸易截止时间。' : '跟随贸易截止时间，未设置时历史单据按正常流程导入。' }}
            </dd>
          </div>
        </dl>
      </section>
    </template>
  </SyncSettingsLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Connection } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  getProductionSyncSettings,
  updateProductionSyncSettings,
  type ProductionSyncSettingsResult,
} from '@/api/modules/production'
import { usePermissionStore } from '@/stores/permission'
import SyncIntervalPanel from '@/components/sync-duration/SyncIntervalPanel.vue'
import SyncSettingsLayout from '@/components/sync-duration/SyncSettingsLayout.vue'
import { formatDuration } from '@/components/sync-duration/format'

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

const intervalBounds = computed(() => settings.value?.interval_bounds ?? { min: 300, max: 172800 })
const windowBounds = computed(() => settings.value?.window_bounds ?? { min: 1, max: 180 })
const isDirty = computed(() => settings.value != null
  && (form.sync_interval_seconds !== settings.value.sync_interval_seconds
    || form.sync_window_days !== settings.value.sync_window_days))

function resetSettings() {
  form.sync_interval_seconds = settings.value?.sync_interval_seconds
  form.sync_window_days = settings.value?.sync_window_days
}

async function load() {
  loading.value = true
  try {
    const res = await getProductionSyncSettings()
    settings.value = res.data
  } catch {
    settings.value = null
  } finally {
    resetSettings()
    loading.value = false
  }
}

/** 用 GET 返回的 bounds 前置校验，避免无效请求 */
function validate(): string | null {
  if (!settings.value) return '请先加载同步设置'
  const ib = intervalBounds.value
  const wb = windowBounds.value
  if (form.sync_interval_seconds == null && form.sync_window_days == null) return '请至少填写一项设置'
  if (form.sync_interval_seconds != null
    && (!Number.isInteger(form.sync_interval_seconds) || form.sync_interval_seconds < ib.min || form.sync_interval_seconds > ib.max)) {
    return `同步间隔须在 ${formatDuration(ib.min)} 至 ${formatDuration(ib.max)} 之间`
  }
  if (form.sync_window_days != null
    && (!Number.isInteger(form.sync_window_days) || form.sync_window_days < wb.min || form.sync_window_days > wb.max)) {
    return `分片跨度须在 ${wb.min}~${wb.max} 天之间`
  }
  return null
}

async function save() {
  if (saving.value || loading.value || !canManage.value || !settings.value || !isDirty.value) return
  const invalid = validate()
  if (invalid) { ElMessage.warning(invalid); return }
  saving.value = true
  try {
    const res = await updateProductionSyncSettings({
      sync_interval_seconds: form.sync_interval_seconds,
      sync_window_days: form.sync_window_days,
    })
    settings.value = { ...settings.value, ...res.data }
    resetSettings()
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
.window-label { display: block; }
</style>
