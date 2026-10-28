import { ref } from 'vue'

/**
 * 表格服务端排序 composable
 * 配合 el-table 的 @sort-change 事件使用
 *
 * 用法：
 * const { sortBy, sortOrder, handleSortChange, sortParams } = useTableSort(loadData)
 * // el-table 上添加 @sort-change="handleSortChange"
 * // el-table-column 上添加 sortable="custom"
 * // 调用 API 时传入 ...sortParams
 */
export function useTableSort(onSortChange?: () => void, canSort: (prop: string) => boolean = () => true) {
  const sortBy = ref('')
  const sortOrder = ref('')

  function handleSortChange({
    prop,
    order,
    column
  }: {
    prop: string | null
    order: string | null
    column?: { columnKey?: string | null }
  }) {
    const previousBy = sortBy.value, previousOrder = sortOrder.value
    if (order) {
      // 优先使用 column-key，允许页面列展示字段与后端排序字段解耦。
      sortBy.value = column?.columnKey || prop || ''
      sortOrder.value = order === 'ascending' ? 'ASC' : 'DESC'
      if (!canSort(sortBy.value)) { sortBy.value = ''; sortOrder.value = '' }
    } else {
      sortBy.value = ''
      sortOrder.value = ''
    }
    if (sortBy.value !== previousBy || sortOrder.value !== previousOrder) onSortChange?.()
  }

  /** 重新取数前清除已受限排序；由调用方本次查询完成刷新，避免重复发请求。 */
  function clearRestrictedSort() {
    if (!sortBy.value || canSort(sortBy.value)) return false
    sortBy.value = ''; sortOrder.value = ''
    return true
  }

  /** 展开为 API 调用参数，直接 ...sortParams 即可 */
  const sortParams = {
    get sort_by() { return sortBy.value || undefined },
    get sort_order() { return sortOrder.value || undefined },
  }

  return { sortBy, sortOrder, handleSortChange, sortParams, clearRestrictedSort }
}
