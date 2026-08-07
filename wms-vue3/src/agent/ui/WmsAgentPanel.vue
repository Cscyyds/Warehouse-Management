<template>
  <aside
    class="agent-panel"
    :style="panelStyle"
    aria-label="WMS小助手面板"
    data-page-agent-ignore="true"
    data-browser-use-ignore="true"
  >
    <WmsAgentHeader />

    <div class="panel-body">
      <WmsAgentHistory v-if="store.historyOpen" :style="historyStyle" />
      <span
        v-if="store.historyOpen"
        class="history-resize-handle"
        role="separator"
        aria-label="调整历史记录栏宽度"
        aria-orientation="vertical"
        :aria-valuemin="historyMinimumWidth"
        :aria-valuemax="historyMaximumWidth"
        :aria-valuenow="Math.round(historyWidth)"
        tabindex="0"
        @pointerdown.stop.prevent="startHistoryResize"
        @keydown.left.prevent="adjustHistoryWidth(-12)"
        @keydown.right.prevent="adjustHistoryWidth(12)"
      />
      <button
        class="history-expand-button"
        :class="{ 'is-collapsed': !store.historyOpen }"
        :style="store.historyOpen ? { left: `${historyWidth}px` } : undefined"
        type="button"
        :aria-label="store.historyOpen ? '收起对话历史' : '展开对话历史'"
        :title="store.historyOpen ? '收起对话历史' : '展开对话历史'"
        @click="store.toggleHistory()"
      >
        {{ store.historyOpen ? '<' : '>' }}
      </button>

      <div class="panel-main">
        <div class="status-strip" :class="`is-${store.status}`" role="status" aria-live="polite">
          <span class="status-rail" />
          <WmsAgentThinking
            v-if="store.isRunning && !['awaiting-confirmation', 'awaiting-input'].includes(store.status)"
          />
          <span>{{ store.streamingActive ? '正在输出结果…' : store.activityText }}</span>
        </div>

        <div v-if="store.confirmation" class="confirmation-note">
          <span>需要确认</span>
          <strong>{{ store.confirmation.title }}</strong>
          <p>{{ store.confirmation.summary }}</p>
          <small>请在页面审核预览弹窗中确认或取消</small>
        </div>

        <WmsAgentConversation
          :messages="store.messages"
          :entries="store.timeline"
          :streaming-message-id="store.streamingMessageId"
        />
        <WmsAgentComposer />
      </div>
    </div>

    <span
      v-for="direction in resizeDirections"
      :key="direction"
      class="resize-handle"
      :class="`is-${direction}`"
      aria-hidden="true"
      @pointerdown.stop.prevent="startResize(direction, $event)"
    />
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useAgentUiStore } from '@/agent/stores/agentUiStore'
import WmsAgentComposer from './WmsAgentComposer.vue'
import WmsAgentConversation from './WmsAgentConversation.vue'
import WmsAgentHeader from './WmsAgentHeader.vue'
import WmsAgentHistory from './WmsAgentHistory.vue'
import WmsAgentThinking from './WmsAgentThinking.vue'

type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

const props = defineProps<{ anchorRect: DOMRect }>()
const store = useAgentUiStore()
const viewportMargin = 8
const anchorGap = 12
const minimumWidth = 320
const minimumHeight = 360
const historyMinimumWidth = 150
const historyDefaultWidth = 190
const conversationMinimumWidth = 280
const storageKey = 'wms-agent-panel-size'
const historyStorageKey = 'wms-agent-history-width'
const resizeDirections: ResizeDirection[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
const panelRect = reactive({ x: 0, y: 0, width: 560, height: 680 })
const historyWidth = ref(historyDefaultWidth)
let resizing:
  | {
      direction: ResizeDirection
      pointerX: number
      pointerY: number
      left: number
      top: number
      right: number
      bottom: number
    }
  | undefined
let historyResizing: { pointerX: number; width: number } | undefined

const historyMaximumWidth = computed(() => Math.max(
  historyMinimumWidth,
  panelRect.width - conversationMinimumWidth,
))
const historyStyle = computed(() => ({
  width: `${historyWidth.value}px`,
  flexBasis: `${historyWidth.value}px`,
}))

const panelStyle = computed(() => ({
  left: `${panelRect.x}px`,
  top: `${panelRect.y}px`,
  width: `${panelRect.width}px`,
  height: `${panelRect.height}px`,
}))

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function currentMinimumPanelWidth() {
  return store.historyOpen
    ? historyMinimumWidth + conversationMinimumWidth
    : minimumWidth
}

function clampPanelSize(width: number, height: number) {
  const maximumWidth = Math.max(1, window.innerWidth - viewportMargin * 2)
  const maximumHeight = Math.max(1, window.innerHeight - viewportMargin * 2)
  panelRect.width = clamp(width, Math.min(currentMinimumPanelWidth(), maximumWidth), maximumWidth)
  panelRect.height = clamp(height, Math.min(minimumHeight, maximumHeight), maximumHeight)
  historyWidth.value = clamp(historyWidth.value, historyMinimumWidth, historyMaximumWidth.value)
}

function adjustHistoryWidth(delta: number) {
  historyWidth.value = clamp(
    historyWidth.value + delta,
    historyMinimumWidth,
    historyMaximumWidth.value,
  )
  localStorage.setItem(historyStorageKey, String(historyWidth.value))
}

function startHistoryResize(event: PointerEvent) {
  if (event.button !== 0) return
  historyResizing = { pointerX: event.clientX, width: historyWidth.value }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  window.addEventListener('pointermove', resizeHistory)
  window.addEventListener('pointerup', stopHistoryResize, { once: true })
}

function resizeHistory(event: PointerEvent) {
  if (!historyResizing) return
  event.preventDefault()
  historyWidth.value = clamp(
    historyResizing.width + event.clientX - historyResizing.pointerX,
    historyMinimumWidth,
    historyMaximumWidth.value,
  )
}

function stopHistoryResize() {
  window.removeEventListener('pointermove', resizeHistory)
  historyResizing = undefined
  document.body.style.removeProperty('user-select')
  document.body.style.removeProperty('cursor')
  localStorage.setItem(historyStorageKey, String(historyWidth.value))
}

function placePanel() {
  const anchor = props.anchorRect
  clampPanelSize(panelRect.width, panelRect.height)

  const roomAbove = anchor.top - anchorGap - viewportMargin
  const roomBelow = window.innerHeight - anchor.bottom - anchorGap - viewportMargin
  const openAbove = roomAbove >= panelRect.height || (roomBelow < panelRect.height && roomAbove >= roomBelow)
  const desiredX = anchor.right - panelRect.width
  const desiredY = openAbove ? anchor.top - anchorGap - panelRect.height : anchor.bottom + anchorGap

  panelRect.x = clamp(
    desiredX,
    viewportMargin,
    Math.max(viewportMargin, window.innerWidth - panelRect.width - viewportMargin),
  )
  panelRect.y = clamp(
    desiredY,
    viewportMargin,
    Math.max(viewportMargin, window.innerHeight - panelRect.height - viewportMargin),
  )
}

function startResize(direction: ResizeDirection, event: PointerEvent) {
  if (event.button !== 0) return
  resizing = {
    direction,
    pointerX: event.clientX,
    pointerY: event.clientY,
    left: panelRect.x,
    top: panelRect.y,
    right: panelRect.x + panelRect.width,
    bottom: panelRect.y + panelRect.height,
  }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', resizePanel)
  window.addEventListener('pointerup', stopResize, { once: true })
}

function resizePanel(event: PointerEvent) {
  if (!resizing) return
  event.preventDefault()
  const deltaX = event.clientX - resizing.pointerX
  const deltaY = event.clientY - resizing.pointerY
  const minWidth = Math.min(currentMinimumPanelWidth(), window.innerWidth - viewportMargin * 2)
  const minHeight = Math.min(minimumHeight, window.innerHeight - viewportMargin * 2)
  let { left, top, right, bottom } = resizing

  if (resizing.direction.includes('e')) {
    right = clamp(resizing.right + deltaX, left + minWidth, window.innerWidth - viewportMargin)
  }
  if (resizing.direction.includes('w')) {
    left = clamp(resizing.left + deltaX, viewportMargin, right - minWidth)
  }
  if (resizing.direction.includes('s')) {
    bottom = clamp(resizing.bottom + deltaY, top + minHeight, window.innerHeight - viewportMargin)
  }
  if (resizing.direction.includes('n')) {
    top = clamp(resizing.top + deltaY, viewportMargin, bottom - minHeight)
  }

  panelRect.x = left
  panelRect.y = top
  panelRect.width = right - left
  panelRect.height = bottom - top
}

function stopResize() {
  window.removeEventListener('pointermove', resizePanel)
  resizing = undefined
  localStorage.setItem(
    storageKey,
    JSON.stringify({ width: panelRect.width, height: panelRect.height }),
  )
}

function handleViewportResize() {
  placePanel()
}

watch(
  () => [props.anchorRect.left, props.anchorRect.top, props.anchorRect.width, props.anchorRect.height],
  placePanel,
)

// 展开历史侧栏时若面板过窄,自动加宽一个侧栏宽度,避免挤压对话区。
watch(
  () => store.historyOpen,
  (open) => {
    if (!open) return
    const neededWidth = conversationMinimumWidth + historyWidth.value
    if (panelRect.width >= neededWidth) return
    clampPanelSize(neededWidth, panelRect.height)
    panelRect.x = clamp(
      panelRect.x,
      viewportMargin,
      Math.max(viewportMargin, window.innerWidth - panelRect.width - viewportMargin),
    )
  },
)

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '') as {
      width?: number
      height?: number
    }
    if (typeof saved.width === 'number') panelRect.width = saved.width
    if (typeof saved.height === 'number') panelRect.height = saved.height
  } catch {
    // Ignore invalid local preferences and use the defaults.
  }
  const savedHistoryWidth = Number(localStorage.getItem(historyStorageKey))
  if (Number.isFinite(savedHistoryWidth)) {
    historyWidth.value = Math.max(historyMinimumWidth, savedHistoryWidth)
  }
  placePanel()
  window.addEventListener('resize', handleViewportResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleViewportResize)
  window.removeEventListener('pointermove', resizePanel)
  window.removeEventListener('pointerup', stopResize)
  window.removeEventListener('pointermove', resizeHistory)
  window.removeEventListener('pointerup', stopHistoryResize)
  document.body.style.removeProperty('user-select')
  document.body.style.removeProperty('cursor')
  // 释放打字机定时器,避免面板卸载后仍在写已不存在的消息。
  store.stopStreaming()
})
</script>

<style scoped>
.agent-panel {
  position: fixed;
  z-index: 1990;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #ccd9e2;
  border-radius: 14px;
  background: #fdfefe;
  box-shadow: 0 18px 50px rgb(31 52 66 / 18%), 0 3px 12px rgb(31 52 66 / 8%);
  color: #263746;
  animation: panel-enter 0.2s ease-out;
}

.resize-handle {
  position: absolute;
  z-index: 2;
  touch-action: none;
}

.resize-handle.is-n, .resize-handle.is-s { left: 10px; right: 10px; height: 8px; cursor: ns-resize; }
.resize-handle.is-n { top: 0; }
.resize-handle.is-s { bottom: 0; }
.resize-handle.is-e, .resize-handle.is-w { top: 10px; bottom: 10px; width: 8px; cursor: ew-resize; }
.resize-handle.is-e { right: 0; }
.resize-handle.is-w { left: 0; }
.resize-handle.is-ne, .resize-handle.is-se, .resize-handle.is-sw, .resize-handle.is-nw { width: 14px; height: 14px; }
.resize-handle.is-ne { top: 0; right: 0; cursor: nesw-resize; }
.resize-handle.is-se { right: 0; bottom: 0; cursor: nwse-resize; }
.resize-handle.is-sw { bottom: 0; left: 0; cursor: nesw-resize; }
.resize-handle.is-nw { top: 0; left: 0; cursor: nwse-resize; }

.panel-body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.history-resize-handle {
  position: relative;
  z-index: 4;
  flex: 0 0 7px;
  width: 7px;
  margin-left: -4px;
  cursor: col-resize;
  touch-action: none;
  outline: 0;
}

.history-resize-handle::after {
  position: absolute;
  inset: 0 3px;
  background: transparent;
  content: '';
  transition: background-color 0.14s ease, box-shadow 0.14s ease;
}

.history-resize-handle:hover::after,
.history-resize-handle:focus-visible::after {
  background: #168aad;
  box-shadow: 0 0 0 2px rgb(22 138 173 / 12%);
}

.history-expand-button {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  display: grid;
  place-items: center;
  width: 24px;
  height: 48px;
  padding: 0;
  border: 1px solid #cbdde4;
  border-left: 0;
  border-radius: 0 12px 12px 0;
  background: #f7fafc;
  color: #146c86;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  box-shadow: 3px 0 8px rgb(31 52 66 / 12%);
}

/* 折叠态:贴面板左边框,向右凸出到面板里侧,符号 ">" */
.history-expand-button.is-collapsed { left: 0; }

/* 展开态:贴侧栏右缘(=主面板左缘,分隔线),同样向右凸出到主面板里侧,符号 "<" */
.history-expand-button:not(.is-collapsed) { left: 190px; /* 与 .history-sidebar 宽度一致 */ }

.history-expand-button:hover { background: #e3f0f4; color: #0f5f77; }
.history-expand-button:focus-visible { outline: 2px solid #168aad; outline-offset: -2px; }

.panel-main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.status-strip {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 18px 0 21px;
  background: #edf6f8;
  color: #30697b;
  font-size: 11px;
}

.status-rail { position: absolute; inset: 0 auto 0 0; width: 3px; background: #168aad; }
.is-awaiting-confirmation { background: #fff7e8; color: #906417; }
.is-awaiting-confirmation .status-rail { background: #d89614; }
.is-awaiting-input { background: #fff9e9; color: #80601a; }
.is-awaiting-input .status-rail { background: #d49a20; }
.is-incomplete { background: #fff9e9; color: #80601a; }
.is-incomplete .status-rail { background: #d49a20; }
.is-error { background: #fff1f3; color: #a62d47; }
.is-error .status-rail { background: #d9485f; }
.is-success { background: #edf8f3; color: #267557; }
.is-success .status-rail { background: #2f9e73; }

.confirmation-note { margin: 14px 14px 0; padding: 11px 12px; border: 1px solid #efd9a8; border-radius: 9px; background: #fffaf0; }
.confirmation-note span { display: block; margin-bottom: 3px; color: #a57418; font: 600 9px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: 0.1em; }
.confirmation-note strong { color: #503e1d; font-size: 13px; }
.confirmation-note p { margin: 4px 0; color: #755f34; font-size: 11px; line-height: 1.5; }
.confirmation-note small { color: #9a7a3d; font-size: 10px; }

@keyframes panel-enter {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (max-width: 520px) {
  .resize-handle { display: none; }
  .history-resize-handle { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .agent-panel { animation: none; }
}
</style>
