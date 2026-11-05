/**
 * 守卫：天心模式「写入口封锁」判定规则。
 *
 * 为什么必须守卫：这条规则决定采购通用列表页是否隐藏写入口。
 *   · 判错成「不封锁」→ 天心模式下按钮照常显示，用户点「新增/编辑/审核」必然撞 403（死入口）；
 *   · 判错成「封锁」→ 供应商档案等**本可写**的页面被误锁，功能静默消失。
 * 两种错误都静默、都不报错，只能靠这里钉住。
 *
 * 规则的权威来源：`config/tradeModeRule.ts`；
 * 后端口径：`require_purchase_sales_write_access` 只挂在采购单/入库单/采购退货/销售订单/销售退货。
 *
 * 运行：npm run test:trade-mode-gate
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TIANXIN_BLOCKED_PURCHASE_SCENES,
  isPurchaseSceneWriteBlocked,
} from './tradeModeRule.ts'

test('天心模式下，"单据"族场景的写入口被封锁', () => {
  for (const scene of ['order', 'inbound', 'return']) {
    assert.equal(
      isPurchaseSceneWriteBlocked(scene, true), true,
      `天心模式下 ${scene} 的写接口被后端 403，必须封锁`,
    )
  }
})

test('天心模式下，被封锁场景清单与后端单据族逐字一致', () => {
  assert.deepEqual([...TIANXIN_BLOCKED_PURCHASE_SCENES], ['order', 'inbound', 'return'])
})

test('天心模式下，主数据与报表场景**不**封锁（仍可写）', () => {
  // 供应商主数据归 WMS；报表为只读页（本无写入口）。误封锁会让功能静默消失。
  for (const scene of ['supplier', 'supplierType', 'supplierBalance', 'inboundDetail', 'returnSummary']) {
    assert.equal(
      isPurchaseSceneWriteBlocked(scene, true), false,
      `天心模式下 ${scene} 未被后端封锁，不应隐藏写入口`,
    )
  }
})

test('非天心模式下一律不封锁（含所有场景）', () => {
  const allScenes = [
    ...TIANXIN_BLOCKED_PURCHASE_SCENES,
    'supplier', 'supplierType', 'supplierBalance', 'inboundDetail', 'returnSummary',
  ]
  for (const scene of allScenes) {
    assert.equal(isPurchaseSceneWriteBlocked(scene, false), false, `NATIVE 模式下 ${scene} 不应被封锁`)
  }
})

test('未知场景 + 天心模式 → 不封锁（fail-open，由后端 403 兜底）', () => {
  // 语义选择：宁可是"按钮在、点了 403"（可发现、可上报），
  // 也不要"按钮消失但其实是合规功能"（静默丢功能）。
  assert.equal(isPurchaseSceneWriteBlocked('someFutureScene', true), false)
})

test('场景名精确匹配（不做大小写/前后缀归一）', () => {
  // type 是组件内的字面量，不存在大小写变体；这里钉住"精确匹配"这一语义，
  // 防止后来者误加 toLowerCase() 之类归一后与后端单据族不再一一对应。
  assert.equal(isPurchaseSceneWriteBlocked('Order', true), false)
  assert.equal(isPurchaseSceneWriteBlocked(' order', true), false)
  assert.equal(isPurchaseSceneWriteBlocked('', true), false)
})
