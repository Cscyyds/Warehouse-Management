import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { validatePromptInput } from './dialogModel.ts'

function harness(result) {
  const calls = [], exports = {}
  const source = ts.transpileModule(readFileSync(new URL('./actionDialog.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  new Function('require', 'exports', source)(() => ({ openActionDialog: async (...args) => { calls.push(args); return result } }), exports)
  return { ...exports, calls }
}

test('确认成功仍返回 confirm，VNode 和按钮文案原样传递', async () => {
  const h = harness({ action: 'confirm', value: '' }), message = { __v_isVNode: true }
  assert.equal(await h.confirmAction(message, '审核确认', { confirmButtonText: '审核通过', cancelButtonText: '继续编辑' }), 'confirm')
  assert.equal(h.calls[0][0], message)
  assert.equal(h.calls[0][1].confirmButtonText, '审核通过')
})

test('普通关闭按取消处理，区分关闭时保留放弃修改和停止离开的分支', async () => {
  const h = harness({ action: 'close', value: '' })
  await assert.rejects(h.confirmAction('删除？'), reason => reason === 'cancel')
  await assert.rejects(h.confirmAction('有未保存修改', '离开当前配置', { distinguishCancelAndClose: true }), reason => reason === 'close')
  const cancel = harness({ action: 'cancel', value: '' })
  await assert.rejects(cancel.confirmAction('有未保存修改', { distinguishCancelAndClose: true }), reason => reason === 'cancel')
})

test('输入确认保留原文和返回结构，空取消原因可以提交', async () => {
  const h = harness({ action: 'confirm', value: '  原始凭证  ' })
  assert.deepEqual(await h.promptAction('核对凭证', '核对ERP审核结果'), { value: '  原始凭证  ', action: 'confirm' })
  assert.equal(h.calls[0][1].showInput, true)
  assert.equal(await validatePromptInput('', {}), '')
  const cancel = harness({ action: 'cancel', value: '' })
  await assert.rejects(cancel.promptAction('原因'), reason => reason === 'cancel')
})

test('保留非空名称和五字凭证校验，异步失败不能被当作通过', async () => {
  const name = { inputValidator: value => String(value || '').trim() ? true : '请输入名称' }
  const evidence = { inputValidator: value => !!value && value.trim().length >= 5 || '请填写至少5字的核对依据' }
  assert.equal(await validatePromptInput('  ', name), '请输入名称')
  assert.equal(await validatePromptInput('四个字', evidence), '请填写至少5字的核对依据')
  assert.equal(await validatePromptInput('核对ERP成功', evidence), '')
  assert.equal(await validatePromptInput('A', { inputValidator: async () => '尚未核对' }), '尚未核对')
  assert.equal(await validatePromptInput('A', { inputValidator: async () => { throw new Error('private') } }), '输入内容不符合要求')
})
