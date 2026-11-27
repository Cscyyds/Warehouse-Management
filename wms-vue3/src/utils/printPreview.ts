/** 优先使用后端原始位图，避免把 PDF 缩进固定高度后丢失条码细线。 */
export function printPreviewImage(result: { print_data?: { raster_png_base64?: string | null } | null }): string {
  const raw = result.print_data?.raster_png_base64?.trim()
  return raw ? (raw.startsWith('data:image/png;base64,') ? raw : `data:image/png;base64,${raw}`) : ''
}

/** 未建码预览不能冒充可用于库存操作的正式条码。 */
export function previewIsSample(content: unknown): boolean {
  return typeof content === 'string' && /(^|_)preview(?:_|$)/i.test(content)
}

/** 只允许原始像素和整数倍放大，禁止按容器高度缩小标签。 */
export function previewImageSize(width: number, height: number, zoom: number): { width: string; height: string } {
  const scale = Number.isInteger(zoom) && zoom >= 1 && zoom <= 4 ? zoom : 1
  return { width: `${Math.max(1, width) * scale}px`, height: `${Math.max(1, height) * scale}px` }
}
