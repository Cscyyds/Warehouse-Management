<template>
  <div class="stock-detail">
    <div class="detail-header">
      <div class="detail-header-left">
        <el-button @click="router.back()">返回</el-button>
        <span class="detail-title">库存明细</span>
        <el-tag v-if="route.query.code" size="default" type="info">{{ route.query.code }}</el-tag>
        <span class="detail-product-name">{{ route.query.name || detail?.product_name || '' }}</span>
      </div>
    </div>

    <div v-loading="loading" element-loading-text="加载中...">
      <template v-if="detail">
        <!-- 三类合计统计卡 -->
        <div class="detail-stats">
          <div class="stat-card">
            <div class="stat-label">散件合计</div>
            <div class="stat-value">{{ formatAmount(detail.loose_total_qty) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">塑料盒合计</div>
            <div class="stat-value">{{ formatAmount(detail.plastic_box_total_qty) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">合包合计</div>
            <div class="stat-value">{{ formatAmount(detail.merge_package_total_qty) }}</div>
          </div>
        </div>

        <!-- 全条码货位明细 -->
        <el-card shadow="never" class="detail-card">
          <template #header><span>条码货位明细</span></template>
          <el-table :data="detailRows" border size="small" max-height="560" style="width:100%" empty-text="暂无明细数据">
            <el-table-column type="index" label="" width="55" align="center" />
            <el-table-column prop="barcode_type_label" label="条码类型" width="100" show-overflow-tooltip />
            <el-table-column prop="barcode_code" label="条码编码" min-width="120" show-overflow-tooltip />
            <el-table-column prop="barcode_name" label="条码名称" min-width="110" show-overflow-tooltip>
              <template #default="{ row }"><span :class="{ 'cell-empty': !row.barcode_name }">{{ row.barcode_name || '-' }}</span></template>
            </el-table-column>
            <el-table-column prop="warehouse_name" label="仓库" min-width="110" show-overflow-tooltip />
            <el-table-column prop="location_no" label="货位编号" min-width="100" show-overflow-tooltip />
            <el-table-column prop="location_name" label="货位名称" min-width="120" show-overflow-tooltip />
            <el-table-column prop="floor_no" label="楼层" width="64" align="center" show-overflow-tooltip />
            <el-table-column prop="position_no" label="货位序号" width="110" align="center" show-overflow-tooltip />
            <el-table-column prop="position_code" label="位置编码" min-width="120" show-overflow-tooltip />
            <el-table-column prop="stock_qty" label="数量" width="100" align="right" show-overflow-tooltip>
              <template #default="{ row }"><span :class="{ 'cell-empty': !row.stock_qty && row.stock_qty !== 0 }">{{ formatAmount(row.stock_qty) }}</span></template>
            </el-table-column>
          </el-table>
        </el-card>
      </template>
      <el-empty v-else-if="!loading" description="暂无明细数据" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getProductInventoryDetail, type ProductInventoryDetail } from '@/api'

const route = useRoute()
const router = useRouter()

const detail = ref<ProductInventoryDetail | null>(null)
const loading = ref(false)

/** 展开条码 → 货位明细行；无货位的游离条码也展示一条 */
const detailRows = computed(() => {
  if (!detail.value) return []
  const rows: Record<string, unknown>[] = []
  detail.value.barcodes.forEach((b) => {
    if (b.positions && b.positions.length) {
      b.positions.forEach((p) => {
        rows.push({
          barcode_type_label: b.barcode_type_label,
          barcode_code: b.barcode_code,
          barcode_name: b.barcode_name || '',
          warehouse_name: p.warehouse_name,
          location_no: p.location_no,
          location_name: p.location_name,
          floor_no: p.floor_no,
          position_no: p.position_no,
          position_code: p.position_code,
          stock_qty: p.stock_qty,
        })
      })
    } else {
      rows.push({
        barcode_type_label: b.barcode_type_label,
        barcode_code: b.barcode_code,
        barcode_name: b.barcode_name || '',
        warehouse_name: '',
        location_no: '',
        location_name: '无货位（游离）',
        floor_no: '',
        position_no: '',
        position_code: '',
        stock_qty: '',
      })
    }
  })
  return rows
})

/** 金额/数量格式化：保留2位小数，千分位 */
function formatAmount(value: unknown): string {
  const num = Number(value)
  if (!value && value !== 0) return '-'
  if (Number.isNaN(num)) return '-'
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function loadDetail() {
  const productId = (route.query.productId as string) || (route.params.productId as string)
  if (!productId) {
    ElMessage.error('缺少产品ID')
    return
  }
  loading.value = true
  detail.value = null
  try {
    const res = await getProductInventoryDetail(productId)
    detail.value = res.data
  } catch {
    ElMessage.error('库存明细加载失败')
    detail.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadDetail() })
</script>

<style scoped>
.stock-detail {
  padding: 16px;
  background: var(--bg-page);
  min-height: 100%;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.detail-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.detail-product-name {
  font-size: 14px;
  color: var(--text-secondary);
}

.detail-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  background: var(--bg-page);
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.detail-card {
  border-radius: 12px;
}

.cell-empty {
  color: var(--text-tertiary);
}
</style>
