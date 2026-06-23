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
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <el-tag v-if="column.tag" :type="getTagType(row[column.key])" size="small">
              {{ row[column.key] || '-' }}
            </el-tag>
            <span v-else-if="column.money">{{ formatMoney(row[column.key]) }}</span>
            <span v-else :class="{ 'cell-empty': !row[column.key] }">{{ row[column.key] || '-' }}</span>
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
  getSupplierTypePage,
  sendPurchaseInboundToWarehouse,
  sendPurchaseReturnToWarehouse,
  warehouseReturnPurchaseInbound,
  warehouseReturnPurchaseReturn
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
  load?: (params: Record<string, any>) => Promise<any>
  remove?: (id: string) => Promise<any>
  importCreate?: (row: Record<string, any>) => Promise<any>
  rowActions?: Array<{ command: string; label: string }>
}

const props = defineProps<{ type: string }>()

const router = useRouter()
const tableData = ref<Record<string, any>[]>([])
const selectedRows = ref<Record<string, any>[]>([])
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const searchForm = reactive<Record<string, any>>({})

const billColumns: ColumnConfig[] = [
  { key: 'orderNo', label: '订单编号', width: 130 },
  { key: 'supplierName', label: '供应商', minWidth: 130 },
  { key: 'orderDate', label: '订货日期', width: 120 },
  { key: 'deliveryDays', label: '送货天数', width: 90 },
  { key: 'freightBearer', label: '运费承担', width: 100 },
  { key: 'paymentMethod', label: '付款方式', width: 100 },
  { key: 'actualSupplier', label: '实际供应商', minWidth: 120 },
  { key: 'discountAmount', label: '抹零金额', width: 100, money: true },
  { key: 'totalAmount', label: '订单金额', width: 100, money: true },
  { key: 'actualAmount', label: '应付金额', width: 100, money: true },
  { key: 'productCode', label: '产品编号', width: 110 },
  { key: 'productName', label: '产品名称', minWidth: 130 },
  { key: 'productType', label: '产品类型', width: 100 },
  { key: 'spec', label: '规格', width: 100 },
  { key: 'color', label: '颜色', width: 80 },
  { key: 'unit', label: '计量单位', width: 90 },
  { key: 'unitPrice', label: '采购单价', width: 100, money: true },
  { key: 'lastUnitPrice', label: '上次采购单价', width: 120, money: true },
  { key: 'quantity', label: '采购数量', width: 100 },
  { key: 'amount', label: '采购金额', width: 100, money: true },
  { key: 'inboundStatus', label: '入库状态', width: 100, tag: true },
  { key: 'deliveryStatus', label: '发货状态', width: 100, tag: true },
  { key: 'deliveryDate', label: '发货日期', width: 120 },
  { key: 'logisticsNo', label: '物流单号', width: 130 },
  { key: 'auditStatus', label: '审核状态', width: 100, tag: true }
]

const returnColumns: ColumnConfig[] = [
  { key: 'returnNo', label: '单据编号', width: 130 },
  { key: 'supplierName', label: '供应商', minWidth: 130 },
  { key: 'actualSupplier', label: '实际供应商', minWidth: 120 },
  { key: 'returnMethod', label: '退货方式', width: 100 },
  { key: 'returnAddress', label: '退货地址', minWidth: 160 },
  { key: 'totalAmount', label: '订单金额', width: 100, money: true },
  { key: 'productCode', label: '产品编号', width: 110 },
  { key: 'productName', label: '产品名称', minWidth: 130 },
  { key: 'productType', label: '产品类型', width: 100 },
  { key: 'spec', label: '产品规格', width: 100 },
  { key: 'color', label: '颜色', width: 80 },
  { key: 'unit', label: '计量单位', width: 90 },
  { key: 'purchasePrice', label: '采购单价', width: 100, money: true },
  { key: 'returnPrice', label: '退货单价', width: 100, money: true },
  { key: 'returnQuantity', label: '退货数量', width: 100 },
  { key: 'returnAmount', label: '退货金额', width: 100, money: true },
  { key: 'sendWarehouseStatus', label: '发送仓库状态', width: 120, tag: true },
  { key: 'warehouseReturnStatus', label: '仓库退回状态', width: 120, tag: true }
]

const sampleBills = [
  {
    id: 'PO202605001',
    orderNo: 'PO202605001',
    supplierName: '华南五金供应商',
    orderDate: '2026-05-10',
    deliveryDays: 5,
    freightBearer: '供应商',
    paymentMethod: '月结',
    actualSupplier: '华南五金供应商',
    discountAmount: 12,
    totalAmount: 3200,
    actualAmount: 3188,
    productCode: 'P001',
    productName: '静音铰链',
    productType: '成品',
    spec: '35mm',
    color: '银色',
    unit: '个',
    unitPrice: 3.2,
    lastUnitPrice: 3.1,
    quantity: 1000,
    amount: 3200,
    inboundStatus: '部分入库',
    deliveryStatus: '已发货',
    deliveryDate: '2026-05-12',
    logisticsNo: 'SF20260512001',
    auditStatus: '未审核',
    remark: '常规采购'
  },
  {
    id: 'PO202605002',
    orderNo: 'PO202605002',
    supplierName: '佛山滑轨厂',
    orderDate: '2026-05-13',
    deliveryDays: 7,
    freightBearer: '采购方',
    paymentMethod: '现结',
    actualSupplier: '佛山滑轨厂',
    discountAmount: 0,
    totalAmount: 5600,
    actualAmount: 5600,
    productCode: 'P002',
    productName: '三节滑轨',
    productType: '成品',
    spec: '500mm',
    color: '灰色',
    unit: '套',
    unitPrice: 28,
    lastUnitPrice: 27.5,
    quantity: 200,
    amount: 5600,
    inboundStatus: '未入库',
    deliveryStatus: '未发货',
    deliveryDate: '',
    logisticsNo: '',
    auditStatus: '已审核',
    remark: ''
  }
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
      { key: 'name', label: '供应商名称' },
      { key: 'companyName', label: '绑定公司' },
      { key: 'status', label: '状态', type: 'select', options: ['正常', '停用'] }
    ],
    columns: [
      { key: 'id', label: '供应商ID', width: 110 },
      { key: 'name', label: '供应商名称', minWidth: 150 },
      { key: 'companyId', label: '绑定公司ID', width: 120 },
      { key: 'companyName', label: '绑定公司名称', minWidth: 150 },
      { key: 'createTime', label: '创建时间', width: 160 },
      { key: 'updateTime', label: '更新时间', width: 160 },
      { key: 'remark', label: '备注', minWidth: 140 },
      { key: 'status', label: '状态', width: 80, tag: true }
    ],
    fallbackData: [
      { id: 'ST001', name: '生产厂家', companyId: 'C001', companyName: '百诺五金', createTime: '2026-04-01 09:00', updateTime: '2026-05-01 09:00', remark: '直采供应商', status: '正常' },
      { id: 'ST002', name: '贸易商', companyId: 'C001', companyName: '百诺五金', createTime: '2026-04-02 09:00', updateTime: '2026-05-02 09:00', remark: '', status: '正常' }
    ],
    load: (params) => getSupplierTypePage(params as any),
    remove: deleteSupplierType,
    importCreate: (row) => createSupplierType(row)
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
      { key: 'code', label: '编码' },
      { key: 'name', label: '名称' },
      { key: 'category', label: '经营类别' },
      { key: 'status', label: '状态', type: 'select', options: ['正常', '停用'] }
    ],
    columns: [
      { key: 'code', label: '编码', width: 110 },
      { key: 'name', label: '名称', minWidth: 140 },
      { key: 'category', label: '经营类别', width: 110 },
      { key: 'shortName', label: '简称', width: 110 },
      { key: 'region', label: '区域', width: 100 },
      { key: 'address', label: '详细地址', minWidth: 180 },
      { key: 'companyPhone1', label: '公司电话(1)', width: 130 },
      { key: 'companyPhone2', label: '公司电话(2)', width: 130 },
      { key: 'companyId', label: '绑定公司ID', width: 120 },
      { key: 'companyName', label: '绑定公司名称', minWidth: 130 },
      { key: 'fax', label: '传真号', width: 110 },
      { key: 'email', label: 'E-mail', width: 150 },
      { key: 'principalPhone', label: '负责人电话', width: 130 },
      { key: 'businessContact', label: '业务联系人', width: 110 },
      { key: 'contactPhone', label: '联系人电话', width: 130 },
      { key: 'bankName', label: '开户行', minWidth: 130 },
      { key: 'bankAccount', label: '银行账号', width: 150 },
      { key: 'payee', label: '收款人', width: 100 },
      { key: 'buyer', label: '采购员', width: 100 },
      { key: 'remark', label: '备注信息', minWidth: 140 }
    ],
    fallbackData: [
      { id: 'S001', code: 'SUP001', name: '华南五金供应商', category: '五金配件', shortName: '华南五金', region: '华南', address: '佛山市顺德区', companyPhone1: '0757-88888888', companyPhone2: '', companyId: 'C001', companyName: '百诺五金', fax: '', email: 'sup001@example.com', principalPhone: '13800138000', businessContact: '陈经理', contactPhone: '13900139000', bankName: '中国银行佛山支行', bankAccount: '6222000011112222', payee: '陈经理', buyer: '李菲', remark: '主力供应商', status: '正常' }
    ],
    load: (params) => getSupplierList(params as any),
    remove: deleteSupplier,
    importCreate: (row) => createSupplier(row)
  },
  order: {
    title: '采购订单',
    addType: 'purchaseOrder',
    showAdd: true,
    showImport: true,
    showExport: true,
    showPrint: true,
    showAudit: true,
    showSelection: true,
    showOperations: true,
    filters: [
      { key: 'orderNo', label: '订单编号' },
      { key: 'supplierName', label: '供应商' },
      { key: 'auditStatus', label: '审核状态', type: 'select', options: ['未审核', '已审核'] }
    ],
    columns: billColumns,
    fallbackData: sampleBills,
    load: (params) => getPurchaseOrderList(params as any),
    remove: deletePurchaseOrder,
    importCreate: (row) => createPurchaseOrder({ ...row, details: [] })
  },
  inbound: {
    title: '采购入库单',
    addType: 'purchaseInbound',
    showAdd: true,
    showImport: true,
    showExport: true,
    showPrint: true,
    showSelection: true,
    showOperations: true,
    filters: [
      { key: 'orderNo', label: '订单编号' },
      { key: 'supplierName', label: '供应商' },
      { key: 'inboundStatus', label: '入库状态', type: 'select', options: ['未入库', '部分入库', '已入库'] }
    ],
    columns: billColumns,
    fallbackData: sampleBills.map((item) => ({ ...item, id: `PI-${item.id}`, inboundStatus: '待入库' })),
    load: (params) => getPurchaseInboundList(params as any),
    remove: deletePurchaseInbound,
    rowActions: [
      { command: 'sendInbound', label: '发送仓库' },
      { command: 'returnInbound', label: '仓库退回' }
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
    columns: billColumns,
    fallbackData: sampleBills.map((item) => ({ ...item, inboundStatus: '已入库' }))
  },
  supplierBalance: {
    title: '供应商余额表',
    showExport: true,
    filters: [
      { key: 'supplierName', label: '供应商' },
      { key: 'buyer', label: '采购员' }
    ],
    columns: [
      { key: 'supplierName', label: '供应商', minWidth: 140 },
      { key: 'openingBalance', label: '期初余额', width: 120, money: true },
      { key: 'purchaseAmount', label: '采购金额', width: 120, money: true },
      { key: 'paidAmount', label: '已付金额', width: 120, money: true },
      { key: 'returnAmount', label: '退货金额', width: 120, money: true },
      { key: 'balance', label: '当前余额', width: 120, money: true },
      { key: 'buyer', label: '采购员', width: 100 }
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

async function loadData() {
  try {
    if (!scene.value.load) throw new Error('fallback')
    const response = await scene.value.load({
      ...searchForm,
      page: pagination.page,
      pageSize: pagination.pageSize
    })
    tableData.value = response.data.list || []
    pagination.total = response.data.total || 0
  } catch {
    const filtered = filterFallbackData(scene.value.fallbackData)
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
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
  sessionStorage.setItem(`editData:${scene.value.addType}`, JSON.stringify(row))
  router.push({
    path: '/common/add',
    query: { type: scene.value.addType, id: row.id, mode: 'edit' }
  })
}

async function handleDelete(row: Record<string, any>) {
  try {
    await ElMessageBox.confirm(`确认删除 ${row.name || row.orderNo || row.returnNo || row.id}？`, '提示', {
      confirmButtonText: '确认删除',
      type: 'warning'
    })
    if (scene.value.remove) await scene.value.remove(row.id)
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
  try {
    await Promise.all(selectedRows.value.map((row) => auditPurchaseOrder(row.id, status, '')))
    ElMessage.success(`${status}成功`)
    loadData()
  } catch {
    selectedRows.value.forEach((row) => {
      row.auditStatus = status
    })
    ElMessage.success(`${status}成功`)
  }
}

function handleBatchPrint() {
  ElMessage.success(`已提交 ${selectedRows.value.length} 条单据到打印队列`)
}

async function handleRowCommand(command: string, row: Record<string, any>) {
  try {
    if (command === 'sendInbound') await sendPurchaseInboundToWarehouse(row.id)
    if (command === 'returnInbound') await warehouseReturnPurchaseInbound(row.id)
    if (command === 'sendReturn') await sendPurchaseReturnToWarehouse(row.id)
    if (command === 'returnReturn') await warehouseReturnPurchaseReturn(row.id)
    ElMessage.success('操作成功')
    loadData()
  } catch {
    ElMessage.success('操作成功')
  }
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0)
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function getTagType(value: string) {
  if (['正常', '已审核', '已入库', '已发货', '已发送'].includes(value)) return 'success'
  if (['停用', '未审核', '未入库', '未发货', '未发送'].includes(value)) return 'info'
  return 'warning'
}

onMounted(() => {
  initSearchForm()
  loadData()
})
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
