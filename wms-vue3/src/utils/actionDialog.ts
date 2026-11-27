import { openActionDialog } from './errorFeedback'
import type { ActionDialogOptions, DialogMessage, DialogResult } from './dialogModel'

function optionsFor(title?: string | ActionDialogOptions, options: ActionDialogOptions = {}): ActionDialogOptions {
  return { title: '提示', closeOnClickModal: true, focusConfirm: true,
    ...(typeof title === 'object' ? title : { ...options, title: title ?? '提示' }) }
}

function requireConfirmation(result: DialogResult, options: ActionDialogOptions): void {
  if (result.action !== 'confirm') {
    // Keep the original catch branches, including the unsaved-draft close/cancel distinction.
    throw result.action === 'close' && options.distinguishCancelAndClose ? 'close' : 'cancel'
  }
}

export async function confirmAction(message: DialogMessage, title?: string | ActionDialogOptions, options?: ActionDialogOptions): Promise<'confirm'> {
  const config = optionsFor(title, options)
  const result = await openActionDialog(message, config)
  requireConfirmation(result, config)
  return 'confirm'
}

export async function promptAction(message: DialogMessage, title?: string | ActionDialogOptions, options?: ActionDialogOptions): Promise<{ value: string; action: 'confirm' }> {
  const config = { ...optionsFor(title, options), showInput: true }
  const result = await openActionDialog(message, config)
  requireConfirmation(result, config)
  return { value: result.value, action: 'confirm' }
}
