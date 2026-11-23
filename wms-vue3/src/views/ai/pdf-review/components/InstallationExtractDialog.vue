<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import AutoHeightTextarea from './AutoHeightTextarea.vue';
import ImageRegionPicker from './ImageRegionPicker.vue';
import Modal from './Modal.vue';
import {
  INSTALLATION_GROUPS, INSTALLATION_REGION_TYPES, KEEP_PART_NAME,
  mergeInstallationText, renderInstallationForProduct,
} from '../installationExtract';

const props = defineProps({
  open: { type: Boolean, default: false },
  productName: { type: String, default: '' },
  productModel: { type: String, default: '' },
  productId: { type: String, required: true },
  targets: { type: Array, required: true },
  sources: { type: Array, default: () => [] },
  extract: { type: Function, required: true },
  embedded: { type: Boolean, default: false },
});
const emit = defineEmits(['close', 'apply']);
const MAX_REGIONS = 4;
const MAX_BYTES = 5 * 1024 * 1024;

const picker = ref(null);
const selected = ref(false);
const regions = ref([]);
const busy = ref(false);
const error = ref('');
const result = ref(null);
const drafts = ref([]);
const activeProductId = ref('');
let request;
const hasInstallationImage = computed(() => regions.value.some(region => region.role !== 'parts'));
const sourceRegions = computed(() => Object.fromEntries(regions.value.map((region, index) => [`图${index + 1}`, region])));
const hasInstructions = computed(() => INSTALLATION_GROUPS.some(([key]) => result.value?.[key]?.length));
const activeDraft = computed(() => drafts.value.find(draft => draft.checked && draft.id === activeProductId.value)
  || drafts.value.find(draft => draft.checked));
const changes = computed(() => drafts.value.filter(draft => draft.checked && draft.text.trim()
  && draft.text.trim() !== draft.currentText.trim()).map(({ id, text }) => ({ id, text: text.trim() })));

function clearResult() {
  result.value = null;
  drafts.value = [];
  error.value = '';
}

function reset() {
  request?.abort();
  request = null;
  busy.value = false;
  selected.value = false;
  for (const region of regions.value) URL.revokeObjectURL(region.url);
  regions.value = [];
  clearResult();
}

watch(() => props.open, (open) => { if (!open) reset(); });
onBeforeUnmount(reset);

async function confirmRegion() {
  const currentPicker = picker.value;
  if (!selected.value || busy.value || regions.value.length >= MAX_REGIONS) return;
  clearResult();
  busy.value = true;
  try {
    const region = await currentPicker.buildRegion();
    if (!props.open || picker.value !== currentPicker) return;
    if (region.file.size > MAX_BYTES) throw new Error('选区图片超过 5 MB，请缩小选区或分开框选');
    regions.value.push({ ...region, role: 'installation', url: URL.createObjectURL(region.file) });
    currentPicker.clearSelection();
  } catch (exc) {
    if (props.open && picker.value === currentPicker) error.value = exc?.message || '无法生成选区';
  } finally {
    if (picker.value === currentPicker) busy.value = false;
  }
}

function removeRegion(index) {
  const [region] = regions.value.splice(index, 1);
  URL.revokeObjectURL(region.url);
  clearResult();
}

async function recognize() {
  if (!hasInstallationImage.value || busy.value || selected.value) return;
  clearResult();
  const controller = new AbortController();
  request = controller;
  busy.value = true;
  try {
    const data = await props.extract({ regions: regions.value, productName: props.productName,
      productModel: props.productModel, signal: controller.signal });
    if (controller.signal.aborted) return;
    result.value = data;
    if (hasInstructions.value) {
      activeProductId.value = props.productId;
      drafts.value = props.targets.map(target => {
        const preview = renderInstallationForProduct(data, target.model || '');
        const generated = mergeInstallationText(target.currentText, preview);
        return { ...target, checked: target.id === props.productId, preview, generated,
          text: generated, choices: {}, editedBeforeChoice: false };
      });
    }
  } catch (exc) {
    if (!controller.signal.aborted) error.value = exc?.message || '安装图识别失败，请重试';
  } finally {
    if (request === controller) {
      request = null;
      busy.value = false;
    }
  }
}

function choosePart(draft, key, rowId) {
  draft.choices[key] = rowId;
  draft.preview = renderInstallationForProduct(result.value, draft.model || '', draft.choices);
  const generated = mergeInstallationText(draft.currentText, draft.preview);
  if (draft.text === draft.generated) draft.text = generated;
  else if (draft.generated !== generated) draft.editedBeforeChoice = true;
  draft.generated = generated;
}

function partLabel(row) {
  return [row.marker, row.name, row.model, row.applies_to.join(' / ') || (row.common ? '通用' : '适用产品未标明')]
    .filter(Boolean).join(' · ');
}

function apply() {
  if (changes.value.length) emit('apply', changes.value);
}
</script>

<template>
  <Modal :open="open" title="从安装图生成说明" :subtitle="productName" scroll-content
         :scroll-lock="embedded ? '.workbench-body' : 'body'" @close="emit('close')">
    <div class="installation-extract">
      <template v-if="!result">
        <ImageRegionPicker v-if="open" ref="picker" :sources="sources" :allow-whole-page="false" confirm-selection
                           :instructions="regions.length >= MAX_REGIONS
                             ? `已确认 ${MAX_REGIONS} 个选区，可生成安装说明。移除已有选区后可继续框选。`
                             : `拖动框选安装图，确认后可在缩略图上标记类型。需要补全配件型号时，另框选包含表头的配件表并标记为「配件表」。可滚轮缩放、跨页框选，最多确认 ${MAX_REGIONS} 个选区。`"
                           :max-bytes="MAX_BYTES" :disabled="busy || regions.length >= MAX_REGIONS"
                           @selection-change="selected = $event" @confirm="confirmRegion" />
      </template>
      <ul v-if="regions.length" class="regions">
        <li v-for="(region, index) in regions" :key="region.url">
          <img :src="region.url" :alt="'图' + (index + 1) + '的选区'">
          <div>图{{ index + 1 }} · 第 {{ region.page }} 页</div>
          <select v-if="!result" v-model="region.role" class="input region-role" :disabled="busy"
                  :aria-label="'图' + (index + 1) + '的选区类型'">
            <option v-for="(label, role) in INSTALLATION_REGION_TYPES" :key="role" :value="role">{{ label }}</option>
          </select>
          <small v-else>{{ INSTALLATION_REGION_TYPES[region.role] }}</small>
          <button v-if="!result" class="btn btn-ghost" type="button" :disabled="busy"
                  :aria-label="'移除图' + (index + 1)" @click="removeRegion(index)">移除</button>
        </li>
      </ul>
      <p v-if="!result && regions.length && !hasInstallationImage">请再框选至少一张安装图。</p>
      <p v-if="error" class="extract-error" role="alert">{{ error }}</p>
      <template v-if="result">
        <div v-if="hasInstructions && drafts.length > 1" class="installation-text">
          <p>勾选共用这份安装图的产品，再逐个核对配件型号和写入文字。</p>
          <div class="installation-products">
            <div v-for="draft in drafts" :key="draft.id" class="installation-target">
              <label>
                <input v-model="draft.checked" type="checkbox" @change="draft.checked && (activeProductId = draft.id)">
                <span>{{ draft.name }}<small v-if="draft.model"> · {{ draft.model }}</small></span>
              </label>
              <button v-if="draft.checked" class="btn btn-ghost" type="button"
                      :aria-pressed="activeDraft?.id === draft.id" @click="activeProductId = draft.id">
                {{ activeDraft?.id === draft.id ? '当前预览' : '查看说明' }}
              </button>
            </div>
          </div>
        </div>
        <template v-if="activeDraft">
          <template v-for="[key, label] in INSTALLATION_GROUPS" :key="key">
            <section v-if="activeDraft.preview[key].length">
              <strong>{{ label }}</strong>
              <component :is="key === 'steps' ? 'ol' : 'ul'">
                <li v-for="(item, index) in activeDraft.preview[key]" :key="index">
                  {{ item.text }}
                  <template v-for="id in item.source_ids" :key="id">
                    <a v-if="sourceRegions[id]" class="installation-source" :href="sourceRegions[id].url"
                       target="_blank" rel="noopener" :title="'查看' + id + '的选区'">
                      {{ id }} · {{ sourceRegions[id].role === 'installation' ? '安装图' : INSTALLATION_REGION_TYPES[sourceRegions[id].role] }}
                    </a>
                  </template>
                  <div v-for="review in item.partReviews" :key="review.key" class="part-review">
                    <span v-if="!review.options.length">{{ review.name }} · {{ review.message }}</span>
                    <span v-else-if="!activeDraft.choices[review.key]">{{ review.name }} · 待核对型号</span>
                    <span v-else>{{ review.name }} · {{ activeDraft.choices[review.key] === KEEP_PART_NAME ? '已保留名称' : '已选型号' }}</span>
                    <select v-if="review.options.length" class="input" :value="activeDraft.choices[review.key] || ''"
                            :aria-label="review.name + '的配件型号'"
                            @change="choosePart(activeDraft, review.key, $event.target.value)">
                      <option value="" disabled>请选择型号</option>
                      <option :value="KEEP_PART_NAME">仅保留配件名称</option>
                      <option v-for="row in review.options" :key="row.id" :value="row.id">{{ partLabel(row) }}</option>
                    </select>
                  </div>
                </li>
              </component>
            </section>
          </template>
        </template>
        <section v-if="result.warnings?.length" class="extract-warnings">
          <strong>待确认</strong>
          <ul><li v-for="item in result.warnings" :key="item.text">{{ item.text }} <small>{{ item.source_ids.join('、') }}</small></li></ul>
        </section>
        <div v-if="activeDraft" class="installation-text" :key="activeDraft.id">
          <label class="installation-text">
            <span>写入安装说明的文字</span>
            <AutoHeightTextarea v-model="activeDraft.text" />
          </label>
          <p v-if="activeDraft.editedBeforeChoice && activeDraft.text !== activeDraft.generated" class="extract-warnings">
            已保留手动编辑，请按上方配件选择同步核对写入文字。
          </p>
        </div>
        <p v-else-if="!hasInstructions">没有可写入的安装说明，请调整选区后重试。</p>
      </template>
    </div>
    <template #footer>
      <button class="btn btn-secondary" type="button" @click="emit('close')">取消</button>
      <button v-if="result" class="btn btn-secondary" type="button" @click="clearResult">返回选区</button>
      <button v-if="result" class="btn btn-primary" type="button"
              :disabled="!changes.length" @click="apply">应用到安装说明</button>
      <button v-else class="btn btn-primary" type="button" :disabled="busy || !hasInstallationImage || selected"
              @click="recognize">{{ request && busy ? '正在生成…' : '生成安装说明' }}</button>
    </template>
  </Modal>
</template>

<style scoped>
.installation-extract, .installation-text { display: grid; gap: 10px; font-size: 13px; }
.installation-products { display: grid; gap: 6px; }
.installation-target, .installation-target label { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.installation-extract p { margin: 0; }
.regions { display: flex; flex-wrap: wrap; gap: 10px; margin: 0; padding: 0; list-style: none; }
.regions li { padding: 6px; border: 1px solid var(--border-default); border-radius: var(--radius-sm); }
.regions img { display: block; width: 120px; height: 78px; object-fit: contain; }
.region-role { display: block; width: 100%; margin-block: 4px; }
.installation-source { display: inline-block; margin-inline-start: 8px; color: var(--text-secondary); text-decoration: underline; }
.part-review { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 4px 0; color: var(--warn-600); }
.part-review select { max-width: 100%; }
.installation-extract section ul, .installation-extract section ol { margin: 4px 0 0; padding-inline-start: 22px; }
.installation-extract small { color: var(--text-tertiary); }
.extract-error { color: var(--danger-600); }
.extract-warnings { color: var(--warn-600); }
</style>
