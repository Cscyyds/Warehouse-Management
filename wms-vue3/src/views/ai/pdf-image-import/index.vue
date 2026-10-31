<template>
  <div class="img-import">
    <div class="img-import__bar">
      <span class="img-import__title">图片识别（按产品）</span>
      <span class="img-import__hint">
        扫描服务端目录 → 一个产品一个任务 → 识别完进审核台
      </span>
      <el-button size="small" @click="goBack">返回审核台</el-button>
    </div>

    <div class="img-import__panel">
      <el-select v-model="root" style="width: 460px" placeholder="选择产品根目录">
        <el-option v-for="item in roots" :key="item" :label="item" :value="item" />
      </el-select>
      <el-input
        v-model="pattern"
        placeholder="目录过滤（可选），如 1051_*"
        clearable
        style="width: 220px"
      />
      <el-button type="primary" :loading="scanning" :disabled="!root" @click="doScan">
        扫描目录
      </el-button>
      <span v-if="summary" class="img-import__stat">
        产品 {{ summary.scanned }} 个 · 图片 {{ summary.total_images }} 张 ·
        预估 {{ summary.est_total_pages }} 页
      </span>
    </div>

    <el-table
      v-loading="scanning"
      :data="products"
      size="small"
      height="calc(100vh - 190px)"
      class="img-import__table"
      empty-text="选择根目录后点「扫描目录」"
    >
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
            :disabled="!row.image_count"
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
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

defineOptions({ name: 'PdfImageImport' });

const router = useRouter();
const roots = ref([]);
const root = ref('');
const pattern = ref('');
const products = ref([]);
const summary = ref(null);
const scanning = ref(false);
const starting = ref('');
const message = ref('');
const messageError = ref(false);

function authHeaders(extra = {}) {
  const token = localStorage.getItem('token') || '';
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

function notify(text, isError = false) {
  message.value = text;
  messageError.value = isError;
}

async function call(path, init = {}) {
  const r = await fetch(path, { ...init, headers: authHeaders(init.headers || {}) });
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

async function loadRoots() {
  try {
    const data = await call('/api/v1/pdf-image-import/roots');
    roots.value = data?.roots || [];
    if (!root.value && roots.value.length) root.value = roots.value[roots.value.length - 1];
  } catch (exc) {
    notify(`读取可扫描目录失败：${exc.message}`, true);
  }
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
    products.value = data?.products || [];
    summary.value = data?.summary || null;
    if (!products.value.length) notify('该目录下没有可识别的产品目录');
  } catch (exc) {
    products.value = [];
    summary.value = null;
    notify(`扫描失败：${exc.message}`, true);
  } finally {
    scanning.value = false;
  }
}

async function startOne(row) {
  if (starting.value) return;
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

.img-import__stat {
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.img-import__table {
  margin: 0 16px;
  background: #fff;
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
