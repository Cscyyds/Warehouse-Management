import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
defineOptions({ name: "PdfReviewWorkbench" });
const props = defineProps({
  embedded: { type: Boolean, default: false }
});
const API = {
  upload: "/api/v1/files/upload/pdf",
  start: "/api/v1/pdf-workflow/start",
  review: "/api/v1/plugin/pdf/jobs/{job_id}/review",
  reply: "/api/v1/pdf-workflow/resume"
};
const CLOUD_API_BASE = String(import.meta.env.VITE_PDF_API_BASE || "").trim().replace(/\/+$/, "");
function allowedBase(origin) {
  return !origin || origin === location.origin || !!CLOUD_API_BASE && origin === CLOUD_API_BASE;
}
const reviewBase = ref("");
function originOf(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.origin : "";
  } catch {
    return "";
  }
}
function adoptReviewBase(url) {
  if (reviewBase.value) return;
  const origin = originOf(url);
  if (origin && allowedBase(origin)) reviewBase.value = origin;
}
function reviewBases() {
  return [reviewBase.value, "", CLOUD_API_BASE].filter((v, i, a) => a.indexOf(v) === i);
}
function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || "";
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}
const phase = ref("upload");
const statusMode = ref("waiting");
const statusText = ref("\u7B49\u5F85\u4E0A\u4F20");
const file = ref(null);
const pdfUrl = ref("");
const pdfName = ref("");
const jobId = ref("");
const eventId = ref("");
const message = ref("\u6B63\u5728\u51C6\u5907\u5DE5\u4F5C\u6D41\u2026");
const batches = ref([]);
const batchIndex = ref(0);
const decisions = ref({});
const toast = ref("");
const toastError = ref(false);
const CROP_ZOOM_MAX = 8;
function blankCrop() {
  return { open: false, index: -1, box: null, start: null, zoom: 1, fitW: 0, drag: null, grab: null, base: null, handle: "", hover: "", mode: "" };
}
const crop = ref(blankCrop());
const cropStage = ref(null);
const cropImage = ref(null);
const result = ref({});
const activity = ref([]);
const retryCount = ref(0);
const submitting = ref(false);
const reviewMode = ref("manual");
const autoRest = ref(false);
const hasEnteredReview = ref(false);
const exportState = ref({ state: "", fileName: "", downloadUrl: "", tableId: "", tableName: "", error: "" });
function blankKbState() {
  return { state: "", importId: "", base: "", summary: null, errorRows: [], commitResult: null, error: "" };
}
const kbState = ref(blankKbState());
const restored = ref(false);
const snapshotProducts = ref([]);
const publish = ref({ status: "", processed: 0, failed: 0, remaining: 0, hasMore: false, retrying: false, driving: false });
let activeAbort = null;
let statusTimer = null;
let snapshotMissWarnedFor = "";
const RECENT_JOBS_KEY = "pdf_review_recent_jobs";
const JOB_STATUS_HINTS = {
  ready: "\u5904\u7406\u4E2D",
  processing: "\u5904\u7406\u4E2D",
  merging: "\u5904\u7406\u4E2D",
  review_pending: "\u5F85\u5BA1\u6838",
  publishing: "\u53D1\u5E03\u4E2D",
  publish_partial: "\u90E8\u5206\u5931\u8D25",
  published: "\u5DF2\u5B8C\u6210",
  failed: "\u5931\u8D25",
  canceled: "\u5DF2\u53D6\u6D88"
};
const recentJobs = ref(loadRecentJobs());
function loadRecentJobs() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_JOBS_KEY) || "[]");
    return Array.isArray(list) ? list.filter((x) => x && x.job_id).slice(0, 20) : [];
  } catch {
    return [];
  }
}
function saveRecentJobs() {
  try {
    localStorage.setItem(RECENT_JOBS_KEY, JSON.stringify(recentJobs.value));
  } catch {
  }
}
function rememberJob(jobIdToRecord, hint) {
  if (!jobIdToRecord) return;
  const existing = recentJobs.value.find((x) => x.job_id === jobIdToRecord);
  if (existing) {
    if (hint) existing.hint = hint;
    if (pdfName.value) existing.pdf_name = pdfName.value;
  } else {
    recentJobs.value.unshift({ job_id: jobIdToRecord, pdf_name: pdfName.value || "PDF document", hint: hint || "\u5904\u7406\u4E2D", added_at: Date.now() });
    recentJobs.value = recentJobs.value.slice(0, 20);
  }
  saveRecentJobs();
}
function forgetJob(jobIdToForget) {
  recentJobs.value = recentJobs.value.filter((x) => x.job_id !== jobIdToForget);
  saveRecentJobs();
}
const MAX_PARSE_RETRY = 3;
const retryInfo = computed(() => ({
  active: retryCount.value > 0,
  current: retryCount.value,
  max: MAX_PARSE_RETRY
}));
const items = computed(() => batches.value[batchIndex.value]?.items || []);
const selected = computed(() => items.value.map((x) => decisions.value[x.source_crop_id]).filter(Boolean));
const ready = computed(() => items.value.length > 0 && selected.value.length === items.value.length);
const canStart = computed(() => !!(file.value || pdfUrl.value));
const fileLabel = computed(() => file.value ? `${file.value.name} \xB7 ${(file.value.size / 1048576).toFixed(2)} MB` : "");
const fileName = computed(() => file.value?.name || (pdfUrl.value ? "Remote PDF" : "PDF document"));
const fileUrlDisplay = computed(() => pdfUrl.value || "\u7B49\u5F85 BOS \u4E0A\u4F20");
const wSteps = ref([
  { key: "w1", label: "W1 \xB7 \u9875\u9762\u8BC6\u522B\u4E0E\u5019\u9009\u88C1\u56FE", state: "active" },
  { key: "w2", label: "W2 \xB7 \u4EA7\u54C1\u5408\u5E76\u4E0E\u9884\u89C8\u751F\u6210", state: "" },
  { key: "w3", label: "W3 \xB7 \u4EBA\u5DE5\u5BA1\u6838\u4E0E\u7ED3\u679C\u53D1\u5E03", state: "" }
]);
const productDataOutput = computed(() => pretty(result.value.product_data_json ?? result.value.products ?? []));
const imageUrlsOutput = computed(() => pretty(result.value.image_urls_json ?? result.value.image_urls ?? []));
const LABELS = {
  waiting: "\u7B49\u5F85\u4E0A\u4F20",
  busy: "\u5904\u7406\u4E2D",
  "waiting-review": "\u7B49\u5F85\u4EBA\u5DE5\u5BA1\u6838",
  done: "\u89E3\u6790\u5B8C\u6210",
  error: "\u6267\u884C\u5931\u8D25"
};
function setStatus(mode, text) {
  statusMode.value = mode;
  statusText.value = text || LABELS[mode];
}
let toastTimer = null;
function notify(v, error = false) {
  toast.value = v;
  toastError.value = error;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = "";
    toastTimer = null;
  }, 3200);
}
function addActivity(title, detail = "") {
  activity.value.unshift({ title, detail });
}
function parse(v) {
  if (v && typeof v === "object") return v;
  try {
    const x = JSON.parse(v);
    return typeof x === "string" ? JSON.parse(x) : x;
  } catch {
    return null;
  }
}
function pretty(v) {
  const x = parse(v) ?? v;
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(v);
  }
}
function choose(f) {
  if (!f) return;
  if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
    notify("\u8BF7\u9009\u62E9 PDF \u6587\u4EF6", true);
    return;
  }
  file.value = f;
  pdfUrl.value = "";
  pdfName.value = f.name;
  setStatus("waiting", "\u7B49\u5F85\u4E0A\u4F20");
  addActivity("\u9009\u62E9\u6587\u4EF6", f.name);
}
function useUrl(u) {
  if (!/^https?:\/\//i.test(u)) {
    notify("\u8BF7\u8F93\u5165\u6709\u6548 URL", true);
    return;
  }
  file.value = null;
  pdfUrl.value = u;
  pdfName.value = u.split("/").pop()?.split("?")[0] || "document.pdf";
  addActivity("\u4F7F\u7528 URL", u);
}
function demo() {
  phase.value = "review";
  hasEnteredReview.value = true;
  statusMode.value = "waiting-review";
  statusText.value = "\u7B49\u5F85\u4EBA\u5DE5\u5BA1\u6838";
  eventId.value = "demo";
  batches.value = [{
    items: [
      {
        source_crop_id: "demo-1",
        product_name: "AVENTOS HF",
        image_type: "structure",
        pdf_page_number: 2,
        description: "\u7ED3\u6784\u7206\u70B8\u56FE\uFF0C\u5C55\u793A HF \u4E0A\u7FFB\u95E8\u4E94\u91D1\u7EC4\u4EF6\u3002",
        preview_url: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900",
        page_preview_url: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1600",
        pdf_bbox: [0.08, 0.12, 0.62, 0.58]
      },
      {
        source_crop_id: "demo-2",
        product_name: "SERVO-DRIVE",
        image_type: "detail",
        pdf_page_number: 6,
        description: "\u4EA7\u54C1\u7EC6\u8282\u793A\u610F\u56FE\u3002",
        preview_url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900",
        page_preview_url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600",
        // W1 页面预览兜底 + 拆页场景（逻辑页 = 物理页右侧 75%）：
        // 演示 normalizeReviewItems 由 page_analysis_id 推导 w1_page_url 的降级形态
        w1_page_url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1400",
        source_bbox: [0.25, 0, 1, 1],
        pdf_bbox: [0.3, 0.25, 0.85, 0.75]
      }
    ]
  }];
  addActivity("\u52A0\u8F7D\u754C\u9762\u793A\u4F8B");
}
async function uploadFile() {
  const f = new FormData();
  f.append("file", file.value);
  const r = await fetch(API.upload, { method: "POST", headers: authHeaders(), body: f });
  if (!r.ok) throw new Error(r.status === 401 ? "\u767B\u5F55\u72B6\u6001\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" : "\u6587\u4EF6\u4E0A\u4F20\u672A\u6210\u529F\uFF0C\u8BF7\u91CD\u8BD5");
  const data = await r.json();
  pdfUrl.value = data.file_url;
  pdfName.value = data.file_name || pdfName.value;
  if (!pdfUrl.value) throw new Error("\u6587\u4EF6\u4E0A\u4F20\u672A\u6210\u529F\uFF0C\u8BF7\u91CD\u8BD5");
}
async function startWorkFlow(retryJobId = "") {
  activeAbort = new AbortController();
  const r = await fetch(API.start, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json", Accept: "text/event-stream" }),
    signal: activeAbort.signal,
    body: JSON.stringify({
      // Coze 约定：job_id 复用已有任务时 pdf_url 必须传空，否则工作流入参校验报错
      pdf_url: retryJobId ? "" : (pdfUrl.value || "").trim(),
      pdf_name: pdfName.value,
      job_id: retryJobId,
      // 审核方式：上传页选择 manual/auto_approve；审核中途「转自动审核」后，
      // 后续任何 /start（含失败自动重试）都以 auto_approve 重跑，与前端 autoRest 行为一致
      review_mode: autoRest.value ? "auto_approve" : reviewMode.value,
      token: localStorage.getItem("token") || ""
    })
  });
  if (!r.ok) {
    let msg = r.status === 401 ? "\u767B\u5F55\u72B6\u6001\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" : `\u542F\u52A8\u672A\u6210\u529F\uFF08HTTP ${r.status}\uFF09`;
    try {
      const err = await r.json();
      const detail = Array.isArray(err.detail) ? err.detail.map((x) => `${(x.loc || []).slice(1).join(".")}: ${x.msg}`).join("\uFF1B") : typeof err.detail === "string" ? err.detail : "";
      if (detail) msg = `\u542F\u52A8\u88AB\u62D2\u7EDD\uFF1A${detail}`;
    } catch {
    }
    throw new Error(msg);
  }
  await sse(r);
}
async function start() {
  try {
    phase.value = "processing";
    setStatus("busy", "\u6B63\u5728\u4E0A\u4F20");
    reviewBase.value = "";
    restored.value = false;
    autoRest.value = false;
    hasEnteredReview.value = false;
    snapshotProducts.value = [];
    if (file.value) await uploadFile();
    if (!pdfUrl.value) throw new Error("\u8BF7\u9009\u62E9 PDF \u6216\u586B\u5199 URL");
    setStatus("busy", "\u5DE5\u4F5C\u6D41\u5904\u7406\u4E2D");
    addActivity("\u4E0A\u4F20\u5B8C\u6210", file.value?.name || "BOS URL");
    retryCount.value = 0;
    await startWorkFlow("");
  } catch (e) {
    if (e?.name === "AbortError") return;
    phase.value = "upload";
    setStatus("waiting", "\u7B49\u5F85\u4E0A\u4F20");
    notify(e.message || "\u542F\u52A8\u672A\u6210\u529F\uFF0C\u8BF7\u91CD\u8BD5", true);
  }
}
async function retryParse() {
  if (retryCount.value >= MAX_PARSE_RETRY) {
    phase.value = "upload";
    setStatus("error", "\u89E3\u6790\u672A\u5B8C\u6210");
    notify("\u672C\u6B21\u89E3\u6790\u672A\u80FD\u5B8C\u6210\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77\u4EFB\u52A1", true);
    return;
  }
  retryCount.value += 1;
  const reusedJobId = jobId.value;
  if (!reusedJobId && !(pdfUrl.value || "").trim()) {
    phase.value = "upload";
    setStatus("error", "\u89E3\u6790\u672A\u5B8C\u6210");
    notify("\u672C\u6B21\u89E3\u6790\u672A\u80FD\u5B8C\u6210\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77\u4EFB\u52A1", true);
    return;
  }
  phase.value = "processing";
  setStatus("busy", `\u91CD\u8BD5\u4E2D\uFF08${retryCount.value}/${MAX_PARSE_RETRY}\uFF09`);
  message.value = `\u91CD\u8BD5\u4E2D\uFF08\u7B2C ${retryCount.value}/${MAX_PARSE_RETRY} \u6B21\uFF09\uFF0C\u5DF2\u5B8C\u6210\u7684\u8FDB\u5EA6\u4F1A\u4FDD\u7559\u2026`;
  addActivity(`\u91CD\u8BD5\u4E2D ${retryCount.value}/${MAX_PARSE_RETRY}`, reusedJobId ? "\u7EE7\u7EED\u5904\u7406\u5269\u4F59\u5185\u5BB9" : "\u91CD\u65B0\u53D1\u8D77\u89E3\u6790");
  if (!reusedJobId) {
    wSteps.value[0].state = "active";
    wSteps.value[1].state = "";
    wSteps.value[2].state = "";
  }
  try {
    await startWorkFlow(reusedJobId);
  } catch (e) {
    if (e?.name === "AbortError") return;
    await retryParse();
  }
}
async function sse(r) {
  const rd = r.body?.getReader();
  if (!rd) throw new Error("stream unavailable");
  const td = new TextDecoder();
  let b = "";
  let stop = false;
  while (!stop) {
    const x = await rd.read();
    if (x.done) break;
    b += td.decode(x.value, { stream: true });
    const a = b.split(/\n\n/);
    b = a.pop() || "";
    for (const ev of a) {
      if (!ev.trim()) continue;
      if (await event(ev)) {
        stop = true;
        break;
      }
    }
  }
  if (!stop && b.trim()) await event(b);
  try {
    await rd.cancel();
  } catch {
  }
}
async function event(block) {
  let name = "message";
  const dataLines = [];
  block.split(/\r?\n/).forEach((l) => {
    if (l.startsWith("event:")) name = l.slice(6).trim();
    else if (l.startsWith("data:")) dataLines.push(l.slice(5).trimStart());
  });
  const raw = dataLines.join("\n").trim();
  if (!raw) return;
  let d = parse(raw) || {};
  if (d.job_id) {
    jobId.value = d.job_id;
    rememberJob(jobId.value);
  }
  if (name === "message") {
    const isReviewQuestion = /问答/.test(d.node_title || "") || /请审核以下候选图片|请选择[：:]通过/.test(d.content || d.message || "");
    message.value = isReviewQuestion ? "\u6B63\u5728\u7B49\u5F85\u56FE\u7247\u5BA1\u6838\u6570\u636E\u2026" : d.content || d.message || "\u5DE5\u4F5C\u6D41\u5904\u7406\u4E2D";
    const text = message.value + " " + (d.node_title || "");
    if (/W2|merge|product/i.test(text)) {
      wSteps.value[0].state = "done";
      wSteps.value[1].state = "active";
    }
    if (/W3|review/i.test(text)) {
      wSteps.value[1].state = "done";
      wSteps.value[2].state = "active";
    }
    addActivity(
      isReviewQuestion ? "\u95EE\u7B54\u8282\u70B9\u63D0\u95EE\uFF08\u5DF2\u5C4F\u853D\uFF09" : d.node_title || "Workflow",
      isReviewQuestion ? "\u5BA1\u6838\u5F15\u5BFC\u6587\u672C\u4E0D\u5728\u6B64\u5C55\u793A\uFF0C\u7B49\u5F85\u5BA1\u6838\u9762\u677F\u52A0\u8F7D" : message.value
    );
  } else if (name === "interrupt") {
    eventId.value = d.event_id || "";
    statusMode.value = "waiting-review";
    statusText.value = "\u7B49\u5F85\u4EBA\u5DE5\u5BA1\u6838";
    wSteps.value[2].state = "active";
    rememberJob(jobId.value, "\u5F85\u5BA1\u6838");
    phase.value = "review";
    hasEnteredReview.value = true;
    await loadReview(d);
    return true;
  } else if (name === "done") {
    result.value = parse(d.full_content) || d;
    wSteps.value.forEach((s) => s.state = "done");
    phase.value = "completed";
    setStatus("done");
    rememberJob(jobId.value, "\u5DF2\u5B8C\u6210");
    rememberBitable(result.value);
    await loadFinalResult();
    if (publish.value.status === "publishing") pollFinalUntilDone();
    return true;
  } else if (name === "error") {
    await retryParse();
    return true;
  }
  return false;
}
async function loadFinalResult() {
  if (!jobId.value) return "";
  for (const base of reviewBases()) {
    try {
      const r = await fetch(`${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/final-result`, { headers: authHeaders() });
      if (!r.ok) continue;
      const d = await r.json();
      const parsed = parse(d.result_json);
      if (!parsed) continue;
      if (base) reviewBase.value = base;
      publish.value = {
        ...publish.value,
        status: d.status ?? "",
        processed: d.image_count ?? 0,
        failed: d.failed_count ?? 0,
        remaining: 0
      };
      rememberJob(jobId.value, JOB_STATUS_HINTS[d.status] || "");
      rememberBitable(parsed);
      applyServerExport(parsed);
      result.value = {
        ...result.value,
        product_count: d.product_count ?? parsed.products?.length ?? 0,
        image_count: d.image_count ?? 0,
        status: d.status ?? parsed.status ?? "",
        product_data_json: pretty(parsed.products ?? []),
        image_urls_json: pretty(
          (parsed.products ?? []).flatMap((p) => (p.product_images ?? []).map((img) => img.image_url))
        ),
        message: d.failed_count > 0 ? `\u53D1\u5E03\u5B8C\u6210\uFF0C${d.failed_count} \u5F20\u56FE\u7247\u6E32\u67D3\u5931\u8D25\u3002` : "\u6240\u6709\u5019\u9009\u56FE\u7247\u5DF2\u5BA1\u6838\u53D1\u5E03\uFF0C\u7ED3\u679C\u5982\u4E0B\u3002"
      };
      return d.status ?? "";
    } catch {
      continue;
    }
  }
  return "";
}
function extractJobId(text) {
  const m = String(text || "").match(/\/api\/v1\/plugin\/pdf\/jobs\/([a-f0-9]{32})\//i);
  return m ? m[1] : "";
}
function parseItemsFromText(text) {
  const raw = String(text || "");
  if (!raw) return [];
  const items2 = [];
  const blocks = raw.split(/\n(?=图片\d+\n)/g);
  for (const block of blocks) {
    const head = block.match(/^图片(\d+)\s*\n/);
    if (!head) continue;
    const img = block.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
    if (!img) continue;
    const name = block.match(/产品名称：(.+)/);
    const page = block.match(/来源 PDF 页码：第\s*(\d+)\s*页/);
    const desc = block.match(/图片描述：(.+)/);
    const bbox = block.match(/当前裁剪区域：\[([^\]]+)\]/);
    const url = new URL(img[1], window.location.origin);
    items2.push({
      source_crop_id: decodeURIComponent(url.pathname.split("/").pop()),
      preview_url: url.origin + url.pathname,
      product_name: name ? name[1].trim() : "",
      image_type: (block.match(/图片类型：(\w+)/) || [])[1] || "other",
      pdf_page_number: page ? Number(page[1]) : 0,
      description: desc ? desc[1].trim() : "",
      pdf_bbox: bbox ? bbox[1].split(",").map((v) => parseFloat(v.trim())) : void 0
    });
  }
  return items2;
}
function findReviewItems(value, depth = 0) {
  if (!value || depth > 4) return null;
  if (typeof value === "string") {
    const parsed = parse(value);
    return parsed && parsed !== value ? findReviewItems(parsed, depth + 1) : null;
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      const found = findReviewItems(v, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    if (Array.isArray(value.items) && value.items.length) return value;
    if (typeof value.content === "string" || value.content != null) {
      const found = findReviewItems(value.content, depth + 1);
      if (found) return found;
    }
    if (value.data != null) {
      const found = findReviewItems(value.data, depth + 1);
      if (found) return found;
    }
  }
  return null;
}
function pickField(item, crop2, ...keys) {
  for (const k of keys) {
    if (item?.[k] != null && item[k] !== "") return item[k];
    if (crop2?.[k] != null && crop2[k] !== "") return crop2[k];
  }
  return void 0;
}
function normalizeReviewItems(list, jobIdForAssets = "") {
  return list.map((item, idx) => {
    const crop2 = item?.crop && typeof item.crop === "object" ? item.crop : {};
    let preview = pickField(item, crop2, "preview_url");
    if (preview) adoptReviewBase(preview);
    const cropId = String(pickField(item, crop2, "source_crop_id") || "");
    const base = reviewBase.value || CLOUD_API_BASE;
    if (!preview && cropId && jobIdForAssets) {
      preview = `${base}/api/v1/plugin/pdf/jobs/${jobIdForAssets}/review/assets/${cropId}`;
    }
    const pageAnalysisId = String(pickField(item, crop2, "page_analysis_id") || "");
    const sbRaw = pickField(item, crop2, "source_bbox");
    const sourceBbox = Array.isArray(sbRaw) && sbRaw.length === 4 && sbRaw.every((n) => typeof n === "number") ? sbRaw : [0, 0, 1, 1];
    return {
      source_crop_id: cropId,
      preview_url: preview || "",
      // 整页预览（重裁用）：网关规范化协议与旧后端均通过该接口按裁剪候选定位整页
      page_preview_url: cropId && jobIdForAssets ? `${base}/api/v1/plugin/pdf/jobs/${jobIdForAssets}/review/page-assets/${cropId}` : "",
      // W1 页面预览兜底（120dpi）：page-assets 不可用时按 page_analysis_id 定位；
      // 拆页场景该图为逻辑视图（clip=source_bbox），框选坐标需按 source_bbox 映射回物理页
      w1_page_url: pageAnalysisId && jobIdForAssets ? `${base}/api/v1/plugin/pdf/assets/${pageAnalysisId}` : "",
      source_bbox: sourceBbox,
      product_name: String(pickField(item, crop2, "product_name") || ""),
      image_type: String(pickField(item, crop2, "image_type") || "other"),
      pdf_page_number: Number(pickField(item, crop2, "pdf_page_number") || 0),
      description: String(pickField(item, crop2, "description") || ""),
      pdf_bbox: pickField(item, crop2, "pdf_bbox")
    };
  }).filter((x) => x.source_crop_id);
}
function ownerBaseOf(url) {
  if (!url) return null;
  try {
    const u = new URL(url, location.origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin === location.origin ? "" : u.origin;
  } catch {
    return null;
  }
}
function warnSnapshotUnavailable(sawNotFound) {
  if (!jobId.value || snapshotMissWarnedFor === jobId.value) return;
  snapshotMissWarnedFor = jobId.value;
  const shortId = jobId.value.slice(0, 8);
  if (sawNotFound) {
    notify("\u5BA1\u6838\u6570\u636E\u6E90\u65E0\u6B64\u4EFB\u52A1\uFF0C\u8BF7\u68C0\u67E5\u5B9E\u4F8B\u914D\u7F6E", true);
    addActivity(
      "\u5BA1\u6838\u5FEB\u7167\u6E90\u4E0D\u5339\u914D",
      `\u4EFB\u52A1 ${shortId}\u2026 \u5728\u5019\u9009\u5B9E\u4F8B\u5747\u8FD4\u56DE 404\uFF08\u4EFB\u52A1\u4E0D\u5B58\u5728\uFF09\u3002\u5E38\u89C1\u539F\u56E0\uFF1A\u5DE5\u4F5C\u6D41\u5728\u4E91\u7AEF\u5B9E\u4F8B\u5EFA\u4EFB\u52A1\uFF0C\u800C\u9875\u9762\u8BFB\u5FEB\u7167\u8D70\u4E86\u672C\u5730\u540C\u6E90\u3002\u8BF7\u628A VITE_PDF_API_BASE \u6307\u5411\u5EFA\u4EFB\u52A1\u5B9E\u4F8B\uFF0C\u5E76\u786E\u8BA4 vite \u7684 PDF \u4EE3\u7406\u76EE\u6807\u4E00\u81F4\u3002`
    );
    return;
  }
  notify("\u5BA1\u6838\u5FEB\u7167\u8BFB\u53D6\u5931\u8D25\uFF1A\u5B9E\u4F8B\u4E0D\u53EF\u8FBE", true);
  addActivity(
    "\u5BA1\u6838\u5FEB\u7167\u6E90\u4E0D\u53EF\u8FBE",
    `\u4EFB\u52A1 ${shortId}\u2026 \u7684\u5019\u9009\u5B9E\u4F8B\u8BF7\u6C42\u5F02\u5E38\u6216\u5FEB\u7167\u5C1A\u672A\u751F\u6210\uFF1B\u8BF7\u786E\u8BA4\u7F51\u5173\u5DF2\u542F\u52A8\u3001\u7F51\u7EDC\u53EF\u8FBE\u3002`
  );
}
async function fetchReviewSnapshot() {
  if (!jobId.value) return null;
  let sawNotFound = false;
  for (const base of reviewBases()) {
    try {
      const r = await fetch(`${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/review`, { headers: authHeaders() });
      if (!r.ok) {
        if (r.status === 404) sawNotFound = true;
        continue;
      }
      const d = await r.json();
      const snap = parse(d.review_json) || d;
      if (snap?.crop_bindings?.length) {
        const owner = ownerBaseOf(snap.crop_bindings.find((b) => b.preview_url)?.preview_url);
        const safeBase = base === "" || /^https?:\/\//.test(base) ? base : "";
        const adopted = owner !== null && allowedBase(owner) ? owner : safeBase;
        reviewBase.value = allowedBase(adopted) ? adopted : "";
        return snap;
      }
    } catch {
      continue;
    }
  }
  warnSnapshotUnavailable(sawNotFound);
  return null;
}
async function loadReview(i = {}) {
  try {
    const container = i.review && Array.isArray(i.review.items) && i.review.items.length ? i.review : findReviewItems(i.raw?.interrupt_data?.data) || findReviewItems(i.review_json) || findReviewItems(i.message);
    if (container?.items?.length) {
      if (!jobId.value) jobId.value = extractJobId(JSON.stringify(container)) || i.review?.job_id || "";
      const needsEnrich = container.items.some((x) => !(x?.page_analysis_id || x?.crop?.page_analysis_id));
      if (needsEnrich) {
        const snap2 = await fetchReviewSnapshot();
        if (snap2?.crop_bindings?.length) {
          const byId = new Map(snap2.crop_bindings.map((b) => [b.source_crop_id, b]));
          container.items.forEach((x) => {
            const target = x?.crop ? x.crop : x;
            const b = byId.get(target.source_crop_id);
            if (!b) return;
            if (!target.page_analysis_id) target.page_analysis_id = b.page_analysis_id || "";
            if (!target.source_bbox && b.source_bbox) target.source_bbox = b.source_bbox;
          });
        }
      }
      const items3 = normalizeReviewItems(container.items, jobId.value);
      batches.value = [];
      for (let n = 0; n < items3.length; n += 8) batches.value.push({ items: items3.slice(n, n + 8) });
      if (!batches.value.length) batches.value = [{ items: [] }];
      decisions.value = {};
      batchIndex.value = 0;
      addActivity("\u5BA1\u6838\u6570\u636E\u5DF2\u52A0\u8F7D", `${items3.length} \u5F20\u56FE\u7247`);
      if (autoRest.value) setTimeout(() => {
        autoApproveRest();
      }, 0);
      return;
    }
    const questionText = i.message || i.raw?.interrupt_data?.data?.content || "";
    if (!jobId.value) {
      jobId.value = extractJobId(questionText) || extractJobId(i.raw ? JSON.stringify(i.raw) : "");
    }
    const snap = await fetchReviewSnapshot();
    const pending = (snap?.crop_bindings || []).filter((x) => !x.review_action);
    const items2 = pending.length ? normalizeReviewItems(pending, jobId.value) : normalizeReviewItems(parseItemsFromText(questionText), jobId.value);
    batches.value = [];
    for (let n = 0; n < items2.length; n += 8) batches.value.push({ items: items2.slice(n, n + 8) });
    if (!batches.value.length) batches.value = [{ items: [] }];
    decisions.value = {};
    batchIndex.value = 0;
    if (items2.length) addActivity("\u5BA1\u6838\u6570\u636E\u5DF2\u52A0\u8F7D", items2.length + " \u5F20\u56FE\u7247");
    else addActivity("\u5F53\u524D\u6279\u6B21\u65E0\u5F85\u5BA1\u56FE\u7247");
    if (autoRest.value && items2.length) setTimeout(() => {
      autoApproveRest();
    }, 0);
  } catch {
    addActivity("\u5BA1\u6838\u6570\u636E\u52A0\u8F7D\u4E2D\u65AD");
  }
}
const actionLabels = { approve: "\u901A\u8FC7", reject: "\u62D2\u7EDD", skip: "\u8DF3\u8FC7", recrop: "\u91CD\u88C1" };
function decide(item, action) {
  if (action === "recrop") {
    openCrop(items.value.indexOf(item));
    return;
  }
  decisions.value = { ...decisions.value, [item.source_crop_id]: { source_crop_id: item.source_crop_id, action } };
  addActivity("\u51B3\u7B56", `${actionLabels[action]} \xB7 ${item.product_name || ""}`.trim());
}
function approveAll() {
  items.value.forEach((x) => {
    decisions.value = { ...decisions.value, [x.source_crop_id]: { source_crop_id: x.source_crop_id, action: "approve" } };
  });
  addActivity("\u5168\u90E8\u901A\u8FC7", items.value.length + " \u5F20\u56FE\u7247");
}
function markAllApproved() {
  batches.value.flatMap((b) => b.items).forEach((x) => {
    decisions.value = { ...decisions.value, [x.source_crop_id]: { source_crop_id: x.source_crop_id, action: "approve" } };
  });
}
async function autoApproveRest() {
  if (submitting.value) return;
  batchIndex.value = 0;
  markAllApproved();
  addActivity("\u81EA\u52A8\u901A\u8FC7", `${selected.value.length} \u5F20\u56FE\u7247\uFF08\u8F6C\u81EA\u52A8\u5BA1\u6838\uFF09`);
  await submit();
}
async function switchToAuto() {
  if (autoRest.value) return;
  autoRest.value = true;
  addActivity("\u8F6C\u4E3A\u81EA\u52A8\u5BA1\u6838", "\u672C\u6279\u53CA\u540E\u7EED\u6279\u6B21\u4E0D\u518D\u4EBA\u5DE5\u786E\u8BA4");
  if (!submitting.value) await autoApproveRest();
}
async function submit() {
  if (submitting.value) return;
  if (restored.value) {
    await submitDirect();
    return;
  }
  if (!ready.value || !eventId.value) {
    notify("\u8BF7\u5B8C\u6210\u5F53\u524D\u6279\u6B21", true);
    return;
  }
  submitting.value = true;
  const payload = selected.value;
  try {
    const r = await fetch(API.reply, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json", Accept: "text/event-stream" }),
      body: JSON.stringify({ event_id: eventId.value, crops: payload })
    });
    if (!r.ok) {
      let detail = "";
      try {
        const j = await r.json();
        detail = j?.detail || j?.message || "";
      } catch {
      }
      notify(detail ? `\u63D0\u4EA4\u672A\u6210\u529F\uFF1A${detail}` : "\u63D0\u4EA4\u672A\u6210\u529F\uFF0C\u8BF7\u91CD\u8BD5", true);
      return;
    }
    eventId.value = "";
    phase.value = "processing";
    setStatus("busy", "\u5904\u7406\u4E2D");
    addActivity("\u63D0\u4EA4\u5BA1\u6838", `${payload.length} \u5F20\u56FE\u7247`);
    await sse(r);
  } catch {
    setStatus("waiting-review", "\u7B49\u5F85\u4EBA\u5DE5\u5BA1\u6838");
    notify("\u63D0\u4EA4\u672A\u6210\u529F\uFF0C\u8BF7\u91CD\u8BD5", true);
  } finally {
    submitting.value = false;
  }
}
function stopStatusPolling() {
  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
}
async function fetchJobStatus(id = jobId.value) {
  for (const base of reviewBases()) {
    try {
      const r = await fetch(`${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(id)}`, { headers: authHeaders() });
      if (!r.ok) continue;
      const d = await r.json();
      if (base) reviewBase.value = base;
      return d;
    } catch {
      continue;
    }
  }
  return null;
}
async function tryArchivedResult(id = jobId.value) {
  for (const base of reviewBases()) {
    try {
      const r = await fetch(`${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(id)}/final-result`, { headers: authHeaders() });
      if (!r.ok) continue;
      const d = await r.json();
      const parsed = parse(d.result_json);
      if (!parsed?.products) continue;
      if (base) reviewBase.value = base;
      restored.value = true;
      jobId.value = id;
      wSteps.value.forEach((s) => s.state = "done");
      publish.value = {
        ...publish.value,
        status: d.status ?? "published",
        processed: d.image_count ?? 0,
        failed: d.failed_count ?? 0,
        remaining: 0
      };
      result.value = {
        product_count: d.product_count ?? parsed.products?.length ?? 0,
        image_count: d.image_count ?? 0,
        status: d.status ?? parsed.status ?? "",
        product_data_json: pretty(parsed.products ?? []),
        image_urls_json: pretty(
          (parsed.products ?? []).flatMap((p) => (p.product_images ?? []).map((img) => img.image_url))
        ),
        message: d.failed_count > 0 ? `\u5F52\u6863\u7ED3\u679C\uFF1A\u53D1\u5E03\u5B8C\u6210\uFF0C${d.failed_count} \u5F20\u56FE\u7247\u6E32\u67D3\u5931\u8D25\u3002` : "\u5F52\u6863\u7ED3\u679C\uFF1A\u6240\u6709\u5019\u9009\u56FE\u7247\u5DF2\u5BA1\u6838\u53D1\u5E03\u3002"
      };
      phase.value = "completed";
      setStatus("done");
      addActivity("\u67E5\u770B\u5F52\u6863\u7ED3\u679C", `\u4EFB\u52A1\u68C0\u67E5\u70B9\u5DF2\u8FC7\u671F\uFF0C\u4ECE\u6301\u4E45\u5F52\u6863\u6062\u590D\uFF08${d.product_count ?? 0} \u4E2A\u4EA7\u54C1\uFF09`);
      rememberBitable(parsed);
      applyServerExport(parsed);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}
const TABLE_ID_KEYS = ["table_id", "bitable_table_id", "tableId", "feishu_table_id"];
const TABLE_NAME_KEYS = ["table_name", "bitable_table_name", "tableName", "feishu_table_name"];
function deepFindTableBinding(root, depth = 0) {
  if (!root || typeof root !== "object" || depth > 6) return null;
  for (const key of TABLE_ID_KEYS) {
    const raw = root[key];
    if (typeof raw === "string" && raw.trim()) {
      const name = TABLE_NAME_KEYS.map((k) => root[k]).find((v) => typeof v === "string" && v.trim()) || "";
      return { tableId: raw.trim(), tableName: String(name).trim() };
    }
  }
  for (const value of Object.values(root)) {
    if (typeof value === "string") {
      const nested = value.trim().startsWith("{") || value.trim().startsWith("[") ? parse(value) : null;
      const hit = nested ? deepFindTableBinding(nested, depth + 1) : null;
      if (hit) return hit;
    } else if (value && typeof value === "object") {
      const hit = deepFindTableBinding(value, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}
function rememberBitable(parsed) {
  const b = parsed?.bitable;
  let binding = b?.table_id ? { tableId: String(b.table_id), tableName: String(b.table_name || "") } : null;
  if (!binding) binding = deepFindTableBinding(parsed);
  if (!binding) binding = deepFindTableBinding(result.value);
  if (!binding?.tableId) return;
  exportState.value = { ...exportState.value, tableId: binding.tableId, tableName: binding.tableName };
}
function applyServerExport(parsed) {
  const rec = parsed?.export;
  if (!rec?.file_name) return;
  if (!["", "error"].includes(exportState.value.state)) return;
  exportState.value = {
    ...exportState.value,
    state: "ready",
    fileName: String(rec.file_name),
    downloadUrl: `${reviewBase.value || ""}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/export.xlsx`
  };
}
async function exportXlsx() {
  if (!jobId.value || exportState.value.state === "exporting") return;
  kbState.value = blankKbState();
  exportState.value = { ...exportState.value, state: "exporting", error: "" };
  addActivity("\u5BFC\u51FA Excel", "\u6B63\u5728\u4ECE\u98DE\u4E66\u591A\u7EF4\u8868\u683C\u5BFC\u51FA\u2026");
  const candidates = [reviewBase.value || "", ""].filter((v, i, a) => a.indexOf(v) === i);
  try {
    let lastDetail = "";
    for (const base of candidates) {
      const r = await fetch(`${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/export-xlsx`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          table_id: exportState.value.tableId || "",
          table_name: exportState.value.tableName || ""
        })
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        exportState.value = {
          state: "ready",
          fileName: d.file_name || "products.xlsx",
          // 下载与导出同实例（产物在执行实例本地磁盘）
          downloadUrl: `${base}${d.download_url}`,
          tableId: d.table_id || exportState.value.tableId || "",
          tableName: d.table_name || exportState.value.tableName || "",
          error: ""
        };
        addActivity("\u5BFC\u51FA\u5B8C\u6210", d.file_name || "");
        notify("Excel \u5DF2\u751F\u6210\uFF0C\u53EF\u76F4\u63A5\u4E0B\u8F7D");
        return;
      }
      lastDetail = typeof d?.detail === "string" ? d.detail : `\u5BFC\u51FA\u5931\u8D25\uFF08${r.status}\uFF09`;
      if (!(r.status === 404 && lastDetail === "Not Found")) throw new Error(lastDetail);
    }
    throw new Error(lastDetail || "\u5BFC\u51FA\u5931\u8D25");
  } catch (e) {
    exportState.value = { ...exportState.value, state: "error", error: e?.message || "\u5BFC\u51FA\u5931\u8D25" };
    notify(e?.message || "\u5BFC\u51FA\u5931\u8D25", true);
  }
}
function maybeAutoExport() {
  if ((publish.value.status === "published" || publish.value.status === "publish_partial") && exportState.value.state === "" && exportState.value.tableId) {
    exportXlsx();
  }
}
watch(() => publish.value.status, maybeAutoExport);
watch(() => exportState.value.tableId, maybeAutoExport);
function kbImportCandidates() {
  const bases = [];
  try {
    const u = new URL(exportState.value.downloadUrl, location.origin);
    if (allowedBase(u.origin)) bases.push(u.origin === location.origin ? "" : u.origin);
  } catch {
  }
  if (reviewBase.value && !bases.includes(reviewBase.value)) bases.push(reviewBase.value);
  if (!bases.includes("")) bases.push("");
  return bases;
}
async function importKnowledge() {
  if (!jobId.value || exportState.value.state !== "ready" || ["importing", "committing"].includes(kbState.value.state)) return;
  kbState.value = { ...blankKbState(), state: "importing" };
  addActivity("\u5BFC\u5165\u77E5\u8BC6\u5E93", "\u6B63\u5728\u6821\u9A8C\u5BFC\u51FA\u6570\u636E\u2026");
  const candidates = kbImportCandidates();
  let lastDetail = "";
  try {
    for (const base of candidates) {
      const r = await fetch(`${base}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/import-knowledge`, {
        method: "POST",
        headers: authHeaders()
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        kbState.value = { ...kbState.value, state: "validated", base, importId: d.import_id, summary: d };
        if (d.status === "validated") {
          addActivity("\u77E5\u8BC6\u5E93\u6821\u9A8C\u5B8C\u6210", `\u5171 ${d.total_rows} \u884C\uFF0C\u6709\u6548 ${d.valid_rows}\uFF0C\u8B66\u544A ${d.warning_rows}`);
          notify(`\u6821\u9A8C\u901A\u8FC7\uFF1A${d.valid_rows} \u884C\u53EF\u5BFC\u5165`);
        } else {
          addActivity("\u77E5\u8BC6\u5E93\u6821\u9A8C\u5931\u8D25", d.error_message || d.status);
        }
        if (d.error_rows > 0) await fetchKbErrorRows();
        return;
      }
      lastDetail = typeof d?.detail === "string" ? d.detail : `\u5BFC\u5165\u5931\u8D25\uFF08${r.status}\uFF09`;
      if (r.status !== 404) throw new Error(lastDetail);
    }
    throw new Error(lastDetail || "\u5BFC\u5165\u5931\u8D25");
  } catch (e) {
    kbState.value = { ...kbState.value, state: "error", error: e?.message || "\u5BFC\u5165\u5931\u8D25" };
    notify(e?.message || "\u5BFC\u5165\u5931\u8D25", true);
  }
}
async function fetchKbErrorRows() {
  const { base, importId } = kbState.value;
  if (!importId) return;
  try {
    const r = await fetch(
      `${base}/api/v1/knowledge/admin/imports/${encodeURIComponent(importId)}/rows?status=error`,
      { headers: authHeaders() }
    );
    const d = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(d.rows)) kbState.value = { ...kbState.value, errorRows: d.rows };
  } catch {
  }
}
async function commitKnowledge() {
  const { state, base, importId } = kbState.value;
  if (state !== "validated" || !importId) return;
  if (kbState.value.summary?.status !== "validated") return;
  kbState.value = { ...kbState.value, state: "committing", error: "" };
  addActivity("\u63D0\u4EA4\u77E5\u8BC6\u5E93", "\u6B63\u5728\u63D0\u4EA4\u6279\u6B21\u5E76\u6295\u9012\u7D22\u5F15\u4EFB\u52A1\u2026");
  try {
    const r = await fetch(`${base}/api/v1/knowledge/admin/imports/${encodeURIComponent(importId)}/commit`, {
      method: "POST",
      headers: authHeaders()
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(typeof d?.detail === "string" ? d.detail : `\u63D0\u4EA4\u5931\u8D25\uFF08${r.status}\uFF09`);
    kbState.value = { ...kbState.value, state: "committed", summary: { ...kbState.value.summary, ...d }, commitResult: d };
    const failed = Array.isArray(d.dispatch_failed_job_ids) ? d.dispatch_failed_job_ids.length : 0;
    addActivity("\u77E5\u8BC6\u5E93\u63D0\u4EA4\u5B8C\u6210", failed ? `\u5DF2\u63D0\u4EA4\uFF0C${failed} \u4E2A\u7D22\u5F15\u4EFB\u52A1\u6295\u9012\u5931\u8D25` : "\u5DF2\u63D0\u4EA4\u7D22\u5F15");
    notify(failed ? `\u5DF2\u63D0\u4EA4\uFF0C${failed} \u4E2A\u7D22\u5F15\u4EFB\u52A1\u6295\u9012\u5931\u8D25` : "\u5DF2\u63D0\u4EA4\u7D22\u5F15\uFF0C\u540E\u53F0\u5411\u91CF\u5316\u8FDB\u884C\u4E2D\uFF0C\u7A0D\u540E\u5373\u53EF\u68C0\u7D22");
  } catch (e) {
    kbState.value = { ...kbState.value, state: "validated", error: e?.message || "\u63D0\u4EA4\u5931\u8D25" };
    notify(e?.message || "\u63D0\u4EA4\u5931\u8D25", true);
  }
}
async function refreshKbStatus() {
  const { state, base, importId } = kbState.value;
  if (state !== "committed" || !importId) return;
  try {
    const r = await fetch(
      `${base}/api/v1/knowledge/admin/imports/${encodeURIComponent(importId)}`,
      { headers: authHeaders() }
    );
    const d = await r.json().catch(() => ({}));
    if (r.ok) kbState.value = { ...kbState.value, summary: { ...kbState.value.summary, ...d } };
  } catch {
  }
}
async function restoreJob(rawId) {
  const id = String(rawId || "").trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id)) {
    notify("\u8BF7\u8F93\u5165 32 \u4F4D\u5341\u516D\u8FDB\u5236\u7684\u4EFB\u52A1 ID", true);
    return;
  }
  restart();
  restored.value = true;
  jobId.value = id;
  pdfName.value = recentJobs.value.find((x) => x.job_id === id)?.pdf_name || "\u6062\u590D\u7684\u4EFB\u52A1";
  phase.value = "processing";
  setStatus("busy", "\u6B63\u5728\u6062\u590D\u4EFB\u52A1");
  message.value = "\u6B63\u5728\u67E5\u8BE2\u4EFB\u52A1\u72B6\u6001\u2026";
  addActivity("\u6062\u590D\u4EFB\u52A1", id);
  const job = await fetchJobStatus(id);
  if (!job) {
    const archived = await tryArchivedResult(id);
    if (archived) return;
    notify("\u672A\u627E\u5230\u8BE5\u4EFB\u52A1\uFF08\u4E34\u65F6\u4EFB\u52A1\u4FDD\u7559 12 \u5C0F\u65F6\uFF0C\u53EF\u80FD\u5DF2\u8FC7\u671F\uFF09", true);
    restart();
    return;
  }
  rememberJob(id, JOB_STATUS_HINTS[job.status] || "");
  if (job.status === "review_pending") {
    await restoreReview();
    return;
  }
  if (["publishing", "publish_partial", "published"].includes(job.status)) {
    await enterResultPhase();
    pollFinalUntilDone();
    return;
  }
  if (["ready", "processing", "merging"].includes(job.status)) {
    message.value = `\u4EFB\u52A1\u4ECD\u5728\u89E3\u6790\u4E2D\uFF08${job.progress_current ?? 0}/${job.progress_total ?? "?"} \u9875\uFF09\uFF0C\u9875\u9762\u5C06\u81EA\u52A8\u8DDF\u8FDB\u2026`;
    wSteps.value[0].state = "done";
    wSteps.value[1].state = "active";
    pollProcessingStatus();
    return;
  }
  notify(`\u4EFB\u52A1\u72B6\u6001\u5F02\u5E38\uFF08${JOB_STATUS_HINTS[job.status] || job.status}\uFF09\uFF0C\u65E0\u6CD5\u6062\u590D`, true);
  restart();
}
async function restoreReview() {
  phase.value = "review";
  hasEnteredReview.value = true;
  statusMode.value = "waiting-review";
  statusText.value = "\u7B49\u5F85\u4EBA\u5DE5\u5BA1\u6838";
  wSteps.value[0].state = "done";
  wSteps.value[1].state = "done";
  wSteps.value[2].state = "active";
  await loadReviewSnapshot();
}
async function loadReviewSnapshot() {
  const snap = await fetchReviewSnapshot();
  const pending = (snap?.crop_bindings || []).filter((x) => !x.review_action);
  snapshotProducts.value = (snap?.products || []).map((p) => ({
    product_candidate_id: p.product_candidate_id ?? p.id ?? "",
    reviewed: !!p.review_action
  }));
  const items2 = normalizeReviewItems(pending, jobId.value);
  batches.value = [];
  for (let n = 0; n < items2.length; n += 8) batches.value.push({ items: items2.slice(n, n + 8) });
  if (!batches.value.length) batches.value = [{ items: [] }];
  decisions.value = {};
  batchIndex.value = 0;
  if (items2.length) {
    addActivity("\u5BA1\u6838\u6570\u636E\u5DF2\u52A0\u8F7D", `${items2.length} \u5F20\u56FE\u7247\uFF08\u6062\u590D\u4F1A\u8BDD\uFF09`);
  } else {
    addActivity("\u5F53\u524D\u6279\u6B21\u65E0\u5F85\u5BA1\u56FE\u7247");
    await finalizeDirect();
  }
}
function productApprovals() {
  return snapshotProducts.value.filter((p) => p.product_candidate_id && !p.reviewed).map((p) => ({ product_candidate_id: p.product_candidate_id, action: "approve" }));
}
async function postReviewDecisions(crops, finalize) {
  const body = { products: productApprovals(), crops };
  const r = await fetch(`${reviewBase.value}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/review`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ review_mode: "manual", decisions_json: JSON.stringify(body), finalize })
  });
  if (!r.ok) {
    let detail = "";
    try {
      const j = await r.json();
      detail = j?.detail || j?.message || "";
    } catch {
    }
    throw new Error(detail ? `\u63D0\u4EA4\u672A\u6210\u529F\uFF1A${detail}` : "\u63D0\u4EA4\u672A\u6210\u529F\uFF0C\u8BF7\u91CD\u8BD5");
  }
  return r.json();
}
async function submitDirect() {
  submitting.value = true;
  try {
    const res = await postReviewDecisions(selected.value, false);
    addActivity("\u63D0\u4EA4\u5BA1\u6838", `${selected.value.length} \u5F20\u56FE\u7247`);
    if ((res?.remaining_review_count ?? 0) > 0) {
      await loadReviewSnapshot();
      notify("\u5DF2\u63D0\u4EA4\u5F53\u524D\u6279\u6B21\uFF0C\u8FD8\u6709\u5F85\u5BA1\u56FE\u7247");
    } else {
      await finalizeDirect();
    }
  } catch (e) {
    notify(e.message || "\u63D0\u4EA4\u672A\u6210\u529F\uFF0C\u8BF7\u91CD\u8BD5", true);
  } finally {
    submitting.value = false;
  }
}
async function finalizeDirect() {
  try {
    await postReviewDecisions([], true);
  } catch (e) {
    addActivity("\u6536\u5C3E\u63D0\u4EA4", e.message || "");
  }
  rememberJob(jobId.value, "\u53D1\u5E03\u4E2D");
  await enterResultPhase();
  drivePublish();
}
async function postPublishBatch(retryFailed) {
  const r = await fetch(`${reviewBase.value}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}/publish/next-batch`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ batch_size: 5, retry_failed: !!retryFailed })
  });
  if (!r.ok) {
    let detail = "";
    try {
      const j = await r.json();
      detail = j?.detail || j?.message || "";
    } catch {
    }
    throw new Error(detail || "\u53D1\u5E03\u8BF7\u6C42\u672A\u6210\u529F");
  }
  return r.json();
}
function adoptPublishState(d) {
  publish.value = {
    ...publish.value,
    status: d.status ?? publish.value.status,
    processed: d.processed_count ?? publish.value.processed,
    failed: d.failed_count ?? publish.value.failed,
    remaining: d.remaining ?? publish.value.remaining,
    hasMore: !!d.has_more
  };
  rememberJob(jobId.value, JOB_STATUS_HINTS[publish.value.status] || "");
}
async function drivePublish() {
  if (publish.value.driving) return;
  publish.value.driving = true;
  publish.value.retrying = false;
  setStatus("busy", "\u53D1\u5E03\u4E2D");
  try {
    for (let i = 0; i < 100; i += 1) {
      const d = await postPublishBatch(false);
      adoptPublishState(d);
      if (d.status !== "publishing" || !d.has_more) break;
    }
    await loadFinalResult();
    phase.value = "completed";
    if (publish.value.failed > 0) {
      setStatus("done");
      notify(`\u53D1\u5E03\u5B8C\u6210\uFF0C${publish.value.failed} \u5F20\u56FE\u7247\u5931\u8D25\uFF0C\u53EF\u70B9\u51FB\u300C\u91CD\u8BD5\u5931\u8D25\u56FE\u7247\u300D`, true);
    } else {
      setStatus("done");
    }
  } catch (e) {
    phase.value = "completed";
    setStatus("error", "\u53D1\u5E03\u4E2D\u65AD");
    notify(e.message || "\u53D1\u5E03\u672A\u6210\u529F\uFF0C\u53EF\u70B9\u51FB\u300C\u7EE7\u7EED\u53D1\u5E03\u5269\u4F59\u300D\u7EED\u8DD1", true);
  } finally {
    publish.value.driving = false;
  }
}
async function retryFailedPublish() {
  if (publish.value.driving || publish.value.retrying) return;
  publish.value.retrying = true;
  setStatus("busy", "\u91CD\u8BD5\u5931\u8D25\u56FE\u7247");
  try {
    for (let i = 0; i < 100; i += 1) {
      const d = await postPublishBatch(true);
      adoptPublishState(d);
      if (d.status !== "publishing" || !d.has_more) break;
    }
    await loadFinalResult();
    setStatus("done");
    notify(publish.value.failed > 0 ? `\u4ECD\u6709 ${publish.value.failed} \u5F20\u56FE\u7247\u6E32\u67D3\u5931\u8D25` : "\u5931\u8D25\u56FE\u7247\u5DF2\u5168\u90E8\u91CD\u8BD5\u5B8C\u6210", publish.value.failed > 0);
  } catch (e) {
    notify(e.message || "\u91CD\u8BD5\u672A\u6210\u529F\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5", true);
  } finally {
    publish.value.retrying = false;
  }
}
function pollFinalUntilDone() {
  stopStatusPolling();
  let tries = 0;
  statusTimer = setInterval(async () => {
    tries += 1;
    if (tries > 150) {
      stopStatusPolling();
      return;
    }
    const job = await fetchJobStatus();
    if (!job) return;
    publish.value = { ...publish.value, status: job.status };
    rememberJob(jobId.value, JOB_STATUS_HINTS[job.status] || "");
    if (job.status !== "publishing") {
      stopStatusPolling();
      await loadFinalResult();
      if (job.status === "publish_partial") notify("\u90E8\u5206\u56FE\u7247\u53D1\u5E03\u5931\u8D25\uFF0C\u53EF\u70B9\u51FB\u300C\u91CD\u8BD5\u5931\u8D25\u56FE\u7247\u300D", true);
    }
  }, 2e3);
}
function pollProcessingStatus() {
  stopStatusPolling();
  let tries = 0;
  statusTimer = setInterval(async () => {
    tries += 1;
    if (tries > 200) {
      stopStatusPolling();
      return;
    }
    const job = await fetchJobStatus();
    if (!job) return;
    rememberJob(jobId.value, JOB_STATUS_HINTS[job.status] || "");
    message.value = `\u4EFB\u52A1\u4ECD\u5728\u89E3\u6790\u4E2D\uFF08${job.progress_current ?? 0}/${job.progress_total ?? "?"} \u9875\uFF09\u2026`;
    if (job.status === "review_pending") {
      stopStatusPolling();
      await restoreReview();
    } else if (["publishing", "publish_partial", "published"].includes(job.status)) {
      stopStatusPolling();
      await enterResultPhase();
      drivePublish();
    } else if (["failed", "canceled"].includes(job.status)) {
      stopStatusPolling();
      notify(`\u4EFB\u52A1${JOB_STATUS_HINTS[job.status] || "\u5DF2\u7ED3\u675F"}`, true);
      restart();
    }
  }, 3e3);
}
async function enterResultPhase() {
  phase.value = "completed";
  wSteps.value.forEach((s) => {
    s.state = "done";
  });
  setStatus("busy", "\u53D1\u5E03\u4E2D");
  await loadFinalResult();
  if (publish.value.status !== "publishing") setStatus("done");
}
function cancelRun() {
  try {
    activeAbort?.abort();
  } catch {
  }
  stopStatusPolling();
  restart();
  notify("\u5DF2\u65AD\u5F00\u5DE5\u4F5C\u6D41\u8FDE\u63A5\uFF08\u4EFB\u52A1\u53EF\u80FD\u4ECD\u5728\u540E\u53F0\u6267\u884C\uFF0C\u53EF\u901A\u8FC7\u4EFB\u52A1 ID \u6062\u590D\uFF09");
}
async function abandonJob() {
  if (!jobId.value) return;
  if (!window.confirm("\u786E\u5B9A\u653E\u5F03\u6B64\u4EFB\u52A1\uFF1F\u540E\u7AEF\u4EFB\u52A1\u5FEB\u7167\u5C06\u88AB\u5220\u9664\uFF0C\u5DF2\u89E3\u6790\u5185\u5BB9\u4E0D\u53EF\u6062\u590D\u3002")) return;
  try {
    const r = await fetch(`${reviewBase.value}/api/v1/plugin/pdf/jobs/${encodeURIComponent(jobId.value)}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    if (!r.ok) {
      let detail = "";
      try {
        const j = await r.json();
        detail = j?.detail || j?.message || "";
      } catch {
      }
      notify(detail || "\u653E\u5F03\u4EFB\u52A1\u672A\u6210\u529F\uFF08\u53D1\u5E03\u4E2D\u7684\u4EFB\u52A1\u4E0D\u53EF\u5220\u9664\uFF09", true);
      return;
    }
    forgetJob(jobId.value);
    restart();
    notify("\u4EFB\u52A1\u5DF2\u653E\u5F03");
  } catch {
    notify("\u653E\u5F03\u4EFB\u52A1\u672A\u6210\u529F\uFF0C\u8BF7\u91CD\u8BD5", true);
  }
}
onBeforeUnmount(() => {
  stopStatusPolling();
  try {
    activeAbort?.abort();
  } catch {
  }
});
const cropSource = ref("");
const cropCurrentBox = computed(() => {
  const b = items.value[crop.value.index]?.pdf_bbox;
  return Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === "number" && n >= 0 && n <= 1) ? b : null;
});
function cropViewTransform() {
  const item = items.value[crop.value.index];
  if (!item) return null;
  if (cropSource.value === "w1") {
    const sb = Array.isArray(item.source_bbox) && item.source_bbox.length === 4 ? item.source_bbox : [0, 0, 1, 1];
    return { offset: [sb[0], sb[1]], span: [sb[2] - sb[0], sb[3] - sb[1]] };
  }
  if (cropSource.value === "crop") {
    const cur = cropCurrentBox.value;
    if (!cur) return null;
    return { offset: [cur[0], cur[1]], span: [cur[2] - cur[0], cur[3] - cur[1]] };
  }
  return { offset: [0, 0], span: [1, 1] };
}
const cropCurrentBoxView = computed(() => {
  const item = items.value[crop.value.index];
  const b = cropCurrentBox.value;
  if (!item || !b) return null;
  if (cropSource.value === "w1") {
    const sb = Array.isArray(item.source_bbox) && item.source_bbox.length === 4 ? item.source_bbox : [0, 0, 1, 1];
    const sw = sb[2] - sb[0], sh = sb[3] - sb[1];
    if (sw <= 0 || sh <= 0) return null;
    const v = [(b[0] - sb[0]) / sw, (b[1] - sb[1]) / sh, (b[2] - sb[0]) / sw, (b[3] - sb[1]) / sh];
    if (v.some((x) => x < -0.02 || x > 1.02)) return null;
    return v.map((x) => +Math.min(1, Math.max(0, x)).toFixed(4));
  }
  if (cropSource.value === "crop") return null;
  return b;
});
const cropSubtitle = computed(() => {
  const drawing = crop.value.mode === "drawn";
  const refHint = cropCurrentBoxView.value ? drawing ? "\u3002\u5DF2\u6846\u9009\u65B0\u533A\u57DF\uFF08\u539F\u533A\u57DF\u53C2\u8003\u89C1\u8BFB\u6570\uFF09" : "\u3002\u9AD8\u4EAE\u6846\u4E3A\u5F53\u524D\u88C1\u526A\u8303\u56F4\uFF1A\u76F4\u63A5\u62D6\u62FD\u79FB\u52A8\u3001\u62D6\u8FB9\u89D2\u8C03\u6574\u5927\u5C0F\uFF0C\u6216\u6846\u9009\u65B0\u533A\u57DF\u66FF\u6362" : "";
  switch (cropSource.value) {
    case "w1": {
      const sb = items.value[crop.value.index]?.source_bbox;
      const split = Array.isArray(sb) && (sb[0] !== 0 || sb[1] !== 0 || sb[2] !== 1 || sb[3] !== 1);
      return (split ? "\u6574\u9875\u9884\u89C8\u4E0D\u53EF\u7528\uFF0C\u5DF2\u56DE\u9000\u4E3A\u9875\u9762\u9884\u89C8\uFF08\u62C6\u5206\u9875\u89C6\u56FE\uFF09\uFF0C\u6846\u9009\u5750\u6807\u5C06\u81EA\u52A8\u6620\u5C04\u56DE\u6574\u9875" : "\u6574\u9875\u9884\u89C8\u4E0D\u53EF\u7528\uFF0C\u5DF2\u56DE\u9000\u4E3A\u9875\u9762\u9884\u89C8\uFF0C\u6846\u9009\u5750\u6807\u4E0E\u6574\u9875\u4E00\u81F4") + refHint;
    }
    case "crop":
      return "\u6574\u9875\u9884\u89C8\u4E0D\u53EF\u7528\uFF0C\u5DF2\u56DE\u9000\u4E3A\u88C1\u526A\u56FE\uFF08\u5C0F\u56FE\u5DF2\u653E\u5927\u4FBF\u4E8E\u6846\u9009\uFF0C\u5750\u6807\u81EA\u52A8\u6620\u5C04\u56DE\u6574\u9875\uFF09";
    default:
      return "\u5728\u6574\u9875\u9884\u89C8\u4E0A\u62D6\u52A8\u9009\u62E9\u65B0\u533A\u57DF" + refHint;
  }
});
const cropBoxPhysical = computed(() => {
  if (!crop.value.box) return null;
  const t = cropViewTransform();
  if (!t) return null;
  return [
    t.offset[0] + crop.value.box[0] * t.span[0],
    t.offset[1] + crop.value.box[1] * t.span[1],
    t.offset[0] + crop.value.box[2] * t.span[0],
    t.offset[1] + crop.value.box[3] * t.span[1]
  ].map((v) => +Math.min(1, Math.max(0, v)).toFixed(4));
});
const cropReadout = computed(() => {
  if (crop.value.box) {
    if (crop.value.mode === "current") {
      const phys = cropBoxPhysical.value || crop.value.box;
      const orig = cropCurrentBox.value;
      return `\u8C03\u6574\u540E\u533A\u57DF\uFF1A${JSON.stringify(phys)}` + (orig ? `\uFF08\u539F ${JSON.stringify(orig)}\uFF09` : "");
    }
    return `\u65B0\u88C1\u526A\u533A\u57DF\uFF1A${JSON.stringify(cropBoxPhysical.value || crop.value.box)}`;
  }
  return cropCurrentBox.value ? `\u5F53\u524D\u533A\u57DF\uFF1A${JSON.stringify(cropCurrentBox.value)}` : "\u8BF7\u62D6\u52A8\u9009\u62E9\u533A\u57DF";
});
function openCrop(i) {
  crop.value = { ...blankCrop(), open: true, index: i };
  nextTick(() => {
    const item = items.value[i];
    cropSource.value = item.page_preview_url ? "page" : item.w1_page_url ? "w1" : "crop";
    cropImage.value.style.width = "";
    cropImage.value.style.maxWidth = "";
    cropImage.value.style.maxHeight = "";
    cropImage.value.style.imageRendering = "";
    cropImage.value.src = item.page_preview_url || item.w1_page_url || item.preview_url || "";
  });
}
function onCropImageError() {
  const item = items.value[crop.value.index];
  if (!item || cropSource.value === "crop") return;
  crop.value.zoom = 1;
  crop.value.fitW = 0;
  if (cropSource.value === "page" && item.w1_page_url) {
    cropSource.value = "w1";
    cropImage.value.src = item.w1_page_url;
    return;
  }
  cropSource.value = "crop";
  cropImage.value.src = item.preview_url || "";
}
function onCropImageLoad() {
  const img = cropImage.value;
  if (!img || !crop.value.open) return;
  crop.value.zoom = 1;
  crop.value.fitW = 0;
  img.style.maxWidth = "";
  if (cropSource.value !== "crop") {
    img.style.width = "";
    img.style.maxHeight = "";
    img.style.imageRendering = "";
  } else {
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (nw && nh) {
      const maxH = Math.max(window.innerHeight * 0.62, 320);
      const maxW = 800;
      const scale = Math.max(1, Math.min(maxW / nw, maxH / nh));
      if (scale > 1) {
        img.style.width = `${Math.round(nw * scale)}px`;
        img.style.imageRendering = scale >= 3 ? "pixelated" : "auto";
      } else {
        img.style.width = "";
        img.style.imageRendering = "";
      }
    }
  }
  crop.value.fitW = img.getBoundingClientRect().width;
}
function closeCrop() {
  crop.value = blankCrop();
  cropSource.value = "";
}
function applyCropZoom() {
  const img = cropImage.value;
  if (!img || !crop.value.open || !crop.value.fitW) return;
  if (crop.value.zoom <= 1) {
    img.style.maxWidth = "";
    img.style.maxHeight = "";
    img.style.width = cropSource.value === "crop" ? `${Math.round(crop.value.fitW)}px` : "";
    nextTick(() => {
      const stage = cropStage.value;
      if (stage) {
        stage.scrollTop = 0;
        stage.scrollLeft = 0;
      }
    });
  } else {
    img.style.maxWidth = "none";
    img.style.maxHeight = "none";
    img.style.width = `${Math.round(crop.value.fitW * crop.value.zoom)}px`;
  }
}
function setCropZoom(z) {
  if (!crop.value.open || crop.value.zoom === z) return;
  crop.value.zoom = z;
  applyCropZoom();
}
function onCropWheel(e) {
  const stage = cropStage.value;
  const img = cropImage.value;
  if (!crop.value.open || !stage || !img || !crop.value.fitW || !img.naturalWidth || !e.deltaY) return;
  e.preventDefault();
  const intensity = Math.min(1, Math.abs(e.deltaY) / 100);
  const factor = e.deltaY < 0 ? 1 + 0.2 * intensity : 1 / (1 + 0.2 * intensity);
  const next = Math.min(CROP_ZOOM_MAX, Math.max(1, +(crop.value.zoom * factor).toFixed(2)));
  if (next === crop.value.zoom) return;
  const sr = stage.getBoundingClientRect();
  const r = img.getBoundingClientRect();
  const rx = (e.clientX - r.left) / r.width;
  const ry = (e.clientY - r.top) / r.height;
  crop.value.zoom = next;
  applyCropZoom();
  const nr = img.getBoundingClientRect();
  stage.scrollLeft += nr.left - sr.left + rx * nr.width - (e.clientX - sr.left);
  stage.scrollTop += nr.top - sr.top + ry * nr.height - (e.clientY - sr.top);
}
const CROP_EDGE_PX = 8;
const CROP_MIN_SIZE = 0.02;
const cropResizeCursors = {
  l: "ew-resize",
  r: "ew-resize",
  t: "ns-resize",
  b: "ns-resize",
  lt: "nwse-resize",
  rb: "nwse-resize",
  lb: "nesw-resize",
  rt: "nesw-resize"
};
const cropStageCursor = computed(() => {
  if (crop.value.drag === "move") return "grabbing";
  if (crop.value.drag === "resize") return cropResizeCursors[crop.value.handle] || "crosshair";
  if (crop.value.hover === "move") return "move";
  return cropResizeCursors[crop.value.hover] || "";
});
function insideCropBox(p, b) {
  if (!b) return false;
  const EPS = 2e-3;
  return p.x >= b[0] - EPS && p.x <= b[2] + EPS && p.y >= b[1] - EPS && p.y <= b[3] + EPS;
}
function cropEdgeHit(p, b) {
  if (!b) return "";
  const img = cropImage.value;
  if (!img) return "";
  const r = img.getBoundingClientRect();
  if (!r.width || !r.height) return "";
  const tx = CROP_EDGE_PX / r.width;
  const ty = CROP_EDGE_PX / r.height;
  if (p.x < b[0] - tx || p.x > b[2] + tx || p.y < b[1] - ty || p.y > b[3] + ty) return "";
  const nearL = Math.abs(p.x - b[0]) <= tx;
  const nearR = Math.abs(p.x - b[2]) <= tx;
  const nearT = Math.abs(p.y - b[1]) <= ty;
  const nearB = Math.abs(p.y - b[3]) <= ty;
  let h = "";
  if (nearL || nearR) h = nearL && nearR ? Math.abs(p.x - b[0]) <= Math.abs(p.x - b[2]) ? "l" : "r" : nearL ? "l" : "r";
  let v = "";
  if (nearT || nearB) v = nearT && nearB ? Math.abs(p.y - b[1]) <= Math.abs(p.y - b[3]) ? "t" : "b" : nearT ? "t" : "b";
  return h + v;
}
function startCropMove(p) {
  crop.value.drag = "move";
  crop.value.grab = { dx: p.x - crop.value.box[0], dy: p.y - crop.value.box[1] };
}
function startCropResize(handle) {
  crop.value.drag = "resize";
  crop.value.handle = handle;
  crop.value.base = [...crop.value.box];
}
function onCropPointerDown(e) {
  if (e.button !== 0) return;
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
  }
  const p = point(e);
  if (crop.value.box) {
    const h = cropEdgeHit(p, crop.value.box);
    if (h) {
      startCropResize(h);
      return;
    }
    if (insideCropBox(p, crop.value.box)) {
      startCropMove(p);
      return;
    }
  }
  const cur = crop.value.mode === "current" ? null : cropCurrentBoxView.value;
  if (cur) {
    const h = cropEdgeHit(p, cur);
    if (h) {
      crop.value.box = [...cur];
      crop.value.mode = "current";
      startCropResize(h);
      return;
    }
    if (insideCropBox(p, cur)) {
      crop.value.box = [...cur];
      crop.value.mode = "current";
      startCropMove(p);
      return;
    }
  }
  crop.value.drag = "draw";
  crop.value.start = p;
}
function onCropPointerMove(e) {
  if (crop.value.drag && !(e.buttons & 1)) {
    onCropPointerUp();
    return;
  }
  if (crop.value.drag === "resize") {
    const p2 = point(e);
    const b = [...crop.value.base];
    const h = crop.value.handle || "";
    if (h.includes("l")) b[0] = Math.min(Math.max(p2.x, 0), b[2] - CROP_MIN_SIZE);
    if (h.includes("r")) b[2] = Math.max(Math.min(p2.x, 1), b[0] + CROP_MIN_SIZE);
    if (h.includes("t")) b[1] = Math.min(Math.max(p2.y, 0), b[3] - CROP_MIN_SIZE);
    if (h.includes("b")) b[3] = Math.max(Math.min(p2.y, 1), b[1] + CROP_MIN_SIZE);
    crop.value.box = b.map((v) => +v.toFixed(4));
    return;
  }
  if (crop.value.drag === "move") {
    const p2 = point(e);
    const g = crop.value.grab;
    const b = crop.value.box;
    if (!g || !b) return;
    const w = b[2] - b[0];
    const h = b[3] - b[1];
    const nx = Math.min(1 - w, Math.max(0, p2.x - g.dx));
    const ny = Math.min(1 - h, Math.max(0, p2.y - g.dy));
    crop.value.box = [nx, ny, Math.min(1, nx + w), Math.min(1, ny + h)].map((v) => +v.toFixed(4));
    return;
  }
  if (crop.value.drag === "draw") {
    draw(e);
    return;
  }
  let hover = "";
  const p = point(e);
  for (const b of crop.value.mode === "current" ? [crop.value.box] : [crop.value.box, cropCurrentBoxView.value]) {
    if (!b) continue;
    const h = cropEdgeHit(p, b);
    if (h) {
      hover = h;
      break;
    }
    if (insideCropBox(p, b)) {
      hover = "move";
      break;
    }
  }
  crop.value.hover = hover;
}
function onCropPointerUp() {
  crop.value.drag = null;
  crop.value.start = null;
  crop.value.grab = null;
  crop.value.handle = "";
  crop.value.base = null;
}
function resetCrop() {
  crop.value.box = null;
  crop.value.mode = "";
  crop.value.start = null;
  setCropZoom(1);
}
function point(e) {
  const r = cropImage.value.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
    y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
  };
}
function draw(e) {
  if (!crop.value.start) return;
  const a = crop.value.start, b = point(e);
  const box = [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)];
  if (box[2] - box[0] > 0.02 && box[3] - box[1] > 0.02) {
    crop.value.box = box.map((x) => +x.toFixed(4));
    crop.value.mode = "drawn";
  } else {
    crop.value.box = null;
    crop.value.mode = "";
  }
}
function applyCrop() {
  if (!crop.value.box) return;
  const x = items.value[crop.value.index];
  const box = cropBoxPhysical.value;
  if (!box) {
    notify("\u65E0\u6CD5\u786E\u5B9A\u5F53\u524D\u88C1\u526A\u533A\u57DF\uFF0C\u4E0D\u80FD\u5E94\u7528\u91CD\u88C1", true);
    return;
  }
  decisions.value = { ...decisions.value, [x.source_crop_id]: { source_crop_id: x.source_crop_id, action: "recrop", pdf_bbox: box } };
  addActivity("\u91CD\u65B0\u88C1\u526A", x.product_name || "");
  closeCrop();
}
function restart() {
  try {
    activeAbort?.abort();
  } catch {
  }
  stopStatusPolling();
  phase.value = "upload";
  setStatus("waiting");
  file.value = null;
  pdfUrl.value = "";
  pdfName.value = "";
  jobId.value = "";
  eventId.value = "";
  reviewBase.value = "";
  retryCount.value = 0;
  submitting.value = false;
  restored.value = false;
  autoRest.value = false;
  hasEnteredReview.value = false;
  snapshotProducts.value = [];
  publish.value = { status: "", processed: 0, failed: 0, remaining: 0, hasMore: false, retrying: false, driving: false };
  exportState.value = { state: "", fileName: "", downloadUrl: "", tableId: "", tableName: "", error: "" };
  kbState.value = blankKbState();
  batchIndex.value = 0;
  message.value = "\u6B63\u5728\u51C6\u5907\u5DE5\u4F5C\u6D41\u2026";
  batches.value = [];
  decisions.value = {};
  result.value = {};
  activity.value = [];
  wSteps.value[0].state = "active";
  wSteps.value[1].state = "";
  wSteps.value[2].state = "";
}
