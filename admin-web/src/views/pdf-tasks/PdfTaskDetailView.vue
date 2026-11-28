<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import {
  createPdfJobExcel,
  downloadPdfJobExcel,
  fetchPdfAssetBlob,
  getPdfJobCrops,
  getPdfJobDetail,
  getPdfJobEvents,
  getPdfJobExcelPreview,
  getPdfJobProducts,
} from '@/api/pdfAdmin'
import type {
  PdfCropsResponse,
  PdfEventsResponse,
  PdfExcelPreview,
  PdfJobDetail,
  PdfJobEvent,
  PdfProduct,
  PdfProductImage,
  PdfProductsResponse,
} from '@/types/pdfAdmin'
import { formatDateTime, formatSize, pdfImageTypeMeta, pdfStageMeta, pdfStatusMeta } from './statusMeta'
import PdfJsonTable from './PdfJsonTable.vue'

const route = useRoute()
const router = useRouter()
const jobId = String(route.params.jobId || '')

const loading = ref(false)
const detail = ref<PdfJobDetail | null>(null)
const activeTab = ref('overview')
const errorMessage = ref('')

const productsLoading = ref(false)
const products = ref<PdfProduct[]>([])
const productsMode = ref('none')
const productsLoaded = ref(false)

const cropsLoading = ref(false)
const crops = ref<PdfProductImage[]>([])
const cropsMode = ref('none')
const cropsLoaded = ref(false)
const cropKeyword = ref('')
const cropProductId = ref('')
const cropType = ref('')
const imageUrls = ref<Record<string, string>>({})
const previewOpen = ref(false)
const previewImage = ref<PdfProductImage | null>(null)

const excelLoading = ref(false)
const excel = ref<PdfExcelPreview | null>(null)
const excelLoaded = ref(false)
const excelBusy = ref(false)

const eventsLoading = ref(false)
const events = ref<PdfJobEvent[]>([])
const lastSeq = ref(0)
const streamLabel = ref('')
const eventsLoaded = ref(false)
let eventTimer: number | null = null

const ACTIVE_STATUSES = ['ready', 'processing', 'merging', 'publishing', 'review_pending']
const statusMeta = computed(() => pdfStatusMeta(detail.value?.status || ''))
const isActive = computed(() => ACTIVE_STATUSES.includes(detail.value?.status || ''))
const activeStep = computed(() => {
  switch (detail.value?.status) {
    case 'ready':
      return 0
    case 'processing':
      return 1
    case 'merging':
      return 2
    case 'review_pending':
      return 3
    case 'publishing':
    case 'published':
    case 'publish_partial':
      return 4
    default:
      return 0
  }
})

function handleError(error: unknown, fallback: string) {
  errorMessage.value = error instanceof Error ? error.message : fallback
  ElMessage.error(errorMessage.value)
}

async function loadDetail() {
  loading.value = true
  try {
    const data = await getPdfJobDetail(jobId)
    detail.value = data
    errorMessage.value = ''
  } catch (error) {
    detail.value = null
    handleError(error, 'PDF 任务详情加载失败')
  } finally {
    loading.value = false
  }
}

async function ensureProducts() {
  if (productsLoaded.value || productsLoading.value) return
  productsLoading.value = true
  try {
    const data: PdfProductsResponse = await getPdfJobProducts(jobId)
    products.value = data.items
    productsMode.value = data.mode
    productsLoaded.value = true
  } catch (error) {
    products.value = []
    handleError(error, '产品参数加载失败')
  } finally {
    productsLoading.value = false
  }
}

async function ensureCrops() {
  if (cropsLoaded.value || cropsLoading.value) return
  cropsLoading.value = true
  try {
    const data: PdfCropsResponse = await getPdfJobCrops(jobId)
    crops.value = data.items
    cropsMode.value = data.mode
    cropsLoaded.value = true
    await nextTick()
    await Promise.all(visibleCrops.value.map(loadImage))
  } catch (error) {
    crops.value = []
    handleError(error, '裁剪图片加载失败')
  } finally {
    cropsLoading.value = false
  }
}

async function ensureExcel() {
  if (excelLoaded.value || excelLoading.value) return
  excelLoading.value = true
  try {
    excel.value = await getPdfJobExcelPreview(jobId)
    excelLoaded.value = true
  } catch (error) {
    excel.value = null
    handleError(error, 'Excel 预览加载失败')
  } finally {
    excelLoading.value = false
  }
}

function assetPath(url: string): string {
  if (!url || /^https?:/i.test(url)) return ''
  return url.replace(/^\/api\/admin/, '')
}

async function loadImage(item: PdfProductImage) {
  if (!item.source_crop_id) return
  if (item.image_url) {
    imageUrls.value[item.source_crop_id] = item.image_url
    return
  }
  const path = assetPath(item.preview_url)
  if (!path || imageUrls.value[item.source_crop_id]) return
  try {
    imageUrls.value[item.source_crop_id] = await fetchPdfAssetBlob(path)
  } catch {
    imageUrls.value[item.source_crop_id] = ''
  }
}

function imageSrc(item: PdfProductImage): string {
  return imageUrls.value[item.source_crop_id] || item.image_url || ''
}

function openPreview(item: PdfProductImage) {
  previewImage.value = item
  previewOpen.value = true
}

const productOptions = computed(() => {
  const map = new Map<string, string>()
  for (const item of crops.value) {
    if (item.product_candidate_id) map.set(item.product_candidate_id, item.product_name || item.product_candidate_id)
  }
  for (const item of products.value) {
    if (item.product_candidate_id) map.set(item.product_candidate_id, item.product_name || item.product_candidate_id)
  }
  return [...map.entries()].map(([id, name]) => ({ id, name }))
})

const visibleCrops = computed(() => {
  const keyword = cropKeyword.value.trim().toLowerCase()
  return crops.value.filter((item) => {
    if (cropProductId.value && item.product_candidate_id !== cropProductId.value) return false
    if (cropType.value && item.image_type !== cropType.value) return false
    if (!keyword) return true
    return [item.product_name, item.description, item.source_crop_id]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
})

watch(visibleCrops, async (list) => {
  await Promise.all(list.map(loadImage))
})

async function loadEvents(append: boolean) {
  if (eventsLoading.value) return
  eventsLoading.value = true
  try {
    const data: PdfEventsResponse = await getPdfJobEvents(jobId, {
      since: append ? lastSeq.value : 0,
      limit: 300,
    })
    streamLabel.value = data.stream ? `${data.stream.kind} · ${data.stream.status}` : '无流实例'
    if (append) events.value = [...events.value, ...data.events]
    else events.value = data.events
    lastSeq.value = data.last_seq
    eventsLoaded.value = true
  } catch (error) {
    events.value = []
    streamLabel.value = ''
    handleError(error, '运行事件加载失败')
  } finally {
    eventsLoading.value = false
  }
}

function stopPolling() {
  if (eventTimer !== null) {
    window.clearInterval(eventTimer)
    eventTimer = null
  }
}

function startPolling() {
  stopPolling()
  if (!isActive.value) return
  eventTimer = window.setInterval(() => {
    if (document.hidden) return
    void loadEvents(true)
    if (activeTab.value === 'overview') void loadDetail()
  }, 8000)
}

async function refreshExcel() {
  excelLoaded.value = false
  await ensureExcel()
}

async function generateExcel() {
  excelBusy.value = true
  try {
    excel.value = await createPdfJobExcel(jobId)
    excelLoaded.value = true
    ElMessage.success('Excel 已生成/刷新')
    await loadDetail()
  } catch (error) {
    handleError(error, 'Excel 生成失败')
  } finally {
    excelBusy.value = false
  }
}

async function downloadExcel() {
  try {
    await downloadPdfJobExcel(jobId, excel.value?.file_name || `${detail.value?.file_name || 'products'}.xlsx`)
    ElMessage.success('Excel 下载已开始')
  } catch (error) {
    handleError(error, 'Excel 下载失败')
  }
}

async function onTabChange(tab: string | number) {
  const name = String(tab)
  if (name === 'products') await ensureProducts()
  if (name === 'crops') await ensureCrops()
  if (name === 'excel') await ensureExcel()
  if (name === 'events' && !eventsLoaded.value) await loadEvents(false)
}

watch(
  () => detail.value?.status,
  () => startPolling(),
)

onBeforeUnmount(() => {
  stopPolling()
  for (const url of Object.values(imageUrls.value)) URL.revokeObjectURL(url)
})

onMounted(async () => {
  await loadDetail()
  if (isActive.value) startPolling()
})
</script>

<template>
  <div v-if="detail" v-loading="loading" class="page-stack pdf-detail">
    <div class="pdf-detail__head">
      <div>
        <el-button link type="primary" @click="router.push({ name: 'pdf-tasks' })">← 返回任务列表</el-button>
        <PageHeader
          eyebrow="PDF TASK DETAIL"
          :title="detail.file_name || detail.job_id"
          :description="`任务 ID：${detail.job_id}`"
          :marker="statusMeta.label"
        />
      </div>
      <div class="pdf-detail__actions">
        <el-button :loading="loading" @click="loadDetail">刷新详情</el-button>
      </div>
    </div>

    <el-alert
      v-if="detail.error_message"
      type="error"
      show-icon
      :closable="false"
      :title="detail.error_message"
      class="pdf-alert"
    />

    <section class="pdf-detail__stats">
      <article><span>产品数量</span><strong>{{ detail.product_count }}</strong></article>
      <article><span>裁剪候选</span><strong>{{ detail.crop_count }}</strong></article>
      <article><span>最终图片</span><strong>{{ detail.image_count }}</strong></article>
      <article><span>发布失败</span><strong>{{ detail.failed_image_count }}</strong></article>
      <article><span>页数</span><strong>{{ detail.page_count }}</strong></article>
      <article><span>数据来源</span><strong>{{ detail.archive_available ? '归档' : '检查点' }}</strong></article>
    </section>

    <el-tabs v-model="activeTab" class="pdf-tabs" @tab-change="onTabChange">
      <el-tab-pane label="运行概览" name="overview">
        <section class="pdf-panel">
          <el-steps :active="activeStep" align-center finish-status="success">
            <el-step title="任务创建" :description="formatDateTime(detail.created_at)" />
            <el-step title="页面识别 W1" :description="detail.page_progress?.completed ? `${detail.page_progress.completed} 页完成` : '—'" />
            <el-step title="产品合并 W2" :description="detail.stage === 'w2' ? '进行中' : '—'" />
            <el-step title="人工审核" :description="detail.review?.status || '—'" />
            <el-step title="结果发布" :description="detail.status" />
          </el-steps>

          <div class="pdf-info-grid">
            <dl>
              <dt>任务状态</dt>
              <dd>
                <el-tag size="small" :type="statusMeta.type">{{ statusMeta.label }}</el-tag>
                <span class="pdf-inline">{{ pdfStageMeta(detail.stage, detail.status) }}</span>
              </dd>
              <dt>发起人</dt>
              <dd>{{ detail.owner_user_name || detail.owner_user_id || '历史未记录' }}</dd>
              <dt>租户 company_id</dt>
              <dd>{{ detail.company_id || '—' }}</dd>
              <dt>创建 / 更新时间</dt>
              <dd>{{ formatDateTime(detail.created_at) }} / {{ formatDateTime(detail.updated_at) }}</dd>
              <dt>完成时间</dt>
              <dd>{{ formatDateTime(detail.completed_at) }}</dd>
              <dt>源文件大小</dt>
              <dd>{{ formatSize(detail.file_size) }}</dd>
              <dt>页面进度</dt>
              <dd>{{ detail.progress_current || 0 }}/{{ detail.progress_total || 0 }}</dd>
            </dl>
            <dl>
              <dt>当前流实例</dt>
              <dd>{{ detail.latest_stream_id || '—' }}</dd>
              <dt>审核剩余</dt>
              <dd>{{ detail.review?.remaining_review_count ?? 0 }}</dd>
              <dt>已通过产品 / 裁剪</dt>
              <dd>{{ detail.review?.approved_product_count ?? 0 }} / {{ detail.review?.approved_crop_count ?? 0 }}</dd>
              <dt>已拒绝产品 / 裁剪</dt>
              <dd>{{ detail.review?.rejected_product_count ?? 0 }} / {{ detail.review?.rejected_crop_count ?? 0 }}</dd>
              <dt>导出文件名</dt>
              <dd>{{ detail.export?.file_name || '尚未生成' }}</dd>
              <dt>导出来源</dt>
              <dd>{{ detail.export?.source_format || '—' }}</dd>
              <dt>PDF 源地址</dt>
              <dd class="pdf-url">{{ detail.source_url || '—' }}</dd>
            </dl>
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane label="运行事件" name="events">
        <section v-loading="eventsLoading" class="pdf-panel">
          <div class="pdf-panel__head">
            <div>
              <span class="mono-label">STREAM EVENTS</span>
              <h2>{{ streamLabel || '运行事件' }}</h2>
            </div>
            <el-button :loading="eventsLoading" @click="loadEvents(false)">刷新事件</el-button>
          </div>
          <el-table :data="events" stripe table-layout="fixed" empty-text="暂无运行事件">
            <el-table-column label="序号" width="72"><template #default="scope">{{ scope.row.seq }}</template></el-table-column>
            <el-table-column label="类型" width="96"><template #default="scope"><span class="status-pill is-info">{{ scope.row.ev }}</span></template></el-table-column>
            <el-table-column type="expand" label="内容" width="92">
              <template #default="scope">
                <pre class="pdf-pre">{{ JSON.stringify(scope.row.data, null, 2) }}</pre>
              </template>
            </el-table-column>
            <el-table-column label="摘要" min-width="240">
              <template #default="scope">{{ JSON.stringify(scope.row.data).slice(0, 160) }}</template>
            </el-table-column>
          </el-table>
        </section>
      </el-tab-pane>

      <el-tab-pane label="产品参数" name="products">
        <section v-loading="productsLoading" class="pdf-panel">
          <div class="pdf-panel__head">
            <div>
              <span class="mono-label">PRODUCT PARAMETERS</span>
              <h2>{{ productsMode === 'final' ? '最终产品' : '审核产品' }}</h2>
            </div>
            <span class="record-count"><strong>{{ products.length }}</strong> 个产品</span>
          </div>
          <el-table :data="products" stripe table-layout="fixed" empty-text="暂无产品">
            <el-table-column label="产品" min-width="220">
              <template #default="scope">
                <div class="pdf-file-cell">
                  <strong>{{ scope.row.product_name || '未命名产品' }}</strong>
                  <span class="table-code">{{ scope.row.product_candidate_id }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="brand" label="品牌" width="110" show-overflow-tooltip />
            <el-table-column prop="series_name" label="系列" width="130" show-overflow-tooltip />
            <el-table-column label="特点" min-width="220">
              <template #default="scope">
                <div class="pdf-tag-list">
                  <el-tag v-for="item in scope.row.features || []" :key="item" size="small" type="info" effect="plain">{{ item }}</el-tag>
                  <span v-if="!(scope.row.features || []).length">—</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="图片" width="72">
              <template #default="scope">{{ scope.row.image_count }}</template>
            </el-table-column>
            <el-table-column type="expand" width="72">
              <template #default="scope">
                <div class="pdf-product-detail">
                  <h4>技术参数</h4>
                  <PdfJsonTable :data="scope.row.specification" />
                  <h4>安装说明</h4>
                  <p>{{ scope.row.installation || '—' }}</p>
                  <h4>注意事项</h4>
                  <p>{{ scope.row.precautions || '—' }}</p>
                  <h4>来源页码</h4>
                  <p>{{ (scope.row.pages || []).join('、') || '—' }}</p>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </el-tab-pane>

      <el-tab-pane label="裁剪图片" name="crops">
        <section v-loading="cropsLoading" class="pdf-panel">
          <div class="pdf-panel__head">
            <div>
              <span class="mono-label">CROP IMAGES</span>
              <h2>{{ cropsMode === 'final' ? '最终发布图片' : '审核候选图片' }}</h2>
            </div>
            <span class="record-count"><strong>{{ visibleCrops.length }}</strong> 张图片</span>
          </div>

          <div class="pdf-filter-row">
            <el-input v-model="cropKeyword" clearable placeholder="产品 / 描述 / 裁剪 ID" />
            <el-select v-model="cropProductId" clearable placeholder="全部产品">
              <el-option v-for="item in productOptions" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
            <el-select v-model="cropType" clearable placeholder="全部类型">
              <el-option label="主图" value="main" />
              <el-option label="细节图" value="detail" />
              <el-option label="场景图" value="scene" />
              <el-option label="结构图" value="structure" />
              <el-option label="安装图" value="install" />
              <el-option label="参数图" value="parameter" />
              <el-option label="其他" value="other" />
            </el-select>
          </div>

          <div v-if="visibleCrops.length" class="pdf-crop-grid">
            <article v-for="item in visibleCrops" :key="item.source_crop_id" class="pdf-crop-card" @click="openPreview(item)">
              <img v-if="imageSrc(item)" :src="imageSrc(item)" :alt="item.product_name || item.description || '裁剪图片'" loading="lazy" />
              <div v-else class="pdf-crop-card__empty">预览不可用</div>
              <div class="pdf-crop-card__body">
                <strong>{{ item.product_name || '未命名产品' }}</strong>
                <span class="table-code">{{ pdfImageTypeMeta(item.image_type) }} · P{{ item.page_number || '—' }}</span>
                <p>{{ item.description || '—' }}</p>
              </div>
            </article>
          </div>
          <el-empty v-else description="暂无符合条件的裁剪图片" />
        </section>
      </el-tab-pane>

      <el-tab-pane label="Excel 预览" name="excel">
        <section v-loading="excelLoading" class="pdf-panel">
          <div class="pdf-panel__head">
            <div>
              <span class="mono-label">EXCEL PREVIEW</span>
              <h2>{{ excel?.kind === 'actual' ? '真实 Excel 文件' : '预计导出内容' }}</h2>
            </div>
            <div class="panel-actions">
              <el-button :loading="excelLoading" @click="refreshExcel">刷新预览</el-button>
              <el-button type="primary" :loading="excelBusy" :disabled="!excel?.can_export" @click="generateExcel">生成 / 刷新 Excel</el-button>
              <el-button :disabled="excel?.kind !== 'actual'" @click="downloadExcel">下载 Excel</el-button>
            </div>
          </div>

          <el-alert
            v-if="excel"
            :type="excel.kind === 'actual' ? 'success' : 'info'"
            show-icon
            :closable="false"
            :title="excel.message"
            class="pdf-alert"
          />

          <div v-if="excel" class="pdf-excel-meta">
            <span>文件名：{{ excel.file_name || '—' }}</span>
            <span>总行数：{{ excel.total_rows }}</span>
            <span>预览行数：{{ excel.rows.length }}</span>
            <span v-if="excel.truncated">内容较多，完整数据请下载 Excel</span>
          </div>

          <el-table
            v-if="excel && excel.rows.length"
            :data="excel.rows"
            stripe
            table-layout="auto"
            empty-text="暂无 Excel 内容"
          >
            <el-table-column
              v-for="(column, index) in excel.columns"
              :key="column"
              :label="column"
              min-width="140"
              show-overflow-tooltip
            >
              <template #default="scope">{{ scope.row[index] }}</template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无可预览的 Excel 内容" />
        </section>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="previewOpen" title="裁剪图片预览" width="720px">
      <div v-if="previewImage" class="pdf-image-dialog">
        <img v-if="imageSrc(previewImage)" :src="imageSrc(previewImage)" :alt="previewImage.description" />
        <el-empty v-else description="预览不可用" />
        <dl>
          <dt>产品</dt><dd>{{ previewImage.product_name || '—' }}</dd>
          <dt>类型</dt><dd>{{ pdfImageTypeMeta(previewImage.image_type) }}</dd>
          <dt>页码</dt><dd>{{ previewImage.page_number || '—' }}</dd>
          <dt>描述</dt><dd>{{ previewImage.description || '—' }}</dd>
        </dl>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.pdf-detail__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
.pdf-detail__actions { display: flex; gap: 10px; }
.pdf-detail__stats { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; }
.pdf-detail__stats article { padding: 16px 18px; border: 1px solid var(--line); border-radius: 12px; background: #fff; box-shadow: 0 8px 22px rgba(25,45,67,.05); }
.pdf-detail__stats span { display: block; color: var(--muted); font-size: 11px; font-weight: 750; }
.pdf-detail__stats strong { display: block; margin-top: 7px; color: var(--cargo-ink); font-size: 22px; letter-spacing: -0.03em; }
.pdf-alert { border-radius: 12px; }
.pdf-tabs :deep(.el-tabs__header) { margin-bottom: 20px; }
.pdf-tabs :deep(.el-tabs__item) { height: 44px; color: #607286; font-weight: 700; }
.pdf-tabs :deep(.el-tabs__item.is-active) { color: var(--scanner-blue); }
.pdf-panel { padding: 22px 24px; border: 1px solid var(--line); border-radius: var(--radius); background: #fff; box-shadow: var(--shadow); }
.pdf-panel__head { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
.pdf-panel__head h2 { margin: 4px 0 0; color: var(--cargo-ink); font-size: 18px; }
.pdf-panel__head .mono-label { color: #8795a4; }
.pdf-info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 24px; }
.pdf-info-grid dl { display: grid; grid-template-columns: 145px minmax(0, 1fr); margin: 0; padding: 0; }
.pdf-info-grid dt { color: #7b8998; font-size: 11px; font-weight: 750; }
.pdf-info-grid dd { margin: 0 0 12px; color: #33475b; font-size: 12px; overflow-wrap: anywhere; }
.pdf-inline { margin-left: 8px; color: #7b8998; }
.pdf-url { font-family: "Cascadia Mono", monospace; font-size: 11px; }
.pdf-pre { margin: 0; padding: 12px; max-height: 320px; overflow: auto; border: 1px solid var(--line); border-radius: 8px; background: #f8fafc; color: #33475b; font-size: 11px; white-space: pre-wrap; }
.pdf-product-detail { display: grid; gap: 8px; padding: 8px 18px 16px; }
.pdf-product-detail h4 { margin: 8px 0 0; color: #526479; font-size: 12px; }
.pdf-product-detail p { margin: 0; color: #33475b; font-size: 12px; white-space: pre-wrap; }
.pdf-tag-list { display: flex; flex-wrap: wrap; gap: 4px; }
.pdf-file-cell { display: grid; gap: 4px; min-width: 0; }
.pdf-file-cell strong { color: var(--cargo-ink); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdf-filter-row { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(180px, 1fr) minmax(150px, .8fr); gap: 10px; margin-bottom: 18px; }
.pdf-crop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.pdf-crop-card { border: 1px solid var(--line); border-radius: 12px; background: #fff; overflow: hidden; cursor: pointer; transition: border-color .18s ease, transform .18s ease; }
.pdf-crop-card:hover { border-color: var(--line-strong); transform: translateY(-2px); }
.pdf-crop-card img { width: 100%; height: 150px; background: #f8fafc; object-fit: contain; }
.pdf-crop-card__empty { display: grid; place-items: center; height: 150px; color: #8a98a7; background: #f8fafc; font-size: 11px; }
.pdf-crop-card__body { display: grid; gap: 5px; padding: 10px 12px 12px; }
.pdf-crop-card__body strong { color: var(--cargo-ink); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdf-crop-card__body p { margin: 0; color: #69798b; font-size: 11px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pdf-excel-meta { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 16px; color: #69798b; font-size: 11px; }
.pdf-image-dialog { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 18px; }
.pdf-image-dialog img { width: 100%; max-height: 62vh; border: 1px solid var(--line); border-radius: 10px; background: #f8fafc; object-fit: contain; }
.pdf-image-dialog dl { display: grid; grid-template-columns: 48px minmax(0, 1fr); margin: 0; }
.pdf-image-dialog dt { color: #7b8998; font-size: 11px; font-weight: 750; }
.pdf-image-dialog dd { margin: 0 0 12px; color: #33475b; font-size: 12px; overflow-wrap: anywhere; }

@media (max-width: 1180px) {
  .pdf-detail__stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .pdf-info-grid { grid-template-columns: 1fr; }
  .pdf-image-dialog { grid-template-columns: 1fr; }
}
</style>
