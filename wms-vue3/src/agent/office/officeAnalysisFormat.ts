/**
 * 数据分析域结构化回复适配（app AnalysisReplyFormat.kt 的 TS 移植）。
 *
 * 销售域结构化决策 JSON（`{"analysis_summary":"一句话诊断","charts":[{"shape":"v|h|pie|line",
 * "title":"…","subtext":"可空","categories":[…],"series":[{"name":"…","data":[…]}],
 * "value_name":"销售额（元）","unit":"元","integer":false,"category_name":"客户"}]}`）
 * 识别为该形态时转成 Markdown 文字（摘要 + 标题 + 数据表）走既有渲染管线；
 * 非该形态返回 null，调用方保持原样渲染。streaming=true 时对未闭合 JSON 给出摘要预览。
 */

const SUMMARY_PARTIAL_RE = /"analysis_summary"\s*:\s*"((?:\\.|[^"\\])*)/

function formatAmount(value: number, integer: boolean): string {
  return integer
    ? Math.round(value).toLocaleString('en-US')
    : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseLenient(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    return null
  } catch {
    try {
      const repaired = JSON.parse(text.replace(/,\s*([}\]])/g, '$1')) as unknown
      if (repaired && typeof repaired === 'object' && !Array.isArray(repaired)) return repaired as Record<string, unknown>
      return null
    } catch {
      return null
    }
  }
}

function looksLikeAnalysis(text: string): boolean {
  return text.includes('"analysis_summary"') || text.includes('"charts"')
}

/** 定位 JSON 对象候选：剥掉代码围栏，要求以 { 开头且含分析决策关键字段。 */
function locateJsonObject(content: string | null | undefined): string | null {
  let text = String(content || '').trim()
  if (!text) return null
  if (text.startsWith('```')) {
    text = text.startsWith('```json') ? text.slice('```json'.length) : text.slice(3)
    text = text.replace(/```$/, '').trim()
  }
  if (!text.startsWith('{')) return null
  const end = text.lastIndexOf('}')
  if (end <= 0) {
    // 流式期间 JSON 尚未闭合：仍按原候选处理，交给 lenient 解析失败后走预览
    return looksLikeAnalysis(text) ? text : null
  }
  text = text.slice(0, end + 1)
  return looksLikeAnalysis(text) ? text : null
}

/** 解码 JSON 字符串片段（流式预览用，覆盖常见转义）。 */
function decodeJsonString(raw: string): string {
  let result = ''
  let index = 0
  while (index < raw.length) {
    const ch = raw[index]
    if (ch === '\\' && index + 1 < raw.length) {
      const esc = raw[index + 1]
      if (esc === 'n') result += '\n'
      else if (esc === 'r') result += '\r'
      else if (esc === 't') result += '\t'
      else if (esc === 'u' && index + 5 < raw.length) {
        const code = Number.parseInt(raw.slice(index + 2, index + 6), 16)
        if (Number.isFinite(code)) result += String.fromCharCode(code)
        index += 4
      } else result += esc
      index += 2
    } else {
      result += ch
      index += 1
    }
  }
  return result
}

/** 流式期间未闭合的决策 JSON：即时呈现已到达的摘要文字，避免用户看到半截大括号。 */
function streamingPreview(text: string): string | null {
  const match = SUMMARY_PARTIAL_RE.exec(text)
  if (!match) return '正在整理分析结果…'
  const summary = decodeJsonString(match[1])
  return summary.trim() ? summary : '正在整理分析结果…'
}

function stringArrayOf(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item ?? '').trim()) : []
}

function numberArrayOf(value: unknown): number[] {
  return Array.isArray(value) ? value.map(item => Number(item) || 0) : []
}

/** 表格单元格里出现竖线/换行会截断列，做最小转义（竖线→全角、换行→空格）。 */
function escapeCell(value: string): string {
  return value.replace(/\|/g, '｜').replace(/\n/g, ' ').trim()
}

function str(value: unknown): string {
  return String(value ?? '').trim()
}

interface ChartSeries {
  name: string
  data: number[]
}

function chartToMarkdown(chart: Record<string, unknown>): string | null {
  const cats = stringArrayOf(chart.categories)
  const series: ChartSeries[] = []
  if (Array.isArray(chart.series)) {
    chart.series.forEach((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return
      const record = item as Record<string, unknown>
      series.push({
        name: str(record.name) || '数值',
        data: numberArrayOf(record.data),
      })
    })
  }
  const unit = str(chart.unit)
  const firstSeriesName = series[0]?.name ?? ''
  const valueName = str(chart.value_name)
    || (unit && firstSeriesName && !firstSeriesName.includes(unit) ? `${firstSeriesName}（${unit}）` : firstSeriesName)
  const integer = chart.integer === true
  const shape = str(chart.shape)
  const blankCat = str(chart.category_name) || '类目'

  const headerLines: string[] = []
  const title = str(chart.title)
  if (title) headerLines.push(`**${title}**`)
  const subtext = str(chart.subtext)
  if (subtext) headerLines.push(`> ${subtext}`)
  const header = headerLines.join('\n')

  if (!cats.length || !series.length) return header || null
  // 类目与各系列数据按公共长度对齐（决策层截断规则的展示侧兜底）
  const shortestSeries = Math.min(...series.map(item => item.data.length))
  const n = Math.min(cats.length, shortestSeries, 12)

  let cells: string[]
  let rows: string[][]
  const isPie = shape === 'pie' && series.length === 1
  const isTrend = shape === 'line' || series.length > 1
  if (isPie) {
    const pairs = cats.slice(0, n).map((cat, index) => [cat, series[0].data[index]] as const)
      .sort((left, right) => right[1] - left[1])
    const total = pairs.reduce((sum, [, value]) => sum + value, 0)
    cells = [blankCat, valueName, '占比']
    rows = pairs.map(([cat, value]) => [
      escapeCell(cat),
      formatAmount(value, integer),
      total > 0 ? `占 ${((value / total) * 100).toFixed(2)}%` : '—',
    ])
  } else if (isTrend) {
    // 趋势/双指标对比：保持决策给出的顺序（时间序、分组对比序）
    cells = [blankCat, ...series.map(item => item.name)]
    rows = Array.from({ length: n }, (_, index) => [
      escapeCell(cats[index]),
      ...series.map(item => formatAmount(item.data[index], integer)),
    ])
  } else {
    // 单系列排行（v/h）：按数值降序加排名列
    const order = Array.from({ length: n }, (_, index) => index)
      .sort((left, right) => series[0].data[right] - series[0].data[left])
    cells = ['排名', blankCat, valueName]
    rows = order.map((position, rank) => [
      String(rank + 1),
      escapeCell(cats[position]),
      formatAmount(series[0].data[position], integer),
    ])
  }

  const table = [
    `| ${cells.join(' | ')} |`,
    `| ${cells.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')

  return [header, table].filter(part => part).join('\n\n')
}

/**
 * 把消息内容尝试转换为 Markdown 文字；返回 null 表示不是数据分析结构化回复
 * （或暂时无法解析且非流式），调用方按原样渲染。
 */
export function toOfficeAnalysisMarkdown(content: string | null | undefined, streaming: boolean): string | null {
  const candidate = locateJsonObject(content)
  if (candidate === null) return null
  const parsed = parseLenient(candidate)
  if (!parsed) return streaming ? streamingPreview(candidate) : null
  if (!('analysis_summary' in parsed) && !('charts' in parsed)) return null

  const parts: string[] = []
  const summary = str(parsed.analysis_summary)
  if (summary) parts.push(summary)
  if (Array.isArray(parsed.charts)) {
    parsed.charts.forEach((chart) => {
      if (!chart || typeof chart !== 'object' || Array.isArray(chart)) return
      const markdown = chartToMarkdown(chart as Record<string, unknown>)
      if (markdown) parts.push(markdown)
    })
  }
  const joined = parts.join('\n\n')
  return joined || null
}
