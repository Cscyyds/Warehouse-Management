<template>
  <SyncSettingsLayout
    title="借出借入同步设置"
    description="管理借入、借出及归还单据的自动同步间隔。"
    :loading="loading"
  >
    <SyncIntervalPanel
      v-model="intervalSeconds"
      :current-interval="settings?.sync_interval_seconds"
      :interval-bounds="intervalBounds"
      :can-manage="canManage"
      :loading="loading"
      :saving="saving"
      :is-dirty="isDirty"
      @reload="load"
      @reset="resetInterval"
      @save="save"
    />

    <template #details>
      <section class="panel runtime-panel">
        <div class="panel-heading">
          <span class="panel-icon"><el-icon><Connection /></el-icon></span>
          <h3>同步前置条件</h3>
          <span class="read-only"><el-icon><Lock /></el-icon>只读</span>
        </div>
        <dl class="runtime-details">
          <div>
            <dt>模块形态</dt>
            <dd class="data-value">
              <span>{{ syncModeLabel(mode?.tenant_mode) }}</span>
            </dd>
          </div>
          <div>
            <dt>渠道编码</dt>
            <dd class="data-value"><code>{{ mode?.tenant_mode === 'TIANXIN' ? 'TIANXIN' : '—' }}</code></dd>
          </div>
          <div class="formal-start">
            <dt>单据正式开启时间</dt>
            <dd class="data-value">{{ settings ? (settings.formal_start_at || '未设置') : '—' }}</dd>
            <dd v-if="settings && !settings.formal_start_at" class="field-note">
              历史单据将按正常流程导入，请联系平台设置。
            </dd>
          </div>
        </dl>
      </section>
    </template>

    <template #scope>
      <dl class="scope-details is-paired">
        <div>
          <dt>借入侧</dt>
          <dd>借入单 + 借入还出单</dd>
        </div>
        <div>
          <dt>借出侧</dt>
          <dd>借出单 + 借出还入单</dd>
        </div>
      </dl>
    </template>
  </SyncSettingsLayout>
</template>

<script setup lang="ts">
/**
 * 借出借入同步设置（D3 甲：独立页）。
 * - 端点：GET/POST /tenant-borrow/sync/settings[/update]，仅开放「间隔」一项
 *   （窗口跨度归平台侧，租户侧不开放——与贸易设置同口径）；
 *   formal_start_at（单据正式开启时间）GET 只读展示，POST 绝不携带（后端出现即 400）；
 * - 权限：查看 perm_borrow_view / 修改 perm_borrow_manage（v-perm 按 URL 解析）；
 * - 模式：当前员工信息的统一 tenant_mode；同步准备状态不能由模式推断。
 */
import { computed, onMounted, ref } from 'vue'
import { Connection, Lock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  getBorrowSyncSettings,
  updateBorrowSyncSettings,
  type BorrowSyncSettingsResult,
} from '@/api/modules/borrow'
import { getMyProfile } from '@/api/modules/personnel'
import { readTenantMode, type TenantModeSnapshot } from '@/config/tenantMode'
import { usePermissionStore } from '@/stores/permission'
import SyncIntervalPanel from '@/components/sync-duration/SyncIntervalPanel.vue'
import SyncSettingsLayout from '@/components/sync-duration/SyncSettingsLayout.vue'
import { syncModeLabel } from '@/components/sync-duration/syncModeLabel'
import { formatDuration } from '@/components/sync-duration/format'

const permissionStore = usePermissionStore()
/** 仅查看权限的用户：输入禁用、保存隐藏（与生产同步设置卡同口径） */
const canManage = computed(() => permissionStore.hasUrlPerm('POST /api/v1/tenant-borrow/sync/settings/update'))

const loading = ref(false)
const saving = ref(false)
const settings = ref<BorrowSyncSettingsResult | null>(null)
const mode = ref<TenantModeSnapshot | null>(null)
const intervalSeconds = ref<number | undefined>(undefined)

const intervalBounds = computed(() => settings.value?.interval_bounds ?? { min: 300, max: 172800 })
const isDirty = computed(() => settings.value != null
  && intervalSeconds.value !== settings.value.sync_interval_seconds)

function resetInterval() {
  intervalSeconds.value = settings.value?.sync_interval_seconds
}

async function load() {
  loading.value = true
  try {
    const res = await getBorrowSyncSettings()
    settings.value = res.data
    intervalSeconds.value = res.data.sync_interval_seconds
  } catch {
    settings.value = null
    resetInterval()
  } finally {
    loading.value = false
  }
}

async function loadMode() {
  try {
    const res = await getMyProfile()
    mode.value = readTenantMode(res.data)
  } catch {
    mode.value = null
  }
}

async function save() {
  if (saving.value || loading.value || !canManage.value || !settings.value || !isDirty.value) return
  if (intervalSeconds.value == null) {
    ElMessage.warning('请选择同步间隔')
    return
  }
  const bounds = intervalBounds.value
  if (!Number.isInteger(intervalSeconds.value)
    || intervalSeconds.value < bounds.min
    || intervalSeconds.value > bounds.max) {
    ElMessage.warning(`同步间隔须在 ${formatDuration(bounds.min)} 至 ${formatDuration(bounds.max)} 之间`)
    return
  }
  saving.value = true
  try {
    const res = await updateBorrowSyncSettings({ sync_interval_seconds: intervalSeconds.value })
    settings.value.sync_interval_seconds = res.data.sync_interval_seconds
    resetInterval()
    ElMessage.success(res.message || '同步设置已保存')
  } catch {
    // 全局拦截器已弹错（403 文案含未开通/权限不足）
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  load()
  loadMode()
})
</script>
