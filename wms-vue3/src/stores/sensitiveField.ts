import { defineStore } from 'pinia'
import { onScopeDispose, ref, shallowRef } from 'vue'
// 【敏感字段体系未上线·暂时注释 2026-10-28】预判接口暂停调用，恢复时取消注释：
// import { getSensitiveRestrictions } from '@/api/modules/sensitiveField'
import type { SensitiveFieldRestriction } from '@/api/modules/sensitiveField'
// 【敏感字段体系未上线·暂时注释 2026-10-28】import { normalizeApiError } from '@/utils/apiError'
// 【敏感字段体系未上线·暂时注释 2026-10-28】import { parseSensitivePath } from '@/utils/sensitiveFields'

export interface SensitiveRestrictionState {
  status: 'loading' | 'ready' | 'unknown'
  fields: SensitiveFieldRestriction[]
  message: string
  fetchedAt: number
}
export const useSensitiveFieldStore = defineStore('sensitive-fields', () => {
  const entries = shallowRef(new Map<string, SensitiveRestrictionState>())
  const revision = ref(0)
  let token = localStorage.getItem('token')
  let generation = 0
  const pending = new Map<string, Promise<SensitiveRestrictionState>>()
  const normalizePath = (path: string) => path.replace(/^\/api\/v1(?=\/)/, '')
  function retainRestrictions() {
    return new Map([...entries.value].filter(([, state]) => state.fields.length > 0).map(([path, state]) => [path, {
      status: 'unknown' as const, fields: state.fields, message: '权限状态待重新确认', fetchedAt: 0,
    }]))
  }
  function invalidate() {
    generation++
    const nextToken = localStorage.getItem('token')
    // 同会话只作废旧放行结果；已知限制不能因重新预判失败而自动解除。
    entries.value = token && token === nextToken ? retainRestrictions() : new Map()
    token = nextToken
    pending.clear()
    revision.value++
  }
  function put(path: string, state: SensitiveRestrictionState) { entries.value = new Map(entries.value).set(path, state) }
  async function load(path: string, force = false): Promise<SensitiveRestrictionState> {
    // 【敏感字段体系未上线·暂时注释 2026-10-28】不再调用预判接口，一律按「已确认、无限制」返回；
    // 业务页面据此自动回到全字段可见/可编辑的原生行为。体系上线后删除下方直返逻辑并取消块注释恢复原实现。
    void force
    path = normalizePath(path)
    const cached = entries.value.get(path)
    if (cached?.status === 'ready') return cached
    const open: SensitiveRestrictionState = { status: 'ready', fields: [], message: '', fetchedAt: Date.now() }
    put(path, open)
    return open
    /* 【原实现·体系上线后恢复】
    if (localStorage.getItem('token') !== token) invalidate()
    path = normalizePath(path)
    const cached = entries.value.get(path)
    if (!force && cached?.status === 'ready' && Date.now() - cached.fetchedAt < 5000) return cached
    if (pending.has(path)) return pending.get(path)!
    let current = generation
    const capturedToken = token
    put(path, { status: 'loading', fields: cached?.fields ?? [], message: '', fetchedAt: 0 })
    const promise = (async (): Promise<SensitiveRestrictionState> => {
      let state: SensitiveRestrictionState
      try {
        const response = await getSensitiveRestrictions(path, { silent: true })
        if (response.data?.interface_url !== path || typeof response.data.is_restricted !== 'boolean' || !Array.isArray(response.data.restricted_fields)
          || response.data.restricted_fields.some(item => !item || typeof item.param_name !== 'string' || !['INPUT', 'OUTPUT'].includes(item.io_type) || ![1, 2].includes(item.restriction_type))) {
          throw new Error('权限返回格式不完整，请重新加载')
        }
        response.data.restricted_fields.forEach(item => parseSensitivePath(item.param_name))
        state = { status: 'ready', fields: response.data.restricted_fields, message: '', fetchedAt: Date.now() }
      } catch (error) {
        const e = error as { message?: string; response?: { data?: unknown; status?: number } }
        if (e.response?.status === 403 && generation === current) {
          // 失去授权后清除其他路径的旧放行结果；不递增 revision，避免403触发无限自动预判。
          current = ++generation
          entries.value = retainRestrictions()
          pending.clear()
        }
        state = { status: 'unknown', fields: cached?.fields ?? [], message: normalizeApiError(e.response?.data, e.message || '权限状态未确认').message, fetchedAt: 0 }
      }
      if (generation !== current || localStorage.getItem('token') !== capturedToken) return { status: 'unknown', fields: [], message: '会话或权限已变化，请重新加载', fetchedAt: 0 }
      put(path, state)
      pending.delete(path)
      return state
    })()
    pending.set(path, promise)
    return promise
    */
  }
  const onStorage = (event: StorageEvent) => { if (event.key === 'token' || event.key === null) invalidate() }
  window.addEventListener('storage', onStorage)
  window.addEventListener('wms-sensitive-permissions-changed', invalidate)
  onScopeDispose(() => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('wms-sensitive-permissions-changed', invalidate)
  })
  return { entries, revision, load, invalidate, normalizePath }
})
