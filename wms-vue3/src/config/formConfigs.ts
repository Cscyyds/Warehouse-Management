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
  getProductDetail, createProduct, updateProduct
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
  }
}

export function getSceneConfig(type: string): SceneConfig | undefined {
  return formConfigMap[type]
}

export function getRegisteredScenes(): string[] {
  return Object.keys(formConfigMap)
}
