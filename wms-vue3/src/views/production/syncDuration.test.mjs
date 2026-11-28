import { test } from 'node:test'
import assert from 'node:assert/strict'
import { durationToSeconds, formatDuration, secondsForMinute } from './syncDuration.ts'

test('分钟秒精确换算及展示，支持超过24小时', () => {
  assert.equal(durationToSeconds(5, 1, 300, 172800), 301)
  assert.equal(durationToSeconds(2880, 0, 300, 172800), 172800)
  assert.equal(formatDuration(301), '5 分 1 秒')
  assert.equal(formatDuration(172800), '2880 分 0 秒')
})
test('首尾分钟仅允许后台范围内的秒数，支持非整分钟边界', () => {
  assert.deepEqual(secondsForMinute(5, 305, 367), Array.from({ length: 55 }, (_, i) => i + 5))
  assert.deepEqual(secondsForMinute(6, 305, 367), [0, 1, 2, 3, 4, 5, 6, 7])
  assert.deepEqual(secondsForMinute(2880, 300, 172800), [0])
  assert.equal(durationToSeconds(5, 5, 305, 367), 305)
  assert.equal(durationToSeconds(6, 7, 305, 367), 367)
})
test('拒绝越界、非整数及无效秒数', () => {
  for (const [m, s] of [[4, 59], [2880, 1], [5, 60], [5, -1], [5.5, 0], [5, NaN]]) {
    assert.throws(() => durationToSeconds(m, s, 300, 172800), RangeError)
  }
})
