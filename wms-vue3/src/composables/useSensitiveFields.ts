import { computed, onActivated, onDeactivated, shallowRef, watch } from 'vue'
import { useSensitiveFieldStore } from '@/stores/sensitiveField'
import { omitSensitivePaths, sensitivePathCovers, type ResponseSensitiveRestriction } from '@/utils/sensitiveFields'
// 【敏感字段体系未上线·暂时注释 2026-10-28】响应受限字段解析暂停，恢复时改回：
// import { omitSensitivePaths, responseSensitiveRestrictions, sensitivePathCovers } from '@/utils/sensitiveFields'

/** 每个数据区绑定实际调用接口，响应和隐藏提示以本次响应整体替换。 */
export function useSensitiveFields(options: { interfacePath: () => string; enabled?: () => boolean }) {
  const store = useSensitiveFieldStore()
  const sessionToken = localStorage.getItem('token')
  let active = true
  const responseRestrictions = shallowRef<ResponseSensitiveRestriction[]>([])
  const path = computed(() => store.normalizePath(options.interfacePath()))
  const state = computed(() => store.entries.get(path.value))
  const validSession = computed(() => { void store.revision; return localStorage.getItem('token') === sessionToken })
  const confirmed = computed(() => validSession.value && state.value?.status === 'ready')
  const hiddenPaths = computed(() => [
    ...(state.value?.fields ?? []).filter(item => item.io_type === 'OUTPUT' && item.restriction_type === 1).map(item => item.param_name),
    ...responseRestrictions.value.flatMap(item => item.param_names),
  ])
  const inputPaths = computed(() => (state.value?.fields ?? []).filter(item => item.io_type === 'INPUT').map(item => item.param_name))
  async function refresh() {
    if (options.enabled?.() !== false && path.value && validSession.value) await store.load(path.value, true)
  }
  function reload() { if (active) void refresh() }
  // 本次数据返回前保留上一响应的隐藏提示，避免切换搜索接口时短暂恢复旧列。
  watch([path, () => options.enabled?.() !== false, () => store.revision], reload, { immediate: true })
  onActivated(() => { active = true; reload() })
  onDeactivated(() => { active = false })
  return {
    state, confirmed, hiddenPaths, reload, refresh,
    // 【敏感字段体系未上线·暂时注释 2026-10-28】响应中的受限字段信息暂不解析，保持空实现：
    // setResponse: (data: unknown) => { responseRestrictions.value = responseSensitiveRestrictions(data) },
    setResponse: (_data: unknown) => { /* 敏感字段体系未上线：空实现 */ },
    canView: (field: string) => validSession.value && !hiddenPaths.value.some(item => sensitivePathCovers(item, field)),
    canEdit: (field: string) => confirmed.value && !inputPaths.value.some(item => sensitivePathCovers(item, field)),
    sanitizeOutput: <T>(payload: T): T => omitSensitivePaths(payload, hiddenPaths.value),
    sanitizeUpdate: <T>(payload: T): T => {
      if (!confirmed.value) throw new Error('权限状态未确认，请重新加载后保存')
      return omitSensitivePaths(payload, inputPaths.value)
    },
  }
}
