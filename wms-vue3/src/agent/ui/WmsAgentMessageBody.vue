<template>
  <div class="agent-message-body">
    <template v-for="(block, blockIndex) in blocks" :key="blockIndex">
      <p v-if="block.type === 'paragraph'" class="message-paragraph">
        <template v-for="(segment, segmentIndex) in block.items[0]" :key="segmentIndex">
          <strong v-if="segment.bold">{{ segment.text }}</strong>
          <span v-else>{{ segment.text }}</span>
        </template>
      </p>

      <ol v-else-if="block.type === 'ordered-list'" class="result-list">
        <li v-for="(segments, itemIndex) in block.items" :key="itemIndex">
          <span class="result-index">{{ itemIndex + 1 }}</span>
          <span class="result-copy">
            <template v-for="(segment, segmentIndex) in segments" :key="segmentIndex">
              <strong v-if="segment.bold">{{ segment.text }}</strong>
              <span v-else>{{ segment.text }}</span>
            </template>
          </span>
        </li>
      </ol>

      <ul v-else class="bullet-list">
        <li v-for="(segments, itemIndex) in block.items" :key="itemIndex">
          <template v-for="(segment, segmentIndex) in segments" :key="segmentIndex">
            <strong v-if="segment.bold">{{ segment.text }}</strong>
            <span v-else>{{ segment.text }}</span>
          </template>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatAgentMessage } from './agentMessageFormatter'

const props = defineProps<{ content: string }>()
const blocks = computed(() => formatAgentMessage(props.content))
</script>

<style scoped>
.agent-message-body {
  padding: 10px 11px;
  border: 1px solid #d9e4ea;
  border-radius: 5px 12px 12px;
  background: #fff;
  color: #304654;
  font-size: 12px;
  line-height: 1.62;
  overflow-wrap: anywhere;
}

.message-paragraph { margin: 0; }
.message-paragraph + .message-paragraph,
.result-list + .message-paragraph,
.bullet-list + .message-paragraph { margin-top: 10px; }

.result-list {
  display: grid;
  gap: 6px;
  margin: 9px 0 0;
  padding: 0;
  list-style: none;
}

.result-list li {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding: 7px 8px;
  border: 1px solid #e1e9ed;
  border-radius: 8px;
  background: #f7fafb;
}

.result-index {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  border-radius: 6px;
  background: #dceef3;
  color: #146c86;
  font: 700 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
}

.result-copy { min-width: 0; }
.result-copy strong { color: #123f50; font-weight: 700; letter-spacing: 0.01em; }

.bullet-list {
  margin: 8px 0 0;
  padding-left: 17px;
}
.bullet-list li + li { margin-top: 4px; }

strong { font-weight: 700; }
</style>
