<template>
  <span>{{ display }}</span>
</template>

<script setup lang="ts">
/**
 * 数字滚动：挂载时从 0 滚到目标值，目标值后续变化则从当前显示值继续滚过去。
 * 缓动与 StockAlertCard 的预警进度条同款（easeOutCubic），仪表盘观感统一。
 * 非数字值（如「断货」「--:--」）原样直出，不参与动画。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  value: string | number
  /** 滚动时长（ms） */
  duration?: number
  /** 起始延迟（ms）：同组卡片按下标错峰，形成逐张滚动的观感 */
  delay?: number
}>(), {
  duration: 800,
  delay: 0,
})

/** 解析目标值；小数位数取目标值自身，滚动过程不会出现「1.5 → 2.34」这类位数抖动 */
function parseTarget(raw: string | number): { value: number; decimals: number } | null {
  const text = String(raw).trim()
  const num = Number(text)
  if (text === '' || !Number.isFinite(num)) return null
  return { value: num, decimals: (text.split('.')[1] || '').length }
}

const current = ref(0)

const display = computed(() => {
  const target = parseTarget(props.value)
  return target ? current.value.toFixed(target.decimals) : String(props.value)
})

let rafId = 0
let timerId: ReturnType<typeof setTimeout> | undefined

function rollTo(to: number) {
  if (rafId) cancelAnimationFrame(rafId)
  if (timerId) clearTimeout(timerId)
  const from = current.value
  if (from === to) {
    current.value = to
    return
  }
  const start = () => {
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min((now - t0) / props.duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      current.value = from + (to - from) * ease
      rafId = p < 1 ? requestAnimationFrame(step) : 0
    }
    rafId = requestAnimationFrame(step)
  }
  if (props.delay > 0) timerId = setTimeout(start, props.delay)
  else start()
}

watch(
  () => props.value,
  raw => {
    const target = parseTarget(raw)
    if (target) rollTo(target.value)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  if (timerId) clearTimeout(timerId)
})
</script>
