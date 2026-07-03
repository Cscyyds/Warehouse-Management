<template>
  <ListTemplate
    title="库位库存表"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="仓库">
          <el-input v-model="searchForm.warehouseId" placeholder="请输入" clearable style="width:120px" />
        </el-form-item>
        <el-form-item label="库位"><el-input v-model="searchForm.locationId" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item label="产品名称"><el-input v-model="searchForm.productName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
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
      <el-table
        :data="tableData"
        stripe
        size="small"
        style="width:100%"
        class="warehouse-text-table"
        row-class-name="table-row"
        show-summary
        :summary-method="getSummaries"
      >
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="warehouseName" label="仓库" min-width="120" show-overflow-tooltip />
        <el-table-column prop="locationName" label="库位" min-width="120" show-overflow-tooltip />
        <el-table-column prop="shelfName" label="货位" min-width="100" show-overflow-tooltip />
        <el-table-column prop="productCode" label="产品编码" min-width="100" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品名称" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link class="cell-link" type="primary" @click="handleEdit(row)">
              <span class="cell-text" :class="{ 'cell-empty': !row.productName }">{{ row.productName || '-' }}</span>
            </el-link>
          </template>
        </el-table-column>
        <el-table-column prop="productSpec" label="产品规格" min-width="100" show-overflow-tooltip />
        <el-table-column prop="productUnit" label="计量单位" width="80" show-overflow-tooltip />
        <el-table-column prop="batchNo" label="批次号" min-width="100" show-overflow-tooltip />
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
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getInventoryList, exportInventory, type InventoryItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { createAmountSummary } from '@/composables/useTableSummary'

const router = useRouter()
const tableData = ref<InventoryItem[]>([])
const getSummaries = createAmountSummary(['totalCost'])
const searchForm = reactive({ warehouseId: '', locationId: '', productName: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

async function loadData() {
  try {
    const res = await getInventoryList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function handleEdit(row: InventoryItem) {
  sessionStorage.setItem('editData:productInfo', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'productInfo', id: row.productId, mode: 'edit' } })
}
function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { warehouseId: '', locationId: '', productName: '' }); handleSearch() }

async function handleExport() {
  try {
    await exportInventory({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
    ElMessage.success('导出任务已提交')
  } catch { ElMessage.error('导出失败') }
}

onMounted(() => { loadData() })
</script>

<style scoped>
.warehouse-text-table :deep(.el-table__cell .cell) {
  min-width: 0;
}

.cell-link {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;
}

.cell-link :deep(.el-link__inner) {
  display: inline-block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.cell-empty {
  color: var(--text-tertiary);
}

.cell-warning { color: var(--el-color-warning); font-weight: 600; }
</style>
