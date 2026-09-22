import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { ApiResponse } from '@/utils/request'
import { importRequestError } from '@/utils/importTask'

export function useImportTaskQuery<T>(options: {
  key: () => string
  enabled: () => boolean
  request: (signal: AbortSignal) => Promise<ApiResponse<T>>
  interval: (data: T) => number
}) {
  const data = shallowRef<T | null>(null)
  const loading = ref(false)
  const error = ref('')
  const visible = ref(document.visibilityState !== 'hidden')
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  let generation = 0

  function stop() {
    generation++
    clearTimeout(timer)
    controller?.abort()
    controller = undefined
    loading.value = false
  }

  async function refresh() {
    stop()
    if (!options.enabled() || !visible.value) return
    const current = generation
    controller = new AbortController()
    loading.value = true
    error.value = ''
    try {
      const response = await options.request(controller.signal)
      if (current !== generation) return
      data.value = response.data
      const interval = options.interval(response.data)
      if (interval > 0) timer = setTimeout(refresh, interval)
    } catch (e) {
      if (current === generation) error.value = importRequestError(e)
    } finally {
      if (current === generation) loading.value = false
    }
  }

  watch([options.key, options.enabled, visible], (values, previous) => {
    if (!previous || values[0] !== previous[0]) data.value = null
    void refresh()
  }, { immediate: true })

  function onVisibilityChange() { visible.value = document.visibilityState !== 'hidden' }
  document.addEventListener('visibilitychange', onVisibilityChange)
  onScopeDispose(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { data, loading, error, refresh }
}
