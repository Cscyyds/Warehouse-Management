import {
  getOrgTree, getOrgTypeOptions,
  createPersonnel, updatePersonnel,
  createUser, updateManagedUser, getUserDetail, getUserTypeOptions,
  type UserCreatePayload, type ManagedUserUpdatePayload,
  getPositionList, getPostDetail, createPost, updatePost, getPostCategoryOptions,
  getOrgDetail, createOrg, updateOrg,
  getRoleDetail, createRole, updateRole, getRoleAll, getVisiblePermissions, type RoleCreatePayload, type RoleUpdatePayload,
  searchAdmins, getAdminDetail, createAdmin, updateAdmin,
  getParamDetail, createParam, updateParam,
  getDictDetail, createDict, updateDict,
  getAreaDetail, createArea, updateArea, getAreaList, type AreaCreatePayload, type AreaUpdatePayload,
  getDictDataDetail, createDictData, updateDictData,
  getCustomerTypeDetail, createCustomerType, updateCustomerType,
  getCustomerRegionDetail, createCustomerRegion, updateCustomerRegion, getCustomerRegionList,
  getCustomerDetail, createCustomer, updateCustomer, getCustomerTypeList,
  getCustomerLeadDetail, createCustomerLead, updateCustomerLead,
  getVisitTaskDetail, createVisitTask, updateVisitTask,
  addGiftLog,
  getLogisticsCompanyList, getLogisticsCompanyDetail, createLogisticsCompany, updateLogisticsCompany,
  getProductCategoryDetail, createProductCategory, updateProductCategory,
  getProductCategoryTree,
  getProductUnitDetail, createProductUnit, updateProductUnit, getProductUnitList,
  getProductDetail, createProduct, updateProduct, addProductSupplier, deleteProductSupplier,
  bindProductSalePrices, updateProductSalePrices, deleteProductSalePrice,
  deleteProductImages, deleteProductAttachments,
  getWarehouseTree, getWarehouseDetail, createWarehouse, updateWarehouse,
  getLocationDetail, createLocation, updateLocation,
  getShelfDetail, createShelf, updateShelf,
  getPlasticBoxDetail, createPlasticBox, updatePlasticBox,
  getStagingSpotDetail, createStagingSpot, updateStagingSpot,
  getBarcodeDetail, createBarcode, updateBarcode,
  getSalesOrderDetailV2, createSalesOrderV2, updateSalesOrderV2, addSalesOrderItems, updateSalesOrderItems,
  getSupplierTypeDetail, createSupplierType, updateSupplierType, getSupplierTypeList,  getSupplierDetail, createSupplier, updateSupplier, deleteSupplierImages, deleteSupplierAttachments,
  getPurchaseOrderDetail, createPurchaseOrder, updatePurchaseOrder, addPurchaseOrderItems, updatePurchaseOrderItems, deletePurchaseOrderImages, deletePurchaseOrderAttachments,
  getPurchaseInboundDetail, createPurchaseInbound, updatePurchaseInbound, addPurchaseInboundItems, updatePurchaseInboundItems, deletePurchaseInboundImages, deletePurchaseInboundAttachments,
  getPurchaseReturnDetail, createPurchaseReturn, updatePurchaseReturn, addPurchaseReturnItems, updatePurchaseReturnItems, deletePurchaseReturnImages, deletePurchaseReturnAttachments,
  getBankAccountDetail, createBankAccount, updateBankAccount, deleteBankAccountImages, deleteBankAccountAttachments, getBankAccountList,
  getAccountSubjectTree,
  getPrepaymentOrderDetail, createPrepaymentOrder, updatePrepaymentOrder, deletePrepaymentOrderFiles,
  getPaymentOrderDetail, createPaymentOrder, updatePaymentOrder, deletePaymentOrderFiles,
  getMonthlyPaymentOrderDetail, createMonthlyPaymentOrder, updateMonthlyPaymentOrder, deleteMonthlyPaymentOrderFiles,
  getOtherReceiptDetail, createOtherReceipt, updateOtherReceipt, deleteOtherReceiptFiles,
  getCollectionReceiptDetail, createCollectionReceipt, updateCollectionReceipt, deleteCollectionReceiptFiles,
  getMonthlyReceiptOrderDetail, createMonthlyReceiptOrder, updateMonthlyReceiptOrder, deleteMonthlyReceiptOrderFiles,
  getPrecollectionOrderDetail, createPrecollectionOrder, updatePrecollectionOrder, deletePrecollectionOrderFiles,
  getOtherPaymentDetail, createOtherPayment, updateOtherPayment, deleteOtherPaymentFiles,
  getVehicleDetail, createVehicle, updateVehicle,
  getSalesReturnDetailV2, createSalesReturnV2, updateSalesReturnV2,
} from '@/api'

import {
  getAfterSaleDetail, createAfterSale, updateAfterSale,
  getReconciliationDetail, createReconciliation, updateReconciliation,
} from '@/api/legacy'

import { loadCityTree } from '@/utils/regionCity'
import { ElMessage, ElMessageBox } from 'element-plus'
import { usePermissionStore } from '@/stores/permission'
import { expandRolePermissionIds } from '@/config/pagePermissionMap'
import { groupRolePermissionTree } from '@/config/permissionTreeGrouping'

export type FieldType = 'input' | 'textarea' | 'select' | 'radio' | 'tree-select' | 'tree' | 'date' | 'number' | 'section' | 'input-suffix' | 'dynamic-table' | 'embedded-table' | 'checkbox-group' | 'image-upload' | 'file-upload' | 'computed'

export interface FieldConfig {
  key: string
  label: string
  type: FieldType
  placeholder?: string
  required?: boolean
  rules?: Record<string, unknown>[]
  options?: { label: string; value: string | number }[]
  treeData?: unknown[]
  treeProps?: Record<string, string>
  defaultValue?: unknown
  span?: number
  rows?: number
  suffixIcon?: string
  disabled?: boolean
  disabledInEdit?: boolean
  /** 编辑模式下完全隐藏该字段（仅新增时显示） */
  hiddenInEdit?: boolean
  onSuffixClick?: string
  columns?: { key: string; label: string; width?: number; type?: string; options?: { label: string; value: string | number }[]; treeData?: unknown[]; treeProps?: Record<string, string>; loadOptions?: () => Promise<{ label: string; value: string | number }[]>; dialogType?: string; labelKey?: string; fillFields?: Record<string, string>; computed?: boolean; disabled?: boolean; compute?: (row: Record<string, any>) => number | string; onInput?: (row: Record<string, any>, ctx: any) => void; onChange?: (row: Record<string, any>, ctx: any) => void; /** 必填列：表头渲染红星（仅展示标记，行级校验在各场景 submitCreate/Update 中实现） */ required?: boolean }[]
  tableData?: unknown[]
  addLabel?: string
  /** 点击新增按钮时直接打开弹窗选择，选完后自动加行 */
  addViaDialog?: boolean
  /** addViaDialog 为 true 时打开的弹窗类型 */
  addDialogType?: 'product' | 'pending-receipt' | 'pending-return' | 'unpaid-order' | 'sales-order' | 'sales-return-item'
  checkStrictly?: boolean
  clearable?: boolean
  filterable?: boolean
  /** 下拉多选（el-select multiple） */
  multiple?: boolean
  /** 允许输入并创建新选项（需配合 filterable，用于按 ID 录入） */
  allowCreate?: boolean
  visible?: (formData: Record<string, any>) => boolean
  /** dynamic-table 是否显示序号列 */
  showIndex?: boolean
  /** 弹窗选择器类型（配合 input-suffix 使用，点击打开对应选择弹窗而非树形下拉） */
  dialogType?: 'supplier' | 'customer' | 'employee' | 'purchaseOrder' | 'purchaseReturn' | 'salesOrder' | 'salesReturn'
  /** 弹窗确认后回显 label 的取值字段名（如 supplier_name）；不传则用 name */
  labelKey?: string
  /** 供应商/采购订单弹窗：只显示月结供应商或月结付款方式的订单 */
  monthlyOnly?: boolean
  loadTreeData?: (owner?: string) => Promise<unknown[]>
  /** 内联树数据源切换按钮（如角色权限树的 平台/扫码枪）：true 时树工具栏渲染切换按钮，切换时以 owner 重载 loadTreeData */
  ownerSwitch?: boolean
  loadOptions?: () => Promise<{ label: string; value: string | number }[]>
  /** 标记该字段使用「静态区划 / 高德地图」数据源切换组件（仅 tree-select 生效） */
  regionSource?: boolean
  maxImages?: number
  maxFiles?: number
  /** 删除已有远程文件时回调（仅编辑态、被删项含后端 url 时触发），用于联动调用后端删除接口 */
  onDeleteRemote?: (file: { url: string; name?: string }, editId: string) => Promise<void>
  /** computed 字段：自动计算函数，接收当前 formData，返回显示值（不随表单提交） */
  compute?: (formData: Record<string, any>) => unknown
  /** computed 字段：是否按金额格式（¥ 千分位两位小数）展示 */
  money?: boolean
  /** 选中该项后，把当前值同步写入另一个字段（如选完所在城市自动填充收货地址）。值为目标字段 key。 */
  syncTo?: string
  /** syncTo 同步时对源值做转换（如去掉「省 / 市」之间的分隔符再写入收货地址）。 */
  syncTransform?: (val: any) => any
  /**
   * 多选树（tree-select）勾选后的值补全钩子，接收已勾选 id 数组，返回补全后的数组。
   * 用于角色权限树：勾中某页面的写权限时自动带出该页面的查询权限，
   * 避免「能提交但页面不可见 / 进去列表 403」的半残配置。见 pagePermissionMap.ts。
   */
  expandCheckedIds?: (ids: string[]) => string[]
}

export interface TabConfig {
  label: string
  fields: FieldConfig[]
}

/** 页面附加操作。key 由 AddTemplate 的组件注册表解析。 */
export interface ExtraActionConfig {
  key: string
  /** header=顶部操作区；content=表单内容顶部。缺省为 header。 */
  placement?: 'header' | 'content'
  /** 当前页面状态是否渲染；缺省始终渲染。如产品图片识别仅新增态开放：show: ({isEdit}) => !isEdit */
  show?: (ctx: { isEdit: boolean; isReadonly: boolean }) => boolean
}

export interface SceneConfig {
  title: string
  editTitle?: string
  detailTitle?: string
  type: string
  module: string
  tabs: TabConfig[]
  labelWidth?: string
  labelPosition?: 'left' | 'right' | 'top'
  apiAction?: string
  successRoute?: string
  /** 页面附加操作，可配置在顶部操作区或表单内容顶部 */
  extraActions?: ExtraActionConfig[]
  loadDetail?: (id: string, cached?: Record<string, any>) => Promise<Record<string, any>>
  submitCreate?: (data: Record<string, any>, files?: Record<string, File[]>) => Promise<any>
  submitUpdate?: (id: string, data: Record<string, any>, files?: Record<string, File[]>) => Promise<any>
  /** 动态表格行内动作注册表：AddTemplate 操作列按钮通过它回调（如销售订单缺货行「生成订货单」） */
  __tableActionHandlers?: Record<string, (row: Record<string, any>, ctx: any) => void | Promise<void>>
}

/** 将 Date 对象或日期字符串格式化为 YYYY-MM-DD（后端要求的格式） */
function formatDate(value: unknown): string | undefined {
  if (!value) return undefined
  const d = value instanceof Date ? value : new Date(value as string)
  if (isNaN(d.getTime())) return undefined
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function normalizeFileUrl(value: unknown): string {
  return String(value ?? '').trim().replace(/^`+|`+$/g, '').trim()
}

function normalizeUploadDetailFiles(detail: Record<string, any>) {
  const imageSource = Array.isArray(detail.images)
    ? detail.images
    : Array.isArray(detail.image_urls)
      ? detail.image_urls
      : (typeof detail.images === 'string'
          ? detail.images.split(',')
          : (typeof detail.image_urls === 'string' ? detail.image_urls.split(',') : []))

  const attachmentSource = Array.isArray(detail.attachments)
    ? detail.attachments
    : Array.isArray(detail.attachment_urls)
      ? detail.attachment_urls
      : (typeof detail.attachments === 'string'
          ? detail.attachments.split(',')
          : (typeof detail.attachment_urls === 'string' ? detail.attachment_urls.split(',') : []))

  const images = imageSource
    .map((item: any) => normalizeFileUrl(item?.file_url ?? item?.url ?? item))
    .filter(Boolean)

  const attachments = attachmentSource
    .map((item: any, index: number) => {
      const url = normalizeFileUrl(item?.file_url ?? item?.url ?? item)
      if (!url) return null
      return {
        name: item?.file_name || item?.name || `file-${index + 1}`,
        url,
      }
    })
    .filter(Boolean)

  return {
    images,
    attachments,
  }
}

/** 付款方式英文标准值 → 中文（预付款单 select value 用中文，回显时把后端返回的英文转回中文） */
const PAYMENT_METHOD_LABEL: Record<string, string> = { CASH: '现金', TRANSFER: '银行转账', 现金: '现金', 银行转账: '银行转账' }
function paymentMethodLabel(method?: string): string {
  if (!method) return ''
  return PAYMENT_METHOD_LABEL[method] || method
}

/** 已针对"缺货一键生成订货单"弹过提示的产品（旧弹窗方案遗留，现为空置） */
const qtyPromptedProducts = new Set<string>()
void qtyPromptedProducts

/**
 * 销售订单明细"数量"列变更钩子（缺货检测 + 一键生成客户订货单）。
 * When qty > available_stock：询问是否按缺量一键生成客户订货单，确认后跳转预填页。
 * 返回时通过 AddTemplate 的快照恢复机制保留销售订单原有（未保存）状态。
 * @deprecated 已改为行内检测 + 行内按钮（见 onSalesOrderQtyInput / onSalesOrderShortageAction），保留以兼容外部引用
 */
async function onSalesOrderQtyChange(row: Record<string, any>, ctx: any) {
  const qty = Number(row.qty)
  const productId = row.product_id
  if (!productId || !qty || qty <= 0) return

  let available = 0
  try {
    // 可用库存来自产品资料接口（/tenant-products/detail 已扣减采购退货预占量）
    const res = await getProductDetail(productId)
    const raw = Number(res.data?.available_stock)
    available = isNaN(raw) ? 0 : raw
    // 同步刷新明细行「可用库存」列，保持与查询结果一致
    row.available_stock = res.data?.available_stock ?? String(available)
  } catch {
    // 库存查询失败不阻断数量录入
    return
  }
  if (qty <= available) return

  // 缺货：同位产品本次会话只提示一次（旧弹窗方案逻辑，现为空置）
  if (qtyPromptedProducts.has(productId)) return
  qtyPromptedProducts.add(productId)

  const deficit = qty - available
  try {
    await ElMessageBox.confirm(
      `产品「${row.product_name || row.product_code}」当前可用库存 ${available}，订单数量 ${qty} 已超出 ${deficit}。` +
      `是否一键生成客户订货单（订货数量 ${deficit}）？`,
      '库存不足，一键生成订货单',
      { confirmButtonText: '去生单', cancelButtonText: '暂不', type: 'warning' }
    )
  } catch {
    return // 用户暂不处理
  }

  const customerId = ctx.formData?.customer_id
  if (!customerId) {
    ElMessage.warning('生成订货单需先在主表选择客户')
    return
  }

  // 1) 快照销售订单当前编辑/创建状态，供跳转订货单保存返回后恢复
  try {
    const snapshot = JSON.stringify({
      formData: ctx.formData || {},
      dynamicTableData: ctx.dynamicTableData || {},
      activeTab: ctx.activeTab,
    })
    sessionStorage.setItem(`salesOrderEditRestore:salesOrder:${ctx.editId || 'new'}`, snapshot)
  } catch {
    // 序列化失败（如循环引用）则放弃快照恢复
  }

  // 2) 写入客户订货单预填数据（缺量的那一条明细）
  const prefill = {
    customer_id: customerId,
    customer_name: ctx.formData?.customer_name || '',
    items: [
      {
        product_id: productId,
        product_code: row.product_code || '',
        product_name: row.product_name || '',
        unit_id: row.unit_id || undefined,
        unit_name: row.unit_name || undefined,
        qty: deficit,
        project_name: '',
        line_remark: `销售订单缺货补量（订单需 ${qty}，库存 ${available}）`,
      },
    ],
  }
  sessionStorage.setItem('customerOrderPrefillFromSales', JSON.stringify(prefill))

  // 3) 跳转新增客户订货单预填页
  const soId = ctx.editId ? `&soId=${ctx.editId}` : ''
  ctx.router.push(`/sales/customer-order/create?prefill=1&from=salesOrder${soId}`)
}

/** 销售订单审核状态：0=未审核 1=审核通过 2=已反审核 3=审核失败（与后端 SalesAuditStatus 一致） */
export type SalesAuditStatus = 0 | 1 | 2 | 3

/**
 * 序列化角色权限 ID 列表（提交给角色创建/更新接口前的净化）。
 *
 * 背景：权限树是「菜单 → 按钮 → 权限」三级级联，父子联动勾选时父节点 id 会一并
 * 带入表单值，而后端角色接口的 permission_id 只接受权限码，混入结构性节点 id 会报
 * 「权限不存在」。
 * 过滤规则：按「结构性前缀黑名单」剔除（menu_/btn_/module:/page:），其余全部保留。
 * ⚠️ 不能按 perm_ 前缀白名单过滤——权限码并非都以 perm_ 开头
 *（如产品知识库的 knowledge:wms:search），白名单会把整模块权限清空（2026-09-02 实测踩坑）。
 */
function serializePermissionIds(value: unknown): string {
  const list = Array.isArray(value) ? value : (value ? [value] : [])
  // 补全：勾选了某页面写权限时自动带出该页面的查询权限（勾树时已做，此处兜底
  // 覆盖「编辑态未触发 check 就直接保存」等路径）
  const permOnly = expandRolePermissionIds(list.map(String))
    .filter(id => !/^(menu_|btn_|module:|page:)/.test(id))
  return JSON.stringify(permOnly)
}

/**
 * 角色创建/更新可能改动登录人自身角色的权限：保存生效后必须强制刷新权限 store，
 * 否则路由守卫/侧边栏仍按旧集合放行，进入已无权限的页面会收到接口 403
 * （表现为「保存成功」与「权限不足」气泡打架 + 列表空白）。
 */
async function refreshPermissionAfterRoleChange<T>(res: T): Promise<T> {
  await usePermissionStore().load(true)
  return res
}

/**
 * 采购订单明细行级提交校验（对齐后端 /tenant-purchase-orders 与 /items/create 的逐条规则：
 * product_id 必填、qty/purchase_price 必填数字、已发货必须填发货日期且格式 YYYY-MM-DD）。
 * 前端先行拦截，避免保存后才收到后端 400（编辑路径还涉及主单/明细双接口，
 * 明细后报错会造成主单已更新、明细未写入的半提交状态，故提交前统一校验）。
 * 比后端略严的口径：qty 必须 > 0（0/负数采购无业务意义）；purchase_price 允许 0（兼容赠品）。
 */
function validatePurchaseOrderItems(items: any[]): void {
  items.forEach((row: any, idx: number) => {
    const label = `第${idx + 1}条明细${row.product_name ? `「${row.product_name}」` : ''}`
    if (!row.product_id) throw new Error(`${label}：请选择产品`)
    const qtyRaw = String(row.qty ?? '').trim()
    if (qtyRaw === '') throw new Error(`${label}：采购数量不能为空`)
    const qty = Number(qtyRaw)
    if (Number.isNaN(qty)) throw new Error(`${label}：采购数量必须为数字`)
    if (qty <= 0) throw new Error(`${label}：采购数量必须大于0`)
    const priceRaw = String(row.purchase_price ?? '').trim()
    if (priceRaw === '') throw new Error(`${label}：采购单价不能为空`)
    const price = Number(priceRaw)
    if (Number.isNaN(price)) throw new Error(`${label}：采购单价必须为数字`)
    if (price < 0) throw new Error(`${label}：采购单价不能为负数`)
    if (Number(row.delivery_status) === 1) {
      const dateRaw = String(row.delivery_date ?? '').trim().slice(0, 10)
      if (!dateRaw) throw new Error(`${label}：已发货，发货日期不能为空`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) throw new Error(`${label}：发货日期格式错误，仅支持YYYY-MM-DD`)
    }
  })
}

/**
 * 产品「最低销售价格」计算（与表单「最低销售价格」computed 字段及后端
 * _compute_min_sale_price 同式）：预设出厂价 ÷ (1 − 毛利控制比例%)。
 * 毛利越界（<0 或 ≥100）由字段级 validator 拦截，此处返回 null 跳过下限比对，
 * 不对同一问题重复报错。
 */
function computeProductMinSalePrice(factoryPrice: unknown, ratePercent: unknown): number | null {
  const price = Number(factoryPrice) || 0
  const rate = Number(ratePercent) || 0
  if (rate < 0 || rate >= 100) return null
  const divisor = 1 - rate / 100
  if (divisor <= 0) return null
  // 不做四舍五入：后端按精确除法比较，前端取整会造成边界值（如 149.999）误放行/误拦截
  return price / divisor
}

/**
 * 产品资料提交前行级校验（对齐后端 /tenant-products/sale-prices/create|update 与
 * /suppliers/add 的逐条规则）：价格行客户类型/销售价格必填、价格不得低于最低销售价、
 * 客户类型不重复；关联供应商至少一条且不重复。
 * 新增/编辑均为主接口 + 价格 + 供应商多个接口先后提交，明细在后报 400 会造成
 * 「产品已保存、价格/供应商未写入」的半提交状态，故任何请求前统一拦截。
 */
function validateProductFormTables(data: Record<string, any>): void {
  // ── 客户价格行（sale-prices/create :3271-3321 / update :3504-3511 同口径）──
  const salePrices: any[] = data.sale_prices || []
  const minSalePrice = computeProductMinSalePrice(data.factory_price, data.gross_profit_ctrl_rate)
  const seenTypeIds = new Set<string>()
  salePrices.forEach((row: any, idx: number) => {
    const label = `第${idx + 1}行客户价格${row.customer_type_name ? `「${row.customer_type_name}」` : ''}`
    if (!row.customer_type_id) throw new Error(`${label}：请选择客户类型`)
    if (seenTypeIds.has(row.customer_type_id)) throw new Error(`${label}：客户类型重复，同一客户类型只能绑定一条价格`)
    seenTypeIds.add(row.customer_type_id)
    const priceRaw = String(row.sale_price ?? '').trim()
    if (priceRaw === '') throw new Error(`${label}：销售价格不能为空`)
    const price = Number(priceRaw)
    if (Number.isNaN(price)) throw new Error(`${label}：销售价格必须为数字`)
    if (minSalePrice !== null && price < minSalePrice) {
      throw new Error(`${label}：销售价格 ${price} 不得低于最低销售价格 ${minSalePrice.toFixed(2)} 元`)
    }
  })
  // ── 关联供应商行（suppliers/add :2408/:4858 至少一条、重复整体驳回）──
  const suppliers: any[] = (data.product_suppliers || []).filter((s: any) => s.supplier_id)
  if (suppliers.length === 0) throw new Error('请至少关联一个供应商')
  const seenSupplierIds = new Set<string>()
  suppliers.forEach((s: any, idx: number) => {
    if (seenSupplierIds.has(s.supplier_id)) {
      throw new Error(`第${idx + 1}条供应商「${s.supplier_name || ''}」：重复关联同一供应商`)
    }
    seenSupplierIds.add(s.supplier_id)
  })
}

/**
 * 销售订单创建下游单据（订货单/收款单）的审核前置校验。
 * 仅审核通过（audit_status === 1）允许操作；未审核/已反审核/审核失败一律拦截并提示。
 * 新增态（无 audit_status 字段）视为未审核，同样拦截。
 * @returns true=已审核通过可继续；false=被拦截（已提示）
 */
export function ensureSalesOrderAudited(formData?: Record<string, any>): boolean {
  const status = Number(formData?.audit_status ?? 0)
  if (status === 1) return true
  const labelMap: Record<number, string> = { 0: '未审核', 2: '已反审核', 3: '审核失败' }
  const label = labelMap[status] || '未审核'
  ElMessage.warning(`当前销售订单为「${label}」状态，需审核通过后才能创建订货单/收款单`)
  return false
}

/** 行内缺货按钮点击 → 打开确认弹窗（保留「去生单/暂不」交互），确认后走生成订货单流程 */
async function onSalesOrderShortageAction(row: Record<string, any>, ctx: any) {
  // 业务拦截：未审核（0/2/3）的销售订单不允许创建订货单/收款单，仅审核通过(1)可操作
  if (!ensureSalesOrderAudited(ctx.formData)) return

  const qty = Number(row.qty)
  const productId = row.product_id
  if (!productId || !qty || qty <= 0) return
  const available = Number(row.available_stock) || 0
  if (qty <= available) return

  const deficit = qty - available
  try {
    await ElMessageBox.confirm(
      `产品「${row.product_name || row.product_code}」当前可用库存 ${available}，订单数量 ${qty} 已超出 ${deficit}。` +
      `是否一键生成客户订货单（订货数量 ${deficit}）？`,
      '库存不足，一键生成订货单',
      { confirmButtonText: '去生单', cancelButtonText: '暂不', type: 'warning' }
    )
  } catch {
    return // 用户暂不处理
  }

  const customerId = ctx.formData?.customer_id
  if (!customerId) {
    ElMessage.warning('生成订货单需先在主表选择客户')
    return
  }

  // 1) 快照销售订单当前编辑/创建状态，供跳转订货单保存返回后恢复
  try {
    const snapshot = JSON.stringify({
      formData: ctx.formData || {},
      dynamicTableData: ctx.dynamicTableData || {},
      activeTab: ctx.activeTab,
    })
    sessionStorage.setItem(`salesOrderEditRestore:salesOrder:${ctx.editId || 'new'}`, snapshot)
  } catch {
    // 序列化失败（如循环引用）则放弃快照恢复
  }

  // 2) 写入客户订货单预填数据（缺量的那一条明细）
  const prefill = {
    customer_id: customerId,
    customer_name: ctx.formData?.customer_name || '',
    items: [
      {
        product_id: productId,
        product_code: row.product_code || '',
        product_name: row.product_name || '',
        unit_id: row.unit_id || undefined,
        unit_name: row.unit_name || undefined,
        qty: deficit,
        project_name: '',
        line_remark: `销售订单缺货补量（订单需 ${qty}，库存 ${available}）`,
      },
    ],
  }
  sessionStorage.setItem('customerOrderPrefillFromSales', JSON.stringify(prefill))

  // 3) 跳转新增客户订货单预填页
  const soId = ctx.editId ? `&soId=${ctx.editId}` : ''
  ctx.router.push(`/sales/customer-order/create?prefill=1&from=salesOrder${soId}`)
}

/**
 * 销售订单明细"数量"列输入钩子（缺货检测，行内标红 + 行内「生成订货单」按钮）。
 * 输入即检测（AddTemplate 侧已做 600ms 防抖），停止输入后自动比对可用库存并刷新行内缺货标记；
 * 不再弹窗打断录入，用户点击行内按钮时才确认并跳转生成订货单。
 */
async function onSalesOrderQtyInput(row: Record<string, any>, _ctx: any) {
  const qty = Number(row.qty)
  const productId = row.product_id
  if (!productId) return
  // 数量清空/非法时清除缺货标记
  if (!qty || qty <= 0) {
    row._shortage = false
    row._shortageQty = 0
    return
  }

  let available = Number(row.available_stock)
  // 行上无缓存库存时才请求产品详情（/tenant-products/detail 已扣减采购退货预占量）
  if (isNaN(available) || row.available_stock === undefined || row.available_stock === '') {
    try {
      const res = await getProductDetail(productId)
      const raw = Number(res.data?.available_stock)
      available = isNaN(raw) ? 0 : raw
      // 同步刷新明细行「可用库存」列，保持与查询结果一致
      row.available_stock = res.data?.available_stock ?? String(available)
    } catch {
      // 库存查询失败不阻断数量录入
      return
    }
  }
  const shortage = qty > available
  row._shortage = shortage
  row._shortageQty = shortage ? qty - available : 0
}

const formConfigMap: Record<string, SceneConfig> = {
  personnel: {
    title: '新增用户',
    editTitle: '编辑用户',
    type: 'personnel',
    module: 'system/personnel',
    successRoute: '/system/personnel',
    labelWidth: '110px',
    loadDetail: async (id, cached) => {
      const orgId = (cached?.org_id as string | undefined) || ''
      const res = await getUserDetail({ org_id: orgId, user_id: id })
      const user = res.data.user?.[0]
      if (!user) return {}
      return { ...user, password: '******' }
    },
    submitCreate: (data) => createUser(data as unknown as UserCreatePayload),
    submitUpdate: (id, data) => {
      const payload: ManagedUserUpdatePayload = {
        target_user_id: id,
        user_name: data.user_name,
        org_id: data.org_id,
        post_id: data.post_id,
        role_id: data.role_id,
        user_type: data.user_type,
        sort_no: data.sort_no,
        status: data.status,
      }
      return updateManagedUser(payload)
    },
    tabs: [
      {
        label: '用户信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'user_name', label: '员工姓名', type: 'input', required: true, placeholder: '请输入员工姓名', span: 8 },
          { key: 'password', label: '初始密码', type: 'input', required: true, placeholder: '至少6位', span: 8, hiddenInEdit: true, rules: [{ min: 6, message: '密码至少6位', trigger: 'blur' }] },
          { key: 'sort_no', label: '排序编号', type: 'number', defaultValue: 0, span: 8 },
          { key: 'mobile', label: '手机号码', type: 'input', placeholder: '请输入手机号码', span: 8, disabledInEdit: true, rules: [{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码', trigger: 'blur' }] },
          { key: 'email', label: '电子邮箱', type: 'input', placeholder: '请输入电子邮箱', span: 8, disabledInEdit: true, rules: [{ pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, message: '请输入正确的邮箱格式', trigger: 'blur' }] },
          { key: 'user_type', label: '用户类型', type: 'select', placeholder: '请选择用户类型', span: 8, options: [], loadOptions: async () => { try { return await getUserTypeOptions() } catch { return [] } } },
          { key: 'status', label: '状态', type: 'select', defaultValue: 1, span: 8, options: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] },
          { key: 'section-org', label: '组织与岗位', type: 'section', span: 24 },
          { key: 'org_id', label: '所属组织', type: 'tree-select', required: true, placeholder: '请选择所属组织', span: 12, checkStrictly: true, treeProps: { label: 'name', children: 'children', value: 'org_code' }, treeData: [], loadTreeData: async () => { const res = await getOrgTree(); return res.data.org || [] } },
          { key: 'post_id', label: '所属岗位', type: 'select', placeholder: '请选择岗位', span: 12, options: [], loadOptions: async () => { try { const res = await getPositionList({ page: 1, pageSize: 1000 } as any); return res.data.list.map((p: any) => ({ label: p.name, value: p.id })) } catch { return [] } } },
          { key: 'section-role', label: '角色分配', type: 'section', span: 24 },
          { key: 'role_id', label: '绑定角色', type: 'select', required: true, placeholder: '请选择角色', span: 12, options: [], loadOptions: async () => { try { const res = await getRoleAll(); return res.data.map((r: any) => ({ label: r.name, value: r.id })) } catch { return [] } } },
        ]
      }
    ]
  },
  position: {
    title: '新增岗位',
    editTitle: '编辑岗位',
    type: 'position',
    module: 'system/position',
    successRoute: '/system/position',
    labelWidth: '100px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getPostDetail(id)
      const p = res.data.post?.[0]
      if (!p) return {}
      return {
        post_name: p.post_name,
        post_code: p.post_code,
        post_category: p.post_category || undefined,
        sort_no: p.sort_no,
        status: p.status,
        remark: p.remark || '',
      }
    },
    submitCreate: (data) => createPost({
      post_name: String(data.post_name ?? ''),
      post_category: data.post_category || undefined,
      sort_no: Number(data.sort_no ?? 0) || 0,
      remark: data.remark || undefined,
    }),
    submitUpdate: (id, data) => updatePost({
      post_id: id,
      post_name: data.post_name || undefined,
      post_category: data.post_category || undefined,
      sort_no: (data.sort_no === '' || data.sort_no === undefined) ? undefined : Number(data.sort_no),
      status: (data.status === '' || data.status === undefined) ? undefined : Number(data.status),
      remark: data.remark || undefined,
    }),
    tabs: [
      {
        label: '岗位信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'post_name', label: '岗位名称', type: 'input', required: true, placeholder: '请输入岗位名称', span: 12 },
          { key: 'post_code', label: '岗位编码', type: 'input', disabled: true, placeholder: '系统自动生成', span: 12 },
          { key: 'post_category', label: '岗位分类', type: 'select', filterable: true, clearable: true, placeholder: '请选择岗位分类', options: [], loadOptions: async () => { try { return await getPostCategoryOptions() } catch { return [] } }, span: 12 },
          { key: 'sort_no', label: '排序号', type: 'number', defaultValue: 0, span: 12 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '停用', value: 0 }
          ], span: 12 },
          { key: 'remark', label: '备注信息', type: 'textarea', placeholder: '请输入备注信息', rows: 3, span: 24 }
        ]
      }
    ]
  },
  organization: {
    title: '新增机构',
    editTitle: '编辑机构',
    type: 'organization',
    module: 'system/organization',
    successRoute: '/system/organization',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getOrgDetail(id)
      return res.data.org as unknown as Record<string, any>
    },
    submitCreate: (data) => createOrg({
      org_name: data.org_name,
      org_full_name: data.org_full_name || undefined,
      sort_no: Number(data.sort_no) || 0,
      org_type: data.org_type,
      parent_id: data.parent_id || undefined,
      leader_name: data.leader_name || undefined,
      contact_address: data.contact_address || undefined,
      email: data.email || undefined,
      post_code: data.post_code || undefined,
      remark: data.remark || undefined
    }),
    submitUpdate: (id, data) => updateOrg({
      org_id: id,
      org_name: data.org_name,
      org_full_name: data.org_full_name,
      sort_no: data.sort_no === '' || data.sort_no === undefined ? undefined : Number(data.sort_no),
      org_type: data.org_type,
      status: data.status === '' || data.status === undefined ? undefined : Number(data.status),
      parent_id: data.parent_id,
      leader_name: data.leader_name,
      contact_address: data.contact_address,
      email: data.email,
      post_code: data.post_code,
      remark: data.remark
    }),
    tabs: [
      {
        label: '机构信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'parent_id', label: '上级机构', type: 'tree-select', placeholder: '不选则为顶级机构', span: 12, checkStrictly: true, treeProps: { label: 'name', children: 'children', value: 'org_code' }, loadTreeData: async () => { const res = await getOrgTree(); return res.data.org } },
          { key: 'org_name', label: '机构简称', type: 'input', required: true, placeholder: '请输入机构简称', span: 12 },
          { key: 'org_full_name', label: '机构全称', type: 'input', placeholder: '请输入机构全称', span: 12 },
          { key: 'org_type', label: '机构类型', type: 'select', required: true, placeholder: '请选择机构类型', filterable: true, loadOptions: getOrgTypeOptions, span: 12 },
          { key: 'sort_no', label: '排序号', type: 'number', defaultValue: 0, span: 12 },
          { key: 'leader_name', label: '负责人', type: 'input', placeholder: '请输入负责人', span: 12 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '停用', value: 0 }
          ], span: 12 },
          { key: 'section-detail', label: '详细信息', type: 'section', span: 24 },
          { key: 'contact_address', label: '联系地址', type: 'input', placeholder: '请输入联系地址', span: 12 },
          { key: 'email', label: '电子邮箱', type: 'input', placeholder: '请输入电子邮箱', span: 12, rules: [{ pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, message: '请输入正确的邮箱格式', trigger: 'blur' }] },
          { key: 'post_code', label: '邮政编码', type: 'input', placeholder: '请输入邮政编码', span: 12 },
          { key: 'remark', label: '备注信息', type: 'textarea', placeholder: '请输入备注信息', rows: 3, span: 24 }
        ]
      }
    ]
  },
  role: {
    title: '新增角色',
    editTitle: '编辑角色',
    type: 'role',
    module: 'system/role',
    successRoute: '/system/roles',
    labelWidth: '100px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getRoleDetail(id)
      const role = res.data.role[0]
      if (!role) throw new Error('角色不存在')
      // permission_id 后端返回 str | string[] | null，统一成数组以供多选回显
      const rawPerm = (role as any).permission_id
      // 回显时也做一次补全，保证「看到的勾选项」与「保存后生效的权限」一致
      const permission_id = expandRolePermissionIds(
        Array.isArray(rawPerm) ? rawPerm.map(String) : (rawPerm ? [String(rawPerm)] : [])
      )
      return { ...(role as unknown as Record<string, any>), permission_id } as Record<string, any>
    },
    submitCreate: (data) => createRole({
      role_name: data.role_name,
      role_type: data.role_type,
      sort_no: Number(data.sort_no) || 0,
      status: data.status === '' || data.status === undefined ? 1 : Number(data.status),
      remark: data.remark || undefined,
      permission_id: serializePermissionIds(data.permission_id),
    } as RoleCreatePayload).then(refreshPermissionAfterRoleChange),
    submitUpdate: (id, data) => updateRole(id, {
      role_id: id,
      role_name: data.role_name,
      role_type: data.role_type,
      permission_id: serializePermissionIds(data.permission_id),
      sort_no: data.sort_no === '' || data.sort_no === undefined ? undefined : Number(data.sort_no),
      status: data.status === '' || data.status === undefined ? 1 : Number(data.status),
      remark: data.remark || undefined,
    } as RoleUpdatePayload).then(refreshPermissionAfterRoleChange),
    tabs: [
      {
        label: '角色信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'role_name', label: '角色名称', type: 'input', required: true, placeholder: '请输入角色名称', span: 8 },
          { key: 'role_code', label: '角色编码', type: 'input', placeholder: '保存后自动生成', span: 8, visible: (formData: Record<string, any>) => !formData.role_code },
          { key: 'role_type', label: '角色类型', type: 'select', required: true, placeholder: '请选择角色类型', options: [
            { label: '主管', value: 'MANAGER' }, { label: '员工', value: 'EMPLOYEE' },{label:'管理员','value':'ADMIN'}
          ], span: 8 },
          { key: 'sort_no', label: '排序号', type: 'number', defaultValue: 0, span: 8 },
          { key: 'is_system', label: '系统角色', type: 'radio', defaultValue: 0, options: [
            { label: '是', value: 1 as any }, { label: '否', value: 0 as any }
          ], span: 8, visible: (formData: Record<string, any>) => !!formData.is_system },
          { key: 'status', label: '状态', type: 'radio', defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '停用', value: 0 }
          ], span: 8 },
          {
            // 内联勾选树（默认收起），替代原 tree-select 下拉输入框
            key: 'permission_id', label: '权限设置', type: 'tree',
            span: 24, defaultValue: [], treeData: [],
            treeProps: { label: 'label', children: 'children', value: 'id' }, checkStrictly: false,
            // 数据源切换：平台权限（WMS_PLATFORM）与扫码枪权限（WMS_SCANNER）分属两个后端体系
            ownerSwitch: true,
            // 联动：勾中某页面的写权限时自动带出该页面的查询权限与跨页依赖（deps），
            // 避免只给写权限导致页面不可见（严格语义下）或表单选项/选单弹窗 403。
            // 入参 ids 是 AddTemplate 差量记账后的「用户显式勾选集」（非树当前勾选态），
            // 保证取消勾选页面节点时联动补出的码随之清除（不会反复补回导致无法取消）
            expandCheckedIds: (ids: string[]) => expandRolePermissionIds(ids),
            loadTreeData: async (owner = 'WMS_PLATFORM') => {
              try {
                // 角色绑定树需展示租客级全部可分配权限（与登录人角色无关），故用 visible-permissions；
                // 登录后的页面级过滤用 my-permissions（见 stores/permission.ts）
                const res = await getVisiblePermissions(owner)
                if (owner === 'WMS_SCANNER') {
                  // 扫码枪权限无平台页面映射，保留原 菜单→按钮→权限 结构
                  return res.data
                }
                // 平台权限按「模块 → 页面 → 该页面全部接口」重排（见 permissionTreeGrouping.ts）：
                // 叶子仍是 perm_code，落库/回显/联动逻辑不变；未登记页面的权限兜底挂「其他权限」
                return groupRolePermissionTree(res.data)
              } catch { return [] }
            }
          },
          { key: 'remark', label: '备注信息', type: 'textarea', placeholder: '请输入备注信息', rows: 3, span: 24 }
        ]
      }
    ]
  },
  admin: {
    title: '新增二级管理员',
    editTitle: '编辑二级管理员',
    type: 'admin',
    module: 'system/admin',
    successRoute: '/system/admin',
    labelWidth: '100px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      // 后端无详情接口，通过搜索接口按 user_id 查单条数据
      const res = await searchAdmins({
        search_field: JSON.stringify(['user_id']),
        search_value: JSON.stringify({ user_id: id })
      })
      const row = (res.data.user || [])[0] || {}
      return {
        ...row,
        // 表单字段名与列表字段名映射
        account: row.login_name || '',
        nickname: row.user_name || '',
        phone: row.mobile || '',
        email: row.email || '',
        // status 列表返回 1/0，表单 select 选项值为"正常"/"停用"
        status: row.status === 1 ? '正常' : (row.status === 0 ? '停用' : row.status)
      }
    },
    submitCreate: (data) => createAdmin(data),
    submitUpdate: (id, data) => updateAdmin(id, data),
    tabs: [
      {
        label: '管理员信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'account', label: '登录账号', type: 'input', required: true, placeholder: '请输入登录账号', span: 8, disabledInEdit: true },
          { key: 'nickname', label: '用户昵称', type: 'input', required: true, placeholder: '请输入用户昵称', span: 8, disabledInEdit: true },
          { key: 'email', label: '电子邮箱', type: 'input', placeholder: '请输入电子邮箱', span: 8, disabledInEdit: true, rules: [{ pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, message: '请输入正确的邮箱格式', trigger: 'blur' }] },
          { key: 'phone', label: '手机号码', type: 'input', placeholder: '请输入手机号码', span: 8, disabledInEdit: true, rules: [{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码', trigger: 'blur' }] },
          { key: 'officePhone', label: '办公电话', type: 'input', placeholder: '请输入办公电话', span: 8, disabledInEdit: true },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', disabledInEdit: true, options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 8 }
        ]
      }
    ]
  },
  params: {
    title: '新增参数',
    editTitle: '编辑参数',
    type: 'params',
    module: 'system/param',
    successRoute: '/system/params',
    labelWidth: '100px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getParamDetail(id)
      return res.data
    },
    submitCreate: (data) => createParam(data),
    submitUpdate: (id, data) => updateParam(id, data),
    tabs: [
      {
        label: '参数信息',
        fields: [
          { key: 'paramName', label: '参数名称', type: 'input', required: true, placeholder: '请输入参数名称', span: 12 },
          { key: 'paramKey', label: '参数键名', type: 'input', required: true, placeholder: '请输入参数键名', span: 12 },
          { key: 'paramValue', label: '参数键值', type: 'textarea', required: true, placeholder: '请输入参数键值', rows: 4, span: 24 },
          { key: 'isSystem', label: '系统参数', type: 'radio', defaultValue: false, options: [
            { label: '是', value: true as any }, { label: '否', value: false as any }
          ], span: 12 },
          { key: 'remark', label: '参数描述', type: 'textarea', placeholder: '请输入参数描述', rows: 3, span: 24 }
        ]
      }
    ]
  },
  dict: {
    title: '新增字典',
    editTitle: '编辑字典',
    type: 'dict',
    module: 'system/dict',
    successRoute: '/system/dict',
    labelWidth: '100px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getDictDetail(id)
      return res.data
    },
    submitCreate: (data) => createDict(data),
    submitUpdate: (id, data) => updateDict(id, data),
    tabs: [
      {
        label: '字典信息',
        fields: [
          { key: 'name', label: '字典名称', type: 'input', required: true, placeholder: '请输入字典名称', span: 12 },
          { key: 'type', label: '字典类型', type: 'input', required: true, placeholder: '请输入字典类型', span: 12 },
          { key: 'isSystem', label: '系统字典', type: 'radio', defaultValue: false, options: [
            { label: '是', value: true as any }, { label: '否', value: false as any }
          ], span: 12 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 12 },
          { key: 'remark', label: '备注信息', type: 'textarea', placeholder: '请输入备注信息', rows: 3, span: 24 }
        ]
      }
    ]
  },
  area: {
    title: '新增行政区划',
    editTitle: '编辑行政区划',
    type: 'area',
    module: 'system/area',
    successRoute: '/system/area',
    labelWidth: '100px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getAreaDetail(id)
      const area = res.data.area
      if (!area) throw new Error('区划不存在')
      const AREA_TYPE_MAP: Record<string, string> = {
        COUNTRY: '国家',
        PROVINCE_MUNICIPALITY: '省份直辖市',
        PROVINCE: '省份直辖市',
        CITY: '地市',
        DISTRICT_COUNTY: '区县',
        DISTRICT: '区县',
      }
      return {
        ...area,
        area_type: AREA_TYPE_MAP[area.area_type] ?? area.area_type,
        area_type_label: AREA_TYPE_MAP[area.area_type] ?? area.area_type_label ?? '',
      } as unknown as Record<string, any>
    },
    submitCreate: (data) => createArea({
      area_code: data.area_code,
      area_name: data.area_name,
      area_type: data.area_type,
      sort_no: Number(data.sort_no) || 0,
      parent_id: data.parent_id || '0',
      status: data.status === '' || data.status === undefined ? 1 : Number(data.status),
    } as AreaCreatePayload),
    submitUpdate: (id, data) => updateArea(id, {
      area_id: id,
      area_code: data.area_code,
      area_name: data.area_name,
      parent_id: data.parent_id || '0',
      area_type: data.area_type,
      sort_no: data.sort_no === '' || data.sort_no === undefined ? undefined : Number(data.sort_no),
      status: data.status === '' || data.status === undefined ? 1 : Number(data.status),
    } as AreaUpdatePayload),
    tabs: [
      {
        label: '区划信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'area_name', label: '区划名称', type: 'input', required: true, placeholder: '请输入区划名称', span: 8 },
          { key: 'area_code', label: '区划编码', type: 'input', required: true, placeholder: '请输入区划编码', span: 8 },
          { key: 'area_type', label: '区划类型', type: 'select', required: true, placeholder: '请选择区划类型', options: [
            { label: '国家', value: '国家' }, { label: '省份直辖市', value: '省份直辖市' }, { label: '地市', value: '地市' }, { label: '区县', value: '区县' }
          ], span: 8 },
          { key: 'parent_id', label: '上级区划', type: 'tree-select', placeholder: '不选则为顶级区划', span: 8, checkStrictly: true, filterable: true, treeProps: { label: 'area_name', children: 'children', value: 'area_id' }, loadTreeData: async () => { const res = await getAreaList({}); return res.data.area || [] } },
          { key: 'sort_no', label: '排序号', type: 'number', defaultValue: 0, span: 8 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '停用', value: 0 }
          ], span: 8 },
          { key: 'area_type_label', label: '区划类型显示名', type: 'input', placeholder: '保存后自动生成', span: 8, visible: (formData: Record<string, any>) => !!formData.area_type_label },
        ]
      }
    ]
  },
  dictData: {
    title: '新增字典数据',
    editTitle: '编辑字典数据',
    type: 'dictData',
    module: 'system/dict-data',
    successRoute: '/system/dict',
    labelWidth: '100px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getDictDataDetail(id)
      return res.data
    },
    submitCreate: (data) => createDictData(data),
    submitUpdate: (id, data) => updateDictData(id, data),
    tabs: [
      {
        label: '字典数据信息',
        fields: [
          { key: 'parentId', label: '上级字典', type: 'select', placeholder: '请选择上级字典（无则留空）', span: 12 },
          { key: 'label', label: '字典标签', type: 'input', required: true, placeholder: '请输入字典标签', span: 12 },
          { key: 'value', label: '字典键值', type: 'input', required: true, placeholder: '请输入字典键值', span: 12 },
          { key: 'sort', label: '排序号', type: 'number', defaultValue: 0, span: 12 },
          { key: 'isSystem', label: '系统内置', type: 'radio', defaultValue: false, options: [
            { label: '是', value: true as any }, { label: '否', value: false as any }
          ], span: 12 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 12 },
          { key: 'remark', label: '备注信息', type: 'textarea', placeholder: '请输入备注信息', rows: 3, span: 24 },
          { key: 'section-other', label: '其他信息', type: 'section', span: 24 },
          { key: 'cssStyle', label: 'CSS样式', type: 'input', placeholder: '请输入CSS样式，如 color: red;', span: 12 },
          { key: 'cssClass', label: 'CSS类别', type: 'input', placeholder: '请输入CSS类名', span: 12 }
        ]
      }
    ]
  },

  // ==================== 客户管理 ====================
  customerType: {
    title: '新增客户类型',
    editTitle: '编辑客户类型',
    type: 'customerType',
    module: 'customer/type',
    successRoute: '/customer/type',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getCustomerTypeDetail(id)
      const row = (res.data as any).customer_type
      const item = Array.isArray(row) ? row[0] : row
      if (!item) throw new Error('客户类型不存在')
      return item as unknown as Record<string, any>
    },
    submitCreate: (data) => createCustomerType({
      type_name: data.type_name,
    }),
    submitUpdate: (id, data) => updateCustomerType(id, {
      customer_type_id: id,
      type_name: data.type_name,
      status: data.status === '' || data.status === undefined ? undefined : Number(data.status),
    }),
    tabs: [
      {
        label: '基本信息',
        fields: [
          { key: 'type_name', label: '类型名称', type: 'input', required: true, placeholder: '请输入客户类型名称', span: 12 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '停用', value: 0 }
          ], span: 12 },
        ]
      }
    ]
  },

  logisticsCompany: {
    title: '新增物流公司',
    editTitle: '编辑物流公司',
    type: 'logisticsCompany',
    module: 'delivery/company',
    successRoute: '/delivery/company',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getLogisticsCompanyDetail(id)
      const row = (res.data as any).logistics_company
      const item = Array.isArray(row) ? row[0] : row
      if (!item) throw new Error('物流公司不存在')
      return item as unknown as Record<string, any>
    },
    submitCreate: (data) => createLogisticsCompany({
      company_name: data.company_name,
      sort_no: Number(data.sort_no) || 0,
      remark: data.remark || undefined,
    }),
    submitUpdate: (id, data) => updateLogisticsCompany(id, {
      logistics_company_id: id,
      company_name: data.company_name,
      sort_no: data.sort_no !== undefined && data.sort_no !== '' ? Number(data.sort_no) : undefined,
      status: data.status === '' || data.status === undefined ? undefined : Number(data.status),
      remark: data.remark || undefined,
    }),
    tabs: [
      {
        label: '基本信息',
        fields: [
          { key: 'company_name', label: '公司名称', type: 'input', required: true, placeholder: '请输入物流公司名称', span: 12 },
          { key: 'sort_no', label: '排序号', type: 'number', required: true, placeholder: '请输入排序号', span: 12 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '停用', value: 0 }
          ], span: 12 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  customerRegion: {
    title: '新增区域',
    editTitle: '编辑区域',
    type: 'customerRegion',
    module: 'customer/region',
    successRoute: '/customer/region',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getCustomerRegionDetail(id)
      const row = (res.data as any).region
      const item = Array.isArray(row) ? row[0] : row
      if (!item) throw new Error('区域不存在')
      return item as unknown as Record<string, any>
    },
    submitCreate: (data) => createCustomerRegion({
      region_name: data.region_name,
      remark: data.remark || undefined,
    }),
    submitUpdate: (id, data) => updateCustomerRegion(id, {
      region_id: id,
      region_name: data.region_name,
      status: data.status === '' || data.status === undefined ? undefined : Number(data.status),
      remark: data.remark || undefined,
    }),
    tabs: [
      {
        label: '区域信息',
        fields: [
          { key: 'region_name', label: '区域名称', type: 'input', required: true, placeholder: '请输入区域名称', span: 12 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '停用', value: 0 }
          ], span: 12 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  customerInfo: {
    title: '新增正式客户',
    editTitle: '编辑正式客户',
    type: 'customerInfo',
    module: 'customer/info',
    successRoute: '/customer/info',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getCustomerDetail(id)
      const row = (res.data as any).customer
      const item = Array.isArray(row) ? row[0] : row
      if (!item) throw new Error('客户不存在')
      return item as unknown as Record<string, any>
    },
    submitCreate: (data) => createCustomer({
      customer_name: data.customer_name,
      area_id: data.area_id || '',
      detail_address: data.detail_address || '',
      company_leader_name: data.company_leader_name || '',
      leader_phone: data.leader_phone || '',
      customer_type_id: data.customer_type_id || '',
      region_id: data.region_id || '',
      logistics_company_id: data.logistics_company_id || '',
      follower_user_id: data.follower_user_id || undefined,
      salesman_user_id: data.salesman_user_id || undefined,
      is_monthly_settlement: Number(data.is_monthly_settlement) ?? 0,
      monthly_days: Number(data.monthly_days) || 0,
      settlement_day: Number(data.settlement_day) || 0,
      credit_amount: String(data.credit_amount ?? 0),
      gift_amount: String(data.gift_amount ?? 0),
      customer_scale: data.customer_scale || undefined,
      remark: data.remark || undefined,
    }),
    submitUpdate: (id, data) => updateCustomer({
      customer_id: id,
      customer_name: data.customer_name,
      area_id: data.area_id || '',
      detail_address: data.detail_address || '',
      company_leader_name: data.company_leader_name || '',
      leader_phone: data.leader_phone || '',
      customer_type_id: data.customer_type_id || '',
      region_id: data.region_id || '',
      logistics_company_id: data.logistics_company_id || '',
      follower_user_id: data.follower_user_id || undefined,
      salesman_user_id: data.salesman_user_id || undefined,
      is_monthly_settlement: Number(data.is_monthly_settlement) ?? 0,
      monthly_days: Number(data.monthly_days) || 0,
      settlement_day: Number(data.settlement_day) || 0,
      credit_amount: String(data.credit_amount ?? 0),
      customer_scale: data.customer_scale || undefined,
      status: Number(data.status) ?? 0,
      remark: data.remark || undefined,
    }),
    tabs: [
      {
        label: '基本信息',
        fields: [
          { key: 'section-base', label: '客户基本信息', type: 'section', span: 24 },
          { key: 'customer_name', label: '客户名称', type: 'input', required: true, placeholder: '请输入客户名称', span: 8 },
          { key: 'area_id', label: '行政区划', type: 'tree-select', required: true, placeholder: '请选择行政区划', span: 8, filterable: true, checkStrictly: true, treeProps: { label: 'area_name', children: 'children', value: 'area_id' }, loadTreeData: async () => { try { const res = await getAreaList({}); return res.data.area || [] } catch { return [] } } },
          { key: 'detail_address', label: '详细地址', type: 'input', required: true, placeholder: '请输入详细地址', span: 8 },
          { key: 'company_leader_name', label: '公司负责人', type: 'input', required: true, placeholder: '请输入负责人名称', span: 8 },
          { key: 'leader_phone', label: '负责人电话', type: 'input', required: true, placeholder: '请输入负责人电话', span: 8 },
          { key: 'customer_type_id', label: '客户类型', type: 'select', required: true, placeholder: '请选择客户类型', options: [], span: 8, loadOptions: async () => { try { const res = await getCustomerTypeList({ page: 1 }); return res.data.customer_type.map((t: any) => ({ label: t.type_name, value: t.customer_type_id })) } catch { return [] } } },
          { key: 'region_id', label: '所属区域', type: 'select', required: true, placeholder: '请选择所属区域', options: [], span: 8, loadOptions: async () => { try { const res = await getCustomerRegionList({ page: 1 }); return res.data.region.map((r: any) => ({ label: r.region_name, value: r.region_id })) } catch { return [] } } },
          { key: 'logistics_company_id', label: '物流公司', type: 'select', required: true, placeholder: '请选择物流公司', options: [], span: 8, loadOptions: async () => { try { const res = await getLogisticsCompanyList({ page: 1 }); return res.data.logistics_company.map((l: any) => ({ label: l.company_name, value: l.logistics_company_id })) } catch { return [] } } },
          { key: 'follower_user_id', label: '跟单员', type: 'input-suffix', dialogType: 'employee', labelKey: 'follower_user_name', placeholder: '请选择跟单员', span: 8 },
          { key: 'salesman_user_id', label: '销售员', type: 'input-suffix', dialogType: 'employee', labelKey: 'salesman_user_name', placeholder: '请选择销售员', span: 8 },
          { key: 'customer_scale', label: '客户规模', type: 'select', placeholder: '请选择客户规模', options: [
            { label: '大型', value: '大型' }, { label: '中型', value: '中型' }, { label: '小型', value: '小型' }
          ], span: 8 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      },
      {
        label: '业务信息',
        fields: [
          { key: 'section-biz', label: '业务配置', type: 'section', span: 24 },
          { key: 'is_monthly_settlement', label: '是否月结', type: 'radio', defaultValue: 0, options: [
            { label: '是', value: 1 }, { label: '否', value: 0 }
          ], span: 8 },
          { key: 'credit_amount', label: '授信额度', type: 'number', defaultValue: 0, span: 8, disabled: true },
          { key: 'gift_amount', label: '赠送金额', type: 'number', defaultValue: 0, span: 8, disabled: true },
          { key: 'monthly_days', label: '月结时长(天)', type: 'number', defaultValue: 0, span: 8 },
          { key: 'settlement_day', label: '结算日', type: 'number', defaultValue: 0, span: 8 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '停用', value: 0 }
          ], span: 8 },
        ]
      }
    ]
  },

  customerNew: {
    title: '新增开拓客户',
    editTitle: '编辑开拓客户',
    type: 'customerNew',
    module: 'customer/new',
    successRoute: '/customer/new',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getCustomerLeadDetail(id)
      const row = (res.data as any).customer_lead
      const item = Array.isArray(row) ? row[0] : row
      if (!item) throw new Error('开拓客户不存在')
      return item as unknown as Record<string, any>
    },
    submitCreate: (data) => createCustomerLead({
      lead_name: data.lead_name,
      area_id: data.area_id || '',
      detail_address: data.detail_address || '',
      contact_name: data.contact_name || '',
      contact_phone: data.contact_phone || '',
      customer_type_id: data.customer_type_id || '',
      region_id: data.region_id || '',
      customer_scale: data.customer_scale || undefined,
      remark: data.remark || undefined,
    }),
    submitUpdate: (id, data) => updateCustomerLead({
      lead_id: id,
      lead_name: data.lead_name,
      area_id: data.area_id || undefined,
      detail_address: data.detail_address || undefined,
      contact_name: data.contact_name || undefined,
      contact_phone: data.contact_phone || undefined,
      customer_type_id: data.customer_type_id || undefined,
      region_id: data.region_id || undefined,
      customer_scale: data.customer_scale || undefined,
      remark: data.remark || undefined,
      status: data.status === '' || data.status === undefined ? 1 : Number(data.status),
    }),
    tabs: [
      {
        label: '客户信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'lead_name', label: '客户名称', type: 'input', required: true, placeholder: '请输入客户名称', span: 8 },
          { key: 'area_id', label: '行政区划', type: 'tree-select', placeholder: '请选择行政区划', span: 8, filterable: true, checkStrictly: true, treeProps: { label: 'area_name', children: 'children', value: 'area_id' }, loadTreeData: async () => { if (!usePermissionStore().hasPerm('perm_api_emp_query_areas')) return []; try { const res = await getAreaList({}); return res.data.area || [] } catch { return [] } } },
          { key: 'detail_address', label: '详细地址', type: 'input', placeholder: '请输入详细地址', span: 8 },
          { key: 'contact_name', label: '负责人名称', type: 'input', placeholder: '请输入负责人名称', span: 8 },
          { key: 'contact_phone', label: '负责人电话', type: 'input', placeholder: '请输入负责人电话', span: 8 },
          { key: 'customer_type_id', label: '客户类型', type: 'select', placeholder: '请选择客户类型', options: [], span: 8, loadOptions: async () => { try { const res = await getCustomerTypeList({ page: 1 }); return res.data.customer_type.map((t: any) => ({ label: t.type_name, value: t.customer_type_id })) } catch { return [] } } },
          { key: 'region_id', label: '所属区域', type: 'select', placeholder: '请选择所属区域', options: [], span: 8, loadOptions: async () => { try { const res = await getCustomerRegionList({ page: 1 }); return res.data.region.map((r: any) => ({ label: r.region_name, value: r.region_id })) } catch { return [] } } },
          { key: 'customer_scale', label: '客户规模', type: 'input', placeholder: '请输入客户规模', span: 8 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  customerVisit: {
    title: '新增拜访任务',
    editTitle: '编辑拜访任务',
    type: 'customerVisit',
    module: 'customer/task/visit',
    successRoute: '/customer/task/visit',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getVisitTaskDetail(id)
      return res.data.visit_task as unknown as Record<string, any>
    },
    submitCreate: (data) => createVisitTask({
      task_type: data.task_type || '上门拜访',
      customer_id: data.customer_id || '',
      contact_name: data.contact_name || '',
      contact_phone: data.contact_phone || '',
      visit_address: data.visit_address || '',
      salesman_user_id: data.salesman_user_id || '',
      visit_plan: data.visit_plan || '',
      status: 1,
      visit_time: data.visit_time || undefined,
      remark: data.remark || undefined,
    }),
    submitUpdate: (id, data) => updateVisitTask({
      visit_task_id: id,
      task_type: data.task_type || '上门拜访',
      customer_id: data.customer_id || '',
      contact_name: data.contact_name || '',
      contact_phone: data.contact_phone || '',
      visit_address: data.visit_address || '',
      salesman_user_id: data.salesman_user_id || '',
      visit_plan: data.visit_plan || '',
      status: data.status === '' || data.status === undefined ? 1 : Number(data.status),
      visit_time: data.visit_time || undefined,
      remark: data.remark || undefined,
    }),
    tabs: [
      {
        label: '任务信息',
        fields: [
          { key: 'section-base', label: '拜访信息', type: 'section', span: 24 },
          { key: 'customer_name', label: '客户', type: 'input', required: true, disabledInEdit: true, placeholder: '客户名称', span: 8 },
          { key: 'contact_name', label: '联系人', type: 'input', placeholder: '请输入联系人', span: 8 },
          { key: 'contact_phone', label: '电话', type: 'input', placeholder: '请输入联系电话', span: 8 },
          { key: 'visit_address', label: '拜访地址', type: 'input', placeholder: '请输入拜访地址', span: 8 },
          { key: 'task_type', label: '任务类型', type: 'select', placeholder: '请选择任务类型', options: [
            { label: '上门拜访', value: '上门拜访' },
            { label: '电话回访', value: '电话回访' },
            { label: '视频会议', value: '视频会议' },
            { label: '其他', value: '其他' }
          ], span: 8 },
          { key: 'salesman_user_id', label: '销售员', type: 'input-suffix', dialogType: 'employee', labelKey: 'salesman_user_name', placeholder: '请选择销售员', span: 8 },
          { key: 'visit_time', label: '拜访时间', type: 'date', placeholder: '请选择拜访时间', span: 8 },
          { key: 'visit_plan', label: '拜访计划', type: 'textarea', placeholder: '请输入拜访计划', rows: 3, span: 24 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  // ==================== 产品管理 ====================
  productCategory: {
    title: '新增产品类别',
    editTitle: '编辑产品类别',
    type: 'productCategory',
    module: 'product/category',
    successRoute: '/product/category',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getProductCategoryDetail(id)
      return res.data.category
    },
    submitCreate: (data) => createProductCategory(data),
    submitUpdate: (id, data) => updateProductCategory(id, data),
    tabs: [
      {
        label: '类别信息',
        fields: [
          { key: 'name', label: '类别名称', type: 'input', required: true, placeholder: '请输入类别名称', span: 8 },
          { key: 'parent_id', label: '上级产品类别', type: 'input-suffix', placeholder: '请选择上级产品类别（无则留空）', span: 8, suffixIcon: 'ArrowDown', labelKey: 'parent_name', loadTreeData: async () => { try { const res = await getProductCategoryTree(); return res.data } catch { const cached = sessionStorage.getItem('treeCache:productCategory'); return cached ? JSON.parse(cached) : [] } } },
          { key: 'sort_no', label: '排序号', type: 'number', defaultValue: 0, span: 8 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '禁用', value: 0 }
          ], span: 8 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  productUnit: {
    title: '新增计量单位',
    editTitle: '编辑计量单位',
    type: 'productUnit',
    module: 'product/unit',
    successRoute: '/product/unit',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getProductUnitDetail(id)
      return res.data.unit?.[0] || {}
    },
    submitCreate: (data) => createProductUnit({
      unit_name: data.unit_name,
      remark: data.remark
    }),
    submitUpdate: (id, data) => updateProductUnit({
      unit_id: id,
      status: Number(data.status),
      unit_name: data.unit_name,
      remark: data.remark
    }),
    tabs: [
      {
        label: '单位信息',
        fields: [
          { key: 'unit_name', label: '单位名称', type: 'input', required: true, placeholder: '请输入单位名称', span: 8 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '停用', value: 0 }
          ], span: 8 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  productInfo: {
    title: '新增产品资料',
    editTitle: '编辑产品资料',
    detailTitle: '滞销产品详细页',
    type: 'productInfo',
    module: 'product/info',
    successRoute: '/product/info',
    // 图片识别：仅新增态开放（编辑态留作 P3，防止误覆盖已录入数据），置于头部操作区（重置/保存左侧）
    extraActions: [
      { key: 'productRecognize', placement: 'header', show: ({ isEdit }) => !isEdit },
    ],
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getProductDetail(id)
      const data = res.data as any
      const uploadFiles = normalizeUploadDetailFiles(data)
      // 缓存原始销售价格ID，用于编辑时追踪删除
      if (data.sale_prices) {
        sessionStorage.setItem('productInfo:originalSalePriceIds', JSON.stringify(data.sale_prices.map((sp: any) => sp.sale_price_id)))
      }
      // 主供应商：后端不返回顶层 supplier_id，从 suppliers[0] 提取供字段回显
      if (data.suppliers?.length) {
        data.supplier_id = data.suppliers[0].supplier_id
        data.supplier_name = data.suppliers[0].supplier_name || ''
      }
      // 关联供应商列表映射到 product_suppliers（供 dynamic-table 回显）
      data.product_suppliers = data.suppliers || []
      // 编辑态回显：产品详情仅返回 supplier_id/name/model，需逐个回查供应商详情补全
      // 编码(supplier_code) / 详细地址(detail_address) / 电话(phone1) / 状态(status, status_name) 展示字段
      if (Array.isArray(data.product_suppliers)) {
        await Promise.all(data.product_suppliers.map(async (s: any) => {
          if (!s.supplier_id) return
          try {
            const sdRes = await getSupplierDetail(s.supplier_id)
            const sd = sdRes.data?.supplier?.[0]
            if (sd) {
              s.supplier_code = sd.supplier_code || ''
              s.detail_address = sd.detail_address || ''
              s.phone1 = sd.phone1 || ''
              s.status = sd.status
              s.status_name = sd.status === 1 ? '启用' : (sd.status === 0 ? '禁用' : '')
            }
          } catch {
            // 单条回查失败不阻断整体回显，缺失字段显示 '-'
          }
        }))
      }
      // 缓存原始关联供应商 ID，提交时用于差量计算
      sessionStorage.setItem('productInfo:originalSupplierIds', JSON.stringify((data.suppliers || []).map((s: any) => s.supplier_id)))
      return {
        ...data,
        ...uploadFiles,
      }
    },
    submitCreate: async (data, files) => {
      // 提交前统一行级校验（价格行/供应商行）：产品创建成功后价格或供应商接口
      // 才报错，会造成「产品已创建、价格/供应商未写入」的半提交状态
      validateProductFormTables(data)
      // 关联供应商表格：第一条 → create 接口的 supplier_id（必填）；其余行 → 新增接口(接口26)
      const associatedSuppliers: any[] = (data.product_suppliers || []).filter((s: any) => s.supplier_id)
      const mainSupplierId = associatedSuppliers[0].supplier_id
      const res = await createProduct({
        product_name: data.product_name,
        product_type: data.product_type,
        category_id: data.category_id,
        supplier_id: mainSupplierId,
        unit_id: data.unit_id,
        is_weighing: Number(data.is_weighing),
        factory_price: String(data.factory_price),
        fifo_flag: Number(data.fifo_flag),
        is_combined: Number(data.is_combined),
        gross_profit_ctrl_rate: String(data.gross_profit_ctrl_rate),
        product_status: data.product_status,
        item_no: data.item_no,
        specification: data.specification,
        origin_place: data.origin_place,
        color: data.color,
        unit_weight: data.unit_weight ? String(data.unit_weight) : undefined,
        weight_tolerance: data.weight_tolerance ? String(data.weight_tolerance) : undefined,
        assist_unit_id: data.assist_unit_id,
        convert_ratio: data.convert_ratio ? String(data.convert_ratio) : undefined,
        package_qty: data.package_qty ? String(data.package_qty) : undefined,
        production_cycle_days: data.production_cycle_days ? String(data.production_cycle_days) : undefined,
        stock_warning_qty: data.stock_warning_qty ? String(data.stock_warning_qty) : undefined,
        remark: data.remark
      }, files)
      // 绑定客户类型销售价格（接口17）
      const salePrices = data.sale_prices || []
      if (salePrices.length > 0 && res.data?.product_id) {
        await bindProductSalePrices(res.data.product_id, salePrices.map((r: any) => ({
          customer_type_id: r.customer_type_id,
          sale_price: String(r.sale_price),
          remark: r.remark || undefined
        })))
      }
      // 关联供应商：第一条已写入 create 的 supplier_id，其余行走新增接口(接口26)
      // 失败不再静默吞掉：产品已创建，供应商绑定失败需提示用户进编辑页补录
      const extraSuppliers = associatedSuppliers.slice(1)
      if (extraSuppliers.length > 0 && res.data?.product_id) {
        await addProductSupplier({
          product_id: res.data.product_id,
          supplier_id: extraSuppliers.map(s => ({
            supplier_id: s.supplier_id,
            supplier_model: s.supplier_model || undefined
          }))
        }, { errorMessagePrefix: '产品已创建，但关联供应商保存失败，请编辑补录' })
      }
      return res
    },
    submitUpdate: async (id, data, files) => {
      // 提交前统一行级校验：编辑是主接口+价格+供应商多接口先后提交，
      // 价格/供应商接口在后报错会造成半提交（原「请至少关联一个供应商」检查
      // 位于价格接口之后，同样有此问题），统一提前到所有请求之前
      validateProductFormTables(data)
      const res = await updateProduct({
        product_id: id,
        product_name: data.product_name,
        product_type: data.product_type,
        category_id: data.category_id,
        unit_id: data.unit_id,
        is_weighing: data.is_weighing !== undefined ? Number(data.is_weighing) : undefined,
        factory_price: data.factory_price ? String(data.factory_price) : undefined,
        fifo_flag: data.fifo_flag !== undefined ? Number(data.fifo_flag) : undefined,
        is_combined: data.is_combined !== undefined ? Number(data.is_combined) : undefined,
        gross_profit_ctrl_rate: data.gross_profit_ctrl_rate ? String(data.gross_profit_ctrl_rate) : undefined,
        product_status: data.product_status,
        item_no: data.item_no,
        specification: data.specification,
        origin_place: data.origin_place,
        color: data.color,
        unit_weight: data.unit_weight ? String(data.unit_weight) : undefined,
        weight_tolerance: data.weight_tolerance ? String(data.weight_tolerance) : undefined,
        assist_unit_id: data.assist_unit_id,
        convert_ratio: data.convert_ratio ? String(data.convert_ratio) : undefined,
        package_qty: data.package_qty ? String(data.package_qty) : undefined,
        production_cycle_days: data.production_cycle_days ? String(data.production_cycle_days) : undefined,
        stock_warning_qty: data.stock_warning_qty ? String(data.stock_warning_qty) : undefined,
        remark: data.remark
      }, files)
      // 处理客户类型销售价格（接口17/18/19）
      const salePriceErrorConfig = {
        errorMessagePrefix: '产品基本资料已保存，但客户价格保存失败'
      }
      const supplierErrorConfig = {
        errorMessagePrefix: '产品基本资料已保存，但关联供应商保存失败'
      }
      const salePrices: any[] = data.sale_prices || []
      const origIdsStr = sessionStorage.getItem('productInfo:originalSalePriceIds')
      const origIds: string[] = origIdsStr ? JSON.parse(origIdsStr) : []
      const currentIds = salePrices.filter((r: any) => r.sale_price_id).map((r: any) => r.sale_price_id)
      // 删除：原始有但当前没有的
      const deletedIds = origIds.filter((oid: string) => !currentIds.includes(oid))
      for (const sid of deletedIds) {
        await deleteProductSalePrice(sid).catch(() => {})
      }
      // 新增：没有 sale_price_id 的行
      const newPrices = salePrices.filter((r: any) => !r.sale_price_id)
      if (newPrices.length > 0) {
        await bindProductSalePrices(id, newPrices.map((r: any) => ({
          customer_type_id: r.customer_type_id,
          sale_price: String(r.sale_price),
          remark: r.remark || undefined
        })), salePriceErrorConfig)
      }
      // 更新：有 sale_price_id 的行
      const existingPrices = salePrices.filter((r: any) => r.sale_price_id)
      if (existingPrices.length > 0) {
        await updateProductSalePrices(id, existingPrices.map((r: any) => ({
          sale_price_id: r.sale_price_id,
          sale_price: String(r.sale_price),
          remark: r.remark || undefined
        })), salePriceErrorConfig)
      }
      sessionStorage.removeItem('productInfo:originalSalePriceIds')
      // 关联供应商：至少一条/重复已由提交前 validateProductFormTables 统一校验，此处仅做差量计算
      const associatedSuppliers: any[] = (data.product_suppliers || []).filter((s: any) => s.supplier_id)
      const origSupplierIdsStr = sessionStorage.getItem('productInfo:originalSupplierIds')
      const origSupplierIds: string[] = origSupplierIdsStr ? JSON.parse(origSupplierIdsStr) : []
      const supplierCurrentIds = associatedSuppliers.map((s: any) => s.supplier_id)
      // 删除：原始有但当前没有的（接口27 解绑）
      const supplierDeletedIds = origSupplierIds.filter((oid: string) => !supplierCurrentIds.includes(oid))
      for (const did of supplierDeletedIds) {
        await deleteProductSupplier({ product_id: id, supplier_id: did }).catch(() => {})
      }
      // 新增：当前有但原始没有的（接口26）。失败不再静默吞掉，提示用户补录
      const newSuppliers = associatedSuppliers.filter(s => !origSupplierIds.includes(s.supplier_id))
      if (newSuppliers.length > 0) {
        await addProductSupplier({
          product_id: id,
          supplier_id: newSuppliers.map(s => ({
            supplier_id: s.supplier_id,
            supplier_model: s.supplier_model || undefined
          }))
        }, supplierErrorConfig)
      }
      sessionStorage.removeItem('productInfo:originalSupplierIds')
      return res
    },
    tabs: [
      {
        label: '基本信息',
        fields: [
          { key: 'section-base', label: '产品基本信息', type: 'section', span: 24 },
          { key: 'product_name', label: '产品名称', type: 'input', required: true, placeholder: '请输入产品名称', span: 8 },
          { key: 'product_type', label: '产品类型', type: 'select', required: true, placeholder: '请选择产品类型', options: [
            { label: '实物商品', value: 'GOODS' }, { label: '虚拟商品', value: 'VIRTUAL' }
          ], span: 8 },
          { key: 'product_status', label: '产品状态', type: 'select', required: true, placeholder: '请选择产品状态', options: [
            { label: '在售', value: 'ON_SALE' }, { label: '停售', value: 'OFF_SALE' }, { label: '停产', value: 'DISCONTINUED' }
          ], span: 8 },
          { key: 'item_no', label: '货号', type: 'input', placeholder: '请输入货号', span: 8 },
          { key: 'category_id', label: '产品类别', type: 'input-suffix', required: true, placeholder: '请选择产品类别', span: 8, suffixIcon: 'ArrowDown', labelKey: 'category_name', loadTreeData: async () => { try { const res = await getProductCategoryTree(); const data = res.data; sessionStorage.setItem('treeCache:productCategory', JSON.stringify(data)); return data } catch { const c = sessionStorage.getItem('treeCache:productCategory'); return c ? JSON.parse(c) : [] } } },
          { key: 'specification', label: '规格型号', type: 'input', placeholder: '请输入规格型号', span: 8 },
          { key: 'origin_place', label: '产地', type: 'input', placeholder: '请输入产地', span: 8 },
          { key: 'color', label: '颜色', type: 'input', placeholder: '请输入颜色', span: 8 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 },
          { key: 'section-price-bind', label: '客户价格绑定', type: 'section', span: 24 },
          { key: 'sale_prices', label: '客户价格', type: 'dynamic-table', showIndex: true, addLabel: '新增价格', span: 24, columns: [
            { key: 'sale_price', label: '销售价格', type: 'input', required: true },
            { key: 'gross_profit_rate', label: '毛利率(%)', type: 'input' },
            { key: 'customer_type_id', label: '客户类型', type: 'select', required: true, loadOptions: async () => {
              // 客户价格绑定跨页依赖客户类型查询权限：纯产品权限角色进表单时静默走缓存/空选项，避免挂载即 403 弹窗
              if (!usePermissionStore().hasPerm('perm_api_crm_query_customer_types')) {
                const c = sessionStorage.getItem('optionsCache:customerType')
                return c ? JSON.parse(c) : []
              }
              try {
                const res = await getCustomerTypeList({})
                // 过滤停用类型：后端 sale-prices/create 会拒绝失效客户类型（:3297），
                // 从选项源头屏蔽，避免用户选到注定被驳回的项
                const opts = res.data.customer_type.filter((t: any) => t.status === 1).map((t: any) => ({ label: t.type_name, value: t.customer_type_id }))
                sessionStorage.setItem('optionsCache:customerType', JSON.stringify(opts))
                return opts
              } catch {
                const c = sessionStorage.getItem('optionsCache:customerType')
                return c ? JSON.parse(c) : []
              }
            } },
            { key: 'remark', label: '备注', type: 'input' }
          ] },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '产品图片', type: 'image-upload', maxImages: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteProductImages(editId, [file.url]) } },
          { key: 'attachments', label: '产品附件', type: 'file-upload', maxFiles: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteProductAttachments(editId, [file.url]) } },
          { key: 'section-suppliers', label: '关联供应商（首行即为主供应商）', type: 'section', span: 24 },
          { key: 'product_suppliers', label: '关联供应商', type: 'dynamic-table', showIndex: true, addLabel: '新增供应商', span: 24, columns: [
            { key: 'supplier_name', label: '供应商名称', type: 'dialog-select', dialogType: 'supplier', labelKey: 'supplier_name' },
            { key: 'supplier_code', label: '编码', type: 'display' },
            { key: 'detail_address', label: '详细地址', type: 'display' },
            { key: 'phone1', label: '电话', type: 'display' },
            { key: 'status_name', label: '状态', type: 'display' },
          ] },
        ]
      },
      {
        label: '单位与重量',
        fields: [
          { key: 'section-unit', label: '计量单位', type: 'section', span: 24 },
          { key: 'unit_id', label: '主计量单位', type: 'select', required: true, placeholder: '请选择主计量单位', options: [], span: 8, loadOptions: async () => { try { const res = await getProductUnitList(); const opts = res.data.unit.map(u => ({ label: u.unit_name, value: u.unit_id })); sessionStorage.setItem('optionsCache:productUnit', JSON.stringify(opts)); return opts } catch { const c = sessionStorage.getItem('optionsCache:productUnit'); return c ? JSON.parse(c) : [] } } },
          { key: 'unit_weight', label: '单位重量', type: 'number', defaultValue: 0, span: 8 },
          { key: 'is_weighing', label: '是否称重', type: 'radio', required: true, defaultValue: 0, options: [
            { label: '是', value: 1 as any }, { label: '否', value: 0 as any }
          ], span: 24 },
          { key: 'weight_tolerance', label: '重量公差', type: 'number', defaultValue: 0, span: 8 },
          { key: 'assist_unit_id', label: '辅助计量单位', type: 'select', placeholder: '请选择辅助计量单位', options: [], span: 8, loadOptions: async () => { const c = sessionStorage.getItem('optionsCache:productUnit'); return c ? JSON.parse(c) : [] } },
          { key: 'convert_ratio', label: '换算比例', type: 'number', defaultValue: 1, span: 8 }
        ]
      },
      {
        label: '价格与库存',
        fields: [
          { key: 'section-price', label: '价格设置', type: 'section', span: 24 },
          { key: 'factory_price', label: '预设出厂价', type: 'number', required: true, span: 8,
            rules: [{ validator: (_r: any, value: any, cb: (err?: Error) => void) => {
              if (value === '' || value === null || value === undefined) return cb()
              if (Number(value) > 0) cb()
              else cb(new Error('预设出厂价必须大于0'))
            }, trigger: 'blur' }] },
          { key: 'gross_profit_ctrl_rate', label: '毛利控制比例(%)', type: 'number', required: true, placeholder: '如10表示10%', span: 8,
            rules: [{ validator: (_r: any, value: any, cb: (err?: Error) => void) => {
              if (value === '' || value === null || value === undefined) return cb()
              const rate = Number(value)
              if (rate >= 0 && rate < 100) cb()
              else cb(new Error('毛利控制比例需在0到100之间（如10表示10%）'))
            }, trigger: 'blur' }] },
          { key: 'min_sale_price', label: '最低销售价格', type: 'computed', span: 8, money: true,
            compute: (f: Record<string, any>) => {
              const price = Number(f.factory_price) || 0
              const ratePercent = Number(f.gross_profit_ctrl_rate) || 0
              if (ratePercent < 0 || ratePercent >= 100) return 0 // 越界（后端会拒绝），这里兜底显示 0
              const divisor = 1 - ratePercent / 100
              if (divisor <= 0) return 0
              const v = price / divisor
              return Math.round(v * 100) / 100
            } },
          { key: 'is_combined', label: '是否组合产品', type: 'radio', required: true, defaultValue: 0, options: [
            { label: '是', value: 1 as any }, { label: '否', value: 0 as any }
          ], span: 24 },
          { key: 'section-inventory', label: '库存与生产', type: 'section', span: 24 },
          // { key: 'available_stock', label: '可用库存', type: 'computed', span: 8 },
          { key: 'fifo_flag', label: '是否先进先出', type: 'radio', required: true, defaultValue: 1, options: [
            { label: '是', value: 1 as any }, { label: '否', value: 0 as any }
          ], span: 24 },
          { key: 'package_qty', label: '包装数量', type: 'number', defaultValue: 0, span: 8 },
          { key: 'stock_warning_qty', label: '库存预警数量', type: 'number', defaultValue: 0, span: 8 },
          { key: 'production_cycle_days', label: '生产周期(天)', type: 'number', defaultValue: 0, span: 8 }
        ]
      }
    ]
  },

  // ==================== 仓库管理 ====================
  warehouseLocation: {
    title: '新增仓库',
    editTitle: '编辑仓库',
    type: 'warehouseLocation',
    module: 'warehouse/location',
    successRoute: '/warehouse/location',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getWarehouseDetail(id)
      const d = res.data as unknown as Record<string, any>
      // 后端返回枚举英文值（如 EAST/OWN），表单下拉选项 value 是中文，用 _label 回填
      if (d.warehouse_region_label) d.warehouse_region = d.warehouse_region_label
      if (d.warehouse_type_label) d.warehouse_type = d.warehouse_type_label
      return d
    },
    submitCreate: (data) => createWarehouse({
      warehouse_region: data.warehouse_region,
      area_id: data.area_id || '',
      warehouse_name: data.warehouse_name,
      warehouse_no: data.warehouse_no,
      warehouse_type: data.warehouse_type,
      warehouse_address: data.warehouse_address || '',
      contact_name: data.contact_name || '',
      contact_phone: data.contact_phone || '',
      status: String(data.status ?? 1),
      remark: data.remark || undefined,
    }),
    submitUpdate: (id, data) => updateWarehouse(id, {
      warehouse_region: data.warehouse_region || undefined,
      area_id: data.area_id || undefined,
      warehouse_name: data.warehouse_name || undefined,
      warehouse_no: data.warehouse_no || undefined,
      warehouse_type: data.warehouse_type || undefined,
      warehouse_address: data.warehouse_address || undefined,
      contact_name: data.contact_name || undefined,
      contact_phone: data.contact_phone || undefined,
      status: data.status !== '' && data.status !== undefined ? String(data.status) : undefined,
      remark: data.remark || undefined,
    }),
    tabs: [
      {
        label: '仓库信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'warehouse_name', label: '仓库名称', type: 'input', required: true, placeholder: '请输入仓库名称', span: 8 },
          { key: 'warehouse_no', label: '仓库编号', type: 'input', required: true, placeholder: '请输入仓库编号', span: 8 },
          { key: 'warehouse_region', label: '仓库区域', type: 'select', required: true, placeholder: '请选择仓库区域', options: [
            { label: '东北', value: '东北' }, { label: '华东', value: '华东' }, { label: '华中', value: '华中' },
            { label: '华南', value: '华南' }, { label: '西南', value: '西南' }, { label: '西北', value: '西北' }
          ], span: 8 },
          { key: 'warehouse_type', label: '仓库类型', type: 'select', required: true, placeholder: '请选择仓库类型', options: [
            { label: '自营仓库', value: '自营仓库' }, { label: '合作仓库', value: '合作仓库' }
          ], span: 8 },
          { key: 'area_id', label: '行政区划', type: 'tree-select', required: true, placeholder: '请选择行政区划', span: 8, filterable: true, checkStrictly: true, treeProps: { label: 'area_name', children: 'children', value: 'area_id' }, loadTreeData: async () => { try { const res = await getAreaList({}); return res.data.area || [] } catch { return [] } } },
          { key: 'warehouse_address', label: '仓库地址', type: 'input', required: true, placeholder: '请输入仓库地址', span: 16 },
          { key: 'contact_name', label: '联系人', type: 'input', required: true, placeholder: '请输入联系人名称', span: 8 },
          { key: 'contact_phone', label: '联系电话', type: 'input', required: true, placeholder: '请输入联系人电话', span: 8 },
          { key: 'status', label: '状态', type: 'radio', required: true, defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '停用', value: 0 }
          ], span: 8 },
          { key: 'section-extra', label: '附加信息', type: 'section', span: 24 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  warehouseShelf: {
    title: '新增放货货位',
    editTitle: '编辑放货货位',
    type: 'warehouseShelf',
    module: 'warehouse/shelf',
    successRoute: '/warehouse/shelf',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getStagingSpotDetail(id)
      return res.data as unknown as Record<string, any>
    },
    submitCreate: (data) => createStagingSpot({
      spot_name: data.spot_name,
      remark: data.remark || undefined,
    }),
    submitUpdate: (id, data) => updateStagingSpot(id, {
      spot_name: data.spot_name || undefined,
      remark: data.remark !== undefined ? (data.remark || '') : undefined,
    }),
    tabs: [
      {
        label: '放货货位信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'spot_name', label: '货位名称', type: 'input', required: true, placeholder: '请输入货位名称（不可重命）', span: 12 },
          { key: 'section-extra', label: '附加信息', type: 'section', span: 24 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  warehouseLocationChild: {
    title: '新增下级库位',
    editTitle: '编辑下级库位',
    type: 'warehouseLocationChild',
    module: 'warehouse/location-child',
    successRoute: '/warehouse/location',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getLocationDetail(id)
      const d = res.data as unknown as Record<string, any>
      // 后端返回枚举英文值（如 SHELF），表单下拉选项 value 是中文，用 _label 回填
      if (d.location_type_label) d.location_type = d.location_type_label
      return d
    },
    submitCreate: (data) => createLocation({
      parent_id: data.parent_id || '',
      location_no: data.location_no,
      location_name: data.location_name,
      simple_code: data.simple_code,
      location_type: data.location_type,
      location_desc: data.location_desc || '',
      status: String(data.status ?? 1),
      sort_no: String(data.sort_no ?? 1),
      remark: data.remark || undefined,
    }),
    submitUpdate: (id, data) => updateLocation(id, {
      parent_id: data.parent_id || undefined,
      location_no: data.location_no || undefined,
      location_name: data.location_name || undefined,
      simple_code: data.simple_code || undefined,
      location_type: data.location_type || undefined,
      location_desc: data.location_desc || undefined,
      status: data.status !== '' && data.status !== undefined ? String(data.status) : undefined,
      sort_no: data.sort_no !== '' && data.sort_no !== undefined ? String(data.sort_no) : undefined,
      remark: data.remark || undefined,
    }),
    tabs: [
      {
        label: '货位信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'parent_id', label: '上级库位名称', type: 'tree-select', required: true, placeholder: '请选择上级仓库或货位', span: 8, checkStrictly: true, filterable: true, treeProps: { label: 'name', children: 'children', value: 'id' }, loadTreeData: async () => { try { const res = await getWarehouseTree({ page: 1 }); const warehouses = (res.data.warehouse as any[]) || []; const normalize = (nodes: any[]): any[] => nodes.map(n => ({ id: n.warehouse_id || n.location_id || n.id, name: n.warehouse_name || n.location_name || n.name, children: n.children?.length ? normalize(n.children) : [] })); return normalize(warehouses); } catch { return [] } } },
          { key: 'location_no', label: '货位编号', type: 'input', required: true, placeholder: '请输入货位编号', span: 8 },
          { key: 'location_name', label: '货位名称', type: 'input', required: true, placeholder: '请输入货位名称（不可重命）', span: 8 },
          { key: 'simple_code', label: '简码', type: 'input', required: true, placeholder: '请输入简码', span: 8 },
          { key: 'location_type', label: '货位类型', type: 'select', required: true, placeholder: '请选择货位类型', options: [
            { label: '货架', value: '货架' }, { label: '托盘', value: '托盘' }
          ], span: 8 },
          { key: 'sort_no', label: '排序号', type: 'number', required: true, defaultValue: 1, span: 8, rules: [{ type: 'number', min: 1, message: '排序号必须大于0的整数', trigger: 'blur' }] },
          { key: 'status', label: '状态', type: 'radio', required: true, defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '停用', value: 0 }
          ], span: 8 },
          { key: 'location_desc', label: '货位描述', type: 'textarea', required: true, placeholder: '请输入货位描述', rows: 3, span: 24 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  warehousePlastic: {
    title: '新增塑料盒',
    editTitle: '编辑塑料盒',
    type: 'warehousePlastic',
    module: 'warehouse/plastic',
    successRoute: '/warehouse/plastic',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getPlasticBoxDetail(id)
      return res.data as unknown as Record<string, any>
    },
    submitCreate: (data) => createPlasticBox({
      box_name: data.box_name,
      box_code: data.box_code,
      remark: data.remark || undefined,
    }),
    submitUpdate: (id, data) => updatePlasticBox(id, {
      box_name: data.box_name || undefined,
      box_code: data.box_code || undefined,
      remark: data.remark || undefined,
    }),
    tabs: [
      {
        label: '塑料盒信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'box_name', label: '塑料盒名称', type: 'input', required: true, placeholder: '请输入塑料盒名称', span: 8 },
          { key: 'box_code', label: '塑料盒编码', type: 'input', required: true, placeholder: '请输入塑料盒编码', span: 8 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  warehouseShelfBind: {
    title: '产品货架绑定',
    editTitle: '编辑产品货架绑定',
    type: 'warehouseShelfBind',
    module: 'warehouse/shelf-bind',
    successRoute: '/warehouse/shelf-bind',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const data = sessionStorage.getItem('editData:warehouseShelfBind')
      return data ? JSON.parse(data) : {}
    },
    submitCreate: (data) => createBarcode({ ...data, type: '绑定' }),
    submitUpdate: (id, data) => updateBarcode(id, data),
    tabs: [
      {
        label: '绑定信息',
        fields: [
          { key: 'section-base', label: '产品信息', type: 'section', span: 24 },
          { key: 'productCode', label: '产品编码', type: 'input', required: true, placeholder: '请输入产品编码', span: 8 },
          { key: 'productName', label: '产品名称', type: 'input', required: true, placeholder: '请输入产品名称', span: 8 },
          { key: 'productSpec', label: '产品规格', type: 'input', placeholder: '请输入产品规格', span: 8 },
          { key: 'section-location', label: '仓位信息', type: 'section', span: 24 },
          { key: 'warehouseId', label: '仓库', type: 'tree-select', required: true, placeholder: '请选择仓库', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'locationId', label: '库位', type: 'tree-select', required: true, placeholder: '请选择库位', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'shelfId', label: '货位', type: 'tree-select', required: true, placeholder: '请选择货位', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'boxId', label: '塑料盒', type: 'tree-select', placeholder: '请选择塑料盒', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'quantity', label: '绑定数量', type: 'number', required: true, defaultValue: 1, span: 8 },
          { key: 'section-extra', label: '附加信息', type: 'section', span: 24 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  warehouseBarcodeIn: {
    title: '新增入库条码',
    editTitle: '编辑入库条码',
    type: 'warehouseBarcodeIn',
    module: 'warehouse/barcode-in',
    successRoute: '/warehouse/barcode-in',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getBarcodeDetail(id)
      return res.data
    },
    submitCreate: (data) => createBarcode({ ...data, type: '入库', businessType: '采购入库' }),
    submitUpdate: (id, data) => updateBarcode(id, data),
    tabs: [
      {
        label: '入库条码信息',
        fields: [
          { key: 'section-base', label: '条码信息', type: 'section', span: 24 },
          { key: 'barcode', label: '条形码编码', type: 'input', required: true, placeholder: '请输入条形码编码', span: 8 },
          { key: 'productCode', label: '产品编码', type: 'input', required: true, placeholder: '请输入产品编码', span: 8 },
          { key: 'productName', label: '产品名称', type: 'input', required: true, placeholder: '请输入产品名称', span: 8 },
          { key: 'productSpec', label: '产品规格', type: 'input', placeholder: '请输入产品规格', span: 8 },
          { key: 'companyId', label: '绑定公司', type: 'tree-select', placeholder: '请选择绑定公司', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'color', label: '颜色', type: 'input', placeholder: '请输入颜色', span: 8 },
          { key: 'unit', label: '计量单位', type: 'select', placeholder: '请选择计量单位', options: [], span: 8, loadOptions: async () => { try { const res = await getProductUnitList(); const opts = res.data.unit.map(u => ({ label: u.unit_name, value: u.unit_name })); sessionStorage.setItem('optionsCache:productUnit', JSON.stringify(opts)); return opts } catch { const c = sessionStorage.getItem('optionsCache:productUnit'); return c ? JSON.parse(c) : [] } } },
          { key: 'origin', label: '原产地', type: 'input', placeholder: '请输入原产地', span: 8 },
          { key: 'quantity', label: '数量', type: 'number', required: true, defaultValue: 1, span: 8 },
          { key: 'printDate', label: '打印日期', type: 'date', placeholder: '请选择打印日期', span: 8 },
          { key: 'businessNo', label: '入库单', type: 'input', placeholder: '请输入入库单号', span: 8 }
        ]
      }
    ]
  },

  warehouseBarcodeOut: {
    title: '新增出库条码',
    editTitle: '编辑出库条码',
    type: 'warehouseBarcodeOut',
    module: 'warehouse/barcode-out',
    successRoute: '/warehouse/barcode-out',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getBarcodeDetail(id)
      return res.data
    },
    submitCreate: (data) => createBarcode({ ...data, type: '出库', businessType: '销售出库' }),
    submitUpdate: (id, data) => updateBarcode(id, data),
    tabs: [
      {
        label: '出库条码信息',
        fields: [
          { key: 'section-base', label: '条码信息', type: 'section', span: 24 },
          { key: 'barcode', label: '条形码编码', type: 'input', required: true, placeholder: '请输入条形码编码', span: 8 },
          { key: 'productCode', label: '产品编码', type: 'input', required: true, placeholder: '请输入产品编码', span: 8 },
          { key: 'productName', label: '产品名称', type: 'input', required: true, placeholder: '请输入产品名称', span: 8 },
          { key: 'productSpec', label: '产品规格', type: 'input', placeholder: '请输入产品规格', span: 8 },
          { key: 'companyId', label: '绑定公司', type: 'tree-select', placeholder: '请选择绑定公司', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'color', label: '颜色', type: 'input', placeholder: '请输入颜色', span: 8 },
          { key: 'unit', label: '计量单位', type: 'select', placeholder: '请选择计量单位', options: [], span: 8, loadOptions: async () => { const c = sessionStorage.getItem('optionsCache:productUnit'); if (c) return JSON.parse(c); try { const res = await getProductUnitList(); const opts = res.data.unit.map(u => ({ label: u.unit_name, value: u.unit_name })); sessionStorage.setItem('optionsCache:productUnit', JSON.stringify(opts)); return opts } catch { return [] } } },
          { key: 'origin', label: '原产地', type: 'input', placeholder: '请输入原产地', span: 8 },
          { key: 'quantity', label: '数量', type: 'number', required: true, defaultValue: 1, span: 8 },
          { key: 'printDate', label: '打印日期', type: 'date', placeholder: '请选择打印日期', span: 8 },
          { key: 'section-delivery', label: '收货信息', type: 'section', span: 24 },
          { key: 'receiver', label: '收货人', type: 'input', placeholder: '请输入收货人', span: 8 },
          { key: 'address', label: '地址', type: 'input', placeholder: '请输入收货地址', span: 8 },
          { key: 'businessNo', label: '出库单', type: 'input', placeholder: '请输入出库单号', span: 8 }
        ]
      }
    ]
  },

  warehouseBarcodeLogistics: {
    title: '新增物流条码',
    editTitle: '编辑物流条码',
    type: 'warehouseBarcodeLogistics',
    module: 'warehouse/barcode-logistics',
    successRoute: '/warehouse/barcode-logistics',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getBarcodeDetail(id)
      return res.data
    },
    submitCreate: (data) => createBarcode({ ...data, type: '物流', businessType: '物流发货' }),
    submitUpdate: (id, data) => updateBarcode(id, data),
    tabs: [
      {
        label: '物流条码信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'barcode', label: '物流单号', type: 'input', required: true, placeholder: '请输入物流单号', span: 12 },
          { key: 'businessNo', label: '出库单号', type: 'input', required: true, placeholder: '请输入出库单号', span: 12 },
          { key: 'printDate', label: '打印日期', type: 'date', placeholder: '请选择打印日期', span: 12 }
        ]
      }
    ]
  },

  // ==================== 销售管理 ====================
  salesOrder: {
    title: '新增销售订单',
    editTitle: '编辑销售订单',
    type: 'salesOrder',
    module: 'sales/order',
    successRoute: '/sales/order',
    labelWidth: '110px',
    labelPosition: 'top',
    // 动态表格行内动作注册表：AddTemplate 操作列按钮通过它回调（如缺货行「生成订货单」）
    __tableActionHandlers: { shortage: onSalesOrderShortageAction },
    // 一键创建收款单：仅编辑态显示（需读取已加载的销售订单数据），置于头部操作区
    extraActions: [
      { key: 'createReceipt', placement: 'header', show: ({ isEdit }) => isEdit },
    ],
    loadDetail: async (id: string) => {
      const res = await getSalesOrderDetailV2(id)
      const data = res.data as any
      // 后端契约：枚举字段返回双份（中文显示名 + 标准值 *_value）。
      // 表单 select 的 value 为标准值，此处将中文回显转为标准值，保证下拉回显与提交判断（如 PREPAYMENT）一致。
      if (data && data.settlement_method_value) {
        data.settlement_method = data.settlement_method_value
      }
      // 明细行补充「可用库存」：销售订单详情不含库存字段，逐行调用产品资料接口获取
      // （/tenant-products/detail 返回 available_stock，已扣减采购退货预占量，与产品列表口径一致）
      if (Array.isArray(data?.items)) {
        await Promise.all(data.items.map(async (item: any) => {
          if (!item.product_id) return
          try {
            const p = await getProductDetail(item.product_id)
            item.available_stock = p.data?.available_stock
          } catch {
            item.available_stock = undefined
          }
        }))
      }
      return data
    },
    submitCreate: (data) => createSalesOrderV2({
      ...data,
      prepayment_ratio: data.settlement_method === 'PREPAYMENT' ? (data.prepayment_ratio ?? 0) : undefined,
      items: JSON.stringify(
        (Array.isArray(data.items) ? data.items : []).map((item: any) => ({
          product_id: item.product_id,
          qty: item.qty,
          discount_price: item.discount_price,
          tax_rate: item.tax_rate,
          line_remark: item.line_remark,
        }))
      ),
    } as any),
    submitUpdate: async (_id, data) => {
      const { items, ...headerData } = data as any
      await updateSalesOrderV2(headerData as any)
      if (!Array.isArray(items) || items.length === 0) return

      const existingItems = items.filter((item: any) => String(item?.sales_order_item_id || '').trim())
      const newItems = items.filter((item: any) => !String(item?.sales_order_item_id || '').trim())

      if (existingItems.length > 0) {
        await updateSalesOrderItems(
          headerData.sales_order_id,
          existingItems.map((item: any) => ({
            sales_order_item_id: item.sales_order_item_id,
            qty: item.qty,
            discount_price: item.discount_price,
            tax_rate: item.tax_rate,
            line_remark: item.line_remark,
          }))
        )
      }

      if (newItems.length > 0) {
        await addSalesOrderItems(
          headerData.sales_order_id,
          newItems.map((item: any) => ({
            product_id: item.product_id,
            qty: item.qty,
            discount_price: item.discount_price,
            tax_rate: item.tax_rate,
            line_remark: item.line_remark,
          }))
        )
      }
    },
    tabs: [
      {
        label: '基本信息',
        fields: [
          { key: 'section-base', label: '订单信息', type: 'section', span: 24 },
          { key: 'bill_type', label: '单据类型', type: 'select', required: true, placeholder: '请选择单据类型', options: [
            { label: '销售', value: 'SALES' }, { label: '售后', value: 'AFTER_SALE' }
          ], span: 8 },
          { key: 'settlement_method', label: '结算方式', type: 'select', required: true, placeholder: '请选择结算方式', options: [
            { label: '现结', value: 'CASH' }, { label: '月结', value: 'MONTHLY' }, { label: '挂账', value: 'CREDIT' }, { label: '预付款', value: 'PREPAYMENT' }
          ], span: 8 },
          { key: 'customer_id', label: '客户', type: 'input-suffix', required: true, placeholder: '请选择客户', dialogType: 'customer', labelKey: 'customer_name', span: 8 },
          { key: 'outbound_date', label: '出库日期', type: 'date', placeholder: '请选择出库日期', span: 8 },
          { key: 'prepayment_ratio', label: '预付款比例(%)', type: 'number', defaultValue: 0, span: 8,
            visible: (formData: Record<string, any>) => formData.settlement_method === 'PREPAYMENT' },
          { key: 'section-delivery', label: '收货与配送', type: 'section', span: 24 },
          { key: 'city', label: '所在城市', type: 'tree-select', placeholder: '请选择省份 / 城市', span: 8, filterable: true, clearable: true, treeProps: { label: 'label', children: 'children', value: 'value' }, loadTreeData: () => loadCityTree(), regionSource: true, syncTo: 'receive_address', syncTransform: (v: any) => (v ? String(v).replace(/\s*\/\s*/g, '') : v) },
          { key: 'receive_address', label: '收货地址', type: 'input', placeholder: '请输入收货地址', span: 16 },
          { key: 'delivery_method', label: '配送方式', type: 'select', placeholder: '请选择配送方式', options: [
            { label: '配送', value: 'DELIVERY' }, { label: '快递', value: 'EXPRESS' }, { label: '自提', value: 'SELF_PICKUP' }
          ], span: 8 },
          { key: 'carrier_company_id', label: '承运公司', type: 'select', placeholder: '请选择承运公司', span: 8,
            loadOptions: async () => {
              if (!usePermissionStore().hasPerm('perm_api_crm_query_logistics')) return []
              const res = await getLogisticsCompanyList({})
              return (res.data?.logistics_company || []).map((c: any) => ({ label: c.company_name, value: c.logistics_company_id }))
            }
          },
          { key: 'settlement_bank_id', label: '结算银行', type: 'select', placeholder: '请选择结算银行', span: 8,
            loadOptions: async () => {
              if (!usePermissionStore().hasPerm('perm_api_fin_list_bank')) return []
              const res = await getBankAccountList({ page_size: 100 } as any)
              return (res.data?.items || []).map((b: any) => ({ label: `${b.bank_name} - ${b.account_name}`, value: b.bank_account_id }))
            }
          },
          { key: 'customer_remark', label: '客户备注', type: 'textarea', placeholder: '请输入客户备注', rows: 3, span: 24 }
        ]
      },
      {
        label: '订单明细',
        fields: [
          { key: 'items', label: '', type: 'dynamic-table', span: 24,
            addLabel: '添加产品',
            addViaDialog: true,
            addDialogType: 'product',
            showIndex: true,
            columns: [
              { key: 'product_code', label: '产品编号', width: 130, type: 'display' },
              { key: 'product_name', label: '产品名称', width: 160, type: 'display' },
              { key: 'category_name', label: '分类', width: 110 },
              { key: 'unit_name', label: '单位', width: 80 },
              { key: 'available_stock', label: '可用库存', width: 110, type: 'display' },
              { key: 'qty', label: '数量', width: 100, type: 'input', onInput: onSalesOrderQtyInput },
              { key: 'actual_out_qty', label: '实际出库', width: 100, type: 'display' },
              { key: 'pending_out_qty', label: '待出库', width: 100, type: 'display' },
              { key: 'pending_return_qty', label: '待退货', width: 100, type: 'display' },
              { key: 'discount_price', label: '折后单价', width: 120, type: 'input' },
              { key: 'tax_rate', label: '税率', width: 90, type: 'input' },
              { key: 'line_sales_amount', label: '总原价', width: 100, type: 'computed',
                compute: (row: Record<string, any>) => {
                  const ls = Number(row.line_sales_amount)
                  if (row.line_sales_amount !== undefined && row.line_sales_amount !== null && row.line_sales_amount !== '' && !isNaN(ls)) return ls.toFixed(2)
                  const sp = Number(row.sale_price) * Number(row.qty)
                  if (!isNaN(sp) && sp > 0) return sp.toFixed(2)
                  return ((Number(row.discount_price) || 0) * (Number(row.qty) || 0)).toFixed(2)
                } },
              { key: 'line_payable_amount', label: '总应支付价', width: 100, type: 'computed',
                compute: (row: Record<string, any>) => {
                  const lr = Number(row.line_receivable_amount)
                  if (row.line_receivable_amount !== undefined && row.line_receivable_amount !== null && row.line_receivable_amount !== '' && !isNaN(lr)) return lr.toFixed(2)
                  return ((Number(row.discount_price) || 0) * (Number(row.qty) || 0)).toFixed(2)
                } },
              { key: 'line_gift_amount', label: '总优惠金额', width: 100, type: 'computed',
                compute: (row: Record<string, any>) => {
                  const ls = Number(row.line_sales_amount)
                  const lr = Number(row.line_receivable_amount)
                  if (row.line_sales_amount !== undefined && row.line_receivable_amount !== undefined && row.line_receivable_amount !== null && row.line_receivable_amount !== '' && !isNaN(ls) && !isNaN(lr)) return (ls - lr).toFixed(2)
                  const ug = Number(row.use_gift_amount)
                  if (!isNaN(ug) && ug > 0) return ug.toFixed(2)
                  return '0.00'
                } },
              { key: 'line_remark', label: '备注', width: 140, type: 'input' }
            ]
          },
          { key: 'section-amount', label: '金额调整', type: 'section', span: 24 },
          { key: 'use_prepayment_amount', label: '使用预付款', type: 'number', defaultValue: 0, span: 8 },
          { key: 'use_gift_amount', label: '使用赠送金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'rounding_amount', label: '抹零金额', type: 'number', defaultValue: 0, span: 8 }
        ]
      }
    ]
  },

  salesReturn: {
    title: '新增销售退货单',
    editTitle: '编辑销售退货单',
    type: 'salesReturn',
    module: 'sales/return',
    successRoute: '/sales/return',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getSalesReturnDetailV2(id)
      const data = res.data as any
      const uploadFiles = normalizeUploadDetailFiles(data)
      return {
        ...data,
        ...uploadFiles,
        return_method: data.return_method_label || data.return_method,
        is_refund_gift_amount: String(data.is_refund_gift_amount ?? '0'),
        is_refund_prepayment_amount: String(data.is_refund_prepayment_amount ?? '0'),
        has_sales_record: String(data.has_sales_record ?? '1'),
        items: Array.isArray(data.items)
          ? data.items.map((item: any) => ({
              ...item,
              product_status: item.product_status_label || item.product_status,
            }))
          : data.items,
      }
    },
    submitCreate: async (data, files) => {
      if (!data.customer_id) throw new Error('请选择客户')
      if (!data.return_method) throw new Error('请选择退货方式')
      const items = (data.items as any[] || []).map((row: any) => ({
        sales_order_item_id: row.sales_order_item_id,
        return_qty: String(row.return_qty || '1'),
        return_price: String(row.return_price || '0'),
        product_status: row.product_status || undefined,
        remark: row.remark || undefined,
      }))
      if (!items.length) throw new Error('请至少添加一条退货明细')
      const salesOrderId = (data.items as any[])[0]?.sales_order_id
      if (!salesOrderId) throw new Error('退货明细缺少关联销售订单信息，请重新选择')
      const methodMap: Record<string, string> = { '退货退款': 'RETURN_AND_REFUND', '仅退货': 'RETURN_ONLY', '仅退款': 'REFUND_ONLY' }
      return createSalesReturnV2({
        customer_id: data.customer_id,
        return_method: methodMap[data.return_method] || data.return_method,
        items: JSON.stringify(items),
        has_sales_record: '1',
        sales_order_id: salesOrderId,
        return_date: formatDate(data.return_date) || undefined,
        inbound_date: formatDate(data.inbound_date) || undefined,
        is_refund_gift_amount: data.is_refund_gift_amount === '1' ? '1' : '0',
        refund_gift_amount: data.is_refund_gift_amount === '1' ? String(data.refund_gift_amount || '0') : undefined,
        is_refund_prepayment_amount: data.is_refund_prepayment_amount === '1' ? '1' : '0',
        refund_prepayment_amount: data.is_refund_prepayment_amount === '1' ? String(data.refund_prepayment_amount || '0') : undefined,
        remark: data.remark || undefined,
      }, files)
    },
    submitUpdate: async (id, data, files) => {
      const methodMap: Record<string, string> = { '退货退款': 'RETURN_AND_REFUND', '仅退货': 'RETURN_ONLY', '仅退款': 'REFUND_ONLY' }
      return updateSalesReturnV2({
        sales_return_id: id,
        return_method: data.return_method ? (methodMap[data.return_method] || data.return_method) : undefined,
        return_date: formatDate(data.return_date) || undefined,
        inbound_date: formatDate(data.inbound_date) || undefined,
        is_refund_gift_amount: data.is_refund_gift_amount !== undefined ? String(data.is_refund_gift_amount) : undefined,
        refund_gift_amount: data.is_refund_gift_amount === '1' ? String(data.refund_gift_amount || '0') : undefined,
        is_refund_prepayment_amount: data.is_refund_prepayment_amount !== undefined ? String(data.is_refund_prepayment_amount) : undefined,
        refund_prepayment_amount: data.is_refund_prepayment_amount === '1' ? String(data.refund_prepayment_amount || '0') : undefined,
        remark: data.remark || undefined,
      }, files)
    },
    tabs: [
      {
        label: '退货信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'customer_id', label: '客户', type: 'input-suffix', required: true, placeholder: '请选择客户', dialogType: 'customer', labelKey: 'customer_name', span: 8 },
          { key: 'return_method', label: '退货方式', type: 'select', required: true, placeholder: '请选择退货方式', options: [
            { label: '退货退款', value: '退货退款' }, { label: '仅退货', value: '仅退货' }, { label: '仅退款', value: '仅退款' }
          ], span: 8 },
          { key: 'return_date', label: '退货日期', type: 'date', placeholder: '请选择退货日期', span: 8 },
          { key: 'inbound_date', label: '预计入库日期', type: 'date', placeholder: '请选择预计入库日期', span: 8 },
          { key: 'section-refund', label: '退款信息', type: 'section', span: 24 },
          { key: 'is_refund_gift_amount', label: '退还赠送金额', type: 'select', defaultValue: '0', options: [
            { label: '否', value: '0' }, { label: '是', value: '1' }
          ], span: 8 },
          { key: 'refund_gift_amount', label: '退还赠送金额', type: 'number', defaultValue: 0, span: 8,
            visible: (formData: Record<string, any>) => formData.is_refund_gift_amount === '1' },
          { key: 'is_refund_prepayment_amount', label: '退还预付款', type: 'select', defaultValue: '0', options: [
            { label: '否', value: '0' }, { label: '是', value: '1' }
          ], span: 8 },
          { key: 'refund_prepayment_amount', label: '退还预付款金额', type: 'number', defaultValue: 0, span: 8,
            visible: (formData: Record<string, any>) => formData.is_refund_prepayment_amount === '1' },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 2, span: 24 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '单据图片', type: 'image-upload', maxImages: 5, span: 24 },
          { key: 'attachments', label: '单据附件', type: 'file-upload', maxFiles: 5, span: 24 },
        ]
      },
      {
        label: '退货明细',
        fields: [
          { key: 'items', label: '', type: 'dynamic-table', span: 24,
            addLabel: '选择退货明细',
            addViaDialog: true,
            addDialogType: 'sales-return-item',
            showIndex: true,
            columns: [
              { key: 'sales_order_no', label: '销售单号', width: 170 },
              { key: 'product_code', label: '产品编码', width: 120 },
              { key: 'product_name', label: '产品名称', width: 150 },
              { key: 'unit_name', label: '单位', width: 70 },
              { key: 'remaining', label: '可退余量', width: 80 },
              { key: 'return_qty', label: '退货数量', width: 100, type: 'input' },
              { key: 'return_price', label: '退货单价', width: 110, type: 'input' },
              { key: 'product_status', label: '产品状态', width: 110, type: 'select', options: [
                { label: '完好', value: '完好' }, { label: '轻微损坏', value: '轻微损坏' },
                { label: '严重损坏', value: '严重损坏' }, { label: '报废', value: '报废' }
              ] },
              { key: 'remark', label: '备注', type: 'input' },
            ]
          }
        ]
      }
    ]
  },

  salesAfterSales: {
    title: '新增售后单',
    editTitle: '编辑售后单',
    type: 'salesAfterSales',
    module: 'sales/after-sales',
    successRoute: '/sales/after-sales',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getAfterSaleDetail(id)
      return res.data
    },
    submitCreate: (data) => createAfterSale(data),
    submitUpdate: (id, data) => updateAfterSale(id, data),
    tabs: [
      {
        label: '售后信息',
        fields: [
          { key: 'section-base', label: '售后基本信息', type: 'section', span: 24 },
          { key: 'serviceNo', label: '单据编号', type: 'input', required: true, placeholder: '请输入单据编号', span: 8 },
          { key: 'urgency', label: '紧急程度', type: 'select', required: true, placeholder: '请选择紧急程度', options: [
            { label: '紧急', value: '紧急' }, { label: '一般', value: '一般' }, { label: '低', value: '低' }
          ], span: 8 },
          { key: 'customerName', label: '客户', type: 'input', required: true, placeholder: '请输入客户名称', span: 8 },
          { key: 'contactPerson', label: '客户联系人', type: 'input', placeholder: '请输入客户联系人', span: 8 },
          { key: 'contactPhone', label: '联系电话', type: 'input', placeholder: '请输入联系电话', span: 8 },
          { key: 'repairAddress', label: '维修地址', type: 'input', placeholder: '请输入维修地址', span: 8 },
          { key: 'handler', label: '指派人', type: 'input', placeholder: '请输入指派人', span: 8 },
          { key: 'serviceDate', label: '售后日期', type: 'date', placeholder: '请选择售后日期', span: 8 },
          { key: 'section-detail', label: '售后明细', type: 'section', span: 24 },
          { key: 'serviceType', label: '售后类型', type: 'select', placeholder: '请选择售后类型', options: [
            { label: '维修', value: '维修' }, { label: '换货', value: '换货' }, { label: '退货', value: '退货' }, { label: '补发', value: '补发' }
          ], span: 8 },
          { key: 'responsiblePerson', label: '责任人', type: 'input', placeholder: '请输入责任人', span: 8 },
          { key: 'salesOrderNo', label: '销售单号', type: 'input', placeholder: '请输入关联销售单号', span: 8 },
          { key: 'productCode', label: '产品编号', type: 'input', placeholder: '请输入产品编号', span: 8 },
          { key: 'productName', label: '产品名称', type: 'input', placeholder: '请输入产品名称', span: 8 },
          { key: 'productType', label: '产品类型', type: 'input', placeholder: '请输入产品类型', span: 8 },
          { key: 'spec', label: '产品规格', type: 'input', placeholder: '请输入产品规格', span: 8 },
          { key: 'color', label: '颜色', type: 'input', placeholder: '请输入颜色', span: 8 },
          { key: 'unit', label: '计量单位', type: 'select', placeholder: '请选择计量单位', options: [], span: 8, loadOptions: async () => { const c = sessionStorage.getItem('optionsCache:productUnit'); if (c) return JSON.parse(c); try { const res = await getProductUnitList(); const opts = res.data.unit.map(u => ({ label: u.unit_name, value: u.unit_name })); sessionStorage.setItem('optionsCache:productUnit', JSON.stringify(opts)); return opts } catch { return [] } } },
          { key: 'quantity', label: '数量', type: 'number', defaultValue: 1, span: 8 },
          { key: 'serviceFee', label: '售后费用', type: 'number', defaultValue: 0, span: 8 },
          { key: 'serviceReason', label: '售后原因', type: 'textarea', placeholder: '请输入售后原因', rows: 2, span: 24 },
          { key: 'solution', label: '解决方案', type: 'textarea', placeholder: '请输入解决方案', rows: 2, span: 24 },
          { key: 'finalResult', label: '最终结果', type: 'input', placeholder: '请输入最终结果', span: 8 },
          { key: 'detailRemark', label: '明细备注', type: 'textarea', placeholder: '请输入明细备注', rows: 2, span: 24 },
          { key: 'auditStatus', label: '审核状态', type: 'radio', defaultValue: '待审核', options: [
            { label: '待审核', value: '待审核' }, { label: '审核通过', value: '审核通过' }, { label: '审核驳回', value: '审核驳回' }
          ], span: 8 }
        ]
      }
    ]
  },

  salesReconciliation: {
    title: '新增对账单',
    editTitle: '编辑对账单',
    type: 'salesReconciliation',
    module: 'sales/reconciliation',
    successRoute: '/sales/reconciliation',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getReconciliationDetail(id)
      return res.data
    },
    submitCreate: (data) => createReconciliation(data),
    submitUpdate: (id, data) => updateReconciliation(id, data),
    tabs: [
      {
        label: '对账信息',
        fields: [
          { key: 'section-base', label: '对账基本信息', type: 'section', span: 24 },
          { key: 'reconciliationNo', label: '单据编号', type: 'input', required: true, placeholder: '请输入单据编号', span: 8 },
          { key: 'customerName', label: '客户', type: 'input', required: true, placeholder: '请输入客户名称', span: 8 },
          { key: 'settleDays', label: '月结时长(天)', type: 'number', defaultValue: 30, span: 8 },
          { key: 'settleDate', label: '结算日', type: 'input', placeholder: '请输入结算日', span: 8 },
          { key: 'period', label: '对账月份', type: 'date', placeholder: '请选择对账月份', span: 8 },
          { key: 'section-amount', label: '金额信息', type: 'section', span: 24 },
          { key: 'reconciliationAmount', label: '本次对账金额', type: 'number', required: true, defaultValue: 0, span: 8 },
          { key: 'discountRate', label: '折扣比例', type: 'number', defaultValue: 0, span: 8 },
          { key: 'discountAmount', label: '折扣金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'adjustAmount', label: '加减金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'receivableAmount', label: '应收金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  purchaseSupplierType: {
    title: '新增供应商类型',
    editTitle: '编辑供应商类型',
    type: 'purchaseSupplierType',
    module: 'purchase/supplier-type',
    successRoute: '/purchase/supplier-type',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getSupplierTypeDetail(id)
      const data = res.data as any
      return Array.isArray(data.supplier_type) ? (data.supplier_type[0] || {}) : data.supplier_type
    },
    submitCreate: (data) => createSupplierType({
      type_name: data.type_name,
      status: Number(data.status),
      remark: data.remark
    }),
    submitUpdate: (id, data) => updateSupplierType({
      supplier_type_id: id,
      type_name: data.type_name,
      status: Number(data.status),
      remark: data.remark
    }),
    tabs: [
      {
        label: '供应商类型',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'type_name', label: '类型名称', type: 'input', required: true, placeholder: '请输入类型名称', span: 12 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '禁用', value: 0 }
          ], span: 12 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  purchaseSupplier: {
    title: '新增供应商档案',
    editTitle: '编辑供应商档案',
    type: 'purchaseSupplier',
    module: 'purchase/supplier',
    successRoute: '/purchase/supplier',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getSupplierDetail(id)
      const data = res.data as any
      const detail = Array.isArray(data.supplier) ? (data.supplier[0] || {}) : (data.supplier || {})
      return {
        ...detail,
        ...normalizeUploadDetailFiles(detail),
      }
    },
    submitCreate: (data, files) => createSupplier({
      supplier_name: data.supplier_name,
      short_name: data.short_name,
      supplier_type_id: data.supplier_type_id,
      area_id: data.area_id,
      detail_address: data.detail_address,
      phone1: data.phone1,
      phone2: data.phone2,
      fax_no: data.fax_no,
      email: data.email,
      principal_phone: data.principal_phone,
      business_contact: data.business_contact,
      contact_phone: data.contact_phone,
      bank_name: data.bank_name,
      bank_account: data.bank_account,
      payee_name: data.payee_name,
      purchaser_user_id: data.purchaser_user_id,
      is_monthly_settlement: Number(data.is_monthly_settlement) ?? 0,
      status: Number(data.status),
      credit_amount: data.credit_amount,
      gift_amount: data.gift_amount,
      remark: data.remark
    }, files),
    submitUpdate: (id, data, files) => updateSupplier({
      supplier_id: id,
      supplier_name: data.supplier_name,
      short_name: data.short_name,
      supplier_type_id: data.supplier_type_id,
      area_id: data.area_id,
      detail_address: data.detail_address,
      phone1: data.phone1,
      phone2: data.phone2,
      fax_no: data.fax_no,
      email: data.email,
      principal_phone: data.principal_phone,
      business_contact: data.business_contact,
      contact_phone: data.contact_phone,
      bank_name: data.bank_name,
      bank_account: data.bank_account,
      payee_name: data.payee_name,
      purchaser_user_id: data.purchaser_user_id,
      is_monthly_settlement: Number(data.is_monthly_settlement) ?? 0,
      status: Number(data.status),
      remark: data.remark
    }, files),
    tabs: [
      {
        label: '基础资料',
        fields: [
          { key: 'section-base', label: '基础信息', type: 'section', span: 24 },
          { key: 'supplier_name', label: '供应商名称', type: 'input', required: true, placeholder: '请输入供应商名称', span: 8 },
          { key: 'short_name', label: '简称', type: 'input', placeholder: '请输入简称', span: 8 },
          { key: 'supplier_type_id', label: '供应商类型', type: 'select', placeholder: '请选择供应商类型', clearable: true, filterable: true, options: [], span: 8, loadOptions: async () => { try { const res = await getSupplierTypeList(); return (res.data.supplier_type || []).map((t: any) => ({ label: t.type_name, value: t.supplier_type_id })) } catch { return [] } } },
          { key: 'area_id', label: '所在区域', type: 'tree-select', placeholder: '请选择所在区域', clearable: true, filterable: true, span: 8, checkStrictly: true, treeProps: { label: 'area_name', children: 'children', value: 'area_id' }, loadTreeData: async () => { if (!usePermissionStore().hasPerm('perm_api_emp_query_areas')) return []; try { const res = await getAreaList({}); return res.data.area || [] } catch { return [] } } },
          { key: 'detail_address', label: '详细地址', type: 'input', placeholder: '请输入详细地址', span: 16 },
          { key: 'phone1', label: '电话1', type: 'input', placeholder: '请输入电话', span: 8 },
          { key: 'phone2', label: '电话2', type: 'input', placeholder: '请输入电话', span: 8 },
          { key: 'fax_no', label: '传真号', type: 'input', placeholder: '请输入传真号', span: 8 },
          { key: 'email', label: '邮箱', type: 'input', placeholder: '请输入邮箱', span: 8 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '禁用', value: 0 }
          ], span: 8 },
          { key: 'is_monthly_settlement', label: '是否月结', type: 'radio', defaultValue: 0, options: [
            { label: '是', value: 1 }, { label: '否', value: 0 }
          ], span: 8 },
          { key: 'principal_phone', label: '负责人电话', type: 'input', placeholder: '请输入负责人电话', span: 8 },
          { key: 'business_contact', label: '业务联系人', type: 'input', placeholder: '请输入业务联系人', span: 8 },
          { key: 'contact_phone', label: '联系人电话', type: 'input', placeholder: '请输入联系人电话', span: 8 },
          { key: 'bank_name', label: '开户行', type: 'input', placeholder: '请输入开户行', span: 8 },
          { key: 'bank_account', label: '银行账号', type: 'input', placeholder: '请输入银行账号', span: 8 },
          { key: 'payee_name', label: '收款人', type: 'input', placeholder: '请输入收款人', span: 8 },
          { key: 'purchaser_user_id', label: '采购员', type: 'input-suffix', placeholder: '请选择采购员', span: 8, suffixIcon: 'Search', dialogType: 'employee', labelKey: 'purchaser_user_name' },
          { key: 'remark', label: '备注信息', type: 'textarea', placeholder: '请输入备注信息', rows: 3, span: 24 },
          { key: 'section-balance', label: '余额初始化', type: 'section', span: 24 },
          { key: 'credit_amount', label: '授信额度', type: 'number', defaultValue: 0, disabledInEdit: true, placeholder: '初始授信额度，不得为负', span: 8 },
          { key: 'gift_amount', label: '赠送金额', type: 'number', defaultValue: 0, disabledInEdit: true, placeholder: '初始赠送金额，不得为负', span: 8 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '供应商图片', type: 'image-upload', maxImages: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteSupplierImages(editId, [file.url]) } },
          { key: 'attachments', label: '供应商附件', type: 'file-upload', maxFiles: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteSupplierAttachments(editId, [file.url]) } }
        ]
      }
    ]
  },

  purchaseOrder: {

    title: '新增采购订单',
    editTitle: '编辑采购订单',
    type: 'purchaseOrder',
    module: 'purchase/order',
    successRoute: '/purchase/order',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getPurchaseOrderDetail(id)
      // 后端详情返回裸对象（无 purchase_order wrapper key），直接使用 res.data
      const data = res.data as Record<string, any>
      return {
        ...data,
        ...normalizeUploadDetailFiles(data),
      }
    },
    submitCreate: (data, files) => {
      const rawItems: any[] = data.items || []
      // 后端要求明细至少 1 条；行级规则详见 validatePurchaseOrderItems
      if (rawItems.length === 0) throw new Error('请至少添加一条采购明细')
      validatePurchaseOrderItems(rawItems)
      return createPurchaseOrder({
        supplier_id: data.supplier_id || '',
        order_date: formatDate(data.order_date) || '',
        delivery_days: Number(data.delivery_days) || 0,
        freight_bear_type: data.freight_bear_type || '',
        payment_method: data.payment_method || '',
        items: JSON.stringify((data.items || []).map((it: any) => ({
          product_id: it.product_id || '',
          qty: it.qty ?? '',
          purchase_price: it.purchase_price ?? '',
          delivery_status: it.delivery_status ?? 0,
          delivery_date: it.delivery_date || '',
          unit_id: it.unit_id || '',
          last_purchase_price: it.last_purchase_price || '',
          logistics_no: it.logistics_no || '',
          remark: it.remark || '',
          ...(it.purchase_order_item_id ? { purchase_order_item_id: it.purchase_order_item_id } : {})
        }))),
        use_prepayment_amount: data.use_prepayment_amount !== undefined ? String(data.use_prepayment_amount) : undefined,
        use_gift_amount: data.use_gift_amount !== undefined ? String(data.use_gift_amount) : undefined,
        remark: data.remark || undefined,
      }, files as { images?: File[]; attachments?: File[] } | undefined)
    },
    submitUpdate: async (id, data, files) => {
      // 0. 明细先行校验：编辑是「主单 + 明细」多个接口先后提交，若明细接口在后报错，
      //    会造成主单已更新、明细未写入的半提交状态，故任何请求前统一拦截
      validatePurchaseOrderItems(data.items || [])
      // 1. 更新主单基本信息
      await updatePurchaseOrder({
        purchase_order_id: id,
        supplier_id: data.supplier_id || undefined,
        order_date: formatDate(data.order_date),
        delivery_days: data.delivery_days !== undefined ? Number(data.delivery_days) : undefined,
        freight_bear_type: data.freight_bear_type || undefined,
        payment_method: data.payment_method || undefined,
        use_prepayment_amount: data.use_prepayment_amount !== undefined ? String(data.use_prepayment_amount) : undefined,
        use_gift_amount: data.use_gift_amount !== undefined ? String(data.use_gift_amount) : undefined,
        remark: data.remark !== undefined ? (data.remark || '') : undefined,
      }, files as { images?: File[]; attachments?: File[] } | undefined)
      // 2. 处理明细行：区分新增行（无 purchase_order_item_id）和已有行（有 purchase_order_item_id）
      const allItems: any[] = data.items || []
      const newItems = allItems.filter((it: any) => !it.purchase_order_item_id)
      const existingItems = allItems.filter((it: any) => !!it.purchase_order_item_id)
      if (newItems.length > 0) {
        await addPurchaseOrderItems(id, newItems.map((it: any) => {
          const row: any = { product_id: it.product_id || '' }
          if (it.qty !== undefined && it.qty !== '') row.qty = it.qty
          if (it.purchase_price !== undefined && it.purchase_price !== '') row.purchase_price = it.purchase_price
          row.delivery_status = it.delivery_status ?? 0
          if (it.delivery_date) row.delivery_date = it.delivery_date
          if (it.unit_id) row.unit_id = it.unit_id
          if (it.last_purchase_price !== undefined && it.last_purchase_price !== '') row.last_purchase_price = it.last_purchase_price
          if (it.logistics_no) row.logistics_no = it.logistics_no
          row.remark = it.remark || ''
          return row
        }))
      }
      if (existingItems.length > 0) {
        await updatePurchaseOrderItems(id, existingItems.map((it: any) => {
          const row: any = { purchase_order_item_id: it.purchase_order_item_id }
          if (it.product_id) row.product_id = it.product_id
          if (it.qty !== undefined && it.qty !== '') row.qty = it.qty
          if (it.purchase_price !== undefined && it.purchase_price !== '') row.purchase_price = it.purchase_price
          if (it.delivery_status !== undefined) row.delivery_status = it.delivery_status
          if (it.delivery_date) row.delivery_date = it.delivery_date
          if (it.unit_id) row.unit_id = it.unit_id
          if (it.last_purchase_price !== undefined && it.last_purchase_price !== '') row.last_purchase_price = it.last_purchase_price
          if (it.logistics_no) row.logistics_no = it.logistics_no
          if (it.remark !== undefined) row.remark = it.remark || ''
          return row
        }))
      }
    },
    tabs: [
      {
        label: '订单信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'supplier_id', label: '供应商', type: 'input-suffix', required: true, placeholder: '请选择供应商', span: 12, suffixIcon: 'Search', dialogType: 'supplier', labelKey: 'supplier_name' },
          { key: 'order_date', label: '订单日期', type: 'date', required: true, placeholder: '请选择订单日期', span: 12 },
          { key: 'delivery_days', label: '送货天数', type: 'number', defaultValue: 0, span: 8 },
          { key: 'freight_bear_type', label: '运费承担', type: 'select', required: true, placeholder: '请选择运费承担', options: [
            { label: '有需方承担运费', value: '有需方承担运费' }, { label: '由发货方承担运费', value: '由发货方承担运费' }
          ], span: 8 },
          { key: 'payment_method', label: '付款方式', type: 'select', required: true, placeholder: '请选择付款方式', options: [
            { label: '月结', value: '月结' }, { label: '现结', value: '现结' }, { label: '挂账', value: '挂账' }, { label: '预付款使用', value: '预付款使用' }
          ], span: 8 },
          { key: 'order_amount', label: '订单金额', type: 'computed', defaultValue: '0.00', span: 8 },
          { key: 'payable_amount', label: '应付金额', type: 'computed', defaultValue: '0.00', span: 8 },
          { key: 'use_prepayment_amount', label: '使用预付款', type: 'number', defaultValue: 0, span: 8 },
          { key: 'use_gift_amount', label: '使用赠送金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 },
          { key: 'items', label: '采购明细', type: 'dynamic-table', addLabel: '新增产品明细', addViaDialog: true, columns: [
            { key: 'product_code', label: '产品编号', width: 140, type: 'display' },
            { key: 'product_name', label: '产品名称', width: 140, type: 'display' },
            { key: 'category_name', label: '产品类型', width: 120, type: 'display' },
            { key: 'purchase_price', label: '采购单价', width: 120 },
            { key: 'qty', label: '采购数量', width: 100 },
            { key: 'line_total_amount', label: '总原价', width: 100, type: 'computed',
              compute: (row: Record<string, any>) => {
                const amt = Number(row.amount)
                if (row.amount !== undefined && row.amount !== null && row.amount !== '' && !isNaN(amt)) return amt.toFixed(2)
                return ((Number(row.purchase_price) || 0) * (Number(row.qty) || 0)).toFixed(2)
              } },
            { key: 'line_payable_total', label: '总应支付价', width: 100, type: 'computed',
              compute: (row: Record<string, any>) => {
                const pa = Number(row.payable_amount)
                if (row.payable_amount !== undefined && row.payable_amount !== null && row.payable_amount !== '' && !isNaN(pa)) return pa.toFixed(2)
                const pup = Number(row.payable_unit_price) * Number(row.qty)
                if (!isNaN(pup) && pup > 0) return pup.toFixed(2)
                return ((Number(row.purchase_price) || 0) * (Number(row.qty) || 0)).toFixed(2)
              } },
            { key: 'line_gift_total', label: '总优惠金额', width: 100, type: 'computed',
              compute: (row: Record<string, any>) => {
                const amt = Number(row.amount)
                const pa = Number(row.payable_amount)
                if (row.amount !== undefined && row.payable_amount !== undefined && row.payable_amount !== null && row.payable_amount !== '' && !isNaN(amt) && !isNaN(pa)) return (amt - pa).toFixed(2)
                return '0.00'
              } },
            { key: 'delivery_status', label: '发货状态', width: 120, type: 'select', options: [
              { label: '未发货', value: 0 }, { label: '已发货', value: 1 }
            ] },
            { key: 'unit_id', label: '计量单位', width: 120, type: 'dialog-select', dialogType: 'unit', labelKey: 'unit_name', disabled: true },
            { key: 'delivery_date', label: '发货日期', width: 140, type: 'date' },
            { key: 'last_purchase_price', label: '上次采购价', width: 120 },
            { key: 'logistics_no', label: '物流单号', width: 140 },
            { key: 'remark', label: '备注', width: 160 }
          ], span: 24 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '订单图片', type: 'image-upload', maxImages: 5, span: 24, onDeleteRemote: async (file, editId) => { await deletePurchaseOrderImages(editId, [file.url]) } },
          { key: 'attachments', label: '订单附件', type: 'file-upload', maxFiles: 5, span: 24, onDeleteRemote: async (file, editId) => { await deletePurchaseOrderAttachments(editId, [file.url]) } }
        ]
      }
    ]
  },

  purchaseInbound: {
    title: '新增采购入库单',
    editTitle: '编辑采购入库单',
    type: 'purchaseInbound',
    module: 'purchase/inbound',
    successRoute: '/purchase/inbound',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getPurchaseInboundDetail(id)
      // 后端详情返回裸对象（无 purchase_receipt wrapper key），直接使用 res.data
      const detail = (res.data as any) ?? {}
      const uploadFiles = normalizeUploadDetailFiles(detail)
      return {
        ...detail,
        supplier_id: detail.supplier_id,
        supplier_id_label: detail.supplier_name,
        items: detail.items ?? [],
        ...uploadFiles,
      }
    },
    submitCreate: async (data: Record<string, any>, files?: Record<string, File[]>) => {
      if (!data.supplier_id) throw new Error('请选择供应商')
      const rawItems: any[] = data.items || []
      if (rawItems.length === 0) throw new Error('请至少添加一条入库明细')
      const items = rawItems.map((row: any) => ({
        purchase_order_item_id: row.purchase_order_item_id,
        in_stock_qty: Number(row.in_stock_qty) || 0,
        remark: row.remark || ''
      }))
      return createPurchaseInbound(
        { supplier_id: data.supplier_id, items: JSON.stringify(items), remark: data.remark || '' },
        { images: files?.images, attachments: files?.attachments }
      )
    },
    submitUpdate: async (id: string, data: Record<string, any>, files?: Record<string, File[]>) => {
      await updatePurchaseInbound(
        id,
        { supplier_id: data.supplier_id || undefined, remark: data.remark || undefined },
        { images: files?.images, attachments: files?.attachments }
      )
      const allItems: any[] = data.items || []
      const newItems = allItems.filter((it: any) => !it.purchase_receipt_item_id)
      const existingItems = allItems.filter((it: any) => !!it.purchase_receipt_item_id)
      if (newItems.length > 0) {
        await addPurchaseInboundItems(id, newItems.map((it: any) => {
          const row: any = { purchase_order_item_id: it.purchase_order_item_id }
          if (it.in_stock_qty !== undefined && it.in_stock_qty !== '') row.in_stock_qty = it.in_stock_qty
          if (it.remark !== undefined) row.remark = it.remark || ''
          return row
        }))
      }
      if (existingItems.length > 0) {
        await updatePurchaseInboundItems(id, existingItems.map((it: any) => {
          const row: any = { purchase_receipt_item_id: it.purchase_receipt_item_id }
          if (it.in_stock_qty !== undefined && it.in_stock_qty !== '') row.in_stock_qty = it.in_stock_qty
          if (it.remark !== undefined) row.remark = it.remark || ''
          return row
        }))
      }
    },
    tabs: [
      {
        label: '入库信息',
        fields: [
          { key: 'section-base', label: '单据信息', type: 'section', span: 24 },
          { key: 'supplier_id', label: '供应商', type: 'input-suffix', required: true, placeholder: '请选择供应商', span: 8, suffixIcon: 'Search', dialogType: 'supplier', labelKey: 'supplier_name' },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '入库图片', type: 'image-upload', maxImages: 5, span: 24, onDeleteRemote: async (file, editId) => { await deletePurchaseInboundImages(editId, [file.url]) } },
          { key: 'attachments', label: '入库附件', type: 'file-upload', maxFiles: 5, span: 24, onDeleteRemote: async (file, editId) => { await deletePurchaseInboundAttachments(editId, [file.url]) } },
          { key: 'section-items', label: '入库明细', type: 'section', span: 24 },
          { key: 'items', label: '入库明细', type: 'dynamic-table', addLabel: '新增入库明细', addViaDialog: true, addDialogType: 'pending-receipt', columns: [
            { key: 'purchase_order_no', label: '采购单号', width: 150 },
            { key: 'product_code', label: '产品编号', width: 130 },
            { key: 'product_name', label: '产品名称', width: 150 },
            { key: 'category_name', label: '产品类型', width: 100 },
            { key: 'specification', label: '规格', width: 90 },
            { key: 'color', label: '颜色', width: 80 },
            { key: 'unit_name', label: '计量单位', width: 90 },
            { key: 'purchase_price', label: '采购单价', width: 110 },
            { key: 'in_stock_qty', label: '入库数量', width: 110 },
            { key: 'remark', label: '备注', width: 160 }
          ], span: 24 }
        ]
      }
    ]
  },

  purchaseReturn: {
    title: '新增采购退货单',
    editTitle: '编辑采购退货单',
    type: 'purchaseReturn',
    module: 'purchase/return',
    successRoute: '/purchase/return',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getPurchaseReturnDetail(id)
      // 详情接口直接返回裸对象，无 wrapper key
      const detail = res.data
      // 后端用错了映射表，payment_method 返回英文标准值，需转成中文与 select 选项对齐
      const RETURN_METHOD_MAP: Record<string, string> = {
        RETURN_AND_REFUND: '退货退款',
        RETURN_ONLY: '仅退货',
        REFUND_ONLY: '仅退款'
      }
      return {
        ...detail,
        supplier_id_label: detail.supplier_name,
        payment_method: RETURN_METHOD_MAP[detail.payment_method] ?? detail.payment_method,
        items: detail.items ?? []
      }
    },
    submitCreate: async (data: Record<string, any>, files?: Record<string, File[]>) => {
      if (!data.supplier_id) throw new Error('请选择供应商')
      if (!data.payment_method) throw new Error('请选择退货方式')
      if (!data.return_address) throw new Error('请输入退货地址')
      if (data.is_refund_prepayment === 1 && (!data.refund_prepayment_amount || Number(data.refund_prepayment_amount) <= 0)) throw new Error('退回预付款金额必须大于0')
      if (data.is_refund_gift_amount === 1 && (!data.refund_gift_amount || Number(data.refund_gift_amount) <= 0)) throw new Error('退回赠送金额必须大于0')
      const rawItems: any[] = data.items || []
      if (rawItems.length === 0) throw new Error('请至少添加一条退货明细')
      for (const row of rawItems) {
        const returnQty = Number(row.return_qty) || 0
        const remaining = Number(row.remaining) || 0
        if (returnQty > remaining) {
          const deductions: any[] = row.receipt_item_deductions || []
          const deductionTotal = deductions.reduce((sum: number, d: any) => sum + (Number(d.deduction_qty) || 0), 0)
          if (deductionTotal < returnQty - remaining) {
            throw new Error(`明细"${row.product_name || ''}"退货数量超出可退余量，且冲减数量不足，请补充冲减入库明细`)
          }
        }
      }
      const items = rawItems.map((row: any) => {
        const item: any = { purchase_order_item_id: row.purchase_order_item_id }
        if (row.return_price !== undefined && row.return_price !== '') item.return_price = row.return_price
        if (row.return_qty !== undefined && row.return_qty !== '') item.return_qty = row.return_qty
        if (row.remark) item.remark = row.remark
        if (row.receipt_item_deductions && row.receipt_item_deductions.length > 0) {
          item.receipt_item_deductions = row.receipt_item_deductions.map((d: any) => ({
            purchase_receipt_item_id: d.purchase_receipt_item_id,
            deduction_qty: String(d.deduction_qty)
          }))
        }
        return item
      })
      const submitData: any = {
        supplier_id: data.supplier_id,
        purchase_order_id: rawItems[0]?.purchase_order_id || '',
        payment_method: data.payment_method,
        return_address: data.return_address,
        items: JSON.stringify(items),
        remark: data.remark || undefined
      }
      if (data.is_refund_prepayment === 1) {
        submitData.is_refund_prepayment = 'true'
        submitData.refund_prepayment_amount = String(data.refund_prepayment_amount)
      } else {
        submitData.is_refund_prepayment = 'false'
      }
      if (data.is_refund_gift_amount === 1) {
        submitData.is_refund_gift_amount = 'true'
        submitData.refund_gift_amount = String(data.refund_gift_amount)
      } else {
        submitData.is_refund_gift_amount = 'false'
      }
      return createPurchaseReturn(submitData, { images: files?.images, attachments: files?.attachments })
    },
    submitUpdate: async (id: string, data: Record<string, any>, files?: Record<string, File[]>) => {
      if (data.is_refund_prepayment === 1 && (!data.refund_prepayment_amount || Number(data.refund_prepayment_amount) <= 0)) throw new Error('退回预付款金额必须大于0')
      if (data.is_refund_gift_amount === 1 && (!data.refund_gift_amount || Number(data.refund_gift_amount) <= 0)) throw new Error('退回赠送金额必须大于0')
      // 编辑场景：已有明细不允许追加冲减
      const allItems: any[] = data.items || []
      for (const row of allItems) {
        if (row.purchase_return_item_id && row.remaining !== undefined) {
          const returnQty = Number(row.return_qty) || 0
          const remaining = Number(row.remaining) || 0
          if (returnQty > remaining) {
            throw new Error('当前版本暂不支持通过编辑明细追加冲减，请删除该明细后重新新增。')
          }
        }
      }
      // 新增明细需校验冲减
      const newItems = allItems.filter((it: any) => !it.purchase_return_item_id)
      for (const row of newItems) {
        const returnQty = Number(row.return_qty) || 0
        const remaining = Number(row.remaining) || 0
        if (returnQty > remaining) {
          const deductions: any[] = row.receipt_item_deductions || []
          const deductionTotal = deductions.reduce((sum: number, d: any) => sum + (Number(d.deduction_qty) || 0), 0)
          if (deductionTotal < returnQty - remaining) {
            throw new Error(`明细"${row.product_name || ''}"退货数量超出可退余量，且冲减数量不足，请补充冲减入库明细`)
          }
        }
      }
      // 1. 更新主单
      const updateData: any = {
        supplier_id: data.supplier_id || undefined,
        payment_method: data.payment_method || undefined,
        return_address: data.return_address || undefined,
        remark: data.remark || undefined
      }
      if (data.is_refund_prepayment === 1) {
        updateData.is_refund_prepayment = 'true'
        updateData.refund_prepayment_amount = String(data.refund_prepayment_amount)
      } else {
        updateData.is_refund_prepayment = 'false'
      }
      if (data.is_refund_gift_amount === 1) {
        updateData.is_refund_gift_amount = 'true'
        updateData.refund_gift_amount = String(data.refund_gift_amount)
      } else {
        updateData.is_refund_gift_amount = 'false'
      }
      await updatePurchaseReturn(id, updateData, { images: files?.images, attachments: files?.attachments })
      // 2. 明细 diff：有 purchase_return_item_id 为已有行，无则为新增行
      const existingItems = allItems.filter((it: any) => !!it.purchase_return_item_id)
      if (newItems.length > 0) {
        await addPurchaseReturnItems(id, newItems.map((it: any) => {
          const row: any = { purchase_order_item_id: it.purchase_order_item_id }
          if (it.return_price !== undefined && it.return_price !== '') row.return_price = it.return_price
          if (it.return_qty !== undefined && it.return_qty !== '') row.return_qty = it.return_qty
          if (it.remark) row.remark = it.remark
          if (it.receipt_item_deductions && it.receipt_item_deductions.length > 0) {
            row.receipt_item_deductions = it.receipt_item_deductions.map((d: any) => ({
              purchase_receipt_item_id: d.purchase_receipt_item_id,
              deduction_qty: String(d.deduction_qty)
            }))
          }
          return row
        }))
      }
      if (existingItems.length > 0) {
        await updatePurchaseReturnItems(id, existingItems.map((it: any) => {
          const row: any = { purchase_return_item_id: it.purchase_return_item_id }
          if (it.return_price !== undefined && it.return_price !== '') row.return_price = it.return_price
          if (it.return_qty !== undefined && it.return_qty !== '') row.return_qty = it.return_qty
          if (it.remark !== undefined) row.remark = it.remark || ''
          return row
        }))
      }
    },
    tabs: [
      {
        label: '退货信息',
        fields: [
          { key: 'section-base', label: '单据信息', type: 'section', span: 24 },
          { key: 'supplier_id', label: '供应商', type: 'input-suffix', required: true, placeholder: '请选择供应商', span: 8, suffixIcon: 'Search', dialogType: 'supplier', labelKey: 'supplier_name' },
          { key: 'payment_method', label: '退货方式', type: 'select', required: true, placeholder: '请选择退货方式', options: [
            { label: '退货退款', value: '退货退款' }, { label: '仅退货', value: '仅退货' }, { label: '仅退款', value: '仅退款' }
          ], span: 8 },
          { key: 'return_address', label: '退货地址', type: 'input', required: true, placeholder: '请输入退货地址', span: 8 },
          { key: 'section-refund', label: '退款信息', type: 'section', span: 24 },
          { key: 'is_refund_prepayment', label: '是否退回预付款', type: 'select', placeholder: '请选择', options: [
            { label: '否', value: 0 }, { label: '是', value: 1 }
          ], span: 8, defaultValue: 0 },
          { key: 'refund_prepayment_amount', label: '退回预付款金额', type: 'number', placeholder: '退回预付款时必填', span: 8, visible: (formData: Record<string, any>) => formData.is_refund_prepayment === 1 || formData.is_refund_prepayment === '1' },
          { key: 'is_refund_gift_amount', label: '是否退回赠送金额', type: 'select', placeholder: '请选择', options: [
            { label: '否', value: 0 }, { label: '是', value: 1 }
          ], span: 8, defaultValue: 0 },
          { key: 'refund_gift_amount', label: '退回赠送金额', type: 'number', placeholder: '退回赠送金额时必填', span: 8, visible: (formData: Record<string, any>) => formData.is_refund_gift_amount === 1 || formData.is_refund_gift_amount === '1' },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '退货图片', type: 'image-upload', maxImages: 5, span: 24, onDeleteRemote: async (file, editId) => { await deletePurchaseReturnImages(editId, [file.url]) } },
          { key: 'attachments', label: '退货附件', type: 'file-upload', maxFiles: 5, span: 24, onDeleteRemote: async (file, editId) => { await deletePurchaseReturnAttachments(editId, [file.url]) } },
          { key: 'section-items', label: '退货明细', type: 'section', span: 24 },
          { key: 'items', label: '退货明细', type: 'dynamic-table', addLabel: '新增退货明细', addViaDialog: true, addDialogType: 'pending-return', columns: [
            { key: 'purchase_order_no', label: '采购单号', width: 150 },
            { key: 'product_code', label: '产品编号', width: 130 },
            { key: 'product_name', label: '产品名称', width: 150 },
            { key: 'category_name', label: '产品类型', width: 100 },
            { key: 'specification', label: '规格', width: 90 },
            { key: 'color', label: '颜色', width: 80 },
            { key: 'unit_name', label: '计量单位', width: 90 },
            { key: 'purchase_price', label: '采购单价', width: 110 },
            { key: 'return_price', label: '退货单价', width: 110 },
            { key: 'return_qty', label: '退货数量', width: 110 },
            { key: 'deducted_receipt_qty', label: '冲减数量', width: 110, type: 'computed' },
            { key: 'warehouse_out_qty', label: '需出库数量', width: 110, type: 'computed' },
            { key: 'remaining', label: '可退余量', width: 100 },
            { key: 'remark', label: '备注', width: 160 }
          ], span: 24 }
        ]
      }
    ]
  },

  // ==================== 财务管理 - 银行账户 ====================
  bankAccount: {
    title: '新增银行账户',
    editTitle: '编辑银行账户',
    type: 'bankAccount',
    module: 'finance/bank-account',
    successRoute: '/finance/bank-account',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getBankAccountDetail(id)
      const data = res.data
      const uploadFiles = normalizeUploadDetailFiles(data)
      return {
        ...data,
        // 后端详情返回 account_status 为英文标准值（NORMAL 等）+ account_status_display 中文；
        // 表单 select 的 value 用中文（后端接口1/2 接受中文并自动映射），故回显用中文名
        account_status: data.account_status_display || data.account_status,
        ...uploadFiles,
      }
    },
    submitCreate: async (data, files) => {
      return createBankAccount({
        account_name: data.account_name,
        account_no: data.account_no,
        bank_name: data.bank_name,
        opening_balance: data.opening_balance != null ? String(data.opening_balance) : undefined,
        account_status: data.account_status,
        open_date: formatDate(data.open_date),
        close_date: formatDate(data.close_date),
        remark: data.remark || undefined
      }, files)
    },
    submitUpdate: async (id, data, files) => {
      return updateBankAccount(id, {
        account_name: data.account_name,
        account_no: data.account_no,
        bank_name: data.bank_name,
        opening_balance: data.opening_balance != null ? String(data.opening_balance) : undefined,
        account_status: data.account_status,
        open_date: formatDate(data.open_date),
        close_date: formatDate(data.close_date),
        remark: data.remark || undefined
      }, files)
    },
    tabs: [
      {
        label: '账户信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'account_name', label: '账户名称', type: 'input', required: true, placeholder: '请输入账户名称', span: 8 },
          { key: 'account_no', label: '账户账号', type: 'input', required: true, placeholder: '请输入账户账号', span: 8 },
          { key: 'bank_name', label: '开户银行', type: 'input', required: true, placeholder: '请输入开户银行', span: 8 },
          { key: 'opening_balance', label: '期初金额', type: 'number', required: true, placeholder: '请输入期初金额（不能为负）', span: 8 },
          { key: 'account_status', label: '账户状态', type: 'select', required: true, placeholder: '请选择账户状态', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }, { label: '销户', value: '销户' }
          ], span: 8 },
          { key: 'open_date', label: '开户时间', type: 'date', placeholder: '请选择开户时间', span: 8 },
          { key: 'close_date', label: '销户时间', type: 'date', placeholder: '销户状态时必填', span: 8 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '账户图片', type: 'image-upload', maxImages: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteBankAccountImages(editId, [file.url]) } },
          { key: 'attachments', label: '账户附件', type: 'file-upload', maxFiles: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteBankAccountAttachments(editId, [file.url]) } },
          { key: 'section-remark', label: '备注', type: 'section', span: 24 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  // ==================== 财务管理 - 预付款单（主表） ====================
  // 说明：主表表单仅管主表字段（E1/E2），明细在列表页"明细"按钮弹窗里用 E9/E10/E11 独立管理。
  prepaymentOrder: {
    title: '新增预付款单',
    editTitle: '编辑预付款单',
    type: 'prepaymentOrder',
    module: 'finance/prepayment',
    successRoute: '/finance/prepayment',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getPrepaymentOrderDetail(id)
      const data = res.data
      const uploadFiles = normalizeUploadDetailFiles(data)
      return {
        ...data,
        payment_method: paymentMethodLabel(data.payment_method),
        bank_account_id_label: data.bank_account_name,
        ...uploadFiles,
      }
    },
    submitCreate: async (data, files) => {
      return createPrepaymentOrder({
        subject_id: data.subject_id,
        payment_date: formatDate(data.payment_date),
        payment_method: data.payment_method,
        bank_account_id: data.bank_account_id || undefined,
        remark: data.remark || undefined
      }, [{
        supplier_id: data.supplier_id,
        prepayment_amount: String(data.prepayment_amount),
        gift_amount: String(data.gift_amount || '0'),
        actual_amount: String(Number(data.prepayment_amount || 0) + Number(data.gift_amount || 0))
      }], files)
    },
    submitUpdate: async (id, data, files) => {
      return updatePrepaymentOrder(id, {
        subject_id: data.subject_id,
        payment_date: formatDate(data.payment_date),
        payment_method: data.payment_method,
        bank_account_id: data.bank_account_id || undefined,
        remark: data.remark || undefined
      }, files)
    },
    tabs: [
      {
        label: '主表信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'supplier_id', label: '供应商', type: 'input-suffix', required: true, placeholder: '请选择供应商', span: 8, dialogType: 'supplier', labelKey: 'supplier_name' },
          { key: 'subject_id', label: '科目', type: 'tree-select', required: true, placeholder: '请选择科目', span: 8, treeData: [], checkStrictly: true, loadTreeData: async () => {
            try { const res = await getAccountSubjectTree(); return res.data?.items || [] } catch { return [] }
          }, treeProps: { label: 'name', children: 'children', value: 'subject_id' } },
          { key: 'payment_date', label: '付款日期', type: 'date', required: true, placeholder: '请选择付款日期', span: 8 },
          { key: 'payment_method', label: '付款方式', type: 'select', required: true, placeholder: '请选择付款方式', options: [
            { label: '现金', value: '现金' }, { label: '银行转账', value: '银行转账' }
          ], span: 8 },
          { key: 'bank_account_id', label: '银行账户', type: 'select', placeholder: '银行转账时必填', span: 8, clearable: true, filterable: true, loadOptions: async () => {
            if (!usePermissionStore().hasPerm('perm_api_fin_list_bank')) return []
            try {
              const res = await getBankAccountList({ page: 1, page_size: 100 })
              return (res.data.items || []).map((b: any) => ({ label: b.account_name, value: b.bank_account_id }))
            } catch { return [] }
          } },
          { key: 'prepayment_amount', label: '预付金额', type: 'input', required: true, placeholder: '请输入预付金额', span: 8 },
          { key: 'gift_amount', label: '赠送金额', type: 'input', placeholder: '请输入赠送金额（选填）', span: 8 },
          { key: 'remark', label: '备注', type: 'input', placeholder: '请输入备注', span: 16 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '单据图片', type: 'image-upload', maxImages: 5, span: 24, onDeleteRemote: async (file, editId) => { await deletePrepaymentOrderFiles(editId, 'image', [file.url]) } },
          { key: 'attachments', label: '单据附件', type: 'file-upload', maxFiles: 5, span: 24, onDeleteRemote: async (file, editId) => { await deletePrepaymentOrderFiles(editId, 'attachment', [file.url]) } }
        ]
      }
    ]
  },

  paymentOrder: {
    title: '新增付款单',
    editTitle: '编辑付款单',
    type: 'paymentOrder',
    module: 'finance/payment-order',
    successRoute: '/finance/payment-order',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getPaymentOrderDetail(id)
      const data = res.data
      const uploadFiles = normalizeUploadDetailFiles(data)
      return {
        ...data,
        payment_method: paymentMethodLabel(data.payment_method),
        bank_account_id_label: data.bank_account_name,
        ...uploadFiles,
      }
    },
    submitCreate: async (data, files) => {
      const items = (data.items as any[] || []).map((row: any) => ({
        purchase_order_id: row.purchase_order_id,
        payment_amount: String(row.payment_amount || '0'),
        remark: row.remark || undefined
      }))
      return createPaymentOrder({
        supplier_id: data.supplier_id,
        subject_id: data.subject_id || '',
        payment_date: formatDate(data.payment_date) || '',
        payment_method: data.payment_method === '现金' ? 'CASH' : data.payment_method === '银行转账' ? 'TRANSFER' : data.payment_method,
        items: JSON.stringify(items),
        bank_account_id: data.bank_account_id || undefined,
        remark: data.remark || undefined
      }, files)
    },
    submitUpdate: async (id, data, files) => {
      return updatePaymentOrder({
        payment_order_id: id,
        subject_id: data.subject_id || undefined,
        payment_date: formatDate(data.payment_date),
        payment_method: data.payment_method === '现金' ? 'CASH' : data.payment_method === '银行转账' ? 'TRANSFER' : data.payment_method,
        bank_account_id: data.bank_account_id || undefined,
        remark: data.remark || undefined
      }, files)
    },
    tabs: [
      {
        label: '主表信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'supplier_id', label: '供应商', type: 'input-suffix', required: true, placeholder: '请选择供应商', span: 8, dialogType: 'supplier', labelKey: 'supplier_name' },
          { key: 'subject_id', label: '科目', type: 'tree-select', required: true, placeholder: '请选择科目', span: 8, treeData: [], checkStrictly: true, loadTreeData: async () => {
            try { const res = await getAccountSubjectTree(); return res.data?.items || [] } catch { return [] }
          }, treeProps: { label: 'name', children: 'children', value: 'subject_id' } },
          { key: 'payment_date', label: '付款日期', type: 'date', required: true, placeholder: '请选择付款日期', span: 8 },
          { key: 'payment_method', label: '付款方式', type: 'select', required: true, placeholder: '请选择付款方式', options: [
            { label: '现金', value: '现金' }, { label: '银行转账', value: '银行转账' }
          ], span: 8 },
          { key: 'bank_account_id', label: '银行账户', type: 'select', placeholder: '银行转账时必填', span: 8, clearable: true, filterable: true, loadOptions: async () => {
            if (!usePermissionStore().hasPerm('perm_api_fin_list_bank')) return []
            try {
              const res = await getBankAccountList({ page: 1, page_size: 100 })
              return (res.data.items || []).map((b: any) => ({ label: b.account_name, value: b.bank_account_id }))
            } catch { return [] }
          } },
          { key: 'remark', label: '备注', type: 'input', placeholder: '请输入备注', span: 16 },
          { key: 'section-items', label: '付款明细', type: 'section', span: 24 },
          { key: 'items', label: '', type: 'dynamic-table', span: 24, addLabel: '选择采购订单', addViaDialog: true, addDialogType: 'unpaid-order', showIndex: true,
            columns: [
              { key: 'order_no', label: '采购订单号', width: 180 },
              { key: 'payment_method_display', label: '结算方式', width: 90 },
              { key: 'pending_payable_amount', label: '待付金额', width: 110 },
              { key: 'payment_amount', label: '付款金额', width: 130, type: 'input' },
              { key: 'remark', label: '备注', width: 150, type: 'input' }
            ]
          },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '单据图片', type: 'image-upload', maxImages: 5, span: 24, onDeleteRemote: async (file, editId) => { await deletePaymentOrderFiles(editId, 'image', [file.url]) } },
          { key: 'attachments', label: '单据附件', type: 'file-upload', maxFiles: 5, span: 24, onDeleteRemote: async (file, editId) => { await deletePaymentOrderFiles(editId, 'attachment', [file.url]) } }
        ]
      }
    ]
  },

  monthlyPaymentOrder: {
    title: '新增月结付款单',
    editTitle: '编辑月结付款单',
    type: 'monthlyPaymentOrder',
    module: 'finance/monthly-payment',
    successRoute: '/finance/monthly-payment',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getMonthlyPaymentOrderDetail(id)
      const data = res.data
      const uploadFiles = normalizeUploadDetailFiles(data)
      return {
        ...data,
        payment_method: paymentMethodLabel(data.payment_method),
        bank_account_id_label: data.bank_account_name,
        ...uploadFiles,
      }
    },
    submitCreate: async (data, files) => {
      const items = data.purchase_order_id
        ? JSON.stringify([{ purchase_order_id: data.purchase_order_id, payment_amount: String(data.initial_payment_amount || '0') }])
        : undefined
      return createMonthlyPaymentOrder({
        supplier_id: data.supplier_id,
        subject_id: data.subject_id,
        payment_date: formatDate(data.payment_date) || '',
        payment_method: data.payment_method,
        items,
        bank_account_id: data.bank_account_id || undefined,
        remark: data.remark || undefined
      }, files)
    },
    submitUpdate: async (id, data, files) => {
      return updateMonthlyPaymentOrder({
        monthly_payment_id: id,
        subject_id: data.subject_id || undefined,
        payment_date: formatDate(data.payment_date),
        payment_method: data.payment_method,
        bank_account_id: data.bank_account_id || undefined,
        remark: data.remark || undefined
      }, files)
    },
    tabs: [
      {
        label: '主表信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'supplier_id', label: '供应商', type: 'input-suffix', required: true, placeholder: '请选择月结供应商', span: 8, dialogType: 'supplier', labelKey: 'supplier_name', monthlyOnly: true },
          { key: 'subject_id', label: '科目', type: 'tree-select', required: true, placeholder: '请选择科目', span: 8, treeData: [], checkStrictly: true, loadTreeData: async () => {
            try { const res = await getAccountSubjectTree(); return res.data?.items || [] } catch { return [] }
          }, treeProps: { label: 'name', children: 'children', value: 'subject_id' } },
          { key: 'payment_date', label: '付款日期', type: 'date', required: true, placeholder: '请选择付款日期', span: 8 },
          { key: 'payment_method', label: '付款方式', type: 'select', required: true, placeholder: '请选择付款方式', options: [
            { label: '现金', value: '现金' }, { label: '银行转账', value: '银行转账' }
          ], span: 8 },
          { key: 'bank_account_id', label: '银行账户', type: 'select', placeholder: '银行转账时必填', span: 8, clearable: true, filterable: true, loadOptions: async () => {
            if (!usePermissionStore().hasPerm('perm_api_fin_list_bank')) return []
            try {
              const res = await getBankAccountList({ page: 1, page_size: 100 })
              return (res.data.items || []).map((b: any) => ({ label: b.account_name, value: b.bank_account_id }))
            } catch { return [] }
          } },
          { key: 'purchase_order_id', label: '采购订单（首条明细）', type: 'input-suffix', required: true, placeholder: '请选择采购订单', span: 8, dialogType: 'purchaseOrder', labelKey: 'order_no', monthlyOnly: true },
          { key: 'initial_payment_amount', label: '付款金额（首条明细）', type: 'input', required: true, placeholder: '请输入付款金额', span: 8 },
          { key: 'remark', label: '备注', type: 'input', placeholder: '请输入备注', span: 16 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '单据图片', type: 'image-upload', maxImages: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteMonthlyPaymentOrderFiles(editId, 'image', [file.url]) } },
          { key: 'attachments', label: '单据附件', type: 'file-upload', maxFiles: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteMonthlyPaymentOrderFiles(editId, 'attachment', [file.url]) } }
        ]
      }
    ]
  },

  // ==================== 客户财务 ====================
  customerGiftAdd: {
    title: '新增赠送金额',
    type: 'customerGiftAdd',
    module: 'customer/finance/gift',
    successRoute: '/customer/finance/gift',
    labelWidth: '110px',
    labelPosition: 'top',
    submitCreate: (data) => addGiftLog({
      customer_id: data.customer_id,
      amount: Number(data.amount) || 0,
      remark: data.remark || undefined,
    }),
    tabs: [
      {
        label: '赠送信息',
        fields: [
          { key: 'customer_id', label: '客户ID', type: 'input', required: true, placeholder: '请输入客户ID', span: 12 },
          { key: 'amount', label: '赠送金额', type: 'number', required: true, defaultValue: 0, span: 12 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },
  otherReceipt: {
    title: '新增其他收款单',
    editTitle: '编辑其他收款单',
    type: 'otherReceipt',
    module: 'finance/other-receipt',
    successRoute: '/finance/other-receipt',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getOtherReceiptDetail(id)
      const data = res.data as any
      const uploadFiles = normalizeUploadDetailFiles(data)
      return {
        ...data,
        collection_method: paymentMethodLabel(data.collection_method),
        receipt_type: data.receipt_type,
        original_receipt_type: data.receipt_type,
        bank_account_id_label: data.bank_account_name,
        supplier_id_label: data.supplier_name,
        customer_id_label: data.customer_name,
        purchase_return_id_label: data.purchase_return_no,
        ...uploadFiles,
      }
    },
    submitCreate: async (data, files) => {
      return createOtherReceipt({
        subject_id: data.subject_id || '',
        receipt_date: formatDate(data.receipt_date) || '',
        collection_method: data.collection_method === '现金' ? 'CASH' : data.collection_method === '银行转账' ? 'TRANSFER' : data.collection_method,
        receipt_type: data.receipt_type,
        actual_receipt_amount: String(data.actual_receipt_amount),
        bank_account_id: data.bank_account_id || undefined,
        customer_id: data.customer_id || undefined,
        supplier_id: data.supplier_id || undefined,
        purchase_return_id: data.purchase_return_id || undefined,
        actual_refund_prepayment: data.actual_refund_prepayment ? String(data.actual_refund_prepayment) : undefined,
        actual_refund_gift_amount: data.actual_refund_gift_amount ? String(data.actual_refund_gift_amount) : undefined,
        remark: data.remark || undefined
      }, files)
    },
    submitUpdate: async (id, data, files) => {
      // 后端 update 不接收 receipt_type/customer_id/supplier_id/purchase_return_id，且永远按【库里存储的原收款类型】校验退回金额；
      // 故此处必须用编辑加载时的 original_receipt_type（而非 UI 上可能被临时改动的 receipt_type）来判断，避免误带退回金额触发后端报错。
      const isPurchaseRefund = (data.original_receipt_type || data.receipt_type) === 'PURCHASE_REFUND'
      return updateOtherReceipt({
        other_receipt_id: id,
        subject_id: data.subject_id || undefined,
        receipt_date: formatDate(data.receipt_date),
        collection_method: data.collection_method === '现金' ? 'CASH' : data.collection_method === '银行转账' ? 'TRANSFER' : data.collection_method,
        actual_receipt_amount: data.actual_receipt_amount ? String(data.actual_receipt_amount) : undefined,
        bank_account_id: data.bank_account_id || undefined,
        actual_refund_prepayment: isPurchaseRefund && data.actual_refund_prepayment ? String(data.actual_refund_prepayment) : undefined,
        actual_refund_gift_amount: isPurchaseRefund && data.actual_refund_gift_amount ? String(data.actual_refund_gift_amount) : undefined,
        remark: data.remark || undefined
      }, files)
    },
    tabs: [
      {
        label: '主表信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'receipt_type', label: '收款类型', type: 'select', required: true, disabledInEdit: true, placeholder: '请选择收款类型', options: [
            { label: '客户收款', value: 'CUSTOMER_RECEIPT' },
            { label: '供应商收款', value: 'SUPPLIER_RECEIPT' },
            { label: '采购退款', value: 'PURCHASE_REFUND' }
          ], span: 8 },
          { key: 'subject_id', label: '科目', type: 'tree-select', required: true, placeholder: '请选择科目', span: 8, checkStrictly: true, loadTreeData: async () => {
            try { const res = await getAccountSubjectTree(); return res.data?.items || [] } catch { return [] }
          }, treeProps: { label: 'name', children: 'children', value: 'subject_id' } },
          { key: 'receipt_date', label: '收款日期', type: 'date', required: true, placeholder: '请选择收款日期', span: 8 },
          { key: 'collection_method', label: '收款方式', type: 'select', required: true, placeholder: '请选择收款方式', options: [
            { label: '现金', value: '现金' }, { label: '银行转账', value: '银行转账' }
          ], span: 8 },
          { key: 'bank_account_id', label: '银行账户', type: 'select', placeholder: '银行转账时必填', span: 8, clearable: true, filterable: true, loadOptions: async () => {
            if (!usePermissionStore().hasPerm('perm_api_fin_list_bank')) return []
            try {
              const res = await getBankAccountList({ page: 1, page_size: 100 })
              return (res.data.items || []).map((b: any) => ({ label: b.account_name, value: b.bank_account_id }))
            } catch { return [] }
          } },
          { key: 'actual_receipt_amount', label: '实际收款金额', type: 'input', required: true, placeholder: '请输入实际收款金额', span: 8 },
          { key: 'customer_id', label: '客户', type: 'input-suffix', disabledInEdit: true, placeholder: '请选择客户', span: 8, dialogType: 'customer', labelKey: 'customer_name', visible: (formData: Record<string, any>) => formData.receipt_type === 'CUSTOMER_RECEIPT' },
          { key: 'supplier_id', label: '供应商', type: 'input-suffix', disabledInEdit: true, placeholder: '请选择供应商', span: 8, dialogType: 'supplier', labelKey: 'supplier_name', visible: (formData: Record<string, any>) => formData.receipt_type === 'SUPPLIER_RECEIPT' },
          { key: 'purchase_return_id', label: '采购退货单', type: 'input-suffix', disabledInEdit: true, placeholder: '请选择退货单', span: 8, dialogType: 'purchaseReturn', labelKey: 'return_no', visible: (formData: Record<string, any>) => formData.receipt_type === 'PURCHASE_REFUND' },
          { key: 'actual_refund_prepayment', label: '退回预付款金额', type: 'input', placeholder: '请输入退回预付款金额', span: 8, visible: (formData: Record<string, any>) => formData.receipt_type === 'PURCHASE_REFUND' },
          { key: 'actual_refund_gift_amount', label: '退回赠送金额', type: 'input', placeholder: '请输入退回赠送金额', span: 8, visible: (formData: Record<string, any>) => formData.receipt_type === 'PURCHASE_REFUND' },
          { key: 'remark', label: '备注', type: 'input', placeholder: '请输入备注', span: 16 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '单据图片', type: 'image-upload', maxImages: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteOtherReceiptFiles(editId, 'image', [file.url]) } },
          { key: 'attachments', label: '单据附件', type: 'file-upload', maxFiles: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteOtherReceiptFiles(editId, 'attachment', [file.url]) } }
        ]
      }
    ]
  },

  // ==================== 财务管理 - 收款单（B1-B8） ====================
  collectionReceipt: {
    title: '新增收款单',
    editTitle: '编辑收款单',
    type: 'collectionReceipt',
    module: 'finance/collection-receipt',
    successRoute: '/finance/transfer',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getCollectionReceiptDetail(id)
      const data = res.data
      const uploadFiles = normalizeUploadDetailFiles(data)
      return {
        ...data,
        collection_method: paymentMethodLabel(data.collection_method),
        bank_account_id_label: data.bank_account_name,
        ...uploadFiles,
      }
    },
    submitCreate: async (data, files) => {
      const items = (data.items as any[] || []).map((row: any) => ({
        sales_order_id: row.sales_order_id,
        collection_amount: String(row.collection_amount || '0'),
        remark: row.remark || undefined
      }))
      return createCollectionReceipt({
        customer_id: data.customer_id,
        subject_id: data.subject_id || '',
        collection_date: formatDate(data.collection_date) || '',
        collection_method: data.collection_method === '现金' ? 'CASH' : data.collection_method === '银行转账' ? 'TRANSFER' : data.collection_method,
        items: JSON.stringify(items),
        bank_account_id: data.bank_account_id || undefined,
        remark: data.remark || undefined
      }, files)
    },
    submitUpdate: async (id, data, files) => {
      return updateCollectionReceipt({
        receipt_id: id,
        subject_id: data.subject_id || undefined,
        collection_date: formatDate(data.collection_date),
        collection_method: data.collection_method === '现金' ? 'CASH' : data.collection_method === '银行转账' ? 'TRANSFER' : data.collection_method,
        bank_account_id: data.bank_account_id || undefined,
        remark: data.remark || undefined
      }, files)
    },
    tabs: [
      {
        label: '主表信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'customer_id', label: '客户', type: 'input-suffix', required: true, placeholder: '请选择客户', span: 8, dialogType: 'customer', labelKey: 'customer_name' },
          { key: 'subject_id', label: '科目', type: 'tree-select', required: true, placeholder: '请选择科目', span: 8, treeData: [], checkStrictly: true, loadTreeData: async () => {
            try { const res = await getAccountSubjectTree(); return res.data?.items || [] } catch { return [] }
          }, treeProps: { label: 'name', children: 'children', value: 'subject_id' } },
          { key: 'collection_date', label: '收款日期', type: 'date', required: true, placeholder: '请选择收款日期', span: 8 },
          { key: 'collection_method', label: '收款方式', type: 'select', required: true, placeholder: '请选择收款方式', options: [
            { label: '现金', value: '现金' }, { label: '银行转账', value: '银行转账' }
          ], span: 8 },
          { key: 'bank_account_id', label: '银行账户', type: 'select', placeholder: '银行转账时必填', span: 8, clearable: true, filterable: true, loadOptions: async () => {
            if (!usePermissionStore().hasPerm('perm_api_fin_list_bank')) return []
            try {
              const res = await getBankAccountList({ page: 1, page_size: 100 })
              return (res.data.items || []).map((b: any) => ({ label: b.account_name, value: b.bank_account_id }))
            } catch { return [] }
          } },
          { key: 'remark', label: '备注', type: 'input', placeholder: '请输入备注', span: 16 },
          { key: 'section-items', label: '收款明细', type: 'section', span: 24 },
          { key: 'items', label: '', type: 'dynamic-table', span: 24, addLabel: '选择销售订单', addViaDialog: true, addDialogType: 'sales-order', showIndex: true,
            columns: [
              { key: 'order_no', label: '销售订单号', width: 180 },
              { key: 'receivable_amount', label: '应收金额', width: 110 },
              { key: 'collection_amount', label: '收款金额', width: 130, type: 'input' },
              { key: 'remark', label: '备注', width: 150, type: 'input' }
            ]
          },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '单据图片', type: 'image-upload', maxImages: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteCollectionReceiptFiles(editId, 'image', [file.url]) } },
          { key: 'attachments', label: '单据附件', type: 'file-upload', maxFiles: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteCollectionReceiptFiles(editId, 'attachment', [file.url]) } }
        ]
      }
    ]
  },

  // ==================== 财务管理 - 月结客户收款单（DR1-DR14） ====================
  monthlyReceiptOrder: {
    title: '新增月结收款单',
    editTitle: '编辑月结收款单',
    type: 'monthlyReceiptOrder',
    module: 'finance/monthly-receipt-order',
    successRoute: '/finance/gift',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getMonthlyReceiptOrderDetail(id)
      const data = res.data
      const uploadFiles = normalizeUploadDetailFiles(data)
      return {
        ...data,
        receipt_method: paymentMethodLabel(data.receipt_method),
        customer_id_label: data.customer_name,
        bank_account_id_label: data.bank_account_name,
        ...uploadFiles,
      }
    },
    submitCreate: async (data, files) => {
      return createMonthlyReceiptOrder({
        customer_id: data.customer_id,
        receipt_date: formatDate(data.receipt_date) || '',
        receipt_method: data.receipt_method,
        subject_id: data.subject_id || undefined,
        bank_account_id: data.bank_account_id || undefined,
        remark: data.remark || undefined,
        items: JSON.stringify([])
      }, files)
    },
    submitUpdate: async (id, data, files) => {
      return updateMonthlyReceiptOrder({
        monthly_receipt_id: id,
        subject_id: data.subject_id || undefined,
        receipt_date: formatDate(data.receipt_date),
        receipt_method: data.receipt_method || undefined,
        bank_account_id: data.bank_account_id || undefined,
        remark: data.remark || undefined
      }, files)
    },
    tabs: [
      {
        label: '主表信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'customer_id', label: '客户', type: 'input-suffix', required: true, placeholder: '请选择客户', span: 8, dialogType: 'customer', labelKey: 'customer_name' },
          { key: 'subject_id', label: '科目', type: 'tree-select', placeholder: '请选择科目', span: 8, treeData: [], checkStrictly: true, loadTreeData: async () => {
            try { const res = await getAccountSubjectTree(); return res.data?.items || [] } catch { return [] }
          }, treeProps: { label: 'name', children: 'children', value: 'subject_id' } },
          { key: 'receipt_date', label: '收款日期', type: 'date', required: true, placeholder: '请选择收款日期', span: 8 },
          { key: 'receipt_method', label: '收款方式', type: 'select', required: true, placeholder: '请选择收款方式', options: [
            { label: '现金', value: '现金' }, { label: '银行转账', value: '银行转账' }
          ], span: 8 },
          { key: 'bank_account_id', label: '银行账户', type: 'select', placeholder: '银行转账时必填', span: 8, clearable: true, filterable: true, loadOptions: async () => {
            if (!usePermissionStore().hasPerm('perm_api_fin_list_bank')) return []
            try {
              const res = await getBankAccountList({ page: 1, page_size: 100 })
              return (res.data.items || []).map((b: any) => ({ label: b.account_name, value: b.bank_account_id }))
            } catch { return [] }
          } },
          { key: 'remark', label: '备注', type: 'input', placeholder: '请输入备注', span: 16 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '单据图片', type: 'image-upload', maxImages: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteMonthlyReceiptOrderFiles(editId, 'image', [file.url]) } },
          { key: 'attachments', label: '单据附件', type: 'file-upload', maxFiles: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteMonthlyReceiptOrderFiles(editId, 'attachment', [file.url]) } }
        ]
      }
    ]
  },

  // ==================== 财务管理 - 预收款单（PC1-PC11） ====================
  precollectionOrder: {
    title: '新增预收款单',
    editTitle: '编辑预收款单',
    type: 'precollectionOrder',
    module: 'finance/precollection-order',
    successRoute: '/finance/precollection',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getPrecollectionOrderDetail(id)
      const data = res.data
      const uploadFiles = normalizeUploadDetailFiles(data)
      return {
        ...data,
        receipt_method: paymentMethodLabel(data.receipt_method),
        bank_account_id_label: data.bank_account_name,
        ...uploadFiles,
      }
    },
    submitCreate: async (data, files) => {
      return createPrecollectionOrder({
        receipt_date: formatDate(data.receipt_date) || '',
        receipt_method: data.receipt_method,
        subject_id: data.subject_id || undefined,
        bank_account_id: data.bank_account_id || undefined,
        remark: data.remark || undefined,
        items: JSON.stringify([])
      }, files)
    },
    submitUpdate: async (id, data, files) => {
      return updatePrecollectionOrder({
        precollection_order_id: id,
        subject_id: data.subject_id || undefined,
        receipt_date: formatDate(data.receipt_date),
        receipt_method: data.receipt_method || undefined,
        bank_account_id: data.bank_account_id || undefined,
        remark: data.remark || undefined
      }, files)
    },
    tabs: [
      {
        label: '主表信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'subject_id', label: '科目', type: 'tree-select', placeholder: '请选择科目', span: 8, treeData: [], checkStrictly: true, loadTreeData: async () => {
            try { const res = await getAccountSubjectTree(); return res.data?.items || [] } catch { return [] }
          }, treeProps: { label: 'name', children: 'children', value: 'subject_id' } },
          { key: 'receipt_date', label: '收款日期', type: 'date', required: true, placeholder: '请选择收款日期', span: 8 },
          { key: 'receipt_method', label: '收款方式', type: 'select', required: true, placeholder: '请选择收款方式', options: [
            { label: '现金', value: '现金' }, { label: '银行转账', value: '银行转账' }
          ], span: 8 },
          { key: 'bank_account_id', label: '银行账户', type: 'select', placeholder: '银行转账时必填', span: 8, clearable: true, filterable: true, loadOptions: async () => {
            if (!usePermissionStore().hasPerm('perm_api_fin_list_bank')) return []
            try {
              const res = await getBankAccountList({ page: 1, page_size: 100 })
              return (res.data.items || []).map((b: any) => ({ label: b.account_name, value: b.bank_account_id }))
            } catch { return [] }
          } },
          { key: 'remark', label: '备注', type: 'input', placeholder: '请输入备注', span: 16 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '单据图片', type: 'image-upload', maxImages: 5, span: 24, onDeleteRemote: async (file, editId) => { await deletePrecollectionOrderFiles(editId, 'image', [file.url]) } },
          { key: 'attachments', label: '单据附件', type: 'file-upload', maxFiles: 5, span: 24, onDeleteRemote: async (file, editId) => { await deletePrecollectionOrderFiles(editId, 'attachment', [file.url]) } }
        ]
      }
    ]
  },

  vehicle: {
    title: '新增车辆',
    editTitle: '编辑车辆',
    type: 'vehicle',
    module: 'delivery/vehicle',
    successRoute: '/delivery/vehicle',
    labelWidth: '100px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getVehicleDetail(id)
      const data = res.data as any
      return { ...data, ...normalizeUploadDetailFiles(data) }
    },
    submitCreate: (data, files) => createVehicle({
      license_plate: data.license_plate,
      vehicle_name: data.vehicle_name,
      remark: data.remark,
    }, files),
    submitUpdate: (id, data, files) => updateVehicle({
      vehicle_id: id,
      license_plate: data.license_plate,
      vehicle_name: data.vehicle_name,
      remark: data.remark,
    }, files),
    tabs: [
      {
        label: '基础资料',
        fields: [
          { key: 'section-base', label: '车辆信息', type: 'section', span: 24 },
          { key: 'license_plate', label: '车牌号', type: 'input', required: true, placeholder: '请输入车牌号', span: 8 },
          { key: 'vehicle_name', label: '车辆名称', type: 'input', required: true, placeholder: '请输入车辆名称', span: 8 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注信息', rows: 3, span: 24 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '车辆图片', type: 'image-upload', maxImages: 5, span: 24 },
          { key: 'attachments', label: '车辆附件', type: 'file-upload', maxFiles: 5, span: 24 }
        ]
      }
    ]
  },

  // ==================== 财务管理 - 其他付款单（OP1-OP8） ====================
  otherPayment: {
    title: '新增其他付款单',
    editTitle: '编辑其他付款单',
    type: 'otherPayment',
    module: 'finance/other-payment',
    successRoute: '/finance/other-payment',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getOtherPaymentDetail(id)
      const data = res.data as any
      const uploadFiles = normalizeUploadDetailFiles(data)
      return {
        ...data,
        payment_method: data.payment_method,
        bank_account_id_label: data.bank_account_name,
        customer_id_label: data.customer_name,
        supplier_id_label: data.supplier_name,
        sales_return_id_label: data.sales_return_no,
        ...uploadFiles,
      }
    },
    submitCreate: async (data, files) => {
      return createOtherPayment({
        subject_id: data.subject_id || '',
        payment_date: formatDate(data.payment_date) || '',
        payment_method: data.payment_method,
        payment_type: data.payment_type,
        actual_payment_amount: String(data.actual_payment_amount),
        bank_account_id: data.bank_account_id || undefined,
        customer_id: data.customer_id || undefined,
        supplier_id: data.supplier_id || undefined,
        sales_return_id: data.sales_return_id || undefined,
        actual_refund_prepayment: data.actual_refund_prepayment ? String(data.actual_refund_prepayment) : undefined,
        actual_refund_gift_amount: data.actual_refund_gift_amount ? String(data.actual_refund_gift_amount) : undefined,
        remark: data.remark || undefined,
      }, files)
    },
    submitUpdate: async (id, data, files) => {
      return updateOtherPayment({
        other_payment_id: id,
        subject_id: data.subject_id || undefined,
        payment_date: formatDate(data.payment_date),
        payment_method: data.payment_method || undefined,
        payment_type: data.payment_type || undefined,
        actual_payment_amount: data.actual_payment_amount ? String(data.actual_payment_amount) : undefined,
        bank_account_id: data.bank_account_id || undefined,
        customer_id: data.customer_id || undefined,
        supplier_id: data.supplier_id || undefined,
        sales_return_id: data.sales_return_id || undefined,
        actual_refund_prepayment: data.actual_refund_prepayment ? String(data.actual_refund_prepayment) : undefined,
        actual_refund_gift_amount: data.actual_refund_gift_amount ? String(data.actual_refund_gift_amount) : undefined,
        remark: data.remark || undefined,
      }, files)
    },
    tabs: [
      {
        label: '主表信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'payment_type', label: '付款类型', type: 'select', required: true, placeholder: '请选择付款类型', options: [
            { label: '客户付款', value: 'CUSTOMER_PAYMENT' },
            { label: '供应商付款', value: 'SUPPLIER_PAYMENT' },
            { label: '销售退款', value: 'SALES_REFUND' },
          ], span: 8 },
          { key: 'subject_id', label: '科目', type: 'tree-select', required: true, placeholder: '请选择科目', span: 8, checkStrictly: true, loadTreeData: async () => {
            try { const res = await getAccountSubjectTree(); return res.data?.items || [] } catch { return [] }
          }, treeProps: { label: 'name', children: 'children', value: 'subject_id' } },
          { key: 'payment_date', label: '付款日期', type: 'date', required: true, placeholder: '请选择付款日期', span: 8 },
          { key: 'payment_method', label: '付款方式', type: 'select', required: true, placeholder: '请选择付款方式', options: [
            { label: '现金', value: 'CASH' },
            { label: '银行转账', value: 'TRANSFER' },
          ], span: 8 },
          { key: 'bank_account_id', label: '付款银行账户', type: 'select', placeholder: '银行转账时必填', span: 8, clearable: true, filterable: true,
            visible: (formData: Record<string, any>) => formData.payment_method === 'TRANSFER',
            loadOptions: async () => {
              if (!usePermissionStore().hasPerm('perm_api_fin_list_bank')) return []
              try {
                const res = await getBankAccountList({ page: 1, page_size: 100 })
                return (res.data.items || []).map((b: any) => ({ label: b.account_name, value: b.bank_account_id }))
              } catch { return [] }
            }
          },
          { key: 'actual_payment_amount', label: '实际付款金额', type: 'input', required: true, placeholder: '请输入实际付款金额', span: 8 },
          { key: 'customer_id', label: '客户', type: 'input-suffix', placeholder: '请选择客户', span: 8, dialogType: 'customer', labelKey: 'customer_name',
            visible: (formData: Record<string, any>) => formData.payment_type === 'CUSTOMER_PAYMENT' },
          { key: 'supplier_id', label: '供应商', type: 'input-suffix', placeholder: '请选择供应商', span: 8, dialogType: 'supplier', labelKey: 'supplier_name',
            visible: (formData: Record<string, any>) => formData.payment_type === 'SUPPLIER_PAYMENT' },
          { key: 'sales_return_id', label: '销售退货单', type: 'input-suffix', placeholder: '请选择退货单', span: 8, dialogType: 'salesReturn', labelKey: 'return_no',
            visible: (formData: Record<string, any>) => formData.payment_type === 'SALES_REFUND' },
          { key: 'actual_refund_prepayment', label: '退回预存款金额', type: 'input', placeholder: '请输入退回预存款金额', span: 8,
            visible: (formData: Record<string, any>) => formData.payment_type === 'SALES_REFUND' },
          { key: 'actual_refund_gift_amount', label: '退回赠送金额', type: 'input', placeholder: '请输入退回赠送金额', span: 8,
            visible: (formData: Record<string, any>) => formData.payment_type === 'SALES_REFUND' },
          { key: 'remark', label: '备注', type: 'input', placeholder: '请输入备注', span: 16 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '单据图片', type: 'image-upload', maxImages: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteOtherPaymentFiles(editId, 'image', [file.url]) } },
          { key: 'attachments', label: '单据附件', type: 'file-upload', maxFiles: 5, span: 24, onDeleteRemote: async (file, editId) => { await deleteOtherPaymentFiles(editId, 'attachment', [file.url]) } },
        ]
      }
    ]
  }
}

export function getSceneConfig(type: string): SceneConfig | undefined {
  return formConfigMap[type]
}

export function getRegisteredScenes(): string[] {
  return Object.keys(formConfigMap)
}
