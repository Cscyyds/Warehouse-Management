// 人工新增审核卡片的纯逻辑（提交前只存在于前端）。
// 与 index.vue 的 UI 状态分离，便于 vitest 单测（见 manualCard.test.mjs）。
//
// 契约要点（后端 submit_pdf_review，Coze_Connect service/pdf_publish_service.py）：
// - source_crop_id 必须带 manual_ 前缀，后端才放行快照外的 crop_id；
// - 决策只能是 approve（创建即已决），携带 pdf_bbox + pdf_page_number + product_candidate_id；
// - 描述/图片类型走 edits（与「修改描述」修订同口径），提交出口 selected 合并。

/** 生成人工卡片 id：manual_ 前缀 + 时间戳 + 随机后缀（刷新/多标签页下唯一）。 */
export function newManualCropId(): string {
  const rand = Math.random().toString(16).slice(2, 10);
  return `manual_${Date.now().toString(16)}${rand}`;
}

/** 合成卡片 item（注入审核批次；字段与快照 crop_binding 同构，ReviewCard 直接可用）。 */
export function buildManualCardItem(fields: {
  product_candidate_id: string;
  product_name?: string;
  image_type?: string;
  description?: string;
  pdf_page_number: number;
  pdf_bbox: number[];
  preview_url?: string;
  page_preview_url?: string;
}) {
  return {
    source_crop_id: newManualCropId(),
    product_name: fields.product_name || '',
    image_type: fields.image_type || 'other',
    pdf_page_number: fields.pdf_page_number,
    description: (fields.description || '').trim(),
    pdf_bbox: fields.pdf_bbox,
    product_candidate_id: fields.product_candidate_id,
    preview_url: fields.preview_url || '',
    page_preview_url: fields.page_preview_url || '',
    source_bbox: [0, 0, 1, 1],
    manual: true
  };
}

/** item → 审核决策（后端 manual_ 契约只收 approve）。 */
export function manualCropDecision(item: Record<string, any>) {
  return {
    source_crop_id: item.source_crop_id,
    action: 'approve' as const,
    pdf_bbox: item.pdf_bbox,
    pdf_page_number: item.pdf_page_number,
    product_candidate_id: item.product_candidate_id
  };
}

/** item → 人工修订（描述/类型），提交出口与 decisions 合并。 */
export function manualCropEdit(item: Record<string, any>) {
  return { description: item.description, image_type: item.image_type };
}

/** 草稿合并：把历史草稿里的 manualCards 注入目标批次，跳过已存在的 id。 */
export function mergeDraftManualCards(
  batches: Array<{ items: any[] }>,
  draftCards: any[]
): { injected: any[]; batches: Array<{ items: any[] }> } {
  const existing = new Set(batches.flatMap(b => b.items).map(x => x.source_crop_id));
  const injected = (draftCards || []).filter(
    c => c && c.source_crop_id && !existing.has(c.source_crop_id)
  );
  if (!injected.length) return { injected, batches };
  const target = batches.find(b => b.items.length) || batches[0];
  if (!target) return { injected, batches };
  target.items.push(...injected);
  return { injected, batches };
}

/**
 * 新增卡片「绑定产品」下拉按当前批次收敛：
 * 本批卡片（AI 候选 + 本会话新增）绑定过的产品 → inBatch（保持产品列表原序），
 * 其余 → others。本批没有任何有效关联时 inBatch 为空，调用方回退全量
 * （如整批都是未绑定产品，收敛会变成空栏）。
 */
export function splitProductsByBatch<T extends { product_candidate_id: string }>(
  items: Array<{ product_candidate_id?: string }>,
  products: T[]
): { inBatch: T[]; others: T[] } {
  const ids = new Set(
    (items || []).map(x => x?.product_candidate_id).filter(Boolean)
  );
  const list = products || [];
  return {
    inBatch: list.filter(p => ids.has(p.product_candidate_id)),
    others: list.filter(p => !ids.has(p.product_candidate_id))
  };
}

/**
 * 新增卡片「页码条」按当前批次收敛：本批卡片（AI 候选 + 本会话新增）的
 * 物理页码 ±1（防产品跨页展示相关数据），去重升序。本批无任何有效页码时
 * 返回空数组，调用方回落全量页码（页码条不空栏）。
 */
export function addPageCandidatesFor(
  items: Array<{ pdf_page_number?: number | null }>,
  pageCount: number
): number[] {
  const seen = new Set<number>();
  for (const it of items || []) {
    const p = Number(it?.pdf_page_number);
    if (!(p >= 1)) continue;
    for (const n of [p - 1, p, p + 1]) {
      if (n >= 1 && (!pageCount || n <= pageCount)) seen.add(n);
    }
  }
  return [...seen].sort((a, b) => a - b);
}
