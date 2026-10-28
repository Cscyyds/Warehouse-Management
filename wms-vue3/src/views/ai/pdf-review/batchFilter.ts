// 条件批量决策纯逻辑（审核页实用性三件套，2026-10-23）。
// 与 ReviewView 的 UI 分离，node --test 单测（见 batchFilter.test.mjs）。
// 语义：只匹配「未决策」项（与「全部通过只补未决」同口径，不覆盖已有决策）；
// 类型/描述取「人工修订后生效值」（改过类型的卡按新类型参与筛选）。

export interface ReviewBatchFilter {
  image_type?: string;   // '' = 全部类型
  product_name?: string; // '' = 全部产品
  keyword?: string;      // 描述/产品名包含（大小写不敏感），'' = 不限
}

export interface ReviewLikeItem {
  source_crop_id: string;
  product_name?: string;
  image_type?: string;
  description?: string;
}

export interface ReviewLikeEdit {
  description?: string;
  image_type?: string;
}

/** 生效类型：修订优先于 AI 原始值（与 ReviewCard displayType 同口径）。 */
export function effectiveType(item: ReviewLikeItem, edits?: Record<string, ReviewLikeEdit>): string {
  const e = edits?.[item.source_crop_id];
  return e && e.image_type !== undefined ? e.image_type : (item.image_type || 'other');
}

/** 生效描述：修订优先（含主动清空 = 空串）。 */
export function effectiveDesc(item: ReviewLikeItem, edits?: Record<string, ReviewLikeEdit>): string {
  const e = edits?.[item.source_crop_id];
  return e && e.description !== undefined ? e.description : (item.description || '');
}

/** 筛选命中且未决策的项（批量决策的目标集合）。 */
export function matchReviewItems(
  items: ReviewLikeItem[],
  filter: ReviewBatchFilter | undefined,
  decisions: Record<string, unknown> | undefined,
  edits?: Record<string, ReviewLikeEdit>
): ReviewLikeItem[] {
  const f = filter || {};
  const keyword = String(f.keyword || '').trim().toLowerCase();
  return (items || []).filter((item) => {
    if (!item?.source_crop_id) return false;
    if (decisions?.[item.source_crop_id]) return false;
    if (f.image_type && effectiveType(item, edits) !== f.image_type) return false;
    if (f.product_name && (item.product_name || '') !== f.product_name) return false;
    if (keyword) {
      const haystack = `${effectiveDesc(item, edits)} ${item.product_name || ''}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
}

/** 当前批次可用的筛选项（去重排序，供下拉）。 */
export function filterOptionValues(
  items: ReviewLikeItem[],
  edits?: Record<string, ReviewLikeEdit>
): { imageTypes: string[]; productNames: string[] } {
  const types = new Set<string>();
  const names = new Set<string>();
  for (const item of items || []) {
    if (!item?.source_crop_id) continue;
    types.add(effectiveType(item, edits));
    const name = String(item.product_name || '').trim();
    if (name) names.add(name);
  }
  return {
    imageTypes: Array.from(types).sort(),
    productNames: Array.from(names).sort(),
  };
}
