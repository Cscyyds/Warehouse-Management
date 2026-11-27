import { safeErrorText } from './serverErrorDisplay.ts'
import { createVNode, render, type AppContext } from 'vue'
import WmsErrorDialog from '@/components/feedback/WmsErrorDialog.vue'
import WmsConfirmDialog from '@/components/feedback/WmsConfirmDialog.vue'
import { buildErrorDialogContent, type ErrorDialogOptions } from './errorDialogModel'
import type { ActionDialogOptions, DialogMessage, DialogResult } from './dialogModel'

let appContext: AppContext | undefined

export function setErrorDialogAppContext(context: AppContext): void {
  appContext = context
}

/** Each call opens its own modal. No queue, grouping or deduplication. */
export function showErrorDialog(input: unknown, options?: ErrorDialogOptions): void {
  const container = document.createElement('div')
  const vnode = createVNode(WmsErrorDialog, {
    content: buildErrorDialogContent(input, options),
    onClosed: () => {
      render(null, container)
      container.remove()
    },
  })
  if (appContext) vnode.appContext = appContext
  document.body.appendChild(container)
  render(vnode, container)
}

export interface ConfirmDialogOptions {
  title?: string
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
}

/** Cancel, Escape and close all resolve false; only an explicit confirmation resolves true. */
export function showConfirmDialog(message: string, options: ConfirmDialogOptions = {}): Promise<boolean> {
  return openActionDialog(message, {
    title: options.title || '操作确认', confirmButtonText: options.confirmText || '确认',
    cancelButtonText: options.cancelText || '取消', showCancelButton: options.showCancel,
    closeOnClickModal: false, focusConfirm: false,
  }).then(result => result.action === 'confirm')
}

export function openActionDialog(message: DialogMessage, options: ActionDialogOptions): Promise<DialogResult> {
  if (typeof message === 'string') message = safeErrorText(message)
  return new Promise(resolve => {
    const container = document.createElement('div')
    const vnode = createVNode(WmsConfirmDialog, {
      message,
      options,
      onClosed: (result: DialogResult) => {
        render(null, container)
        container.remove()
        resolve(result)
      },
    })
    if (appContext) vnode.appContext = appContext
    document.body.appendChild(container)
    render(vnode, container)
  })
}

export async function showInfoDialog(message: string, options: Omit<ConfirmDialogOptions, 'showCancel'> = {}): Promise<void> {
  await showConfirmDialog(message, { title: '提示', confirmText: '知道了', ...options, showCancel: false })
}
