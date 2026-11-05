/**
 * 天心贸易模式「写入口门」组合式函数（Vue / Pinia 胶水层）。
 *
 * ── 为什么需要它 ──────────────────────────────────────────────────────────
 * 后端判定某租户为天心模式时，会对**采购单 / 入库单 / 采购退货 / 销售订单 / 销售退货**
 * 五类单据的写接口统一返回 403：
 *   · 提示文案：「采购/销售由天心 ERP 接管，本系统仅提供查询」
 *   · 门禁实现：`require_purchase_sales_write_access`
 *     （nuomi_wms/app/services/trade/access.py）
 *   · 挂载位置：nuomi_wms/app/api/v1/endpoints/tenant_purchase_management.py（39 处）
 *               nuomi_wms/app/api/v1/endpoints/tenant_sales_order_management.py（28 处）
 *
 * 查询接口**未封锁**，所以这些页面仍要能看，只是不能写。
 * ⇒ 前端必须在这些页面隐藏写入口，否则用户点「新增 / 编辑 / 审核」必然撞 403。
 *
 * 与共享页机制的关系（★ 2026-09-21 修正后）：
 *   天心四单据的承载页是 `TRADE_SHARED_PAGES` 指定的 4 个 WMS 页面 ——
 *   **采购订单**（/purchase/order）、采购退货单、销售订单、销售退货单。
 *   其中被 `TradeBillList` 整体替换的页面，写入口自然消失，无需本门；
 *   而**采购入库单不参与天心侧**（天心采购只涉及采购订单与采购退货单），它在天心模式下
 *   仍渲染 WMS 列表，**但它的写接口仍被后端 403 封锁** → 本门的主要适用对象。
 *
 * 判定规则本身在 `config/tradeModeRule.ts`（纯函数，可单测）；本文件只负责把它接到
 * `tradeMode` store 上，避免规则散落在各页面。
 *
 * ── fail-open ────────────────────────────────────────────────────────────
 * 模式未加载 / 加载失败时 `isTianxin` 为 false → 判定为「可写」（按钮照常显示），由后端
 * 403 兜底。与 `stores/tradeMode.ts` 的 fail-open 策略一致：不能让一次
 * `/tenant-trade/mode` 网络抖动把整个采购/销售模块的写入口锁死。
 */
import { computed } from 'vue'
import { useTradeModeStore } from '@/stores/tradeMode'
import {
  TIANXIN_BLOCKED_PURCHASE_SCENES,
  TIANXIN_WRITE_BLOCKED_TIP,
  isPurchaseSceneWriteBlocked,
} from '@/config/tradeModeRule'

// 供页面按需直接引用（规则与文案的单一来源仍在 config/tradeModeRule.ts）
export { TIANXIN_BLOCKED_PURCHASE_SCENES, TIANXIN_WRITE_BLOCKED_TIP, isPurchaseSceneWriteBlocked }

export function useTradeModeGate() {
  const tradeModeStore = useTradeModeStore()

  /** 是否天心贸易模式（本系统采购/销售写接口被封） */
  const isTianxinMode = computed(() => tradeModeStore.isTianxin)

  /** 采购 / 销售的「写」是否可用（fail-open：未加载或加载失败时放行，后端 403 兜底） */
  const canWritePurchaseSales = computed(() => !tradeModeStore.isTianxin)

  /** 财务模块是否可用（天心模式下恒 false；财务菜单由权限层自动剪枝，无需页面级门） */
  const canAccessFinance = computed(() => tradeModeStore.financeEnabled)

  /**
   * 给定采购列表场景，判断其写入口是否可用（= 是否未被天心模式封锁）。
   * 规则见 `config/tradeModeRule.ts::isPurchaseSceneWriteBlocked`。
   *
   * @param sceneType `PurchaseGenericList` 的 `type` 取值
   */
  function canWritePurchaseScene(sceneType: string): boolean {
    return !isPurchaseSceneWriteBlocked(sceneType, tradeModeStore.isTianxin)
  }

  return {
    isTianxinMode,
    canWritePurchaseSales,
    canAccessFinance,
    canWritePurchaseScene,
  }
}
