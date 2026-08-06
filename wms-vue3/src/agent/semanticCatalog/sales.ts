import { semanticPage, type AgentSemanticPageMap } from './types.ts'

export const salesSemanticPages: AgentSemanticPageMap = {
  'sales.order': semanticPage(
    '查看、新增和审核销售订单主单，并查看订单客户、审核状态和仓库状态；不用于逐行查询卖出的具体商品。',
    ['销售订单', '销售单', '销售开单', '客户订单', '卖货单', '销售出库'],
    ['查看销售订单', '开一张销售单', '查询客户的订单'],
    ['采购订单', '采购入库', '采购退货出库', '出货', '发货', '卖了什么', '销售商品明细'],
    {
      capabilities: [
        {
          id: 'sales-order.search',
          kind: 'read',
          description: '按订单号、客户、结算方式、审核状态和创建日期查询销售订单',
          keywords: ['查询', '搜索', '查找', '订单'],
        },
        {
          id: 'sales-order.audit-approve',
          kind: 'write',
          description: '审核通过一张当前页面中的未审核销售订单',
          keywords: ['审核', '审核通过'],
        },
      ],
      agentPageId: 'sales.order.list',
    },
  ),
  'sales.return': semanticPage(
    '查看和新增客户退回商品的销售退货单。',
    ['销售退货', '客户退货', '客退', '客户把货退回来'],
    ['查看销售退货单', '客户要退货', '新增客退单'],
    ['采购退货', '退给供应商', '销售出库'],
    {
      capabilities: [{
        id: 'sales-return.search',
        kind: 'read',
        description: '按退货单号、客户、退货方式、审核状态和创建日期查询销售退货单',
        keywords: ['查询', '搜索', '销售退货', '客户退货'],
      }],
      agentPageId: 'sales.return.list',
    },
  ),
  'sales.reconciliation': semanticPage(
    '查看和新增与客户核对销售往来及应收款的销售对账单。',
    ['销售对账', '客户对账', '对账单', '核对货款'],
    ['和客户对账', '查看销售对账单', '新增客户对账单'],
    ['采购对账', '收款单', '客户余额'],
  ),
  'sales.report.product-summary': semanticPage(
    '按产品聚合统计销售数量和销售金额，适用于销量排行、销售汇总和“卖得多/最好”的统计问题；不用于查看某天逐行卖出的具体商品明细。',
    ['产品销售汇总', '商品销售统计', '什么货卖得多', '商品卖得最好', '产品销量', '销量排行', '销售额汇总'],
    ['查看商品销量汇总', '哪些产品卖得最好', '产品销售汇总', '统计今天各产品卖了多少'],
    ['库存数量', '销售订单明细', '滞销产品', '今天卖了什么', '销售了哪些商品'],
    {
      capabilities: [{
        id: 'product-sales-summary.search',
        kind: 'read',
        description: '按产品查询累计销量、销售额、成本和利润，并按指标排序',
        keywords: ['查询', '销售汇总', '销量排行', '卖得最好'],
      }],
      agentPageId: 'sales.product-summary.list',
    },
  ),
  'sales.report.customer-summary': semanticPage(
    '按客户汇总销售数量和销售金额。',
    ['客户销售汇总', '客户销售统计', '谁买得多', '客户销量'],
    ['哪些客户买得最多', '查看客户销售汇总'],
    ['客户订货明细', '客户余额'],
  ),
  'sales.report.order-detail': semanticPage(
    '逐行查看销售订单中实际卖出的具体产品、订购数量和金额；“某天卖了什么/销售了哪些东西”属于本页面，不是产品销售汇总。',
    ['销售订单明细', '订单产品明细', '销售商品明细', '卖了什么', '销售了什么', '卖了哪些东西', '销售了哪些商品', '卖货明细'],
    ['查看销售订单明细', '查看订单中的商品行', '今天卖了什么东西', '昨天销售了哪些商品'],
    ['采购入库明细', '采购订单明细', '客户订货汇总', '产品销量排行', '销售汇总统计'],
    {
      synonyms: ['卖出的东西', '卖出的商品', '销售商品记录'],
      capabilities: [{
        id: 'sales-order-detail.search',
        kind: 'read',
        description: '按订单、客户、产品和创建日期查询销售商品明细',
        keywords: ['查询', '卖了什么', '销售商品明细', '卖货明细'],
      }],
      agentPageId: 'sales.order-detail.list',
    },
  ),
  'sales.report.customer-order-detail': semanticPage(
    '逐行查看客户订购的商品、数量和订单归属。',
    ['客户订货明细', '客户买了什么', '客户买过什么货', '客户订单商品', '某客户买过的货'],
    ['查看客户订货明细', '这个客户买过什么商品'],
    ['销售出库商品', '客户销售汇总', '采购订单明细'],
  ),
}
