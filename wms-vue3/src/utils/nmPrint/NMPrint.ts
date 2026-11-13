/**
 * 精臣打印 SDK 接口封装（移植自 web-4.0.6_20260514/pc-sdk-vue/src/utils/Print.js）
 * 依赖本机打印服务（浏览器 → ws://127.0.0.1:37989 → 打印服务 → 打印机）
 */
import { NmSocket, type SdkMessage } from './Socket'

/** 打印异常码与中文提示（源自官方 SDK） */
export const PRINT_ERROR_MESSAGES: Record<number, string> = {
  1: '异常开盖，请关闭上盖后再继续打印',
  2: '未检测到标签纸，请重新安装后再试',
  3: '电量过低，请充电后再试',
  4: '电池异常，请联系客服',
  5: '已停止打印',
  6: '打印异常，请稍后再试',
  7: '打印头温度过高，请冷却后再试',
  8: '出纸异常或标签纸用完，请检查标签纸后再试',
  9: '打印忙碌，请稍后再试',
  10: '未检测到打印头，请联系客服',
  11: '打印环境温度过低，请在室温下再试',
  12: '打印头未锁紧，请锁紧后再试',
  13: '未检测到碳带，请安装碳带后再试',
  14: '碳带不匹配，请安装匹配类型碳带',
  15: '碳带已用完，请更换碳带后再试',
  16: '纸张类型错误，请联系客服',
  20: '标签损坏或非RFID标签，请检查标签纸后再试',
  22: '通讯异常，请稍后再试',
  23: '打印机连接断开，请重新连接再试',
  28: '标签纸异常，请按打印机右键重新定位',
  29: '检测到RFID标签，请更换标签纸后再试',
  30: '浓度设置异常，请重新设置',
  31: '打印模式异常，请重新设置',
  32: '标签材质设置异常，请重新设置',
  33: '不支持该标签材质，请更换或重新设置',
  34: '不支持RFID写入',
  50: '非法标签',
  51: '非法碳带和标签',
}

/** 根据错误码取中文提示；未知码回落到 info 或通用文案 */
export function describePrintError(errorCode: number, info?: string): string {
  return PRINT_ERROR_MESSAGES[errorCode] || info || `打印异常（错误码 ${errorCode}）`
}

/** 画板初始化参数（宽高单位 mm） */
export interface DrawingBoardParam {
  width: number
  height: number
  rotate: number
  path?: string
  verticalShift?: number
  HorizontalShift?: number
}

export interface TextElementJson {
  x: number; y: number; height: number; width: number
  value: string
  fontFamily?: string
  rotate?: number
  fontSize: number
  /** 0 左对齐 1 居中 2 右对齐 */
  textAlignHorizonral?: number
  /** 0 顶对齐 1 垂直居中 2 底对齐 */
  textAlignVertical?: number
  letterSpacing?: number
  lineSpacing?: number
  /** 建议 6：宽高固定，内容超宽高时自动缩放 */
  lineMode?: number
  /** [加粗, 斜体, 下划线, 删除线] */
  fontStyle?: [boolean, boolean, boolean, boolean]
}

export interface CodeElementJson {
  x: number; y: number; height: number; width: number
  value: string
  /** barCode：一维码类型（常用 20=CODE128）；qrCode：31=QR_CODE */
  codeType: number
  rotate?: number
  fontSize?: number
  textHeight?: number
  textPosition?: number
}

export interface GraphElementJson {
  x: number; y: number; height: number; width: number
  rotate?: number
  lineWidth?: number
  lineType?: number
  /** 1 圆 2 椭圆 3 矩形 4 圆角矩形 */
  graphType: number
}

export interface LineElementJson {
  x: number; y: number; height: number; width: number
  lineType?: number
  rotate?: number
  dashwidth?: string
}

export type ElementJson = TextElementJson | CodeElementJson | GraphElementJson | LineElementJson

export interface LabelElement {
  type: 'text' | 'qrCode' | 'barCode' | 'line' | 'graph' | 'image'
  json: ElementJson
}

/** 单页标签：画板参数 + 元素列表 */
export interface LabelPage {
  InitDrawingBoardParam: DrawingBoardParam
  elements: LabelElement[]
}

export class NMPrint {
  private socket: NmSocket

  constructor(socket: NmSocket) {
    this.socket = socket
  }

  private send(apiName: string, parameter?: unknown, timeout?: number): Promise<SdkMessage> {
    return this.socket.send(parameter !== undefined ? { apiName, parameter } : { apiName }, timeout)
  }

  /**
   * 带超时重试的指令发送：打印服务偶发忽略新连接上的首条指令（实测复现，
   * 10s 无应答返回 errorCode 22「通讯异常」），对幂等的指令自动重试一次。
   * 注意：commitJob 有副作用（重复提交会多打一页），不走此方法。
   */
  private async sendWithRetry(apiName: string, parameter?: unknown, timeout?: number): Promise<SdkMessage> {
    let res = await this.send(apiName, parameter, timeout)
    if (res.resultAck?.errorCode === 22) {
      res = await this.send(apiName, parameter, timeout)
    }
    return res
  }

  private expectOk(res: SdkMessage, action: string): SdkMessage {
    if (res.resultAck?.errorCode !== 0) {
      throw new Error(describePrintError(res.resultAck?.errorCode ?? 0, res.resultAck?.info) || `${action}失败`)
    }
    return res
  }

  /** 连接打印服务后必须先调用（fontDir 官方注明"暂不生效"，传 {fontDir:""} 与官方 Demo 一致） */
  initSdk(): Promise<SdkMessage> {
    return this.send('initSdk', { fontDir: '' })
  }

  /** 获取 USB 连接的打印机列表 */
  getAllPrinters(): Promise<SdkMessage> {
    return this.send('getAllPrinters')
  }

  /** 连接 USB 打印机 */
  selectPrinter(printerName: string, port: number): Promise<SdkMessage> {
    return this.send('selectPrinter', { printerName, port })
  }

  /** 搜索 WiFi 打印机（耗时较长，需放大超时） */
  scanWifiPrinter(): Promise<SdkMessage> {
    return this.send('scanWifiPrinter', undefined, 25000)
  }

  /** 连接 WiFi 打印机（仅限 scanWifiPrinter 结果中的设备） */
  connectWifiPrinter(printerName: string, port: number): Promise<SdkMessage> {
    return this.send('connectWifiPrinter', { printerName, port }, 25000)
  }

  /** 开启打印任务；count 为所有页打印份数之和 */
  startJob(printDensity: number, printLabelType: number, printMode: number, count: number): Promise<SdkMessage> {
    return this.sendWithRetry('startJob', {
      printDensity, printLabelType, printMode, count,
    })
  }

  /**
   * 提交当前页（printQuantity 为本页打印份数）。
   * 官方协议：printData 必须为 null——设备打印的是此前绘制命令的画板缓存，
   * 传入页面数组会被设备以 errorCode 6 "Data error" 拒收。
   */
  commitJob(printQuantity: number): Promise<SdkMessage> {
    return this.socket.send({
      apiName: 'commitJob',
      parameter: {
        printData: null,
        printerImageProcessingInfo: { printQuantity },
      },
    })
  }

  /** 结束打印任务（全部页完成 printQuantity 后调用） */
  endJob(): Promise<SdkMessage> {
    return this.send('endJob')
  }

  /** 断开打印机连接，释放独占的设备句柄（打印完成后调用，否则其他页面探测会得到 no device） */
  closePrinter(): Promise<SdkMessage> {
    return this.send('closePrinter')
  }

  /** 取消当前打印任务 */
  cancelJob(): Promise<SdkMessage> {
    return this.send('stopPrint')
  }

  /** 初始化画板（会清空上次绘制内容） */
  InitDrawingBoard(param: DrawingBoardParam): Promise<SdkMessage> {
    return this.sendWithRetry('InitDrawingBoard', param)
  }

  DrawLableText(json: TextElementJson): Promise<SdkMessage> {
    return this.sendWithRetry('DrawLableText', json)
  }

  DrawLableBarCode(json: CodeElementJson): Promise<SdkMessage> {
    return this.sendWithRetry('DrawLableBarCode', json)
  }

  DrawLableQrCode(json: CodeElementJson): Promise<SdkMessage> {
    return this.sendWithRetry('DrawLableQrCode', json)
  }

  DrawLableGraph(json: GraphElementJson): Promise<SdkMessage> {
    return this.sendWithRetry('DrawLableGraph', json)
  }

  DrawLableLine(json: LineElementJson): Promise<SdkMessage> {
    return this.sendWithRetry('DrawLableLine', json)
  }

  /**
   * 生成预览图，返回 base64 PNG；失败抛出具体原因。
   * displayScale = 每毫米像素数（官方注释：200dpi≈8，300dpi≈11.81）。
   * 不传时按"预览图宽 ≥1000px"自适应（50mm 标签 → 20px/mm → 1000×600px）：
   * 固定 8 时小标签只有 ~400px 宽，在高分屏（150% 缩放）上被拉伸后条码发糊。
   */
  async generatePreviewImage(pages: LabelPage[], displayScale?: number): Promise<string | null> {
    const page = pages[0]
    const scale = displayScale ?? Math.min(24, Math.max(8, Math.ceil(1000 / (page.InitDrawingBoardParam.width || 50))))
    const stepLog = (msg: string) => console.log('%c[精臣打印]', 'color:#e6a23c;font-weight:bold', msg)
    const t0 = Date.now()
    await this.expectOk(await this.InitDrawingBoard(page.InitDrawingBoardParam), '画板初始化')
    stepLog(`[预览] 画板初始化完成 ${page.InitDrawingBoardParam.width}×${page.InitDrawingBoardParam.height}mm，生图 ${scale}px/mm（${Date.now() - t0}ms）`)
    for (const element of page.elements) {
      const res = await this.drawElement(element)
      await this.expectOk(res, '绘制元素')
    }
    stepLog(`[预览] ${page.elements.length} 个元素绘制完成（累计 ${Date.now() - t0}ms）`)
    // 官方 SDK 此处 displayScale 为顶层字段（非 parameter 包裹）；生图耗时较长，超时放大到 20s
    let res = await this.socket.send({ apiName: 'generateImagePreviewImage', displayScale: scale }, 20000)
    // 打印服务偶发无应答（errorCode 22 超时），重试一次
    if (res.resultAck?.errorCode === 22) {
      stepLog(`[预览] 生图超时（${Date.now() - t0}ms），重试一次...`)
      res = await this.socket.send({ apiName: 'generateImagePreviewImage', displayScale: scale }, 20000)
    }
    await this.expectOk(res, '生成预览')
    stepLog(`[预览] 预览图生成完成（累计 ${Date.now() - t0}ms）`)
    try {
      const info = JSON.parse(String(res.resultAck?.info ?? '{}')) as { ImageData?: string }
      return info.ImageData ? `data:image/png;base64,${info.ImageData}` : null
    } catch {
      return null
    }
  }

  async drawElement(element: LabelElement): Promise<SdkMessage> {
    switch (element.type) {
      case 'text': return this.DrawLableText(element.json as TextElementJson)
      case 'barCode': return this.DrawLableBarCode(element.json as CodeElementJson)
      case 'qrCode': return this.DrawLableQrCode(element.json as CodeElementJson)
      case 'graph': return this.DrawLableGraph(element.json as GraphElementJson)
      case 'line': return this.DrawLableLine(element.json as LineElementJson)
      default: throw new Error(`不支持的打印元素类型：${element.type}`)
    }
  }

  addPrintListener(callback: Parameters<NmSocket['addPrintListener']>[0]) {
    return this.socket.addPrintListener(callback)
  }

  removePrintListener(callback: Parameters<NmSocket['removePrintListener']>[0]) {
    this.socket.removePrintListener(callback)
  }
}
