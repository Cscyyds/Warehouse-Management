<template>
  <ListTemplate
    title="产品货架绑定"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleBind"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="产品编码"><el-input v-model="searchForm.productCode" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="产品名称"><el-input v-model="searchForm.productName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="仓库">
          <el-input v-model="searchForm.warehouseName" placeholder="请输入" clearable style="width:120px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button type="primary" @click="handleBind"><el-icon><Link /></el-icon>绑定</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column prop="productCode" label="产品编码" min-width="120" />
        <el-table-column prop="productName" label="产品名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="productSpec" label="产品规格" min-width="100" show-overflow-tooltip />
        <el-table-column prop="warehouseName" label="仓库" min-width="120" />
        <el-table-column prop="locationName" label="库位" min-width="120" />
        <el-table-column prop="shelfName" label="货位" min-width="120" />
        <el-table-column prop="boxCode" label="塑料盒" min-width="120" />
        <el-table-column prop="quantity" label="绑定数量" width="80" align="center" />
        <el-table-column prop="bindStatus" label="绑定状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.bindStatus === '已绑定' ? 'success' : 'warning'" size="small">{{ row.bindStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="bindTime" label="绑定时间" width="160" />
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleUnbind(row)">解绑</el-button>
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
import { Link } from '@element-plus/icons-vue'
import ListTemplate from '@/views/common/ListTemplate.vue'

interface ShelfBindItem {
  id: string
  productCode: string
  productName: string
  productSpec: string
  warehouseId: string
  warehouseName: string
  locationId: string
  locationName: string
  shelfId: string
  shelfName: string
  boxId: string
  boxCode: string
  quantity: number
  bindStatus: string
  bindTime: string
}

const router = useRouter()
const tableData = ref<ShelfBindItem[]>([])
const searchForm = reactive({ productCode: '', productName: '', warehouseName: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: ShelfBindItem[] = [
  { id: '1', productCode: 'P001', productName: '铰链A型', productSpec: '40x35mm', warehouseId: '1', warehouseName: '深圳主仓库', locationId: '1', locationName: '深圳主仓库A区', shelfId: '1', shelfName: 'A区1层1列', boxId: '1', boxCode: 'BOX-SZ-001-001', quantity: 50, bindStatus: '已绑定', bindTime: '2024-03-01 09:00' },
  { id: '2', productCode: 'P002', productName: '滑轨B型', productSpec: '300mm', warehouseId: '1', warehouseName: '深圳主仓库', locationId: '1', locationName: '深圳主仓库A区', shelfId: '2', shelfName: 'A区1层2列', boxId: '2', boxCode: 'BOX-SZ-001-002', quantity: 30, bindStatus: '已绑定', bindTime: '2024-03-05 10:00' },
  { id: '3', productCode: 'P003', productName: '把手C型', productSpec: '80mm', warehouseId: '2', warehouseName: '广州副仓库', locationId: '2', locationName: '广州副仓库B区', shelfId: '3', shelfName: 'B区1层1列', boxId: '3', boxCode: 'BOX-GZ-002-001', quantity: 0, bindStatus: '待绑定', bindTime: '' },
]

async function loadData() {
  try {
    // TODO: replace with actual API call when backend is ready
    const filtered = fallbackData.filter(r => {
      if (searchForm.productCode && !r.productCode.includes(searchForm.productCode)) return false
      if (searchForm.productName && !r.productName.includes(searchForm.productName)) return false
      if (searchForm.warehouseName && !r.warehouseName.includes(searchForm.warehouseName)) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  } catch {}
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { productCode: '', productName: '', warehouseName: '' }); handleSearch() }
function handleBind() { router.push({ path: '/common/add', query: { type: 'warehouseShelfBind' } }) }
function handleEdit(row: ShelfBindItem) {
  sessionStorage.setItem('editData:warehouseShelfBind', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'warehouseShelfBind', id: row.id, mode: 'edit' } })
}

async function handleUnbind(row: ShelfBindItem) {
  try {
    await ElMessageBox.confirm(`确认解绑产品「${row.productName}」与货位「${row.shelfName}」的绑定？`, '提示', { confirmButtonText: '确认解绑', type: 'warning' })
    ElMessage.success('解绑成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>