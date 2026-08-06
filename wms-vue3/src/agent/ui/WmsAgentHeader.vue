<template>
  <header class="agent-header">
    <div class="identity">
      <span class="eyebrow">WMS · PAGE AGENT</span>
      <strong>{{ store.currentPageTitle || '页面助手' }}</strong>
    </div>
    <div class="header-actions">
      <!-- <button
        v-if="store.messages.length && !store.isRunning"
        class="new-chat-button"
        type="button"
        aria-label="开始新对话"
        @click="store.startNewConversation()"
      >
        新对话
      </button> -->
      <button
        v-if="store.isRunning"
        class="stop-button"
        type="button"
        aria-label="停止当前任务"
        @click="stopTask"
      >
        停止
      </button>
      <button class="icon-button" type="button" aria-label="关闭 WMS小助手面板" @click="store.closePanel()">
        ×
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useAgentUiStore } from '@/agent/stores/agentUiStore'
import { stopAgentTask } from '@/agent/runtime/agentRuntime'

const store = useAgentUiStore()

async function stopTask() {
  await stopAgentTask()
}
</script>

<style scoped>
.agent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid #dce5eb;
  background: #f7fafc;
}

.identity { display: grid; gap: 2px; min-width: 0; }
.eyebrow { color: #168aad; font: 600 9px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: 0.14em; }
.identity strong { color: #20313e; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.header-actions { display: flex; align-items: center; gap: 6px; }

button {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.stop-button,
.new-chat-button {
  padding: 5px 9px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 650;
}

.stop-button {
  background: #fff1f3;
  color: #bd3450;
}

.new-chat-button { background: #eaf4f7; color: #276b7f; }

.icon-button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: transparent;
  color: #607585;
  font-size: 20px;
}

button:hover { filter: brightness(0.96); }
button:focus-visible { outline: 2px solid #168aad; outline-offset: 2px; }
</style>
