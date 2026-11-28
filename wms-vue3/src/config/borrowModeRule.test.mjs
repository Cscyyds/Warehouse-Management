/**
 * 守卫：借出借入「模式显隐」判定规则。
 *
 * 为什么必须守卫：这条规则决定整块「借出借入」业务是否出现在顶部导航，并决定
 * `/borrow/**` 深链是否被拦。
 *   · 判错成「NATIVE 也显示」→ WMS 自营租户看到死入口，点进去必然 403
 *     「本租户未开通天心借出借入数据同步」；
 *   · 判错成「未知态也隐藏」→ 天心租户在 mode 接口抖动时整块业务静默消失，
 *     用户无法自查、只能报障。
 * 两种错误都静默、都不报错，只能靠这里钉住。
 *
 * 规则的权威来源：`config/borrowModeRule.ts`；
 * 后端口径：`tenant_borrow_management.py:894-911`（BORROW 行 enabled=0 + TIANXIN）与
 *          `_require_tianxin_borrow_mode`（运行时 403 兜底）。
 *
 * 运行：npm run test:borrow-mode-gate
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isBorrowNavVisible, isBorrowDeepLinkBlocked } from './borrowModeRule.ts'

test('明确 NATIVE → 导航隐藏', () => {
  assert.equal(isBorrowNavVisible('NATIVE'), false)
})

test('明确 TIANXIN → 导航显示', () => {
  assert.equal(isBorrowNavVisible('TIANXIN'), true)
})

test('未知态（未加载/接口失败）→ 导航显示，交给权限树与后端 403 兜底', () => {
  // 语义选择：宁可让 NATIVE 租户短暂看到一个点进去 403 的入口（可发现、可上报），
  // 也不要在接口抖动时把天心租户的整块业务静默锁死。
  assert.equal(isBorrowNavVisible(null), true)
})

test('NATIVE 只拦 /borrow 与 /borrow/**，不误伤其他业务路径', () => {
  assert.equal(isBorrowDeepLinkBlocked('NATIVE', '/borrow'), true)
  assert.equal(isBorrowDeepLinkBlocked('NATIVE', '/borrow/in-order'), true)
  assert.equal(isBorrowDeepLinkBlocked('NATIVE', '/borrow/out-order'), true)
  assert.equal(isBorrowDeepLinkBlocked('NATIVE', '/borrow/sync-settings'), true)
  assert.equal(isBorrowDeepLinkBlocked('NATIVE', '/borrow/in-order/detail/txh_x'), true)

  for (const path of [
    '/dashboard',
    '/trade/outbound-order',   // 前缀相似，但属贸易模块
    '/trade/borrow-order',     // 路径中间含 borrow，不是借出借入
    '/borrowed-list',
    '/',
    '',
  ]) {
    assert.equal(isBorrowDeepLinkBlocked('NATIVE', path), false, `${path} 不应被借出借入深链规则拦截`)
  }
})

test('TIANXIN 下不拦任何 /borrow 路径', () => {
  assert.equal(isBorrowDeepLinkBlocked('TIANXIN', '/borrow'), false)
  assert.equal(isBorrowDeepLinkBlocked('TIANXIN', '/borrow/in-order'), false)
})

test('未知态不拦深链（与导航放行同向）', () => {
  assert.equal(isBorrowDeepLinkBlocked(null, '/borrow'), false)
  assert.equal(isBorrowDeepLinkBlocked(null, '/borrow/out-return'), false)
})

test('显隐与深链拦截至多只有 NATIVE 一个隐藏来源', () => {
  // 两条判定必须同源：任何模式值下，「导航可见」与「深链不拦」的布尔值应一致。
  const modes = ['TIANXIN', 'NATIVE', null]
  for (const mode of modes) {
    assert.equal(
      isBorrowNavVisible(mode),
      !isBorrowDeepLinkBlocked(mode, '/borrow'),
      `模式 ${String(mode)} 下导航显隐与深链拦截口径不一致`,
    )
  }
})
