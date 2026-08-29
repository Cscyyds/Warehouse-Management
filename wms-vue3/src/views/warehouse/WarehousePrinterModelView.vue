## 打印机型号查看（只读，型号与标签规格由平台管理员维护）
<template>
  <ListTemplate
    title="打印机型号"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :loading="loading"
    :show-add="false"
    @page-change="loadData"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="型号名称"><el-input v-model="searchForm.model_name" placeholder="请输入" clearable style="width:160px" /></el-form-item>
        <el-form-item label="品牌"><el-input v-model="searchForm.brand" placeholder="请输入" clearable style="width:120px" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button @click="loadData"><el-icon><Refresh /></el-icon>刷新</el-button>
    </template>
    <template #table>
      <el-table border :data="pagedData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="model_name" label="型号名称" min-width="180">
          <template #default="{ row }">
            <span class="cell-link" @click="handleViewDetail(row)">{{ row.model_name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="brand" label="品牌" width="90" show-overflow-tooltip />
        <el-table-column label="打印模式" min-width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ joinList(row.supported_print_modes) }}</template>
        </el-table-column>
        <el-table-column label="纸张类型" min-width="190" show-overflow-tooltip>
          <template #default="{ row }">{{ joinList(row.supported_label_types) }}</template>
        </el-table-column>
        <el-table-column label="连接方式" min-width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ joinList(row.connection_types) }}</template>
        </el-table-column>
        <el-table-column label="浓度范围" width="150" align="center">
          <template #default="{ row }">{{ row.density_min }} ~ {{ row.density_max }}（默认 {{ row.density_default }}）</template>
        </el-table-column>
        <el-table-column prop="dpi" label="分辨率(DPI)" width="105" align="center" />
        <el-table-column label="预览能力" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.has_preview_capability === 1 ? 'success' : 'info'" size="small">
              {{ row.has_preview_capability === 1 ? '支持' : '不支持' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="标签规格数" width="100" align="center">
          <template #default="{ row }">{{ row.label_spec_count ?? 0 }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleViewDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>

  <el-drawer v-model="detailVisible" title="打印机型号详情" size="640px">
    <div v-loading="detailLoading" class="detail-body">
      <template v-if="detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="型号名称">{{ detail.model_name }}</el-descriptions-item>
          <el-descriptions-item label="品牌">{{ detail.brand }}</el-descriptions-item>
          <el-descriptions-item label="支持的打印模式">{{ joinList(detail.supported_print_modes) }}</el-descriptions-item>
          <el-descriptions-item label="支持的纸张类型">{{ joinList(detail.supported_label_types) }}</el-descriptions-item>
          <el-descriptions-item label="支持的连接方式">{{ joinList(detail.connection_types) }}</el-descriptions-item>
          <el-descriptions-item label="打印分辨率(DPI)">{{ detail.dpi }}</el-descriptions-item>
          <el-descriptions-item label="浓度最小值">{{ detail.density_min }}</el-descriptions-item>
          <el-descriptions-item label="浓度最大值">{{ detail.density_max }}</el-descriptions-item>
          <el-descriptions-item label="默认浓度值">{{ detail.density_default }}</el-descriptions-item>
          <el-descriptions-item label="是否具备预览能力">{{ detail.has_preview_capability === 1 ? '支持' : '不支持' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 class="spec-title">可用标签规格（{{ (detail.label_specs || []).length }}）</h4>
        <el-table border :data="detail.label_specs || []" stripe size="small" style="width:100%" empty-text="该型号暂无可用标签规格">
          <el-table-column prop="spec_name" label="规格名称" min-width="140" />
          <el-table-column prop="width_mm" label="标签宽度(mm)" width="120" align="center" />
          <el-table-column prop="height_mm" label="标签高度(mm)" width="120" align="center" />
          <el-table-column label="是否默认规格" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="row.is_default === 1 ? 'success' : 'info'" size="small">{{ row.is_default === 1 ? '是' : '否' }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { getVisiblePrinterList, getVisiblePrinterDetail, type PrinterModelItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const allData = ref<PrinterModelItem[]>([])
const searchForm = reactive({ model_name: '', brand: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const loading = ref(false)
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<PrinterModelItem | null>(null)

/** JSON 数组字段转顿号分隔的中文展示 */
function joinList(value: unknown): string {
  if (Array.isArray(value) && value.length > 0) return value.join('、')
  return '-'
}

// 后端一次性返回全部启用型号且无 search 接口，筛选与分页在前端完成
const filteredData = computed(() => {
  const name = searchForm.model_name.trim()
  const brand = searchForm.brand.trim()
  return allData.value.filter(item =>
    (!name || item.model_name.includes(name)) && (!brand || item.brand.includes(brand)),
  )
})

const pagedData = computed(() => {
  const start = (pagination.page - 1) * pagination.pageSize
  return filteredData.value.slice(start, start + pagination.pageSize)
})

async function loadData() {
  loading.value = true
  try {
    const res = await getVisiblePrinterList()
    allData.value = res.data.printers || []
    pagination.total = filteredData.value.length
  } catch {
    allData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  pagination.total = filteredData.value.length
}

function handleReset() {
  Object.assign(searchForm, { model_name: '', brand: '' })
  handleSearch()
}

async function handleViewDetail(row: PrinterModelItem) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await getVisiblePrinterDetail(row.model_code)
    detail.value = res.data
  } catch {
    detailVisible.value = false
    ElMessage.error('打印机型号详情加载失败')
  } finally {
    detailLoading.value = false
  }
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
.detail-body { padding-right: 4px; }
.spec-title { margin: 20px 0 10px; font-size: 14px; font-weight: 600; }
</style>
