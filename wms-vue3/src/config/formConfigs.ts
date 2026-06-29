import {
  getOrgTree, getOrgTypeOptions,
  getPersonnelDetail, createPersonnel, updatePersonnel,
  getUserDetail, createUser, updateUserProfile, getUserTypeOptions,
  type UserCreatePayload, type UserUpdatePayload,
  getPositionList, getPostDetail, createPost, updatePost, getPostCategoryOptions,
  getOrgDetail, createOrg, updateOrg,
  getRoleDetail, createRole, updateRole, getRoleAll, type RoleCreatePayload, type RoleUpdatePayload,
  getAdminDetail, createAdmin, updateAdmin,
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
  getLogisticsCompanyList,
  getProductCategoryDetail, createProductCategory, updateProductCategory,
  getProductCategoryTree,
  getProductUnitDetail, createProductUnit, updateProductUnit, getProductUnitList,
  getProductDetail, createProduct, updateProduct, addProductSupplier,
  bindProductSalePrices, updateProductSalePrices, deleteProductSalePrice,
  getWarehouseTree, getWarehouseDetail, createWarehouse, updateWarehouse,
  getLocationDetail, createLocation, updateLocation,
  getShelfDetail, createShelf, updateShelf,
  getPlasticBoxDetail, createPlasticBox, updatePlasticBox,
  getStagingSpotDetail, createStagingSpot, updateStagingSpot,
  getBarcodeDetail, createBarcode, updateBarcode,
  getPrinterDetail, createPrinter, updatePrinter,
  getCustomerOrderDetail, createCustomerOrder, updateCustomerOrder,
  getSalesOrderDetail, createSalesOrder, updateSalesOrder,
  getSalesReturnDetail, createSalesReturn, updateSalesReturn,
  getAfterSaleDetail, createAfterSale, updateAfterSale,
  getReconciliationDetail, createReconciliation, updateReconciliation,
  getSupplierTypeDetail, createSupplierType, updateSupplierType, getSupplierTypeList,
  getSupplierDetail, createSupplier, updateSupplier,
  getPurchaseOrderDetail, createPurchaseOrder, updatePurchaseOrder, addPurchaseOrderItems, updatePurchaseOrderItems,
  getPurchaseInboundDetail, createPurchaseInbound, updatePurchaseInbound,
  getPurchaseReturnDetail, createPurchaseReturn, updatePurchaseReturn
} from '@/api'

export type FieldType = 'input' | 'textarea' | 'select' | 'radio' | 'tree-select' | 'date' | 'number' | 'section' | 'input-suffix' | 'dynamic-table' | 'embedded-table' | 'checkbox-group' | 'image-upload' | 'file-upload'

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
  onSuffixClick?: string
  columns?: { key: string; label: string; width?: number; type?: string; options?: { label: string; value: string | number }[]; treeData?: unknown[]; treeProps?: Record<string, string>; loadOptions?: () => Promise<{ label: string; value: string | number }[]>; dialogType?: string; labelKey?: string; fillFields?: Record<string, string> }[]
  tableData?: unknown[]
  addLabel?: string
  /** 点击新增按钮时直接打开弹窗选择，选完后自动加行 */
  addViaDialog?: boolean
  /** addViaDialog 为 true 时打开的弹窗类型：'product'（产品选择）| 'pending-receipt'（待收货明细选择） */
  addDialogType?: 'product' | 'pending-receipt'
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
  dialogType?: 'supplier' | 'customer' | 'employee'
  /** 弹窗确认后回显 label 的取值字段名（如 supplier_name）；不传则用 name */
  labelKey?: string
  loadTreeData?: () => Promise<unknown[]>
  loadOptions?: () => Promise<{ label: string; value: string | number }[]>
  maxImages?: number
  maxFiles?: number
}

export interface TabConfig {
  label: string
  fields: FieldConfig[]
}

export interface SceneConfig {
  title: string
  editTitle?: string
  type: string
  module: string
  tabs: TabConfig[]
  labelWidth?: string
  labelPosition?: 'left' | 'right' | 'top'
  apiAction?: string
  successRoute?: string
  loadDetail?: (id: string) => Promise<Record<string, any>>
  submitCreate?: (data: Record<string, any>, files?: Record<string, File[]>) => Promise<any>
  submitUpdate?: (id: string, data: Record<string, any>, files?: Record<string, File[]>) => Promise<any>
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

const formConfigMap: Record<string, SceneConfig> = {
  personnel: {
    title: '新增用户',
    editTitle: '编辑用户',
    type: 'personnel',
    module: 'system/personnel',
    successRoute: '/system/personnel',
    labelWidth: '110px',
    loadDetail: async (id: string) => {
      const cached = sessionStorage.getItem('editData:personnel')
      const orgId = cached ? (JSON.parse(cached).org_id as string | undefined) : undefined
      const res = await getUserDetail(id, orgId)
      const data = res.data as any
      return data.user?.[0] || data
    },
    submitCreate: (data) => createUser(data as unknown as UserCreatePayload),
    submitUpdate: (id, data) => updateUserProfile({ target_user_id: id, ...(data as object) } as unknown as UserUpdatePayload),
    tabs: [
      {
        label: '用户信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'user_name', label: '员工姓名', type: 'input', required: true, placeholder: '请输入员工姓名', span: 8 },
          { key: 'password', label: '初始密码', type: 'input', required: true, placeholder: '至少6位', span: 8, rules: [{ min: 6, message: '密码至少6位', trigger: 'blur' }] },
          { key: 'sort_no', label: '排序编号', type: 'number', defaultValue: 0, span: 8 },
          { key: 'mobile', label: '手机号码', type: 'input', placeholder: '请输入手机号码', span: 8, rules: [{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码', trigger: 'blur' }] },
          { key: 'email', label: '电子邮箱', type: 'input', placeholder: '请输入电子邮箱', span: 8, rules: [{ pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, message: '请输入正确的邮箱格式', trigger: 'blur' }] },
          { key: 'user_type', label: '用户类型', type: 'select', placeholder: '请选择用户类型', span: 8, options: [], loadOptions: async () => { try { return await getUserTypeOptions() } catch { return [] } } },
          { key: 'status', label: '状态', type: 'select', defaultValue: 1, span: 8, options: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] },
          { key: 'section-org', label: '组织与岗位', type: 'section', span: 24 },
          { key: 'org_id', label: '所属组织', type: 'tree-select', required: true, placeholder: '请选择所属组织', span: 12, treeProps: { label: 'name', children: 'children', value: 'org_code' }, treeData: [], loadTreeData: async () => { const res = await getOrgTree(); return res.data.org || [] } },
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
      const permission_id = Array.isArray(rawPerm) ? rawPerm : (rawPerm ? [rawPerm] : [])
      return { ...(role as unknown as Record<string, any>), permission_id } as Record<string, any>
    },
    submitCreate: (data) => createRole({
      role_name: data.role_name,
      role_type: data.role_type,
      sort_no: Number(data.sort_no) || 0,
      status: data.status === '' || data.status === undefined ? 1 : Number(data.status),
      remark: data.remark || undefined,
      permission_id: Array.isArray(data.permission_id) ? JSON.stringify(data.permission_id) : (data.permission_id || '[]'),
    } as RoleCreatePayload),
    submitUpdate: (id, data) => updateRole(id, {
      role_id: id,
      role_name: data.role_name,
      role_type: data.role_type,
      permission_id: Array.isArray(data.permission_id) ? JSON.stringify(data.permission_id) : (data.permission_id || '[]'),
      sort_no: data.sort_no === '' || data.sort_no === undefined ? undefined : Number(data.sort_no),
      status: data.status === '' || data.status === undefined ? 1 : Number(data.status),
      remark: data.remark || undefined,
    } as RoleUpdatePayload),
    tabs: [
      {
        label: '角色信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'role_name', label: '角色名称', type: 'input', required: true, placeholder: '请输入角色名称', span: 8 },
          { key: 'role_code', label: '角色编码', type: 'input', placeholder: '保存后自动生成', span: 8, visible: (formData: Record<string, any>) => !formData.role_code },
          { key: 'role_type', label: '角色类型', type: 'select', required: true, placeholder: '请选择角色类型', options: [
            { label: '主管', value: 'MANAGER' }, { label: '员工', value: 'EMPLOYEE' }
          ], span: 8 },
          { key: 'sort_no', label: '排序号', type: 'number', defaultValue: 0, span: 8 },
          { key: 'is_system', label: '系统角色', type: 'radio', defaultValue: 0, options: [
            { label: '是', value: 1 as any }, { label: '否', value: 0 as any }
          ], span: 8, visible: (formData: Record<string, any>) => !!formData.is_system },
          { key: 'status', label: '状态', type: 'radio', defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '停用', value: 0 }
          ], span: 8 },
          {
            key: 'permission_id', label: '权限ID', type: 'select', multiple: true, filterable: true, allowCreate: true,
            placeholder: '请输入权限ID（回车添加），已分配权限以中文名展示',
            span: 24, defaultValue: [], options: [],
            // 编辑回显：用详情返回的 permission_name 作为选项 label（中文描述），value 仍为权限ID本体
            loadOptions: async () => {
              try {
                const cached = sessionStorage.getItem('editData:role')
                if (!cached) return []
                const row = JSON.parse(cached)
                const ids: any[] = Array.isArray(row.permission_id) ? row.permission_id : (row.permission_id ? [row.permission_id] : [])
                const names: any[] = Array.isArray(row.permission_name) ? row.permission_name : (row.permission_name ? [row.permission_name] : [])
                return ids.map((pid, i) => ({ label: String(names[i] || pid), value: String(pid) }))
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
      const res = await getAdminDetail(id)
      return res.data
    },
    submitCreate: (data) => createAdmin(data),
    submitUpdate: (id, data) => updateAdmin(id, data),
    tabs: [
      {
        label: '管理员信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'account', label: '登录账号', type: 'input', required: true, placeholder: '请输入登录账号', span: 8 },
          { key: 'nickname', label: '用户昵称', type: 'input', required: true, placeholder: '请输入用户昵称', span: 8 },
          { key: 'email', label: '电子邮箱', type: 'input', placeholder: '请输入电子邮箱', span: 8, rules: [{ pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, message: '请输入正确的邮箱格式', trigger: 'blur' }] },
          { key: 'phone', label: '手机号码', type: 'input', placeholder: '请输入手机号码', span: 8, rules: [{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码', trigger: 'blur' }] },
          { key: 'officePhone', label: '办公电话', type: 'input', placeholder: '请输入办公电话', span: 8 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
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
      return area as unknown as Record<string, any>
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
          { key: 'parent_id', label: '上级区划', type: 'input', placeholder: '上级区划ID，不填为顶级', span: 8 },
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
      return res.data as unknown as Record<string, any>
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
      return res.data as unknown as Record<string, any>
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
      return res.data as unknown as Record<string, any>
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
      is_monthly_settlement: Number(data.is_monthly_settlement) ?? 0,
      monthly_days: Number(data.monthly_days) || 0,
      settlement_day: Number(data.settlement_day) || 0,
      credit_amount: String(data.credit_amount ?? 0),
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
          { key: 'area_id', label: '行政区划', type: 'select', placeholder: '请选择行政区划', options: [], span: 8, loadOptions: async () => { try { const res = await getAreaList({}); const flat: { label: string; value: string }[] = []; const walk = (nodes: any[]) => { nodes.forEach(n => { flat.push({ label: n.area_name, value: n.area_id }); if (n.children?.length) walk(n.children); }); }; walk(res.data.area); return flat; } catch { return [] } } },
          { key: 'detail_address', label: '详细地址', type: 'input', placeholder: '请输入详细地址', span: 8 },
          { key: 'company_leader_name', label: '公司负责人', type: 'input', placeholder: '请输入负责人名称', span: 8 },
          { key: 'leader_phone', label: '负责人电话', type: 'input', placeholder: '请输入负责人电话', span: 8 },
          { key: 'customer_type_id', label: '客户类型', type: 'select', placeholder: '请选择客户类型', options: [], span: 8, loadOptions: async () => { try { const res = await getCustomerTypeList({ page: 1 }); return res.data.customer_type.map((t: any) => ({ label: t.type_name, value: t.customer_type_id })) } catch { return [] } } },
          { key: 'region_id', label: '所属区域', type: 'select', placeholder: '请选择所属区域', options: [], span: 8, loadOptions: async () => { try { const res = await getCustomerRegionList({ page: 1 }); return res.data.regions.map((r: any) => ({ label: r.region_name, value: r.region_id })) } catch { return [] } } },
          { key: 'logistics_company_id', label: '物流公司', type: 'select', placeholder: '请选择物流公司', options: [], span: 8, loadOptions: async () => { try { const res = await getLogisticsCompanyList({ page: 1 }); return res.data.logistics_company.map((l: any) => ({ label: l.company_name, value: l.logistics_company_id })) } catch { return [] } } },
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
          { key: 'credit_amount', label: '授信额度', type: 'number', defaultValue: 0, span: 8 },
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
      return res.data as unknown as Record<string, any>
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
          { key: 'area_id', label: '行政区划', type: 'select', placeholder: '请选择行政区划', options: [], span: 8, loadOptions: async () => { try { const res = await getAreaList({}); const flat: { label: string; value: string }[] = []; const walk = (nodes: any[]) => { nodes.forEach(n => { flat.push({ label: n.area_name, value: n.area_id }); if (n.children?.length) walk(n.children); }); }; walk(res.data.area); return flat; } catch { return [] } } },
          { key: 'detail_address', label: '详细地址', type: 'input', placeholder: '请输入详细地址', span: 8 },
          { key: 'contact_name', label: '负责人名称', type: 'input', placeholder: '请输入负责人名称', span: 8 },
          { key: 'contact_phone', label: '负责人电话', type: 'input', placeholder: '请输入负责人电话', span: 8 },
          { key: 'customer_type_id', label: '客户类型', type: 'select', placeholder: '请选择客户类型', options: [], span: 8, loadOptions: async () => { try { const res = await getCustomerTypeList({ page: 1 }); return res.data.customer_type.map((t: any) => ({ label: t.type_name, value: t.customer_type_id })) } catch { return [] } } },
          { key: 'region_id', label: '所属区域', type: 'select', placeholder: '请选择所属区域', options: [], span: 8, loadOptions: async () => { try { const res = await getCustomerRegionList({ page: 1 }); return res.data.regions.map((r: any) => ({ label: r.region_name, value: r.region_id })) } catch { return [] } } },
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
          { key: 'salesman_user_id', label: '销售员ID', type: 'input', placeholder: '请输入销售员ID', span: 8 },
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
      return res.data.product_category
    },
    submitCreate: (data) => createProductCategory(data),
    submitUpdate: (id, data) => updateProductCategory(id, data),
    tabs: [
      {
        label: '类别信息',
        fields: [
          { key: 'name', label: '类别名称', type: 'input', required: true, placeholder: '请输入类别名称', span: 8 },
          { key: 'parent_id', label: '上级产品类别', type: 'input-suffix', placeholder: '请选择上级产品类别（无则留空）', span: 8, suffixIcon: 'ArrowDown', loadTreeData: async () => { try { const res = await getProductCategoryTree(); return res.data } catch { const cached = sessionStorage.getItem('treeCache:productCategory'); return cached ? JSON.parse(cached) : [] } } },
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
    type: 'productInfo',
    module: 'product/info',
    successRoute: '/product/info',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getProductDetail(id)
      const data = res.data
      // 缓存原始销售价格ID，用于编辑时追踪删除
      if (data.sale_prices) {
        sessionStorage.setItem('productInfo:originalSalePriceIds', JSON.stringify(data.sale_prices.map((sp: any) => sp.sale_price_id)))
      }
      return data
    },
    submitCreate: async (data, files) => {
      const res = await createProduct({
        product_name: data.product_name,
        product_type: data.product_type,
        category_id: data.category_id,
        supplier_id: data.supplier_id,
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
      // 关联供应商（接口26：批量新增产品关联供应商）
      const associatedSuppliers: any[] = data.product_suppliers || []
      if (associatedSuppliers.length > 0 && res.data?.product_id) {
        await addProductSupplier({
          product_id: res.data.product_id,
          supplier_id: associatedSuppliers.map(s => ({
            supplier_id: s.supplier_id,
            supplier_model: s.supplier_model || undefined
          }))
        }).catch(() => {})
      }
      return res
    },
    submitUpdate: async (id, data, files) => {
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
        })))
      }
      // 更新：有 sale_price_id 的行
      const existingPrices = salePrices.filter((r: any) => r.sale_price_id)
      if (existingPrices.length > 0) {
        await updateProductSalePrices(id, existingPrices.map((r: any) => ({
          sale_price_id: r.sale_price_id,
          sale_price: String(r.sale_price),
          remark: r.remark || undefined
        })))
      }
      sessionStorage.removeItem('productInfo:originalSalePriceIds')
      // 关联供应商（接口26：批量新增产品关联供应商）
      const associatedSuppliers: any[] = data.product_suppliers || []
      if (associatedSuppliers.length > 0) {
        await addProductSupplier({
          product_id: id,
          supplier_id: associatedSuppliers.map(s => ({
            supplier_id: s.supplier_id,
            supplier_model: s.supplier_model || undefined
          }))
        }).catch(() => {})
      }
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
          { key: 'category_id', label: '产品类别', type: 'input-suffix', required: true, placeholder: '请选择产品类别', span: 8, suffixIcon: 'ArrowDown', loadTreeData: async () => { try { const res = await getProductCategoryTree(); const data = res.data; sessionStorage.setItem('treeCache:productCategory', JSON.stringify(data)); return data } catch { const c = sessionStorage.getItem('treeCache:productCategory'); return c ? JSON.parse(c) : [] } } },
          { key: 'supplier_id', label: '供应商', type: 'input-suffix', required: true, placeholder: '请选择供应商', span: 8, suffixIcon: 'Search', dialogType: 'supplier', labelKey: 'supplier_name' },
          { key: 'specification', label: '规格型号', type: 'input', placeholder: '请输入规格型号', span: 8 },
          { key: 'origin_place', label: '产地', type: 'input', placeholder: '请输入产地', span: 8 },
          { key: 'color', label: '颜色', type: 'input', placeholder: '请输入颜色', span: 8 },
          { key: 'section-price-bind', label: '客户价格绑定', type: 'section', span: 24 },
          { key: 'sale_prices', label: '客户价格', type: 'dynamic-table', showIndex: true, addLabel: '新增价格', span: 24, columns: [
            { key: 'sale_price', label: '销售价格', type: 'input' },
            { key: 'gross_profit_rate', label: '毛利率(%)', type: 'input' },
            { key: 'customer_type_id', label: '客户类型', type: 'select', loadOptions: async () => {
              try {
                const res = await getCustomerTypeList({})
                const opts = res.data.customer_type.map((t: any) => ({ label: t.type_name, value: t.customer_type_id }))
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
          { key: 'images', label: '产品图片', type: 'image-upload', maxImages: 5, span: 24 },
          { key: 'attachments', label: '产品附件', type: 'file-upload', maxFiles: 5, span: 24 },
          { key: 'section-suppliers', label: '关联供应商', type: 'section', span: 24 },
          { key: 'product_suppliers', label: '关联供应商', type: 'input-suffix', placeholder: '请选择关联供应商（可多选）', span: 24, suffixIcon: 'Search', dialogType: 'supplier', multiple: true, labelKey: 'supplier_name' }
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
          { key: 'factory_price', label: '预设出厂价', type: 'number', required: true, defaultValue: 0, span: 8 },
          { key: 'gross_profit_ctrl_rate', label: '毛利控制比例', type: 'number', required: true, defaultValue: 0, placeholder: '如0.15表示15%', span: 8 },
          { key: 'is_combined', label: '是否组合产品', type: 'radio', required: true, defaultValue: 0, options: [
            { label: '是', value: 1 as any }, { label: '否', value: 0 as any }
          ], span: 24 },
          { key: 'section-inventory', label: '库存与生产', type: 'section', span: 24 },
          { key: 'fifo_flag', label: '是否先进先出', type: 'radio', required: true, defaultValue: 1, options: [
            { label: '是', value: 1 as any }, { label: '否', value: 0 as any }
          ], span: 24 },
          { key: 'package_qty', label: '包装数量', type: 'number', defaultValue: 0, span: 8 },
          { key: 'stock_warning_qty', label: '库存预警数量', type: 'number', defaultValue: 0, span: 8 },
          { key: 'production_cycle_days', label: '生产周期(天)', type: 'number', defaultValue: 0, span: 8 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
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
          { key: 'area_id', label: '行政区划', type: 'select', required: true, placeholder: '请选择行政区划', options: [], span: 8, loadOptions: async () => { try { const res = await getAreaList({}); const flat: { label: string; value: string }[] = []; const walk = (nodes: any[]) => { nodes.forEach(n => { flat.push({ label: n.area_name, value: n.area_id }); if (n.children?.length) walk(n.children); }); }; walk(res.data.area); return flat; } catch { return [] } } },
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
          { key: 'spot_name', label: '货位名称', type: 'input', required: true, placeholder: '请输入货位名称（同租户不得重名）', span: 12 },
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
          { key: 'parent_id', label: '上级ID', type: 'tree-select', required: true, placeholder: '请选择上级仓库或货位', span: 8, checkStrictly: true, filterable: true, treeProps: { label: 'name', children: 'children', value: 'id' }, loadTreeData: async () => { try { const res = await getWarehouseTree({ page: 1 }); const warehouses = (res.data.warehouse as any[]) || []; const normalize = (nodes: any[]): any[] => nodes.map(n => ({ id: n.warehouse_id || n.location_id || n.id, name: n.warehouse_name || n.location_name || n.name, children: n.children?.length ? normalize(n.children) : [] })); return normalize(warehouses); } catch { return [] } } },
          { key: 'location_no', label: '货位编号', type: 'input', required: true, placeholder: '请输入货位编号', span: 8 },
          { key: 'location_name', label: '货位名称', type: 'input', required: true, placeholder: '请输入货位名称', span: 8 },
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
      location_id: data.location_id,
      floor_no: Number(data.floor_no) || 1,
      position_no: Number(data.position_no) || 1,
      remark: data.remark || undefined,
    }),
    submitUpdate: (id, data) => updatePlasticBox(id, {
      box_name: data.box_name || undefined,
      box_code: data.box_code || undefined,
      location_id: data.location_id || undefined,
      floor_no: data.floor_no !== '' && data.floor_no !== undefined ? Number(data.floor_no) : undefined,
      position_no: data.position_no !== '' && data.position_no !== undefined ? Number(data.position_no) : undefined,
      remark: data.remark || undefined,
    }),
    tabs: [
      {
        label: '塑料盒信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'box_name', label: '塑料盒名称', type: 'input', required: true, placeholder: '请输入塑料盒名称', span: 8 },
          { key: 'box_code', label: '塑料盒编码', type: 'input', required: true, placeholder: '请输入塑料盒编码', span: 8 },
          { key: 'location_id', label: '绑定货位', type: 'tree-select', required: true, placeholder: '请选择货位', span: 8, checkStrictly: true, filterable: true, treeProps: { label: 'name', children: 'children', value: 'id' }, loadTreeData: async () => { try { const res = await getWarehouseTree({ page: 1 }); const warehouses = (res.data.warehouse as any[]) || []; const normalize = (nodes: any[]): any[] => nodes.map(n => ({ id: n.warehouse_id || n.location_id || n.id, name: n.warehouse_name || n.location_name || n.name, children: n.children?.length ? normalize(n.children) : [] })); return normalize(warehouses); } catch { return [] } } },
          { key: 'floor_no', label: '所在层数', type: 'number', required: true, defaultValue: 1, span: 8, rules: [{ type: 'number', min: 1, message: '层数必须大于等于1', trigger: 'blur' }] },
          { key: 'position_no', label: '所在位置', type: 'number', required: true, defaultValue: 1, span: 8, rules: [{ type: 'number', min: 1, message: '位置必须大于等于1', trigger: 'blur' }] },
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

  warehousePrinter: {
    title: '新增打印机',
    editTitle: '编辑打印机',
    type: 'warehousePrinter',
    module: 'warehouse/printer',
    successRoute: '/warehouse/printer',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getPrinterDetail(id)
      return res.data as unknown as Record<string, any>
    },
    submitCreate: (data) => createPrinter({
      printer_name: data.printer_name,
      ip_address: data.ip_address,
      port: Number(data.port),
      remark: data.remark || undefined,
    }),
    submitUpdate: (id, data) => updatePrinter(id, {
      printer_name: data.printer_name || undefined,
      ip_address: data.ip_address || undefined,
      port: data.port !== '' && data.port !== undefined ? Number(data.port) : undefined,
      remark: data.remark || undefined,
    }),
    tabs: [
      {
        label: '打印机信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'printer_name', label: '打印机名称', type: 'input', required: true, placeholder: '请输入打印机名称', span: 12 },
          { key: 'ip_address', label: 'IP地址', type: 'input', required: true, placeholder: '请输入IP地址', span: 12 },
          { key: 'port', label: '端口号', type: 'number', required: true, defaultValue: 9100, span: 12, rules: [{ type: 'number', min: 1, max: 65535, message: '端口范围 1-65535', trigger: 'blur' }] },
          { key: 'section-extra', label: '附加信息', type: 'section', span: 24 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  // ==================== 销售管理 ====================
  salesCustomerOrder: {
    title: '新增客户订货单',
    editTitle: '编辑客户订货单',
    type: 'salesCustomerOrder',
    module: 'sales/customer-order',
    successRoute: '/sales/customer-order',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getCustomerOrderDetail(id)
      return res.data
    },
    submitCreate: (data) => createCustomerOrder(data),
    submitUpdate: (id, data) => updateCustomerOrder(id, data),
    tabs: [
      {
        label: '订货信息',
        fields: [
          { key: 'section-base', label: '订货基本信息', type: 'section', span: 24 },
          { key: 'orderNo', label: '订货单号', type: 'input', required: true, placeholder: '请输入订货单号', span: 8 },
          { key: 'customerName', label: '客户名称', type: 'input', required: true, placeholder: '请输入客户名称', span: 8 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 },
          { key: 'section-product', label: '产品明细', type: 'section', span: 24 },
          { key: 'productCode', label: '产品编码', type: 'input', required: true, placeholder: '请输入产品编码', span: 8 },
          { key: 'productName', label: '产品名称', type: 'input', required: true, placeholder: '请输入产品名称', span: 8 },
          { key: 'productType', label: '产品类型', type: 'select', placeholder: '请选择产品类型', options: [
            { label: '成品', value: '成品' }, { label: '半成品', value: '半成品' }, { label: '原材料', value: '原材料' }, { label: '辅料', value: '辅料' }
          ], span: 8 },
          { key: 'spec', label: '产品规格', type: 'input', placeholder: '请输入产品规格', span: 8 },
          { key: 'color', label: '颜色', type: 'input', placeholder: '请输入颜色', span: 8 },
          { key: 'unit', label: '计量单位', type: 'select', placeholder: '请选择计量单位', options: [], span: 8, loadOptions: async () => { const c = sessionStorage.getItem('optionsCache:productUnit'); if (c) return JSON.parse(c); try { const res = await getProductUnitList(); const opts = res.data.unit.map(u => ({ label: u.unit_name, value: u.unit_name })); sessionStorage.setItem('optionsCache:productUnit', JSON.stringify(opts)); return opts } catch { return [] } } },
          { key: 'quantity', label: '订货数量', type: 'number', required: true, defaultValue: 1, span: 8 },
          { key: 'projectName', label: '项目名称', type: 'input', placeholder: '请输入项目名称', span: 8 },
          { key: 'detailRemark', label: '明细备注', type: 'textarea', placeholder: '请输入明细备注', rows: 2, span: 24 },
          { key: 'section-extra', label: '附加信息', type: 'section', span: 24 },
          { key: 'auditStatus', label: '审核状态', type: 'radio', defaultValue: '待审核', options: [
            { label: '待审核', value: '待审核' }, { label: '审核通过', value: '审核通过' }, { label: '审核驳回', value: '审核驳回' }
          ], span: 8 }
        ]
      }
    ]
  },

  salesOrder: {
    title: '新增销售订单',
    editTitle: '编辑销售订单',
    type: 'salesOrder',
    module: 'sales/order',
    successRoute: '/sales/order',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getSalesOrderDetail(id)
      return res.data
    },
    submitCreate: (data) => createSalesOrder(data as any),
    submitUpdate: (id, data) => updateSalesOrder(id, data as any),
    tabs: [
      {
        label: '基本信息',
        fields: [
          { key: 'section-base', label: '订单基本信息', type: 'section', span: 24 },
          { key: 'orderNo', label: '单据编号', type: 'input', required: true, placeholder: '请输入单据编号', span: 8 },
          { key: 'orderType', label: '单据类型', type: 'select', required: true, placeholder: '请选择单据类型', options: [
            { label: '正常销售', value: '正常销售' }, { label: '样品销售', value: '样品销售' }, { label: '赠送', value: '赠送' }
          ], span: 8 },
          { key: 'settleType', label: '结算方式', type: 'select', required: true, placeholder: '请选择结算方式', options: [
            { label: '月结', value: '月结' }, { label: '现结', value: '现结' }, { label: '预付', value: '预付' }
          ], span: 8 },
          { key: 'customerName', label: '客户名称', type: 'input', required: true, placeholder: '请输入客户名称', span: 8 },
          { key: 'city', label: '所在城市', type: 'input', placeholder: '请输入所在城市', span: 8 },
          { key: 'isMonthlySettle', label: '是否月结', type: 'radio', defaultValue: false, options: [
            { label: '是', value: true as any }, { label: '否', value: false as any }
          ], span: 8 },
          { key: 'creditAmount', label: '授信额度', type: 'number', defaultValue: 0, span: 8 },
          { key: 'currentBalance', label: '当前余额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'remainingCredit', label: '剩余授信额度', type: 'number', defaultValue: 0, span: 8 }
        ]
      },
      {
        label: '配送与收货',
        fields: [
          { key: 'section-delivery', label: '收货信息', type: 'section', span: 24 },
          { key: 'deliveryAddress', label: '收货地址', type: 'input', placeholder: '请输入收货地址', span: 8 },
          { key: 'actualDeliveryAddress', label: '实际送货地址', type: 'input', placeholder: '请输入实际送货地址', span: 8 },
          { key: 'receiver', label: '收货人', type: 'input', placeholder: '请输入收货人', span: 8 },
          { key: 'receiverPhone', label: '收货人电话', type: 'input', placeholder: '请输入收货人电话', span: 8 },
          { key: 'settleBank', label: '结算银行', type: 'input', placeholder: '请输入结算银行', span: 8 },
          { key: 'section-logistics', label: '配送信息', type: 'section', span: 24 },
          { key: 'deliveryMethod', label: '配送方式', type: 'select', placeholder: '请选择配送方式', options: [
            { label: '快递', value: '快递' }, { label: '物流', value: '物流' }, { label: '自提', value: '自提' }
          ], span: 8 },
          { key: 'carrierCompany', label: '承运公司', type: 'input', placeholder: '请输入承运公司', span: 8 },
          { key: 'freightMethod', label: '运费方式', type: 'select', placeholder: '请选择运费方式', options: [
            { label: '包邮', value: '包邮' }, { label: '到付', value: '到付' }, { label: '预付', value: '预付' }
          ], span: 8 },
          { key: 'expressNo', label: '快递单号', type: 'input', placeholder: '请输入快递单号', span: 8 },
          { key: 'expressAmount', label: '快递金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'outboundDate', label: '出库日期', type: 'date', placeholder: '请选择出库日期', span: 8 }
        ]
      },
      {
        label: '金额信息',
        fields: [
          { key: 'section-amount', label: '金额设置', type: 'section', span: 24 },
          { key: 'totalTaxAmount', label: '合计税额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'usePrepayAmount', label: '使用预付款金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'rebateUseRate', label: '返利金额使用比例', type: 'number', defaultValue: 0, span: 8 },
          { key: 'rebateBalance', label: '返利余额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'useRebateAmount', label: '使用返利金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'roundOffAmount', label: '抹零金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'receivableAmount', label: '应收金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'receivableAmountCN', label: '应收金额大写', type: 'input', placeholder: '自动生成', span: 8 },
          { key: 'salesAmount', label: '销售金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'customerRemark', label: '客户备注', type: 'textarea', placeholder: '请输入客户备注', rows: 3, span: 24 }
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
      const res = await getSalesReturnDetail(id)
      return res.data
    },
    submitCreate: (data) => createSalesReturn(data),
    submitUpdate: (id, data) => updateSalesReturn(id, data),
    tabs: [
      {
        label: '退货信息',
        fields: [
          { key: 'section-base', label: '退货基本信息', type: 'section', span: 24 },
          { key: 'returnNo', label: '退货单号', type: 'input', required: true, placeholder: '请输入退货单号', span: 8 },
          { key: 'orderNo', label: '关联销售单号', type: 'input', required: true, placeholder: '请输入关联销售单号', span: 8 },
          { key: 'customerName', label: '客户名称', type: 'input', required: true, placeholder: '请输入客户名称', span: 8 },
          { key: 'warehouseId', label: '退货仓库', type: 'tree-select', required: true, placeholder: '请选择退货仓库', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'returnDate', label: '退货日期', type: 'date', required: true, placeholder: '请选择退货日期', span: 8 },
          { key: 'returnReason', label: '退货原因', type: 'textarea', required: true, placeholder: '请输入退货原因', rows: 3, span: 24 },
          { key: 'totalAmount', label: '退货金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
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
      return Array.isArray(data.supplier) ? (data.supplier[0] || {}) : data.supplier
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
      status: Number(data.status),
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
          { key: 'area_id', label: '所在区域', type: 'select', placeholder: '请选择所在区域', clearable: true, filterable: true, options: [], span: 8, loadOptions: async () => { try { const res = await getAreaList({}); const flat: { label: string; value: string }[] = []; const walk = (nodes: any[]) => { nodes.forEach(n => { flat.push({ label: n.area_name, value: n.area_id }); if (n.children?.length) walk(n.children); }); }; walk(res.data.area); return flat; } catch { return [] } } },
          { key: 'detail_address', label: '详细地址', type: 'input', placeholder: '请输入详细地址', span: 16 },
          { key: 'phone1', label: '电话1', type: 'input', placeholder: '请输入电话', span: 8 },
          { key: 'phone2', label: '电话2', type: 'input', placeholder: '请输入电话', span: 8 },
          { key: 'fax_no', label: '传真号', type: 'input', placeholder: '请输入传真号', span: 8 },
          { key: 'email', label: '邮箱', type: 'input', placeholder: '请输入邮箱', span: 8 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: 1, options: [
            { label: '启用', value: 1 }, { label: '禁用', value: 0 }
          ], span: 8 },
          { key: 'section-contact', label: '联系人与财务', type: 'section', span: 24 },
          { key: 'principal_phone', label: '负责人电话', type: 'input', placeholder: '请输入负责人电话', span: 8 },
          { key: 'business_contact', label: '业务联系人', type: 'input', placeholder: '请输入业务联系人', span: 8 },
          { key: 'contact_phone', label: '联系人电话', type: 'input', placeholder: '请输入联系人电话', span: 8 },
          { key: 'bank_name', label: '开户行', type: 'input', placeholder: '请输入开户行', span: 8 },
          { key: 'bank_account', label: '银行账号', type: 'input', placeholder: '请输入银行账号', span: 8 },
          { key: 'payee_name', label: '收款人', type: 'input', placeholder: '请输入收款人', span: 8 },
          { key: 'purchaser_user_id', label: '采购员', type: 'input-suffix', placeholder: '请选择采购员', span: 8, suffixIcon: 'Search', dialogType: 'employee', labelKey: 'purchaser_user_name' },
          { key: 'remark', label: '备注信息', type: 'textarea', placeholder: '请输入备注信息', rows: 3, span: 24 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '供应商图片', type: 'image-upload', maxImages: 5, span: 24 },
          { key: 'attachments', label: '供应商附件', type: 'file-upload', maxFiles: 5, span: 24 }
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
      return res.data as unknown as Record<string, any>
    },
    submitCreate: (data, files) => createPurchaseOrder({
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
      rounding_amount: data.rounding_amount !== undefined ? String(data.rounding_amount) : '0',
      use_prepayment_amount: data.use_prepayment_amount !== undefined ? String(data.use_prepayment_amount) : undefined,
      use_gift_amount: data.use_gift_amount !== undefined ? String(data.use_gift_amount) : undefined,
      remark: data.remark || undefined,
    }, files as { images?: File[]; attachments?: File[] } | undefined),
    submitUpdate: async (id, data, files) => {
      // 1. 更新主单基本信息
      await updatePurchaseOrder({
        purchase_order_id: id,
        supplier_id: data.supplier_id || undefined,
        order_date: formatDate(data.order_date),
        delivery_days: data.delivery_days !== undefined ? Number(data.delivery_days) : undefined,
        freight_bear_type: data.freight_bear_type || undefined,
        payment_method: data.payment_method || undefined,
        rounding_amount: data.rounding_amount !== undefined ? String(data.rounding_amount) : undefined,
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
          { key: 'rounding_amount', label: '抹零金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'use_prepayment_amount', label: '使用预付款', type: 'number', defaultValue: 0, span: 8 },
          { key: 'use_gift_amount', label: '使用赠送金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 },
          { key: 'items', label: '采购明细', type: 'dynamic-table', addLabel: '新增产品明细', addViaDialog: true, columns: [
            { key: 'product_code', label: '产品编号', width: 140 },
            { key: 'product_name', label: '产品名称', width: 140 },
            { key: 'category_name', label: '产品类型', width: 120 },
            { key: 'product_id', label: '选择产品', width: 120, type: 'dialog-select', dialogType: 'product', labelKey: 'product_name' },
            { key: 'purchase_price', label: '采购单价', width: 120 },
            { key: 'qty', label: '采购数量', width: 100 },
            { key: 'delivery_status', label: '发货状态', width: 120, type: 'select', options: [
              { label: '未发货', value: 0 }, { label: '已发货', value: 1 }
            ] },
            { key: 'unit_id', label: '计量单位', width: 120, type: 'dialog-select', dialogType: 'unit', labelKey: 'unit_name' },
            { key: 'delivery_date', label: '发货日期', width: 140, type: 'date' },
            { key: 'last_purchase_price', label: '上次采购价', width: 120 },
            { key: 'logistics_no', label: '物流单号', width: 140 },
            { key: 'remark', label: '备注', width: 160 }
          ], span: 24 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '订单图片', type: 'image-upload', maxImages: 5, span: 24 },
          { key: 'attachments', label: '订单附件', type: 'file-upload', maxFiles: 5, span: 24 }
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
      // 详情接口返回 { purchase_receipt: {...} }，展开后供表单回填
      const detail = res.data.purchase_receipt
      return {
        ...detail,
        supplier_id: detail.supplier_id,
        supplier_id_label: detail.supplier_name,
        items: detail.items ?? []
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
      return updatePurchaseInbound(
        id,
        { supplier_id: data.supplier_id || undefined, remark: data.remark || undefined },
        { images: files?.images, attachments: files?.attachments }
      )
    },
    tabs: [
      {
        label: '入库信息',
        fields: [
          { key: 'section-base', label: '单据信息', type: 'section', span: 24 },
          { key: 'supplier_id', label: '供应商', type: 'input-suffix', required: true, placeholder: '请选择供应商', span: 8, suffixIcon: 'Search', dialogType: 'supplier', labelKey: 'supplier_name' },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 },
          { key: 'section-media', label: '媒体附件', type: 'section', span: 24 },
          { key: 'images', label: '入库图片', type: 'image-upload', maxImages: 5, span: 24 },
          { key: 'attachments', label: '入库附件', type: 'file-upload', maxFiles: 5, span: 24 },
          { key: 'section-items', label: '入库明细', type: 'section', span: 24 },
          { key: 'items', label: '入库明细', type: 'dynamic-table', addLabel: '新增入库明细', addViaDialog: true, addDialogType: 'pending-receipt', columns: [
            { key: 'product_code', label: '产品编号', width: 130 },
            { key: 'product_name', label: '产品名称', width: 150 },
            { key: 'unit_name', label: '计量单位', width: 90 },
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
      return res.data
    },
    submitCreate: (data) => createPurchaseReturn(data),
    submitUpdate: (id, data) => updatePurchaseReturn(id, data),
    tabs: [
      {
        label: '退货信息',
        fields: [
          { key: 'section-base', label: '单据信息', type: 'section', span: 24 },
          { key: 'returnNo', label: '单据编号', type: 'input', required: true, placeholder: '请输入单据编号', span: 8 },
          { key: 'supplierName', label: '供应商', type: 'input', required: true, placeholder: '请输入供应商', span: 8 },
          { key: 'actualSupplier', label: '实际供应商', type: 'input', placeholder: '请输入实际供应商', span: 8 },
          { key: 'returnMethod', label: '退货方式', type: 'select', placeholder: '请选择退货方式', options: [
            { label: '物流退回', value: '物流退回' }, { label: '自提退回', value: '自提退回' }
          ], span: 8 },
          { key: 'returnAddress', label: '退货地址', type: 'input', placeholder: '请输入退货地址', span: 8 },
          { key: 'totalAmount', label: '订单金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'sendWarehouseStatus', label: '发送仓库状态', type: 'radio', defaultValue: '未发送', options: [
            { label: '未发送', value: '未发送' }, { label: '已发送', value: '已发送' }
          ], span: 8 },
          { key: 'warehouseReturnStatus', label: '仓库退回状态', type: 'radio', defaultValue: '未退回', options: [
            { label: '未退回', value: '未退回' }, { label: '已退回', value: '已退回' }
          ], span: 8 },
          { key: 'images', label: '图片上传', type: 'input', placeholder: '请输入图片地址或附件标识', span: 12 },
          { key: 'attachments', label: '附件上传', type: 'input', placeholder: '请输入附件地址或附件标识', span: 12 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 },
          { key: 'details', label: '退货明细', type: 'dynamic-table', addLabel: '新增退货明细', columns: [
            { key: 'productCode', label: '产品编号', width: 120 }, { key: 'productName', label: '产品名称', width: 140 },
            { key: 'productType', label: '产品类型', width: 100 }, { key: 'spec', label: '产品规格', width: 100 },
            { key: 'color', label: '颜色', width: 80 }, { key: 'unit', label: '计量单位', width: 90 },
            { key: 'purchasePrice', label: '采购单价', width: 100 }, { key: 'returnPrice', label: '退货单价', width: 100 },
            { key: 'returnQuantity', label: '退货数量', width: 100 }, { key: 'returnAmount', label: '退货金额', width: 100 },
            { key: 'detailRemark', label: '明细备注', width: 140 }
          ], span: 24 }
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
  }
}

export function getSceneConfig(type: string): SceneConfig | undefined {
  return formConfigMap[type]
}

export function getRegisteredScenes(): string[] {
  return Object.keys(formConfigMap)
}
