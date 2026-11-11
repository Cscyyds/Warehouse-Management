<script setup>
// Excel 文字预览与编辑面板（2026-10-27 由 ExcelPreviewDrawer 抽屉内容提取为内嵌面板）。
// 审核页（mode='review'）：中栏「图片审核 ⇄ Excel 文字预览」视图切换的承载组件；
// 结果页（mode='result'）：导出后就地检查/修改文字，重新导出时随 export-xlsx 提交补丁。
// 行文本来自后端 xlsx-preview（与导出同一函数生成，所见即所写）；
// 组件自身不发起提交。纯逻辑在 ../excelPreview.ts 与 ../techParams.ts。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  CATEGORY_OPTIONS,
  buildProductPatch,
  featuresToText,
  matchCategoryOption,
  textToFeatures,
} from '../excelPreview';
import {
  duplicateParamNames,
  inheritParamKeys,
  inheritVariantKeys,
  isVariantIdentityKey,
  sharedVariantValues,
  techEditFromFields,
  techEquals,
} from '../techParams';
import { IMAGE_TYPE_LABELS } from '../imageTypes';
import ImageExtractDialog from './ImageExtractDialog.vue';

const props = defineProps({
  // review = 审核页（编辑随批次提交）；result = 结果页（编辑随重新导出提交）
  mode: { type: String, default: 'review' },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  // { headers: string[], rows: string[][], products: [{ product_candidate_id, product_name, fields }] }
  preview: { type: Object, default: null },
  // 导出前置校验结果 { issues: [...], stats }
  validation: { type: Object, default: null },
  // 当前批次图片归属的产品 id（仅 review 模式的「本批次产品」范围用）
  batchIds: { type: Array, default: () => [] },
  productEdits: { type: Object, default: () => ({}) },
  // 绑定裁剪图：未发布图回落的审核预览图基址
  //（{reviewBase}/api/v1/plugin/pdf/jobs/{jobId}/review/assets/，由 index.vue 提供）
  assetBase: { type: String, default: '' },
  // 嵌入模式：放大遮罩从 fixed 降级为 absolute（不盖 WMS 顶栏/侧栏）
  embedded: { type: Boolean, default: false },
  // 已删除（未提交）产品：{ product_candidate_id, product_name }[]，供撤销条回显
  deletedProducts: { type: Array, default: () => [] },
  // 是否开放「删除产品」：仅审核页且走插件 REST 直提通道（Coze SSE 载荷无产品决策）
  canDeleteProduct: { type: Boolean, default: false },
  // 二次图片识别回调：({ file, target, hint }) => Promise<{params,variants,features,...}>
  // 由 index.vue 注入（统一带鉴权/任务 ID）；为空时不显示识别入口
  extractImage: { type: Function, default: null }
});
const emit = defineEmits(['refresh', 'edit', 'reset-edit', 'delete-product', 'restore-product']);

const scope = ref('batch');   // 'batch' | 'all'（仅 review 模式展示切换）
const selectedPcid = ref('');
// 删除产品：仅审核页 + REST 直提通道开放；结果页导出无产品级删除语义
const canDelete = computed(() => props.mode === 'review' && props.canDeleteProduct);
function requestDelete(product) {
  if (!product?.product_candidate_id) return;
  emit('delete-product', {
    product_candidate_id: product.product_candidate_id,
    product_name: product.product_name || ''
  });
}
function restoreProduct(pcid) {
  if (pcid) emit('restore-product', pcid);
}
// 视图切换：form = 按产品编辑（默认）；table = 总体预览（全量行表格，与导出同源）
const view = ref('form');
// 左侧产品列表可折叠（2026-10-27）：想让编辑区更宽时收起；组件内记忆，切产品不重置
const listOpen = ref(true);
// 校对效率增强：产品搜索/筛选、校验条折叠、新增行定位
const panelRef = ref(null);
const searchRef = ref(null);
const listKeyword = ref('');
const listFilter = ref('all');        // all | edited | issue
const showValidation = ref(false);
// 新增变体的共享值设置：按「键」控制哪些键带出共同值（默认全部可共享键都开）
const shareSettingsOpen = ref(false);
const sharePanelRef = ref(null);
const shareKeyPrefs = ref({});        // { [key: string]: boolean }，undefined = 默认开
// 二次图片识别弹窗：target = tech_params | features
const imageDialogOpen = ref(false);
const imageDialogTarget = ref('tech_params');

// 批次口径：当前批次图片归属的产品（D4）；无命中时回退全部并提示，避免空面板
const batchFallback = computed(() => {
  const list = props.preview?.products || [];
  const ids = new Set(props.batchIds || []);
  return list.filter(p => ids.has(p.product_candidate_id)).length === 0;
});
const visibleProducts = computed(() => {
  const list = props.preview?.products || [];
  if (props.mode === 'review' && scope.value === 'batch' && !batchFallback.value) {
    const ids = new Set(props.batchIds || []);
    return list.filter(p => ids.has(p.product_candidate_id));
  }
  return list;
});
watch([() => props.preview, visibleProducts], () => {
  const ids = visibleProducts.value.map(p => p.product_candidate_id);
  if (!ids.includes(selectedPcid.value)) selectedPcid.value = ids[0] || '';
}, { immediate: true });

const productsAll = computed(() => props.preview?.products || []);
const tableRows = computed(() => props.preview?.rows || []);
const productById = computed(
  () => new Map(productsAll.value.map((p) => [p.product_candidate_id, p]))
);
const selectedProduct = computed(
  () => productById.value.get(selectedPcid.value) || null
);
const selectedRow = computed(() => {
  const i = productsAll.value.indexOf(selectedProduct.value);
  return i >= 0 && props.preview?.rows ? props.preview.rows[i] : null;
});
const rowPairs = computed(() => {
  const headers = props.preview?.headers || [];
  const row = selectedRow.value;
  if (!row) return [];
  return headers.map((h, i) => [h, row[i] ?? '']);
});

function editValue(pcid, field, fallback) {
  const edit = props.productEdits[pcid];
  const value = edit ? edit[field] : undefined;
  return value !== undefined ? value : fallback;
}
// 与提交口径一致的「是否有改动」：改回原样不再误标已编辑（2026-11-11）
const editedPcids = computed(() => {
  const set = new Set();
  for (const [pcid, edit] of Object.entries(props.productEdits || {})) {
    const product = productById.value.get(pcid);
    if (Object.keys(buildProductPatch(edit, product?.fields || {})).length) set.add(pcid);
  }
  return set;
});
function isEdited(pcid) {
  return editedPcids.value.has(pcid);
}

// ── 产品列表搜索 / 筛选 / 上一下一个（2026-11-11）──
// 校对大批量产品时不用再靠滚动找「已编辑」；Alt+↑/↓ 切产品，/ 聚焦搜索。
const validationIssues = computed(() => props.validation?.issues || []);
const validationStats = computed(() => props.validation?.stats || { rows: 0, errors: 0, warnings: 0 });
const issueCountByProduct = computed(() => {
  const counts = {};
  for (const issue of validationIssues.value) {
    const pcid = String(issue?.product_candidate_id || '');
    if (pcid) counts[pcid] = (counts[pcid] || 0) + 1;
  }
  return counts;
});
const editedVisibleCount = computed(
  () => visibleProducts.value.filter((p) => isEdited(p.product_candidate_id)).length
);
const issueVisibleCount = computed(
  () => visibleProducts.value.filter((p) => issueCountByProduct.value[p.product_candidate_id]).length
);
function productSearchText(product) {
  const pcid = product.product_candidate_id;
  const parts = [
    product.product_name,
    editValue(pcid, 'product_name', product.fields?.product_name ?? ''),
    editValue(pcid, 'series_name', product.fields?.series_name ?? ''),
    editValue(pcid, 'product_category', product.fields?.product_category ?? ''),
    editValue(pcid, 'featuresText', featuresToText(product.fields?.features)),
  ];
  const tech = techStateOf(product);
  if (tech) {
    parts.push(...tech.params.map((row) => `${row.name} ${row.value}`));
    parts.push(...tech.variants.flat().map((entry) => `${entry.key} ${entry.value}`));
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}
const filteredProducts = computed(() => {
  const keyword = listKeyword.value.trim().toLowerCase();
  return visibleProducts.value.filter((p) => {
    const pcid = p.product_candidate_id;
    if (listFilter.value === 'edited' && !isEdited(pcid)) return false;
    if (listFilter.value === 'issue' && !issueCountByProduct.value[pcid]) return false;
    return !keyword || productSearchText(p).includes(keyword);
  });
});
watch(filteredProducts, (list) => {
  if (!list.length) return;   // 筛选无结果时保留当前编辑器，仅列表给出空态提示
  if (!list.some((p) => p.product_candidate_id === selectedPcid.value)) {
    selectedPcid.value = list[0].product_candidate_id;
  }
});
const currentListIndex = computed(
  () => filteredProducts.value.findIndex((p) => p.product_candidate_id === selectedPcid.value)
);
const canPrevProduct = computed(() => currentListIndex.value > 0);
const canNextProduct = computed(
  () => currentListIndex.value >= 0 && currentListIndex.value < filteredProducts.value.length - 1
);
function selectRelativeProduct(delta) {
  const list = filteredProducts.value;
  const idx = currentListIndex.value;
  if (idx < 0) {
    if (list.length) selectedPcid.value = list[0].product_candidate_id;
    return;
  }
  const next = list[idx + delta];
  if (next) selectedPcid.value = next.product_candidate_id;
}
function clearListFilters() {
  listKeyword.value = '';
  listFilter.value = 'all';
}
function onSearchKeydown(event) {
  if (event.key === 'Escape') {
    listKeyword.value = '';
    event.target?.blur();
  }
}
function isTypingTarget(target) {
  const tag = String(target?.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || !!target?.isContentEditable;
}
function focusSearch() {
  listOpen.value = true;
  nextTick(() => searchRef.value?.focus());
}
function onWindowKeydown(event) {
  if (event.altKey && !event.ctrlKey && !event.metaKey
      && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault();
    selectRelativeProduct(event.key === 'ArrowUp' ? -1 : 1);
    return;
  }
  if (event.key === '/' && !isTypingTarget(event.target)) {
    event.preventDefault();
    focusSearch();
  }
}
onMounted(() => window.addEventListener('keydown', onWindowKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onWindowKeydown));

// 品类下拉：历史写法（旧「一级 - 类目」全串、「类目 - 诺米一级」两段式、
// 已合并的旧类目名）自动折算到当前 16 个类目，避免值不在选项里时下拉显示
// 空白、看起来像"没识别"；确实是旧值又折算不出时，保留原值并给出显式提示。
const categoryRaw = computed(() => {
  const p = selectedProduct.value;
  if (!p) return '';
  const v = editValue(
    p.product_candidate_id, 'product_category', p.fields?.product_category ?? ''
  );
  return String(v || '').trim();
});
const categoryValue = computed(() => matchCategoryOption(categoryRaw.value));
const categoryUnmatched = computed(() => !!categoryRaw.value && !categoryValue.value);
// ── 总体预览（表格视图）：全量行与导出同源；已修改产品行高亮，
//    点击行定位到该产品的编辑视图（发现问题 → 就地修改）──
const editedRowCount = computed(
  () => productsAll.value.filter(p => isEdited(p.product_candidate_id)).length
);
function focusRowProduct(rowIndex) {
  const p = productsAll.value[rowIndex];
  if (!p) return;
  if (props.mode === 'review'
      && !visibleProducts.value.some((x) => x.product_candidate_id === p.product_candidate_id)) {
    scope.value = 'all';
  }
  selectedPcid.value = p.product_candidate_id;
  view.value = 'form';
}

// ── 绑定裁剪图（2026-10-27 校对视图直显）：发布后用 BOS 正式图；
//    未发布/「(待发布)」占位回落到审核预览图（与审核卡片同源，无需鉴权）──
const productImages = computed(() => selectedProduct.value?.fields?.images || []);
function imageSrc(img) {
  const url = String(img?.image_url || '');
  if (/^(https?:|data:)/i.test(url)) return url;
  const cid = String(img?.source_crop_id || '');
  return cid && props.assetBase ? props.assetBase + encodeURIComponent(cid) : '';
}
function cropKey(img, i) { return String(img?.source_crop_id || `idx${i}`); }
// 加载失败的图换占位（不阻塞其他图）；切换产品时清账
const brokenCrops = ref(new Set());
function markCropBroken(key) { brokenCrops.value = new Set(brokenCrops.value).add(key); }
watch(selectedPcid, () => {
  brokenCrops.value = new Set();
  enlargeCrop.value = null;
  shareSettingsOpen.value = false;
  imageDialogOpen.value = false;
});
// 点击放大（含描述/类型/页码）
const enlargeCrop = ref(null);

// ── 产品特点结构化编辑（2026-10-27）：与技术参数同款行式设计，序号自动排。
// 存储仍走 featuresText（一行一条，与 buildProductPatch 契约不变），
// 这里只负责 rows ⇄ '\n'.join 的拆装 ──
const featureRows = computed(() => {
  const p = selectedProduct.value;
  if (!p) return [];
  const text = String(editValue(p.product_candidate_id, 'featuresText', featuresToText(p.fields?.features)) ?? '');
  return text === '' ? [] : text.split('\n');
});
function setFeatureRows(rows) {
  const pcid = selectedProduct.value?.product_candidate_id;
  if (pcid) emit('edit', pcid, 'featuresText', rows.join('\n'));
}
function updateFeatureRow(index, value) {
  const rows = [...featureRows.value];
  rows[index] = value;
  setFeatureRows(rows);
}
function removeFeatureRow(index) {
  const rows = [...featureRows.value];
  rows.splice(index, 1);
  setFeatureRows(rows);
}
function addFeatureRow() {
  setFeatureRows([...featureRows.value, '']);
  void focusNewRow('.xpv-feature-row', '.input');
}
// 从 Excel/文本粘贴多行进特点：自动拆条，不再挤在一个输入框里
function onFeaturePaste(index, event) {
  const text = event.clipboardData?.getData('text/plain') || '';
  if (!text.includes('\n')) return;
  event.preventDefault();
  const parts = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!parts.length) return;
  const rows = [...featureRows.value];
  const current = String(rows[index] || '').trim();
  const merged = current && current !== parts[0] ? [current, ...parts] : parts;
  rows.splice(index, 1, ...merged);
  setFeatureRows(rows);
  nextTick(() => {
    const inputs = panelRef.value?.querySelectorAll('.xpv-feature-row .input');
    inputs?.[index + merged.length - 1]?.focus();
  });
}
function onFeatureEnter(index) {
  if (index === featureRows.value.length - 1) addFeatureRow();
}

// 新增行后滚动到可见并聚焦：减少在内部滚动区里手动找新行
async function focusNewRow(containerSelector, inputSelector) {
  await nextTick();
  const rows = panelRef.value?.querySelectorAll(containerSelector);
  const node = rows?.[rows.length - 1];
  if (!node) return;
  node.scrollIntoView({ block: 'nearest' });
  const inputs = Array.from(node.querySelectorAll(inputSelector));
  const target = inputs.find((el) => !String(el.value || '').trim()) || inputs[0];
  target?.focus();
}
async function focusVariantEntry(vi) {
  await nextTick();
  const card = panelRef.value?.querySelectorAll('.xpv-variant')?.[vi];
  const rows = card?.querySelectorAll('.xpv-tech-row');
  const row = rows?.[rows.length - 1];
  if (!row) return;
  row.scrollIntoView({ block: 'nearest' });
  row.querySelector('.xpv-tech-name')?.focus();
}

// ── 导出前置校验：error=建议修复，warning=提示；点击条目定位产品+字段 ──
const ISSUE_FIELD = {
  EMPTY_NAME: 'product_name',
  DUP_NAME: 'product_name',
  NO_FEATURES: 'features',
  NO_SERIES: 'series_name',
  NO_CATEGORY: 'product_category',
  NO_IMAGES: 'images',
  NO_TECH_PARAMS: 'tech_params',
  EMPTY_IMAGE_DESC: 'images',
};
function severityClass(issue) { return issue.severity === 'error' ? 'is-error' : 'is-warning'; }
async function focusIssue(issue) {
  // 先清筛选，避免定位到的产品被当前筛选立刻踢走
  clearListFilters();
  view.value = 'form';
  // 批次视图可能不含该产品（校验覆盖全部行）：切到全部产品再定位
  if (props.mode === 'review' && issue?.product_candidate_id
      && !visibleProducts.value.some((p) => p.product_candidate_id === issue.product_candidate_id)) {
    scope.value = 'all';
  }
  if (issue?.product_candidate_id) selectedPcid.value = issue.product_candidate_id;
  const field = ISSUE_FIELD[issue?.code];
  if (!field) return;
  await nextTick();
  const el = panelRef.value?.querySelector(`[data-field="${field}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.add('is-flash');
  setTimeout(() => el.classList.remove('is-flash'), 1600);
}

// ── 技术参数结构化编辑（方案 A）：用户全程不接触 JSON ──
const techState = computed(() => {
  const p = selectedProduct.value;
  if (!p) return null;
  const edit = props.productEdits[p.product_candidate_id];
  return edit?.techParams !== undefined
    ? edit.techParams
    : techEditFromFields(p.fields?.tech_params_structured);
});
const techDupNames = computed(() => (techState.value ? duplicateParamNames(techState.value.params) : []));
watch(() => techState.value?.variants.length, (n) => { if (!n) shareSettingsOpen.value = false; });

// ── 本产品已修改字段（2026-11-11）：字段级标记 + 原值 + 单字段恢复 ──
// 只列用户真正改过的字段；改回原样即从条上消失，不再只有产品级「已编辑」。
const DIRTY_FIELD_LABELS = [
  ['product_name', '产品名称'],
  ['series_name', '产品系列'],
  ['product_category', '品类'],
  ['featuresText', '产品特点'],
  ['installation', '安装说明'],
  ['precautions', '注意事项'],
  ['techParams', '技术参数'],
];
function initialFieldValue(product, field) {
  if (field === 'featuresText') return featuresToText(product.fields?.features);
  return product.fields?.[field] ?? '';
}
function fieldChanged(product, field, edit) {
  if (field === 'techParams') {
    return !techEquals(edit.techParams, product.fields?.tech_params_structured);
  }
  if (field === 'featuresText') {
    return JSON.stringify(textToFeatures(edit.featuresText))
      !== JSON.stringify(product.fields?.features || []);
  }
  return edit[field] !== (product.fields?.[field] ?? '');
}
const dirtyFields = computed(() => {
  const p = selectedProduct.value;
  if (!p) return [];
  const edit = props.productEdits[p.product_candidate_id];
  if (!edit) return [];
  return DIRTY_FIELD_LABELS
    .filter(([field]) => edit[field] !== undefined && fieldChanged(p, field, edit))
    .map(([field, label]) => ({ field, label }));
});
function dirtyFieldTitle(item) {
  if (item.field === 'techParams') return '技术参数已修改，点击恢复为识别原文';
  const p = selectedProduct.value;
  const original = p ? String(initialFieldValue(p, item.field) || '') : '';
  const text = original.replace(/\s+/g, ' ').slice(0, 120);
  return `原值：${text || '（空）'}；点击恢复`;
}
function resetDirtyField(field) {
  const p = selectedProduct.value;
  if (!p) return;
  if (field === 'techParams') {
    emitTech(techEditFromFields(p.fields?.tech_params_structured));
    return;
  }
  emit('edit', p.product_candidate_id, field, initialFieldValue(p, field));
}

// 新增变体的共享值设置（2026-11-11）：按「键」控制哪些键带出共同值。
// sharedVariantValues 已排除型号/货号等身份键；这里只负责用户勾选与默认值。
const shareKeyOptions = computed(() => {
  const variants = techState.value?.variants || [];
  if (!variants.length) return [];
  const shared = sharedVariantValues(variants);
  const keys = [];
  const seen = new Set();
  for (const row of variants) {
    for (const entry of row || []) {
      const key = String(entry?.key || '').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
  }
  return keys.map((key) => {
    const identity = isVariantIdentityKey(key);
    const value = shared[key] || '';
    const shareable = !!value && !identity;
    return {
      key,
      value,
      shareable,
      reason: identity ? '型号/货号不参与共享' : '值不一致或为空',
    };
  });
});
const shareableKeyCount = computed(() => shareKeyOptions.value.filter((o) => o.shareable).length);
function isShareKeyEnabled(key) {
  const option = shareKeyOptions.value.find((o) => o.key === key);
  if (option && !option.shareable) return false;
  return shareKeyPrefs.value[key] !== false;
}
const enabledSharedCount = computed(
  () => shareKeyOptions.value.filter((o) => o.shareable && isShareKeyEnabled(o.key)).length
);
function toggleShareKey(key, checked) {
  shareKeyPrefs.value = { ...shareKeyPrefs.value, [key]: !!checked };
}
function toggleShareSettings() {
  shareSettingsOpen.value = !shareSettingsOpen.value;
  if (shareSettingsOpen.value) {
    // 面板在编辑区底部，打开后滚到可见区，避免只露出半截
    nextTick(() => sharePanelRef.value?.scrollIntoView({ block: 'nearest' }));
  }
}
function enableAllShareKeys() {
  const next = { ...shareKeyPrefs.value };
  for (const option of shareKeyOptions.value) {
    if (option.shareable) next[option.key] = true;
  }
  shareKeyPrefs.value = next;
}
function disableAllShareKeys() {
  const next = { ...shareKeyPrefs.value };
  for (const option of shareKeyOptions.value) next[option.key] = false;
  shareKeyPrefs.value = next;
}
function sharedValuesForNewVariant(variants) {
  const shared = sharedVariantValues(variants);
  const enabled = {};
  for (const [key, value] of Object.entries(shared)) {
    if (isShareKeyEnabled(key)) enabled[key] = value;
  }
  return enabled;
}
const addVariantHint = computed(() => {
  if (!techState.value?.variants.length) return '新建变体（默认属性名：型号）';
  return '新变体继承上一个变体的属性名；按「共享值设置」带出勾选键的共同值，其余留空';
});

// ── 继承上一产品参数名（只继承键，值留空；已有同名参数保留原值）──
// 「上一个产品」按当前可见列表顺序取（本批次/全部两套范围与列表展示一致）
function techStateOf(product) {
  const edit = props.productEdits[product.product_candidate_id];
  return edit?.techParams !== undefined
    ? edit.techParams
    : techEditFromFields(product.fields?.tech_params_structured);
}
const previousTechProduct = computed(() => {
  const list = visibleProducts.value;
  const idx = list.findIndex(p => p.product_candidate_id === selectedPcid.value);
  return idx > 0 ? list[idx - 1] : null;
});
const inheritedTechState = computed(() => {
  const prev = previousTechProduct.value;
  if (!prev || !selectedProduct.value) return null;
  return inheritParamKeys(techState.value, techStateOf(prev));
});
const inheritHint = computed(() => {
  if (!previousTechProduct.value) return '当前产品是列表第一个，没有可继承的上一个产品';
  if (!inheritedTechState.value) return '上一个产品的参数名在当前产品中已全部存在';
  const name = previousTechProduct.value.product_name || previousTechProduct.value.product_candidate_id;
  return `继承「${name}」的参数名（值留空）；已有同名参数保留原值`;
});
function inheritPreviousParamKeys() {
  const pcid = selectedProduct.value?.product_candidate_id;
  const next = inheritedTechState.value;
  if (pcid && next) emitTech(next);
}

function emitTech(next) {
  const pcid = selectedProduct.value?.product_candidate_id;
  if (pcid) emit('edit', pcid, 'techParams', next);
}
function openImageExtract(target) {
  if (!props.extractImage) return;
  imageDialogTarget.value = target;
  imageDialogOpen.value = true;
}
function onExtractedTech(next) {
  emitTech(next);
  imageDialogOpen.value = false;
}
function onExtractedFeatures(features) {
  setFeatureRows(Array.isArray(features) ? features : []);
  imageDialogOpen.value = false;
}
function updateParam(index, field, value) {
  const next = JSON.parse(JSON.stringify(techState.value || { params: [], variants: [] }));
  next.params[index][field] = value;
  emitTech(next);
}
function addParam() {
  const next = JSON.parse(JSON.stringify(techState.value || { params: [], variants: [] }));
  next.params.push({ name: '', value: '' });
  emitTech(next);
  void focusNewRow('.xpv-tech-table .xpv-tech-row', '.xpv-tech-name');
}
function removeParam(index) {
  const next = JSON.parse(JSON.stringify(techState.value || { params: [], variants: [] }));
  next.params.splice(index, 1);
  emitTech(next);
}
function updateVariantEntry(vi, ei, field, value) {
  const next = JSON.parse(JSON.stringify(techState.value || { params: [], variants: [] }));
  next.variants[vi][ei][field] = value;
  emitTech(next);
}
function addVariantEntry(vi) {
  const next = JSON.parse(JSON.stringify(techState.value || { params: [], variants: [] }));
  next.variants[vi].push({ key: '', value: '' });
  emitTech(next);
  void focusVariantEntry(vi);
}
function removeVariantEntry(vi, ei) {
  const next = JSON.parse(JSON.stringify(techState.value || { params: [], variants: [] }));
  next.variants[vi].splice(ei, 1);
  if (!next.variants[vi].length) next.variants.splice(vi, 1);
  emitTech(next);
}
// 新增变体继承上一个变体的属性名；「共享值设置」里勾选的键自动带值，
// 未勾选/值不一致/型号货号等身份键留空。
function addVariant() {
  const next = JSON.parse(JSON.stringify(techState.value || { params: [], variants: [] }));
  const previous = next.variants[next.variants.length - 1];
  const shared = sharedValuesForNewVariant(next.variants);
  next.variants.push(inheritVariantKeys(previous, shared));
  emitTech(next);
  void focusNewRow('.xpv-variant', '.xpv-tech-val');
}
</script>

<template>
  <div ref="panelRef" class="xpv">
    <div class="xpv-toolbar">
      <!-- 视图切换：按产品编辑（默认）| 总体预览（全量行表格，与导出同源） -->
      <div class="xpv-scope">
        <button type="button" class="xpv-scope-btn" :class="{ active: view === 'form' }"
                @click="view = 'form'">按产品编辑</button>
        <button type="button" class="xpv-scope-btn" :class="{ active: view === 'table' }"
                title="以表格查看全部产品将写入 Excel 的行（与导出同源）；点击行可定位到该产品编辑"
                @click="view = 'table'">总体预览</button>
      </div>
      <!-- 批次范围切换仅审核页有意义：结果页没有「当前批次」概念，恒为全部 -->
      <div v-if="props.mode === 'review' && view === 'form'" class="xpv-scope">
        <button type="button" class="xpv-scope-btn" :class="{ active: scope === 'batch' }"
                @click="scope = 'batch'">本批次产品</button>
        <button type="button" class="xpv-scope-btn" :class="{ active: scope === 'all' }"
                @click="scope = 'all'">全部产品</button>
      </div>
      <span v-if="props.mode === 'review' && scope === 'batch' && batchFallback" class="xpv-hint">
        当前批次图片均未决或无归属产品，已展示全部
      </span>
      <button type="button" class="xpv-refresh" :disabled="props.loading"
              @click="emit('refresh')">{{ props.loading ? '加载中…' : '刷新预览' }}</button>
    </div>

    <!-- 已删除（未提交）产品：产品与其裁剪提交时一并 reject，不写入 Excel；可逐项撤销 -->
    <div v-if="canDelete && props.deletedProducts.length" class="xpv-deleted-bar">
      <span class="xpv-deleted-label">已删除 {{ props.deletedProducts.length }} 个产品（提交后不写入 Excel）：</span>
      <span v-for="p in props.deletedProducts" :key="p.product_candidate_id" class="xpv-deleted-chip">
        <span class="xpv-deleted-name" :title="p.product_name || p.product_candidate_id">{{ p.product_name || p.product_candidate_id }}</span>
        <button type="button" class="xpv-deleted-undo" title="撤销删除，恢复写入 Excel"
                @click="restoreProduct(p.product_candidate_id)">撤销</button>
      </span>
    </div>

    <!-- 导出前置校验：默认只显示计数条，避免刷屏；点击条目定位产品+字段 -->
    <div v-if="props.validation && (validationStats.errors || validationStats.warnings)"
         class="xpv-validate-bar" :class="{ 'has-error': validationStats.errors > 0 }"
         :title="`基于最近一次预览刷新（${validationStats.rows} 行）；编辑后点「刷新预览」可更新`">
      <span class="xpv-validate-summary">
        校验：<b v-if="validationStats.errors" class="is-error">{{ validationStats.errors }} 个需修复</b>
        <b v-if="validationStats.warnings" class="is-warning">{{ validationStats.warnings }} 个提示</b>
      </span>
      <button type="button" class="xpv-validate-toggle" @click="showValidation = !showValidation">
        {{ showValidation ? '收起' : '查看' }}
      </button>
    </div>
    <ul v-if="showValidation && validationIssues.length" class="xpv-validate-list xpv-validate-list-bar">
      <li v-for="(issue, i) in validationIssues" :key="i"
          class="xpv-validate-item" :class="severityClass(issue)"
          :title="`定位到产品：${issue.product_name || issue.product_candidate_id}`"
          @click="focusIssue(issue)">
        <span class="xpv-validate-sev">{{ issue.severity === 'error' ? '修复' : '提示' }}</span>
        <span class="xpv-validate-name">{{ issue.product_name || issue.product_candidate_id }}</span>
        <span class="xpv-validate-msg">{{ issue.message }}</span>
      </li>
    </ul>

    <!-- 原始报错不再展示给用户（2026-10-27）：HTTP 状态/后端 detail 属开发向信息；
         失败时面板落到下方空态提示，刷新按钮可重试 -->
    <p v-if="props.loading && !props.preview" class="xpv-hint">正在生成预览…</p>

    <!-- 总体预览：全量行表格（与导出同源）；已修改行黄色标出，点击行定位到该产品编辑 -->
    <div v-if="props.preview && view === 'table' && tableRows.length" class="xpv-table-wrap">
      <div class="xpv-table-scroll">
        <table>
          <thead>
            <tr>
              <th v-for="(c, ci) in (props.preview?.headers || [])" :key="ci">{{ c }}</th>
              <th v-if="canDelete" class="xpv-table-op">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in tableRows" :key="ri"
                :class="{ 'is-edited': isEdited(productsAll[ri]?.product_candidate_id) }"
                :title="`点击定位到产品：${productsAll[ri]?.product_name || productsAll[ri]?.product_candidate_id || ''}`"
                @click="focusRowProduct(ri)">
              <td v-for="(v, ci) in row" :key="ci" :title="v">
                <span v-if="ci === 0 && isEdited(productsAll[ri]?.product_candidate_id)"
                      class="xpv-table-flag">已改</span>{{ v }}
              </td>
              <td v-if="canDelete" class="xpv-table-op">
                <button type="button" class="xpv-product-del-mini"
                        :title="`删除「${productsAll[ri]?.product_name || productsAll[ri]?.product_candidate_id || ''}」：不写入 Excel`"
                        @click.stop="requestDelete(productsAll[ri])">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="xpv-hint">
        共 {{ tableRows.length }} 行，与导出 Excel 同源<template v-if="editedRowCount">；{{ editedRowCount }} 行有未{{ props.mode === 'review' ? '提交' : '导出' }}的修改（黄色标出）</template>
      </p>
    </div>

    <div v-else-if="props.preview && visibleProducts.length" class="xpv-body" :class="{ 'no-list': !listOpen }">
      <!-- 收起态：窄条展开按钮（校对时让编辑区占满宽度） -->
      <button v-if="!listOpen" type="button" class="xpv-list-strip"
              title="展开产品列表" aria-label="展开产品列表"
              @click="listOpen = true">»</button>
      <aside v-else class="xpv-list-col">
        <!-- 头部固定在滚动层外：折叠按钮不随列表滚动（出滚动条也始终可见） -->
        <div class="xpv-list-head">
          <span>产品（{{ (listKeyword.trim() || listFilter !== 'all')
            ? `${filteredProducts.length}/${visibleProducts.length}`
            : visibleProducts.length }}）</span>
          <button type="button" class="xpv-list-toggle" title="收起产品列表"
                  aria-label="收起产品列表" @click="listOpen = false">«</button>
        </div>
        <!-- 搜索/筛选：大批量产品时先缩小范围，再按 Alt+↑/↓ 连续校对 -->
        <div class="xpv-list-tools">
          <input ref="searchRef" v-model="listKeyword" class="input xpv-list-search"
                 type="search" placeholder="搜索名称/型号（/）" @keydown="onSearchKeydown">
          <div class="xpv-list-filters">
            <button type="button" class="xpv-list-filter" :class="{ active: listFilter === 'all' }"
                    title="显示全部产品" @click="listFilter = 'all'">全部</button>
            <button type="button" class="xpv-list-filter" :class="{ active: listFilter === 'edited' }"
                    title="只看有未提交/未导出修改的产品" @click="listFilter = 'edited'">已改 {{ editedVisibleCount }}</button>
            <button type="button" class="xpv-list-filter" :class="{ active: listFilter === 'issue' }"
                    title="只看最近一次校验有问题的产品" @click="listFilter = 'issue'">问题 {{ issueVisibleCount }}</button>
          </div>
        </div>
        <div class="xpv-list">
          <p v-if="!filteredProducts.length" class="xpv-hint xpv-list-empty">
            没有符合筛选的产品
            <button type="button" class="xpv-list-clear" @click="clearListFilters">清空</button>
          </p>
          <button v-for="p in filteredProducts" :key="p.product_candidate_id" type="button"
                  class="xpv-item" :class="{ active: p.product_candidate_id === selectedPcid }"
                  :title="p.product_name || p.product_candidate_id"
                  @click="selectedPcid = p.product_candidate_id">
            <span class="xpv-item-name">{{ p.product_name || p.product_candidate_id }}</span>
            <span v-if="isEdited(p.product_candidate_id)" class="xpv-item-flag"
                  :title="props.mode === 'review' ? '有未提交的文字编辑' : '有未导出的文字修改'">已编辑</span>
          </button>
        </div>
      </aside>

      <section v-if="selectedProduct" class="xpv-editor">
        <!-- 产品切换 + 字段级改动条：不用再回左侧列表找「上一个/下一个」 -->
        <div class="xpv-product-nav">
          <button type="button" class="xpv-nav-btn" :disabled="!canPrevProduct"
                  title="上一个产品（Alt+↑）" @click="selectRelativeProduct(-1)">← 上一个</button>
          <span class="xpv-nav-pos">
            {{ currentListIndex >= 0 ? currentListIndex + 1 : '–' }} / {{ filteredProducts.length }}
          </span>
          <button type="button" class="xpv-nav-btn" :disabled="!canNextProduct"
                  title="下一个产品（Alt+↓）" @click="selectRelativeProduct(1)">下一个 →</button>
          <span v-if="dirtyFields.length" class="xpv-nav-dirty">{{ dirtyFields.length }} 项已改</span>
        </div>
        <div v-if="dirtyFields.length" class="xpv-dirty-bar">
          <span class="xpv-dirty-label">本产品已修改：</span>
          <span v-for="item in dirtyFields" :key="item.field" class="xpv-dirty-chip">
            {{ item.label }}
            <button type="button" class="xpv-dirty-reset" :title="dirtyFieldTitle(item)"
                    @click="resetDirtyField(item.field)">↺</button>
          </span>
        </div>
        <details class="xpv-rowbox">
          <summary>该行将写入 Excel 的 11 列文本{{ props.mode === 'review' ? '（未提交决策已计入）' : '' }} — 点击展开/收起</summary>
          <div class="xpv-rowpairs">
            <div v-for="([label, value], i) in rowPairs" :key="i" class="xpv-rowpair">
              <span class="xpv-rowlabel">{{ label }}</span>
              <span class="xpv-rowvalue" :title="value">{{ value || '（空）' }}</span>
            </div>
          </div>
        </details>

        <div class="xpv-form">
          <div class="xpv-row2">
            <label class="xpv-field" data-field="product_name">
              <span title="图册中的原始产品名称">产品名称</span>
              <input class="input" type="text"
                     :value="editValue(selectedProduct.product_candidate_id, 'product_name', selectedProduct.fields?.product_name ?? '')"
                     @input="emit('edit', selectedProduct.product_candidate_id, 'product_name', $event.target.value)">
            </label>
            <label class="xpv-field" data-field="series_name">
              <span title="品牌-系列 的后半段，如「库博-D123」填 D123">产品系列</span>
              <input class="input" type="text"
                     :value="editValue(selectedProduct.product_candidate_id, 'series_name', selectedProduct.fields?.series_name ?? '')"
                     @input="emit('edit', selectedProduct.product_candidate_id, 'series_name', $event.target.value)">
            </label>
            <!-- 品类：16 个类目名下拉（与品牌系列互相独立）；后端导出侧会把清单外取值置空，
                 因此只提供合法选项，杜绝手填被静默清空 -->
            <label class="xpv-field xpv-cat-field" data-field="product_category">
              <span title="产品功能归类，只能从 16 个固定类目里选；与品牌/系列无关">品类</span>
              <select class="input xpv-cat" aria-label="品类"
                      :value="categoryValue"
                      @change="emit('edit', selectedProduct.product_candidate_id, 'product_category', $event.target.value)">
                <option value="">（未识别 —— 导出为空，可人工补选）</option>
                <option v-if="categoryUnmatched" :value="categoryRaw">「{{ categoryRaw }}」（旧值，不在清单内，请重选）</option>
                <option v-for="c in CATEGORY_OPTIONS" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>
          </div>

          <!-- 产品特点：与技术参数同款行式编辑，序号自动排；空行在提交时自动忽略 -->
          <div class="xpv-features" data-field="features">
            <div class="xpv-features-head">
              <span>产品特点</span>
              <button v-if="props.extractImage" type="button" class="xpv-image-btn"
                      title="上传产品特点图片，识别后确认追加"
                      @click="openImageExtract('features')">图片识别</button>
            </div>
            <div class="xpv-features-rows">
              <div v-for="(line, i) in featureRows" :key="i" class="xpv-feature-row">
                <span class="xpv-feature-no">{{ i + 1 }}.</span>
                <input class="input" type="text" placeholder="输入特点内容（可粘贴多行）"
                       :value="line" @input="updateFeatureRow(i, $event.target.value)"
                       @paste="onFeaturePaste(i, $event)"
                       @keydown.enter.prevent="onFeatureEnter(i)">
                <button type="button" class="xpv-row-del" title="删除此条"
                        @click="removeFeatureRow(i)">✕</button>
              </div>
            </div>
            <button type="button" class="xpv-row-add" @click="addFeatureRow">＋ 添加特点</button>
          </div>

          <label class="xpv-field" data-field="installation">
            <span>安装说明</span>
            <textarea class="input xpv-area" rows="3"
                      :value="editValue(selectedProduct.product_candidate_id, 'installation', selectedProduct.fields?.installation ?? '')"
                      @input="emit('edit', selectedProduct.product_candidate_id, 'installation', $event.target.value)"></textarea>
          </label>
          <label class="xpv-field" data-field="precautions">
            <span>注意事项</span>
            <textarea class="input xpv-area" rows="3"
                      :value="editValue(selectedProduct.product_candidate_id, 'precautions', selectedProduct.fields?.precautions ?? '')"
                      @input="emit('edit', selectedProduct.product_candidate_id, 'precautions', $event.target.value)"></textarea>
          </label>
          <button v-if="isEdited(selectedProduct.product_candidate_id)" type="button"
                  class="xpv-reset" @click="emit('reset-edit', selectedProduct.product_candidate_id)">
            恢复本产品原始文字（放弃未提交编辑）
          </button>
          <button v-if="canDelete" type="button" class="xpv-product-del"
                  title="产品与其名下裁剪图一并标记为拒绝，提交后不会写入 Excel"
                  @click="requestDelete(selectedProduct)">
            删除该产品（不写入 Excel）
          </button>
        </div>

        <!-- 技术参数结构化编辑（方案 A）：参数表 + 型号变体行卡片，不接触 JSON -->
        <div v-if="techState" class="xpv-tech" data-field="tech_params">
          <div class="xpv-tech-head">
            <span>技术参数</span>
            <span v-if="techDupNames.length" class="xpv-tech-dup"
                  :title="`同名参数在导出时会以「；」拼接为一个值：${techDupNames.join('、')}`">
              同名参数：{{ techDupNames.join('、') }}
            </span>
            <button type="button" class="xpv-tech-inherit" :disabled="!inheritedTechState"
                    :title="inheritHint" @click="inheritPreviousParamKeys">
              继承上一产品键
            </button>
            <button v-if="props.extractImage" type="button" class="xpv-image-btn"
                    title="上传技术参数图片，识别型号/参数后确认合并"
                    @click="openImageExtract('tech_params')">图片识别</button>
          </div>
          <div class="xpv-tech-table">
            <div v-for="(row, i) in techState.params" :key="'p' + i" class="xpv-tech-row">
              <input class="input xpv-tech-name" type="text" placeholder="参数名（如：长度）"
                     :value="row.name" @input="updateParam(i, 'name', $event.target.value)">
              <input class="input xpv-tech-val" type="text" placeholder="参数值（如：500mm）"
                     :value="row.value" @input="updateParam(i, 'value', $event.target.value)">
              <button type="button" class="xpv-tech-del" title="删除此参数"
                      @click="removeParam(i)">✕</button>
            </div>
            <p v-if="!techState.params.length" class="xpv-hint">暂无参数，点击下方添加</p>
          </div>
          <button type="button" class="xpv-tech-add" @click="addParam">＋ 添加参数</button>

          <!-- 型号变体默认展开（2026-10-27）：折叠态下用户发现不了这块可编辑 -->
          <details class="xpv-readonly" open>
            <summary>型号变体（{{ techState.variants.length }}）——每个变体一张键值卡片</summary>
            <div v-for="(variant, vi) in techState.variants" :key="'v' + vi" class="xpv-variant">
              <div class="xpv-variant-title">变体 {{ vi + 1 }}</div>
              <div v-for="(entry, ei) in variant" :key="ei" class="xpv-tech-row">
                <input class="input xpv-tech-name" type="text" placeholder="属性（如：型号）"
                       :value="entry.key" @input="updateVariantEntry(vi, ei, 'key', $event.target.value)">
                <input class="input xpv-tech-val" type="text" placeholder="值（如：D123）"
                       :value="entry.value" @input="updateVariantEntry(vi, ei, 'value', $event.target.value)">
                <button type="button" class="xpv-tech-del" title="删除此属性"
                        @click="removeVariantEntry(vi, ei)">✕</button>
              </div>
              <button type="button" class="xpv-tech-add" @click="addVariantEntry(vi)">＋ 添加属性</button>
            </div>
            <p v-if="!techState.variants.length" class="xpv-hint">暂无型号变体</p>
            <div class="xpv-variant-actions">
              <button type="button" class="xpv-tech-add" :title="addVariantHint"
                      @click="addVariant">＋ 添加变体</button>
              <button v-if="techState.variants.length" type="button" class="xpv-share-toggle"
                      :class="{ active: shareSettingsOpen }"
                      :title="`哪些键带出共享值：已启用 ${enabledSharedCount}/${shareableKeyCount}`"
                      @click="toggleShareSettings">
                共享值设置 <span class="xpv-share-count">{{ enabledSharedCount }}/{{ shareableKeyCount }}</span>
              </button>
            </div>
            <div v-if="shareSettingsOpen && techState.variants.length" ref="sharePanelRef" class="xpv-share-panel">
              <div class="xpv-share-head">
                <span>新增变体带出的共享值</span>
                <button type="button" class="xpv-share-close" @click="shareSettingsOpen = false">关闭</button>
              </div>
              <p class="xpv-hint">
                勾选的键会带出所有现有变体一致的值；未勾选或值不一致的键留空。型号/货号永不共享。
              </p>
              <div class="xpv-share-rows">
                <label v-for="opt in shareKeyOptions" :key="opt.key" class="xpv-share-row"
                       :class="{ 'is-disabled': !opt.shareable }">
                  <input type="checkbox" :checked="isShareKeyEnabled(opt.key)" :disabled="!opt.shareable"
                         @change="toggleShareKey(opt.key, $event.target.checked)">
                  <span class="xpv-share-key">{{ opt.key }}</span>
                  <span class="xpv-share-val" :title="opt.shareable ? opt.value : opt.reason">
                    {{ opt.shareable ? opt.value : opt.reason }}
                  </span>
                </label>
              </div>
              <div class="xpv-share-actions">
                <button type="button" @click="enableAllShareKeys">全选可共享</button>
                <button type="button" @click="disableAllShareKeys">全不选</button>
              </div>
            </div>
          </details>
        </div>

        <!-- 绑定裁剪图：审核预览图/正式图直显，点击放大（校对文字时对照看图） -->
        <div class="xpv-crops" data-field="images">
          <div class="xpv-crops-head">绑定裁剪图（{{ productImages.length }} 张）</div>
          <div v-if="productImages.length" class="xpv-crops-strip">
            <figure v-for="(img, i) in productImages" :key="img.source_crop_id || i" class="xpv-crop">
              <img v-if="imageSrc(img) && !brokenCrops.has(cropKey(img, i))"
                   :src="imageSrc(img)" loading="lazy" :alt="img.description || '裁剪图'"
                   :title="`${IMAGE_TYPE_LABELS[img.image_type] || img.image_type} · 第 ${img.page_number || '-'} 页${img.description ? ' · ' + img.description : ''}`"
                   @click="enlargeCrop = img"
                   @error="markCropBroken(cropKey(img, i))">
              <div v-else class="xpv-crop-empty">无预览</div>
              <figcaption>
                <span class="xpv-crop-type">{{ IMAGE_TYPE_LABELS[img.image_type] || img.image_type }}</span>
                <span class="xpv-crop-page">P{{ img.page_number || '-' }}</span>
              </figcaption>
            </figure>
          </div>
          <p v-else class="xpv-hint">无图片（均未通过或未决策）</p>
        </div>
      </section>
    </div>
    <p v-else-if="props.preview && !props.loading" class="xpv-hint">
      {{ props.mode === 'review'
        ? '暂无可预览的产品行：产品均未决策或未通过（未决产品会在提交时自动通过后出现在预览中）'
        : '暂无可预览的产品行' }}
    </p>

    <!-- 裁剪图放大遮罩（嵌入模式 absolute 降级，与工作台弹层策略一致） -->
    <Teleport to="body">
      <div v-if="enlargeCrop" class="xpv-crop-mask" :class="{ embedded: props.embedded }"
            @click="enlargeCrop = null">
        <img :src="imageSrc(enlargeCrop)" :alt="enlargeCrop.description || '裁剪图'" @click.stop>
        <div class="xpv-crop-meta" @click.stop>
          <strong>{{ enlargeCrop.description || '（无描述）' }}</strong>
          <span>{{ IMAGE_TYPE_LABELS[enlargeCrop.image_type] || enlargeCrop.image_type }} · 第 {{ enlargeCrop.page_number || '-' }} 页</span>
        </div>
      </div>
    </Teleport>

    <!-- 二次图片识别：上传图片 → 识别 → 合并预览确认后写入当前产品 -->
    <ImageExtractDialog
      v-if="selectedProduct"
      :open="imageDialogOpen"
      :target="imageDialogTarget"
      :product-name="selectedProduct.product_name || ''"
      :current-tech="techState"
      :current-features="featureRows"
      :extract-image="props.extractImage"
      :embedded="props.embedded"
      @close="imageDialogOpen = false"
      @apply-tech="onExtractedTech"
      @apply-features="onExtractedFeatures" />
  </div>
</template>

<style scoped>
.xpv { display: grid; gap: 12px; }
.xpv-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.xpv-scope { display: inline-flex; border: 1px solid var(--border-default); border-radius: var(--radius-md); overflow: hidden; }
.xpv-scope-btn { padding: 5px 12px; border: none; background: transparent; font-size: 12px; color: var(--text-tertiary); cursor: pointer; }
.xpv-scope-btn.active { background: var(--accent-50); color: var(--accent-600); font-weight: 600; }
.xpv-hint { font-size: 12px; color: var(--text-tertiary); }
.xpv-refresh { margin-left: auto; padding: 5px 12px; border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--bg-subtle); font-size: 12px; color: var(--text-secondary); cursor: pointer; }
/* 已删除产品条：删除后行即从预览消失，这里保留入口供逐项撤销 */
.xpv-deleted-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 10px; border: 1px solid var(--danger-600); border-radius: var(--radius-md); background: var(--danger-50); font-size: 12px; }
.xpv-deleted-label { color: var(--danger-600); font-weight: 600; }
.xpv-deleted-chip { display: inline-flex; align-items: center; gap: 6px; padding: 2px 4px 2px 8px; border: 1px solid var(--border-default); border-radius: 999px; background: var(--bg-panel); color: var(--text-secondary); }
.xpv-deleted-name { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.xpv-deleted-undo { padding: 1px 8px; border: 1px solid var(--border-default); border-radius: 999px; background: var(--bg-subtle); font-size: 11px; color: var(--accent-600); cursor: pointer; }
.xpv-deleted-undo:hover { border-color: var(--border-focus); }
/* 删除产品：表格操作列 + 表单底部（危险操作与常规操作拉开） */
.xpv-table-scroll th.xpv-table-op, .xpv-table-scroll td.xpv-table-op { width: 64px; text-align: center; }
.xpv-product-del-mini { padding: 1px 8px; border: 1px solid var(--danger-600); border-radius: var(--radius-sm); background: var(--bg-panel); font-size: 11px; color: var(--danger-600); cursor: pointer; }
.xpv-product-del-mini:hover { background: var(--danger-50); }
.xpv-product-del { justify-self: start; padding: 4px 10px; border: 1px solid var(--danger-600); border-radius: var(--radius-md); background: transparent; font-size: 12px; color: var(--danger-600); cursor: pointer; }
.xpv-product-del:hover { background: var(--danger-50); }
/* 总体预览表格：与结果页导出预览同风格（吸顶表头 + 横向滚动 + 单元格截断悬浮看全） */
.xpv-table-wrap { display: grid; gap: 8px; }
.xpv-table-scroll {
  max-height: 520px;
  overflow: auto;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
}
.xpv-table-scroll table { border-collapse: collapse; font-size: 12px; white-space: nowrap; }
.xpv-table-scroll th,
.xpv-table-scroll td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-default);
  border-right: 1px solid var(--border-default);
  text-align: left;
  color: var(--text-secondary);
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xpv-table-scroll th {
  position: sticky;
  top: 0;
  z-index: 1;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-subtle);
}
.xpv-table-scroll tr:last-child td { border-bottom: none; }
.xpv-table-scroll tbody tr { cursor: pointer; }
.xpv-table-scroll tbody tr:hover td { background: var(--bg-hover); }
/* 已修改行：警告色底 + 行首「已改」标记（写在 hover 之后，同优先级下覆盖 hover） */
.xpv-table-scroll tbody tr.is-edited td { background: var(--warn-50); }
.xpv-table-flag {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border: 1px solid var(--warn-600);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: var(--warn-600);
  background: var(--bg-panel);
}
/* 导出前置校验区：默认折叠成一条计数，点击「查看」再展开问题列表 */
.xpv-validate-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 5px 10px;
  border: 1px solid var(--warn-600);
  border-radius: var(--radius-md);
  background: var(--warn-50);
  font-size: 12px;
}
.xpv-validate-bar.has-error { border-color: var(--danger-600); background: var(--danger-50); }
.xpv-validate-toggle {
  margin-left: auto; padding: 2px 10px;
  border: 1px solid var(--border-default); border-radius: var(--radius-md);
  background: var(--bg-panel); font-size: 12px; color: var(--text-secondary); cursor: pointer;
}
.xpv-validate-toggle:hover { border-color: var(--border-focus); color: var(--accent-600); }
.xpv-validate-list-bar { margin-top: 0; }
.xpv-validate {
  padding: 8px 10px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: 12px;
}
.xpv-validate.has-error { border-color: var(--danger-600); background: var(--danger-50); }
.xpv-validate-summary { color: var(--text-secondary); }
.xpv-validate-summary b.is-error { color: var(--danger-600); margin-right: 6px; }
.xpv-validate-summary b.is-warning { color: var(--warn-600); }
.xpv-validate-list { margin: 6px 0 0; padding: 0; list-style: none; max-height: 140px; overflow: auto; display: grid; gap: 4px; }
.xpv-validate-item {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 8px; border-radius: var(--radius-sm);
  background: var(--bg-subtle); cursor: pointer;
}
.xpv-validate-item:hover { background: var(--bg-hover); }
.xpv-validate-sev { flex: none; padding: 1px 6px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.xpv-validate-item.is-error .xpv-validate-sev { color: var(--danger-600); background: var(--danger-50); }
.xpv-validate-item.is-warning .xpv-validate-sev { color: var(--warn-600); background: var(--warn-50); }
.xpv-validate-name { flex: none; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); font-weight: 600; }
.xpv-validate-msg { color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 主体两栏：产品列表 | 编辑区。列表用细分隔线代替盒子 */
.xpv-body { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: var(--space-4); min-height: 320px; }
/* 折叠态：列表缩为窄条，编辑区占满剩余宽度 */
.xpv-body.no-list { grid-template-columns: 26px minmax(0, 1fr); }
/* 列表列：头部（固定，含折叠按钮）+ 搜索筛选 + 滚动区（仅产品项） */
.xpv-list-col {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  min-width: 0;
  max-height: 560px;
  padding-right: 12px;
  border-right: 1px solid var(--divider, var(--border-default));
}
.xpv-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 2px 2px 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}
/* 搜索/筛选：200px 列宽内紧凑排布，筛选按钮换行也不撑破 */
.xpv-list-tools { display: grid; gap: 5px; padding: 0 2px 8px; }
.xpv-list-search { width: 100%; padding: 4px 8px; font-size: 12px; }
.xpv-list-filters { display: flex; flex-wrap: wrap; gap: 4px; }
.xpv-list-filter {
  padding: 2px 7px;
  border: 1px solid var(--border-default);
  border-radius: 999px;
  background: var(--bg-panel);
  font-size: 11px;
  color: var(--text-tertiary);
  cursor: pointer;
}
.xpv-list-filter:hover { border-color: var(--border-focus); color: var(--accent-600); }
.xpv-list-filter.active { border-color: var(--accent-600); background: var(--accent-50); color: var(--accent-600); font-weight: 600; }
.xpv-list-empty { display: flex; align-items: center; gap: 8px; padding: 6px 2px; }
.xpv-list-clear {
  padding: 1px 8px;
  border: 1px solid var(--border-default);
  border-radius: 999px;
  background: var(--bg-subtle);
  font-size: 11px;
  color: var(--accent-600);
  cursor: pointer;
}
.xpv-list-toggle, .xpv-list-strip {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-panel);
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: color var(--duration-fast), border-color var(--duration-fast);
}
.xpv-list-toggle:hover, .xpv-list-strip:hover { color: var(--accent-600); border-color: var(--border-focus); }
/* 收起态窄条按钮：贴顶、不随列表滚动 */
.xpv-list-strip { align-self: start; position: sticky; top: 0; }
/* 滚动区：只滚产品项；禁横向滚动条（名称溢出由省略号承担，按钮永不被滚走） */
.xpv-list {
  display: grid;
  gap: 4px;
  align-content: start;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.xpv-item {
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  padding: 8px 10px; border: 1px solid transparent; border-radius: var(--radius-md);
  background: transparent; text-align: left; cursor: pointer;
}
.xpv-item:hover { background: var(--bg-hover); }
.xpv-item.active { border-color: var(--border-focus); background: var(--accent-50); }
.xpv-item-name { font-size: 13px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.xpv-item-flag { flex: none; padding: 1px 6px; border-radius: 999px; font-size: 11px; color: var(--warn-600); background: var(--warn-50); }
/* 编辑区：纵向节奏放宽（组间 16px），行文本默认收起只留一行入口 */
/* 产品切换 + 字段级改动条：改动条 sticky 在编辑区顶部，滚动时仍可见 */
.xpv-product-nav { display: flex; align-items: center; gap: 8px; }
.xpv-nav-btn {
  padding: 3px 10px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}
.xpv-nav-btn:hover:not(:disabled) { border-color: var(--border-focus); color: var(--accent-600); }
.xpv-nav-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.xpv-nav-pos { font-size: 12px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.xpv-nav-dirty {
  margin-left: auto;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--warn-50);
  font-size: 11px;
  font-weight: 600;
  color: var(--warn-600);
}
.xpv-dirty-bar {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 6px 8px;
  border: 1px solid var(--warn-600);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  font-size: 12px;
}
.xpv-dirty-label { color: var(--text-secondary); font-weight: 600; }
.xpv-dirty-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 4px 1px 8px;
  border: 1px solid var(--border-default);
  border-radius: 999px;
  background: var(--warn-50);
  color: var(--warn-600);
}
.xpv-dirty-reset {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}
.xpv-dirty-reset:hover { background: var(--bg-hover); }
.xpv-editor { display: grid; gap: var(--space-4); align-content: start; max-height: 560px; overflow: auto; padding-right: 4px; }
.xpv-rowbox, .xpv-readonly { border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 8px 12px; }
.xpv-rowbox summary, .xpv-readonly summary { font-size: 12px; font-weight: 600; color: var(--text-secondary); cursor: pointer; }
.xpv-rowbox summary { color: var(--text-tertiary); font-weight: 500; }
.xpv-rowbox[open] summary { margin-bottom: 4px; color: var(--text-secondary); }
.xpv-rowpairs { display: grid; gap: 6px; margin-top: 8px; }
.xpv-rowpair { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 8px; font-size: 12px; }
.xpv-rowlabel { color: var(--text-tertiary); }
.xpv-rowvalue { color: var(--text-primary); word-break: break-all; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; }
/* 字段区：短字段两列并排（名称+系列、安装+注意），特点为独立结构化卡片 */
.xpv-form { display: grid; gap: 12px; }
.xpv-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 900px) { .xpv-row2 { grid-template-columns: 1fr; } }
/* 品类下拉独占一行（16 条全串较长，挤半栏会截断），沿 .input 盒模型 */
.xpv-row2 .xpv-cat-field { grid-column: 1 / -1; }
select.input.xpv-cat { font-family: inherit; cursor: pointer; }
.xpv-field { display: grid; gap: 4px; }
.xpv-field > span { font-size: 12px; color: var(--text-tertiary); }
.xpv-area { resize: vertical; font-family: inherit; }
/* 多行文本框覆盖全局 .input 的单行盒模型（40px 定高 / 0 纵向内边距）：
   字号与横向内边距和单行输入一致（14px / 14px），纵向按行数展开 */
.xpv-field textarea.xpv-area {
  height: auto;
  min-height: 78px;
  padding: 8px 14px;
  font-size: 14px;
  line-height: 1.6;
}
/* 产品特点：与技术参数同款行式卡片（序号自动排 + 逐条删改 + 添加按钮） */
.xpv-features { display: grid; gap: 8px; border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 10px 12px; }
.xpv-features-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.xpv-features-rows { display: grid; gap: 6px; }
.xpv-feature-row { display: grid; grid-template-columns: 24px minmax(0, 1fr) 26px; gap: 6px; align-items: center; }
.xpv-feature-no { font-size: 12px; color: var(--text-tertiary); text-align: right; font-variant-numeric: tabular-nums; }
.xpv-feature-row .input { padding: 4px 8px; font-size: 12px; }
.xpv-reset { justify-self: start; padding: 4px 10px; border: 1px solid var(--border-default); border-radius: var(--radius-md); background: transparent; font-size: 12px; color: var(--text-secondary); cursor: pointer; }
/* 绑定裁剪图：缩略图条（contain 不裁边——校对要看全图）+ 点击放大 */
.xpv-crops { display: grid; gap: 8px; border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 10px 12px; }
.xpv-crops-head { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.xpv-crops-strip { display: flex; flex-wrap: wrap; gap: 10px; }
.xpv-crop {
  margin: 0;
  width: 128px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-panel);
  overflow: hidden;
  cursor: zoom-in;
  transition: border-color var(--duration-fast);
}
.xpv-crop:hover { border-color: var(--border-focus); }
.xpv-crop img { display: block; width: 100%; height: 96px; object-fit: contain; background: var(--bg-subtle); }
.xpv-crop-empty { display: grid; place-items: center; width: 100%; height: 96px; font-size: 11px; color: var(--text-tertiary); background: var(--bg-subtle); }
.xpv-crop figcaption { display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 3px 6px; font-size: 10px; color: var(--text-tertiary); }
.xpv-crop-type { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.xpv-crop-page { flex: none; font-variant-numeric: tabular-nums; }
/* 裁剪图放大遮罩（复用结果页图片放大的视觉语言） */
.xpv-crop-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  background: rgba(0, 0, 0, 0.72);
}
.xpv-crop-mask.embedded { position: absolute; padding: 16px; }
.xpv-crop-mask img {
  max-width: min(92vw, 1100px);
  max-height: 70vh;
  object-fit: contain;
  border-radius: var(--radius-md);
  background: #fff;
}
.xpv-crop-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  max-width: min(92vw, 1100px);
  color: #fff;
  text-align: center;
}
.xpv-crop-meta strong { font-size: 14px; font-weight: 600; line-height: 1.5; }
.xpv-crop-meta span { font-size: 12px; opacity: 0.85; }
/* 技术参数结构化编辑（方案 A） */
.xpv-tech { display: grid; gap: 8px; border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 10px 12px; }
.xpv-tech-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.xpv-tech-dup { font-weight: 500; color: var(--warn-600); background: var(--warn-50); padding: 1px 8px; border-radius: 999px; }
/* 继承上一产品参数名：只补键不继承值；无可继承时禁用 */
.xpv-tech-inherit { margin-left: auto; padding: 2px 10px; border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--bg-subtle); font-size: 12px; color: var(--text-secondary); cursor: pointer; }
.xpv-tech-inherit:hover:not(:disabled) { border-color: var(--border-focus); color: var(--accent-600); }
.xpv-tech-inherit:disabled { opacity: 0.55; cursor: not-allowed; }
/* 二次图片识别入口（技术参数/产品特点共用） */
.xpv-image-btn { padding: 2px 10px; border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--bg-subtle); font-size: 12px; color: var(--text-secondary); cursor: pointer; }
.xpv-image-btn:hover { border-color: var(--border-focus); color: var(--accent-600); }
.xpv-tech-table { display: grid; gap: 6px; }
.xpv-tech-row { display: grid; grid-template-columns: minmax(90px, 40%) minmax(0, 1fr) 28px; gap: 6px; align-items: center; }
.xpv-tech-row .input { padding: 4px 8px; font-size: 12px; }
/* 行删除/添加：特点与技术参数共用 */
.xpv-row-del, .xpv-tech-del {
  width: 26px; height: 26px; border: none; border-radius: var(--radius-sm);
  background: transparent; color: var(--text-tertiary); cursor: pointer; font-size: 13px;
}
.xpv-row-del:hover, .xpv-tech-del:hover { background: var(--danger-50); color: var(--danger-600); }
.xpv-row-add, .xpv-tech-add { justify-self: start; padding: 3px 10px; border: 1px dashed var(--border-strong); border-radius: var(--radius-md); background: transparent; font-size: 12px; color: var(--text-secondary); cursor: pointer; }
.xpv-row-add:hover, .xpv-tech-add:hover { border-color: var(--border-focus); color: var(--accent-600); }
.xpv-variant { margin-top: 8px; padding: 8px; border: 1px solid var(--divider); border-radius: var(--radius-md); display: grid; gap: 6px; }
.xpv-variant-title { font-size: 11px; color: var(--text-tertiary); font-weight: 600; }
/* 新增变体 + 共享值设置：按钮行与面板分离，避免把复选框挤在添加按钮旁 */
.xpv-variant-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
.xpv-share-toggle {
  padding: 3px 10px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}
.xpv-share-toggle:hover, .xpv-share-toggle.active { border-color: var(--border-focus); color: var(--accent-600); }
.xpv-share-count {
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent-50);
  color: var(--accent-600);
  font-size: 11px;
}
.xpv-share-panel {
  display: grid;
  gap: 6px;
  max-width: 640px;
  margin-top: 6px;
  padding: 8px 10px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}
.xpv-share-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}
.xpv-share-close {
  padding: 1px 8px;
  border: 1px solid var(--border-default);
  border-radius: 999px;
  background: var(--bg-panel);
  font-size: 11px;
  color: var(--text-tertiary);
  cursor: pointer;
}
.xpv-share-rows { display: grid; gap: 3px; max-height: 200px; overflow: auto; }
.xpv-share-row {
  display: grid;
  grid-template-columns: 16px 110px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  padding: 3px 4px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}
.xpv-share-row:hover { background: var(--bg-hover); }
.xpv-share-row.is-disabled { opacity: 0.55; }
.xpv-share-row input { width: 13px; height: 13px; margin: 0; }
.xpv-share-key { color: var(--text-secondary); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.xpv-share-val { color: var(--text-tertiary); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.xpv-share-actions { display: flex; gap: 6px; }
.xpv-share-actions button {
  padding: 2px 8px;
  border: 1px solid var(--border-default);
  border-radius: 999px;
  background: var(--bg-panel);
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
}
.xpv-share-actions button:hover { border-color: var(--border-focus); color: var(--accent-600); }
/* 校验问题定位：目标字段短暂描边，滚动后一眼看到 */
.is-flash { animation: xpv-flash 1.6s ease-out; }
@keyframes xpv-flash {
  0%, 25% { outline: 2px solid var(--accent-600); outline-offset: 2px; }
  100% { outline: 2px solid transparent; outline-offset: 2px; }
}
@media (max-width: 760px) { .xpv-body { grid-template-columns: 1fr; } .xpv-list-col { max-height: 180px; } .xpv-body.no-list { grid-template-columns: 1fr; } .xpv-list-strip { position: static; justify-self: start; } }
</style>
