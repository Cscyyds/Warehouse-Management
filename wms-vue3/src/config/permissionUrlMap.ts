/**
 * 模块：权限可视化 - 接口 URL → 权限码解析（手写门面）
 *
 * 背景：后端 `my-permissions` 只返回 perm_code，不返回 api_path，
 *       因此「URL ↔ perm_code」的映射必须由前端持有，见同目录
 *       permissionUrlMap.generated.ts（由 npm run gen:perm-url-map 从后端 SQL 生成）。
 *
 * v-perm 书写形式（两者等价，推荐显式带方法）：
 *   v-perm="'POST /api/v1/tenant-purchase-orders/create'"   精确匹配
 *   v-perm="'/api/v1/tenant-purchase-orders/create'"        按 POST → GET 顺序回退
 *
 * 本文件为手写层，不会被生成脚本覆盖：URL 与后端登记不一致、或后端尚未登记时，
 * 在 ENDPOINT_PERM_OVERRIDES 中人工补登记即可。
 */
import { API_PERM_BY_ENDPOINT, API_META_BY_ENDPOINT } from './permissionUrlMap.generated'

/** 未显式声明方法时的探测顺序：写操作多为 POST，其次查询类 GET */
const FALLBACK_METHODS = ['POST', 'GET'] as const

/**
 * 人工覆盖表（优先级高于 generated）。
 * 用途：前端调用的 URL 与后端 sys_api_function.api_path 登记不一致，
 *       或后端尚未登记但已有等价权限码可复用时，在此显式指定。
 * key 必须是完整 `METHOD /path` 形式。
 */
export const ENDPOINT_PERM_OVERRIDES: Record<string, string[]> = {}

/** 归一化为 `METHOD /path`；无方法时返回 null 方法，交由调用方回退探测 */
export function normalizeEndpoint(input: string): { method: string | null; path: string } | null {
  const text = String(input || '').trim()
  if (!text) return null
  const matched = text.match(/^([A-Za-z]+)\s+(\/.*)$/)
  const method = matched ? matched[1].toUpperCase() : null
  const rawPath = matched ? matched[2] : text
  if (!rawPath.startsWith('/')) return null
  const path = rawPath.split('?')[0].replace(/\/+$/, '') || '/'
  return { method, path }
}

function lookup(key: string): string[] | undefined {
  return ENDPOINT_PERM_OVERRIDES[key] || API_PERM_BY_ENDPOINT[key]
}

/** 解析端点对应的权限码集合；未登记返回空数组 */
export function resolvePermCodesByEndpoint(input: string): string[] {
  const normalized = normalizeEndpoint(input)
  if (!normalized) return []
  const { method, path } = normalized
  if (method) return lookup(`${method} ${path}`) || []
  for (const fallback of FALLBACK_METHODS) {
    const hit = lookup(`${fallback} ${path}`)
    if (hit?.length) return hit
  }
  return []
}

/** 端点是否已登记（供 dev 告警与一致性测试用） */
export function isEndpointRegistered(input: string): boolean {
  return resolvePermCodesByEndpoint(input).length > 0
}

/** 端点元信息（perm_name 与接口中文说明），仅用于排查 */
export function describeEndpoint(input: string): { apiIds: string[]; permNames: string[]; desc: string } | null {
  const normalized = normalizeEndpoint(input)
  if (!normalized) return null
  const { method, path } = normalized
  if (method) return API_META_BY_ENDPOINT[`${method} ${path}`] || null
  for (const fallback of FALLBACK_METHODS) {
    const meta = API_META_BY_ENDPOINT[`${fallback} ${path}`]
    if (meta) return meta
  }
  return null
}

/** 值是否为 URL 形式的 v-perm 参数（区别于旧的按钮名关键词模式） */
export function isEndpointExpression(value: string): boolean {
  const text = String(value || '').trim()
  return text.startsWith('/') || /^[A-Za-z]+\s+\//.test(text)
}
