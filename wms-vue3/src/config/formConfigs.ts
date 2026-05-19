import { getOrgTree } from '@/api'

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
}

const formConfigMap: Record<string, SceneConfig> = {
  personnel: {
    title: '新增用户',
    editTitle: '编辑用户',
    type: 'personnel',
    module: 'system/personnel',
    successRoute: '/system/personnel',
    labelWidth: '110px',
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
    tabs: [
      {
        label: '角色信息',
        fields: [
          { key: 'section-base', label: '基本信息', type: 'section', span: 24 },
          { key: 'name', label: '角色名称', type: 'input', required: true, placeholder: '请输入角色名称', span: 8 },
          { key: 'code', label: '角色编码', type: 'input', required: true, placeholder: '请输入角色编码', span: 8 },
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
  }
}

export function getSceneConfig(type: string): SceneConfig | undefined {
  return formConfigMap[type]
}

export function getRegisteredScenes(): string[] {
  return Object.keys(formConfigMap)
}
