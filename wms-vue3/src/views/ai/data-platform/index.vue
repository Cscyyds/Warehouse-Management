<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import DataIcon from './DataIcon.vue'
import { cleanText, configError, createChunks, defaultConfig, documentSize, sampleDocuments } from './processing'
import type { Chunk, ProcessingConfig, SourceDocument } from './processing'
import { parseFile } from './fileParser'
import { documentKindLabel, modelLabel } from './displayLabels'
import './style.css'
import './workspace-layout.css'

defineOptions({ name: 'DataPlatformDemo' })
const router = useRouter()
const theme = useThemeStore()
const section = ref<'import' | 'library' | 'tasks'>('import')
const step = ref(1)
const sourceTab = ref<'file' | 'text'>('file')
const documents = ref<SourceDocument[]>([])
const selectedId = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const parsing = ref(false)
const textTitle = ref('')
const textContent = ref('')
const search = ref('')
const chunkSearch = ref('')
const previewMode = ref<'source' | 'chunks'>('source')
const sheetIndex = ref(0)
const previewPage = ref(1)
const showHelp = ref(false)
const inspecting = ref<LibraryEntry | null>(null)
const removing = ref<string | null>(null)
const toast = ref('')
const errors = ref<string[]>([])
const config = reactive<ProcessingConfig>({ ...defaultConfig })
const targetName = ref('产品知识库')
const collectionType = ref('产品资料')
const description = ref('')
const saved = ref(false)
const jobProgress = ref(0)
const running = ref(false)
let processTimer: ReturnType<typeof setInterval> | undefined
let toastTimer: ReturnType<typeof setTimeout> | undefined
let snapshot: { docs: SourceDocument[]; chunks: Chunk[]; config: ProcessingConfig; target: string; category: string; description: string } | null = null
interface LibraryEntry { id: string; name: string; kind: string; chars: number; chunks: Chunk[]; at: string; target: string; category: string; description: string; config: ProcessingConfig; sample: boolean }
interface Task { id: string; at: string; count: number; target: string; chunks: number; status: 'done' | 'cancelled' }
const library = ref<LibraryEntry[]>([])
const tasks = ref<Task[]>([])
const activeDoc = computed(() => documents.value.find(doc => doc.id === selectedId.value) || documents.value[0])
const validation = computed(() => configError(config))
const allChunks = computed(() => documents.value.flatMap(doc => createChunks(doc, config)))
const currentChunks = computed(() => allChunks.value.filter(chunk => chunk.sourceId === activeDoc.value?.id))
const searchedChunks = computed(() => currentChunks.value.filter(chunk => `${chunk.text} ${chunk.index}`.toLowerCase().includes(chunkSearch.value.toLowerCase())))
const shownChunks = computed(() => searchedChunks.value.slice((previewPage.value - 1) * 8, previewPage.value * 8))
const totalChars = computed(() => documents.value.reduce((total, doc) => total + Array.from(cleanText(doc.text, config)).length, 0))
const ready = computed(() => documents.value.length > 0 && documents.value.every(doc => doc.text.trim()))
const visibleLibrary = computed(() => library.value.filter(entry => `${entry.name} ${entry.target} ${entry.category}`.toLowerCase().includes(search.value.toLowerCase())))
const totalStored = computed(() => library.value.reduce((total, entry) => total + entry.chunks.length, 0))
const tableRows = computed(() => activeDoc.value?.sheets?.[sheetIndex.value]?.rows || activeDoc.value?.rows || [])
const heading = computed(() => section.value === 'library' ? '我的知识库' : section.value === 'tasks' ? '处理记录' : '导入数据')
const stepNames = ['添加数据', '配置处理', '预览与入库']
const pipeline = ['解析与清洗', '生成数据分块', '整理索引配置', '生成处理结果']
watch(config, () => { previewPage.value = 1 }, { deep: true })
function notify(message: string) { toast.value = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.value = '' }, 4200) }
function selectDoc(id: string) { selectedId.value = id; sheetIndex.value = 0; previewPage.value = 1; chunkSearch.value = '' }
function navigate(to: 'import' | 'library' | 'tasks') { section.value = to; search.value = '' }
async function addFiles(files: FileList | File[] | null) {
  if (!files || parsing.value || running.value) return
  parsing.value = true; errors.value = []
  const queue = Array.from(files)
  if (documents.value.length + queue.length > 20) { errors.value = ['每次最多添加 20 份资料']; parsing.value = false; return }
  for (const file of queue) {
    try {
      if (documents.value.some(doc => doc.name === file.name && doc.size === file.size)) { errors.value.push(`${file.name}：已在列表中`); continue }
      const doc = await parseFile(file)
      documents.value.push(doc); selectDoc(doc.id); saved.value = false
    } catch (error) { errors.value.push(error instanceof Error ? error.message : `${file.name}：解析失败，请检查文件`) }
  }
  parsing.value = false
  if (fileInput.value) fileInput.value.value = ''
}
function handleDrop(event: DragEvent) { dragging.value = false; void addFiles(event.dataTransfer?.files || null) }
function addText() {
  if (!textTitle.value.trim() || !textContent.value.trim()) { notify('请填写文本标题和内容'); return }
  if (documents.value.length >= 20) { notify('每次最多添加 20 份资料'); return }
  const doc = { id: crypto.randomUUID(), name: textTitle.value.trim(), kind: 'TEXT', text: textContent.value.trim(), size: new Blob([textContent.value]).size }
  documents.value.push(doc); selectDoc(doc.id); textTitle.value = ''; textContent.value = ''; saved.value = false; notify('自定义文本已添加')
}
function loadSample() {
  const sample = sampleDocuments()[0]!
  if (!documents.value.some(doc => doc.id === sample.id)) {
    if (documents.value.length >= 20) { notify('每次最多添加 20 份资料'); return }
    documents.value.push(sample)
  }
  selectDoc(sample.id); sourceTab.value = 'file'; saved.value = false
}
function removeDoc(id: string) { const doc = documents.value.find(item => item.id === id); if (doc?.url) URL.revokeObjectURL(doc.url); documents.value = documents.value.filter(item => item.id !== id); if (activeDoc.value) selectDoc(activeDoc.value.id) }
function goStep(next: number) {
  if (parsing.value || running.value) return
  if (next > 1 && !ready.value) { notify('请添加资料；版式文档需先补充可切片的正文'); return }
  if (next > 2 && validation.value) { notify(validation.value); return }
  if (next > 1 && sourceTab.value === 'text' && textContent.value.trim()) { notify('请先点击“添加到资料列表”，保存正在编辑的文本'); return }
  step.value = next; previewMode.value = next === 3 ? 'chunks' : 'source'; previewPage.value = 1
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function preset(size: number, overlap: number) { config.size = size; config.overlap = overlap; config.storage = 'chunks'; saved.value = false }
function saveConfig() {
  if (validation.value) { notify(validation.value); return }
  try { localStorage.setItem('data-platform-demo-config-v1', JSON.stringify(config)); notify('处理模板已保存到当前浏览器') } catch { notify('浏览器无法保存模板，请检查存储权限') }
}
try { const raw = localStorage.getItem('data-platform-demo-config-v1'); if (raw) { const parsed = JSON.parse(raw); const candidate = { ...defaultConfig, ...parsed }; if (['chunks', 'whole'].includes(candidate.storage) && ['always', 'threshold'].includes(candidate.condition) && ['paragraph', 'length', 'delimiter'].includes(candidate.strategy) && !configError(candidate)) Object.assign(config, candidate) } } catch { /* A fresh config works without local storage. */ }
function resetConfig() { Object.assign(config, defaultConfig); notify('已恢复默认参数') }
function beginProcess() {
  if (!ready.value || validation.value || !targetName.value.trim() || running.value || saved.value) { notify(validation.value || '请检查资料与知识库名称'); return }
  snapshot = { docs: documents.value.map(doc => ({ ...doc })), chunks: allChunks.value.map(chunk => ({ ...chunk })), config: { ...config }, target: targetName.value.trim(), category: collectionType.value, description: description.value }
  jobProgress.value = 0; running.value = true
  processTimer = setInterval(() => {
    jobProgress.value = Math.min(100, jobProgress.value + 5)
    if (jobProgress.value === 100) finishProcess()
  }, 160)
}
function finishProcess() {
  clearInterval(processTimer)
  if (!snapshot) return
  const at = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
  library.value.unshift(...snapshot.docs.map(doc => ({ id: crypto.randomUUID(), name: doc.name, kind: doc.kind, chars: Array.from(doc.text).length, chunks: snapshot!.chunks.filter(chunk => chunk.sourceId === doc.id), at, target: snapshot!.target, category: snapshot!.category, description: snapshot!.description, config: { ...snapshot!.config }, sample: !!doc.sample })))
  tasks.value.unshift({ id: crypto.randomUUID(), at, count: snapshot.docs.length, target: snapshot.target, chunks: snapshot.chunks.length, status: 'done' })
  running.value = false; saved.value = true; snapshot = null; notify('资料整理完成，可在“我的知识库”查看结果')
}
function cancelProcess() {
  clearInterval(processTimer)
  if (snapshot) tasks.value.unshift({ id: crypto.randomUUID(), at: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }), count: snapshot.docs.length, target: snapshot.target, chunks: snapshot.chunks.length, status: 'cancelled' })
  running.value = false; snapshot = null; jobProgress.value = 0; notify('已取消处理，资料与配置已保留')
}
function newImport() { documents.value.forEach(doc => { if (doc.url) URL.revokeObjectURL(doc.url) }); documents.value = []; selectedId.value = ''; saved.value = false; step.value = 1; section.value = 'import'; errors.value = []; previewMode.value = 'source' }
function exportData(entry?: LibraryEntry) {
  const value = entry || { target: targetName.value, config: { ...config }, chunks: allChunks.value, demo: true }
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = `${entry?.name || '数据处理预览'}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
onBeforeUnmount(() => { clearInterval(processTimer); clearTimeout(toastTimer); documents.value.forEach(doc => { if (doc.url) URL.revokeObjectURL(doc.url) }) })
</script>

<template>
  <div class="dp-shell">
    <aside class="dp-sidebar">
      <a class="dp-brand" href="/ai/pdf_agent/data-platform" @click.prevent="navigate('import')"><span class="dp-brand-mark"><DataIcon name="database" :size="23" /></span><span>仓储管理<span class="dp-brand-en">数据工作空间</span></span></a>
      <div class="dp-workspace"><span class="dp-workspace-avatar">个</span><span>个人工作空间<small>专属资料管理空间</small></span><span class="dp-workspace-dot"></span></div>
      <div class="dp-nav-caption">工作台</div>
      <nav class="dp-nav" aria-label="数据中台导航">
        <button :class="{ active: section === 'library' }" @click="navigate('library')"><DataIcon name="database" />我的知识库<span class="dp-nav-count">{{ library.length }}</span></button>
        <button :class="{ active: section === 'import' }" @click="navigate('import')"><DataIcon name="upload" />导入数据</button>
        <button :class="{ active: section === 'tasks' }" @click="navigate('tasks')"><DataIcon name="clock" />处理记录<span v-if="tasks.length" class="dp-nav-count">{{ tasks.length }}</span></button>
      </nav>
      <div class="dp-sidebar-bottom"><button class="dp-help-link" @click="showHelp = true"><DataIcon name="help" :size="18" />使用指南<DataIcon name="chevron" :size="15" /></button><button class="dp-return" @click="router.push('/ai/pdf_agent')"><DataIcon name="back" :size="16" />返回文档解析工作台</button><div class="dp-user"><span>用</span><div>当前用户<small>个人空间</small></div><button class="dp-icon-button" :aria-label="theme.isDark ? '切换浅色模式' : '切换深色模式'" @click="theme.toggleTheme()"><DataIcon :name="theme.isDark ? 'sun' : 'moon'" :size="18" /></button></div></div>
    </aside>

    <div class="dp-main">
      <header class="dp-topbar"><div class="dp-breadcrumb">工作空间<DataIcon name="chevron" :size="13" /><strong>{{ heading }}</strong></div><div class="dp-topbar-right"><span class="dp-topbar-hint">让每一份资料，成为可用的知识</span><button class="dp-icon-button" aria-label="打开使用指南" @click="showHelp = true"><DataIcon name="help" :size="19" /></button></div></header>
      <main class="dp-content">
        <div class="dp-page-heading"><div><div class="dp-eyebrow">{{ section === 'import' ? '知识处理流程' : section === 'library' ? '知识集中管理' : '处理过程追踪' }}</div><h1>{{ section === 'import' ? '把资料，变成知识。' : heading }}</h1><p>{{ section === 'import' ? '汇集文档、表格与灵感，为你的知识库添加新的内容。' : section === 'library' ? '在一个地方管理资料，查看每一份知识的来源与分块。' : '每一次处理都有迹可循，从原始资料到知识索引。' }}</p></div><button v-if="section === 'import'" class="dp-button dp-secondary" @click="showHelp = true"><DataIcon name="help" :size="16" />导入指南</button><button v-else class="dp-button dp-primary" @click="saved ? newImport() : navigate('import')"><DataIcon name="plus" :size="17" />添加数据</button></div>

        <div class="dp-stats"><div><span class="dp-stat-icon"><DataIcon name="file" /></span><div><small>{{ section === 'import' ? '待导入资料' : '知识文档' }}</small><strong>{{ section === 'import' ? documents.length : library.length }}<em>份</em></strong></div><span class="dp-stat-foot">{{ section === 'import' ? '支持多种格式' : '当前会话' }}</span></div><div><span class="dp-stat-icon"><DataIcon name="layers" /></span><div><small>{{ section === 'import' ? '预计数据分块' : '知识分块' }}</small><strong>{{ section === 'import' ? allChunks.length : totalStored }}<em>块</em></strong></div><span class="dp-stat-foot">{{ section === 'import' ? '随配置实时更新' : '可查看与导出' }}</span></div><div><span class="dp-stat-icon"><DataIcon name="spark" /></span><div><small>索引模式</small><strong class="dp-stat-label">混合检索</strong></div><span class="dp-stat-foot"><span class="dp-status-dot"></span>索引配置</span></div></div>

        <template v-if="section === 'import'">
          <nav class="dp-flow" aria-label="资料导入流程">
            <ol class="dp-flow-steps">
              <li v-for="(name, index) in stepNames" :key="name" class="dp-flow-step"
                  :class="{ current: step === index + 1, done: step > index + 1 }">
                <button class="dp-flow-button" :disabled="running || saved || parsing"
                        :aria-current="step === index + 1 ? 'step' : undefined" @click="goStep(index + 1)">
                  <span class="dp-step-number">
                    <DataIcon v-if="step > index + 1" name="check" :size="16" />
                    <template v-else>{{ String(index + 1).padStart(2, '0') }}</template>
                  </span>
                  <span>{{ name }}<small>{{ ['上传文件或输入文本', '定义数据的处理方式', '确认效果，写入知识库'][index] }}</small></span>
                </button>
              </li>
            </ol>
          </nav>

          <div v-if="saved" class="dp-success"><span class="dp-success-icon"><DataIcon name="check" :size="28" /></span><div><h2>资料整理完成</h2><p>{{ documents.length }} 份资料 · {{ allChunks.length }} 个分块，已生成处理结果。目标知识库为「{{ targetName }}」，尚未写入服务器。</p></div><button class="dp-button dp-secondary" @click="newImport">继续添加</button><button class="dp-button dp-primary" @click="navigate('library')">查看知识库<DataIcon name="arrow" :size="17" /></button></div>
          <div v-else class="dp-editor-grid" :class="{ 'dp-final-grid': step === 3 }">
            <div class="dp-editor-left">
              <section v-if="step === 1" class="dp-panel">
                <div class="dp-panel-heading"><div><h2>添加你的资料</h2><p>从本地文件开始，或直接记录一段知识。</p></div><span class="dp-section-number">01</span></div>
                <div class="dp-source-tabs" role="tablist" aria-label="资料来源"><button role="tab" :aria-selected="sourceTab === 'file'" :class="{ active: sourceTab === 'file' }" @click="sourceTab = 'file'"><DataIcon name="file" :size="17" />本地文件</button><button role="tab" :aria-selected="sourceTab === 'text'" :class="{ active: sourceTab === 'text' }" @click="sourceTab = 'text'"><DataIcon name="text" :size="17" />自定义文本</button></div>
                <div v-if="sourceTab === 'file'" class="dp-upload-area" :class="{ dragging, busy: parsing }" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="handleDrop">
                  <div class="dp-upload-illustration"><div class="dp-paper-back"></div><div class="dp-paper"><DataIcon name="file" :size="32" /><span></span><span></span></div><span class="dp-upload-bubble"><DataIcon name="upload" :size="18" /></span></div>
                  <h3>{{ parsing ? '正在读取资料…' : '拖拽文件到这里' }}</h3><p>支持批量添加，把零散信息汇集起来</p><button class="dp-button dp-primary" :disabled="parsing" @click="fileInput?.click()"><DataIcon name="plus" :size="16" />选择本地文件</button><div class="dp-file-formats"><span>版式文档</span><span>纯文本</span><span>文字文档</span><span>标记文本</span><span>电子表格</span></div><small>单文件不超过 20 兆字节，每次最多 20 份</small>
                  <input ref="fileInput" type="file" accept=".pdf,.txt,.md,.docx,.xlsx,.xls,.csv" multiple hidden @change="addFiles(($event.target as HTMLInputElement).files)" />
                </div>
                <div v-else class="dp-text-form"><label for="text-title">文本标题<span>*</span></label><input id="text-title" v-model="textTitle" placeholder="例如：产品常见问题与补充说明" maxlength="120" /><label for="text-content">正文内容<span>*</span></label><textarea id="text-content" v-model="textContent" rows="9" placeholder="粘贴知识内容、业务规则或补充信息…&#10;&#10;支持使用分级标题组织段落。" maxlength="200000"></textarea><div class="dp-text-form-footer"><small>{{ textContent.length.toLocaleString() }} / 200,000 字符</small><button class="dp-button dp-primary" :disabled="!textTitle.trim() || !textContent.trim()" @click="addText"><DataIcon name="plus" :size="16" />添加到资料列表</button></div></div>
                <div class="dp-sample-row"><span class="dp-sample-icon"><DataIcon name="spark" :size="18" /></span><div><strong>还没有准备好资料？</strong><small>用一份产品指南，体验完整处理流程</small></div><button @click="loadSample">试试示例<DataIcon name="arrow" :size="16" /></button></div>
                <div v-if="errors.length" class="dp-errors" role="alert"><p v-for="error in errors" :key="error">{{ error }}</p></div>
                <div class="dp-file-list-heading"><h3>资料列表<span>{{ documents.length }}</span></h3><small>添加后可在右侧预览</small></div>
                <div v-if="!documents.length" class="dp-empty-list"><DataIcon name="file" :size="19" />还没有添加资料，准备好就开始吧。</div>
                <div v-for="doc in documents" :key="doc.id" class="dp-file-row" :class="{ selected: activeDoc?.id === doc.id }"><button class="dp-file-select" @click="selectDoc(doc.id)"><span class="dp-file-badge" :class="{ green: ['XLSX','XLS','CSV'].includes(doc.kind) }">{{ documentKindLabel(doc.kind) }}</span><span class="dp-file-meta"><strong>{{ doc.name }}</strong><small>{{ documentSize(doc.size) }}<span>·</span>{{ doc.sample ? '示例资料' : doc.text ? '已读取' : '待补充正文' }}</small></span></button><button class="dp-icon-button" :aria-label="`移除 ${doc.name}`" :disabled="parsing" @click="removeDoc(doc.id)"><DataIcon name="close" :size="16" /></button></div>
              </section>

              <section v-if="step === 2" class="dp-panel dp-config-panel">
                <div class="dp-panel-heading"><div><h2>配置处理方式</h2><p>根据资料结构，找到合适的知识粒度。</p></div><button class="dp-plain-link" @click="resetConfig">恢复默认</button></div>
                <div class="dp-config-section"><div class="dp-setting-title"><span>1</span><h3>存储与切片</h3></div><label>存储方式</label><div class="dp-choice-row"><button :class="{ selected: config.storage === 'chunks' }" @click="config.storage = 'chunks'"><DataIcon name="layers" :size="21" /><strong>分块存储</strong><small>细粒度组织，精准检索</small><i></i></button><button :class="{ selected: config.storage === 'whole' }" @click="config.storage = 'whole'"><DataIcon name="file" :size="21" /><strong>全文存储</strong><small>保留完整上下文</small><i></i></button></div>
                  <template v-if="config.storage === 'chunks'"><label>分块条件</label><div class="dp-radio-row"><label><input v-model="config.condition" type="radio" value="always" />始终分块</label><label><input v-model="config.condition" type="radio" value="threshold" />超出指定长度时分块</label></div><div v-if="config.condition === 'threshold'" class="dp-inline-field">原文大于<input v-model.number="config.threshold" type="number" min="1" step="100" aria-label="触发分块的原文长度" /><span>字符时触发</span></div><label>切片精度<span class="dp-label-hint">快捷调整最大分块与重叠长度</span></label><div class="dp-segments"><button :class="{ active: config.size === 200 }" @click="preset(200, 30)">精细 <small>200 字符</small></button><button :class="{ active: config.size === 500 }" @click="preset(500, 50)">均衡 <small>500 字符</small></button><button :class="{ active: config.size === 1000 }" @click="preset(1000, 100)">完整 <small>1,000 字符</small></button></div><label for="chunk-strategy">分块策略</label><select id="chunk-strategy" v-model="config.strategy"><option value="paragraph">按段落分块 · 优先保留段落完整性</option><option value="length">按长度分块 · 固定字符长度</option><option value="delimiter">按指定分隔符分块</option></select><div v-if="config.strategy === 'delimiter'"><label for="delimiter">分隔符</label><input id="delimiter" v-model="config.delimiter" placeholder="例如：\n\n 或 ###" /><p class="dp-field-help">支持 \n 换行与 \t 制表符；超长段落仍按最大长度拆分。</p></div><div class="dp-form-grid"><div><label for="chunk-size">最大分块大小 <small>字符</small></label><input id="chunk-size" v-model.number="config.size" type="number" min="50" max="4000" step="50" /></div><div><label for="chunk-overlap">分块重叠长度 <small>字符</small></label><input id="chunk-overlap" v-model.number="config.overlap" type="number" min="0" :max="config.size - 1" step="10" /></div><div v-if="config.strategy === 'paragraph'"><label for="paragraph-depth">最大段落深度</label><select id="paragraph-depth" v-model.number="config.depth"><option v-for="n in 6" :key="n" :value="n">{{ n }} 级标题</option></select></div></div><p class="dp-field-help">段落与标题优先作为边界；超长段落按上限拆分，重叠内容帮助保留上下文。</p></template>
                </div>
                <div class="dp-config-section"><div class="dp-setting-title"><span>2</span><h3>清洗与索引增强</h3></div><label class="dp-switch-line"><span><strong>规范空白字符</strong><small>合并连续空格、制表符，清理行首行尾空白</small></span><input v-model="config.normalize" type="checkbox" role="switch" /><i></i></label><label class="dp-switch-line"><span><strong>清理多余空行</strong><small>将连续三个及以上换行合并为段落间隔</small></span><input v-model="config.removeBlank" type="checkbox" role="switch" /><i></i></label><label class="dp-switch-line"><span><strong>将文档标题加入索引</strong><small>为每个分块补充来源信息</small></span><input v-model="config.titleIndex" type="checkbox" role="switch" /><i></i></label><label class="dp-switch-line"><span><strong>自动生成索引摘要 </strong><small>本地用正文摘录预览，语义摘要待接入模型</small></span><input v-model="config.autoIndex" type="checkbox" role="switch" /><i></i></label><div class="dp-form-grid"><div><label for="index-size">最大索引大小 <small>字符</small></label><input id="index-size" v-model.number="config.indexSize" type="number" min="16" max="1024" step="8" /></div><div><label for="embedding-model">向量模型 </label><select id="embedding-model" v-model="config.model"><option value="bge-m3">多语言嵌入模型 · 1024 维</option><option value="text-embedding-3-small">第三代轻量嵌入模型 · 1536 维</option></select></div></div></div>
                <p v-if="validation" class="dp-validation" role="alert">{{ validation }}</p><div class="dp-template-footer"><DataIcon name="settings" :size="17" /><span>常用配置，下次直接使用</span><button class="dp-plain-link" @click="saveConfig">保存为模板</button></div>
              </section>

              <section v-if="step === 3" class="dp-panel"><div class="dp-panel-heading"><div><h2>确认入库信息</h2><p>检查分块效果，为资料安排一个位置。</p></div><span class="dp-section-number">03</span></div><label for="kb-name">目标知识库<span class="dp-required">*</span></label><input id="kb-name" v-model="targetName" :disabled="running" maxlength="60" placeholder="填写知识库名称" /><label for="category">资料分类</label><select id="category" v-model="collectionType" :disabled="running"><option>产品资料</option><option>业务知识</option><option>操作手册</option><option>补充信息</option></select><label for="kb-description">补充说明 <small>选填</small></label><textarea id="kb-description" v-model="description" :disabled="running" rows="3" maxlength="500" placeholder="补充这批资料的用途、适用范围或版本信息…"></textarea><div class="dp-config-summary"><h3>处理方案<button class="dp-plain-link" :disabled="running" @click="goStep(2)">修改配置</button></h3><dl><div><dt>存储方式</dt><dd>{{ config.storage === 'whole' ? '全文存储' : '分块存储' }}</dd></div><div><dt>分块策略</dt><dd>{{ config.storage === 'whole' ? '保留原文' : { paragraph: '按段落分块', length: '按长度分块', delimiter: '指定分隔符' }[config.strategy] }}</dd></div><div><dt>最大分块 / 重叠</dt><dd>{{ config.storage === 'whole' ? '—' : `${config.size} / ${config.overlap} 字符` }}</dd></div><div><dt>索引增强</dt><dd>{{ [config.titleIndex ? '文档标题' : '', config.autoIndex ? '摘要摘录' : ''].filter(Boolean).join(' + ') || '正文索引' }}</dd></div><div><dt>向量模型</dt><dd>{{ modelLabel(config.model) }}</dd></div></dl></div><div class="dp-notice"><DataIcon name="info" :size="17" /><p>当前可生成分块与索引配置。向量化、检索和服务器存储尚未接入。</p></div></section>
              <div class="dp-safe-note"><DataIcon name="info" :size="15" /><span>资料在浏览器本地解析，当前不会上传到服务器。</span></div>
            </div>

            <section class="dp-panel dp-preview-panel"><div class="dp-preview-heading"><div><DataIcon name="eye" :size="19" /><h2>{{ step === 1 ? '数据预览' : '处理效果预览' }}</h2></div><span class="dp-live-tag"><span></span>{{ step === 1 ? '原始内容' : '实时更新' }}</span></div><div class="dp-preview-toolbar"><div class="dp-preview-tabs"><button :class="{ active: previewMode === 'source' }" @click="previewMode = 'source'">原始数据</button><button :class="{ active: previewMode === 'chunks' }" @click="previewMode = 'chunks'; previewPage = 1">分块预览<span v-if="activeDoc">{{ currentChunks.length }}</span></button></div><span class="dp-preview-type">{{ activeDoc ? documentKindLabel(activeDoc.kind) : '内容预览' }}</span></div>
              <template v-if="activeDoc"><select v-if="documents.length > 1" class="dp-doc-selector" :value="activeDoc.id" aria-label="选择预览资料" @change="selectDoc(($event.target as HTMLSelectElement).value)"><option v-for="doc in documents" :key="doc.id" :value="doc.id">{{ doc.name }}</option></select><div class="dp-document-title"><span class="dp-file-badge small">{{ documentKindLabel(activeDoc.kind) }}</span><div><h3>{{ activeDoc.name }}</h3><span>{{ activeDoc.sample ? '示例资料 · ' : '' }}{{ documentSize(activeDoc.size) }} · {{ Array.from(activeDoc.text).length.toLocaleString() }} 字符</span></div></div><p v-if="activeDoc.issue" class="dp-parser-note">{{ activeDoc.issue }}</p>
                <div v-if="previewMode === 'source'" class="dp-source-preview"><iframe v-if="activeDoc.url" :key="activeDoc.url" :src="activeDoc.url" title="版式文档原文件预览"></iframe><template v-else-if="activeDoc.sheets"><div class="dp-sheet-tabs"><button v-for="(sheet, index) in activeDoc.sheets" :key="sheet.name" :class="{ active: sheetIndex === index }" @click="sheetIndex = index">{{ sheet.name }}</button></div><div class="dp-table-scroll"><table class="dp-source-table"><tbody><tr v-for="(row, index) in tableRows.slice(0, 101)" :key="index"><th>{{ index + 1 }}</th><td v-for="(cell, col) in row" :key="col">{{ cell }}</td></tr></tbody></table></div><small class="dp-table-hint">共 {{ tableRows.length }} 行 · 原始预览最多显示前 100 行数据，切片包含全部已读取行</small></template><div v-else class="dp-document-body"><div v-for="(paragraph, index) in activeDoc.text.split(/\n\s*\n/)" :key="index" :class="/^#/.test(paragraph) ? 'dp-document-subtitle' : 'dp-document-paragraph'">{{ paragraph.replace(/^#{1,6}\s*/, '') }}</div></div></div>
                <template v-else><div class="dp-chunk-filter"><DataIcon name="search" :size="16" /><input v-model="chunkSearch" placeholder="搜索分块内容…" aria-label="搜索分块内容" @input="previewPage = 1" /><span>{{ searchedChunks.length }} 块</span></div><p v-if="validation" class="dp-validation">{{ validation }}</p><div class="dp-chunks"><div v-for="(chunk, index) in shownChunks" :key="chunk.id" class="dp-chunk-card"><div class="dp-chunk-header"><span><DataIcon name="layers" :size="14" />分块 {{ String((previewPage - 1) * 8 + index + 1).padStart(2, '0') }}</span><small>{{ Array.from(chunk.text).length }} 字符</small></div><p>{{ chunk.text }}</p><div class="dp-chunk-index"><span><DataIcon name="spark" :size="12" />索引</span><p>{{ chunk.index }}</p></div><small class="dp-chunk-range">字符位置 {{ chunk.start + 1 }}–{{ chunk.end }}</small></div><div v-if="!searchedChunks.length" class="dp-no-chunks">{{ activeDoc.text ? '没有匹配的分块' : '请先补充文档提取文本，再预览切片。' }}</div></div><div v-if="searchedChunks.length > 8" class="dp-pagination"><button :disabled="previewPage === 1" @click="previewPage--">上一页</button><span>{{ previewPage }} / {{ Math.ceil(searchedChunks.length / 8) }}</span><button :disabled="previewPage * 8 >= searchedChunks.length" @click="previewPage++">下一页</button></div></template>
                <div v-if="activeDoc.kind === 'PDF' && step === 1" class="dp-pdf-text"><label for="pdf-text">补充文档提取文本</label><textarea id="pdf-text" v-model="activeDoc.text" rows="4" placeholder="粘贴正文，体验本地切片；不会自动提取文档内容。"></textarea></div><div class="dp-preview-bottom"><span><DataIcon name="file" :size="14" />{{ previewMode === 'source' ? '处理前原始内容' : `${config.storage === 'whole' ? '全文存储' : '本地实际切片'} · 索引摘要取自正文摘录` }}</span><span>{{ currentChunks.length }} 个分块</span></div>
              </template>
              <div v-else class="dp-preview-empty"><div class="dp-preview-placeholder"><DataIcon name="file" :size="38" /><span></span><span></span><span></span></div><h3>知识，从一份资料开始</h3><p>添加文件或自定义文本后<br>在这里查看原始内容与分块效果</p><div><i></i></div></div>
            </section>
          </div>
          <div v-if="!saved" class="dp-actionbar"><div><span class="dp-action-count">{{ documents.length }}<small>份资料已就绪</small></span><span class="dp-action-divider"></span><span class="dp-action-hint">{{ step === 1 ? '先预览内容，再决定如何处理' : `${totalChars.toLocaleString()} 字符 · 预计生成 ${allChunks.length} 个分块` }}</span></div><div><button v-if="step > 1" class="dp-button dp-secondary" :disabled="running" @click="goStep(step - 1)"><DataIcon name="back" :size="16" />上一步</button><button v-if="step < 3" class="dp-button dp-primary" :disabled="!ready || parsing || !!(step === 2 && validation)" @click="goStep(step + 1)">{{ step === 1 ? '下一步：配置处理' : '下一步：预览与入库' }}<DataIcon name="arrow" :size="17" /></button><button v-else class="dp-button dp-primary" :disabled="running || !targetName.trim() || !ready || !!validation" @click="beginProcess"><DataIcon name="database" :size="17" />{{ running ? '正在处理…' : '生成处理结果' }}</button></div></div>
        </template>

        <section v-else-if="section === 'library'" class="dp-panel dp-library-panel"><div class="dp-list-toolbar"><h2>全部资料 <span>{{ library.length }}</span></h2><div class="dp-search"><DataIcon name="search" :size="17" /><input v-model="search" placeholder="搜索资料、知识库或分类" aria-label="搜索知识库资料" /></div></div><div v-if="!visibleLibrary.length" class="dp-collection-empty"><DataIcon name="database" :size="42" /><h3>{{ library.length ? '没有找到匹配的资料' : '为你的知识库添加第一份资料' }}</h3><p>上传资料、配置分块，构建自己的知识空间。</p><button class="dp-button dp-primary" @click="saved ? newImport() : navigate('import')"><DataIcon name="plus" :size="16" />添加数据</button></div><div v-else class="dp-table-scroll"><table class="dp-library-table"><thead><tr><th>资料名称</th><th>知识库 / 分类</th><th>数据分块</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="entry in visibleLibrary" :key="entry.id"><td><div class="dp-table-file"><span class="dp-file-badge small">{{ documentKindLabel(entry.kind) }}</span><div><strong>{{ entry.name }}</strong><small>{{ entry.at }}{{ entry.sample ? ' · 示例' : '' }}</small></div></div></td><td>{{ entry.target }}<small>{{ entry.category }}</small></td><td>{{ entry.chunks.length }} 块<small>{{ entry.chars.toLocaleString() }} 字符</small></td><td><span class="dp-status-pill"><span></span>待写入</span></td><td><div class="dp-table-actions"><button class="dp-icon-button" aria-label="查看分块" @click="inspecting = entry"><DataIcon name="eye" :size="17" /></button><button class="dp-icon-button" aria-label="导出分块数据" @click="exportData(entry)"><DataIcon name="download" :size="17" /></button><button class="dp-icon-button" aria-label="移除资料" @click="removing = entry.id"><DataIcon name="trash" :size="17" /></button></div></td></tr></tbody></table></div><div class="dp-list-footnote"><DataIcon name="info" :size="15" />资料暂存于当前会话，刷新后清空。需要保留时请先导出，当前尚未写入服务器。</div></section>
        <section v-else class="dp-panel dp-library-panel"><div class="dp-list-toolbar"><h2>处理记录 <span>{{ tasks.length }}</span></h2><span class="dp-muted">当前会话 · 北京时间</span></div><div v-if="!tasks.length" class="dp-collection-empty"><DataIcon name="clock" :size="42" /><h3>每一份知识，都有来时的路</h3><p>完成资料处理后，可在这里回看任务记录。</p></div><div v-for="task in tasks" :key="task.id" class="dp-task-row"><span class="dp-task-icon"><DataIcon :name="task.status === 'done' ? 'check' : 'close'" /></span><div><h3>{{ task.target }} · 批量导入</h3><p>{{ task.at }} · {{ task.count }} 份资料 · {{ task.chunks }} 个分块</p></div><span class="dp-status-pill" :class="{ cancelled: task.status === 'cancelled' }">{{ task.status === 'done' ? '分块处理完成' : '已取消' }}</span></div></section>
        <footer class="dp-page-footer"></footer>
      </main>
    </div>

    <Transition name="dp-toast"><div v-if="toast" class="dp-toast-message" role="status"><DataIcon name="info" :size="18" />{{ toast }}</div></Transition>
    <div v-if="running" class="dp-overlay"><section class="dp-modal dp-process-modal" role="dialog" aria-modal="true" aria-labelledby="process-title"><span class="dp-process-logo"><DataIcon name="database" :size="30" /></span><span class="dp-eyebrow">知识整理中</span><h2 id="process-title">正在整理你的知识</h2><p>{{ snapshot?.docs.length }} 份资料 · {{ snapshot?.chunks.length }} 个分块</p><div class="dp-progress"><span :style="{ width: `${jobProgress}%` }"></span></div><div class="dp-process-percent">{{ jobProgress }}%</div><div v-for="(name, index) in pipeline" :key="name" class="dp-process-step" :class="{ done: jobProgress >= (index + 1) * 25, active: jobProgress >= index * 25 && jobProgress < (index + 1) * 25 }"><span><DataIcon v-if="jobProgress >= (index + 1) * 25" name="check" :size="15" /><template v-else>{{ index + 1 }}</template></span>{{ name }}<small>{{ jobProgress >= (index + 1) * 25 ? '完成' : jobProgress >= index * 25 ? '进行中' : '等待' }}</small></div><div class="dp-notice"><DataIcon name="info" :size="17" /><p>正在整理本地处理结果，当前不会执行模型调用或服务器写入。</p></div><button class="dp-plain-link" @click="cancelProcess">取消处理</button></section></div>
    <div v-if="showHelp" class="dp-overlay" @click.self="showHelp = false" @keydown.esc="showHelp = false"><section class="dp-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" tabindex="-1"><button class="dp-modal-close dp-icon-button" aria-label="关闭指南" autofocus @click="showHelp = false"><DataIcon name="close" /></button><div class="dp-eyebrow">使用指南</div><h2 id="guide-title">三步，把资料变成知识</h2><div class="dp-guide-step"><span>01</span><div><h3>汇集资料</h3><p>支持纯文本、标记文本、文字文档、电子表格与自定义文本。版式文档支持原文件预览，可手动补充提取正文。</p></div></div><div class="dp-guide-step"><span>02</span><div><h3>定义处理方式</h3><p>选择全文或分块存储，调整分块策略、字符上限、重叠长度、标题深度与索引配置，在右侧查看实时效果。</p></div></div><div class="dp-guide-step"><span>03</span><div><h3>检查处理结果</h3><p>确认分块，填写知识库名称。处理完成后可查看和导出结构化数据。模型调用、向量化与服务器存储尚未接入。</p></div></div><div class="dp-notice"><DataIcon name="info" :size="17" /><p>资料仅保留在当前页面内，刷新后清空。保存的处理模板留在当前浏览器中。</p></div><button class="dp-button dp-primary" @click="showHelp = false">开始体验<DataIcon name="arrow" :size="17" /></button></section></div>
    <div v-if="inspecting" class="dp-overlay" @click.self="inspecting = null" @keydown.esc="inspecting = null"><section class="dp-modal dp-detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button class="dp-modal-close dp-icon-button" aria-label="关闭详情" autofocus @click="inspecting = null"><DataIcon name="close" /></button><div class="dp-eyebrow">文档详情</div><h2 id="detail-title">{{ inspecting.name }}</h2><p>{{ inspecting.target }} · {{ inspecting.category }} · {{ inspecting.chunks.length }} 个分块</p><p v-if="inspecting.description" class="dp-detail-description">{{ inspecting.description }}</p><div class="dp-detail-chunks"><div v-for="(chunk, index) in inspecting.chunks" :key="chunk.id" class="dp-chunk-card"><div class="dp-chunk-header"><span>分块 {{ index + 1 }}</span><small>{{ Array.from(chunk.text).length }} 字符</small></div><p>{{ chunk.text }}</p><div class="dp-chunk-index"><span>索引</span><p>{{ chunk.index }}</p></div></div></div><button class="dp-button dp-primary" @click="exportData(inspecting)"><DataIcon name="download" :size="17" />导出分块数据</button></section></div>
    <div v-if="removing" class="dp-overlay" @click.self="removing = null"><section class="dp-modal dp-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">移除这份资料？</h2><p>将从当前会话的知识库列表移除，原始文件不受影响。</p><div><button class="dp-button dp-secondary" autofocus @click="removing = null">取消</button><button class="dp-button dp-primary" @click="library = library.filter(entry => entry.id !== removing); removing = null; notify('已移除资料')">确认移除</button></div></section></div>
  </div>
</template>
