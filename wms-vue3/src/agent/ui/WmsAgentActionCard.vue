<template>
  <article
    class="action-card"
    :class="[`is-${entry.status}`, `is-${entry.kind}`, { 'is-compact': compact }]"
  >
    <span class="track-dot" aria-hidden="true" />
    <div class="action-copy">
      <div class="action-heading">
        <strong>{{ entry.title }}</strong>
        <span v-if="entry.duration !== undefined" class="duration">{{ entry.duration }} ms</span>
      </div>
      <p>{{ entry.detail }}</p>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { AgentTimelineEntry } from '@/agent/types'

withDefaults(defineProps<{ entry: AgentTimelineEntry; compact?: boolean }>(), {
  compact: false,
})
</script>

<style scoped>
.action-card {
  position: relative;
  display: flex;
  gap: 12px;
  padding: 0 0 16px;
}

.action-card.is-compact {
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #dce6eb;
  border-radius: 9px;
  background: #f3f7f9;
}

.is-compact .track-dot { width: 8px; height: 8px; flex-basis: 8px; margin-top: 5px; border-width: 1px; }
.is-compact .action-heading strong { font-size: 11px; }
.is-compact .action-copy p { margin-top: 2px; font-size: 10px; }

.action-card:not(:last-child)::before {
  content: '';
  position: absolute;
  top: 14px;
  bottom: 0;
  left: 5px;
  width: 1px;
  background: var(--agent-line, #d9e2ea);
}

.track-dot {
  position: relative;
  z-index: 1;
  width: 11px;
  height: 11px;
  flex: 0 0 11px;
  margin-top: 4px;
  border-radius: 50%;
  border: 2px solid #6e8799;
  background: #f7fafc;
}

.is-running .track-dot {
  border-color: #168aad;
  box-shadow: 0 0 0 4px rgb(22 138 173 / 12%);
}

.is-success .track-dot { border-color: #2f9e73; background: #2f9e73; }
.is-error .track-dot { border-color: #d9485f; background: #d9485f; }

.action-copy { min-width: 0; flex: 1; }
.action-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.action-heading strong { color: #263746; font-size: 12px; font-weight: 650; }
.duration { color: #8093a3; font: 10px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; }
.action-copy p { margin: 4px 0 0; color: #637787; font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; }
</style>
