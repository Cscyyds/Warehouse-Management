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
 *   - 页面:pagePermissionMap.PAGE_PERMS_BY_TITLE(页面标题 → {view, all} 权限码,2026-09-01 全模块铺开)
 *   - 叶子:仍是 perm_code(id 不变),落库值/回显/expandRolePermissionIds 联动逻辑全部不变
 *
 * 兜底(fail-open):
 *   - 未登记进 PAGE_PERMS_BY_TITLE 的权限,保留原 菜单→按钮→权限 结构,挂到「其他权限」
 *     模块下,保证任何可见权限都不会从树里丢失;
 *   - 同一权限码被多个页面引用时 first-wins(只出现在先登记的页面下),避免 el-tree
 *     node-key 重复;另一页面的 view 码仍由 expandRolePermissionIds 联动补全(值正确)。
 */

import type { PermissionTreeNode } from '@/api/modules/role'
import { PAGE_PERMS_BY_TITLE } from './pagePermissionMap'
import { PAGE_MENU_BY_TITLE, MENU_DISPLAY_NAMES } from './menuPermissionMap'

/** 重排后的树节点(id/label/children 与 el-tree 约定一致) */
export interface GroupedPermNode {
  id: string
  label: string
  children?: GroupedPermNode[]
}

/** 未分组权限的兜底模块名 */
const FALLBACK_MODULE = '其他权限'

/** 判定是否为权限叶子:标准树带 type 标记;legacy 兜底树无 type,按「非结构性 id」识别
 *  (权限码不都以 perm_ 开头,如产品知识库的 knowledge:wms:search,不能只认 perm_ 前缀) */
function isPermNode(node: PermissionTreeNode): boolean {
  const id = String(node.id || '')
  if (node.type === 'perm' || id.startsWith('perm_')) return true
  return !node.type && !/^(menu_|btn_|module:|page:)/.test(id)
}

/** 递归收集树中权限叶子:perm_code → 显示名 */
function collectPermIndex(nodes: PermissionTreeNode[], index: Map<string, string>): void {
  for (const n of nodes || []) {
    if (isPermNode(n)) index.set(String(n.id), String(n.label ?? n.id))
    if (Array.isArray(n.children) && n.children.length) collectPermIndex(n.children, index)
  }
}

/**
 * 裁剪原树:只保留包含「未被页面分组消费」权限叶子的分支。
 * 用于兜底模块——未登记页面的权限不丢失,仍按原 菜单→按钮→权限 层级展示。
 */
function pruneToUnconsumed(nodes: PermissionTreeNode[], consumed: Set<string>): PermissionTreeNode[] {
  const out: PermissionTreeNode[] = []
  for (const n of nodes || []) {
    if (isPermNode(n)) {
      if (!consumed.has(String(n.id))) out.push(n)
      continue
    }
    const children = Array.isArray(n.children) ? pruneToUnconsumed(n.children, consumed) : []
    if (children.length) out.push({ ...n, children })
  }
  return out
}

/**
 * 把 visible-permissions 返回的 菜单→按钮→权限 树重排为 模块→页面→权限 树。
 *
 * @param source getVisiblePermissions() 归一化后的树(租客级全部可分配权限)
 * @returns 重排后的树;模块节点 id 前缀 'module:'、页面节点 'page:'(均非 perm_ 前缀,
 *          提交侧 serializePermissionIds 会自动过滤,不影响落库值)
 */
export function groupRolePermissionTree(source: PermissionTreeNode[]): GroupedPermNode[] {
  // 1) 权限码 → 显示名 索引(租户可见集合)
  const permIndex = new Map<string, string>()
  collectPermIndex(source || [], permIndex)

  // 2) 按模块聚合页面;first-wins 去重,consumed 记录已被页面分组收编的权限码
  const modules = new Map<string, GroupedPermNode[]>()
  const consumed = new Set<string>()
  const moduleOrder: string[] = []
  for (const [title, binding] of Object.entries(PAGE_PERMS_BY_TITLE)) {
    const leaves = binding.all
      .filter(code => permIndex.has(code) && !consumed.has(code))
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
  const leftover = pruneToUnconsumed(source || [], consumed)
  if (leftover.length) {
    result.push({ id: `module:${FALLBACK_MODULE}`, label: FALLBACK_MODULE, children: leftover })
  }
  return result
}
