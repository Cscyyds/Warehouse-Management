export interface ApiResponse<T> {
  success?: boolean
  code?: number
  timestamp?: string
  message: string
  data: T | null
}

export interface PageResult<T> {
  total: number
  items: T[]
}

export type FormValue = string | number | boolean | string[] | null | undefined
export type FormPayload = Record<string, FormValue>
