<template>
  <!-- 补充说明任务（task_type=supplement）专属：目标产品行绑定面板。
       每个识别产品一张绑定卡：知识库候选行单选（按型号/名称匹配打分）+
       新建产品行 / 跳过；候选不对可手输搜索。保存后发布完成即可回写知识库。
       数据与 API 都在父组件（index.vue），本组件只管选择状态与展示。 -->
  <section class="supp-bind">
    <header class="supp-bind-head">
      <h3 class="supp-bind-title">目标产品行绑定</h3>
      <span v-if="saved" class="supp-saved" title="绑定已写入任务，继续审核并发布后，结果页会出现「回写知识库」按钮">
        ✓ 绑定已保存 · 继续审核，发布后在结果页回写
      </span>
      <span class="supp-bind-meta">{{ hint }}</span>
      <span class="supp-bind-actions">
        <button class="btn btn-ghost" type="button" :disabled="loading" @click="emit('refresh')">刷新匹配</button>
        <button class="btn btn-primary" type="button" :disabled="loading || !products.length" @click="save">
          {{ saved ? '更新绑定' : '保存绑定' }}
        </button>
      </span>
    </header>
    <p class="supp-bind-tip">
      为每个识别出的产品选择知识库中已有产品行（自动按型号/名称匹配）；绑定后发布，
      发布完成即可把补充内容（安装说明 / 新参数 / 裁剪图）合并回写覆盖该行。
    </p>

    <div v-if="loading" class="supp-bind-empty">正在匹配知识库产品行…</div>
    <div v-else-if="!products.length" class="supp-bind-empty">
      暂无识别产品（识别完成后自动出现绑定卡片）
    </div>

    <div v-for="p in products" :key="p.product_candidate_id" class="supp-card">
      <div class="supp-card-title">
        {{ productName(p) }}
      </div>
      <label v-for="c in candidatesOf(p)" :key="c.official_product_id" class="supp-opt">
        <input type="radio" :name="bindName(p)"
               :checked="isSelected(p, 'existing', c.official_product_id)"
               @change="pick(p, 'existing', c.official_product_id, c.source_record_id)">
        <span class="supp-opt-body">
          <span class="supp-opt-name">{{ optName(c) }}</span>
          <span class="supp-badge">{{ scoreText(c) }}</span>
          <span class="supp-opt-meta">{{ optMeta(c) }}</span>
          <span class="supp-opt-ev">{{ optEvidence(c) }}</span>
        </span>
      </label>
      <label class="supp-opt">
        <input type="radio" :name="`bind_${p.product_candidate_id}`"
               :checked="isSelected(p, 'new_row')"
               @change="pick(p, 'new_row', '', '')">
        <span class="supp-opt-body"><span class="supp-opt-name">➕ 新建产品行</span>
          <span class="supp-opt-meta">不覆盖已有行，作为新纪录写入</span></span>
      </label>
      <label class="supp-opt">
        <input type="radio" :name="`bind_${p.product_candidate_id}`"
               :checked="isSelected(p, 'skip')"
               @change="pick(p, 'skip', '', '')">
        <span class="supp-opt-body"><span class="supp-opt-name">⏭ 跳过该产品</span>
          <span class="supp-opt-meta">本次不回写此产品</span></span>
      </label>
      <div class="supp-search">
        <input v-model="queryBy[p.product_candidate_id]" class="supp-search-input" type="text"
               placeholder="候选不对？输入型号或产品名重新搜索" @keydown.enter="search(p)">
        <button class="btn btn-secondary" type="button" @click="search(p)">搜索</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';

const props = defineProps({
  // 审核快照产品（product_candidate_id / product_name）
  products: { type: Array as () => Array<{ product_candidate_id: string; product_name: string }>, default: () => [] },
  // GET supplement/matches 的 matches 数组（含任务级 product_candidate_id='' 的兜底候选）
  matches: { type: Array as () => any[], default: () => [] },
  loading: { type: Boolean, default: false },
  hint: { type: String, default: '' },
  // 绑定已保存（持久徽标 + 按钮转「更新绑定」）；改绑后再次保存仍为 true
  saved: { type: Boolean, default: false },
});

const emit = defineEmits(['refresh', 'search', 'save']);

// 选择状态：product_candidate_id → {binding_type, official_product_id, source_record_id}
// 初始值 = 首个候选（无候选则 new_row）；matches 变化不重置已选项
const selections = reactive<Record<string, any>>({});
const queryBy = reactive<Record<string, string>>({});

function candidatesOf(p: any) {
  const own = props.matches.find((m: any) => m.product_candidate_id === p.product_candidate_id);
  if (own && Array.isArray(own.candidates) && own.candidates.length) return own.candidates;
  const jobLevel: any = props.matches.find((m: any) => !m.product_candidate_id);
  return (jobLevel && jobLevel.candidates) || [];
}

// ── 展示辅助：模板表达式里不放中文字符串字面量（Vite 模板表达式解析器
//    对全角字符 + 引号的组合会误判"字符串未闭合"，统一收敛到 script）──
function bindName(p: any) { return 'bind_' + p.product_candidate_id; }
function productName(p: any) { return p.product_name || '（未命名产品）'; }
function optName(c: any) { return c?.summary?.product_name || '（未命名）'; }
function scoreText(c: any) {
  const s = Number(c?.score ?? 0);
  return Number.isFinite(s) ? s.toFixed(2) : String(c?.score ?? '');
}
function optMeta(c: any) {
  const s = c?.summary || {};
  const head = [s.brand, s.series, s.primary_model].filter(Boolean).join(' / ') || '—';
  return `${head} · 型号 ${s.model_count ?? 0} 个 · 图片 ${s.image_count ?? 0} 张`
       + ` · 安装说明 ${s.installation_chars ?? 0} 字`;
}
function optEvidence(c: any) {
  return '依据：' + ((c?.evidence || []).join('；') || '—');
}

function isSelected(p: any, type: string, pid = '') {
  const cur = selections[p.product_candidate_id];
  if (!cur) return false;
  return cur.binding_type === type && (type !== 'existing' || cur.official_product_id === pid);
}

function pick(p: any, type: string, pid: string, srid: string) {
  selections[p.product_candidate_id] = { binding_type: type, official_product_id: pid, source_record_id: srid };
}

function search(p: any) {
  const q = (queryBy[p.product_candidate_id] || '').trim();
  if (q) emit('search', q);
}

function save() {
  const bindings = props.products.map((p: any) => ({
    product_candidate_id: p.product_candidate_id,
    ...(selections[p.product_candidate_id] || { binding_type: 'new_row', official_product_id: '', source_record_id: '' }),
  }));
  emit('save', bindings);
}

// 产品/候选就绪后补默认选择（不动用户已选的）
watch(() => [props.products, props.matches], () => {
  for (const p of props.products) {
    if (selections[p.product_candidate_id]) continue;
    const cands = candidatesOf(p);
    selections[p.product_candidate_id] = cands.length
      ? { binding_type: 'existing', official_product_id: cands[0].official_product_id, source_record_id: cands[0].source_record_id }
      : { binding_type: 'new_row', official_product_id: '', source_record_id: '' };
  }
}, { immediate: true, deep: true });
</script>

<style scoped>
/* 主题适配：全部引用 .pdf-workbench 桥接的设计令牌（index.vue 定义，
   浅色/深色随 html.dark 自动翻转），不自造变量、不硬编码颜色 */
.supp-bind {
  border: 1px solid var(--border-default);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 16px;
  background: var(--bg-subtle);
}
.supp-bind-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.supp-bind-title { font-size: 14px; font-weight: 600; margin: 0; color: var(--text-primary); }
.supp-saved {
  padding: 2px 10px; border-radius: 10px; font-size: 12px;
  color: var(--success-600); background: var(--success-50);
}
.supp-bind-meta { flex: 1; min-width: 120px; font-size: 12px; color: var(--text-secondary); }
.supp-bind-actions { display: flex; gap: 8px; }
.supp-bind-tip { margin: 6px 0 10px; font-size: 12px; color: var(--text-secondary); }
.supp-bind-empty { font-size: 13px; color: var(--text-secondary); padding: 8px 0; }
.supp-card {
  border-top: 1px dashed var(--divider);
  padding: 10px 0;
}
.supp-card-title { font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); }
.supp-opt { display: flex; gap: 8px; align-items: flex-start; padding: 4px 0; cursor: pointer; font-size: 12px; }
.supp-opt input { margin-top: 3px; flex: none; accent-color: var(--accent-600); }
.supp-opt-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.supp-opt-name { font-weight: 600; color: var(--text-primary); }
.supp-badge {
  display: inline-block; align-self: flex-start; padding: 0 8px; border-radius: 10px;
  font-size: 11px; background: var(--accent-50); color: var(--accent-600);
}
.supp-opt-meta { color: var(--text-secondary); }
.supp-opt-ev { color: var(--text-tertiary); font-size: 11px; }
.supp-search { display: flex; gap: 8px; margin-top: 6px; }
/* .input 是 UploadView 的 scoped 类，此处拿不到——自带一份令牌化样式 */
.supp-search-input {
  flex: 1; min-width: 0; padding: 6px 10px; font-size: 12px;
  border: 1px solid var(--border-default); border-radius: 8px;
  background: var(--bg-panel); color: var(--text-primary);
}
.supp-search-input::placeholder { color: var(--text-tertiary); }
.supp-search-input:focus { outline: none; border-color: var(--accent-600); }
</style>
