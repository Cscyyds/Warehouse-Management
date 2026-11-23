<template>
  <SyncSettingsLayout
    title="其他入库同步设置"
    description="管理天心其他入库单的同步频率，查看历史回填和增量同步状态。"
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
      <section class="panel runtime-panel" aria-labelledby="other-inbound-runtime-title">
        <div class="panel-heading">
          <span class="panel-icon"><el-icon><Connection /></el-icon></span>
          <h3 id="other-inbound-runtime-title">运行态势</h3>
          <span class="read-only"><el-icon><Lock /></el-icon>只读</span>
        </div>
        <div>
          <p class="field-label" id="other-inbound-phase-label">同步阶段</p>
          <ol v-if="knownPhase" class="phase-track" aria-labelledby="other-inbound-phase-label">
            <li v-for="phase in phases" :key="phase.code" :aria-current="phase.code === settings?.phase ? 'step' : undefined">
              <span class="phase-marker" aria-hidden="true"></span>
              <span>
                <strong>{{ phase.label }}</strong>
                <code>{{ phase.code }}</code>
              </span>
              <span v-if="phase.code === settings?.phase" class="phase-current">当前</span>
            </li>
          </ol>
          <p v-else class="phase-unavailable">{{ settings?.phase || '暂无阶段信息' }}</p>
        </div>
        <dl class="runtime-details">
          <div>
            <dt>最近成功</dt>
            <dd class="data-value" :class="{ 'is-empty': !settings?.last_success_at }">
              {{ settings?.last_success_at || (settings ? '暂无记录' : '—') }}
            </dd>
          </div>
          <div>
            <dt>连续失败</dt>
            <dd class="data-value">
              {{ settings ? settings.consecutive_failures : '—' }}<span v-if="settings" class="data-unit"> 次</span>
              <el-tag v-if="settings && settings.consecutive_failures > 0" type="warning" size="small">需关注</el-tag>
            </dd>
          </div>
          <div>
            <dt>水位起点</dt>
            <dd class="data-value" :class="{ 'is-empty': !settings?.watermark_start }">
              {{ settings?.watermark_start || (settings ? '暂无记录' : '—') }}
            </dd>
          </div>
          <div>
            <dt>水位终点</dt>
            <dd class="data-value" :class="{ 'is-empty': !settings?.watermark_end }">
              {{ settings?.watermark_end || (settings ? '暂无记录' : '—') }}
            </dd>
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
      <dl class="scope-details">
        <div>
          <dt>单据范围</dt>
          <dd>其他入库单（XC，单管线）</dd>
        </div>
        <div>
          <dt>模块形态</dt>
          <dd>{{ syncModeLabel(mode?.mode) }}</dd>
        </div>
        <div>
          <dt>渠道编码</dt>
          <dd><code>{{ mode?.channel_code || '—' }}</code></dd>
        </div>
        <div>
          <dt>ERP 同步</dt>
          <dd>
            <el-tag v-if="mode" :type="mode.erp_sync_enabled ? 'success' : 'info'" size="small">
              {{ mode.erp_sync_enabled ? '已开启' : '未开启' }}
            </el-tag>
            <span v-else>—</span>
          </dd>
        </div>
      </dl>
    </template>
  </SyncSettingsLayout>
</template>

<script setup lang="ts">
/**
 * 其他入库同步设置（2026-11-18 随 WS0 新建）。
 * - 端点：GET/POST /tenant-other-inbound/sync/settings[/update]，仅开放「间隔」一项；
 *   GET 返回 8 字段：间隔/bounds + 运行态势（phase/水位/最近成功/连续失败）+ formal_start_at；
 *   formal_start_at（单据正式开启时间）只读展示，POST 绝不携带（后端出现即 400）；
 * - 权限：settings GET 归 perm_other_inbound_manage（与 borrow 归 view 不同，D12），
 *   页面可见性绑定 view=manage 码；v-perm 按 URL 解析；
 * - 模式：GET /tenant-other-inbound/mode（identity 鉴权）仅用于展示，不参与页面可见性。
 */
import { computed, onMounted, ref } from 'vue'
import { Connection, Lock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  getOtherInboundMode,
  getOtherInboundSyncSettings,
  updateOtherInboundSyncSettings,
  type OtherInboundModeResult,
  type OtherInboundSyncSettingsResult,
} from '@/api/modules/otherInbound'
import { usePermissionStore } from '@/stores/permission'
import SyncIntervalPanel from '@/components/sync-duration/SyncIntervalPanel.vue'
import SyncSettingsLayout from '@/components/sync-duration/SyncSettingsLayout.vue'
import { syncModeLabel } from '@/components/sync-duration/syncModeLabel'
import { formatDuration } from '@/components/sync-duration/format'

const permissionStore = usePermissionStore()
const canManage = computed(() => permissionStore.hasUrlPerm('POST /api/v1/tenant-other-inbound/sync/settings/update'))

const loading = ref(false)
const saving = ref(false)
const settings = ref<OtherInboundSyncSettingsResult | null>(null)
const mode = ref<OtherInboundModeResult | null>(null)
const intervalSeconds = ref<number | undefined>(undefined)

const phases = [
  { code: 'BACKFILL', label: '历史回填' },
  { code: 'INCREMENTAL', label: '增量同步' },
]
const knownPhase = computed(() => phases.some(phase => phase.code === settings.value?.phase))
const intervalBounds = computed(() => settings.value?.interval_bounds ?? { min: 300, max: 172800 })
const isDirty = computed(() => settings.value != null
  && intervalSeconds.value !== settings.value.sync_interval_seconds)

function resetInterval() {
  intervalSeconds.value = settings.value?.sync_interval_seconds
}

async function load() {
  loading.value = true
  try {
    const res = await getOtherInboundSyncSettings()
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
    const res = await getOtherInboundMode()
    mode.value = res.data
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
    const res = await updateOtherInboundSyncSettings({ sync_interval_seconds: intervalSeconds.value })
    const savedInterval = res.data.sync_interval_seconds
    settings.value.sync_interval_seconds = savedInterval
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

<style scoped>
.phase-track {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.phase-track li {
  position: relative;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--sync-muted);
}

.phase-track li + li::before {
  position: absolute;
  top: 50%;
  right: 100%;
  width: 15px;
  border-top: 1px solid var(--border-color);
  content: '';
}

.phase-track li[aria-current] {
  background: var(--primary-bg);
  border-color: var(--primary-border);
  color: var(--sync-accent);
}

.phase-track strong, .phase-track code { display: block; }
.phase-track strong { font-size: 14px; }
.phase-track code { margin-top: 3px; font-size: 10px; }
.phase-marker { flex: none; width: 8px; height: 8px; border: 1px solid currentColor; border-radius: 50%; }
[aria-current] .phase-marker { background: currentColor; }
.phase-current { margin-left: auto; font-size: 11px; white-space: nowrap; }
.phase-unavailable { margin: 0; padding: 12px 0; font-size: 13px; overflow-wrap: anywhere; }

@container (max-width: 340px) {
  .phase-track { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .phase-track li + li::before { display: none; }
}
</style>
