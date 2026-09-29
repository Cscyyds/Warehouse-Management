<script setup lang="ts">
/**
 * 生产管理 · 贸易形态 Tab
 *
 * 作用：决定该租户**是否处于天心贸易模式**。
 * 本质是改写 `sys_tenant_module_config` 中 `PURCHASE_SALES` 与 `FINANCE` 两行的 `enable` 字段
 * —— 后端约束两者必须同值（`validate_module_form`），天心模式下还会把
 * `PURCHASE_SALES.channel_code` 置为 `TIANXIN`；同开（本系统模式）时 channel 恒置空。
 * 因此这里**只提供两种形态选择**，不做成两个独立开关（那样会允许提交必然 400 的组合）。
 *
 * 接口（平台管理员 JWT 鉴权）：
 *   GET  /platform-trade/configs/query?tenant_id=…   查询当前形态
 *   POST /platform-trade/configs/update              （Form）更新形态
 *
 * 与 ModuleConfigTab 的分工：本 Tab 只管「采购/销售 + 财务」两行；生产模块（PRODUCTION）
 * 那一行由 ModuleConfigTab 管，两者互不影响（module_code 不同）。
 *
 * ERP数据同步总开关（2026-09-22 批次）：PURCHASE_SALES 行的 erp_sync_enabled 列（int 0/1）
 * 亦在本 Tab 维护 —— 后端 configs/update 是整表单重写语义，**每次保存都会回写该列**，
 * 故提交时无条件显式携带现值（enable_erp_sync），否则任何形态切换都会把开关重置为关。
 */
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { queryTradeConfig, updateTradeConfig, type TradeConfigResult } from '@/api/platformTrade'

const props = defineProps<{
  tenantId: string
  /** 兄弟 Tab 写成功后的版本号：驱动本 Tab 重新拉取快照 */
  dataVersion: number
}>()

const emit = defineEmits<{ (e: 'changed'): void }>()

type TradeMode = 'NATIVE' | 'TIANXIN'

const MODE_TEXT: Record<TradeMode, string> = {
  NATIVE: '本系统模式',
  TIANXIN: '天心贸易模式',
}

const loading = ref(false)
const submitting = ref(false)
const config = ref<TradeConfigResult | null>(null)
const loadError = ref('')

/** 表单 = 两种形态 + 天心ERP数据同步总开关（后者仅天心形态有语义） */
const form = ref<{ mode: TradeMode; erpSyncEnabled: 0 | 1 }>({ mode: 'NATIVE', erpSyncEnabled: 0 })

const isTianxin = computed(() => Boolean(config.value?.is_tianxin_trade_mode))
const originalMode = computed<TradeMode>(() => (isTianxin.value ? 'TIANXIN' : 'NATIVE'))
/** 开关现值快照（null/无行按 0），提交时必须显式回传 —— 后端是整表单重写语义，缺省即重置为关 */
const originalErpSync = computed<0 | 1>(() =>
  Number(config.value?.purchase_sales?.erp_sync_enabled ?? 0) === 1 ? 1 : 0,
)
const dirty = computed(
  () => form.value.mode !== originalMode.value || form.value.erpSyncEnabled !== originalErpSync.value,
)
const canSubmit = computed(
  () => Boolean(config.value) && dirty.value && !submitting.value && !loading.value,
)

const modeHint = computed(() =>
  form.value.mode === 'TIANXIN'
    ? '天心接管采购/销售与财务：WMS 原生对应接口停用，四单据页就地切换为天心数据。'
    : '本系统接管采购/销售与财务：WMS 原生功能全部可用。',
)

/** 开关仅在天心形态下展示（NATIVE 下无语义，后端按关处理）；关闭时租户侧自动同步停止投递、手动同步入口 403 */
const erpSyncDirty = computed(() => form.value.erpSyncEnabled !== originalErpSync.value)

async function load() {
  if (!props.tenantId) return
  loading.value = true
  loadError.value = ''
  try {
    const data = await queryTradeConfig(props.tenantId)
    config.value = data
    form.value.mode = data.is_tianxin_trade_mode ? 'TIANXIN' : 'NATIVE'
    // 无 PURCHASE_SALES 行时 erp_sync_enabled 为 null，按关处理（与 channel_code 同口径）
    form.value.erpSyncEnabled = Number(data.purchase_sales?.erp_sync_enabled ?? 0) === 1 ? 1 : 0
  } catch (error) {
    // 加载失败必须清空 config 并禁用保存：否则 config=null 会按「本系统模式」渲染，
    // 管理员一点保存就把已开通的模块形态改掉。
    config.value = null
    loadError.value = error instanceof Error ? error.message : '查询失败'
    ElMessage.error(loadError.value)
  } finally {
    loading.value = false
  }
}

watch(() => [props.tenantId, props.dataVersion], load, { immediate: true })

async function handleSubmit() {
  if (!canSubmit.value) return
  const target = form.value.mode

  // 切换会实际改变租户可用功能（天心模式下写接口 403、财务全端点封锁），属高风险操作 → 二次确认
  const confirmLines = target === 'TIANXIN'
    ? [
        '• 该租户的采购/销售/财务写接口将被封锁（403）',
        '• 财务全部端点（含查询）封锁',
        '• 租户端「采购订单 / 采购退货单 / 销售订单 / 销售退货单」四个页面就地切换为天心单据',
        '• 首次切换会自动初始化 4 个贸易单据的同步状态',
        `• 天心ERP数据同步总开关：${form.value.erpSyncEnabled === 1 ? '开启（自动同步与手动同步可用）' : '关闭（租户侧自动同步停止、手动同步入口不可用，可随后单独开启）'}`,
      ]
    : [
        '• 恢复该租户的采购/销售/财务接口',
        '• 上述四个页面恢复为 WMS 原页面',
        '• 已同步的天心贸易数据保留但不再更新',
        ...(originalErpSync.value === 1
          ? ['• 天心ERP数据同步总开关将一并关闭（后端口径：非天心形态恒置关；如需再启用请切回天心形态后重新开启）']
          : []),
      ]

  try {
    await ElMessageBox.confirm(`${confirmLines.join('\n')}\n\n确认切换？`, `切换为${MODE_TEXT[target]}`, {
      confirmButtonText: '确认切换',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  submitting.value = true
  try {
    const result = await updateTradeConfig({
      tenant_id: props.tenantId,
      // 本系统模式 = 两开关同开（true）；天心模式 = 两开关同关（false）
      need_finance_module: String(target === 'NATIVE'),
      need_purchase_sales_module: String(target === 'NATIVE'),
      // 同关时必填；同开时后端忽略，此处不传
      external_software: target === 'TIANXIN' ? 'TIANXIN' : undefined,
      // ⚠️ 整表单重写语义：无论是否改动了开关，每次保存都必须显式携带现值，否则被重置为关
      enable_erp_sync: String(form.value.erpSyncEnabled === 1),
    })
    const erpSyncSuffix = target === 'TIANXIN'
      ? `，ERP数据同步${result.erp_sync_enabled === 1 ? '已开启' : '为关闭'}`
      : ''
    ElMessage.success(
      result.states_created > 0
        ? `已切为${MODE_TEXT[target]}，并初始化 ${result.states_created} 个贸易单据同步状态${erpSyncSuffix}`
        : `已切为${MODE_TEXT[target]}${erpSyncSuffix}`,
    )
    await load()
    emit('changed')
  } catch (error) {
    // 400（两开关不同值 / 未指定 external_software / 不支持的软件方）由 http 拦截器抛 ApiError
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="trade-mode-tab">
    <el-alert
      v-if="loadError"
      class="tab-notice"
      type="error"
      show-icon
      :closable="false"
      title="贸易形态查询失败，已禁用保存"
      :description="`${loadError}（避免把「加载失败」误当成「本系统模式」而误改租户形态）`"
    />

    <div v-else-if="config" class="config-meta">
      <span class="mono-label">CURRENT MODE</span>
      <span>当前形态
        <el-tag size="small" effect="dark" :type="isTianxin ? 'warning' : 'success'">
          {{ MODE_TEXT[originalMode] }}
        </el-tag>
      </span>
    </div>

    <el-alert
      class="tab-notice"
      type="info"
      show-icon
      :closable="false"
      title="该配置直接决定租户是否处于天心贸易模式"
      description=""
    />

    <el-form v-loading="loading" label-position="top" class="dense-form config-form">
      <el-form-item label="模块形态">
        <el-radio-group v-model="form.mode" :disabled="!config">
          <el-radio-button value="NATIVE">本系统模式</el-radio-button>
          <el-radio-button value="TIANXIN">天心贸易模式</el-radio-button>
        </el-radio-group>
        <p class="field-hint">{{ modeHint }}</p>
      </el-form-item>

      <el-form-item v-if="form.mode === 'TIANXIN'" label="外部软件方" required>
        <el-input model-value="TIANXIN" disabled style="width: 200px" />
        <p class="field-hint">两开关同关时必填；当前后端仅支持 TIANXIN。</p>
      </el-form-item>

      <el-form-item v-if="form.mode === 'TIANXIN'" label="ERP数据同步（总开关）">
        <el-switch
          v-model="form.erpSyncEnabled"
          :active-value="1"
          :inactive-value="0"
          inline-prompt
          active-text="开启"
          inactive-text="关闭"
        />
        <p class="field-hint">
          关闭时：该租户天心自动同步（含每日对账）停止投递、租户侧手动同步/重启/失败记录入口隐藏（403）；
          重新开启后增量窗口自旧水位连续衔接补齐，停扫期间数据不丢。存租户上线默认为关，须在此逐租户开启。
        </p>
      </el-form-item>

      <div class="config-actions">
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >保存形态</el-button>
        <span class="action-hint">
          {{ !config
            ? '配置未加载，暂不可保存'
            : (dirty
              ? `将保存：${form.mode !== originalMode ? `切换为「${MODE_TEXT[form.mode]}」` : '形态不变'}${erpSyncDirty ? `，ERP数据同步${form.erpSyncEnabled === 1 ? '开启' : '关闭'}` : ''}`
              : '当前已是最新配置') }}
        </span>
      </div>
    </el-form>
  </div>
</template>

<style scoped>
.trade-mode-tab { display: grid; gap: 18px; }
.tab-notice :deep(.el-alert__title) { font-weight: 700; }
.config-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #f7f9fb;
  color: #68798c;
  font-size: 11px;
}
.config-form { max-width: 900px; }
.field-hint { margin: 6px 0 0; color: #8a98a7; font-size: 11px; line-height: 1.6; max-width: 720px; }
.config-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-top: 6px;
  border-top: 1px solid var(--line);
  margin-top: 4px;
}
.config-actions .el-button { min-width: 130px; height: 40px; font-weight: 700; }
.action-hint { color: #8a98a7; font-size: 11px; }
</style>
