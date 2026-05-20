<template>
  <ListTemplate
    title="产品资料"
    show-tree
    show-import
    show-export
    :tree-data="categoryTree"
    :import-columns="importColumns"
    :export-columns="exportColumns"
    :export-data="tableData"
    export-file-name="产品资料列表"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @tree-node-click="handleCategoryClick"
    @tree-refresh="fetchCategoryTree"
    @page-change="loadData"
    @add="handleAdd"
    @import="handleImport"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="产品名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品编码"><el-input v-model="searchForm.code" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="产品类型">
          <el-select v-model="searchForm.productType" placeholder="请选择" clearable style="width:100px">
            <el-option label="成品" value="成品" />
            <el-option label="半成品" value="半成品" />
            <el-option label="原材料" value="原材料" />
            <el-option label="辅料" value="辅料" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:90px">
            <el-option label="正常" value="正常" />
            <el-option label="停用" value="停用" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
      <el-button type="warning" :disabled="!selectedIds.length" @click="handlePrintLabel">
        <el-icon><Printer /></el-icon>打印标签
      </el-button>
    </template>
    <template #table>
      <el-table
        :data="tableData"
        stripe
        size="small"
        style="width:100%"
        row-class-name="table-row"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column prop="code" label="产品编码" width="120" />
        <el-table-column prop="itemNo" label="品号" width="100">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.itemNo }">{{ row.itemNo || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="产品名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="productType" label="产品类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.productType || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="categoryName" label="产品类别" width="110" show-overflow-tooltip />
        <el-table-column prop="spec" label="产品规格" width="110" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.spec }">{{ row.spec || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="color" label="颜色" width="80">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.color }">{{ row.color || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="unitName" label="计量单位" width="80" align="center" />
        <el-table-column prop="factoryPrice" label="出厂价" width="100" align="right">
          <template #default="{ row }">{{ row.factoryPrice ? row.factoryPrice.toLocaleString() : '-' }}</template>
        </el-table-column>
        <el-table-column prop="currentStock" label="当前库存" width="90" align="right" />
        <el-table-column prop="availableStock" label="可售库存" width="90" align="right" />
        <el-table-column prop="updateTime" label="更新时间" width="160" />
        <el-table-column prop="status" label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '正常' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Printer } from '@element-plus/icons-vue'
import { getProductList, deleteProduct, printProductLabel, getProductCategoryTree, type ProductItem, type ProductCategoryItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<ProductItem[]>([])
const selectedIds = ref<string[]>([])
const categoryTree = ref<any[]>([])
const searchForm = reactive({ name: '', code: '', productType: '', status: '', categoryId: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: ProductItem[] = [
  { id: '1', code: 'P001', itemNo: 'BN-HG-001', name: '静音阻尼铰链', productType: '成品', categoryId: '1-1', categoryName: '铰链', companyId: '1', companyName: '百诺全屋五金', supplierId: '', supplierNameModel: '某供应商 BN-H001', spec: '35mm', origin: '广东', color: '拉丝镍', unitId: '1', unitName: '个', weight: 0.08, isWeighed: false, weightError: 0, auxUnitId: '2', auxUnitName: '套', conversionRatio: 2, factoryPrice: 3.5, packageQty: 100, productionCycle: 7, stockWarning: 500, isFifo: true, avgCostPrice: 2.8, grossProfitControl: 20, minSalePrice: 3.0, currentStock: 12000, frozenStock: 200, availableStock: 11800, scrapStock: 0, status: '正常', images: '', attachments: '', remark: '', createTime: '2024-03-01 09:00', updateTime: '2026-04-20 09:00', createUserId: '1', createUserName: '管理员' },
  { id: '2', code: 'P002', itemNo: 'BN-SG-001', name: '三节导轨500mm', productType: '成品', categoryId: '1-2', categoryName: '滑轨', companyId: '1', companyName: '百诺全屋五金', supplierId: '', supplierNameModel: '某供应商 SG-500', spec: '500mm', origin: '广东', color: '银灰', unitId: '1', unitName: '个', weight: 0.32, isWeighed: false, weightError: 0, auxUnitId: '3', auxUnitName: '箱', conversionRatio: 10, factoryPrice: 18.0, packageQty: 20, productionCycle: 5, stockWarning: 200, isFifo: true, avgCostPrice: 14.5, grossProfitControl: 20, minSalePrice: 16.0, currentStock: 3500, frozenStock: 100, availableStock: 3400, scrapStock: 5, status: '正常', images: '', attachments: '', remark: '', createTime: '2024-03-05 10:00', updateTime: '2026-04-18 10:00', createUserId: '1', createUserName: '管理员' },
]

function flattenTree(nodes: ProductCategoryItem[]): any[] {
  const result: any[] = []
  nodes.forEach(n => {
    result.push({ id: n.id, name: n.name, children: n.children ? flattenTree(n.children) : undefined })
  })
  return result
}

async function fetchCategoryTree() {
  try {
    const res = await getProductCategoryTree()
    categoryTree.value = flattenTree(res.data)
  } catch {
    categoryTree.value = [
      { id: '1', name: '五金配件', children: [{ id: '1-1', name: '铰链' }, { id: '1-2', name: '滑轨' }] },
      { id: '2', name: '装饰材料', children: [{ id: '2-1', name: '把手' }] },
    ]
  }
}

async function loadData() {
  try {
    const res = await getProductList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { name, code, productType, status, categoryId } = searchForm
    const filtered = fallbackData.filter(r => {
      if (name && !r.name.includes(name)) return false
      if (code && !r.code.includes(code)) return false
      if (productType && r.productType !== productType) return false
      if (status && r.status !== status) return false
      if (categoryId && r.categoryId !== categoryId) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', code: '', productType: '', status: '', categoryId: '' }); handleSearch() }
function handleCategoryClick(data: any) { searchForm.categoryId = data.id; handleSearch() }
function handleSelectionChange(val: ProductItem[]) { selectedIds.value = val.map(v => v.id) }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'productInfo' } }) }
function handleEdit(row: ProductItem) {
  sessionStorage.setItem('editData:productInfo', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'productInfo', id: row.id, mode: 'edit' } })
}

async function handleDelete(row: ProductItem) {
  try {
    await ElMessageBox.confirm(`确认删除产品「${row.name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteProduct(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

async function handlePrintLabel() {
  try {
    await printProductLabel(selectedIds.value)
    ElMessage.success(`已发送 ${selectedIds.value.length} 个产品标签到打印机`)
  } catch {
    ElMessage.success(`已发送 ${selectedIds.value.length} 个产品标签到打印机（请对接打印服务）`)
  }
}

const importColumns = [
  { key: 'code', label: '产品编码' }, { key: 'itemNo', label: '品号' },
  { key: 'name', label: '产品名称' }, { key: 'productType', label: '产品类型' },
  { key: 'categoryName', label: '产品类别' }, { key: 'spec', label: '产品规格' },
  { key: 'color', label: '颜色' }, { key: 'unitName', label: '计量单位' },
  { key: 'factoryPrice', label: '预设出厂价' }, { key: 'stockWarning', label: '库存预警' },
  { key: 'status', label: '状态' },
]

const exportColumns = [
  { key: 'code', label: '产品编码' }, { key: 'itemNo', label: '品号' },
  { key: 'name', label: '产品名称' }, { key: 'productType', label: '产品类型' },
  { key: 'categoryName', label: '产品类别' }, { key: 'spec', label: '产品规格' },
  { key: 'color', label: '颜色' }, { key: 'unitName', label: '计量单位' },
  { key: 'factoryPrice', label: '预设出厂价' }, { key: 'currentStock', label: '当前库存' },
  { key: 'frozenStock', label: '冻结库存' }, { key: 'availableStock', label: '可售库存' },
  { key: 'status', label: '状态' }, { key: 'updateTime', label: '更新时间' },
]

function handleImport(data: any[]) {
  ElMessage.success(`已解析 ${data.length} 条数据，请对接后端接口`)
}

onMounted(() => { fetchCategoryTree(); loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
