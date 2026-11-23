<template>
  <div class="sync-settings-layout">
    <header v-if="title" class="page-head">
      <h2>{{ title }}</h2>
      <p v-if="description">{{ description }}</p>
    </header>

    <div class="settings-grid" v-loading="loading">
      <slot />
      <slot name="details" />
    </div>

    <section v-if="$slots.scope" class="panel scope-panel" :aria-labelledby="scopeTitleId">
      <div class="panel-heading">
        <span class="panel-icon"><el-icon><Box /></el-icon></span>
        <h3 :id="scopeTitleId">同步范围与前置条件</h3>
      </div>
      <slot name="scope" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { Box } from '@element-plus/icons-vue'

defineProps<{ title?: string; description?: string; loading: boolean }>()

const scopeTitleId = useId()
</script>

<style scoped>
.sync-settings-layout {
  --sync-accent: var(--primary);
  --sync-muted: #596670;
  --sync-warning: #94530d;
  --readout-start: color-mix(in srgb, var(--bg-white) 96%, var(--primary));
  --readout-end: color-mix(in srgb, var(--bg-white) 88%, var(--primary));
  --readout-value: var(--primary-dark);
  --sync-mono: 'Cascadia Mono', Consolas, monospace;
  --panel-padding: clamp(16px, 2vw, 26px);
  container-type: inline-size;
  display: grid;
  gap: 16px;
  width: 100%;
  max-width: 1480px;
  margin-inline: auto;
  color: var(--text-primary);
}

html.dark .sync-settings-layout {
  --sync-accent: color-mix(in srgb, var(--primary) 46%, white);
  --sync-muted: #a7b1bb;
  --sync-warning: #f4bf70;
  --readout-start: var(--bg-deep-card);
  --readout-end: color-mix(in srgb, var(--bg-white) 80%, var(--primary));
  --readout-value: #f9e1dc;
}

.page-head {
  margin: 6px 0 4px;
}

.page-head h2 {
  margin: 0;
  font-size: clamp(22px, 2.3vw, 32px);
  font-weight: 700;
  line-height: 1.35;
}

.page-head p {
  margin: 7px 0 0;
  color: var(--sync-muted);
  font-size: 13px;
  line-height: 1.65;
}

:deep(code) {
  font-family: var(--sync-mono);
  font-size: 12px;
  letter-spacing: .04em;
}

.settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.07fr) minmax(0, 1fr);
  gap: 16px;
}

:deep(.panel) {
  min-width: 0;
  padding: var(--panel-padding);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-white);
}

:deep(.panel-heading) {
  display: flex;
  align-items: center;
  gap: 10px;
}

:deep(.panel-heading h3) {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
}

:deep(.panel-icon) {
  display: grid;
  flex: none;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
  color: var(--sync-muted);
}

:deep(.runtime-panel) {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

:deep(.field-label), :deep(dt) {
  margin: 0 0 8px;
  color: var(--sync-muted);
  font-size: 12px;
}

:deep(.field-note) { margin: 8px 0 0; color: var(--sync-muted); font-size: 12px; line-height: 1.65; }
:deep(.read-only) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  color: var(--sync-muted);
  font-size: 12px;
}

:deep(.runtime-details), :deep(.scope-details) { display: grid; margin: 0; }
:deep(.runtime-details) { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 14px; }
:deep(.runtime-details > div) { padding: 11px 0; border-top: 1px solid var(--border-color); }
:deep(.runtime-details .formal-start) { grid-column: 1 / -1; padding-bottom: 0; }
:deep(.runtime-details dt), :deep(.scope-details dt) { margin-bottom: 4px; }
:deep(dd) { margin: 0; overflow-wrap: anywhere; }
:deep(.data-value), :deep(.scope-details dd) { font-size: 14px; font-weight: 550; font-variant-numeric: tabular-nums; line-height: 1.5; }
:deep(.data-value .el-tag) { vertical-align: middle; }
:deep(.data-value span + .el-tag) { margin-left: 6px; }
:deep(.data-unit), :deep(.data-value.is-empty) { color: var(--sync-muted); font-size: 12px; font-weight: 400; }
:deep(.formal-start .field-note) { margin-top: 4px; }

.scope-panel {
  display: grid;
  grid-template-columns: minmax(0, max-content) minmax(0, 1fr);
  align-items: center;
  gap: 18px 26px;
}

:deep(.scope-details) { grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 14px; }
:deep(.scope-details.is-paired) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
:deep(.scope-details > div) { min-width: 0; padding-left: 14px; border-left: 1px solid var(--border-color); }

@container (max-width: 850px) {
  .settings-grid, .scope-panel { grid-template-columns: minmax(0, 1fr); }
  :deep(.scope-details > div) { padding: 0; border: 0; }
}

@container (max-width: 520px) {
  :deep(.scope-details) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
