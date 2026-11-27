<script setup>
import { computed, ref } from 'vue';
import { EMBEDDING_MODELS } from './chunker';

const props = defineProps({
  kbs: { type: Array, required: true },
  activeId: { type: String, default: '' },
});
const emit = defineEmits(['select', 'create', 'import', 'delete-doc', 'retry-doc', 'view-doc']);

const kb = computed(() => props.kbs.find(k => k.id === props.activeId) || props.kbs[0]);
const keyword = ref('');
const statusFilter = ref('all');

const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'ready', label: '已就绪' },
  { key: 'processing', label: '处理中' },
  { key: 'failed', label: '失败' },
];

const docs = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return (kb.value?.docs || []).filter(d =>
    (statusFilter.value === 'all' || d.status === statusFilter.value)
    && (!kw || d.name.toLowerCase().includes(kw)));
});

const stats = computed(() => {
  const list = kb.value?.docs || [];
  return {
    docs: list.length,
    chunks: list.reduce((n, d) => n + (d.chunks || 0), 0),
    chars: list.reduce((n, d) => n + (d.chars || 0), 0),
    processing: list.filter(d => d.status === 'processing').length,
    failed: list.filter(d => d.status === 'failed').length,
  };
});

function countOf(key) {
  const list = kb.value?.docs || [];
  return key === 'all' ? list.length : list.filter(d => d.status === key).length;
}

const modelLabel = computed(() => EMBEDDING_MODELS.find(m => m.value === kb.value?.embeddingModel)?.label || kb.value?.embeddingModel);

function fmtSize(n) {
  if (!n) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}
function fmtNum(n) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万`;
  return n.toLocaleString();
}
function timeAgo(ts) {
  const diff = Date.now() - Number(ts || 0);
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}
</script>

<template>
  <section class="home fade-in">
    <aside class="kb-side">
      <div class="side-head">
        <span class="panel-overline">KNOWLEDGE BASES</span>
        <button class="btn btn-secondary btn-sm" type="button" @click="emit('create')">＋ 新建</button>
      </div>
      <ul class="kb-list">
        <li v-for="k in props.kbs" :key="k.id">
          <button type="button" class="kb-item" :class="{ active: k.id === kb?.id }" @click="emit('select', k.id)">
            <span class="kb-name">{{ k.name }}</span>
            <span class="kb-meta">{{ k.docs.length }} 个文档
              <template v-if="k.docs.some(d => d.status === 'processing')"> · <i class="dot-busy"></i>处理中</template>
            </span>
          </button>
        </li>
      </ul>
    </aside>

    <div class="kb-main panel">
      <div class="main-head">
        <div class="main-title">
          <span class="panel-overline">DATA HUB / 知识库</span>
          <h1 class="panel-title">{{ kb?.name }}</h1>
          <p class="panel-lead">{{ kb?.desc || '暂无描述' }} · 向量模型 {{ modelLabel }}</p>
        </div>
        <button class="btn btn-primary" type="button" @click="emit('import')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          导入数据
        </button>
      </div>

      <div class="stat-row">
        <div class="stat"><span>文档</span><strong>{{ stats.docs }}</strong></div>
        <div class="stat"><span>分块</span><strong>{{ fmtNum(stats.chunks) }}</strong></div>
        <div class="stat"><span>字符</span><strong>{{ fmtNum(stats.chars) }}</strong></div>
        <div class="stat"><span>处理中 / 失败</span><strong>{{ stats.processing }} <em>/</em> {{ stats.failed }}</strong></div>
      </div>

      <div class="toolbar">
        <div class="seg" role="tablist" aria-label="按状态筛选">
          <button v-for="t in STATUS_TABS" :key="t.key" type="button" role="tab"
                  :aria-selected="statusFilter === t.key" :class="{ active: statusFilter === t.key }"
                  @click="statusFilter = t.key">{{ t.label }} <small>{{ countOf(t.key) }}</small></button>
        </div>
        <input v-model="keyword" class="input search" type="search" placeholder="搜索文档名称">
      </div>

      <div v-if="docs.length" class="doc-table" role="table">
        <div class="doc-row head" role="row">
          <span role="columnheader">文档</span>
          <span role="columnheader">处理方式</span>
          <span role="columnheader" class="num">分块</span>
          <span role="columnheader" class="num">字符</span>
          <span role="columnheader">状态</span>
          <span role="columnheader">更新</span>
          <span role="columnheader"></span>
        </div>
        <div v-for="d in docs" :key="d.id" class="doc-row" role="row">
          <span class="doc-name" role="cell">
            <i class="ext-badge" :data-ext="d.ext">{{ d.ext === 'text' ? 'TXT' : d.ext }}</i>
            <span>
              <button v-if="d.status === 'ready'" class="name-link" type="button" :title="`查看「${d.name}」的分块`"
                      @click="emit('view-doc', d)">{{ d.name }}</button>
              <strong v-else :title="d.name">{{ d.name }}</strong>
              <small>{{ d.ext === 'text' ? '自定义文本' : fmtSize(d.size) }}</small>
            </span>
          </span>
          <span role="cell" class="muted">{{ d.storeMode }}</span>
          <span role="cell" class="num">{{ d.status === 'ready' ? d.chunks : '-' }}</span>
          <span role="cell" class="num">{{ d.status === 'ready' ? d.chars.toLocaleString() : '-' }}</span>
          <span role="cell">
            <span v-if="d.status === 'ready'" class="state ok">✓ 已就绪</span>
            <span v-else-if="d.status === 'processing'" class="state busy">
              <i class="spinner" aria-hidden="true"></i>处理中 {{ d.progress || 0 }}%
              <i class="bar"><b :style="{ width: `${d.progress || 0}%` }"></b></i>
            </span>
            <span v-else class="state fail" :title="d.error">
              ! 失败
              <button class="link" type="button" @click="emit('retry-doc', d)">重试</button>
            </span>
          </span>
          <span role="cell" class="muted">{{ timeAgo(d.updatedAt) }}</span>
          <span role="cell" class="ops">
            <button class="icon-btn view" type="button" title="查看分块" aria-label="查看分块"
                    :disabled="d.status !== 'ready'" @click="emit('view-doc', d)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                   stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
            <button class="icon-btn" type="button" title="删除" aria-label="删除文档"
                    :disabled="d.status === 'processing'" @click="emit('delete-doc', d)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                   stroke-linejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </button>
          </span>
        </div>
      </div>
      <div v-else class="empty">
        <p>{{ (kb?.docs || []).length ? '没有符合条件的文档' : '知识库还是空的' }}</p>
        <button v-if="!(kb?.docs || []).length" class="btn btn-secondary" type="button" @click="emit('import')">导入第一份数据</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: var(--space-5); align-items: start; }
.kb-side {
  position: sticky; top: 88px;
  padding: var(--space-4); border: 1px solid var(--border-default); border-radius: var(--radius-lg);
  background: var(--bg-panel); box-shadow: var(--shadow-sm);
}
.side-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); }
.side-head .panel-overline { margin: 0; }
.kb-list { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
.kb-item {
  display: block; width: 100%; padding: 10px 12px; border: 1px solid transparent; border-radius: var(--radius-md);
  background: transparent; color: inherit; text-align: left; cursor: pointer; transition: all var(--duration-fast);
}
.kb-item:hover { background: var(--bg-hover); }
.kb-item.active { border-color: var(--border-focus); background: var(--accent-50); }
.kb-name { display: block; font-size: 14px; font-weight: 600; }
.kb-item.active .kb-name { color: var(--accent-600); }
.kb-meta { display: flex; align-items: center; gap: 4px; margin-top: 2px; font-size: 12px; color: var(--text-secondary); }
.dot-busy { width: 6px; height: 6px; border-radius: 50%; background: var(--info-600); }

.kb-main { padding: var(--space-6) var(--space-8); }
.main-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); }
.main-title { min-width: 0; }

.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); margin: var(--space-5) 0; }
.stat { padding: var(--space-3) var(--space-4); border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--bg-subtle); }
.stat span { display: block; font-size: 12px; color: var(--text-secondary); }
.stat strong { display: block; margin-top: 2px; font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
.stat em { font-style: normal; color: var(--text-tertiary); font-weight: 400; }

.toolbar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-3); }
.seg { display: inline-flex; padding: 3px; border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--bg-subtle); }
.seg button {
  padding: 5px 12px; border: 0; border-radius: var(--radius-sm); background: transparent;
  color: var(--text-secondary); font: inherit; font-size: 13px; cursor: pointer;
}
.seg button small { margin-left: 2px; color: var(--text-tertiary); }
.seg button.active { background: var(--bg-panel); color: var(--text-primary); font-weight: 600; box-shadow: var(--shadow-sm); }
.search { max-width: 260px; height: 36px; }

.doc-table { border: 1px solid var(--border-default); border-radius: var(--radius-md); overflow: hidden; }
.doc-row {
  display: grid; grid-template-columns: minmax(220px, 2.4fr) 1fr 70px 90px 1.4fr 90px 72px;
  align-items: center; gap: var(--space-3); padding: 10px var(--space-4);
  border-top: 1px solid var(--divider); font-size: 13px;
}
.doc-row:first-child { border-top: 0; }
.doc-row.head { background: var(--bg-subtle); color: var(--text-secondary); font-size: 12px; font-weight: 600; }
.doc-row:not(.head):hover { background: var(--bg-hover); }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.muted { color: var(--text-secondary); }
.doc-name { display: flex; align-items: center; gap: 10px; min-width: 0; }
.doc-name .ext-badge { width: 34px; height: 38px; font-size: 9px; font-style: normal; }
.doc-name > span { min-width: 0; }
.doc-name strong, .name-link { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.name-link {
  padding: 0; border: 0; background: none; color: inherit; font: inherit; font-weight: 600; text-align: left; cursor: pointer;
}
.name-link:hover { color: var(--accent-600); text-decoration: underline; text-underline-offset: 3px; }
.doc-name small { color: var(--text-tertiary); font-size: 12px; }

.state { display: inline-flex; align-items: center; gap: 6px; font-weight: 500; white-space: nowrap; }
.state.ok { color: var(--success-600); }
.state.busy { color: var(--info-600); }
.state.fail { color: var(--danger-600); }
.spinner {
  width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--info-600) 25%, transparent); border-top-color: var(--info-600);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.bar { display: inline-block; width: 56px; height: 4px; border-radius: 2px; background: var(--bg-subtle); overflow: hidden; }
.bar b { display: block; height: 100%; background: var(--info-600); transition: width 150ms linear; }
.link { padding: 0; border: 0; background: none; color: var(--accent-600); font: inherit; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
.ops { display: flex; justify-content: flex-end; gap: 2px; }
.icon-btn.view:hover:not(:disabled) { color: var(--accent-600); background: var(--accent-50); }
.icon-btn {
  display: grid; place-items: center; width: 28px; height: 28px; padding: 0;
  border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--text-tertiary); cursor: pointer;
}
.icon-btn svg { width: 15px; height: 15px; }
.icon-btn:hover:not(:disabled) { color: var(--danger-600); background: var(--danger-50); }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.empty { padding: var(--space-10) 0; text-align: center; color: var(--text-secondary); }
.empty p { margin: 0 0 var(--space-3); }

@media (max-width: 960px) {
  .home { grid-template-columns: 1fr; }
  .kb-side { position: static; }
  .stat-row { grid-template-columns: repeat(2, 1fr); }
  .doc-table { overflow-x: auto; }
  .doc-row { min-width: 760px; }
}
</style>
