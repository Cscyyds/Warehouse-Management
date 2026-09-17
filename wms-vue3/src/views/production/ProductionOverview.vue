<template>
  <div class="prod-overview">
    <div class="overview-topbar">
      <div class="overview-title">
        <h3>生产概览</h3>
        <template v-if="overview">
          <el-tag :type="overview.enabled ? 'success' : 'info'" size="small">
            {{ overview.enabled ? '已开通' : '未开通' }}
          </el-tag>
          <span v-if="overview.enabled" class="channel-text">渠道：{{ overview.channel_name || overview.channel_code }}</span>
          <span v-if="overview.enabled" class="interval-text">同步间隔：{{ formatInterval(overview.sync_interval_seconds) }}</span>
        </template>
      </div>
      <el-button :loading="loading" @click="refresh">
        <el-icon><Refresh /></el-icon>刷新
      </el-button>
    </div>

    <el-alert
      v-if="overview && !overview.enabled"
      type="warning"
      :closable="false"
      title="生产模块未开通"
      description="当前租户尚未开通生产管理模块，请联系平台管理员在后台开通后再查看同步状态。"
      class="module-alert"
    />

    <!-- 同步设置：放在概览状态卡片之上（低频配置在前，状态监控在后） -->
    <SyncSettingsCard @saved="load" />

    <div v-loading="loading" class="doc-grid">
      <div
        v-for="cfg in docConfigs"
        :key="cfg.docKey"
        class="doc-card"
        :class="{ 'is-error': hasError(cfg.docKey) }"
        @click="goList(cfg.docKey)"
      >
        <div class="doc-card__head">
          <span class="doc-name">{{ cfg.name }}</span>
          <span class="sync-dot" :class="dotClass(cfg.docKey)" :title="dotTitle(cfg.docKey)" />
        </div>
        <div class="doc-card__phase">
          <el-tag :type="phaseTagType(phaseOf(cfg.docKey))" size="small">{{ phaseLabel(phaseOf(cfg.docKey)) }}</el-tag>
          <el-tag v-if="unboundOf(cfg.docKey) > 0" type="warning" size="small" class="unbound-tag">
            未绑品号 {{ unboundOf(cfg.docKey) }}
          </el-tag>
        </div>
        <div class="doc-card__time">
          <span class="label">最近同步</span>
          <span class="value">{{ docOf(cfg.docKey)?.last_success_at || '—' }}</span>
        </div>
        <el-progress
          v-if="showProgress(cfg.docKey)"
          :percentage="progressPercent(cfg.docKey)"
          :stroke-width="6"
          class="doc-card__progress"
        />
        <div v-if="docOf(cfg.docKey)?.last_error" class="doc-card__error" :title="docOf(cfg.docKey)!.last_error!">
          {{ docOf(cfg.docKey)!.last_error }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { PRODUCTION_DOC_CONFIGS } from '@/config/productionDocConfig'
import { getProductionOverview, type ProductionOverviewDoc, type ProductionOverviewResult } from '@/api/modules/production'
import SyncSettingsCard from './components/SyncSettingsCard.vue'

const router = useRouter()
const docConfigs = PRODUCTION_DOC_CONFIGS

const loading = ref(false)
const overview = ref<ProductionOverviewResult | null>(null)
let lastRefreshAt = 0

const REFRESH_MIN_INTERVAL_MS = 10_000

function docMap(): Map<string, ProductionOverviewDoc> {
  return new Map((overview.value?.docs || []).map((d) => [d.doc_key, d]))
}
function docOf(docKey: string): ProductionOverviewDoc | undefined {
  return docMap().get(docKey)
}
function phaseOf(docKey: string): string {
  return docOf(docKey)?.phase || 'BACKFILL'
}
function unboundOf(docKey: string): number {
  return docOf(docKey)?.unbound_prd_count || 0
}
function hasError(docKey: string): boolean {
  return Boolean(docOf(docKey)?.last_error)
}
function showProgress(docKey: string): boolean {
  const d = docOf(docKey)
  return Boolean(d && d.phase === 'BACKFILL' && d.slice_total > 0)
}
function progressPercent(docKey: string): number {
  const d = docOf(docKey)
  if (!d || !d.slice_total) return 0
  return Math.min(100, Math.round((d.slice_done / d.slice_total) * 100))
}
function dotClass(docKey: string): string {
  const d = docOf(docKey)
  if (!d) return 'is-idle'
  if (d.last_error) return 'is-error'
  return d.synced_recently ? 'is-fresh' : 'is-idle'
}
function dotTitle(docKey: string): string {
  const d = docOf(docKey)
  if (!d) return '暂无同步状态'
  if (d.last_error) return `最近错误：${d.last_error}`
  return d.synced_recently ? '1 小时内同步成功' : '近期未同步'
}
function phaseLabel(phase: string): string {
  if (phase === 'BACKFILL') return '回填中'
  if (phase === 'INCREMENTAL') return '增量同步'
  if (phase === 'RECONCILE') return '对账中'
  return phase || '—'
}
function phaseTagType(phase: string): 'success' | 'info' | 'warning' {
  if (phase === 'INCREMENTAL') return 'success'
  if (phase === 'RECONCILE') return 'warning'
  return 'info'
}
function formatInterval(seconds: number): string {
  if (!seconds) return '—'
  if (seconds >= 60 && seconds % 60 === 0) return `每 ${seconds / 60} 分钟`
  return `每 ${seconds} 秒`
}

async function load() {
  loading.value = true
  try {
    const res = await getProductionOverview()
    overview.value = res.data
  } catch {
    overview.value = null
  } finally {
    loading.value = false
  }
}

function refresh() {
  const now = Date.now()
  if (now - lastRefreshAt < REFRESH_MIN_INTERVAL_MS) {
    ElMessage.info('刷新过于频繁，请稍后再试（≥10 秒）')
    return
  }
  lastRefreshAt = now
  load()
}

function goList(docKey: string) {
  router.push(`/production/${docKey}`)
}

onMounted(load)
</script>

<style scoped>
.prod-overview { display: flex; flex-direction: column; gap: 14px; }
.overview-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.overview-title { display: flex; align-items: center; gap: 10px; }
.overview-title h3 { margin: 0; font-size: 18px; font-weight: 700; color: var(--text-primary); }
.channel-text, .interval-text { color: var(--text-secondary); font-size: 13px; }
.module-alert { }
.doc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.doc-card {
  display: flex; flex-direction: column; gap: 8px;
  padding: 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md);
  background: var(--bg-white); cursor: pointer;
  transition: box-shadow .15s, border-color .15s, transform .15s;
}
.doc-card:hover { box-shadow: var(--shadow-md); border-color: var(--primary); transform: translateY(-1px); }
.doc-card.is-error { border-color: var(--el-color-danger); }
.doc-card__head { display: flex; align-items: center; justify-content: space-between; }
.doc-name { font-weight: 600; color: var(--text-primary); }
.sync-dot { width: 9px; height: 9px; border-radius: 50%; }
.sync-dot.is-fresh { background: var(--el-color-success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-color-success) 18%, transparent); }
.sync-dot.is-idle { background: var(--text-tertiary); }
.sync-dot.is-error { background: var(--el-color-danger); box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-color-danger) 18%, transparent); }
.doc-card__phase { display: flex; align-items: center; gap: 6px; }
.unbound-tag { }
.doc-card__time { display: flex; flex-direction: column; gap: 2px; }
.doc-card__time .label { font-size: 12px; color: var(--text-tertiary); }
.doc-card__time .value { font-size: 12px; color: var(--text-secondary); font-family: monospace; }
.doc-card__progress { }
.doc-card__error {
  font-size: 12px; color: var(--el-color-danger);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
</style>
