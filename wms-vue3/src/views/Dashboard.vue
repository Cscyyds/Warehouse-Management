<template>
  <div class="dashboard">
    <div class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">WMS 仓储运营总览</h1>
        <p class="hero-subtitle">您好，王浩 ——— 欢迎回来，以下是今日运营概览</p>
      </div>
      <div class="hero-stats">
        <div class="stat-item">
          <div class="stat-value">12</div>
          <div class="stat-label">待处理单据</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">5</div>
          <div class="stat-label">库存预警</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">236</div>
          <div class="stat-label">今日入库</div>
        </div>
        <div class="stat-item stat-item--update">
          <div class="stat-value stat-value--time">{{ updateTime }}</div>
          <div class="stat-label">数据更新时间</div>
        </div>
      </div>
    </div>

    <div class="stats-groups">
      <el-row :gutter="20">
        <el-col v-for="group in statGroups" :key="group.label" :span="8">
          <div class="stat-group">
            <div class="stat-group-title">{{ group.label }}</div>
            <div class="stat-group-cards">
              <div
                v-for="(stat, idx) in group.items"
                :key="stat.label"
                class="stat-card"
                :style="{ '--delay': `${idx * 0.1}s` }"
              >
                <div class="stat-card-icon" :style="{ background: stat.gradient }">
                  <el-icon :size="22" color="#fff"><component :is="stat.icon" /></el-icon>
                </div>
                <div class="stat-card-body">
                  <div class="stat-card-title">{{ stat.label }}</div>
                  <div class="stat-card-value">{{ stat.value }}</div>
                  <div class="stat-card-change" :class="stat.change.startsWith('+') ? 'trend-up' : 'trend-down'">
                    <el-icon :size="12"><component :is="stat.change.startsWith('+') ? 'CaretTop' : 'CaretBottom'" /></el-icon>
                    <span>{{ stat.trend }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <div class="content-section">
      <div class="section-left">
        <el-card class="section-card">
          <template #header><span>最近入库单</span></template>
          <el-table :data="recentInbounds" style="width: 100%" size="small">
            <el-table-column prop="no" label="单号" width="150" />
            <el-table-column prop="product" label="产品" />
            <el-table-column prop="quantity" label="数量" width="80" />
            <el-table-column prop="time" label="时间" width="160" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
      <div class="section-right">
        <el-card class="section-card">
          <template #header><span>库存预警</span></template>
          <div v-for="item in alerts" :key="item.name" class="alert-item">
            <div class="alert-header">
              <span class="alert-name">{{ item.name }}</span>
              <span class="alert-percent">{{ item.percent }}%</span>
            </div>
            <el-progress
              :percentage="animatedPercents[item.name] ?? 0"
              :color="progressColor(item.percent)"
              :stroke-width="8"
            />
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import { CaretTop, CaretBottom, Download, Upload, CircleCheck, Clock, Van } from '@element-plus/icons-vue'

const updateTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

const statGroups = [
  {
    label: '入库',
    items: [
      { label: '未入库单数', value: '23', change: '+12%', trend: '较昨日 +3', gradient: 'linear-gradient(135deg, #667eea, #764ba2)', icon: 'Download' },
      { label: '已入库单数', value: '156', change: '+8%', trend: '较昨日 +12', gradient: 'linear-gradient(135deg, #10b981, #059669)', icon: 'CircleCheck' }
    ]
  },
  {
    label: '出库',
    items: [
      { label: '未出库单数', value: '18', change: '-3%', trend: '较昨日 -2', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', icon: 'Upload' },
      { label: '已出库单数', value: '142', change: '+15%', trend: '较昨日 +18', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', icon: 'CircleCheck' }
    ]
  },
  {
    label: '发货',
    items: [
      { label: '未发货单数', value: '9', change: '-5%', trend: '较昨日 -1', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', icon: 'Clock' },
      { label: '已发货单数', value: '87', change: '+10%', trend: '较昨日 +8', gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)', icon: 'Van' }
    ]
  }
]

function statusType(status: string): string {
  const map: Record<string, string> = {
    '已完成': 'success',
    '进行中': 'primary',
    '待审核': 'warning',
    '待处理': 'warning',
    '已取消': 'info'
  }
  return map[status] ?? 'info'
}

function progressColor(percent: number): string {
  if (percent < 30) return '#ef4444'
  if (percent < 60) return '#f97316'
  if (percent < 80) return '#f59e0b'
  return '#ef4444'
}

const recentInbounds = [
  { no: 'RKD-2026-0001', product: '电子元件 A-100', quantity: 500, time: '2026-05-18 09:30', status: '已完成' },
  { no: 'RKD-2026-0002', product: '包装材料 B-200', quantity: 1000, time: '2026-05-18 10:15', status: '已完成' },
  { no: 'RKD-2026-0003', product: '五金配件 C-300', quantity: 200, time: '2026-05-18 11:00', status: '进行中' },
  { no: 'RKD-2026-0004', product: '化工原料 D-400', quantity: 300, time: '2026-05-18 13:20', status: '进行中' },
  { no: 'RKD-2026-0005', product: '办公用品 E-500', quantity: 150, time: '2026-05-18 14:00', status: '待处理' }
]

const alerts = [
  { name: '电子元件 A-100', percent: 85 },
  { name: '包装材料 B-200', percent: 72 },
  { name: '五金配件 C-300', percent: 90 },
  { name: '化工原料 D-400', percent: 45 },
  { name: '办公用品 E-500', percent: 68 }
]

const animatedPercents = reactive<Record<string, number>>({})

onMounted(() => {
  alerts.forEach(item => { animatedPercents[item.name] = 0 })
  requestAnimationFrame(() => {
    const duration = 800
    const start = performance.now()
    const targets = Object.fromEntries(alerts.map(a => [a.name, a.percent]))
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      alerts.forEach(a => { animatedPercents[a.name] = Math.round(targets[a.name] * ease) })
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
})
</script>

<style scoped>
.dashboard { padding: 0; animation: fadeInUp 0.5s ease; }

.hero-section {
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  padding: 32px;
  color: var(--text-primary);
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-xs);
  border-left: 4px solid var(--primary);
}
.hero-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  background: var(--primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero-subtitle { font-size: 14px; color: var(--text-secondary); }

.hero-stats {
  display: flex;
  gap: 1px;
  background: var(--border-light, #e5e7eb);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.stat-item {
  text-align: center;
  padding: 12px 24px;
  background: var(--bg-white);
  position: relative;
}
.stat-item--update { background: var(--bg-page); }
.stat-value {
  font-size: 28px;
  font-weight: 700;
  background: var(--primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.stat-value--time {
  font-size: 18px;
  font-weight: 600;
}
.stat-label { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }

.stats-groups { margin-bottom: 20px; }
.stat-group {
  margin-bottom: 4px;
  background: var(--bg-white);
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: var(--shadow-xs);
}
.stat-group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
  padding-left: 4px;
}
.stat-group-cards { display: flex; flex-direction: column; gap: 12px; }

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  background: var(--bg-white);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
  cursor: pointer;
  animation: fadeInUp 0.5s ease both;
  animation-delay: var(--delay);
}
.stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }

.stat-card-icon {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--primary-gradient);
}

.stat-card-body { flex: 1; min-width: 0; }
.stat-card-title { font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; }
.stat-card-value { font-size: 28px; font-weight: 700; color: var(--text-primary); line-height: 1.2; margin-bottom: 2px; }
.stat-card-change { font-size: 12px; display: flex; align-items: center; gap: 2px; }
.trend-up { color: #10b981; }
.trend-down { color: #ef4444; }

.content-section { display: flex; gap: 16px; }
.section-left { flex: 2; }
.section-right { flex: 1; }
.alert-item { margin-bottom: 16px; }
.alert-item:last-child { margin-bottom: 0; }
.alert-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
.alert-name { color: var(--text-primary); }
.alert-percent { color: var(--text-secondary); }
</style>
