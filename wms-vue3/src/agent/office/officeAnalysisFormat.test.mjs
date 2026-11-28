import assert from 'node:assert/strict'
import test from 'node:test'
import { toOfficeAnalysisMarkdown } from './officeAnalysisFormat.ts'

function payload(overrides = {}) {
  return JSON.stringify({
    analysis_summary: '本月销售总额 100.50 万元，同比增长 12%。',
    charts: [],
    ...overrides,
  })
}

test('非 JSON 内容返回 null，按原文渲染', () => {
  assert.equal(toOfficeAnalysisMarkdown('库存充足，可以开单', false), null)
  assert.equal(toOfficeAnalysisMarkdown('', false), null)
})

test('单系列柱状/条形图转带排名列的降序表', () => {
  const markdown = toOfficeAnalysisMarkdown(payload({
    charts: [{
      shape: 'v',
      title: '客户销售额排行',
      subtext: '数据来源：销售出库单',
      categories: ['甲客户', '乙客户', '丙客户'],
      series: [{ name: '销售额', data: [100.5, 300.25, 200] }],
      value_name: '销售额（元）',
      unit: '元',
      integer: false,
    }],
  }), false)
  assert.ok(markdown.startsWith('本月销售总额 100.50 万元，同比增长 12%。'))
  assert.ok(markdown.includes('**客户销售额排行**'))
  assert.ok(markdown.includes('> 数据来源：销售出库单'))
  assert.ok(markdown.includes('| 排名 | 类目 | 销售额（元） |'))
  // 降序：乙客户 300.25 排第一
  const rankRow = markdown.split('\n').find(line => line.includes('| 1 |'))
  assert.ok(rankRow.includes('乙客户'))
  assert.ok(rankRow.includes('300.25'))
})

test('饼图追加占比列并按数值降序', () => {
  const markdown = toOfficeAnalysisMarkdown(payload({
    charts: [{
      shape: 'pie',
      title: '品类占比',
      categories: ['A 品类', 'B 品类'],
      series: [{ name: '销量', data: [75, 25] }],
      value_name: '销量',
      integer: true,
    }],
  }), false)
  assert.ok(markdown.includes('| 类目 | 销量 | 占比 |'))
  assert.ok(markdown.includes('占 75.00%'))
  assert.ok(markdown.includes('| A 品类 | 75 |'))
})

test('折线/多系列保持原始顺序并列多列', () => {
  const markdown = toOfficeAnalysisMarkdown(payload({
    charts: [{
      shape: 'line',
      title: '月度趋势',
      categories: ['1月', '2月', '3月'],
      series: [
        { name: '销售额', data: [10, 20, 30] },
        { name: '毛利', data: [1, 2, 3.5] },
      ],
      integer: false,
    }],
  }), false)
  assert.ok(markdown.includes('| 类目 | 销售额 | 毛利 |'))
  const lastRow = markdown.split('\n').find(line => line.includes('3月'))
  assert.ok(lastRow.includes('| 30.00 | 3.50 |'))
})

test('代码围栏包裹的 JSON 同样识别', () => {
  const fenced = `\`\`\`json\n${payload({ charts: [] })}\n\`\`\``
  const markdown = toOfficeAnalysisMarkdown(fenced, false)
  assert.equal(markdown, '本月销售总额 100.50 万元，同比增长 12%。')
})

test('流式未闭合 JSON 给出摘要预览', () => {
  const partial = '{"analysis_summary":"销售额正在统计中，","charts":[{"shape":"v'
  const markdown = toOfficeAnalysisMarkdown(partial, true)
  assert.equal(markdown, '销售额正在统计中，')
})

test('流式未闭合且无摘要字段时给默认文案', () => {
  assert.equal(toOfficeAnalysisMarkdown('{"charts": [{"sh', true), '正在整理分析结果…')
  // 非流式下同样内容返回 null
  assert.equal(toOfficeAnalysisMarkdown('{"charts": [{"sh', false), null)
})

test('尾逗号容错解析', () => {
  const lenient = '{"analysis_summary":"摘要","charts":[],}'
  assert.equal(toOfficeAnalysisMarkdown(lenient, false), '摘要')
})

test('表格单元格转义竖线', () => {
  const markdown = toOfficeAnalysisMarkdown(payload({
    charts: [{
      shape: 'v',
      categories: ['A|B 客户'],
      series: [{ name: '销售额', data: [10] }],
      integer: true,
    }],
  }), false)
  assert.ok(markdown.includes('A｜B 客户'))
})
