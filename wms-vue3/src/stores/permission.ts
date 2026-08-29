/**
 * 模块：权限可视化 - 权限状态存储
 *
 * 职责：
 *   1. 登录后（或刷新进入时）调用 `load()` 拉取当前员工可见权限
 *      （复用 role.ts 的 getVisiblePermissions → GET /api/v1/tenant-employees/visible-permissions）
 *   2. 将返回的「菜单 → 按钮 → 权限」三级结构拍平为两个集合：
 *      - menuNames: Set<menu_name>  页面级可见集合（一级/二级/三级导航过滤 + 路由守卫）
 *      - permCodes: Set<perm_code>  按钮级权限码集合（预留阶段 2 的 v-perm 指令）
 *   3. 提供 loadPromise 保证并发场景只发一次请求
 *
 * 策略：fail-closed —— 加载失败时视为无任何权限（仅公共页可达），
 *       并通过 loadError 暴露给调用方做明确提示，不静默降级为全量放行。
 *
 * 生命周期：登录成功后调用 load()；退出登录时调用 reset() 清空集合与缓存。
 */
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getVisiblePermissions } from '@/api/modules/role'
import { ElMessage } from 'element-plus'

/** sessionStorage 持久化 key：避免刷新瞬间菜单「先全量后收窄」的闪烁 */
const STORAGE_KEY = 'visible_menus_cache'

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
  /** 按钮级权限码集合（后端 sys_permission.perm_code），阶段 2 预留 */
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
        const res = await getVisiblePermissions()
        const menus = Array.isArray(res.data) ? res.data : []
        const nextMenus = new Set<string>()
        const nextPerms = new Set<string>()
        for (const menu of menus) {
          if (menu?.label) nextMenus.add(String(menu.label))
          const buttons = Array.isArray(menu?.children) ? menu.children : []
          for (const button of buttons) {
            const perms = Array.isArray(button?.children) ? button.children : []
            for (const perm of perms) {
              if (perm?.id) nextPerms.add(String(perm.id))
            }
          }
        }
        menuNames.value = nextMenus
        permCodes.value = nextPerms
        loadError.value = null
        isLoaded.value = true
        persistCache()
      } catch (err) {
        // fail-closed：失败时清空集合，仅公共页可达
        menuNames.value = new Set()
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

  /** 按钮级：员工是否拥有某权限码（阶段 2 预留） */
  function hasPerm(code: string): boolean {
    return permCodes.value.has(code)
  }

  /** 退出登录时重置全部状态与缓存 */
  function reset() {
    menuNames.value = new Set()
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

  return { menuNames, permCodes, isLoaded, loadError, load, hasMenu, hasPerm, reset }
})

/** 非组件环境下的提示兜底（守卫中失败提示） */
export function warnPermissionFailure() {
  ElMessage.warning('权限加载失败，请重新登录或联系管理员')
}
