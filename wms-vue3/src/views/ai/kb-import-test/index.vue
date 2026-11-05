<script setup>
/**
 * 知识库 xlsx 导入接口手动测试页（独立入口，不经 PDF 工作台）。
 *
 * 直接验证 Coze_Connect 自带的两步式导入：
 *   ① POST /api/v1/knowledge/admin/imports/excel   校验落批次，返回 import_id
 *   ② POST /api/v1/knowledge/admin/imports/{import_id}/commit   提交 + 投递索引
 *   （附：批次状态查询 / 错误行明细）
 *
 * 目标实例可选：云端 7779 直连（CORS 全开，不依赖 vite 代理）、
 * 本地 8001 直连、同源 vite 代理（跟随 vite.config 的 /api/v1/knowledge 条目）。
 * 「上传前适配」复刻编排路由（pdf_knowledge_import_service）的行为：
 * sheet 名改「图册记录表」+ 数据行「记录状态」填「已发布」——
 * 关掉可测原生接口对未适配文件的报错（422 缺 sheet 名 / 导入后 disabled）。
 */
import { computed, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import * as XLSX from 'xlsx';

const SHEET_NAME = '图册记录表';
const STATUS_HEADER = '记录状态';
const PUBLISHED = '已发布';

// ── 请求目标 ──
const BASES = [
  { label: '云端 7779（直连）', value: 'https://www.aster-mindlink.cn:7779' },
  { label: '本地 8001（直连）', value: 'http://127.0.0.1:8001' },
  { label: '同源（vite 代理）', value: '' },
];
const base = ref(BASES[0].value);

// ── 文件与适配 ──
const rawFile = ref(null);
const adapt = ref(true);
const adaptNote = ref('');
const uploading = ref(false);

// ── 批次状态（步骤①结果 → 步骤②消费）──
const batch = ref(null);          // batch_to_dict 摘要
const commitResult = ref(null);   // commit 响应
const errorRows = ref([]);
const committing = ref(false);
const fetchingRows = ref(false);
const refreshing = ref(false);

const importId = computed(() => String(batch.value?.import_id || ''));
const committable = computed(() => batch.value?.status === 'validated');

// ── 请求日志（手动测试的核心可见性）──
const logs = reactive([]);
function log(method, url, status, body, error = '') {
  logs.unshift({ time: new Date().toLocaleTimeString(), method, url, status, body, error });
  if (logs.length > 30) logs.pop();
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem('token') || '';
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

function onFileChange(file) {
  rawFile.value = file.raw || file;
  adaptNote.value = '';
}

/** 客户端适配（复刻编排路由）：改 sheet 名 + 填记录状态，返回新 File。 */
async function adaptXlsx(file) {
  const wb = XLSX.read(await file.arrayBuffer());
  const firstName = wb.SheetNames[0];
  if (firstName !== SHEET_NAME) {
    // SheetJS 改名必须同步两处：SheetNames 数组 + Sheets 字典键。
    // 只改数组会导致 wb.Sheets[SHEET_NAME] 为 undefined → 空表 → 后端「缺少必需表头」
    wb.Sheets[SHEET_NAME] = wb.Sheets[firstName];
    delete wb.Sheets[firstName];
    wb.SheetNames[wb.SheetNames.indexOf(firstName)] = SHEET_NAME;
  }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET_NAME], { header: 1, defval: '' });
  const header = Array.isArray(rows[0]) ? rows[0] : [];
  const statusIdx = header.indexOf(STATUS_HEADER);
  if (statusIdx < 0) {
    // 缺「记录状态」列不在此处拦截：让后端 422 报完整缺失清单
    adaptNote.value = `已改 sheet 名；未找到「${STATUS_HEADER}」列，状态填充跳过`;
  } else {
    let filled = 0;
    for (let r = 1; r < rows.length; r++) {
      if (Array.isArray(rows[r]) && rows[r].length) { rows[r][statusIdx] = PUBLISHED; filled++; }
    }
    adaptNote.value = `已改 sheet 名「${SHEET_NAME}」，${filled} 行记录状态填「${PUBLISHED}」`;
  }
  wb.Sheets[SHEET_NAME] = XLSX.utils.aoa_to_sheet(rows);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const name = (file.name || 'import.xlsx').replace(/\.xlsx$/i, '') + '_adapted.xlsx';
  return new File([out], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ── 步骤①：excel 校验 ──
async function uploadExcel() {
  if (!rawFile.value || uploading.value) return;
  uploading.value = true;
  batch.value = null; commitResult.value = null; errorRows.value = [];
  try {
    let file = rawFile.value;
    if (adapt.value) {
      file = await adaptXlsx(file);
      ElMessage.info(adaptNote.value || '已适配');
    }
    const form = new FormData();
    form.append('file', file);
    form.append('target_space_code', 'OFFICIAL_PUBLIC');
    form.append('strict', 'true');
    const url = `${base.value}/api/v1/knowledge/admin/imports/excel`;
    const r = await fetch(url, { method: 'POST', headers: authHeaders(), body: form });
    const d = await r.json().catch(() => ({}));
    log('POST', url, r.status, d);
    if (!r.ok) throw new Error(typeof d?.detail === 'string' ? d.detail : `HTTP ${r.status}`);
    batch.value = d;
    if (d.error_rows > 0) await fetchErrorRows();
    ElMessage.success(`校验完成：${d.valid_rows ?? '?'}/${d.total_rows ?? '?'} 行有效（${d.status}）`);
  } catch (e) {
    ElMessage.error(e?.message || '上传校验失败');
  } finally {
    uploading.value = false;
  }
}

// ── 步骤②：commit ──
async function commitImport() {
  if (!committable.value || committing.value) return;
  committing.value = true;
  try {
    const url = `${base.value}/api/v1/knowledge/admin/imports/${encodeURIComponent(importId.value)}/commit`;
    const r = await fetch(url, { method: 'POST', headers: authHeaders() });
    const d = await r.json().catch(() => ({}));
    log('POST', url, r.status, d);
    if (!r.ok) throw new Error(typeof d?.detail === 'string' ? d.detail : `HTTP ${r.status}`);
    commitResult.value = d;
    batch.value = { ...batch.value, ...d };
    const failed = Array.isArray(d.dispatch_failed_job_ids) ? d.dispatch_failed_job_ids.length : 0;
    ElMessage.success(`已提交：${d.committed_rows ?? '?'} 行落库，状态 ${d.status}${failed ? `（${failed} 个索引任务投递失败）` : ''}`);
  } catch (e) {
    ElMessage.error(e?.message || '提交失败');
  } finally {
    committing.value = false;
  }
}

async function refreshBatch() {
  if (!importId.value || refreshing.value) return;
  refreshing.value = true;
  try {
    const url = `${base.value}/api/v1/knowledge/admin/imports/${encodeURIComponent(importId.value)}`;
    const r = await fetch(url, { headers: authHeaders() });
    const d = await r.json().catch(() => ({}));
    log('GET', url, r.status, d);
    if (!r.ok) throw new Error(typeof d?.detail === 'string' ? d.detail : `HTTP ${r.status}`);
    batch.value = { ...batch.value, ...d };
    ElMessage.success(`批次状态：${d.status}（索引 ${d.indexed_rows ?? 0}/${d.committed_rows ?? '?'}）`);
  } catch (e) {
    ElMessage.error(e?.message || '刷新失败');
  } finally {
    refreshing.value = false;
  }
}

async function fetchErrorRows() {
  if (!importId.value || fetchingRows.value) return;
  fetchingRows.value = true;
  try {
    const url = `${base.value}/api/v1/knowledge/admin/imports/${encodeURIComponent(importId.value)}/rows?status=error`;
    const r = await fetch(url, { headers: authHeaders() });
    const d = await r.json().catch(() => ({}));
    log('GET', url, r.status, d);
    if (r.ok && Array.isArray(d.rows)) {
      errorRows.value = d.rows;
      if (d.rows.length) ElMessage.warning(`${d.rows.length} 行校验失败，见下方明细`);
    }
  } finally {
    fetchingRows.value = false;
  }
}
</script>

<template>
  <div class="kb-test">
    <header class="kb-test-head">
      <h1>知识库导入接口测试</h1>
      <p>两步式：① excel 校验（返回 import_id）→ ② commit 提交 + 投递索引。需登录态且角色含 knowledge:manage。</p>
    </header>

    <el-card shadow="never">
      <template #header>请求目标</template>
      <el-radio-group v-model="base">
        <el-radio-button v-for="b in BASES" :key="b.value" :value="b.value">{{ b.label }}</el-radio-button>
      </el-radio-group>
    </el-card>

    <el-card shadow="never">
      <template #header>① 校验导入（POST /admin/imports/excel）</template>
      <div class="row">
        <el-upload :auto-upload="false" :limit="1" accept=".xlsx" :on-change="onFileChange">
          <el-button>选择 xlsx 文件</el-button>
        </el-upload>
        <span v-if="rawFile" class="file-name">{{ rawFile.name }}</span>
      </div>
      <div class="row">
        <el-checkbox v-model="adapt">上传前适配（sheet 名改「{{ SHEET_NAME }}」+ 记录状态填「{{ PUBLISHED }}」）</el-checkbox>
      </div>
      <div class="row">
        <el-button type="primary" :loading="uploading" :disabled="!rawFile" @click="uploadExcel">校验导入</el-button>
        <span v-if="adaptNote" class="hint">{{ adaptNote }}</span>
      </div>
    </el-card>

    <el-card v-if="batch" shadow="never">
      <template #header>批次结果（import_id: {{ importId }}）</template>
      <el-descriptions :column="4" border size="small">
        <el-descriptions-item label="状态">{{ batch.status }}</el-descriptions-item>
        <el-descriptions-item label="总行数">{{ batch.total_rows }}</el-descriptions-item>
        <el-descriptions-item label="有效">{{ batch.valid_rows }}</el-descriptions-item>
        <el-descriptions-item label="错误">{{ batch.error_rows }}</el-descriptions-item>
        <el-descriptions-item label="警告">{{ batch.warning_rows }}</el-descriptions-item>
        <el-descriptions-item label="已提交">{{ batch.committed_rows }}</el-descriptions-item>
        <el-descriptions-item label="已索引">{{ batch.indexed_rows }}</el-descriptions-item>
        <el-descriptions-item label="空间">{{ batch.target_space_code }}</el-descriptions-item>
      </el-descriptions>
      <p v-if="batch.error_message" class="error-msg">{{ batch.error_message }}</p>
      <div class="row">
        <el-button type="primary" :loading="committing" :disabled="!committable" @click="commitImport">
          ② 提交索引（commit）
        </el-button>
        <el-button :loading="refreshing" :disabled="!importId" @click="refreshBatch">刷新批次状态</el-button>
        <el-button :loading="fetchingRows" :disabled="!importId" @click="fetchErrorRows">拉取错误行明细</el-button>
        <span v-if="!committable && batch.status" class="hint">状态 {{ batch.status }} 不可提交（需 validated）</span>
      </div>
      <div v-if="commitResult" class="commit-result">
        <strong>commit 响应：</strong>
        <pre>index_job_ids: {{ commitResult.index_job_ids }}</pre>
        <pre>dispatch_failed_job_ids: {{ commitResult.dispatch_failed_job_ids }}</pre>
      </div>
      <el-table v-if="errorRows.length" :data="errorRows" size="small" border max-height="300">
        <el-table-column prop="row_no" label="行号" width="70" />
        <el-table-column label="错误">
          <template #default="{ row }">{{ (row.errors || []).join('；') }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never">
      <template #header>请求日志（{{ logs.length }}）</template>
      <el-empty v-if="!logs.length" description="暂无请求" :image-size="60" />
      <div v-for="(item, i) in logs" :key="i" class="log-item">
        <div class="log-head">
          <el-tag size="small" :type="item.status >= 200 && item.status < 300 ? 'success' : 'danger'">{{ item.status }}</el-tag>
          <span class="log-method">{{ item.method }}</span>
          <span class="log-url">{{ item.url }}</span>
          <span class="log-time">{{ item.time }}</span>
        </div>
        <pre class="log-body">{{ typeof item.body === 'string' ? item.body : JSON.stringify(item.body, null, 2) }}</pre>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.kb-test { max-width: 920px; margin: 0 auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.kb-test-head h1 { font-size: 20px; margin: 0 0 6px; }
.kb-test-head p { font-size: 13px; color: var(--el-text-color-secondary); margin: 0; }
.row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 10px; }
.row:first-of-type { margin-top: 0; }
.file-name { font-size: 13px; color: var(--el-text-color-regular); word-break: break-all; }
.hint { font-size: 12px; color: var(--el-text-color-secondary); }
.error-msg { color: var(--el-color-danger); font-size: 13px; word-break: break-all; margin: 10px 0 0; }
.commit-result { margin-top: 10px; font-size: 13px; }
.commit-result pre { margin: 4px 0; padding: 8px; background: var(--el-fill-color-light); border-radius: 4px; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
.log-item { border-bottom: 1px solid var(--el-border-color-lighter); padding: 8px 0; }
.log-head { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.log-method { font-weight: 600; }
.log-url { color: var(--el-text-color-secondary); word-break: break-all; }
.log-time { margin-left: auto; color: var(--el-text-color-placeholder); flex: none; }
.log-body { margin: 6px 0 0; padding: 8px; background: var(--el-fill-color-light); border-radius: 4px; font-size: 12px; max-height: 220px; overflow: auto; white-space: pre-wrap; word-break: break-all; }
</style>
