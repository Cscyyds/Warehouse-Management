<template>
  <div class="wheel-wrap">
    <div class="wheel-unit">{{ label }}</div>
    <div class="wheel-highlight" />
    <div ref="scroller" class="wheel" role="listbox" :aria-label="label" tabindex="0"
      :aria-activedescendant="`${id}-${modelValue}`" @scroll="onScroll" @keydown="onKey">
      <div v-for="value in values" :id="`${id}-${value}`" :key="value" role="option"
        :aria-selected="value === modelValue" class="wheel-option" :class="{ selected: value === modelValue }"
        @click="select(value)">{{ String(value).padStart(2, '0') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
const props = defineProps<{ modelValue: number; values: number[]; label: string; id: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const scroller = ref<HTMLElement>()
const ROW = 36
function align() {
  if (scroller.value) scroller.value.scrollTop = Math.max(0, props.values.indexOf(props.modelValue)) * ROW
}
function onScroll() {
  const index = Math.min(props.values.length - 1, Math.max(0, Math.round((scroller.value?.scrollTop || 0) / ROW)))
  const value = props.values[index]
  if (value !== undefined && value !== props.modelValue) emit('update:modelValue', value)
}
function select(value: number) {
  emit('update:modelValue', value)
  if (scroller.value) scroller.value.scrollTop = props.values.indexOf(value) * ROW
}
function onKey(event: KeyboardEvent) {
  const index = props.values.indexOf(props.modelValue)
  const offsets: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -10, PageDown: 10 }
  let next = index
  if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = props.values.length - 1
  else if (event.key in offsets) next += offsets[event.key]!
  else return
  event.preventDefault()
  const value = props.values[Math.max(0, Math.min(props.values.length - 1, next))]
  if (value !== undefined) select(value)
}
watch(() => props.values, async () => { await nextTick(); align() })
watch(() => props.modelValue, async () => {
  await nextTick()
  const target = Math.max(0, props.values.indexOf(props.modelValue)) * ROW
  if (scroller.value && Math.abs(scroller.value.scrollTop - target) > ROW / 2) align()
})
onMounted(align)
</script>

<style scoped>
.wheel-wrap { position: relative; flex: 1; min-width: 0; text-align: center; }
.wheel-unit { height: 28px; color: var(--text-secondary); font-size: 12px; }
.wheel { position: relative; height: 180px; overflow-y: auto; overscroll-behavior: contain; scroll-snap-type: y mandatory; padding: 72px 0; box-sizing: border-box; scrollbar-width: thin; }
.wheel:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; border-radius: 8px; }
.wheel-option { height: 36px; line-height: 36px; scroll-snap-align: center; cursor: pointer; font-size: 18px; font-variant-numeric: tabular-nums; color: var(--text-tertiary); }
.wheel-option.selected { color: var(--el-color-primary); font-weight: 700; font-size: 22px; }
.wheel-highlight { position: absolute; top: 100px; left: 4px; right: 4px; height: 36px; border-radius: 8px; background: var(--el-color-primary-light-9); pointer-events: none; }
</style>
