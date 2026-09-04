/**
 * 模块：权限可视化 - 页面级精确权限映射（页面 → 权限码）
 *
 * 背景：
 *   后端 sys_menu 是「模块级」菜单（员工管理/财务管理…共 21 个），而
 *   menuPermissionMap.ts 的 PAGE_MENU_BY_TITLE 把多个前端页面映射到同一模块 menu_id，
 *   导致模块内任意一个权限都会点亮该模块下全部页面（例：只绑「创建组织」→
 *   系统管理下 8 个页面全可见）。本文件在模块判定之上补一层「页面 → perm_code」
 *   精确映射，实现页面级收口。2026-09-01 已全模块铺开（员工/客户/产品/仓库/
 *   采购/销售/财务/配送/客户订货）。
 *
 * 判定语义（严格，isPageVisible）：
 *   模块菜单命中 AND 该页面「查询类」权限码命中任一 → 页面可见。
 *   - 只绑写权限（如 perm_api_emp_create_org）时页面不可见（2026-09-01 用户拍板）；
 *   - 未登记映射的页面回退模块级判定（fail-open，兜底未覆盖的页面/子页面）。
 *
 * 绑定联动（expandRolePermissionIds）：
 *   角色绑定树勾中某页面任一权限时，自动补全该页面「查询类」权限 + 跨页依赖（deps），
 *   避免「能提交但页面不可见 / 进去表单 403」。
 *   ⚠️ 联动必须以「用户显式勾选集」为入参、且匹配/补全都只做一轮（非迭代）：
 *   若把上一次联动补出的码也当触发器迭代扩展，会出现两个后果——
 *   1) 勾一个叶子级联点亮整组页面（如「新增科目」点亮全部财务页面）；
 *   2) 取消勾选时联动码仍留在勾选集里被反复补回，节点永远取消不掉。
 *   角色落库值就是 perm_code（AddTemplate.vue onTreeCheck 只收叶子 +
 *   serializePermissionIds 只留 perm_ 前缀），故映射单元统一为 perm_code，
 *   与 my-permissions 返回的 permCodes 集合直接对齐。
 *
 * ⚠️ 格式约定（一致性守卫依赖）：
 *   下方 *_VIEW / *_WRITE / DEP_* 分组数组必须保持「顶层 const、单行、完整 perm_code
 *   字面量」格式，页面绑定行必须保持「'标题': { view: XXX_VIEW, ... }」格式——
 *   pagePermissionMap.test.mjs 通过静态正则读取本文件做防拼写/防漏登记守卫，
 *   改成函数拼接（如 P('query_orgs')）会让守卫静默失效。
 *
 * 维护约定：
 *   - view 组为「查询/列表/详情」类权限码（决定页面可见性），保持最小化：
 *     只放页面主列表/主详情接口；详情页内的子 Tab 查询接口放 write 组；
 *   - write 组 = 该页面自身的写类权限码 + 页面内部的子查询（渲染为本页面叶子）；
 *   - deps 组 = 页面运行时会调用、但归属其他页面域的权限码（下拉选项/选单弹窗/
 *     复用表单等跨页查询）：不渲染为本页面叶子（叶子仍挂在归属页面下，避免同一
 *     权限码在树里被 first-wins 抢占后丢失勾选入口）、不作为联动触发器；勾中本页面
 *     任一叶子时由 expandRolePermissionIds 一并补全。deps 是「勾一个页面节点即可
 *     完整使用该页」的关键——没有它，跨页选项码只能去归属页面下手工勾选；
 *   - all 组 = view + write + deps（完整运行时所需，仅用于联动补全，不参与可见性判定）；
 *   - 同一 view 码原则上不跨页面；确属同资源双页面（别名页）时，必须在
 *     pagePermissionMap.test.mjs 的 SHARED_VIEW_ALLOWED 白名单登记；
 *   - perm_code 来源 permissionUrlMap.generated.ts（由后端 SQL 生成）。
 */

import { resolveMenuCandidates } from './menuPermissionMap'

/** 页面权限绑定：view 决定可见性，write = 本页写类，deps = 跨页依赖，all = 三者并集 */
export interface PagePermBinding {
  /** 页面可见性判定所需权限码（查询类）：命中任一即可见 */
  view: string[]
  /** 跨页依赖码（归属其他页面域的选项/选单查询）：不渲染、不触发联动，勾中本页任一叶子时补全 */
  deps?: string[]
  /** 该页面涉及的全部权限码（view+write+deps）：用于角色绑定树联动补全 */
  all: string[]
}

// ── 跨页依赖分组（deps）：归属页面的「选项/选单」类查询码，供多个页面以 deps 引用 ──
// 码的「归属页面」= 把它放进自己 view/write 组的页面（叶子渲染在那里）。
const DEP_ENUM = ['perm_api_emp_query_enum']
const DEP_ORG_TREE = ['perm_api_emp_query_orgs']
const DEP_USER_PICK = ['perm_api_emp_query_users']
const DEP_AREA_TREE = ['perm_api_emp_query_areas']
const DEP_SELF_PROFILE_UPDATE = ['perm_api_emp_update_profile']
const DEP_CUST_TYPE = ['perm_api_crm_query_customer_types']
const DEP_LOGISTICS = ['perm_api_crm_query_logistics']
const DEP_REGIONS = ['perm_api_crm_query_regions']
const DEP_CUST_PICK = ['perm_api_crm_query_customers', 'perm_api_crm_search_customers']
const DEP_UNIT_LIST = ['perm_api_prod_list_unit']
const DEP_PROD_LIST = ['perm_api_prod_list']
const DEP_PROD_SEARCH = ['perm_api_prod_search']
const DEP_PROD_DETAIL = ['perm_api_prod_detail']
const DEP_SUPPLIER_DETAIL = ['perm_api_pur_detail_supplier']
const DEP_SUPPLIER_TYPE = ['perm_api_pur_list_supplier_type']
const DEP_SUPPLIER_PICK = ['perm_api_pur_list_supplier', 'perm_api_pur_search_supplier']
const DEP_PRINTER = ['perm_api_tenant_printer_models_query', 'perm_api_tenant_printer_models_detail']
const DEP_BANK = ['perm_api_fin_list_bank']
const DEP_SUBJECT = ['perm_api_fin_query_subject']
const DEP_DRV_OPTIONS = ['perm_api_drv_options']
const DEP_PUR_ORDER_SEARCH = ['perm_api_pur_search_order']
const DEP_PUR_RETURN_SEARCH = ['perm_api_pur_search_return']
const DEP_PUR_RETURN_PICK = ['perm_api_pur_list_return', 'perm_api_pur_search_return']
const DEP_UNPAID_SO = ['perm_api_fin_unpaid_sales_orders', 'perm_api_fin_unpaid_sales_orders_search']
const DEP_UNPAID_PO = ['perm_api_fin_unpaid_purchase_orders', 'perm_api_fin_unpaid_purchase_orders_search']
// 拜访表单（customerVisit 场景）被 拜访任务单/负责拜访任务 两页共用；表单码归属拜访任务单
const DEP_VISIT_FORM = ['perm_api_crm_create_visit', 'perm_api_crm_update_visit', 'perm_api_crm_detail_visit']
const DEP_PAYABLE_SR = ['perm_api_fin_payable_sales_returns', 'perm_api_fin_payable_sales_returns_search']
const DEP_REFUNDABLE_PR = ['perm_api_fin_pur_returns_refundable', 'perm_api_fin_pur_returns_refundable_search']
const DEP_MIGRATE_CATEGORY = ['perm_api_prod_migrate_category2']
const DEP_MIGRATE_UNIT = ['perm_api_prod_migrate_unit']
const DEP_MIGRATE_SUPPLIER = ['perm_api_prod_migrate_supplier']
const DEP_PROD_SUPPLIERS = ['perm_api_prod_suppliers_query']
const DEP_CUST_SUMMARY = ['perm_api_sales_customer_detail', 'perm_api_sales_customer_search']
const DEP_PROD_SUMMARY = ['perm_api_sales_product_summary', 'perm_api_sales_product_summary_search']

// ── 系统管理 → 员工管理 ─────────────────────────────────────────
const EMP_USERS_VIEW = ['perm_api_emp_query_users', 'perm_api_emp_search_users', 'perm_api_emp_detail_user']
// emp_query_enum=人事表单枚举字典（getTenantEnumMappings，组织/岗位页以 deps 引用）
const EMP_USERS_WRITE = ['perm_api_emp_create_user', 'perm_api_emp_delete_user', 'perm_api_emp_import_users', 'perm_api_emp_query_enum']

const EMP_ORG_VIEW = ['perm_api_emp_query_orgs', 'perm_api_emp_search_orgs', 'perm_api_emp_detail_org', 'perm_api_emp_org_assoc_query']
const EMP_ORG_WRITE = ['perm_api_emp_create_org', 'perm_api_emp_update_org', 'perm_api_emp_delete_org', 'perm_api_emp_org_delete_preview', 'perm_api_emp_migrate_org']

const EMP_POST_VIEW = ['perm_api_emp_query_posts', 'perm_api_emp_search_posts', 'perm_api_emp_detail_post']
const EMP_POST_WRITE = ['perm_api_emp_create_post', 'perm_api_emp_update_post', 'perm_api_emp_delete_post', 'perm_api_emp_migrate_post']

const EMP_ROLE_VIEW = ['perm_api_emp_query_roles', 'perm_api_emp_search_roles', 'perm_api_emp_detail_role']
const EMP_ROLE_WRITE = ['perm_api_emp_create_role', 'perm_api_emp_update_role', 'perm_api_emp_delete_role', 'perm_api_emp_migrate_role', 'perm_api_emp_query_permissions']

const EMP_ADMIN_VIEW = ['perm_api_emp_query_admin_users', 'perm_api_emp_search_admin_users']

const EMP_AREA_VIEW = ['perm_api_emp_query_areas', 'perm_api_emp_search_areas', 'perm_api_emp_detail_area']
const EMP_AREA_WRITE = ['perm_api_emp_create_area', 'perm_api_emp_update_area', 'perm_api_emp_delete_area', 'perm_api_emp_area_delete_preview', 'perm_api_emp_migrate_area']

const EMP_OPLOG_VIEW = ['perm_api_emp_query_op_logs', 'perm_api_emp_search_op_logs', 'perm_api_emp_detail_op_log']

const EMP_ONLINE_VIEW = ['perm_api_emp_query_online_today', 'perm_api_emp_query_online_by_name']

// ── 客户管理 → 客户关系管理 ─────────────────────────────────────
const CRM_TYPES_VIEW = ['perm_api_crm_query_customer_types', 'perm_api_crm_search_customer_types', 'perm_api_crm_detail_customer_type']
const CRM_TYPES_WRITE = ['perm_api_crm_create_customer_type', 'perm_api_crm_update_customer_type', 'perm_api_crm_delete_customer_type', 'perm_api_crm_migrate_customer_type']

const CRM_LEADS_VIEW = ['perm_api_crm_query_leads', 'perm_api_crm_search_leads', 'perm_api_crm_detail_lead']
const CRM_LEADS_WRITE = ['perm_api_crm_create_lead', 'perm_api_crm_update_lead', 'perm_api_crm_delete_lead', 'perm_api_crm_convert_lead']

const CRM_CUSTOMERS_VIEW = ['perm_api_crm_query_customers', 'perm_api_crm_search_customers', 'perm_api_crm_detail_customer']
const CRM_CUSTOMERS_WRITE = ['perm_api_crm_create_customer', 'perm_api_crm_update_customer', 'perm_api_crm_delete_customer', 'perm_api_crm_import_customer', 'perm_api_crm_migrate_staff', 'perm_api_crm_create_contact', 'perm_api_crm_update_contact', 'perm_api_crm_delete_contact', 'perm_api_crm_create_delivery_addr', 'perm_api_crm_update_delivery_addr', 'perm_api_crm_delete_delivery_addr', 'perm_api_crm_query_contacts', 'perm_api_crm_query_delivery_addrs']

const CRM_OPEN_POOL_VIEW = ['perm_api_crm_open_pool_query', 'perm_api_crm_open_pool_search']
const CRM_OPEN_POOL_WRITE = ['perm_api_crm_open_pool_assign', 'perm_api_crm_open_pool_convert']

const CRM_REGIONS_VIEW = ['perm_api_crm_query_regions', 'perm_api_crm_search_regions', 'perm_api_crm_detail_region']
const CRM_REGIONS_WRITE = ['perm_api_crm_create_region', 'perm_api_crm_update_region', 'perm_api_crm_delete_region', 'perm_api_crm_migrate_region']

const CRM_CREDIT_VIEW = ['perm_api_crm_credit_summary_query', 'perm_api_crm_credit_summary_search']
const CRM_CREDIT_WRITE = ['perm_api_crm_credit_adjust', 'perm_api_crm_credit_logs_query', 'perm_api_crm_credit_logs_search', 'perm_api_crm_credit_usage_list']

const CRM_PREPAY_VIEW = ['perm_api_crm_prepayment_summary_query', 'perm_api_crm_prepayment_summary_search']
const CRM_PREPAY_WRITE = ['perm_api_crm_prepayment_logs_query', 'perm_api_crm_prepayment_logs_search', 'perm_api_crm_prepayment_usage_list']

const CRM_GIFT_VIEW = ['perm_api_crm_gift_summary_query', 'perm_api_crm_gift_summary_search']
const CRM_GIFT_WRITE = ['perm_api_crm_gift_adjust', 'perm_api_crm_gift_logs_query', 'perm_api_crm_gift_logs_search', 'perm_api_crm_gift_usage_list']

const CRM_BALANCE_VIEW = ['perm_api_crm_balance_summary_query', 'perm_api_crm_balance_summary_search']
const CRM_BALANCE_WRITE = ['perm_api_crm_balance_logs_query', 'perm_api_crm_balance_logs_search']

const CRM_VISITS_VIEW = ['perm_api_crm_query_visits', 'perm_api_crm_search_visits', 'perm_api_crm_detail_visit']
// my_customers=拜访表单「我的客户」选择器（本页归属）
const CRM_VISITS_WRITE = ['perm_api_crm_create_visit', 'perm_api_crm_update_visit', 'perm_api_crm_delete_visit', 'perm_api_crm_audit_visit', 'perm_api_crm_visit_images_delete', 'perm_api_crm_my_customers']

const CRM_LOGISTICS_VIEW = ['perm_api_crm_query_logistics', 'perm_api_crm_search_logistics', 'perm_api_crm_detail_logistics']
const CRM_LOGISTICS_WRITE = ['perm_api_crm_create_logistics', 'perm_api_crm_update_logistics', 'perm_api_crm_delete_logistics', 'perm_api_crm_migrate_logistics']

// ── 产品管理 ────────────────────────────────────────────────────
const PROD_CATEGORY_VIEW = ['perm_api_prod_list_category', 'perm_api_prod_search_category', 'perm_api_prod_detail_category']
const PROD_CATEGORY_WRITE = ['perm_api_prod_create_category', 'perm_api_prod_update_category', 'perm_api_prod_delete_category', 'perm_api_prod_category_delete_preview', 'perm_api_prod_migrate_category']

const PROD_UNIT_VIEW = ['perm_api_prod_list_unit', 'perm_api_prod_search_unit', 'perm_api_prod_detail_unit']
const PROD_UNIT_WRITE = ['perm_api_prod_create_unit', 'perm_api_prod_update_unit', 'perm_api_prod_delete_unit']

const PROD_INFO_VIEW = ['perm_api_prod_list', 'perm_api_prod_search', 'perm_api_prod_detail']
const PROD_INFO_WRITE = ['perm_api_prod_create', 'perm_api_prod_update', 'perm_api_prod_delete', 'perm_api_prod_delete_preview', 'perm_api_prod_import', 'perm_api_prod_delete_images', 'perm_api_prod_delete_attachments', 'perm_api_prod_migrate_assist_unit', 'perm_api_prod_migrate_category2', 'perm_api_prod_migrate_supplier', 'perm_api_prod_migrate_unit', 'perm_api_prod_components_create', 'perm_api_prod_components_update', 'perm_api_prod_components_delete', 'perm_api_prod_sale_prices_create', 'perm_api_prod_sale_prices_update', 'perm_api_prod_sale_prices_delete', 'perm_api_prod_suppliers_add', 'perm_api_prod_suppliers_delete', 'perm_api_prod_suppliers_query', 'perm_api_prod_suppliers_search', 'perm_api_prod_recognize']

const PROD_SLOW_VIEW = ['perm_api_prod_slow_moving_query', 'perm_api_prod_slow_moving_search']

// ── 仓库管理 ────────────────────────────────────────────────────
const WMS_LOCATION_VIEW = ['perm_api_wms_search_location', 'perm_api_wms_detail_location']
const WMS_LOCATION_WRITE = ['perm_api_wms_create_location', 'perm_api_wms_update_location', 'perm_api_wms_delete_location', 'perm_api_wms_location_delete_preview']

// 仓库档案接口（tenant-warehouses）由库位管理页承载（仓库树/增删改/迁移/关联查询），无独立仓库页面
const WMS_WAREHOUSE_PERMS = ['perm_api_wms_create_warehouse', 'perm_api_wms_delete_warehouse', 'perm_api_wms_update_warehouse', 'perm_api_wms_detail_warehouse', 'perm_api_wms_query_warehouse', 'perm_api_wms_search_warehouse', 'perm_api_wms_migrate_warehouse', 'perm_api_wms_warehouse_delete_preview', 'perm_api_wms_association_query']

const WMS_STAGING_VIEW = ['perm_api_wms_query_staging', 'perm_api_wms_search_staging', 'perm_api_wms_detail_staging']
const WMS_STAGING_WRITE = ['perm_api_wms_create_staging', 'perm_api_wms_update_staging', 'perm_api_wms_delete_staging']

const WMS_PLASTIC_VIEW = ['perm_api_wms_query_plastic_box', 'perm_api_wms_search_plastic_box', 'perm_api_wms_detail_plastic_box']
const WMS_PLASTIC_WRITE = ['perm_api_wms_create_plastic_box', 'perm_api_wms_update_plastic_box', 'perm_api_wms_delete_plastic_box']

const WMS_STOCK_VIEW = ['perm_api_wms_inventory_list', 'perm_api_wms_inventory_search', 'perm_api_wms_inventory_detail', 'perm_api_wms_inventory_analysis']

// 打印机型号页面专用查询接口（tenant-printer-models / label-specs）。
// 原「打印机」设备管理页已废弃（tenant-printers 接口后端已删除、页面已下线），绑定已移除
const TENANT_PRINTER_VIEW = ['perm_api_tenant_printer_models_query', 'perm_api_tenant_printer_models_search', 'perm_api_tenant_printer_models_detail', 'perm_api_tenant_printer_label_specs_query', 'perm_api_tenant_printer_label_specs_search', 'perm_api_tenant_printer_label_specs_detail']

// ── 采购管理 ────────────────────────────────────────────────────
const PUR_SUPPLIER_TYPE_VIEW = ['perm_api_pur_list_supplier_type', 'perm_api_pur_search_supplier_type', 'perm_api_pur_detail_supplier_type']
const PUR_SUPPLIER_TYPE_WRITE = ['perm_api_pur_create_supplier_type', 'perm_api_pur_update_supplier_type', 'perm_api_pur_delete_supplier_type', 'perm_api_pur_migrate_supplier_type']

const PUR_SUPPLIER_VIEW = ['perm_api_pur_list_supplier', 'perm_api_pur_search_supplier', 'perm_api_pur_detail_supplier']
// pur_supplier_images_delete=供应商图片删除（无其他归属页，渲染在本页叶子下，勾页面即授予）
const PUR_SUPPLIER_WRITE = ['perm_api_pur_create_supplier', 'perm_api_pur_update_supplier', 'perm_api_pur_delete_supplier', 'perm_api_pur_import_supplier', 'perm_api_pur_migrate_supplier', 'perm_api_pur_supplier_attachments_delete', 'perm_api_pur_supplier_images_delete']

const PUR_SUPPLIER_CREDIT_VIEW = ['perm_api_pur_supplier_credit_summary_query', 'perm_api_pur_supplier_credit_summary_search']
const PUR_SUPPLIER_CREDIT_WRITE = ['perm_api_pur_supplier_credit_logs', 'perm_api_pur_supplier_credit_logs_query', 'perm_api_pur_supplier_credit_logs_search', 'perm_api_pur_supplier_credit_usage_list']

const PUR_SUPPLIER_GIFT_VIEW = ['perm_api_pur_supplier_gift_logs_query', 'perm_api_pur_supplier_gift_logs_search']
const PUR_SUPPLIER_GIFT_WRITE = ['perm_api_pur_supplier_gift_logs', 'perm_api_pur_supplier_gift_summary_query', 'perm_api_pur_supplier_gift_summary_search', 'perm_api_pur_supplier_gift_usage_list']

const PUR_ORDER_VIEW = ['perm_api_pur_list_order', 'perm_api_pur_search_order', 'perm_api_pur_detail_order']
const PUR_ORDER_WRITE = ['perm_api_pur_create_order', 'perm_api_pur_create_order_item', 'perm_api_pur_update_order', 'perm_api_pur_update_order_item', 'perm_api_pur_delete_order', 'perm_api_pur_delete_order_item', 'perm_api_pur_import_order', 'perm_api_pur_order_purchase_status', 'perm_api_pur_order_attachments_delete', 'perm_api_pur_order_images_delete', 'perm_api_pur_audit_order', 'perm_api_pur_audit_order_preview']

const PUR_RECEIPT_VIEW = ['perm_api_pur_list_receipt', 'perm_api_pur_search_receipt', 'perm_api_pur_detail_receipt']
const PUR_RECEIPT_WRITE = ['perm_api_pur_create_receipt', 'perm_api_pur_create_receipt_item', 'perm_api_pur_update_receipt', 'perm_api_pur_update_receipt_item', 'perm_api_pur_delete_receipt', 'perm_api_pur_delete_receipt_item', 'perm_api_pur_supplier_pending_receipt_list', 'perm_api_pur_supplier_pending_receipt_search', 'perm_api_pur_receipt_attachments_delete', 'perm_api_pur_receipt_images_delete', 'perm_api_pur_receipt_exception_detail', 'perm_api_pur_receipt_exception_revoke', 'perm_api_pur_receipt_wh_cancel_send', 'perm_api_pur_receipt_wh_return', 'perm_api_pur_receipt_wh_status']

const PUR_RETURN_VIEW = ['perm_api_pur_list_return', 'perm_api_pur_search_return', 'perm_api_pur_detail_return']
const PUR_RETURN_WRITE = ['perm_api_pur_create_return', 'perm_api_pur_create_return_item', 'perm_api_pur_update_return', 'perm_api_pur_update_return_item', 'perm_api_pur_delete_return', 'perm_api_pur_delete_return_item', 'perm_api_pur_return_attachments_delete', 'perm_api_pur_return_images_delete', 'perm_api_pur_return_exception_detail', 'perm_api_pur_return_exception_revoke', 'perm_api_pur_return_wh_cancel_send', 'perm_api_pur_return_wh_return', 'perm_api_pur_return_wh_status', 'perm_api_pur_return_avail_order_items', 'perm_api_pur_return_avail_order_items_search', 'perm_api_pur_return_avail_receipt_deduction', 'perm_api_pur_return_avail_receipt_deduction_search', 'perm_api_pur_return_deduction_records', 'perm_api_pur_audit_return']

const PUR_RECON_VIEW = ['perm_api_pur_list_recon', 'perm_api_pur_detail_recon']
const PUR_RECON_WRITE = ['perm_api_pur_create_recon', 'perm_api_pur_recon_add_orders', 'perm_api_pur_recon_add_returns', 'perm_api_pur_recon_remove_orders', 'perm_api_pur_recon_remove_returns', 'perm_api_pur_audit_recon']

const PUR_RETURN_ITEMS_VIEW = ['perm_api_pur_list_return_items', 'perm_api_pur_search_return_items']
const PUR_RECEIPT_ITEMS_VIEW = ['perm_api_pur_list_receipt_items', 'perm_api_pur_search_receipt_items']

const PUR_SUPPLIER_BALANCE_VIEW = ['perm_api_pur_supplier_balance_summary_query', 'perm_api_pur_supplier_balance_summary_search']
const PUR_SUPPLIER_BALANCE_WRITE = ['perm_api_pur_supplier_balance_logs_list', 'perm_api_pur_supplier_balance_logs_detail_query', 'perm_api_pur_supplier_balance_logs_detail_search']

// ── 销售管理 ────────────────────────────────────────────────────
const SALES_ORDER_VIEW = ['perm_api_sales_list_order', 'perm_api_sales_search_order', 'perm_api_sales_detail_order']
const SALES_ORDER_WRITE = ['perm_api_sales_create_order', 'perm_api_sales_create_order_item', 'perm_api_sales_update_order', 'perm_api_sales_update_order_item', 'perm_api_sales_delete_order', 'perm_api_sales_delete_order_item', 'perm_api_sales_import_order', 'perm_api_sales_audit_order', 'perm_api_sales_audit_order_preview', 'perm_api_sales_exception_detail', 'perm_api_sales_exception_revoke', 'perm_api_sales_wh_cancel_send', 'perm_api_sales_wh_return', 'perm_api_sales_wh_status', 'perm_api_sales_avail_products', 'perm_api_sales_avail_products_search']

const SALES_RETURN_VIEW = ['perm_api_sales_list_return', 'perm_api_sales_search_return', 'perm_api_sales_detail_return']
const SALES_RETURN_WRITE = ['perm_api_sales_create_return', 'perm_api_sales_create_return_item', 'perm_api_sales_update_return', 'perm_api_sales_update_return_item', 'perm_api_sales_delete_return', 'perm_api_sales_delete_return_item', 'perm_api_sales_audit_return', 'perm_api_sales_return_avail_order_items', 'perm_api_sales_return_avail_order_items_search', 'perm_api_sales_return_calculate_deduction', 'perm_api_sales_return_exception_detail', 'perm_api_sales_return_exception_revoke', 'perm_api_sales_return_wh_cancel_send', 'perm_api_sales_return_wh_return', 'perm_api_sales_return_wh_status', 'perm_api_sales_list_return_items', 'perm_api_sales_search_return_items']

const SALES_RECON_VIEW = ['perm_api_sales_list_recon', 'perm_api_sales_detail_recon']
const SALES_RECON_WRITE = ['perm_api_sales_create_recon', 'perm_api_sales_recon_add_orders', 'perm_api_sales_recon_add_returns', 'perm_api_sales_recon_remove_orders', 'perm_api_sales_recon_remove_returns', 'perm_api_sales_audit_recon']

const SALES_PRODUCT_REPORT_VIEW = ['perm_api_sales_product_summary', 'perm_api_sales_product_summary_search', 'perm_api_sales_product_summary_customers', 'perm_api_sales_product_summary_customers_search']

const SALES_CUSTOMER_REPORT_VIEW = ['perm_api_sales_customer_summary', 'perm_api_sales_customer_summary_search', 'perm_api_sales_customer_detail', 'perm_api_sales_customer_items', 'perm_api_sales_customer_search']

const SALES_ORDER_ITEMS_VIEW = ['perm_api_sales_list_order_items', 'perm_api_sales_search_order_items']

// ── 财务管理 ────────────────────────────────────────────────────
const FIN_SUBJECT_VIEW = ['perm_api_fin_query_subject', 'perm_api_fin_search_subject', 'perm_api_fin_detail_subject', 'perm_api_fin_subject_assoc_query']
const FIN_SUBJECT_WRITE = ['perm_api_fin_create_subject', 'perm_api_fin_update_subject', 'perm_api_fin_delete_subject', 'perm_api_fin_subject_delete_preview']

const FIN_BANK_VIEW = ['perm_api_fin_list_bank', 'perm_api_fin_search_bank', 'perm_api_fin_detail_bank']
const FIN_BANK_WRITE = ['perm_api_fin_create_bank', 'perm_api_fin_update_bank', 'perm_api_fin_delete_bank', 'perm_api_fin_bank_attachments_delete', 'perm_api_fin_bank_images_delete']

const FIN_OTHER_RECEIPT_VIEW = ['perm_api_fin_list_other_receipt', 'perm_api_fin_search_other_receipt', 'perm_api_fin_detail_other_receipt']
// refundable 2 码=其他收款单「引用可退款退货单」选单（本页归属，采购退货单列表以 deps 引用）
const FIN_OTHER_RECEIPT_WRITE = ['perm_api_fin_create_other_receipt', 'perm_api_fin_update_other_receipt', 'perm_api_fin_delete_other_receipt', 'perm_api_fin_void_other_receipt', 'perm_api_fin_other_receipt_files_delete', 'perm_api_fin_pur_returns_refundable', 'perm_api_fin_pur_returns_refundable_search']

const FIN_COLLECTION_VIEW = ['perm_api_fin_list_collection', 'perm_api_fin_search_collection', 'perm_api_fin_detail_collection']
// unpaid 2 码=收款单「未收销售订单」选单（本页归属，月结收款/对账单以 deps 引用）
const FIN_COLLECTION_WRITE = ['perm_api_fin_create_collection', 'perm_api_fin_update_collection', 'perm_api_fin_delete_collection', 'perm_api_fin_void_collection', 'perm_api_fin_collection_files_delete', 'perm_api_fin_collection_items_add', 'perm_api_fin_collection_items_update', 'perm_api_fin_collection_items_delete', 'perm_api_fin_unpaid_sales_orders', 'perm_api_fin_unpaid_sales_orders_search']

const FIN_MONTHLY_RECEIPT_VIEW = ['perm_api_fin_list_monthly_receipt', 'perm_api_fin_search_monthly_receipt', 'perm_api_fin_detail_monthly_receipt']
// payable 2 码=月结收款「应付退货单」选单（本页归属，销售对账单以 deps 引用）
const FIN_MONTHLY_RECEIPT_WRITE = ['perm_api_fin_create_monthly_receipt', 'perm_api_fin_update_monthly_receipt', 'perm_api_fin_delete_monthly_receipt', 'perm_api_fin_void_monthly_receipt', 'perm_api_fin_monthly_receipt_files_delete', 'perm_api_fin_monthly_receipt_items_add', 'perm_api_fin_monthly_receipt_items_update', 'perm_api_fin_monthly_receipt_items_delete', 'perm_api_fin_monthly_receipt_return_items_add', 'perm_api_fin_monthly_receipt_return_items_update', 'perm_api_fin_monthly_receipt_return_items_delete', 'perm_api_fin_payable_sales_returns', 'perm_api_fin_payable_sales_returns_search']

const FIN_PRECOLLECTION_VIEW = ['perm_api_fin_list_precollection', 'perm_api_fin_search_precollection', 'perm_api_fin_detail_precollection']
const FIN_PRECOLLECTION_WRITE = ['perm_api_fin_create_precollection', 'perm_api_fin_update_precollection', 'perm_api_fin_delete_precollection', 'perm_api_fin_void_precollection', 'perm_api_fin_precollection_files_delete', 'perm_api_fin_precollection_items_add', 'perm_api_fin_precollection_items_update', 'perm_api_fin_precollection_items_delete']

const FIN_PAYMENT_VIEW = ['perm_api_fin_list_payment', 'perm_api_fin_search_payment', 'perm_api_fin_detail_payment']
// unpaid_po 2 码=付款单「未付采购订单」选单（本页归属）
const FIN_PAYMENT_WRITE = ['perm_api_fin_create_payment', 'perm_api_fin_update_payment', 'perm_api_fin_delete_payment', 'perm_api_fin_void_payment', 'perm_api_fin_payment_files_delete', 'perm_api_fin_payment_items_add', 'perm_api_fin_payment_items_update', 'perm_api_fin_payment_items_delete', 'perm_api_fin_unpaid_purchase_orders', 'perm_api_fin_unpaid_purchase_orders_search']

const FIN_MONTHLY_PAYMENT_VIEW = ['perm_api_fin_list_monthly_payment', 'perm_api_fin_search_monthly_payment', 'perm_api_fin_detail_monthly_payment']
const FIN_MONTHLY_PAYMENT_WRITE = ['perm_api_fin_create_monthly_payment', 'perm_api_fin_update_monthly_payment', 'perm_api_fin_delete_monthly_payment', 'perm_api_fin_void_monthly_payment', 'perm_api_fin_monthly_payment_files_delete', 'perm_api_fin_monthly_payment_items_add', 'perm_api_fin_monthly_payment_items_update', 'perm_api_fin_monthly_payment_items_delete', 'perm_api_fin_monthly_payment_return_items_add', 'perm_api_fin_monthly_payment_return_items_update', 'perm_api_fin_monthly_payment_return_items_delete']

const FIN_PREPAYMENT_VIEW = ['perm_api_fin_list_prepayment', 'perm_api_fin_search_prepayment', 'perm_api_fin_detail_prepayment']
const FIN_PREPAYMENT_WRITE = ['perm_api_fin_create_prepayment', 'perm_api_fin_update_prepayment', 'perm_api_fin_delete_prepayment', 'perm_api_fin_void_prepayment', 'perm_api_fin_prepayment_files_delete', 'perm_api_fin_prepayment_items_add', 'perm_api_fin_prepayment_items_update', 'perm_api_fin_prepayment_items_delete']

const FIN_OTHER_PAYMENT_VIEW = ['perm_api_fin_list_other_payment', 'perm_api_fin_search_other_payment', 'perm_api_fin_detail_other_payment']
const FIN_OTHER_PAYMENT_WRITE = ['perm_api_fin_create_other_payment', 'perm_api_fin_update_other_payment', 'perm_api_fin_delete_other_payment', 'perm_api_fin_void_other_payment', 'perm_api_fin_other_payment_files_delete']

// ── 配送管理（发货/物流/司机/车辆）───────────────────────────────
const DEL_TASK_VIEW = ['perm_api_del_list_task', 'perm_api_del_detail_task', 'perm_api_del_scan_list']
const DEL_TASK_WRITE = ['perm_api_del_create_task', 'perm_api_del_update_task', 'perm_api_del_cancel_task', 'perm_api_del_delete_load', 'perm_api_del_scan_load', 'perm_api_nav_driving_route']

const LGST_VIEW = ['perm_api_lgst_query', 'perm_api_lgst_search', 'perm_api_lgst_detail']
const LGST_WRITE = ['perm_api_lgst_bind_carrier', 'perm_api_lgst_cancel', 'perm_api_lgst_create', 'perm_api_lgst_eligible_orders']

const DRV_VIEW = ['perm_api_drv_query', 'perm_api_drv_search', 'perm_api_drv_detail', 'perm_api_drv_options']
const DRV_WRITE = ['perm_api_drv_create', 'perm_api_drv_update', 'perm_api_drv_delete']

const VEH_VIEW = ['perm_api_veh_list', 'perm_api_veh_detail']
const VEH_WRITE = ['perm_api_veh_create', 'perm_api_veh_update', 'perm_api_veh_delete']

// ── 客户订货管理 ────────────────────────────────────────────────
const CO_ORDER_VIEW = ['perm_api_co_list', 'perm_api_co_search', 'perm_api_co_detail']
const CO_ORDER_WRITE = ['perm_api_co_create', 'perm_api_co_update', 'perm_api_co_delete', 'perm_api_co_audit', 'perm_api_co_items_create', 'perm_api_co_items_update', 'perm_api_co_items_delete', 'perm_api_co_attachments_delete', 'perm_api_co_images_delete']

const CO_ORDER_ITEMS_VIEW = ['perm_api_co_items_list', 'perm_api_co_items_search']

// ── 仪表盘 / 个人中心（负责拜访任务）─────────────────────────────
const DASHBOARD_VIEW = ['perm_api_dashboard_overview']
const MY_VISIT_VIEW = ['perm_api_crm_my_visits', 'perm_api_crm_my_visit_detail', 'perm_api_crm_my_visit_search']
const MY_VISIT_WRITE = ['perm_api_crm_my_visit_complete', 'perm_api_crm_my_visit_images_delete']

// 个人中心（/tenant-users/me 自身资料读写，与员工管理权限解耦，见 personnel.ts 注释）
const SELF_PROFILE_VIEW = ['perm_api_emp_query_me']
const SELF_PROFILE_WRITE = ['perm_api_emp_update_profile', 'perm_api_emp_update_secure', 'perm_api_emp_upload_avatar']

/**
 * 页面标题 → 权限码绑定。
 * key 必须与路由 meta.title 及侧边栏叶子菜单 title 完全一致——两个措辞不同的
 * 变体都要登记（如「客户类型」/「客户类型设定」），分别供 MainLayout 菜单过滤
 * 与路由守卫消费，缺一边就会出现「入口可见但点击被拦」或反向的静默不一致。
 */
export const PAGE_PERMS_BY_TITLE: Record<string, PagePermBinding> = {
  // ── 系统管理 → 员工管理 ──
  '人事资料管理': { view: EMP_USERS_VIEW, deps: [...DEP_ORG_TREE, ...DEP_SELF_PROFILE_UPDATE], all: [...EMP_USERS_VIEW, ...EMP_USERS_WRITE, ...DEP_ORG_TREE, ...DEP_SELF_PROFILE_UPDATE] },
  '组织机构管理': { view: EMP_ORG_VIEW, deps: [...DEP_ENUM], all: [...EMP_ORG_VIEW, ...EMP_ORG_WRITE, ...DEP_ENUM] },
  '岗位管理': { view: EMP_POST_VIEW, deps: [...DEP_ENUM], all: [...EMP_POST_VIEW, ...EMP_POST_WRITE, ...DEP_ENUM] },
  '角色管理': { view: EMP_ROLE_VIEW, all: [...EMP_ROLE_VIEW, ...EMP_ROLE_WRITE] },
  '二级管理员': { view: EMP_ADMIN_VIEW, all: [...EMP_ADMIN_VIEW] },
  '行政区划': { view: EMP_AREA_VIEW, all: [...EMP_AREA_VIEW, ...EMP_AREA_WRITE] },
  '访问日志': { view: EMP_OPLOG_VIEW, all: [...EMP_OPLOG_VIEW] },
  '在线用户': { view: EMP_ONLINE_VIEW, all: [...EMP_ONLINE_VIEW] },
  '仪表盘': { view: DASHBOARD_VIEW, all: [...DASHBOARD_VIEW] },
  '个人中心': { view: SELF_PROFILE_VIEW, all: [...SELF_PROFILE_VIEW, ...SELF_PROFILE_WRITE] },
  // ── 客户管理 → 客户关系管理 ──
  '客户类型': { view: CRM_TYPES_VIEW, all: [...CRM_TYPES_VIEW, ...CRM_TYPES_WRITE] },
  '客户类型设定': { view: CRM_TYPES_VIEW, all: [...CRM_TYPES_VIEW, ...CRM_TYPES_WRITE] },
  '新开拓客户': { view: CRM_LEADS_VIEW, deps: [...DEP_CUST_TYPE, ...DEP_LOGISTICS, ...DEP_REGIONS, ...DEP_AREA_TREE, ...DEP_ORG_TREE, ...DEP_USER_PICK], all: [...CRM_LEADS_VIEW, ...CRM_LEADS_WRITE, ...DEP_CUST_TYPE, ...DEP_LOGISTICS, ...DEP_REGIONS, ...DEP_AREA_TREE, ...DEP_ORG_TREE, ...DEP_USER_PICK] },
  '客户资料': { view: CRM_CUSTOMERS_VIEW, deps: [...DEP_CUST_TYPE, ...DEP_LOGISTICS, ...DEP_REGIONS, ...DEP_AREA_TREE], all: [...CRM_CUSTOMERS_VIEW, ...CRM_CUSTOMERS_WRITE, ...DEP_CUST_TYPE, ...DEP_LOGISTICS, ...DEP_REGIONS, ...DEP_AREA_TREE] },
  '正式客户信息': { view: CRM_CUSTOMERS_VIEW, deps: [...DEP_CUST_TYPE, ...DEP_LOGISTICS, ...DEP_REGIONS, ...DEP_AREA_TREE], all: [...CRM_CUSTOMERS_VIEW, ...CRM_CUSTOMERS_WRITE, ...DEP_CUST_TYPE, ...DEP_LOGISTICS, ...DEP_REGIONS, ...DEP_AREA_TREE] },
  '公海客户': { view: CRM_OPEN_POOL_VIEW, deps: [...DEP_LOGISTICS, ...DEP_REGIONS, ...DEP_ORG_TREE, ...DEP_USER_PICK], all: [...CRM_OPEN_POOL_VIEW, ...CRM_OPEN_POOL_WRITE, ...DEP_LOGISTICS, ...DEP_REGIONS, ...DEP_ORG_TREE, ...DEP_USER_PICK] },
  '区域管理': { view: CRM_REGIONS_VIEW, all: [...CRM_REGIONS_VIEW, ...CRM_REGIONS_WRITE] },
  '区域管理设定': { view: CRM_REGIONS_VIEW, all: [...CRM_REGIONS_VIEW, ...CRM_REGIONS_WRITE] },
  '客户授信余额表': { view: CRM_CREDIT_VIEW, deps: [...DEP_CUST_PICK], all: [...CRM_CREDIT_VIEW, ...CRM_CREDIT_WRITE, ...DEP_CUST_PICK] },
  '预付款余额表': { view: CRM_PREPAY_VIEW, all: [...CRM_PREPAY_VIEW, ...CRM_PREPAY_WRITE] },
  '赠送金额余额表': { view: CRM_GIFT_VIEW, all: [...CRM_GIFT_VIEW, ...CRM_GIFT_WRITE] },
  '客户余额表': { view: CRM_BALANCE_VIEW, all: [...CRM_BALANCE_VIEW, ...CRM_BALANCE_WRITE] },
  '拜访任务单': { view: CRM_VISITS_VIEW, all: [...CRM_VISITS_VIEW, ...CRM_VISITS_WRITE] },
  '负责拜访任务': { view: MY_VISIT_VIEW, deps: [...DEP_VISIT_FORM], all: [...MY_VISIT_VIEW, ...MY_VISIT_WRITE, ...DEP_VISIT_FORM] },
  // ── 产品管理 ──
  '产品类别': { view: PROD_CATEGORY_VIEW, deps: [...DEP_PROD_LIST, ...DEP_MIGRATE_CATEGORY], all: [...PROD_CATEGORY_VIEW, ...PROD_CATEGORY_WRITE, ...DEP_PROD_LIST, ...DEP_MIGRATE_CATEGORY] },
  '计量单位': { view: PROD_UNIT_VIEW, deps: [...DEP_PROD_SEARCH, ...DEP_MIGRATE_UNIT], all: [...PROD_UNIT_VIEW, ...PROD_UNIT_WRITE, ...DEP_PROD_SEARCH, ...DEP_MIGRATE_UNIT] },
  '产品资料': { view: PROD_INFO_VIEW, deps: [...DEP_CUST_TYPE, ...DEP_UNIT_LIST, ...DEP_SUPPLIER_DETAIL, ...DEP_PRINTER], all: [...PROD_INFO_VIEW, ...PROD_INFO_WRITE, ...DEP_CUST_TYPE, ...DEP_UNIT_LIST, ...DEP_SUPPLIER_DETAIL, ...DEP_PRINTER] },
  '滞销产品': { view: PROD_SLOW_VIEW, deps: [...DEP_PROD_DETAIL, ...DEP_UNIT_LIST, ...DEP_CUST_TYPE, ...DEP_SUPPLIER_DETAIL, ...DEP_PRINTER], all: [...PROD_SLOW_VIEW, ...DEP_PROD_DETAIL, ...DEP_UNIT_LIST, ...DEP_CUST_TYPE, ...DEP_SUPPLIER_DETAIL, ...DEP_PRINTER] },
  '滞销产品表': { view: PROD_SLOW_VIEW, deps: [...DEP_PROD_DETAIL, ...DEP_UNIT_LIST, ...DEP_CUST_TYPE, ...DEP_SUPPLIER_DETAIL, ...DEP_PRINTER], all: [...PROD_SLOW_VIEW, ...DEP_PROD_DETAIL, ...DEP_UNIT_LIST, ...DEP_CUST_TYPE, ...DEP_SUPPLIER_DETAIL, ...DEP_PRINTER] },
  // ── 仓库管理 ──
  '库位管理': { view: WMS_LOCATION_VIEW, deps: [...DEP_AREA_TREE, ...DEP_PRINTER], all: [...WMS_LOCATION_VIEW, ...WMS_LOCATION_WRITE, ...WMS_WAREHOUSE_PERMS, ...DEP_AREA_TREE, ...DEP_PRINTER] },
  '放货货位': { view: WMS_STAGING_VIEW, all: [...WMS_STAGING_VIEW, ...WMS_STAGING_WRITE] },
  '塑料盒管理': { view: WMS_PLASTIC_VIEW, deps: [...DEP_PRINTER], all: [...WMS_PLASTIC_VIEW, ...WMS_PLASTIC_WRITE, ...DEP_PRINTER] },
  '产品库存': { view: WMS_STOCK_VIEW, all: [...WMS_STOCK_VIEW] },
  '打印机型号': { view: TENANT_PRINTER_VIEW, all: [...TENANT_PRINTER_VIEW] },
  // ── 采购管理 ──
  '供应商类型': { view: PUR_SUPPLIER_TYPE_VIEW, all: [...PUR_SUPPLIER_TYPE_VIEW, ...PUR_SUPPLIER_TYPE_WRITE] },
  '供应商档案': { view: PUR_SUPPLIER_VIEW, deps: [...DEP_AREA_TREE, ...DEP_SUPPLIER_TYPE, ...DEP_MIGRATE_SUPPLIER, ...DEP_PROD_SUPPLIERS], all: [...PUR_SUPPLIER_VIEW, ...PUR_SUPPLIER_WRITE, ...DEP_AREA_TREE, ...DEP_SUPPLIER_TYPE, ...DEP_MIGRATE_SUPPLIER, ...DEP_PROD_SUPPLIERS] },
  '供应商授信': { view: PUR_SUPPLIER_CREDIT_VIEW, all: [...PUR_SUPPLIER_CREDIT_VIEW, ...PUR_SUPPLIER_CREDIT_WRITE] },
  '供应商赠送金额': { view: PUR_SUPPLIER_GIFT_VIEW, all: [...PUR_SUPPLIER_GIFT_VIEW, ...PUR_SUPPLIER_GIFT_WRITE] },
  '采购订单': { view: PUR_ORDER_VIEW, all: [...PUR_ORDER_VIEW, ...PUR_ORDER_WRITE] },
  '采购入库单': { view: PUR_RECEIPT_VIEW, all: [...PUR_RECEIPT_VIEW, ...PUR_RECEIPT_WRITE] },
  '采购入库单明细': { view: PUR_RECEIPT_ITEMS_VIEW, all: [...PUR_RECEIPT_ITEMS_VIEW] },
  '采购退货单': { view: PUR_RETURN_VIEW, deps: [...DEP_REFUNDABLE_PR], all: [...PUR_RETURN_VIEW, ...PUR_RETURN_WRITE, ...DEP_REFUNDABLE_PR] },
  '采购退货汇总表': { view: PUR_RETURN_ITEMS_VIEW, all: [...PUR_RETURN_ITEMS_VIEW] },
  '采购对账单': { view: PUR_RECON_VIEW, deps: [...DEP_PUR_ORDER_SEARCH, ...DEP_PUR_RETURN_SEARCH, ...DEP_SUPPLIER_PICK], all: [...PUR_RECON_VIEW, ...PUR_RECON_WRITE, ...DEP_PUR_ORDER_SEARCH, ...DEP_PUR_RETURN_SEARCH, ...DEP_SUPPLIER_PICK] },
  '供应商余额表': { view: PUR_SUPPLIER_BALANCE_VIEW, all: [...PUR_SUPPLIER_BALANCE_VIEW, ...PUR_SUPPLIER_BALANCE_WRITE] },
  // ── 销售管理 ──
  '销售订单': { view: SALES_ORDER_VIEW, deps: [...DEP_LOGISTICS, ...DEP_BANK, ...DEP_PROD_DETAIL], all: [...SALES_ORDER_VIEW, ...SALES_ORDER_WRITE, ...DEP_LOGISTICS, ...DEP_BANK, ...DEP_PROD_DETAIL] },
  '销售退货单': { view: SALES_RETURN_VIEW, all: [...SALES_RETURN_VIEW, ...SALES_RETURN_WRITE] },
  '对账单管理': { view: SALES_RECON_VIEW, deps: [...DEP_UNPAID_SO, ...DEP_PAYABLE_SR], all: [...SALES_RECON_VIEW, ...SALES_RECON_WRITE, ...DEP_UNPAID_SO, ...DEP_PAYABLE_SR] },
  '对账单': { view: SALES_RECON_VIEW, deps: [...DEP_UNPAID_SO, ...DEP_PAYABLE_SR], all: [...SALES_RECON_VIEW, ...SALES_RECON_WRITE, ...DEP_UNPAID_SO, ...DEP_PAYABLE_SR] },
  '产品销售汇总表': { view: SALES_PRODUCT_REPORT_VIEW, all: [...SALES_PRODUCT_REPORT_VIEW] },
  '客户销售汇总表': { view: SALES_CUSTOMER_REPORT_VIEW, all: [...SALES_CUSTOMER_REPORT_VIEW] },
  '销售订单明细表': { view: SALES_ORDER_ITEMS_VIEW, all: [...SALES_ORDER_ITEMS_VIEW] },
  // ── 财务管理 ──
  '科目管理': { view: FIN_SUBJECT_VIEW, all: [...FIN_SUBJECT_VIEW, ...FIN_SUBJECT_WRITE] },
  '银行账户': { view: FIN_BANK_VIEW, all: [...FIN_BANK_VIEW, ...FIN_BANK_WRITE] },
  '其他收款': { view: FIN_OTHER_RECEIPT_VIEW, deps: [...DEP_BANK, ...DEP_SUBJECT], all: [...FIN_OTHER_RECEIPT_VIEW, ...FIN_OTHER_RECEIPT_WRITE, ...DEP_BANK, ...DEP_SUBJECT] },
  '收款单': { view: FIN_COLLECTION_VIEW, deps: [...DEP_BANK, ...DEP_SUBJECT], all: [...FIN_COLLECTION_VIEW, ...FIN_COLLECTION_WRITE, ...DEP_BANK, ...DEP_SUBJECT] },
  '月结收款单': { view: FIN_MONTHLY_RECEIPT_VIEW, deps: [...DEP_BANK, ...DEP_SUBJECT, ...DEP_CUST_PICK, ...DEP_UNPAID_SO], all: [...FIN_MONTHLY_RECEIPT_VIEW, ...FIN_MONTHLY_RECEIPT_WRITE, ...DEP_BANK, ...DEP_SUBJECT, ...DEP_CUST_PICK, ...DEP_UNPAID_SO] },
  '预收款单': { view: FIN_PRECOLLECTION_VIEW, deps: [...DEP_BANK, ...DEP_SUBJECT, ...DEP_CUST_PICK], all: [...FIN_PRECOLLECTION_VIEW, ...FIN_PRECOLLECTION_WRITE, ...DEP_BANK, ...DEP_SUBJECT, ...DEP_CUST_PICK] },
  '付款单': { view: FIN_PAYMENT_VIEW, deps: [...DEP_BANK, ...DEP_SUBJECT], all: [...FIN_PAYMENT_VIEW, ...FIN_PAYMENT_WRITE, ...DEP_BANK, ...DEP_SUBJECT] },
  '月结付款单': { view: FIN_MONTHLY_PAYMENT_VIEW, deps: [...DEP_BANK, ...DEP_SUBJECT, ...DEP_PUR_RETURN_PICK, ...DEP_UNPAID_PO], all: [...FIN_MONTHLY_PAYMENT_VIEW, ...FIN_MONTHLY_PAYMENT_WRITE, ...DEP_BANK, ...DEP_SUBJECT, ...DEP_PUR_RETURN_PICK, ...DEP_UNPAID_PO] },
  '预付款单': { view: FIN_PREPAYMENT_VIEW, deps: [...DEP_BANK, ...DEP_SUBJECT, ...DEP_SUPPLIER_PICK], all: [...FIN_PREPAYMENT_VIEW, ...FIN_PREPAYMENT_WRITE, ...DEP_BANK, ...DEP_SUBJECT, ...DEP_SUPPLIER_PICK] },
  '其他付款': { view: FIN_OTHER_PAYMENT_VIEW, deps: [...DEP_BANK, ...DEP_SUBJECT], all: [...FIN_OTHER_PAYMENT_VIEW, ...FIN_OTHER_PAYMENT_WRITE, ...DEP_BANK, ...DEP_SUBJECT] },
  // ── 配送管理 ──
  '配送任务': { view: DEL_TASK_VIEW, all: [...DEL_TASK_VIEW, ...DEL_TASK_WRITE] },
  '物流单号管理': { view: LGST_VIEW, deps: [...DEP_LOGISTICS, ...DEP_DRV_OPTIONS], all: [...LGST_VIEW, ...LGST_WRITE, ...DEP_LOGISTICS, ...DEP_DRV_OPTIONS] },
  '司机档案': { view: DRV_VIEW, all: [...DRV_VIEW, ...DRV_WRITE] },
  '车辆管理': { view: VEH_VIEW, all: [...VEH_VIEW, ...VEH_WRITE] },
  '物流公司': { view: CRM_LOGISTICS_VIEW, all: [...CRM_LOGISTICS_VIEW, ...CRM_LOGISTICS_WRITE] },
  // ── 客户订货管理 ──
  '客户订货单': { view: CO_ORDER_VIEW, all: [...CO_ORDER_VIEW, ...CO_ORDER_WRITE] },
  '客户订货明细表': { view: CO_ORDER_ITEMS_VIEW, deps: [...DEP_CUST_PICK, ...DEP_CUST_SUMMARY, ...DEP_PROD_SUMMARY], all: [...CO_ORDER_ITEMS_VIEW, ...DEP_CUST_PICK, ...DEP_CUST_SUMMARY, ...DEP_PROD_SUMMARY] },
}

/** 页面级判定所需的最小权限视图（permission store 满足该结构） */
export interface PagePermissionView {
  /** 模块菜单名是否可见（menuNames 集合，第一道判定） */
  hasMenu(name: string): boolean
  /** 权限码是否命中（permCodes 集合，第二道判定） */
  hasPerm(code: string): boolean
}

/**
 * 页面级严格判定（模块菜单 + 查询类权限双闸）。
 *
 * @param path  路由 path（用于模块级候选解析；侧边栏场景传菜单项 index）
 * @param title 路由 meta.title 或侧边栏叶子菜单 title
 * @returns true = 页面可见。未登记映射 / view 组为空 → 回退模块级判定结果（fail-open）
 */
export function isPageVisible(path: string, title: string | undefined, permission: PagePermissionView): boolean {
  const menuOk = resolveMenuCandidates(path, title).some(name => permission.hasMenu(name))
  if (!menuOk) return false
  const binding = PAGE_PERMS_BY_TITLE[(title || '').trim()]
  if (!binding || !binding.view.length) return true
  return binding.view.some(code => permission.hasPerm(code))
}

/**
 * 角色绑定树联动：勾中某页面任一「自有」权限（view/write 叶子）→ 补全该页面
 * 查询类权限 + 跨页依赖（deps）。纯函数、幂等、只做一轮匹配（以入参集为触发依据，
 * 不把补全结果再当触发器迭代——否则取消勾选时联动码会被反复补回，节点无法取消）。
 * 返回去重后的新数组，不修改入参。
 */
export function expandRolePermissionIds(selected: string[] | unknown): string[] {
  const list = Array.isArray(selected) ? selected : (selected ? [selected] : [])
  const original = new Set(list.map(String))
  const picked = new Set(original)
  for (const binding of Object.values(PAGE_PERMS_BY_TITLE)) {
    // 触发器 = 本页自有码（all 去掉 deps）：deps 码挂在归属页面下，不能反过来把
    // 消费页面的绑定也点亮（例：勾「新增科目」不得经由 deps 点亮全部财务页面）
    const deps = binding.deps || []
    const trigger = binding.all.filter(code => !deps.includes(code))
    if (!trigger.some(code => original.has(code))) continue
    for (const code of binding.view) picked.add(code)
    for (const code of deps) picked.add(code)
  }
  return [...picked]
}
