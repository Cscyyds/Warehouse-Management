/**
 * 守卫：天心 ERP 单据（贸易 4 + 借出借入 4）筛选区的「字段剔除」规则。
 *
 * 为什么必须钉住：筛选区是"照着字段名逐个铺开"的，删多删少都静默——
 *   · 该删没删 → 用户搜了必空，又会被当成"功能坏了"（2026-11-05 用户首轮反馈）；
 *   · 不该删却删了 → 少一个可搜维度，页面上完全看不出来。
 *
 * 判据（2026-11-05 逐字段核可用性，证据见两个 config 的常量注释）：
 *   结构性缺失（报文无该键 / 恒定单值）或全表无值 ⇒ 剔除；有值可命中的一律保留。
 *
 * ⚠️ 剔除**只作用于筛选区**（getXxxHeaderSearchFields），排序白名单与表格列不动。
 *
 * 运行：npm run test:erp-search-fields
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BORROW_SEARCH_HIDDEN_BY_DOC,
  BORROW_SEARCH_HIDDEN_FIELDS,
  borrowSearchFieldsOf,
} from './borrowDocConfig.ts'
import {
  TRADE_SEARCH_HIDDEN_FIELDS,
  tradeSearchFieldsOf,
} from './tradeDocConfig.ts'

/* ───────────────────────── 贸易四单据 ───────────────────────── */

test('贸易剔除清单 = 分类日期/流转分类/单据ID（不做增减）', () => {
  assert.deepEqual([...TRADE_SEARCH_HIDDEN_FIELDS], ['cls_date', 'lz_cls_id', 'ps_id'])
})

test('贸易：有真实值的字段必须留下（total_qty/sal_no/usr 等）', () => {
  // 真实的 sales-order 搜索白名单（HEADER_SORT_BASE + 单据专属）
  const sortFields = [
    'erp_bill_no', 'erp_bill_date', 'erp_modify_date', 'synced_at',
    'cus_no', 'sal_no', 'rem', 'bil_type', 'dep', 'dep_name',
    'usr', 'cls_date', 'lz_cls_id', 'total_qty', 'erp_lock_status',
    'ps_id', 'transfer_os_no', 'cus_os_no', 'customer_name', 'employee_name',
    'source_os_no',
  ]
  const search = tradeSearchFieldsOf(sortFields)

  for (const f of TRADE_SEARCH_HIDDEN_FIELDS) {
    assert.equal(search.includes(f), false, `${f} 必须从筛选区消失`)
  }
  // 用户明确说"能用"的这三个，绝不能被误删（库里空值率 0%、去重 14~77）
  for (const f of ['total_qty', 'sal_no', 'usr']) {
    assert.equal(search.includes(f), true, `${f} 有真实数据，必须留在筛选区`)
  }
  assert.deepEqual(search, sortFields.filter((f) => !TRADE_SEARCH_HIDDEN_FIELDS.includes(f)))
})

/* ─────────────────────── 借出借入四单据 ─────────────────────── */

test('借出借入族级剔除清单 = 产品指定的 5 个 + 部门名称', () => {
  assert.deepEqual(
    [...BORROW_SEARCH_HIDDEN_FIELDS],
    ['total_qty', 'sal_no', 'usr', 'cls_date', 'bl_id', 'dep_name'],
  )
})

test('单据类别只在借入单/借出单剔除（这两张报文无 BIL_TYPE）', () => {
  assert.deepEqual([...BORROW_SEARCH_HIDDEN_BY_DOC['borrow-in-order']], ['bil_type'])
  assert.deepEqual([...BORROW_SEARCH_HIDDEN_BY_DOC['lend-out-order']], ['bil_type'])
  assert.equal(BORROW_SEARCH_HIDDEN_BY_DOC['borrow-in-return'], undefined, 'BB 报文有 BIL_TYPE，不能删')
  assert.equal(BORROW_SEARCH_HIDDEN_BY_DOC['lend-out-return'], undefined, 'LB 报文有 BIL_TYPE，不能删')
})

test('借出借入：四单据的可用字段全部保留，单张差异只影响 bil_type', () => {
  // 真实 HDR_COMMON + 借入族联表字段
  const base = [
    'erp_bill_no', 'erp_bill_date', 'erp_modify_date', 'synced_at',
    'bl_id', 'cus_no', 'sal_no', 'bil_type', 'dep', 'dep_name',
    'usr', 'cls_id', 'cls_date', 'est_dd', 'pay_dd', 'cus_os_no',
    'warehouse_status', 'erp_lock_status', 'total_qty',
    'supplier_name', 'employee_name',
  ]
  const bn = borrowSearchFieldsOf('borrow-in-order', base)
  const bb = borrowSearchFieldsOf('borrow-in-return', base)

  // 族级 6 个一律消失
  for (const f of BORROW_SEARCH_HIDDEN_FIELDS) {
    assert.equal(bn.includes(f), false, `${f} 必须消失（BN）`)
    assert.equal(bb.includes(f), false, `${f} 必须消失（BB）`)
  }
  // 可用字段一个不少
  for (const f of ['erp_bill_no', 'erp_modify_date', 'synced_at', 'cus_no', 'dep', 'cls_id',
    'est_dd', 'pay_dd', 'cus_os_no', 'warehouse_status', 'erp_lock_status',
    'supplier_name', 'employee_name']) {
    assert.equal(bn.includes(f), true, `${f} 可用，必须留在筛选区（BN）`)
  }
  // 单张差异：BN 去掉 bil_type，BB 保留
  assert.equal(bn.includes('bil_type'), false, 'BN 报文无 BIL_TYPE，留着必空')
  assert.equal(bb.includes('bil_type'), true, 'BB 报文有 BIL_TYPE，不能误删')
})

/* ───────────────────────── 通用边界 ───────────────────────── */

test('只做过滤，不改写字段名（白名单是后端契约，改写会 400）', () => {
  assert.deepEqual(tradeSearchFieldsOf(['ps_id', 'total_qty']), ['total_qty'])
  assert.deepEqual(borrowSearchFieldsOf('borrow-in-order', ['bil_type', 'dep']), ['dep'])
})

test('空/未知输入不抛错（未注册 docKey 时页面渲染空态）', () => {
  assert.deepEqual(tradeSearchFieldsOf([]), [])
  assert.deepEqual(borrowSearchFieldsOf('some-future-doc', ['erp_bill_no']), ['erp_bill_no'])
})
