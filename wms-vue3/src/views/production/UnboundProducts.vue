<template>
  <div class="unbound-page">
    <!-- 统计卡：全量口径（受关键字过滤影响、不受分页影响），与列表同一响应返回 -->
    <div class="summary-grid">
      <div class="summary-card is-missing">
        <span class="summary-label">档案缺失 · 待补录</span>
        <span class="summary-value">{{ summary.missing_count }}</span>
      </div>
      <div class="summary-card is-rebind">
        <span class="summary-label">待回绑 · 需平台重扫</span>
        <span class="summary-value">{{ summary.pending_rebind_count }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">明细行数（去重前）</span>
        <span class="summary-value">{{ summary.item_total }}</span>
      </div>
    </div>

    <div class="list-host">
      <ListTemplate
        title="未绑品号清单"
        v-model:page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :loading="loading"
        :columns="columns"
        :table-data="tableData"
        pagination-mode="server"
        row-key="prd_no"
        :show-index="true"
        :show-add="false"
        @page-change="loadData"
      >
        <template #actions>
          <el-button :loading="loading" @click="loadData">
            <el-icon><Refresh /></el-icon>刷新
          </el-button>
        </template>

        <template #search>
          <el-form inline size="default">
            <el-form-item label="品号 / 品名">
              <el-input
                v-model="keyword"
                placeholder="输入品号或品名模糊搜索"
                clearable
                style="width: 220px"
                @keyup.enter="handleSearch"
                @clear="handleSearch"
              />
            </el-form-item>
            <el-form-item label="单据类别">
              <el-select
                v-model="docKey"
                placeholder="全部单据"
                clearable
                style="width: 180px"
                @change="handleSearch"
              >
                <el-option v-for="d in PRODUCTION_DOCS" :key="d.docKey" :label="d.name" :value="d.docKey" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSearch">查询</el-button>
              <el-button @click="handleReset">重置</el-button>
              <span class="scope-note">ERP 已同步、WMS 无档案</span>
            </el-form-item>
          </el-form>
        </template>

        <template #col-prd_no="{ row }">
          <span class="mono-cell">{{ row.prd_no }}</span>
        </template>

        <template #col-prd_name="{ row }">
          <span>{{ row.prd_name || '—' }}</span>
        </template>

        <template #col-status="{ row }">
          <el-tag :type="row.status === 'MISSING' ? 'danger' : 'warning'" size="small">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>

        <template #col-doc_names="{ row }">
          <span v-if="!row.doc_names || row.doc_names.length === 0">—</span>
          <template v-else>
            <el-tag
              v-for="name in row.doc_names"
              :key="name"
              type="info"
              size="small"
              class="doc-tag"
            >{{ name }}</el-tag>
          </template>
        </template>

        <template #col-actions="{ row }">
          <el-button
            v-if="row.status === 'MISSING'"
            link
            type="primary"
            size="small"
            @click="guideMissing(row)"
          >去补录</el-button>
          <el-button
            v-else
            link
            type="warning"
            size="small"
            @click="guideRebind(row)"
          >如何重扫</el-button>
        </template>
      </ListTemplate>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 未绑品号清单（生产管理）
 * 源接口：nuomi_wms/docs/20_生产管理_批量作业状态变更与未同步品号查询接口指引.md §3
 *   GET /api/v1/tenant-production/unbound-products（perm_production_view）
 *
 * 语义：13 类生产单据明细里「ERP 已同步过来、但 WMS 产品档案中没有」的品号清单，
 *      按品号聚合去重（不是告警日志）。租户补录档案并回绑成功后条目自动消失，
 *      属现势视图，前端无需「已处理」标记。
 * 两类处理动作：MISSING=去产品管理补录；PENDING_REBIND=档案已有，需平台 FULL 重扫。
 */
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import ListTemplate, { type Column } from '@/views/common/ListTemplate.vue'
import { PRODUCTION_DOCS, listUnboundProducts, type UnboundProductsSummary, type UnboundProductRow, type UnboundProductStatus } from '@/api/modules/production'

const route = useRoute()
const router = useRouter()

const tableData = ref<UnboundProductRow[]>([])
const loading = ref(false)
const keyword = ref('')
const docKey = ref<string>('')
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const summary = ref<UnboundProductsSummary>({ missing_count: 0, pending_rebind_count: 0, item_total: 0 })

/** 接口固定按 item_count 降序、prd_no 升序，不支持自定义排序 → 列一律不带 sortable */
const columns: Column[] = [
  { prop: 'prd_no', label: '品号', minWidth: 140, priority: 'high' },
  { prop: 'prd_name', label: '品名', minWidth: 180 },
  { prop: 'status', label: '处理动作', width: 130, align: 'center' },
  { prop: 'doc_names', label: '涉及单据', minWidth: 200 },
  { prop: 'bill_count', label: '单据数', width: 90, align: 'center' },
  { prop: 'item_count', label: '明细行数', width: 100, align: 'center' },
  { prop: 'first_synced_at', label: '最早同步', width: 170 },
  { prop: 'last_synced_at', label: '最近同步', width: 170 },
]

function statusLabel(status: UnboundProductStatus | string): string {
  if (status === 'MISSING') return '档案缺失'
  if (status === 'PENDING_REBIND') return '待回绑'
  return String(status || '—')
}

async function loadData() {
  loading.value = true
  try {
    const res = await listUnboundProducts({
      // keyword 有 min_length=1 约束，空串由 API 层整个省略
      keyword: keyword.value,
      doc_key: docKey.value || undefined,
      page: pagination.page,
      page_size: pagination.pageSize,
    })
    tableData.value = res.data.items || []
    pagination.total = res.data.total
    summary.value = res.data.summary || { missing_count: 0, pending_rebind_count: 0, item_total: 0 }
    // 订阅到期时后端静默把 page_size 压到 ≤10，分页器须以响应值为准（否则第 2 页之后不可达）
    if (res.data.page_size) pagination.pageSize = res.data.page_size
  } catch {
    tableData.value = []
    pagination.total = 0
    summary.value = { missing_count: 0, pending_rebind_count: 0, item_total: 0 }
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  // keyword 过滤发生在分页之前，切换关键词必须回第 1 页
  pagination.page = 1
  loadData()
}

function handleReset() {
  keyword.value = ''
  docKey.value = ''
  pagination.page = 1
  loadData()
}

/** MISSING：产品档案缺失 → 引导去产品资料补录（补录后条目会自动消失） */
function guideMissing(row: UnboundProductRow) {
  ElMessageBox.alert(
    `品号「${row.prd_no}」在产品资料中不存在，涉及 ${row.bill_count} 张单据 / ${row.item_count} 条明细。`
    + '请到「产品资料」补录该品号，完成后回本页刷新即可。',
    '补录产品档案',
    {
      confirmButtonText: '前往产品资料',
      showCancelButton: true,
      cancelButtonText: '稍后处理',
      center: false,
    },
  ).then(() => { router.push('/product/info') }).catch(() => { /* 取消 */ })
}

/** PENDING_REBIND：档案已有货号，但历史明细未被增量同步再次触达 → 需平台 FULL 重扫回绑 */
function guideRebind(row: UnboundProductRow) {
  ElMessageBox.alert(
    `品号「${row.prd_no}」档案已存在，历史明细未被同步触达，需平台 FULL 重扫回绑。请联系平台管理员。`,
    '待重扫回绑',
    { confirmButtonText: '知道了', center: false },
  ).catch(() => { /* 关闭 */ })
}

onMounted(() => {
  // 从概览页「未绑品号」标签跳转时带 doc_key，直接按该类单据过滤
  const q = route.query.doc_key
  if (typeof q === 'string' && q) docKey.value = q
  loadData()
})
</script>

<style scoped>
.unbound-page { display: flex; flex-direction: column; gap: 12px; height: 100%; }

.summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.summary-card {
  display: flex; flex-direction: column; gap: 6px;
  padding: 14px 16px; border: 1px solid var(--border-color);
  border-radius: var(--radius-md); background: var(--bg-white);
}
.summary-label { font-size: 12px; color: var(--text-tertiary); }
.summary-value {
  font-size: 22px; font-weight: 700; color: var(--text-primary);
  font-variant-numeric: tabular-nums; line-height: 1.2;
}
.summary-card.is-missing .summary-value { color: var(--el-color-danger); }
.summary-card.is-rebind .summary-value { color: var(--el-color-warning); }

.list-host { flex: 1; min-height: 0; }

.mono-cell { font-family: monospace; }
.doc-tag { margin-right: 4px; }
.scope-note { margin-left: 10px; font-size: 12px; color: var(--text-tertiary); }

@media (max-width: 900px) {
  .summary-grid { grid-template-columns: 1fr; }
}
</style>
