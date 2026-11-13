export interface PdfStreamRun {
  stream_id: string
  kind: string
  status: string
  retry_count: number
  error_message: string
  lease_owner: string
  lease_heartbeat?: string | null
  created_at?: string | null
  started_at?: string | null
  finished_at?: string | null
}

export interface PdfJobRow {
  job_id: string
  file_name: string
  status: string
  page_count: number
  progress_current: number
  progress_total: number
  company_id: string
  created_by: string
  owner_user_id: string
  owner_user_name: string
  error_message: string
  created_at?: string | null
  updated_at?: string | null
  completed_at?: string | null
  checkpoint_available: boolean
  archive_available: boolean
  product_count: number
  crop_count: number
  image_count: number
  failed_image_count: number
  stream: PdfStreamRun | null
  stage: string
  result_mode: string
}

export interface PdfJobListStats {
  total: number
  active: number
  review_pending: number
  abnormal: number
  published: number
  publish_partial: number
}

export interface PdfJobListResponse {
  page: number
  page_size: number
  total: number
  items: PdfJobRow[]
  stats: PdfJobListStats
}

export interface PdfJobDetail extends PdfJobRow {
  source_url: string
  file_size: number
  page_progress: Record<string, number>
  runs: PdfStreamRun[]
  latest_stream_id: string
  review: {
    status: string
    remaining_review_count: number
    approved_product_count: number
    approved_crop_count: number
    rejected_product_count: number
    rejected_crop_count: number
  }
  export: Record<string, string | number>
  excel_download_url: string
}

export interface PdfProductImage {
  source_crop_id: string
  product_candidate_id: string
  product_name: string
  image_type: string
  description: string
  page_number: number
  sort: number
  review_action: string
  publish_status: string
  error_message: string
  image_url: string
  preview_url: string
}

export interface PdfProduct {
  product_candidate_id: string
  product_name: string
  brand: string
  series_name: string
  category_name: string
  supplier_name: string
  product_model: string
  item_no: string
  features: string[]
  installation: string
  precautions: string
  specification: Record<string, unknown> | unknown[]
  pages: Array<string | number>
  review_action: string
  image_count: number
  images: PdfProductImage[]
}

export interface PdfProductsResponse {
  job_id: string
  mode: string
  total: number
  items: PdfProduct[]
}

export interface PdfCropsResponse {
  job_id: string
  mode: string
  total: number
  items: PdfProductImage[]
}

export interface PdfJobEvent {
  seq: number
  ev: string
  data: Record<string, unknown>
}

export interface PdfEventsResponse {
  job_id: string
  stream: PdfStreamRun | null
  events: PdfJobEvent[]
  last_seq: number
}

export interface PdfExcelPreview {
  job_id: string
  kind: 'actual' | 'estimate'
  file_name: string
  columns: string[]
  rows: string[][]
  total_rows: number
  truncated: boolean
  limit: number
  can_export: boolean
  download_url: string
  message: string
  export?: Record<string, unknown>
}

export interface PdfJobListParams {
  page: number
  page_size: number
  keyword?: string
  status?: string
  company_id?: string
  owner_user_id?: string
  created_from?: string
  created_to?: string
  abnormal_only?: boolean
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}
