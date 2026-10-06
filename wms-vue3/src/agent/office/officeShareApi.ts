import type { OfficeChatMessage } from '@/agent/types'
import { stripOfficeAlbumPrefix } from '@/agent/office/officeChatApi'

// 挂在 /api/v1/coze 前缀下：由 Coze_Connect 服务承载（对话数据与分享同源），
// vite/nginx 中已有的 coze 代理规则直接复用，无需新增转发。
const SHARE_CREATE_PATH = '/api/v1/coze/chat/shares'

/** 提交给后端的分享快照消息（只保留展示所需字段，与直出页渲染一一对应）。 */
export interface ShareMessagePayload {
  id: string
  role: 'user' | 'assistant'
  content: string
  images: Array<{ url: string; title: string }>
  attachments: Array<{ name: string }>
}

interface ResolvedImage { url: string; title: string }

/**
 * 从助手 payload.images 中解析可展示的图片列表。
 * Coze 返回结构不稳定（picture_message 嵌套 / 平铺 / 纯字符串均出现过），
 * 这里按候选字段逐一兜底，与历史消息回放共用同一解析口径。
 */
export function resolveOfficeImages(images?: unknown[]): ResolvedImage[] {
  if (!Array.isArray(images)) return []
  const seen = new Set<string>()
  const result: ResolvedImage[] = []
  images.forEach((value) => {
    const image = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    const picture = image.picture_message && typeof image.picture_message === 'object'
      ? image.picture_message as Record<string, unknown>
      : {}
    const candidates = typeof value === 'string' ? [value] : [
      image.picture_url, image.pictureUrl, image.image_url, image.imageUrl, image.url,
      picture.picture_url, picture.pictureUrl, picture.image_url, picture.imageUrl, picture.url,
    ]
    const url = candidates.map(item => String(item || '').trim()).find(item => /^https?:\/\//i.test(item))
    if (!url || seen.has(url)) return
    seen.add(url)
    result.push({ url, title: String(image.title || picture.title || 'AI 返回图片') })
  })
  return result
}

/** 单条消息 → 分享快照；流式未完成的消息由调用方先行过滤。 */
export function toShareMessage(message: OfficeChatMessage): ShareMessagePayload {
  return {
    id: message.id,
    role: message.role,
    content: message.role === 'user' ? stripOfficeAlbumPrefix(message.content) : message.content,
    images: resolveOfficeImages(message.payload?.images)
      .filter(image => image.url.startsWith('https://'))
      .map(image => ({ url: image.url, title: image.title.slice(0, 100) })),
    attachments: message.attachments
      .filter(attachment => attachment.type !== 'audio/voice')
      .map(attachment => ({ name: attachment.name || '附件' })),
  }
}

function authHeaders(): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  const token = localStorage.getItem('token')?.trim()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

/** 创建分享：返回公开链接（免登，任何拿到链接的人可查看）。 */
export async function createAgentShare(input: {
  sessionId: string
  title: string
  messages: ShareMessagePayload[]
}): Promise<{ shareKey: string; shareUrl: string }> {
  const response = await fetch(SHARE_CREATE_PATH, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      sessionId: input.sessionId,
      title: input.title,
      messages: input.messages,
    }),
  })
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // 保持 body 为 null，走下方统一错误提示。
  }
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  if (!response.ok) {
    throw new Error(String(record.detail || record.message || `分享创建失败（HTTP ${response.status}）`))
  }
  // Coze_Connect 返回裸 dict（{shareKey, shareUrl}），兼容 nuomi_wms 风格的 {success, data} 包装。
  const data = (record.data && typeof record.data === 'object' ? record.data : record) as Record<string, unknown>
  const shareKey = String(data.shareKey || '')
  const shareUrl = String(data.shareUrl || '')
  if (!shareUrl) throw new Error(String(record.message || '分享创建失败：接口未返回链接'))
  return { shareKey, shareUrl }
}

/** 复制到剪贴板：优先 Clipboard API，HTTP 环境降级 execCommand。 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
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
