<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ApiError } from '@/api/http'
import { queryTenantSimpleMode, updateTenantSimpleMode, type TenantSimpleMode, type SimpleModeBlocker } from '@/api/platformSimpleMode'

const props = defineProps<{ tenantId: string; tenantName: string }>()
const status = ref<TenantSimpleMode | null>(null)
const loading = ref(false)
const saving = ref(false)
const confirming = ref(false)
const error = ref('')
const serverBlockers = ref<SimpleModeBlocker[]>([])
const busy = computed(() => loading.value || saving.value || confirming.value)
const blockers = computed(() => serverBlockers.value.length ? serverBlockers.value : status.value?.disable_blockers || [])
let generation = 0
let querySequence = 0

function blockerLabel(blocker: SimpleModeBlocker) {
  return ({ SIMPLE_STOCK_REMAINS: '无条码库存未清空', SIMPLE_REQUEST_IN_PROGRESS: '简易操作仍在处理中',
    SIMPLE_TASK_UNFINISHED: '简易任务尚未完成', SIMPLE_TASK_NEEDS_REVIEW: '历史任务需要核对' } as Record<string, string>)[blocker.error_code] || '存在需要核对的阻断项'
}
function placeLabel(type?: string) {
  return ({ POSITION: '位置', PLASTIC_BOX: '塑料盒', DISTRIBUTION_SPOT: '集散位' } as Record<string, string>)[type || ''] || ''
}

async function load(keepError = false) {
  const tenantId = props.tenantId
  const current = generation
  const query = ++querySequence
  loading.value = true
  if (!keepError) { error.value = ''; serverBlockers.value = [] }
  try {
    const result = await queryTenantSimpleMode(tenantId)
    if (generation !== current || query !== querySequence || props.tenantId !== tenantId) return
    status.value = result
  } catch (err) {
    if (generation !== current || query !== querySequence) return
    status.value = null
    error.value = err instanceof Error ? err.message : '简易模式加载失败'
  } finally {
    if (generation === current && query === querySequence) loading.value = false
  }
}

async function changeMode() {
  if (!status.value || busy.value) return false
  const tenantId = props.tenantId
  const current = generation
  const target = status.value.enabled === 1 ? 0 : 1
  const revision = status.value.revision
  if (target === 0 && !status.value.can_disable) {
    error.value = '仍有无条码库存或未结束的简易任务，请处理下方阻断项后刷新'
    return false
  }
  confirming.value = true
  try {
    await ElMessageBox.confirm(`${props.tenantName}（${tenantId}）`, target ? '开启简易模式' : '关闭简易模式', {
      confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return false }
  finally { if (generation === current) confirming.value = false }
  if (generation !== current || props.tenantId !== tenantId) return false
  saving.value = true
  error.value = ''
  serverBlockers.value = []
  try {
    const result = await updateTenantSimpleMode({ tenant_id: tenantId, enabled: target, expected_revision: revision })
    if (generation !== current || props.tenantId !== tenantId) return false
    status.value = result
    ElMessage.success(target ? '简易模式已开启' : '简易模式已关闭')
  } catch (err) {
    if (generation !== current) return false
    error.value = err instanceof Error ? err.message : '简易模式更新失败'
    if (err instanceof ApiError) {
      const details = err.details as { error_code?: string; blockers?: SimpleModeBlocker[] } | null
      if (Array.isArray(details?.blockers)) serverBlockers.value = details.blockers
      if (details?.error_code === 'VERSION_CONFLICT') error.value = '配置已被更新，已重新查询；请核对最新状态后再次操作'
    }
    await load(true)
  } finally { if (generation === current) saving.value = false }
  // 展示值只由后端成功响应决定，不允许el-switch自行乐观翻转。
  return false
}

watch(() => props.tenantId, () => {
  generation++
  status.value = null
  saving.value = false
  confirming.value = false
  void load()
}, { immediate: true })
onBeforeUnmount(() => { generation++; querySequence++ })
</script>

<template>
  <section class="simple-mode-panel tenant-detail-card" v-loading="loading">
    <div class="mode-heading">
      <div><h3>简易模式</h3><p>开启后，该租客的产品库存按无条码库存展示，并可使用简易出入库。切换开关不会转换已有库存。</p></div>
      <el-button :disabled="busy" @click="load()">刷新状态</el-button>
    </div>
    <div class="mode-control">
      <el-switch :model-value="status?.enabled === 1" :disabled="!status || busy" :loading="saving"
        :before-change="changeMode" active-text="开启" inactive-text="关闭" aria-label="租客简易模式" />
      <span v-if="!status">{{ loading ? '正在查询状态' : '状态不可用' }}</span>
    </div>
    <el-alert v-if="error" :title="error" type="warning" show-icon :closable="false" />
    <div v-if="blockers.length" class="mode-blockers">
      <p>关闭前需处理以下 {{ blockers.length }} 项：</p>
      <ul>
        <li v-for="(blocker, index) in blockers" :key="index">
          <strong>{{ blockerLabel(blocker) }}</strong>
          <span v-if="blocker.product_id">产品：{{ blocker.product_id }}</span>
          <span v-if="blocker.place_id">{{ placeLabel(blocker.place_type) }}：{{ blocker.place_id }}</span>
          <span v-if="blocker.stock_qty != null">数量：{{ blocker.stock_qty }}</span>
          <span v-if="blocker.request_id">请求：{{ blocker.request_id }}</span>
          <span v-if="blocker.target_id">任务：{{ blocker.target_id }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.simple-mode-panel { margin-bottom: 20px; padding: 20px; }
.mode-heading { display: flex; gap: 16px; justify-content: space-between; align-items: flex-start; }
.mode-heading h3 { margin: 0 0 8px; }
.mode-heading p { margin: 0; color: #667085; line-height: 1.6; }
.mode-control { display: flex; align-items: center; gap: 16px; margin: 16px 0; }
.mode-blockers p { margin-bottom: 8px; }
.mode-blockers ul { padding-left: 20px; margin: 0; }
.mode-blockers li { margin-bottom: 10px; overflow-wrap: anywhere; }
.mode-blockers li span { display: inline-block; margin-left: 12px; }
</style>
