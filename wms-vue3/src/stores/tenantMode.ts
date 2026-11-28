import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getMyProfile } from '@/api/modules/personnel'
import { readTenantMode, type TenantMode } from '@/config/tenantMode'

/** The current user's tenant mode is the only source of module capabilities. */
export const useTenantModeStore = defineStore('tenantMode', () => {
  const mode = ref<TenantMode | null>(null)
  const revision = ref<number | null>(null)
  const availableModules = ref<string[]>([])
  const isLoaded = ref(false)
  const loadError = ref<string | null>(null)
  let loadedToken = ''
  let pending: { token: string; promise: Promise<void> } | null = null
  let generation = 0
  const isTianxin = computed(() => mode.value === 'TIANXIN')

  function load(force = false): Promise<void> {
    const token = String(localStorage.getItem('token') || '')
    if (pending?.token === token) return pending.promise
    if (!force && isLoaded.value && loadedToken === token) return Promise.resolve()
    const current = ++generation
    mode.value = null
    revision.value = null
    availableModules.value = []
    isLoaded.value = false
    loadError.value = null
    const promise = (async () => {
      try {
        const res = await getMyProfile()
        const snapshot = readTenantMode(res.data)
        if (generation !== current || token !== String(localStorage.getItem('token') || '')) return
        mode.value = snapshot.tenant_mode
        revision.value = snapshot.tenant_mode_revision
        availableModules.value = snapshot.available_modules
      } catch (error) {
        if (generation !== current) return
        loadError.value = error instanceof Error ? error.message : String(error)
      } finally {
        if (generation === current) {
          loadedToken = token
          isLoaded.value = true
          pending = null
        }
      }
    })()
    pending = { token, promise }
    return promise
  }

  function reset() {
    generation++
    mode.value = null
    revision.value = null
    availableModules.value = []
    isLoaded.value = false
    loadError.value = null
    loadedToken = ''
    pending = null
    try {
      sessionStorage.removeItem('trade_mode_cache_v1')
      sessionStorage.removeItem('borrow_mode_cache_v1')
    } catch { /* Session storage may be disabled. */ }
  }

  return { mode, revision, availableModules, isLoaded, loadError, isTianxin, load, reset }
})
