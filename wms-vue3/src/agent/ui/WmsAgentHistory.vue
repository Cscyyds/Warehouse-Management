<template>
  <aside class="history-sidebar" aria-label="对话历史记录">
    <button
      class="new-chat-button"
      type="button"
      :disabled="store.isRunning"
      @click="store.startNewConversation()"
    >
      + 新对话
    </button>

    <ul v-if="store.sessions.length" class="session-list">
      <li v-for="session in store.sessions" :key="session.id" class="session-row">
        <button
          class="session-item"
          :class="{ 'is-active': session.id === store.currentSessionId }"
          type="button"
          :disabled="store.isRunning"
          :title="session.title"
          @click="store.switchConversation(session.id)"
        >
          <span class="session-title">{{ session.title }}</span>
          <span class="session-meta">{{ formatSessionTime(session.updatedAt) }} · {{ session.messages.length }} 条</span>
        </button>
        <button
          class="session-delete"
          type="button"
          :disabled="store.isRunning"
          :aria-label="`删除对话「${session.title}」`"
          @click.stop="confirmDelete(session)"
        >
          ×
        </button>
      </li>
    </ul>
    <p v-else class="empty-tip">暂无历史对话</p>

    <p v-if="store.isRunning" class="running-tip">任务执行中，暂不能切换对话</p>
  </aside>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import { useAgentUiStore } from '@/agent/stores/agentUiStore'
import type { AgentConversationSession } from '@/agent/types'

const store = useAgentUiStore()

function formatSessionTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const hhmm = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (date.toDateString() === now.toDateString()) return hhmm
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hhmm}`
}

async function confirmDelete(session: AgentConversationSession) {
  try {
    await ElMessageBox.confirm(`确认删除对话「${session.title}」？`, '提示', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    store.deleteConversation(session.id)
  } catch {
    // 用户取消删除。
  }
}
</script>

<style scoped>
.history-sidebar {
  display: flex;
  flex-direction: column;
  width: 190px;
  flex: 0 0 190px;
  min-height: 0;
  border-right: 1px solid #dce5eb;
  background: #f7fafc;
}

.new-chat-button {
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

.new-chat-button:disabled { opacity: 0.5; cursor: not-allowed; }
.new-chat-button:not(:disabled):hover { filter: brightness(0.96); }
.new-chat-button:focus-visible { outline: 2px solid #168aad; outline-offset: 2px; }

.session-list {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: 0 8px 10px;
  overflow-y: auto;
  list-style: none;
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 138, 156, 0.55) transparent;
}
.session-list::-webkit-scrollbar { width: 6px; }
.session-list::-webkit-scrollbar-track { background: transparent; }
.session-list::-webkit-scrollbar-thumb {
  background-color: rgba(120, 138, 156, 0.55);
  border-radius: 3px;
}
.session-list::-webkit-scrollbar-thumb:hover { background-color: rgba(120, 138, 156, 0.8); }

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
.session-item.is-active { background: #e3f0f4; box-shadow: inset 2px 0 0 #168aad; }
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

.session-delete {
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

.session-row:hover .session-delete,
.session-delete:focus-visible { opacity: 1; }
.session-delete:hover { background: #fff1f3; color: #bd3450; }

.empty-tip { margin: 18px 12px; color: #8a9aa7; font-size: 11px; text-align: center; }
.running-tip { margin: 0 12px 10px; color: #a27719; font-size: 10px; }
</style>
