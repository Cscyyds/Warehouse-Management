<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { listPdfJobs } from '@/api/pdfAdmin'
import type { PdfJobListParams, PdfJobListResponse, PdfJobRow } from '@/types/pdfAdmin'
import { formatDateTime, pdfStageMeta, pdfStatusMeta } from './statusMeta'

const router = useRouter()
const loading = ref(false)
const rows = ref<PdfJobRow[]>([])
const total = ref(0)
const stats = ref<PdfJobListResponse['stats']>({
  total: 0,
  active: 0,
  review_pending: 0,
  abnormal: 0,
  published: 0,
  publish_partial: 0,
})
const page = ref(1)
const pageSize = 20
const filters = reactive({
  keyword: '',
  status: '',
  company_id: '',
  owner_user_id: '',
  abnormal_only: false,
  date_range: [] as string[],
  sort_by: 'created_at',
  sort_order: 'desc' as 'asc' | 'desc',
})

const statusOptions = [
  ['ready', '待解析'],
  ['processing', '解析中'],
  ['merging', '合并中'],
  ['review_pending', '待人工审核'],
  ['publishing', '发布中'],
  ['published', '已完成'],
  ['publish_partial', '部分完成'],
  ['failed', '失败'],
  ['canceled', '已取消'],
]

function buildParams(): PdfJobListParams {
  return {
    page: page.value,
    page_size: pageSize,
    keyword: filters.keyword.trim() || undefined,
    status: filters.status || undefined,
    company_id: filters.company_id.trim() || undefined,
    owner_user_id: filters.owner_user_id.trim() || undefined,
    abnormal_only: filters.abnormal_only,
    created_from: filters.date_range?.[0] || undefined,
    created_to: filters.date_range?.[1] || undefined,
    sort_by: filters.sort_by,
    sort_order: filters.sort_order,
  }
}

async function load() {
  loading.value = true
  try {
    const data = await listPdfJobs(buildParams())
    rows.value = data.items
    total.value = data.total
    stats.value = data.stats
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(error instanceof Error ? error.message : 'PDF 任务列表加载失败')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  load()
}

function resetFilters() {
  Object.assign(filters, {
    keyword: '',
    status: '',
    company_id: '',
    owner_user_id: '',
    abnormal_only: false,
    date_range: [],
    sort_by: 'created_at',
    sort_order: 'desc',
  })
  applyFilters()
}

function changePage(next: number) {
  page.value = next
  load()
}

function openDetail(row: PdfJobRow) {
  router.push({ name: 'pdf-task-detail', params: { jobId: row.job_id } })
}

function ownerLabel(row: PdfJobRow): string {
  if (row.owner_user_name || row.owner_user_id) return row.owner_user_name || row.owner_user_id
  return row.checkpoint_available ? '历史未记录' : '归档未记录'
}

function progressLabel(row: PdfJobRow): string {
  if (!row.progress_total) return '—'
  return `${row.progress_current}/${row.progress_total}`
}

onMounted(load)
</script>

<template>
  <div class="page-stack">
    <PageHeader
      eyebrow="PDF PIPELINE"
      title="PDF 解析任务"
      description="查看所有用户的 PDF 产品文档拆分状态、解析结果、产品参数、裁剪图片与最终 Excel。"
      marker="SYSTEM ADMIN"
    />

    <section class="pdf-stat-grid">
      <article><span>总任务</span><strong>{{ stats.total }}</strong></article>
      <article><span>进行中</span><strong>{{ stats.active }}</strong></article>
      <article><span>待审核</span><strong>{{ stats.review_pending }}</strong></article>
      <article><span>异常</span><strong>{{ stats.abnormal }}</strong></article>
      <article><span>已完成</span><strong>{{ stats.published }}</strong></article>
      <article><span>部分完成</span><strong>{{ stats.publish_partial }}</strong></article>
    </section>

    <section class="filter-deck">
      <div class="filter-deck__head">
        <div>
          <span class="mono-label">QUERY CONTROL</span>
          <h2>查询条件</h2>
        </div>
        <div class="filter-actions">
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" :loading="loading" @click="applyFilters">查询任务</el-button>
        </div>
      </div>
      <div class="filter-grid">
        <label>
          <span>关键字</span>
          <el-input v-model="filters.keyword" clearable placeholder="文件名 / 任务ID / 用户" @keyup.enter="applyFilters" />
        </label>
        <label>
          <span>任务状态</span>
          <el-select v-model="filters.status" clearable placeholder="全部状态">
            <el-option v-for="item in statusOptions" :key="item[0]" :label="item[1]" :value="item[0]" />
          </el-select>
        </label>
        <label>
          <span>发起用户 ID</span>
          <el-input v-model="filters.owner_user_id" clearable placeholder="sys_user.user_id" />
        </label>
        <label>
          <span>租户 company_id</span>
          <el-input v-model="filters.company_id" clearable placeholder="tenant company_id" />
        </label>
        <label>
          <span>创建时间</span>
          <el-date-picker
            v-model="filters.date_range"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            clearable
          />
        </label>
        <label>
          <span>排序字段</span>
          <el-select v-model="filters.sort_by">
            <el-option label="创建时间" value="created_at" />
            <el-option label="更新时间" value="updated_at" />
            <el-option label="文件名" value="file_name" />
            <el-option label="状态" value="status" />
            <el-option label="页数" value="page_count" />
            <el-option label="产品数" value="product_count" />
          </el-select>
        </label>
        <label>
          <span>排序方向</span>
          <el-select v-model="filters.sort_order">
            <el-option label="降序" value="desc" />
            <el-option label="升序" value="asc" />
          </el-select>
        </label>
        <label class="pdf-switch-cell">
          <span>仅看异常</span>
          <el-switch v-model="filters.abnormal_only" />
        </label>
      </div>
    </section>

    <section class="data-panel">
      <div class="data-panel__head">
        <div>
          <span class="mono-label">TASK RECORDS</span>
          <h2>解析任务</h2>
        </div>
        <span class="record-count"><strong>{{ total }}</strong> 条任务</span>
      </div>

      <el-table
        v-loading="loading"
        :data="rows"
        stripe
        table-layout="fixed"
        empty-text="没有符合条件的 PDF 解析任务"
        @row-click="openDetail"
      >
        <el-table-column label="文件 / 任务" min-width="240">
          <template #default="scope">
            <div class="pdf-file-cell">
              <strong>{{ scope.row.file_name || '未命名 PDF' }}</strong>
              <span class="table-code">{{ scope.row.job_id }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="104">
          <template #default="scope">
            <el-tag size="small" effect="light" :type="pdfStatusMeta(scope.row.status).type">
              {{ pdfStatusMeta(scope.row.status).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="阶段" width="104">
          <template #default="scope">
            <span class="status-pill is-info">{{ pdfStageMeta(scope.row.stage, scope.row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="发起人 / 租户" min-width="180">
          <template #default="scope">
            <div class="table-person">
              <strong>{{ ownerLabel(scope.row) }}</strong>
              <span>{{ scope.row.company_id || '—' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="页面进度" width="104">
          <template #default="scope">
            <span class="table-code">{{ progressLabel(scope.row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="产品 / 裁剪 / 图片" min-width="150">
          <template #default="scope">
            <div class="pdf-counts">
              <span>产品 {{ scope.row.product_count }}</span>
              <span>裁剪 {{ scope.row.crop_count }}</span>
              <span>图片 {{ scope.row.image_count }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="164">
          <template #default="scope">{{ formatDateTime(scope.row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="完成时间" width="164">
          <template #default="scope">{{ formatDateTime(scope.row.completed_at) }}</template>
        </el-table-column>
        <el-table-column label="数据" width="104">
          <template #default="scope">
            <span v-if="scope.row.archive_available" class="status-pill is-success">归档</span>
            <span v-else-if="scope.row.checkpoint_available" class="status-pill is-info">检查点</span>
            <span v-else class="status-pill is-muted">无</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="72" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <span>点击任意行查看任务详情</span>
        <el-pagination
          background
          layout="prev, pager, next"
          :page-size="pageSize"
          :total="total"
          :current-page="page"
          @current-change="changePage"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.pdf-stat-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px;
}

.pdf-stat-grid article {
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(25, 45, 67, 0.05);
}

.pdf-stat-grid span {
  display: block;
  color: var(--muted);
  font-size: 11px;
  font-weight: 750;
}

.pdf-stat-grid strong {
  display: block;
  margin-top: 7px;
  color: var(--cargo-ink);
  font-size: 24px;
  letter-spacing: -0.03em;
}

.pdf-switch-cell {
  align-self: end;
  padding-bottom: 6px;
}

.pdf-file-cell {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.pdf-file-cell strong {
  overflow: hidden;
  color: var(--cargo-ink);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pdf-counts {
  display: grid;
  gap: 4px;
  color: #526479;
  font-size: 11px;
}

@media (max-width: 1180px) {
  .pdf-stat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>
