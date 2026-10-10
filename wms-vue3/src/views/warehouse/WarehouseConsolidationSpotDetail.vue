<template>
  <div class="spot-detail">
    <div class="detail-header">
      <div class="detail-header-left">
        <el-button @click="router.back()">返回</el-button>
        <span class="detail-title">集散位详情</span>
        <el-tag v-if="detail" :type="detail.status === 1 ? 'success' : 'info'" size="default">{{ detail.status === 1 ? '有效' : '无效' }}</el-tag>
      </div>
      <div v-if="detail" class="detail-header-actions">
        <el-button v-if="detail.barcode_url" @click="openBarcodeUrl">查看条码</el-button>
      </div>
    </div>

    <div v-loading="loading" element-loading-text="加载中...">
      <template v-if="detail">
        <!-- 档案卡 -->
        <el-card shadow="never" class="detail-card">
          <template #header><span>集散位档案</span></template>
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="集散位编号">{{ detail.spot_no }}</el-descriptions-item>
            <el-descriptions-item label="集散位名称">{{ detail.spot_name }}</el-descriptions-item>
            <el-descriptions-item label="简码">
              <span :class="{ 'cell-empty': !detail.simple_code }">{{ detail.simple_code || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="所属仓库">
              <span v-if="detail.warehouse && detail.warehouse.warehouse_no">
                {{ detail.warehouse.warehouse_no }}（{{ detail.warehouse.warehouse_name }}）
              </span>
              <span v-else class="cell-empty">-</span>
            </el-descriptions-item>
            <el-descriptions-item label="备注">
              <span :class="{ 'cell-empty': !detail.remark }">{{ detail.remark || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatTableDate(detail.created_at) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 在位统计 -->
        <div class="detail-stats">
          <div class="stat-card">
            <div class="stat-label">在位产品数</div>
            <div class="stat-value">{{ detail.products.length }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">库存合计</div>
            <div class="stat-value">{{ formatAmount(detail.products.reduce((s, p) => s + Number(p.stock_qty || 0), 0)) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">在位合包数</div>
            <div class="stat-value">{{ detail.products.reduce((s, p) => s + Number(p.package_count || 0), 0) }}</div>
          </div>
        </div>

        <!-- 在位产品清单（含合包明细展开） -->
        <el-card shadow="never" class="detail-card">
          <template #header><span>在位产品清单（集散位多位多品、只收合包）</span></template>
          <el-table :data="detail.products" border size="small" style="width:100%" empty-text="该集散位暂无在库合包">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="expand-packages">
                  <el-table :data="row.packages" border size="small" style="width:100%" empty-text="无在位合包明细">
                    <el-table-column type="index" label="" width="55" align="center" />
                    <el-table-column prop="barcode_code" label="合包条码编号" min-width="130" show-overflow-tooltip />
                    <el-table-column prop="merge_qty" label="合包数量" width="110" align="right">
                      <template #default="{ row: pkg }">{{ formatAmount(pkg.merge_qty) }}</template>
                    </el-table-column>
                    <el-table-column prop="warehouse_status" label="仓库状态" width="100" align="center">
                      <template #default="{ row: pkg }">
                        <el-tag size="small" type="success">在位</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column prop="created_at" label="入库时间" min-width="170" show-overflow-tooltip>
                      <template #default="{ row: pkg }">{{ formatTableDate(pkg.created_at) }}</template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
            </el-table-column>
            <el-table-column type="index" label="" width="55" align="center" />
            <el-table-column prop="product_code" label="产品编码" min-width="120" show-overflow-tooltip />
            <el-table-column prop="product_name" label="产品名称" min-width="140" show-overflow-tooltip />
            <el-table-column prop="specification" label="规格" min-width="100" show-overflow-tooltip>
              <template #default="{ row }"><span :class="{ 'cell-empty': !row.specification }">{{ row.specification || '-' }}</span></template>
            </el-table-column>
            <el-table-column prop="unit_name" label="单位" width="70" align="center">
              <template #default="{ row }"><span :class="{ 'cell-empty': !row.unit_name }">{{ row.unit_name || '-' }}</span></template>
            </el-table-column>
            <el-table-column prop="stock_qty" label="在库数量" width="110" align="right">
              <template #default="{ row }">{{ formatAmount(row.stock_qty) }}</template>
            </el-table-column>
            <el-table-column prop="package_count" label="在位合包数" width="100" align="right" />
          </el-table>
        </el-card>
      </template>
      <el-empty v-else-if="!loading" description="集散位不存在或已删除" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getConsolidationSpotDetail, type ConsolidationSpotDetail } from '@/api'
import { formatTableDate } from '@/utils/date'

const route = useRoute()
const router = useRouter()
const detail = ref<ConsolidationSpotDetail | null>(null)
const loading = ref(false)

function formatAmount(v: unknown): string {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'
}

async function loadDetail() {
  const id = String(route.query.id || '')
  if (!id) return
  loading.value = true
  try {
    const res = await getConsolidationSpotDetail(id)
    detail.value = res.data
  } catch {
    detail.value = null
  } finally {
    loading.value = false
  }
}

function openBarcodeUrl() {
  const url = detail.value?.barcode_url
  if (url) window.open(url, '_blank')
}

onMounted(() => { loadDetail() })
</script>

<style scoped>
.spot-detail {
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

.detail-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  background: var(--bg-white);
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.stat-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
}

.detail-card {
  margin-bottom: 16px;
}

.expand-packages {
  padding: 8px 16px;
  background: var(--bg-page);
}

.cell-empty { color: var(--text-tertiary); }
</style>
