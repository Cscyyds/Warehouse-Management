import axios, { AxiosError } from 'axios'
import type {
  PdfCropsResponse,
  PdfEventsResponse,
  PdfExcelPreview,
  PdfJobDetail,
  PdfJobListParams,
  PdfJobListResponse,
  PdfProductsResponse,
} from '@/types/pdfAdmin'

const AUTH_KEY = 'zhixing-wms-admin-auth'
export const PDF_ADMIN_BASE_URL =
  import.meta.env.VITE_PDF_AGENT_BASE_URL || '/pdf-agent/api/admin'

export const pdfAdminHttp = axios.create({
  baseURL: PDF_ADMIN_BASE_URL,
  timeout: 120000,
})

pdfAdminHttp.interceptors.request.use((config) => {
  const raw = localStorage.getItem(AUTH_KEY)
  if (raw) {
    try {
      const token = (JSON.parse(raw) as { accessToken?: string }).accessToken
      if (token) config.headers.Authorization = `Bearer ${token}`
    } catch {
      localStorage.removeItem(AUTH_KEY)
    }
  }
  return config
})

pdfAdminHttp.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string; message?: string }>) => {
    const status = error.response?.status ?? 0
    if (status === 401) {
      localStorage.removeItem(AUTH_KEY)
      const base = import.meta.env.BASE_URL
      if (!location.pathname.endsWith('/login')) {
        location.assign(`${base}login?redirect=${encodeURIComponent(location.pathname + location.search)}`)
      }
    }
    const detail = error.response?.data?.detail || error.response?.data?.message
    throw new Error(detail || error.message || '请求失败')
  },
)

export function listPdfJobs(params: PdfJobListParams): Promise<PdfJobListResponse> {
  return pdfAdminHttp.get<PdfJobListResponse>('/jobs', { params }).then((response) => response.data)
}

export function getPdfJobDetail(jobId: string): Promise<PdfJobDetail> {
  return pdfAdminHttp.get<PdfJobDetail>(`/jobs/${encodeURIComponent(jobId)}`).then((response) => response.data)
}

export function getPdfJobEvents(
  jobId: string,
  params: { stream_id?: string; since?: number; limit?: number } = {},
): Promise<PdfEventsResponse> {
  return pdfAdminHttp
    .get<PdfEventsResponse>(`/jobs/${encodeURIComponent(jobId)}/events`, { params })
    .then((response) => response.data)
}

export function getPdfJobProducts(jobId: string): Promise<PdfProductsResponse> {
  return pdfAdminHttp
    .get<PdfProductsResponse>(`/jobs/${encodeURIComponent(jobId)}/products`)
    .then((response) => response.data)
}

export function getPdfJobCrops(jobId: string): Promise<PdfCropsResponse> {
  return pdfAdminHttp.get<PdfCropsResponse>(`/jobs/${encodeURIComponent(jobId)}/crops`).then((response) => response.data)
}

export function getPdfJobExcelPreview(jobId: string, limit = 200): Promise<PdfExcelPreview> {
  return pdfAdminHttp
    .get<PdfExcelPreview>(`/jobs/${encodeURIComponent(jobId)}/excel-preview`, { params: { limit } })
    .then((response) => response.data)
}

export function createPdfJobExcel(jobId: string, limit = 200): Promise<PdfExcelPreview> {
  return pdfAdminHttp
    .post<PdfExcelPreview>(`/jobs/${encodeURIComponent(jobId)}/export-xlsx`, undefined, { params: { limit } })
    .then((response) => response.data)
}

function fileNameFromDisposition(header: string | undefined, fallback: string): string {
  if (!header) return fallback
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1])
    } catch {
      return utf8[1]
    }
  }
  const ascii = /filename="?([^;]+)"?/i.exec(header)
  return ascii?.[1] || fallback
}

export async function downloadPdfJobExcel(jobId: string, fallbackName = 'products.xlsx'): Promise<Blob> {
  const response = await pdfAdminHttp.get<Blob>(`/jobs/${encodeURIComponent(jobId)}/export.xlsx`, {
    responseType: 'blob',
  })
  const fileName = fileNameFromDisposition(response.headers['content-disposition'], fallbackName)
  const blob = response.data
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return blob
}

export async function fetchPdfAssetBlob(path: string): Promise<string> {
  const response = await pdfAdminHttp.get<Blob>(path, { responseType: 'blob' })
  return URL.createObjectURL(response.data)
}
