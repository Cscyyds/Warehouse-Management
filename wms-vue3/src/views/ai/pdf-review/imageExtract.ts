// 二次图片识别结果的合并纯逻辑（2026-11-11）。
// 与后端 service/pdf_reimage_service.py 的返回结构对应：
// { target, params: [{name,value}], variants: [{型号:值,...}], features: [..], warnings: [..] }
// 合并策略默认「追加去重」；冲突处理在弹窗里由用户确认，纯函数可单测。
import type { TechEditState } from './techParams.ts';
import { isVariantIdentityKey } from './techParams.ts';

export interface ExtractedParam {
  name?: string;
  value?: string;
}

export type ExtractedVariant = Record<string, unknown>;

export interface ExtractedData {
  target?: string;
  params?: ExtractedParam[];
  variants?: ExtractedVariant[];
  features?: string[];
  warnings?: string[];
  model?: string;
}

export type ConflictPolicy = 'append' | 'keep' | 'overwrite' | 'skip';

export interface TechParamPreview {
  name: string;
  incoming: string;
  existing: string;
  kind: 'add' | 'same' | 'conflict';
}

export interface TechVariantFieldPreview {
  key: string;
  incoming: string;
  existing: string;
  kind: 'add' | 'same' | 'conflict';
}

export interface TechVariantPreview {
  modelKey: string;
  modelValue: string;
  kind: 'add' | 'merge';
  targetIndex: number;
  incoming: Record<string, string>;
  fields: TechVariantFieldPreview[];
}

export interface TechMergePreview {
  params: TechParamPreview[];
  variants: TechVariantPreview[];
}

export interface FeaturePreviewItem {
  text: string;
  duplicate: boolean;
}

function norm(value: unknown): string {
  return String(value ?? '').trim();
}

/** 追加去重：旧值已包含新值时原样返回；否则用「；」拼接。 */
export function appendValue(existing: string, incoming: string): string {
  const oldValue = norm(existing);
  const newValue = norm(incoming);
  if (!newValue) return oldValue;
  if (!oldValue) return newValue;
  const parts = oldValue.split(/\s*[；;]\s*/).map((part) => part.trim()).filter(Boolean);
  const key = newValue.toLowerCase();
  if (parts.some((part) => part.toLowerCase() === key)) return oldValue;
  return `${oldValue}；${newValue}`;
}

function cleanVariant(raw: ExtractedVariant): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw || {})) {
    const name = norm(key);
    const text = norm(value);
    if (name && text) out[name] = text;
  }
  return out;
}

function identityKeyOf(row: Record<string, string>): string {
  for (const key of Object.keys(row)) {
    if (isVariantIdentityKey(key) && norm(row[key])) return key;
  }
  return '';
}

function findVariantIndex(
  current: TechEditState | undefined,
  modelKey: string,
  modelValue: string
): number {
  if (!modelKey || !modelValue) return -1;
  const key = modelKey.toLowerCase();
  const value = modelValue.toLowerCase();
  return (current?.variants || []).findIndex((row) =>
    row.some((entry) =>
      norm(entry?.key).toLowerCase() === key
      && norm(entry?.value).toLowerCase() === value
    )
  );
}

/** 识别结果 vs 当前技术参数：列出新增/同值/冲突，不修改入参。 */
export function buildTechMergePreview(
  current: TechEditState | undefined,
  extracted: ExtractedData | undefined
): TechMergePreview {
  const params: TechParamPreview[] = [];
  const seenParamNames = new Set<string>();
  for (const raw of extracted?.params || []) {
    const name = norm(raw?.name);
    const incoming = norm(raw?.value);
    if (!name || !incoming || seenParamNames.has(name)) continue;
    seenParamNames.add(name);
    const existingRow = (current?.params || []).find((row) => norm(row?.name) === name);
    const existing = norm(existingRow?.value);
    params.push({
      name,
      incoming,
      existing,
      kind: !existingRow ? 'add' : existing === incoming ? 'same' : 'conflict',
    });
  }

  const variants: TechVariantPreview[] = [];
  const seenVariants = new Set<string>();
  for (const raw of extracted?.variants || []) {
    const incoming = cleanVariant(raw);
    if (!Object.keys(incoming).length) continue;
    const modelKey = identityKeyOf(incoming);
    const modelValue = modelKey ? incoming[modelKey] : '';
    const variantKey = modelKey ? `${modelKey.toLowerCase()}=${modelValue.toLowerCase()}` : '';
    if (variantKey && seenVariants.has(variantKey)) continue;
    if (variantKey) seenVariants.add(variantKey);

    const targetIndex = findVariantIndex(current, modelKey, modelValue);
    const targetRow = targetIndex >= 0 ? (current?.variants || [])[targetIndex] : null;
    const existingMap = new Map<string, string>();
    for (const entry of targetRow || []) {
      const key = norm(entry?.key);
      if (key && !existingMap.has(key)) existingMap.set(key, norm(entry?.value));
    }
    const fields: TechVariantFieldPreview[] = Object.entries(incoming).map(([key, value]) => {
      const has = existingMap.has(key);
      const existing = existingMap.get(key) ?? '';
      return {
        key,
        incoming: value,
        existing,
        kind: !has ? 'add' : existing === value ? 'same' : 'conflict',
      };
    });
    variants.push({
      modelKey,
      modelValue,
      kind: targetIndex >= 0 ? 'merge' : 'add',
      targetIndex,
      incoming,
      fields,
    });
  }

  return { params, variants };
}

/** 应用技术参数合并；冲突按 policy 处理（默认追加去重），新增项始终加入。 */
export function applyTechMerge(
  current: TechEditState | undefined,
  preview: TechMergePreview | undefined,
  policy: ConflictPolicy = 'append'
): TechEditState {
  const next: TechEditState = {
    params: (current?.params || []).map((row) => ({ ...row })),
    variants: (current?.variants || []).map((row) => row.map((entry) => ({ ...entry }))),
  };

  for (const item of preview?.params || []) {
    if (item.kind === 'add') {
      next.params.push({ name: item.name, value: item.incoming });
      continue;
    }
    if (item.kind !== 'conflict') continue;
    if (policy === 'keep' || policy === 'skip') continue;
    const target = next.params.find((row) => norm(row?.name) === item.name);
    if (!target) {
      next.params.push({ name: item.name, value: item.incoming });
      continue;
    }
    target.value = policy === 'overwrite'
      ? item.incoming
      : appendValue(target.value, item.incoming);
  }

  for (const item of preview?.variants || []) {
    if (item.kind === 'add' || item.targetIndex < 0) {
      next.variants.push(
        Object.entries(item.incoming).map(([key, value]) => ({ key, value }))
      );
      continue;
    }
    const target = next.variants[item.targetIndex];
    if (!target) continue;
    for (const field of item.fields) {
      if (field.kind === 'same') continue;
      const existingEntry = target.find((entry) => norm(entry?.key) === field.key);
      if (field.kind === 'add' || !existingEntry) {
        target.push({ key: field.key, value: field.incoming });
        continue;
      }
      if (policy === 'keep' || policy === 'skip') continue;
      existingEntry.value = policy === 'overwrite'
        ? field.incoming
        : appendValue(existingEntry.value, field.incoming);
    }
  }

  return next;
}

function normFeature(text: string): string {
  return norm(text)
    .replace(/^\s*(?:\d+[.、)）]|[-*•])\s*/, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** 产品特点对比：标记与现有/前文重复的条目，不修改入参。 */
export function previewFeatureMerge(
  existing: string[] | undefined,
  extracted: string[] | undefined
): FeaturePreviewItem[] {
  const seen = new Set((existing || []).map((text) => normFeature(text)).filter(Boolean));
  const out: FeaturePreviewItem[] = [];
  for (const raw of extracted || []) {
    const text = norm(raw);
    if (!text) continue;
    const key = normFeature(text);
    if (!key) continue;
    const duplicate = seen.has(key);
    if (!duplicate) seen.add(key);
    out.push({ text, duplicate });
  }
  return out;
}

/** 追加去重应用：只接受未标记重复且被用户选中的条目。 */
export function applyFeatureMerge(
  existing: string[] | undefined,
  items: FeaturePreviewItem[] | undefined
): string[] {
  const out = (existing || []).map((text) => norm(text)).filter(Boolean);
  const seen = new Set(out.map((text) => normFeature(text)).filter(Boolean));
  for (const item of items || []) {
    if (!item || item.duplicate) continue;
    const text = norm(item.text);
    if (!text) continue;
    const key = normFeature(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}
