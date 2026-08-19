<template>
  <section class="office-panel">
    <!-- 顶部栏：左侧会话入口图标 + 标题 -->
    <div class="office-topbar">
      <button
        type="button"
        class="sessions-toggle"
        :class="{ 'is-open': sessionsOpen }"
        :aria-label="sessionsOpen ? '收起会话记录' : '展开会话记录'"
        :title="sessionsOpen ? '收起会话记录' : '展开会话记录'"
        @click="sessionsOpen = !sessionsOpen"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
        <span v-if="sessionsCount > 0" class="sessions-badge">{{ sessionsCount }}</span>
      </button>
      <span class="topbar-title">日常办公</span>
    </div>

    <div class="office-body">
      <!-- 会话记录侧栏 -->
      <Transition name="sessions-slide">
        <aside v-if="sessionsOpen" class="sessions-rail">
          <div class="sessions-head">
            <span>会话记录</span>
            <button type="button" class="new-chat" @click="startNewConversation">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              新会话
            </button>
          </div>
          <ul class="sessions-list">
            <li
              v-for="item in sessionItems"
              :key="item.id"
              class="session-item"
              :class="{ 'is-active': item.id === store.officeCurrentId }"
              @click="switchConversation(item.id)"
            >
              <span class="session-title">{{ item.title }}</span>
              <button
                type="button"
                class="session-del"
                aria-label="删除会话"
                @click.stop="removeConversation(item.id)"
              >×</button>
            </li>
            <li v-if="!sessionItems.length" class="sessions-empty">暂无历史会话</li>
          </ul>
        </aside>
      </Transition>

      <!-- 对话区 -->
      <div ref="conversationRef" class="office-conversation">
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

        <!-- 消息列表 -->
        <template v-for="message in messages" :key="message.id">
          <div v-if="message.role === 'user'" class="msg is-user">
            <div class="msg-bubble">
              <p v-if="message.content">{{ message.content }}</p>
              <ul v-if="message.attachments.length" class="msg-attachments">
                <li
                  v-for="att in message.attachments"
                  :key="att.id"
                  :class="att.type === 'audio/voice' ? 'is-voice' : 'is-file'"
                >
                  <span class="att-icon" aria-hidden="true">
                    <svg v-if="att.type === 'audio/voice'" viewBox="0 0 24 24"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <svg v-else viewBox="0 0 24 24"><path d="M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </span>
                  <span class="att-name">{{ att.name }}</span>
                  <span class="att-size">{{ formatSize(att.size) }}</span>
                </li>
              </ul>
            </div>
          </div>

          <div v-else class="msg is-assistant">
            <div v-if="message.content || message.payload?.images?.length" class="msg-bubble assistant-result" :class="{ 'is-error': message.status === 'error' }">
              <details v-if="message.payload?.thinkingSteps?.length" class="reasoning" :open="message.status === 'streaming'">
                <summary>
                  <span>{{ message.status === 'streaming' ? '正在梳理信息' : `已完成 · ${message.payload.thinkingSteps.length} 个步骤` }}</span>
                </summary>
                <ol>
                  <li v-for="step in message.payload.thinkingSteps" :key="step.id">{{ step.content }}</li>
                </ol>
              </details>
              <div v-if="message.content" class="office-markdown" v-html="renderAgentMarkdown(message.content)" />
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

    <!-- 输入区 -->
    <WmsOfficeComposer :disabled="!!pending || store.officeInitializing" @submit="handleSubmit" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { OfficeAttachment, OfficeChatMessage, OfficePendingTask } from '@/agent/types'
import { useAgentUiStore } from '@/agent/stores/agentUiStore'
import { renderAgentMarkdown } from './agentMarkdownRenderer'
import WmsOfficeComposer from './WmsOfficeComposer.vue'

const props = defineProps<{
  messages: OfficeChatMessage[]
  pending: OfficePendingTask | null
  status: string
  activityText: string
}>()

const store = useAgentUiStore()
const conversationRef = ref<HTMLDivElement>()
const sessionsOpen = ref(false)

const sessionsCount = computed(() => store.officeSessions.length)
const sessionItems = computed(() =>
  store.officeSessions.map(session => ({ id: session.id, title: session.title || session.preview || '新会话' })),
)

function switchConversation(id: string) {
  store.switchOfficeConversation(id)
  sessionsOpen.value = false
}
function startNewConversation() {
  store.startOfficeConversation()
  sessionsOpen.value = false
}
function removeConversation(id: string) {
  store.removeOfficeConversation(id)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function handleSubmit(payload: { text: string; attachments: OfficeAttachment[] }) {
  store.submitOfficeTask(payload.text, payload.attachments)
}

interface ResolvedImage { url: string; title: string }

function resolveImages(images?: unknown[]): ResolvedImage[] {
  if (!Array.isArray(images)) return []
  const seen = new Set<string>()
  const result: ResolvedImage[] = []
  images.forEach((value) => {
    const image = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    const picture = image.picture_message && typeof image.picture_message === 'object'
      ? image.picture_message as Record<string, unknown>
      : {}
    const candidates = typeof value === 'string' ? [value] : [
      image.picture_url, image.pictureUrl, image.image_url, image.imageUrl, image.url,
      picture.picture_url, picture.pictureUrl, picture.image_url, picture.imageUrl, picture.url,
    ]
    const url = candidates.map(item => String(item || '').trim()).find(item => /^https?:\/\//i.test(item))
    if (!url || seen.has(url)) return
    seen.add(url)
    result.push({ url, title: String(image.title || picture.title || 'AI 返回图片') })
  })
  return result
}

onMounted(() => {
  store.initializeOfficeConversation().catch(() => undefined)
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

/* 顶部栏 */
.office-topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid #f0e6e4;
  background: #fffafa;
}
.sessions-toggle {
  position: relative;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid #f0d8d4;
  border-radius: 8px;
  background: #fff;
  color: #922b21;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, transform 0.2s;
}
.sessions-toggle:hover {
  background: #fcf2f1;
  border-color: #d44637;
}
.sessions-toggle.is-open {
  background: #922b21;
  border-color: #922b21;
  color: #fff;
}
.sessions-toggle svg { width: 16px; height: 16px; fill: none; stroke: currentColor; }
.sessions-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 999px;
  background: #c0392b;
  color: #fff;
  font-size: 10px;
  line-height: 15px;
  text-align: center;
}
.topbar-title {
  font-size: 13px;
  font-weight: 600;
  color: #6e2117;
  letter-spacing: 0.02em;
}

/* 主体 */
.office-body {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}

/* 会话侧栏 */
.sessions-rail {
  flex: 0 0 200px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #f0e6e4;
  background: #fffafa;
  overflow: hidden;
}
.sessions-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 8px;
  font-size: 12px;
  color: #8a5a52;
  font-weight: 600;
}
.new-chat {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: 1px solid #e1ada9;
  border-radius: 6px;
  background: #fff;
  color: #922b21;
  font-size: 11px;
  padding: 3px 8px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.new-chat:hover { background: #922b21; color: #fff; }
.new-chat svg { width: 12px; height: 12px; fill: none; stroke: currentColor; }
.sessions-list {
  flex: 1 1 auto;
  overflow-y: auto;
  margin: 0;
  padding: 0 6px 8px;
  list-style: none;
}
.sessions-list::-webkit-scrollbar { width: 5px; }
.sessions-list::-webkit-scrollbar-thumb { background: #e8c9c5; border-radius: 999px; }
.session-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  margin-bottom: 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s;
  border: 1px solid transparent;
}
.session-item:hover {
  background: #fcf2f1;
  border-color: #f0d8d4;
}
.session-item.is-active {
  background: rgba(146, 43, 33, 0.1);
  border-color: rgba(146, 43, 33, 0.3);
}
.session-item.is-current {
  background: rgba(192, 57, 43, 0.06);
  border-color: rgba(192, 57, 43, 0.2);
}
.session-title {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #1f2329;
}
.session-del {
  border: 0;
  background: transparent;
  color: #c4a59f;
  font-size: 14px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.18s, color 0.18s;
}
.session-item:hover .session-del { opacity: 1; }
.session-del:hover { color: #c0392b; }
.sessions-empty {
  padding: 14px 8px;
  color: #c4a59f;
  font-size: 11px;
  text-align: center;
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
  scroll-behavior: smooth;
}
.office-conversation::-webkit-scrollbar { width: 6px; }
.office-conversation::-webkit-scrollbar-thumb {
  background: #e8c9c5;
  border-radius: 999px;
}
.office-loading {
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: #8a5a52;
  font-size: 12px;
}
.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #f0d8d4;
  border-top-color: #c0392b;
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
  background: linear-gradient(180deg, #d44637 0%, #922b21 100%);
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
  color: #6e2117;
  font-size: 19px;
  font-weight: 650;
  letter-spacing: 0.02em;
}
.office-welcome p {
  margin: 0 0 16px;
  color: #8a5a52;
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
  border: 1px solid #f0d8d4;
  border-radius: 9px;
  background: #fffafa;
  color: #8a5a52;
  font-size: 11px;
  transition: border-color 0.2s, background 0.2s, color 0.2s, transform 0.2s;
  cursor: default;
}
.welcome-suggest li:hover {
  border-color: rgba(192, 57, 43, 0.45);
  background: rgba(192, 57, 43, 0.06);
  color: #922b21;
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
  background: linear-gradient(135deg, #c0392b 0%, #922b21 100%);
  color: #fff;
  border-bottom-right-radius: 5px;
  box-shadow: 0 4px 14px rgba(146, 43, 33, 0.28);
}
.is-assistant .msg-bubble {
  background: #fffafa;
  color: #1f2329;
  border: 1px solid #f0e6e4;
  border-bottom-left-radius: 5px;
  box-shadow: 0 2px 8px rgba(146, 43, 33, 0.05);
}
.assistant-result { min-width: 70px; }
.assistant-result.is-error {
  border-color: rgba(192, 57, 43, 0.35);
  background: #fff6f5;
  color: #8b2118;
}
.msg-bubble p { margin: 0; }
.msg-bubble p + .msg-attachments { margin-top: 8px; }

.reasoning {
  margin: -3px 0 9px;
  border-bottom: 1px solid #f0e6e4;
  padding-bottom: 8px;
  color: #8a5a52;
  font-size: 11px;
}
.reasoning summary {
  cursor: pointer;
  color: #922b21;
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
  color: #c0392b;
  font-weight: 700;
}
.office-markdown { min-width: 0; }
.office-markdown :deep(p) { margin: 0; }
.office-markdown :deep(p + p),
.office-markdown :deep(ul + p),
.office-markdown :deep(ol + p),
.office-markdown :deep(pre + p) { margin-top: 8px; }
.office-markdown :deep(h1),
.office-markdown :deep(h2),
.office-markdown :deep(h3) { margin: 10px 0 5px; color: #6e2117; line-height: 1.35; }
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
  background: #231b1a;
  color: #fff8f7;
}
.office-markdown :deep(code) { font-family: Consolas, Monaco, monospace; font-size: 0.94em; }
.office-markdown :deep(.markdown-table-scroll) {
  width: 100%;
  margin: 8px 0;
  overflow-x: auto;
  border: 1px solid #ead8d5;
  border-radius: 8px;
}
.office-markdown :deep(table) { width: max-content; min-width: 100%; border-collapse: collapse; white-space: nowrap; font-size: 11px; }
.office-markdown :deep(th),
.office-markdown :deep(td) { padding: 6px 8px; border-right: 1px solid #ead8d5; border-bottom: 1px solid #ead8d5; text-align: left; }
.office-markdown :deep(th) { background: #fff2f0; color: #6e2117; }
.stream-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 3px;
  vertical-align: -0.12em;
  background: #c0392b;
  animation: cursor-blink 0.8s steps(1) infinite;
}
@keyframes cursor-blink { 50% { opacity: 0; } }
.reply-images { display: grid; gap: 9px; margin-top: 10px; }
.reply-image {
  display: grid;
  gap: 5px;
  color: #8a5a52;
  text-decoration: none;
  font-size: 10px;
}
.reply-image img { display: block; width: 100%; max-height: 320px; object-fit: contain; border-radius: 9px; background: #f8efed; }
.office-error {
  margin: 8px auto;
  max-width: 86%;
  padding: 7px 10px;
  border-radius: 8px;
  background: #fff1ef;
  color: #a52b20;
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
  background: #fffafa;
}
.thinking-current { display: flex; align-items: center; gap: 8px; color: #8a5a52; }
.thinking-steps { color: #8a5a52; font-size: 11px; }
.think-wave { display: inline-flex; gap: 4px; align-items: center; height: 16px; }
.think-wave i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #c0392b;
  animation: think-bounce 1.2s ease-in-out infinite;
}
.think-wave i:nth-child(2) { animation-delay: 0.16s; }
.think-wave i:nth-child(3) { animation-delay: 0.32s; }
@keyframes think-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-5px); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .welcome-glyph span, .think-wave i, .loading-spinner, .stream-cursor { animation: none !important; }
}
</style>
