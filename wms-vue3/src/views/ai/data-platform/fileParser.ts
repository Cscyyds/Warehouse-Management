import type { SourceDocument } from './processing'
import {
  ApiUnavailableError, MAX_PDF_PAGES, ParseRejectedError, isServerExcelName,
  parseExcelOnServer, parsePdfOnServer, sheetToGrid,
} from './dataApi'
import type { PdfParseResult } from './dataApi'

/**
 * 资料解析。
 *
 * 解析优先走服务端（Coze_Connect 的 /api/v1/file/excel/parse 与 /pdf/parse），
 * 服务端不可用（未登录、网络不通、5xx、超时）时，表格回退浏览器本地解析，
 * 并在文档上留下 issue 说明，避免用户把本地结果误认为服务端结果。
 *
 * 三种失败语义严格区分：
 *   ParseRejectedError → 请求本身不合法（空文件 / 超限），直接报错，不回退
 *   ApiUnavailableError → 服务不可用，表格回退本地；PDF 保留原文件预览
 *   其它 Error → 解析器自身的致命错误，直接抛出
 *
 * PDF 没有本地提取能力：服务端失败就只保留原文件预览，提示手动补充正文。
 */

/** 本地能独立解析的表格格式（服务端不可用时的回退路径）。 */
const LOCAL_EXCEL_EXTS = ['XLSX', 'XLS', 'CSV']

/** 页面接受的全部格式；表格族以服务端支持范围为准。 */
const SUPPORTED_KINDS = [
  'PDF', 'TXT', 'MD', 'DOCX',
  'XLSX', 'XLSM', 'XLTX', 'XLTM', 'XLS', 'XLSB', 'ODS', 'CSV', 'TSV', 'XML',
]

/** 本地读取纯文本；UTF-8 失败退 GB18030（历史 Excel 导出的 csv/txt 常见）。 */
async function readPlainText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('gb18030').decode(bytes)
  }
}

/** DOCX 正文：从 CFB 容器取 word/document.xml，按段落还原 Markdown 标题。 */
async function parseDocxLocally(file: File): Promise<string> {
  const { CFB } = await import('xlsx')
  const archive = CFB.read(new Uint8Array(await file.arrayBuffer()), { type: 'buffer' })
  const entry = CFB.find(archive, '/word/document.xml')
  if (!entry?.content) throw new Error(`${file.name}：未找到有效的 DOCX 正文`)
  const xml = new DOMParser().parseFromString(
    new TextDecoder().decode(new Uint8Array(entry.content as Uint8Array)),
    'application/xml',
  )
  if (xml.querySelector('parsererror')) throw new Error(`${file.name}：DOCX 结构无法解析`)
  return Array.from(xml.getElementsByTagName('w:p')).map(p => {
    const style = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') || ''
    const heading = /heading([1-6])/i.exec(style)?.[1]
    const content = Array.from(p.getElementsByTagName('w:t')).map(t => t.textContent || '').join('')
    return (heading ? '#'.repeat(Number(heading)) + ' ' : '') + content
  }).filter(Boolean).join('\n\n')
}

/** 表格本地解析（回退路径）。 */
async function parseSpreadsheetLocally(file: File, doc: SourceDocument): Promise<void> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, sheetRows: 5001 })
  const sheets = workbook.SheetNames.map((name: string) => ({
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name]!, { header: 1, defval: '', raw: false, blankrows: false })
      .map((row: unknown[]) => row.map((value: unknown) => String(value ?? ''))),
  }))
  if (sheets.some(sheet => sheet.rows.length > 5000)) {
    throw new Error(`${file.name}：每张表最多支持 5000 行，请拆分后上传`)
  }
  doc.sheets = sheets
  doc.rows = sheets[0]?.rows || []
  doc.text = sheets.map(sheet => `# ${sheet.name}\n\n${sheet.rows.map(row => row.join(' | ')).join('\n')}`).join('\n\n')
  doc.parser = 'local'
}

/** 服务端表格解析：逐 sheet 网格 + 纯文本正文（供切片使用）。 */
async function parseSpreadsheetOnServer(file: File, doc: SourceDocument): Promise<void> {
  const result = await parseExcelOnServer(file)
  const sheets = (result.sheets || [])
    .map(sheet => ({
      name: sheet.sheet_name || `工作表 ${sheet.sheet_index}`,
      rows: sheetToGrid(sheet),
    }))
    .filter(sheet => sheet.rows.length)
  if (!sheets.length) throw new ApiUnavailableError(`${file.name}：服务端未返回可用的表格数据`, 0)
  doc.sheets = sheets
  doc.rows = sheets[0]?.rows || []
  doc.text = sheets.map(sheet => `# ${sheet.name}\n\n${sheet.rows.map(row => row.join(' | ')).join('\n')}`).join('\n\n')
  const shape = `${result.sheet_count} 个工作表 · ${result.total_rows} 行 · ${result.total_cells} 个单元格`
  doc.issue = `已由服务端解析（${result.file_format || '表格'}）：${shape}。`
  doc.parser = 'server'
}

/** 服务端 PDF 解析：按页拼接正文；图片只统计数量，不塞进正文。 */
async function parsePdfOnServerDoc(file: File, doc: SourceDocument): Promise<void> {
  const result: PdfParseResult = await parsePdfOnServer(file)
  const pages = Array.isArray(result.pages) ? result.pages : []
  const body = pages
    .map(page => {
      const text = (page.text || '').trim()
      return text ? `## 第 ${page.page_number} 页\n\n${text}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
  if (!body.trim()) {
    doc.issue = `${file.name}：服务端解析完成（${result.page_count} 页），但没有提取到文字，可能是扫描件；可在下方补充正文后体验切片。`
    return
  }
  doc.text = body
  const imageCount = pages.reduce((total, page) => total + (page.images?.length || 0), 0)
  doc.issue = `已由服务端解析：共 ${result.page_count} 页${imageCount ? `，提取 ${imageCount} 张嵌入图片（已转存对象存储）` : ''}。`
  doc.parser = 'server'
}

export async function parseFile(file: File): Promise<SourceDocument> {
  const kind = file.name.split('.').pop()?.toUpperCase() || ''
  if (!SUPPORTED_KINDS.includes(kind)) throw new Error(`${file.name}：暂不支持该格式`)
  if (!file.size) throw new Error(`${file.name}：文件为空`)
  const doc: SourceDocument = { id: crypto.randomUUID(), name: file.name, kind, size: file.size, text: '' }

  if (kind === 'PDF') {
    // 本地预览始终可用：服务端解析失败也不影响原文件预览
    doc.url = URL.createObjectURL(file)
    try {
      await parsePdfOnServerDoc(file, doc)
    } catch (error) {
      if (error instanceof ParseRejectedError) {
        URL.revokeObjectURL(doc.url)
        throw error
      }
      if (!(error instanceof ApiUnavailableError)) throw error
      doc.issue = `版式文档解析服务不可用（${error.message}）。可预览原文件；在下方补充正文后体验切片。`
    }
  } else if (kind === 'TXT' || kind === 'MD') {
    doc.text = await readPlainText(file)
    doc.parser = 'local'
  } else if (kind === 'DOCX') {
    doc.text = await parseDocxLocally(file)
    doc.parser = 'local'
    doc.issue = '已提取 DOCX 正文；图片、页眉页脚与复杂排版暂不包含在预览中。'
  } else if (isServerExcelName(file.name) || LOCAL_EXCEL_EXTS.includes(kind)) {
    try {
      await parseSpreadsheetOnServer(file, doc)
    } catch (error) {
      if (error instanceof ParseRejectedError) throw error
      if (!(error instanceof ApiUnavailableError)) throw error
      // 服务端不可用时回退本地：只有 xlsx/xls/csv 本地能读
      if (!LOCAL_EXCEL_EXTS.includes(kind)) {
        throw new Error(`${file.name}：服务端解析不可用（${error.message}），本地暂不支持 ${kind} 格式`)
      }
      await parseSpreadsheetLocally(file, doc)
      doc.issue = `表格解析服务不可用（${error.message}），已回退浏览器本地解析。`
    }
  } else {
    throw new Error(`${file.name}：暂不支持该格式`)
  }

  if (kind !== 'PDF' && !doc.text.trim()) throw new Error(`${file.name}：没有可供处理的正文`)
  if (Array.from(doc.text).length > 400000) {
    doc.text = Array.from(doc.text).slice(0, 400000).join('')
    doc.issue = `${doc.issue || ''}正文超过 40 万字符，仅保留前 40 万字符用于切片预览。`.trim()
  }
  return doc
}

/** 页面展示用的服务端能力说明，避免各处硬编码文案不一致。 */
export const parserCapabilities = {
  excelExtensions: ['xlsx', 'xlsm', 'xltx', 'xltm', 'xls', 'xlsb', 'ods', 'csv', 'tsv', 'txt', 'xml'],
  maxPdfPages: MAX_PDF_PAGES,
} as const
