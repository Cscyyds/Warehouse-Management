/**
 * 模块:角色权限树 - 按业务分组重排(模块 → 页面 → 该页面全部接口)
 *
 * 背景:
 *   后端 visible-permissions 返回的是「系统管理视角」的 菜单(menu) → 按钮(button) → 权限(perm)
 *   三级树,授权者面对的是"按钮"而不是"页面"。一个页面实际调用的接口常散落在
 *   多个按钮、甚至其他模块下(例:客户订货明细表内嵌「产品销售汇总」接口,挂在销售模块),
 *   按"按钮"授权极易漏勾,出现「列表能进、弹窗 403」的半残配置。
 *
 *   本文件把上述树重排为「模块 → 页面 → 权限叶子」:
 *   - 模块:menuPermissionMap.PAGE_MENU_BY_TITLE(页面标题 → 后端模块 menu_id),
 *     节点 label 经 MENU_DISPLAY_NAMES 转中文显示
 *   - 页面:pagePermissionMap.PAGE_PERMS_BY_TITLE(页面标题 → {view, deps, all} 权限码,2026-09-01 全模块铺开)
 *   - 叶子:仍是 perm_code(id 不变),落库值/回显/expandRolePermissionIds 联动逻辑全部不变;
 *     deps 码（跨页依赖，归属其他页面域）不渲染为叶子——叶子仍挂在归属页面下，
 *     勾中本页面任一叶子时由 expandRolePermissionIds 一并补全（见 pagePermissionMap.ts）
 *
 * 兜底(fail-open):
 *   - 未登记进 PAGE_PERMS_BY_TITLE 的权限,拍平为去重的权限叶子挂到「其他权限」模块下
 *     (不再保留 菜单→按钮 结构层:按钮/菜单名在库里是英文码串,无授权语义,且同一权限码
 *     挂多个按钮时会重复出现),保证任何可见权限都不会从树里丢失;
 *   - 同一权限码被多个页面引用时 first-wins(只出现在先登记的页面下),避免 el-tree
 *     node-key 重复;消费页面运行时所需的其他页面码走 deps(不渲染),由
 *     expandRolePermissionIds 联动补全,勾选/取消勾选页面节点时同步点亮/熄灭。
 */

import type { PermissionTreeNode } from '@/api/modules/role'
import type { TradeModeResult } from '@/api/modules/trade'
import { PAGE_PERMS_BY_TITLE } from './pagePermissionMap'
import { PAGE_MENU_BY_TITLE, MENU_DISPLAY_NAMES } from './menuPermissionMap'

const SHARED_TRADE_PAGE_TITLES = ['采购订单', '采购退货单', '销售订单', '销售退货单']
type RoleTradeMode = TradeModeResult['purchase_sales_mode'] | null

export function getRolePermissionModeHint(mode: RoleTradeMode): string {
  if (!mode) return '未获取到当前租户贸易模式，暂按后端返回的可分配权限展示。'
  const current = mode === 'TIANXIN' ? '天心' : ' WMS '
  const hidden = mode === 'TIANXIN' ? 'WMS' : '天心'
  return `当前为${current}模式，同类${hidden}单据权限暂不展示；共用权限保留。已绑定权限不会因隐藏而删除，模式切换后请重新核对授权。`
}

/** 重排后的树节点(id/label/children 与 el-tree 约定一致) */
export interface GroupedPermNode {
  id: string
  label: string
  children?: GroupedPermNode[]
}

/** 未分组权限的兜底模块名 */
const FALLBACK_MODULE = '其他权限'

/**
 * 不进角色权限树的权限（系统级 / 内部调用），在兜底桶收集阶段直接丢弃。
 *
 * 判定依据（均为「不该由租客管理员按角色分配」）：
 *   1. 登录接口 perm_api_auth_user_login —— 登录时 token 尚未签发，任何角色校验都
 *      无法执行；后端 main.py:140 也已对 POST /auth/user/login 特判跳过中间件。
 *      勾不勾这个框登录行为完全一样，留着只会让管理员误以为能禁止某角色登录。
 *   2. 平台级运维码 perm_platform_production_admin —— 平台方能力，非租客权限。
 *   3. 知识库/向量化内部接口（perm_api_kb_official_* / knowledge:* / perm_api_prod_kb_*）
 *      —— 由「产品文档拆分」页在后台调用 Coze 网关，业务上不是给管理员手工勾选的；
 *      且这些码的 desc 全为技术术语（索引重建/向量化/检索轨迹），放进树叶只制造噪音。
 *      后端仍照常按 sys_api_function 校验，此处仅影响「角色树里是否可见」。
 *   4. Coze 侧调用的销售分析概览 perm_api_sales_analysis_overview —— wms-vue3 无任何
 *      页面调用（仅 app/core/coze_caller.py 使用），不属于租客可分配的页面权限。
 */
const INTERNAL_ONLY_PERM_EXACT = new Set<string>([
  'perm_api_auth_user_login',
  'perm_platform_production_admin',
  'perm_api_sales_analysis_overview',
])

/** 内部调用权限的码前缀（知识库体系） */
const INTERNAL_ONLY_PERM_PREFIXES = ['perm_api_kb_official_', 'perm_api_prod_kb_', 'knowledge:']

/** 该权限是否应从角色树中隐藏 */
function isInternalOnlyPerm(code: string): boolean {
  if (INTERNAL_ONLY_PERM_EXACT.has(code)) return true
  return INTERNAL_ONLY_PERM_PREFIXES.some(prefix => code.startsWith(prefix))
}


/** 判定是否为权限叶子:标准树带 type 标记;legacy 兜底树无 type,按「非结构性 id」识别
 *  (权限码不都以 perm_ 开头,如产品知识库的 knowledge:wms:search,不能只认 perm_ 前缀) */
function isPermNode(node: PermissionTreeNode): boolean {
  const id = String(node.id || '')
  if (node.type === 'perm' || id.startsWith('perm_')) return true
  return !node.type && !/^(menu_|btn_|module:|page:)/.test(id)
}

/** 递归收集树中权限叶子:perm_code → 显示名（内部调用权限不入索引，故也不会渲染为叶子） */
function collectPermIndex(nodes: PermissionTreeNode[], index: Map<string, string>): void {
  for (const n of nodes || []) {
    if (isPermNode(n)) {
      const id = String(n.id)
      if (!isInternalOnlyPerm(id)) index.set(id, String(n.label ?? n.id))
    }
    if (Array.isArray(n.children) && n.children.length) collectPermIndex(n.children, index)
  }
}

/**
 * 收集未被页面分组收编的权限叶子,拍平为一级列表(first-wins 去重)。
 * 用于兜底模块——未登记页面的权限不丢失;菜单/按钮结构层不进树(名字是英文码串、
 * 无授权语义、提交侧只认 perm_code;同一权限码挂多个按钮时在此去重防 node-key 重复)。
 */
function collectUnconsumedPerms(nodes: PermissionTreeNode[], consumed: Set<string>, out: GroupedPermNode[]): void {
  for (const n of nodes || []) {
    const id = String(n.id || '')
    if (isPermNode(n)) {
      if (isInternalOnlyPerm(id)) continue
      if (!consumed.has(id)) {
        consumed.add(id)
        out.push({ id, label: String(n.label ?? id) })
      }
      continue
    }
    if (Array.isArray(n.children) && n.children.length) collectUnconsumedPerms(n.children, consumed, out)
  }
}

/**
 * 把 visible-permissions 返回的 菜单→按钮→权限 树重排为 模块→页面→权限 树。
 *
 * @param source getVisiblePermissions() 归一化后的树(租客级全部可分配权限)
 * @returns 重排后的树;模块节点 id 前缀 'module:'、页面节点 'page:'(均非 perm_ 前缀,
 *          提交侧 serializePermissionIds 会自动过滤,不影响落库值)
 */
export function groupRolePermissionTree(source: PermissionTreeNode[], mode: RoleTradeMode): GroupedPermNode[] {
  // 1) 权限码 → 显示名 索引(租户可见集合)
  const permIndex = new Map<string, string>()
  collectPermIndex(source || [], permIndex)
  const hiddenTitles = new Set(mode ? SHARED_TRADE_PAGE_TITLES.map(title => mode === 'TIANXIN' ? title : `${title}（天心）`) : [])
  const hiddenCodes = [...hiddenTitles].flatMap(title => {
    const binding = PAGE_PERMS_BY_TITLE[title]
    return binding.all.filter(code => !binding.deps?.includes(code))
  })

  // 2) 按模块聚合页面;first-wins 去重,consumed 记录已被页面分组收编的权限码
  const modules = new Map<string, GroupedPermNode[]>()
  // 隐藏码也记为已消费，避免从其他页面或「其他权限」兜底重新出现。
  const consumed = new Set<string>(hiddenCodes)
  const moduleOrder: string[] = []
  for (const [title, binding] of Object.entries(PAGE_PERMS_BY_TITLE)) {
    if (hiddenTitles.has(title)) continue
    // deps 码不渲染为叶子：它们归属其他页面域（叶子挂在归属页面下），
    // 在此渲染会因 first-wins 抢占归属页面/其他消费页面的勾选入口
    const deps = binding.deps || []
    const leaves = binding.all
      .filter(code => !deps.includes(code) && permIndex.has(code) && !consumed.has(code))
      .map(code => ({ id: code, label: permIndex.get(code) as string }))
    if (!leaves.length) continue
    leaves.forEach(l => consumed.add(l.id))
    const moduleName = PAGE_MENU_BY_TITLE[title] || FALLBACK_MODULE
    if (!modules.has(moduleName)) { modules.set(moduleName, []); moduleOrder.push(moduleName) }
    modules.get(moduleName)!.push({ id: `page:${title}`, label: title, children: leaves })
  }

  // 3) 组装模块节点;id 保持 menu_id(提交侧不消费),label 转中文展示
  const result: GroupedPermNode[] = []
  for (const moduleName of moduleOrder) {
    result.push({ id: `module:${moduleName}`, label: MENU_DISPLAY_NAMES[moduleName] || moduleName, children: modules.get(moduleName)! })
  }
  const leftover: GroupedPermNode[] = []
  collectUnconsumedPerms(source || [], consumed, leftover)
  if (leftover.length) {
    result.push({ id: `module:${FALLBACK_MODULE}`, label: FALLBACK_MODULE, children: leftover })
  }
  return result
}
