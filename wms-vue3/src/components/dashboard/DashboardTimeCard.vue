<template>
  <div class="time-card" :title="`当前时间 ${fullDate} ${nowClock}`">
    <div class="time-card__icon">
      <el-icon :size="18" color="#fff"><Clock /></el-icon>
    </div>
    <div class="time-card__main">
      <div class="time-card__now">{{ nowClock }}</div>
      <div class="time-card__updated">数据更新于 {{ updateClock }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 页头时间卡（固定排在业务指标卡右侧）：
 * 第一行当前时间（每秒跳动），第二行接口数据更新时间——
 * 两处时间同卡展示，避免页头出现多套时间信息。
 * Dashboard 每次进入重挂载，定时器随卸载销毁。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Clock } from '@element-plus/icons-vue'

const props = defineProps<{
  /** 仪表盘接口返回的数据更新时间，形如 "2026-10-17 11:14:22" 或 "11:14:22" */
  dataUpdateTime: string
}>()

const now = ref(new Date())
let timer: number | undefined

function tick() {
  now.value = new Date()
}

onMounted(() => {
  tick()
  timer = window.setInterval(tick, 1000)
})

onBeforeUnmount(() => {
  if (timer !== undefined) clearInterval(timer)
})

const pad = (n: number) => String(n).padStart(2, '0')
const nowClock = computed(() => {
  const d = now.value
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
})
const fullDate = computed(() => {
  const d = now.value
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})

/** 从接口时间串中取末尾时刻部分（兼容纯 HH:mm:ss 与完整日期时间两种格式） */
const updateClock = computed(() => {
  const raw = (props.dataUpdateTime || '').trim()
  if (!raw) return '--:--:--'
  const m = raw.match(/(\d{1,2}:\d{2}(?::\d{2})?)$/)
  return m ? m[1] : raw
})
</script>

<style scoped>
.time-card {
  display: flex;
  align-items: center;
  gap: 10px;
  /* 固定在指标行最右，不参与 4 张业务卡的等宽分配 */
  flex: 0 0 auto;
  background: var(--bg-page);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  white-space: nowrap;
}
.time-card__icon {
  width: 34px; height: 34px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: linear-gradient(135deg, #64748b, #475569);
}
.time-card__main { display: flex; flex-direction: column; gap: 1px; }
.time-card__now {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
}
.time-card__updated {
  font-size: 11px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 1280px) {
  .time-card { padding: 10px 12px; gap: 8px; }
  .time-card__icon { width: 30px; height: 30px; }
  .time-card__now { font-size: 18px; }
}
@media (max-width: 1080px) {
  .time-card { flex: 1 1 calc(50% - 10px); min-width: 160px; }
}
@media (max-width: 768px) {
  .time-card { flex: 1 1 100%; }
}
</style>
