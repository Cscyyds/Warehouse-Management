import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useTenantModeStore } from './tenantMode'

export const useBorrowModeStore = defineStore('borrowMode', () => {
  const tenant = useTenantModeStore()
  return {
    mode: computed(() => tenant.mode === 'LOCAL' ? 'NATIVE' : tenant.mode),
    isTianxin: computed(() => tenant.isTianxin),
    isMenuVisible: computed(() => tenant.mode === null || tenant.availableModules.includes('BORROW')),
    isLoaded: computed(() => tenant.isLoaded),
    loadError: computed(() => tenant.loadError),
    load: tenant.load, reset: tenant.reset,
  }
})
