import { semanticPage, type AgentSemanticPageMap } from './types.ts'

export const dashboardSemanticPages: AgentSemanticPageMap = {
  'dashboard.overview': semanticPage(
    '查看 WMS 运营总览、待处理单据、库存预警以及入库、出库、配送趋势。',
    ['仪表盘', '首页', '工作台', '运营总览', '系统概览', '整体情况'],
    ['回到首页', '打开工作台', '看一下运营总览'],
    ['出库商品明细', '入库商品明细', '具体订单', '具体客户'],
  ),
}
