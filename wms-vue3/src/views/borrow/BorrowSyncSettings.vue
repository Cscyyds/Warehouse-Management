<template>
  <div class="borrow-settings-page">
    <div class="page-head">
      <h2 class="page-title">借出借入同步设置</h2>
      <span class="page-sub">BORROW 模块独立配置，与采购/销售（贸易）同步设置互不影响</span>
    </div>

    <el-card shadow="never" class="section-card" v-loading="loading">
      <template #header>
        <div class="card-head">
          <span class="card-title">自动同步间隔</span>
          <span class="card-hint">修改即时生效（扫描器 ≤60 秒内按新值判定），无需重启</span>
        </div>
      </template>
      <el-form label-position="top" class="settings-form">
        <div class="settings-grid">
          <el-form-item>
            <template #label>
              同步间隔
            </template>
            <!-- 与「生产概览 → 同步设置」共用同一选择器（分钟/秒双滚轮弹层）：
                 间隔是低频配置且容忍粒度误差，滚轮比裸数字输入更不容易填错。 -->
            <SyncDurationPicker
              v-model="intervalSeconds"
              :min="settings?.interval_bounds?.min ?? 300"
              :max="settings?.interval_bounds?.max ?? 172800"
              :disabled="!canManage || !settings || saving"
            />
            <p class="field-tip">多久同步一次新单据。当前：{{ formatInterval(intervalSeconds) }}</p>
          </el-form-item>
          <el-form-item class="settings-actions">
            <el-button
              v-perm="'POST /api/v1/tenant-borrow/sync/settings/update'"
              type="primary"
              :loading="saving"
              :disabled="!settings || loading"
              @click="save"
            >保存</el-button>
            <el-button v-if="canManage" :disabled="saving || loading" @click="load">重置</el-button>
          </el-form-item>
        </div>
      </el-form>
    </el-card>

    <el-card shadow="never" class="section-card">
      <template #header><span class="card-title">同步范围与前置条件</span></template>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">借入侧</span>
          <span class="info-value">借入单（BN）+ 借入还出单（BB）两条线</span>
        </div>
        <div class="info-item">
          <span class="info-label">借出侧</span>
          <span class="info-value">借出单（LN）+ 借出还入单（LB）两条线</span>
        </div>
        <div class="info-item">
          <span class="info-label">模块形态</span>
          <span class="info-value">
            {{ mode?.borrow_mode || '-' }}
            <el-tag v-if="mode" :type="mode.erp_sync_enabled ? 'success' : 'info'" size="small" class="ml-6">
              ERP 同步{{ mode.erp_sync_enabled ? '已开启' : '未开启' }}
            </el-tag>
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">渠道编码</span>
          <span class="info-value">{{ mode?.channel_code || '-' }}</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
/**
 * 借出借入同步设置（D3 甲：独立页）。
 * - 端点：GET/POST /tenant-borrow/sync/settings[/update]，仅开放「间隔」一项
 *   （窗口跨度归平台侧，租户侧不开放——与贸易设置同口径）；
 * - 权限：查看 perm_borrow_view / 修改 perm_borrow_manage（v-perm 按 URL 解析）；
 * - 模式：GET /tenant-borrow/mode（identity 鉴权）用于展示模块形态与总开关，不参与页面可见性。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getBorrowMode,
  getBorrowSyncSettings,
  updateBorrowSyncSettings,
  type BorrowModeResult,
  type BorrowSyncSettingsResult,
} from '@/api/modules/borrow'
import { usePermissionStore } from '@/stores/permission'
import SyncDurationPicker from '@/components/sync-duration/SyncDurationPicker.vue'
import { formatDuration } from '@/components/sync-duration/format'

const permissionStore = usePermissionStore()
/** 仅查看权限的用户：输入禁用、保存隐藏（与生产同步设置卡同口径） */
const canManage = computed(() => permissionStore.hasUrlPerm('POST /api/v1/tenant-borrow/sync/settings/update'))

const loading = ref(false)
const saving = ref(false)
const settings = ref<BorrowSyncSettingsResult | null>(null)
const mode = ref<BorrowModeResult | null>(null)
const intervalSeconds = ref<number | undefined>(undefined)

function formatInterval(seconds?: number): string {
  if (!seconds) return '—'
  return `每 ${formatDuration(seconds)}`
}

async function load() {
  loading.value = true
  try {
    const res = await getBorrowSyncSettings()
    settings.value = res.data
    intervalSeconds.value = res.data.sync_interval_seconds
  } catch {
    settings.value = null
  } finally {
    loading.value = false
  }
}

async function loadMode() {
  try {
    const res = await getBorrowMode()
    mode.value = res.data
  } catch {
    mode.value = null
  }
}

async function save() {
  if (saving.value || loading.value) return
  if (!settings.value) {
    ElMessage.warning('请先加载同步设置')
    return
  }
  if (intervalSeconds.value == null) {
    ElMessage.warning('请选择同步间隔')
    return
  }
  const bounds = settings.value.interval_bounds
  if (bounds && (!Number.isInteger(intervalSeconds.value)
    || intervalSeconds.value < bounds.min
    || intervalSeconds.value > bounds.max)) {
    ElMessage.warning(`同步间隔须在 ${formatDuration(bounds.min)} 至 ${formatDuration(bounds.max)} 之间`)
    return
  }
  saving.value = true
  try {
    const res = await updateBorrowSyncSettings({ sync_interval_seconds: intervalSeconds.value })
    intervalSeconds.value = res.data.sync_interval_seconds
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

<style scoped>
.borrow-settings-page { display: flex; flex-direction: column; gap: 12px; }
.page-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.page-title { margin: 0; font-size: 18px; font-weight: 700; color: var(--text-primary); }
.page-sub { font-size: 12px; color: var(--text-secondary); }
.section-card { border-radius: var(--radius-md); }
.card-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.card-title { font-weight: 600; }
.card-hint { font-size: 12px; color: var(--text-tertiary); }
.settings-form { margin-top: 4px; }
.settings-grid { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0 32px; align-items: start; }
.settings-grid :deep(.el-form-item) { margin-bottom: 0; }
.settings-actions { align-self: end; padding-bottom: 2px; }
.settings-actions :deep(.el-form-item__content) { flex-wrap: nowrap; }
.field-tip { margin: 6px 0 0; font-size: 12px; color: var(--text-tertiary); line-height: 1.6; }
.info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px 24px; }
.info-item { display: flex; gap: 10px; font-size: 13px; line-height: 1.7; }
.info-label { flex: none; width: 72px; color: var(--text-secondary); }
.info-value { color: var(--text-primary); }
.ml-6 { margin-left: 6px; }
.scope-alert { margin-top: 14px; }
@media (max-width: 1100px) {
  .settings-grid { grid-template-columns: 1fr; gap: 16px 0; }
  .settings-actions { align-self: stretch; }
}
</style>
