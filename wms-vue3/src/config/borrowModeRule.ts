/** 页面模式由 /tenant-users/me 的 tenant_mode 提供；LOCAL 在现有页面规则中映射为 NATIVE。 */

/** 借出借入模式：TIANXIN=天心 ERP 单据族；NATIVE=本系统（不提供该模块）；null=未就绪/加载失败 */
export type BorrowMode = 'TIANXIN' | 'NATIVE' | null

/**
 * 是否展示「借出借入」一级导航，也是 `/borrow/**` 深链的放行条件。
 *
 * 规则：**只有明确 NATIVE 才隐藏**；TIANXIN 与未知态（null）都放行。
 * 未知态放行的理由：接口故障时若按 NATIVE 隐藏，会把天心租户的入口整块锁死；
 * 而放行的下行兜底是有效的——权限树（REQUIRE_BORROW_ERP_SYNC）会剪枝，
 * 后端 `_require_tianxin_borrow_mode` 也会对越权访问返回 403。
 *
 * @param mode 后端 `borrow_mode`（或 null=未加载/失败）
 */
export function isBorrowNavVisible(mode: BorrowMode): boolean {
  return mode !== 'NATIVE'
}

/**
 * 是否拦截该路径的直接访问（手输 URL / 旧书签 / 站内残留链接）。
 *
 * 只拦 `/borrow` 与 `/borrow/**`，不影响其他业务路径。
 */
export function isBorrowDeepLinkBlocked(mode: BorrowMode, path: string): boolean {
  if (mode !== 'NATIVE') return false
  return path === '/borrow' || path.startsWith('/borrow/')
}
