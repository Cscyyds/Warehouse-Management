/**
 * 单测：PDF 任务状态词汇表（src/views/ai/pdf-review/jobStatus.ts）
 *
 * 锁住三件事：
 * 1) 后端 9 个状态 → 卡片徽标三态（解析中/待审核/已完成）的折叠口径；
 * 2) 发布中/部分失败归入「已完成」，但保留副标；
 * 3) 旧记录（中文 hint 快照）迁移成原始 status，且不丢记录。
 *
 * 运行：node --experimental-strip-types --test src/views/ai/pdf-review/jobStatus.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  jobBucketAction,
  jobBucketKey,
  jobBucketLabel,
  jobStatusSub,
  jobStatusText,
  isTerminalJobStatus,
  normalizeJobStatus,
  normalizeRecentJob,
} from './jobStatus.ts'

test('解析阶段三种状态都归「解析中」', () => {
  for (const s of ['ready', 'processing', 'merging']) {
    assert.equal(jobBucketKey(s), 'parsing', `${s} 应归解析中`)
    assert.equal(jobBucketLabel(s), '解析中')
    assert.equal(jobBucketAction(s), '查看进度')
  }
})

test('review_pending 归「待审核」——用户退出审核页后要能看出这个状态', () => {
  assert.equal(jobBucketKey('review_pending'), 'review')
  assert.equal(jobBucketLabel('review_pending'), '待审核')
  assert.equal(jobBucketAction('review_pending'), '继续审核')
})

test('发布中/部分失败归「已完成」，副标保留细粒度文案', () => {
  for (const s of ['publishing', 'publish_partial', 'published']) {
    assert.equal(jobBucketKey(s), 'done', `${s} 应归已完成`)
    assert.equal(jobBucketLabel(s), '已完成')
  }
  assert.equal(jobStatusSub('publishing'), '发布中…')
  assert.equal(jobStatusSub('publish_partial'), '部分失败')
  assert.equal(jobStatusSub('published'), '', 'published 不应有副标')
})

test('failed / canceled 是终态异常，不是「状态未知」', () => {
  assert.equal(jobBucketKey('failed'), 'failed')
  assert.equal(jobBucketLabel('failed'), '失败')
  assert.equal(jobBucketKey('canceled'), 'failed')
  assert.equal(jobStatusText('canceled'), '已取消', '细粒度文案仍区分「已取消」')
})

test('expired / unknown / 脏值一律落到中性灰「状态未知」', () => {
  for (const s of ['expired', 'unknown', '', null, undefined, 'weird', 123, {}]) {
    assert.equal(jobBucketKey(s), 'unknown', `${String(s)} 应归状态未知`)
    assert.equal(jobBucketLabel(s), '状态未知')
  }
})

test('大小写与空白容忍（后端返回抖动不应翻成状态未知）', () => {
  assert.equal(normalizeJobStatus(' REVIEW_PENDING '), 'review_pending')
  assert.equal(jobBucketKey('Published'), 'done')
})

test('终态判据只认 published / failed / canceled', () => {
  assert.deepEqual(
    ['published', 'failed', 'canceled'].map(isTerminalJobStatus),
    [true, true, true]
  )
  for (const s of ['processing', 'review_pending', 'publishing', 'publish_partial', 'expired', 'unknown', '']) {
    assert.equal(isTerminalJobStatus(s), false, `${s} 不应判为终态`)
  }
})

test('旧记录（中文 hint）迁移为原始 status，并补 statusAt', () => {
  const legacy = [
    { hint: '处理中', expect: 'processing' },
    { hint: '待审核', expect: 'review_pending' },
    { hint: '发布中', expect: 'publishing' },
    { hint: '部分失败', expect: 'publish_partial' },
    { hint: '已完成', expect: 'published' },
    { hint: '失败', expect: 'failed' },
    { hint: '已取消', expect: 'canceled' },
  ]
  for (const { hint, expect } of legacy) {
    const rec = normalizeRecentJob({ job_id: 'a'.repeat(32), pdf_name: 'x.pdf', hint, added_at: 1700000000000 })
    assert.equal(rec.status, expect, `hint「${hint}」应迁移为 ${expect}`)
    assert.equal(rec.statusAt, 1700000000000, 'statusAt 应回退到 added_at')
    assert.equal(rec.pdf_name, 'x.pdf')
  }
})

test('新记录（已有 status）不被 hint 覆盖；字段缺失有兜底', () => {
  const rec = normalizeRecentJob({ job_id: 'b'.repeat(32), status: 'review_pending', hint: '已完成', statusAt: 1700000009999 })
  assert.equal(rec.status, 'review_pending', 'status 优先于陈旧 hint')
  assert.equal(rec.statusAt, 1700000009999)
  assert.equal(rec.pdf_name, 'PDF document', '缺 pdf_name 时兜底')
})

test('非法记录返回 null（由调用方过滤）', () => {
  for (const v of [null, undefined, {}, { pdf_name: 'x' }, 42, 'x']) {
    assert.equal(normalizeRecentJob(v), null, `${JSON.stringify(v)} 应被丢弃`)
  }
})

test('未知 hint 不丢记录，降级为状态未知（等实时刷新纠正）', () => {
  const rec = normalizeRecentJob({ job_id: 'c'.repeat(32), hint: '某个新词', added_at: 1 })
  assert.equal(rec.status, 'unknown')
  assert.equal(jobBucketLabel(rec.status), '状态未知')
})
