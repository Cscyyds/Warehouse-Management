import { reactive, ref, watch, toValue, type WatchSource } from 'vue'

interface PaginationState {
  page: number
  pageSize: number
  total: number
}

interface OpenReloadOptions {
  visible: WatchSource<boolean>
  load: () => void | Promise<void>
  reset?: () => void
  immediate?: boolean
}

interface DependencyReloadOptions<T> {
  visible: WatchSource<boolean>
  dependency: WatchSource<T>
  load: () => void | Promise<void>
  reset?: () => void
  isReady?: (value: T) => boolean
}

export function useRemoteDialogPagination(initialPageSize = 20) {
  const loading = ref(false)
  const pagination = reactive<PaginationState>({
    page: 1,
    pageSize: initialPageSize,
    total: 0,
  })

  function resetPage() {
    pagination.page = 1
  }

  function resetPagination() {
    pagination.page = 1
    pagination.total = 0
  }

  function clearPaginationTotal() {
    pagination.total = 0
  }

  async function withMinLoading<T>(task: () => Promise<T>, minMs = 200): Promise<T> {
    loading.value = true
    const minDelay = new Promise((resolve) => setTimeout(resolve, minMs))
    try {
      const result = await task()
      await minDelay
      return result
    } catch (error) {
      await minDelay
      throw error
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    pagination,
    resetPage,
    resetPagination,
    clearPaginationTotal,
    withMinLoading,
  }
}

export function useDialogOpenReload(options: OpenReloadOptions) {
  watch(
    options.visible,
    (visible) => {
      if (!visible) return
      options.reset?.()
      void options.load()
    },
    { immediate: options.immediate }
  )
}

export function useDialogDependencyReload<T>(options: DependencyReloadOptions<T>) {
  watch(options.dependency, (value, previousValue) => {
    if (!toValue(options.visible)) return
    if (Object.is(value, previousValue)) return
    if (options.isReady && !options.isReady(value)) return
    options.reset?.()
    void options.load()
  })
}
