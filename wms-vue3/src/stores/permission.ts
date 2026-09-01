/**
 * 模块：权限可视化 - 权限状态存储
 *
 * 职责：
 *   1. 登录后（或刷新进入时）调用 `load()` 拉取当前登录员工个人可见权限
 *      （role.ts 的 getMyPermissions → GET /api/v1/tenant-employees/my-permissions，
 *       管理员角色=租客全部可见权限，普通角色=仅其角色绑定的权限）
 *      注：visible-permissions 返回租客级全集（与登录人无关），用于角色绑定树，
 *          页面级过滤必须用 my-permissions，否则普通员工会放行全部模块页面。
 *   2. 将返回的「菜单 → 按钮 → 权限」三级结构拍平为三类状态，驱动三级可视化：
 *      - menuNames: Set<menu_name>        一级导航/二级菜单/路由守卫（页面入口隐藏）
 *      - permCodes: Set<perm_code>        按钮级权限码集合（v-perm 指令 / hasUrlPerm，现行方案）
 *      - buttonsByMenu: Map<menu, Set>    按钮名关键词匹配（hasButtonPerm，迁移期兼容，已弃用）
 *   3. 提供 loadPromise 保证并发场景只发一次请求
 *
 * 策略：fail-closed —— 加载失败时视为无任何权限（仅公共页可达），
 *       并通过 loadError 暴露给调用方做明确提示，不静默降级为全量放行。
 *       按钮级校验（v-perm）在端点未登记时 fail-open，交由后端接口级权限兜底，
 *       避免映射缺失把按钮（含管理员的）误隐藏。
 *
 * 生命周期：登录成功后调用 load()；退出登录时调用 reset() 清空集合与缓存。
 */
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getMyPermissions, type PermissionTreeNode } from '@/api/modules/role'
import { resolvePermCodesByEndpoint } from '@/config/permissionUrlMap'
import { ElMessage } from 'element-plus'

/** sessionStorage 持久化 key：避免刷新瞬间菜单「先全量后收窄」的闪烁 */
const STORAGE_KEY = 'visible_menus_cache'

/**
 * 三级按钮可视化：标准动作 → 后端 sys_button.button_name 子串关键词。
 * 按钮均为业务命名（如「新增供应商」「更改采购订单」「采购订单审核」），
 * 同一模块菜单下按动作关键词匹配即认定可用。
 * 未收录的动作可用自定义关键词（如 '授信调整'）直接传按钮名子串。
 */
const BUTTON_ACTION_KEYWORDS: Record<string, string[]> = {
  add: ['新增', '创建', '添加', '新建'],
  edit: ['编辑', '修改', '更新', '调整', '更改'],
  delete: ['删除'],
  import: ['导入'],
  export: ['导出'],
  audit: ['审核'],
  print: ['打印'],
}

/** 递归收集树节点中的按钮名（type=button 或带 children 的节点；权限叶子无 children） */
function collectButtonNames(nodes: PermissionTreeNode[] | undefined, out: Set<string>): void {
  for (const node of nodes || []) {
    if (!node) continue
    if (node.type === 'perm') continue
    if (node.type === 'button' || Array.isArray(node.children)) {
      if (node.label) out.add(String(node.label))
    }
    if (node.children?.length) collectButtonNames(node.children, out)
  }
}

/**
 * 递归收集权限码。必须递归：后端把 perm 叶子与子按钮**并列**放在 children 下
 * （见 api/modules/role.ts 的 normalizeButtonNode），只下探一层既会把 button_id
 * 误当权限码，又会漏掉父子按钮结构下的孙层权限。
 */
function collectPermCodes(nodes: PermissionTreeNode[] | undefined, out: Set<string>): void {
  for (const node of nodes || []) {
    if (!node) continue
    if (node.type === 'perm') {
      if (node.id) out.add(String(node.id))
      continue
    }
    if (node.children?.length) collectPermCodes(node.children, out)
  }
}

function readCachedMenus(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : []
  } catch {
    return []
  }
}

export const usePermissionStore = defineStore('permission', () => {
  /** 页面级可见菜单名集合（后端 sys_menu.menu_name） */
  const menuNames = ref<Set<string>>(new Set(readCachedMenus()))
  /** 三级按钮可视化：模块菜单名 → 该菜单下当前用户可用的按钮名集合（后端 sys_button.button_name） */
  const buttonsByMenu = ref<Map<string, Set<string>>>(new Map())
  /** 按钮级权限码集合（后端 sys_permission.perm_code） */
  const permCodes = ref<Set<string>>(new Set())
  /** 是否已完成首次加载（无论成功失败） */
  const isLoaded = ref(false)
  /** 最近一次加载的错误信息（成功时为 null） */
  const loadError = ref<string | null>(null)
  /** 并发去重：进行中的加载 Promise */
  let loadPromise: Promise<void> | null = null

  function persistCache() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...menuNames.value]))
    } catch {
      /* 存储失败不影响主流程 */
    }
  }

  /**
   * 拉取可见权限（幂等、并发去重）。
   * 已加载过（无论成功失败）时不重复请求，避免失败后每次导航都重试打爆接口；
   * 需要刷新时（重新登录、角色变更）传 force=true。
   */
  function load(force = false): Promise<void> {
    if (loadPromise) return loadPromise
    if (isLoaded.value && !force) return Promise.resolve()

    loadPromise = (async () => {
      try {
        const res = await getMyPermissions()
        const menus = Array.isArray(res.data) ? res.data : []
        const nextMenus = new Set<string>()
        const nextButtons = new Map<string, Set<string>>()
        const nextPerms = new Set<string>()
        for (const menu of menus) {
          if (menu?.label) nextMenus.add(String(menu.label))
          // 三级按钮可视化：递归收集该菜单下全部按钮名（含子按钮）
          const buttonNames = new Set<string>()
          collectButtonNames(menu?.children, buttonNames)
          if (menu?.label) nextButtons.set(String(menu.label), buttonNames)
          collectPermCodes(menu?.children, nextPerms)
        }
        menuNames.value = nextMenus
        buttonsByMenu.value = nextButtons
        permCodes.value = nextPerms
        loadError.value = null
        isLoaded.value = true
        persistCache()
      } catch (err) {
        // fail-closed：失败时清空集合，仅公共页可达
        menuNames.value = new Set()
        buttonsByMenu.value = new Map()
        permCodes.value = new Set()
        loadError.value = err instanceof Error ? err.message : String(err)
        isLoaded.value = true
        console.error('[权限加载失败]', err)
      } finally {
        loadPromise = null
      }
    })()
    return loadPromise
  }

  /** 页面级：员工是否可见某菜单（页面） */
  function hasMenu(name: string | null | undefined): boolean {
    if (!name) return false
    return menuNames.value.has(name)
  }

  /** 按钮级：员工是否拥有某权限码 */
  function hasPerm(code: string): boolean {
    return permCodes.value.has(code)
  }

  /**
   * 按钮级（推荐）：按接口 URL 判断权限。
   * @param endpoint `'POST /api/v1/xxx/create'` 或 `'/api/v1/xxx/create'`（后者按 POST→GET 回退）
   * @returns 该端点对应的任一 perm_code 命中即 true；
   *          端点未在字典中登记时 fail-open 返回 true，由后端接口级权限兜底
   *          （避免漏登记把管理员按钮藏掉；指令层会在 DEV 下 warn）。
   */
  function hasUrlPerm(endpoint: string): boolean {
    const codes = resolvePermCodesByEndpoint(endpoint)
    if (!codes.length) return true
    return codes.some(code => permCodes.value.has(code))
  }

  /**
   * 三级按钮级：员工在指定模块菜单下是否可用某操作按钮。
   * @param action  标准动作名（add/edit/delete/import/export/audit/print）
   *                或按钮名子串（如 '采购状态'、'发送'、'授信调整'）
   * @param menus   所属页面对应的后端模块菜单名（resolveMenuCandidates 结果）
   * @returns 命中任一菜单下的任一关键词按钮即 true；模块集为空（公共页/继承页/
   *          非模块页）时 fail-open 返回 true，由后端接口级权限兜底。
   */
  function hasButtonPerm(action: string, menus: string | string[]): boolean {
    const keywords = BUTTON_ACTION_KEYWORDS[action] || [action]
    const menuList = (Array.isArray(menus) ? menus : [menus]).filter(Boolean)
    if (!menuList.length) return true // 非模块级页面：不按按钮权限隐藏
    for (const menu of menuList) {
      const buttonNames = buttonsByMenu.value.get(menu)
      if (!buttonNames?.size) continue
      for (const name of buttonNames) {
        if (keywords.some(keyword => name.includes(keyword))) return true
      }
    }
    return false
  }

  /** 退出登录时重置全部状态与缓存 */
  function reset() {
    menuNames.value = new Set()
    buttonsByMenu.value = new Map()
    permCodes.value = new Set()
    loadError.value = null
    isLoaded.value = false
    loadPromise = null
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* 忽略 */
    }
  }

  return { menuNames, buttonsByMenu, permCodes, isLoaded, loadError, load, hasMenu, hasPerm, hasUrlPerm, hasButtonPerm, reset }
})

/** 非组件环境下的提示兜底（守卫中失败提示） */
export function warnPermissionFailure() {
  ElMessage.warning('权限加载失败，请重新登录或联系管理员')
}
