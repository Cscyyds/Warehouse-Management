/**
 * PDF 按次隐藏：字段目录与请求/文件名快照的守卫测试
 *
 * 覆盖后端契约里最容易写错的四条：
 * 1. 三个目录的字段数必须与后端 PDF_FIELDS 基数一致（采购 32 / 销售 41 / 订货单 20）。
 * 2. 重复标准键序列化（不能出现 hide_fields[] / 逗号串 / JSON 数组）。
 * 3. 隐藏 document.order_no 时文件名必须去单号，且禁止回填业务 ID。
 * 4. 一键全隐金额的展开项必须等于后端「完整无结构化金额」不变量（采购 7 / 销售 12）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

/**
 * 执行真实 TS 模块（与 productionDocConfig.test.mjs 同一套做法，避免只查源码字符串）。
 *
 * 注意：`utils/pdfExport.ts` 用 `@/config/pdfExportOptions` 别名导入，
 * 转译出的 CommonJS 里会是 require('@/...')。这里提供最小 require 解析器，
 * 把 `@/` 前缀映射到 src/，并复用同一份 exports 缓存，保证测的是真实实现。
 */
const moduleCache = new Map()

function loadTs(relativePath) {
  const url = new URL(relativePath, import.meta.url)
  const key = url.pathname
  if (moduleCache.has(key)) return moduleCache.get(key)

  const source = readFileSync(url, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  moduleCache.set(key, exports)

  // 只解析 @/ 别名；其余内置模块本次不需要
  const localRequire = (spec) => {
    if (spec.startsWith('@/')) {
      const target = new URL(`../${spec.slice(2)}.ts`, import.meta.url)
      return loadTs(target.href)
    }
    throw new Error(`测试未预期的模块依赖：${spec}`)
  }
  new Function('exports', 'require', compiled)(exports, localRequire)
  return exports
}

const options = loadTs('./pdfExportOptions.ts')
const pdfExport = loadTs('../utils/pdfExport.ts')
const { PDF_CATALOGUES, getPdfCatalogue, allFieldKeys: allKeysOfCatalogue, moneyFieldLabels } = options
const {
  buildPdfExportSnapshot, snapshotToRequestParams, repeatKeyParamsSerializer,
  moneyHideFields, addMoneyFields, removeMoneyFields, hasAllMoneyFields, isEmptySelection,
} = pdfExport
const {
  sectionFields, sectionsContaining, isCrossSectionField,
  isSectionFullyHidden, isSectionPartiallyHidden, toggleSectionFields,
  defaultShownFields, defaultHiddenFields, shownToHidden,
  alwaysShownKeys, isAlwaysShown,
} = options

/* ── 1. 目录基数与后端一致 ── */

test('三个目录的字段总数与后端 PDF_FIELDS 基数一致', () => {
  assert.equal(allKeysOfCatalogue(PDF_CATALOGUES.purchase).length, 32, '采购应为 32 项')
  assert.equal(allKeysOfCatalogue(PDF_CATALOGUES.sales).length, 41, '销售应为 41 项')
  assert.equal(allKeysOfCatalogue(PDF_CATALOGUES.customerOrder).length, 20, '订货单应为 20 项')
})

test('字段 key 全部大写敏感且形如 domain.name', () => {
  for (const kind of ['purchase', 'sales', 'customerOrder']) {
    for (const key of allKeysOfCatalogue(PDF_CATALOGUES[kind])) {
      assert.match(key, /^(document|order|items)\.[a-z0-9_]+$/, `${kind} 非法 key: ${key}`)
    }
  }
})

test('同目录内字段不重复', () => {
  for (const kind of ['purchase', 'sales', 'customerOrder']) {
    const keys = allKeysOfCatalogue(PDF_CATALOGUES[kind])
    assert.equal(new Set(keys).size, keys.length, `${kind} 存在重复 key`)
  }
})

test('公共 6 项三个接口一致', () => {
  const expected = ['document.logo', 'document.brand_name', 'document.tenant_name',
    'document.order_no', 'document.generated_at', 'document.page_number']
  for (const kind of ['purchase', 'sales', 'customerOrder']) {
    assert.deepEqual(PDF_CATALOGUES[kind].common.map((f) => f.key), expected)
  }
})

test('订货单没有金额字段（后端无该能力）', () => {
  assert.equal(PDF_CATALOGUES.customerOrder.hasMoney, false)
  assert.deepEqual(moneyHideFields('customerOrder'), [])
  const money = [...PDF_CATALOGUES.customerOrder.orderFields, ...PDF_CATALOGUES.customerOrder.itemFields]
    .filter((f) => f.money)
  assert.equal(money.length, 0, '订货单目录不应标记任何金额字段')
})

/* ── 2. 一键全隐金额 = 后端不变量 ── */

test('一键全隐金额：采购 7 项、销售 12 项', () => {
  assert.equal(moneyHideFields('purchase').length, 7)
  assert.equal(moneyHideFields('sales').length, 12)
})

test('采购全隐金额包含 5 个主单 + 2 个明细，且含应付/采购单价/金额', () => {
  const fields = moneyHideFields('purchase')
  for (const key of ['order.order_amount', 'order.rounding_amount', 'order.use_prepayment_amount',
    'order.use_gift_amount', 'order.payable_amount', 'items.purchase_price', 'items.amount']) {
    assert.ok(fields.includes(key), `采购全隐缺少 ${key}`)
  }
})

test('销售全隐金额包含 8 个主单 + 4 个明细，税率不在其中', () => {
  const fields = moneyHideFields('sales')
  for (const key of ['order.total_sales_amount', 'order.receivable_amount', 'order.pending_receivable_amount',
    'order.received_amount', 'order.use_prepayment_amount', 'order.use_gift_amount',
    'order.rounding_amount', 'order.total_tax_amount',
    'items.discount_price', 'items.line_sales_amount', 'items.tax_amount', 'items.line_receivable_amount']) {
    assert.ok(fields.includes(key), `销售全隐缺少 ${key}`)
  }
  assert.ok(!fields.includes('items.tax_rate'), '税率独立，不应计入金额快捷项')
})

test('addMoneyFields 只追加缺失的金额字段，保留用户其它勾选', () => {
  const merged = addMoneyFields(['order.supplier_name', 'items.qty'], 'purchase')
  assert.ok(merged.includes('order.supplier_name'), '应保留非金额勾选')
  assert.ok(merged.includes('items.qty'), '应保留非金额勾选')
  for (const key of moneyHideFields('purchase')) assert.ok(merged.includes(key))
  assert.equal(merged.length, 2 + 7)
})

test('removeMoneyFields 只移除金额字段，保留其它勾选', () => {
  const all = [...moneyHideFields('sales'), 'order.customer_name']
  const left = removeMoneyFields(all, 'sales')
  assert.deepEqual(left, ['order.customer_name'])
})

test('hasAllMoneyFields 正确反映开关状态', () => {
  assert.equal(hasAllMoneyFields([], 'purchase'), false)
  assert.equal(hasAllMoneyFields(moneyHideFields('purchase'), 'purchase'), true)
  assert.equal(hasAllMoneyFields(moneyHideFields('purchase').slice(0, 3), 'purchase'), false)
  // 订货单无金额字段，恒为 false
  assert.equal(hasAllMoneyFields([], 'customerOrder'), false)
})

/* 回归：手勾金额字段只应被「识别」，绝不能反过来驱动全隐开关。
   开关全隐 = 用户显式操作；勾字段只是勾字段。两个状态必须解耦。 */
test('回归：勾满金额字段后 hasAllMoneyFields 为 true（用于提示），但开关状态需独立维护', () => {
  // 模拟用户逐个勾选全部金额字段
  let hideFields = []
  for (const key of moneyHideFields('purchase')) hideFields = addMoneyFields(hideFields, 'purchase')
  assert.equal(hasAllMoneyFields(hideFields, 'purchase'), true, '应识别为已覆盖全部金额')

  // 关键断言：removeMoneyFields 能干净还原，说明金额集合运算与开关无关
  assert.deepEqual(removeMoneyFields(hideFields, 'purchase'), [])
})

test('回归：勾单个金额字段不应被视为已覆盖全部金额', () => {
  const one = ['order.order_amount']
  assert.equal(hasAllMoneyFields(one, 'purchase'), false)
  // 少任意一项都不算覆盖
  const almost = moneyHideFields('purchase').slice(0, -1)
  assert.equal(hasAllMoneyFields(almost, 'purchase'), false)
})

test('金额字段都有可见中文名（二次确认清单不会露出英文 key）', () => {
  for (const kind of ['purchase', 'sales']) {
    for (const { key, label } of moneyFieldLabels(PDF_CATALOGUES[kind])) {
      assert.notEqual(label, key, `${kind} 的 ${key} 缺少中文名`)
    }
  }
})

/* ── 3. 重复标准键序列化 ── */

test('序列化生成重复标准键，不产生方括号或逗号串', () => {
  const query = repeatKeyParamsSerializer({
    purchase_order_id: 'po_1',
    hide_fields: ['order.supplier_name', 'items.purchase_price'],
    hide_sections: ['notes'],
  })
  assert.equal(
    query,
    'purchase_order_id=po_1&hide_fields=order.supplier_name&hide_fields=items.purchase_price&hide_sections=notes'
  )
  assert.ok(!query.includes('[]'), '不得出现 hide_fields[]')
  assert.ok(!query.includes('['), '不得出现任何方括号')
  assert.ok(!query.includes('%5B'), '不得出现编码后的方括号')
  assert.ok(!query.includes('%2C'), '不得把数组压成逗号串')
})

test('序列化对字段点号保留（只编码必要的字符）', () => {
  const query = repeatKeyParamsSerializer({ hide_fields: ['order.payable_amount'] })
  assert.equal(query, 'hide_fields=order.payable_amount')
})

test('空选项时快照不带 hide_fields / hide_sections 参数', () => {
  const snap = buildPdfExportSnapshot({ kind: 'purchase', billId: 'po_1', billNo: 'PO2026' })
  assert.deepEqual(snapshotToRequestParams(snap), {})
  assert.equal(isEmptySelection(undefined, undefined), true)
})

/* ── 4. 文件名规则（隐藏单号必须去单号） ── */

test('未隐藏单号时文件名保留单号（与旧行为一致）', () => {
  const snap = buildPdfExportSnapshot({ kind: 'purchase', billId: 'po_1', billNo: 'PO2026001' })
  assert.equal(snap.fileName, '采购明细单_PO2026001.pdf')
  assert.equal(snap.orderNoHidden, false)
})

test('未隐藏单号但缺单号时回退业务 ID（保持各页面原规则）', () => {
  const snap = buildPdfExportSnapshot({ kind: 'sales', billId: 'so_9', billNo: '' })
  assert.equal(snap.fileName, '销售订单_so_9.pdf')
})

test('隐藏单号时文件名固定为无单号名，禁止回填单号或业务 ID', () => {
  for (const [kind, expected] of [
    ['purchase', '采购明细单.pdf'],
    ['sales', '销售订单.pdf'],
    ['customerOrder', '客户订货单.pdf'],
  ]) {
    const snap = buildPdfExportSnapshot({
      kind, billId: 'biz_123', billNo: 'NO2026001', hideFields: ['document.order_no'],
    })
    assert.equal(snap.fileName, expected, `${kind} 隐藏单号后文件名错误`)
    assert.equal(snap.orderNoHidden, true)
    assert.ok(!snap.fileName.includes('NO2026001'), '不得残留单号')
    assert.ok(!snap.fileName.includes('biz_123'), '不得回填业务 ID')
  }
})

test('隐藏单号且原单号为空时，文件名仍为固定无单号名', () => {
  const snap = buildPdfExportSnapshot({
    kind: 'customerOrder', billId: 'co_1', billNo: '', hideFields: ['document.order_no'],
  })
  assert.equal(snap.fileName, '客户订货单.pdf')
})

/* ── 5. 快照不可变（确认后不再读界面状态） ── */

test('快照与输入数组解耦：后续修改源数组不影响快照', () => {
  const fields = ['order.supplier_name']
  const snap = buildPdfExportSnapshot({ kind: 'purchase', billId: 'po_1', billNo: 'PO1', hideFields: fields })
  fields.push('items.amount')
  assert.deepEqual(snap.hideFields, ['order.supplier_name'])
})

test('快照去重且去首尾空白（与后端规范化一致）', () => {
  const snap = buildPdfExportSnapshot({
    kind: 'purchase', billId: 'po_1', billNo: 'PO1',
    hideFields: ['  order.supplier_name  ', 'order.supplier_name', '', 'items.qty'],
  })
  assert.deepEqual(snap.hideFields, ['order.supplier_name', 'items.qty'])
})

/* ── 6. 区域 ↔ 字段混合结构 ── */

test('每个区域的字段并集覆盖目录全部业务字段（无遗漏）', () => {
  for (const kind of ['purchase', 'sales', 'customerOrder']) {
    const cat = PDF_CATALOGUES[kind]
    const inSections = new Set(cat.sections.flatMap((s) => s.fields))
    const business = [...cat.orderFields, ...cat.itemFields].map((f) => f.key)
    for (const key of business) {
      assert.ok(inSections.has(key), `${kind} 的 ${key} 未归入任何区域`)
    }
  }
})

test('区域字段引用的 key 都真实存在于目录（无幽灵字段）', () => {
  for (const kind of ['purchase', 'sales', 'customerOrder']) {
    const cat = PDF_CATALOGUES[kind]
    const known = new Set([
      ...cat.common.map((f) => f.key),
      ...cat.orderFields.map((f) => f.key),
      ...cat.itemFields.map((f) => f.key),
    ])
    for (const s of cat.sections) {
      for (const key of s.fields) {
        assert.ok(known.has(key), `${kind} 区域 ${s.key} 引用了未知字段 ${key}`)
      }
    }
  }
})

test('合计行（totals）区域已按业务要求移除', () => {
  for (const kind of ['purchase', 'sales', 'customerOrder']) {
    const totals = PDF_CATALOGUES[kind].sections.find((s) => s.key === 'totals')
    assert.equal(totals, undefined, `${kind} 不应再有 totals 区域`)
  }
})

test('所有区域都是字段型（无 sectionOnly 残留）', () => {
  for (const kind of ['purchase', 'sales', 'customerOrder']) {
    for (const s of PDF_CATALOGUES[kind].sections) {
      assert.notEqual(s.sectionOnly, true, `${kind} 区域 ${s.key} 不应标记 sectionOnly`)
      assert.ok(s.fields.length > 0, `${kind} 区域 ${s.key} 应有字段`)
    }
  }
})

test('sectionFields 返回带显示名的字段，且 sectionOnly 区域返回空', () => {
  const fields = sectionFields(PDF_CATALOGUES.purchase, 'basic')
  assert.ok(fields.length > 0)
  for (const f of fields) {
    assert.ok(f.label && f.label !== f.key, `字段 ${f.key} 缺中文名`)
  }
  assert.deepEqual(sectionFields(PDF_CATALOGUES.purchase, 'totals'), [])
})

test('采购 order.payable_amount 被识别为跨区字段（basic + notes）', () => {
  const cat = PDF_CATALOGUES.purchase
  assert.equal(isCrossSectionField(cat, 'order.payable_amount'), true)
  assert.deepEqual(sectionsContaining(cat, 'order.payable_amount').sort(), ['basic', 'notes'])
})

test('销售 order.receivable_amount 被识别为跨区字段（basic + notes）', () => {
  const cat = PDF_CATALOGUES.sales
  assert.equal(isCrossSectionField(cat, 'order.receivable_amount'), true)
  assert.deepEqual(sectionsContaining(cat, 'order.receivable_amount').sort(), ['basic', 'notes'])
})

test('销售订单不再有独立「金额区」，金额字段全部并入基本信息区', () => {
  const cat = PDF_CATALOGUES.sales
  assert.equal(cat.sections.find((s) => s.key === 'amounts'), undefined,
    '销售不应再有 amounts（金额区）')
  const basic = cat.sections.find((s) => s.key === 'basic')
  assert.ok(basic, '销售应有 basic 区')
  for (const key of [
    'order.total_sales_amount', 'order.receivable_amount', 'order.pending_receivable_amount',
    'order.received_amount', 'order.use_prepayment_amount', 'order.use_gift_amount',
    'order.rounding_amount', 'order.total_tax_amount',
  ]) {
    assert.ok(basic.fields.includes(key), `金额字段 ${key} 应归入基本信息区`)
  }
})

test('采购与销售的区域划分保持一致（同为 basic/items/notes）', () => {
  const keysOf = (kind) => PDF_CATALOGUES[kind].sections.map((s) => s.key).sort()
  assert.deepEqual(keysOf('sales'), keysOf('purchase'), '销售区域应采购一致')
})

test('普通字段不算跨区', () => {
  assert.equal(isCrossSectionField(PDF_CATALOGUES.purchase, 'order.supplier_name'), false)
  assert.equal(isCrossSectionField(PDF_CATALOGUES.purchase, 'items.qty'), false)
})

test('区域全选/半选状态判定', () => {
  const cat = PDF_CATALOGUES.purchase
  const basicKeys = sectionFields(cat, 'basic').map((f) => f.key)
  assert.equal(isSectionFullyHidden(cat, 'basic', []), false)
  assert.equal(isSectionPartiallyHidden(cat, 'basic', []), false)
  assert.equal(isSectionPartiallyHidden(cat, 'basic', basicKeys.slice(0, 2)), true)
  assert.equal(isSectionFullyHidden(cat, 'basic', basicKeys), true)
  assert.equal(isSectionPartiallyHidden(cat, 'basic', basicKeys), false)
})

test('toggleSectionFields 全选该区域全部字段', () => {
  const cat = PDF_CATALOGUES.purchase
  const after = toggleSectionFields(cat, 'basic', [], true)
  const expected = sectionFields(cat, 'basic').map((f) => f.key)
  assert.deepEqual([...after].sort(), [...expected].sort())
})

test('toggleSectionFields 取消只移除该区域的字段，保留其它区域勾选', () => {
  const cat = PDF_CATALOGUES.purchase
  const basicKeys = sectionFields(cat, 'basic').map((f) => f.key)
  const start = [...basicKeys, 'items.qty', 'document.logo']
  const after = toggleSectionFields(cat, 'basic', start, false)
  assert.deepEqual([...after].sort(), ['document.logo', 'items.qty'].sort())
})

test('toggleSectionFields 对 sectionOnly 区域不改动 hide_fields', () => {
  const cat = PDF_CATALOGUES.purchase
  const before = ['order.supplier_name']
  assert.deepEqual(toggleSectionFields(cat, 'totals', before, true), before)
})

test('未知单据类型降级：目录缺失但快照仍可用', () => {
  assert.equal(getPdfCatalogue('nope'), null)
  // 目录缺失时标题降级为「单据」，但仍沿用「单号缺失回退业务 ID」的既有规则
  const snap = buildPdfExportSnapshot({ kind: 'nope', billId: 'x_1', billNo: '' })
  assert.equal(snap.fileName, '单据_x_1.pdf')
  // 隐藏单号时降级为固定无单号名
  const hidden = buildPdfExportSnapshot({ kind: 'nope', billId: 'x_1', billNo: '', hideFields: ['document.order_no'] })
  assert.equal(hidden.fileName, '单据.pdf')
})

/* ── 7. 默认勾选 + 强制显示（2026-11-26 业务确认） ── */

/** 5 个必须显示的字段（界面无勾选框） */
const ALWAYS_SHOW = [
  'document.logo', 'document.brand_name', 'document.tenant_name',
  'document.order_no', 'document.page_number',
]

test('Logo/品牌名/公司名/单号/页码 为强制显示，恒在显示集合内', () => {
  for (const kind of ['purchase', 'sales', 'customerOrder']) {
    const cat = PDF_CATALOGUES[kind]
    const shown = new Set(defaultShownFields(cat))
    for (const key of ALWAYS_SHOW) {
      assert.ok(shown.has(key), `${kind} 强制显示字段 ${key} 必须在显示集合内`)
      assert.ok(isAlwaysShown(cat, key), `${kind} ${key} 应标记 alwaysShow`)
      assert.ok(!defaultHiddenFields(cat).includes(key), `${kind} ${key} 不得进入隐藏集合`)
    }
  }
})

test('生成时间不是强制显示（用户可取消）', () => {
  for (const kind of ['purchase', 'sales', 'customerOrder']) {
    const cat = PDF_CATALOGUES[kind]
    assert.equal(isAlwaysShown(cat, 'document.generated_at'), false,
      `${kind} 生成时间不应被固定`)
  }
})

test('采购默认勾选与业务截图一致（基本信息区 5 项 + 明细区 9 项）', () => {
  const cat = PDF_CATALOGUES.purchase
  const shown = new Set(defaultShownFields(cat))

  // 基本信息区
  for (const key of ['order.supplier_name', 'order.order_date', 'order.payment_method',
    'order.order_amount', 'order.payable_amount']) {
    assert.ok(shown.has(key), `基本信息区应默认勾选 ${key}`)
  }
  // 未勾选
  for (const key of ['order.delivery_days', 'order.expected_arrival_date', 'order.freight_bear_type',
    'order.rounding_amount', 'order.use_prepayment_amount', 'order.use_gift_amount']) {
    assert.ok(!shown.has(key), `基本信息区不应默认勾选 ${key}`)
  }

  // 明细区
  for (const key of ['items.row_no', 'items.product_code', 'items.product_name', 'items.specification',
    'items.color', 'items.unit_name', 'items.purchase_price', 'items.qty', 'items.amount']) {
    assert.ok(shown.has(key), `明细区应默认勾选 ${key}`)
  }
  for (const key of ['items.length_text', 'items.received_qty', 'items.remark']) {
    assert.ok(!shown.has(key), `明细区不应默认勾选 ${key}`)
  }
})

test('每个区域都必须至少勾选一个必要字段（不允许空区域）', () => {
  for (const kind of ['purchase', 'sales', 'customerOrder']) {
    const cat = PDF_CATALOGUES[kind]
    const shown = new Set(defaultShownFields(cat))
    for (const section of cat.sections) {
      const hit = section.fields.filter((key) => shown.has(key)).length
      assert.ok(hit > 0,
        `${cat.title} 的「${section.label}」一个字段都没勾选（共 ${section.fields.length} 个字段）`)
    }
  }
})

test('销售与订货单的默认勾选与采购模式一致（主体信息 + 金额都勾上）', () => {
  // 销售：主体信息
  const sales = new Set(defaultShownFields(PDF_CATALOGUES.sales))
  for (const key of ['order.customer_name', 'order.bill_type', 'order.settlement_method',
    'order.delivery_method', 'order.receive_address']) {
    assert.ok(sales.has(key), `销售基本信息应默认勾选 ${key}`)
  }
  // 销售：金额
  for (const key of ['order.total_sales_amount', 'order.receivable_amount', 'order.received_amount',
    'order.total_tax_amount', 'items.discount_price', 'items.line_sales_amount',
    'items.tax_amount', 'items.line_receivable_amount']) {
    assert.ok(sales.has(key), `销售金额字段应默认勾选 ${key}`)
  }

  // 订货单：主体 + 明细
  const cust = new Set(defaultShownFields(PDF_CATALOGUES.customerOrder))
  for (const key of ['order.customer_name', 'order.created_by_name', 'order.created_at', 'order.remark']) {
    assert.ok(cust.has(key), `订货单主单应默认勾选 ${key}`)
  }
  for (const key of ['items.row_no', 'items.product_code', 'items.product_name', 'items.specification',
    'items.color', 'items.unit_name', 'items.qty', 'items.product_type', 'items.project_name']) {
    assert.ok(cust.has(key), `订货单明细应默认勾选 ${key}`)
  }
})

test('默认勾选不得导致「无可见正文」（后端会 400 NO_VISIBLE_PDF_CONTENT）', () => {
  for (const kind of ['purchase', 'sales', 'customerOrder']) {
    const cat = PDF_CATALOGUES[kind]
    const shown = new Set(defaultShownFields(cat))
    const hasInfo = cat.orderFields.some((f) => shown.has(f.key)) || cat.common.some((f) => shown.has(f.key))
    const hasItems = cat.itemFields.some((f) => shown.has(f.key))
    assert.ok(hasInfo || hasItems, `${kind} 默认白名单会导致 400 NO_VISIBLE_PDF_CONTENT`)
  }
})

test('alwaysShownKeys 恰好是那 5 项', () => {
  for (const kind of ['purchase', 'sales', 'customerOrder']) {
    const keys = alwaysShownKeys(PDF_CATALOGUES[kind]).sort()
    assert.deepEqual(keys, [...ALWAYS_SHOW].sort(), `${kind} 强制显示集合不符`)
  }
})

test('白名单为空时回退为全部显示（防空白单据）', () => {
  const empty = {
    kind: 'purchase', title: 'x', hasMoney: false, fallbackFileName: 'x.pdf',
    sections: [], moneyFields: [],
    common: [{ key: 'document.logo', label: 'Logo' }],
    orderFields: [{ key: 'order.supplier_name', label: '供应商' }],
    itemFields: [{ key: 'items.qty', label: '数量' }],
  }
  const shown = defaultShownFields(empty)
  assert.equal(shown.length, 3, '白名单为空时应回退为全部字段，避免导出空单据')
})

test('区域全选会把跨区字段一并加入（后端 hide_fields 语义：影响所有位置）', () => {
  const cat = PDF_CATALOGUES.purchase
  const after = toggleSectionFields(cat, 'basic', [], true)
  assert.ok(after.includes('order.payable_amount'))
  // 该字段同时也出现在 notes，因此 notes 区域会显示为部分勾选
  assert.equal(isSectionPartiallyHidden(cat, 'notes', after), true)
})
