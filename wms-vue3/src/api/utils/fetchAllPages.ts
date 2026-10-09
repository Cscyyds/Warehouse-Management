/**
 * 工具：树形接口「按 total 翻页取全」
 *
 * ## 为什么需要它
 * 后端所有 list/query 树形接口共用同一套分页读取逻辑（见各 endpoint 模块的
 * `_get_page_size_from_request`）：不传 page_size 时**默认只回 20 条**，
 * page_size 上限 100，且**超出范围不报错、直接静默回退到 20**。
 *
 * 而分页作用在**顶层节点**上（每棵子树内含全部子孙），所以只要顶级节点超过 20 个
 * ——行政区划 34 个省级、组织机构、仓库、科目都可能——侧边栏树和下拉就会
 * 「看起来正常但少了后面几项」，且没有任何错误提示。
 *
 * ## 用法
 * ```ts
 * return fetchAllPages<AreaListResponse, AreaItem>({
 *   fetchPage: ({ page, page_size }) => getAreaList({ page, page_size }),
 *   pick: data => data.area,
 *   assign: (data, items) => { data.area = items },
 * })
 * ```
 *
 * 相比「直接写死 page_size=100」的写法，本工具在超过 100 个顶级节点时仍能取全，
 * 不用等数据涨上去再出一次静默截断。
 */
import type { ApiResponse } from '@/utils/request'

/** 单页请求上限，与后端 page_size 上限保持一致 */
export const FETCH_ALL_PAGE_SIZE = 100

/** 最大页数防御：后端 total 异常膨胀时避免无限翻页 */
const MAX_PAGES = 200

export interface FetchAllPagesOptions<TRes, TItem> {
  /** 单页请求函数，page / page_size 已由本工具填好 */
  fetchPage: (params: { page: number; page_size: number }) => Promise<ApiResponse<TRes>>
  /** 从响应 data 中取出本页的顶层节点数组 */
  pick: (data: TRes) => TItem[] | undefined | null
  /** 把合并后的完整数组写回响应 data（树接口的数组字段名各不相同，故由调用方指定） */
  assign: (data: TRes, items: TItem[]) => void
  /** 从响应 data 中取出总数；缺省读 `data.total` */
  total?: (data: TRes) => number | undefined | null
  /** 每页条数，默认 100（后端上限） */
  pageSize?: number
  /** 最大页数，默认 200 */
  maxPages?: number
}

/**
 * 拉取第一页，按 total 并行补拉剩余页，合并后写回第一页的响应对象。
 *
 * 返回的是**第一页的 ApiResponse**（`data` 中的数组字段已被替换为合并后的完整数组），
 * 因此调用方的取值路径与直接调用单页接口完全一致，无需改动。
 *
 * 防御行为：
 * - 补拉页返回空数组时**停止累加**（total 大于实际数据量时不把空页拼进结果）
 * - 达到 maxPages 时停止（避免 total 异常膨胀导致请求量失控）
 *
 * 注意：剩余页是按 total **并行**发出的，所以「空页停止」作用于合并阶段而非请求阶段——
 * 请求数在发第一页后即已确定。这样换来的是多页场景下更短的等待时间。
 */
export async function fetchAllPages<TRes, TItem>(
  options: FetchAllPagesOptions<TRes, TItem>
): Promise<ApiResponse<TRes>> {
  const { fetchPage, pick, assign } = options
  const pageSize = options.pageSize ?? FETCH_ALL_PAGE_SIZE
  const maxPages = options.maxPages ?? MAX_PAGES
  const readTotal = options.total ?? ((data: TRes) => (data as { total?: number })?.total)

  const first = await fetchPage({ page: 1, page_size: pageSize })
  const collected: TItem[] = [...(pick(first.data) || [])]
  const total = Number(readTotal(first.data)) || 0

  if (total > collected.length) {
    const lastPage = Math.min(Math.ceil(total / pageSize), maxPages)
    const restPages = Array.from({ length: Math.max(lastPage - 1, 0) }, (_, i) => i + 2)
    const rest = await Promise.all(
      restPages.map(page => fetchPage({ page, page_size: pageSize }))
    )
    for (const res of rest) {
      const items = pick(res.data)
      // 空页即视为后端已无更多数据，提前结束
      if (!items || items.length === 0) break
      collected.push(...items)
    }
  }

  assign(first.data, collected)
  return first
}