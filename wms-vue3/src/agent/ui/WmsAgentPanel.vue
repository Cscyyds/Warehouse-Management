<template>
  <aside
    class="agent-panel"
    :style="panelStyle"
    aria-label="WMS小助手面板"
    data-page-agent-ignore="true"
    data-browser-use-ignore="true"
  >
    <WmsAgentHeader />

    <div class="status-strip" :class="`is-${store.status}`" role="status" aria-live="polite">
      <span class="status-rail" />
      <WmsAgentThinking
        v-if="store.isRunning && !['awaiting-confirmation', 'awaiting-input'].includes(store.status)"
      />
      <span>{{ store.activityText }}</span>
    </div>

    <div v-if="store.confirmation" class="confirmation-note">
      <span>需要确认</span>
      <strong>{{ store.confirmation.title }}</strong>
      <p>{{ store.confirmation.summary }}</p>
      <small>请在页面审核预览弹窗中确认或取消</small>
    </div>

    <WmsAgentConversation :messages="store.messages" :entries="store.timeline" />
    <WmsAgentComposer />

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
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { useAgentUiStore } from '@/agent/stores/agentUiStore'
import WmsAgentComposer from './WmsAgentComposer.vue'
import WmsAgentConversation from './WmsAgentConversation.vue'
import WmsAgentHeader from './WmsAgentHeader.vue'
import WmsAgentThinking from './WmsAgentThinking.vue'

type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

const props = defineProps<{ anchorRect: DOMRect }>()
const store = useAgentUiStore()
const viewportMargin = 8
const anchorGap = 12
const minimumWidth = 320
const minimumHeight = 360
const storageKey = 'wms-agent-panel-size'
const resizeDirections: ResizeDirection[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
const panelRect = reactive({ x: 0, y: 0, width: 380, height: 420 })
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

const panelStyle = computed(() => ({
  left: `${panelRect.x}px`,
  top: `${panelRect.y}px`,
  width: `${panelRect.width}px`,
  height: `${panelRect.height}px`,
}))

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function clampPanelSize(width: number, height: number) {
  const maximumWidth = Math.max(1, window.innerWidth - viewportMargin * 2)
  const maximumHeight = Math.max(1, window.innerHeight - viewportMargin * 2)
  panelRect.width = clamp(width, Math.min(minimumWidth, maximumWidth), maximumWidth)
  panelRect.height = clamp(height, Math.min(minimumHeight, maximumHeight), maximumHeight)
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
  const minWidth = Math.min(minimumWidth, window.innerWidth - viewportMargin * 2)
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
  placePanel()
  window.addEventListener('resize', handleViewportResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleViewportResize)
  window.removeEventListener('pointermove', resizePanel)
  window.removeEventListener('pointerup', stopResize)
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
}

@media (prefers-reduced-motion: reduce) {
  .agent-panel { animation: none; }
}
</style>
