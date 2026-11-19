<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { queryInboundMode, updateInboundMode, type InboundModeConfig, type InboundModule } from '@/api/platformInboundModes'

const props = defineProps<{ tenantId: string; module: InboundModule; title: string }>()
const emit = defineEmits<{ changed: []; 'go-sync-config': [] }>()

const config = ref<InboundModeConfig>()
const mode = ref<'native' | 'tianxin'>('native')
const syncEnabled = ref(false)
const loading = ref(false)
const submitting = ref(false)
const loadError = ref('')
const warnings = ref<string[]>([])
let disposed = false
onScopeDispose(() => { disposed = true })

const isTianxin = computed(() => mode.value === 'tianxin')
const effectiveSync = computed(() => isTianxin.value && syncEnabled.value)
const dirty = computed(() => config.value && (
  isTianxin.value !== config.value.isTianxin || effectiveSync.value !== config.value.syncEnabled
))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const result = await queryInboundMode(props.module, props.tenantId)
    config.value = result
    mode.value = result.isTianxin ? 'tianxin' : 'native'
    syncEnabled.value = result.syncEnabled
  } catch (error) {
    config.value = undefined
    loadError.value = error instanceof Error ? error.message : '查询形态失败'
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!dirty.value || loading.value || submitting.value) return
  const tenantId = props.tenantId
  const targetTianxin = isTianxin.value
  const targetSync = effectiveSync.value
  const targetLabel = targetTianxin ? '天心模式' : '本系统模式'
  const effect = targetSync
    ? '保存后会补齐同步状态。凭证有效时，自动同步将拉取真实 ERP 单据。'
    : '关闭后会暂停该模块的 ERP 同步，并隐藏租户端对应的天心单据入口。'

  submitting.value = true
  try {
    await ElMessageBox.confirm(
      `将「${props.title}」设为${targetLabel}，ERP 数据同步${targetSync ? '开启' : '关闭'}。\n${effect}`,
      `保存${props.title}形态`,
      { confirmButtonText: '确认保存', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    submitting.value = false
    return
  }

  if (disposed) return
  try {
    const result = await updateInboundMode(props.module, tenantId, targetTianxin, targetSync)
    if (disposed) return
    config.value = { exists: true, isTianxin: targetTianxin, syncEnabled: result.erp_sync_enabled === 1 }
    syncEnabled.value = config.value.syncEnabled
    warnings.value = result.warnings ?? []
    ElMessage.success(result.states_created > 0
      ? `${props.title}形态已保存，已初始化 ${result.states_created} 条同步状态`
      : `${props.title}形态已保存`)
    emit('changed')
  } catch (error) {
    if (!disposed) ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <section v-loading="loading" class="mode-card">
    <header class="mode-header">
      <h3>{{ title }}</h3>
      <el-tag v-if="config" size="small" :type="config.isTianxin ? 'warning' : 'info'">
        {{ !config.exists ? '未配置' : config.isTianxin ? '天心模式' : '本系统模式' }}
      </el-tag>
    </header>

    <el-alert v-if="loadError" type="error" show-icon :closable="false" title="查询失败" :description="loadError" />
    <div v-if="loadError">
      <el-button size="small" @click="load">重新加载</el-button>
    </div>
    <template v-else-if="config">
      <el-alert v-if="warnings.length" type="warning" show-icon :closable="false" title="单据正式开启时间">
        <ul class="warnings">
          <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
        </ul>
        <el-button size="small" type="warning" plain @click="emit('go-sync-config')">去设置截止时间</el-button>
      </el-alert>

      <el-form label-position="top" class="dense-form" :disabled="submitting">
        <el-form-item label="模块形态">
          <el-radio-group v-model="mode">
            <el-radio-button value="native">本系统模式</el-radio-button>
            <el-radio-button value="tianxin">天心模式</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="isTianxin" label="ERP 数据同步">
          <el-switch v-model="syncEnabled" inline-prompt active-text="开启" inactive-text="关闭" />
          <p class="field-hint">开启后，租户可使用该模块的天心单据入口，系统按配置自动同步。</p>
        </el-form-item>
        <p v-else class="field-hint">本系统模式下关闭该模块的 ERP 同步。</p>
      </el-form>

      <footer class="mode-actions">
        <el-button type="primary" :loading="submitting" :disabled="!dirty" @click="save">保存形态</el-button>
        <span class="field-hint" role="status">{{ dirty ? '有未保存的更改' : '当前配置无更改' }}</span>
      </footer>
    </template>
  </section>
</template>

<style scoped>
.mode-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
}
.mode-header, .mode-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.mode-header h3 { margin: 0; font-size: 16px; }
.mode-actions { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--line); }
.field-hint { margin: 0; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.6; }
.el-form-item .field-hint { width: 100%; margin-top: 6px; }
.warnings { margin: 4px 0 8px; padding-left: 18px; }
</style>
