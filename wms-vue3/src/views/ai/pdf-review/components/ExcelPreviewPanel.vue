<script setup>
// Excel 文字预览与编辑面板（2026-10-27 由 ExcelPreviewDrawer 抽屉内容提取为内嵌面板）。
// 审核页（mode='review'）：中栏「图片审核 ⇄ Excel 文字预览」视图切换的承载组件；
// 结果页（mode='result'）：导出后就地检查/修改文字，重新导出时随 export-xlsx 提交补丁。
// 行文本来自后端 xlsx-preview（与导出同一函数生成，所见即所写）；
// 组件自身不发起提交。纯逻辑在 ../excelPreview.ts 与 ../techParams.ts。
import { computed, ref, watch } from 'vue';
import { CATEGORY_OPTIONS, featuresToText } from '../excelPreview';
import { duplicateParamNames, techEditFromFields } from '../techParams';
import { IMAGE_TYPE_LABELS } from '../imageTypes';

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
  embedded: { type: Boolean, default: false }
});
const emit = defineEmits(['refresh', 'edit', 'reset-edit']);

const scope = ref('batch');   // 'batch' | 'all'（仅 review 模式展示切换）
const selectedPcid = ref('');
// 视图切换：form = 按产品编辑（默认）；table = 总体预览（全量行表格，与导出同源）
const view = ref('form');
// 导出前置校验提示暂不对用户展示（2026-10-27 产品决策）：数据照常拉取，
// 恢复展示时改回 true 即可
const SHOW_VALIDATE = false;
// 左侧产品列表可折叠（2026-10-27）：想让编辑区更宽时收起；组件内记忆，切产品不重置
const listOpen = ref(true);

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
});

const productsAll = computed(() => props.preview?.products || []);
const tableRows = computed(() => props.preview?.rows || []);
const selectedProduct = computed(
  () => productsAll.value.find(p => p.product_candidate_id === selectedPcid.value) || null
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
function isEdited(pcid) {
  return !!props.productEdits[pcid];
}
// ── 总体预览（表格视图）：全量行与导出同源；已修改产品行高亮，
//    点击行定位到该产品的编辑视图（发现问题 → 就地修改）──
const editedRowCount = computed(
  () => productsAll.value.filter(p => isEdited(p.product_candidate_id)).length
);
function focusRowProduct(rowIndex) {
  const p = productsAll.value[rowIndex];
  if (!p) return;
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
watch(selectedPcid, () => { brokenCrops.value = new Set(); enlargeCrop.value = null; });
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
}

// ── 导出前置校验：error=建议修复，warning=提示；点击条目定位产品 ──
const validationIssues = computed(() => props.validation?.issues || []);
const validationStats = computed(() => props.validation?.stats || { rows: 0, errors: 0, warnings: 0 });
function severityClass(issue) { return issue.severity === 'error' ? 'is-error' : 'is-warning'; }
function focusIssue(issue) {
  if (issue?.product_candidate_id) selectedPcid.value = issue.product_candidate_id;
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

function emitTech(next) {
  const pcid = selectedProduct.value?.product_candidate_id;
  if (pcid) emit('edit', pcid, 'techParams', next);
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
}
function removeVariantEntry(vi, ei) {
  const next = JSON.parse(JSON.stringify(techState.value || { params: [], variants: [] }));
  next.variants[vi].splice(ei, 1);
  if (!next.variants[vi].length) next.variants.splice(vi, 1);
  emitTech(next);
}
function addVariant() {
  const next = JSON.parse(JSON.stringify(techState.value || { params: [], variants: [] }));
  next.variants.push([{ key: '型号', value: '' }]);
  emitTech(next);
}
</script>

<template>
  <div class="xpv">
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

    <!-- 导出前置校验：随预览刷新（同源同载荷）；点击条目定位到对应产品 -->
    <div v-if="SHOW_VALIDATE && props.validation" class="xpv-validate" :class="{ 'has-error': validationStats.errors > 0 }">
        <span class="xpv-validate-summary">
          校验 {{ validationStats.rows }} 行：
          <template v-if="!validationIssues.length">✓ 无问题</template>
          <template v-else>
            <b v-if="validationStats.errors" class="is-error">{{ validationStats.errors }} 个需修复</b>
            <b v-if="validationStats.warnings" class="is-warning">{{ validationStats.warnings }} 个提示</b>
          </template>
        </span>
      <ul v-if="validationIssues.length" class="xpv-validate-list">
        <li v-for="(issue, i) in validationIssues" :key="i"
            class="xpv-validate-item" :class="severityClass(issue)"
            :title="`定位到产品：${issue.product_name || issue.product_candidate_id}`"
            @click="focusIssue(issue)">
          <span class="xpv-validate-sev">{{ issue.severity === 'error' ? '修复' : '提示' }}</span>
          <span class="xpv-validate-name">{{ issue.product_name || issue.product_candidate_id }}</span>
          <span class="xpv-validate-msg">{{ issue.message }}</span>
        </li>
      </ul>
    </div>

    <!-- 原始报错不再展示给用户（2026-10-27）：HTTP 状态/后端 detail 属开发向信息；
         失败时面板落到下方空态提示，刷新按钮可重试 -->
    <p v-if="props.loading && !props.preview" class="xpv-hint">正在生成预览…</p>

    <!-- 总体预览：全量行表格（与导出同源）；已修改行黄色标出，点击行定位到该产品编辑 -->
    <div v-if="props.preview && view === 'table' && tableRows.length" class="xpv-table-wrap">
      <div class="xpv-table-scroll">
        <table>
          <thead>
            <tr><th v-for="(c, ci) in (props.preview?.headers || [])" :key="ci">{{ c }}</th></tr>
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
          <span>产品（{{ visibleProducts.length }}）</span>
          <button type="button" class="xpv-list-toggle" title="收起产品列表"
                  aria-label="收起产品列表" @click="listOpen = false">«</button>
        </div>
        <div class="xpv-list">
          <button v-for="p in visibleProducts" :key="p.product_candidate_id" type="button"
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
            <label class="xpv-field">
              <span title="图册中的原始产品名称">产品名称</span>
              <input class="input" type="text"
                     :value="editValue(selectedProduct.product_candidate_id, 'product_name', selectedProduct.fields?.product_name ?? '')"
                     @input="emit('edit', selectedProduct.product_candidate_id, 'product_name', $event.target.value)">
            </label>
            <label class="xpv-field">
              <span title="品牌-系列 的后半段，如「库博-D123」填 D123">产品系列</span>
              <input class="input" type="text"
                     :value="editValue(selectedProduct.product_candidate_id, 'series_name', selectedProduct.fields?.series_name ?? '')"
                     @input="emit('edit', selectedProduct.product_candidate_id, 'series_name', $event.target.value)">
            </label>
            <!-- 品类：17 条闭集下拉（与品牌系列互相独立）；后端导出侧会把清单外取值置空，
                 因此只提供合法选项，杜绝手填被静默清空 -->
            <label class="xpv-field xpv-cat-field">
              <span title="产品功能归类，只能从 17 条固定清单里选；与品牌/系列无关">品类</span>
              <select class="input xpv-cat" aria-label="品类"
                      :value="editValue(selectedProduct.product_candidate_id, 'product_category', selectedProduct.fields?.product_category ?? '')"
                      @change="emit('edit', selectedProduct.product_candidate_id, 'product_category', $event.target.value)">
                <option value="">（未识别 —— 导出为空，可人工补选）</option>
                <option v-for="c in CATEGORY_OPTIONS" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>
          </div>

          <!-- 产品特点：与技术参数同款行式编辑，序号自动排；空行在提交时自动忽略 -->
          <div class="xpv-features">
            <div class="xpv-features-head">产品特点</div>
            <div class="xpv-features-rows">
              <div v-for="(line, i) in featureRows" :key="i" class="xpv-feature-row">
                <span class="xpv-feature-no">{{ i + 1 }}.</span>
                <input class="input" type="text" placeholder="输入特点内容"
                       :value="line" @input="updateFeatureRow(i, $event.target.value)">
                <button type="button" class="xpv-row-del" title="删除此条"
                        @click="removeFeatureRow(i)">✕</button>
              </div>
            </div>
            <button type="button" class="xpv-row-add" @click="addFeatureRow">＋ 添加特点</button>
          </div>

          <label class="xpv-field">
            <span>安装说明</span>
            <textarea class="input xpv-area" rows="3"
                      :value="editValue(selectedProduct.product_candidate_id, 'installation', selectedProduct.fields?.installation ?? '')"
                      @input="emit('edit', selectedProduct.product_candidate_id, 'installation', $event.target.value)"></textarea>
          </label>
          <label class="xpv-field">
            <span>注意事项</span>
            <textarea class="input xpv-area" rows="3"
                      :value="editValue(selectedProduct.product_candidate_id, 'precautions', selectedProduct.fields?.precautions ?? '')"
                      @input="emit('edit', selectedProduct.product_candidate_id, 'precautions', $event.target.value)"></textarea>
          </label>
          <button v-if="isEdited(selectedProduct.product_candidate_id)" type="button"
                  class="xpv-reset" @click="emit('reset-edit', selectedProduct.product_candidate_id)">
            恢复本产品原始文字（放弃未提交编辑）
          </button>
        </div>

        <!-- 技术参数结构化编辑（方案 A）：参数表 + 型号变体行卡片，不接触 JSON -->
        <div v-if="techState" class="xpv-tech">
          <div class="xpv-tech-head">
            <span>技术参数</span>
            <span v-if="techDupNames.length" class="xpv-tech-dup"
                  :title="`同名参数在导出时会以「；」拼接为一个值：${techDupNames.join('、')}`">
              同名参数：{{ techDupNames.join('、') }}
            </span>
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
            <button type="button" class="xpv-tech-add" @click="addVariant">＋ 添加变体</button>
          </details>
        </div>

        <!-- 绑定裁剪图：审核预览图/正式图直显，点击放大（校对文字时对照看图） -->
        <div class="xpv-crops">
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
/* 导出前置校验区 */
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
/* 列表列：头部（固定，含折叠按钮）+ 滚动区（仅产品项），两段分离 */
.xpv-list-col {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
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
/* 品类下拉独占一行（17 条全串较长，挤半栏会截断），沿 .input 盒模型 */
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
.xpv-features-head { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
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
.xpv-tech-head { display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.xpv-tech-dup { font-weight: 500; color: var(--warn-600); background: var(--warn-50); padding: 1px 8px; border-radius: 999px; }
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
.xpv-readonly > .xpv-tech-add { margin-top: 6px; }
@media (max-width: 760px) { .xpv-body { grid-template-columns: 1fr; } .xpv-list-col { max-height: 180px; } .xpv-body.no-list { grid-template-columns: 1fr; } .xpv-list-strip { position: static; justify-self: start; } }
</style>
