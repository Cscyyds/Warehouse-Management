import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateRolePermissions, permissionFingerprint, permissionsFromDraft, permissionChanges } from './sensitivePermissionDraft.ts'

test('空配置与加载失败严格区分，重复和非法类型均拒绝保存', () => {
  assert.deepEqual(validateRolePermissions([]), [])
  for (const value of [undefined, {}, [{ field_id: 'a', restriction_type: 0 }], [{ field_id: 'a', restriction_type: 1 }, { field_id: 'a', restriction_type: 2 }]]) assert.throws(() => validateRolePermissions(value))
})
test('全量草稿序列化保留非当前筛选字段，取消限制的0不发给后端', () => {
  assert.deepEqual(permissionsFromDraft({ visible: 0, otherModule: 2, hidden: 1 }), [{ field_id: 'otherModule', restriction_type: 2 }, { field_id: 'hidden', restriction_type: 1 }])
})
test('回查比较忽略排列和展示标签，识别远端类型修改', () => {
  const a = [{ field_id: 'a', restriction_type: 1 }, { field_id: 'b', restriction_type: 2 }]
  assert.equal(permissionFingerprint(a), permissionFingerprint([...a].reverse()))
  assert.notEqual(permissionFingerprint(a), permissionFingerprint([{ ...a[0], restriction_type: 2 }, a[1]]))
})
test('解除隐藏和批量新增隐藏提供实际变更范围', () => {
  const result = permissionChanges([{ field_id: 'a', restriction_type: 1 }, { field_id: 'b', restriction_type: 2 }], [{ field_id: 'a', restriction_type: 2 }, { field_id: 'c', restriction_type: 1 }])
  assert.equal(result.count, 3)
  assert.deepEqual(result.unhidden.map(x => x.field_id), ['a'])
  assert.deepEqual(result.newlyHidden.map(x => x.field_id), ['c'])
})
