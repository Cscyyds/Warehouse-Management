/**
 * 模块：财务管理
 * 源接口：08_租客员工_财务管理.md
 * 范围：银行账户（接口1-8）、预付款单（模块E：E1-E11）、科目数据源（A4/A6/A7，供下拉用）
 *   科目管理完整页（A1-A8）、收付款单等暂不接入
 *
 * 后端契约（已对照接口文档）：
 *   - 银行账户列表/搜索返回 key 为 items（与 product 的 products / purchase 的 purchase_order 命名不同，以联调实际为准）
 *   - 详情返回裸对象（无 wrapper key），含 images[] / attachments[]
 *   - account_status / payment_method 存英文标准值，*_name 为中文；select 统一传中文由后端映射
 *   - 删除图片/附件参数为 file_urls（JSON 数组字符串），返回 { deleted_count }
 *   - 创建/更新均为 multipart/form-data；图片/附件在更新时仅追加，不删除已有
 *   - 注意：toMultipart 会过滤空串，故更新接口的"传空串清空"能力本期不实现
 *
 * 预付款单（模块E）契约要点：
 *   - 列表/详情返回结构文档未给示例，类型按推断封装、联调校准
 *   - E1 创建时 items 为 JSON 字符串，含 supplier_id/三个金额/supplier 银行信息；三个总金额后端自动算
 *   - E2 更新仅主表，明细用 E9/E10/E11 独立接口
 *   - E5 删文件用 file_type(image/attachment)+file_urls（与月结同、与银行账户分接口不同）
 *   - status: 0=删除中间态 1=正常 2=作废；E3 作废/恢复 toggle
 */
import { get, post, toMultipart } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 账户状态枚举标准值（后端存英文，select value 用英文、label 用中文） */
export type AccountStatus = 'NORMAL' | 'DISABLED' | 'CLOSED'

/** 银行账户图片/附件文件引用（详情接口5返回） */
export interface BankAccountFile {
  file_ref_id: string
  file_id: string
  file_name: string
  file_url: string
  file_size?: number          // 仅附件有
  sort_no: number
}

/** 银行账户列表项（接口4/6 返回，无图片/附件） */
export interface BankAccountListItem {
  bank_account_id: string
  account_name: string
  account_no: string
  bank_name: string
  opening_balance: string     // 期初金额，4位小数
  account_status: AccountStatus
  account_status_name?: string
  open_date?: string | null
  close_date?: string | null
  remark?: string | null
  created_at?: string
  created_by?: string
  created_by_name?: string
}

/** 银行账户完整详情（接口5 返回裸对象，含 images/attachments） */
export interface BankAccountDetail extends BankAccountListItem {
  images?: BankAccountFile[]
  attachments?: BankAccountFile[]
}

/** 列表/搜索响应（key 为 items） */
export interface BankAccountListResponse {
  total: number
  page?: number
  page_size?: number
  items: BankAccountListItem[]
}

/** 银行账户查询参数（接口4） */
export interface BankAccountQueryParams {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}

/** 银行账户搜索参数（接口6） */
export interface BankAccountSearchParams {
  search_field: string
  search_value: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}

/** 新增/更新入参（字段对应接口1/2，提交时组装为 multipart） */
export interface BankAccountPayload {
  account_name?: string
  account_no?: string
  bank_name?: string
  opening_balance?: string | number
  account_status?: AccountStatus | string
  open_date?: string
  close_date?: string
  remark?: string
}

// --- 接口1：新增银行账户（multipart/form-data，可同步上传图片和附件） ---
export function createBankAccount(
  data: BankAccountPayload,
  files?: { images?: File[]; attachments?: File[] }
): Promise<ApiResponse<BankAccountDetail>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<BankAccountDetail>('/api/v1/tenant-finance/bank-accounts/create', fd)
}

// --- 接口2：更新银行账户（multipart/form-data，仅传字段覆盖原值，图片附件仅追加） ---
export function updateBankAccount(
  bankAccountId: string,
  data: BankAccountPayload,
  files?: { images?: File[]; attachments?: File[] }
): Promise<ApiResponse<BankAccountDetail>> {
  const fd = toMultipart({ ...data, bank_account_id: bankAccountId } as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<BankAccountDetail>('/api/v1/tenant-finance/bank-accounts/update', fd)
}

// --- 接口3：删除银行账户（软删除，不删关联文件） ---
export function deleteBankAccount(bankAccountId: string): Promise<ApiResponse<null>> {
  return post<null>('/api/v1/tenant-finance/bank-accounts/delete', toMultipart({ bank_account_id: bankAccountId }))
}

// --- 接口4：银行账户列表查询（GET） ---
export function getBankAccountList(params: BankAccountQueryParams): Promise<ApiResponse<BankAccountListResponse>> {
  return get<BankAccountListResponse>('/api/v1/tenant-finance/bank-accounts/list', params as unknown as Record<string, unknown>)
}

// --- 接口5：银行账户详情查询（GET，返回裸对象含 images/attachments） ---
export function getBankAccountDetail(bankAccountId: string): Promise<ApiResponse<BankAccountDetail>> {
  return get<BankAccountDetail>('/api/v1/tenant-finance/bank-accounts/detail', { bank_account_id: bankAccountId })
}

// --- 接口6：银行账户搜索（GET，search_field/search_value 为 JSON 字符串） ---
export function searchBankAccounts(params: BankAccountSearchParams): Promise<ApiResponse<BankAccountListResponse>> {
  return get<BankAccountListResponse>('/api/v1/tenant-finance/bank-accounts/search', params as unknown as Record<string, unknown>)
}

// --- 接口7：删除银行账户图片（参数 file_urls 为 JSON 数组字符串，返回 deleted_count） ---
export function deleteBankAccountImages(
  bankAccountId: string,
  fileUrls: string[]
): Promise<ApiResponse<{ deleted_count: number }>> {
  const payload = { bank_account_id: bankAccountId, file_urls: JSON.stringify(fileUrls) }
  return post<{ deleted_count: number }>('/api/v1/tenant-finance/bank-accounts/images/delete', toMultipart(payload))
}

// --- 接口8：删除银行账户附件（参数 file_urls 为 JSON 数组字符串，返回 deleted_count） ---
export function deleteBankAccountAttachments(
  bankAccountId: string,
  fileUrls: string[]
): Promise<ApiResponse<{ deleted_count: number }>> {
  const payload = { bank_account_id: bankAccountId, file_urls: JSON.stringify(fileUrls) }
  return post<{ deleted_count: number }>('/api/v1/tenant-finance/bank-accounts/attachments/delete', toMultipart(payload))
}

// ==================== 科目管理（接口A4/A6/A7，仅作下拉数据源） ====================
// 说明：科目完整页（A1-A8）暂不接入，此处仅封装列表/详情/搜索，供预付款单等表单的科目下拉使用。
//   A4 文档无返回示例，按树形结构推断；联调若为平表再改。

/** 科目节点（A4 树形列表返回，按嵌套 children 推断） */
export interface AccountSubjectNode {
  subject_id: string
  name: string
  parent_id?: string
  remark?: string | null
  status?: number
  children?: AccountSubjectNode[]
}

/** 科目详情（A6，按推断） */
export interface AccountSubjectDetail {
  subject_id: string
  name: string
  parent_id?: string | null
  remark?: string | null
  status?: number
}

/** 科目列表响应（A4，按推断返回树形数组） */
export type AccountSubjectListResponse = AccountSubjectNode[]

// --- 接口A4：科目树形列表（GET，按推断返回树形数组） ---
export function getAccountSubjectTree(params?: {
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<AccountSubjectListResponse>> {
  return get<AccountSubjectListResponse>('/api/v1/tenant-finance/account-subjects/query', params as unknown as Record<string, unknown>)
}

// --- 接口A6：科目详情（GET） ---
export function getAccountSubjectDetail(subjectId: string): Promise<ApiResponse<AccountSubjectDetail>> {
  return get<AccountSubjectDetail>('/api/v1/tenant-finance/account-subjects/detail', { subject_id: subjectId })
}

// --- 接口A7：科目搜索（GET，search_field/search_value 为 JSON 字符串） ---
export function searchAccountSubjects(params: {
  search_field: string
  search_value: string
  page?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<{ total: number; items: AccountSubjectDetail[] }>> {
  return get<{ total: number; items: AccountSubjectDetail[] }>('/api/v1/tenant-finance/account-subjects/search', params as unknown as Record<string, unknown>)
}

// ==================== 预付款单（模块E：E1-E11） ====================

/** 付款方式枚举（中英文均可，前端统一传中文由后端映射） */
export type PrepaymentMethod = '现金' | '银行转账'

/** 预付款单状态：0=删除中间态 1=正常 2=已作废 */
export type PrepaymentStatus = 0 | 1 | 2

/** 预付款明细行（E1 items / E7 详情 items） */
export interface PrepaymentLineItem {
  prepayment_item_id?: string
  prepayment_order_id?: string
  supplier_id: string
  supplier_name?: string
  supplier_bank_account?: string
  supplier_bank_name?: string
  actual_amount: string | number      // 实付金额，>0
  prepayment_amount: string | number // 预付金额，>0
  gift_amount: string | number        // 赠送金额，>=0
  remark?: string | null
}

/** 预付款单列表项（E6 返回，主表基本信息，不含明细） */
export interface PrepaymentOrderListItem {
  prepayment_order_id: string
  prepayment_no: string
  subject_id: string
  subject_name?: string
  payment_date: string
  payment_method: PrepaymentMethod | string
  bank_account_id?: string | null
  bank_account_name?: string | null
  total_actual_amount: string         // 实付合计（后端自动算）
  total_prepayment_amount: string     // 预付合计
  total_gift_amount: string           // 赠送合计
  status: PrepaymentStatus
  remark?: string | null
  created_at?: string
  created_by?: string
  created_by_name?: string
}

/** 预付款单完整详情（E7 返回裸对象，主表全部字段 + items + 图片/附件） */
export interface PrepaymentOrderDetail extends PrepaymentOrderListItem {
  items: PrepaymentLineItem[]
  images?: BankAccountFile[]          // 复用银行账户文件引用结构（file_ref_id/file_id/file_name/file_url/sort_no）
  attachments?: BankAccountFile[]
}

/** 预付款单列表响应（E6/E8，key 文档未给示例，按 prepayment_orders 推断，联调校准） */
export interface PrepaymentOrderListResponse {
  total: number
  page?: number
  page_size?: number
  prepayment_orders: PrepaymentOrderListItem[]
}

/** 预付款单查询参数（E6） */
export interface PrepaymentOrderQueryParams {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
  start_date?: string
  end_date?: string
}

/** 预付款单搜索参数（E8） */
export interface PrepaymentOrderSearchParams {
  search_field: string
  search_value: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}

/** 预付款单主表入参（E1/E2 通用字段） */
export interface PrepaymentOrderPayload {
  subject_id?: string
  payment_date?: string
  payment_method?: PrepaymentMethod | string
  bank_account_id?: string
  remark?: string
}

// --- 接口E1：创建预付款单（multipart/form-data，items 为 JSON 字符串） ---
export function createPrepaymentOrder(
  data: PrepaymentOrderPayload,
  items: PrepaymentLineItem[],
  files?: { images?: File[]; attachments?: File[] }
): Promise<ApiResponse<PrepaymentOrderDetail>> {
  const fd = toMultipart({ ...data, items: JSON.stringify(items) } as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<PrepaymentOrderDetail>('/api/v1/tenant-finance/prepayment-orders/create', fd)
}

// --- 接口E2：更新预付款单主表（multipart/form-data，仅主表字段，明细走独立接口） ---
export function updatePrepaymentOrder(
  prepaymentOrderId: string,
  data: PrepaymentOrderPayload,
  files?: { images?: File[]; attachments?: File[] }
): Promise<ApiResponse<PrepaymentOrderDetail>> {
  const fd = toMultipart({ ...data, prepayment_order_id: prepaymentOrderId } as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<PrepaymentOrderDetail>('/api/v1/tenant-finance/prepayment-orders/update', fd)
}

// --- 接口E3：作废/恢复预付款单（toggle，status 1↔2） ---
export function voidPrepaymentOrder(prepaymentOrderId: string): Promise<ApiResponse<{ prepayment_order_id: string; status: number }>> {
  return post<{ prepayment_order_id: string; status: number }>('/api/v1/tenant-finance/prepayment-orders/void', toMultipart({ prepayment_order_id: prepaymentOrderId }))
}

// --- 接口E4：删除预付款单（软删，status 和 deleted_flag 同时变更） ---
export function deletePrepaymentOrder(prepaymentOrderId: string): Promise<ApiResponse<{ prepayment_order_id: string }>> {
  return post<{ prepayment_order_id: string }>('/api/v1/tenant-finance/prepayment-orders/delete', toMultipart({ prepayment_order_id: prepaymentOrderId }))
}

// --- 接口E5：删除预付款单文件（file_type=image/attachment，file_urls 为 JSON 字符串） ---
export function deletePrepaymentOrderFiles(
  prepaymentOrderId: string,
  fileType: 'image' | 'attachment',
  fileUrls: string[]
): Promise<ApiResponse<{ deleted_count: number }>> {
  const payload = { prepayment_order_id: prepaymentOrderId, file_type: fileType, file_urls: JSON.stringify(fileUrls) }
  return post<{ deleted_count: number }>('/api/v1/tenant-finance/prepayment-orders/files/delete', toMultipart(payload))
}

// --- 接口E6：预付款单列表（GET） ---
export function getPrepaymentOrderList(params: PrepaymentOrderQueryParams): Promise<ApiResponse<PrepaymentOrderListResponse>> {
  return get<PrepaymentOrderListResponse>('/api/v1/tenant-finance/prepayment-orders/list', params as unknown as Record<string, unknown>)
}

// --- 接口E7：预付款单详情（GET，返回裸对象含 items + 图片/附件） ---
export function getPrepaymentOrderDetail(prepaymentOrderId: string): Promise<ApiResponse<PrepaymentOrderDetail>> {
  return get<PrepaymentOrderDetail>('/api/v1/tenant-finance/prepayment-orders/detail', { prepayment_order_id: prepaymentOrderId })
}

// --- 接口E8：搜索预付款单（GET，search_field/search_value 为 JSON 字符串） ---
export function searchPrepaymentOrders(params: PrepaymentOrderSearchParams): Promise<ApiResponse<PrepaymentOrderListResponse>> {
  return get<PrepaymentOrderListResponse>('/api/v1/tenant-finance/prepayment-orders/search', params as unknown as Record<string, unknown>)
}

// --- 接口E9：新增预付款明细（multipart/form-data，items 为 JSON 字符串） ---
export function addPrepaymentOrderItems(
  prepaymentOrderId: string,
  items: PrepaymentLineItem[]
): Promise<ApiResponse<{ prepayment_order_id: string; prepayment_item_ids: string[] }>> {
  const payload = { prepayment_order_id: prepaymentOrderId, items: JSON.stringify(items) }
  return post<{ prepayment_order_id: string; prepayment_item_ids: string[] }>('/api/v1/tenant-finance/prepayment-orders/items/add', toMultipart(payload))
}

// --- 接口E10：更新预付款明细（multipart/form-data） ---
export function updatePrepaymentOrderItem(
  prepaymentItemId: string,
  data: Partial<Omit<PrepaymentLineItem, 'prepayment_item_id' | 'prepayment_order_id' | 'supplier_name'>>
): Promise<ApiResponse<{ prepayment_item_id: string }>> {
  const fd = toMultipart({ ...data, prepayment_item_id: prepaymentItemId } as unknown as Record<string, unknown>)
  return post<{ prepayment_item_id: string }>('/api/v1/tenant-finance/prepayment-orders/items/update', fd)
}

// --- 接口E11：删除预付款明细（至少保留1条有效明细） ---
export function deletePrepaymentOrderItem(prepaymentItemId: string): Promise<ApiResponse<{ prepayment_item_id: string }>> {
  return post<{ prepayment_item_id: string }>('/api/v1/tenant-finance/prepayment-orders/items/delete', toMultipart({ prepayment_item_id: prepaymentItemId }))
}
