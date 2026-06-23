<template>
  <ListTemplate
    title="库存查看"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="产品编码"><el-input v-model="searchForm.productCode" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品名称"><el-input v-model="searchForm.productName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="仓库">
          <el-input v-model="searchForm.warehouseId" placeholder="请输入" clearable style="width:120px" />
        </el-form-item>
        <el-form-item label="批次号"><el-input v-model="searchForm.batchNo" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button @click="handleExport"><el-icon><Download /></el-icon>批量导出</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" show-summary :summary-method="getSummaries">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="productCode" label="产品编码" min-width="100" />
        <el-table-column prop="productName" label="产品名称" min-width="130" show-overflow-tooltip />
        <el-table-column prop="productSpec" label="产品规格" min-width="100" show-overflow-tooltip />
        <el-table-column prop="productUnit" label="计量单位" width="80" />
        <el-table-column prop="categoryName" label="产品类别" min-width="80" />
        <el-table-column prop="warehouseName" label="仓库" min-width="120" />
        <el-table-column prop="locationName" label="库位" min-width="100" />
        <el-table-column prop="shelfName" label="货位" min-width="100" />
        <el-table-column prop="batchNo" label="批次号" min-width="100" />
        <el-table-column prop="quantity" label="总数量" width="80" align="center" />
        <el-table-column prop="frozenQuantity" label="冻结数量" width="80" align="center" />
        <el-table-column prop="availableQuantity" label="可用数量" width="80" align="center">
          <template #default="{ row }">
            <span :class="{ 'cell-warning': row.availableQuantity <= 10 }">{{ row.availableQuantity }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="costPrice" label="成本单价" width="80" align="center" />
        <el-table-column prop="totalCost" label="总成本" width="80" align="center" />
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getInventoryList, exportInventory, type InventoryItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'

const tableData = ref<InventoryItem[]>([])
const getSummaries = createAmountSummary(['totalCost'])
const searchForm = reactive({ productCode: '', productName: '', warehouseId: '', batchNo: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: InventoryItem[] = [
  { id: '1', productId: '1', productCode: 'P001', productName: '铰链A型', productSpec: '40x35mm', productUnit: '个', categoryId: '1', categoryName: '五金配件', warehouseId: '1', warehouseName: '深圳主仓库', locationId: '1', locationName: '深圳主仓库A区', shelfId: '1', shelfName: 'A区1层1列', batchNo: 'B001', quantity: 50, frozenQuantity: 10, availableQuantity: 40, costPrice: 12.5, totalCost: 625, createTime: '2024-03-01 09:00', updateTime: '2026-04-20 09:00' },
  { id: '2', productId: '2', productCode: 'P002', productName: '滑轨B型', productSpec: '300mm', productUnit: '套', categoryId: '1', categoryName: '五金配件', warehouseId: '1', warehouseName: '深圳主仓库', locationId: '1', locationName: '深圳主仓库A区', shelfId: '2', shelfName: 'A区1层2列', batchNo: 'B002', quantity: 30, frozenQuantity: 5, availableQuantity: 25, costPrice: 18.0, totalCost: 540, createTime: '2024-03-02 10:00', updateTime: '2026-04-20 10:00' },
  { id: '3', productId: '3', productCode: 'P003', productName: '把手C型', productSpec: '80mm', productUnit: '个', categoryId: '2', categoryName: '门控五金', warehouseId: '2', warehouseName: '广州副仓库', locationId: '2', locationName: '广州副仓库B区', shelfId: '3', shelfName: 'B区1层1列', batchNo: 'B003', quantity: 8, frozenQuantity: 0, availableQuantity: 8, costPrice: 22.0, totalCost: 176, createTime: '2024-03-05 11:00', updateTime: '2026-04-20 11:00' },
]

async function loadData() {
  try {
    const res = await getInventoryList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { productCode, productName, batchNo } = searchForm
    const filtered = fallbackData.filter(r => {
      if (productCode && !r.productCode.includes(productCode)) return false
      if (productName && !r.productName.includes(productName)) return false
      if (batchNo && !r.batchNo.includes(batchNo)) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { productCode: '', productName: '', warehouseId: '', batchNo: '' }); handleSearch() }

async function handleExport() {
  try {
    await exportInventory({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
    ElMessage.success('导出任务已提交')
  } catch { ElMessage.error('导出失败') }
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-warning { color: var(--el-color-warning); font-weight: 600; }
</style>