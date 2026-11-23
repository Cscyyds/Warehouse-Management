import type { SourceDocument } from './processing'

export async function parseFile(file: File): Promise<SourceDocument> {
  const kind = file.name.split('.').pop()?.toUpperCase() || ''
  if (!['PDF', 'TXT', 'MD', 'DOCX', 'CSV', 'XLSX', 'XLS'].includes(kind)) throw new Error(`${file.name}：暂不支持该格式`)
  if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name}：单文件上限为 20 兆字节`)
  if (!file.size) throw new Error(`${file.name}：文件为空`)
  const doc: SourceDocument = { id: crypto.randomUUID(), name: file.name, kind, size: file.size, text: '' }
  if (kind === 'PDF') {
    doc.url = URL.createObjectURL(file)
    doc.issue = '可预览版式文档原文件。正文提取与文字识别 待接入解析服务；可在下方补充提取文本后体验切片。'
  } else if (['TXT', 'MD'].includes(kind)) {
    const bytes = await file.arrayBuffer()
    try { doc.text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
    catch { doc.text = new TextDecoder('gb18030').decode(bytes) }
  } else if (kind === 'DOCX') {
    const { CFB } = await import('xlsx')
    const archive = CFB.read(new Uint8Array(await file.arrayBuffer()), { type: 'buffer' })
    const entry = CFB.find(archive, '/word/document.xml')
    if (!entry?.content) throw new Error(`${file.name}：未找到有效的文字文档正文`)
    const xml = new DOMParser().parseFromString(new TextDecoder().decode(new Uint8Array(entry.content as Uint8Array)), 'application/xml')
    if (xml.querySelector('parsererror')) throw new Error(`${file.name}：文字文档结构无法解析`)
    doc.text = Array.from(xml.getElementsByTagName('w:p')).map(p => {
      const style = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') || ''
      const heading = /heading([1-6])/i.exec(style)?.[1]
      const content = Array.from(p.getElementsByTagName('w:t')).map(t => t.textContent || '').join('')
      return (heading ? '#'.repeat(Number(heading)) + ' ' : '') + content
    }).filter(Boolean).join('\n\n')
    doc.issue = '已提取文字文档正文；图片、页眉页脚与复杂排版暂不包含在预览中。'
  } else {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, sheetRows: 5001 })
    doc.sheets = workbook.SheetNames.map(name => ({
      name,
      rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name]!, { header: 1, defval: '', raw: false, blankrows: false }).map(row => row.map(value => String(value ?? ''))),
    }))
    if (doc.sheets.some(sheet => sheet.rows.length > 5000)) throw new Error(`${file.name}：每张表最多支持 5000 行，请拆分后上传`)
    doc.rows = doc.sheets[0]?.rows || []
    doc.text = doc.sheets.map(sheet => `# ${sheet.name}\n\n${sheet.rows.map(row => row.join(' | ')).join('\n')}`).join('\n\n')
  }
  if (kind !== 'PDF' && !doc.text.trim()) throw new Error(`${file.name}：没有可供处理的正文`)
  if (Array.from(doc.text).length > 300000) throw new Error(`${file.name}：正文最多支持 30 万字符，请拆分后上传`)
  return doc
}
