/**
 * 天心贸易模式 —— 写入口判定规则（纯常量 + 纯函数，无 Vue / Pinia / 网络依赖）。
 *
 * 单独成文件的原因：这是「按模式隐藏写入口」的**唯一判定点**，写错会静默丢按钮或
 * 留下必然 403 的死入口，属"静默且致命"的错误，需要能被 `node --test` 直接覆盖
 * （与 `config/pagePermissionMap.ts` + `pagePermissionMap.test.mjs` 同一套路）。
 *
 * 后端口径（勿在别处重复实现）：
 *   天心模式判定见 `stores/tradeMode.ts` → 后端 `GET /tenant-trade/mode` 的
 *   `purchase_sales_mode`；天心模式下后端对**采购单 / 入库单 / 采购退货 / 销售订单 /
 *   销售退货**五类单据的写接口统一 403（`require_purchase_sales_write_access`）。
 */

/**
 * 天心模式下写接口被封锁的**采购通用列表场景**（`PurchaseGenericList` 的 `type` 取值）。
 *
 * 与后端被封锁的"单据"族一一对应：采购单 / 入库单 / 采购退货。
 * （后端门禁 `require_purchase_sales_write_access` 只挂这三族 + 销售订单/销售退货）
 *
 * 三者当前的作用差异（★ 2026-09-21 修正后）：
 *   - `inbound`（采购入库单）：**真正需要本门**。它不参与天心侧，天心模式下仍渲染 WMS 列表，
 *     但写接口被后端 403 → 必须隐藏写入口。
 *   - `order` / `return`：天心模式下对应页面已被 `TradeBillList` 整体替换，
 *     写入口自然消失；保留在表内作为防御（共享页机制若变化仍能拦住）。
 *
 * ⚠️ 不在本表内的场景**不受影响、仍可写**，勿误加：
 *   - `supplier` / `supplierType` —— 供应商主数据，天心模式下仍归 WMS
 *   - `supplierBalance` / `inboundDetail` / `returnSummary` —— 只读报表页
 */
export const TIANXIN_BLOCKED_PURCHASE_SCENES: readonly string[] = ['order', 'inbound', 'return']

/** 写入口被封锁时的提示文案（与后端 403 的 detail 保持一致，便于用户对照） */
export const TIANXIN_WRITE_BLOCKED_TIP = '采购/销售单据已由天心 ERP 接管，本系统仅提供查询'

/**
 * 判定「某采购列表场景的写入口是否被天心模式封锁」。
 *
 * 规则：`天心模式` **且** `该场景属于被封锁的单据族` → 封锁。
 * 非天心模式下一律放行（含模式未加载 / 加载失败 —— fail-open，由后端 403 兜底）。
 *
 * @param sceneType 采购通用列表场景（`PurchaseGenericList` 的 `type`）
 * @param isTianxin 当前租户是否天心贸易模式
 */
export function isPurchaseSceneWriteBlocked(sceneType: string, isTianxin: boolean): boolean {
  return isTianxin && TIANXIN_BLOCKED_PURCHASE_SCENES.includes(sceneType)
}
