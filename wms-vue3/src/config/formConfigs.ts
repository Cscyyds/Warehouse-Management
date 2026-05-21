import {
  getOrgTree,
  getPersonnelDetail, createPersonnel, updatePersonnel,
  getPositionDetail, createPosition, updatePosition,
  getOrgDetail, createOrg, updateOrg,
  getRoleDetail, createRole, updateRole,
  getAdminDetail, createAdmin, updateAdmin,
  getParamDetail, createParam, updateParam,
  getDictDetail, createDict, updateDict,
  getAreaDetail, createArea, updateArea,
  getDictDataDetail, createDictData, updateDictData,
  getCustomerTypeItemDetail, createCustomerType, updateCustomerType,
  getCustomerRegionDetail, createCustomerRegion, updateCustomerRegion,
  getCustomerDetail, createCustomer, updateCustomer,
  getVisitDetail, createVisit, updateVisit,
  getProductCategoryDetail, createProductCategory, updateProductCategory,
  getProductCategoryTree,
  getProductUnitDetail, createProductUnit, updateProductUnit,
  getProductDetail, createProduct, updateProduct,
  getWarehouseDetail, createWarehouse, updateWarehouse,
  getLocationDetail, createLocation, updateLocation,
  getShelfDetail, createShelf, updateShelf,
  getPlasticBoxDetail, createPlasticBox, updatePlasticBox,
  getBarcodeDetail, createBarcode, updateBarcode,
  getPrinterDetail, createPrinter, updatePrinter,
  getCustomerOrderDetail, createCustomerOrder, updateCustomerOrder,
  getSalesOrderDetail, createSalesOrder, updateSalesOrder,
  getSalesReturnDetail, createSalesReturn, updateSalesReturn,
  getAfterSaleDetail, createAfterSale, updateAfterSale,
  getReconciliationDetail, createReconciliation, updateReconciliation,
  getSupplierTypeDetail, createSupplierType, updateSupplierType,
  getSupplierDetail, createSupplier, updateSupplier,
  getPurchaseOrderDetail, createPurchaseOrder, updatePurchaseOrder,
  getPurchaseInboundDetail, createPurchaseInbound, updatePurchaseInbound,
  getPurchaseReturnDetail, createPurchaseReturn, updatePurchaseReturn
} from '@/api'

export type FieldType = 'input' | 'textarea' | 'select' | 'radio' | 'tree-select' | 'date' | 'number' | 'section' | 'input-suffix' | 'dynamic-table' | 'embedded-table' | 'checkbox-group'

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
  onSuffixClick?: string
  columns?: { key: string; label: string; width?: number; type?: string; options?: { label: string; value: string | number }[]; treeData?: unknown[]; treeProps?: Record<string, string> }[]
  tableData?: unknown[]
  addLabel?: string
  checkStrictly?: boolean
  clearable?: boolean
  filterable?: boolean
  visible?: (formData: Record<string, any>) => boolean
  loadTreeData?: () => Promise<unknown[]>
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
  submitCreate?: (data: Record<string, any>) => Promise<any>
  submitUpdate?: (id: string, data: Record<string, any>) => Promise<any>
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
      const res = await getPersonnelDetail(id)
      return res.data
    },
    submitCreate: (data) => createPersonnel(data),
    submitUpdate: (id, data) => updatePersonnel(id, data),
    tabs: [
      {
        label: '用户信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'name', label: '员工姓名', type: 'input', required: true, placeholder: '请输入员工姓名', span: 8 },
          { key: 'account', label: '登录账号', type: 'input', required: true, placeholder: '请输入登录账号', span: 8 },
          { key: 'nickname', label: '用户昵称', type: 'input', required: true, placeholder: '请输入用户昵称', span: 8 },
          { key: 'phone', label: '手机号码', type: 'input', placeholder: '请输入手机号码', span: 8, rules: [{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码', trigger: 'blur' }] },
          { key: 'email', label: '电子邮箱', type: 'input', placeholder: '请输入电子邮箱', span: 8, rules: [{ pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, message: '请输入正确的邮箱格式', trigger: 'blur' }] },
          { key: 'officePhone', label: '办公电话', type: 'input', placeholder: '请输入办公电话', span: 8 },
          { key: 'positionId', label: '所在岗位', type: 'tree-select', placeholder: '请选择岗位', span: 8 },
          { key: 'sort', label: '权重排序', type: 'number', defaultValue: 0, span: 8 },
          { key: 'section-org', label: '组织归属', type: 'section', span: 24 },
          { key: 'orgId', label: '归属机构', type: 'tree-select', required: true, placeholder: '请选择归属机构', span: 12, treeData: [{ id: 'root', name: '百诺全屋五金配套服务商', children: [{ id: '0', name: '总经办', children: [{ id: '1', name: '销售部' }, { id: '2', name: '仓储物流部' }, { id: '3', name: '客服部' }, { id: '4', name: '产品部', children: [{ id: '4-1', name: '采购部' }, { id: '4-2', name: '售后部' }] }, { id: '5', name: '行政部' }, { id: '6', name: '财务部' }] }] }], loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'companyId', label: '归属公司', type: 'tree-select', placeholder: '请选择归属公司', span: 12, treeData: [{ id: 'root', name: '百诺全屋五金配套服务商', children: [{ id: '0', name: '总经办', children: [{ id: '1', name: '销售部' }, { id: '2', name: '仓储物流部' }, { id: '3', name: '客服部' }, { id: '4', name: '产品部', children: [{ id: '4-1', name: '采购部' }, { id: '4-2', name: '售后部' }] }, { id: '5', name: '行政部' }, { id: '6', name: '财务部' }] }] }], loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'section-more', label: '附属信息', type: 'section', span: 24 },
          { key: 'subOrgs', label: '附属机构', type: 'dynamic-table', addLabel: '新增附属机构', columns: [{ key: 'orgId', label: '机构', type: 'tree-select' }, { key: 'position', label: '岗位', type: 'input' }], span: 24 },
          { key: 'remark', label: '备注信息', type: 'textarea', placeholder: '请输入备注信息', rows: 3, span: 24 },
          { key: 'section-roles', label: '分配角色', type: 'section', span: 24 },
          { key: 'roles', label: '角色分配', type: 'embedded-table', columns: [
            { key: 'roleName', label: '角色名称' },
            { key: 'roleId', label: '角色编号' },
            { key: 'checked', label: '是否分配', type: 'checkbox' }
          ], tableData: [
            { roleId: 'admin', roleName: '系统管理员', checked: false },
            { roleId: 'manager', roleName: '仓库管理员', checked: false },
            { roleId: 'operator', roleName: '仓储操作员', checked: false },
            { roleId: 'viewer', roleName: '只读用户', checked: false }
          ], span: 24 }
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
      const res = await getPositionDetail(id)
      return res.data
    },
    submitCreate: (data) => createPosition(data),
    submitUpdate: (id, data) => updatePosition(id, data),
    tabs: [
      {
        label: '岗位信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'name', label: '岗位名称', type: 'input', required: true, placeholder: '请输入岗位名称', span: 8 },
          { key: 'code', label: '岗位编码', type: 'input', required: true, placeholder: '请输入岗位编码', span: 8 },
          { key: 'category', label: '岗位分类', type: 'select', required: true, placeholder: '请选择岗位分类', options: [
            { label: '管理类', value: '管理类' },
            { label: '技术类', value: '技术类' },
            { label: '业务类', value: '业务类' },
            { label: '后勤类', value: '后勤类' }
          ], span: 8 },
          { key: 'sort', label: '排序号', type: 'number', defaultValue: 0, span: 8 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 8 },
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
      return res.data
    },
    submitCreate: (data) => createOrg(data),
    submitUpdate: (id, data) => updateOrg(id, data),
    tabs: [
      {
        label: '机构信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'parentId', label: '上级机构', type: 'tree-select', placeholder: '请选择上级机构', span: 12, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'code', label: '机构代码', type: 'input', required: true, placeholder: '请输入机构代码', span: 12 },
          { key: 'name', label: '机构名称', type: 'input', required: true, placeholder: '请输入机构名称', span: 12 },
          { key: 'fullName', label: '机构全称', type: 'input', placeholder: '请输入机构全称', span: 12 },
          { key: 'type', label: '机构类型', type: 'select', required: true, placeholder: '请选择机构类型', options: [
            { label: '公司', value: '公司' }, { label: '部门', value: '部门' }, { label: '小组', value: '小组' }
          ], span: 12 },
          { key: 'sort', label: '排序号', type: 'number', defaultValue: 0, span: 12 },
          { key: 'leader', label: '负责人', type: 'input', placeholder: '请输入负责人', span: 12 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '启用', options: [
            { label: '启用', value: '启用' }, { label: '停用', value: '停用' }
          ], span: 12 },
          { key: 'section-detail', label: '详细信息', type: 'section', span: 24 },
          { key: 'address', label: '联系地址', type: 'input', placeholder: '请输入联系地址', span: 12 },
          { key: 'email', label: '电子邮箱', type: 'input', placeholder: '请输入电子邮箱', span: 12 },
          { key: 'zipCode', label: '邮政编码', type: 'input', placeholder: '请输入邮政编码', span: 12 },
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
      return res.data
    },
    submitCreate: (data) => createRole(data),
    submitUpdate: (id, data) => updateRole(id, data),
    tabs: [
      {
        label: '角色信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'name', label: '角色名称', type: 'input', required: true, placeholder: '请输入角色名称', span: 8 },
          { key: 'code', label: '角色编码', type: 'input', required: true, placeholder: '请输入角色编码', span: 8 },
          { key: 'roleType', label: '角色类型', type: 'select', required: true, placeholder: '请选择角色类型', options: [
            { label: '系统管理员', value: '系统管理员' },
            { label: '仓储管理', value: '仓储管理' },
            { label: '销售管理', value: '销售管理' },
            { label: '采购管理', value: '采购管理' },
            { label: '财务管理', value: '财务管理' },
            { label: '访客', value: '访客' }
          ], span: 8 },
          { key: 'sort', label: '排序号', type: 'number', defaultValue: 0, span: 8 },
          { key: 'isSystem', label: '系统角色', type: 'radio', defaultValue: false, options: [
            { label: '是', value: true as any }, { label: '否', value: false as any }
          ], span: 8 },
          { key: 'userType', label: '用户类型', type: 'select', placeholder: '请选择用户类型', options: [
            { label: '管理员', value: '管理员' },
            { label: '员工', value: '员工' },
            { label: '访客', value: '访客' }
          ], span: 8 },
          { key: 'dataScope', label: '数据范围', type: 'select', placeholder: '请选择数据范围', options: [
            { label: '全部', value: '全部' },
            { label: '本部门', value: '本部门' },
            { label: '本部门及下级', value: '本部门及下级' },
            { label: '仅本人', value: '仅本人' }
          ], span: 8 },
          { key: 'businessScope', label: '业务范围', type: 'select', placeholder: '请选择业务范围', options: [
            { label: '全部', value: '全部' },
            { label: '仓储', value: '仓储' },
            { label: '销售', value: '销售' },
            { label: '采购', value: '采购' },
            { label: '财务', value: '财务' },
            { label: '无', value: '无' }
          ], span: 8 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 8 },
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
    title: '新增区域',
    editTitle: '编辑区域',
    type: 'area',
    module: 'system/area',
    successRoute: '/system/area',
    labelWidth: '100px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getAreaDetail(id)
      return res.data
    },
    submitCreate: (data) => createArea(data),
    submitUpdate: (id, data) => updateArea(id, data),
    tabs: [
      {
        label: '区域信息',
        fields: [
          { key: 'name', label: '区域名称', type: 'input', required: true, placeholder: '请输入区域名称', span: 12 },
          { key: 'type', label: '区域类型', type: 'select', required: true, placeholder: '请选择区域类型', options: [
            { label: '省', value: '省' }, { label: '市', value: '市' }, { label: '区/县', value: '区/县' }
          ], span: 12 },
          { key: 'sort', label: '排序号', type: 'number', defaultValue: 0, span: 12 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 12 },
          { key: 'remark', label: '备注信息', type: 'textarea', placeholder: '请输入备注信息', rows: 3, span: 24 }
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
      const res = await getCustomerTypeItemDetail(id)
      return res.data
    },
    submitCreate: (data) => createCustomerType(data),
    submitUpdate: (id, data) => updateCustomerType(id, data),
    tabs: [
      {
        label: '客户类型信息',
        fields: [
          { key: 'name', label: '客户类型名称', type: 'input', required: true, placeholder: '请输入客户类型名称', span: 12 },
          { key: 'orgId', label: '所属组织', type: 'tree-select', required: true, placeholder: '请选择所属组织', span: 12, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 12 }
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
      return res.data
    },
    submitCreate: (data) => createCustomerRegion(data),
    submitUpdate: (id, data) => updateCustomerRegion(id, data),
    tabs: [
      {
        label: '区域信息',
        fields: [
          { key: 'name', label: '区域名称', type: 'input', required: true, placeholder: '请输入区域名称', span: 12 },
          { key: 'orgId', label: '所属组织', type: 'tree-select', required: true, placeholder: '请选择所属组织', span: 12, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 12 }
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
      return res.data
    },
    submitCreate: (data) => createCustomer(data),
    submitUpdate: (id, data) => updateCustomer(id, data),
    tabs: [
      {
        label: '基本信息',
        fields: [
          { key: 'section-base', label: '客户基本信息', type: 'section', span: 24 },
          { key: 'name', label: '客户名称', type: 'input', required: true, placeholder: '请输入客户名称', span: 8 },
          { key: 'city', label: '所在城市', type: 'input', placeholder: '请输入所在城市', span: 8 },
          { key: 'address', label: '详细地址', type: 'input', placeholder: '请输入详细地址', span: 8 },
          { key: 'contactPerson', label: '公司负责人', type: 'input', placeholder: '请输入负责人名称', span: 8 },
          { key: 'contactPhone', label: '负责人电话', type: 'input', placeholder: '请输入负责人电话', span: 8 },
          { key: 'type', label: '客户类型', type: 'select', placeholder: '请选择客户类型', options: [], span: 8 },
          { key: 'companyId', label: '绑定公司', type: 'tree-select', placeholder: '请选择绑定公司', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'areaId', label: '所属区域', type: 'select', placeholder: '请选择所属区域', options: [], span: 8 },
          { key: 'level', label: '客户规模', type: 'select', placeholder: '请选择客户规模', options: [
            { label: '大型', value: '大型' }, { label: '中型', value: '中型' }, { label: '小型', value: '小型' }
          ], span: 8 },
          { key: 'industry', label: '客户详细描述', type: 'textarea', placeholder: '请输入客户详细描述', rows: 3, span: 24 }
        ]
      },
      {
        label: '业务信息',
        fields: [
          { key: 'section-biz', label: '业务配置', type: 'section', span: 24 },
          { key: 'source', label: '承运公司', type: 'input', placeholder: '请输入承运公司', span: 8 },
          { key: 'salesUserName', label: '跟单员', type: 'input', placeholder: '请输入跟单员', span: 8 },
          { key: 'salesUserId', label: '销售员', type: 'input', placeholder: '请输入销售员', span: 8 },
          { key: 'settleType', label: '是否月结', type: 'radio', defaultValue: '否', options: [
            { label: '是', value: '是' }, { label: '否', value: '否' }
          ], span: 8 },
          { key: 'creditAmount', label: '授信额度', type: 'number', defaultValue: 0, span: 8 },
          { key: 'creditDays', label: '月结时长(天)', type: 'number', defaultValue: 0, span: 8 },
          { key: 'category', label: '结算日', type: 'input', placeholder: '请输入结算日', span: 8 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 8 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
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
      const res = await getCustomerDetail(id)
      return res.data
    },
    submitCreate: (data) => createCustomer({ ...data, isNewDevelop: true }),
    submitUpdate: (id, data) => updateCustomer(id, data),
    tabs: [
      {
        label: '客户信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'name', label: '客户名称', type: 'input', required: true, placeholder: '请输入客户名称', span: 8 },
          { key: 'city', label: '所在城市', type: 'input', placeholder: '请输入所在城市', span: 8 },
          { key: 'address', label: '详细地址', type: 'input', placeholder: '请输入详细地址', span: 8 },
          { key: 'contactPerson', label: '负责人名称', type: 'input', placeholder: '请输入负责人名称', span: 8 },
          { key: 'contactPhone', label: '负责人电话', type: 'input', placeholder: '请输入负责人电话', span: 8 },
          { key: 'type', label: '客户类型', type: 'select', placeholder: '请选择客户类型', options: [], span: 8 },
          { key: 'areaId', label: '所属区域', type: 'select', placeholder: '请选择所属区域', options: [], span: 8 },
          { key: 'level', label: '客户规模', type: 'select', placeholder: '请选择客户规模', options: [
            { label: '大型', value: '大型' }, { label: '中型', value: '中型' }, { label: '小型', value: '小型' }
          ], span: 8 },
          { key: 'companyId', label: '绑定公司', type: 'tree-select', placeholder: '请选择绑定公司', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 8 },
          { key: 'industry', label: '客户详细描述', type: 'textarea', placeholder: '请输入客户详细描述', rows: 3, span: 24 },
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
      const res = await getVisitDetail(id)
      return res.data
    },
    submitCreate: (data) => createVisit(data),
    submitUpdate: (id, data) => updateVisit(id, data),
    tabs: [
      {
        label: '任务信息',
        fields: [
          { key: 'section-base', label: '拜访信息', type: 'section', span: 24 },
          { key: 'customerName', label: '客户', type: 'input', required: true, placeholder: '请输入客户名称', span: 8 },
          { key: 'contactPerson', label: '联系人', type: 'input', placeholder: '请输入联系人', span: 8 },
          { key: 'contactPhone', label: '电话', type: 'input', placeholder: '请输入联系电话', span: 8 },
          { key: 'customerAddress', label: '拜访地址', type: 'input', placeholder: '请输入拜访地址', span: 8 },
          { key: 'visitType', label: '任务类型', type: 'select', placeholder: '请选择任务类型', options: [
            { label: '上门拜访', value: '上门拜访' },
            { label: '电话回访', value: '电话回访' },
            { label: '视频会议', value: '视频会议' },
            { label: '其他', value: '其他' }
          ], span: 8 },
          { key: 'salesUserName', label: '销售员', type: 'input', placeholder: '请输入销售员', span: 8 },
          { key: 'visitDate', label: '拜访时间', type: 'date', placeholder: '请选择拜访时间', span: 8 },
          { key: 'visitEndTime', label: '完成时间', type: 'date', placeholder: '请选择完成时间', span: 8 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 8 },
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
      return res.data
    },
    submitCreate: (data) => createProductCategory(data),
    submitUpdate: (id, data) => updateProductCategory(id, data),
    tabs: [
      {
        label: '类别信息',
        fields: [
          { key: 'code', label: '产品编码', type: 'input', required: true, placeholder: '请输入产品编码', span: 8 },
          { key: 'name', label: '类别名称', type: 'input', required: true, placeholder: '请输入类别名称', span: 8 },
          { key: 'parentId', label: '上级类别', type: 'tree-select', placeholder: '请选择上级类别（无则留空）', span: 8, loadTreeData: async () => { const res = await getProductCategoryTree(); return res.data } },
          { key: 'companyId', label: '绑定公司', type: 'tree-select', placeholder: '请选择绑定公司', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'sort', label: '排序号', type: 'number', defaultValue: 0, span: 8 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
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
      return res.data
    },
    submitCreate: (data) => createProductUnit(data),
    submitUpdate: (id, data) => updateProductUnit(id, data),
    tabs: [
      {
        label: '单位信息',
        fields: [
          { key: 'name', label: '单位名称', type: 'input', required: true, placeholder: '请输入单位名称', span: 8 },
          { key: 'companyId', label: '绑定公司', type: 'tree-select', placeholder: '请选择绑定公司', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
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
      return res.data
    },
    submitCreate: (data) => createProduct(data),
    submitUpdate: (id, data) => updateProduct(id, data),
    tabs: [
      {
        label: '基本信息',
        fields: [
          { key: 'section-base', label: '产品基本信息', type: 'section', span: 24 },
          { key: 'code', label: '产品编码', type: 'input', required: true, placeholder: '请输入产品编码', span: 8 },
          { key: 'itemNo', label: '品号', type: 'input', placeholder: '请输入品号', span: 8 },
          { key: 'name', label: '产品名称', type: 'input', required: true, placeholder: '请输入产品名称', span: 8 },
          { key: 'productType', label: '产品类型', type: 'select', placeholder: '请选择产品类型', options: [
            { label: '成品', value: '成品' }, { label: '半成品', value: '半成品' },
            { label: '原材料', value: '原材料' }, { label: '辅料', value: '辅料' }
          ], span: 8 },
          { key: 'categoryId', label: '产品类别', type: 'tree-select', placeholder: '请选择产品类别', span: 8, loadTreeData: async () => { const res = await getProductCategoryTree(); return res.data } },
          { key: 'companyId', label: '绑定公司', type: 'tree-select', placeholder: '请选择绑定公司', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'supplierId', label: '供应商', type: 'input', placeholder: '请输入供应商', span: 8 },
          { key: 'supplierNameModel', label: '供应商名称及型号', type: 'input', placeholder: '请输入供应商名称及型号', span: 8 },
          { key: 'spec', label: '产品规格', type: 'input', placeholder: '请输入产品规格', span: 8 },
          { key: 'origin', label: '原产地', type: 'input', placeholder: '请输入原产地', span: 8 },
          { key: 'color', label: '颜色', type: 'input', placeholder: '请输入颜色', span: 8 },
          { key: 'status', label: '产品状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 8 }
        ]
      },
      {
        label: '单位与库存',
        fields: [
          { key: 'section-unit', label: '计量单位', type: 'section', span: 24 },
          { key: 'unitId', label: '计量单位', type: 'select', required: true, placeholder: '请选择计量单位', options: [], span: 8 },
          { key: 'weight', label: '单位重量(kg)', type: 'number', defaultValue: 0, span: 8 },
          { key: 'isWeighed', label: '是否称重', type: 'radio', defaultValue: false, options: [
            { label: '是', value: true as any }, { label: '否', value: false as any }
          ], span: 8 },
          { key: 'weightError', label: '称重误差(g)', type: 'number', defaultValue: 0, span: 8 },
          { key: 'auxUnitId', label: '辅助单位', type: 'select', placeholder: '请选择辅助单位', options: [], span: 8 },
          { key: 'conversionRatio', label: '换算比例', type: 'number', defaultValue: 1, span: 8 },
          { key: 'packageQty', label: '包装数量', type: 'number', defaultValue: 1, span: 8 },
          { key: 'stockWarning', label: '库存预警', type: 'number', defaultValue: 0, span: 8 },
          { key: 'isFifo', label: '是否先进先出', type: 'radio', defaultValue: true, options: [
            { label: '是', value: true as any }, { label: '否', value: false as any }
          ], span: 8 }
        ]
      },
      {
        label: '价格与成本',
        fields: [
          { key: 'section-price', label: '价格设置', type: 'section', span: 24 },
          { key: 'factoryPrice', label: '预设出厂价', type: 'number', defaultValue: 0, span: 8 },
          { key: 'avgCostPrice', label: '平均成本单价', type: 'number', defaultValue: 0, span: 8 },
          { key: 'minSalePrice', label: '最低销售单价', type: 'number', defaultValue: 0, span: 8 },
          { key: 'grossProfitControl', label: '毛利控制(%)', type: 'number', defaultValue: 0, span: 8 },
          { key: 'productionCycle', label: '生产周期(天)', type: 'number', defaultValue: 0, span: 8 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 }
        ]
      }
    ]
  },

  // ==================== 仓库管理 ====================
  warehouseLocation: {
    title: '新增库位',
    editTitle: '编辑库位',
    type: 'warehouseLocation',
    module: 'warehouse/location',
    successRoute: '/warehouse/location',
    labelWidth: '110px',
    labelPosition: 'top',
    loadDetail: async (id: string) => {
      const res = await getWarehouseDetail(id)
      return res.data
    },
    submitCreate: (data) => createWarehouse(data),
    submitUpdate: (id, data) => updateWarehouse(id, data),
    tabs: [
      {
        label: '库位信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'code', label: '完整编号', type: 'input', required: true, placeholder: '请输入完整编号', span: 8 },
          { key: 'areaName', label: '区域', type: 'select', placeholder: '请选择区域', options: [
            { label: '华南', value: '华南' }, { label: '华东', value: '华东' }, { label: '华北', value: '华北' }, { label: '西南', value: '西南' }
          ], span: 8 },
          { key: 'provinceCityArea', label: '省市区', type: 'input', placeholder: '请输入省市区', span: 8 },
          { key: 'name', label: '仓库名称', type: 'input', required: true, placeholder: '请输入仓库名称', span: 8 },
          { key: 'companyId', label: '绑定公司', type: 'tree-select', placeholder: '请选择绑定公司', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'type', label: '仓库类型', type: 'select', required: true, placeholder: '请选择仓库类型', options: [
            { label: '主仓', value: '主仓' }, { label: '副仓', value: '副仓' }, { label: '临时仓', value: '临时仓' }
          ], span: 8 },
          { key: 'address', label: '仓库地址', type: 'input', placeholder: '请输入仓库地址', span: 8 },
          { key: 'contactPerson', label: '联系人名称', type: 'input', placeholder: '请输入联系人名称', span: 8 },
          { key: 'contactPhone', label: '联系人电话', type: 'input', placeholder: '请输入联系人电话', span: 8 },
          { key: 'warehouseStatus', label: '仓库状态', type: 'select', placeholder: '请选择仓库状态', options: [
            { label: '正常', value: '正常' }, { label: '冻结', value: '冻结' }, { label: '维修', value: '维修' }
          ], span: 8 },
          { key: 'sort', label: '排序号', type: 'number', defaultValue: 0, span: 8 },
          { key: 'section-extra', label: '附加信息', type: 'section', span: 24 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 8 }
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
      const res = await getShelfDetail(id)
      return res.data
    },
    submitCreate: (data) => createShelf(data),
    submitUpdate: (id, data) => updateShelf(id, data),
    tabs: [
      {
        label: '货位信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'code', label: '完整编号', type: 'input', required: true, placeholder: '请输入完整编号', span: 8 },
          { key: 'warehouseId', label: '上级仓库', type: 'tree-select', required: true, placeholder: '请选择上级仓库', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'name', label: '货位名称', type: 'input', required: true, placeholder: '请输入货位名称', span: 8 },
          { key: 'shortCode', label: '简码', type: 'input', placeholder: '请输入简码', span: 8 },
          { key: 'companyId', label: '绑定公司', type: 'tree-select', placeholder: '请选择绑定公司', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'description', label: '货位描述', type: 'textarea', placeholder: '请输入货位描述', rows: 3, span: 24 },
          { key: 'type', label: '货位类型', type: 'select', required: true, placeholder: '请选择货位类型', options: [
            { label: '货架', value: '货架' }, { label: '地堆', value: '地堆' }, { label: '托盘', value: '托盘' }
          ], span: 8 },
          { key: 'locationStatus', label: '库位状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 8 },
          { key: 'sort', label: '排序号', type: 'number', defaultValue: 0, span: 8 },
          { key: 'section-extra', label: '附加信息', type: 'section', span: 24 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 8 }
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
      return res.data
    },
    submitCreate: (data) => createPlasticBox(data),
    submitUpdate: (id, data) => updatePlasticBox(id, data),
    tabs: [
      {
        label: '塑料盒信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'code', label: '塑料盒编号', type: 'input', required: true, placeholder: '请输入塑料盒编号', span: 8 },
          { key: 'locationId', label: '关联库位', type: 'tree-select', required: true, placeholder: '请选择关联库位', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'shelfId', label: '关联货位', type: 'tree-select', required: true, placeholder: '请选择关联货位', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'companyId', label: '绑定公司', type: 'tree-select', placeholder: '请选择绑定公司', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'type', label: '类型', type: 'select', placeholder: '请选择类型', options: [
            { label: '标准', value: '标准' }, { label: '大型', value: '大型' }, { label: '小型', value: '小型' }
          ], span: 8 },
          { key: 'spec', label: '规格', type: 'input', placeholder: '请输入规格', span: 8 },
          { key: 'rfid', label: 'RFID', type: 'input', placeholder: '请输入RFID编码', span: 8 },
          { key: 'addQuantity', label: '新增数量', type: 'number', defaultValue: 1, span: 8 },
          { key: 'section-extra', label: '附加信息', type: 'section', span: 24 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 8 }
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
          { key: 'unit', label: '计量单位', type: 'select', placeholder: '请选择计量单位', options: [
            { label: '个', value: '个' }, { label: '套', value: '套' }, { label: '件', value: '件' }, { label: '箱', value: '箱' }, { label: 'kg', value: 'kg' }
          ], span: 8 },
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
          { key: 'unit', label: '计量单位', type: 'select', placeholder: '请选择计量单位', options: [
            { label: '个', value: '个' }, { label: '套', value: '套' }, { label: '件', value: '件' }, { label: '箱', value: '箱' }, { label: 'kg', value: 'kg' }
          ], span: 8 },
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
      return res.data
    },
    submitCreate: (data) => createPrinter(data),
    submitUpdate: (id, data) => updatePrinter(id, data),
    tabs: [
      {
        label: '打印机信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'name', label: '打印机名称', type: 'input', required: true, placeholder: '请输入打印机名称', span: 8 },
          { key: 'code', label: '打印机编码', type: 'input', required: true, placeholder: '请输入打印机编码', span: 8 },
          { key: 'type', label: '打印机类型', type: 'select', required: true, placeholder: '请选择打印机类型', options: [
            { label: '条码', value: '条码' }, { label: '标签', value: '标签' }, { label: '物流', value: '物流' }
          ], span: 8 },
          { key: 'ipAddress', label: 'IP地址', type: 'input', required: true, placeholder: '请输入IP地址', span: 8 },
          { key: 'port', label: '端口号', type: 'number', required: true, defaultValue: 9100, span: 8 },
          { key: 'companyId', label: '绑定公司', type: 'tree-select', placeholder: '请选择绑定公司', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'section-extra', label: '附加信息', type: 'section', span: 24 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 8 }
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
          { key: 'unit', label: '计量单位', type: 'select', placeholder: '请选择计量单位', options: [
            { label: '个', value: '个' }, { label: '套', value: '套' }, { label: '件', value: '件' }, { label: '箱', value: '箱' }
          ], span: 8 },
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
          { key: 'unit', label: '计量单位', type: 'select', placeholder: '请选择计量单位', options: [
            { label: '个', value: '个' }, { label: '套', value: '套' }, { label: '件', value: '件' }
          ], span: 8 },
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
      return res.data
    },
    submitCreate: (data) => createSupplierType(data),
    submitUpdate: (id, data) => updateSupplierType(id, data),
    tabs: [
      {
        label: '供应商类型',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'id', label: '供应商ID', type: 'input', placeholder: '可由系统生成', span: 8 },
          { key: 'name', label: '供应商名称', type: 'input', required: true, placeholder: '请输入供应商名称', span: 8 },
          { key: 'companyId', label: '绑定公司ID', type: 'tree-select', placeholder: '请选择绑定公司', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'companyName', label: '绑定公司名称', type: 'input', placeholder: '请输入绑定公司名称', span: 8 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 8 },
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
      return res.data
    },
    submitCreate: (data) => createSupplier(data),
    submitUpdate: (id, data) => updateSupplier(id, data),
    tabs: [
      {
        label: '基础资料',
        fields: [
          { key: 'section-base', label: '基础信息', type: 'section', span: 24 },
          { key: 'code', label: '编码', type: 'input', required: true, placeholder: '请输入供应商编码', span: 8 },
          { key: 'name', label: '名称', type: 'input', required: true, placeholder: '请输入供应商名称', span: 8 },
          { key: 'category', label: '经营类别', type: 'input', placeholder: '请输入经营类别', span: 8 },
          { key: 'shortName', label: '简称', type: 'input', placeholder: '请输入简称', span: 8 },
          { key: 'region', label: '区域', type: 'input', placeholder: '请输入区域', span: 8 },
          { key: 'address', label: '详细地址', type: 'input', placeholder: '请输入详细地址', span: 8 },
          { key: 'companyPhone1', label: '公司电话(1)', type: 'input', placeholder: '请输入公司电话', span: 8 },
          { key: 'companyPhone2', label: '公司电话(2)', type: 'input', placeholder: '请输入公司电话', span: 8 },
          { key: 'companyId', label: '绑定公司ID', type: 'tree-select', placeholder: '请选择绑定公司', span: 8, loadTreeData: async () => { const res = await getOrgTree(); return res.data.tree } },
          { key: 'companyName', label: '绑定公司名称', type: 'input', placeholder: '请输入绑定公司名称', span: 8 },
          { key: 'fax', label: '传真号', type: 'input', placeholder: '请输入传真号', span: 8 },
          { key: 'email', label: 'E-mail', type: 'input', placeholder: '请输入E-mail', span: 8 },
          { key: 'section-contact', label: '联系人与财务', type: 'section', span: 24 },
          { key: 'principalPhone', label: '负责人电话', type: 'input', placeholder: '请输入负责人电话', span: 8 },
          { key: 'businessContact', label: '业务联系人', type: 'input', placeholder: '请输入业务联系人', span: 8 },
          { key: 'contactPhone', label: '联系人电话', type: 'input', placeholder: '请输入联系人电话', span: 8 },
          { key: 'bankName', label: '开户行', type: 'input', placeholder: '请输入开户行', span: 8 },
          { key: 'bankAccount', label: '银行账号', type: 'input', placeholder: '请输入银行账号', span: 8 },
          { key: 'payee', label: '收款人', type: 'input', placeholder: '请输入收款人', span: 8 },
          { key: 'buyer', label: '采购员', type: 'input', placeholder: '请输入采购员', span: 8 },
          { key: 'status', label: '状态', type: 'radio', defaultValue: '正常', options: [
            { label: '正常', value: '正常' }, { label: '停用', value: '停用' }
          ], span: 8 },
          { key: 'remark', label: '备注信息', type: 'textarea', placeholder: '请输入备注信息', rows: 3, span: 24 },
          { key: 'images', label: '图片上传', type: 'input', placeholder: '请输入图片地址或附件标识', span: 12 },
          { key: 'attachments', label: '附件上传', type: 'input', placeholder: '请输入附件地址或附件标识', span: 12 }
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
      return res.data
    },
    submitCreate: (data) => createPurchaseOrder({ ...data, details: data.details || [] }),
    submitUpdate: (id, data) => updatePurchaseOrder(id, { ...data, details: data.details || [] }),
    tabs: [
      {
        label: '订单信息',
        fields: [
          { key: 'section-base', label: '单据信息', type: 'section', span: 24 },
          { key: 'orderNo', label: '订单编号', type: 'input', required: true, placeholder: '请输入订单编号', span: 8 },
          { key: 'supplierName', label: '供应商', type: 'input', required: true, placeholder: '请输入供应商', span: 8 },
          { key: 'orderDate', label: '订货日期', type: 'date', required: true, placeholder: '请选择订货日期', span: 8 },
          { key: 'deliveryDays', label: '送货天数', type: 'number', defaultValue: 0, span: 8 },
          { key: 'freightBearer', label: '运费承担', type: 'select', placeholder: '请选择运费承担', options: [
            { label: '采购方', value: '采购方' }, { label: '供应商', value: '供应商' }
          ], span: 8 },
          { key: 'paymentMethod', label: '付款方式', type: 'select', placeholder: '请选择付款方式', options: [
            { label: '现结', value: '现结' }, { label: '月结', value: '月结' }, { label: '预付', value: '预付' }
          ], span: 8 },
          { key: 'actualSupplier', label: '实际供应商', type: 'input', placeholder: '请输入实际供应商', span: 8 },
          { key: 'discountAmount', label: '抹零金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'totalAmount', label: '订单金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'actualAmount', label: '应付金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'auditStatus', label: '审核状态', type: 'radio', defaultValue: '未审核', options: [
            { label: '未审核', value: '未审核' }, { label: '已审核', value: '已审核' }
          ], span: 8 },
          { key: 'images', label: '图片上传', type: 'input', placeholder: '请输入图片地址或附件标识', span: 12 },
          { key: 'attachments', label: '附件上传', type: 'input', placeholder: '请输入附件地址或附件标识', span: 12 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 },
          { key: 'details', label: '采购明细', type: 'dynamic-table', addLabel: '新增产品明细', columns: [
            { key: 'productCode', label: '产品编号', width: 120 },
            { key: 'productName', label: '产品名称', width: 140 },
            { key: 'productType', label: '产品类型', width: 100 },
            { key: 'spec', label: '规格', width: 100 },
            { key: 'color', label: '颜色', width: 80 },
            { key: 'unit', label: '计量单位', width: 90 },
            { key: 'unitPrice', label: '采购单价', width: 100 },
            { key: 'lastUnitPrice', label: '上次采购单价', width: 120 },
            { key: 'quantity', label: '采购数量', width: 100 },
            { key: 'amount', label: '采购金额', width: 100 },
            { key: 'inboundStatus', label: '入库状态', width: 100 },
            { key: 'deliveryStatus', label: '发货状态', width: 100 },
            { key: 'deliveryDate', label: '发货日期', width: 110 },
            { key: 'logisticsNo', label: '物流单号', width: 120 },
            { key: 'detailRemark', label: '明细备注', width: 140 }
          ], span: 24 }
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
      return res.data
    },
    submitCreate: (data) => createPurchaseInbound(data),
    submitUpdate: (id, data) => updatePurchaseInbound(id, data),
    tabs: [
      {
        label: '入库信息',
        fields: [
          { key: 'section-base', label: '单据信息', type: 'section', span: 24 },
          { key: 'orderNo', label: '订单编号', type: 'input', required: true, placeholder: '请输入订单编号', span: 8 },
          { key: 'supplierName', label: '供应商', type: 'input', required: true, placeholder: '请输入供应商', span: 8 },
          { key: 'orderDate', label: '订货日期', type: 'date', placeholder: '请选择订货日期', span: 8 },
          { key: 'deliveryDays', label: '送货天数', type: 'number', defaultValue: 0, span: 8 },
          { key: 'freightBearer', label: '运费承担', type: 'input', placeholder: '请输入运费承担', span: 8 },
          { key: 'paymentMethod', label: '付款方式', type: 'input', placeholder: '请输入付款方式', span: 8 },
          { key: 'actualSupplier', label: '实际供应商', type: 'input', placeholder: '请输入实际供应商', span: 8 },
          { key: 'discountAmount', label: '抹零金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'totalAmount', label: '订单金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'actualAmount', label: '应付金额', type: 'number', defaultValue: 0, span: 8 },
          { key: 'inboundStatus', label: '入库状态', type: 'radio', defaultValue: '待入库', options: [
            { label: '待入库', value: '待入库' }, { label: '已入库', value: '已入库' }
          ], span: 8 },
          { key: 'auditStatus', label: '审核状态', type: 'radio', defaultValue: '未审核', options: [
            { label: '未审核', value: '未审核' }, { label: '已审核', value: '已审核' }
          ], span: 8 },
          { key: 'images', label: '图片上传', type: 'input', placeholder: '请输入图片地址或附件标识', span: 12 },
          { key: 'attachments', label: '附件上传', type: 'input', placeholder: '请输入附件地址或附件标识', span: 12 },
          { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3, span: 24 },
          { key: 'details', label: '入库明细', type: 'dynamic-table', addLabel: '新增入库明细', columns: [
            { key: 'productCode', label: '产品编号', width: 120 }, { key: 'productName', label: '产品名称', width: 140 },
            { key: 'productType', label: '产品类型', width: 100 }, { key: 'spec', label: '规格', width: 100 },
            { key: 'color', label: '颜色', width: 80 }, { key: 'unit', label: '计量单位', width: 90 },
            { key: 'unitPrice', label: '采购单价', width: 100 }, { key: 'lastUnitPrice', label: '上次采购单价', width: 120 },
            { key: 'quantity', label: '采购数量', width: 100 }, { key: 'amount', label: '采购金额', width: 100 },
            { key: 'deliveryDate', label: '发货日期', width: 110 }, { key: 'logisticsNo', label: '物流单号', width: 120 },
            { key: 'detailRemark', label: '明细备注', width: 140 }
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
  }
}

export function getSceneConfig(type: string): SceneConfig | undefined {
  return formConfigMap[type]
}

export function getRegisteredScenes(): string[] {
  return Object.keys(formConfigMap)
}
