<template>
  <div class="agent-message-body markdown-body" v-html="renderedHtml" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderAgentMarkdown } from './agentMarkdownRenderer'

const props = defineProps<{ content: string }>()
const renderedHtml = computed(() => renderAgentMarkdown(props.content))
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

.markdown-body :deep(p) { margin: 0; }
.markdown-body :deep(p + p),
.markdown-body :deep(.markdown-table-scroll + p),
.markdown-body :deep(ul + p),
.markdown-body :deep(ol + p),
.markdown-body :deep(pre + p),
.markdown-body :deep(blockquote + p) { margin-top: 10px; }

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 12px 0 6px;
  color: #173e4d;
  line-height: 1.35;
}

.markdown-body :deep(h1:first-child),
.markdown-body :deep(h2:first-child),
.markdown-body :deep(h3:first-child),
.markdown-body :deep(h4:first-child),
.markdown-body :deep(h5:first-child),
.markdown-body :deep(h6:first-child) { margin-top: 0; }

.markdown-body :deep(h1) { font-size: 17px; }
.markdown-body :deep(h2) { font-size: 15px; }
.markdown-body :deep(h3) { font-size: 13px; }
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) { font-size: 12px; }

.markdown-body :deep(ol) {
  counter-reset: agent-result;
  display: grid;
  gap: 6px;
  margin: 9px 0 0;
  padding: 0;
  list-style: none;
}

.markdown-body :deep(ol > li) {
  counter-increment: agent-result;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding: 7px 8px;
  border: 1px solid #e1e9ed;
  border-radius: 8px;
  background: #f7fafb;
}

.markdown-body :deep(ol > li::before) {
  content: counter(agent-result);
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

.markdown-body :deep(ol > li > *) { min-width: 0; }
.markdown-body :deep(strong) {
  color: #123f50;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.markdown-body :deep(ul) {
  margin: 8px 0 0;
  padding-left: 17px;
}
.markdown-body :deep(ul li + li) { margin-top: 4px; }

.markdown-body :deep(.markdown-table-scroll) {
  width: 100%;
  margin: 9px 0;
  overflow-x: auto;
  border: 1px solid #dce6eb;
  border-radius: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 138, 156, 0.55) transparent;
}
.markdown-body :deep(.markdown-table-scroll)::-webkit-scrollbar { height: 6px; }
.markdown-body :deep(.markdown-table-scroll)::-webkit-scrollbar-track { background: transparent; }
.markdown-body :deep(.markdown-table-scroll)::-webkit-scrollbar-thumb {
  background-color: rgba(120, 138, 156, 0.55);
  border-radius: 3px;
}
.markdown-body :deep(.markdown-table-scroll)::-webkit-scrollbar-thumb:hover {
  background-color: rgba(120, 138, 156, 0.8);
}

.markdown-body :deep(table) {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
  font-size: 11px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 7px 9px;
  border-right: 1px solid #dce6eb;
  border-bottom: 1px solid #dce6eb;
  text-align: left;
  vertical-align: top;
}

.markdown-body :deep(th:last-child),
.markdown-body :deep(td:last-child) { border-right: 0; }
.markdown-body :deep(tbody tr:last-child td) { border-bottom: 0; }

.markdown-body :deep(th) {
  background: #edf6f8;
  color: #174f61;
  font-weight: 700;
}

.markdown-body :deep(tbody tr:nth-child(even)) { background: #f8fafb; }
.markdown-body :deep(tbody tr:hover) { background: #edf7fa; }

.markdown-body :deep(blockquote) {
  margin: 8px 0;
  padding: 7px 10px;
  border-left: 3px solid #48a8ba;
  background: #f2f9fa;
  color: #536c78;
}

.markdown-body :deep(blockquote p) { margin: 0; }

.markdown-body :deep(pre) {
  margin: 9px 0;
  overflow-x: auto;
  padding: 9px;
  border-radius: 7px;
  background: #17242c;
  color: #e8f1f5;
  white-space: pre;
}

.markdown-body :deep(code) {
  font-family: Consolas, Monaco, monospace;
  font-size: 0.94em;
}

.markdown-body :deep(:not(pre) > code) {
  padding: 1px 4px;
  border-radius: 4px;
  background: #edf3f5;
  color: #28596b;
}

.markdown-body :deep(hr) {
  height: 1px;
  margin: 10px 0;
  border: 0;
  background: #dce6eb;
}

@media (prefers-reduced-motion: no-preference) {
  .markdown-body :deep(tbody tr) { transition: background-color 120ms ease; }
}
</style>
