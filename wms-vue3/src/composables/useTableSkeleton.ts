/**
 * 表格「首屏骨架」判定。
 *
 * 只区分两种加载：
 * - 首次加载（本页从未成功加载过数据）→ initialLoading = true，页面表格渲染骨架行；
 * - 翻页 / 查询 / keep-alive 切回标签页的刷新 → 不再出骨架，沿用 v-loading 遮罩旧数据，
 *   避免每次回到标签页都闪一次骨架。
 *
 * 用法：
 * ```ts
 * const { initialLoading, skeletonRows } = useTableSkeleton(loading)
 * // el-table: :data="initialLoading ? skeletonRows : tableData"
 * //           :class="{ 'table-skeleton': initialLoading }"
 * // v-loading（ListTemplate 的 :loading 或表格自身）: loading && !initialLoading
 * ```
 */
import { computed, ref, watch, type Ref } from 'vue'

/** 首屏加载判定：从未成功加载过数据时的 loading 为 true；翻页/刷新/切回标签页返回 false */
export function useInitialLoading(loading: Ref<boolean>) {
  /** 是否已经历过一次加载结束（成功或失败均算，避免请求失败后骨架常驻） */
  const everLoaded = ref(false)
  watch(loading, (value) => {
    if (!value) everLoaded.value = true
  })
  return computed(() => loading.value && !everLoaded.value)
}

export function useTableSkeleton(loading: Ref<boolean>, rows = 8) {
  const initialLoading = useInitialLoading(loading)
  const skeletonRows = computed(() =>
    initialLoading.value ? Array.from({ length: rows }, () => ({})) : [],
  )

  return { initialLoading, skeletonRows }
}
