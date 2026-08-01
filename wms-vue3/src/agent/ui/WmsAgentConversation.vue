<template>
  <section ref="conversationRef" class="conversation" aria-label="WMS小助手对话">
    <div v-if="!messages.length" class="welcome-message">
      <span class="assistant-avatar" aria-hidden="true">W</span>
      <div>
        <strong>你好，我是 WMS小助手</strong>
        <p>告诉我你想查询或操作什么；缺少必要信息时，我会在这里向你询问。</p>
      </div>
    </div>

    <template v-for="item in conversationFeed" :key="item.id">
      <article
        v-if="item.type === 'message'"
        class="message-row"
        :class="[`is-${item.data.role}`, `is-${item.data.kind}`]"
      >
        <span v-if="item.data.role === 'assistant'" class="assistant-avatar" aria-hidden="true">W</span>
        <div class="message-content">
          <span class="message-author">{{ item.data.role === 'user' ? '你' : 'WMS小助手' }}</span>
          <WmsAgentMessageBody
            v-if="item.data.role === 'assistant' && item.data.kind === 'result'"
            :content="item.data.content"
          />
          <p v-else>{{ item.data.content }}</p>
          <small v-if="item.data.kind === 'question'">等待你的回答</small>
        </div>
      </article>
      <div v-else class="activity-row">
        <WmsAgentActionCard :entry="item.data" compact />
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { AgentChatMessage, AgentTimelineEntry } from '@/agent/types'
import WmsAgentActionCard from './WmsAgentActionCard.vue'
import WmsAgentMessageBody from './WmsAgentMessageBody.vue'

const props = defineProps<{
  messages: AgentChatMessage[]
  entries: AgentTimelineEntry[]
}>()
const conversationRef = ref<HTMLElement>()
const conversationFeed = computed(() =>
  [
    ...props.messages.map((message) => ({
      id: message.id,
      sequence: message.sequence,
      type: 'message' as const,
      data: message,
    })),
    ...props.entries.map((entry) => ({
      id: entry.id,
      sequence: entry.sequence ?? 0,
      type: 'activity' as const,
      data: entry,
    })),
  ].sort((left, right) => left.sequence - right.sequence),
)

watch(
  () => [
    props.messages.length,
    props.entries.length,
    props.entries.at(-1)?.status,
  ],
  async () => {
    await nextTick()
    const element = conversationRef.value
    if (element) element.scrollTop = element.scrollHeight
  },
  { flush: 'post' },
)
</script>

<style scoped>
.conversation {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 14px 10px;
  background: #f8fbfc;
  scrollbar-width: thin;
}

.welcome-message,
.message-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.welcome-message { color: #536b7b; }
.welcome-message strong { color: #263b49; font-size: 13px; }
.welcome-message p { margin: 5px 0 0; font-size: 12px; line-height: 1.6; }

.assistant-avatar {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  flex: 0 0 25px;
  border-radius: 8px;
  background: #146c86;
  color: #fff;
  font: 700 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
  box-shadow: 0 3px 8px rgb(20 108 134 / 16%);
}

.message-row { margin-bottom: 14px; }
.message-row.is-user { justify-content: flex-end; }
.activity-row { margin: -2px 0 12px 33px; }

.message-content {
  max-width: min(82%, 520px);
  min-width: 0;
}

.message-author {
  display: block;
  margin: 0 0 4px 2px;
  color: #7b8f9d;
  font-size: 9px;
}

.message-content p {
  margin: 0;
  padding: 9px 11px;
  border: 1px solid #d9e4ea;
  border-radius: 5px 12px 12px;
  background: #fff;
  color: #304654;
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.is-user .message-author { margin-right: 2px; text-align: right; }
.is-user .message-content p {
  border-color: #146c86;
  border-radius: 12px 5px 12px 12px;
  background: #146c86;
  color: #fff;
}

.is-question .message-content p { border-color: #e2c679; background: #fff9e9; color: #684f18; }
.is-error .message-content p { border-color: #edbdc6; background: #fff3f5; color: #923249; }
.is-stopped .message-content p { background: #f2f5f7; color: #667b89; }
.message-content small { display: block; margin: 4px 0 0 3px; color: #a27719; font-size: 9px; }
</style>
