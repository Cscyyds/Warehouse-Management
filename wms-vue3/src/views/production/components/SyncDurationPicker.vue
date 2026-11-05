<template>
  <el-popover v-model:visible="open" trigger="click" :width="280" :disabled="disabled">
    <template #reference>
      <el-button class="duration-trigger" :disabled="disabled" :aria-expanded="open" aria-label="选择同步间隔">
        <el-icon><Timer /></el-icon>
        <span>{{ modelValue == null ? '选择分钟和秒' : formatDuration(modelValue) }}</span>
        <el-icon class="chevron"><ArrowDown /></el-icon>
      </el-button>
    </template>
    <div class="picker-title">同步间隔</div>
    <div class="wheels" v-if="open">
      <DurationWheel id="sync-minutes" v-model="minutes" :values="minuteOptions" label="分钟" />
      <span class="separator">:</span>
      <DurationWheel id="sync-seconds" v-model="seconds" :values="secondOptions" label="秒" />
    </div>
    <p class="range">可选 {{ formatDuration(min) }} — {{ formatDuration(max) }}</p>
    <div class="picker-footer">
      <el-button size="small" @click="open = false">取消</el-button>
      <el-button size="small" type="primary" @click="confirm">确定</el-button>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowDown, Timer } from '@element-plus/icons-vue'
import DurationWheel from './DurationWheel.vue'
import { durationToSeconds, formatDuration, secondsForMinute } from '../syncDuration'
const props = defineProps<{ modelValue?: number; min: number; max: number; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const open = ref(false)
const minutes = ref(0)
const seconds = ref(0)
const minuteOptions = computed(() => Array.from({ length: Math.floor(props.max / 60) - Math.floor(props.min / 60) + 1 }, (_, i) => Math.floor(props.min / 60) + i))
const secondOptions = computed(() => secondsForMinute(minutes.value, props.min, props.max))
watch(secondOptions, values => { seconds.value = Math.max(values[0] ?? 0, Math.min(values.at(-1) ?? 0, seconds.value)) }, { flush: 'sync' })
watch(() => props.disabled, value => { if (value) open.value = false })
// 在滚轮挂载前初始化，避免弹出动画结束后的 show 事件覆盖用户已滚动的值。
watch(open, value => { if (value) prepare() }, { flush: 'sync' })
function prepare() {
  const total = Math.max(props.min, Math.min(props.max, props.modelValue ?? props.min))
  minutes.value = Math.floor(total / 60)
  seconds.value = total % 60
}
function confirm() {
  emit('update:modelValue', durationToSeconds(minutes.value, seconds.value, props.min, props.max))
  open.value = false
}
</script>

<style scoped>
.duration-trigger { width: 100%; justify-content: flex-start; font-variant-numeric: tabular-nums; }
.duration-trigger :deep(> span) { width: 100%; display: flex; align-items: center; gap: 8px; }
.chevron { margin-left: auto; color: var(--text-tertiary); }
.picker-title { margin: 2px 0 16px; font-weight: 600; color: var(--text-primary); }
.wheels { display: flex; align-items: center; gap: 8px; }
.separator { padding-top: 28px; color: var(--text-tertiary); }
.range { margin: 14px 0; font-size: 12px; color: var(--text-tertiary); line-height: 1.6; }
.picker-footer { display: flex; justify-content: flex-end; border-top: 1px solid var(--el-border-color-lighter); padding-top: 12px; }
</style>
