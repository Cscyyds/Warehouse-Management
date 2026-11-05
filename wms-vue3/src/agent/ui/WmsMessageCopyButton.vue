<template>
  <!--
    消息气泡底部的快捷复制按钮：默认透明且不可聚焦，鼠标进入所在消息
    （.message-row / .msg）时由外部样式把它显现出来。组件自身只负责
    "复制哪段文本" 和 "复制后的状态反馈"。
  -->
  <button
    type="button"
    class="msg-copy-btn"
    :class="{ 'is-copied': state === 'copied', 'is-failed': state === 'failed' }"
    :disabled="!text"
    :title="label"
    :aria-label="label"
    @click.stop="handleCopy"
  >
    <svg v-if="state === 'failed'" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8v5M12 16.5v.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6" />
    </svg>
    <svg v-else-if="state === 'copied'" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7" />
      <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6.5A3.5 3.5 0 0 0 3 6.5v6A2.5 2.5 0 0 0 5.5 15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    </svg>
    <span class="msg-copy-btn-text">{{ buttonText }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { copyText } from '@/utils/clipboard'

const props = defineProps<{
  /** 要复制的纯文本；为空时按钮禁用（无内容可复制）。 */
  text: string
  /** 默认提示文案。 */
  label?: string
}>()

type CopyState = 'idle' | 'copied' | 'failed'
const state = ref<CopyState>('idle')
const FEEDBACK_MS = 1600
let timer: ReturnType<typeof setTimeout> | undefined

const buttonText = computed(() => {
  if (state.value === 'copied') return '已复制'
  if (state.value === 'failed') return '复制失败'
  return '复制'
})

const label = computed(() => {
  if (state.value === 'copied') return '已复制到剪贴板'
  if (state.value === 'failed') return '复制失败，请手动选中文本复制'
  return props.label || '复制这条消息'
})

function scheduleReset() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    state.value = 'idle'
    timer = undefined
  }, FEEDBACK_MS)
}

async function handleCopy() {
  if (!props.text) return
  const ok = await copyText(props.text)
  state.value = ok ? 'copied' : 'failed'
  scheduleReset()
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  timer = undefined
})
</script>

<style scoped>
.msg-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin: 4px 0 0;
  padding: 2px 7px 2px 5px;
  border: 1px solid #d5e3e8;
  border-radius: 7px;
  /* 默认隐藏：宽度/透明度都参与过渡，hover 时不会推动气泡重排。 */
  background: #ffffff;
  color: #6d8794;
  font-family: inherit;
  font-size: 11px;
  line-height: 1.6;
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transform: translateY(2px);
  transition: opacity 0.16s ease, transform 0.16s ease, color 0.16s ease,
    border-color 0.16s ease, background-color 0.16s ease, visibility 0s linear 0.16s;
}
.msg-copy-btn svg {
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
}
.msg-copy-btn-text { white-space: nowrap; }
.msg-copy-btn:hover:not(:disabled) {
  border-color: #a8ccd7;
  background: #f2f8fa;
  color: #146c86;
}
.msg-copy-btn:focus-visible {
  outline: 2px solid #168aad;
  outline-offset: 1px;
}
.msg-copy-btn:disabled { cursor: default; }
.msg-copy-btn.is-copied {
  border-color: #b9dfcf;
  background: #f1faf6;
  color: #268a64;
}
/* 复制成功后按钮保持可见，避免反馈一闪而过用户没看见。 */
.msg-copy-btn.is-copied,
.msg-copy-btn.is-failed {
  opacity: 1;
  visibility: visible;
  transform: none;
  transition-delay: 0s;
}
.msg-copy-btn.is-failed {
  border-color: #eec7c4;
  background: #fdf4f3;
  color: #b4352f;
}
@media (prefers-reduced-motion: reduce) {
  .msg-copy-btn { transition: none; }
}
</style>