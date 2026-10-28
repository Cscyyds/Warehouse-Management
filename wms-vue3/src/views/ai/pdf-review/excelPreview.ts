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

/**
 * 提交出口合并：未审核产品自动 approve（既有 productApprovals 行为）⨝ 产品编辑。
 * - 已审核产品携带编辑时保留其快照 review_action（不翻转此前决策）；
 * - 空 patch 的编辑项不产生载荷；
 * - 同产品 approvals 与编辑合并为一条（patch 优先合并）。
 */
export function mergeProductsPayload(
  approvals: Array<{ product_candidate_id: string; action: string }>,
  productPatches: Record<string, Record<string, unknown>>,
  snapshotProducts: Array<{ product_candidate_id: string; review_action?: string | null }>
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
  return Array.from(merged.values());
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
