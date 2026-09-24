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
      <div class="topbar-actions">
        <el-button
          v-perm="'POST /api/v1/tenant-production/wms-status/batch-update'"
          @click="batchVisible = true"
        >
          <el-icon><Operation /></el-icon>批量变更仓库作业状态
        </el-button>
        <el-button :loading="loading" @click="refresh">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>
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
        <div v-if="unboundOf(cfg.docKey) > 0" class="doc-card__phase">
          <el-tag
            type="warning"
            size="small"
            class="unbound-tag"
            title="ERP 有、WMS 无档案的品号，点击查看清单"
            @click.stop="goUnbound(cfg.docKey)"
          >
            未绑品号 {{ unboundOf(cfg.docKey) }} ›
          </el-tag>
        </div>
        <div class="doc-card__time">
          <span class="label">最近同步</span>
          <span class="value">{{ docOf(cfg.docKey)?.last_success_at || '—' }}</span>
        </div>
        <div v-if="docOf(cfg.docKey)?.last_error" class="doc-card__error" :title="docOf(cfg.docKey)!.last_error!">
          {{ docOf(cfg.docKey)!.last_error }}
        </div>
      </div>
    </div>

    <!-- 批量变更仓库作业状态：概览页不预选单据类别，由弹窗内选择 -->
    <WmsStatusBatchDialog v-model="batchVisible" @done="load" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Operation, Refresh } from '@element-plus/icons-vue'
import { PRODUCTION_DOC_CONFIGS } from '@/config/productionDocConfig'
import { getProductionOverview, type ProductionOverviewDoc, type ProductionOverviewResult } from '@/api/modules/production'
import SyncSettingsCard from './components/SyncSettingsCard.vue'
import WmsStatusBatchDialog from './components/WmsStatusBatchDialog.vue'

const router = useRouter()
const docConfigs = PRODUCTION_DOC_CONFIGS

const loading = ref(false)
const overview = ref<ProductionOverviewResult | null>(null)
const batchVisible = ref(false)
let lastRefreshAt = 0

const REFRESH_MIN_INTERVAL_MS = 10_000

function docMap(): Map<string, ProductionOverviewDoc> {
  return new Map((overview.value?.docs || []).map((d) => [d.doc_key, d]))
}
function docOf(docKey: string): ProductionOverviewDoc | undefined {
  return docMap().get(docKey)
}
function unboundOf(docKey: string): number {
  return docOf(docKey)?.unbound_prd_count || 0
}
function hasError(docKey: string): boolean {
  return Boolean(docOf(docKey)?.last_error)
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

/** 点「未绑品号」标签：带该单据类别跳清单页（卡片本身点击是进单据列表，故用 @click.stop） */
function goUnbound(docKey: string) {
  router.push({ path: '/production/unbound-products', query: { doc_key: docKey } })
}

onMounted(load)
</script>

<style scoped>
.prod-overview { display: flex; flex-direction: column; gap: 14px; }
.overview-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.overview-title { display: flex; align-items: center; gap: 10px; }
.overview-title h3 { margin: 0; font-size: 18px; font-weight: 700; color: var(--text-primary); }
.topbar-actions { display: flex; align-items: center; gap: 8px; }
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
/* 未绑品号标签可点：跳「未绑品号清单」并预选该单据类别 */
.unbound-tag { cursor: pointer; }
.doc-card__time { display: flex; flex-direction: column; gap: 2px; }
.doc-card__time .label { font-size: 12px; color: var(--text-tertiary); }
.doc-card__time .value { font-size: 12px; color: var(--text-secondary); font-family: monospace; }
.doc-card__error {
  font-size: 12px; color: var(--el-color-danger);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
</style>
