<template>
  <ListTemplate
    title="库存盘点"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="盘点单号"><el-input v-model="searchForm.checkNo" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="仓库">
          <el-input v-model="searchForm.warehouseId" placeholder="请输入" clearable style="width:120px" />
        </el-form-item>
        <el-form-item label="盘点类型">
          <el-select v-model="searchForm.checkType" placeholder="请选择" clearable style="width:100px">
            <el-option label="全仓盘点" value="全仓盘点" />
            <el-option label="部分盘点" value="部分盘点" />
            <el-option label="动态盘点" value="动态盘点" />
          </el-select>
        </el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="searchForm.auditStatus" placeholder="请选择" clearable style="width:100px">
            <el-option label="待审核" value="待审核" />
            <el-option label="审核通过" value="审核通过" />
            <el-option label="审核驳回" value="审核驳回" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="checkNo" label="盘点单号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="warehouseName" label="仓库" min-width="120" />
        <el-table-column prop="checkDate" label="盘点日期" width="110">
          <template #default="{ row }">{{ formatTableDate(row.checkDate) }}</template>
        </el-table-column>
        <el-table-column prop="checkType" label="盘点类型" min-width="80" align="center" />
        <el-table-column prop="totalCheck" label="总盘点数" width="80" align="center" />
        <el-table-column prop="matchCount" label="匹配数" width="70" align="center" />
        <el-table-column prop="mismatchCount" label="不匹配数" width="80" align="center">
          <template #default="{ row }">
            <span :class="{ 'cell-danger': row.mismatchCount > 0 }">{{ row.mismatchCount }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '已完成' ? 'success' : row.status === '进行中' ? 'warning' : 'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="auditStatus" label="审核状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.auditStatus === '审核通过' ? 'success' : row.auditStatus === '审核驳回' ? 'danger' : 'warning'" size="small">{{ row.auditStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createUserName" label="创建人" width="80" />
        <el-table-column prop="createTime" label="创建时间" width="160">
          <template #default="{ row }">{{ formatTableDate(row.createTime) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleView(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { getInventoryCheckList, type InventoryCheckItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { formatTableDate } from '@/utils/date'

const tableData = ref<InventoryCheckItem[]>([])
const searchForm = reactive({ checkNo: '', warehouseId: '', checkType: '', auditStatus: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

async function loadData() {
  try {
    const res = await getInventoryCheckList({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { checkNo: '', warehouseId: '', checkType: '', auditStatus: '' }); handleSearch() }
function handleView(row: InventoryCheckItem) {
  // TODO: navigate to check detail view when available
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
.cell-danger { color: var(--el-color-danger); font-weight: 600; }
</style>
