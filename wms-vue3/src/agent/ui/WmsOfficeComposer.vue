<template>
  <div class="office-composer" :class="{ 'is-disabled': disabled, 'is-recording': voiceState === 'recording' }">
    <!-- 附件预览区 -->
    <ul v-if="attachments.length" class="att-chips">
      <li
        v-for="att in attachments"
        :key="att.id"
        class="att-chip"
        :class="att.type === 'audio/voice' ? 'is-voice' : 'is-file'"
      >
        <span class="chip-icon" aria-hidden="true">
          <svg v-if="att.type === 'audio/voice'" viewBox="0 0 24 24"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <svg v-else viewBox="0 0 24 24"><path d="M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span class="chip-name">{{ att.name }}</span>
        <button
          type="button"
          class="chip-remove"
          aria-label="移除附件"
          :disabled="disabled"
          @click="removeAttachment(att.id)"
        >×</button>
      </li>
    </ul>

    <!-- 输入框 -->
    <div class="input-row">
      <button
        type="button"
        class="tool-btn"
        aria-label="上传文件"
        title="上传文件"
        :disabled="disabled || voiceState !== 'idle' || voicePending"
        @click="triggerFilePicker"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.44 10.27 12 1 2.56 10.27M12 1v18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 22h16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
      </button>
      <input
        ref="fileInputRef"
        type="file"
        class="file-input"
        :disabled="disabled || voiceState !== 'idle' || voicePending"
        @change="handleFileSelect"
      />

      <button
        type="button"
        class="tool-btn voice-btn"
        :class="{ 'is-recording': voiceState === 'recording' }"
        :aria-pressed="voiceState === 'recording'"
        aria-label="语音输入"
        title="语音输入"
        :disabled="voiceButtonDisabled"
        @click="toggleVoice"
      >
        <span v-if="voiceState === 'transcribing' || voicePending" class="voice-spinner" aria-hidden="true" />
        <svg v-else-if="voiceState !== 'recording'" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span v-else class="rec-stop-icon" aria-hidden="true" />
      </button>

      <!-- 实时识别文字直接写回 textarea，录音状态显示在其下方。 -->
      <div class="input-field">
        <textarea
          ref="textareaRef"
          v-model="text"
          rows="1"
          maxlength="2000"
          :disabled="disabled || voicePending || voiceState === 'transcribing'"
          :placeholder="voiceState === 'recording' ? '正在识别，请开始说话…' : '发文字、传文件、发语音，告诉我你想做什么…'"
          aria-label="办公模式输入框"
          @keydown.enter.exact.prevent="submit"
          @input="autoGrow"
        />
        <Transition name="field-fade">
          <div v-if="voiceState === 'recording' || voiceState === 'transcribing'" class="recording-field">
            <span class="rec-indicator" aria-hidden="true">
              <i /><i /><i /><i /><i /><i /><i />
            </span>
            <span class="rec-label">{{ voiceState === 'recording' ? '实时识别中' : '正在生成最终识别结果' }}</span>
            <span class="rec-timer">{{ formatDuration(recordingMs) }}</span>
            <span class="rec-hint">{{ voiceState === 'recording' ? '识别文字会实时显示在上方' : '请稍候' }}</span>
          </div>
        </Transition>
      </div>

      <button
        v-if="voiceState === 'recording'"
        type="button"
        class="send-btn rec-finish"
        aria-label="完成录音"
        @click="stopVoiceRecording()"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
      </button>
      <button
        v-else
        type="submit"
        class="send-btn"
        :disabled="!canSubmit"
        aria-label="发送"
        @click="submit"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { OfficeAttachment } from '@/agent/types'
import { VoiceTranscriber } from '@/agent/voice/speechRecognitionApi'

const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{
  (e: 'submit', payload: { text: string; attachments: OfficeAttachment[] }): void
}>()

const text = ref('')
const attachments = ref<OfficeAttachment[]>([])
const fileInputRef = ref<HTMLInputElement>()
const textareaRef = ref<HTMLTextAreaElement>()

type VoiceState = 'idle' | 'recording' | 'transcribing'
const voiceState = ref<VoiceState>('idle')
const voicePending = ref(false)
const recordingMs = ref(0)
let durationTimer: number | undefined
let recordingLimitTimer: number | undefined
let transcriber: VoiceTranscriber | undefined
let voiceBaseText = ''

const canSubmit = computed(() => (
  !props.disabled
  && !voicePending.value
  && voiceState.value === 'idle'
  && (!!text.value.trim() || attachments.value.length > 0)
))
const voiceButtonDisabled = computed(() => (
  !!props.disabled
  || voicePending.value
  || voiceState.value === 'transcribing'
  || (voiceState.value === 'idle' && !VoiceTranscriber.isSupported())
))

function autoGrow() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 140) + 'px'
}

function triggerFilePicker() {
  fileInputRef.value?.click()
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files) return
  Array.from(input.files).forEach((file) => {
    attachments.value.push({
      id: `att:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      file,
    })
  })
  input.value = ''
}

function removeAttachment(id: string) {
  const idx = attachments.value.findIndex(a => a.id === id)
  if (idx >= 0) attachments.value.splice(idx, 1)
}

async function toggleVoice() {
  if (voiceState.value === 'recording') {
    await stopVoiceRecording()
  } else if (voiceState.value === 'idle') {
    await startVoiceRecording()
  }
}

function clearVoiceTimers() {
  if (durationTimer !== undefined) window.clearInterval(durationTimer)
  if (recordingLimitTimer !== undefined) window.clearTimeout(recordingLimitTimer)
  durationTimer = undefined
  recordingLimitTimer = undefined
}

async function startVoiceRecording() {
  if (voicePending.value || voiceState.value !== 'idle') return
  voicePending.value = true
  voiceBaseText = text.value.trim()
  const nextTranscriber = new VoiceTranscriber()
  transcriber = nextTranscriber
  try {
    await nextTranscriber.start()
    voicePending.value = false
    voiceState.value = 'recording'
    recordingMs.value = 0
    durationTimer = window.setInterval(() => { recordingMs.value += 100 }, 100)
    recordingLimitTimer = window.setTimeout(() => {
      if (voiceState.value === 'recording') void stopVoiceRecording(true)
    }, 30_000)
  } catch (error) {
    voicePending.value = false
    await nextTranscriber.cancel()
    transcriber = undefined
    voiceState.value = 'idle'
    ElMessage.error(error instanceof Error ? error.message : '无法启动麦克风')
  }
}

async function stopVoiceRecording(reachedLimit = false) {
  if (voiceState.value !== 'recording' || !transcriber) return
  clearVoiceTimers()
  const activeTranscriber = transcriber
  transcriber = undefined
  voiceState.value = 'transcribing'
  try {
    const result = await activeTranscriber.stop()
    text.value = [voiceBaseText, result.text].filter(Boolean).join(' ').slice(0, 2000)
    await nextTick(autoGrow)
    ElMessage.success(reachedLimit ? '已达到30秒上限，识别结果已填入输入框' : '识别完成')
  } catch (error) {
    await activeTranscriber.cancel()
    ElMessage.error(error instanceof Error ? error.message : '语音识别失败，请稍后重试')
  } finally {
    voiceState.value = 'idle'
  }
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}"`
}

function submit() {
  if (!canSubmit.value) return
  emit('submit', { text: text.value, attachments: [...attachments.value] })
  text.value = ''
  attachments.value = []
  if (textareaRef.value) textareaRef.value.style.height = 'auto'
}

onBeforeUnmount(() => {
  clearVoiceTimers()
  if (transcriber) void transcriber.cancel()
  transcriber = undefined
  voicePending.value = false
})
</script>

<style scoped>
.office-composer {
  padding: 10px 14px 14px;
  border-top: 1px solid #f0e6e4;
  background: #ffffff;
}
.office-composer.is-disabled { opacity: 0.7; pointer-events: none; }

/* 附件预览 chips */
.att-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
}
.att-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 5px 4px 5px 8px;
  border: 1px solid rgba(192, 57, 43, 0.28);
  border-radius: 8px;
  background: rgba(192, 57, 43, 0.06);
  color: #922b21;
  font-size: 11px;
}
.chip-icon { display: inline-flex; }
.chip-icon svg { width: 14px; height: 14px; color: #c0392b; }
.chip-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip-remove {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border: 0;
  border-radius: 50%;
  background: rgba(192, 57, 43, 0.1);
  color: #8a5a52;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.18s, color 0.18s;
}
.chip-remove:hover { background: rgba(192, 57, 43, 0.3); color: #922b21; }

/* 输入行 */
.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 6px 8px;
  border: 1.5px solid #e5e5e5;
  border-radius: 14px;
  background: #ffffff;
  transition: border-color 0.22s, box-shadow 0.22s, background 0.3s;
}
.input-row:focus-within {
  border-color: rgba(192, 57, 43, 0.5);
  box-shadow: 0 0 0 3px rgba(192, 57, 43, 0.1);
  background: #ffffff;
}
/* 录音态：输入行整体变红 + 高级动画效果 */
.office-composer.is-recording .input-row {
  border-color: #c0392b;
  background: linear-gradient(135deg, rgba(192, 57, 43, 0.08) 0%, rgba(231, 76, 60, 0.05) 50%, rgba(146, 43, 33, 0.1) 100%);
  box-shadow: 0 0 0 3px rgba(192, 57, 43, 0.15), 0 4px 12px rgba(192, 57, 43, 0.08);
  animation: rec-input-glow 2s ease-in-out infinite;
}
@keyframes rec-input-glow {
  0%, 100% { box-shadow: 0 0 0 3px rgba(192, 57, 43, 0.15), 0 4px 12px rgba(192, 57, 43, 0.08); }
  50% { box-shadow: 0 0 0 4px rgba(192, 57, 43, 0.2), 0 6px 16px rgba(192, 57, 43, 0.12); }
}

.tool-btn {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #8a5a52;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.tool-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; }
.tool-btn:hover:not(:disabled) { background: rgba(192, 57, 43, 0.08); color: #922b21; }
.tool-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.voice-btn.is-recording {
  background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%);
  color: #fff;
  animation: voice-pulse 1.2s ease-in-out infinite;
  transform: scale(1.05);
}
.voice-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(192, 57, 43, 0.2);
  border-top-color: #c0392b;
  border-radius: 50%;
  animation: voice-spin 0.8s linear infinite;
}
@keyframes voice-spin { to { transform: rotate(360deg); } }
@keyframes voice-pulse {
  0% { box-shadow: 0 0 0 0 rgba(192, 57, 43, 0.6); transform: scale(1.05); }
  50% { box-shadow: 0 0 0 6px rgba(192, 57, 43, 0.1); }
  70% { box-shadow: 0 0 0 10px rgba(192, 57, 43, 0); }
  100% { box-shadow: 0 0 0 0 rgba(192, 57, 43, 0); transform: scale(1.05); }
}
.rec-stop-icon { width: 10px; height: 10px; border-radius: 2px; background: currentColor; }

.file-input { display: none; }

/* 输入字段区域 */
.input-field {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
textarea {
  width: 100%;
  min-height: 32px;
  max-height: 140px;
  padding: 7px 4px;
  border: 0;
  background: transparent;
  color: #1f2329;
  font: 13px/1.5 inherit;
  resize: none;
  outline: 0;
}
textarea::placeholder { color: #c4a59f; }

/* 录音态字段 */
.recording-field {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 0 2px 4px;
}
.rec-indicator {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 16px;
}
.rec-indicator i {
  width: 3px;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%);
  animation: rec-wave 1.1s ease-in-out infinite;
  box-shadow: 0 0 8px rgba(192, 57, 43, 0.3);
}
.rec-indicator i:nth-child(1) { animation-delay: 0s; }
.rec-indicator i:nth-child(2) { animation-delay: 0.08s; }
.rec-indicator i:nth-child(3) { animation-delay: 0.16s; }
.rec-indicator i:nth-child(4) { animation-delay: 0.24s; }
.rec-indicator i:nth-child(5) { animation-delay: 0.32s; }
.rec-indicator i:nth-child(6) { animation-delay: 0.24s; }
.rec-indicator i:nth-child(7) { animation-delay: 0.08s; }
@keyframes rec-wave {
  0%, 100% { height: 6px; opacity: 0.5; transform: scaleY(1); }
  50% { height: 14px; opacity: 1; transform: scaleY(1.1); }
}
.rec-label {
  font-size: 11px;
  font-weight: 600;
  color: #922b21;
  white-space: nowrap;
  animation: rec-text-pulse 2s ease-in-out infinite;
}
@keyframes rec-text-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}
.rec-label::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 7px;
  border-radius: 50%;
  background: radial-gradient(circle, #e74c3c 0%, #c0392b 70%);
  vertical-align: middle;
  animation: rec-dot 1s ease-in-out infinite;
  box-shadow: 0 0 12px rgba(192, 57, 43, 0.6), 0 0 6px rgba(231, 76, 60, 0.4);
}
@keyframes rec-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.75); box-shadow: 0 0 16px rgba(192, 57, 43, 0.8); }
}
.rec-timer {
  font-variant-numeric: tabular-nums;
  color: #c0392b;
  font-size: 11px;
  font-weight: 700;
  background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.rec-hint {
  margin-left: auto;
  font-size: 11px;
  color: #c4a59f;
}

/* 字段切换过渡 */
.field-fade-enter-active, .field-fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.field-fade-enter-from { opacity: 0; transform: translateY(4px); }
.field-fade-leave-to { opacity: 0; transform: translateY(-4px); }

.send-btn {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 9px;
  background: linear-gradient(135deg, #c0392b 0%, #922b21 100%);
  color: #fff;
  cursor: pointer;
  transition: transform 0.18s, box-shadow 0.18s, opacity 0.18s;
}
.send-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; }
.send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(146, 43, 33, 0.4); }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.rec-finish {
  background: #c0392b;
  box-shadow: 0 2px 8px rgba(192, 57, 43, 0.3);
}


@media (prefers-reduced-motion: reduce) {
  .rec-indicator i, .voice-btn.is-recording, .rec-label::before, .voice-spinner { animation: none !important; }
}
</style>
