export interface OfficeQuestionOption {
  label: string
}

export interface OfficeOrderQuestion {
  kind: 'order-detail'
  prompt: string
  options: OfficeQuestionOption[]
}

function parseOptions(raw: string): string[] | null {
  const firstLine = raw.split('\n').map(line => line.trim()).find(Boolean)
  if (!firstLine) return null
  try {
    const parsed: unknown = JSON.parse(firstLine)
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some(item => typeof item !== 'string')) return null
    return parsed.map(item => item.trim()).filter(Boolean)
  } catch {
    return null
  }
}

export function parseOfficeOrderQuestion(content: string): OfficeOrderQuestion | null {
  const separator = content.match(/\n={4,}[ \t]*\n/)
  if (!separator || separator.index === undefined) return null

  const prompt = content.slice(0, separator.index).trim()
  const options = parseOptions(content.slice(separator.index + separator[0].length))
  if (!options) return null
  const isOrderOption = options.some(option => /(?:查看|展示|不查看).*(?:订单|完整商品明细)/.test(option))
  if (!isOrderOption || !/商品明细/.test(prompt)) return null

  return {
    kind: 'order-detail',
    prompt,
    options: options.map(label => ({ label })),
  }
}
