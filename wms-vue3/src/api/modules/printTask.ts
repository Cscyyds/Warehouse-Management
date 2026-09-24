/**
 * 模块：打印任务（PDA下发 → 网站"打印任务"窗口消费）
 *
 * 任务接口：scanner 端 app/api/v1/endpoints/wms_print_task/print_task.py
 *           （方案《PDA打印任务中转落地方案与实施清单.md》v3.0 §6）
 * 打印数据：复用 scannerPrint.ts 的既有打印函数（接口3-8）+ 本文件补齐
 *           接口9（生产入库条码打印，网站侧此前无封装）
 * 说明：不修改 scannerPrint.ts（零改动约束）——本模块自带与其同构的
 *       轻量 axios 实例（token 透传 + ApiResponse 解包 + 错误提示）
 */
import axios, { type AxiosInstance } from 'axios'
import { ElMessage } from 'element-plus'
import {
  SCANNER_API_BASE_URL,
  type BarcodePrintItem,
  type BarcodePrintResult,
  type PrintCommonParams,
  printLocationBarcode,
  printMergePackage,
  printPlasticBox,
  printPlasticBoxOutbound,
  printPositionBarcode,
  printProductBarcode,
  printPurchaseInBarcodes,
  printSalesReturnBarcodes,
} from './scannerPrint'
// 生产单据箱贴（天心分支）：标签 PDF 由主工程 nuomi_wms 生成（无循环依赖）；
// 芯烨直打时改取 TSPL 指令经本机代理出纸（见 fetchTaskPrintData 的 billLabelDirectPrint 分流）
import {
  printProductionBillPdf,
  printProductionBillTspl,
  type ProductionBillTsplResult,
} from './production'

/* —— 轻量 axios 实例（与 scannerPrint.ts 同构） —— */

interface ApiResponse<T = unknown> {
  success?: boolean
  code?: number
  message: string
  data: T | null
}

const http: AxiosInstance = axios.create({
  baseURL: SCANNER_API_BASE_URL,
  timeout: 30000,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response) => {
    const res = response.data as ApiResponse
    if (res.success === false || (res.code !== undefined && res.code !== 200)) {
      const errMsg = typeof res.data === 'string' && res.data ? res.data : res.message
      ElMessage.error(errMsg || '打印任务请求失败')
      return Promise.reject(new Error(errMsg || '打印任务请求失败'))
    }
    return response.data
  },
  (error) => {
    const resData = error.response?.data as ApiResponse | undefined
    const errMsg = (typeof resData?.data === 'string' && resData.data) || resData?.message || error.message || '网络错误'
    ElMessage.error(errMsg)
    return Promise.reject(new Error(errMsg))
  },
)

function toForm(data: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams()
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value))
  })
  return params
}

async function postForm<T>(url: string, data: Record<string, unknown>): Promise<T> {
  const res = (await http.post(url, toForm(data), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })) as unknown as ApiResponse<T>
  return res.data as T
}

async function getQuery<T>(url: string, params: Record<string, unknown>): Promise<T> {
  const res = (await http.get(url, { params })) as unknown as ApiResponse<T>
  return res.data as T
}

/* —— 任务数据模型（对应后端 PrintTaskItemData） —— */

export type PrintTaskStatus = 'PENDING' | 'PRINTED' | 'CANCELED'

/** 生成式类型的重放参数（{items:[{type,merge_qty,print_qty}], doc_key?}） */
export interface PrintTaskParams {
  doc_key?: string
  items?: BarcodePrintItem[]
}

export interface PrintTaskItem {
  print_task_id: string
  task_no: string
  batch_id: string
  biz_type: string
  biz_type_desc: string
  biz_id: string
  biz_desc: string
  print_qty: number
  print_params: PrintTaskParams | null
  summary: Record<string, unknown> | null
  source: string
  source_desc: string
  status: PrintTaskStatus
  is_generative: boolean
  created_by: string
  created_by_name: string
  created_at: string
  printed_by_name: string | null
  printed_at: string | null
  cancel_reason: string | null
}

export interface PrintTaskListResponse {
  list: PrintTaskItem[]
  total: number
  page: number
  page_size: number
}

export interface ListPrintTasksQuery {
  status?: 'PENDING' | 'PRINTED' | 'CANCELED' | 'ALL'
  biz_type?: string
  page?: number
  page_size?: number
}

/** 查询打印任务列表（进入页面/点击刷新时调用；无轮询） */
export function listPrintTasks(query: ListPrintTasksQuery = {}): Promise<PrintTaskListResponse> {
  return getQuery<PrintTaskListResponse>('/api/v1/tenant-wms/print-tasks', { status: 'PENDING', ...query })
}

export interface MarkPrintedResult {
  print_task_id: string
  task_no: string
  status: string
  printed_at: string
}

/** 确认已打印（打印出纸成功后回写；幂等） */
export function markPrintTaskPrinted(printTaskId: string): Promise<MarkPrintedResult> {
  return postForm<MarkPrintedResult>('/api/v1/tenant-wms/print-tasks/printed', { print_task_id: printTaskId })
}

/** 取消打印任务（仅待打印可取消） */
export function cancelPrintTask(printTaskId: string, reason?: string): Promise<{ print_task_id: string; task_no: string; status: string }> {
  return postForm('/api/v1/tenant-wms/print-tasks/cancel', { print_task_id: printTaskId, reason })
}

/* —— 任务创建（网站侧触发点） —— */

/** 建任务项（与后端 CreatePrintTasksRequest items 元素对应） */
export interface CreatePrintTaskItemPayload {
  biz_type: string
  biz_id: string
  biz_desc?: string
  print_qty?: number
  params?: Record<string, unknown>
}

export interface CreatePrintTasksResult {
  batch_id: string
  created: Array<{ print_task_id: string; task_no: string; biz_type: string; biz_id: string; biz_desc: string }>
  skipped: Array<{ biz_id: string; reason: string }>
  invalid: Array<{ biz_id: string; reason: string }>
  total_pending: number
}

/**
 * 批量创建打印任务（PDA 五类触发点之外的网站侧触发点也走此接口）。
 * 生产单据批量打印：source='PRODUCTION_BILL_PRINT'，每张单据一项
 * （biz_type='PRODUCTION_BILL_LABEL'，params 携带 doc_key，天心分支）。
 * batchNo 传 UUID 重试复用可实现幂等（确定性类型按单据维度幂等）。
 */
export function createPrintTasks(
  source: string,
  items: CreatePrintTaskItemPayload[],
  batchNo?: string,
): Promise<CreatePrintTasksResult> {
  return postForm<CreatePrintTasksResult>('/api/v1/tenant-wms/print-tasks', {
    source,
    batch_no: batchNo,
    items: JSON.stringify(items),
  })
}

/* —— 接口9 封装：打印生产入库条码（网站侧此前缺失的唯一打印函数） —— */

/** 打印生产入库条码（接口9，5 类生产单据；wms_item_id 为 prdi_ 前缀） */
export function printProductionInbound(
  docKey: string,
  wmsItemId: string,
  items: BarcodePrintItem[],
  params: Omit<PrintCommonParams, 'print_qty'>,
): Promise<{ items: Array<Record<string, unknown>> } & Record<string, unknown>> {
  return postForm(`/api/v1/tenant-wms/production/inbound/${docKey}/barcodes/print`, {
    ...params,
    wms_item_id: wmsItemId,
    items: JSON.stringify(items),
  })
}

/* —— 类型注册表：biz_type → 取打印数据的调用方式 —— */

/** 生产单据箱贴（biz_type 常量，天心分支）：PDF 型任务，不走条码直打链路 */
export const BIZ_TYPE_PRODUCTION_BILL_LABEL = 'PRODUCTION_BILL_LABEL'

/** 归一化后的一张可打印标签（多标签任务拆成多张） */
export interface PrintableLabel {
  key: string
  /** 展示名（条码编号等） */
  label: string
  /** 本张打印份数 */
  qty: number
  result: BarcodePrintResult
  /** PDF 型任务（生产单据箱贴）：主工程返回的标签 PDF 二进制与下载文件名。
   *  有值时页面走 PDF 下载/预览分支，不进打印机直打链路 */
  pdfBlob?: Blob
  pdfFileName?: string
}

/** 入库类响应（items 嵌套：SINGLE 直接可打，MERGE 展开为 merge_packages[]）→ 扁平标签列表 */
function normalizeInboundResponse(response: { items?: Array<Record<string, unknown>> } & Record<string, unknown>, fallbackLabel: string): PrintableLabel[] {
  const labels: PrintableLabel[] = []
  const items = Array.isArray(response.items) ? response.items : []
  items.forEach((item, index) => {
    const type = String(item.type || '')
    if (type === 'MERGE') {
      const packages = Array.isArray(item.merge_packages) ? item.merge_packages : []
      packages.forEach((pkg: Record<string, unknown>, pkgIndex: number) => {
        labels.push({
          key: `${index}-${pkgIndex}`,
          label: String(pkg.barcode_code || `合包标签 ${pkgIndex + 1}`),
          qty: Number(pkg.print_qty || 1),
          result: pkg as unknown as BarcodePrintResult,
        })
      })
    } else {
      labels.push({
        key: String(index),
        label: String(item.barcode_code || `${fallbackLabel} ${index + 1}`),
        qty: Number(item.print_qty || 1),
        result: item as unknown as BarcodePrintResult,
      })
    }
  })
  return labels
}

/**
 * 按任务类型调用对应既有打印接口，归一化返回可打印标签列表。
 * print_mode 由调用方指定（PREVIEW 预览 / PRINT 打印）。
 * billLabelDirectPrint：生产单据箱贴在 PRINT 且已选芯烨直打型号时传 true——
 * 改取主工程 TSPL 指令走本机代理直打（每张明细一张标签）；否则保持 PDF 下载/预览。
 */
export async function fetchTaskPrintData(
  task: PrintTaskItem,
  params: PrintCommonParams,
  billLabelDirectPrint = false,
): Promise<PrintableLabel[]> {
  const { print_qty: qty, ...paramsWithoutQty } = params
  switch (task.biz_type) {
    case 'MERGE_PACKAGE':
      return [{ key: '0', label: task.biz_desc || task.biz_id, qty, result: await printMergePackage(task.biz_id, params) }]
    case 'PLASTIC_BOX':
      return [{ key: '0', label: task.biz_desc || task.biz_id, qty, result: await printPlasticBox(task.biz_id, params) }]
    case 'PRODUCT':
      return [{ key: '0', label: task.biz_desc || task.biz_id, qty, result: await printProductBarcode(task.biz_id, params) }]
    case 'LOCATION':
      return [{ key: '0', label: task.biz_desc || task.biz_id, qty, result: await printLocationBarcode(task.biz_id, params) }]
    case 'PRODUCT_POSITION':
      return [{ key: '0', label: task.biz_desc || task.biz_id, qty, result: await printPositionBarcode(task.biz_id, params) }]
    case 'PLASTIC_BOX_OUTBOUND':
      return [{ key: '0', label: task.biz_desc || task.biz_id, qty, result: await printPlasticBoxOutbound(task.biz_id, params) }]
    case 'INBOUND_PURCHASE':
      return normalizeInboundResponse(
        await printPurchaseInBarcodes(task.biz_id, task.print_params?.items || [], paramsWithoutQty),
        task.biz_type_desc,
      )
    case 'INBOUND_SALES_RETURN':
      return normalizeInboundResponse(
        await printSalesReturnBarcodes(task.biz_id, task.print_params?.items || [], paramsWithoutQty),
        task.biz_type_desc,
      )
    case 'PRODUCTION_INBOUND': {
      const docKey = task.print_params?.doc_key || ''
      if (!docKey) throw new Error('任务缺少生产单据类型（doc_key），请取消后重新下发')
      return normalizeInboundResponse(
        await printProductionInbound(docKey, task.biz_id, task.print_params?.items || [], paramsWithoutQty),
        task.biz_type_desc,
      )
    }
    case BIZ_TYPE_PRODUCTION_BILL_LABEL: {
      // 生产单据箱贴（天心分支）：默认整单标签 PDF 由主工程生成，返回 pdfBlob 交页面
      // 下载/预览；芯烨直打（PRINT + 已选直打型号）改取 TSPL 指令走本机代理出纸，
      // 预览（PREVIEW）恒走 PDF（TSPL 无预览形态）。主工程 axios 实例 silent 不弹错，
      // 此处显式提示后原样抛出
      const docKey = task.print_params?.doc_key || ''
      if (!docKey) throw new Error('任务缺少生产单据类型（doc_key），请取消后重新下发')
      if (params.print_mode === 'PRINT' && billLabelDirectPrint) {
        let tspl: ProductionBillTsplResult | null = null
        try {
          tspl = (await printProductionBillTspl(docKey, task.biz_id, params.density, params.label_type)).data
        } catch (error) {
          ElMessage.error(`箱贴直打指令获取失败：${error instanceof Error ? error.message : '请稍后重试'}`)
          throw error
        }
        if (!tspl || !tspl.items?.length) throw new Error('箱贴直打指令为空，请稍后重试')
        return tspl.items.map((item, index) => ({
          key: String(index),
          label: item.label,
          // 每张明细一张标签、一份出纸（份数语义与 PDF 版一致：整单一套）
          qty: 1,
          result: {
            printer_has_preview_capability: true,
            sdk_type: 'XP',
            print_data: { tspl_commands: item.tspl_commands },
          } as unknown as BarcodePrintResult,
        }))
      }
      let blob: Blob
      try {
        blob = await printProductionBillPdf(docKey, task.biz_id)
      } catch (error) {
        ElMessage.error(`箱贴 PDF 获取失败：${error instanceof Error ? error.message : '请稍后重试'}`)
        throw error
      }
      return [{
        key: '0',
        label: task.biz_desc || task.biz_id,
        qty: task.print_qty || 1,
        result: {} as BarcodePrintResult,
        pdfBlob: blob,
        pdfFileName: `${task.biz_desc || task.biz_id}.pdf`,
      }]
    }
    default:
      throw new Error(`暂不支持的打印类型：${task.biz_type_desc || task.biz_type}`)
  }
}
