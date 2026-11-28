/**
 * 守卫：批量补录的输入解析与上限判定。
 *
 * 为什么必须守卫：这是「用户自由文本 → 接口 bill_nos 参数」的唯一转换点，判错静默出错：
 *   · 单号被切坏 → 后端查不到该单，用户以为"补录成功但没数据"；
 *   · 去重遗漏 → 同一张单重复处理；
 *   · 上限失效 → 后端 400，白跑一次 ERP 请求。
 *
 * 契约来源：后端 `POST /api/v1/tenant-trade/{docKey}/sync/refresh`
 *   Form `bill_nos`（可重复）；`len > 50` → 400；后端不去重。
 *
 * 运行：npm run test:trade-topup
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TOPUP_LIMIT, countBillNoSegments, isTopupOverLimit, parseBillNos } from './tradeTopup.ts'

test('按换行解析（最常见：从 Excel 一列粘贴）', () => {
  assert.deepEqual(parseBillNos('PC001\nPC002\nPC003'), ['PC001', 'PC002', 'PC003'])
})

test('兼容多种分隔符：逗号/全角逗号/顿号/分号/制表/空格', () => {
  assert.deepEqual(
    parseBillNos('PC001,PC002，PC003、PC004;PC005；PC006\tPC007 PC008'),
    ['PC001', 'PC002', 'PC003', 'PC004', 'PC005', 'PC006', 'PC007', 'PC008'],
  )
})

test('丢弃空白段与首尾空白（含全空输入）', () => {
  assert.deepEqual(parseBillNos('  PC001 \n\n  \nPC002\t\n'), ['PC001', 'PC002'])
  assert.deepEqual(parseBillNos(''), [])
  assert.deepEqual(parseBillNos('   \n\t  '), [])
})

test('按首次出现顺序去重', () => {
  assert.deepEqual(parseBillNos('B\nA\nB\nC\nA'), ['B', 'A', 'C'])
})

test('★ 不把单号内部的 - _ . 当分隔符（否则会把单号切坏）', () => {
  assert.deepEqual(
    parseBillNos('SB2026-0910-001\nPO_2026.09.10_A'),
    ['SB2026-0910-001', 'PO_2026.09.10_A'],
  )
})

test('不做大小写归一（ERP 单号是精确串）', () => {
  assert.deepEqual(parseBillNos('pc001\nPC001'), ['pc001', 'PC001'])
})

test('上限判定：50 允许，51 超出（与后端 400 阈值一致）', () => {
  assert.equal(TOPUP_LIMIT, 50)
  assert.equal(isTopupOverLimit(50), false)
  assert.equal(isTopupOverLimit(51), true)
  assert.equal(isTopupOverLimit(0), false)
})

test('去重能救回"重复粘贴导致超限"的情况', () => {
  // 同一个 50 张的列表粘两遍 = 100 段，但去重后仍是 50，不应被判超限
  const once = Array.from({ length: 50 }, (_, i) => `PC${String(i).padStart(3, '0')}`)
  const twice = [...once, ...once].join('\n')
  const parsed = parseBillNos(twice)
  assert.equal(parsed.length, 50)
  assert.equal(isTopupOverLimit(parsed.length), false)
})

test('countBillNoSegments 返回去重前的有效段数（供"已去除 N 个重复"提示用）', () => {
  assert.equal(countBillNoSegments('B\nA\nB\nC'), 4)      // 去重前 4 段
  assert.equal(parseBillNos('B\nA\nB\nC').length, 3)       // 去重后 3 个
  assert.equal(countBillNoSegments(''), 0)
  assert.equal(countBillNoSegments('  \n ,  ，  '), 0)     // 全是分隔符 → 0 段
  // 与 parseBillNos 共用同一分隔规则，两者段数差即重复数
  const text = 'PC001,PC001,PC002'
  assert.equal(countBillNoSegments(text) - parseBillNos(text).length, 1)
})
