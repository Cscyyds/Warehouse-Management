import { semanticPage, type AgentSemanticPageMap } from './types.ts'

export const warehouseSemanticPages: AgentSemanticPageMap = {
  'warehouse.location': semanticPage(
    '维护仓库中的库区、库位及其基础信息。',
    ['库位', '仓库库位', '储位', '库位管理'],
    ['查看仓库库位', '新增库位'],
    ['客户区域', '放货货位', '库位库存'],
  ),
  'warehouse.shelf': semanticPage(
    '维护用于放置商品的货架和放货位置。',
    ['放货货位', '货架', '放货位', '商品放哪'],
    ['查看货架', '货一般放在哪个位置'],
    ['仓库库位', '产品库存'],
  ),
  'warehouse.plastic': semanticPage(
    '维护仓库周转使用的塑料盒或周转箱。',
    ['塑料盒', '周转箱', '周转盒', '料箱'],
    ['查看周转箱', '新增塑料盒'],
    ['包装条码', '产品包装'],
  ),
  'warehouse.stock': semanticPage(
    '查看产品当前库存数量和库存状态，不表示历史出入库流水。',
    ['库存', '产品库存', '商品库存', '现货', '还有多少货', '仓库里还有什么货', '仓库里有哪些货'],
    ['查看库存', '这个商品还有多少', '仓库里现在有什么货', '仓库里现在还有什么货'],
    ['出库记录', '入库记录', '销售出库商品', '采购入库明细'],
  ),
  'warehouse.printer': semanticPage(
    '维护仓库和业务单据使用的打印机设备。',
    ['打印机', '打印设备', '仓库打印机'],
    ['查看打印机', '新增打印设备'],
    ['打印订单', '导出报表'],
  ),
}
