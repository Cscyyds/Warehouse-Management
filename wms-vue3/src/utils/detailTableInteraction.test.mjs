import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detailNavigationTarget } from './detailTableInteraction.ts'

test('Tab 跳过只读与禁用列，并跨行继续；Shift+Tab 反向移动', () => {
  const rows = [[2, 4], [2], [2, 4]]
  assert.deepEqual(detailNavigationTarget(rows, 0, 2, 'Tab'), [0, 4])
  assert.deepEqual(detailNavigationTarget(rows, 0, 4, 'Tab'), [1, 2])
  assert.deepEqual(detailNavigationTarget(rows, 2, 2, 'Tab', true), [1, 2])
  assert.equal(detailNavigationTarget(rows, 0, 2, 'Tab', true), undefined)
  assert.equal(detailNavigationTarget(rows, 2, 4, 'Tab'), undefined)
})
test('Enter 到下一行同列，跳过没有可编辑控件的行，不在最后一行循环', () => {
  const rows = [[2, 4], [2], [], [2, 4]]
  assert.deepEqual(detailNavigationTarget(rows, 0, 4, 'Enter'), [3, 4])
  assert.deepEqual(detailNavigationTarget(rows, 3, 4, 'Enter', true), [0, 4])
  assert.equal(detailNavigationTarget(rows, 3, 4, 'Enter'), undefined)
})
