<template>
  <!-- 处理中状态卡：无边框无背景，直接铺在页面背景上（app StatusCard） -->
  <div class="office-status-card" aria-live="polite">
    <div class="status-row">
      <span class="typing-dots" aria-hidden="true"><i /><i /><i /></span>
      <!-- 趣味语句：亮色沿左上→右下方向扫过文字的渐变动效 -->
      <span v-if="quipPhase && !statusText" class="status-quip">{{ quip }}</span>
      <span v-else class="status-text">{{ statusText || '正在理解业务并整理数据' }}</span>
    </div>
    <!-- 步骤列表与小程序一致：排除正在进行的最后一步 -->
    <template v-if="completedSteps.length">
      <hr class="status-divider" />
      <ul class="status-steps">
        <li v-for="step in completedSteps" :key="step.id">{{ step.content }}</li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { OfficeThinkingStep } from '@/agent/types'

const props = defineProps<{
  statusText: string
  steps: OfficeThinkingStep[]
}>()

const HEAVY_QUIP = '这堆资料太重了，小星搬……不动……了啊啊'
const TROLLEY_QUIP = '找到拖车了！很快就能回复了！'
const waitingQuips = [
  '小星正在查资料，心急吃不了热豆腐～',
  HEAVY_QUIP,
  TROLLEY_QUIP,
  '资料库有点大，小星正在挨个柜子翻',
  '看到目标资料了！小星正在伸手……够……够到了！',
  '小星正在把资料装车，马上运回来',
  '快好了快好了，小星在冲刺！',
]

// 无状态文字时：前 2 秒显示默认文案，之后在同一位置轮播趣味语句（间隔 3.2s）
const quipPhase = ref(false)
const quip = ref(pickInitialQuip())
let phaseTimer: number | undefined
let rotateTimer: number | undefined

function pickInitialQuip(): string {
  const pool = waitingQuips.filter(item => item !== TROLLEY_QUIP)
  return pool[Math.floor(Math.random() * pool.length)] ?? waitingQuips[0]
}

function nextQuip() {
  quip.value = quip.value === HEAVY_QUIP
    ? TROLLEY_QUIP
    : waitingQuips.filter(item => item !== TROLLEY_QUIP && item !== quip.value)[
      Math.floor(Math.random() * (waitingQuips.length - 2))] ?? waitingQuips[0]
}

const completedSteps = computed(() => props.steps.slice(0, -1))

onMounted(() => {
  phaseTimer = window.setTimeout(() => {
    quipPhase.value = true
    rotateTimer = window.setInterval(nextQuip, 3_200)
  }, 2_000)
})

onBeforeUnmount(() => {
  if (phaseTimer !== undefined) window.clearTimeout(phaseTimer)
  if (rotateTimer !== undefined) window.clearInterval(rotateTimer)
})
</script>

<style scoped>
.office-status-card {
  padding: 11px 13px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 17px;
}

.typing-dots { display: inline-flex; gap: 3px; flex: 0 0 auto; }
.typing-dots i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #626a73;
  animation: typing-dot 0.5s linear infinite alternate;
}
.typing-dots i:nth-child(2) { animation-delay: 0.16s; }
.typing-dots i:nth-child(3) { animation-delay: 0.32s; }
@keyframes typing-dot {
  from { opacity: 0.25; }
  to { opacity: 1; }
}

.status-text,
.status-quip {
  color: rgb(98 106 115 / 78%);
  font-size: 12px;
  line-height: 17px;
}

/* 扫光：亮色沿左上→右下方向扫过文字 */
.status-quip {
  background: linear-gradient(105deg,
    rgb(98 106 115 / 78%) 0%,
    rgb(98 106 115 / 78%) 40%,
    #e53935 50%,
    rgb(98 106 115 / 78%) 60%,
    rgb(98 106 115 / 78%) 100%);
  background-size: 250% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: quip-shimmer 2.4s linear infinite;
}
@keyframes quip-shimmer {
  from { background-position: 120% 0; }
  to { background-position: -120% 0; }
}

.status-divider {
  margin: 9px 0 7px;
  border: 0;
  border-top: 1px solid #e8eaed;
}

.status-steps {
  display: grid;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.status-steps li {
  position: relative;
  padding-left: 16px;
  color: #626a73;
  font-size: 12px;
  line-height: 17px;
}
.status-steps li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #19a974;
  font-size: 11px;
}

@media (prefers-reduced-motion: reduce) {
  .typing-dots i, .status-quip { animation: none !important; }
  .status-quip {
    background: none;
    -webkit-text-fill-color: currentColor;
  }
}
</style>
