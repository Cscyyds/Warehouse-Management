import { normalizeApiError } from '@/utils/apiError';
import { safeErrorText } from '@/utils/serverErrorDisplay';
/**
 * 数据中台页面的服务端解析接口封装。
 *
 * 目前接入的是两个"现成可用"的解析接口（都在 Coze_Connect 服务上）：
 *   POST /api/v1/file/excel/parse  表格解析（xlsx/xlsm/xltx/xltm/xls/xlsb/ods/csv/tsv/txt/xml）
 *   POST /pdf/parse                PDF 按页提取正文与图片
 *
 * 两者都是"解析即返回"的同步接口，不落业务库；PDF 的嵌入图片会转存 BOS。
 * 页面必须先能登录（前端 utils/session.ts 的活动会话），否则后端一律 401。
 *
 * 错误分两类，调用方必须区别对待：
 *   ApiUnavailableError —— 服务不可用（未登录 / 网络 / 超时 / 5xx / 4xx），可回退本地解析
 *   ParseRejectedError  —— 请求本身不合法（空文件、超上限、格式不支持），回退没有意义
 *
 * vite 侧需要在 pdfProxyTarget（Coze_Connect）上补两条代理前缀：
 *   '/api/v1/file/excel' 与 '/pdf/parse'。见 vite.config.ts 同名注释。
 */
import { pdfFetch } from '@/utils/pdfApi';
import { authHeaders } from '@/utils/session';

/** 服务端解析不可用。调用方据此决定是否回退浏览器本地解析。 */
export class ApiUnavailableError extends Error {
  /** 后端返回的 HTTP 状态码；网络或超时类失败为 0。 */
  readonly status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiUnavailableError';
    this.status = status;
  }
}

/** 请求本身不合法（与"服务不可用"无关，回退本地不会变好）。 */
export class ParseRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseRejectedError';
  }
}

export interface ExcelSheetCell {
  row_index: number;
  column_index: number;
  coordinate: string;
  text: string;
}

export interface ExcelSheetRow {
  row_index: number;
  cells: ExcelSheetCell[];
}

export interface ExcelSheet {
  sheet_index: number;
  sheet_name: string;
  sheet_type: string;
  visibility: string;
  row_count: number;
  column_count: number;
  merged_ranges: string[];
  /** 逐单元格完整网格（兼容字段）。 */
  rows: ExcelSheetRow[];
  /** 表头区域自动提取的元数据（标题、单号、色温等）。 */
  metadata: Record<string, string>;
  headers: string[];
  /** 每行为 { 列名: 值 }，空值字段已省略。 */
  data_rows: Record<string, string>[];
}

export interface ExcelParseResult {
  file_name: string;
  file_size: number;
  content_type: string | null;
  file_format: string;
  sheet_count: number;
  total_rows: number;
  total_cells: number;
  sheets: ExcelSheet[];
}

export interface PdfPageImage {
  image_name: string;
  image_url: string;
  xref: number;
  mask_xref: number | null;
  bbox: number[] | null;
}

export interface PdfPage {
  page_number: number;
  text: string;
  images: PdfPageImage[];
}

export interface PdfParseResult {
  file_name: string;
  page_count: number;
  pages: PdfPage[];
}

/** 单文件上限，与后端 MAX_UPLOAD_SIZE_BYTES 一致。 */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** 表格解析的单元格总量上限，与后端 EXCEL_PARSE_MAX_CELLS 一致。 */
export const MAX_EXCEL_CELLS = 200_000;

/** PDF 页数上限，与后端 PDF_MAX_PAGES 一致。 */
export const MAX_PDF_PAGES = 200;

/** 服务端支持的表格扩展名，与 service/excel_service.py 的 SUPPORTED_EXCEL_EXTENSIONS 一致。 */
export const SERVER_EXCEL_EXTS = [
  '.xlsx', '.xlsm', '.xltx', '.xltm', '.xls', '.xlsb', '.ods',
  '.csv', '.tsv', '.txt', '.xml',
] as const;

/** 解析类请求的超时：大表格后端也要算，给足 3 分钟。 */
const PARSE_TIMEOUT_MS = 180_000;

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === 'AbortError' || err.name === 'TimeoutError'
    : false;
}

/** 把后端错误体收敛成一句可读文案。 */
async function readErrorDetail(resp: Response): Promise<string> {
  try {
    const body = (await resp.json()) as { detail?: unknown; message?: unknown };
    return safeErrorText(normalizeApiError(body, `服务返回 ${resp.status}`).message, resp.status);
  } catch {
    /* 非 JSON 响应体：退回状态码文案 */
  }
  return safeErrorText(`服务返回 ${resp.status}`, resp.status);
}

/**
 * 统一的 multipart 解析请求。
 *
 * 用 pdfFetch 而非裸 fetch：令牌过期时能走会话失效流程（与 PDF 审核页一致）。
 */
async function postParseFile<T>(url: string, file: File, label: string): Promise<T> {
  if (!file.size) throw new ParseRejectedError(`${file.name}：文件为空`)
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ParseRejectedError(
      `${file.name}：超过单文件 ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} 兆字节上限，请拆分后上传`,
    )
  }

  const form = new FormData()
  form.append('file', file, file.name)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PARSE_TIMEOUT_MS)
  let resp: Response
  try {
    resp = await pdfFetch(url, {
      method: 'POST',
      // 不能手工设 Content-Type：multipart 的 boundary 由浏览器生成
      headers: authHeaders(),
      body: form,
      signal: controller.signal,
    })
  } catch (err) {
    throw new ApiUnavailableError(isAbortError(err) ? `${label}超时` : `${label}请求失败`, 0)
  } finally {
    clearTimeout(timer)
  }

  if (!resp.ok) {
    const detail = await readErrorDetail(resp)
    throw new ApiUnavailableError(`${label}失败：${detail}`, resp.status)
  }
  try {
    return (await resp.json()) as T
  } catch {
    throw new ApiUnavailableError(`${label}返回的不是合法 JSON`, resp.status)
  }
}

/** 表格解析：成功即返回逐工作表结构。 */
export function parseExcelOnServer(file: File): Promise<ExcelParseResult> {
  return postParseFile<ExcelParseResult>('/api/v1/file/excel/parse', file, '表格解析')
}

/** PDF 解析：成功即返回按页正文与图片。 */
export function parsePdfOnServer(file: File): Promise<PdfParseResult> {
  return postParseFile<PdfParseResult>('/pdf/parse', file, '版式文档解析')
}

/** 文件名是否在服务端表格解析支持范围内。 */
export function isServerExcelName(name: string): boolean {
  const lower = name.toLowerCase()
  return SERVER_EXCEL_EXTS.some(ext => lower.endsWith(ext))
}

/** 把逐单元格网格还原成二维字符串数组，供页面表格预览直接渲染。 */
export function sheetToGrid(sheet: ExcelSheet): string[][] {
  if (Array.isArray(sheet.rows) && sheet.rows.length) {
    return sheet.rows.map(row => {
      const cells = Array.isArray(row.cells) ? row.cells : []
      if (!cells.length) return []
      const width = Math.max(...cells.map(cell => cell.column_index))
      const line: string[] = new Array(width).fill('')
      for (const cell of cells) line[cell.column_index - 1] = cell.text ?? ''
      return line
    })
  }
  // 兼容只给 headers + data_rows 的实现：用表头补首行，缺列留空
  const headers = Array.isArray(sheet.headers) ? sheet.headers : []
  if (!headers.length) return []
  const body = (sheet.data_rows || []).map(row => headers.map(header => row[header] ?? ''))
  return [headers, ...body]
}
