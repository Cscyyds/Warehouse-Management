<script setup>
import { computed, ref } from 'vue';
import { docChars } from './chunker';
import { ACCEPT_ATTR, MAX_FILE_MB } from './parsers';
import { SAMPLE_CUSTOM_TEXT } from './samples';

const props = defineProps({
  kbName: { type: String, default: '' },
  docs: { type: Array, default: () => [] },
  parsing: { type: Array, default: () => [] },
});
const emit = defineEmits(['add-files', 'add-text', 'remove', 'back', 'next']);

const tab = ref('file');
const dragging = ref(false);
const fileInput = ref(null);

const textTitle = ref('');
const textBody = ref('');
const textChars = computed(() => textBody.value.trim().length);

function pick() { fileInput.value?.click(); }
function onFiles(list) {
  const files = Array.from(list || []);
  if (files.length) emit('add-files', files);
}
function onChange(e) {
  onFiles(e.target.files);
  e.target.value = '';
}
function onDrop(e) {
  dragging.value = false;
  onFiles(e.dataTransfer?.files);
}

function addText() {
  if (!textChars.value) return;
  emit('add-text', { title: textTitle.value || `自定义文本 ${props.docs.filter(d => d.source === 'text').length + 1}`, text: textBody.value });
  textTitle.value = '';
  textBody.value = '';
}
function fillSample() {
  textTitle.value = '退货处理常见问题';
  textBody.value = SAMPLE_CUSTOM_TEXT;
}

function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}
function headingCount(doc) {
  return doc.blocks.filter(b => b.kind === 'heading').length;
}
</script>

<template>
  <section class="panel source fade-in">
    <div class="panel-header">
      <span class="panel-overline">DATA HUB / 01</span>
      <h1 class="panel-title">选择要导入的数据</h1>
      <p class="panel-lead">数据将写入知识库「{{ props.kbName }}」。可混合添加多个文件和自定义文本，下一步统一设置处理参数并预览分块。</p>
    </div>

    <div class="tabs" role="tablist">
      <button type="button" role="tab" :aria-selected="tab === 'file'" :class="{ active: tab === 'file' }" @click="tab = 'file'">本地文件</button>
      <button type="button" role="tab" :aria-selected="tab === 'text'" :class="{ active: tab === 'text' }" @click="tab = 'text'">自定义文本</button>
    </div>

    <div v-if="tab === 'file'" class="dropzone" :class="{ drag: dragging }" role="button" tabindex="0"
         @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onDrop"
         @click="pick" @keydown.enter.prevent="pick" @keydown.space.prevent="pick">
      <div class="upload-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
      </div>
      <div class="dz-title">拖放文件到这里，或点击选择</div>
      <div class="dz-hint">支持 PDF、DOCX、TXT、Markdown、XLSX、CSV，单个文件不超过 {{ MAX_FILE_MB }} MB，可多选</div>
      <div class="dz-formats" aria-hidden="true">
        <i class="ext-badge" data-ext="pdf">PDF</i>
        <i class="ext-badge" data-ext="docx">DOCX</i>
        <i class="ext-badge" data-ext="txt">TXT</i>
        <i class="ext-badge" data-ext="md">MD</i>
        <i class="ext-badge" data-ext="xlsx">XLSX</i>
      </div>
      <input ref="fileInput" type="file" multiple :accept="ACCEPT_ATTR" hidden @change="onChange">
    </div>

    <div v-else class="text-form">
      <input v-model="textTitle" class="input" type="text" maxlength="60" placeholder="标题（可选，如：退货处理常见问题）">
      <textarea v-model="textBody" class="input" rows="10"
                placeholder="粘贴或输入文本。支持 Markdown 标题（# / ##）与「第一章」「一、」等章节编号，切片时会识别为标题层级。"></textarea>
      <div class="text-actions">
        <button class="btn btn-ghost btn-sm" type="button" @click="fillSample">填入示例</button>
        <span class="text-count">{{ textChars.toLocaleString() }} 字</span>
        <button class="btn btn-secondary" type="button" :disabled="!textChars" @click="addText">添加到列表</button>
      </div>
    </div>

    <div class="picked">
      <h2 class="picked-title">
        已选择 <span>{{ props.docs.length }}</span>
        <small v-if="props.parsing.length">· 正在读取 {{ props.parsing.length }} 个文件…</small>
      </h2>
      <ul v-if="props.docs.length || props.parsing.length" class="picked-list">
        <li v-for="d in props.docs" :key="d.id">
          <i class="ext-badge" :data-ext="d.ext">{{ d.ext === 'text' ? 'TXT' : d.ext }}</i>
          <div class="picked-info">
            <strong :title="d.name">{{ d.name }}</strong>
            <span>
              {{ d.source === 'text' ? '自定义文本' : fmtSize(d.size) }}
              · {{ docChars(d).toLocaleString() }} 字 · {{ d.blocks.length }} 个段落
              <template v-if="headingCount(d)"> · {{ headingCount(d) }} 个标题</template>
            </span>
            <em v-if="d.note" class="picked-note">{{ d.note }}</em>
          </div>
          <button class="remove" type="button" :aria-label="`移除 ${d.name}`" title="移除" @click="emit('remove', d.id)">×</button>
        </li>
        <li v-for="p in props.parsing" :key="p.key" class="is-parsing">
          <i class="spinner" aria-hidden="true"></i>
          <div class="picked-info"><strong>{{ p.name }}</strong><span>读取中…</span></div>
        </li>
      </ul>
      <p v-else class="picked-empty">还没有添加数据</p>
    </div>

    <div class="actions">
      <button class="btn btn-ghost" type="button" @click="emit('back')">返回知识库</button>
      <button class="btn btn-primary" type="button" :disabled="!props.docs.length || props.parsing.length > 0"
              @click="emit('next')">下一步：处理设置</button>
    </div>
  </section>
</template>

<style scoped>
.source { max-width: 860px; margin: 0 auto; }
.tabs { display: flex; gap: 4px; margin: var(--space-6) 0 var(--space-4); border-bottom: 1px solid var(--border-default); }
.tabs button {
  margin-bottom: -1px; padding: 8px 16px; border: 0; border-bottom: 2px solid transparent;
  background: none; color: var(--text-secondary); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer;
}
.tabs button.active { color: var(--accent-600); border-bottom-color: var(--accent-600); font-weight: 600; }

.dropzone {
  padding: 40px 24px; border: 2px dashed var(--border-strong); border-radius: var(--radius-md);
  background: var(--bg-subtle); text-align: center; cursor: pointer; transition: all var(--duration-normal) var(--ease-out);
}
.dropzone:hover, .dropzone:focus-visible { border-color: var(--accent-600); outline: none; }
.dropzone.drag { border-style: solid; border-color: var(--accent-600); background: var(--accent-50); transform: translateY(-2px); }
.upload-icon {
  display: grid; place-items: center; width: 52px; height: 52px; margin: 0 auto 14px;
  border-radius: var(--radius-md); background: var(--bg-panel); color: var(--text-secondary); box-shadow: var(--shadow-sm);
}
.dropzone.drag .upload-icon { background: var(--accent-600); color: #fff; }
.upload-icon svg { width: 22px; height: 22px; }
.dz-title { font-size: 16px; font-weight: 700; }
.dz-hint { margin-top: 6px; color: var(--text-secondary); font-size: 13px; }
.dz-formats { display: flex; justify-content: center; gap: 8px; margin-top: 16px; }
.dz-formats .ext-badge { width: 38px; height: 42px; font-style: normal; }

.text-form { display: grid; gap: var(--space-3); }
.text-actions { display: flex; align-items: center; gap: var(--space-3); }
.text-count { margin-left: auto; color: var(--text-secondary); font-size: 12px; font-variant-numeric: tabular-nums; }

.picked { margin-top: var(--space-6); }
.picked-title { margin: 0 0 var(--space-3); font-size: 14px; font-weight: 600; }
.picked-title span { color: var(--accent-600); }
.picked-title small { color: var(--text-secondary); font-weight: 400; }
.picked-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.picked-list li {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--bg-panel);
}
.picked-list .ext-badge { width: 34px; height: 38px; font-size: 9px; font-style: normal; }
.picked-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.picked-info strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.picked-info span { color: var(--text-secondary); font-size: 12px; }
.picked-note { color: var(--warn-600); font-size: 12px; font-style: normal; }
.remove {
  flex: none; width: 28px; height: 28px; border: 0; border-radius: var(--radius-sm);
  background: none; color: var(--text-tertiary); font-size: 18px; line-height: 1; cursor: pointer;
}
.remove:hover { color: var(--danger-600); background: var(--danger-50); }
.is-parsing { opacity: 0.75; }
.spinner {
  flex: none; width: 16px; height: 16px; margin: 0 9px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--accent-600) 22%, transparent); border-top-color: var(--accent-600);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.picked-empty { margin: 0; padding: var(--space-4); border: 1px dashed var(--border-default); border-radius: var(--radius-md); color: var(--text-secondary); font-size: 13px; text-align: center; }

.actions { display: flex; justify-content: space-between; gap: var(--space-3); margin-top: var(--space-6); }
</style>
