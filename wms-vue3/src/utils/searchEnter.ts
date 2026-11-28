/** 搜索框与查询按钮共用业务入口；输入法确认、修饰键和长按不提交。 */
export function onSearchEnter(event: KeyboardEvent, search: () => unknown) {
  if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
  event.preventDefault()
  event.stopPropagation()
  return search()
}
