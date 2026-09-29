// 手工测试批次探针:把候选话术跑过真实确定性路由器,打印实际行为
import { resolveDeterministicTaskIntent } from '../src/agent/semanticIntentRouter.ts'

const groups = [
  ['名称直呼', [
    '仪表盘', '人事资料管理', '管理员', '访问日志', '客户资料', '公海客户',
    '产品库存', '放货货位', '供应商档案', '采购订单', '销售订单明细表',
    '配送任务', '收款单', '预付款单', '修改密码', '负责拜访任务',
  ]],
  ['别名/口语', [
    '打开首页', '看看公海里的客户', '我想看库存', '仓库里现在还有什么货',
    '今天有哪些货要送', '查一下给供应商的付款单', '看看车辆', '员工信息',
    '查采退单', '客户档案', '商品资料', '开单', '供货商资料', '查一下物流',
  ]],
  ['新增/表单', [
    '新增采购订单', '新建销售订单', '新增产品', '新增员工', '新建客户',
    '开一张采购入库单', '新增车辆', '我要创建一个供应商',
  ]],
  ['拼音', [
    '打开cgd', '打开khzl', '查看xsd', '打开caigoudingdan', '打开kucun', 'ghkh',
  ]],
  ['错别字', [
    '采购定单', '销售定单', '客户资枓', '打开配送任物',
  ]],
  ['歧义/多候选', [
    '订单', '退货', '我想看退货', '入库单', '明细',
    '看看客户资料还是新开拓客户', '收款', '打开页面',
  ]],
  ['反向/排除', [
    '查看库存的出库记录', '销售订单的出库商品明细', '查一下新开拓客户',
    '公海客户资料', '昨天卖了多少货', '昨天销售了哪些商品',
    '我想看昨天退给供应商的货', '查看销售订单的明细', '修改员工密码',
  ]],
  ['噪音/闲聊', [
    '你好', '今天天气怎么样', '谢谢', '帮我写一首诗',
  ]],
  ['模块级', [
    '我想看财务情况', '打开仓库管理', '客户管理', '我想看配送',
    '系统管理', '个人中心看看',
  ]],
  ['委派(页面定,LLM填参)', [
    '客户查询', '查看客户查询', '查一下某个产品的库存数量',
    '查询某个客户的销售订单', '今天采购了什么', '了解一下入库情况',
  ]],
]

for (const [groupName, utterances] of groups) {
  console.log(`\n## ${groupName}`)
  for (const utterance of utterances) {
    const intent = resolveDeterministicTaskIntent(utterance)
    let detail = ''
    if (intent.kind === 'navigate') detail = `→ ${intent.pageId}${intent.mode === 'create' ? ' [mode=create]' : ''}${intent.followUp ? ' [跳转后追问]' : ''}`
    else if (intent.kind === 'business-action') detail = `→ ${intent.pageId} (${intent.actionId})`
    else if (intent.kind === 'agent') detail = intent.contract.kind === 'business-action' ? `→ 委派 LLM: ${intent.contract.expectedPageId} / ${intent.contract.expectedActionIds.join(',')}` : '→ 开放式交 LLM'
    else if (intent.kind === 'navigate-section') detail = `→ 区块 ${intent.section}`
    else if (intent.kind === 'clarify') detail = `→ 澄清: ${intent.suggestions.slice(0, 3).join('、')}`
    else if (intent.kind === 'unsupported') detail = `→ 不支持: ${intent.message}`
    console.log(`  ${utterance}  ==>  ${intent.kind} ${detail}`)
  }
}
