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
import { API_PERM_BY_ENDPOINT, API_META_BY_ENDPOINT, SCANNER_CN_NAME_BY_ID } from './permissionUrlMap.generated'

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

/**
 * perm_code → 中文功能名（权限树叶子显示用）。
 *
 * 背景：后端 sys_permission.perm_name 目前存的就是 perm_code（build_permission_tree
 * 原样透传），角色权限树叶子只能显示英文码。此处从 API_META_BY_ENDPOINT 的端点中文
 * 描述（desc）反查生成码 → 中文名：
 *   1. 先收「端点 ↔ 权限码」一对一的条目（534/545，实测零冲突），描述必然贴合该码；
 *   2. 再用多码端点补漏——只补尚无名字的码，避免把端点描述张冠李戴到复用端点的兄弟码上
 *      （兄弟码已在第 1 步拿到更贴切的描述，不会被覆盖；剩余 11 个均为 *_delete_preview /
 *      *_migrate_* 类仅在多码端点登记的码，端点描述即其语义）。
 * 未收录的码（perm_btn_* / bth_* 等纯前端按钮码、扫码枪体系权限）回退显示原码。
 * 后端后续若把 perm_name 填成真中文，resolvePermDisplayLabel 会优先后端值。
 */
export const PERM_CN_NAME_BY_CODE: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  const singles: Array<[string, string]> = []
  const multis: Array<[string[], string]> = []
  for (const meta of Object.values(API_META_BY_ENDPOINT)) {
    if (!meta.desc) continue
    if (meta.permNames.length === 1) singles.push([meta.permNames[0], meta.desc])
    else if (meta.permNames.length > 1) multis.push([meta.permNames, meta.desc])
  }
  for (const [code, desc] of singles) if (!map[code]) map[code] = desc
  for (const [codes, desc] of multis) for (const code of codes) if (!map[code]) map[code] = desc
  return map
})()

/** 权限叶子展示名：后端名已是中文（≠ 权限码）则优先，否则查 desc 映射/扫码枪字典，再回退原名 */
export function resolvePermDisplayLabel(code: string, backendName?: unknown): string {
  const raw = String(backendName ?? '').trim()
  if (raw && raw !== code) return raw
  return PERM_CN_NAME_BY_CODE[code] || SCANNER_NODE_CN_NAME_BY_ID[code] || raw || code
}

/**
 * 人工补登记（优先级低于 generated 扫码枪字典，二者 key 不相交）。
 * 背景：菜单按钮功能权限初始化SQL.md 的扫码枪段是另一套更细粒度的旧 id
 * （button_name/perm_name 在库里存的是 id 本身），扫码枪初始化 SQL 未覆盖这些 id，
 * 中文名按同概念接口的 api_name 词汇补齐。后端若把库名修成真中文，
 * resolvePermDisplayLabel / 节点取名会优先后端值，此处仅作展示兜底。
 */
export const SCANNER_CN_NAME_OVERRIDES: Record<string, string> = {
  // 入库作业（旧 id：单据查询+条码打印+待办合为一个按钮/权限）
  'btn_scanner_inbound_operation': '入库单据查询与条码打印',
  'perm_scanner_inbound_operation': '入库单据查询与条码打印',
  'btn_scanner_inbound_place_identify': '放货条码与位置识别',
  'perm_scanner_inbound_place_identify': '放货条码与位置识别',
  'btn_scanner_inbound_preparation': '产品与货位绑定',
  'perm_scanner_inbound_preparation': '产品与货位绑定',
  'btn_scanner_inbound_scan_identify': '入库扫描条码识别',
  'perm_scanner_inbound_scan_identify': '入库扫描条码识别',
  'btn_scanner_inbound_plastic_box': '塑料盒与位置绑定',
  'perm_scanner_inbound_plastic_box': '塑料盒与位置绑定',
  // 出库作业（旧 id：单据查询+出库确认+库存明细合为一个按钮/权限）
  'btn_scanner_outbound_operation': '出库单据查询与库存明细',
  'perm_scanner_outbound_operation': '出库单据查询与库存明细',
  'btn_scanner_outbound_scan_identify': '出库条码识别',
  'perm_scanner_outbound_scan_identify': '出库条码识别',
  // 合包作业（旧 id：按操作/校验/打印/查询拆分）
  'btn_scanner_merge_package_operation': '合包操作',
  'perm_scanner_merge_package_operation': '合包操作',
  'btn_scanner_merge_package_precheck': '合包前置校验',
  'perm_scanner_merge_package_precheck': '合包前置校验',
  'btn_scanner_merge_package_print': '合包打印',
  'perm_scanner_merge_package_print': '合包打印',
  'btn_scanner_merge_package_query': '合包查询',
  'perm_scanner_merge_package_query': '合包查询',
}

/** 扫码枪体系节点展示名（generated 字典 + 人工补登记合并），menu/button/perm 的 id 统一查询 */
export const SCANNER_NODE_CN_NAME_BY_ID: Record<string, string> = {
  ...SCANNER_CN_NAME_BY_ID,
  ...SCANNER_CN_NAME_OVERRIDES,
}

/** 值是否为 URL 形式的 v-perm 参数（区别于旧的按钮名关键词模式） */
export function isEndpointExpression(value: string): boolean {
  const text = String(value || '').trim()
  return text.startsWith('/') || /^[A-Za-z]+\s+\//.test(text)
}
