<template>
  <form class="composer" @submit.prevent="submitTask">
    <textarea
      v-model="task"
      rows="2"
      maxlength="1000"
      :disabled="store.isRunning || !store.available"
      :placeholder="placeholder"
      aria-label="输入 Agent 任务"
      @keydown.enter.exact.prevent="submitTask"
    />
    <div class="composer-footer">
      <span>{{ task.length }}/1000</span>
      <button type="submit" :disabled="!canSubmit">执行任务</button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { executeAgentTask } from '@/agent/runtime/agentRuntime'
import { useAgentUiStore } from '@/agent/stores/agentUiStore'

const store = useAgentUiStore()
const task = ref('')
const canSubmit = computed(() => !!task.value.trim() && !store.isRunning && store.available)
const placeholder = computed(() =>
  store.currentPageTitle ? `告诉我你想在“${store.currentPageTitle}”完成什么` : '当前页面尚未注册业务能力',
)

async function submitTask() {
  if (!canSubmit.value) return
  const submittedTask = task.value.trim()
  task.value = ''
  try {
    await executeAgentTask(submittedTask)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    store.setError(message)
    ElMessage.error(message)
  }
}
</script>

<style scoped>
.composer {
  margin: 0 12px 12px;
  border: 1px solid #cfdbe3;
  border-radius: 10px;
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.composer:focus-within { border-color: #168aad; box-shadow: 0 0 0 3px rgb(22 138 173 / 10%); }
textarea { width: 100%; min-height: 64px; resize: none; border: 0; outline: 0; padding: 10px 11px 4px; background: transparent; color: #263746; font: 13px/1.55 inherit; box-sizing: border-box; }
textarea::placeholder { color: #94a4b0; }
.composer-footer { display: flex; align-items: center; justify-content: space-between; padding: 5px 6px 6px 11px; }
.composer-footer span { color: #9aa9b4; font: 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace; }
.composer-footer button { border: 0; border-radius: 7px; padding: 7px 12px; background: #146c86; color: #fff; cursor: pointer; font-size: 12px; font-weight: 650; }
.composer-footer button:disabled { cursor: not-allowed; opacity: 0.45; }
.composer-footer button:focus-visible { outline: 2px solid #168aad; outline-offset: 2px; }
</style>
