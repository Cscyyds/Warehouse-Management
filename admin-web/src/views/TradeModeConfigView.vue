<script setup lang="ts">
/**
 * 平台管理员侧：贸易形态配置（doc 19 §1.2）
 *
 * 功能：
 *   - 选择租户 → 查询当前贸易模块形态（finance / purchase_sales 开关 + 是否天心模式）
 *   - 修改两开关（强制同值）+ external_software（同关时必填 TIANXIN）
 *   - 切换确认弹窗（doc 1.2.2 切换语义）→ 提交 → 展示 states_created
 */
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { queryPlatformTenants, type TenantOptionRow } from '@/api/platformQueries'
import {
  queryTradeConfig,
  updateTradeConfig,
  type TradeConfigResult,
  type UpdateTradeConfigResult,
} from '@/api/platformTrade'

// ── 租户选择 ──
const tenantLoading = ref(false)
const tenantOptions = ref<TenantOptionRow[]>([])
const selectedTenantCode = ref('')

const selectedTenant = computed(() =>
  tenantOptions.value.find((t) => t.tenant_code === selectedTenantCode.value) || null,
)

async function searchTenants(keyword: string) {
  tenantLoading.value = true
  try {
    const data = await queryPlatformTenants({ keyword: keyword.trim() || undefined, page_size: 50 })
    tenantOptions.value = data.tenant
  } catch (error) {
    tenantOptions.value = []
    ElMessage.error(error instanceof Error ? error.message : '租客列表加载失败')
  } finally {
    tenantLoading.value = false
  }
}

// ── 配置查询 ──
const configLoading = ref(false)
const config = ref<TradeConfigResult | null>(null)
const configError = ref('')

async function loadConfig() {
  if (!selectedTenantCode.value) return
  configLoading.value = true
  configError.value = ''
  config.value = null
  try {
    config.value = await queryTradeConfig(selectedTenantCode.value)
    // 回填表单
    form.value.needFinance = config.value.finance?.enabled ?? false
    form.value.needPurchaseSales = config.value.purchase_sales?.enabled ?? false
    form.value.externalSoftware = config.value.is_tianxin_trade_mode ? 'TIANXIN' : ''
  } catch (error) {
    configError.value = error instanceof Error ? error.message : '查询失败'
    ElMessage.error(configError.value)
  } finally {
    configLoading.value = false
  }
}

function onTenantChange() {
  config.value = null
  configError.value = ''
  loadConfig()
}

// ── 表单 ──
const form = ref({
  needFinance: false,
  needPurchaseSales: false,
  externalSoftware: '',
})

const submitting = ref(false)
const lastResult = ref<UpdateTradeConfigResult | null>(null)

/** 当前是否天心贸易模式（两开关同关 + external_software=TIANXIN） */
const isTianxinMode = computed(() =>
  !form.value.needFinance && !form.value.needPurchaseSales && form.value.externalSoftware === 'TIANXIN',
)

/** 原配置是否天心模式（用于判断切换方向） */
const wasTianxinMode = computed(() => config.value?.is_tianxin_trade_mode ?? false)

/** 两开关强制同值（doc 1.2.2 约束） */
function syncSwitches(val: boolean) {
  form.value.needFinance = val
  form.value.needPurchaseSales = val
  if (val) {
    // 同开时 external_software 忽略并置空
    form.value.externalSoftware = ''
  }
}

function onFinanceChange(val: boolean) { syncSwitches(val) }
function onPurchaseSalesChange(val: boolean) { syncSwitches(val) }

/** 提交前校验 */
const canSubmit = computed(() => {
  if (!selectedTenantCode.value) return false
  if (configLoading.value || submitting.value) return false
  // 两开关同关时 external_software 必填
  if (!form.value.needFinance && !form.value.needPurchaseSales && !form.value.externalSoftware) return false
  return true
})

async function handleSubmit() {
  if (!canSubmit.value || !selectedTenantCode.value) return

  // 切换确认弹窗（doc 1.2.2 切换语义）
  const switchingToTianxin = isTianxinMode.value && !wasTianxinMode.value
  const switchingToNative = !isTianxinMode.value && wasTianxinMode.value

  if (switchingToTianxin) {
    try {
      await ElMessageBox.confirm(
        '切为天心贸易模式后：\n' +
        '• 该租户的原采购/销售/财务写接口将被封锁（403）\n' +
        '• 财务全部端点（含查询）封锁\n' +
        '• 租客端「采购订单 / 采购退货单 / 销售订单 / 销售退货单」四个页面就地切换为天心单据\n\n' +
        '确认切换？',
        '切换为天心贸易模式',
        { confirmButtonText: '确认切换', cancelButtonText: '取消', type: 'warning' },
      )
    } catch { return }
  } else if (switchingToNative) {
    try {
      await ElMessageBox.confirm(
        '切回本系统模式后：\n' +
        '• 恢复原采购/销售/财务接口\n' +
        '• 上述四个页面恢复为 WMS 原页面\n' +
        '• 已同步的天心贸易数据保留但不再更新\n\n' +
        '确认切换？',
        '切回本系统模式',
        { confirmButtonText: '确认切换', cancelButtonText: '取消', type: 'warning' },
      )
    } catch { return }
  }

  submitting.value = true
  lastResult.value = null
  try {
    const result = await updateTradeConfig({
      tenant_id: selectedTenantCode.value,
      need_finance_module: String(form.value.needFinance),
      need_purchase_sales_module: String(form.value.needPurchaseSales),
      external_software: form.value.externalSoftware || undefined,
    })
    lastResult.value = result
    ElMessage.success(
      result.states_created > 0
        ? `保存成功，已初始化 ${result.states_created} 个贸易单据同步状态`
        : '保存成功',
    )
    // 刷新配置快照
    await loadConfig()
  } catch (error) {
    // 400 错误（两开关不同值/未指定 external_software/不支持的软件方）由 http 拦截器抛 ApiError
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    submitting.value = false
  }
}

// 初始加载租户列表
searchTenants('')
</script>

<template>
  <div class="trade-mode-config">
    <PageHeader eyebrow="PLATFORM" title="贸易形态配置" description="管理租户的采购/销售与财务模块形态（本系统 / 天心 ERP）" marker="TRADE" />

    <!-- 租户选择 -->
    <el-card shadow="never" class="section-card">
      <template #header><span class="card-title">选择租户</span></template>
      <el-select
        v-model="selectedTenantCode"
        filterable
        remote
        reserve-keyword
        placeholder="输入租户编码或名称搜索"
        :remote-method="searchTenants"
        :loading="tenantLoading"
        style="width: 360px"
        @change="onTenantChange"
      >
        <el-option
          v-for="t in tenantOptions"
          :key="t.tenant_code"
          :label="`${t.tenant_code} - ${t.tenant_name}`"
          :value="t.tenant_code"
        />
      </el-select>
      <span v-if="selectedTenant" class="tenant-hint">
        当前：{{ selectedTenant.tenant_name }}（{{ selectedTenant.tenant_code }}）
      </span>
    </el-card>

    <!-- 当前配置状态 -->
    <el-card v-if="config" shadow="never" class="section-card" v-loading="configLoading">
      <template #header><span class="card-title">当前形态</span></template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="财务模块">
          <el-tag :type="config.finance?.enabled ? 'success' : 'info'" size="small">
            {{ config.finance?.enabled ? '已启用' : '已停用' }}
          </el-tag>
          <span v-if="!config.finance?.exists" class="hint">（未创建配置行）</span>
        </el-descriptions-item>
        <el-descriptions-item label="采购/销售模块">
          <el-tag :type="config.purchase_sales?.enabled ? 'success' : 'info'" size="small">
            {{ config.purchase_sales?.enabled ? '已启用' : '已停用' }}
          </el-tag>
          <span v-if="config.purchase_sales?.channel_code" class="hint">
            渠道：{{ config.purchase_sales.channel_code }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="天心贸易模式">
          <el-tag :type="config.is_tianxin_trade_mode ? 'warning' : 'info'" size="small">
            {{ config.is_tianxin_trade_mode ? '是（天心 ERP）' : '否（本系统）' }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-alert v-if="configError" type="error" :title="configError" :closable="false" class="section-card" />

    <!-- 修改表单 -->
    <el-card v-if="config" shadow="never" class="section-card">
      <template #header><span class="card-title">修改形态</span></template>
      <el-form label-width="160px" style="max-width: 520px">
        <el-form-item label="财务模块">
          <el-switch
            :model-value="form.needFinance"
            @update:model-value="onFinanceChange($event as boolean)"
          />
          <span class="switch-hint">{{ form.needFinance ? '启用（本系统）' : '停用' }}</span>
        </el-form-item>
        <el-form-item label="采购/销售模块">
          <el-switch
            :model-value="form.needPurchaseSales"
            @update:model-value="onPurchaseSalesChange($event as boolean)"
          />
          <span class="switch-hint">{{ form.needPurchaseSales ? '启用（本系统）' : '停用' }}</span>
        </el-form-item>
        <el-form-item v-if="!form.needFinance && !form.needPurchaseSales" label="其他软件方">
          <el-select v-model="form.externalSoftware" placeholder="请选择" style="width: 200px">
            <el-option label="天心（TIANXIN）" value="TIANXIN" />
          </el-select>
          <span class="switch-hint">两开关同关时必填</span>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :loading="submitting"
            :disabled="!canSubmit"
            @click="handleSubmit"
          >保存</el-button>
        </el-form-item>
      </el-form>

      <!-- 提交结果 -->
      <el-alert
        v-if="lastResult"
        type="success"
        :closable="true"
        class="result-alert"
        @close="lastResult = null"
      >
        <template #title>
          保存成功：finance_enabled={{ lastResult.finance_enabled }}，
          purchase_sales_enabled={{ lastResult.purchase_sales_enabled }}，
          channel_code={{ lastResult.channel_code || 'null' }}，
          states_created={{ lastResult.states_created }}
        </template>
      </el-alert>
    </el-card>

    <!-- 未选租户提示 -->
    <el-empty v-if="!config && !configLoading && !configError && selectedTenantCode" description="暂无配置数据" />
    <el-empty v-if="!selectedTenantCode" description="请先选择租户" />
  </div>
</template>

<style scoped>
.trade-mode-config { display: flex; flex-direction: column; gap: 16px; }
.section-card { border-radius: 8px; }
.card-title { font-weight: 600; }
.tenant-hint { margin-left: 12px; font-size: 13px; color: var(--el-text-color-secondary); }
.hint { margin-left: 8px; font-size: 12px; color: var(--el-text-color-secondary); }
.switch-hint { margin-left: 10px; font-size: 12px; color: var(--el-text-color-secondary); }
.result-alert { margin-top: 12px; }
</style>
