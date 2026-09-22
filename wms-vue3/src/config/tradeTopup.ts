/**
 * 批量补录（按 ERP 单号）—— 输入解析与上限（纯函数，无 Vue 依赖，可单测）。
 *
 * 单独成文件的原因：这是**用户自由文本 → 接口参数**的转换点，判错会静默出错
 * （单号被切坏 → 后端报「未找到该单」；去重漏了 → 同一张单重复处理）。
 * 与后端契约：`POST /api/v1/tenant-trade/{docKey}/sync/refresh` 的 Form 字段 `bill_nos`
 * （可重复）；后端对 `len(bill_nos) > 50` 直接 400「单次补录上限 50 张单号」，
 * 且后端**不去重**，故前端必须先解析干净再提交。
 */

/** 单次补录上限（与后端 tenant_trade_management.py 的 400 校验保持一致） */
export const TOPUP_LIMIT = 50

/**
 * 分隔符：换行 / 制表 / 空格 / 半角逗号 / 全角逗号 / 顿号 / 半角分号 / 全角分号
 * （便于从 Excel 一列直接粘贴）。
 *
 * ⚠️ **不含** `-`、`_`、`.`：ERP 单号常含这些字符（如 SB2026-0910-001），误加会直接切坏单号。
 */
const SEGMENT_SPLIT_RE = /[\s,，、;；]+/

/** 切分为有效段（去空白、丢空段，**不去重**）——分隔规则的唯一实现，勿在别处另写正则 */
function splitSegments(text: string): string[] {
  if (!text) return []
  return text.split(SEGMENT_SPLIT_RE).map(s => s.trim()).filter(Boolean)
}

/**
 * 解析补录输入文本 → 单号数组（去重后）。
 *
 * 处理规则：
 *   1. 按 `SEGMENT_SPLIT_RE` 切分，逐段 trim，丢弃空段；
 *   2. **按首次出现顺序去重**（后端不查重，前端先去重避免重复处理同一张单）；
 *   3. 不做大小写/前后缀归一 —— ERP 单号是精确串，改动即查不到。
 */
export function parseBillNos(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of splitSegments(text)) {
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

/**
 * 输入的有效段数（**去重前**）。用于提示「已自动去除 N 个重复单号」，
 * 避免在组件里再写一遍分隔正则导致两处漂移。
 */
export function countBillNoSegments(text: string): number {
  return splitSegments(text).length
}

/** 是否超出单次补录上限 */
export function isTopupOverLimit(count: number): boolean {
  return count > TOPUP_LIMIT
}
