import assert from 'node:assert/strict'
import test from 'node:test'
import { buildOfficeUserCopyText, toPlainText } from './agentMessagePlainText.ts'

test('把表格转成制表符分隔，便于粘进 Excel 自动分列', () => {
  const text = toPlainText(`| 订单号 | 品号 | 金额 |
|---|---|---|
| SO202608140004 | P001 | 588,784.86 |`)

  assert.equal(text, '订单号\t品号\t金额\nSO202608140004\tP001\t588,784.86')
})

test('去掉标题井号与加粗标记，保留文字', () => {
  const text = toPlainText(`### 库存预警

共 **3** 条缺货记录，请尽快补货。`)

  assert.equal(text, '库存预警\n\n共 3 条缺货记录，请尽快补货。')
})

test('去掉引用符号与围栏标记，代码块内容原样保留', () => {
  const text = toPlainText(`> 注意

\`\`\`python
def f():
    return 1
\`\`\``)

  assert.match(text, /^注意/)
  assert.match(text, /def f\(\):/)
  assert.match(text, /^ {4}return 1$/m)
  assert.doesNotMatch(text, /```/)
  assert.doesNotMatch(text, /^>/m)
})

test('链接只保留文字，去掉分隔线', () => {
  const text = toPlainText(`请看 [库存看板](/dashboard/stock)

---

以上。`)

  assert.equal(text, '请看 库存看板\n\n以上。')
})

test('空内容返回空字符串', () => {
  assert.equal(toPlainText(''), '')
  assert.equal(toPlainText('   \n\n  '), '')
})

test('办公模式用户消息带上附件清单', () => {
  const text = buildOfficeUserCopyText('帮我看下这个表', [
    { name: '8月库存.xlsx' },
    { name: '会议纪要.docx' },
  ])

  assert.equal(text, '帮我看下这个表\n[附件] 8月库存.xlsx\n[附件] 会议纪要.docx')
})

test('没有正文时仅输出附件清单', () => {
  const text = buildOfficeUserCopyText('', [{ name: '录音.m4a' }])

  assert.equal(text, '[附件] 录音.m4a')
})