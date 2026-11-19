import { buildTechMergePreview, flattenSupplementModel, type ExtractedData, type ExtractedVariant } from './imageExtract.ts';
import { isVariantIdentityKey, type TechEditState } from './techParams.ts';

export interface TechAllocationProduct {
  id: string;
  name: string;
  model: string;
  itemNo: string;
  supplement?: boolean;
  tech: TechEditState;
}

const normalizeCode = (code: unknown) => String(code ?? '').trim().toLowerCase();

function identityEntries(variant: ExtractedVariant) {
  return Object.entries(variant).filter(([key, value]) => isVariantIdentityKey(key) && normalizeCode(value));
}

export function variantCodes(variant: ExtractedVariant): string[] {
  return [...new Set(identityEntries(variant).map(([, value]) => String(value).trim()))];
}

export function allocateTechRows(variants: ExtractedVariant[], products: TechAllocationProduct[]) {
  const byCode = new Map<string, Set<string>>();
  for (const product of products) {
    const codes = [product.model, product.itemNo, ...product.tech.variants.flatMap(row =>
      row.filter(entry => isVariantIdentityKey(entry.key)).map(entry => entry.value))];
    for (const code of codes.map(normalizeCode).filter(Boolean)) {
      const ids = byCode.get(code) ?? new Set<string>();
      ids.add(product.id);
      byCode.set(code, ids);
    }
  }

  const seen = new Set<string>();
  return variants.flatMap(raw => {
    const variant = Object.fromEntries(Object.entries(raw || {}).map(([key, value]) =>
      [key.trim(), String(value ?? '').trim()]).filter(([key, value]) => key && value));
    const entries = Object.entries(variant);
    const fingerprint = JSON.stringify(entries.sort(([a], [b]) => a.localeCompare(b)));
    if (!entries.length || seen.has(fingerprint)) return [];
    seen.add(fingerprint);
    const codes = variantCodes(variant);
    const ids = new Set(codes.flatMap(code => [...(byCode.get(normalizeCode(code)) ?? [])]));
    return [{ variant, productId: ids.size === 1 ? [...ids][0] : '', model: '',
      reason: ids.size > 1 ? '型号或货号匹配到多个产品' : codes.length ? '未匹配到产品' : '未识别出型号或货号' }];
  });
}

type AllocationRow = ReturnType<typeof allocateTechRows>[number];

export function buildAllocatedTechPreview(product: TechAllocationProduct, rows: AllocationRow[],
  commonParams: ExtractedData['params']) {
  if (product.supplement && !product.tech.variants.length && rows.length) {
    const variants = rows.map(({ variant, model }) => model.trim() ? { ...variant, 型号: model.trim() } : variant);
    const source = { params: commonParams, variants };
    const flattened = flattenSupplementModel(source, [product.model, product.itemNo]);
    if (flattened !== source) return { preview: buildTechMergePreview(product.tech, flattened), ambiguous: false };
  }
  const preview = buildTechMergePreview(product.tech, { params: commonParams });
  const existing = product.tech.variants.map(row => new Set(row
    .filter(entry => isVariantIdentityKey(entry.key)).map(entry => normalizeCode(entry.value)).filter(Boolean)));
  const usedCodes = new Set<string>();
  const usedRows = new Set<number>();
  let ambiguous = false;
  for (const { variant, model } of rows) {
    const input = model.trim() ? { ...variant, 型号: model.trim() } : variant;
    const codes = variantCodes(input).map(normalizeCode);
    const matches = existing.map((row, index) => codes.some(code => row.has(code)) ? index : -1)
      .filter(index => index >= 0);
    const index = matches[0] ?? -1;
    if (matches.length > 1 || codes.some(code => usedCodes.has(code)) || usedRows.has(index)) {
      ambiguous = true;
    }
    codes.forEach(code => usedCodes.add(code));
    if (index >= 0) usedRows.add(index);

    // 用已有变体的身份字段定位合并行，保留表里的其他型号标识。
    const existingRow = product.tech.variants[index] ?? [];
    const existingModel = existingRow.find(entry => entry.key.trim() === '型号' && normalizeCode(entry.value));
    const entries = identityEntries(input);
    const modelValue = (entries.find(([key]) => ['型号', '产品型号', '型号编码', '型号代码', 'model', 'product_model']
      .includes(key.trim().toLowerCase())) ?? entries[0])?.[1];
    if (modelValue) {
      const incoming = { 型号: existingModel?.value || modelValue, ...input };
      // 已有身份字段含等价编码时保留原写法。
      for (const entry of existingRow) {
        if (isVariantIdentityKey(entry.key) && normalizeCode(incoming[entry.key]) === normalizeCode(entry.value)) {
          incoming[entry.key] = entry.value;
        }
      }
      preview.variants.push(...buildTechMergePreview(product.tech, { variants: [incoming] }, index).variants);
    }
  }
  return { preview, ambiguous };
}
