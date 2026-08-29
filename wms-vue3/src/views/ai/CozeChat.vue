<template>
  <div class="coze-chat">
    <!-- 页头 -->
    <div class="chat-header">
      <div class="chat-header-left">
        <div class="chat-header-icon">
          <el-icon :size="22" color="#fff"><ChatDotRound /></el-icon>
        </div>
        <div>
          <div class="chat-header-title">AI 助手</div>
          <div class="chat-header-sub">由 Coze 工作流驱动</div>
        </div>
      </div>
      <el-button size="small" plain @click="clearMessages" :disabled="streaming">
        <el-icon><Delete /></el-icon>
        清空对话
      </el-button>
    </div>

    <!-- 消息列表 -->
    <div class="chat-body" ref="chatBodyRef">
      <!-- 空状态 -->
      <div v-if="messages.length === 0" class="chat-empty">
        <el-icon :size="48" color="#c0c4cc"><ChatLineRound /></el-icon>
        <p>向 AI 助手提问，开始对话吧</p>
        <div class="chat-suggestions">
          <el-tag
            v-for="s in suggestions"
            :key="s"
            class="suggestion-tag"
            effect="plain"
            type="info"
            size="default"
            @click="useSuggestion(s)"
          >{{ s }}</el-tag>
        </div>
      </div>

      <!-- 消息气泡 -->
      <template v-for="(msg, idx) in messages" :key="idx">
        <!-- 用户消息 -->
        <div v-if="msg.role === 'user'" class="bubble-row bubble-row--user">
          <div class="bubble bubble--user">{{ msg.content }}</div>
          <div class="avatar avatar--user">
            <el-icon :size="16" color="#fff"><UserFilled /></el-icon>
          </div>
        </div>

        <!-- AI 消息 -->
        <div v-else-if="msg.role === 'ai'" class="bubble-row bubble-row--ai">
          <div class="avatar avatar--ai">
            <el-icon :size="16" color="#fff"><ChatDotRound /></el-icon>
          </div>
          <div class="bubble bubble--ai">
            <span v-if="msg.content">{{ msg.content }}</span>
            <span v-if="msg.streaming" class="cursor-blink">|</span>
            <span v-if="!msg.content && !msg.streaming" class="thinking">思考中...</span>
          </div>
        </div>

        <!-- 中断提示 -->
        <div v-else-if="msg.role === 'interrupt'" class="bubble-row bubble-row--ai">
          <div class="avatar avatar--ai">
            <el-icon :size="16" color="#fff"><ChatDotRound /></el-icon>
          </div>
          <div class="bubble bubble--interrupt">
            <el-icon class="interrupt-icon"><QuestionFilled /></el-icon>
            <span>{{ pendingInterruptMessage || '工作流需要您的进一步输入，请在下方输入框回复' }}</span>
          </div>
        </div>

        <!-- 错误提示 -->
        <div v-else-if="msg.role === 'error'" class="bubble-row bubble-row--ai">
          <div class="avatar avatar--ai avatar--error">
            <el-icon :size="16" color="#fff"><WarningFilled /></el-icon>
          </div>
          <div class="bubble bubble--error">{{ msg.content }}</div>
        </div>
      </template>
    </div>

    <!-- 输入区 -->
    <div class="chat-footer">
      <div v-if="pendingEventId" class="interrupt-hint">
        <el-icon><QuestionFilled /></el-icon>
        {{ pendingInterruptMessage || '工作流等待您的回复' }} · 输入内容后点击发送
        <el-button size="small" link type="danger" @click="cancelInterrupt">取消</el-button>
      </div>
      <div class="input-row">
        <el-input
          v-model="inputText"
          :placeholder="pendingEventId ? '请输入您的回复...' : '输入您的问题，按 Enter 发送'"
          :disabled="streaming"
          size="large"
          class="chat-input"
          @keydown.enter.exact.prevent="sendMessage"
          clearable
        />
        <el-button
          type="primary"
          size="large"
          :loading="streaming"
          :disabled="!inputText.trim() || streaming"
          class="send-btn"
          @click="sendMessage"
        >
          <el-icon v-if="!streaming"><Promotion /></el-icon>
          <span>{{ streaming ? '生成中' : '发送' }}</span>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import {
  ChatDotRound,
  ChatLineRound,
  Delete,
  UserFilled,
  QuestionFilled,
  WarningFilled,
  Promotion,
} from '@element-plus/icons-vue'
import { startCozeWorkflow, replyCozeWorkflow } from '@/api/modules/coze'

// ── 类型 ──────────────────────────────────────────
type Role = 'user' | 'ai' | 'interrupt' | 'error'

interface Message {
  role: Role
  content: string
  streaming?: boolean
}

// ── 状态 ──────────────────────────────────────────
const inputText = ref('')
const streaming = ref(false)
const pendingEventId = ref<string | null>(null)
const pendingInterruptMessage = ref('')
const messages = ref<Message[]>([])
const chatBodyRef = ref<HTMLElement | null>(null)

// 快捷提问建议
const suggestions = [
  '帮我查询今日库存情况',
  '最近一周的采购订单有哪些？',
  '当前待发货订单数量',
]

// ── 滚动到底部 ──────────────────────────────────────
async function scrollToBottom() {
  await nextTick()
  if (chatBodyRef.value) {
    chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
  }
}

// ── 使用建议 ────────────────────────────────────────
function useSuggestion(text: string) {
  if (streaming.value) return
  inputText.value = text
}

// ── 清空对话 ────────────────────────────────────────
function clearMessages() {
  messages.value = []
  pendingEventId.value = null
  pendingInterruptMessage.value = ''
  inputText.value = ''
}

// ── 取消中断等待 ──────────────────────────────────────
function cancelInterrupt() {
  pendingEventId.value = null
  pendingInterruptMessage.value = ''
}

// ── 发送消息 ────────────────────────────────────────
async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || streaming.value) return

  messages.value.push({ role: 'user', content: text })
  inputText.value = ''
  streaming.value = true

  const aiMsgIndex = messages.value.length
  messages.value.push({ role: 'ai', content: '', streaming: true })
  await scrollToBottom()

  const callbacks = {
    onMessage(content: string) {
      messages.value[aiMsgIndex].content += content
      scrollToBottom()
    },
    onInterrupt(eventId: string, _interruptType: number, message: string) {
      messages.value[aiMsgIndex].streaming = false
      pendingEventId.value = eventId
      pendingInterruptMessage.value = message
      if (message) {
        messages.value.push({ role: 'interrupt', content: message })
      }
      streaming.value = false
      scrollToBottom()
    },
    onError(message: string) {
      messages.value.splice(aiMsgIndex, 1, { role: 'error', content: message })
      streaming.value = false
      scrollToBottom()
    },
    onDone() {
      messages.value[aiMsgIndex].streaming = false
      streaming.value = false
      scrollToBottom()
    },
  }

  if (pendingEventId.value) {
    // 回复中断
    const eventId = pendingEventId.value
    pendingEventId.value = null
    await replyCozeWorkflow(eventId, text, callbacks)
  } else {
    // 新对话
    await startCozeWorkflow(text, callbacks)
  }
}
</script>

<style scoped lang="scss">
.coze-chat {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
  max-height: 860px;
  min-height: 500px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  margin: 16px;
}

// ── 页头 ──────────────────────────────────────────
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: linear-gradient(135deg, #1a56db, #6875f5);
  flex-shrink: 0;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-header-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.chat-header-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  line-height: 1.3;
}

.chat-header-sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 1px;
}

// ── 消息区 ──────────────────────────────────────────
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #f7f8fc;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: #dce0e8;
    border-radius: 4px;
  }
}

.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #a0a8b8;
  gap: 12px;

  p {
    font-size: 14px;
    margin: 0;
  }
}

.chat-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 4px;
}

.suggestion-tag {
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #ecf5ff;
    border-color: #409eff;
    color: #409eff;
  }
}

// ── 气泡行 ──────────────────────────────────────────
.bubble-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 80%;

  &--user {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  &--ai {
    align-self: flex-start;
  }
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &--user {
    background: linear-gradient(135deg, #1a56db, #6875f5);
  }

  &--ai {
    background: linear-gradient(135deg, #0ea5e9, #06b6d4);
  }

  &--error {
    background: linear-gradient(135deg, #ef4444, #f97316);
  }
}

.bubble {
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;

  &--user {
    background: linear-gradient(135deg, #1a56db, #6875f5);
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  &--ai {
    background: #fff;
    color: #303133;
    border-bottom-left-radius: 4px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    min-width: 60px;
  }

  &--interrupt {
    background: #fef9e7;
    color: #7d6608;
    border: 1px solid #f9e79f;
    border-bottom-left-radius: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }

  &--error {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
    border-bottom-left-radius: 4px;
  }
}

.interrupt-icon {
  color: #d4ac0d;
  flex-shrink: 0;
}

.thinking {
  color: #9ca3af;
  font-style: italic;
  font-size: 13px;
}

// 打字光标动效
.cursor-blink {
  display: inline-block;
  color: #1a56db;
  font-weight: 700;
  animation: blink 0.8s step-end infinite;
  margin-left: 1px;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

// ── 输入区 ──────────────────────────────────────────
.chat-footer {
  padding: 12px 16px 16px;
  background: #fff;
  border-top: 1px solid #ebeef5;
  flex-shrink: 0;
}

.interrupt-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #b45309;
  background: #fef9e7;
  border: 1px solid #f9e79f;
  border-radius: 6px;
  padding: 6px 10px;
  margin-bottom: 10px;

  .el-icon {
    color: #d4ac0d;
  }
}

.input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.chat-input {
  flex: 1;

  :deep(.el-input__wrapper) {
    border-radius: 10px;
  }
}

.send-btn {
  border-radius: 10px;
  padding: 0 20px;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
