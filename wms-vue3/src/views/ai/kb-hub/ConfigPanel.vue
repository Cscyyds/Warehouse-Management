<script setup>
/**
 * 处理参数面板：直接改父组件传入的 reactive 配置对象，右侧预览实时重算。
 * 切片精度是三个尺寸参数的预设；手动改任一尺寸即转为「自定义」。
 */
import { computed, ref } from 'vue';
import {
  defaultConfig, EMBEDDING_MODELS, parseSeparatorCode, PRECISION_PRESETS, SEPARATOR_PRESETS, separatorCode,
} from './chunker';

const props = defineProps({
  config: { type: Object, required: true },
  modelLabel: { type: String, default: '' },
  kbName: { type: String, default: '' },
});
const cfg = props.config;

const STORE_MODES = [
  { key: 'chunk', label: '分块存储', hint: '按规则切成多个片段，适合长文档检索' },
  { key: 'whole', label: '整篇存储', hint: '全文作为一个片段，适合短文本、公告' },
  { key: 'qa', label: '问答对拆分', hint: '按标题生成问答对，适合 FAQ' },
];
const SPLIT_BY = [
  { key: 'paragraph', label: '按段落' },
  { key: 'length', label: '按长度' },
  { key: 'separator', label: '按分隔符' },
];
const SPLIT_HINT = {
  paragraph: '以原文段落为最小单位，相邻段落合并到不超过最大分块大小；超长段落在句末处断开。',
  length: '按固定字数滑动切分，不考虑句子边界，结果最均匀。',
  separator: '按下方分隔符依次切分（排在前面的优先），切完仍超长的片段用下一个分隔符继续切。',
};
const PRECISIONS = [
  ...Object.entries(PRECISION_PRESETS).map(([key, p]) => ({ key, label: p.label, hint: p.hint })),
  { key: 'custom', label: '自定义', hint: '手动设置下方参数' },
];

const isChunk = computed(() => cfg.storeMode === 'chunk');
const isWhole = computed(() => cfg.storeMode === 'whole');
const model = computed(() => EMBEDDING_MODELS.find(m => m.value === cfg.embeddingModel));

function setPrecision(key) {
  cfg.precision = key;
  const p = PRECISION_PRESETS[key];
  if (p) Object.assign(cfg, { maxChunkSize: p.maxChunkSize, overlap: p.overlap, minChunkSize: p.minChunkSize });
}
function onSizeChange() {
  const hit = Object.entries(PRECISION_PRESETS).find(([, p]) =>
    p.maxChunkSize === cfg.maxChunkSize && p.overlap === cfg.overlap && p.minChunkSize === cfg.minChunkSize);
  cfg.precision = hit ? hit[0] : 'custom';
}

// ── 分隔符 ──
const customSep = ref('');
function hasSep(v) { return cfg.separators.includes(v); }
function toggleSep(v) {
  cfg.separators = hasSep(v) ? cfg.separators.filter(s => s !== v) : [...cfg.separators, v];
}
function addCustomSep() {
  const v = parseSeparatorCode(customSep.value);
  if (v && !hasSep(v)) cfg.separators = [...cfg.separators, v];
  customSep.value = '';
}
function moveSep(i, d) {
  const list = [...cfg.separators];
  const j = i + d;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  cfg.separators = list;
}
function sepLabel(v) {
  return SEPARATOR_PRESETS.find(p => p.value === v)?.label || '自定义';
}

function reset() {
  Object.assign(cfg, defaultConfig(), { embeddingModel: cfg.embeddingModel });
}
</script>

<template>
  <aside class="cfg panel">
    <div class="cfg-head">
      <div>
        <span class="panel-overline">DATA HUB / 02</span>
        <h1 class="cfg-title">处理设置</h1>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" title="恢复默认参数" @click="reset">恢复默认</button>
    </div>

    <section class="grp">
      <h2>处理方式</h2>
      <div class="cards">
        <button v-for="m in STORE_MODES" :key="m.key" type="button" class="card"
                :class="{ active: cfg.storeMode === m.key }" :aria-pressed="cfg.storeMode === m.key"
                @click="cfg.storeMode = m.key">
          <strong>{{ m.label }}</strong><span>{{ m.hint }}</span>
        </button>
      </div>
    </section>

    <section v-if="!isWhole" class="grp">
      <h2>分块条件</h2>
      <label class="radio-line">
        <input v-model="cfg.trigger" type="radio" value="force"> 强制分块
        <small>无论原文多长都执行分块</small>
      </label>
      <label class="radio-line">
        <input v-model="cfg.trigger" type="radio" value="length"> 原文长度大于
        <el-input-number v-model="cfg.triggerLength" size="small" :min="100" :max="100000" :step="100"
                         :disabled="cfg.trigger !== 'length'" controls-position="right" class="num-sm" />
        字时分块
      </label>
      <p class="hint">未达到长度的文档按整篇存储。</p>
    </section>

    <section v-if="isChunk" class="grp">
      <h2>分块方式</h2>
      <div class="seg">
        <button v-for="s in SPLIT_BY" :key="s.key" type="button" :class="{ active: cfg.splitBy === s.key }"
                :aria-pressed="cfg.splitBy === s.key" @click="cfg.splitBy = s.key">{{ s.label }}</button>
      </div>
      <p class="hint">{{ SPLIT_HINT[cfg.splitBy] }}</p>

      <div v-if="cfg.splitBy === 'separator'" class="sep-box">
        <ol v-if="cfg.separators.length" class="sep-list">
          <li v-for="(s, i) in cfg.separators" :key="s">
            <span class="sep-rank">{{ i + 1 }}</span>
            <code>{{ separatorCode(s) }}</code>
            <span class="sep-name">{{ sepLabel(s) }}</span>
            <button type="button" :disabled="i === 0" aria-label="上移" @click="moveSep(i, -1)">↑</button>
            <button type="button" :disabled="i === cfg.separators.length - 1" aria-label="下移" @click="moveSep(i, 1)">↓</button>
            <button type="button" aria-label="删除" @click="toggleSep(s)">×</button>
          </li>
        </ol>
        <p v-else class="hint warn">至少添加一个分隔符，否则按最大分块大小硬切。</p>
        <div class="sep-presets">
          <button v-for="p in SEPARATOR_PRESETS" :key="p.code" type="button" class="chip"
                  :class="{ active: hasSep(p.value) }" @click="toggleSep(p.value)">{{ p.label }} <code>{{ p.code }}</code></button>
        </div>
        <div class="sep-custom">
          <input v-model="customSep" class="input" type="text" maxlength="10" placeholder="自定义分隔符，如 ### 或 \n---"
                 @keydown.enter.prevent="addCustomSep">
          <button class="btn btn-secondary btn-sm" type="button" :disabled="!customSep" @click="addCustomSep">添加</button>
        </div>
        <label class="check"><input v-model="cfg.keepSeparator" type="checkbox"> 分块中保留分隔符</label>
      </div>
    </section>

    <section v-if="!isWhole" class="grp">
      <h2>切片精度</h2>
      <div class="seg four">
        <button v-for="p in PRECISIONS" :key="p.key" type="button" :class="{ active: cfg.precision === p.key }"
                :title="p.hint" :aria-pressed="cfg.precision === p.key"
                @click="p.key !== 'custom' ? setPrecision(p.key) : (cfg.precision = 'custom')">{{ p.label }}</button>
      </div>
      <div class="field">
        <div class="field-head"><span>最大分块大小</span><em>字</em></div>
        <div class="slider-row">
          <el-slider v-model="cfg.maxChunkSize" :min="100" :max="2000" :step="50" @change="onSizeChange" />
          <el-input-number v-model="cfg.maxChunkSize" size="small" :min="100" :max="2000" :step="50"
                           controls-position="right" class="num-sm" @change="onSizeChange" />
        </div>
      </div>
      <template v-if="isChunk">
        <div class="field">
          <div class="field-head"><span>分块重叠</span><em>字，相邻块共享的上下文</em></div>
          <div class="slider-row">
            <el-slider v-model="cfg.overlap" :min="0" :max="Math.floor(cfg.maxChunkSize / 2)" :step="10" @change="onSizeChange" />
            <el-input-number v-model="cfg.overlap" size="small" :min="0" :max="Math.floor(cfg.maxChunkSize / 2)" :step="10"
                             controls-position="right" class="num-sm" @change="onSizeChange" />
          </div>
        </div>
        <div v-if="cfg.splitBy !== 'length'" class="field">
          <div class="field-head"><span>最小分块大小</span><em>字，过短的块并入前一块</em></div>
          <div class="slider-row">
            <el-slider v-model="cfg.minChunkSize" :min="0" :max="500" :step="10" @change="onSizeChange" />
            <el-input-number v-model="cfg.minChunkSize" size="small" :min="0" :max="500" :step="10"
                             controls-position="right" class="num-sm" @change="onSizeChange" />
          </div>
        </div>
      </template>
      <div class="field">
        <div class="field-head"><span>最大段落深度</span><em>按 1～N 级标题切分章节</em></div>
        <div class="slider-row">
          <el-slider v-model="cfg.maxDepth" :min="isChunk ? 0 : 1" :max="6" :step="1" show-stops />
          <el-input-number v-model="cfg.maxDepth" size="small" :min="isChunk ? 0 : 1" :max="6"
                           controls-position="right" class="num-sm" />
        </div>
        <p class="hint">{{ cfg.maxDepth === 0 ? '0 = 忽略标题，全文连续切分。' : `${cfg.maxDepth} 级以内的标题开启新章节，分块不跨章节；更深的标题当作正文。` }}</p>
      </div>
    </section>

    <section class="grp">
      <h2>索引增强</h2>
      <div class="switch-line">
        <span><strong>标题加入索引</strong><small>把分块所属的标题路径写进索引，提升按章节检索的命中率</small></span>
        <el-switch v-model="cfg.titleToIndex" />
      </div>
      <div class="switch-line">
        <span><strong>自动生成索引</strong><small>为每个分块提取关键词和摘要，一并写入索引</small></span>
        <el-switch v-model="cfg.autoIndex" />
      </div>
      <div class="field">
        <div class="field-head"><span>索引大小</span><em>字，超出部分截断</em></div>
        <div class="slider-row">
          <el-slider v-model="cfg.indexSize" :min="100" :max="2000" :step="50" />
          <el-input-number v-model="cfg.indexSize" size="small" :min="100" :max="2000" :step="50"
                           controls-position="right" class="num-sm" />
        </div>
      </div>
    </section>

    <section class="grp">
      <h2>数据清洗</h2>
      <label class="check"><input v-model="cfg.cleanWhitespace" type="checkbox"> 合并连续空格、多余空行</label>
      <label class="check"><input v-model="cfg.removeUrls" type="checkbox"> 删除网址链接</label>
      <label class="check"><input v-model="cfg.dedupe" type="checkbox"> 删除重复段落</label>
    </section>

    <section class="grp">
      <h2>向量化</h2>
      <el-select v-model="cfg.embeddingModel" class="model-select">
        <el-option v-for="m in EMBEDDING_MODELS" :key="m.value" :label="m.label" :value="m.value">
          <span>{{ m.label }}</span><span class="opt-dims">{{ m.dims }} 维</span>
        </el-option>
      </el-select>
      <p class="hint">「{{ props.kbName }}」默认使用该模型；同一知识库内的模型须一致，否则向量不可比。当前 {{ model?.dims }} 维。</p>
    </section>
  </aside>
</template>

<style scoped>
.cfg {
  position: sticky; top: 80px;
  max-height: calc(100vh - 176px); overflow-y: auto; overscroll-behavior: contain;
  padding: var(--space-5) var(--space-5) var(--space-6);
  scrollbar-width: thin;
}
.cfg-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-2); }
.cfg-title { margin: 0; font-size: 20px; font-weight: 700; }

.grp { padding: var(--space-4) 0; border-top: 1px dashed var(--divider); }
.grp:first-of-type { border-top: 0; }
.grp h2 { margin: 0 0 var(--space-3); font-size: 13px; font-weight: 600; }
.hint { margin: var(--space-2) 0 0; color: var(--text-secondary); font-size: 12px; line-height: 1.55; }
.hint.warn { color: var(--warn-600); }

.cards { display: grid; gap: 8px; }
.card {
  display: flex; flex-direction: column; gap: 2px; padding: 10px 12px;
  border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--bg-panel);
  color: inherit; font: inherit; text-align: left; cursor: pointer; transition: all var(--duration-fast);
}
.card strong { font-size: 14px; }
.card span { color: var(--text-secondary); font-size: 12px; }
.card:hover { border-color: var(--border-focus); }
.card.active { border-color: var(--accent-600); background: var(--accent-50); box-shadow: inset 3px 0 0 var(--accent-600); }
.card.active strong { color: var(--accent-600); }

.seg { display: grid; grid-template-columns: repeat(3, 1fr); padding: 3px; border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--bg-subtle); }
.seg.four { grid-template-columns: repeat(4, 1fr); }
.seg button {
  padding: 6px 4px; border: 0; border-radius: var(--radius-sm); background: transparent;
  color: var(--text-secondary); font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap;
}
.seg button.active { background: var(--bg-panel); color: var(--accent-600); font-weight: 600; box-shadow: var(--shadow-sm); }

.radio-line { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; font-size: 13px; cursor: pointer; }
.radio-line small { color: var(--text-secondary); font-size: 12px; }
.radio-line input, .check input { margin: 0; accent-color: var(--accent-600); }
.check { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 13px; cursor: pointer; }
.num-sm { width: 104px; }

.field { margin-top: var(--space-3); }
.field-head { display: flex; align-items: baseline; gap: 6px; font-size: 13px; }
.field-head em { color: var(--text-secondary); font-size: 12px; font-style: normal; }
.slider-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 14px; padding-left: 6px; }

.sep-box { margin-top: var(--space-3); padding: var(--space-3); border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--bg-subtle); }
.sep-list { display: grid; gap: 4px; margin: 0 0 var(--space-3); padding: 0; list-style: none; }
.sep-list li { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: var(--radius-sm); background: var(--bg-panel); font-size: 12px; }
.sep-rank { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--accent-50); color: var(--accent-600); font-size: 11px; font-weight: 700; }
.sep-list code, .chip code { font-family: var(--font-mono); font-size: 12px; }
.sep-name { flex: 1; color: var(--text-secondary); }
.sep-list button {
  width: 22px; height: 22px; padding: 0; border: 0; border-radius: 4px; background: none;
  color: var(--text-secondary); cursor: pointer;
}
.sep-list button:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }
.sep-list button:disabled { opacity: 0.3; cursor: default; }
.sep-presets { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  padding: 3px 10px; border: 1px solid var(--border-default); border-radius: 999px; background: var(--bg-panel);
  color: var(--text-secondary); font: inherit; font-size: 12px; cursor: pointer;
}
.chip.active { border-color: var(--accent-600); color: var(--accent-600); background: var(--accent-50); }
.sep-custom { display: flex; gap: 8px; margin-top: var(--space-3); }
.sep-custom .input { height: 32px; font-family: var(--font-mono); font-size: 13px; }

.switch-line { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }
.switch-line strong { display: block; font-size: 13px; font-weight: 500; }
.switch-line small { display: block; color: var(--text-secondary); font-size: 12px; line-height: 1.5; }

.model-select { width: 100%; }
.opt-dims { float: right; margin-left: 16px; color: var(--el-text-color-secondary); font-size: 12px; }

@media (max-width: 1080px) {
  .cfg { position: static; max-height: none; }
}
</style>
