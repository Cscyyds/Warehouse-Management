// 边识别边审核（方案 B 阶段1）纯逻辑：批次切分与增量到货合并。
// 与 index.vue 的 UI 状态分离，node --test 单测（见 reviewStream.test.mjs）。

/** 待审项按 8 张/批切分（与既有 loadReviewSnapshot 的切批口径一致）。 */
export function chunkBatches(items: Array<Record<string, unknown>>, size = 8): Array<{ items: Array<Record<string, unknown>> }> {
  const list = items || [];
  const batches: Array<{ items: Array<Record<string, unknown>> }> = [];
  for (let i = 0; i < list.length; i += size) batches.push({ items: list.slice(i, i + size) });
  return batches;
}

/**
 * 增量到货合并：新到的待审项作为新批次 append 到既有批次尾部。
 * - 按 source_crop_id 去重（轮询抖动/重复到货安全）；
 * - 不回填既有批次（可预测：已见批次不变，新货永远是新批）；
 * - 既有本地态（decisions/edits/草稿）由调用方持有，本函数不触碰。
 * 返回 { batches, appended }（appended = 实际并入的张数）。
 */
export function mergeArrivals(
  existingBatches: Array<{ items: Array<Record<string, unknown>> }>,
  arrivals: Array<Record<string, unknown>>
): { batches: Array<{ items: Array<Record<string, unknown>> }>; appended: number } {
  const known = new Set(
    (existingBatches || []).flatMap((b) => (b.items || []).map((x) => String(x?.source_crop_id || '')))
  );
  const fresh = (arrivals || []).filter((x) => {
    const id = String(x?.source_crop_id || '');
    return id && !known.has(id);
  });
  if (!fresh.length) return { batches: existingBatches || [], appended: 0 };
  const batches = [...(existingBatches || [])];
  // 既有列表可能含占位空批（无待审时 [{items: []}]）：清掉再并
  const cleaned = batches.filter((b) => (b.items || []).length > 0);
  return { batches: [...cleaned, ...chunkBatches(fresh, 8)], appended: fresh.length };
}
