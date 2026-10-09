/**
 * 单测：项次自然序排序（src/utils/itemSeqSort.ts）
 *
 * 背景：贸易明细 `erp_item_seq` 是 VARCHAR(16)，后端 `ORDER BY` 走字典序
 * 导致「项次 10 排在项次 1 后面」。前端在详情页做全量排序兜底，
 * 本测试锁住该排序语义，防止后续被改回字典序。
 *
 * 运行：npm run test:item-seq-sort
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareItemSeq, sortItemsBySeq } from './itemSeqSort.ts'

test('纯数字项次按数值升序，而不是字典序', () => {
  const input = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']
  const strSorted = [...input].sort()
  assert.deepEqual(strSorted.slice(0, 3), ['1', '10', '11'], '前置断言：字典序确实是 1,10,11...')
  const seqSorted = [...input].sort(compareItemSeq)
  assert.deepEqual(seqSorted, input, '数值序应为 1..11 连续')
})

test('项次 100 项以内不跳号不重号（截图场景：1..10 共 10 行）', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ erp_item_seq: String(i + 1) }))
  // 打乱成字典序的样子
  const shuffled = [rows[0], rows[9], rows[1], rows[2], rows[3], rows[4], rows[5], rows[6], rows[7], rows[8]]
  assert.deepEqual(
    shuffled.map(r => r.erp_item_seq),
    ['1', '10', '2', '3', '4', '5', '6', '7', '8', '9'],
    '前置断言：原始顺序确实是用户截图里的 1,10,2,3...'
  )
  assert.deepEqual(
    sortItemsBySeq(shuffled).map(r => r.erp_item_seq),
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    '排序后应还原为 1..10'
  )
})

test('sortItemsBySeq 不修改原数组（computed 里依赖不可变语义）', () => {
  const rows = [{ erp_item_seq: '10' }, { erp_item_seq: '2' }]
  const frozen = [...rows]
  const sorted = sortItemsBySeq(rows)
  assert.deepEqual(rows, frozen, '原数组顺序不能变')
  assert.notEqual(sorted, rows, '必须返回新数组')
})

test('数字串排在非数字值之前（对齐后端 _seq_order 语义）', () => {
  const rows = [
    { erp_item_seq: 'A' },
    { erp_item_seq: '3' },
    { erp_item_seq: 'B' },
    { erp_item_seq: '11' },
    { erp_item_seq: '2' },
  ]
  assert.deepEqual(
    sortItemsBySeq(rows).map(r => r.erp_item_seq),
    ['2', '3', '11', 'A', 'B']
  )
})

test('数值相同但字面不同（01 / 1）按字典序兜底，保证全序稳定', () => {
  assert.equal(compareItemSeq('01', '1'), -1)
  assert.equal(compareItemSeq('1', '01'), 1)
  assert.equal(compareItemSeq('1', '1'), 0)
})

test('空值 / null / undefined 归到末尾且不抛错', () => {
  const rows = [
    { erp_item_seq: null },
    { erp_item_seq: '2' },
    { erp_item_seq: undefined },
    { erp_item_seq: '1' },
  ]
  assert.deepEqual(
    sortItemsBySeq(rows).map(r => String(r.erp_item_seq)),
    ['1', '2', 'null', 'undefined']
  )
  assert.doesNotThrow(() => compareItemSeq(undefined, null))
})

test('数字入参（接口偶尔返 number）也能按数值排', () => {
  const rows = [{ erp_item_seq: 10 }, { erp_item_seq: 2 }, { erp_item_seq: 1 }]
  assert.deepEqual(
    sortItemsBySeq(rows).map(r => r.erp_item_seq),
    [1, 2, 10]
  )
})

test('单条与空数组边界', () => {
  assert.deepEqual(sortItemsBySeq([]), [])
  const one = [{ erp_item_seq: '7' }]
  assert.deepEqual(sortItemsBySeq(one), one)
})