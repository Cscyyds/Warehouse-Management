import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveAgentFormPageIdentity } from './formPageIdentity.ts'

test('derives a create form identity from the route type', () => {
  const identity = deriveAgentFormPageIdentity({ type: 'salesOrder', title: '新增销售订单' })
  assert.equal(identity.id, 'salesOrder.form')
  assert.equal(identity.mode, 'create')
  assert.equal(identity.title, '新增销售订单')
})

test('treats mode=edit as an edit form identity', () => {
  const identity = deriveAgentFormPageIdentity({ type: 'customerInfo', mode: 'edit', title: '修改客户' })
  assert.equal(identity.id, 'customerInfo.form')
  assert.equal(identity.mode, 'edit')
})

test('readonly=1 wins over mode=edit and marks a readonly form identity', () => {
  const identity = deriveAgentFormPageIdentity({
    type: 'salesOrder',
    mode: 'edit',
    readonly: '1',
  })
  assert.equal(identity.mode, 'readonly')
})

test('treats readonly=0 as a writable form', () => {
  const identity = deriveAgentFormPageIdentity({ type: 'salesOrder', readonly: '0' })
  assert.equal(identity.mode, 'create')
})

test('omits the identity without a form type so nothing is registered', () => {
  assert.equal(deriveAgentFormPageIdentity({}), undefined)
  assert.equal(deriveAgentFormPageIdentity({ type: '   ' }), undefined)
  assert.equal(deriveAgentFormPageIdentity({ type: undefined, title: '新增用户' }), undefined)
})

test('falls back to a generic form title and describes the mode', () => {
  const identity = deriveAgentFormPageIdentity({ type: 'personnel' })
  assert.equal(identity.title, '业务表单')
  assert.match(identity.description, /模式：create/)
})
