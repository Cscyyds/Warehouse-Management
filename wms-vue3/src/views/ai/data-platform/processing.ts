export interface ProcessingConfig {
  storage: 'chunks' | 'whole'
  condition: 'always' | 'threshold'
  threshold: number
  strategy: 'paragraph' | 'length' | 'delimiter'
  delimiter: string
  depth: number
  size: number
  overlap: number
  indexSize: number
  titleIndex: boolean
  autoIndex: boolean
  imageIndex: boolean
  normalize: boolean
  removeBlank: boolean
  model: string
}
export interface SourceDocument {
  id: string
  name: string
  kind: string
  size: number
  text: string
  sample?: boolean
  url?: string
  rows?: string[][]
  sheets?: { name: string; rows: string[][] }[]
  issue?: string
  /** 正文来源：server = 服务端解析，local = 浏览器本地解析；未设置视为本地。 */
  parser?: 'server' | 'local'
  parseJobId?: string
  serverStatus?: string
  images?: { id: string; path: string; origin: Record<string, unknown> }[]
  /** 服务端识别的内容类型：product / faq / manual / policy / generic */
  contentType?: string
  /** 服务端清洗动作说明（跳过页、移除页眉页脚等） */
  cleaning?: string[]
  /** PDF 每页使用的解析路径和表格行数量。 */
  pageRoutes?: { page: number; path: string; reason?: string; table_count?: number; table_rows?: number; numeric_conflicts?: unknown[] }[]
}
export interface Chunk {
  id: string
  sourceId: string
  sourceName: string
  text: string
  index: string
  start: number
  end: number
  /** 服务端分块来源：page / heading_path / step_range / question / clause / sheet 等 */
  origin?: Record<string, unknown>
}
export const defaultConfig: ProcessingConfig = {
  storage: 'chunks', condition: 'always', threshold: 1200,
  strategy: 'paragraph', delimiter: '\\n\\n', depth: 3,
  size: 500, overlap: 50, indexSize: 120,
  titleIndex: true, autoIndex: true, imageIndex: false, normalize: true, removeBlank: false,
  model: 'bge-m3',
}
export function configError(config: ProcessingConfig): string {
  if (!Number.isInteger(config.indexSize) || config.indexSize < 16 || config.indexSize > 1024) return '索引大小需为 16–1024 的整数'
  if (config.storage === 'whole') return ''
  if (!Number.isInteger(config.size) || config.size < 50 || config.size > 4000) return '最大分块大小需为 50–4000 的整数'
  if (!Number.isInteger(config.overlap) || config.overlap < 0 || config.overlap >= config.size) return '重叠长度需为非负整数，且小于最大分块大小'
  if (!Number.isInteger(config.depth) || config.depth < 1 || config.depth > 6) return '最大段落深度需为 1–6 的整数'
  if (config.condition === 'threshold' && (!Number.isInteger(config.threshold) || config.threshold < 1)) return '触发长度需为正整数'
  if (config.strategy === 'delimiter' && !config.delimiter.trim()) return '请填写分隔符，例如 \\n\\n 或 ###'
  return ''
}
export function cleanText(text: string, config: ProcessingConfig): string {
  let value = text.replace(/\r\n?/g, '\n')
  if (config.normalize) value = value.replace(/[\t \u00a0]+/g, ' ').replace(/ *\n */g, '\n')
  if (config.removeBlank) value = value.replace(/\n{3,}/g, '\n\n')
  return value.trim()
}
/** Offsets and sizes count Unicode code points, so an emoji is never split. */
export function createChunks(doc: SourceDocument, config: ProcessingConfig): Chunk[] {
  if (configError(config)) return []
  const chars = Array.from(cleanText(doc.text, config))
  if (!chars.length) return []
  const whole = config.storage === 'whole' || (config.condition === 'threshold' && chars.length <= config.threshold)
  const cuts = new Set<number>()
  if (!whole && config.strategy !== 'length') {
    const value = chars.join('')
    const separator = config.strategy === 'delimiter'
      ? config.delimiter.replace(/\\n/g, '\n').replace(/\\t/g, '\t') : '\n\n'
    let utfOffset = 0
    for (const unit of value.split(separator).slice(0, -1)) {
      utfOffset += unit.length + separator.length
      cuts.add(Array.from(value.slice(0, utfOffset)).length)
    }
    if (config.strategy === 'paragraph') {
      const headings = new RegExp(`^#{1,${config.depth}} +`, 'gm')
      for (const match of value.matchAll(headings)) cuts.add(Array.from(value.slice(0, match.index)).length)
    }
  }
  const boundaries = [...cuts].sort((a, b) => a - b)
  const chunks: Chunk[] = []
  let start = 0
  while (start < chars.length) {
    const limit = whole ? chars.length : Math.min(start + config.size, chars.length)
    let end = limit
    if (limit < chars.length && config.strategy !== 'length') {
      const candidates = boundaries.filter(cut => cut > start + config.overlap && cut <= limit)
      if (candidates.length) end = candidates[candidates.length - 1]!
    }
    const text = chars.slice(start, end).join('')
    const prefix = config.titleIndex ? doc.name.replace(/\.[^.]+$/, '') + ' · ' : ''
    // A deterministic excerpt demonstrates the index; semantic generation belongs to the backend.
    const index = Array.from(prefix + (config.autoIndex ? text.replace(/[#\n|]+/g, ' ').replace(/ +/g, ' ').trim() : text)).slice(0, config.indexSize).join('')
    chunks.push({ id: `${doc.id}-${chunks.length + 1}`, sourceId: doc.id, sourceName: doc.name, text, index, start, end })
    if (end === chars.length) break
    start = end - config.overlap
  }
  return chunks
}
export function documentSize(size: number): string {
  return size < 1024 ? `${size} B` : size < 1024 ** 2 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 ** 2).toFixed(1)} MB`
}
export function sampleDocuments(): SourceDocument[] {
  const text = `# 智能灯光产品使用指南\n\n## 01 产品概述\n\n智能灯光系统通过控制器连接灯具，支持亮度调节、色温调节与场景联动，适用于厨房、衣帽间、客厅等空间。用户可以通过无线开关或移动端管理家中灯光，为不同的生活场景设置合适的照明。\n\n本系列产品采用 24V 安全低压供电，安装前请确认电源额定功率与灯具总功率相匹配。建议预留 20% 的功率余量，确保设备长时间稳定运行。\n\n## 02 安装与连接\n\n### 2.1 安装前准备\n\n请在断电状态下完成灯带与控制器的接线。按照正负极标识连接灯具、电源和控制器，检查所有接头是否插紧。灯带应安装在干燥、通风的环境中，避免靠近高温热源。\n\n### 2.2 设备配网\n\n首次使用时，长按控制器配对按键 5 秒，直到指示灯快速闪烁。打开应用，进入“添加设备”，选择附近的灯光控制器，按照页面指引完成连接。配网过程中请将手机靠近设备，并保持蓝牙开启。\n\n如需重新配网，请再次长按配对按键，将设备恢复到待配对状态。重新连接后，原有的场景设置需要重新配置。\n\n## 03 日常使用\n\n短按无线开关可开启或关闭灯光，长按可连续调节亮度。双色温灯具可在暖白光与冷白光之间切换，满足工作照明和氛围照明的不同需求。\n\n在应用中可建立“回家”“阅读”“晚安”等场景，同时控制多个房间的设备。设置定时任务后，系统会按照预设时间自动执行。建议根据实际使用习惯调整场景参数。\n\n## 04 维护与常见问题\n\n灯具不亮时，请先确认电源连接和开关状态，再检查控制器与灯具之间的连接线。若灯光出现闪烁，请确认灯带总功率是否超过电源额定功率，并检查线路接触情况。\n\n设备离线时，请检查蓝牙和网络环境，将手机靠近设备后重试。清洁灯具时应先断开电源，使用柔软的干布擦拭，不要使用腐蚀性清洁剂。\n\n## 05 售后服务\n\n请妥善保存购买凭证和产品型号。咨询技术支持时，请提供设备型号、安装环境以及故障现象，以便售后人员快速定位问题。非专业人员请勿自行拆卸控制器或电源。`
  return [{ id: 'sample-guide', name: '智能灯光产品使用指南.md', kind: 'MD', size: new Blob([text]).size, text, sample: true }]
}
