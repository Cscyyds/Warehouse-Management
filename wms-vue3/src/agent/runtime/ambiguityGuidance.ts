import { findAgentNavigationCandidates } from '../navigationCatalog.ts'

// 意图后缀词：WMS 中最常出现在模糊实体查询中的后缀（"查XX的资料/信息/记录"）。
const intentKeywords = ['资料', '信息', '档案', '详情', '记录', '数据']

// 组织/公司形态后缀：命中说明实体名明显是外部组织专名（如"阿里巴巴集团"、"XX 公司"）。
const EXTERNAL_ORG_PATTERN =
  /(?:公司|集团|有限|股份|实业|贸易|商行|合作社|厂|店|超市|中心|广场|大厦|银行|医院|学校|酒店)$/

// 人名形态：常见中文姓氏 + 1~3 个汉字（如"张老板"、"李总"、"王先生"）。
const COMMON_SURNAME_PATTERN =
  /^(?:王|李|张|刘|陈|杨|赵|黄|周|吴|徐|孙|马|朱|胡|郭|何|高|林|罗|郑|梁|谢|宋|唐|许|韩|冯|邓|曹|彭|曾|肖|田|董|袁|潘|于|蒋|蔡|余|杜|叶|程|苏|魏|吕|丁|任|沈|姚|卢|姜|崔|钟|谭|陆|汪|范|金|石|廖|贾|夏|韦|付|方|白|邹|孟|熊|秦|邱|江|尹|薛|闫|段|雷|侯|龙|史|陶|黎|贺|顾|毛|郝|龚|邵|万|钱|严|覃|武|戴|莫|孔|向|汤)[\u4e00-\u9fa5]{1,3}$/

// 语助/动词/语气词前缀：把"我想看看 / 帮我查一下 / 请麻烦打开"这类引导词剥掉，
// 只保留疑似实体名本体，避免"我想看看拜访记录"提取出"我想看看拜访"导致
// "实体名命中页面就早退"的检查永远失效。
const LEAD_PREFIX_PATTERN =
  /^(?:请|麻烦|请你|麻烦你|帮我|帮|我想|我要|我想要|我想看|我想查|我要看|想)*(?:查看|查询|查一查|查|搜索|找找|找|看看|看一下|看|打开|显示|了解一下|了解)*(?:一下|一查|看看)*(?:啊|呀|呢|吧)?/

/**
 * 检测用户查询中是否包含"具体业务实体名 + 模糊意图"的模式（如"帮我查一下沃尔玛的资料"）。
 *
 * 只有当疑似实体名**明显是外部专名**（组织/公司后缀、人名形态、或含非中文字符）
 * 时才返回引导指令让 LLM 走 ask_user 澄清路径；其余情况（业务页面说法的变体，
 * 如"拜访记录"→拜访任务单；或目录未收录的纯中文说法）一律返回 null，交 LLM
 * 用完整页面清单自行判断，避免把业务查询误拦成"是哪一类业务对象"。
 */
export function buildAmbiguityGuidance(task: string): string | null {
  const directCandidates = findAgentNavigationCandidates(task, 6)
  // 有直接关键词命中时由 LLM 自行处理（单页面精确匹配或页面名模糊匹配）
  if (directCandidates.length > 0) return null

  let matchedIntent: string | null = null
  for (const kw of intentKeywords) {
    if (task.includes(kw)) {
      matchedIntent = kw
      break
    }
  }
  if (!matchedIntent) return null

  // 用意图关键词查找相关页面，少于两个候选说明歧义范围太小，不值得引导。
  const intentCandidates = findAgentNavigationCandidates(matchedIntent, 10)
  if (intentCandidates.length < 2) return null

  // 去掉语助前缀和意图词后缀，提取疑似实体名。
  const entityPart = task
    .replace(LEAD_PREFIX_PATTERN, '')
    .replace(new RegExp(`的?${matchedIntent}.*$`), '')
    .trim()

  if (!entityPart || entityPart.length < 2) return null

  // 实体名本身能在页面清单中找到沾边的页面（含同义词/反向子串），
  // 说明这是业务页面说法的变体（如"拜访"→客户拜访/拜访任务），不是外部实体查询。
  const entityCandidates = findAgentNavigationCandidates(entityPart, 6)
  if (entityCandidates.length > 0) return null

  // 收紧触发条件：只有明显是"外部专名"才硬澄清引导，其余交 LLM 判断。
  const looksExternal = EXTERNAL_ORG_PATTERN.test(entityPart)
    || COMMON_SURNAME_PATTERN.test(entityPart)
    || /[A-Za-z0-9]/.test(entityPart)
  if (!looksExternal) return null

  const topCandidates = intentCandidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const candidateList = topCandidates
    .map((c) => `- ${c.page.title}（${c.page.id}）`)
    .join('\n')

  return [
    '⚠️ 检测到用户查询中的业务对象名称不明确。',
    `用户查询中的"${entityPart}"是一个具体业务实体名称（非 WMS 页面名），其业务类型存在多种可能。`,
    '你必须使用 ask_user 向用户确认，严禁猜测或自行选择任一页面导航。',
    '与本次查询意图相关的候选业务页面：',
    candidateList,
  ].join('\n')
}
