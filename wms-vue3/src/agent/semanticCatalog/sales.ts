import { semanticPage, type AgentSemanticPageMap } from './types.ts'

export const salesSemanticPages: AgentSemanticPageMap = {
  'sales.order': semanticPage(
    '查看、新增和审核销售订单，并查看订单当前仓库状态。',
    ['销售订单', '销售单', '销售开单', '客户订单', '卖货单', '销售出库', '出了什么货', '出货情况'],
    ['查看销售订单', '开一张销售单', '查询客户的订单', '我想看昨天出了什么货'],
    ['采购订单', '采购入库', '采购退货出库'],
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
  ),
  'sales.reconciliation': semanticPage(
    '查看和新增与客户核对销售往来及应收款的销售对账单。',
    ['销售对账', '客户对账', '对账单', '核对货款'],
    ['和客户对账', '查看销售对账单', '新增客户对账单'],
    ['采购对账', '收款单', '客户余额'],
  ),
  'sales.report.product-summary': semanticPage(
    '按产品汇总销售数量和销售金额。',
    ['产品销售汇总', '商品销售统计', '什么货卖得多', '商品卖得最好', '产品销量'],
    ['查看商品销量', '哪些产品卖得最好', '产品销售汇总'],
    ['库存数量', '销售订单明细', '滞销产品'],
  ),
  'sales.report.customer-summary': semanticPage(
    '按客户汇总销售数量和销售金额。',
    ['客户销售汇总', '客户销售统计', '谁买得多', '客户销量'],
    ['哪些客户买得最多', '查看客户销售汇总'],
    ['客户订货明细', '客户余额'],
  ),
  'sales.report.order-detail': semanticPage(
    '逐行查看销售订单中的产品、订购数量和金额信息。',
    ['销售订单明细', '订单产品明细', '销售商品明细'],
    ['查看销售订单明细', '查看订单中的商品行'],
    ['采购入库明细', '采购订单明细', '客户订货汇总'],
  ),
  'sales.report.customer-order-detail': semanticPage(
    '逐行查看客户订购的商品、数量和订单归属。',
    ['客户订货明细', '客户买了什么', '客户买过什么货', '客户订单商品', '某客户买过的货'],
    ['查看客户订货明细', '这个客户买过什么商品'],
    ['销售出库商品', '客户销售汇总', '采购订单明细'],
  ),
}
