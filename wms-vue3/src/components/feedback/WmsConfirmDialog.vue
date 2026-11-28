<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref } from 'vue'
import { ElDialog } from 'element-plus'
import { validatePromptInput, type ActionDialogOptions, type DialogAction, type DialogMessage, type DialogResult } from '@/utils/dialogModel'

const props = defineProps<{ message: DialogMessage; options: ActionDialogOptions }>()
defineEmits<{ closed: [result: DialogResult] }>()
const visible = ref(true)
const action = ref<DialogAction>('close')
const inputValue = ref(props.options.inputValue ?? '')
const submittedValue = ref(inputValue.value)
const error = ref('')
const validating = ref(false)
const field = ref<HTMLInputElement>()
const inputErrorId = `wms-dialog-validation-${getCurrentInstance()!.uid}`
const showCancel = computed(() => props.options.showCancelButton !== false)
const showConfirm = computed(() => props.options.showConfirmButton !== false)
const title = computed(() => props.options.title ?? '提示')

function MessageBody() {
  return typeof props.message === 'function' ? props.message() : props.message
}

function cancel() {
  if (!visible.value) return
  action.value = 'cancel'
  visible.value = false
}

async function validateField() {
  const value = inputValue.value
  const reason = await validatePromptInput(value, props.options)
  if (visible.value && inputValue.value === value) error.value = reason
}

async function submit() {
  if (validating.value || !visible.value) return
  const value = inputValue.value
  validating.value = true
  try {
    const reason = props.options.showInput ? await validatePromptInput(value, props.options) : ''
    if (!visible.value || inputValue.value !== value) return
    error.value = reason
    if (reason) {
      await nextTick()
      field.value?.focus()
      return
    }
    submittedValue.value = value
    action.value = 'confirm'
    visible.value = false
  } finally { validating.value = false }
}

function onEnter(event: KeyboardEvent) {
  if (!event.isComposing && showConfirm.value) {
    event.preventDefault()
    void submit()
  }
}
</script>

<template>
  <ElDialog v-model="visible" class="wms-error-dialog wms-confirm-dialog" :class="options.customClass"
    modal-class="wms-error-overlay" :style="options.customStyle" width="520px" align-center append-to-body
    :close-on-click-modal="options.closeOnClickModal ?? false" :close-on-press-escape="options.closeOnPressEscape ?? true"
    :show-close="false" :title="title" @closed="$emit('closed', { action, value: submittedValue })">
    <template #header="{ titleId, titleClass }">
      <div class="wms-error-heading">
        <span class="wms-error-mark" aria-hidden="true">{{ showCancel ? '?' : 'i' }}</span>
        <h2 :id="titleId" :class="titleClass">{{ title }}</h2>
        <button v-if="options.showClose !== false" type="button" class="wms-error-close" aria-label="关闭提示窗口" @click="visible = false">×</button>
      </div>
    </template>
    <div class="wms-error-content"><MessageBody /></div>
    <div v-if="options.showInput" class="wms-dialog-field">
      <label class="wms-dialog-field-label">
        <span class="wms-dialog-sr-only">{{ title }}</span>
        <input ref="field" v-model="inputValue" :type="options.inputType || 'text'" :placeholder="options.inputPlaceholder"
          :autofocus="options.autofocus !== false" :aria-invalid="!!error" :aria-describedby="error ? inputErrorId : undefined"
          @input="error = ''" @blur="validateField" @keydown.enter="onEnter">
      </label>
      <p v-if="error" :id="inputErrorId" class="wms-dialog-validation" role="alert">{{ error }}</p>
    </div>
    <template #footer>
      <div class="wms-error-actions">
        <button v-if="showCancel" type="button" :autofocus="!options.showInput && options.autofocus !== false && !options.focusConfirm" @click="cancel">{{ options.cancelButtonText || '取消' }}</button>
        <button v-if="showConfirm" type="button" class="wms-error-confirm" :disabled="validating" :aria-busy="validating"
          :autofocus="!options.showInput && options.autofocus !== false && (!!options.focusConfirm || !showCancel)" @click="submit">{{ options.confirmButtonText || '确定' }}</button>
      </div>
    </template>
  </ElDialog>
</template>

<style>
.wms-dialog-field { margin-top: 16px; }
.wms-dialog-field-label { display: block; }
.wms-dialog-field input {
  display: block; width: 100%; box-sizing: border-box; padding: 10px 12px;
  border: 1px solid var(--error-ink); border-radius: var(--radius-sm, 8px);
  background: var(--error-surface); color: var(--error-ink); font: inherit; font-size: 16px; line-height: 1.5;
}
.wms-dialog-field input::placeholder { color: var(--error-ink); opacity: .65; }
.wms-dialog-field input:focus-visible { outline: 2px solid var(--error-accent); outline-offset: 2px; }
.wms-dialog-field input[aria-invalid="true"] { border-color: var(--error-accent); }
.wms-dialog-validation { margin: 8px 0 0; padding-left: 8px; border-left: 2px solid var(--error-accent); color: var(--error-ink); font-size: 14px; }
.wms-dialog-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.wms-confirm-dialog .wms-error-content * { color: inherit !important; }
.wms-confirm-dialog .wms-error-confirm:disabled { cursor: wait; }
</style>
