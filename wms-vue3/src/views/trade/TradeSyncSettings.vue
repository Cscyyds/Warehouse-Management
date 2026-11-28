<template>
  <SyncSettingsLayout
    title="贸易同步设置"
    description="管理采购、销售与出库单共用的自动同步间隔。"
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
              <el-tag v-if="mode" :type="mode.tenant_mode === 'TIANXIN' ? 'success' : 'info'" size="small">
                {{ syncModeLabel(mode.tenant_mode) }}
              </el-tag>
              <span v-else>—</span>
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
          <dt>采购侧</dt>
          <dd>采购订单 + 采购退货单</dd>
        </div>
        <div>
          <dt>销售侧</dt>
          <dd>销售订单 + 销售退货单 + 出库单</dd>
        </div>
      </dl>
    </template>
  </SyncSettingsLayout>
</template>

<script setup lang="ts">
/**
 * 贸易同步设置（2026-11-18 补建，Q2/Q6 决议：采购+销售双菜单入口、同一页面）。
 * - 端点：GET/POST /tenant-trade/sync/settings[/update]，仅开放「间隔」一项；
 *   GET 仅 3 字段（interval/bounds/formal_start_at），sync_window_days 已于 2026-10-06 收口移除；
 *   formal_start_at（单据正式开启时间）只读展示，POST 绝不携带（后端出现即 400）；
 * - 权限：两个 settings 码（采购侧/销售侧）任一即完整能力，v-perm 按 URL 解析；
 * - 模式：当前员工信息的统一 tenant_mode；同步准备状态不能由模式推断。
 */
import { computed, onMounted, ref } from 'vue'
import { Connection, Lock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  getTradeSyncSettings,
  updateTradeSyncSettings,
  type TradeSyncSettingsResult,
} from '@/api/modules/trade'
import { getMyProfile } from '@/api/modules/personnel'
import { readTenantMode, type TenantModeSnapshot } from '@/config/tenantMode'
import { usePermissionStore } from '@/stores/permission'
import SyncIntervalPanel from '@/components/sync-duration/SyncIntervalPanel.vue'
import SyncSettingsLayout from '@/components/sync-duration/SyncSettingsLayout.vue'
import { syncModeLabel } from '@/components/sync-duration/syncModeLabel'
import { formatDuration } from '@/components/sync-duration/format'

const permissionStore = usePermissionStore()
/** 仅查看权限的用户：输入禁用、保存隐藏（与借出/生产设置同口径） */
const canManage = computed(() => permissionStore.hasUrlPerm('POST /api/v1/tenant-trade/sync/settings/update'))

const loading = ref(false)
const saving = ref(false)
const settings = ref<TradeSyncSettingsResult | null>(null)
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
    const res = await getTradeSyncSettings()
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
    const res = await updateTradeSyncSettings({ sync_interval_seconds: intervalSeconds.value })
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
