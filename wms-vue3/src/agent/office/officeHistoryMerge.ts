/**
 * 历史合并 / 断流恢复（app ChatHistoryMerge.kt + ChatRecovery.kt 的 TS 移植）。
 *
 * 历史 API 只有正文和选项：对齐同一条消息后保留本机已有的附件、图片详情；
 * 断流后通过轮询 /api/history 找回后台已生成的回复，期间本地未完成的轮次保持可见。
 */
import type { OfficeChatMessage } from '@/agent/types'

/** 只识别与本机附件名称完全一致的服务端追加标记，避免误删用户自己输入的文字。 */
export function hasMatchingAttachmentSuffix(remote: OfficeChatMessage, local: OfficeChatMessage): boolean {
  if (remote.role !== 'user' || !remote.content.startsWith(local.content)) return false
  const names = [
    ...(local.payload.file ? [local.payload.file.name] : []),
    ...local.payload.files.map(file => file.name),
  ]
  if (!names.length || names.some(name => !name)) return false
  const suffix = remote.content.slice(local.content.length).trim()
  const markers = [...suffix.matchAll(/\[附件[:：]\s*([^\]]+)\]/g)]
  if (!markers.length) return false
  let cursor = 0
  for (const marker of markers) {
    const start = marker.index ?? 0
    if (suffix.slice(cursor, start).trim()) return false
    cursor = start + marker[0].length
  }
  if (suffix.slice(cursor).trim()) return false
  const values = markers.map(marker => marker[1].trim())
  const joinedMatches = values.length === 1
    && [', ', ',', '，'].some(sep => values[0] === names.join(sep))
  return (values.length === names.length && values.every((value, index) => value === names[index]))
    || joinedMatches
}

function payloadIsBlank(message: OfficeChatMessage): boolean {
  return !message.payload.statusSteps.length
    && !message.payload.images.length
    && !message.payload.file
    && !message.payload.files.length
}

/** 历史 API 只有正文和选项：对齐同一条消息后保留本机已有的附件、图片和结构化卡片。 */
export function retainCachedMessageDetails(
  remote: OfficeChatMessage[],
  cached: OfficeChatMessage[],
): OfficeChatMessage[] {
  let before = cached.length
  const merged = [...remote].reverse().map((message) => {
    let index = -1
    for (let cursor = before - 1; cursor >= 0; cursor -= 1) {
      const local = cached[cursor]
      const contentMatches = local.content === message.content
        || hasMatchingAttachmentSuffix(message, local)
      if (local.role === message.role && contentMatches
        && Math.abs(local.createdAt - message.createdAt) <= 60_000) {
        index = cursor
        break
      }
    }
    if (index < 0) return message
    before = index
    const local = cached[index]
    return {
      ...message,
      content: hasMatchingAttachmentSuffix(message, local) ? local.content : message.content,
      payload: payloadIsBlank(message)
        ? local.payload
        : { ...message.payload, files: message.payload.files.length ? message.payload.files : local.payload.files },
      options: message.options.length ? message.options : local.options,
    }
  })
  return merged.reverse()
}

function pendingUserIndex(
  history: OfficeChatMessage[],
  user: OfficeChatMessage,
  previous: OfficeChatMessage[],
): number {
  const previousIds = new Set(previous.map(item => item.id))
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index]
    if (previousIds.has(item.id)) continue
    if (item.role !== 'user' || item.sessionId !== user.sessionId) continue
    if (item.createdAt < user.createdAt - 60_000) continue
    if (item.content === user.content || hasMatchingAttachmentSuffix(item, user)) return index
  }
  return -1
}

/** Only a reply following this user turn can complete a disconnected request. */
export function recoveredReply(
  history: OfficeChatMessage[],
  user: OfficeChatMessage,
  previous: OfficeChatMessage[] = [],
): OfficeChatMessage | null {
  const index = pendingUserIndex(history, user, previous)
  if (index < 0) return null
  let reply: OfficeChatMessage | null = null
  for (let cursor = index + 1; cursor < history.length; cursor += 1) {
    const item = history[cursor]
    if (item.role === 'user') break
    if (item.role === 'assistant') reply = item
  }
  return reply
}

/** Refresh earlier server messages while keeping the in-flight turn visible until it is saved. */
export function mergeRecoveringHistory(
  remote: OfficeChatMessage[],
  cached: OfficeChatMessage[],
  user: OfficeChatMessage,
  previous: OfficeChatMessage[],
): OfficeChatMessage[] {
  if (!remote.length) return cached
  const history = [...retainCachedMessageDetails(remote, cached)]
  const remoteUser = pendingUserIndex(remote, user, previous)
  if (remoteUser >= 0) {
    history[remoteUser] = { ...history[remoteUser], content: user.content, payload: user.payload }
  }
  if (recoveredReply(remote, user, previous)) return history
  const localUser = cached.findIndex(item => item.id === user.id)
  const pending: OfficeChatMessage[] = [user]
  if (localUser >= 0) {
    for (let cursor = localUser + 1; cursor < cached.length; cursor += 1) {
      if (cached[cursor].role === 'user') break
      pending.push(cached[cursor])
    }
  }
  if (remoteUser >= 0) {
    return [...history.slice(0, remoteUser), ...pending, ...history.slice(remoteUser + 1)]
  }
  return [...history, ...pending]
}
