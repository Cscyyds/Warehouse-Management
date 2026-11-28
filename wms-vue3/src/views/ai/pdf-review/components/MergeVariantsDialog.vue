<script setup>
import { computed, ref } from 'vue';
import Modal from './Modal.vue';
import { IMAGE_TYPE_LABELS } from '../imageTypes';

const props = defineProps({
  products: { type: Array, required: true },
  initialTarget: { type: String, required: true },
  requestMerge: { type: Function, required: true },
  assetBase: { type: String, default: '' },
  embedded: Boolean
});
const emit = defineEmits(['close', 'merged']);
const selected = ref([props.initialTarget]);
const target = ref(props.initialTarget);
const productName = ref('');
const busy = ref(false);
const error = ref('');
const preview = ref(null);
const binding = ref('');
const choices = ref({});
const cropChoices = ref([]);
const expandedImage = ref(null);
const selectedImageCount = computed(() => new Set(cropChoices.value.flat()).size);
const modelOverrides = ref({});
const selectedProducts = computed(() => props.products.filter(p => selected.value.includes(p.product_candidate_id)));
const missingModels = computed(() => selectedProducts.value.filter(p => !p.fields?.product_model
  && !p.fields?.item_no && !p.fields?.tech_params_structured?.variants?.length));
const canConfirm = computed(() => preview.value
  && (preview.value.binding_options.length < 2 || binding.value)
  && preview.value.parameter_conflicts.every(conflict => choices.value[conflict.id]));

function toggleProduct(id, checked) {
  selected.value = checked ? [...selected.value, id] : selected.value.filter(value => value !== id);
  if (!selected.value.includes(target.value)) chooseTarget(selected.value[0] || '');
}

function chooseTarget(id) {
  target.value = id;
  productName.value = '';
}

function bindingLabel(option) {
  if (option.binding_type === 'skip') return '跳过回写';
  if (option.binding_type === 'new_row') return '新建产品行';
  return '知识库记录 ' + option.source_record_id;
}

function imageUrl(image) {
  return image.preview_url || (props.assetBase && props.assetBase + encodeURIComponent(image.source_crop_id));
}

async function submit(confirm) {
  busy.value = true;
  error.value = '';
  try {
    const result = await props.requestMerge({
      product_ids: selected.value,
      target_id: target.value,
      product_name: productName.value,
      model_overrides: Object.fromEntries(missingModels.value.map(p => [p.product_candidate_id,
        modelOverrides.value[p.product_candidate_id] || ''])),
      ...(confirm ? { preview_token: preview.value.preview_token,
        binding_product_id: binding.value, parameter_choices: choices.value, variant_crop_ids: cropChoices.value } : {})
    });
    if (confirm) emit('merged', result.target_id);
    else {
      preview.value = result;
      binding.value = '';
      choices.value = {};
      cropChoices.value = result.variant_images.map(group => group.images.map(image => image.source_crop_id));
    }
  } catch (exc) {
    error.value = exc?.message || '型号变体合并失败';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal open title="合并为型号变体" scroll-content :scroll-lock="embedded ? '.workbench-body' : 'body'"
         @close="!busy && emit('close')">
    <div class="merge-fields" :aria-busy="busy">
      <img v-if="expandedImage" class="merge-image-expanded" :src="imageUrl(expandedImage)"
           :alt="expandedImage.description || '候选图片'">
      <template v-else-if="!preview">
        <p>选择属于同一产品的行。合并后，每个型号的参数会保存在各自的变体中。</p>
        <div class="merge-products">
          <label v-for="product in products" :key="product.product_candidate_id">
            <input type="checkbox" :checked="selected.includes(product.product_candidate_id)" :disabled="busy"
                   @change="toggleProduct(product.product_candidate_id, $event.target.checked)">
            <span>{{ product.product_name }} <small>{{ product.fields?.product_model || product.fields?.item_no }}</small></span>
          </label>
        </div>
        <label v-for="product in missingModels" :key="product.product_candidate_id">
          {{ product.product_name }}的型号
          <input v-model="modelOverrides[product.product_candidate_id]" class="input"
                 maxlength="128" :disabled="busy" placeholder="如原文有型号，请填写">
        </label>
        <label>保留的产品行
          <select class="input" :value="target" :disabled="busy || !selectedProducts.length"
                  @change="chooseTarget($event.target.value)">
            <option v-for="product in selectedProducts" :key="product.product_candidate_id"
                    :value="product.product_candidate_id">{{ product.product_name }}</option>
          </select>
        </label>
        <label>合并后的产品名称
          <input v-model="productName" class="input" maxlength="300" :disabled="busy"
                 :placeholder="selectedProducts.find(p => p.product_candidate_id === target)?.product_name || ''">
        </label>
      </template>
      <template v-else>
        <p><strong>{{ preview.product_name }}</strong> · {{ preview.variants.length }} 个变体 · 已选 {{ selectedImageCount }}/{{ preview.crop_count }} 张图</p>
        <label v-if="preview.binding_options.length > 1">合并后使用的回写目标
          <select v-model="binding" class="input" :disabled="busy">
            <option value="">请选择</option>
            <option v-for="option in preview.binding_options" :key="option.product_candidate_id" :value="option.product_candidate_id">
              {{ option.product_name }} · {{ bindingLabel(option) }}
            </option>
          </select>
        </label>
        <p v-else-if="preview.binding_options.length">回写目标 · {{ bindingLabel(preview.binding_options[0]) }}</p>
        <label v-for="conflict in preview.parameter_conflicts" :key="conflict.id">
          {{ conflict.model }} · {{ conflict.name }} 有多个值
          <select v-model="choices[conflict.id]" class="input" :disabled="busy">
            <option :value="undefined">请选择保留的值</option>
            <option v-for="option in conflict.options" :key="option.value" :value="option.value">
              {{ option.value }}（{{ option.sources.join('、') }}）
            </option>
          </select>
        </label>
        <details v-for="(row, index) in preview.variants" :key="index" open>
          <summary>{{ row.型号 }} <small v-if="row.货号 && row.货号 !== row.型号"> · {{ row.货号 }}</small>
            <small> · 已选 {{ cropChoices[index].length }} 张图</small>
          </summary>
          <dl>
            <template v-for="(value, name) in row" :key="name">
              <template v-if="name !== '型号' && name !== '货号'"><dt>{{ name }}</dt><dd>{{ value }}</dd></template>
            </template>
          </dl>
          <div v-if="preview.variant_images[index].images.length" class="merge-images">
            <div v-for="image in preview.variant_images[index].images" :key="image.source_crop_id" class="merge-image">
              <button v-if="imageUrl(image)" type="button" class="merge-image-preview" :disabled="busy"
                      :aria-label="'放大查看：' + (image.description || IMAGE_TYPE_LABELS[image.image_type] || '候选图片')"
                      @click="expandedImage = image">
                <img :src="imageUrl(image)" alt="" loading="lazy">
              </button>
              <label>
                <input v-model="cropChoices[index]" type="checkbox" :value="image.source_crop_id" :disabled="busy">
                <span>{{ IMAGE_TYPE_LABELS[image.image_type] || '候选图片' }}<span v-if="image.pdf_page_number"> · 第 {{ image.pdf_page_number }} 页</span>
                  <small v-if="image.description">{{ image.description }}</small>
                </span>
              </label>
            </div>
          </div>
          <p v-else class="merge-no-image">此型号暂无候选图片</p>
        </details>
        <details v-if="preview.installation">
          <summary>合并后的安装说明</summary>
          <p class="merge-installation">{{ preview.installation }}</p>
        </details>
        <p>确认后，勾选的图片归到保留行，共用图片只保留一份。完全取消勾选的图片标记为跳过。</p>
      </template>
      <p v-if="error" class="merge-error" role="alert">{{ error }}</p>
    </div>
    <template #footer>
      <button v-if="expandedImage" type="button" class="btn btn-secondary"
              @click="expandedImage = null">返回图片选择</button>
      <template v-else-if="preview">
        <button type="button" class="btn btn-secondary" :disabled="busy"
                @click="preview = null; error = ''">返回修改</button>
        <button type="button" class="btn btn-primary" :disabled="busy || !canConfirm"
                @click="submit(true)">确认合并</button>
      </template>
      <template v-else>
        <button type="button" class="btn btn-secondary" :disabled="busy" @click="emit('close')">取消</button>
        <button type="button" class="btn btn-primary" :disabled="busy || selected.length < 2 || !target"
                @click="submit(false)">预览合并</button>
      </template>
    </template>
  </Modal>
</template>

<style scoped>
.merge-fields { display: grid; gap: 12px; overflow-wrap: anywhere; }
.merge-fields p, .merge-fields dl { margin: 0; }
.merge-fields label { display: grid; gap: 6px; }
.merge-products { display: grid; gap: 6px; max-height: 230px; overflow: auto; }
.merge-products label { grid-template-columns: auto 1fr; align-items: start; padding: 7px; }
.merge-fields details { border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 9px; }
.merge-fields summary { cursor: pointer; font-weight: 600; }
.merge-fields dl { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 4px 12px; padding-top: 8px; }
.merge-fields dd { margin: 0; }
.merge-images { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 8px; margin-top: 10px; }
.merge-image { min-width: 0; border: 1px solid var(--border-default); border-radius: var(--radius-md); overflow: hidden; }
.merge-image-preview { display: block; width: 100%; padding: 0; border: 0; background: var(--bg-subtle, #f4f4f5); cursor: zoom-in; }
.merge-image-preview:focus-visible { outline: 2px solid var(--primary-500); outline-offset: -2px; }
.merge-image img { display: block; width: 100%; height: 96px; object-fit: contain; }
.merge-image-expanded { width: 100%; max-height: 65vh; object-fit: contain; }
.merge-image label { grid-template-columns: auto minmax(0, 1fr); align-items: start; padding: 7px; cursor: pointer; }
.merge-image small { display: block; margin-top: 2px; }
.merge-fields .merge-no-image { margin-top: 8px; }
.merge-installation { white-space: pre-line; padding-top: 8px; }
.merge-error { color: var(--danger-600); }
</style>
