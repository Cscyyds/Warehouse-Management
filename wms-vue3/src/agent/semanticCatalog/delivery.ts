import { semanticPage, type AgentSemanticPageMap } from './types.ts'

export const deliverySemanticPages: AgentSemanticPageMap = {
  'delivery.task': semanticPage(
    '管理已出库销售订单的配送、装车和送达任务。',
    ['配送任务', '送货任务', '配送单', '今天送哪些单', '今天送哪些订单', '今天要送哪些订单', '今天有哪些货要送', '待送货物', '发车任务'],
    ['查看配送任务', '今天要送哪些订单', '今天有哪些货要送', '新增配送任务'],
    ['销售出库商品', '采购入库', '客户拜访'],
  ),
  'delivery.logistics': semanticPage(
    '维护业务单据对应的物流单号和物流信息。',
    ['物流单号', '快递单号', '运单号', '物流信息'],
    ['查询物流单号', '维护快递单号'],
    ['配送任务', '物流公司', '销售订单号'],
  ),
  'delivery.driver': semanticPage(
    '查看和维护配送司机或驾驶员档案。',
    ['司机', '驾驶员', '司机档案', '送货司机'],
    ['查看司机资料', '新增配送司机'],
    ['员工资料', '车辆管理'],
  ),
  'delivery.vehicle': semanticPage(
    '查看和维护配送车辆档案。',
    ['配送车辆', '送货车', '车辆档案', '车牌'],
    ['查看送货车辆', '新增车辆'],
    ['司机档案', '物流公司'],
  ),
  'delivery.company': semanticPage(
    '查看和维护承运或合作物流公司档案。',
    ['物流公司', '承运商', '快递公司', '运输公司'],
    ['查看物流公司', '新增承运商'],
    ['供应商档案', '物流单号'],
  ),
}
