import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useTenantModeStore } from './tenantMode'

/** NATIVE remains a page-level alias for the unified LOCAL mode. */
export const useTradeModeStore = defineStore('tradeMode', () => {
  const tenant = useTenantModeStore()
  return {
    mode: computed(() => tenant.mode === 'LOCAL' ? 'NATIVE' : tenant.mode),
    financeEnabled: computed(() => tenant.availableModules.includes('FINANCE')),
    purchaseSalesEnabled: computed(() => tenant.mode === 'LOCAL' && tenant.availableModules.includes('PURCHASE_SALES')),
    channelCode: computed(() => tenant.isTianxin ? 'TIANXIN' : null),
    isTianxin: computed(() => tenant.isTianxin),
    isLoaded: computed(() => tenant.isLoaded),
    loadError: computed(() => tenant.loadError),
    load: tenant.load, reset: tenant.reset,
  }
})
