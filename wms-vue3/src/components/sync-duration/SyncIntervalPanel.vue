<template>
  <section class="panel interval-panel" :aria-labelledby="titleId">
    <div class="panel-heading">
      <span class="panel-icon"><el-icon><Timer /></el-icon></span>
      <h3 :id="titleId">自动同步间隔</h3>
    </div>

    <div class="interval-readout">
      <p>当前生效间隔</p>
      <div class="interval-display">
        <span class="interval-announcement" aria-live="polite" aria-atomic="true">
          {{ currentInterval != null ? `当前生效间隔 ${formatDuration(currentInterval)}` : '当前生效间隔暂无数据' }}
        </span>
        <div class="interval-value" aria-hidden="true">
          <template v-if="currentInterval != null">
            <span v-for="{ unit, digits } in intervalReadout" :key="unit" class="interval-part">
              <strong class="interval-digits">
                <span v-for="(digit, index) in digits" :key="digits.length - index" class="interval-digit">
                  <Transition :name="intervalRoll" :css="intervalRoll != null">
                    <span v-if="digit !== ' '" :key="digit" class="interval-glyph">{{ digit }}</span>
                  </Transition>
                </span>
              </strong>
              <span class="interval-unit">{{ unit }}</span>
            </span>
          </template>
          <strong v-else>—</strong>
        </div>
      </div>
    </div>

    <div v-if="currentInterval != null && canManage" class="interval-editor">
      <p class="field-label">设置同步间隔</p>
      <div class="interval-controls">
        <div v-if="presets.length" class="interval-presets" role="group" aria-label="常用同步间隔">
          <button
            v-for="seconds in presets"
            :key="seconds"
            class="interval-preset"
            type="button"
            :aria-pressed="intervalSeconds === seconds"
            :disabled="saving || loading"
            @click="intervalSeconds = seconds"
          >{{ seconds / 60 }} 分钟</button>
        </div>
        <div class="interval-picker">
          <SyncDurationPicker
            v-model="intervalSeconds"
            :min="intervalBounds.min"
            :max="intervalBounds.max"
            :disabled="saving || loading"
          />
        </div>
      </div>
      <p class="field-note">保存后，扫描器会在 60 秒内按新间隔判定，无需重启。</p>
    </div>
    <p v-else-if="currentInterval != null" class="field-note">当前账户仅可查看同步间隔。</p>
    <div v-else-if="!loading" class="load-error">
      <p>同步设置加载失败。</p>
      <el-button size="small" @click="emit('reload')">重新加载</el-button>
    </div>

    <div v-if="currentInterval != null && canManage" class="panel-footer">
      <span class="save-status" :class="{ 'is-dirty': isDirty }" role="status">
        <span class="status-dot" aria-hidden="true"></span>{{ isDirty ? '有未保存的更改' : '设置已保存' }}
      </span>
      <div class="settings-actions">
        <el-button :disabled="!isDirty || saving || loading" @click="emit('reset')">重置</el-button>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="!isDirty || loading"
          @click="emit('save')"
        >保存更改</el-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { Timer } from '@element-plus/icons-vue'
import SyncDurationPicker from './SyncDurationPicker.vue'
import { formatDuration } from './format'

const props = defineProps<{
  currentInterval?: number
  intervalBounds: { min: number; max: number }
  canManage: boolean
  loading: boolean
  saving: boolean
  isDirty: boolean
}>()
const intervalSeconds = defineModel<number>()
const emit = defineEmits<{ reload: []; reset: []; save: [] }>()
const titleId = useId()
const intervalRoll = ref<'interval-roll-up' | 'interval-roll-down'>()

watch(() => props.currentInterval, (current, previous) => {
  intervalRoll.value = current == null || previous == null
    ? undefined
    : current > previous ? 'interval-roll-up' : 'interval-roll-down'
})

const intervalReadout = computed(() => {
  const total = props.currentInterval ?? 0
  // Reserve places for the allowed maximum so unchanged digits stay aligned.
  const minutePlaces = String(Math.floor(props.intervalBounds.max / 60)).length
  return [
    { unit: '分', digits: String(Math.floor(total / 60)).padStart(minutePlaces, ' ') },
    { unit: '秒', digits: String(total % 60).padStart(2, '0') },
  ]
})
const presets = computed(() => [300, 600, 1800].filter(
  seconds => seconds >= props.intervalBounds.min && seconds <= props.intervalBounds.max,
))
</script>

<style scoped>
.interval-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.interval-panel .panel-icon {
  background: var(--primary-bg);
  color: var(--sync-accent);
}

.interval-readout {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: grid;
  align-content: center;
  gap: 8px;
  min-height: 146px;
  box-sizing: border-box;
  padding: 20px clamp(14px, 2.2vw, 24px);
  border: 1px solid var(--primary-border);
  border-radius: var(--radius-md);
  background: linear-gradient(110deg, var(--readout-start) 28%, var(--readout-end));
  color: var(--readout-value);
}

.interval-readout::after {
  position: absolute;
  z-index: -1;
  inset: 0 0 0 46%;
  background:
    repeating-linear-gradient(90deg, transparent 0 31px, color-mix(in srgb, var(--sync-accent) 31%, transparent) 31px 32px)
    left bottom / 100% 43px no-repeat,
    repeating-linear-gradient(90deg, transparent 0 7px, color-mix(in srgb, var(--sync-accent) 18%, transparent) 7px 8px)
    left bottom / 100% 19px no-repeat;
  mask-image: linear-gradient(90deg, transparent, #000 65%);
  content: '';
  pointer-events: none;
}

.interval-readout p {
  margin: 0;
  font-size: 13px;
  color: var(--sync-muted);
}

.interval-display {
  --interval-roll-distance: 105%;
  --interval-roll-duration: 540ms;
  position: relative;
  overflow: hidden;
}

.interval-announcement {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.interval-value {
  display: flex;
  flex-wrap: wrap;
  /* Leading empty digit slots can give minutes a different text baseline. */
  align-items: flex-end;
  gap: 4px 16px;
  line-height: 1;
}

.interval-roll-up-leave-active, .interval-roll-down-leave-active {
  position: absolute;
  inset: 0 0 auto;
}

.interval-roll-up-enter-active, .interval-roll-up-leave-active,
.interval-roll-down-enter-active, .interval-roll-down-leave-active {
  transition:
    transform var(--interval-roll-duration) cubic-bezier(.45, .05, .35, 1),
    opacity var(--interval-roll-duration) ease-in-out;
}

.interval-roll-up-enter-from, .interval-roll-down-leave-to {
  transform: translateY(var(--interval-roll-distance));
  opacity: 0;
}

.interval-roll-down-enter-from, .interval-roll-up-leave-to {
  transform: translateY(calc(-1 * var(--interval-roll-distance)));
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .interval-display {
    --interval-roll-distance: 18px;
    --interval-roll-duration: 280ms;
  }
}

.interval-part {
  display: inline-flex;
  align-items: flex-end;
  gap: 5px;
}

.interval-value strong {
  font: 600 clamp(36px, 5cqw, 60px)/1 var(--sync-mono);
}

.interval-digits {
  display: inline-flex;
}

.interval-digit {
  position: relative;
  display: grid;
  justify-items: center;
  overflow: hidden;
  inline-size: 1ch;
  block-size: 1em;
}

.interval-glyph {
  text-align: center;
}

.interval-unit {
  padding-bottom: .2em;
  font-size: 14px;
  color: var(--sync-muted);
}

.field-label {
  margin: 0 0 8px;
  color: var(--sync-muted);
  font-size: 12px;
}

.interval-controls, .interval-presets, .settings-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.interval-preset {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs);
  background: var(--bg-white);
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.interval-preset[aria-pressed="true"], .interval-preset:hover:not(:disabled) {
  border-color: var(--primary-border);
  background: var(--primary-bg);
  color: var(--sync-accent);
}

.interval-preset:focus-visible {
  outline: 2px solid var(--sync-accent);
  outline-offset: 2px;
}

.interval-preset:disabled { opacity: .6; cursor: default; }
.interval-picker { flex: 0 1 166px; min-width: 0; }
.interval-picker :deep(.duration-trigger) { height: 34px; }
.field-note { margin: 8px 0 0; color: var(--sync-muted); font-size: 12px; line-height: 1.65; }
.load-error { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 13px; }
.load-error p { margin: 0; }

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--border-color);
}

.settings-actions .el-button + .el-button { margin-left: 0; }

.save-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--sync-muted);
  font-size: 12px;
}

.save-status.is-dirty { color: var(--sync-warning); }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
</style>
