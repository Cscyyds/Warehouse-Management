import { safeErrorText } from './serverErrorDisplay.ts'
import type { CSSProperties, VNode } from 'vue'

export type DialogMessage = string | VNode | (() => VNode)
export type DialogAction = 'confirm' | 'cancel' | 'close'
export interface DialogResult { action: DialogAction; value: string }
export interface ActionDialogOptions {
  title?: string
  type?: string
  confirmButtonText?: string
  cancelButtonText?: string
  confirmButtonClass?: string
  customClass?: string
  customStyle?: CSSProperties
  center?: boolean
  showCancelButton?: boolean
  showConfirmButton?: boolean
  showClose?: boolean
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
  distinguishCancelAndClose?: boolean
  autofocus?: boolean
  focusConfirm?: boolean
  showInput?: boolean
  inputValue?: string
  inputPlaceholder?: string
  inputType?: string
  inputPattern?: RegExp
  inputErrorMessage?: string
  inputValidator?: (value: string) => boolean | string | void | Promise<boolean | string | void>
}

export async function validatePromptInput(value: string, options: ActionDialogOptions): Promise<string> {
  const fallback = safeErrorText(options.inputErrorMessage || '输入内容不符合要求')
  if (options.inputPattern && !new RegExp(options.inputPattern.source, options.inputPattern.flags).test(value)) return fallback
  if (options.inputValidator) {
    try {
      const result = await options.inputValidator(value)
      if (typeof result === 'string') return safeErrorText(result || fallback)
      if (result === false) return fallback
    } catch { return fallback }
  }
  return ''
}
