<template>
  <div class="office-composer" :class="{ 'is-disabled': composerDisabled }">
    <!-- 待发送图片：本地预览秒显，上传中角标转圈，× 移除 -->
    <div v-if="pendingImages.length" class="pending-images">
      <button
        v-for="file in pendingImages"
        :key="file.id"
        type="button"
        class="pending-thumb"
        :title="file.name"
        @click="previewPendingImages(file)"
      >
        <img :src="file.localUrl" :alt="file.name" />
        <span v-if="!file.url" class="thumb-uploading" aria-hidden="true"><i /></span>
        <span
          role="button"
          tabindex="-1"
          class="thumb-remove"
          aria-label="移除图片"
          @click.stop="store.removeOfficeFile(file.id)"
        >×</span>
      </button>
    </div>

    <!-- 待发送文档：紧凑长条，主名超 4 字截断、后缀保留 -->
    <div v-for="file in pendingDocs" :key="file.id" class="pending-doc-row">
      <span class="pending-doc">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 13h8M8 16.5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <span class="pending-doc-name">{{ shortDocName(file.name) }}</span>
        <span
          role="button"
          tabindex="-1"
          class="pending-doc-remove"
          aria-label="移除文件"
          @click="store.removeOfficeFile(file.id)"
        >×</span>
      </span>
      <span class="pending-doc-hint">每条消息限一个文件</span>
    </div>

    <!-- 语音转写中提示 -->
    <div v-if="voiceState === 'transcribing'" class="voice-converting" aria-live="polite">
      <span class="converting-spinner" aria-hidden="true" />
      正在把语音转换为文字...
    </div>

    <input
      ref="fileInputRef"
      type="file"
      class="file-input"
      multiple
      :disabled="composerDisabled || voiceState !== 'idle'"
      @change="handleFileSelect"
    />

    <label class="web-search-toggle"><input v-model="store.officeWebSearch" type="checkbox" :disabled="composerDisabled" /> 联网搜索</label>

    <!-- 立体悬浮输入条：单行胶囊曲度，出现第二行时平滑降为圆角矩形 -->
    <div class="input-bar" :class="{ 'is-multi-line': multiLine, 'is-recording': voiceState === 'recording' }">
      <!-- 录音态：输入框位置换成实时声波 + 计时器，一眼可见正在录音 -->
      <div v-if="voiceState === 'recording'" class="recording-field" aria-live="polite">
        <span class="recording-label">
          <span class="recording-dot" aria-hidden="true" />
          正在录音
        </span>
        <span class="recording-wave" aria-hidden="true">
          <i
            v-for="(bar, barIndex) in waveLevels"
            :key="barIndex"
            :style="{ height: `${bar}px` }"
          />
        </span>
        <span class="recording-timer">{{ recordingSeconds }}s / 60s</span>
        <span class="recording-hint">点击 <strong>■</strong> 结束并转为文字</span>
      </div>
      <textarea
        v-else
        ref="textareaRef"
        v-model="text"
        rows="1"
        maxlength="2000"
        :disabled="composerDisabled || voiceState === 'transcribing'"
        placeholder="问库存、查订单、开单"
        aria-label="日常办公输入框"
        @keydown.enter.exact.prevent="submit"
        @input="autoGrow"
        @focus="focused = true"
        @blur="focused = false"
      />

      <template v-if="voiceState === 'recording'">
        <!-- 录音中：麦克风位置变成红色停止按钮 -->
        <button
          type="button"
          class="chip is-stop"
          aria-label="结束录音并转为文字"
          title="结束录音并转为文字"
          @click="stopVoiceRecording()"
        >
          <span class="stop-icon" aria-hidden="true" />
        </button>
      </template>
      <template v-else-if="editing">
        <button
          type="submit"
          class="chip is-send"
          :class="{ 'is-ready': canSubmit }"
          :disabled="!canSubmit"
          aria-label="发送"
          title="发送（Enter）"
          @click="submit"
        >↑</button>
      </template>
      <template v-else>
        <button
          type="button"
          class="chip"
          :disabled="composerDisabled || !voiceSupported"
          aria-label="语音输入"
          title="语音输入"
          @click="toggleVoice"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
        </button>
        <button
          type="button"
          class="chip is-attach"
          :disabled="composerDisabled || voiceState !== 'idle'"
          aria-label="添加附件"
          title="添加附件（图片可多选，文档限一个）"
          @click="triggerFilePicker"
        >＋</button>
      </template>
    </div>

    <p class="composer-disclaimer">AI 内容仅供参考，业务写入前请仔细核对</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { OfficePendingFile } from '@/agent/types'
import { VoiceTranscriber } from '@/agent/voice/speechRecognitionApi'
import { useAgentUiStore } from '@/agent/stores/agentUiStore'

const emit = defineEmits<{
  (e: 'preview-images', payload: { urls: Array<{ url: string; title: string }>; current: string }): void
}>()

const store = useAgentUiStore()

const text = ref('')
const focused = ref(false)
const multiLine = ref(false)
const fileInputRef = ref<HTMLInputElement>()
const textareaRef = ref<HTMLTextAreaElement>()

type VoiceState = 'idle' | 'recording' | 'transcribing'
const voiceState = ref<VoiceState>('idle')
const recordingSeconds = ref(0)
const voiceSupported = VoiceTranscriber.isSupported()
let durationTimer: number | undefined
let recordingLimitTimer: number | undefined
let transcriber: VoiceTranscriber | undefined
let voiceBaseText = ''
// 语音输入关联（同音字纠错学习回路）：发送时随消息上报
let voiceSessionId = ''

// ─── 录音波形：跟随真实麦克风响度跳动 ──────────────────────────────────
// onAmplitude 每个音频块（约 85ms）上报一次 RMS；100ms 节拍把当前响度推入
// 滚动窗口并衰减，静音时波形自然回落而不是冻住。
const WAVE_BARS = 26
const WAVE_MIN_PX = 4
const WAVE_MAX_PX = 22
const waveLevels = ref<number[]>(Array.from({ length: WAVE_BARS }, () => WAVE_MIN_PX))
let waveCurrentLevel = 0
let waveTickTimer: number | undefined

function onRecordingAmplitude(level: number) {
  waveCurrentLevel = Math.max(waveCurrentLevel, level)
}

function pushWaveSample() {
  const height = Math.round(WAVE_MIN_PX + waveCurrentLevel * (WAVE_MAX_PX - WAVE_MIN_PX))
  waveLevels.value = [...waveLevels.value.slice(1), height]
  // 衰减：无声时约 0.3s 回落到基线
  waveCurrentLevel *= 0.7
}

function startWaveTicker() {
  stopWaveTicker()
  waveLevels.value = Array.from({ length: WAVE_BARS }, () => WAVE_MIN_PX)
  waveCurrentLevel = 0
  waveTickTimer = window.setInterval(pushWaveSample, 100)
}

function stopWaveTicker() {
  if (waveTickTimer !== undefined) window.clearInterval(waveTickTimer)
  waveTickTimer = undefined
}

const pendingFiles = computed<OfficePendingFile[]>(() => store.officePendingFiles)
const pendingImages = computed(() => pendingFiles.value.filter(file => file.kind === 'image'))
const pendingDocs = computed(() => pendingFiles.value.filter(file => file.kind !== 'image'))

// 编辑态：聚焦 / 已有内容 / 已有附件 → 只保留输入框 + 发送按钮（app 同款）
const editing = computed(() => focused.value || text.value.length > 0 || pendingFiles.value.length > 0)
const composerDisabled = computed(() =>
  store.officeAnswering || store.officePreparingSend || store.officeInitializing || store.officeUploadingFile)
const canSubmit = computed(() => (
  !composerDisabled.value
  && voiceState.value === 'idle'
  && (!!text.value.trim() || store.officeHasReadyFile)
))

// 文本清空即解除语音纠错关联（全删重打无法归属到语音基线）
watch(text, (value) => {
  if (!value) voiceSessionId = ''
})

function autoGrow() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  // 行高 21px：内容高度超过 1.6 行即视为出现第二行（app 同款判定）
  multiLine.value = el.scrollHeight > 21 * 1.6
}

function triggerFilePicker() {
  fileInputRef.value?.click()
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  if (files.length) store.chooseOfficeFiles(files)
  input.value = ''
}

/** 主名超 4 字截断加省略号，格式后缀始终保留（app 同款）。 */
function shortDocName(name: string): string {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot + 1) : ''
  if (stem.length <= 4) return name
  return extension ? `${stem.slice(0, 4)}….${extension}` : `${stem.slice(0, 4)}…`
}

function previewPendingImages(file: OfficePendingFile) {
  if (!file.localUrl) return
  const urls = pendingImages.value
    .filter(item => item.localUrl)
    .map(item => ({ url: item.localUrl, title: item.name }))
  emit('preview-images', { urls, current: file.localUrl })
}

async function submit() {
  if (!canSubmit.value) return
  const voiceId = voiceSessionId
  const accepted = await store.sendOfficeText(text.value, voiceId || undefined)
  if (accepted) {
    text.value = ''
    voiceSessionId = ''
    await nextTick()
    if (textareaRef.value) textareaRef.value.style.height = 'auto'
    multiLine.value = false
  }
}

// ─── 语音输入（桌面化适配：点击开始/结束，60s 上限，文本回填输入框） ────

function clearVoiceTimers() {
  if (durationTimer !== undefined) window.clearInterval(durationTimer)
  if (recordingLimitTimer !== undefined) window.clearTimeout(recordingLimitTimer)
  durationTimer = undefined
  recordingLimitTimer = undefined
}

async function toggleVoice() {
  if (voiceState.value === 'recording') await stopVoiceRecording()
  else if (voiceState.value === 'idle') await startVoiceRecording()
}

async function startVoiceRecording() {
  if (voiceState.value !== 'idle' || !voiceSupported) return
  voiceBaseText = text.value.trim()
  const nextTranscriber = new VoiceTranscriber()
  transcriber = nextTranscriber
  try {
    await nextTranscriber.start({ onAmplitude: onRecordingAmplitude })
    voiceState.value = 'recording'
    recordingSeconds.value = 0
    startWaveTicker()
    durationTimer = window.setInterval(() => { recordingSeconds.value += 1 }, 1000)
    recordingLimitTimer = window.setTimeout(() => {
      if (voiceState.value === 'recording') void stopVoiceRecording(true)
    }, 60_000)
  } catch (error) {
    await nextTranscriber.cancel()
    transcriber = undefined
    ElMessage.error(error instanceof Error ? error.message : '无法启动麦克风')
  }
}

async function stopVoiceRecording(reachedLimit = false) {
  if (voiceState.value !== 'recording' || !transcriber) return
  clearVoiceTimers()
  stopWaveTicker()
  const activeTranscriber = transcriber
  transcriber = undefined
  voiceState.value = 'transcribing'
  try {
    const result = await activeTranscriber.stop()
    if (result.sessionId) voiceSessionId = result.sessionId
    text.value = [voiceBaseText, result.text].filter(Boolean).join(' ').slice(0, 2000)
    await nextTick(autoGrow)
    if (reachedLimit) ElMessage.success('已达到60秒上限，识别结果已填入输入框')
  } catch (error) {
    await activeTranscriber.cancel()
    ElMessage.error(error instanceof Error ? error.message : '语音识别失败，请稍后重试')
  } finally {
    voiceState.value = 'idle'
  }
}

onBeforeUnmount(() => {
  clearVoiceTimers()
  stopWaveTicker()
  if (transcriber) void transcriber.cancel()
  transcriber = undefined
})
</script>

<style scoped>
.office-composer {
  padding: 6px 12px 8px;
  border-top: 1px solid #e8eaed;
  background: #ffffff;
}

/* 待发送图片缩略图行 */
.pending-images {
  display: flex;
  gap: 9px;
  margin-bottom: 7px;
  overflow-x: auto;
  padding: 2px;
  scrollbar-width: thin;
}
.pending-thumb {
  position: relative;
  flex: 0 0 auto;
  width: 64px;
  height: 64px;
  padding: 0;
  border: 1px solid #e8eaed;
  border-radius: 10px;
  background: #f2f3f5;
  overflow: hidden;
  cursor: pointer;
}
.pending-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb-uploading {
  position: absolute;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgb(0 0 0 / 45%);
}
.thumb-uploading i {
  width: 11px;
  height: 11px;
  border: 1.5px solid rgb(255 255 255 / 30%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: thumb-spin 0.8s linear infinite;
}
@keyframes thumb-spin { to { transform: rotate(360deg); } }
.thumb-remove {
  position: absolute;
  top: 3px;
  right: 3px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid #d9dde3;
  border-radius: 50%;
  background: #ffffff;
  color: #3c4043;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}
.thumb-remove:hover { background: #f1f3f4; }

/* 待发送文档 */
.pending-doc-row {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 7px;
}
.pending-doc {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 70%;
  padding: 6px 4px 6px 10px;
  border: 1px solid #e8eaed;
  border-radius: 10px;
  background: #ffffff;
  color: #1f2329;
  font-size: 13px;
}
.pending-doc svg { width: 22px; height: 22px; color: #e53935; flex: 0 0 auto; }
.pending-doc-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pending-doc-remove {
  display: grid;
  place-items: center;
  padding: 2px 6px;
  border-radius: 50%;
  color: #626a73;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.pending-doc-remove:hover { background: #f1f3f4; }
.pending-doc-hint { color: #9aa1a9; font-size: 11px; white-space: nowrap; }

/* 语音转写提示 */
.voice-converting {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
  padding: 0 8px;
  color: #626a73;
  font-size: 12px;
}
.converting-spinner {
  width: 13px;
  height: 13px;
  border: 1.5px solid #f5d4d2;
  border-top-color: #e53935;
  border-radius: 50%;
  animation: thumb-spin 0.8s linear infinite;
}

.file-input { display: none; }

/* 输入条 */
.input-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px;
  border: 1px solid #e8eaed;
  border-radius: 24px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgb(31 35 41 / 8%);
  transition: border-radius 0.18s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}
.input-bar.is-multi-line {
  align-items: flex-start;
  border-radius: 12px;
}
.input-bar:focus-within { border-color: #f0b6b4; }
.input-bar.is-recording {
  border-color: #e53935;
  background: linear-gradient(180deg, #fffafa 0%, #ffffff 70%);
  box-shadow: 0 0 0 3px rgb(229 57 53 / 14%), 0 6px 18px rgb(229 57 53 / 10%);
  animation: rec-bar-glow 1.8s ease-in-out infinite;
}
@keyframes rec-bar-glow {
  0%, 100% { box-shadow: 0 0 0 3px rgb(229 57 53 / 14%), 0 6px 18px rgb(229 57 53 / 10%); }
  50% { box-shadow: 0 0 0 4px rgb(229 57 53 / 20%), 0 6px 22px rgb(229 57 53 / 14%); }
}
textarea {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 32px;
  max-height: 132px;
  padding: 6px 9px;
  border: 0;
  background: transparent;
  color: #1f2329;
  font: 14px/21px inherit;
  resize: none;
  outline: 0;
}
textarea::placeholder { color: #9aa1a9; font-size: 13px; }
textarea:disabled { color: #9aa1a9; }

/* 录音态字段：占据输入框位置，声波 + 计时器 */
.recording-field {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 32px;
  padding: 0 6px;
}
.recording-label {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #b71c1c;
  font-size: 13px;
  font-weight: 650;
  white-space: nowrap;
}
.recording-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e53935;
  animation: rec-dot-blink 1s ease-in-out infinite;
}
@keyframes rec-dot-blink {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.8); }
}
.recording-wave {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 3px;
  height: 26px;
  overflow: hidden;
}
.recording-wave i {
  flex: 1 0 2px;
  min-height: 4px;
  border-radius: 99px;
  background: linear-gradient(180deg, #ff7043 0%, #e53935 100%);
  transition: height 0.1s linear;
}
.recording-timer {
  flex: 0 0 auto;
  color: #b71c1c;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.recording-hint {
  flex: 0 0 auto;
  color: #9aa1a9;
  font-size: 11px;
  white-space: nowrap;
}
.recording-hint strong { color: #e53935; font-size: 12px; }

/* 圆形小按钮（发送 / 语音 / 附件 / 停止） */
.chip {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #f3f4f6;
  color: #626a73;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, opacity 0.18s, transform 0.18s;
}
.chip svg { width: 18px; height: 18px; fill: none; stroke: currentColor; }
.chip:not(:disabled):hover { background: #e9ebef; }
.chip:disabled { opacity: 0.45; cursor: not-allowed; }
.chip.is-attach:not(:disabled) { color: #626a73; }
.chip.is-send {
  background: #c9cdd2;
  color: #ffffff;
  font-size: 16px;
}
.chip.is-send.is-ready {
  background: #1f2329;
}
.chip.is-send.is-ready:not(:disabled):hover { filter: brightness(1.25); }
.input-bar.is-multi-line .chip.is-send { margin-top: 2px; margin-right: 2px; }

/* 录音中的停止按钮：红色实心 + 白色方块 */
.chip.is-stop {
  background: #e53935;
  color: #ffffff;
  animation: stop-btn-pulse 1.6s ease-in-out infinite;
}
.chip.is-stop:hover { background: #d32f2f; transform: scale(1.06); }
@keyframes stop-btn-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgb(229 57 53 / 45%); }
  70% { box-shadow: 0 0 0 7px rgb(229 57 53 / 0%); }
  100% { box-shadow: 0 0 0 0 rgb(229 57 53 / 0%); }
}
.stop-icon {
  width: 12px;
  height: 12px;
  border-radius: 2.5px;
  background: #ffffff;
}

.composer-disclaimer {
  margin: 3px 0 0;
  color: #9aa1a9;
  font-size: 10px;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .thumb-uploading i,
  .converting-spinner,
  .recording-dot,
  .chip.is-stop,
  .input-bar.is-recording { animation: none !important; }
  .recording-wave i { transition: none !important; }
}
</style>

<style scoped>
.web-search-toggle { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--el-text-color-regular); padding: 0 12px 6px; }
</style>
