/**
 * 模块：权限可视化 - 页面 ↔ 后端菜单映射配置
 *
 * ⚠️ 粒度说明（经数据库核实）：后端 sys_menu 是「模块级」菜单（发货管理/司机管理/
 * 员工管理/客户关系管理…共 21 个），不是页面级。`visible-permissions` 返回的
 * menu_name 集合 = 员工可触达按钮所属的模块集合（ADMIN 返回全部模块）。
 *
 * 因此映射方向是：前端页面（path / 标题）→ 所属后端模块菜单名。
 * 匹配规则（三级回退，命中任一即放行）：
 *   1. PAGE_MENU_BY_PATH[path]      路径级覆盖（当前为空，留作例外声明）
 *   2. PAGE_MENU_BY_TITLE[title]    标题 → 模块 映射（本文件主体）
 *   3. title 本身                   兼容未来后端细化为页面级菜单（同名直配）
 *
 * 公共页面（仪表盘、个人中心、/common/add、/ai 等）不走权限校验，见 PUBLIC_PATHS。
 */

/**
 * 后端 sys_menu.menu_name 全集（2026-08 核实，仅供注释参考，不做运行时校验）：
 * 认证与平台管理员 / Coze AI / 客户关系管理 / 客户订货管理 / 仪表盘 / 发货管理 /
 * 司机管理 / 员工管理 / 财务管理 / 配送物流 / 导航管理 / 平台管理 / 产品管理 /
 * 采购管理 / 销售管理 / 车辆管理 / 车辆进场签到 / 仓库管理 / WMS扫码枪-入库|合包|出库
 */

/** 路径级覆盖：path → 后端菜单名（优先级最高，仅当标题映射不适用时使用） */
export const PAGE_MENU_BY_PATH: Record<string, string> = {}

/** 页面标题 → 所属后端模块菜单名（主体映射表，按一级模块分组维护） */
export const PAGE_MENU_BY_TITLE: Record<string, string> = {
  // ── 系统管理 → 员工管理 ──────────────────
  '人事资料管理': '员工管理',
  '组织机构管理': '员工管理',
  '岗位管理': '员工管理',
  '角色管理': '员工管理',
  '二级管理员': '员工管理',
  '行政区划': '员工管理',
  '访问日志': '员工管理',
  '在线用户': '员工管理',

  // ── 客户管理 → 客户关系管理 ──────────────
  '客户类型': '客户关系管理',
  '新开拓客户': '客户关系管理',
  '客户资料': '客户关系管理',
  '公海客户': '客户关系管理',
  '区域管理': '客户关系管理',
  '客户授信余额表': '客户关系管理',
  '预付款余额表': '客户关系管理',
  '赠送金额余额表': '客户关系管理',
  '客户余额表': '客户关系管理',
  '拜访任务单': '客户关系管理',

  // ── 产品管理 → 产品管理 ──────────────────
  '产品类别': '产品管理',
  '计量单位': '产品管理',
  '产品资料': '产品管理',
  '滞销产品表': '产品管理',

  // ── 仓库管理 → 仓库管理 ──────────────────
  '库位管理': '仓库管理',
  '放货货位': '仓库管理',
  '塑料盒管理': '仓库管理',
  '产品库存': '仓库管理',
  '打印机': '仓库管理',
  '打印机型号': '仓库管理',

  // ── 采购管理 → 采购管理 ──────────────────
  '供应商类型': '采购管理',
  '供应商档案': '采购管理',
  '供应商授信': '采购管理',
  '供应商赠送金额': '采购管理',
  '采购订单': '采购管理',
  '采购入库单': '采购管理',
  '采购退货单': '采购管理',
  '采购退货汇总表': '采购管理',
  '采购入库单明细': '采购管理',
  '供应商余额表': '采购管理',

  // ── 销售管理 → 销售管理 / 客户订货管理 ───
  '销售订单': '销售管理',
  '客户订货单': '客户订货管理',
  '销售退货单': '销售管理',
  '对账单管理': '销售管理',
  '产品销售汇总表': '销售管理',
  '客户销售汇总表': '销售管理',
  '销售订单明细表': '销售管理',
  '客户订货明细表': '客户订货管理',

  // ── 配送管理 → 发货管理 / 司机管理 / 车辆管理 / 配送物流 ──
  '配送任务': '发货管理',
  '物流单号管理': '配送物流',
  '司机档案': '司机管理',
  '车辆管理': '车辆管理',
  '物流公司': '配送物流',

  // ── 财务管理 → 财务管理 ──────────────────
  '科目管理': '财务管理',
  '银行账户': '财务管理',
  '其他收款': '财务管理',
  '收款单': '财务管理',
  '月结收款单': '财务管理',
  '预收款单': '财务管理',
  '付款单': '财务管理',
  '月结付款单': '财务管理',
  '预付款单': '财务管理',
  '其他付款': '财务管理',
}

/** 计算某页面的全部候选菜单名（按优先级），命中任一即视为有权限 */
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
 * 子页面 → 父列表页前缀继承表。
 * 新增/编辑/详情类子页面不在导航菜单中，但其权限应跟随所属列表页：
 * 只要员工可见父列表页，子页面即可访问（守卫按最长前缀回退匹配）。
 */
export const CHILD_PATH_INHERIT_PREFIXES: string[] = [
  '/sales/customer-order/create',   // 新增客户订货单 → 客户订货单
  '/sales/reconciliation/add',      // 新增销售对账单 → 对账单管理
  '/delivery/task/add',             // 新增配送任务 → 配送任务
  '/delivery/task/detail',          // 配送任务详情 → 配送任务
  '/delivery/driver/add',           // 新增/编辑司机档案 → 司机档案
  '/customer/finance/gift/add',     // 新增赠送金额 → 赠送金额余额表
  '/finance/gift/add',              // 新增月结收款单 → 月结收款单
  '/finance/precollection/add',     // 新增预收款单 → 预收款单
  '/purchase/supplier/credit/add',  // 新增/调减供应商授信 → 供应商授信
  '/purchase/supplier/credit/detail',
  '/purchase/supplier/gift/add',    // 新增/调减供应商赠送金额 → 供应商赠送金额
  '/purchase/supplier/gift/detail',
]

/** 子页面继承：按已声明前缀返回应继承权限的父列表页 path（未命中返回 null） */
export function resolveInheritedParentPath(path: string): string | null {
  // 最长前缀优先，避免 /purchase/supplier/gift/add 被 /purchase/supplier 误吃
  const matched = CHILD_PATH_INHERIT_PREFIXES.filter(prefix => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?'))
    .sort((a, b) => b.length - a.length)[0]
  if (matched) {
    // 继承目标 = 该子前缀所属的列表页，即在映射表/路由中把末段去掉后的 path
    // 例：/sales/customer-order/create → /sales/customer-order
    const segs = matched.split('/')
    return '/' + segs.slice(1, -1).join('/')
  }
  return null
}

/** 判断是否公共路径（免权限校验） */
export function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.includes(path)) return true
  return PUBLIC_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix + '?') || path.startsWith(prefix + '/'))
}
