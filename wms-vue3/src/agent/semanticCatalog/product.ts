import { semanticPage, type AgentSemanticPageMap } from './types.ts'

export const productSemanticPages: AgentSemanticPageMap = {
  'product.category': semanticPage(
    '维护产品或商品的分类层级。',
    ['产品类别', '商品类别', '产品分类', '品类'],
    ['查看产品分类', '新增一个商品类别'],
    ['客户分类', '供应商类型'],
  ),
  'product.unit': semanticPage(
    '维护盒、件、袋、千克等产品计量单位。',
    ['计量单位', '产品单位', '商品单位', '单位设置'],
    ['查看计量单位', '新增包装单位'],
    ['产品规格', '库位'],
  ),
  'product.info': semanticPage(
    '查看和维护产品编码、名称、规格、价格等基础档案。',
    ['产品资料', '商品资料', '产品档案', '商品档案', '产品信息', '商品信息'],
    ['查一下某个产品', '查看商品资料', '新增产品'],
    ['产品库存', '销售明细', '采购明细'],
    {
      capabilities: [{
        id: 'product.search',
        kind: 'read',
        description: '按产品名称、编码、品号和状态查询产品资料',
        keywords: ['查询', '查找', '产品资料', '商品信息'],
      }],
      agentPageId: 'product.info.list',
    },
  ),
  'product.unsold': semanticPage(
    '查看长期无销售或销售缓慢的滞销产品。',
    ['滞销产品', '滞销商品', '卖不动的货', '货卖不动', '长期没卖'],
    ['哪些货卖不动', '查看滞销商品'],
    ['库存预警', '产品销售汇总'],
  ),
}
