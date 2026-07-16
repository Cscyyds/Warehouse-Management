<template>
  <ListTemplate
    title="产品货架绑定"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
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
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="productCode" label="产品编码" min-width="120" />
        <el-table-column prop="productName" label="产品名称" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" @click="handleEdit(row)">{{ row.productName }}</el-link>
          </template>
        </el-table-column>
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
        <el-table-column prop="bindTime" label="绑定时间" width="160">
          <template #default="{ row }">{{ formatTableDate(row.bindTime) }}</template>
        </el-table-column>
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
import { formatTableDate } from '@/utils/date'

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
const loading = ref(false)

async function loadData() {
  loading.value = true
  try {
    tableData.value = []
    pagination.total = 0
  } catch {} finally {
    loading.value = false
  }
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
