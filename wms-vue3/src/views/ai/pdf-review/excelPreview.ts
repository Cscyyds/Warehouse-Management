// 审核页 Excel 文字预览与编辑（方案 P，2026-10-23）纯逻辑。
// 与 index.vue 的 UI 状态分离，node --test 单测（见 excelPreview.test.mjs）。
//
// 契约要点（后端 Coze_Connect）：
// - 行文本与导出同源：POST /jobs/{id}/review/xlsx-preview → { headers, rows, products }
//   products[i].fields 提供编辑初值（product_name/series_name/product_category/
//   features/installation/precautions/tech_params/tech_params_structured/image_descriptions）
// - 编辑经既有 product_patch 通道提交（POST /review 的 products 决策）：
//   白名单 product_basic / product_description / product_specification 深合并；
// - 特点列一行一条（编号 "1." 由导出侧统一生成，前端只编辑纯文本行）。

import { techEquals, techPatch } from './techParams.ts';

/**
 * 品类闭集 17 条（「一级大类 - 二级类目」全串）。
 * 单一事实源在 Coze_Connect pdf_agent/category_taxonomy.py（TAXONOMY）；
 * 后端导出侧会对清单外取值置空，因此这里用下拉只给合法选项，避免
 * 审核员手填后被静默清空。清单更新时两处同步改。
 */
export const CATEGORY_OPTIONS: readonly string[] = [
  '基础结构与传动 - 铰链系统',
  '基础结构与传动 - 抽屉与滑轨系统',
  '基础结构与传动 - 柜体连接与结构加固件',
  '基础结构与传动 - 开启与支撑结构',
  '全屋收纳与内分隔 - 厨房收纳系统',
  '全屋收纳与内分隔 - 衣柜收纳系统',
  '全屋收纳与内分隔 - 柜内灵动机构（旋转/抽拉）',
  '全屋收纳与内分隔 - 柜内分隔与抽拉件',
  '门控与厨卫空间 - 室内门控五金',
  '门控与厨卫空间 - 水槽与龙头系统',
  '门控与厨卫空间 - 卫浴与阳台五金',
  '智能驱动与照明 - 柜内照明系统',
  '智能驱动与照明 - 智能开关',
  '智能驱动与照明 - 全屋智能系统',
  '智能驱动与照明 - 电源驱动系统',
  '装饰与辅助辅料 - 拉手与外观装饰件',
  '装饰与辅助辅料 - 安装辅料与耗材',
];

/** 单个产品的编辑态（undefined 字段 = 未触碰）。 */
export interface ProductEditState {
  product_name?: string;
  series_name?: string;
  /** 品类（17 条闭集之一或 ''＝未识别；与品牌系列互相独立）。 */
  product_category?: string;
  /** 特点列的文本形态：一行一条（与 features 数组经 textToFeatures 互转）。 */
  featuresText?: string;
  installation?: string;
  precautions?: string;
  /** 技术参数结构化编辑（参数表 + 型号变体行，见 techParams.ts）。 */
  techParams?: import('./techParams.ts').TechEditState;
}

/** 预览端点 products[i].fields 的编辑相关子集。 */
export interface ProductInitialFields {
  product_name?: string;
  series_name?: string;
  product_category?: string;
  features?: string[];
  installation?: string;
  precautions?: string;
  tech_params_structured?: import('./techParams.ts').TechStructuredFields;
}

export interface ProductSubmitEntry {
  product_candidate_id: string;
  action: 'approve' | 'reject';
  product_patch?: Record<string, unknown>;
}

/** features 数组 → textarea 文本（一行一条）。 */
export function featuresToText(features: string[] | null | undefined): string {
  return (features || []).join('\n');
}

/** textarea 文本 → features 数组：按行拆分、去首尾空白、过滤空行。 */
export function textToFeatures(text: string): string[] {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** 批次图片归属的产品 id 列表（去重、保序、剔除空值）。 */
export function batchProductIds(
  items: Array<{ product_candidate_id?: string | null }>
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of items || []) {
    const id = String(item?.product_candidate_id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** 编辑态 → product_patch：仅含与初值不同的字段（改回原样 = 未修改不发送）。 */
export function buildProductPatch(
  edit: ProductEditState | undefined,
  initial: ProductInitialFields | undefined
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (!edit) return patch;
  const init = initial || {};
  const basic: Record<string, unknown> = {};
  const desc: Record<string, unknown> = {};

  if (edit.product_name !== undefined && edit.product_name !== (init.product_name ?? '')) {
    basic.product_name = edit.product_name.trim();
  }
  if (edit.series_name !== undefined && edit.series_name !== (init.series_name ?? '')) {
    basic.series_name = edit.series_name.trim();
  }
  // 品类：下拉取值必在 17 条闭集内（或 ''＝清空/未识别），原样提交，
  // 导出侧还有一道闭集归一兜底
  if (edit.product_category !== undefined
      && edit.product_category !== (init.product_category ?? '')) {
    basic.product_category = edit.product_category.trim();
  }
  if (edit.featuresText !== undefined
      && JSON.stringify(textToFeatures(edit.featuresText)) !== JSON.stringify(init.features || [])) {
    desc.features = textToFeatures(edit.featuresText);
  }
  if (edit.installation !== undefined && edit.installation !== (init.installation ?? '')) {
    desc.installation_instructions = edit.installation.trim();
  }
  if (edit.precautions !== undefined && edit.precautions !== (init.precautions ?? '')) {
    desc.precautions = edit.precautions.trim();
  }
  if (edit.techParams !== undefined && !techEquals(edit.techParams, init.tech_params_structured)) {
    Object.assign(patch, techPatch(edit.techParams));
  }
  if (Object.keys(basic).length) patch.product_basic = basic;
  if (Object.keys(desc).length) patch.product_description = desc;
  return patch;
}

/** 裁剪决策载荷（审核页 REST 直提的 crops[] 同构）。 */
export interface CropDecisionEntry {
  source_crop_id: string;
  action: string;
  product_candidate_id?: string;
  [key: string]: unknown;
}

/**
 * 提交出口合并：未审核产品自动 approve（既有 productApprovals 行为）⨝ 产品编辑。
 * - 已审核产品携带编辑时保留其快照 review_action（不翻转此前决策）；
 * - 空 patch 的编辑项不产生载荷；
 * - 同产品 approvals 与编辑合并为一条（patch 优先合并）；
 * - rejectedProducts（审核页「删除产品」）最后覆盖为 reject，压过自动通过。
 */
export function mergeProductsPayload(
  approvals: Array<{ product_candidate_id: string; action: string }>,
  productPatches: Record<string, Record<string, unknown>>,
  snapshotProducts: Array<{ product_candidate_id: string; review_action?: string | null }>,
  rejectedProducts: Array<{ product_candidate_id: string }> = []
): ProductSubmitEntry[] {
  const actionByPcid = new Map(
    (snapshotProducts || []).map((p) => [p.product_candidate_id, p.review_action || null])
  );
  const merged = new Map<string, ProductSubmitEntry>();
  for (const item of approvals || []) {
    if (!item?.product_candidate_id) continue;
    merged.set(item.product_candidate_id, {
      product_candidate_id: item.product_candidate_id,
      action: 'approve',
    });
  }
  for (const [pcid, patch] of Object.entries(productPatches || {})) {
    if (!pcid || !patch || Object.keys(patch).length === 0) continue;
    const action = merged.get(pcid)?.action || actionByPcid.get(pcid) || 'approve';
    merged.set(pcid, {
      product_candidate_id: pcid,
      action: action === 'reject' ? 'reject' : 'approve',
      product_patch: patch,
    });
  }
  for (const item of rejectedProducts || []) {
    const pcid = item?.product_candidate_id;
    if (!pcid) continue;
    const existing = merged.get(pcid);
    merged.set(pcid, {
      product_candidate_id: pcid,
      action: 'reject',
      ...(existing?.product_patch ? { product_patch: existing.product_patch } : {}),
    });
  }
  return Array.from(merged.values());
}

export interface ManualCropRef {
  source_crop_id: string;
  product_candidate_id?: string;
  pdf_bbox?: number[];
  pdf_page_number?: number;
  image_type?: string;
  description?: string;
}

/**
 * 未入库人工卡片（manual_ 前缀且不在快照）只能以 approve + 完整字段提交。
 * 通用决策按钮会覆盖创建时的完整决策（丢 product/bbox/page），这里用批次 item
 * 的权威字段修复；决策非 approve、产品已删除/不在当前快照、item 缺失或字段
 * 不全的整条剔除——快照里不存在，既无法 reject 也不能创建。
 * 已入库裁剪（含已提交过的 manual_ 卡片）原样返回。
 */
export function normalizeNewManualCrops(
  cropDecisions: CropDecisionEntry[],
  manualRefs: ManualCropRef[],
  snapshotCropIds: string[],
  rejectedProductIds: string[],
  knownProductIds: string[]
): { decisions: CropDecisionEntry[]; dropped: string[] } {
  const inSnapshot = new Set((snapshotCropIds || []).map(String));
  const rejected = new Set((rejectedProductIds || []).map(String));
  const known = new Set((knownProductIds || []).map(String));
  const refById = new Map((manualRefs || []).map((r) => [String(r.source_crop_id), r]));
  const decisions: CropDecisionEntry[] = [];
  const dropped: string[] = [];
  for (const d of cropDecisions || []) {
    const id = String(d?.source_crop_id || '');
    if (!id.startsWith('manual_') || inSnapshot.has(id)) {
      decisions.push(d);
      continue;
    }
    const ref = refById.get(id);
    const pid = String(d?.product_candidate_id || ref?.product_candidate_id || '');
    const bbox = ref?.pdf_bbox;
    const page = Number(ref?.pdf_page_number || 0);
    if (
      d.action !== 'approve'
      || !ref
      || !pid
      || !known.has(pid)
      || rejected.has(pid)
      || !Array.isArray(bbox)
      || bbox.length !== 4
      || !bbox.every((n) => Number.isFinite(n))
      || !(page >= 1)
    ) {
      dropped.push(id);
      continue;
    }
    decisions.push({
      ...d,
      action: 'approve',
      product_candidate_id: pid,
      pdf_bbox: [...bbox],
      pdf_page_number: page,
      ...(d.image_type == null && ref.image_type ? { image_type: ref.image_type } : {}),
      ...(d.description == null && ref.description ? { description: ref.description } : {}),
    });
  }
  return { decisions, dropped };
}

/**
 * 合并裁剪决策：被删除产品名下的裁剪一律 reject（含此前批次已通过的），
 * 覆盖本批 approve/recrop；显式改绑到其他未删除产品的决策保留原样。
 * 后端收尾门禁要求「已通过的裁剪必须绑定已通过产品」，故删产品必须连带删图。
 */
export function mergeDeletedProductCrops(
  cropDecisions: CropDecisionEntry[],
  cropBindings: Array<{ source_crop_id?: string; product_candidate_id?: string }>,
  rejectedProductIds: string[]
): CropDecisionEntry[] {
  const rejected = new Set((rejectedProductIds || []).map((id) => String(id)));
  const byId = new Map<string, CropDecisionEntry>();
  for (const d of cropDecisions || []) {
    if (d?.source_crop_id) byId.set(String(d.source_crop_id), d);
  }
  if (!rejected.size) return Array.from(byId.values());
  for (const c of cropBindings || []) {
    const cid = String(c?.source_crop_id || '');
    if (!cid || !rejected.has(String(c?.product_candidate_id || ''))) continue;
    const current = byId.get(cid);
    // 已改绑到其他未删除产品（人工纠正归属）→ 尊重当前决策
    if (current?.product_candidate_id && !rejected.has(String(current.product_candidate_id))) continue;
    byId.set(cid, { ...(current || {}), source_crop_id: cid, action: 'reject' });
  }
  return Array.from(byId.values());
}

/** 编辑态字段计数（徽标与草稿口径：与初值不同才计数）。 */
export function countProductEdits(
  productEdits: Record<string, ProductEditState>,
  initialByPcid: Record<string, ProductInitialFields>
): number {
  let count = 0;
  for (const [pcid, edit] of Object.entries(productEdits || {})) {
    if (Object.keys(buildProductPatch(edit, initialByPcid[pcid])).length > 0) count += 1;
  }
  return count;
}

/**
 * 预览回放载荷：保留产品审批动作（未审核产品照旧自动通过，保证预览不漏产品），
 * 剥掉 product_patch。
 *
 * 为什么必须剥：预览接口会在快照副本上应用 decisions，把未提交的文字编辑一起
 * 返回；前端拿返回的 fields 当 productEditInitials（diff 基准）→ 基准变成
 * 「你刚改后的值」→ 提交时 buildProductPatch 判定与初值相同 → 改动静默丢掉
 * （2026-11-03 用户实测「改完技术参数提交，导出还是原值」即此）。
 * 基准只能来自「服务端已落库的值」，本地待提交的编辑不得回灌。
 */
export function stripProductPatches(
  products: Array<Record<string, unknown>> | null | undefined
): Array<Record<string, unknown>> {
  return (products || []).map((item) => {
    if (!item || typeof item !== 'object' || !('product_patch' in item)) return item;
    const next = { ...item };
    delete next.product_patch;
    return next;
  });
}
