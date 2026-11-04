/**
 * ERP 单据「家族」注册表：把贸易（/tenant-trade，5 单据）与借出借入（/tenant-borrow，4 单据）
 * 统一成一套可参数化的元数据，供 TradeBillList / TradeBillDetail / SyncRejectPanel
 * 三个通用组件复用（2026-11-03 家族化改造，替代复制一套 Borrow* 组件）。
 *
 * 为什么需要：
 *   - 两族协议逐字同构（page/date_from/sort/search_field JSON + Form 重复字段 + 409 语义），
 *     差异只在 basePath / URL 段 / 侧名（purchase|sales ↔ in|out）/ ID 前缀 / 失败记录 doc_key 前缀；
 *   - 复制一套 1200 行组件会让每个已修硬伤（Form list[str]、409 冷却、补录去重）双倍维护。
 *
 * ⚠️ 组件侧只消费本文件导出的函数，不再直接持 basePath / 侧名。
 */
import { TRADE_DOC_CONFIG_MAP, TRADE_DOC_TITLES, TRADE_DOC_LIST_PATH, type TradeDocConfig } from './tradeDocConfig'
import {
  BORROW_DOC_CONFIG_MAP,
  BORROW_DOC_TITLES,
  BORROW_DOC_META,
  BORROW_DOC_LIST_PATH,
  type BorrowDocConfig,
} from './borrowDocConfig'

export type ErpFamilyKey = 'trade' | 'borrow'

export interface ErpFamilyDoc {
  docKey: string
  /** URL 段（trade 与 docKey 同值；borrow 为 in-order 等短段） */
  segment: string
  /** 展示名（同时是路由守卫/菜单/页签的标题键） */
  name: string
  /** 所属侧（失败记录/重启按侧组织）：trade=purchase|sales，borrow=in|out */
  side: string
}

export interface ErpFamilyMeta {
  key: ErpFamilyKey
  /** 接口前缀（拼 /${segment}/list 等） */
  basePath: string
  /** 详情页路由前缀（/trade | /borrow），完整路径 = `${detailBase}/${docKey}/detail/${billId}` */
  detailBase: string
  docs: ErpFamilyDoc[]
  /** 侧 → 中文名 */
  sideLabels: Record<string, string>
  /** docKey → 列表页路径（详情页「返回列表」） */
  listPath: Record<string, string>
}

export const ERP_FAMILIES: Record<ErpFamilyKey, ErpFamilyMeta> = {
  trade: {
    key: 'trade',
    basePath: '/api/v1/tenant-trade',
    detailBase: '/trade',
    docs: [
      { docKey: 'purchase-order', segment: 'purchase-order', name: TRADE_DOC_TITLES['purchase-order'], side: 'purchase' },
      { docKey: 'purchase-return', segment: 'purchase-return', name: TRADE_DOC_TITLES['purchase-return'], side: 'purchase' },
      { docKey: 'sales-order', segment: 'sales-order', name: TRADE_DOC_TITLES['sales-order'], side: 'sales' },
      { docKey: 'sales-return', segment: 'sales-return', name: TRADE_DOC_TITLES['sales-return'], side: 'sales' },
      // ⛔ 2026-11-04 临时停用本次适配：出库单 CK 从贸易族摘除（销售侧恢复两线：SA+SB）
      // // CK 随销售侧同步/对账/重启（销售侧三线：SA+SB+CK）
      // { docKey: 'outbound-order', segment: 'outbound-order', name: TRADE_DOC_TITLES['outbound-order'], side: 'sales' },
    ],
    sideLabels: { purchase: '采购', sales: '销售' },
    // 4 个共享 WMS 页（出库单独立页已随适配下线）
    listPath: { ...TRADE_DOC_LIST_PATH },
  },
  borrow: {
    key: 'borrow',
    basePath: '/api/v1/tenant-borrow',
    detailBase: '/borrow',
    docs: Object.keys(BORROW_DOC_META).map((docKey) => ({
      docKey,
      segment: BORROW_DOC_META[docKey].segment,
      name: BORROW_DOC_TITLES[docKey],
      side: BORROW_DOC_META[docKey].side,
    })),
    sideLabels: { in: '借入', out: '借出' },
    listPath: { ...BORROW_DOC_LIST_PATH },
  },
}

export type ErpDocConfig = TradeDocConfig | BorrowDocConfig

interface ResolvedErpDoc {
  family: ErpFamilyMeta
  doc: ErpFamilyDoc
}

const DOC_INDEX: Map<string, ResolvedErpDoc> = (() => {
  const map = new Map<string, ResolvedErpDoc>()
  for (const family of Object.values(ERP_FAMILIES)) {
    for (const doc of family.docs) map.set(doc.docKey, { family, doc })
  }
  return map
})()

/** docKey → {family, doc}；未知 docKey 返回 null（组件据此渲染空态，不抛错） */
export function resolveErpDoc(docKey: string): ResolvedErpDoc | null {
  return DOC_INDEX.get(String(docKey || '')) || null
}

/** docKey → 列配置（贸易 / 借出借入两套 config 的合并视图） */
export function erpDocConfig(docKey: string): ErpDocConfig | undefined {
  return TRADE_DOC_CONFIG_MAP[docKey] || BORROW_DOC_CONFIG_MAP[docKey]
}

/** docKey → 页面标题（守卫 effectiveTitle / 页签 / 详情页共用） */
export function erpDocTitle(docKey: string): string | undefined {
  return DOC_INDEX.get(String(docKey || ''))?.doc.name
}

/** 某族某侧的全部单据线（重启/失败记录下拉按此生成，顺序 = 菜单顺序） */
export function erpSideDocs(familyKey: ErpFamilyKey, side: string): ErpFamilyDoc[] {
  return ERP_FAMILIES[familyKey].docs.filter((d) => d.side === side)
}

/**
 * 失败记录表的 doc_key：trade 族带 `trade-` 前缀（trade-sales-order），
 * borrow 族为裸值（borrow-in-order，后端 record_reject 直接落 doc_key）。
 */
export function erpRejectDocKey(familyKey: ErpFamilyKey, docKey: string): string {
  return familyKey === 'trade' ? `trade-${docKey}` : docKey
}

/** 详情页路径 */
export function erpDetailPath(docKey: string, billId: string): string {
  const resolved = resolveErpDoc(docKey)
  const base = resolved?.family.detailBase || '/trade'
  return `${base}/${docKey}/detail/${billId}`
}

/** 列表页路径（详情页返回用） */
export function erpListPath(docKey: string): string | undefined {
  return DOC_INDEX.get(String(docKey || ''))?.family.listPath[docKey]
}

/**
 * 后端重启响应的 doc_lines 归一化为展示名：
 * trade 为 `trade-sales-order`（带前缀），borrow 为 `borrow-in-order`（裸值），两种都要兼容。
 */
export function erpDocLineName(familyKey: ErpFamilyKey, line: string): string {
  const raw = String(line || '')
  const docKey = raw.startsWith('trade-') ? raw.slice('trade-'.length) : raw
  const doc = ERP_FAMILIES[familyKey].docs.find((d) => d.docKey === docKey)
  return doc?.name || raw
}
