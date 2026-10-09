<template>
  <section class="office-panel">
    <div ref="officeBodyRef" class="office-body">
      <!-- 会话记录侧栏 -->
      <Transition name="sessions-slide">
        <aside v-if="sessionsOpen" class="sessions-rail" :style="sessionsRailStyle" aria-label="办公会话记录">
          <button type="button" class="new-chat" :disabled="!!pending" @click="startNewConversation">+ 新对话</button>
          <ul class="sessions-list">
            <li
              v-for="item in sessionItems"
              :key="item.id"
              class="session-row"
            >
              <button
                type="button"
                class="session-item"
                :class="{ 'is-active': item.id === store.officeCurrentId }"
                :disabled="!!pending"
                :title="item.title"
                @click="switchConversation(item.id)"
              >
                <span class="session-title">{{ item.title }}</span>
                <span class="session-meta">{{ formatSessionTime(item.updatedAt) }}</span>
              </button>
              <button
                type="button"
                class="session-del"
                aria-label="删除会话"
                :disabled="!!pending"
                @click.stop="confirmRemoveConversation(item)"
              >×</button>
            </li>
            <li v-if="!sessionItems.length" class="sessions-empty">暂无历史会话</li>
          </ul>
          <p v-if="pending" class="sessions-running">任务执行中，暂不能切换对话</p>
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
      <div ref="conversationRef" class="office-conversation">
        <!-- 分享选择模式工具条 -->
        <div v-if="shareSelectActive" class="share-toolbar">
          <span class="share-toolbar-count">已选 {{ selectedShareCount }} 轮对话</span>
          <span class="share-toolbar-actions">
            <button type="button" :disabled="shareCreating" @click="selectAllShareRounds">全选</button>
            <button type="button" :disabled="shareCreating" @click="clearShareSelection">清空</button>
            <button type="button" class="share-toolbar-generate" :disabled="!selectedShareCount || shareCreating" @click="createShareLink">
              {{ shareCreating ? '生成中…' : '生成分享链接' }}
            </button>
          </span>
          <button type="button" class="share-toolbar-cancel" :disabled="shareCreating" @click="exitShareSelect">取消</button>
          <span v-if="shareError" class="share-toolbar-error" role="alert">{{ shareError }}</span>
        </div>

        <!-- 欢迎屏 -->
        <div v-if="store.officeInitializing" class="office-loading" aria-live="polite">
          <span class="loading-spinner" />
          正在加载会话...
        </div>

        <div v-else-if="!messages.length && !pending" class="office-welcome">
          <div class="welcome-glyph" aria-hidden="true">
            <span /><span /><span /><span />
          </div>
          <h2>日常办公</h2>
          <p>可以发文字、上传文件、发语音，告诉我你想完成的工作</p>
          <ul class="welcome-suggest">
            <li>帮我把这份销售数据整理成表格</li>
            <li>总结一下这份合同的关键条款</li>
            <li>根据录音整理会议纪要</li>
          </ul>
        </div>

        <!-- 消息列表（选择模式下按“轮”勾选：用户消息与其后的助手回复联动选中） -->
        <template v-for="(message, messageIndex) in messages" :key="message.id">
          <div v-if="message.role === 'user'" class="msg is-user" :class="{ 'is-selecting': shareSelectActive && isShareable(message) }">
            <input
              v-if="shareSelectActive && isShareable(message)"
              type="checkbox"
              class="share-check"
              :checked="isRoundSelected(message)"
              :disabled="shareCreating || !isRoundSelectable(message)"
              :aria-label="`选择这段对话`"
              @change="toggleShareRoundFor(message)"
            >
            <div class="msg-body">
              <div class="msg-bubble">
                <p v-if="message.content">{{ message.content }}</p>
                <ul v-if="message.attachments.length" class="msg-attachments">
                  <li
                    v-for="att in message.attachments"
                    :key="att.id"
                    :class="att.type === 'audio/voice' ? 'is-voice' : 'is-file'"
                  >
                    <span class="att-icon" aria-hidden="true">
                      <svg v-if="att.type === 'audio/voice'" viewBox="0 0 24 24"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                      <svg v-else viewBox="0 0 24 24"><path d="M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </span>
                    <span class="att-name">{{ att.name }}</span>
                    <span class="att-size">{{ formatSize(att.size) }}</span>
                  </li>
                </ul>
              </div>
              <WmsMessageCopyButton :text="copyTextOf(message)" />
            </div>
          </div>

          <div v-else class="msg is-assistant" :class="{ 'is-selecting': shareSelectActive && isShareable(message) }">
            <input
              v-if="shareSelectActive && isShareable(message)"
              type="checkbox"
              class="share-check"
              :checked="isRoundSelected(message)"
              :disabled="shareCreating || !isRoundSelectable(message)"
              :aria-label="`选择这段对话`"
              @change="toggleShareRoundFor(message)"
            >
            <div class="msg-body">
              <div v-if="message.content || message.payload?.images?.length" class="msg-bubble assistant-result" :class="{ 'is-error': message.status === 'error' }">
                <details v-if="message.payload?.thinkingSteps?.length" class="reasoning" :open="message.status === 'streaming'">
                  <summary>
                    <span>{{ message.status === 'streaming' ? '正在梳理信息' : `已完成 · ${message.payload.thinkingSteps.length} 个步骤` }}</span>
                  </summary>
                  <ol>
                    <li v-for="step in message.payload.thinkingSteps" :key="step.id">{{ step.content }}</li>
                  </ol>
                </details>
                <div v-if="message.content && parseOfficeOrderQuestion(message.content)" class="office-question">
                  <p class="office-question-prompt">{{ parseOfficeOrderQuestion(message.content)?.prompt }}</p>
                  <div class="office-question-options" role="group" aria-label="订单明细选项">
                    <button
                      v-for="option in parseOfficeOrderQuestion(message.content)?.options"
                      :key="option.label"
                      type="button"
                      class="office-question-option"
                      :disabled="!isQuestionInteractive(message, messageIndex) || !!pending || store.officeInitializing"
                      @click="handleQuestionOption(message, messageIndex, option.label)"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </div>
                <div v-else-if="message.content" class="office-markdown" v-html="renderAgentMarkdown(message.content)" />
                <span v-if="message.status === 'streaming'" class="stream-cursor" aria-hidden="true" />
                <div v-if="resolveImages(message.payload?.images).length" class="reply-images">
                  <a
                    v-for="image in resolveImages(message.payload?.images)"
                    :key="image.url"
                    :href="image.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="reply-image"
                  >
                    <img :src="image.url" :alt="image.title" />
                    <span>{{ image.title }} · 点击查看原图</span>
                  </a>
                </div>
              </div>
              <WmsMessageCopyButton
                v-if="message.content || message.payload?.images?.length"
                :text="copyTextOf(message)"
              />
            </div>
          </div>
        </template>

        <!-- 助手思考占位 -->
        <div v-if="pending?.showThinking" class="msg is-assistant is-thinking" aria-live="polite">
          <div class="msg-bubble thinking-bubble">
            <div class="thinking-current">
              <span class="think-wave"><i /><i /><i /></span>
              <span>{{ pending.statusText || activityText || '正在理解业务并整理数据' }}</span>
            </div>
            <ol v-if="pending.thinkingSteps.length" class="thinking-steps">
              <li v-for="step in pending.thinkingSteps.slice(0, -1)" :key="step.id">{{ step.content }}</li>
            </ol>
          </div>
        </div>

        <div v-if="store.officeError" class="office-error" role="alert">{{ store.officeError }}</div>
      </div>
    </div>

    <!-- 输入区（分享入口在输入工具行“查图册”旁，位置固定） -->
    <WmsOfficeComposer
      :disabled="!!pending || store.officeInitializing"
      :busy="!!pending"
      :share-hidden="shareSelectActive"
      :share-disabled="!messages.length || !!pending"
      @submit="handleSubmit"
      @share="enterShareSelect"
    />

    <!-- 分享结果弹窗 -->
    <Teleport to="body">
      <div v-if="shareResultUrl" class="share-overlay" @click.self="closeShareResult">
        <div class="share-modal" role="dialog" aria-modal="true" aria-label="分享链接已生成">
          <h3>分享链接已生成</h3>
          <p class="share-modal-url">{{ shareResultUrl }}</p>
          <p class="share-modal-tip">任何拿到链接的人都可以查看，请确认内容不含敏感信息。链接可直接粘贴到钉钉 / 飞书 / 企业微信 / QQ / 微信，会自动生成对话卡片。</p>
          <div class="share-modal-actions">
            <button type="button" class="share-modal-secondary" @click="openSharePreview">预览</button>
            <button type="button" class="share-modal-primary" @click="copyShareLink">{{ shareCopied ? '已复制 ✓' : '复制链接' }}</button>
            <button type="button" class="share-modal-secondary" @click="closeShareResult">完成</button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import type { OfficeAttachment, OfficeChatMessage, OfficeConversationSession, OfficePendingTask } from '@/agent/types'
import { useAgentUiStore } from '@/agent/stores/agentUiStore'
import { renderAgentMarkdown } from './agentMarkdownRenderer'
import { buildOfficeUserCopyText, toPlainText } from './agentMessagePlainText'
import { parseOfficeOrderQuestion } from '@/agent/office/officeQuestionFormatter'
import { copyText, createAgentShare, resolveOfficeImages, toShareMessage } from '@/agent/office/officeShareApi'
import WmsOfficeComposer from './WmsOfficeComposer.vue'
import WmsMessageCopyButton from './WmsMessageCopyButton.vue'

const props = defineProps<{
  messages: OfficeChatMessage[]
  pending: OfficePendingTask | null
  status: string
  activityText: string
}>()

const store = useAgentUiStore()
const conversationRef = ref<HTMLDivElement>()
const officeBodyRef = ref<HTMLDivElement>()
const sessionsOpen = ref(false)
const sessionsMinimumWidth = 150
const conversationMinimumWidth = 280
const sessionsStorageKey = 'wms-office-sessions-width'
const sessionsWidth = ref(190)
const selectedQuestionMessageIds = ref(new Set<string>())
const officeBodyWidth = ref(560)
let sessionsResizing: { pointerX: number; width: number } | undefined
let officeBodyResizeObserver: ResizeObserver | undefined

const sessionsMaximumWidth = computed(() => Math.max(sessionsMinimumWidth, officeBodyWidth.value - conversationMinimumWidth))
const sessionsRailStyle = computed(() => ({ width: `${sessionsWidth.value}px`, flexBasis: `${sessionsWidth.value}px` }))
const sessionItems = computed(() =>
  store.officeSessions.map(session => ({
    id: session.id,
    title: session.title || session.preview || '新会话',
    updatedAt: session.updatedAt,
  })),
)

function switchConversation(id: string) {
  store.switchOfficeConversation(id)
}
function startNewConversation() {
  store.startOfficeConversation()
}
async function confirmRemoveConversation(session: Pick<OfficeConversationSession, 'id' | 'title'>) {
  try {
    await ElMessageBox.confirm(`确认删除对话「${session.title}」？`, '提示', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await store.removeOfficeConversation(session.id)
  } catch {
    // 用户取消删除。
  }
}

function formatSessionTime(timestamp: string | number): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const hhmm = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (date.toDateString() === now.toDateString()) return hhmm
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hhmm}`
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function handleSubmit(payload: { text: string; attachments: OfficeAttachment[]; voiceSessions?: string[] }) {
  store.submitOfficeTask(payload.text, payload.attachments, payload.voiceSessions)
}

// —— 对话分享：按“轮”（一问一答）勾选，生成免登公开链接 ——

interface ShareRound { key: string; messageIds: string[]; selectable: boolean }

const shareSelectActive = ref(false)
const selectedRoundKeys = ref(new Set<string>())
const shareCreating = ref(false)
const shareResultUrl = ref('')
const shareCopied = ref(false)
const shareError = ref('')

const shareRounds = computed<ShareRound[]>(() => {
  const rounds: ShareRound[] = []
  let current: ShareRound | null = null
  for (const message of props.messages) {
    if (message.id.startsWith('office-welcome:')) continue
    // 流式输出/等待补充中的消息尚未定型，不允许进入快照。
    const settled = message.status !== 'streaming' && message.status !== 'waiting_input'
    if (message.role === 'user' || !current) {
      current = { key: `round:${message.id}`, messageIds: [message.id], selectable: settled }
      rounds.push(current)
    } else {
      current.messageIds.push(message.id)
      if (!settled) current.selectable = false
    }
  }
  return rounds
})

const roundIndexByMessageId = computed(() => {
  const map = new Map<string, number>()
  shareRounds.value.forEach((round, index) => round.messageIds.forEach(id => map.set(id, index)))
  return map
})

const selectedShareCount = computed(() => {
  const keys = new Set(shareRounds.value.map(round => round.key))
  let count = 0
  selectedRoundKeys.value.forEach(key => {
    if (keys.has(key)) count += 1
  })
  return count
})

function roundOf(message: OfficeChatMessage): ShareRound | undefined {
  const index = roundIndexByMessageId.value.get(message.id)
  return index === undefined ? undefined : shareRounds.value[index]
}
function isShareable(message: OfficeChatMessage): boolean {
  return !message.id.startsWith('office-welcome:')
}
function isRoundSelectable(message: OfficeChatMessage): boolean {
  return !!roundOf(message)?.selectable
}
function isRoundSelected(message: OfficeChatMessage): boolean {
  const round = roundOf(message)
  return !!round && selectedRoundKeys.value.has(round.key)
}
function toggleShareRoundFor(message: OfficeChatMessage) {
  const round = roundOf(message)
  if (!round || !round.selectable) return
  const next = new Set(selectedRoundKeys.value)
  if (next.has(round.key)) next.delete(round.key)
  else next.add(round.key)
  selectedRoundKeys.value = next
}
function enterShareSelect() {
  if (!props.messages.length || props.pending) return
  shareSelectActive.value = true
  shareError.value = ''
  selectedRoundKeys.value = new Set(shareRounds.value.filter(round => round.selectable).map(round => round.key))
}
function exitShareSelect() {
  shareSelectActive.value = false
  selectedRoundKeys.value = new Set()
  shareError.value = ''
}
function selectAllShareRounds() {
  selectedRoundKeys.value = new Set(shareRounds.value.filter(round => round.selectable).map(round => round.key))
}
function clearShareSelection() {
  selectedRoundKeys.value = new Set()
}

async function createShareLink() {
  if (shareCreating.value || !selectedShareCount.value) return
  const selectedIds = new Set(
    shareRounds.value
      .filter(round => selectedRoundKeys.value.has(round.key))
      .flatMap(round => round.messageIds),
  )
  const snapshot = props.messages
    .filter(message => selectedIds.has(message.id) && message.status !== 'streaming' && message.status !== 'waiting_input')
    .map(toShareMessage)
  if (!snapshot.length) return
  const firstUserText = snapshot.find(message => message.role === 'user')?.content.trim()
  const title = (firstUserText && firstUserText.length > 24 ? `${firstUserText.slice(0, 24)}…` : firstUserText)
    || store.officeCurrentSession?.title.slice(0, 24)
    || 'WMS 助手对话'
  shareCreating.value = true
  shareError.value = ''
  try {
    const { shareUrl } = await createAgentShare({
      sessionId: store.officeCurrentId || '',
      title,
      messages: snapshot,
    })
    shareResultUrl.value = shareUrl
    shareCopied.value = false
    exitShareSelect()
  } catch (error) {
    shareError.value = error instanceof Error ? error.message : '分享创建失败'
  } finally {
    shareCreating.value = false
  }
}

async function copyShareLink() {
  shareCopied.value = await copyText(shareResultUrl.value)
}
function openSharePreview() {
  if (shareResultUrl.value) window.open(shareResultUrl.value, '_blank', 'noopener')
}
function closeShareResult() {
  shareResultUrl.value = ''
  shareCopied.value = false
}

function isQuestionInteractive(message: OfficeChatMessage, index: number): boolean {
  return index === props.messages.length - 1
    && (message.status === 'streaming' || message.status === 'waiting_input')
    && !selectedQuestionMessageIds.value.has(message.id)
}

function handleQuestionOption(message: OfficeChatMessage, index: number, label: string) {
  if (!isQuestionInteractive(message, index)) return
  selectedQuestionMessageIds.value = new Set(selectedQuestionMessageIds.value).add(message.id)
  store.submitOfficeTask(label, [])
}

/**
 * 复制文本：用户消息带附件清单；助手消息是 Markdown，去标记后复制。
 * 订单明细追问消息（prompt + ==== + JSON 选项）只复制问句本身，
 * 免得把内部选项数组也带出去。
 */
function copyTextOf(message: OfficeChatMessage): string {
  if (message.role === 'user') {
    return buildOfficeUserCopyText(message.content, message.attachments || [])
  }
  const question = parseOfficeOrderQuestion(message.content)
  if (question) return question.prompt
  const body = toPlainText(message.content)
  const images = resolveImages(message.payload?.images).map(image => image.title).filter(Boolean)
  if (!images.length) return body
  const lines = images.map(title => `[图片] ${title}`)
  return body ? `${body}\n${lines.join('\n')}` : lines.join('\n')
}

const resolveImages = resolveOfficeImages

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
  store.initializeOfficeConversation().catch(() => undefined)
})

onBeforeUnmount(() => {
  officeBodyResizeObserver?.disconnect()
  window.removeEventListener('pointermove', resizeSessions)
  window.removeEventListener('pointerup', stopSessionsResize)
  document.body.style.removeProperty('user-select')
  document.body.style.removeProperty('cursor')
})

watch(
  () => [props.messages.length, props.messages.at(-1)?.content, props.pending?.statusText],
  async () => {
    await nextTick()
    const el = conversationRef.value
    if (el) el.scrollTop = el.scrollHeight
  },
)
</script>

<style scoped>
.office-panel {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  background: #ffffff;
  color: #1f2329;
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
  background: transparent;
  color: #146c86;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.sessions-toggle:hover {
  background: #eaf4f7;
  color: #0f5f77;
}
.sessions-toggle.is-open {
  left: 190px;
  background: #e3f0f4;
  color: #146c86;
}
.sessions-toggle svg { width: 16px; height: 16px; fill: none; stroke: currentColor; }

/* 主体 */
.office-body {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
  background: #ffffff;
}

/* 会话侧栏 */
.sessions-rail {
  flex: 0 0 190px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid #dce5eb;
  background: #f7fafc;
  overflow: hidden;
}
.new-chat {
  margin: 12px 12px 8px;
  padding: 7px 0;
  border: 1px solid #bcd7df;
  border-radius: 8px;
  background: #eaf4f7;
  color: #276b7f;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.new-chat:disabled { opacity: 0.5; cursor: not-allowed; }
.new-chat:not(:disabled):hover { filter: brightness(0.96); }
.new-chat:focus-visible { outline: 2px solid #168aad; outline-offset: 2px; }
.sessions-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  margin: 0;
  padding: 0 8px 10px;
  list-style: none;
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 138, 156, 0.55) transparent;
}
.sessions-list::-webkit-scrollbar { width: 6px; }
.sessions-list::-webkit-scrollbar-track { background: transparent; }
.sessions-list::-webkit-scrollbar-thumb { background: rgba(120, 138, 156, 0.55); border-radius: 3px; }
.session-row {
  position: relative;
  display: flex;
  align-items: stretch;
  margin-bottom: 2px;
}
.session-item {
  flex: 1 1 auto;
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 8px 24px 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.session-item:not(:disabled):hover { background: #eaf4f7; }
.session-item.is-active {
  background: #e3f0f4;
  box-shadow: inset 2px 0 0 #168aad;
}
.session-item:disabled { cursor: not-allowed; }
.session-item:focus-visible { outline: 2px solid #168aad; outline-offset: -2px; }
.session-title {
  overflow: hidden;
  color: #2c4250;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-meta { color: #8598a6; font-size: 10px; }
.session-del {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #9aa9b5;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
}
.session-row:hover .session-del,
.session-del:focus-visible { opacity: 1; }
.session-del:hover { background: #e8f3f6; color: #146c86; }
.session-del:disabled { cursor: not-allowed; }
.sessions-empty {
  margin: 18px 12px;
  color: #8a9aa7;
  font-size: 11px;
  text-align: center;
}
.sessions-running { margin: 0 12px 10px; color: #a27719; font-size: 10px; }

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
  background: #168aad;
  box-shadow: 0 0 0 2px rgb(22 138 173 / 12%);
}

/* 会话栏滑入/滑出 */
.sessions-slide-enter-active, .sessions-slide-leave-active {
  transition: flex-basis 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s;
  overflow: hidden;
}
.sessions-slide-enter-from, .sessions-slide-leave-to {
  flex-basis: 0;
  opacity: 0;
}

/* 对话区 */
.office-conversation {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px 18px 8px;
  background: #ffffff;
  scroll-behavior: smooth;
}
.office-conversation::-webkit-scrollbar { width: 6px; }
.office-conversation::-webkit-scrollbar-thumb {
  background: #c9dfe5;
  border-radius: 999px;
}
.office-loading {
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: #5f7884;
  font-size: 12px;
}
.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #d2e5ea;
  border-top-color: #168aad;
  border-radius: 50%;
  animation: office-spin 0.8s linear infinite;
}
@keyframes office-spin { to { transform: rotate(360deg); } }

/* 欢迎屏 */
.office-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 38px 12px 12px;
}
.welcome-glyph {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  margin-bottom: 18px;
}
.welcome-glyph span {
  width: 8px;
  border-radius: 4px;
  background: linear-gradient(180deg, #27a8c2 0%, #146c86 100%);
  opacity: 0.85;
  animation: welcome-bounce 1.6s ease-in-out infinite;
}
.welcome-glyph span:nth-child(1) { height: 28px; }
.welcome-glyph span:nth-child(2) { height: 36px; animation-delay: 0.12s; }
.welcome-glyph span:nth-child(3) { height: 22px; animation-delay: 0.24s; }
.welcome-glyph span:nth-child(4) { height: 32px; animation-delay: 0.36s; }
@keyframes welcome-bounce {
  0%, 100% { transform: scaleY(0.7); opacity: 0.5; }
  50% { transform: scaleY(1); opacity: 0.95; }
}
.office-welcome h2 {
  margin: 0 0 6px;
  color: #234652;
  font-size: 19px;
  font-weight: 650;
  letter-spacing: 0.02em;
}
.office-welcome p {
  margin: 0 0 16px;
  color: #5f7884;
  font-size: 12px;
}
.welcome-suggest {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.welcome-suggest li {
  padding: 9px 14px;
  border: 1px solid #d2e5ea;
  border-radius: 9px;
  background: #f7fbfc;
  color: #5f7884;
  font-size: 11px;
  transition: border-color 0.2s, background 0.2s, color 0.2s, transform 0.2s;
  cursor: default;
}
.welcome-suggest li:hover {
  border-color: rgb(22 138 173 / 45%);
  background: rgb(22 138 173 / 6%);
  color: #146c86;
  transform: translateX(2px);
}

/* 消息 */
.msg { display: flex; margin: 10px 0; }
.msg.is-user { justify-content: flex-end; }
.msg.is-assistant { justify-content: flex-start; }
.msg-bubble {
  max-width: 82%;
  padding: 11px 14px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}
.is-user .msg-bubble {
  background: linear-gradient(135deg, #168aad 0%, #146c86 100%);
  color: #fff;
  border-bottom-right-radius: 5px;
  box-shadow: 0 4px 14px rgb(20 108 134 / 28%);
}
.is-assistant .msg-bubble {
  background: #f7fbfc;
  color: #1f2329;
  border: 1px solid #dbe9ed;
  border-bottom-left-radius: 5px;
  box-shadow: 0 2px 8px rgb(20 108 134 / 5%);
}
.assistant-result { min-width: 70px; }
.assistant-result.is-error {
  border-color: #c7d9df;
  background: #f3f7f8;
  color: #536b78;
}
.msg-bubble p { margin: 0; }
.msg-bubble p + .msg-attachments { margin-top: 8px; }

.reasoning {
  margin: -3px 0 9px;
  border-bottom: 1px solid #dbe9ed;
  padding-bottom: 8px;
  color: #5f7884;
  font-size: 11px;
}
.reasoning summary {
  cursor: pointer;
  color: #146c86;
  font-weight: 600;
}
.reasoning ol,
.thinking-steps {
  display: grid;
  gap: 5px;
  margin: 7px 0 0;
  padding: 0;
  list-style: none;
}
.reasoning li,
.thinking-steps li {
  position: relative;
  padding-left: 16px;
}
.reasoning li::before,
.thinking-steps li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #168aad;
  font-weight: 700;
}
.office-markdown { min-width: 0; }
.office-question { min-width: 0; }
.office-question-prompt { margin: 0; }
.office-question-options {
  display: grid;
  gap: 7px;
  margin-top: 10px;
}
.office-question-option {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #bcd7df;
  border-radius: 8px;
  background: #ffffff;
  color: #276b7f;
  font: inherit;
  line-height: 1.45;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s, color 0.18s;
}
.office-question-option:hover:not(:disabled) {
  border-color: #168aad;
  background: #eaf4f7;
  color: #0f5f77;
}
.office-question-option:focus-visible { outline: 2px solid #168aad; outline-offset: 2px; }
.office-question-option:disabled { cursor: not-allowed; opacity: 0.55; }
.office-markdown :deep(p) { margin: 0; }
.office-markdown :deep(p + p),
.office-markdown :deep(ul + p),
.office-markdown :deep(ol + p),
.office-markdown :deep(pre + p) { margin-top: 8px; }
.office-markdown :deep(h1),
.office-markdown :deep(h2),
.office-markdown :deep(h3) { margin: 10px 0 5px; color: #234652; line-height: 1.35; }
.office-markdown :deep(h1) { font-size: 17px; }
.office-markdown :deep(h2) { font-size: 15px; }
.office-markdown :deep(h3) { font-size: 13px; }
.office-markdown :deep(ul),
.office-markdown :deep(ol) { margin: 7px 0; padding-left: 20px; }
.office-markdown :deep(pre) {
  max-width: 100%;
  margin: 8px 0;
  overflow-x: auto;
  padding: 9px;
  border-radius: 7px;
  background: #17323c;
  color: #f4fbfc;
}
.office-markdown :deep(code) { font-family: Consolas, Monaco, monospace; font-size: 0.94em; }
.office-markdown :deep(.markdown-table-scroll) {
  width: 100%;
  margin: 8px 0;
  overflow-x: auto;
  border: 1px solid #d5e6ea;
  border-radius: 8px;
}
.office-markdown :deep(table) { width: max-content; min-width: 100%; border-collapse: collapse; white-space: nowrap; font-size: 11px; }
.office-markdown :deep(th),
.office-markdown :deep(td) { padding: 6px 8px; border-right: 1px solid #d5e6ea; border-bottom: 1px solid #d5e6ea; text-align: left; }
.office-markdown :deep(th) { background: #edf7f9; color: #234652; }
.stream-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 3px;
  vertical-align: -0.12em;
  background: #168aad;
  animation: cursor-blink 0.8s steps(1) infinite;
}
@keyframes cursor-blink { 50% { opacity: 0; } }
.reply-images { display: grid; gap: 9px; margin-top: 10px; }
.reply-image {
  display: grid;
  gap: 5px;
  color: #5f7884;
  text-decoration: none;
  font-size: 10px;
}
.reply-image img { display: block; width: 100%; max-height: 320px; object-fit: contain; border-radius: 9px; background: #eff7f9; }
.office-error {
  margin: 8px auto;
  max-width: 86%;
  padding: 7px 10px;
  border: 1px solid #c7d9df;
  border-radius: 8px;
  background: #f3f7f8;
  color: #536b78;
  font-size: 11px;
  text-align: center;
}

/* 附件 */
.msg-attachments {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.msg-attachments li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 9px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.18);
  font-size: 11px;
}
.is-user .msg-attachments li { background: rgba(255, 255, 255, 0.16); }
.att-icon { display: inline-flex; }
.att-icon svg { width: 15px; height: 15px; }
.att-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.att-size { opacity: 0.7; font-size: 10px; }

/* 思考占位 */
.is-thinking .thinking-bubble {
  padding: 12px 16px;
  background: #f7fbfc;
}
.thinking-current { display: flex; align-items: center; gap: 8px; color: #5f7884; }
.thinking-steps { color: #5f7884; font-size: 11px; }
.think-wave { display: inline-flex; gap: 4px; align-items: center; height: 16px; }
.think-wave i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #168aad;
  animation: think-bounce 1.2s ease-in-out infinite;
}
.think-wave i:nth-child(2) { animation-delay: 0.16s; }
.think-wave i:nth-child(3) { animation-delay: 0.32s; }
@keyframes think-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-5px); opacity: 1; }
}

/* 对话分享：选择模式 / 结果弹窗（入口按钮在 WmsOfficeComposer 工具行） */

.share-toolbar {
  position: sticky;
  top: -16px;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin: -16px -18px 10px;
  padding: 8px 12px;
  border-bottom: 1px solid #dce5eb;
  background: #eef7f9;
  font-size: 12px;
}
.share-toolbar-count { flex: 1 1 auto; color: #276b7f; font-weight: 650; }
.share-toolbar-actions { display: flex; gap: 6px; }
.share-toolbar button {
  padding: 5px 10px;
  border: 1px solid #bcd7df;
  border-radius: 7px;
  background: #ffffff;
  color: #276b7f;
  font-size: 11px;
  cursor: pointer;
}
.share-toolbar button:hover:not(:disabled) { background: #eaf4f7; }
.share-toolbar button:focus-visible { outline: 2px solid #168aad; outline-offset: 1px; }
.share-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }
.share-toolbar .share-toolbar-generate {
  border-color: #168aad;
  background: #168aad;
  color: #ffffff;
  font-weight: 650;
}
.share-toolbar .share-toolbar-generate:hover:not(:disabled) { background: #137a9a; }
.share-toolbar-error { flex-basis: 100%; color: #b4352f; font-size: 11px; }

.share-check {
  flex: 0 0 auto;
  align-self: center;
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: #168aad;
  cursor: pointer;
}
.share-check:disabled { cursor: not-allowed; }

/* 选择模式消息行：checkbox 固定左列，气泡保持原左右对齐 */
.msg-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}
.msg.is-selecting { gap: 0 8px; }
.is-user .msg-body { align-items: flex-end; }
.is-user .msg-body .msg-bubble { max-width: 100%; }

/* hover 消息气泡区域时显现底部复制按钮 */
.msg:hover .msg-copy-btn,
.msg:focus-within .msg-copy-btn {
  opacity: 1;
  visibility: visible;
  transform: none;
  transition-delay: 0s;
}
.msg .msg-copy-btn:focus-visible {
  opacity: 1;
  visibility: visible;
  transform: none;
}
/* 分享选择模式下 checkbox 占左列，此时不显示复制按钮避免误触 */
.msg.is-selecting .msg-copy-btn { display: none; }
/* 触屏设备没有 hover，常驻显示 */
@media (hover: none) {
  .msg .msg-copy-btn {
    opacity: 1;
    visibility: visible;
    transform: none;
  }
}

.share-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(20 40 50 / 45%);
}
.share-modal {
  width: min(430px, 100%);
  padding: 22px 20px 18px;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 24px 60px rgb(20 108 134 / 25%);
}
.share-modal h3 { margin: 0 0 12px; color: #234652; font-size: 16px; }
.share-modal-url {
  margin: 0 0 10px;
  padding: 10px 12px;
  border: 1px solid #d2e5ea;
  border-radius: 8px;
  background: #f7fbfc;
  color: #146c86;
  font: 600 12px/1.5 Consolas, Monaco, monospace;
  word-break: break-all;
}
.share-modal-tip { margin: 0 0 14px; color: #8598a6; font-size: 11px; line-height: 1.6; }
.share-modal-actions { display: flex; gap: 8px; }
.share-modal-actions button { flex: 1 1 auto; padding: 9px 0; border-radius: 8px; font-size: 12px; cursor: pointer; }
.share-modal-primary { border: 0; background: linear-gradient(135deg, #168aad, #146c86); color: #ffffff; font-weight: 650; }
.share-modal-primary:hover { filter: brightness(0.96); }
.share-modal-secondary { border: 1px solid #bcd7df; background: #ffffff; color: #276b7f; }
.share-modal-secondary:hover { background: #eaf4f7; }

@media (prefers-reduced-motion: reduce) {
  .welcome-glyph span, .think-wave i, .loading-spinner, .stream-cursor { animation: none !important; }
}
</style>
