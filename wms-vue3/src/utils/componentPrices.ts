/** 组合结构可任意嵌套，前端禁止把深层遗留单价带到图形、提示或选择事件中。 */
interface ComponentPriceNode { unit_price?: unknown; components?: ComponentPriceNode[] }
export function omitComponentPrices<T extends ComponentPriceNode>(nodes: T[]): T[] {
  return nodes.map(node => {
    const { unit_price: _price, ...safe } = node
    return { ...safe, ...(node.components ? { components: omitComponentPrices(node.components) } : {}) } as T
  })
}

export function componentPriceValue(value: unknown): number | null {
  if (value == null || value === '') return null
  const price = Number(value)
  return Number.isFinite(price) ? price : null
}
