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
  account_status_display?: string
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

// ==================== 科目管理（A1-A8 完整接口） ====================

/** 科目节点（A4/A7 树形列表，含嵌套 children） */
export interface AccountSubjectNode {
  id?: number
  subject_id: string
  company_id?: string
  name: string
  parent_id?: string | null
  remark?: string | null
  status: number             // 1=启用 0=停用
  deleted_flag?: number
  created_by?: string
  created_by_name?: string
  updated_by?: string
  updated_by_name?: string
  created_at?: string
  updated_at?: string
  children?: AccountSubjectNode[]
}

/** 科目详情（A6，含 parent_name） */
export interface AccountSubjectDetail extends AccountSubjectNode {
  parent_name?: string
}

/** 科目列表响应（A4/A7 分页，分页作用于顶层节点） */
export interface AccountSubjectListResponse {
  total: number
  page?: number
  page_size?: number
  items: AccountSubjectNode[]
}

/** A8 删除影响预览响应 */
export interface AccountSubjectDeletePreview {
  target: { subject_id: string; name: string; type: string }
  cascade_items: AccountSubjectNode[]
  cascade_count: number
  summary: string
}

// --- 接口A1：创建科目 ---
export function createAccountSubject(data: {
  name: string
  parent_id?: string
  remark?: string
}): Promise<ApiResponse<AccountSubjectDetail>> {
  return post<AccountSubjectDetail>('/api/v1/tenant-finance/account-subjects/create', toMultipart(data as Record<string, unknown>))
}

// --- 接口A2：更新科目 ---
export function updateAccountSubject(
  subjectId: string,
  data: { name?: string; parent_id?: string; remark?: string; status?: number }
): Promise<ApiResponse<AccountSubjectDetail>> {
  return post<AccountSubjectDetail>('/api/v1/tenant-finance/account-subjects/update', toMultipart({ ...data, subject_id: subjectId } as Record<string, unknown>))
}

// --- 接口A3：删除科目（有子科目或被引用时禁止删除，返回 cascade_count） ---
export function deleteAccountSubject(subjectId: string): Promise<ApiResponse<{ subject_id: string; cascade_count: number }>> {
  return post<{ subject_id: string; cascade_count: number }>('/api/v1/tenant-finance/account-subjects/delete', toMultipart({ subject_id: subjectId }))
}

// --- 接口A4：科目树形列表（GET，分页作用于顶层节点） ---
export function getAccountSubjectTree(params?: {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<AccountSubjectListResponse>> {
  return get<AccountSubjectListResponse>('/api/v1/tenant-finance/account-subjects/query', params as unknown as Record<string, unknown>)
}

// --- 接口A5：科目下级树（GET，返回指定节点的直接子节点含递归 children） ---
export function getAccountSubjectChildren(parentId: string): Promise<ApiResponse<{ subject_id: string; children: AccountSubjectNode[] }>> {
  return get<{ subject_id: string; children: AccountSubjectNode[] }>('/api/v1/tenant-finance/account-subjects/association/query', { parent_id: parentId })
}

// --- 接口A6：科目详情（GET） ---
export function getAccountSubjectDetail(subjectId: string): Promise<ApiResponse<AccountSubjectDetail>> {
  return get<AccountSubjectDetail>('/api/v1/tenant-finance/account-subjects/detail', { subject_id: subjectId })
}

// --- 接口A7：科目搜索（GET，search_field/search_value 为 JSON 字符串，返回剪枝树） ---
export function searchAccountSubjects(params: {
  search_field: string
  search_value: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}): Promise<ApiResponse<AccountSubjectListResponse>> {
  return get<AccountSubjectListResponse>('/api/v1/tenant-finance/account-subjects/search', params as unknown as Record<string, unknown>)
}

// --- 接口A8：删除影响预览（GET，删除前调用确认级联数量） ---
export function getAccountSubjectDeletePreview(subjectId: string): Promise<ApiResponse<AccountSubjectDeletePreview>> {
  return get<AccountSubjectDeletePreview>('/api/v1/tenant-finance/account-subjects/delete/preview', { subject_id: subjectId })
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
  items: PrepaymentOrderListItem[]
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

// ==================== 付款单（模块C：C1-C8） ====================

/** 付款单列表项（C4/C6 返回，字段对照 serialize_payment_order） */
export interface PaymentOrderListItem {
  id: number
  payment_order_id: string
  payment_no: string
  company_id: string
  subject_id: string | null
  subject_name: string | null
  payment_date: string | null
  payment_method: string
  payment_method_display: string
  bank_account_id: string | null
  bank_account_name: string | null
  actual_payment_amount: string
  purchase_order_id: string
  order_no: string
  supplier_id: string
  supplier_name: string
  order_amount: string
  order_date: string | null
  remark: string | null
  status: number
  deleted_flag: number
  created_by: string | null
  created_by_name: string | null
  updated_by: string | null
  updated_by_name: string | null
  created_at: string | null
  updated_at: string | null
  paid_amount: string | null
}

/** 付款单完整详情（C5 返回裸对象，含图片/附件） */
export interface PaymentOrderDetail extends PaymentOrderListItem {
  images?: BankAccountFile[]
  attachments?: BankAccountFile[]
}

/** 付款单列表响应（C4/C6，key 为 items） */
export interface PaymentOrderListResponse {
  total: number
  page?: number
  page_size?: number
  items: PaymentOrderListItem[]
}

/** 付款单查询参数（C4） */
export interface PaymentOrderQueryParams {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
  start_date?: string
  end_date?: string
  supplier_id?: string
}

/** 付款单搜索参数（C6） */
export interface PaymentOrderSearchParams {
  search_field: string
  search_value: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}

/** 付款单创建入参（C1） */
export interface PaymentOrderCreatePayload {
  supplier_id: string
  subject_id?: string
  payment_date: string
  payment_method: string
  purchase_order_id: string
  actual_payment_amount: string
  bank_account_id?: string
  remark?: string
}

/** 付款单更新入参（C2） */
export interface PaymentOrderUpdatePayload {
  payment_order_id: string
  subject_id?: string
  payment_date?: string
  payment_method?: string
  purchase_order_id?: string
  bank_account_id?: string
  actual_payment_amount?: string
  remark?: string
}

// --- 接口C1：创建付款单（multipart/form-data，items 为关联采购订单 JSON 数组） ---
export function createPaymentOrder(
  data: PaymentOrderCreatePayload,
  files?: { images?: File[]; attachments?: File[] }
): Promise<ApiResponse<PaymentOrderDetail>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<PaymentOrderDetail>('/api/v1/tenant-finance/payment-orders/create', fd)
}

// --- 接口C2：更新付款单（multipart/form-data） ---
export function updatePaymentOrder(
  data: PaymentOrderUpdatePayload,
  files?: { images?: File[]; attachments?: File[] }
): Promise<ApiResponse<PaymentOrderDetail>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<PaymentOrderDetail>('/api/v1/tenant-finance/payment-orders/update', fd)
}

// --- 接口C3：删除付款单 ---
export function deletePaymentOrder(paymentOrderId: string): Promise<ApiResponse<null>> {
  return post<null>('/api/v1/tenant-finance/payment-orders/delete', toMultipart({ payment_order_id: paymentOrderId }))
}

// --- 接口C4：付款单列表（GET） ---
export function getPaymentOrderList(params: PaymentOrderQueryParams): Promise<ApiResponse<PaymentOrderListResponse>> {
  return get<PaymentOrderListResponse>('/api/v1/tenant-finance/payment-orders/list', params as unknown as Record<string, unknown>)
}

// --- 接口C5：付款单详情（GET） ---
export function getPaymentOrderDetail(paymentOrderId: string): Promise<ApiResponse<PaymentOrderDetail>> {
  return get<PaymentOrderDetail>('/api/v1/tenant-finance/payment-orders/detail', { payment_order_id: paymentOrderId })
}

// --- 接口C6：搜索付款单（GET） ---
export function searchPaymentOrders(params: PaymentOrderSearchParams): Promise<ApiResponse<PaymentOrderListResponse>> {
  return get<PaymentOrderListResponse>('/api/v1/tenant-finance/payment-orders/search', params as unknown as Record<string, unknown>)
}

// --- 接口C7：作废付款单（不可恢复） ---
export function voidPaymentOrder(paymentOrderId: string): Promise<ApiResponse<{ payment_order_id: string; status: number }>> {
  return post<{ payment_order_id: string; status: number }>('/api/v1/tenant-finance/payment-orders/void', toMultipart({ payment_order_id: paymentOrderId }))
}

// --- 接口C8：删除付款单文件 ---
export function deletePaymentOrderFiles(
  paymentOrderId: string,
  fileType: 'image' | 'attachment',
  fileUrls: string[]
): Promise<ApiResponse<{ deleted_count: number }>> {
  const payload = { payment_order_id: paymentOrderId, file_type: fileType, file_urls: JSON.stringify(fileUrls) }
  return post<{ deleted_count: number }>('/api/v1/tenant-finance/payment-orders/files/delete', toMultipart(payload))
}

// ==================== 月结付款单（模块D：D1-D14） ====================

/** 月结付款单列表项（D4/D6 返回，字段对照 serialize_monthly_payment_order） */
export interface MonthlyPaymentOrderListItem {
  id: number
  monthly_payment_id: string
  payment_no: string
  company_id: string
  supplier_id: string
  supplier_name: string
  subject_id: string | null
  subject_name: string | null
  payment_date: string | null
  payment_method: string
  payment_method_display: string
  bank_account_id: string | null
  bank_account_name: string | null
  total_payment_amount: string
  total_order_amount: string
  remark: string | null
  status: number
  deleted_flag: number
  created_by: string | null
  created_by_name: string | null
  updated_by: string | null
  updated_by_name: string | null
  created_at: string | null
  updated_at: string | null
}

/** 月结付款单完整详情（D5 返回裸对象，含 items/return_items/图片/附件） */
export interface MonthlyPaymentOrderDetail extends MonthlyPaymentOrderListItem {
  items?: MonthlyPaymentItem[]
  return_items?: MonthlyPaymentReturnItem[]
  images?: BankAccountFile[]
  attachments?: BankAccountFile[]
}

/** 月结付款明细行 */
export interface MonthlyPaymentItem {
  monthly_payment_item_id: string
  monthly_payment_id: string
  purchase_order_id: string
  order_no: string
  order_amount: string
  payment_amount: string
  paid_amount?: string | null
  remark?: string | null
}

/** 月结退货明细行 */
export interface MonthlyPaymentReturnItem {
  monthly_return_id: string
  monthly_payment_id: string
  purchase_return_id: string
  return_no: string
  return_amount: string
  actual_credit_adjust_amount: string
  remark?: string | null
}

/** 月结付款单列表响应（D4/D6，key 为 items） */
export interface MonthlyPaymentOrderListResponse {
  total: number
  page?: number
  page_size?: number
  items: MonthlyPaymentOrderListItem[]
}

/** 月结付款单查询参数（D4） */
export interface MonthlyPaymentOrderQueryParams {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
  start_date?: string
  end_date?: string
  supplier_id?: string
}

/** 月结付款单搜索参数（D6） */
export interface MonthlyPaymentOrderSearchParams {
  search_field: string
  search_value: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}

/** 月结付款单创建入参（D1） */
export interface MonthlyPaymentOrderCreatePayload {
  supplier_id: string
  subject_id: string
  payment_date: string
  payment_method: string
  items?: string
  return_items?: string
  bank_account_id?: string
  remark?: string
}

/** 月结付款单更新入参（D2，仅主表字段） */
export interface MonthlyPaymentOrderUpdatePayload {
  monthly_payment_id: string
  subject_id?: string
  payment_date?: string
  payment_method?: string
  bank_account_id?: string
  remark?: string
}

// --- 接口D1：创建月结付款单 ---
export function createMonthlyPaymentOrder(
  data: MonthlyPaymentOrderCreatePayload,
  files?: { images?: File[]; attachments?: File[] }
): Promise<ApiResponse<MonthlyPaymentOrderDetail>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<MonthlyPaymentOrderDetail>('/api/v1/tenant-finance/monthly-payment-orders/create', fd)
}

// --- 接口D2：更新月结付款单主表 ---
export function updateMonthlyPaymentOrder(
  data: MonthlyPaymentOrderUpdatePayload,
  files?: { images?: File[]; attachments?: File[] }
): Promise<ApiResponse<MonthlyPaymentOrderDetail>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<MonthlyPaymentOrderDetail>('/api/v1/tenant-finance/monthly-payment-orders/update', fd)
}

// --- 接口D3：删除月结付款单 ---
export function deleteMonthlyPaymentOrder(monthlyPaymentId: string): Promise<ApiResponse<null>> {
  return post<null>('/api/v1/tenant-finance/monthly-payment-orders/delete', toMultipart({ monthly_payment_id: monthlyPaymentId }))
}

// --- 接口D4：月结付款单列表（GET） ---
export function getMonthlyPaymentOrderList(params: MonthlyPaymentOrderQueryParams): Promise<ApiResponse<MonthlyPaymentOrderListResponse>> {
  return get<MonthlyPaymentOrderListResponse>('/api/v1/tenant-finance/monthly-payment-orders/list', params as unknown as Record<string, unknown>)
}

// --- 接口D5：月结付款单详情（GET） ---
export function getMonthlyPaymentOrderDetail(monthlyPaymentId: string): Promise<ApiResponse<MonthlyPaymentOrderDetail>> {
  return get<MonthlyPaymentOrderDetail>('/api/v1/tenant-finance/monthly-payment-orders/detail', { monthly_payment_id: monthlyPaymentId })
}

// --- 接口D6：搜索月结付款单（GET） ---
export function searchMonthlyPaymentOrders(params: MonthlyPaymentOrderSearchParams): Promise<ApiResponse<MonthlyPaymentOrderListResponse>> {
  return get<MonthlyPaymentOrderListResponse>('/api/v1/tenant-finance/monthly-payment-orders/search', params as unknown as Record<string, unknown>)
}

// --- 接口D7：作废月结付款单（不可恢复） ---
export function voidMonthlyPaymentOrder(monthlyPaymentId: string): Promise<ApiResponse<{ monthly_payment_id: string; status: number }>> {
  return post<{ monthly_payment_id: string; status: number }>('/api/v1/tenant-finance/monthly-payment-orders/void', toMultipart({ monthly_payment_id: monthlyPaymentId }))
}

// --- 接口D8：删除月结付款单文件 ---
export function deleteMonthlyPaymentOrderFiles(
  monthlyPaymentId: string,
  fileType: 'image' | 'attachment',
  fileUrls: string[]
): Promise<ApiResponse<{ deleted_count: number }>> {
  const payload = { monthly_payment_id: monthlyPaymentId, file_type: fileType, file_urls: JSON.stringify(fileUrls) }
  return post<{ deleted_count: number }>('/api/v1/tenant-finance/monthly-payment-orders/files/delete', toMultipart(payload))
}

// --- 接口D9：新增付款明细 ---
export function addMonthlyPaymentItems(
  monthlyPaymentId: string,
  items: Array<{ purchase_order_id: string; payment_amount: string; remark?: string }>
): Promise<ApiResponse<{ monthly_payment_id: string }>> {
  const payload = { monthly_payment_id: monthlyPaymentId, items: JSON.stringify(items) }
  return post<{ monthly_payment_id: string }>('/api/v1/tenant-finance/monthly-payment-orders/items/add', toMultipart(payload))
}

// --- 接口D10：更新付款明细 ---
export function updateMonthlyPaymentItem(
  monthlyPaymentItemId: string,
  data: { payment_amount?: string; purchase_order_id?: string; remark?: string }
): Promise<ApiResponse<{ monthly_payment_item_id: string }>> {
  const fd = toMultipart({ ...data, monthly_payment_item_id: monthlyPaymentItemId } as unknown as Record<string, unknown>)
  return post<{ monthly_payment_item_id: string }>('/api/v1/tenant-finance/monthly-payment-orders/items/update', fd)
}

// --- 接口D11：删除付款明细 ---
export function deleteMonthlyPaymentItem(monthlyPaymentItemId: string): Promise<ApiResponse<{ monthly_payment_item_id: string }>> {
  return post<{ monthly_payment_item_id: string }>('/api/v1/tenant-finance/monthly-payment-orders/items/delete', toMultipart({ monthly_payment_item_id: monthlyPaymentItemId }))
}

// --- 接口D12：新增退货明细 ---
export function addMonthlyPaymentReturnItems(
  monthlyPaymentId: string,
  returnItems: Array<{ purchase_return_id: string; remark?: string }>
): Promise<ApiResponse<{ monthly_payment_id: string }>> {
  const payload = { monthly_payment_id: monthlyPaymentId, return_items: JSON.stringify(returnItems) }
  return post<{ monthly_payment_id: string }>('/api/v1/tenant-finance/monthly-payment-orders/return-items/add', toMultipart(payload))
}

// --- 接口D13：更新退货明细 ---
export function updateMonthlyPaymentReturnItem(
  monthlyReturnId: string,
  data: { purchase_return_id?: string; remark?: string }
): Promise<ApiResponse<{ monthly_return_id: string }>> {
  const fd = toMultipart({ ...data, monthly_return_id: monthlyReturnId } as unknown as Record<string, unknown>)
  return post<{ monthly_return_id: string }>('/api/v1/tenant-finance/monthly-payment-orders/return-items/update', fd)
}

// --- 接口D14：删除退货明细 ---
export function deleteMonthlyPaymentReturnItem(monthlyReturnId: string): Promise<ApiResponse<{ monthly_return_id: string }>> {
  return post<{ monthly_return_id: string }>('/api/v1/tenant-finance/monthly-payment-orders/return-items/delete', toMultipart({ monthly_return_id: monthlyReturnId }))
}

// ======================= 模块F：其他收款单 =======================

export type OtherReceiptType = 'CUSTOMER_RECEIPT' | 'SUPPLIER_RECEIPT' | 'PURCHASE_REFUND'
export type CollectionMethod = 'CASH' | 'TRANSFER'

export interface OtherReceiptFile {
  file_ref_id: string
  file_id: string
  file_name: string
  file_url: string
  file_size: number
  sort_no: number
}

export interface OtherReceiptListItem {
  other_receipt_id: string
  receipt_no: string
  subject_id: string
  subject_name: string
  receipt_date: string | null
  bank_account_id: string
  bank_account_name: string
  collection_method: CollectionMethod
  collection_method_name: string
  receipt_type: OtherReceiptType
  receipt_type_name: string
  customer_id: string | null
  customer_name: string | null
  supplier_id: string | null
  supplier_name: string | null
  purchase_return_id: string | null
  purchase_return_no: string | null
  actual_receipt_amount: string
  actual_refund_prepayment: string
  actual_refund_gift_amount: string
  actual_credit_adjust_amount: string
  remark: string | null
  status: number
  deleted_flag: number
  created_by: string | null
  created_by_name: string | null
  created_at: string | null
  updated_at: string | null
  images: OtherReceiptFile[]
  attachments: OtherReceiptFile[]
}

export interface OtherReceiptListResponse {
  total: number
  page: number
  page_size: number
  items: OtherReceiptListItem[]
}

export interface OtherReceiptQueryParams {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
  receipt_type?: string
  collection_method?: string
  start_date?: string
  end_date?: string
}

export interface OtherReceiptSearchParams {
  search_field: string
  search_value: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}

export interface OtherReceiptCreatePayload {
  subject_id: string
  receipt_date: string
  collection_method: string
  receipt_type: string
  actual_receipt_amount: string
  bank_account_id?: string
  customer_id?: string
  supplier_id?: string
  purchase_return_id?: string
  actual_refund_prepayment?: string
  actual_refund_gift_amount?: string
  remark?: string
}

export interface OtherReceiptUpdatePayload {
  other_receipt_id: string
  subject_id?: string
  receipt_date?: string
  collection_method?: string
  actual_receipt_amount?: string
  bank_account_id?: string
  actual_refund_prepayment?: string
  actual_refund_gift_amount?: string
  remark?: string
}

// --- 接口F1：创建其他收款单 ---
export function createOtherReceipt(
  data: OtherReceiptCreatePayload,
  files?: Record<string, File[]>
): Promise<ApiResponse<OtherReceiptListItem>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<OtherReceiptListItem>('/api/v1/tenant-finance/other-receipts/create', fd)
}

// --- 接口F2：更新其他收款单 ---
export function updateOtherReceipt(
  data: OtherReceiptUpdatePayload,
  files?: Record<string, File[]>
): Promise<ApiResponse<OtherReceiptListItem>> {
  const fd = toMultipart(data as unknown as Record<string, unknown>)
  if (files?.images) files.images.forEach(f => fd.append('images', f))
  if (files?.attachments) files.attachments.forEach(f => fd.append('attachments', f))
  return post<OtherReceiptListItem>('/api/v1/tenant-finance/other-receipts/update', fd)
}

// --- 接口F3：删除其他收款单 ---
export function deleteOtherReceipt(id: string): Promise<ApiResponse<{ other_receipt_id: string }>> {
  return post<{ other_receipt_id: string }>('/api/v1/tenant-finance/other-receipts/delete', toMultipart({ other_receipt_id: id }))
}

// --- 接口F4：作废其他收款单 ---
export function voidOtherReceipt(id: string): Promise<ApiResponse<{ other_receipt_id: string; status: number }>> {
  return post<{ other_receipt_id: string; status: number }>('/api/v1/tenant-finance/other-receipts/void', toMultipart({ other_receipt_id: id }))
}

// --- 接口F5：其他收款单列表 ---
export function getOtherReceiptList(params: OtherReceiptQueryParams = {}): Promise<ApiResponse<OtherReceiptListResponse>> {
  return get<OtherReceiptListResponse>('/api/v1/tenant-finance/other-receipts/list', params as unknown as Record<string, unknown>)
}

// --- 接口F6：其他收款单详情 ---
export function getOtherReceiptDetail(id: string): Promise<ApiResponse<OtherReceiptListItem>> {
  return get<OtherReceiptListItem>('/api/v1/tenant-finance/other-receipts/detail', { other_receipt_id: id })
}

// --- 接口F7：搜索其他收款单 ---
export function searchOtherReceipts(params: OtherReceiptSearchParams): Promise<ApiResponse<OtherReceiptListResponse>> {
  return get<OtherReceiptListResponse>('/api/v1/tenant-finance/other-receipts/search', params as unknown as Record<string, unknown>)
}

// --- 接口F8：删除其他收款单文件 ---
export function deleteOtherReceiptFiles(id: string, fileType: 'image' | 'attachment', fileUrls: string[]): Promise<ApiResponse<OtherReceiptListItem>> {
  return post<OtherReceiptListItem>('/api/v1/tenant-finance/other-receipts/files/delete', toMultipart({
    other_receipt_id: id,
    file_type: fileType,
    file_urls: JSON.stringify(fileUrls)
  }))
}
