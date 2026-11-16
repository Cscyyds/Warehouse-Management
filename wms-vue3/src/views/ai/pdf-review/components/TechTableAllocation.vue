<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { allocateTechRows, buildAllocatedTechPreview, variantCodes, type TechAllocationProduct } from '../techParamAllocation';
import { applyTechMerge, type ExtractedData } from '../imageExtract';

const props = defineProps<{ products: TechAllocationProduct[]; extracted: ExtractedData }>();
const emit = defineEmits<{ apply: [changes: { id: string; tech: TechAllocationProduct['tech'] }[]] }>();
const rows = ref(allocateTechRows(props.extracted.variants ?? [], props.products));
const commonTargets = ref<string[]>([]);
const policies = reactive<Record<string, 'keep' | 'overwrite'>>({});
const productIds = computed(() => new Set(props.products.map(product => product.id)));
const pendingCount = computed(() => rows.value.filter(row => row.productId !== 'skip' && (
  !productIds.value.has(row.productId) || (!variantCodes(row.variant).length && !row.model.trim())
)).length);

const groups = computed(() => props.products.flatMap(product => {
  const selected = rows.value.filter(row => row.productId === product.id && (
    variantCodes(row.variant).length || row.model.trim()
  ));
  const common = commonTargets.value.includes(product.id) ? props.extracted.params : [];
  if (!selected.length && !common?.length) return [];
  const { preview, ambiguous } = buildAllocatedTechPreview(product, selected, common);
  const conflicts = [
    ...preview.params.filter(field => field.kind === 'conflict').map(field => ({
      label: field.name, existing: field.existing, incoming: field.incoming,
    })),
    ...preview.variants.flatMap(variant => variant.fields.filter(field => field.kind === 'conflict').map(field => ({
      label: `${variant.modelValue} · ${field.key}`, existing: field.existing, incoming: field.incoming,
    }))),
  ];
  return [{ product, preview, ambiguous, conflicts }];
}));
const canApply = computed(() => groups.value.length > 0
  && groups.value.every(group => !group.ambiguous && (!group.conflicts.length || policies[group.product.id])));

function apply() {
  if (!canApply.value) return;
  emit('apply', groups.value.map(({ product, preview }) => ({
    id: product.id,
    tech: applyTechMerge(product.tech, preview, policies[product.id] || 'keep'),
  })));
}

function label(product: TechAllocationProduct) {
  const codes = [...new Set([product.model, product.itemNo].filter(Boolean))];
  return codes.length ? `${product.name}（${codes.join(' / ')}）` : product.name;
}

defineExpose({ apply, canApply });
</script>

<template>
  <div class="tech-allocation">
    <p>核对每个型号的目标产品，待确认和已跳过的行会留在本次应用之外。</p>
    <section v-if="rows.length" class="allocation-block" aria-label="型号分配">
      <div v-for="(row, index) in rows" :key="index" class="allocation-row">
        <div class="allocation-fields">
          <strong>{{ variantCodes(row.variant).join(' / ') || '型号未识别' }}</strong>
          <span v-for="(value, key) in row.variant" :key="key">{{ key }} · {{ value }}</span>
        </div>
        <label class="allocation-choice">
          <span>目标产品</span>
          <select v-model="row.productId" class="input">
            <option value="">待确认</option>
            <option v-for="product in products" :key="product.id" :value="product.id">{{ label(product) }}</option>
            <option value="skip">跳过此行</option>
          </select>
          <small v-if="!row.productId">{{ row.reason }}</small>
          <input v-if="row.productId && row.productId !== 'skip' && !variantCodes(row.variant).length"
                 v-model="row.model" class="input" aria-label="补填型号或货号" placeholder="补填型号或货号">
        </label>
      </div>
    </section>

    <fieldset v-if="extracted.params?.length" class="allocation-block">
      <legend>公共参数 · 勾选适用产品</legend>
      <div class="allocation-fields">
        <span v-for="(param, index) in extracted.params" :key="index">{{ param.name }} · {{ param.value }}</span>
      </div>
      <div class="allocation-fields">
        <label v-for="product in products" :key="product.id">
          <input v-model="commonTargets" type="checkbox" :value="product.id"> {{ label(product) }}
        </label>
      </div>
    </fieldset>

    <section v-for="group in groups" :key="group.product.id" class="allocation-block">
      <strong>{{ label(group.product) }}</strong>
      <p>型号变体 {{ group.preview.variants.map(variant => variant.modelValue).join('、') || '无' }} · 公共参数 {{ group.preview.params.length }} 项</p>
      <p v-if="group.ambiguous" class="allocation-warning" role="alert">多行指向同一型号，或现有变体有重复匹配。请核对后跳过多余行，或先修正该产品的型号变体。</p>
      <template v-if="group.conflicts.length">
        <ul class="allocation-conflicts">
          <li v-for="(field, index) in group.conflicts" :key="index">{{ field.label }}：{{ field.existing || '空' }} → {{ field.incoming }}</li>
        </ul>
        <label class="allocation-choice">
          <span>该产品的冲突处理</span>
          <select v-model="policies[group.product.id]" class="input">
            <option :value="undefined" disabled>请选择</option>
            <option value="keep">保留原值</option>
            <option value="overwrite">采用识别值</option>
          </select>
        </label>
      </template>
    </section>
    <p v-if="pendingCount" class="allocation-warning" role="status">还有 {{ pendingCount }} 行待确认。</p>
  </div>
</template>

<style scoped>
.tech-allocation, .allocation-choice, .allocation-block { display: grid; gap: 8px; }
.tech-allocation { font-size: 13px; color: var(--text-secondary); }
.tech-allocation p { margin: 0; }
.tech-allocation strong, .tech-allocation legend { color: var(--text-primary); }
.allocation-block { min-width: 0; margin: 0; padding: 10px; border: 1px solid var(--border-default); border-radius: var(--radius-md); }
.allocation-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 220px); gap: 12px; }
.allocation-row + .allocation-row { border-top: 1px solid var(--border-default); padding-top: 8px; }
.allocation-fields { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; overflow-wrap: anywhere; }
.allocation-choice { align-content: start; }
.allocation-choice .input { width: 100%; min-width: 0; }
.allocation-conflicts { margin: 0; padding-inline-start: 20px; overflow-wrap: anywhere; }
.allocation-warning { color: var(--warn-600); }
@media (max-width: 600px) { .allocation-row { grid-template-columns: 1fr; } }
</style>
