/**
 * 借出借入「模式显隐」判据（纯常量 + 纯函数，无 Vue / Pinia / 网络依赖）。
 *
 * 单独成文件的原因与 `config/tradeModeRule.ts` 相同：这是「按模式隐藏入口」的**唯一判定点**，
 * 写反了会静默藏掉天心租户的整块业务，或给 WMS 自营租户留一个必然 403 的死入口，
 * 属"静默且致命"的错误，需要能被 `node --test` 直接覆盖。
 *
 * 后端口径（勿在别处重复实现）：
 *   天心借出借入 ⟺ BORROW 行存在 且 enabled == 0 且 channel_code == 'TIANXIN'；
 *   无 BORROW 行 → NATIVE。见 `nuomi_wms/app/api/v1/endpoints/tenant_borrow_management.py:894-911`。
 *   前端只消费 `GET /tenant-borrow/mode` 的 `borrow_mode`，不自行拼判据。
 *
 * ⚠️ 与贸易模块（`stores/tradeMode.ts`）是**两套独立判据**：贸易还要求 FINANCE.enabled == 0，
 *   借出借入只看 BORROW 一行。不可互相替代。
 */

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
