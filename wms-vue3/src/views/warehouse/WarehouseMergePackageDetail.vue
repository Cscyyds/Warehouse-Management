<template>
  <div v-loading="loading" class="merge-package-detail">
    <div class="page-header">
      <el-button link type="primary" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>返回
      </el-button>
      <h3 class="page-title">合包详情</h3>
      <span v-if="barcodeCode" class="page-bill-no">{{ barcodeCode }}</span>
      <div class="detail-actions">
        <!-- 扫码枪域端点暂未在网站权限字典登记（后端双注册 SQL 落地前不加 v-perm） -->
        <el-button
          type="primary"
          :disabled="!detail && !listItem"
          @click="printOpen = true"
        >
          <el-icon><Printer /></el-icon>补打
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="loadError"
      :title="loadError"
      type="error"
      :closable="false"
      show-icon
      class="section-card"
    />

    <!-- 基本信息：详情接口为主，缺失时由列表行数据补齐 -->
    <el-card v-if="detail || listItem" shadow="never" class="section-card">
      <template #header>基本信息</template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="合包条码">{{ barcodeCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="产品编码">{{ field('product_code') || '-' }}</el-descriptions-item>
        <el-descriptions-item label="产品名称">{{ field('product_name') || '-' }}</el-descriptions-item>
        <el-descriptions-item label="品号">{{ productItemNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="规格">{{ specification || '-' }}</el-descriptions-item>
        <el-descriptions-item label="颜色">{{ color || '-' }}</el-descriptions-item>
        <el-descriptions-item label="单位">{{ unitName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="合包数量">
          <span class="num-cell">{{ formatQty(mergeQty) }}{{ unitName ? ` ${unitName}` : '' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="合包ID"><span class="id-mono">{{ mergePackageId }}</span></el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 状态与打印：仓库状态/条码有效性来自详情，打印统计来自列表行 -->
    <el-card v-if="detail || listItem" shadow="never" class="section-card">
      <template #header>状态与打印</template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="仓库状态">
          <el-tag :type="warehouseStatusTagType" size="small">{{ warehouseStatusText }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="条码状态">
          <el-tag :type="detail?.barcode_status === 'INVALID' || listItem?.barcode_status === 'INVALID' ? 'danger' : 'success'" size="small">
            {{ isBarcodeInvalid ? '已失效' : '有效' }}
          </el-tag>
          <span v-if="invalidReason" class="invalid-reason">（{{ invalidReason }}）</span>
        </el-descriptions-item>
        <el-descriptions-item label="已打印次数">
          <span class="num-cell">{{ listItem ? formatQty(listItem.printed_qty) : '-' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="最近打印时间">{{ formatDateTime(listItem?.print_time) }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(detail?.created_at || listItem?.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="创建人">{{ detail?.created_by_name || listItem?.created_by_name || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 当前位置：详情接口独有（货位-层-位-塑料盒），未入库/未绑定时后端返回 null -->
    <el-card v-if="detail" shadow="never" class="section-card">
      <template #header>当前位置</template>
      <template v-if="position">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="位置编码">{{ position.position_code || '-' }}</el-descriptions-item>
          <el-descriptions-item label="货位">
            {{ [position.location_no, position.location_name].filter(Boolean).join(' ') || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="层/位">{{ position.floor_no }} 层 / {{ position.position_no }} 位</el-descriptions-item>
          <el-descriptions-item label="绑定塑料盒" :span="3">
            <template v-if="position.is_bound_plastic_box && position.bound_plastic_box_info">
              {{ [position.bound_plastic_box_info.box_code, position.bound_plastic_box_info.box_name].filter(Boolean).join(' ') }}
            </template>
            <span v-else class="text-tertiary">未绑定</span>
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <el-alert
        v-else
        title="该合包当前未绑定库位（未入库或已出库后解除绑定）"
        type="info"
        :closable="false"
      />
    </el-card>

    <!-- 来源 -->
    <el-card v-if="detail || listItem" shadow="never" class="section-card">
      <template #header>来源</template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="来源类型">{{ sourceTypeText }}</el-descriptions-item>
        <el-descriptions-item label="来源名称" :span="2">{{ sourceName || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 入库/出库追溯：仅列表行携带（详情接口无这些字段） -->
    <el-card v-if="listItem" shadow="never" class="section-card">
      <template #header>入库追溯</template>
      <el-descriptions v-if="hasInboundTrace" :column="3" border>
        <el-descriptions-item label="入库类型">{{ inboundTypeText }}</el-descriptions-item>
        <el-descriptions-item label="入库单号">{{ listItem.inbound_doc_no || '-' }}</el-descriptions-item>
        <el-descriptions-item label="明细编号">{{ listItem.inbound_item_no || '-' }}</el-descriptions-item>
        <el-descriptions-item label="关联订单号">{{ listItem.inbound_order_no || '-' }}</el-descriptions-item>
        <el-descriptions-item label="往来单位" :span="2">{{ listItem.inbound_partner_name || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-alert v-else title="无入库单据绑定（由合包操作创建）" type="info" :closable="false" />
    </el-card>

    <el-card v-if="listItem" shadow="never" class="section-card">
      <template #header>出库追溯</template>
      <el-descriptions v-if="hasOutboundTrace" :column="3" border>
        <el-descriptions-item label="出库类型">{{ outboundTypeText }}</el-descriptions-item>
        <el-descriptions-item label="出库单号">{{ listItem.outbound_doc_no || '-' }}</el-descriptions-item>
        <el-descriptions-item label="明细编号">{{ listItem.outbound_item_no || '-' }}</el-descriptions-item>
        <el-descriptions-item label="往来单位" :span="3">{{ listItem.outbound_partner_name || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-alert v-else title="尚未出库" type="info" :closable="false" />
    </el-card>

    <!-- 补打：单条直打（预览/打印） -->
    <PrintLabelDialog v-model="printOpen" kind="mergePackage" :rows="printRows" @printed="loadDetail" />
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Printer } from '@element-plus/icons-vue'
import PrintLabelDialog from '@/components/PrintLabelDialog.vue'
import {
  MERGE_INBOUND_TYPE_TEXT,
  MERGE_OUTBOUND_TYPE_TEXT,
  MERGE_SOURCE_TYPE_TEXT,
  MERGE_WAREHOUSE_STATUS_TEXT,
  getMergePackageDetail,
  searchMergePackages,
  type MergePackageDetailResponse,
  type MergePackageListItem,
} from '@/api/modules/scannerMergePackage'

const route = useRoute()
const router = useRouter()

const mergePackageId = computed(() => String(route.params.mergePackageId || ''))

const loading = ref(false)
const loadError = ref('')
const detail = ref<MergePackageDetailResponse | null>(null)
/** 列表行数据（由 search 接口按业务ID精确取回）：补打印统计与出入库追溯，
 *  弥补详情接口字段较薄的问题；后端补齐详情字段后可去掉。 */
const listItem = ref<MergePackageListItem | null>(null)

/* —— 字段取值：详情优先、列表行兜底 —— */

function field(key: 'product_code' | 'product_name'): string {
  return (detail.value?.[key] || listItem.value?.[key] || '') as string
}

const barcodeCode = computed(() => detail.value?.barcode_code || listItem.value?.barcode_code || '')
const productItemNo = computed(() => detail.value?.product_item_no || listItem.value?.product_item_no || '')
const specification = computed(() => detail.value?.specification || listItem.value?.product_specification || '')
const color = computed(() => detail.value?.color || listItem.value?.product_color || '')
const unitName = computed(() => detail.value?.unit_name || listItem.value?.unit_name || '')
const mergeQty = computed(() => detail.value?.merge_qty ?? listItem.value?.merge_qty ?? null)

const position = computed(() => detail.value?.current_position_info || null)

const warehouseStatus = computed(() => detail.value?.warehouse_status || listItem.value?.warehouse_status || '')
const warehouseStatusText = computed(
  () => detail.value?.warehouse_status_desc
    || listItem.value?.warehouse_status_desc
    || MERGE_WAREHOUSE_STATUS_TEXT[warehouseStatus.value]
    || '-',
)
const warehouseStatusTagType = computed<'info' | 'success' | 'warning'>(() => {
  if (warehouseStatus.value === 'INBOUND') return 'success'
  if (warehouseStatus.value === 'OUTBOUND') return 'warning'
  return 'info'
})

const isBarcodeInvalid = computed(
  () => detail.value?.barcode_status === 'INVALID' || listItem.value?.barcode_status === 'INVALID',
)
const invalidReason = computed(() => detail.value?.invalid_reason || listItem.value?.invalid_reason || '')

const sourceTypeText = computed(() => {
  const type = detail.value?.source_type || listItem.value?.source_type || ''
  return type ? (MERGE_SOURCE_TYPE_TEXT[type] || type) : '-'
})
const sourceName = computed(() => detail.value?.source_name || listItem.value?.source_name || '')

const inboundTypeText = computed(() => {
  const type = listItem.value?.inbound_type || ''
  return type ? (MERGE_INBOUND_TYPE_TEXT[type] || type) : '-'
})
const hasInboundTrace = computed(() => {
  const row = listItem.value
  return !!row && Boolean(row.inbound_doc_no || row.inbound_order_no || row.inbound_type)
})

const outboundTypeText = computed(() => {
  const type = listItem.value?.outbound_type || ''
  return type ? (MERGE_OUTBOUND_TYPE_TEXT[type] || type) : '-'
})
const hasOutboundTrace = computed(() => {
  const row = listItem.value
  return !!row && Boolean(row.outbound_doc_no || row.outbound_type)
})

/* —— 补打（单条直打） —— */

const printOpen = ref(false)
const printRows = computed(() => {
  if (!mergePackageId.value) return []
  return [{ id: mergePackageId.value, title: field('product_name') || barcodeCode.value, subtitle: barcodeCode.value }]
})

/* —— 数据加载：详情 + 按业务ID精确搜索列表行，两接口独立降级 —— */

async function loadDetail() {
  if (!mergePackageId.value) {
    loadError.value = '缺少合包ID参数，请从合包管理列表进入'
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    // detail 提供位置链与条码校验；search(keyword=业务ID) 取回列表行补充打印统计/
    // 出入库追溯。任一失败不拖垮另一个（allSettled），两者全挂才报错。
    const [detailRes, listRes] = await Promise.allSettled([
      getMergePackageDetail(mergePackageId.value),
      searchMergePackages(mergePackageId.value, { page: 1, page_size: 10 }),
    ])
    detail.value = detailRes.status === 'fulfilled' ? detailRes.value : null
    listItem.value = null
    if (listRes.status === 'fulfilled') {
      // keyword 是 LIKE 匹配，须精确取回本条，避免同前缀业务ID串数据
      listItem.value = listRes.value.list.find((item) => item.merge_package_id === mergePackageId.value) || null
    }
    if (!detail.value && !listItem.value) {
      const reason = detailRes.status === 'rejected' && detailRes.reason instanceof Error
        ? detailRes.reason.message
        : '合包条码不存在或已被删除'
      loadError.value = `合包详情加载失败：${reason}`
    }
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/warehouse/merge-package')
}

function formatQty(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : String(value)
}

/** ISO 8601 → 'YYYY-MM-DD HH:mm:ss'（本地展示，不做时区换算） */
function formatDateTime(value?: string | null): string {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 19)
}

let skipFirstActivate = true
onMounted(loadDetail)
onActivated(() => {
  // keep-alive 重新激活时刷新（打印次数可能变化）；首次挂载跳过避免双请求
  if (skipFirstActivate) {
    skipFirstActivate = false
    return
  }
  loadDetail()
})
</script>

<style scoped>
.merge-package-detail { padding: var(--space-panel, 16px); }
.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.page-title { margin: 0; font-size: var(--font-h3, 18px); font-weight: 700; color: var(--text-primary); }
.page-bill-no { color: var(--text-secondary); font-size: 14px; }
.detail-actions { margin-left: auto; }
.section-card { margin-bottom: 16px; }
.num-cell { font-variant-numeric: tabular-nums; }
.id-mono { font-family: var(--font-mono, monospace); font-size: 12px; color: var(--text-secondary); }
.invalid-reason { color: var(--danger, #f56c6c); font-size: 12px; }
.text-tertiary { color: var(--text-tertiary); }
</style>
