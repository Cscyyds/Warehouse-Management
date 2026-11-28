/** 仅处理明细里的直接文本/数值录入；组合输入法、选择器和日期弹层保持组件行为。 */
export function detailNavigationTarget(rows: number[][], row: number, col: number, key: string, backwards = false): [number, number] | undefined {
  if (key === 'Enter') {
    for (let i = row + (backwards ? -1 : 1); i >= 0 && i < rows.length; i += backwards ? -1 : 1) {
      if (rows[i]?.includes(col)) return [i, col]
    }
    return
  }
  const cells = rows.flatMap((columns, i) => columns.map(column => [i, column] as [number, number]))
  const index = cells.findIndex(([r, c]) => r === row && c === col)
  return index < 0 ? undefined : cells[index + (backwards ? -1 : 1)]
}
function bodyRows(table: Element) { return Array.from(table.querySelectorAll<HTMLTableRowElement>('.el-table__body-wrapper tbody > tr')) }
function editor(cell: Element | undefined): HTMLElement | undefined {
  return cell && Array.from(cell.querySelectorAll<HTMLElement>('input:not([type=hidden]), textarea, .el-select__wrapper[tabindex="0"]')).find(input => {
    if (input.closest('.is-disabled') || input.getClientRects().length === 0) return false
    return !(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) || (!input.disabled && !input.readOnly)
  })
}
export function focusFirstDetailEditor(table: Element | null | undefined, rowIndex: number) {
  const row = table && bodyRows(table)[rowIndex]
  const target = row && Array.from(row.cells).map(editor).find(Boolean)
  target?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); target?.focus()
  if (target instanceof HTMLInputElement) target.select()
}
export function focusDetailCell(table: Element | null | undefined, rowIndex: number, column: string | number, message?: string) {
  if (!table) return
  table.querySelectorAll('.detail-cell-error').forEach(cell => { cell.classList.remove('detail-cell-error'); cell.querySelector('.detail-cell-error-message')?.remove() })
  const row = bodyRows(table)[rowIndex]
  const cell = typeof column === 'number' ? row?.cells[column] : Array.from(row?.cells || []).find(cell => cell.getAttribute('data-detail-column') === column || cell.classList.contains(`detail-col-${column}`))
  if (!cell) return
  if (message) {
    cell.classList.add('detail-cell-error')
    const hint = document.createElement('div'); hint.className = 'detail-cell-error-message'; hint.setAttribute('role', 'alert'); hint.textContent = message; cell.append(hint)
  }
  cell.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  editor(cell)?.focus({ preventScroll: true })
}
export function installDetailTableKeyboard() {
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || !['Tab', 'Enter'].includes(event.key)) return
    const input = event.target
    if (!(input instanceof HTMLInputElement) || input.disabled || input.readOnly) return
    const table = input.closest('.wms-detail-items')
    const cell = input.closest('td'), row = cell?.parentElement
    if (!table || !cell || !row || input.closest('.el-select, .el-date-editor, .el-tree-select') || input.getAttribute('aria-expanded') === 'true') return
    const rows = bodyRows(table), rowIndex = rows.indexOf(row as HTMLTableRowElement), columnIndex = Array.from(row.children).indexOf(cell)
    if (rowIndex < 0) return
    const target = detailNavigationTarget(rows.map(r => Array.from(r.cells).flatMap((c, index) => editor(c) ? [index] : [])), rowIndex, columnIndex, event.key, event.shiftKey)
    if (!target) {
      if (event.key === 'Enter') { event.preventDefault(); input.blur() }
      return
    }
    event.preventDefault()
    const next = editor(rows[target[0]]?.cells[target[1]])
    input.blur(); next?.focus(); if (next instanceof HTMLInputElement) next.select()
  })
  document.addEventListener('input', event => {
    const target = event.target as Element | null
    const cell = target?.closest('.wms-detail-items .detail-cell-error')
    cell?.classList.remove('detail-cell-error'); cell?.querySelector('.detail-cell-error-message')?.remove()
  })
}
