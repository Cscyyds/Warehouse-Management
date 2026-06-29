<template>
  <ListTemplate
    :title="scene.title"
    :show-import="scene.showImport"
    :show-export="scene.showExport"
    :import-columns="scene.columns"
    :export-columns="scene.columns"
    :export-data="tableData"
    :export-file-name="scene.title"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
    @import="handleImport"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item v-for="filter in scene.filters" :key="filter.key" :label="filter.label">
          <el-select
            v-if="filter.type === 'select'"
            v-model="searchForm[filter.key]"
            placeholder="请选择"
            clearable
            style="width: 120px"
          >
            <el-option
              v-for="option in filter.options || []"
              :key="option"
              :label="option"
              :value="option"
            />
          </el-select>
          <el-date-picker
            v-else-if="filter.type === 'date'"
            v-model="searchForm[filter.key]"
            type="date"
            placeholder="请选择"
            clearable
            style="width: 140px"
          />
          <el-input
            v-else
            v-model="searchForm[filter.key]"
            placeholder="请输入"
            clearable
            style="width: 140px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>

    <template #actions>
      <el-button v-if="scene.showAdd" type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>新增
      </el-button>
      <el-button v-if="scene.showPrint" :disabled="selectedRows.length === 0" @click="handleBatchPrint">
        <el-icon><Printer /></el-icon>批量打印
      </el-button>
      <el-button v-if="scene.showAudit" :disabled="selectedRows.length === 0" @click="handleBatchAudit('已审核')">
        审核
      </el-button>
      <el-button v-if="scene.showAudit" :disabled="selectedRows.length === 0" @click="handleBatchAudit('未审核')">
        反审核
      </el-button>
    </template>

    <template #table>
      <el-table
        :data="tableData"
        stripe
        size="small"
        style="width: 100%"
        row-class-name="table-row"
        @selection-change="handleSelectionChange"
      >
        <el-table-column v-if="scene.showSelection" type="selection" width="40" />
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column
          v-for="column in scene.columns"
          :key="column.key"
          :prop="column.key"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :sortable="column.sortable ? 'custom' : false"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <el-tag v-if="column.tag" :type="getTagType(row[column.key])" size="small">
              {{ formatCell(row[column.key], column.enum) }}
            </el-tag>
            <span v-else-if="column.money">{{ formatMoney(row[column.key]) }}</span>
            <span v-else :class="{ 'cell-empty': isEmpty(row[column.key]) }">{{ isEmpty(row[column.key]) ? '-' : row[column.key] }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="scene.showOperations" label="操作" width="230" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            <el-dropdown v-if="scene.rowActions?.length" trigger="click" @command="(command: string) => handleRowCommand(command, row)">
              <el-button link type="primary" size="small">更多</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="action in scene.rowActions"
                    :key="action.command"
                    :command="action.command"
                  >
                    {{ action.label }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Printer } from '@element-plus/icons-vue'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'
import {
  auditPurchaseOrder,
  createPurchaseOrder,
  createSupplier,
  createSupplierType,
  deletePurchaseInbound,
  deletePurchaseOrder,
  deletePurchaseReturn,
  deleteSupplier,
  deleteSupplierType,
  getPurchaseInboundList,
  getPurchaseOrderList,
  getPurchaseReturnList,
  getSupplierList,
  getSupplierTypeList,
  searchPurchaseInbound,
  searchPurchaseOrders,
  searchSupplier,
  searchSupplierType,
  updatePurchaseInboundWarehouseStatus
} from '@/api'

type FilterType = 'input' | 'select' | 'date'

interface FilterConfig {
  key: string
  label: string
  type?: FilterType
  options?: string[]
}

interface ColumnConfig {
  key: string
  label: string
  width?: number
  minWidth?: number
  money?: boolean
  tag?: boolean
  sortable?: boolean
  /** 枚举映射：原始值 → 显示文本 */
  enum?: Record<string, string>
}

interface SceneConfig {
  title: string
  addType?: string
  showAdd?: boolean
  showImport?: boolean
  showExport?: boolean
  showPrint?: boolean
  showAudit?: boolean
  showSelection?: boolean
  showOperations?: boolean
  filters: FilterConfig[]
  columns: ColumnConfig[]
  fallbackData: Record<string, any>[]
  /** 业务 ID 字段名（编辑/删除使用，而非数据库主键 id） */
  idField?: string
  /** 搜索字段映射：前端 searchForm key → 后端字段名及是否数字类型 */
  searchFields?: { key: string; field: string; isNumber?: boolean }[]
  load?: (params: Record<string, any>) => Promise<any>
  /** 专用搜索接口（search_field/search_value JSON 字符串格式） */
  search?: (params: Record<string, any>) => Promise<any>
  remove?: (id: string) => Promise<any>
  importCreate?: (row: Record<string, any>) => Promise<any>
  rowActions?: Array<{ command: string; label: string }>
}

const props = defineProps<{ type: string }>()

const router = useRouter()
const tableData = ref<Record<string, any>[]>([])
const selectedRows = ref<Record<string, any>[]>([])
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const searchForm = reactive<Record<string, any>>({})

/** 采购入库单列表列（snake_case，匹配后端接口41/43返回字段） */
const inboundColumns: ColumnConfig[] = [
  { key: 'receipt_no', label: '入库单号', width: 160, sortable: true },
  { key: 'supplier_name', label: '供应商', minWidth: 140, sortable: true },
  { key: 'total_amount', label: '入库金额', width: 120, money: true, sortable: true },
  { key: 'warehouse_status', label: '入库状态', width: 100, tag: true, sortable: true, enum: { '0': '待入库', '1': '已入库' } },
  { key: 'remark', label: '备注', minWidth: 140, sortable: true },
  { key: 'created_by_name', label: '创建人', width: 100, sortable: true },
  { key: 'created_at', label: '创建时间', width: 160, sortable: true }
]

/** 采购订单列表列（snake_case，匹配后端接口29/31返回字段） */
const orderColumns: ColumnConfig[] = [
  { key: 'order_no', label: '订单编号', width: 150, sortable: true },
  { key: 'supplier_name', label: '供应商', minWidth: 130, sortable: true },
  { key: 'order_date', label: '订单日期', width: 120, sortable: true },
  { key: 'delivery_days', label: '送货天数', width: 90, sortable: true },
  { key: 'freight_bear_type', label: '运费承担', width: 100, sortable: true },
  { key: 'payment_method', label: '付款方式', width: 100, sortable: true },
  { key: 'rounding_amount', label: '抹零金额', width: 100, money: true, sortable: true },
  { key: 'order_amount', label: '订单金额', width: 110, money: true, sortable: true },
  { key: 'payable_amount', label: '应付金额', width: 110, money: true, sortable: true },
  { key: 'is_audited', label: '审核状态', width: 100, tag: true, sortable: true, enum: { '0': '待审核', '1': '已审核', '2': '反审核', '3': '审核失败' } },
  { key: 'purchase_status', label: '采购状态', width: 100, tag: true, sortable: true, enum: { '0': '未采购', '1': '已采购' } },
  { key: 'remark', label: '备注', minWidth: 140, sortable: true },
  { key: 'created_by_name', label: '创建人', width: 100, sortable: true },
  { key: 'created_at', label: '创建时间', width: 160, sortable: true }
]

const returnColumns: ColumnConfig[] = [
  { key: 'returnNo', label: '单据编号', width: 130, sortable: true },
  { key: 'supplierName', label: '供应商', minWidth: 130, sortable: true },
  { key: 'actualSupplier', label: '实际供应商', minWidth: 120, sortable: true },
  { key: 'returnMethod', label: '退货方式', width: 100, sortable: true },
  { key: 'returnAddress', label: '退货地址', minWidth: 160, sortable: true },
  { key: 'totalAmount', label: '订单金额', width: 100, money: true, sortable: true },
  { key: 'productCode', label: '产品编号', width: 110, sortable: true },
  { key: 'productName', label: '产品名称', minWidth: 130, sortable: true },
  { key: 'productType', label: '产品类型', width: 100, sortable: true },
  { key: 'spec', label: '产品规格', width: 100, sortable: true },
  { key: 'color', label: '颜色', width: 80, sortable: true },
  { key: 'unit', label: '计量单位', width: 90, sortable: true },
  { key: 'purchasePrice', label: '采购单价', width: 100, money: true, sortable: true },
  { key: 'returnPrice', label: '退货单价', width: 100, money: true, sortable: true },
  { key: 'returnQuantity', label: '退货数量', width: 100, sortable: true },
  { key: 'returnAmount', label: '退货金额', width: 100, money: true, sortable: true },
  { key: 'sendWarehouseStatus', label: '发送仓库状态', width: 120, tag: true, sortable: true },
  { key: 'warehouseReturnStatus', label: '仓库退回状态', width: 120, tag: true, sortable: true }
]

const sampleReturns = [
  {
    id: 'PR202605001',
    returnNo: 'PR202605001',
    supplierName: '华南五金供应商',
    actualSupplier: '华南五金供应商',
    returnMethod: '物流退回',
    returnAddress: '佛山市顺德区',
    totalAmount: 640,
    productCode: 'P001',
    productName: '静音铰链',
    productType: '成品',
    spec: '35mm',
    color: '银色',
    unit: '个',
    purchasePrice: 3.2,
    returnPrice: 3.2,
    returnQuantity: 200,
    returnAmount: 640,
    sendWarehouseStatus: '未发送',
    warehouseReturnStatus: '未退回',
    remark: '质量异常'
  }
]

const scenes: Record<string, SceneConfig> = {
  supplierType: {
    title: '供应商类型',
    addType: 'purchaseSupplierType',
    showAdd: true,
    showExport: true,
    showSelection: true,
    showOperations: true,
    filters: [
      { key: 'type_name', label: '类型名称' },
      { key: 'status', label: '状态', type: 'select', options: ['启用', '停用'] }
    ],
    columns: [
      { key: 'supplier_type_id', label: '供应商类型ID', width: 140, sortable: true },
      { key: 'type_name', label: '类型名称', minWidth: 150, sortable: true },
      { key: 'status', label: '状态', width: 80, tag: true, sortable: true, enum: { '0': '停用', '1': '启用' } },
      { key: 'remark', label: '备注', minWidth: 140, sortable: true },
      { key: 'created_by_name', label: '创建人', width: 100, sortable: true },
      { key: 'created_at', label: '创建时间', width: 160, sortable: true },
      { key: 'updated_at', label: '更新时间', width: 160, sortable: true }
    ],
    fallbackData: [],
    idField: 'supplier_type_id',
    searchFields: [
      { key: 'type_name', field: 'type_name' },
      { key: 'status', field: 'status', isNumber: true }
    ],
    load: (params) => getSupplierTypeList(params as any),
    search: (params) => searchSupplierType(params as any),
    remove: deleteSupplierType,
    importCreate: (row) => createSupplierType({ type_name: row.type_name || row.name, status: Number(row.status) || 1, remark: row.remark })
  },
  supplier: {
    title: '供应商档案',
    addType: 'purchaseSupplier',
    showAdd: true,
    showImport: true,
    showExport: true,
    showSelection: true,
    showOperations: true,
    filters: [
      { key: 'supplier_name', label: '供应商名称' },
      { key: 'supplier_code', label: '供应商编码' },
      { key: 'status', label: '状态', type: 'select', options: ['启用', '停用'] }
    ],
    columns: [
      { key: 'supplier_id', label: '供应商ID', width: 120 },
      { key: 'supplier_code', label: '编码', width: 110 },
      { key: 'supplier_name', label: '名称', minWidth: 140 },
      { key: 'short_name', label: '简称', width: 110 },
      { key: 'supplier_type_name', label: '供应商类型', width: 120 },
      { key: 'detail_address', label: '详细地址', minWidth: 180 },
      { key: 'phone1', label: '电话1', width: 130 },
      { key: 'phone2', label: '电话2', width: 130 },
      { key: 'fax_no', label: '传真号', width: 110 },
      { key: 'email', label: '邮箱', width: 150 },
      { key: 'principal_phone', label: '负责人电话', width: 130 },
      { key: 'business_contact', label: '业务联系人', width: 110 },
      { key: 'contact_phone', label: '联系人电话', width: 130 },
      { key: 'bank_name', label: '开户行', minWidth: 130 },
      { key: 'bank_account', label: '银行账号', width: 150 },
      { key: 'payee_name', label: '收款人', width: 100 },
      { key: 'balance', label: '余额', width: 110, money: true },
      { key: 'status', label: '状态', width: 80, tag: true, enum: { '0': '停用', '1': '启用' } },
      { key: 'remark', label: '备注', minWidth: 140 }
    ],
    fallbackData: [],
    idField: 'supplier_id',
    searchFields: [
      { key: 'supplier_name', field: 'supplier_name' },
      { key: 'supplier_code', field: 'supplier_code' },
      { key: 'status', field: 'status', isNumber: true }
    ],
    load: (params) => getSupplierList(params as any),
    search: (params) => searchSupplier(params as any),
    remove: deleteSupplier,
    importCreate: (row) => createSupplier({ supplier_name: row.supplier_name || row.name, short_name: row.short_name, status: Number(row.status) || 1, remark: row.remark })
  },
  order: {
    title: '采购订单',
    addType: 'purchaseOrder',
    showAdd: true,
    showExport: true,
    showPrint: true,
    showAudit: true,
    showSelection: true,
    showOperations: true,
    filters: [
      { key: 'order_no', label: '订单编号' },
      { key: 'supplier_name', label: '供应商' },
      { key: 'is_audited', label: '审核状态', type: 'select', options: ['待审核', '已审核', '反审核'] }
    ],
    columns: orderColumns,
    fallbackData: [],
    idField: 'purchase_order_id',
    searchFields: [
      { key: 'order_no', field: 'order_no' },
      { key: 'supplier_name', field: 'supplier_name' },
      { key: 'is_audited', field: 'is_audited', isNumber: true }
    ],
    load: (params) => getPurchaseOrderList(params as any),
    search: (params) => searchPurchaseOrders(params as any),
    remove: deletePurchaseOrder
  },
  inbound: {
    title: '采购入库单',
    addType: 'purchaseInbound',
    showAdd: true,
    showExport: true,
    showPrint: true,
    showSelection: true,
    showOperations: true,
    filters: [
      { key: 'receipt_no', label: '入库单号' },
      { key: 'supplier_name', label: '供应商' },
      { key: 'warehouse_status', label: '入库状态', type: 'select', options: ['待入库', '已入库'] }
    ],
    columns: inboundColumns,
    fallbackData: [],
    idField: 'purchase_receipt_id',
    searchFields: [
      { key: 'receipt_no', field: 'receipt_no' },
      { key: 'supplier_name', field: 'supplier_name' },
      { key: 'warehouse_status', field: 'warehouse_status', isNumber: true }
    ],
    load: (params) => getPurchaseInboundList(params as any),
    search: (params) => searchPurchaseInbound(params as any),
    remove: deletePurchaseInbound,
    rowActions: [
      { command: 'confirmInbound', label: '确认入库' }
    ]
  },
  return: {
    title: '采购退货单',
    addType: 'purchaseReturn',
    showAdd: true,
    showImport: true,
    showExport: true,
    showPrint: true,
    showSelection: true,
    showOperations: true,
    filters: [
      { key: 'returnNo', label: '单据编号' },
      { key: 'supplierName', label: '供应商' },
      { key: 'sendWarehouseStatus', label: '发送仓库', type: 'select', options: ['未发送', '已发送'] }
    ],
    columns: returnColumns,
    fallbackData: sampleReturns,
    load: (params) => getPurchaseReturnList(params as any),
    remove: deletePurchaseReturn,
    rowActions: [
      { command: 'sendReturn', label: '发送仓库' },
      { command: 'returnReturn', label: '仓库退回' }
    ]
  },
  returnSummary: {
    title: '采购退货汇总表',
    showExport: true,
    filters: [
      { key: 'supplierName', label: '供应商' },
      { key: 'startDate', label: '开始日期', type: 'date' },
      { key: 'endDate', label: '结束日期', type: 'date' }
    ],
    columns: [
      { key: 'supplierName', label: '供应商', minWidth: 140 },
      { key: 'returnQuantity', label: '退货数量', width: 100 },
      { key: 'returnAmount', label: '退货金额', width: 120, money: true },
      { key: 'returnCount', label: '退货单数', width: 100 }
    ],
    fallbackData: [
      { id: 'RS001', supplierName: '华南五金供应商', returnQuantity: 200, returnAmount: 640, returnCount: 1 }
    ]
  },
  inboundDetail: {
    title: '采购入库单明细',
    showExport: true,
    filters: [
      { key: 'orderNo', label: '订单编号' },
      { key: 'supplierName', label: '供应商' },
      { key: 'productName', label: '产品名称' }
    ],
    columns: inboundColumns,
    fallbackData: []
  },
  supplierBalance: {
    title: '供应商余额表',
    showExport: true,
    filters: [
      { key: 'supplierName', label: '供应商' },
      { key: 'buyer', label: '采购员' }
    ],
    columns: [
      { key: 'supplierName', label: '供应商', minWidth: 140, sortable: true },
      { key: 'openingBalance', label: '期初余额', width: 120, money: true, sortable: true },
      { key: 'purchaseAmount', label: '采购金额', width: 120, money: true, sortable: true },
      { key: 'paidAmount', label: '已付金额', width: 120, money: true, sortable: true },
      { key: 'returnAmount', label: '退货金额', width: 120, money: true, sortable: true },
      { key: 'balance', label: '当前余额', width: 120, money: true, sortable: true },
      { key: 'buyer', label: '采购员', width: 100, sortable: true }
    ],
    fallbackData: [
      { id: 'SB001', supplierName: '华南五金供应商', openingBalance: 12000, purchaseAmount: 8800, paidAmount: 5000, returnAmount: 640, balance: 15160, buyer: '李菲' }
    ]
  }
}

const scene = computed(() => scenes[props.type] || scenes.supplierType)

function initSearchForm() {
  Object.keys(searchForm).forEach((key) => delete searchForm[key])
  scene.value.filters.forEach((filter) => {
    searchForm[filter.key] = ''
  })
}

function filterFallbackData(rows: Record<string, any>[]) {
  return rows.filter((row) => scene.value.filters.every((filter) => {
    const searchValue = searchForm[filter.key]
    if (!searchValue) return true
    return String(row[filter.key] ?? '').includes(String(searchValue))
  }))
}

/** 将筛选框的值标准化（状态中文 → 数字） */
function normalizeSearchValue(raw: any, isNumber?: boolean) {
  if (!isNumber) return raw
  if (raw === '启用') return 1
  if (raw === '停用') return 0
  if (raw === '待审核') return 0
  if (raw === '已审核') return 1
  if (raw === '反审核') return 2
  return Number(raw)
}

async function loadData() {
  // 已接入后端的场景：使用真实接口，不再回退假数据
  if (scene.value.load) {
    try {
      // 构建专用 search 接口的参数（search_field/search_value JSON 字符串）
      const sf = scene.value.searchFields || []
      const activeFields = sf.filter((f) => {
        const v = searchForm[f.key]
        return v !== undefined && v !== null && v !== ''
      })

      let response
      if (scene.value.search && activeFields.length > 0) {
        const searchField: string[] = []
        const searchValue: Record<string, unknown> = {}
        activeFields.forEach((f) => {
          searchField.push(f.field)
          searchValue[f.field] = normalizeSearchValue(searchForm[f.key], f.isNumber)
        })
        response = await scene.value.search({
          search_field: JSON.stringify(searchField),
          search_value: JSON.stringify(searchValue),
          page: pagination.page,
          sort_by: sortBy.value || undefined,
          sort_order: sortOrder.value || undefined,
        })
      } else {
        response = await scene.value.load({
          page: pagination.page,
          sort_by: sortBy.value || undefined,
          sort_order: sortOrder.value || undefined,
        })
      }
      // 后端列表数据 key：purchase_order(订单) / purchase_receipts(入库单) / supplier_type / supplier
      tableData.value = response.data.purchase_order || response.data.purchase_receipts || response.data.supplier_type || response.data.supplier || response.data.list || []
      pagination.total = response.data.total || 0
    } catch {
      tableData.value = []
      pagination.total = 0
    }
    return
  }
  // 未接入后端的场景：沿用本地示例数据
  const filtered = filterFallbackData(scene.value.fallbackData)
  const start = (pagination.page - 1) * pagination.pageSize
  tableData.value = filtered.slice(start, start + pagination.pageSize)
  pagination.total = filtered.length
}

function handleSearch() {
  pagination.page = 1
  loadData()
}

function handleReset() {
  initSearchForm()
  handleSearch()
}

function handleSelectionChange(rows: Record<string, any>[]) {
  selectedRows.value = rows
}

function handleAdd() {
  if (!scene.value.addType) return
  router.push({ path: '/common/add', query: { type: scene.value.addType } })
}

function handleEdit(row: Record<string, any>) {
  if (!scene.value.addType) return
  // 编辑/删除使用业务 ID（如 supplier_id），而非数据库主键 id
  const bizId = scene.value.idField ? row[scene.value.idField] : row.id
  sessionStorage.setItem(`editData:${scene.value.addType}`, JSON.stringify(row))
  router.push({
    path: '/common/add',
    query: { type: scene.value.addType, id: bizId, mode: 'edit' }
  })
}

async function handleDelete(row: Record<string, any>) {
  const bizId = scene.value.idField ? row[scene.value.idField] : row.id
  try {
    await ElMessageBox.confirm(`确认删除 ${row.name || row.type_name || row.supplier_name || row.orderNo || row.returnNo || bizId}？`, '提示', {
      confirmButtonText: '确认删除',
      type: 'warning'
    })
    if (scene.value.remove) await scene.value.remove(bizId)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

async function handleImport(rows: Record<string, any>[]) {
  try {
    if (scene.value.importCreate) {
      await Promise.all(rows.map((row) => scene.value.importCreate!(row)))
    }
    ElMessage.success(`已导入 ${rows.length} 条数据`)
    loadData()
  } catch {
    ElMessage.success(`已解析 ${rows.length} 条数据，请对接后端导入接口`)
  }
}

async function handleBatchAudit(status: string) {
  // 审核按钮 → is_audited=1（审核通过）；反审核按钮 → is_audited=2（反审核）
  const isAudited = status === '已审核' ? 1 : 2
  const idField = scene.value.idField || 'id'
  const ids = selectedRows.value.map((row) => row[idField])
  try {
    await auditPurchaseOrder(ids, isAudited)
    ElMessage.success(`${status}成功`)
    loadData()
  } catch {
    ElMessage.error(`${status}失败`)
  }
}

function handleBatchPrint() {
  ElMessage.success(`已提交 ${selectedRows.value.length} 条单据到打印队列`)
}

async function handleRowCommand(command: string, row: Record<string, any>) {
  try {
    if (command === 'confirmInbound') {
      const bizId = scene.value.idField ? row[scene.value.idField] : row.id
      await ElMessageBox.confirm(`确认将入库单 ${row.receipt_no || bizId} 状态更新为已入库？此操作将同步更新仓库库存。`, '确认入库', {
        confirmButtonText: '确认入库',
        type: 'warning'
      })
      await updatePurchaseInboundWarehouseStatus(bizId, 1)
      ElMessage.success('入库成功')
      loadData()
      return
    }
    ElMessage.success('操作成功')
    loadData()
  } catch {}
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0)
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function getTagType(value: any) {
  const str = String(value)
  if (['正常', '已审核', '已入库', '已发货', '已发送', '1', '启用'].includes(str)) return 'success'
  if (['停用', '未审核', '未入库', '未发货', '未发送', '0'].includes(str)) return 'info'
  if (['反审核', '审核失败', '2', '3'].includes(str)) return 'danger'
  return 'warning'
}

/** 判断单元格值是否为空（0 不算空） */
function isEmpty(value: any): boolean {
  return value === null || value === undefined || value === ''
}

/** 格式化 tag 单元格：有 enum 映射则转换，否则原样返回 */
function formatCell(value: any, enumMap?: Record<string, string>): string {
  if (isEmpty(value)) return '-'
  if (enumMap) {
    return enumMap[String(value)] ?? String(value)
  }
  return String(value)
}

onMounted(() => {
  initSearchForm()
  loadData()
})
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
