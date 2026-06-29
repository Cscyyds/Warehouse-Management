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
export function useTableSort(onSortChange?: () => void) {
  const sortBy = ref('')
  const sortOrder = ref('')

  function handleSortChange({ prop, order }: { prop: string | null; order: string | null }) {
    if (order) {
      sortBy.value = prop || ''
      sortOrder.value = order === 'ascending' ? 'ASC' : 'DESC'
    } else {
      sortBy.value = ''
      sortOrder.value = ''
    }
    onSortChange?.()
  }

  /** 展开为 API 调用参数，直接 ...sortParams 即可 */
  const sortParams = {
    get sort_by() { return sortBy.value || undefined },
    get sort_order() { return sortOrder.value || undefined },
  }

  return { sortBy, sortOrder, handleSortChange, sortParams }
}
