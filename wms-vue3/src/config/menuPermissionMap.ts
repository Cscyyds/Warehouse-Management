/**
 * 模块：权限可视化 - 页面 ↔ 后端菜单映射配置
 *
 * ⚠️ 粒度说明（经数据库核实）：后端 sys_menu 是「模块级」菜单（发货管理/司机管理/
 * 员工管理/客户关系管理…共 21 个），不是页面级。`my-permissions` 返回的
 * 菜单集合 = 登录员工可触达按钮所属的模块集合（管理员角色=全部模块，普通角色=角色绑定）。
 *
 * 因此映射方向是：前端页面（path / 标题）→ 所属后端模块 menu_id。
 * （按钮级权限已改为「接口 URL → perm_code」精确匹配，见 permissionUrlMap.ts，
 *   本文件只负责页面级：导航 / 侧边栏 / 路由守卫。）
 * 匹配规则（三级回退，命中任一即放行）：
 *   1. PAGE_MENU_BY_PATH[path]      路径级覆盖（当前为空，留作例外声明）
 *   2. PAGE_MENU_BY_TITLE[title]    标题 → 模块 menu_id 映射（本文件主体）
 *   3. title 本身                   兼容未来后端细化为页面级菜单（同名直配）
 *
 * ⚠️ 匹配键用 menu_id 而非 menu_name（2026-09-03 调整）：
 *   menu_name 是展示列、非契约字段——线上初始化 SQL 曾把它填成 menu_id 同值，
 *   导致前端按中文名匹配全部落空、所有业务模块导航/页面/按钮消失。
 *   menu_id 是主键，任何环境的库都稳定存在；permission store 侧同时收录
 *   menu_id 与 menu_name（见 stores/permission.ts），故中文名命名的库同样放行。
 *   模块的中文显示名统一查 MENU_DISPLAY_NAMES。
 *
 * 公共页面（仪表盘、个人中心、/common/add、/ai 等）不走权限校验，见 PUBLIC_PATHS。
 */

/**
 * 后端 sys_menu 全集（2026-08 核实，menu_id → 中文名；仅供注释参考，不做运行时校验）：
 * 认证与平台管理员 / Coze AI / 客户关系管理 / 客户订货管理 / 仪表盘 / 发货管理 /
 * 司机管理 / 员工管理 / 财务管理 / 配送物流 / 导航管理 / 平台管理 / 产品管理 /
 * 采购管理 / 销售管理 / 车辆管理 / 车辆进场签到 / 仓库管理 / WMS扫码枪-入库|合包|出库
 */

/** 路径级覆盖：path → 后端模块 menu_id（优先级最高，仅当标题映射不适用时使用） */
export const PAGE_MENU_BY_PATH: Record<string, string> = {}

/** 页面标题 → 所属后端模块 menu_id（主体映射表，按一级模块分组维护） */
export const PAGE_MENU_BY_TITLE: Record<string, string> = {
  // ── 系统管理 → 员工管理 ──────────────────
  '人事资料管理': 'menu_employee',
  '组织机构管理': 'menu_employee',
  '岗位管理': 'menu_employee',
  '角色管理': 'menu_employee',
  '二级管理员': 'menu_employee',
  '行政区划': 'menu_employee',
  '访问日志': 'menu_employee',
  '在线用户': 'menu_employee',

  // ── 客户管理 → 客户关系管理 ──────────────
  // 注：同一页面「侧边栏标签」与「路由 meta.title」措辞不同时，两个键都要登记
  // （侧边栏按标签过滤，守卫按 meta.title 校验，缺一个就会出现「入口可见但点击被拦」）
  '客户类型': 'menu_crm',
  '客户类型设定': 'menu_crm',
  '新开拓客户': 'menu_crm',
  '客户资料': 'menu_crm',
  '正式客户信息': 'menu_crm',
  '公海客户': 'menu_crm',
  '区域管理': 'menu_crm',
  '区域管理设定': 'menu_crm',
  '客户授信余额表': 'menu_crm',
  '预付款余额表': 'menu_crm',
  '赠送金额余额表': 'menu_crm',
  '客户余额表': 'menu_crm',
  '拜访任务单': 'menu_crm',

  // ── 产品管理 → 产品管理 ──────────────────
  '产品类别': 'menu_product',
  '计量单位': 'menu_product',
  '产品资料': 'menu_product',
  '滞销产品表': 'menu_product',
  '滞销产品': 'menu_product',

  // ── 仓库管理 → 仓库管理 ──────────────────
  '库位管理': 'menu_wms',
  '放货货位': 'menu_wms',
  '塑料盒管理': 'menu_wms',
  '产品库存': 'menu_wms',
  '打印机型号': 'menu_wms',

  // ── 采购管理 → 采购管理 ──────────────────
  '供应商类型': 'menu_purchase',
  '供应商档案': 'menu_purchase',
  '供应商授信': 'menu_purchase',
  '供应商赠送金额': 'menu_purchase',
  '采购订单': 'menu_purchase',
  '采购入库单': 'menu_purchase',
  '采购退货单': 'menu_purchase',
  '采购对账单': 'menu_purchase',
  '采购退货汇总表': 'menu_purchase',
  '采购入库单明细': 'menu_purchase',
  '供应商余额表': 'menu_purchase',

  // ── 销售管理 → 销售管理 / 客户订货管理 ───
  '销售订单': 'menu_sales',
  '客户订货单': 'menu_customer_order',
  '销售退货单': 'menu_sales',
  '对账单管理': 'menu_sales',
  '对账单': 'menu_sales',
  '产品销售汇总表': 'menu_sales',
  '客户销售汇总表': 'menu_sales',
  '销售订单明细表': 'menu_sales',
  '客户订货明细表': 'menu_customer_order',

  // ── 配送管理 → 发货管理 / 司机管理 / 车辆管理 / 配送物流 ──
  '配送任务': 'menu_delivery',
  '物流单号管理': 'menu_logistics',
  '司机档案': 'menu_driver',
  '车辆管理': 'menu_vehicle',
  '物流公司': 'menu_logistics',

  // ── 财务管理 → 财务管理 ──────────────────
  '科目管理': 'menu_finance',
  '银行账户': 'menu_finance',
  '其他收款': 'menu_finance',
  '收款单': 'menu_finance',
  '月结收款单': 'menu_finance',
  '预收款单': 'menu_finance',
  '付款单': 'menu_finance',
  '月结付款单': 'menu_finance',
  '预付款单': 'menu_finance',
  '其他付款': 'menu_finance',
}

/**
 * 模块 menu_id → 中文显示名（仅用于展示，如角色权限树的模块节点标题，
 * 不参与权限判定）。与后端 sys_menu 的 21 个模块一一对应；
 * menu_name 在不同环境可能为中文名或 ID 串，展示一律以本表为准。
 */
export const MENU_DISPLAY_NAMES: Record<string, string> = {
  menu_auth: '认证与平台管理员',
  menu_coze: 'Coze AI',
  menu_crm: '客户关系管理',
  menu_customer_order: '客户订货管理',
  menu_dashboard: '仪表盘',
  menu_delivery: '发货管理',
  menu_driver: '司机管理',
  menu_employee: '员工管理',
  menu_finance: '财务管理',
  menu_logistics: '配送物流',
  menu_navigation: '导航管理',
  menu_platform: '平台管理',
  menu_product: '产品管理',
  menu_purchase: '采购管理',
  menu_sales: '销售管理',
  menu_vehicle: '车辆管理',
  menu_vehicle_checkin: '车辆进场签到',
  menu_wms: '仓库管理',
  menu_scanner_inbound: 'WMS扫码枪-入库',
  menu_scanner_outbound: 'WMS扫码枪-出库',
  menu_scanner_merge: 'WMS扫码枪-合包',
}

/** 计算某页面的全部候选菜单（按优先级，值为 menu_id 或菜单名），命中任一即视为有权限 */
export function resolveMenuCandidates(path: string, routeTitle?: string): string[] {
  const candidates = [
    PAGE_MENU_BY_PATH[path],
    routeTitle ? PAGE_MENU_BY_TITLE[routeTitle.trim()] : undefined,
    (routeTitle || '').trim() || undefined,
  ]
  const deduped = new Set<string>()
  for (const item of candidates) {
    if (item) deduped.add(item)
  }
  return [...deduped]
}

/** 路由 path 前缀匹配豁免清单（完全公开，不走权限校验） */
export const PUBLIC_PATHS: string[] = [
  '/dashboard',
  '/profile',
  '/profile/change-password',
  '/profile/my-visit-task',
]

/** 前缀匹配型公共路径（复用路由 /common/add 入口均来自有权限页面；AI 助手对全员开放） */
export const PUBLIC_PATH_PREFIXES: string[] = ['/common/add', '/ai']

/**
 * 子页面（新增/编辑/详情）权限继承：守卫内通用「祖先路径回退」实现，无需手工登记。
 * 规则：从子页面 path 逐级去掉末段向上回退，命中第一个「已注册路由且其标题映射到
 * 模块菜单」的祖先列表页，即按该列表页的权限放行。
 *   /warehouse/stock/detail            → /warehouse/stock（产品库存 → 仓库管理）
 *   /customer/finance/credit/:id       → /customer/finance/credit（客户授信余额表 → 客户关系管理）
 *   /sales/customer-order/create       → /sales/customer-order（客户订货单 → 客户订货管理）
 * 全部祖先都映射不到 → 无权限（fail-closed），见 router/index.ts 的 inheritedAllowed。
 */

/** 判断是否公共路径（免权限校验） */
export function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.includes(path)) return true
  return PUBLIC_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix + '?') || path.startsWith(prefix + '/'))
}
