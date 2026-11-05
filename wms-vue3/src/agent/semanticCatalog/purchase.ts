import { semanticPage, type AgentSemanticPageMap } from './types.ts'

export const purchaseSemanticPages: AgentSemanticPageMap = {
  'purchase.supplier.type': semanticPage(
    '维护供应商的业务分类。',
    ['供应商类型', '供应商分类', '供货商分类'],
    ['查看供应商分类', '新增供应商类型'],
    ['客户类型', '产品类别'],
  ),
  'purchase.supplier': semanticPage(
    '查看和维护供应商或供货商基础档案。',
    ['供应商', '供货商', '厂家资料', '供应商档案'],
    ['查一下供应商', '查看供货商资料', '新增供应商'],
    ['客户资料', '物流公司'],
    {
      capabilities: [{
        id: 'supplier.search',
        kind: 'read',
        description: '按供应商名称、编码和状态查询供应商档案',
        keywords: ['查询', '搜索', '供应商资料', '供货商资料'],
      }],
      agentPageId: 'purchase.supplier.list',
    },
  ),
  'purchase.supplier.credit': semanticPage(
    '查看和调整供应商授信额度及使用情况。',
    ['供应商授信', '供货商额度', '供应商信用额度'],
    ['供应商还有多少授信', '查看供货商额度'],
    ['客户授信', '供应商余额'],
  ),
  'purchase.supplier.gift': semanticPage(
    '查看和调整供应商提供的赠送金额余额。',
    ['供应商赠送金额', '供应商赠款', '供货商赠送余额'],
    ['查看供应商赠送余额', '调整供货商赠送金额'],
    ['客户赠送金额', '供应商余额'],
  ),
  'purchase.order': semanticPage(
    '查看和新增向供应商采购商品的采购订单。',
    ['采购订单', '采购单', '进货单', '采购开单', '订货给供应商', '采购了什么', '买了什么'],
    ['查看采购订单', '开一张采购单', '向供应商订货', '今天采购了什么'],
    ['销售订单', '采购入库', '采购退货'],
    {
      capabilities: [{
        id: 'purchase-order.search',
        kind: 'read',
        description: '按订单号、供应商、产品名称、审核状态和创建日期查询采购订单',
        keywords: ['查询', '搜索', '采购了什么', '买了什么'],
      }],
      agentPageId: 'purchase.order.list',
    },
  ),
  'purchase.inbound': semanticPage(
    '查看和新增采购商品进入仓库的采购入库单。',
    ['采购入库', '入库单', '收货单', '到货入库'],
    ['查看采购入库单', '新增入库单', '供应商的货到了'],
    ['销售出库', '采购订单', '销售退货'],
    {
      capabilities: [{
        id: 'purchase-inbound.search',
        kind: 'read',
        description: '按入库单号、供应商、入库状态和创建日期查询采购入库单',
        keywords: ['查询', '搜索', '采购入库', '到货'],
      }],
      agentPageId: 'purchase.inbound.list',
    },
  ),
  'purchase.return': semanticPage(
    '查看和新增退回供应商的采购退货单。',
    ['采购退货', '供应商退货', '退给厂家', '退货给供货商'],
    ['查看采购退货单', '把货退给供应商', '新增采购退货'],
    ['销售退货', '客户退货', '普通销售出库'],
    {
      capabilities: [{
        id: 'purchase-return.search',
        kind: 'read',
        description: '按退货单号、供应商、出库状态和创建日期查询采购退货单',
        keywords: ['查询', '搜索', '采购退货', '退给供应商'],
      }],
      agentPageId: 'purchase.return.list',
    },
  ),
  'purchase.report.return-summary': semanticPage(
    '按采购退货业务汇总退给供应商的商品和金额。',
    ['采购退货汇总', '供应商退货统计', '退给供应商的货'],
    ['查看采购退货汇总', '退给供应商多少货'],
    ['销售退货汇总', '销售出库商品'],
  ),
  'purchase.report.inbound-detail': semanticPage(
    '逐行查看采购入库的商品、数量、供应商和入库日期。',
    ['采购入库明细', '入库商品明细', '进了什么货', '到了什么货', '收了什么货'],
    ['昨天入了什么货', '查看采购入库明细', '最近到了哪些商品'],
    ['销售出库明细', '采购订单明细', '销售退货'],
    {
      capabilities: [{
        id: 'purchase-inbound-detail.search',
        kind: 'read',
        description: '按入库单号、供应商、产品、状态和正式入库日期查询采购入库商品明细',
        keywords: ['查询', '搜索', '入库明细', '入了什么货', '到了什么货'],
      }],
      agentPageId: 'purchase.inbound-detail.list',
    },
  ),
  'purchase.report.supplier-balance': semanticPage(
    '查看各供应商的往来账户余额。',
    ['供应商余额', '供货商余额', '欠供应商多少钱', '供应商往来'],
    ['查看供应商余额', '我们还欠供应商多少钱'],
    ['客户余额', '银行余额', '供应商授信'],
    {
      capabilities: [{
        id: 'supplier-balance.search',
        kind: 'read',
        description: '按供应商、地区和采购员查询供应商往来余额',
        keywords: ['查询', '供应商余额', '欠供应商多少钱', '供应商往来'],
      }],
      agentPageId: 'purchase.supplier-balance.list',
    },
  ),
}
