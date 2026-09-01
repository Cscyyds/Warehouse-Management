/**
 * scanner 后端 print_data → 精臣 SDK LabelPage 转换层
 *
 * 后端返回的是"渲染描述"：像素坐标（依 dpi）、字符串枚举（bar_code / CODE128 / align）；
 * 精臣 SDK 期望：毫米坐标、数字枚举（barCode / 20 / textAlignHorizonral）。
 * 转换公式：mm = px * 25.4 / dpi
 */
import type { LabelPage } from './NMPrint'

/** 后端打印元素（扁平结构，坐标为像素） */
interface BackendElement {
  type?: string
  x?: number
  y?: number
  width?: number
  height?: number
  value?: string
  fontSize?: number
  align?: string
  codeType?: string | number
  rotate?: number
  [key: string]: unknown
}

/** 一维码字符串类型 → SDK 数字码（官方 Print.js 规定：20 CODE128 / 21 UPC-A / 22 UPC-E / 23 EAN8 / 24 EAN13 / 25 CODE93 / 26 CODE39 / 27 CODEBAR / 28 ITF25） */
const BARCODE_TYPE_MAP: Record<string, number> = {
  CODE128: 20, UPC: 21, UPCA: 21, UPCE: 22, EAN8: 23, EAN13: 24,
  CODE93: 25, CODE39: 26, CODEBAR: 27, ITF25: 28, ITF14: 28,
}

/** 二维码字符串类型 → SDK 数字码（31=QR_CODE） */
const QRCODE_TYPE_MAP: Record<string, number> = {
  QR_CODE: 31, PDF417: 32, DATA_MATRIX: 33, AZTEC: 34,
}

export function mapBackendPrintData(printData: {
  InitDrawingBoardParam?: Record<string, unknown>
  elements?: BackendElement[]
}): LabelPage {
  const board = printData.InitDrawingBoardParam || {}
  const dpi = Number(board.dpi) || 203
  const px2mm = (px: unknown): number => Math.round((Number(px) || 0) * 25.4 / dpi * 100) / 100

  const canvasW = px2mm(board.width)
  const canvasH = px2mm(board.height)
  const elements: LabelPage['elements'] = []

  for (const el of printData.elements || []) {
    const type = String(el.type || '').toLowerCase()
    let x = px2mm(el.x)
    let y = px2mm(el.y)
    let w = px2mm(el.width)
    let h = px2mm(el.height)
    if (w <= 0 || h <= 0) continue
    // 完全在画布外的元素（后端模板含负坐标的重复组）直接剔除
    if (x + w <= 0 || y + h <= 0 || x >= canvasW || y >= canvasH) continue
    // 部分越界的元素钳制到画布内：一维码被物理裁切后无法扫描，宁可压缩宽度
    if (x < 0) { w += x; x = 0 }
    if (y < 0) { h += y; y = 0 }
    if (x + w > canvasW) w = canvasW - x
    if (y + h > canvasH) h = canvasH - y
    if (w <= 0 || h <= 0) continue

    if (type === 'text') {
      const align = String(el.align || 'left').toLowerCase()
      elements.push({
        type: 'text',
        json: {
          x, y, width: w, height: h,
          value: String(el.value ?? ''),
          rotate: 0,
          fontSize: px2mm(el.fontSize) || 3,
          textAlignHorizonral: align === 'center' ? 1 : align === 'right' ? 2 : 0,
          textAlignVertical: 1,
          letterSpacing: 0,
          lineSpacing: 1,
          lineMode: 6,
          fontStyle: [false, false, false, false],
        },
      })
    } else if (type === 'bar_code' || type === 'barcode') {
      const codeType = typeof el.codeType === 'string'
        ? (BARCODE_TYPE_MAP[el.codeType.toUpperCase()] ?? 20)
        : (Number(el.codeType) || 20)
      elements.push({
        type: 'barCode',
        json: { x, y, width: w, height: h, value: String(el.value ?? ''), codeType, rotate: 0, textPosition: 0 },
      })
    } else if (type === 'qr_code' || type === 'qrcode') {
      const codeType = typeof el.codeType === 'string'
        ? (QRCODE_TYPE_MAP[el.codeType.toUpperCase()] ?? 31)
        : (Number(el.codeType) || 31)
      elements.push({
        type: 'qrCode',
        json: { x, y, width: w, height: h, value: String(el.value ?? ''), codeType, rotate: 0 },
      })
    } else if (type === 'line') {
      elements.push({
        type: 'line',
        json: { x, y, width: w, height: Math.max(h, 0.2), lineType: 1, rotate: 0 },
      })
    }
    // graph / image 等类型后端模板暂未使用，遇到时忽略
  }

  return {
    InitDrawingBoardParam: {
      width: canvasW,
      height: canvasH,
      rotate: 0,
      path: '',
      verticalShift: 0,
      HorizontalShift: 0,
    },
    elements,
  }
}
