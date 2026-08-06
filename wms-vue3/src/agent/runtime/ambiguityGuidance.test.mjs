import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAmbiguityGuidance } from './ambiguityGuidance.ts'

test('does not guide business-term variants that hit the page catalog', () => {
  // "拜访记录"→拜访任务单 是业务页面说法变体（已配 synonyms 直接命中），
  // 不应被误判成"外部实体+模糊意图"而强制澄清。
  assert.equal(buildAmbiguityGuidance('我想看看拜访记录'), null)
})

test('does not hard-guide unknown pure-Chinese entities, leaving judgment to the LLM', () => {
  // "沃尔玛" 是纯中文品牌名：不命中页面词表，也不带组织/人名/非中文形态标记，
  // 按收紧策略交 LLM 自行判断（LLM 会按系统指令【模糊查询处理】自行澄清）。
  assert.equal(buildAmbiguityGuidance('帮我查一下沃尔玛的资料'), null)
})

test('guides organization-shaped entities to clarification', () => {
  const guidance = buildAmbiguityGuidance('帮我查一下阿里巴巴集团的信息')
  assert.ok(guidance)
  assert.ok(guidance.includes('阿里巴巴集团'))
  assert.ok(guidance.includes('你必须使用 ask_user 向用户确认'))
})

test('guides person-name-shaped entities to clarification', () => {
  // 注意：不能带"客户信息"这类会直接命中页面的词（那是正确的"命中即不引导"）。
  const guidance = buildAmbiguityGuidance('帮我查一下李总的档案')
  assert.ok(guidance)
  assert.ok(guidance.includes('李总'))
})

test('extracts entity names from colloquial leading phrases', () => {
  // 回归：语助前缀（"我想看看"）必须被剥掉，否则实体名提取为
  // "我想看看张老板"，"实体名命中页面就早退"的检查会永远失效。
  const guidance = buildAmbiguityGuidance('我想看看张老板的资料')
  assert.ok(guidance)
  assert.ok(guidance.includes('张老板'))
  assert.ok(!guidance.includes('我想看看'))
})

test('requires at least two intent-related candidate pages', () => {
  // 意图后缀词匹配到的候选页不足 2 个时不引导（歧义范围太小）。
  const guidance = buildAmbiguityGuidance('帮我查一下阿里巴巴集团的资料')
  assert.ok(guidance)
  assert.ok(guidance.includes('阿里巴巴集团'))
})
