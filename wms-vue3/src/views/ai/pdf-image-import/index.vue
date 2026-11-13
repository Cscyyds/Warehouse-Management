<template>
  <div class="img-import">
    <div class="img-import__bar">
      <span class="img-import__title">图片识别（按产品）</span>
      <span class="img-import__hint">
        扫描服务端目录 → 勾选多个产品合并为一个任务 → 识别完进审核台
      </span>
      <el-button size="small" @click="goBack">返回审核台</el-button>
    </div>

    <div class="img-import__panel">
      <el-select
        v-model="root"
        style="width: 460px"
        placeholder="选择产品根目录"
        @change="onRootChange"
      >
        <el-option v-for="item in roots" :key="item" :label="item" :value="item" />
      </el-select>
      <el-input
        v-model="pattern"
        placeholder="目录过滤（可选），如 1051_* 或 落水器"
        clearable
        style="width: 220px"
        @keyup.enter="doScan"
        @clear="doScan"
      />
      <el-button type="primary" :loading="scanning" :disabled="!root" @click="doScan">
        扫描目录
      </el-button>
      <span v-if="summary" class="img-import__stat">
        产品 {{ summary.scanned }} 个 · 图片 {{ summary.total_images }} 张 ·
        预估 {{ summary.est_total_pages }} 页
        <template v-if="seriesCount > 1">· {{ seriesCount }} 个系列</template>
        <template v-if="pattern && summary.product_dirs > summary.scanned">
          （匹配 {{ summary.scanned }} / 共 {{ summary.product_dirs }} 个目录）
        </template>
      </span>
    </div>

    <div v-if="products.length" class="img-import__panel img-import__panel--merge">
      <el-button
        :disabled="scanning || merging"
        @click="selectNextN"
      >一键勾选 {{ SELECT_N }} 个</el-button>
      <el-button
        type="success"
        :loading="merging"
        :disabled="!selected.length || !!starting"
        @click="startMerged"
      >合并识别（{{ selected.length }} 个产品 → 1 个任务）</el-button>
      <span v-if="selected.length" class="img-import__stat">
        已选 {{ selected.length }} 个产品 · {{ selectedImages }} 张图 ·
        预估 {{ selectedPages }} 页
        <template v-if="selectedPages > MAX_PAGES">
          <span class="img-import__warn">（超过单任务 {{ MAX_PAGES }} 页上限，请减少勾选）</span>
        </template>
      </span>
      <span v-else class="img-import__stat">勾选多个产品目录可合并成一个任务一次识别；单个产品也可点行内按钮</span>
    </div>

    <el-table
      ref="tableRef"
      v-loading="scanning"
      :data="products"
      size="small"
      height="calc(100vh - 240px)"
      class="img-import__table"
      empty-text="选择根目录后点「扫描目录」"
      :row-class-name="rowClassName"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" fixed="left" width="40" :selectable="canSelect" />
      <el-table-column prop="series" label="系列" width="130" show-overflow-tooltip />
      <el-table-column prop="folder" label="目录" min-width="240" show-overflow-tooltip />
      <el-table-column prop="product_name" label="产品名" min-width="200" show-overflow-tooltip />
      <el-table-column prop="image_count" label="图片" width="70" align="center" />
      <el-table-column prop="est_pages" label="预估页" width="80" align="center" />
      <el-table-column label="标记" min-width="220">
        <template #default="{ row }">
          <el-tag
            v-for="flag in row.flags"
            :key="flag"
            size="small"
            :type="flagLevel(flag)"
            class="img-import__tag"
          >{{ flagText(flag) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right" align="center">
        <template #default="{ row }">
          <el-button
            size="small"
            type="primary"
            :loading="starting === row.folder"
            :disabled="!row.image_count || merging"
            @click="startOne(row)"
          >开始识别</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="message" class="img-import__msg" :class="{ 'is-error': messageError }">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { seriesSummary, sortBySeries } from './seriesSort';
import { authHeaders, pdfFetch } from '@/utils/pdfApi';

defineOptions({ name: 'PdfImageImport' });

const router = useRouter();
const roots = ref([]);
const root = ref('');
const pattern = ref('');
const products = ref([]);
const summary = ref(null);
const scanning = ref(false);
const starting = ref('');
const selected = ref([]);
const merging = ref(false);
const message = ref('');
const messageError = ref(false);

// 与后端 PDF_MAX_PAGES 同源的展示上限（提交前后端仍会兜底校验）
const MAX_PAGES = 200;
// 一键勾选的目标数量（用户口径：从第一个勾选的产品往下补齐 50 个）
const SELECT_N = 50;

const tableRef = ref(null);

const selectedPages = computed(() =>
  selected.value.reduce((sum, row) => sum + (row.est_pages || 0), 0));
const selectedImages = computed(() =>
  selected.value.reduce((sum, row) => sum + (row.image_count || 0), 0));
const seriesCount = computed(() =>
  new Set(products.value.map((row) => row.series).filter(Boolean)).size);

/** 每个系列的第一行加一条分组上边线，肉眼能看出「一个系列一段」。 */
function rowClassName({ rowIndex }) {
  if (rowIndex <= 0 || rowIndex >= products.value.length) return '';
  const prev = products.value[rowIndex - 1];
  const current = products.value[rowIndex];
  return current.series !== prev.series ? 'is-series-start' : '';
}

function canSelect(row) {
  return !!(row.image_count && !row.flags?.includes('pages_exceed_limit'));
}

function onSelectionChange(rows) {
  selected.value = rows || [];
}

function selectNextN() {
  const table = tableRef.value;
  if (!table || !products.value.length) return;
  const chosen = new Set(selected.value);
  // 锚点 = 当前第一个勾选的行（表格顺序）；一个都没勾时从首个可用行开始
  let anchor = products.value.findIndex((row) => chosen.has(row));
  if (anchor < 0) anchor = 0;
  let reachedEnd = true;
  for (let i = anchor; i < products.value.length; i += 1) {
    if (chosen.size >= SELECT_N) { reachedEnd = false; break; }
    const row = products.value[i];
    if (!canSelect(row) || chosen.has(row)) continue;
    chosen.add(row);
    table.toggleRowSelection(row, true);
  }
  const anchorFolder = products.value[anchor]?.folder || '';
  const anchorSeries = products.value[anchor]?.series || '';
  const picked = products.value.filter((row) => chosen.has(row));
  if (chosen.size < SELECT_N) {
    notify(`从「${anchorSeries || anchorFolder}」往下只剩 ${chosen.size} 个可勾选产品`
      + `（不足 ${SELECT_N} 个）——${seriesSummary(picked)}`);
  } else {
    notify(`已勾选 ${chosen.size} 个：从「${anchorSeries || anchorFolder}」起往下补齐`
      + `（${seriesSummary(picked)}）`);
  }
}



function notify(text, isError = false) {
  message.value = text;
  messageError.value = isError;
}

async function call(path, init = {}) {
  const r = await pdfFetch(path, { ...init, headers: authHeaders(init.headers || {}) });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!r.ok) {
    const detail = body?.detail;
    throw new Error(
      typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : `HTTP ${r.status}`
    );
  }
  return body;
}

const FLAG_TEXT = {
  gallery_only: '无详情图',
  single_image: '仅一张图',
  extreme_long: '超长图',
  video_as_image: '视频伪装',
  duplicate_name: '同名重复',
  no_gallery: '缺主图',
  no_images: '无图片',
  unreadable_image: '图片损坏',
  pages_exceed_limit: '页数超限',
  ignored_files: '有忽略文件'
};

function flagText(flag) {
  return FLAG_TEXT[flag] || flag;
}

function flagLevel(flag) {
  if (flag === 'video_as_image' || flag === 'pages_exceed_limit' || flag === 'no_images') return 'danger';
  if (flag === 'duplicate_name') return 'warning';
  return 'info';
}

function goBack() {
  router.push('/ai/pdf_agent');
}

const ROOT_KEY = 'pdf_image_import_root';

async function loadRoots() {
  try {
    const data = await call('/api/v1/pdf-image-import/roots');
    roots.value = data?.roots || [];
    const saved = localStorage.getItem(ROOT_KEY) || '';
    if (!root.value && roots.value.length) {
      root.value = roots.value.includes(saved) ? saved : roots.value[0];
    }
  } catch (exc) {
    notify(`读取可扫描目录失败：${exc.message}`, true);
  }
}

function onRootChange(value) {
  try { localStorage.setItem(ROOT_KEY, value); } catch { /* 存储异常忽略 */ }
}

async function doScan() {
  if (!root.value) return;
  scanning.value = true;
  notify('');
  try {
    const data = await call('/api/v1/pdf-image-import/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root: root.value, pattern: pattern.value || '' })
    });
    products.value = sortBySeries(data?.products || []);
    summary.value = data?.summary || null;
    if (!products.value.length) {
      // 区分「整目录没有子目录」与「过滤词零匹配」，后者给出可行动的提示
      notify(pattern.value.trim()
        ? `没有匹配「${pattern.value.trim()}」的产品目录`
          + `（共 ${summary.value?.product_dirs ?? 0} 个目录）——可换个关键词，`
          + '或支持通配符如 1051_*；点输入框右侧 ✕ 清空后重扫全量'
        : '该目录下没有子目录', true);
    } else if (!data.summary?.importable) {
      notify(
        '该目录下的子目录都没有可用图片——可能选到了上层目录。'
        + '产品根目录应该直接包含 1051_xxx、1126_xxx 这类产品文件夹。',
        true
      );
    }
  } catch (exc) {
    products.value = [];
    summary.value = null;
    notify(`扫描失败：${exc.message}`, true);
  } finally {
    scanning.value = false;
  }
}

async function startOne(row) {
  if (starting.value || merging.value) return;
  starting.value = row.folder;
  notify('');
  try {
    const job = await call('/api/v1/pdf-image-import/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root: root.value, folder: row.folder })
    });
    // 交给 pdf_agent 引擎驱动（与 PDF 任务同一条链路）：只传 job_id 即续跑。
    // 不走 Coze 工作流——那条路要 Pdf_URL，图片任务没有 PDF；且生产队列不可用时
    // pdf_agent 会自动回退进程内线程，本地也能跑。
    await call('/pdf-agent/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: job.job_id, review_mode: 'manual' })
    });
    router.push({ path: '/ai/pdf_agent', query: { job_id: job.job_id } });
  } catch (exc) {
    notify(`启动失败：${exc.message}`, true);
  } finally {
    starting.value = '';
  }
}

async function startMerged() {
  if (merging.value || starting.value || !selected.value.length) return;
  if (selectedPages.value > MAX_PAGES) {
    notify(`预估 ${selectedPages.value} 页超过单任务 ${MAX_PAGES} 页上限，请减少勾选`, true);
    return;
  }
  merging.value = true;
  notify('');
  try {
    // 多产品合并为一个任务：每张图带所属目录的权威产品名（后端按页下发
    // product_hint），识别、审核、发布与多产品 PDF 画册同一条链路。
    const job = await call('/api/v1/pdf-image-import/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        root: root.value,
        folders: selected.value.map((row) => row.folder)
      })
    });
    await call('/pdf-agent/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: job.job_id, review_mode: 'manual' })
    });
    router.push({ path: '/ai/pdf_agent', query: { job_id: job.job_id } });
  } catch (exc) {
    notify(`合并识别失败：${exc.message}`, true);
  } finally {
    merging.value = false;
  }
}

onMounted(loadRoots);
</script>

<style scoped>
.img-import {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--el-bg-color-page, #f5f7fa);
}

.img-import__bar {
  flex: none;
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 10px 16px;
  background: var(--el-color-warning-light-9, #fdf6ec);
  border-bottom: 1px solid var(--el-border-color-light, #e4e7ed);
}

.img-import__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-warning-dark-2, #b88230);
}

.img-import__hint {
  flex: 1;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.img-import__panel {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
}

.img-import__panel--merge {
  padding-top: 0;
}

.img-import__stat {
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.img-import__warn {
  color: var(--el-color-danger, #f56c6c);
}

.img-import__table {
  margin: 0 16px;
  background: #fff;
}

/* 系列分组上边线：同系列连续排在一起，段与段之间留一道可见的分隔 */
.img-import__table :deep(tr.is-series-start > td) {
  border-top: 2px solid var(--el-color-primary-light-1, #53a8ff);
}

.img-import__tag {
  margin-right: 4px;
}

.img-import__msg {
  flex: none;
  padding: 6px 16px 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.img-import__msg.is-error {
  color: var(--el-color-danger, #f56c6c);
}
</style>
