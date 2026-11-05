import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasMatchingAttachmentSuffix,
  mergeRecoveringHistory,
  recoveredReply,
  retainCachedMessageDetails,
} from './officeHistoryMerge.ts'

function message(overrides) {
  return {
    id: `m${Math.random().toString(36).slice(2, 8)}`,
    sessionId: 'app-s1',
    role: 'user',
    content: '查库存',
    options: [],
    payload: { statusSteps: [], images: [], files: [] },
    status: 'success',
    createdAt: Date.now(),
    ...overrides,
  }
}

function emptyPayload() {
  return { statusSteps: [], images: [], files: [] }
}

// ─── 附件后缀识别 ───────────────────────────────────────────────────────

test('hasMatchingAttachmentSuffix 只认与本机附件名一致的追加标记', () => {
  const local = message({
    payload: { statusSteps: [], images: [], files: [], file: { name: '销售.xlsx', url: 'https://b/x.xlsx', isImage: false, abbreviation: 'XLSX' } },
  })
  assert.equal(hasMatchingAttachmentSuffix(message({ content: '查库存[附件：销售.xlsx]' }), local), true)
  assert.equal(hasMatchingAttachmentSuffix(message({ content: '查库存 [附件:销售.xlsx]' }), local), true)
  // 多附件逗号连接
  const multiLocal = message({
    payload: {
      statusSteps: [], images: [], file: undefined,
      files: [
        { name: 'a.png', url: 'u1', isImage: true, abbreviation: 'PNG' },
        { name: 'b.png', url: 'u2', isImage: true, abbreviation: 'PNG' },
      ],
    },
  })
  assert.equal(hasMatchingAttachmentSuffix(message({ content: '查库存[附件：a.png, b.png]' }), multiLocal), true)
  assert.equal(hasMatchingAttachmentSuffix(message({ content: '查库存[附件：别的文件]' }), multiLocal), false)
  // 服务端内容里混入用户未输入的文字 → 不匹配
  assert.equal(hasMatchingAttachmentSuffix(message({ content: '查库存补充说明[附件：销售.xlsx]' }), local), false)
})

// ─── 历史合并 ───────────────────────────────────────────────────────────

test('retainCachedMessageDetails 对齐后保留本机附件详情', () => {
  const localUser = message({
    id: 'history_local_u',
    content: '查库存',
    payload: {
      statusSteps: [], images: [],
      file: { name: '销售.xlsx', url: 'https://b/x.xlsx', isImage: false, abbreviation: 'XLSX' },
      files: [],
    },
  })
  const remoteUser = message({ id: 'history_remote_u', content: '查库存[附件：销售.xlsx]' })
  const merged = retainCachedMessageDetails([remoteUser], [localUser])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].content, '查库存')
  assert.equal(merged[0].payload.file?.name, '销售.xlsx')
})

test('retainCachedMessageDetails 本地没有的远端消息原样保留', () => {
  const remote = message({ id: 'history_new', role: 'assistant', content: '新回复' })
  const merged = retainCachedMessageDetails([remote], [])
  assert.equal(merged[0].id, 'history_new')
  assert.equal(merged[0].content, '新回复')
})

// ─── 断流恢复 ───────────────────────────────────────────────────────────

test('recoveredReply 只认挂起用户轮之后的助手回复', () => {
  const pending = message({ id: 'user_pending', content: '查库存', createdAt: Date.now() })
  const baseline = [message({ id: 'history_u0', role: 'user', content: '旧问题' })]
  const history = [
    message({ id: 'history_u0', role: 'user', content: '旧问题' }),
    message({ id: 'history_a0', role: 'assistant', content: '旧回复' }),
    message({ id: 'user_pending', role: 'user', content: '查库存' }),
    message({ id: 'assistant_new', role: 'assistant', content: '库存充足' }),
  ]
  assert.equal(recoveredReply(history, pending, baseline)?.content, '库存充足')

  // 后台还没生成回复 → null
  const withoutReply = history.slice(0, 3)
  assert.equal(recoveredReply(withoutReply, pending, baseline), null)
})

test('mergeRecoveringHistory 后台无回复时保持本地未完成轮可见', () => {
  const pending = message({ id: 'user_pending', content: '查库存' })
  const baseline = [message({ id: 'history_u0', role: 'user', content: '旧问题' })]
  const cached = [
    message({ id: 'history_u0', role: 'user', content: '旧问题' }),
    message({ id: 'history_a0', role: 'assistant', content: '旧回复' }),
    pending,
  ]
  const remote = [
    message({ id: 'history_u0', role: 'user', content: '旧问题' }),
    message({ id: 'history_a0', role: 'assistant', content: '旧回复' }),
  ]
  const merged = mergeRecoveringHistory(remote, cached, pending, baseline)
  assert.deepEqual(merged.map(item => item.id), ['history_u0', 'history_a0', 'user_pending'])
})

test('mergeRecoveringHistory 找到回复后以服务端为准', () => {
  const pending = message({ id: 'user_pending', content: '查库存' })
  const baseline = []
  const cached = [pending]
  const remote = [
    message({ id: 'user_pending', role: 'user', content: '查库存' }),
    message({ id: 'assistant_new', role: 'assistant', content: '库存充足' }),
  ]
  const merged = mergeRecoveringHistory(remote, cached, pending, baseline)
  assert.deepEqual(merged.map(item => item.id), ['user_pending', 'assistant_new'])
})

test('recoveredReply 附件轮按附件后缀对齐', () => {
  const pending = message({
    id: 'user_pending',
    content: '请帮我分析这个文件',
    payload: {
      statusSteps: [], images: [],
      file: { name: '销售.xlsx', url: 'https://b/x.xlsx', isImage: false, abbreviation: 'XLSX' },
      files: [],
    },
  })
  const history = [
    message({ id: 'user_pending_r', role: 'user', content: '请帮我分析这个文件[附件：销售.xlsx]', createdAt: Date.now() }),
    message({ id: 'assistant_new', role: 'assistant', content: '分析完成' }),
  ]
  assert.equal(recoveredReply(history, pending, [])?.content, '分析完成')
})

test('空 payload 判定不误伤空对象', () => {
  // 远端消息 payload 为空时保留本地详情；本地也为空时保持空
  const local = message({ id: 'history_x', role: 'assistant', content: '回复', payload: emptyPayload() })
  const remote = message({ id: 'history_x', role: 'assistant', content: '回复' })
  const merged = retainCachedMessageDetails([remote], [local])
  assert.deepEqual(merged[0].payload, emptyPayload())
})
