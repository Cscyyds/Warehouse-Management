import { onActivated } from 'vue'

/**
 * keep-alive 缓存页的「激活即刷新」：切换标签回来时重新拉取数据，
 * 分页页数/每页条数/查询条件/排序/滚动位置等页面状态由缓存保留（不重置）。
 *
 * 走 ListTemplate 的页面无需接入 —— ListTemplate 内部已统一在激活时
 * emit pageChange（父页面 loadData）；本 composable 供自带 el-pagination /
 * 独立数据加载的页面使用。
 *
 * @param reload 数据重拉函数（使用当前分页/路由参数，不要重置页码）
 */
export function useCachedListPage(reload: () => unknown | Promise<unknown>) {
  // 首次挂载时 mounted 与 activated 都会触发，跳过首次避免首屏双请求
  let skipFirstActivate = true
  onActivated(() => {
    if (skipFirstActivate) {
      skipFirstActivate = false
      return
    }
    reload()
  })
}
