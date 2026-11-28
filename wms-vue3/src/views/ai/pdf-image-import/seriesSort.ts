/**
 * 图片源导入（按产品）：产品「系列」归属与按系列聚集排序。
 *
 * 背景：后端 scan 按目录名字典序返回（`449_` < `44_`，因为 `9` < `_`），
 * 同一系列的产品会被别的系列穿插，表格上看是乱的，一键勾选 50 个也会跨系列乱抓。
 * 这里把产品名的主分组前缀抽成「系列」，扫描后按系列聚集：一个系列一段往下排。
 *
 * 真实 510 个目录里三种命名都要能认：
 *   1) 显式系列：`拉斐系列-阻尼衣物皮革篮` → 拉斐系列；`小犀牛系列(C款)-四段力阻尼铰链` → 小犀牛系列
 *   2) 破折号/下划线分类：`玻璃柜—玻璃中岛柜` → 玻璃柜；`3C适配器电源_24V` → 3C适配器电源
 *   3) 无分隔的独立产品：`AI鞋柜净魔方` → 自身（自成一组）
 */

export interface ImageProductRow {
  folder: string;
  pid?: string | number | null;
  product_name?: string | null;
  image_count?: number | null;
  [key: string]: unknown;
}

export type SeriesRow<T extends ImageProductRow> = T & { series: string };

/** 「系列」标记：最多 20 字的主体 + 系列二字，避免长名字中间的「系列」误命中。 */
const SERIES_MARK_RE = /^(.{1,20}?)系列/;
/** 分类分隔符：长破折号、短破折号、连字符、下划线、全角/半角冒号。 */
const SERIES_SEP_RE = /[—–\-_：:]/;
const PID_RE = /^\d+$/;
const FALLBACK_SERIES = '未分组';

/** 切分点是否落在未闭合的括号里（`…功率开关Ⅱ（2_拼线）` 这种脏名字不切）。 */
export function hasOpenBracket(text: string): boolean {
  let depth = 0;
  for (const ch of text) {
    if (ch === '（' || ch === '(') depth += 1;
    else if (ch === '）' || ch === ')') depth = Math.max(0, depth - 1);
  }
  return depth > 0;
}

/** 从产品名抽系列名；认不出来时用整个产品名自成一组。 */
export function seriesKey(productName?: string | null): string {
  const text = String(productName ?? '').trim();
  if (!text) return '';
  const mark = text.match(SERIES_MARK_RE);
  if (mark) return `${mark[1].trim()}系列`;
  const sep = text.search(SERIES_SEP_RE);
  if (sep > 0) {
    const head = text.slice(0, sep).trim();
    // 纯数字前缀是商品编码（`10020120-立式置物菜板架`），不是系列名
    if (head && !PID_RE.test(head) && !hasOpenBracket(head)) return head;
  }
  return text;
}

/** pid 取数值比较（目录名前缀）；缺失或非法排到最后。 */
export function pidValue(row?: ImageProductRow | null): number {
  const value = Number(row?.pid);
  return Number.isFinite(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
}

/**
 * 按系列聚集排序：
 * - 组间：该系列的最小 pid 升序（等同产品编号顺序）；
 * - 组内：有图的在前，再按 pid 升序。
 * 这样同系列严格连续，一键勾选就是从当前系列往下补。
 */
export function sortBySeries<T extends ImageProductRow>(
  rows?: T[] | null
): SeriesRow<T>[] {
  const decorated = (rows ?? []).map((row) => ({
    row,
    series: seriesKey(row?.product_name ?? row?.folder),
    usable: row?.image_count ? 0 : 1
  }));
  const minPid = new Map<string, number>();
  for (const item of decorated) {
    const pid = pidValue(item.row);
    const prev = minPid.get(item.series);
    if (prev === undefined || pid < prev) minPid.set(item.series, pid);
  }
  decorated.sort((a, b) =>
    minPid.get(a.series)! - minPid.get(b.series)!
    || String(a.series).localeCompare(String(b.series), 'zh-Hans-CN')
    || a.usable - b.usable
    || pidValue(a.row) - pidValue(b.row)
    || String(a.row.folder).localeCompare(String(b.row.folder), 'zh-Hans-CN'));
  return decorated.map((item) => ({ ...item.row, series: item.series }));
}

/** 勾选结果的系列归属摘要（最多列 3 个系列，其余折成「等 N 个系列」）。 */
export function seriesSummary(rows?: Array<{ series?: string | null }> | null): string {
  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    const key = String(row?.series ?? '').trim() || FALLBACK_SERIES;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const text = entries.slice(0, 3).map(([key, count]) => `${key} ×${count}`).join('、');
  return entries.length > 3 ? `${text} 等 ${entries.length} 个系列` : text;
}
