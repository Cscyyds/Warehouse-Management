/**
 * 工具：项次 / 序号类「字符串数字」的自然序排序
 *
 * ## 为什么需要它
 * 天心单据的项次列 `erp_item_seq`（及来源项次 `source_item_seq`）在后端是
 * **`VARCHAR(16)`** 列，MySQL 对字符串列做 `ORDER BY` 走的是**字典序**，
 * 于是明细会排成 `1, 10, 11, 2, 3 ...` —— 「项次 10 排在项次 1 后面」。
 *
 * 后端生产模块（`production/query.py::_seq_order`）已经用
 * `ORDER BY LENGTH(col), col` 修好了，但贸易模块（销货单/采购单/两类退回）
 * 至今仍是裸 `ORDER BY erp_item_seq`，所以贸易详情页明细顺序依然错乱。
 *
 * ## 前端能不能自己排？
 * 能。贸易详情页（`views/trade/TradeBillDetail.vue`）的明细是
 * `GET /tenant-trade/{doc}/detail` **一次性全量返回**的，前端只做数组 `slice`
 * 分页，因此行顺序完全由前端决定，不依赖后端排序 —— 前端排即可立刻见效，
 * 不必等后端发版。
 *
 * ## 什么时候才需要动后端
 * 下面两处前端**排不了**（必须后端改，已出待办
 * `D:/WMS/贸易明细项次排序_后端待办_20261008.md`）：
 * 1. 跨单明细分页列表 `GET /tenant-trade/{doc}/items/list`（一页就是一个切片，
 *    单页内部重排会让跨页顺序更乱）；
 * 2. 明细搜索结果 `GET /tenant-trade/{doc}/items/search`（同理，服务端分页）。
 * 这两处后端修好后，本工具对它们自动退化为「不再二次排序」（见 `sortItemsBySeq`
 *    的 `enabled` 语义），两侧都改也不会打架。
 *
 * ## 排序规则
 * 纯数字串按**数值**升序（1,2,...,9,10,11）；非纯数字值退回字典序，
 * 排在数字串之后 —— 与后端 `_seq_order` 的语义一致，跨方言安全。
 */

const NUMERIC_RE = /^\d+$/

/** 单个值是否可按数值比较 */
function isNumeric(value: string): boolean {
  return NUMERIC_RE.test(value)
}

/** 取排序用键值：非字符串/空值统一归到末尾，避免 null 参与比较抛错 */
function seqKey(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

/**
 * 项次比较器（数值优先，非数字靠后）。
 *
 * - 两边都是纯数字串 → 按数值比较（`2 < 10`）；
 * - 一边数字一边非数字 → 数字在前；
 * - 两边都非数字 → 按字典序（与 MySQL 字符串列行为一致）；
 * - 相等时返回 0，交由 `Array.prototype.sort` 的稳定性保持原顺序。
 */
export function compareItemSeq(a: unknown, b: unknown): number {
  const sa = seqKey(a)
  const sb = seqKey(b)
  const na = isNumeric(sa)
  const nb = isNumeric(sb)
  if (na && nb) {
    const da = Number(sa)
    const db = Number(sb)
    if (da !== db) return da - db
    // 数值相同但字面不同（如 '01' 与 '1'）：仍按字典序兜底，保证全序稳定
    return sa < sb ? -1 : sa > sb ? 1 : 0
  }
  if (na !== nb) return na ? -1 : 1
  if (sa === sb) return 0
  return sa < sb ? -1 : 1
}

/** 按项次比较器对「只含 erp_item_seq 字段的对象数组」排序（返回新数组，不改原数组） */
export function sortItemsBySeq<T extends Record<string, unknown>>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => compareItemSeq(a.erp_item_seq, b.erp_item_seq))
}