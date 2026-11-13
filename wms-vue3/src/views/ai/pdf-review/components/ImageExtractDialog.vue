<script setup>
// 裁剪或上传图片后沿用识别、合并预览和应用流程。
// 只负责识别与确认，不直接改产品数据；最终通过 apply-tech / apply-features 交给面板写入。
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import Modal from './Modal.vue';
import ImageRegionPicker from './ImageRegionPicker.vue';
import {
  applyFeatureMerge,
  applyTechMerge,
  buildTechMergePreview,
  previewFeatureMerge,
} from '../imageExtract';

const props = defineProps({
  open: { type: Boolean, default: false },
  target: { type: String, default: 'tech_params' },   // tech_params | features
  productName: { type: String, default: '' },
  currentTech: { type: Object, default: null },
  currentFeatures: { type: Array, default: () => [] },
  sources: { type: Array, default: () => [] },
  // 父级注入的识别函数：({ file, target, hint }) => Promise<ExtractedData>
  extractImage: { type: Function, default: null },
  embedded: { type: Boolean, default: false }
});
const emit = defineEmits(['close', 'apply-tech', 'apply-features']);

const MAX_BYTES = 10 * 1024 * 1024;
const POLICY_OPTIONS = [
  { value: 'append', label: '追加去重（旧值；新值）' },
  { value: 'keep', label: '保留现有' },
  { value: 'overwrite', label: '覆盖为识别值' },
];

const fileInput = ref(null);
const picker = ref(null);
const hasSelection = ref(false);
const inputMode = ref('upload');
const file = ref(null);
const previewUrl = ref('');
const status = ref('idle');          // idle | loading | ready | error
const error = ref('');
const extracted = ref(null);
const policy = ref('append');
const featureSelected = ref([]);
let requestSeq = 0;

const title = computed(() => (
  props.target === 'features' ? '图片识别产品特点' : '图片识别技术参数'
));
const subtitle = computed(() => props.productName || '');
const recognizeLabel = computed(() => {
  if (status.value === 'loading') return '识别中…';
  if (status.value === 'error') return '重新识别';
  return '开始识别';
});

const techPreview = computed(() => (
  props.target === 'tech_params'
    ? buildTechMergePreview(props.currentTech, extracted.value)
    : { params: [], variants: [] }
));
const techSummary = computed(() => {
  const preview = techPreview.value;
  const paramAdd = preview.params.filter((item) => item.kind === 'add').length;
  const paramConflict = preview.params.filter((item) => item.kind === 'conflict').length;
  const variantAdd = preview.variants.filter((item) => item.kind === 'add').length;
  const variantMerge = preview.variants.filter((item) => item.kind === 'merge').length;
  const variantConflict = preview.variants.reduce(
    (total, item) => total + item.fields.filter((field) => field.kind === 'conflict').length,
    0
  );
  return { paramAdd, paramConflict, variantAdd, variantMerge, variantConflict };
});
const techHasItems = computed(() => (
  techPreview.value.params.length > 0 || techPreview.value.variants.length > 0
));
const featurePreview = computed(() => (
  props.target === 'features'
    ? previewFeatureMerge(props.currentFeatures, extracted.value?.features)
    : []
));
watch(featurePreview, (items) => {
  featureSelected.value = items.map((item) => !item.duplicate);
}, { immediate: true });

const canApply = computed(() => {
  if (status.value !== 'ready' || !extracted.value) return false;
  if (props.target === 'tech_params') return techHasItems.value;
  return featureSelected.value.some((checked, i) => checked && !featurePreview.value[i]?.duplicate);
});

function reset() {
  requestSeq += 1;
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  file.value = null;
  previewUrl.value = '';
  status.value = 'idle';
  error.value = '';
  extracted.value = null;
  policy.value = 'append';
  featureSelected.value = [];
}

watch([() => props.open, () => props.target], ([open]) => {
  reset();
  hasSelection.value = false;
  if (open) inputMode.value = props.sources.length ? 'crop' : 'upload';
}, { immediate: true });

onBeforeUnmount(() => {
  requestSeq += 1;
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});

function openFilePicker() {
  fileInput.value?.click();
}

function changeInputMode(mode) {
  if (inputMode.value === mode || status.value === 'loading') return;
  reset();
  hasSelection.value = false;
  inputMode.value = mode;
}

function setFile(nextFile) {
  if (!nextFile || status.value === 'loading') return;
  const type = String(nextFile.type || '').toLowerCase();
  const name = String(nextFile.name || '').toLowerCase();
  if (!(type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/.test(name))) {
    error.value = '请选择图片文件（JPG/PNG/WebP）';
    return;
  }
  if (nextFile.size > MAX_BYTES) {
    error.value = `图片超过 ${MAX_BYTES / 1024 / 1024}MB，请压缩后再试`;
    return;
  }
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  file.value = nextFile;
  previewUrl.value = URL.createObjectURL(nextFile);
  extracted.value = null;
  status.value = 'idle';
  error.value = '';
}

function onFileChange(event) {
  setFile(event.target.files?.[0]);
  event.target.value = '';
}

function onDrop(event) {
  if (status.value === 'loading') return;
  const nextFile = event.dataTransfer?.files?.[0];
  if (!nextFile) return;
  changeInputMode('upload');
  setFile(nextFile);
}

function normalizeData(data) {
  return {
    target: String(data?.target || props.target),
    params: Array.isArray(data?.params) ? data.params : [],
    variants: Array.isArray(data?.variants) ? data.variants : [],
    features: Array.isArray(data?.features) ? data.features : [],
    warnings: Array.isArray(data?.warnings) ? data.warnings : [],
    model: String(data?.model || ''),
  };
}

async function recognize() {
  if (!props.extractImage || status.value === 'loading') return;
  if (inputMode.value === 'crop' ? !hasSelection.value : !file.value) return;
  const seq = ++requestSeq;
  status.value = 'loading';
  error.value = '';
  try {
    const sourceFile = inputMode.value === 'crop' ? await picker.value.buildFile() : file.value;
    if (seq !== requestSeq) return;
    if (sourceFile.size > MAX_BYTES) throw new Error('选区图片超过 10MB，请缩小选区再试');
    if (inputMode.value === 'crop') {
      if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = URL.createObjectURL(sourceFile);
    }
    const data = await props.extractImage({
      file: sourceFile,
      target: props.target,
      hint: props.productName || '',
    });
    if (seq !== requestSeq) return;
    extracted.value = normalizeData(data);
    status.value = 'ready';
  } catch (exc) {
    if (seq !== requestSeq) return;
    error.value = exc?.message || '识别失败，请重试';
    status.value = 'error';
  }
}

function apply() {
  if (!canApply.value) return;
  if (props.target === 'tech_params') {
    emit('apply-tech', applyTechMerge(props.currentTech, techPreview.value, policy.value));
  } else {
    const selected = featurePreview.value.filter(
      (item, i) => featureSelected.value[i] && !item.duplicate
    );
    emit('apply-features', applyFeatureMerge(props.currentFeatures, selected));
  }
  emit('close');
}

function kindText(kind) {
  if (kind === 'add') return '新增';
  if (kind === 'same') return '同值跳过';
  return '冲突';
}

function variantLabel(variant) {
  return variant.modelKey && variant.modelValue
    ? `${variant.modelKey}：${variant.modelValue}`
    : '未识别型号';
}

function variantAction(variant) {
  return variant.kind === 'add' ? '新增变体' : `合并到变体 ${variant.targetIndex + 1}`;
}
</script>

<template>
  <Modal :open="props.open" :title="title" :subtitle="subtitle"
         scroll-content
         :scroll-lock="props.embedded ? '.workbench-body' : 'body'"
         @close="emit('close')">
    <div class="reimage" @dragover.prevent @drop.prevent="onDrop">
      <input ref="fileInput" class="reimage-file" type="file" accept="image/*"
             @change="onFileChange">
      <div v-if="sources.length" class="reimage-input-options">
        <button class="btn btn-ghost" type="button" :aria-pressed="inputMode === 'crop'"
                :disabled="status === 'loading'" @click="changeInputMode('crop')">从 PDF 原页裁剪</button>
        <button class="btn btn-ghost" type="button" :aria-pressed="inputMode === 'upload'"
                :disabled="status === 'loading'" @click="changeInputMode('upload')">上传图片</button>
      </div>
      <ImageRegionPicker v-if="inputMode === 'crop'" v-show="status !== 'ready'"
                         ref="picker" :sources="sources" :disabled="status === 'loading'"
                         @selection-change="hasSelection = $event" />
      <div v-if="inputMode === 'upload' && !previewUrl" class="reimage-drop" role="button" tabindex="0"
           @click="openFilePicker" @keydown.enter.prevent="openFilePicker">
        <strong>点击选择图片</strong>
        <span>或把图片拖到这里；支持 JPG/PNG/WebP，建议只截取参数表或特点区域</span>
      </div>
      <div v-if="previewUrl && (inputMode === 'upload' || status === 'ready')" class="reimage-preview">
        <img :src="previewUrl" alt="待识别图片">
        <div class="reimage-preview-bar">
          <span :title="file?.name">{{ inputMode === 'crop' ? '识别选区' : file?.name }}</span>
          <button v-if="inputMode === 'crop'" type="button" @click="reset">重新裁剪</button>
          <button v-else type="button" :disabled="status === 'loading'" @click="openFilePicker">换一张</button>
        </div>
      </div>

      <p v-if="error" class="reimage-error">{{ error }}</p>
      <p v-if="status === 'loading'" class="reimage-loading">
        正在识别图片，通常需要十几秒，请稍候…
      </p>

      <template v-if="status === 'ready' && extracted">
        <template v-if="target === 'tech_params'">
          <p class="reimage-summary">
            识别到 {{ extracted.params.length }} 个公共参数、{{ extracted.variants.length }} 个型号变体<template
              v-if="techSummary.paramConflict || techSummary.variantConflict">，{{ techSummary.paramConflict + techSummary.variantConflict }} 处同名键冲突</template>
          </p>

          <div v-if="techPreview.params.length" class="reimage-block">
            <div class="reimage-block-head">公共参数</div>
            <div class="reimage-table">
              <div class="reimage-tr reimage-th">
                <span>参数名</span><span>识别值</span><span>现有值</span><span>状态</span>
              </div>
              <div v-for="(item, i) in techPreview.params" :key="'p' + i" class="reimage-tr">
                <span :title="item.name">{{ item.name }}</span>
                <span :title="item.incoming">{{ item.incoming }}</span>
                <span :title="item.existing">{{ item.existing || '（空）' }}</span>
                <span class="reimage-kind" :class="'is-' + item.kind">{{ kindText(item.kind) }}</span>
              </div>
            </div>
          </div>

          <div v-if="techPreview.variants.length" class="reimage-block">
            <div class="reimage-block-head">型号变体</div>
            <div v-for="(variant, i) in techPreview.variants" :key="'v' + i" class="reimage-variant">
              <div class="reimage-variant-head">
                <strong :title="variantLabel(variant)">{{ variantLabel(variant) }}</strong>
                <span>{{ variantAction(variant) }}</span>
              </div>
              <div class="reimage-variant-fields">
                <span v-for="(field, j) in variant.fields" :key="j"
                      class="reimage-field" :class="'is-' + field.kind">
                  {{ field.key }}：{{ field.incoming }}
                  <em v-if="field.kind === 'conflict'">（现有 {{ field.existing || '空' }}）</em>
                </span>
              </div>
            </div>
          </div>

          <label v-if="techSummary.paramConflict || techSummary.variantConflict" class="reimage-policy">
            <span>同名键冲突处理</span>
            <select v-model="policy" class="input">
              <option v-for="option in POLICY_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <span class="reimage-policy-hint">仅影响冲突键，新增项仍会加入</span>
          </label>
        </template>

        <template v-else>
          <p class="reimage-summary">识别到 {{ featurePreview.length }} 条产品特点</p>
          <div class="reimage-feature-list">
            <label v-for="(item, i) in featurePreview" :key="i" class="reimage-feature"
                   :class="{ 'is-duplicate': item.duplicate }">
              <input v-model="featureSelected[i]" type="checkbox" :disabled="item.duplicate">
              <span>{{ item.text }}</span>
              <em v-if="item.duplicate">已存在，跳过</em>
            </label>
          </div>
        </template>

        <div v-if="extracted.warnings.length" class="reimage-warnings">
          <strong>识别提示</strong>
          <p v-for="(warning, i) in extracted.warnings" :key="'w' + i">{{ warning }}</p>
        </div>
      </template>
    </div>

    <template #footer>
      <button class="btn btn-secondary" type="button" @click="emit('close')">取消</button>
      <button v-if="status !== 'ready'" class="btn btn-primary" type="button"
              :disabled="(inputMode === 'crop' ? !hasSelection : !file) || status === 'loading' || !props.extractImage"
              @click="recognize">
        {{ recognizeLabel }}
      </button>
      <button v-else class="btn btn-primary" type="button" :disabled="!canApply" @click="apply">
        应用到当前产品
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.reimage { display: grid; gap: 12px; }
.reimage-file { display: none; }
.reimage-input-options { display: flex; gap: 8px; flex-wrap: wrap; }
.reimage-input-options [aria-pressed="true"] { background: var(--accent-50); color: var(--accent-600); }
.reimage-drop {
  display: grid;
  place-items: center;
  gap: 6px;
  padding: 28px 20px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  text-align: center;
  cursor: pointer;
}
.reimage-drop:hover { border-color: var(--border-focus); }
.reimage-drop strong { font-size: 14px; color: var(--text-primary); }
.reimage-drop span { font-size: 12px; color: var(--text-tertiary); }
.reimage-preview { display: grid; gap: 8px; }
.reimage-preview img {
  display: block;
  max-width: 100%;
  max-height: 260px;
  margin: 0 auto;
  object-fit: contain;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}
.reimage-preview-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--text-tertiary); }
.reimage-preview-bar span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reimage-preview-bar button { padding: 2px 8px; border: 1px solid var(--border-default); border-radius: 999px; background: var(--bg-panel); font-size: 11px; color: var(--text-secondary); cursor: pointer; }
.reimage-error { padding: 6px 10px; border: 1px solid var(--danger-600); border-radius: var(--radius-sm); background: var(--danger-50); color: var(--danger-600); font-size: 12px; }
.reimage-loading { padding: 6px 10px; border-radius: var(--radius-sm); background: var(--accent-50); color: var(--accent-600); font-size: 12px; }
.reimage-summary { font-size: 12px; color: var(--text-secondary); }
.reimage-block { display: grid; gap: 6px; padding: 8px 10px; border: 1px solid var(--border-default); border-radius: var(--radius-md); }
.reimage-block-head { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.reimage-table { display: grid; gap: 2px; max-height: 220px; overflow: auto; }
.reimage-tr {
  display: grid;
  grid-template-columns: minmax(90px, 1.1fr) minmax(90px, 1fr) minmax(90px, 1fr) 72px;
  gap: 8px;
  align-items: center;
  padding: 4px 6px;
  border-bottom: 1px solid var(--divider);
  font-size: 12px;
}
.reimage-tr:last-child { border-bottom: none; }
.reimage-tr span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reimage-th { font-weight: 600; color: var(--text-tertiary); background: var(--bg-subtle); }
.reimage-kind { justify-self: start; padding: 1px 6px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.reimage-kind.is-add { color: var(--success-600); background: var(--success-50); }
.reimage-kind.is-same { color: var(--text-tertiary); background: var(--bg-subtle); }
.reimage-kind.is-conflict { color: var(--warn-600); background: var(--warn-50); }
.reimage-variant { display: grid; gap: 4px; padding: 6px 8px; border: 1px solid var(--divider); border-radius: var(--radius-sm); }
.reimage-variant-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; }
.reimage-variant-head strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); }
.reimage-variant-head span { flex: none; color: var(--text-tertiary); }
.reimage-variant-fields { display: flex; flex-wrap: wrap; gap: 4px; }
.reimage-field { padding: 1px 6px; border-radius: var(--radius-sm); background: var(--bg-subtle); font-size: 11px; color: var(--text-secondary); }
.reimage-field.is-conflict { background: var(--warn-50); color: var(--warn-600); }
.reimage-field.is-add { background: var(--success-50); color: var(--success-600); }
.reimage-field em { font-style: normal; opacity: 0.8; }
.reimage-policy { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; color: var(--text-secondary); }
.reimage-policy select { width: auto; min-width: 220px; padding: 4px 8px; font-size: 12px; }
.reimage-policy-hint { font-size: 11px; color: var(--text-tertiary); }
.reimage-feature-list { display: grid; gap: 4px; max-height: 260px; overflow: auto; }
.reimage-feature { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 4px 6px; border-radius: var(--radius-sm); font-size: 12px; }
.reimage-feature:hover { background: var(--bg-hover); }
.reimage-feature.is-duplicate { opacity: 0.55; }
.reimage-feature span { min-width: 0; word-break: break-word; }
.reimage-feature em { flex: none; font-style: normal; color: var(--text-tertiary); }
.reimage-warnings { padding: 6px 10px; border: 1px solid var(--warn-600); border-radius: var(--radius-sm); background: var(--warn-50); font-size: 12px; color: var(--warn-600); }
.reimage-warnings strong { display: block; margin-bottom: 2px; }
.reimage-warnings p { margin: 0; }
</style>
