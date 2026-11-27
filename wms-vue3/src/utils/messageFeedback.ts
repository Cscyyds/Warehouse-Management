import { safeErrorText } from './serverErrorDisplay.ts'
import { ElMessage } from 'element-plus'

export type FeedbackMessageType = 'success' | 'warning' | 'info'

/** Shared bubble styling is supplied by styles/messageFeedback.scss. */
export function showMessage(message: string, type: FeedbackMessageType = 'info', duration?: number): void {
  ElMessage({
    message: safeErrorText(message), type, showClose: true,
    // Avoid EP's default 3000, which ConfigProvider replaces with the app's 1500.
    // Longer feedback needs time to read; hover pauses Element Plus's timer.
    duration: duration ?? Math.min(8000, Math.max(3200, message.length * 100)),
  })
}
