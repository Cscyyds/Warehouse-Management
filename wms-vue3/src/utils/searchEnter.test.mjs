import { test } from 'node:test'
import assert from 'node:assert/strict'
import { onSearchEnter } from './searchEnter.ts'
function enter(overrides = {}) {
  return { key: 'Enter', preventDefault() { this.defaultPrevented = true }, stopPropagation() { this.stopped = true }, ...overrides }
}
test('Enter复用查询入口并阻止表单默认提交与冒泡重复处理', async () => {
  let calls = 0
  const event = enter()
  const result = await onSearchEnter(event, async () => { calls++; return 42 })
  assert.equal(result, 42); assert.equal(calls, 1)
  assert.equal(event.defaultPrevented, true); assert.equal(event.stopped, true)
  onSearchEnter(event, () => calls++)
  assert.equal(calls, 1)
})
test('输入法确认、长按、修饰键及其他按键不查询也不阻断原操作', () => {
  for (const overrides of [{ isComposing: true }, { keyCode: 229 }, { repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }, { key: 'Escape' }]) {
    const event = enter(overrides)
    let calls = 0
    onSearchEnter(event, () => calls++)
    assert.equal(calls, 0); assert.equal(event.defaultPrevented, undefined)
  }
})
