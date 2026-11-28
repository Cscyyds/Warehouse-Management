<template>
  <div class="glass-card">
    <div class="glass-card-header">
      <div class="glass-card-title">
        <span class="card-title-icon"><el-icon :size="16"><Cpu /></el-icon></span>
        <span>生产管理</span>
      </div>
      <span class="prod-count">
        <span v-if="production.totals.errorDocCount > 0" class="prod-chip prod-chip--error">
          {{ production.totals.errorDocCount }} 类同步异常
        </span>
        <span v-else class="prod-chip prod-chip--ok">同步正常</span>
      </span>
    </div>

    <div class="prod-totals">
      <div class="prod-total">
        <div class="prod-total-value"><AnimatedNumber :value="production.totals.billCount" /></div>
        <div class="prod-total-label">单据总数</div>
      </div>
      <div class="prod-total">
        <div class="prod-total-value prod-total-value--warn"><AnimatedNumber :value="production.totals.pendingOpsCount" :delay="80" /></div>
        <div class="prod-total-label">待仓库作业</div>
      </div>
      <div class="prod-total">
        <div class="prod-total-value"><AnimatedNumber :value="production.totals.unboundPrdCount" :delay="160" /></div>
        <div class="prod-total-label">未绑定品号</div>
      </div>
    </div>

    <div class="prod-list">
      <div
        v-for="(doc, idx) in visibleDocs"
        :key="doc.docKey"
        class="prod-item"
        :style="{ '--delay': `${idx * 0.04}s` }"
        :class="{ 'prod-item--error': !!doc.lastError }"
        title="点击进入该单据的独立页面"
        @click="goDocList(doc.docKey)"
      >
        <div class="prod-item-main">
          <div class="prod-item-name">{{ doc.name }}</div>
          <div class="prod-item-meta">
            <span>{{ doc.billCount }} 单</span>
            <span class="prod-item-dot">·</span>
            <span>待作业 {{ doc.pendingOpsCount }}</span>
            <template v-if="doc.lastBillDate">
              <span class="prod-item-dot">·</span>
              <span>{{ doc.lastBillDate }}</span>
            </template>
          </div>
        </div>
        <el-tag
          :type="doc.lastError ? 'danger' : (doc.syncedRecently ? 'success' : 'info')"
          size="small"
          effect="light"
          round
        >
          {{ doc.lastError ? '同步异常' : (doc.syncedRecently ? '已同步' : '待同步') }}
        </el-tag>
        <span class="prod-item-go">›</span>
      </div>
    </div>

    <div v-if="hiddenCount > 0" class="prod-more" @click="expanded = !expanded">
      {{ expanded ? '收起' : `展开全部 ${production.docs.length} 类单据（另有 ${hiddenCount} 类无数据）` }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Cpu } from '@element-plus/icons-vue'
import type { ProductionBlock } from '@/api/modules/dashboard'
import AnimatedNumber from './AnimatedNumber.vue'

const props = defineProps<{ production: ProductionBlock }>()
const router = useRouter()

/** 点单据行：跳该类单据的独立列表页（docKey 与 /production/<docKey> 路由一一对应） */
function goDocList(docKey: string) {
  router.push(`/production/${docKey}`)
}

const expanded = ref(false)
/** 默认只展示有单据的类别，最多 8 行，避免 13 类把卡片撑爆 */
const collapsedLimit = 8

const sortedDocs = computed(() =>
  [...props.production.docs].sort((a, b) => b.billCount - a.billCount)
)

const visibleDocs = computed(() =>
  expanded.value
    ? sortedDocs.value
    : sortedDocs.value.filter(d => d.billCount > 0).slice(0, collapsedLimit)
)

const hiddenCount = computed(() => props.production.docs.length - visibleDocs.value.length)
</script>

<style scoped>
.glass-card {
  background: var(--bg-white);
  border-radius: var(--radius-md);
  padding: 20px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-xs);
  height: 100%;
  display: flex;
  flex-direction: column;
}
.glass-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}
.glass-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.card-title-icon {
  width: 26px; height: 26px;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-bg);
  color: var(--primary);
}
.prod-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-weight: 600;
}
.prod-chip--ok { background: var(--success-light); color: var(--success); }
.prod-chip--error { background: var(--danger-light); color: var(--danger); }

.prod-totals {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
.prod-total {
  flex: 1;
  background: var(--bg-page);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}
.prod-total-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.prod-total-value--warn { color: var(--warning); }
.prod-total-label { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }

.prod-list { display: flex; flex-direction: column; gap: 8px; }
.prod-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-light);
  animation: fadeInUp 0.3s ease both;
  animation-delay: var(--delay);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}
.prod-item:hover {
  border-color: var(--primary-border);
  background: var(--bg-hover);
}
.prod-item--error { border-color: var(--danger-border); }
/* 悬停浮现跳转箭头，明示整行可点 */
.prod-item-go {
  font-size: 14px;
  line-height: 1;
  color: var(--primary);
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity var(--transition-fast), transform var(--transition-fast);
  flex-shrink: 0;
}
.prod-item:hover .prod-item-go { opacity: 1; transform: translateX(0); }
.prod-item-name { font-size: 12px; color: var(--text-primary); font-weight: 500; }
.prod-item-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}
.prod-item-dot { color: var(--border-color); }
.prod-more {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: center;
  transition: color var(--transition-fast);
}
.prod-more:hover { color: var(--primary); }
</style>
