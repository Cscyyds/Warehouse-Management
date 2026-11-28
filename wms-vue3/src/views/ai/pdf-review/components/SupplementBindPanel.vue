<template>
  <!-- 补充说明任务（task_type=supplement）专属：目标产品行绑定面板。
       每个识别产品一张绑定卡：知识库候选行单选（按型号/名称匹配打分）+
       新建产品行 / 跳过；候选不对可手输搜索。保存后发布完成即可回写知识库。
       数据与 API 都在父组件（index.vue），本组件只管选择状态与展示。 -->
  <section class="supp-bind">
    <header class="supp-bind-head">
      <div class="supp-bind-heading">
        <div class="supp-title-row">
          <h3 class="supp-bind-title">目标产品行绑定</h3>
          <span v-if="products.length" class="supp-progress" :class="{ 'is-saved': saved }" aria-live="polite">
            {{ saved ? '已保存' : `已选择 ${products.length - pendingCount} / ${products.length}` }}
          </span>
        </div>
        <p v-if="hint" class="supp-bind-meta" role="status">{{ hint }}</p>
      </div>
      <div class="supp-bind-actions">
        <button class="btn btn-secondary" type="button" :disabled="loading" @click="openAdd">从知识库添加</button>
        <button class="btn btn-secondary" type="button" :disabled="loading" @click="emit('refresh')">刷新匹配</button>
        <button class="btn btn-primary" type="button" :disabled="!canSave" @click="save">
          {{ saved ? '更新绑定' : '保存绑定' }}
        </button>
        <button v-if="p" class="btn btn-ghost" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
          {{ expanded ? '收起' : '展开' }}
        </button>
      </div>
    </header>
    <p v-if="duplicateTarget" class="supp-alert" role="alert">同一知识库产品只能绑定一次。</p>
    <p v-if="!p" class="supp-bind-empty" role="status">{{ loading ? '正在加载候选…' : '暂无识别产品' }}</p>

    <div v-if="p" v-show="expanded" class="supp-content" :aria-busy="loading">
      <div class="supp-toolbar">
        <div class="supp-card-title">
          <strong>{{ productName(p) }}</strong>
          <span v-if="p.product_model" class="supp-model">{{ p.product_model }}</span>
          <span class="supp-state" :class="{ 'is-pending': !currentSelection }">
            {{ currentSelection ? bindingLabels[currentSelection.binding_type] : '待确认' }}
          </span>
        </div>
        <nav v-if="products.length > 1" class="supp-pages" aria-label="绑定产品分页">
          <button class="supp-page" type="button" aria-label="上一页"
                  :disabled="page === 1" @click="page--">‹</button>
          <button v-for="number in visiblePages" :key="number" class="supp-page" type="button"
                  :aria-current="page === number ? 'page' : undefined"
                  :aria-label="pageLabel(number)" :title="pageLabel(number)" @click="page = number">{{ number }}</button>
          <button class="supp-page" type="button" aria-label="下一页"
                  :disabled="page === products.length" @click="page++">›</button>
          <span class="supp-page-count" aria-live="polite">{{ page }} / {{ products.length }}</span>
        </nav>
      </div>

      <div :key="p.product_candidate_id" class="supp-card" role="group" :aria-label="productName(p) + '的回写目标'">
        <div class="supp-candidates">
          <div class="supp-subhead">知识库候选 <span>{{ currentCandidates.length }}</span></div>
          <p v-if="currentSelection?.binding_type === 'existing' && selectedOutsideResults" class="supp-existing">
            已选记录 {{ currentSelection.source_record_id }}
          </p>
          <p v-if="!currentCandidates.length" class="supp-bind-empty" role="status">
            {{ loading ? '正在加载候选…' : '暂无候选，可按型号或产品名搜索。' }}
          </p>
          <div v-else class="supp-candidate-list">
            <label v-for="c in currentCandidates" :key="`${c.official_product_id}/${c.source_record_id}`" class="supp-opt">
              <input type="radio" :name="bindName(p)" :disabled="loading"
                     :checked="isSelected(p, 'existing', c.official_product_id, c.source_record_id)"
                     @change="pick(p, 'existing', c.official_product_id, c.source_record_id)">
              <span class="supp-opt-body">
                <span class="supp-opt-name">{{ optName(c) }}</span>
                <span v-if="optMeta(c)" class="supp-opt-meta">{{ optMeta(c) }}</span>
              </span>
              <span class="supp-score" title="匹配分数">{{ scoreText(c) }}</span>
            </label>
          </div>
        </div>

        <div class="supp-alternatives">
          <form class="supp-search" @submit.prevent="search(p)">
            <label class="supp-subhead" :for="searchInputId(p)">搜索知识库</label>
            <div class="supp-search-row">
              <input :id="searchInputId(p)" v-model="queryBy[p.product_candidate_id]" class="supp-search-input" type="search"
                     placeholder="型号或产品名">
              <button class="btn btn-secondary" type="submit" :disabled="loading || !queryBy[p.product_candidate_id]?.trim()">搜索</button>
            </div>
          </form>
          <div class="supp-other-options">
            <label class="supp-opt">
              <input type="radio" :name="bindName(p)" :disabled="loading" :checked="isSelected(p, 'new_row')"
                     @change="pick(p, 'new_row', '', '')">
              <span class="supp-opt-body"><span class="supp-opt-name">新建产品行</span>
                <span class="supp-opt-meta">在知识库新增一条记录</span></span>
            </label>
            <label class="supp-opt">
              <input type="radio" :name="bindName(p)" :disabled="loading" :checked="isSelected(p, 'skip')"
                     @change="pick(p, 'skip', '', '')">
              <span class="supp-opt-body"><span class="supp-opt-name">跳过回写</span>
                <span class="supp-opt-meta">保留此产品的审核和导出</span></span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <Modal :open="addOpen" title="从知识库添加适用产品"
           subtitle="补入漏识别的产品行：搜索知识库多选确认，补入后走同一套审核、导出与回写"
           scroll-content scroll-lock=".workbench-body" @close="addOpen = false">
      <div class="supp-add">
        <form class="supp-search" @submit.prevent="addSearch">
          <label class="supp-subhead" for="supp-add-search">搜索知识库</label>
          <div class="supp-search-row">
            <input id="supp-add-search" v-model="addQuery" class="supp-search-input" type="search"
                   placeholder="型号或产品名">
            <button class="btn btn-secondary" type="submit" :disabled="addLoading || !addQuery.trim()">搜索</button>
          </div>
        </form>
        <p v-if="addHint" class="supp-bind-empty" role="status">{{ addHint }}</p>
        <div v-if="addResults.length" class="supp-candidate-list supp-add-list">
          <label v-for="c in addResults" :key="addKey(c)" class="supp-opt">
            <input type="checkbox" :disabled="addLoading" :checked="addSelected.includes(addKey(c))"
                   @change="toggleAdd(c)">
            <span class="supp-opt-body">
              <span class="supp-opt-name">{{ optName(c) }}</span>
              <span v-if="optMeta(c)" class="supp-opt-meta">{{ optMeta(c) }}</span>
            </span>
          </label>
        </div>
        <p v-else-if="addSearched && !addLoading" class="supp-bind-empty" role="status">暂无候选，请换型号或产品名搜索。</p>
      </div>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="addOpen = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="addLoading || !addSelected.length" @click="confirmAdd">
          补入 {{ addSelected.length }} 个产品
        </button>
      </template>
    </Modal>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import Modal from './Modal.vue';

type Product = { product_candidate_id: string; product_name: string; product_model?: string };
const bindingLabels = { existing: '已选记录', new_row: '待新建', skip: '跳过回写' };
type BindingType = keyof typeof bindingLabels;
type Selection = { product_candidate_id: string; binding_type: BindingType; official_product_id: string; source_record_id: string };

const props = defineProps({
  // 审核快照产品（product_candidate_id / product_name）
  products: { type: Array as () => Product[], default: () => [] },
  // GET supplement/matches 的 matches 数组（含任务级 product_candidate_id='' 的兜底候选）
  matches: { type: Array as () => any[], default: () => [] },
  loading: { type: Boolean, default: false },
  hint: { type: String, default: '' },
  // 绑定已保存（持久徽标 + 按钮转「更新绑定」）；改绑后再次保存仍为 true
  saved: { type: Boolean, default: false },
  bindings: { type: Object as () => Record<string, Selection>, default: () => ({}) },
  searchResults: { type: Object as () => Record<string, any[]>, default: () => ({}) },
  // 「从知识库添加适用产品」弹窗：候选/加载/提示由父组件供给（API 在父组件）
  addResults: { type: Array as () => any[], default: () => [] },
  addLoading: { type: Boolean, default: false },
  addHint: { type: String, default: '' },
});

const emit = defineEmits(['refresh', 'search', 'save', 'select', 'add-search', 'add-confirm']);

const queryBy = reactive<Record<string, string>>({});
const page = ref(1);
const expanded = ref(true);
const p = computed(() => props.products[page.value - 1]);
const currentSelection = computed(() => p.value ? props.bindings[p.value.product_candidate_id] : undefined);
const currentCandidates = computed(() => p.value ? candidatesOf(p.value) : []);
const visiblePages = computed(() => {
  const count = Math.min(5, props.products.length);
  const first = Math.max(1, Math.min(page.value - 2, props.products.length - count + 1));
  return Array.from({ length: count }, (_, i) => first + i);
});
watch(() => props.products.length, (length) => {
  page.value = Math.min(page.value, Math.max(1, length));
});

function pageLabel(number: number) {
  return `第 ${number} 页 · ${productName(props.products[number - 1])}`;
}

const pendingCount = computed(() => props.products.filter(p => !props.bindings[p.product_candidate_id]).length);
const duplicateTarget = computed(() => {
  const ids = props.products.map(p => props.bindings[p.product_candidate_id])
    .filter(b => b?.binding_type === 'existing').map(b => b.official_product_id);
  return new Set(ids).size !== ids.length;
});
const canSave = computed(() => !props.loading && props.products.length > 0 && !pendingCount.value && !duplicateTarget.value);

function candidatesOf(p: Product) {
  const own = props.matches.find((m: any) => m.product_candidate_id === p.product_candidate_id);
  const jobLevel: any = props.matches.find((m: any) => !m.product_candidate_id);
  const recommended = own?.candidates?.length ? own.candidates : (jobLevel?.candidates || []);
  const candidates = [...(props.searchResults[p.product_candidate_id] || []), ...recommended];
  const seen = new Set<string>();
  return candidates.filter(c => {
    const key = `${c.official_product_id}/${c.source_record_id}`;
    if (!c.source_record_id || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── 展示辅助：模板表达式里不放中文字符串字面量（Vite 模板表达式解析器
//    对全角字符 + 引号的组合会误判"字符串未闭合"，统一收敛到 script）──
function bindName(p: Product) { return 'bind_' + p.product_candidate_id; }
function searchInputId(p: Product) { return 'supp-bind-search-' + p.product_candidate_id; }
function productName(p: Product) { return p.product_name || '（未命名产品）'; }
function optName(c: any) { return c?.summary?.product_name || '（未命名）'; }
function scoreText(c: any) {
  const s = Number(c?.score ?? 0);
  return Number.isFinite(s) ? s.toFixed(2) : String(c?.score ?? '');
}
function optMeta(c: any) {
  const s = c?.summary || {};
  return [s.brand, s.series, s.primary_model, s.catalog_name,
    s.model_count > 0 && `${s.model_count} 个型号`, s.image_count > 0 && `${s.image_count} 张图片`,
    s.installation_chars > 0 && `安装说明 ${s.installation_chars} 字`,
  ].filter(Boolean).join(' · ');
}

function isSelected(p: Product, type: string, pid = '', srid = '') {
  const cur = props.bindings[p.product_candidate_id];
  if (!cur) return false;
  return cur.binding_type === type && (type !== 'existing' || (cur.official_product_id === pid && cur.source_record_id === srid));
}

const selectedOutsideResults = computed(() => !currentCandidates.value.some(c =>
  c.official_product_id === currentSelection.value?.official_product_id
  && c.source_record_id === currentSelection.value?.source_record_id));

function pick(p: Product, type: BindingType, pid: string, srid: string) {
  emit('select', { product_candidate_id: p.product_candidate_id, binding_type: type, official_product_id: pid, source_record_id: srid });
}

function search(p: Product) {
  const q = (queryBy[p.product_candidate_id] || '').trim();
  if (!props.loading && q) emit('search', { id: p.product_candidate_id, query: q });
}

// ── 从知识库添加适用产品（二期：共用说明书漏识别的产品补入审核快照）──
const addOpen = ref(false);
const addQuery = ref('');
const addSearched = ref(false);
const addSelected = ref<string[]>([]);

function addKey(c: any) { return `${c.official_product_id}/${c.source_record_id}`; }

function openAdd() {
  addSelected.value = [];
  addOpen.value = true;
}

function addSearch() {
  const q = addQuery.value.trim();
  if (props.addLoading || !q) return;
  addSearched.value = true;
  emit('add-search', q);
}

function toggleAdd(c: any) {
  const key = addKey(c);
  addSelected.value = addSelected.value.includes(key)
    ? addSelected.value.filter(k => k !== key)
    : [...addSelected.value, key];
}

function confirmAdd() {
  if (props.addLoading || !addSelected.value.length) return;
  const targets = props.addResults
    .filter(c => addSelected.value.includes(addKey(c)))
    .map(c => ({ official_product_id: c.official_product_id, source_record_id: c.source_record_id }));
  addOpen.value = false;
  addSelected.value = [];
  emit('add-confirm', targets);
}

function save() {
  if (!canSave.value) return;
  emit('save', props.products.map(p => props.bindings[p.product_candidate_id]));
}
</script>

<style scoped>
/* 主题适配：全部引用 .pdf-workbench 桥接的设计令牌（index.vue 定义，
   浅色/深色随 html.dark 自动翻转），不自造变量、不硬编码颜色 */
.supp-bind {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg, 12px);
  padding: 16px;
  margin-bottom: 16px;
  background: var(--bg-panel);
  container-type: inline-size;
}
.supp-bind-head, .supp-title-row, .supp-toolbar, .supp-card-title, .supp-pages {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
}
.supp-bind-head, .supp-toolbar { justify-content: space-between; gap: 12px; }
.supp-bind-heading { min-width: 0; flex: 1 1 210px; }
.supp-bind-title { font-size: 16px; font-weight: 650; margin: 0; color: var(--text-primary); }
.supp-bind-meta { margin: 4px 0 0; font-size: 12px; color: var(--text-secondary); overflow-wrap: anywhere; }
.supp-bind-actions, .supp-search-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.supp-bind-actions .btn, .supp-search-row .btn { min-height: 34px; height: auto; padding: 6px 12px; font-size: 13px; }
.supp-progress, .supp-state {
  display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px;
  color: var(--text-secondary); background: var(--bg-subtle); white-space: nowrap;
}
.supp-progress.is-saved { color: var(--success-600); background: var(--success-50); }
.supp-content { margin-top: 12px; border-top: 1px solid var(--border-default); padding-top: 12px; }
.supp-card-title { font-size: 14px; color: var(--text-primary); min-width: 0; overflow-wrap: anywhere; }
.supp-card-title strong { font-weight: 650; }
.supp-model, .supp-score { font-variant-numeric: tabular-nums; }
.supp-model { font-size: 12px; color: var(--text-secondary); }
.supp-state.is-pending { color: var(--warn-600); background: var(--warn-50); }
.supp-pages { gap: 4px; }
.supp-page {
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: var(--bg-panel);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}
.supp-page:hover:not(:disabled), .supp-page[aria-current="page"] {
  border-color: var(--accent-600);
  color: var(--accent-600);
  background: var(--accent-50);
}
.supp-page[aria-current="page"] { font-weight: 600; }
.supp-page:disabled { opacity: .45; cursor: default; }
.supp-page-count { margin-left: 4px; font-size: 12px; color: var(--text-secondary); white-space: nowrap; }
.supp-alert { margin: 8px 0 0; font-size: 13px; color: var(--warn-600); }
.supp-bind-empty, .supp-existing { margin: 0; padding: 8px 0; font-size: 13px; color: var(--text-secondary); }
.supp-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(245px, 32%);
  gap: 12px;
  margin-top: 10px;
}
.supp-candidates, .supp-alternatives { display: grid; align-content: start; gap: 8px; min-width: 0; }
.supp-subhead { display: flex; align-items: baseline; gap: 6px; font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.supp-subhead span { font-variant-numeric: tabular-nums; }
.supp-candidate-list, .supp-other-options { display: grid; align-content: start; gap: 4px; }
.supp-candidate-list { max-height: min(310px, 45vh); padding: 2px; overflow-y: auto; }
.supp-opt {
  display: flex; gap: 8px; align-items: flex-start; min-width: 0; padding: 7px 9px;
  border: 1px solid var(--border-default); border-radius: var(--radius-sm, 6px);
  background: var(--bg-panel); cursor: pointer; font-size: 13px;
}
.supp-opt:hover { background: var(--bg-hover, var(--bg-subtle)); }
.supp-opt:has(input:checked) { border-color: var(--border-focus, var(--accent-600)); background: var(--accent-50); }
.supp-opt:has(input:disabled) { cursor: default; }
.supp-opt input { margin: 2px 0 0; flex: none; accent-color: var(--accent-600); }
.supp-opt-body { display: grid; gap: 1px; min-width: 0; flex: 1; overflow-wrap: anywhere; }
.supp-opt-name { font-weight: 600; color: var(--text-primary); }
.supp-score { flex: none; padding: 1px 6px; border-radius: 5px; background: var(--bg-subtle); color: var(--text-secondary); font-size: 12px; }
.supp-opt-meta { color: var(--text-secondary); font-size: 12px; line-height: 1.35; }
.supp-alternatives { padding: 10px; border-radius: var(--radius-sm, 6px); background: var(--bg-subtle); }
.supp-add { display: grid; gap: 10px; }
.supp-add-list { max-height: min(360px, 50vh); }
.supp-search { display: grid; gap: 6px; }
.supp-search-row { flex-wrap: nowrap; }
.supp-search-row button { flex: none; }
.supp-search-input {
  flex: 1; min-width: 0; min-height: 34px; padding: 6px 9px; font: inherit; font-size: 13px;
  border: 1px solid var(--border-default); border-radius: 8px;
  background: var(--bg-panel); color: var(--text-primary);
}
.supp-search-input::placeholder { color: var(--text-tertiary); }
.supp-page:focus-visible, .supp-search-input:focus-visible { outline: 2px solid var(--border-focus, var(--accent-600)); outline-offset: 2px; }
@container (max-width: 660px) {
  .supp-card { grid-template-columns: minmax(0, 1fr); }
  .supp-other-options { grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr)); }
}
</style>
