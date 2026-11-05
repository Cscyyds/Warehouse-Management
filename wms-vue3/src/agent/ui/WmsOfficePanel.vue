<template>
  <section class="office-panel">
    <div ref="officeBodyRef" class="office-body">
      <!-- 会话记录侧栏（app 抽屉的桌面形态） -->
      <Transition name="sessions-slide">
        <aside v-if="sessionsOpen" class="sessions-rail" :style="sessionsRailStyle" aria-label="办公会话记录">
          <button type="button" class="new-chat" :disabled="store.officeBusy" @click="newConversation">＋ 新建会话</button>
          <p class="rail-caption">最近会话</p>
          <div v-if="store.officeLoadingSessions || store.officeInitializing" class="rail-loading" aria-live="polite">
            <span class="loading-spinner" />
          </div>
          <ul class="sessions-list">
            <li
              v-for="item in sessionItems"
              :key="item.id"
              class="session-row"
              :class="{ 'is-active': item.id === store.officeCurrentId }"
            >
              <button
                type="button"
                class="session-item"
                :disabled="store.officeAnswering"
                :title="item.title"
                @click="switchConversation(item.id)"
              >
                <span class="session-title">{{ item.title }}</span>
                <span v-if="item.updatedAt" class="session-meta">{{ item.updatedAt }}</span>
              </button>
              <button
                type="button"
                class="session-del"
                aria-label="删除会话"
                title="删除会话"
                @click.stop="confirmRemoveConversation(item)"
              >×</button>
            </li>
            <li v-if="!sessionItems.length && !store.officeLoadingSessions && !store.officeInitializing" class="sessions-empty">
              暂无会话记录<br>点击上方按钮开始新对话
            </li>
          </ul>
        </aside>
      </Transition>

      <span
        v-if="sessionsOpen"
        class="sessions-resize-handle"
        role="separator"
        aria-label="调整办公会话记录栏宽度"
        aria-orientation="vertical"
        :aria-valuemin="sessionsMinimumWidth"
        :aria-valuemax="sessionsMaximumWidth"
        :aria-valuenow="Math.round(sessionsWidth)"
        tabindex="0"
        @pointerdown.stop.prevent="startSessionsResize"
        @keydown.left.prevent="adjustSessionsWidth(-12)"
        @keydown.right.prevent="adjustSessionsWidth(12)"
      />

      <button
        type="button"
        class="sessions-toggle"
        :class="{ 'is-open': sessionsOpen }"
        :style="sessionsOpen ? { left: `${sessionsWidth}px` } : undefined"
        :aria-label="sessionsOpen ? '收起会话记录' : '展开会话记录'"
        :title="sessionsOpen ? '收起会话记录' : '展开会话记录'"
        @click="sessionsOpen = !sessionsOpen"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
      </button>

      <!-- 对话区 -->
      <div ref="conversationRef" class="office-conversation" @scroll="handleConversationScroll">
        <template v-for="(message, messageIndex) in messages" :key="message.id">
          <!-- 用户消息：附件卡（文档徽标 / 图片网格）+ 浅红气泡 -->
          <div v-if="message.role === 'user'" class="msg is-user">
            <div class="msg-col">
              <div v-if="message.payload.file" class="user-att-doc" :title="message.payload.file.name">
                <span class="att-badge">{{ message.payload.file.abbreviation }}</span>
                <span class="att-name">{{ message.payload.file.name }}</span>
              </div>
              <div v-if="message.payload.files.length" class="user-att-images">
                <button
                  v-for="file in message.payload.files"
                  :key="file.url + file.name"
                  type="button"
                  class="user-att-image"
                  :title="file.name"
                  @click="previewImages(imageAttachmentsOf(message), displayUrlOf(file))"
                >
                  <img :src="displayUrlOf(file)" :alt="file.name" @error="onAttachmentImageError($event, file)" />
                </button>
              </div>
              <div v-if="message.content" class="msg-bubble is-user">{{ message.content }}</div>
              <div class="msg-meta">
                <span>{{ formatTime(message.createdAt) }}</span>
                <WmsMessageCopyButton v-if="!isWelcome(message)" :text="userCopyTextOf(message)" />
              </div>
            </div>
          </div>

          <!-- 助手消息：思考步骤卡 + 白气泡（Markdown + 流式光标）+ 挂起态选项胶囊 + 图片列表 -->
          <div v-else class="msg is-assistant">
            <div class="msg-col">
              <div
                v-if="message.payload.statusSteps.length"
                class="trace-card"
                :class="{ 'is-expanded': store.officeTraceExpanded(message) }"
                role="button"
                tabindex="0"
                @click="store.toggleOfficeTrace(message.id)"
                @keydown.enter.prevent="store.toggleOfficeTrace(message.id)"
              >
                <div class="trace-head">
                  <span class="trace-dot" :class="{ 'is-running': store.officeTraceExpanded(message) }" />
                  <span class="trace-title">
                    {{ store.officeTraceExpanded(message) ? '正在梳理信息' : `已完成 · ${message.payload.statusSteps.length} 个步骤` }}
                  </span>
                  <span class="trace-toggle">{{ store.officeTraceExpanded(message) ? '收起 ⌃' : '展开 ⌄' }}</span>
                </div>
                <ol v-if="store.officeTraceExpanded(message)" class="trace-steps">
                  <li v-for="step in message.payload.statusSteps" :key="step.id">{{ step.content }}</li>
                </ol>
              </div>

              <div
                v-if="message.content || message.status === 'streaming'"
                class="msg-bubble is-assistant"
                :class="{ 'is-error': message.status === 'error', 'is-interrupted': message.status === 'interrupted' }"
              >
                <div class="office-markdown" v-html="assistantHtmlOf(message)" />
                <span v-if="message.status === 'streaming'" class="stream-cursor" aria-hidden="true" />
              </div>

              <!-- agent_poc 挂起态选项：胶囊按钮，点击原样全文回传发送 -->
              <div v-if="message.options.length" class="option-pills" role="group" aria-label="补充信息选项">
                <button
                  v-for="option in message.options"
                  :key="option"
                  type="button"
                  class="option-pill"
                  :disabled="!optionEnabled(message, messageIndex)"
                  @click="chooseOption(message, option)"
                >{{ option }}</button>
              </div>

              <div v-if="imagesOf(message).length" class="reply-images">
                <div v-for="image in imagesOf(message)" :key="image.url" class="reply-image-card">
                  <button type="button" class="reply-image-button" :title="image.title" @click="previewImages(imagesOf(message), image.url)">
                    <img :src="image.url" :alt="image.title" loading="lazy" />
                  </button>
                  <div class="reply-image-foot">
                    <span class="reply-image-title">{{ image.title }}</span>
                    <span class="reply-image-hint">点击查看大图</span>
                  </div>
                </div>
              </div>

              <div v-if="!isWelcome(message)" class="msg-meta">
                <span>{{ formatTime(message.createdAt) }}</span>
                <WmsMessageCopyButton :text="assistantCopyTextOf(message)" />
              </div>
            </div>
          </div>
        </template>

        <!-- 空态：会话尚未建立时显示欢迎语（app 始终以欢迎消息开场） -->
        <div v-if="!messages.length && !store.officeInitializing" class="msg is-assistant">
          <div class="msg-col">
            <div class="msg-bubble is-assistant">{{ welcomeText }}</div>
          </div>
        </div>

        <!-- 同步状态提示（app historyNotice） -->
        <p v-if="store.officeHistoryNotice" class="history-notice" aria-live="polite">{{ store.officeHistoryNotice }}</p>

        <!-- 处理中状态卡：打字点 + 状态文字（空时轮播趣味语句）+ 已完成步骤 -->
        <OfficeStatusCard
          v-if="store.officeThinking"
          :status-text="store.officeThinkingText"
          :steps="store.officeStatusSteps"
        />

        <div v-if="store.officeInitializing && !messages.length" class="office-loading" aria-live="polite">
          <span class="loading-spinner" />
          正在加载会话...
        </div>

        <p v-if="store.officeError" class="office-error" role="alert">{{ store.officeError }}</p>
      </div>
    </div>

    <!-- 输入区 -->
    <WmsOfficeComposer @preview-images="onComposerPreviewImages" />

    <!-- 对话请求失败结果弹窗（app ResultDialog） -->
    <Teleport to="body">
      <div v-if="store.officeResultDialog" class="result-overlay" @click.self="store.closeOfficeResultDialog()">
        <div class="result-modal" role="dialog" aria-modal="true" aria-label="操作结果">
          <span class="result-icon" :class="store.officeResultDialog.success ? 'is-success' : 'is-failure'" aria-hidden="true">
            {{ store.officeResultDialog.success ? '✓' : '!' }}
          </span>
          <h3>{{ store.officeResultDialog.title }}</h3>
          <p>{{ store.officeResultDialog.content }}</p>
          <button type="button" class="result-confirm" @click="store.closeOfficeResultDialog()">知道了</button>
        </div>
      </div>
    </Teleport>

    <!-- 全屏图片预览：左右切换 + 查看原图 -->
    <Teleport to="body">
      <div v-if="imagePreview" class="image-preview" role="dialog" aria-modal="true" aria-label="图片预览" @click.self="closeImagePreview">
        <div class="preview-topbar">
          <button type="button" class="preview-close" aria-label="关闭预览" @click="closeImagePreview">✕</button>
          <span class="preview-title">{{ currentPreviewImage?.title || '图片' }}</span>
          <span v-if="imagePreview.urls.length > 1" class="preview-counter">{{ imagePreview.index + 1 }} / {{ imagePreview.urls.length }}</span>
        </div>
        <button
          v-if="imagePreview.urls.length > 1"
          type="button"
          class="preview-nav is-prev"
          aria-label="上一张"
          @click="stepImagePreview(-1)"
        >‹</button>
        <img class="preview-image" :src="currentPreviewImage?.url" :alt="currentPreviewImage?.title" @click="openOriginalImage" />
        <button
          v-if="imagePreview.urls.length > 1"
          type="button"
          class="preview-nav is-next"
          aria-label="下一张"
          @click="stepImagePreview(1)"
        >›</button>
        <div class="preview-footbar">
          <span class="preview-hint">点击图片查看原图 · Esc 关闭{{ imagePreview.urls.length > 1 ? ' · ←→ 切换' : '' }}</span>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { OfficeChatMessage, OfficeUserAttachment } from '@/agent/types'
import { useAgentUiStore } from '@/agent/stores/agentUiStore'
import { toOfficeAnalysisMarkdown } from '@/agent/office/officeAnalysisFormat'
import { resolveOfficeImages } from '@/agent/office/officeChatApi'
import { renderAgentMarkdown } from './agentMarkdownRenderer'
import { buildOfficeUserCopyText, toPlainText } from './agentMessagePlainText'
import OfficeStatusCard from './OfficeStatusCard.vue'
import WmsOfficeComposer from './WmsOfficeComposer.vue'
import WmsMessageCopyButton from './WmsMessageCopyButton.vue'

const store = useAgentUiStore()
const conversationRef = ref<HTMLDivElement>()
const officeBodyRef = ref<HTMLDivElement>()
const sessionsOpen = ref(false)
const sessionsMinimumWidth = 150
const conversationMinimumWidth = 280
const sessionsStorageKey = 'wms-office-sessions-width'
const sessionsWidth = ref(190)
const officeBodyWidth = ref(560)
let sessionsResizing: { pointerX: number; width: number } | undefined
let officeBodyResizeObserver: ResizeObserver | undefined

/** 选项已点击的消息（点击后胶囊全部置灰，app questionSelected）。 */
const selectedOptionMessages = ref(new Set<string>())

interface ImagePreviewState {
  urls: Array<{ url: string; title: string }>
  index: number
}
const imagePreview = ref<ImagePreviewState | null>(null)

const sessionsMaximumWidth = computed(() => Math.max(sessionsMinimumWidth, officeBodyWidth.value - conversationMinimumWidth))
const sessionsRailStyle = computed(() => ({ width: `${sessionsWidth.value}px`, flexBasis: `${sessionsWidth.value}px` }))
const sessionItems = computed(() =>
  store.officeSessions.map(session => ({
    id: session.id,
    title: session.title || session.preview || '新会话',
    updatedAt: session.updatedAt,
  })),
)
const messages = computed(() => store.officeMessages)
const currentPreviewImage = computed(() =>
  imagePreview.value ? imagePreview.value.urls[imagePreview.value.index] ?? null : null)

function switchConversation(id: string) {
  void store.selectOfficeSession(id)
}

function newConversation() {
  store.createOfficeSession()
}

async function confirmRemoveConversation(session: { id: string; title: string }) {
  try {
    await ElMessageBox.confirm(`删除“${session.title}”后无法恢复，确定继续吗？`, '删除会话', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await store.removeOfficeSession(session.id)
  } catch {
    // 用户取消删除
  }
}

function clampSessionsWidth(width: number) {
  return Math.min(Math.max(width, sessionsMinimumWidth), sessionsMaximumWidth.value)
}

function adjustSessionsWidth(delta: number) {
  sessionsWidth.value = clampSessionsWidth(sessionsWidth.value + delta)
  localStorage.setItem(sessionsStorageKey, String(sessionsWidth.value))
}

function startSessionsResize(event: PointerEvent) {
  if (event.button !== 0) return
  sessionsResizing = { pointerX: event.clientX, width: sessionsWidth.value }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  window.addEventListener('pointermove', resizeSessions)
  window.addEventListener('pointerup', stopSessionsResize, { once: true })
}

function resizeSessions(event: PointerEvent) {
  if (!sessionsResizing) return
  event.preventDefault()
  sessionsWidth.value = clampSessionsWidth(sessionsResizing.width + event.clientX - sessionsResizing.pointerX)
}

function stopSessionsResize() {
  window.removeEventListener('pointermove', resizeSessions)
  sessionsResizing = undefined
  document.body.style.removeProperty('user-select')
  document.body.style.removeProperty('cursor')
  localStorage.setItem(sessionsStorageKey, String(sessionsWidth.value))
}

// ─── 消息渲染 ───────────────────────────────────────────────────────────

function isWelcome(message: OfficeChatMessage): boolean {
  return message.id.startsWith('welcome_')
}

const welcomeText = '你好，我是小星智问。你可以直接问我库存、订单和经营数据，也可以描述客户与商品，让我帮你生成开单草稿。'

/** 数据分析结构化决策 JSON 转正常 Markdown 呈现；其余回复保持原渲染。 */
function assistantHtmlOf(message: OfficeChatMessage): string {
  const display = message.role === 'assistant'
    ? (toOfficeAnalysisMarkdown(message.content, message.status === 'streaming') ?? message.content)
    : message.content
  return renderAgentMarkdown(display)
}

function imagesOf(message: OfficeChatMessage) {
  return resolveOfficeImages(message.payload?.images)
}

function imageAttachmentsOf(message: OfficeChatMessage) {
  return message.payload.files
    .map(file => ({ url: displayUrlOf(file), title: file.name }))
    .filter(image => !!image.url)
}

/** 图片附件展示地址：objectURL 优先（秒显），刷新后失效自动回退服务端 url。 */
function displayUrlOf(file: OfficeUserAttachment): string {
  return file.localUrl || file.url
}

function onAttachmentImageError(event: Event, file: OfficeUserAttachment) {
  const img = event.target as HTMLImageElement
  if (file.url && img.src !== file.url) img.src = file.url
}

function optionEnabled(message: OfficeChatMessage, index: number): boolean {
  const isLast = index === messages.value.length - 1
  return isLast
    && (message.status === 'streaming' || message.status === 'waiting_input')
    && !selectedOptionMessages.value.has(message.id)
}

function chooseOption(message: OfficeChatMessage, option: string) {
  selectedOptionMessages.value = new Set(selectedOptionMessages.value).add(message.id)
  store.handleOfficeQuestionOption(option)
}

function userCopyTextOf(message: OfficeChatMessage): string {
  const attachments = [
    ...(message.payload.file ? [message.payload.file] : []),
    ...message.payload.files,
  ]
  return buildOfficeUserCopyText(message.content, attachments)
}

function assistantCopyTextOf(message: OfficeChatMessage): string {
  const body = toPlainText(message.content)
  const images = imagesOf(message).map(image => image.title).filter(Boolean)
  if (!images.length) return body
  const lines = images.map(title => `[图片] ${title}`)
  return body ? `${body}\n${lines.join('\n')}` : lines.join('\n')
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ─── 图片全屏预览 ───────────────────────────────────────────────────────

function previewImages(urls: Array<{ url: string; title: string }>, current: string) {
  if (!urls.length) return
  const index = Math.max(0, urls.findIndex(image => image.url === current))
  imagePreview.value = { urls, index }
}

function onComposerPreviewImages(payload: { urls: Array<{ url: string; title: string }>; current: string }) {
  previewImages(payload.urls, payload.current)
}

function closeImagePreview() {
  imagePreview.value = null
}

function stepImagePreview(delta: number) {
  if (!imagePreview.value) return
  const total = imagePreview.value.urls.length
  imagePreview.value.index = (imagePreview.value.index + delta + total) % total
}

function openOriginalImage() {
  const url = currentPreviewImage.value?.url
  if (url) window.open(url, '_blank', 'noopener')
}

function handlePreviewKeydown(event: KeyboardEvent) {
  if (!imagePreview.value) return
  if (event.key === 'Escape') closeImagePreview()
  else if (event.key === 'ArrowLeft') stepImagePreview(-1)
  else if (event.key === 'ArrowRight') stepImagePreview(1)
}

// ─── 滚动跟随：进入/切换会话时直接瞬移到最末尾，同会话内平滑跟随 ────────

let lastScrolledSession: string | null = null
let autoFollow = true

function handleConversationScroll() {
  const el = conversationRef.value
  if (!el) return
  autoFollow = el.scrollHeight - el.scrollTop - el.clientHeight < 60
}

async function followMessages() {
  const el = conversationRef.value
  if (!el || !messages.value.length) return
  await nextTick()
  if (lastScrolledSession !== store.officeCurrentId) {
    lastScrolledSession = store.officeCurrentId
    autoFollow = true
    el.scrollTop = el.scrollHeight
    return
  }
  if (autoFollow) el.scrollTop = el.scrollHeight
}

// officeNotice → 轻提示（app snackbar）
watch(() => store.officeNotice, (notice) => {
  if (!notice) return
  ElMessage({ message: notice, type: 'info', grouping: true })
  store.consumeOfficeNotice()
})

onMounted(() => {
  const savedWidth = Number(localStorage.getItem(sessionsStorageKey))
  if (Number.isFinite(savedWidth)) sessionsWidth.value = clampSessionsWidth(savedWidth)
  const officeBody = officeBodyRef.value
  if (officeBody) {
    officeBodyWidth.value = officeBody.clientWidth
    officeBodyResizeObserver = new ResizeObserver(([entry]) => {
      officeBodyWidth.value = entry.contentRect.width
      sessionsWidth.value = clampSessionsWidth(sessionsWidth.value)
    })
    officeBodyResizeObserver.observe(officeBody)
  }
  window.addEventListener('keydown', handlePreviewKeydown)
  void store.initializeOfficePage()
})

onBeforeUnmount(() => {
  officeBodyResizeObserver?.disconnect()
  window.removeEventListener('pointermove', resizeSessions)
  window.removeEventListener('pointerup', stopSessionsResize)
  window.removeEventListener('keydown', handlePreviewKeydown)
  document.body.style.removeProperty('user-select')
  document.body.style.removeProperty('cursor')
})

watch(
  () => [messages.value.length, messages.value.at(-1)?.content, store.officeThinking, store.officeHistoryNotice],
  followMessages,
  { immediate: true },
)
</script>

<style scoped>
.office-panel {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  background: #f6f7f9;
  color: #1f2329;
}

.office-body {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}

/* ─── 会话侧栏 ─── */
.sessions-rail {
  flex: 0 0 190px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid #e8eaed;
  background: #f6f7f9;
  overflow: hidden;
}
.new-chat {
  margin: 12px 12px 4px;
  padding: 9px 0;
  border: 1px solid #e8eaed;
  border-radius: 12px;
  background: #ffffff;
  color: #1f2329;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s;
}
.new-chat:not(:disabled):hover { border-color: #f0b6b4; background: #fff0ef; }
.new-chat:disabled { opacity: 0.5; cursor: not-allowed; }
.rail-caption {
  margin: 16px 8px 8px 20px;
  color: #626a73;
  font-size: 12px;
}
.rail-loading {
  display: grid;
  place-items: center;
  padding: 24px 0;
}
.sessions-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  margin: 0;
  padding: 0 8px 10px;
  list-style: none;
  scrollbar-width: thin;
  scrollbar-color: rgb(154 161 169 / 55%) transparent;
}
.sessions-list::-webkit-scrollbar { width: 6px; }
.sessions-list::-webkit-scrollbar-thumb { background: rgb(154 161 169 / 55%); border-radius: 3px; }
.session-row {
  position: relative;
  display: flex;
  align-items: stretch;
  border-radius: 10px;
}
.session-row.is-active { background: #fff0ef; }
.session-item {
  flex: 1 1 auto;
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 8px 24px 8px 12px;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.session-item:not(:disabled):hover { background: rgb(229 57 53 / 5%); }
.session-row.is-active .session-item:not(:disabled):hover { background: #ffe7e5; }
.session-item:disabled { cursor: not-allowed; }
.session-title {
  overflow: hidden;
  color: #1f2329;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-meta { color: #626a73; font-size: 10px; }
.session-del {
  position: absolute;
  top: 7px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #626a73;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
}
.session-row:hover .session-del,
.session-del:focus-visible { opacity: 1; }
.session-del:hover { background: rgb(229 57 53 / 10%); color: #b71c1c; }
.sessions-empty {
  margin: 18px 12px;
  color: #626a73;
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}

.sessions-resize-handle {
  position: relative;
  z-index: 5;
  flex: 0 0 7px;
  width: 7px;
  margin-left: -4px;
  cursor: col-resize;
  touch-action: none;
  outline: 0;
}
.sessions-resize-handle::after {
  position: absolute;
  inset: 0 3px;
  background: transparent;
  content: '';
  transition: background-color 0.14s ease, box-shadow 0.14s ease;
}
.sessions-resize-handle:hover::after,
.sessions-resize-handle:focus-visible::after {
  background: #e53935;
  box-shadow: 0 0 0 2px rgb(229 57 53 / 12%);
}

.sessions-slide-enter-active, .sessions-slide-leave-active {
  transition: flex-basis 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s;
  overflow: hidden;
}
.sessions-slide-enter-from, .sessions-slide-leave-to {
  flex-basis: 0;
  opacity: 0;
}

.sessions-toggle {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 6;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: rgb(255 255 255 / 72%);
  color: #626a73;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.sessions-toggle:hover { background: #fff0ef; color: #b71c1c; }
.sessions-toggle svg { width: 16px; height: 16px; fill: none; stroke: currentColor; }

/* ─── 对话区（白→浅红→灰的纵向渐变，app 同款） ─── */
.office-conversation {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 18px 16px 10px;
  background: linear-gradient(180deg, #ffffff 0%, #fff5f4 45%, #f6f7f9 100%);
  scrollbar-width: thin;
}
.office-conversation::-webkit-scrollbar { width: 6px; }
.office-conversation::-webkit-scrollbar-thumb { background: #d9dde3; border-radius: 999px; }

.office-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 120px;
  color: #626a73;
  font-size: 12px;
}
.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #f0d2d0;
  border-top-color: #e53935;
  border-radius: 50%;
  animation: office-spin 0.8s linear infinite;
}
@keyframes office-spin { to { transform: rotate(360deg); } }

.history-notice {
  margin: 4px 2px;
  color: #626a73;
  font-size: 12px;
  line-height: 18px;
}
.office-error {
  margin: 8px auto;
  max-width: 86%;
  padding: 7px 10px;
  border: 1px solid #f5d2d0;
  border-radius: 8px;
  background: #fff5f5;
  color: #b3433e;
  font-size: 11px;
  text-align: center;
}

/* ─── 消息 ─── */
.msg { display: flex; margin: 0 0 18px; }
.msg.is-user { justify-content: flex-end; }
.msg.is-assistant { justify-content: flex-start; }
.msg-col {
  display: flex;
  flex-direction: column;
  max-width: 82%;
  min-width: 0;
}
.is-user .msg-col { align-items: flex-end; }
.is-assistant .msg-col { align-items: flex-start; }

.msg-bubble {
  padding: 10px 15px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 22px;
  word-break: break-word;
}
.msg-bubble.is-user {
  background: #fff0ef;
  color: #1f2329;
}
.msg-bubble.is-assistant {
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 1px 6px rgb(31 35 41 / 6%);
}
.msg-bubble.is-assistant.is-interrupted { color: #626a73; }
.msg-bubble.is-assistant.is-error {
  background: #fff5f5;
  color: #b3433e;
}

/* 用户附件卡 */
.user-att-doc {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 6px;
  padding: 10px 12px;
  border: 1px solid #e8eaed;
  border-radius: 14px;
  background: #ffffff;
  max-width: 100%;
}
.att-badge {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: 8px;
  background: #fff0ef;
  color: #b71c1c;
  font-size: 11px;
  font-weight: 700;
}
.att-name {
  overflow: hidden;
  color: #1f2329;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}
.user-att-images {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 5px;
  max-width: 250px;
  margin-bottom: 6px;
}
.user-att-image {
  width: 80px;
  height: 80px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: #f2f3f5;
  overflow: hidden;
  cursor: pointer;
}
.user-att-image img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* 思考步骤折叠卡（app TraceCard） */
.trace-card {
  width: 100%;
  margin-bottom: 6px;
  padding: 10px 12px;
  border: 1px solid #e8eaed;
  border-radius: 14px;
  background: #f7f8fa;
  cursor: pointer;
}
.trace-head { display: flex; align-items: center; gap: 8px; }
.trace-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #19a974;
}
.trace-dot.is-running {
  background: #e53935;
  animation: trace-spark 0.9s linear infinite alternate;
}
@keyframes trace-spark { from { opacity: 0.35; } to { opacity: 1; } }
.trace-title {
  flex: 1 1 auto;
  overflow: hidden;
  color: #626a73;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.trace-card.is-expanded .trace-title { color: #1f2329; }
.trace-toggle { color: #9aa1a9; font-size: 11px; }
.trace-steps {
  display: grid;
  gap: 3px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.trace-steps li {
  position: relative;
  padding-left: 16px;
  color: #626a73;
  font-size: 12px;
  line-height: 17px;
}
.trace-steps li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #19a974;
  font-size: 11px;
}

/* 流式光标（app StreamingCursor：竖块闪烁） */
.stream-cursor {
  display: inline-block;
  width: 8px;
  height: 16px;
  margin-left: 2px;
  vertical-align: -2px;
  border-radius: 2px;
  background: #e53935;
  animation: cursor-blink 0.55s linear infinite alternate;
}
@keyframes cursor-blink { from { opacity: 0.15; } to { opacity: 1; } }

/* 挂起态选项胶囊（对齐调试台 .opts） */
.option-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}
.option-pill {
  padding: 8px 14px;
  border: 1px solid rgb(229 57 53 / 35%);
  border-radius: 99px;
  background: #fff0ef;
  color: #b71c1c;
  font-size: 13px;
  line-height: 18px;
  cursor: pointer;
  transition: background 0.16s, border-color 0.16s, color 0.16s, opacity 0.16s;
}
.option-pill:not(:disabled):hover { background: #ffe3e1; }
.option-pill:disabled {
  border-color: #e8eaed;
  background: #f3f4f6;
  color: #626a73;
  cursor: not-allowed;
  opacity: 0.75;
}

/* 回复图片卡列表 */
.reply-images {
  display: grid;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
}
.reply-image-card {
  overflow: hidden;
  border: 1px solid #e8eaed;
  border-radius: 14px;
  background: #ffffff;
}
.reply-image-button {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
}
.reply-image-button img {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: cover;
}
.reply-image-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
}
.reply-image-title {
  flex: 1 1 auto;
  overflow: hidden;
  color: #626a73;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reply-image-hint { color: #9aa1a9; font-size: 10px; flex: 0 0 auto; }

.msg-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 5px;
  padding: 0 2px;
  color: #9aa1a9;
  font-size: 10px;
}

/* Markdown 样式 */
.office-markdown { min-width: 0; }
.office-markdown :deep(p) { margin: 0; }
.office-markdown :deep(p + p),
.office-markdown :deep(ul + p),
.office-markdown :deep(ol + p),
.office-markdown :deep(pre + p) { margin-top: 8px; }
.office-markdown :deep(h1),
.office-markdown :deep(h2),
.office-markdown :deep(h3) { margin: 10px 0 5px; color: #1f2329; line-height: 1.35; }
.office-markdown :deep(h1) { font-size: 17px; }
.office-markdown :deep(h2) { font-size: 15px; }
.office-markdown :deep(h3) { font-size: 13px; }
.office-markdown :deep(ul),
.office-markdown :deep(ol) { margin: 7px 0; padding-left: 20px; }
.office-markdown :deep(blockquote) {
  margin: 7px 0;
  padding: 4px 10px;
  border-left: 3px solid #ffd7d5;
  background: #fff8f7;
  color: #626a73;
}
.office-markdown :deep(pre) {
  max-width: 100%;
  margin: 8px 0;
  overflow-x: auto;
  padding: 9px;
  border-radius: 7px;
  background: #26292e;
  color: #f4f5f6;
}
.office-markdown :deep(code) { font-family: Consolas, Monaco, monospace; font-size: 0.94em; }
.office-markdown :deep(a) { color: #d43f3a; }
.office-markdown :deep(.markdown-table-scroll) {
  width: 100%;
  margin: 8px 0;
  overflow-x: auto;
  border: 1px solid #e8eaed;
  border-radius: 8px;
}
.office-markdown :deep(table) { width: max-content; min-width: 100%; border-collapse: collapse; white-space: nowrap; font-size: 11px; }
.office-markdown :deep(th),
.office-markdown :deep(td) { padding: 6px 8px; border-right: 1px solid #e8eaed; border-bottom: 1px solid #e8eaed; text-align: left; }
.office-markdown :deep(th) { background: #f7f8fa; color: #1f2329; }
.office-markdown :deep(img) { max-width: 100%; border-radius: 8px; }

/* ─── 结果弹窗 ─── */
.result-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(31 35 41 / 45%);
}
.result-modal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: min(340px, 100%);
  padding: 26px 22px 20px;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 24px 60px rgb(31 35 41 / 22%);
  text-align: center;
}
.result-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  font-size: 20px;
  font-weight: 700;
}
.result-icon.is-success { background: #e9f8f2; color: #19a974; }
.result-icon.is-failure { background: #ffecea; color: #d93025; }
.result-modal h3 { margin: 2px 0 0; color: #1f2329; font-size: 16px; }
.result-modal p { margin: 0; color: #626a73; font-size: 13px; line-height: 1.6; word-break: break-word; }
.result-confirm {
  margin-top: 8px;
  padding: 9px 34px;
  border: 0;
  border-radius: 10px;
  background: #1f2329;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
}
.result-confirm:hover { filter: brightness(1.2); }

/* ─── 图片全屏预览 ─── */
.image-preview {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  grid-template-columns: 48px 1fr 48px;
  grid-template-rows: 48px 1fr 40px;
  background: rgb(0 0 0 / 96%);
}
.preview-topbar {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 0 8px;
}
.preview-close {
  padding: 12px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #ffffff;
  font-size: 18px;
  cursor: pointer;
}
.preview-close:hover { background: rgb(255 255 255 / 12%); }
.preview-title {
  flex: 1 1 auto;
  overflow: hidden;
  color: rgb(255 255 255 / 75%);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-counter { color: rgb(255 255 255 / 75%); font-size: 12px; }
.preview-image {
  grid-column: 2;
  grid-row: 2;
  width: 100%;
  height: 100%;
  object-fit: contain;
  cursor: zoom-in;
}
.preview-nav {
  grid-row: 2;
  align-self: center;
  justify-self: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 14%);
  color: #ffffff;
  font-size: 24px;
  cursor: pointer;
}
.preview-nav:hover { background: rgb(255 255 255 / 24%); }
.preview-nav.is-prev { grid-column: 1; }
.preview-nav.is-next { grid-column: 3; }
.preview-footbar {
  grid-column: 1 / -1;
  display: grid;
  place-items: center;
}
.preview-hint { color: rgb(255 255 255 / 60%); font-size: 11px; }

@media (prefers-reduced-motion: reduce) {
  .loading-spinner, .stream-cursor, .trace-dot.is-running { animation: none !important; }
}
</style>
