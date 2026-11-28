<template>
  <div class="glass-card">
    <div class="glass-card-header">
      <div class="glass-card-title">
        <span class="card-title-icon"><el-icon :size="16"><Download /></el-icon></span>
        <span>{{ title }}</span>
      </div>
      <span v-if="viewAllRoute" class="glass-card-more" @click="router.push(viewAllRoute)">查看全部 &rarr;</span>
    </div>
    <el-table border :data="items" style="width: 100%" size="small" class="custom-table">
      <el-table-column prop="no" label="单号" width="150">
        <template #default="{ row }">
          <span class="mono-text">{{ row.no }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="product" label="产品" />
      <el-table-column prop="quantity" label="数量" width="80">
        <template #default="{ row }">
          <span class="quantity-text">{{ row.quantity }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="time" label="时间" width="160" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="140">
        <template #default="{ row }">
          <span class="status-dot" :class="'status-dot--' + statusType(row.status)"></span>
          <el-tag :type="statusType(row.status)" size="small" effect="light" round>{{ row.status }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { Download } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import type { RecentInboundItem } from '@/api/modules/dashboard'

defineProps<{
  title: string
  items: RecentInboundItem[]
  viewAllRoute?: string
}>()

const router = useRouter()

/** 状态文案 → el-tag 类型；后端字典为 待处理/进行中/仓库退回/已完成，漏配会回落灰色 info */
function statusType(status: string): string {
  const map: Record<string, string> = {
    '已完成': 'success',
    '进行中': 'primary',
    '待审核': 'warning',
    '待处理': 'warning',
    '仓库退回': 'danger',
    '已取消': 'info'
  }
  return map[status] ?? 'info'
}
</script>

<style scoped>
.glass-card {
  background: var(--bg-white);
  border-radius: var(--radius-md);
  padding: 20px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-xs);
  height: 100%;
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
.glass-card-more {
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  font-weight: 500;
  transition: color var(--transition-fast);
}
.glass-card-more:hover { color: var(--primary); }
.mono-text {
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.quantity-text { font-weight: 600; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.status-dot {
  display: inline-block;
  width: 5px; height: 5px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
  position: relative;
  top: -1px;
}
.status-dot--success { background: var(--success); }
.status-dot--primary { background: var(--info); }
.status-dot--warning { background: var(--warning); }
.status-dot--danger  { background: var(--danger); }
.status-dot--info    { background: var(--text-tertiary); }
</style>
