/**
 * 复制文本到剪贴板：优先 Clipboard API，非安全上下文（HTTP 内网）降级 execCommand。
 * 统一放在 utils 下，供对话气泡复制、分享链接复制等场景共用。
 */
export async function copyText(text: string): Promise<boolean> {
  const value = text ?? ''
  if (!value) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const ok = document.execCommand('copy')
      textarea.remove()
      return ok
    } catch {
      return false
    }
  }
}