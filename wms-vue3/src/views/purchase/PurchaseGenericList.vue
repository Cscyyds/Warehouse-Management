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
            <el-tag v-if="column.tag" :type="getTagType(row[column.key], column.key)" size="small">
              {{ formatCell(row[column.key], column.enum) }}
            </el-tag>
            <span v-else-if="column.money">{{ formatMoney(row[column.key]) }}</span>
            <span v-else :class="{ 'cell-empty': isEmpty(row[column.key]) }">{{ isEmpty(row[column.key]) ? '-' : row[column.key] }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="scene.showOperations" label="操作" width="230" fixed="right" align="center">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            <el-dropdown
              v-if="getVisibleRowActions(row).length"
              trigger="click"
              @command="(command: string) => handleRowCommand(command, row)"
            >
                <el-button link type="primary" size="small">更多</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                    v-for="action in getVisibleRowActions(row)"
                      :key="action.command"
                      :command="action.command"
                    >
                      {{ action.label }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <!-- 仓库退回弹窗（入库单 / 退货单共用） -->
  <WarehouseReturnDialog
    v-model="returnDialog.visible"
    :title="returnDialog.title"
    :biz-type="returnDialog.bizType"
    :items="returnDialog.items"
    @confirm="handleWarehouseReturnConfirm"
  />

  <!-- 审核预览弹窗（采购订单专用） -->
  <AuditPreviewDialog
    v-model="auditPreviewDialog.visible"
    :loading="auditPreviewDialog.loading"
    :data="auditPreviewDialog.data"
    :order-count="auditPreviewDialog.orderCount"
    @confirm="handleAuditPreviewConfirm"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Printer } from '@element-plus/icons-vue'
import ListTemplate from '@/views/common/ListTemplate.vue'
import WarehouseReturnDialog from './WarehouseReturnDialog.vue'
import AuditPreviewDialog from './AuditPreviewDialog.vue'
import { useTableSort } from '@/composables/useTableSort'
import {
  auditPurchaseOrder,
  previewPurchaseOrderAudit,
  updatePurchaseOrderStatus,
  cancelSendPurchaseInbound,
  cancelSendPurchaseReturn,
  createPurchaseOrder,
  createSupplier,
  createSupplierType,
  deletePurchaseInbound,
  deletePurchaseOrder,
  deletePurchaseReturn,
  deleteSupplier,
  deleteSupplierType,
  getPurchaseInboundDetail,
  getPurchaseInboundList,
  getPurchaseInboundItemList,
  getPurchaseOrderList,
  getPurchaseReturnDetail,
  getPurchaseReturnList,
  getPurchaseReturnItemList,
  getSupplierList,
  getSupplierTypeList,
  searchPurchaseInbound,
  searchPurchaseInboundItems,
  searchPurchaseOrders,
  searchPurchaseReturn,
  searchPurchaseReturnItems,
  searchSupplier,
  searchSupplierType,
  updatePurchaseInboundWarehouseStatus,
  updatePurchaseReturnWarehouseStatus,
  warehouseReturnPurchaseInbound,
  warehouseReturnPurchaseReturn
} from '@/api'
import type { AuditPreviewResult } from '@/api'

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

/** 仓库退回弹窗状态 */
const returnDialog = reactive<{
  visible: boolean
  title: string
  bizType: 'inbound' | 'return'
  bizId: string
  items: Record<string, any>[]
}>({
  visible: false,
  title: '',
  bizType: 'inbound',
  bizId: '',
  items: []
})

/** 审核预览弹窗状态 */
const auditPreviewDialog = reactive<{
  visible: boolean
  loading: boolean
  submitting: boolean
  data: AuditPreviewResult | null
  orderCount: number
  ids: string[]
}>({
  visible: false,
  loading: false,
  submitting: false,
  data: null,
  orderCount: 0,
  ids: []
})

const inboundWarehouseStatusEnum: Record<string, string> = {
  '0': '待入库',
  '1': '已发送仓库',
  '2': '仓库退回',
  '3': '入库完成'
}

/** 采购入库单列表列（snake_case，匹配后端接口41/43返回字段） */
const inboundColumns: ColumnConfig[] = [
  { key: 'receipt_no', label: '入库单号', width: 160, sortable: true },
  { key: 'supplier_name', label: '供应商', minWidth: 140, sortable: true },
  { key: 'warehouse_status', label: '入库状态', width: 100, tag: true, sortable: true, enum: inboundWarehouseStatusEnum },
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
  { key: 'return_no', label: '退货单号', width: 160, sortable: true },
  { key: 'supplier_name', label: '供应商', minWidth: 140, sortable: true },
  { key: 'payment_method', label: '退货方式', width: 110, sortable: true },
  { key: 'return_address', label: '退货地址', minWidth: 160, sortable: true },
  { key: 'return_amount', label: '退货金额', width: 120, money: true, sortable: true },
  { key: 'warehouse_status', label: '出库状态', width: 100, tag: true, sortable: true, enum: { '0': '待出库', '1': '已出库' } },
  { key: 'send_by_name', label: '发货人', width: 100, sortable: true },
  { key: 'remark', label: '备注', minWidth: 140, sortable: true },
  { key: 'created_by_name', label: '创建人', width: 100, sortable: true },
  { key: 'created_at', label: '创建时间', width: 160, sortable: true }
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
      { key: 'warehouse_status', label: '入库状态', type: 'select', options: ['待入库', '已发送仓库', '仓库退回', '入库完成'] }
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
      { command: 'confirmInbound', label: '确认入库' },
      { command: 'warehouseReturn', label: '仓库退回' },
      { command: 'cancelSend', label: '撤销发送' }
    ]
  },
  return: {
    title: '采购退货单',
    addType: 'purchaseReturn',
    showAdd: true,
    showExport: true,
    showPrint: true,
    showSelection: true,
    showOperations: true,
    filters: [
      { key: 'return_no', label: '退货单号' },
      { key: 'supplier_name', label: '供应商' },
      { key: 'warehouse_status', label: '出库状态', type: 'select', options: ['待出库', '已出库'] }
    ],
    columns: returnColumns,
    fallbackData: [],
    idField: 'purchase_return_id',
    searchFields: [
      { key: 'return_no', field: 'return_no' },
      { key: 'supplier_name', field: 'supplier_name' },
      { key: 'warehouse_status', field: 'warehouse_status', isNumber: true }
    ],
    load: (params) => getPurchaseReturnList(params as any),
    search: (params) => searchPurchaseReturn(params as any),
    remove: deletePurchaseReturn,
    rowActions: [
      { command: 'confirmReturn', label: '确认出库' },
      { command: 'warehouseReturn', label: '仓库退回' },
      { command: 'cancelSend', label: '撤销发送' }
    ]
  },
  returnSummary: {
    title: '采购退货汇总表',
    showExport: true,
    filters: [
      { key: 'return_no', label: '退货单号' },
      { key: 'supplier_name', label: '供应商' },
      { key: 'product_name', label: '产品名称' },
      { key: 'warehouse_status', label: '出库状态', type: 'select', options: ['待出库', '已出库'] }
    ],
    columns: [
      { key: 'return_no', label: '退货单号', width: 160, sortable: true },
      { key: 'supplier_name', label: '供应商', minWidth: 140, sortable: true },
      { key: 'purchase_order_no', label: '采购订单号', width: 150, sortable: true },
      { key: 'product_code', label: '商品编码', width: 120, sortable: true },
      { key: 'product_name', label: '商品名称', minWidth: 140, sortable: true },
      { key: 'category_name', label: '分类', width: 110, sortable: true },
      { key: 'specification', label: '规格', width: 110, sortable: true },
      { key: 'unit_name', label: '单位', width: 80, sortable: true },
      { key: 'return_price', label: '退货单价', width: 110, money: true, sortable: true },
      { key: 'return_qty', label: '退货数量', width: 110, sortable: true },
      { key: 'actual_return_qty', label: '实际退货数量', width: 120, sortable: true },
      { key: 'planned_return_amount', label: '计划退货金额', width: 130, money: true, sortable: true },
      { key: 'actual_return_amount', label: '实际退货金额', width: 130, money: true, sortable: true },
      { key: 'warehouse_status', label: '出库状态', width: 100, tag: true, sortable: true, enum: { '0': '待出库', '1': '已出库' } },
      { key: 'formal_return_date', label: '退货日期', width: 120, sortable: true },
      { key: 'created_at', label: '创建时间', width: 160, sortable: true }
    ],
    fallbackData: [
      { id: 'RS001', supplierName: '华南五金供应商', returnQuantity: 200, returnAmount: 640, returnCount: 1 }
    ],
    searchFields: [
      { key: 'return_no', field: 'return_no' },
      { key: 'supplier_name', field: 'supplier_name' },
      { key: 'product_name', field: 'product_name' },
      { key: 'warehouse_status', field: 'warehouse_status', isNumber: true }
    ],
    load: (params) => getPurchaseReturnItemList(params as any),
    search: (params) => searchPurchaseReturnItems(params as any)
  },
  inboundDetail: {
    title: '采购入库单明细',
    showExport: true,
    filters: [
      { key: 'receipt_no', label: '入库单号' },
      { key: 'supplier_name', label: '供应商' },
      { key: 'product_name', label: '产品名称' },
      { key: 'warehouse_status', label: '入库状态', type: 'select', options: ['待入库', '已发送仓库', '仓库退回', '入库完成'] }
    ],
    columns: [
      { key: 'receipt_no', label: '入库单号', width: 160, sortable: true },
      { key: 'supplier_name', label: '供应商', minWidth: 140, sortable: true },
      { key: 'purchase_order_no', label: '采购订单号', width: 150, sortable: true },
      { key: 'product_code', label: '商品编码', width: 120, sortable: true },
      { key: 'product_name', label: '商品名称', minWidth: 140, sortable: true },
      { key: 'category_name', label: '分类', width: 110, sortable: true },
      { key: 'specification', label: '规格', width: 110, sortable: true },
      { key: 'unit_name', label: '单位', width: 80, sortable: true },
      { key: 'purchase_price', label: '采购单价', width: 110, money: true, sortable: true },
      { key: 'in_stock_qty', label: '入库数量', width: 110, sortable: true },
      { key: 'actual_in_stock_qty', label: '实际入库数量', width: 120, sortable: true },
      { key: 'planned_receipt_amount', label: '计划入库金额', width: 130, money: true, sortable: true },
      { key: 'actual_receipt_amount', label: '实际入库金额', width: 130, money: true, sortable: true },
      { key: 'warehouse_status', label: '入库状态', width: 100, tag: true, sortable: true, enum: inboundWarehouseStatusEnum },
      { key: 'formal_receipt_date', label: '入库日期', width: 120, sortable: true },
      { key: 'created_at', label: '创建时间', width: 160, sortable: true }
    ],
    fallbackData: [],
    searchFields: [
      { key: 'receipt_no', field: 'receipt_no' },
      { key: 'supplier_name', field: 'supplier_name' },
      { key: 'product_name', field: 'product_name' },
      { key: 'warehouse_status', field: 'warehouse_status', isNumber: true }
    ],
    load: (params) => getPurchaseInboundItemList(params as any),
    search: (params) => searchPurchaseInboundItems(params as any)
  },
  supplierBalance: {
    title: '供应商余额表',
    showExport: true,
    filters: [
      { key: 'supplier_name', label: '供应商' },
      { key: 'purchaser_user_name', label: '采购员' }
    ],
    columns: [
      { key: 'supplier_code', label: '供应商编码', width: 120, sortable: true },
      { key: 'supplier_name', label: '供应商', minWidth: 140, sortable: true },
      { key: 'supplier_type_name', label: '供应商类型', width: 120, sortable: true },
      { key: 'balance', label: '当前余额', width: 120, money: true, sortable: true },
      { key: 'credit_amount', label: '授信额度', width: 120, money: true, sortable: true },
      { key: 'prepayment_amount', label: '预付款余额', width: 120, money: true, sortable: true },
      { key: 'gift_amount', label: '赠送金额', width: 120, money: true, sortable: true },
      { key: 'purchaser_user_name', label: '采购员', width: 100, sortable: true },
      { key: 'status', label: '状态', width: 80, tag: true, enum: { '0': '停用', '1': '启用' } }
    ],
    fallbackData: [
      { id: 'SB001', supplierName: '华南五金供应商', openingBalance: 12000, purchaseAmount: 8800, paidAmount: 5000, returnAmount: 640, balance: 15160, buyer: '李菲' }
    ],
    searchFields: [
      { key: 'supplier_name', field: 'supplier_name' },
      { key: 'purchaser_user_name', field: 'purchaser_user_name' }
    ],
    load: (params) => getSupplierList(params as any),
    search: (params) => searchSupplier(params as any)
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
  if (raw === '待入库') return 0
  if (raw === '已发送仓库' || raw === '已入库') return 1
  if (raw === '仓库退回') return 2
  if (raw === '入库完成') return 3
  if (raw === '待出库') return 0
  if (raw === '已出库') return 1
  return Number(raw)
}

function getVisibleRowActions(row: Record<string, any>) {
  const actions = scene.value.rowActions || []
  if (props.type !== 'inbound') return actions

  const warehouseStatus = Number(row.warehouse_status || 0)
  const canCancelSend = Number(row.can_cancel_send || 0) === 1

  return actions.filter((action) => {
    if (action.command === 'confirmInbound') return warehouseStatus === 0
    if (action.command === 'warehouseReturn') return warehouseStatus === 1 || warehouseStatus === 2
    if (action.command === 'cancelSend') return canCancelSend
    return true
  })
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
      // 后端列表数据 key：purchase_order(订单) / purchase_receipts(入库单) / purchase_returns(退货单) / supplier_type / supplier / items(入库/退货明细列表)
      tableData.value = response.data.purchase_order || response.data.purchase_receipts || response.data.purchase_returns || response.data.supplier_type || response.data.supplier || response.data.items || response.data.list || []
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
  const idField = scene.value.idField || 'id'
  const ids = selectedRows.value.map((row) => row[idField])

  // 反审核：直接提交，无预览
  if (status !== '已审核') {
    try {
      await auditPurchaseOrder(ids, 2)
      ElMessage.success(`${status}成功`)
      loadData()
    } catch {
      ElMessage.error(`${status}失败`)
    }
    return
  }

  // 审核：先调预览接口弹窗，用户确认后再真正审核
  auditPreviewDialog.ids = ids
  auditPreviewDialog.orderCount = ids.length
  auditPreviewDialog.data = null
  auditPreviewDialog.visible = true
  auditPreviewDialog.loading = true
  try {
    // 后端预览接口暂为单 ID，前端并发逐个调用并聚合（任一溢出即标记、金额求和）
    const results = await Promise.all(
      ids.map((id) => previewPurchaseOrderAudit(id).then((r) => r.data).catch(() => null))
    )
    if (results.some((r) => r === null)) {
      ElMessage.error('审核预检失败')
      auditPreviewDialog.visible = false
      return
    }
    auditPreviewDialog.data = aggregateAuditPreview(results as AuditPreviewResult[])
  } catch {
    ElMessage.error('审核预检失败')
    auditPreviewDialog.visible = false
  } finally {
    auditPreviewDialog.loading = false
  }
}

/** 将多条单 ID 预检结果聚合为单个汇总对象（后端批量上线后此函数可移除） */
function aggregateAuditPreview(list: AuditPreviewResult[]): AuditPreviewResult {
  const sum = (key: keyof AuditPreviewResult) =>
    list.reduce((acc, r) => acc + Number((r as any)[key] || 0), 0).toFixed(4)
  return {
    has_gift_overflow: list.some((r) => r.has_gift_overflow),
    gift_overflow_amount: sum('gift_overflow_amount'),
    requested_gift_amount: sum('requested_gift_amount'),
    actual_gift_amount: sum('actual_gift_amount'),
    has_prepayment_overflow: list.some((r) => r.has_prepayment_overflow),
    prepayment_overflow_amount: sum('prepayment_overflow_amount'),
    requested_prepayment_amount: sum('requested_prepayment_amount'),
    actual_prepayment_amount: sum('actual_prepayment_amount')
  }
}

async function handleAuditPreviewConfirm() {
  if (auditPreviewDialog.submitting) return
  auditPreviewDialog.submitting = true
  try {
    await auditPurchaseOrder(auditPreviewDialog.ids, 1)
    // 审核成功后自动标记为已采购（purchase_status 0→1），否则后续创建入库单会被后端拦截
    try {
      await updatePurchaseOrderStatus(auditPreviewDialog.ids)
      ElMessage.success('审核成功，已标记为已采购')
    } catch {
      ElMessage.warning('审核成功，但标记已采购失败，请手动标记后再创建入库单')
    }
    auditPreviewDialog.visible = false
    loadData()
  } catch {
    ElMessage.error('审核失败')
  } finally {
    auditPreviewDialog.submitting = false
  }
}

function handleBatchPrint() {
  ElMessage.success(`已提交 ${selectedRows.value.length} 条单据到打印队列`)
}

async function handleRowCommand(command: string, row: Record<string, any>) {
  const bizId = scene.value.idField ? row[scene.value.idField] : row.id
  const warehouseStatus = Number(row.warehouse_status || 0)
  const canCancelSend = Number(row.can_cancel_send || 0) === 1
  try {
    // 确认入库（发送仓库）：入库单 warehouse_status 0→1
    if (command === 'confirmInbound') {
      if (warehouseStatus !== 0) {
        ElMessage.warning('当前入库单状态不允许确认入库')
        return
      }
      await ElMessageBox.confirm(`确认将入库单 ${row.receipt_no || bizId} 发送仓库？此操作将同步更新仓库库存。`, '确认入库', {
        confirmButtonText: '确认入库',
        type: 'warning'
      })
      await updatePurchaseInboundWarehouseStatus([bizId], 1)
      ElMessage.success('入库成功')
      loadData()
      return
    }
    // 确认出库（发送仓库）：退货单 warehouse_status 0→1
    if (command === 'confirmReturn') {
      await ElMessageBox.confirm(`确认将退货单 ${row.return_no || bizId} 发送仓库？`, '确认出库', {
        confirmButtonText: '确认出库',
        type: 'warning'
      })
      await updatePurchaseReturnWarehouseStatus([bizId], 1)
      ElMessage.success('出库成功')
      loadData()
      return
    }
    // 仓库退回：拉取明细 → 弹窗选择 → 调用退回接口（创建异常单）
    if (command === 'warehouseReturn') {
      if (props.type === 'inbound' && warehouseStatus === 0) {
        ElMessage.warning('仓库尚未处理，请先确认入库；若需撤销发送，请使用撤销发送')
        return
      }
      const isReturn = props.type === 'return'
      // 入库/退货详情后端均返回裸对象，直接使用 res.data
      const detail = isReturn
        ? (await getPurchaseReturnDetail(bizId)).data
        : (await getPurchaseInboundDetail(bizId)).data
      const items = detail?.items ?? []
      if (items.length === 0) {
        ElMessage.warning('该单据暂无明细，无法仓库退回')
        return
      }
      returnDialog.title = `仓库退回 - ${isReturn ? row.return_no : row.receipt_no}`
      returnDialog.bizType = isReturn ? 'return' : 'inbound'
      returnDialog.bizId = bizId
      returnDialog.items = items
      returnDialog.visible = true
      return
    }
    // 撤销发送：仓库未操作时 warehouse_status 1→0（不建异常单）
    if (command === 'cancelSend') {
      if (props.type === 'inbound' && !canCancelSend) {
        ElMessage.warning('仓库已处理，无法撤销发送，请使用仓库退回')
        return
      }
      const isReturn = props.type === 'return'
      const label = isReturn ? '退货单' : '入库单'
      const no = isReturn ? row.return_no : row.receipt_no
      await ElMessageBox.confirm(`确认撤销 ${label} ${no} 的发送仓库操作？仅当仓库尚未处理时可用。`, '撤销发送', {
        confirmButtonText: '确认撤销',
        type: 'warning'
      })
      if (isReturn) {
        await cancelSendPurchaseReturn([bizId])
      } else {
        await cancelSendPurchaseInbound([bizId])
      }
      ElMessage.success('撤销发送成功')
      loadData()
      return
    }
    ElMessage.success('操作成功')
    loadData()
  } catch {}
}

/** 仓库退回弹窗确认回调 */
async function handleWarehouseReturnConfirm(payload: {
  items: Array<{ itemKey: string; return_qty: number; remark?: string }>
  remaining_qty_handle_mode: 0 | 1
  return_remark?: string
}) {
  const isReturn = returnDialog.bizType === 'return'
  const idField = isReturn ? 'purchase_return_item_id' : 'purchase_receipt_item_id'
  const apiItems = payload.items.map((it) => ({
    [idField]: it.itemKey,
    return_qty: it.return_qty,
    remark: it.remark
  }))
  try {
    if (isReturn) {
      await warehouseReturnPurchaseReturn(
        returnDialog.bizId,
        apiItems as any,
        payload.remaining_qty_handle_mode,
        payload.return_remark
      )
    } else {
      await warehouseReturnPurchaseInbound(
        returnDialog.bizId,
        apiItems as any,
        payload.remaining_qty_handle_mode,
        payload.return_remark
      )
    }
    ElMessage.success('仓库退回成功')
    loadData()
  } catch {
    ElMessage.error('仓库退回失败')
  }
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0)
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function getTagType(value: any, key?: string) {
  const str = String(value)
  if (key === 'warehouse_status') {
    if (str === '0') return 'info'
    if (str === '1' || str === '3') return 'success'
    if (str === '2') return 'warning'
  }
  if (['正常', '已审核', '已入库', '已出库', '已发货', '已发送', '1', '启用'].includes(str)) return 'success'
  if (['停用', '未审核', '未入库', '待入库', '未出库', '待出库', '未发货', '未发送', '0'].includes(str)) return 'info'
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
/* 操作列按钮垂直居中对齐：编辑/删除与“更多”下拉持平，间距统一 */
.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.row-actions :deep(.el-button) {
  margin-left: 0;          /* 覆盖 el-button 默认相邻 margin，改由 gap 统一控制 */
}
.row-actions :deep(.el-dropdown) {
  display: inline-flex;
  align-items: center;
}
.row-actions :deep(.el-dropdown + .el-button),
.row-actions :deep(.el-button + .el-dropdown) {
  margin-left: 0;
}
</style>
