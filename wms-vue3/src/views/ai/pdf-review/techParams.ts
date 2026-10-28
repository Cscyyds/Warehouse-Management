// 技术参数结构化编辑纯逻辑（方案 A，2026-10-23）。
// 用户全程不接触 JSON：编辑态是「参数表 + 变体行（键值对）」，
// 组装/初值解析在此完成，node --test 单测（见 techParams.test.mjs）。
//
// 契约（后端 Coze_Connect）：
// - 初值：preview fields.tech_params_structured = { params: [{name,value}], variants: [{任意键:值}] }
//   （与导出 _tech_params 同一收集函数产出，编辑初值 = 导出所见）
// - 提交：product_patch.product_specification = {
//     technical_parameters: [ {parameter_name, parameter_value}…, …变体原样行 ],
//     other_parameters: { common_parameters: [], model_variants: [] }
//     // 旧来源显式清空（_merge_patch 对空 dict 是无操作，必须用空列表整体替换）
//   }（_merge_patch：list 整体替换、dict 深合并）

export interface TechParamRow { name: string; value: string }
export interface TechVariantEntry { key: string; value: string }
/** 一个型号变体 = 若干键值对（键名不固定：型号/长度/备注…） */
export type TechVariantRow = TechVariantEntry[];
export interface TechEditState { params: TechParamRow[]; variants: TechVariantRow[] }

export interface TechStructuredFields {
  params?: Array<{ name?: string; value?: string }>;
  variants?: Array<Record<string, unknown>>;
}

function normName(v: unknown): string { return String(v ?? '').trim(); }

/** 初值 → 编辑态（variants dict → 键值对数组，保持插入序）。 */
export function techEditFromFields(fields: TechStructuredFields | undefined): TechEditState {
  const f = fields || {};
  return {
    params: (f.params || []).map((p) => ({ name: normName(p?.name), value: normName(p?.value) })),
    variants: (f.variants || []).map((v) =>
      Object.entries(v || {}).map(([key, value]) => ({ key, value: normName(value) }))
    ),
  };
}

/** 编辑态 → product_specification patch（整体替换 + 清空旧来源）；空态也产出（=清空参数）。 */
export function techPatch(edit: TechEditState | undefined): Record<string, unknown> {
  const params = (edit?.params || [])
    .filter((p) => p && normName(p.name) && normName(p.value))
    .map((p) => ({ parameter_name: normName(p.name), parameter_value: normName(p.value) }));
  const variants = (edit?.variants || [])
    .map((row) => Object.fromEntries(
      (row || [])
        .filter((e) => e && normName(e.key))
        .map((e) => [normName(e.key), normName(e.value)])
    ))
    .filter((obj) => Object.keys(obj).length > 0);
  return {
    product_specification: {
      technical_parameters: [...params, ...variants],
      // 空列表整体替换以清空旧来源（空 dict 深合并=无操作，旧参数会残留）
      other_parameters: { common_parameters: [], model_variants: [] },
    },
  };
}

/** 归一化后深比较：改回原样 = 不发送 patch。 */
export function techEquals(edit: TechEditState | undefined, fields: TechStructuredFields | undefined): boolean {
  if (!edit) return true;
  return JSON.stringify(techPatch(edit)) === JSON.stringify(techPatch(techEditFromFields(fields)));
}

/** 同名参数软提醒（导出口径：同名值以「；」拼接，允许保留）。 */
export function duplicateParamNames(rows: Array<TechParamRow> | undefined): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const row of rows || []) {
    const name = normName(row?.name);
    if (!name) continue;
    if (seen.has(name)) dup.add(name);
    seen.add(name);
  }
  return Array.from(dup);
}
