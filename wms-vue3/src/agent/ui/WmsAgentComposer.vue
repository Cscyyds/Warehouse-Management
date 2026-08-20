<template>
  <form class="composer" @submit.prevent="submitTask">
    <textarea
      v-model="task"
      rows="2"
      maxlength="1000"
      :disabled="inputDisabled"
      :placeholder="placeholder"
      :aria-label="store.pendingQuestion ? '回答 WMS小助手的问题' : '输入 Agent 任务'"
      @keydown.enter.exact.prevent="submitTask"
    />
    <div
      v-if="voiceState === 'transcribing'"
      class="voice-transcribing"
      role="status"
      aria-live="polite"
    >
      <span class="voice-wave" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span class="voice-transcribing-copy">
        <strong>语音转写中…</strong>
        <small>正在等待识别结果，请稍候</small>
      </span>
    </div>
    <div class="composer-footer">
      <div class="composer-meta">
        <!-- <span>{{ task.length }}/1000</span> -->
        <span v-if="voiceStatusText" class="voice-status" aria-live="polite">
          {{ voiceStatusText }}
        </span>
      </div>
      <div class="composer-actions">
        <button
          type="button"
          class="voice-button"
          :class="{ 'is-recording': voiceState === 'recording' }"
          :disabled="voiceButtonDisabled"
          :aria-pressed="voiceState === 'recording'"
          :aria-label="voiceButtonLabel"
          :title="voiceButtonLabel"
          @click="toggleVoiceRecording"
        >
          <span v-if="voiceState === 'transcribing'" class="voice-spinner" aria-hidden="true" />
          <svg v-else-if="voiceState !== 'recording'" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 15.2a3.7 3.7 0 0 0 3.7-3.7V6.2a3.7 3.7 0 1 0-7.4 0v5.3a3.7 3.7 0 0 0 3.7 3.7Z" />
            <path d="M5.8 10.8v.8a6.2 6.2 0 0 0 12.4 0v-.8M12 17.8v3M8.7 20.8h6.6" />
          </svg>
          <span v-else class="stop-symbol" aria-hidden="true" />
        </button>
        <button type="submit" :disabled="!canSubmit">
          {{ store.pendingQuestion ? '发送回答' : '发送' }}
        </button>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { answerAgentQuestion, executeAgentTask } from '@/agent/runtime/agentRuntime'
import { useAgentUiStore } from '@/agent/stores/agentUiStore'
import { VoiceTranscriber } from '@/agent/voice/speechRecognitionApi'

type VoiceState = 'idle' | 'recording' | 'transcribing'

const store = useAgentUiStore()
const task = ref('')
const voiceState = ref<VoiceState>('idle')
// 静默授权期标记：点击后到真正开始录音前，前端不显示任何"申请中"反馈。
// 仅用于拦截重复点击，不参与任何视觉状态。
const voicePending = ref(false)
let transcriber: VoiceTranscriber | undefined
let voiceBaseText = ''
let recordingTimer: number | undefined

const voiceBusy = computed(() => voiceState.value !== 'idle' || voicePending.value)
const inputDisabled = computed(() => (
  voiceBusy.value || !store.available || (store.isRunning && !store.pendingQuestion)
))
const canSubmit = computed(() => !!task.value.trim() && !inputDisabled.value && !voiceBusy.value)
const voiceButtonDisabled = computed(() => (
  voiceState.value === 'transcribing'
  || (
    voiceState.value === 'idle'
    && !voicePending.value
    && (inputDisabled.value || !VoiceTranscriber.isSupported())
  )
))
const voiceButtonLabel = computed(() => {
  if (!VoiceTranscriber.isSupported()) return '当前浏览器不支持语音输入'
  if (voiceState.value === 'recording') return '停止录音并完成识别'
  if (voiceState.value === 'transcribing') return '正在识别语音'
  return '使用语音输入'
})
const voiceStatusText = computed(() => {
  if (voiceState.value === 'recording') return '录音中 · 点击停止'
  if (voiceState.value === 'transcribing') return '语音转写中…'
  return ''
})
const placeholder = computed(() => {
  if (store.pendingQuestion) return '请在这里补充所需信息…'
  return store.currentPageTitle
    ? `告诉我你想在“${store.currentPageTitle}”完成什么`
    : '告诉我你想完成什么'
})

async function submitTask() {
  if (!canSubmit.value) return
  const submittedTask = task.value.trim()
  try {
    if (store.pendingQuestion) {
      if (!answerAgentQuestion(submittedTask)) throw new Error('当前问题已失效，请重新发起任务')
      task.value = ''
      return
    }

    task.value = ''
    await executeAgentTask(submittedTask)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    store.setError(message)
    ElMessage.error(message)
  }
}

function clearRecordingTimer() {
  if (recordingTimer !== undefined) window.clearTimeout(recordingTimer)
  recordingTimer = undefined
}

async function startVoiceRecording() {
  if (voicePending.value || voiceState.value !== 'idle') return
  voicePending.value = true
  voiceBaseText = task.value.trim()
  const nextTranscriber = new VoiceTranscriber()
  transcriber = nextTranscriber
  try {
    // 后台静默获取浏览器麦克风权限：期间不改变任何前端 UI，
    // 等 getUserMedia 授权且音频链路真正接通、可以开始录音时，
    // 才进入 recording 动态交互（按钮脉冲 + "录音中"状态）。
    await nextTranscriber.start()
    voicePending.value = false
    voiceState.value = 'recording'
    recordingTimer = window.setTimeout(() => {
      if (voiceState.value === 'recording') void stopVoiceRecording(true)
    }, 30_000)
  } catch (error) {
    voicePending.value = false
    await nextTranscriber.cancel()
    transcriber = undefined
    voiceState.value = 'idle'
    const message = error instanceof Error ? error.message : '无法启动麦克风'
    ElMessage.error(message)
  }
}

async function stopVoiceRecording(reachedLimit = false) {
  if (voiceState.value !== 'recording' || !transcriber) return
  clearRecordingTimer()
  const activeTranscriber = transcriber
  transcriber = undefined
  voiceState.value = 'transcribing'
  try {
    const result = await activeTranscriber.stop()
    task.value = [voiceBaseText, result.text].filter(Boolean).join(' ').slice(0,2000)
    ElMessage.success(reachedLimit ? '已达到30秒上限，识别结果已填入输入框' : '识别结果已填入输入框')
  } catch (error) {
    await activeTranscriber.cancel()
    const message = error instanceof Error ? error.message : '语音识别失败，请稍后重试'
    ElMessage.error(message)
  } finally {
    voiceState.value = 'idle'
  }
}

async function toggleVoiceRecording() {
  if (voiceState.value === 'recording') {
    await stopVoiceRecording()
  } else if (voiceState.value === 'idle' && !voicePending.value) {
    await startVoiceRecording()
  }
}

onBeforeUnmount(() => {
  clearRecordingTimer()
  if (transcriber) void transcriber.cancel()
  transcriber = undefined
  voicePending.value = false
})
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
.composer-meta,
.composer-actions { display: flex; align-items: center; gap: 7px; }
.composer-meta > span { color: #9aa9b4; font: 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace; }
.composer-meta .voice-status { color: #167b94; }
.voice-transcribing {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 10px 5px;
  padding: 9px 10px;
  border: 1px solid rgb(22 138 173 / 18%);
  border-radius: 8px;
  background: linear-gradient(90deg, rgb(22 138 173 / 9%), rgb(22 138 173 / 3%));
  color: #146c86;
}
.voice-wave { display: flex; align-items: center; gap: 2px; width: 20px; height: 18px; }
.voice-wave i {
  width: 3px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  animation: voice-wave 1s ease-in-out infinite;
}
.voice-wave i:nth-child(2) { animation-delay: 0.12s; }
.voice-wave i:nth-child(3) { animation-delay: 0.24s; }
.voice-wave i:nth-child(4) { animation-delay: 0.36s; }
.voice-transcribing-copy { display: grid; gap: 2px; }
.voice-transcribing-copy strong { font-size: 12px; line-height: 1.2; }
.voice-transcribing-copy small { color: #6f8793; font-size: 10px; line-height: 1.2; }
.composer-actions button { display: grid; place-items: center; border: 0; cursor: pointer; }
.composer-actions .voice-button {
  width: 29px;
  height: 29px;
  padding: 0;
  border: 1px solid #cbdde4;
  border-radius: 8px;
  background: #f2f8fa;
  color: #146c86;
}
.voice-button svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
.voice-button.is-recording { border-color: #dc6372; background: #fff1f3; color: #b82e43; animation: recording-pulse 1.2s ease-in-out infinite; }
.voice-spinner { width: 13px; height: 13px; border: 2px solid rgb(20 108 134 / 22%); border-top-color: currentColor; border-radius: 50%; animation: voice-spin 0.8s linear infinite; }
.stop-symbol { width: 9px; height: 9px; border-radius: 2px; background: currentColor; }
.composer-footer button { border: 0; border-radius: 7px; padding: 7px 12px; background: #146c86; color: #fff; cursor: pointer; font-size: 12px; font-weight: 650; }
.composer-footer .voice-button { padding: 0; }
.composer-footer button:disabled { cursor: not-allowed; opacity: 0.45; }
.composer-footer button:focus-visible { outline: 2px solid #168aad; outline-offset: 2px; }
@keyframes recording-pulse { 50% { box-shadow: 0 0 0 4px rgb(220 99 114 / 13%); } }
@keyframes voice-spin { to { transform: rotate(360deg); } }
@keyframes voice-wave {
  0%, 100% { height: 6px; opacity: 0.45; }
  50% { height: 17px; opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .voice-button.is-recording,
  .voice-spinner,
  .voice-wave i { animation: none; }
}
</style>
