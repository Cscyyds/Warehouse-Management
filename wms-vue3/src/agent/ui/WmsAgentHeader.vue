<template>
  <header class="agent-header" :class="`is-mode-${store.mode}`">
    <div class="identity">
      <span class="eyebrow">{{ store.mode === 'office' ? 'WMS · OFFICE' : 'WMS · PAGE AGENT' }}</span>
      <strong>{{ store.mode === 'office' ? '日常办公' : (store.currentPageTitle || '页面助手') }}</strong>
    </div>
    <div class="header-actions">
      <div class="mode-switch" role="tablist" aria-label="助手模式切换">
        <button
          type="button"
          role="tab"
          class="mode-tab"
          :class="{ 'is-active': store.mode === 'page' }"
          :aria-selected="store.mode === 'page'"
          @click="store.setMode('page')"
        >
          页面跳转
        </button>
        <button
          type="button"
          role="tab"
          class="mode-tab"
          :class="{ 'is-active': store.mode === 'office' }"
          :aria-selected="store.mode === 'office'"
          @click="store.setMode('office')"
        >
          日常办公
        </button>
        <span class="mode-indicator" :class="`is-${store.mode}`" aria-hidden="true" />
      </div>
      <button
        v-if="store.isRunning || store.officeBusy"
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
  padding: 14px 18px 12px;
  border-bottom: 1px solid #f0e6e4;
  background: #ffffff;
  transition: background 0.4s ease, border-color 0.4s ease;
}

/* 办公模式：白色底 + 品牌红眉条，高级而不沉闷 */
.agent-header.is-mode-office {
  background: linear-gradient(135deg, #fffafa 0%, #fff5f4 100%);
  border-bottom-color: #f0d8d4;
}

.identity { display: grid; gap: 2px; min-width: 0; }
.eyebrow {
  color: #c0392b;
  font: 600 9px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: 0.14em;
  transition: color 0.4s ease;
}
.is-mode-office .eyebrow { color: #922b21; }
.identity strong {
  color: #20313e;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.4s ease;
}
.is-mode-office .identity strong { color: #6e2117; }

.header-actions { display: flex; align-items: center; gap: 10px; }

/* 模式切换 Tab */
.mode-switch {
  position: relative;
  display: flex;
  padding: 3px;
  border-radius: 10px;
  background: #f5f5f5;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: background 0.4s ease;
}
.is-mode-office .mode-switch {
  background: #f5f5f5;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

.mode-tab {
  position: relative;
  z-index: 1;
  padding: 6px 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #666666;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.28s ease;
}
.is-mode-office .mode-tab { color: #666666; }
.mode-tab.is-active { color: #922b21; }
.is-mode-office .mode-tab.is-active { color: #922b21; }
.mode-tab:hover:not(.is-active) { color: #888888; }
.is-mode-office .mode-tab:hover:not(.is-active) { color: #888888; }

/* 滑动指示器：丝滑过渡 */
.mode-indicator {
  position: absolute;
  top: 3px;
  left: 3px;
  z-index: 0;
  height: calc(100% - 6px);
  border-radius: 7px;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(146, 43, 33, 0.14);
  transition: transform 0.42s cubic-bezier(0.4, 0.0, 0.2, 1), width 0.42s cubic-bezier(0.4, 0.0, 0.2, 1), background 0.4s ease;
}
.mode-indicator.is-page { width: 66px; transform: translateX(0); }
.mode-indicator.is-office {
  width: 66px;
  transform: translateX(66px);
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(146, 43, 33, 0.2);
}

button { border: 0; cursor: pointer; font: inherit; }

.stop-button {
  padding: 5px 9px;
  border-radius: 6px;
  background: #fff1f3;
  color: #c0392b;
  font-size: 11px;
  font-weight: 650;
}
.is-mode-office .stop-button {
  background: rgba(192, 57, 43, 0.1);
  color: #922b21;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: transparent;
  color: #8a5a52;
  font-size: 20px;
  transition: color 0.3s ease, background 0.3s ease;
}
.is-mode-office .icon-button { color: #8a5a52; }
.icon-button:hover { background: rgba(192, 57, 43, 0.08); color: #922b21; }

button:hover { filter: brightness(0.98); }
button:focus-visible { outline: 2px solid #c0392b; outline-offset: 2px; }
.is-mode-office button:focus-visible { outline-color: #922b21; }
</style>
