import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { ApiResponse } from '@/utils/request'
import { importRequestError } from '@/utils/importTask'

export function useImportTaskQuery<T>(options: {
  key: () => string
  enabled: () => boolean
  request: (signal: AbortSignal) => Promise<ApiResponse<T>>
  interval: (data: T) => number
  retryIntervalMs?: number
  maxConsecutiveFailures?: number
}) {
  const data = shallowRef<T | null>(null)
  const loading = ref(false)
  const error = ref('')
  const visible = ref(document.visibilityState !== 'hidden')
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  let generation = 0
  let failures = 0
  const sessionToken = localStorage.getItem('token')
  let sessionInvalidated = false

  function sessionCurrent() {
    if (sessionInvalidated) return false
    if (localStorage.getItem('token') === sessionToken) return true
    sessionInvalidated = true
    stop()
    data.value = null
    error.value = ''
    return false
  }

  function stop() {
    generation++
    clearTimeout(timer)
    controller?.abort()
    controller = undefined
    loading.value = false
  }

  async function run() {
    stop()
    if (!sessionCurrent() || !options.enabled() || !visible.value) return
    const current = generation
    controller = new AbortController()
    loading.value = true
    error.value = ''
    try {
      const response = await options.request(controller.signal)
      if (current !== generation || !sessionCurrent() || !options.enabled()) return
      data.value = response.data
      failures = 0
      const interval = options.interval(response.data)
      if (interval > 0) timer = setTimeout(run, interval)
    } catch (e) {
      if (current !== generation || !sessionCurrent()) return
      error.value = importRequestError(e)
      failures++
      const status = (e as { response?: { status?: number } })?.response?.status
      const retryable = !status || status === 429 || status >= 500
      if (retryable && failures < (options.maxConsecutiveFailures ?? 3) && options.enabled() && visible.value) {
        timer = setTimeout(run, options.retryIntervalMs ?? 5000)
      }
    } finally {
      if (current === generation) loading.value = false
    }
  }

  function refresh() { failures = 0; return run() }

  watch([options.key, options.enabled, visible], (values, previous) => {
    if (!previous || values[0] !== previous[0]) data.value = null
    void refresh()
  }, { immediate: true })

  function onVisibilityChange() { visible.value = document.visibilityState !== 'hidden' }
  function onStorageChange(event: StorageEvent) { if (event.key === 'token' || event.key === null) sessionCurrent() }
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('storage', onStorageChange)
  onScopeDispose(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('storage', onStorageChange)
  })

  return { data, loading, error, refresh }
}
