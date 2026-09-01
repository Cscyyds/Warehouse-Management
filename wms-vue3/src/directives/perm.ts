/**
 * 模块：权限可视化 - v-perm 指令（按钮级隐藏）
 *
 * 用法（URL 模式，现行方案）：
 *   <el-button v-perm="'POST /api/v1/tenant-purchase-orders/create'">新增</el-button>
 *   <el-button v-perm="'/api/v1/tenant-purchase-orders/update'">编辑</el-button>   省略方法时按 POST→GET 回退
 *
 * 匹配逻辑：URL → perm_code（config/permissionUrlMap.ts 字典，由后端权限 SQL 生成）
 *          → 当前用户 permCodes 集合（my-permissions 返回），命中任一即保留，
 *          否则隐藏（display:none 而非移除 DOM，保证 Vue diff 安全）。
 *
 * 绑定原则：
 *   - 表格里点单号/名称跳详情的 link 绑 `GET .../detail`，操作列「编辑」绑 `POST .../update`，
 *     两者分开，避免无编辑权限的用户连详情都打不开。
 *   - 前端本地生成的导出（xlsx）无后端接口，不加 v-perm。
 *
 * fail-open：端点未在字典中登记时不隐藏，交由后端接口级权限兜底；
 *            DEV 下 console.warn —— 拼错的 URL 同样表现为「不隐藏」，必须能被发现。
 *
 * 旧模式（已弃用）：v-perm="'add'" / v-perm="'采购状态'" 按 sys_button.button_name 关键词子串匹配，
 *   依赖后端按钮中文命名、易漏配；仅为迁移期保留，新代码不要再使用。
 *
 * 时序说明：路由守卫进入页面前已 await permissionStore.load()，因此 mounted 时
 * 权限数据必然就绪；keep-alive 缓存页复用挂载结果，其权限与所在路由一一对应，无需重算。
 *
 * 注意：仅做视觉隐藏，接口层仍以后端权限校验为准（防越权的最后一道防线在后端）。
 */
import type { Directive } from 'vue'
import router from '@/router'
import { usePermissionStore } from '@/stores/permission'
import { resolveMenuCandidates } from '@/config/menuPermissionMap'
import { isEndpointExpression, isEndpointRegistered } from '@/config/permissionUrlMap'

const warnedEndpoints = new Set<string>()

function warnUnregistered(value: string): void {
  if (!import.meta.env.DEV || warnedEndpoints.has(value)) return
  warnedEndpoints.add(value)
  console.warn(
    `[v-perm] 端点未在权限字典中登记，已放行：${value}\n` +
    '请检查 URL 拼写，或在 src/config/permissionUrlMap.ts 的 ENDPOINT_PERM_OVERRIDES 中补登记。'
  )
}

function apply(el: HTMLElement, value: string | undefined): void {
  if (!value) return
  const store = usePermissionStore()
  let allowed: boolean
  if (isEndpointExpression(value)) {
    if (!isEndpointRegistered(value)) warnUnregistered(value)
    allowed = store.hasUrlPerm(value)
  } else {
    const route = router.currentRoute.value
    const candidates = resolveMenuCandidates(route.path, route.meta?.title as string | undefined)
    allowed = store.hasButtonPerm(value, candidates)
  }
  el.style.display = allowed ? '' : 'none'
}

export const vPerm: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    apply(el, binding.value)
  },
  updated(el, binding) {
    apply(el, binding.value)
  },
}
