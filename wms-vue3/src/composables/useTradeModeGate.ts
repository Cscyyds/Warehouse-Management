import { computed } from 'vue'
import { useTradeModeStore } from '@/stores/tradeMode'
import { TIANXIN_BLOCKED_PURCHASE_SCENES, TIANXIN_WRITE_BLOCKED_TIP, isPurchaseSceneWriteBlocked } from '@/config/tradeModeRule'
export { TIANXIN_BLOCKED_PURCHASE_SCENES, TIANXIN_WRITE_BLOCKED_TIP, isPurchaseSceneWriteBlocked }

/** Unknown tenant mode does not grant LOCAL document write capability. */
export function useTradeModeGate() {
  const trade = useTradeModeStore()
  const isTianxinMode = computed(() => trade.isTianxin)
  const canWritePurchaseSales = computed(() => trade.mode === 'NATIVE')
  const canAccessFinance = computed(() => trade.financeEnabled)
  function canWritePurchaseScene(sceneType: string): boolean {
    return !(TIANXIN_BLOCKED_PURCHASE_SCENES as readonly string[]).includes(sceneType) || trade.mode === 'NATIVE'
  }
  return { isTianxinMode, canWritePurchaseSales, canAccessFinance, canWritePurchaseScene }
}
