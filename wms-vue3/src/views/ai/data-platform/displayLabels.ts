/** Display labels are localized independently of parser and model identifiers. */
export function documentKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    PDF: '版式文档', TXT: '纯文本', DOCX: '文字文档', MD: '标记文本',
    XLSX: '表格', XLS: '表格', CSV: '文本表格', TEXT: '自定义',
  }
  return labels[kind.toUpperCase()] || '文档'
}
export function modelLabel(model: string): string {
  if (model === 'bge-m3') return '多语言嵌入模型'
  if (model === 'text-embedding-3-small') return '第三代轻量嵌入模型'
  return '自定义嵌入模型'
}
