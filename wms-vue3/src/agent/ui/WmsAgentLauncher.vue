<template>
  <div v-if="store.enabled" class="agent-shell">
    <Transition name="panel-fade">
      <WmsAgentPanel v-if="store.panelOpen && launcherRect" :anchor-rect="launcherRect" />
    </Transition>

    <button
      ref="launcherRef"
      class="launcher"
      :class="[`is-${store.status}`, { 'is-open': store.panelOpen }]"
      :style="launcherStyle"
      type="button"
      :aria-expanded="store.panelOpen"
      :aria-label="store.panelOpen ? '收起 WMS小助手' : '打开 WMS小助手'"
      @click="togglePanel"
      @pointerdown="startDrag"
    >
      <span class="warehouse-glyph" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span class="launcher-copy">
        <strong>WMS小助手</strong>
        <small>{{ statusLabel }}</small>
      </span>
      <span
        v-if="store.status === 'awaiting-confirmation' || store.status === 'awaiting-input'"
        class="attention-dot"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useAgentUiStore } from '@/agent/stores/agentUiStore'
import WmsAgentPanel from './WmsAgentPanel.vue'

const store = useAgentUiStore()
const launcherRef = ref<HTMLButtonElement>()
const position = reactive({ x: 0, y: 0 })
const launcherRect = ref<DOMRect | null>(null)
const positioned = ref(false)
const storageKey = 'wms-agent-launcher-position'
let dragStart: { pointerX: number; pointerY: number; x: number; y: number } | null = null
let dragged = false
let suppressClick = false

const launcherStyle = computed(() =>
  positioned.value
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
        right: 'auto',
        bottom: 'auto',
      }
    : undefined,
)

const statusLabel = computed(() => {
  if (!store.available) return '未连接'
  const labels = {
    idle: '待命',
    thinking: '分析中',
    executing: '执行中',
    'awaiting-input': '等你回答',
    'awaiting-confirmation': '待确认',
    success: '已完成',
    error: '异常',
    stopped: '已停止',
  }
  return labels[store.status]
})

function clampPosition(x: number, y: number) {
  const element = launcherRef.value
  if (!element) return { x, y }
  const margin = 8
  return {
    x: Math.min(Math.max(x, margin), Math.max(margin, window.innerWidth - element.offsetWidth - margin)),
    y: Math.min(Math.max(y, margin), Math.max(margin, window.innerHeight - element.offsetHeight - margin)),
  }
}

function updateLauncherRect() {
  if (launcherRef.value) launcherRect.value = launcherRef.value.getBoundingClientRect()
}

function setPosition(x: number, y: number) {
  Object.assign(position, clampPosition(x, y))
  void nextTick(updateLauncherRect)
}

function savePosition() {
  localStorage.setItem(storageKey, JSON.stringify(position))
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0) return
  dragStart = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    x: position.x,
    y: position.y,
  }
  dragged = false
  launcherRef.value?.setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', drag)
  window.addEventListener('pointerup', endDrag, { once: true })
}

function drag(event: PointerEvent) {
  if (!dragStart) return
  const deltaX = event.clientX - dragStart.pointerX
  const deltaY = event.clientY - dragStart.pointerY
  if (!dragged && Math.hypot(deltaX, deltaY) < 4) return
  dragged = true
  event.preventDefault()
  setPosition(dragStart.x + deltaX, dragStart.y + deltaY)
}

function endDrag() {
  window.removeEventListener('pointermove', drag)
  if (dragged) {
    suppressClick = true
    savePosition()
    window.setTimeout(() => {
      suppressClick = false
    }, 0)
  }
  dragStart = null
}

function togglePanel() {
  if (!suppressClick) store.togglePanel()
}

function handleViewportResize() {
  setPosition(position.x, position.y)
}

onMounted(async () => {
  await nextTick()
  const element = launcherRef.value
  if (!element) return

  let saved: { x?: number; y?: number } | undefined
  try {
    saved = JSON.parse(localStorage.getItem(storageKey) || '')
  } catch {
    saved = undefined
  }

  const initialX = typeof saved?.x === 'number' ? saved.x : window.innerWidth - element.offsetWidth - 22
  const initialY = typeof saved?.y === 'number' ? saved.y : window.innerHeight - element.offsetHeight - 22
  setPosition(initialX, initialY)
  positioned.value = true
  await nextTick()
  updateLauncherRect()
  window.addEventListener('resize', handleViewportResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleViewportResize)
  window.removeEventListener('pointermove', drag)
  window.removeEventListener('pointerup', endDrag)
})
</script>

<style scoped>
.agent-shell { --agent-accent: #168aad; }

.launcher {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 1991;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 112px;
  height: 50px;
  padding: 0 14px 0 11px;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 13px;
  background: #203846;
  color: #fff;
  box-shadow: 0 10px 24px rgb(28 54 67 / 24%);
  cursor: pointer;
  touch-action: none;
  user-select: none;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.launcher:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgb(28 54 67 / 28%); }
.launcher:focus-visible { outline: 3px solid rgb(22 138 173 / 35%); outline-offset: 3px; }
.launcher.is-awaiting-confirmation,
.launcher.is-awaiting-input { --agent-accent: #f3b43f; background: #684d1e; }
.launcher.is-error { --agent-accent: #ef6078; background: #653342; }
.launcher.is-success { --agent-accent: #5ed0a3; }

.warehouse-glyph {
  display: grid;
  grid-template-columns: repeat(3, 3px);
  align-items: end;
  gap: 2px;
  width: 24px;
  height: 24px;
  padding: 4px;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 7px;
  box-sizing: border-box;
}

.warehouse-glyph i { display: block; height: 7px; border-radius: 1px; background: var(--agent-accent); }
.warehouse-glyph i:nth-child(2) { height: 12px; }
.warehouse-glyph i:nth-child(3) { height: 9px; }
.is-thinking .warehouse-glyph i, .is-executing .warehouse-glyph i { animation: rack-scan 1.1s ease-in-out infinite; }
.is-thinking .warehouse-glyph i:nth-child(2), .is-executing .warehouse-glyph i:nth-child(2) { animation-delay: 0.12s; }
.is-thinking .warehouse-glyph i:nth-child(3), .is-executing .warehouse-glyph i:nth-child(3) { animation-delay: 0.24s; }

.launcher-copy { display: grid; min-width: 72px; text-align: left; }
.launcher-copy strong { font-size: 13px; line-height: 1.2; letter-spacing: 0.02em; }
.launcher-copy small { margin-top: 2px; color: rgb(255 255 255 / 68%); font-size: 9px; }
.attention-dot { position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; border: 2px solid #fff; border-radius: 50%; background: #f3b43f; }

.panel-fade-enter-active, .panel-fade-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.panel-fade-enter-from, .panel-fade-leave-to { opacity: 0; transform: translateY(8px); }

@keyframes rack-scan {
  0%, 100% { opacity: 0.42; }
  45% { opacity: 1; }
}

@media (max-width: 520px) {
  .launcher { right: 14px; bottom: 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .launcher, .panel-fade-enter-active, .panel-fade-leave-active { transition: none; }
  .warehouse-glyph i { animation: none !important; }
}
</style>
