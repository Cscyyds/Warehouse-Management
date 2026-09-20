<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { deleteProductionConfig, updateProductionConfig } from '@/api/productionManagement'
import type { ChannelItem, ProductionConfigDetail } from '@/types/productionManagement'

const props = defineProps<{
  tenantId: string
  channels: ChannelItem[]
  config: ProductionConfigDetail | null
  enabled: boolean
  /** 父级租户详情（③）是否已成功加载；未成功前禁止保存，
   *  否则 config=null 会按「未配置」渲染（enabled=0），一点保存就把已开通的模块关掉。 */
  detailLoaded: boolean
}>()

const emit = defineEmits<{ (e: 'changed'): void }>()

interface ConfigForm {
  enabled: 0 | 1
  channel_code: string
  sync_interval_seconds: number | undefined
  sync_window_days: number | undefined
  initial_backfill_days: number | undefined
  reconcile_days: number | undefined
  remark: string
}

const saving = ref(false)
const deleting = ref(false)
const deleteDialogOpen = ref(false)
const purgeSyncState = ref(false)

const form = reactive<ConfigForm>({
  enabled: 0,
  channel_code: '',
  sync_interval_seconds: undefined,
  sync_window_days: undefined,
  initial_backfill_days: undefined,
  reconcile_days: undefined,
  remark: '',
})

/**
 * 参数上下限，对齐后端 app/core/config.py 与 services/production/sync/state.py：
 * - sync_interval_seconds / sync_window_days 会被 effective_*() 按 300~172800 秒 / 1~180 天钳制，
 *   前端取同一区间，避免存进去的值与实际生效不一致；
 * - initial_backfill_days / reconcile_days 后端仅要求正整数，3650 天为前端护栏（防误填超大值拖慢同步）。
 */
const SYNC_INTERVAL_MIN = 300
const SYNC_INTERVAL_MAX = 172800
const SYNC_WINDOW_MIN = 1
const SYNC_WINDOW_MAX = 180
const BACKFILL_DAYS_MAX = 3650
const RECONCILE_DAYS_MAX = 3650

/** 正整数才提交，其余（空/非法）转为 undefined，交由 toUrlEncoded 丢弃 = 后端「不传不改」 */
function positiveOrUndefined(value: number | undefined): number | undefined {
  return typeof value === 'number' && value > 0 ? value : undefined
}

function fillForm(config: ProductionConfigDetail | null) {
  if (!config) {
    Object.assign(form, {
      enabled: 0,
      channel_code: '',
      sync_interval_seconds: undefined,
      sync_window_days: undefined,
      initial_backfill_days: undefined,
      reconcile_days: undefined,
      remark: '',
    })
    return
  }
  Object.assign(form, {
    enabled: config.enabled === 1 ? 1 : 0,
    channel_code: config.channel_code || '',
    sync_interval_seconds: config.sync_interval_seconds ?? undefined,
    sync_window_days: config.sync_window_days ?? undefined,
    initial_backfill_days: config.initial_backfill_days ?? undefined,
    reconcile_days: config.reconcile_days ?? undefined,
    remark: config.remark || '',
  })
}

watch(() => props.config, fillForm, { immediate: true })

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

/** 与后端约束保持一致的前置校验，避免存进去的值被后端静默钳制 */
function validateConfig(): string | null {
  if (form.enabled === 1 && !form.channel_code) return '启用生产模块时必须选择渠道'
  if (form.sync_interval_seconds != null
    && (form.sync_interval_seconds < SYNC_INTERVAL_MIN || form.sync_interval_seconds > SYNC_INTERVAL_MAX)) {
    return `同步间隔须在 ${SYNC_INTERVAL_MIN}~${SYNC_INTERVAL_MAX} 秒之间`
  }
  if (form.sync_window_days != null
    && (form.sync_window_days < SYNC_WINDOW_MIN || form.sync_window_days > SYNC_WINDOW_MAX)) {
    return `分片跨度须在 ${SYNC_WINDOW_MIN}~${SYNC_WINDOW_MAX} 天之间`
  }
  if (form.initial_backfill_days != null
    && (form.initial_backfill_days < 1 || form.initial_backfill_days > BACKFILL_DAYS_MAX)) {
    return `首轮回填天数须在 1~${BACKFILL_DAYS_MAX} 天之间`
  }
  if (form.reconcile_days != null
    && (form.reconcile_days < 1 || form.reconcile_days > RECONCILE_DAYS_MAX)) {
    return `对账回看天数须在 1~${RECONCILE_DAYS_MAX} 天之间`
  }
  return null
}

async function save() {
  if (!props.detailLoaded) {
    ElMessage.warning('租户配置尚未加载成功，已禁用保存以免误改')
    return
  }
  const invalid = validateConfig()
  if (invalid) { ElMessage.warning(invalid); return }
  saving.value = true
  try {
    const data = await updateProductionConfig({
      tenant_id: props.tenantId,
      enabled: form.enabled,
      channel_code: form.enabled === 1 ? form.channel_code : (form.channel_code || undefined),
      sync_interval_seconds: positiveOrUndefined(form.sync_interval_seconds),
      sync_window_days: positiveOrUndefined(form.sync_window_days),
      initial_backfill_days: positiveOrUndefined(form.initial_backfill_days),
      reconcile_days: positiveOrUndefined(form.reconcile_days),
      remark: form.remark.trim(),
    })
    ElMessage.success(data.created ? '生产模块配置已创建' : '生产模块配置已更新')
    emit('changed')
  } catch (error) {
    ElMessage.error(errorMessage(error, '生产模块配置保存失败'))
  } finally {
    saving.value = false
  }
}

function openDeleteDialog() {
  purgeSyncState.value = false
  deleteDialogOpen.value = true
}

async function confirmDelete() {
  deleting.value = true
  try {
    await deleteProductionConfig({
      tenant_id: props.tenantId,
      purge_sync_state: purgeSyncState.value ? 1 : 0,
    })
    ElMessage.success(purgeSyncState.value ? '配置已删除，同步水位已清除' : '配置已删除，同步水位已保留')
    deleteDialogOpen.value = false
    emit('changed')
  } catch (error) {
    ElMessage.error(errorMessage(error, '生产模块配置删除失败'))
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="module-config-tab">
    <el-alert
      v-if="!config"
      class="tab-notice"
      type="info"
      show-icon
      :closable="false"
      title="该租户尚未配置生产模块"
      description="打开开关并选择渠道后保存即可完成首次开通；首次开启会自动初始化 13 个单据的同步状态。"
    />
    <div v-else class="config-meta">
      <span class="mono-label">CURRENT CONFIG</span>
      <span>配置号 <code>{{ config.config_id }}</code></span>
      <span v-if="config.updated_by_name">最后修改 {{ config.updated_by_name }}</span>
      <span v-if="config.updated_at">更新于 {{ config.updated_at }}</span>
    </div>

    <el-form label-position="top" class="dense-form config-form">
      <div class="form-row">
        <el-form-item label="生产模块开关">
          <el-switch v-model="form.enabled" :active-value="1" :inactive-value="0" inline-prompt active-text="开启" inactive-text="关闭" />
          <p class="field-hint">关闭后租户端生产页面立即 403，已同步数据保留，重新开启从原水位续扫。</p>
        </el-form-item>
        <el-form-item label="接入渠道" :required="form.enabled === 1">
          <el-select v-model="form.channel_code" clearable placeholder="选择 ERP 渠道" :disabled="form.enabled === 0">
            <el-option
              v-for="item in channels"
              :key="item.channel_code"
              :label="item.channel_name"
              :value="item.channel_code"
              :disabled="!item.available"
            >
              <span>{{ item.channel_name }}</span>
              <span v-if="!item.available" class="channel-reserved">预留占位</span>
              <span v-else class="channel-doc-count">{{ item.supported_doc_count }} 单据</span>
            </el-option>
          </el-select>
          <p class="field-hint">切换渠道后同步状态行将按新渠道重建。</p>
        </el-form-item>
      </div>

      <div class="form-row form-row--four">
        <el-form-item :label="`同步间隔（秒，${SYNC_INTERVAL_MIN}~${SYNC_INTERVAL_MAX}）`">
          <el-input-number v-model="form.sync_interval_seconds" :min="SYNC_INTERVAL_MIN" :max="SYNC_INTERVAL_MAX" :step="60" controls-position="right" placeholder="默认 600" />
        </el-form-item>
        <el-form-item :label="`分片跨度（天，${SYNC_WINDOW_MIN}~${SYNC_WINDOW_MAX}）`">
          <el-input-number v-model="form.sync_window_days" :min="SYNC_WINDOW_MIN" :max="SYNC_WINDOW_MAX" controls-position="right" placeholder="默认 31" />
        </el-form-item>
        <el-form-item :label="`首轮回填天数（1~${BACKFILL_DAYS_MAX}）`">
          <el-input-number v-model="form.initial_backfill_days" :min="1" :max="BACKFILL_DAYS_MAX" controls-position="right" placeholder="默认 365" />
        </el-form-item>
        <el-form-item :label="`对账回看天数（1~${RECONCILE_DAYS_MAX}）`">
          <el-input-number v-model="form.reconcile_days" :min="1" :max="RECONCILE_DAYS_MAX" controls-position="right" placeholder="默认 90" />
        </el-form-item>
      </div>
      <p class="form-tip">
        留空表示沿用后端默认值（600 秒 / 31 天 / 365 天 / 90 天）。同步间隔与分片跨度由后端按上述区间钳制；回填/对账天数上限为前端护栏。
      </p>

      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="500" placeholder="选填" />
      </el-form-item>

      <div class="config-actions">
        <el-button type="primary" :loading="saving" :disabled="!detailLoaded" @click="save">保存配置</el-button>
        <el-button
          type="danger"
          plain
          :disabled="!config || enabled"
          @click="openDeleteDialog"
        >删除配置</el-button>
        <span v-if="!detailLoaded" class="field-hint">配置尚未加载成功，保存已禁用（避免把「加载失败」当成「未配置」而误改）。</span>
        <span v-else-if="config && enabled" class="field-hint">模块启用中，需先关闭才能删除配置。</span>
      </div>
    </el-form>

    <el-dialog v-model="deleteDialogOpen" title="删除生产模块配置" width="520px" :close-on-click-modal="false">
      <div class="dialog-notice">
        <span class="mono-label">DELETE CONFIG</span>
        <p>删除后配置回归「从未开通」态；已同步进 WMS 的单据数据始终保留。此操作不可撤销。</p>
      </div>
      <el-checkbox v-model="purgeSyncState">同时清除同步水位（下次开启将从首轮回填天数前重新全量回填）</el-checkbox>
      <template #footer>
        <el-button @click="deleteDialogOpen = false">取消</el-button>
        <el-button type="danger" :loading="deleting" @click="confirmDelete">确认删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.module-config-tab { display: grid; gap: 18px; }
.tab-notice :deep(.el-alert__title) { font-weight: 700; }
.config-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; padding: 12px 16px; border: 1px solid var(--line); border-radius: 10px; background: #f7f9fb; color: #68798c; font-size: 11px; }
.config-meta code { color: var(--scanner-blue); }
.config-form { max-width: 900px; }
.form-row--four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.field-hint { margin: 6px 0 0; color: #8a98a7; font-size: 11px; line-height: 1.5; }
.form-tip { margin: -6px 0 18px; color: #8a98a7; font-size: 11px; }
.channel-reserved { margin-left: 8px; color: #b0642a; font-size: 11px; }
.channel-doc-count { margin-left: 8px; color: #8a98a7; font-size: 11px; }
.config-actions { display: flex; align-items: center; gap: 14px; padding-top: 6px; border-top: 1px solid var(--line); margin-top: 4px; }
.config-actions .el-button { min-width: 130px; height: 40px; font-weight: 700; }
@media (max-width: 1180px) {
  .form-row--four { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
