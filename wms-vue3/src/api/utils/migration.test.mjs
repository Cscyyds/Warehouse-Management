import { test } from 'node:test'
import assert from 'node:assert/strict'
import { migrationForm } from './migration.ts'

test('结构化列表按 JSON 编码，姓名式特殊字符和对象集合不丢失', () => {
  const changes = [{ new_customer_type: 'TYPE & + 中文', change_lead: ['L1', 'L2'], change_customer: ['C1'] }]
  const form = migrationForm({ source_customer_type_id: 'SRC & +' }, changes)
  const decoded = new URLSearchParams(form.toString())
  assert.equal(decoded.get('source_customer_type_id'), 'SRC & +')
  assert.deepEqual(JSON.parse(decoded.get('change_message')), changes)
  assert.equal(decoded.has('target_customer_type_id'), false)
})
test('负责人清空用显式 null/空串，不能被表单过滤丢失', () => {
  for (const new_user of [null, '']) {
    const form = migrationForm({ source_user_id: 'U1', staff_type: 'both' }, [{ new_user, change_customer: ['C1'] }])
    assert.deepEqual(JSON.parse(form.get('change_message')), [{ new_user, change_customer: ['C1'] }])
    assert.equal(form.get('staff_type'), 'both')
  }
})
test('不扩展或去重迁移对象，由后端校验重复并保持原子性', () => {
  const changes = [{ new_organization: 'O2', change_user: ['U1', 'U1'] }]
  const form = migrationForm({ source_org_id: 'O1' }, changes)
  assert.deepEqual(JSON.parse(form.get('change_message')), changes)
  assert.deepEqual(changes[0].change_user, ['U1', 'U1'])
  assert.equal(form.has('migrate_type'), false)
})
