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
 *
 * 当前为空。
 * 历史记录：组合产品三查询接口（components/preview|list|search）曾在此临时补登记，
 * 因当时后端初始化 SQL 尚未同步；2026-09-15 已将三条补入
 * nuomi_wms/docs/菜单按钮功能权限初始化SQL.md 并重新生成字典，故移除此处冗余登记
 * （避免覆盖表掩盖后端后续对 perm_code 的调整）。
 */
/**
 * 生产管理（租客侧）端点 → 聚合权限码。
 * 生产模块只有两个聚合码：perm_production_view（查询类）/ perm_production_manage（明细软删除+同步设置修改）。
 * 生成字典尚未收录生产端点，先在此手工登记（key 必须为 2 空格缩进字面量，供一致性守卫正则读取）；
 * 后端将权限 SQL 合入《菜单按钮功能权限初始化SQL.md》并重跑 gen:perm-url-map 后可移除本段。
 */
export const ENDPOINT_PERM_OVERRIDES: Record<string, string[]> = {
  'GET /api/v1/tenant-production/overview': ['perm_production_view'],
  'GET /api/v1/tenant-production/sync/settings': ['perm_production_view'],
  'POST /api/v1/tenant-production/sync/settings/update': ['perm_production_manage'],
  // doc 20：批量作业状态变更（写，perm_production_manage）/ 未绑品号清单（读，perm_production_view）
  'POST /api/v1/tenant-production/wms-status/batch-update': ['perm_production_manage'],
  'GET /api/v1/tenant-production/unbound-products': ['perm_production_view'],
  'GET /api/v1/tenant-production/finished-goods-stockin/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/finished-goods-stockin/search': ['perm_production_view'],
  'GET /api/v1/tenant-production/finished-goods-stockin/detail': ['perm_production_view'],
  'GET /api/v1/tenant-production/finished-goods-stockin/items/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/finished-goods-stockin/items/search': ['perm_production_view'],
  'POST /api/v1/tenant-production/finished-goods-stockin/items/delete': ['perm_production_manage'],
  'GET /api/v1/tenant-production/production-picking/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/production-picking/search': ['perm_production_view'],
  'GET /api/v1/tenant-production/production-picking/detail': ['perm_production_view'],
  'GET /api/v1/tenant-production/production-picking/items/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/production-picking/items/search': ['perm_production_view'],
  'POST /api/v1/tenant-production/production-picking/items/delete': ['perm_production_manage'],
  'GET /api/v1/tenant-production/production-return/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/production-return/search': ['perm_production_view'],
  'GET /api/v1/tenant-production/production-return/detail': ['perm_production_view'],
  'GET /api/v1/tenant-production/production-return/items/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/production-return/items/search': ['perm_production_view'],
  'POST /api/v1/tenant-production/production-return/items/delete': ['perm_production_manage'],
  'GET /api/v1/tenant-production/production-supplement/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/production-supplement/search': ['perm_production_view'],
  'GET /api/v1/tenant-production/production-supplement/detail': ['perm_production_view'],
  'GET /api/v1/tenant-production/production-supplement/items/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/production-supplement/items/search': ['perm_production_view'],
  'POST /api/v1/tenant-production/production-supplement/items/delete': ['perm_production_manage'],
  'GET /api/v1/tenant-production/non-production-picking/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/non-production-picking/search': ['perm_production_view'],
  'GET /api/v1/tenant-production/non-production-picking/detail': ['perm_production_view'],
  'GET /api/v1/tenant-production/non-production-picking/items/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/non-production-picking/items/search': ['perm_production_view'],
  'POST /api/v1/tenant-production/non-production-picking/items/delete': ['perm_production_manage'],
  'GET /api/v1/tenant-production/non-production-return/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/non-production-return/search': ['perm_production_view'],
  'GET /api/v1/tenant-production/non-production-return/detail': ['perm_production_view'],
  'GET /api/v1/tenant-production/non-production-return/items/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/non-production-return/items/search': ['perm_production_view'],
  'POST /api/v1/tenant-production/non-production-return/items/delete': ['perm_production_manage'],
  'GET /api/v1/tenant-production/outsourcing-picking/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-picking/search': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-picking/detail': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-picking/items/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-picking/items/search': ['perm_production_view'],
  'POST /api/v1/tenant-production/outsourcing-picking/items/delete': ['perm_production_manage'],
  'GET /api/v1/tenant-production/outsourcing-return/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-return/search': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-return/detail': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-return/items/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-return/items/search': ['perm_production_view'],
  'POST /api/v1/tenant-production/outsourcing-return/items/delete': ['perm_production_manage'],
  'GET /api/v1/tenant-production/outsourcing-supplement/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-supplement/search': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-supplement/detail': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-supplement/items/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-supplement/items/search': ['perm_production_view'],
  'POST /api/v1/tenant-production/outsourcing-supplement/items/delete': ['perm_production_manage'],
  'GET /api/v1/tenant-production/outsourcing-receipt/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-receipt/search': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-receipt/detail': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-receipt/items/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-receipt/items/search': ['perm_production_view'],
  'POST /api/v1/tenant-production/outsourcing-receipt/items/delete': ['perm_production_manage'],
  'GET /api/v1/tenant-production/material-cutting/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/material-cutting/search': ['perm_production_view'],
  'GET /api/v1/tenant-production/material-cutting/detail': ['perm_production_view'],
  'GET /api/v1/tenant-production/material-cutting/items/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/material-cutting/items/search': ['perm_production_view'],
  'POST /api/v1/tenant-production/material-cutting/items/delete': ['perm_production_manage'],
  'GET /api/v1/tenant-production/outsourcing-chargeback/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-chargeback/search': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-chargeback/detail': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-chargeback/items/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/outsourcing-chargeback/items/search': ['perm_production_view'],
  'POST /api/v1/tenant-production/outsourcing-chargeback/items/delete': ['perm_production_manage'],
  'GET /api/v1/tenant-production/sales-return/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/sales-return/search': ['perm_production_view'],
  'GET /api/v1/tenant-production/sales-return/detail': ['perm_production_view'],
  'GET /api/v1/tenant-production/sales-return/items/list': ['perm_production_view'],
  'GET /api/v1/tenant-production/sales-return/items/search': ['perm_production_view'],
  'POST /api/v1/tenant-production/sales-return/items/delete': ['perm_production_manage'],

  /**
   * 贸易数据（租客侧，天心 ERP 同步）端点 → 聚合权限码。
   * 贸易模块只有两个聚合码：perm_trade_view（查询类）/ perm_trade_manage（手动同步）。
   * 4 单据 × 6 端点 = 24 条；mode 端点仅身份鉴权，不登记（hasUrlPerm fail-open 放行）。
   * 后端将权限 SQL 合入《菜单按钮功能权限初始化SQL.md》并重跑 gen:perm-url-map 后可移除本段。
   */
  'GET /api/v1/tenant-trade/purchase-order/list': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/purchase-order/search': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/purchase-order/detail': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/purchase-order/items/list': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/purchase-order/items/search': ['perm_trade_view'],
  'POST /api/v1/tenant-trade/purchase-order/sync/refresh': ['perm_trade_manage'],
  'GET /api/v1/tenant-trade/purchase-return/list': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/purchase-return/search': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/purchase-return/detail': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/purchase-return/items/list': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/purchase-return/items/search': ['perm_trade_view'],
  'POST /api/v1/tenant-trade/purchase-return/sync/refresh': ['perm_trade_manage'],
  'GET /api/v1/tenant-trade/sales-order/list': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/sales-order/search': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/sales-order/detail': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/sales-order/items/list': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/sales-order/items/search': ['perm_trade_view'],
  'POST /api/v1/tenant-trade/sales-order/sync/refresh': ['perm_trade_manage'],
  'GET /api/v1/tenant-trade/sales-return/list': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/sales-return/search': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/sales-return/detail': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/sales-return/items/list': ['perm_trade_view'],
  'GET /api/v1/tenant-trade/sales-return/items/search': ['perm_trade_view'],
  'POST /api/v1/tenant-trade/sales-return/sync/refresh': ['perm_trade_manage'],
}

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
 * perm_code → 业务话术名（覆盖层，优先级高于 desc 反查）。
 *
 * 为什么需要：API_META 的 desc 是「接口文档视角」写的，含大量授权者看不懂的表述——
 *   「租户普通用户登录，返回JWT令牌」「基于配送任务调用高德地图驾车路径规划」
 *   「预览删除仓库操作的影响范围」；另有约 20 个码库里 perm_name 存的就是码本身，
 *   反查又拿不到 desc，树叶上直接显示 perm_api_prod_components_batch_preview。
 * 本表用「动作 + 对象」短语统一改写，只登记确实需要改写的码；
 * 未登记且 desc 可用的码仍走 desc（保持既有 500+ 条中文名不变，控制改动面）。
 *
 * ⚠️ 本常量必须在 PERM_CN_NAME_BY_CODE 之前声明——后者是 IIFE，在模块求值时即读取本表。
 */
export const PERM_CN_NAME_OVERRIDES: Record<string, string> = {
  // ── 认证（登录接口本身不该出现在权限树，此处仅为兜底显示；见 permissionTreeGrouping 过滤）──
  'perm_api_auth_user_login': '登录系统',

  // ── 车辆打卡 ──
  'perm_api_chk_list': '查看打卡记录',
  'perm_api_chk_detail': '查看打卡详情',
  'perm_api_chk_create': '新增打卡记录',
  'perm_api_chk_update': '编辑打卡记录',
  'perm_api_chk_delete': '删除打卡记录',

  // ── 组合产品（库里无中文名，原样显示英文码）──
  'perm_api_prod_components_list': '查看组合产品列表',
  'perm_api_prod_components_search': '搜索组合产品',
  'perm_api_prod_components_preview': '查看可拆分产品',
  'perm_api_prod_components_batch_preview': '批量查看可拆分产品',
  'perm_api_prod_suppliers_update_price': '修改供应商供货价',

  // ── 生产管理（聚合码，名过长且带括号注解）──
  'perm_production_view': '查看生产单据',
  'perm_production_manage': '管理生产单据明细',

  // ── 销售订单图片/附件删除（库里无中文名）──
  'perm_api_sales_delete_order_images': '删除销售订单图片',
  'perm_api_sales_delete_order_attachments': '删除销售订单附件',

  // ── 供应商预付款（库里无中文名）──
  'perm_api_pur_supplier_prepayment_summary_query': '查看供应商预付款余额',
  'perm_api_pur_supplier_prepayment_summary_search': '搜索供应商预付款余额',
  'perm_api_pur_supplier_prepayment_logs_query': '查看供应商预付款流水',
  'perm_api_pur_supplier_prepayment_logs_search': '搜索供应商预付款流水',
  'perm_api_pur_supplier_prepayment_usage_list': '查看预付款使用明细',

  // ── 员工字典映射（库里无中文名）──
  'perm_api_emp_query_mapping_groups': '查看数据字典分组',
  'perm_api_emp_update_mapping_value': '修改数据字典项',

  // ── 员工-管理员（后端 SQL 的 api_function 仍写「二级管理员」，前端页面已统一称「管理员」；
  //      待后端改词并重跑 npm run gen:perm-url-map 后，本段可移除）──
  'perm_api_emp_query_admin_users': '查询管理员列表',
  'perm_api_emp_search_admin_users': '搜索管理员',

  // ── 行政区划迁移（CRM 模块调用，与员工模块同名前缀易混淆）──
  'perm_api_crm_migrate_area': '迁移客户行政区划',

  // ── 配送/导航（desc 过于技术化）──
  'perm_api_nav_driving_route': '查看驾车路线',

  // ── 知识库（内部接口，角色树已隐藏；此处兜底中文名，便于日志/排查）──
  'perm_api_prod_kb_search': '检索产品知识库',
  'perm_api_prod_kb_batches': '查看知识库同步批次',
  'perm_api_prod_kb_knowledge_detail': '查看产品知识内容',
  'perm_api_prod_kb_search_traces': '查看知识检索记录',
  'perm_api_prod_kb_vectorize': '生成产品知识向量',
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
 *   3. 最后套用 PERM_CN_NAME_OVERRIDES 业务话术覆盖层（授权者看不懂的 desc 在此改写）。
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
  // 业务话术覆盖层：把「接口视角」的 desc 改写成授权者能一眼看懂的动作短语
  for (const [code, name] of Object.entries(PERM_CN_NAME_OVERRIDES)) map[code] = name
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
