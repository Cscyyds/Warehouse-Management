<template>
  <section class="timeline" aria-label="Agent 执行轨迹">
    <div v-if="!entries.length" class="empty-state">
      <span class="empty-mark">⌁</span>
      <p>任务轨迹会显示在这里</p>
    </div>
    <WmsAgentActionCard v-for="entry in entries" :key="entry.id" :entry="entry" />
  </section>
</template>

<script setup lang="ts">
import type { AgentTimelineEntry } from '@/agent/types'
import WmsAgentActionCard from './WmsAgentActionCard.vue'

defineProps<{ entries: AgentTimelineEntry[] }>()
</script>

<style scoped>
.timeline {
  flex: 1 1 auto;
  min-height: 110px;
  overflow: auto;
  padding: 16px 18px 2px;
  scrollbar-width: thin;
}

.empty-state {
  display: grid;
  place-items: center;
  min-height: 90px;
  color: #8a9ba9;
}

.empty-state p { margin: 4px 0 0; font-size: 12px; }
.empty-mark { color: #168aad; font-size: 28px; line-height: 1; }
</style>
