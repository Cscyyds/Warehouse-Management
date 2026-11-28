<script setup lang="ts">
import { showMessage, type FeedbackMessageType } from '@/utils/messageFeedback'
import { showErrorDialog } from '@/utils/errorFeedback'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import DataIcon from './DataIcon.vue'
import ContentTypeDialog from './ContentTypeDialog.vue'
import DocumentViewer from './DocumentViewer.vue'
import { cleanText, configError, createChunks, defaultConfig, documentSize, sampleDocuments } from './processing'
import type { Chunk, ProcessingConfig, SourceDocument } from './processing'
import { renderAnswer } from './answerFormat'
import * as api from './pipelineApi'
import type { ServerJob, ServerDocument, ProcessResult, LibrarySummary, LibraryDetail, SearchHit, Tag, TagSuggestion, AskSource } from './pipelineApi'
import './style.css'
import './workspace-layout.css'

defineOptions({ name: 'DataPlatformWorkspace' })
const router = useRouter(), route = useRoute(), theme = useThemeStore()
const section = ref<'import' | 'library' | 'tasks' | 'ask'>('import'), step = ref(1), sourceTab = ref<'file' | 'text'>('file')
const documents = ref<SourceDocument[]>([]), selectedId = ref(''), fileInput = ref<HTMLInputElement | null>(null)
const confirmedContentTypes = ref<Record<string, string>>({})
const contentTypesReady = computed(() => documents.value.length > 0 && documents.value.every(doc => confirmedContentTypes.value[doc.id]))
const typeConfirmQueue = ref<SourceDocument[]>([])
const typeConfirmDoc = computed(() => typeConfirmQueue.value[0])
const openingPreview = ref(false), parseProgress = ref<number | null>(null)
async function typeSaved(type: api.ContentType) {
  const doc = typeConfirmDoc.value
  if (!doc) return
  confirmedContentTypes.value[doc.id] = type
  typeConfirmQueue.value.shift()
  if (!typeConfirmQueue.value.length) await openFullPreview(doc)
}
const dragging = ref(false), parsing = ref(false), textTitle = ref(''), textContent = ref(''), search = ref('')
const showHelp = ref(false)
const inspecting = ref<LibraryEntry | null>(null), removing = ref<string | null>(null), errors = ref<string[]>([])
const config = reactive<ProcessingConfig>({ ...defaultConfig }), targetName = ref('产品知识库'), description = ref('')
const saved = ref(false), savedStats = ref({ documents: 0, chunks: 0 }), jobProgress = ref(0), running = ref(false), jobStage = ref(''), uploadStage = ref(''), syncing = ref(false)
const uploadLimits = ref('上传与解析上限由服务器配置')
const serverChunks = ref<Record<string, Chunk[]>>({})
let refreshTimer: ReturnType<typeof setInterval> | undefined
let controller = new AbortController(), activeJob = '', disposed = false
const formatDate = (value: string) => new Date(value.endsWith('Z') ? value : value + 'Z').toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
interface LibraryEntry { id: string; name: string; kind: string; chars: number; chunks: Chunk[]; at: string; target: string; libraryId: string; category: string; tags: Tag[]; description: string; config: ProcessingConfig; sample: boolean; version: string | null }
const library = ref<LibraryEntry[]>([]), tasks = ref<ServerJob[]>([])
// ── 知识库（服务端 /libraries）与管理状态 ──
const libraries = ref<LibrarySummary[]>([]), libraryFilter = ref(''), newLibraryName = ref('')
const showNewLibrary = ref(false), libraryBusy = ref(false), showLibraryDialog = ref(false)
const removingLibrary = ref<LibraryDetail | null>(null)
// ── 语义检索（服务端 /search）──
const searchQuery = ref(''), searching = ref(false), searchedOnce = ref(false), searchError = ref('')
const searchResults = ref<SearchHit[]>([])
let searchRequestId = 0
const searchScope = computed(() => {
  const scope = libraries.value.find(lib => lib.id === libraryFilter.value)?.name || '全部资料'
  const tagNames = tags.value.filter(tag => searchTagIds.value.includes(tag.id)).map(tag => tag.name)
  return tagNames.length ? `${scope} · ${tagNames.join('、')}` : scope
})
async function runSearch() {
  const query = searchQuery.value.trim()
  if (!query || searching.value) return
  const requestId = ++searchRequestId
  searching.value = true; searchError.value = ''; searchResults.value = []; searchedOnce.value = false
  try {
    const { hits } = await api.searchDocuments(query, libraryFilter.value || undefined, searchTagIds.value)
    if (requestId !== searchRequestId) return
    searchResults.value = hits.map(hit => ({
      ...hit,
      document_name: library.value.find(entry => entry.id === hit.document_id)?.name
        || documents.value.find(doc => doc.id === hit.document_id)?.name,
    }))
    searchedOnce.value = true
  } catch (error) {
    if (requestId !== searchRequestId) return
    searchError.value = error instanceof Error ? error.message : '检索失败，请确认检索服务已启动'
    searchResults.value = []
  } finally { if (requestId === searchRequestId) searching.value = false }
}
function resetSearchResults() {
  // Invalidate pending responses as soon as the query or scope changes.
  ++searchRequestId
  searching.value = false; searchResults.value = []; searchedOnce.value = false; searchError.value = ''
}
function clearSearch() { searchQuery.value = ''; resetSearchResults() }
watch(searchQuery, resetSearchResults, { flush: 'sync' })
watch(libraryFilter, () => clearSearch(), { flush: 'sync' })

// ── 知识问答（服务端 /ask，RAG 流式回答 + 引用核对）──
interface AskMessage { id: string; role: 'user' | 'assistant'; content: string; status: 'streaming' | 'done' | 'error' | 'stopped' | 'no_evidence'; sources: AskSource[]; error?: string; model?: string; question?: string; scope?: string }
const askMessages = ref<AskMessage[]>([])
const askInput = ref(''), askBusy = ref(false), askLibraryId = ref(''), askTagIds = ref<string[]>([])
const askEvidenceFor = ref(''), askCiteActive = ref(0), expandedSource = ref(''), askPinned = ref(true)
const askScroll = ref<HTMLElement | null>(null), askInputEl = ref<HTMLTextAreaElement | null>(null)
let askController: AbortController | null = null
const ASK_SUGGESTIONS = ['上合页距门顶多少毫米？', '抽屉滑轨的承重是多少？', '安装时有哪些注意事项？', '这份资料适用于哪些型号？']
const askScope = computed(() => {
  const scope = libraries.value.find(lib => lib.id === askLibraryId.value)?.name || '全部资料'
  const tagNames = tags.value.filter(tag => askTagIds.value.includes(tag.id)).map(tag => tag.name)
  return tagNames.length ? `${scope} · ${tagNames.join('、')}` : scope
})
const askEvidenceMessage = computed(() => askMessages.value.find(m => m.id === askEvidenceFor.value && m.role === 'assistant')
  || [...askMessages.value].reverse().find(m => m.role === 'assistant' && m.sources.length) || null)
const askId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
function toggleAskTag(tag: Tag) { askTagIds.value = askTagIds.value.includes(tag.id) ? askTagIds.value.filter(id => id !== tag.id) : [...askTagIds.value, tag.id] }
function answerHtml(msg: AskMessage) { return renderAnswer(msg.content, msg.sources.length) }
function scrollAsk() { if (!askPinned.value) return; void nextTick(() => { const el = askScroll.value; if (el) el.scrollTop = el.scrollHeight }) }
function onAskScroll() { const el = askScroll.value; if (el) askPinned.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }
function growAskInput() { const el = askInputEl.value; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px' }
function focusAskInput() { void nextTick(() => askInputEl.value?.focus()) }
function enrichSources(hits: AskSource[]): AskSource[] {
  return hits.map(hit => ({ ...hit, document_name: hit.document_name || library.value.find(e => e.id === hit.document_id)?.name || documents.value.find(d => d.id === hit.document_id)?.name }))
}
async function streamAnswer(live: AskMessage, question: string) {
  askBusy.value = true; askPinned.value = true
  askController = new AbortController()
  const index = askMessages.value.findIndex(m => m.id === live.id)
  const history = askMessages.value.slice(0, index).filter(m => m.status === 'done' && m.content.trim()).slice(-6).map(m => ({ role: m.role, content: m.content.slice(0, 1500) }))
  scrollAsk()
  try {
    const result = await api.askKnowledge({ question, library_id: askLibraryId.value || undefined, tag_ids: askTagIds.value, history }, {
      onSources: hits => { live.sources = enrichSources(hits); scrollAsk() },
      onDelta: answer => { live.content = answer; scrollAsk() },
    }, askController.signal)
    live.content = result.answer
    live.model = result.model
    live.sources = enrichSources(result.sources)
    live.status = result.noEvidence ? 'no_evidence' : 'done'
  } catch (error) {
    if (askController?.signal.aborted) live.status = 'stopped'
    else { live.status = 'error'; live.error = error instanceof Error ? error.message : '回答失败，请重试' }
  } finally { askBusy.value = false; askController = null; scrollAsk(); focusAskInput() }
}
async function sendQuestion(raw?: string) {
  const question = (raw ?? askInput.value).trim()
  if (!question || askBusy.value) return
  askInput.value = ''
  growAskInput()
  askMessages.value.push({ id: askId(), role: 'user', content: question, status: 'done', sources: [] })
  askMessages.value.push({ id: askId(), role: 'assistant', content: '', status: 'streaming', sources: [], question, scope: askScope.value })
  const live = askMessages.value[askMessages.value.length - 1]!
  askEvidenceFor.value = live.id; askCiteActive.value = 0
  await streamAnswer(live, question)
}
async function retryAnswer(msg: AskMessage) {
  if (askBusy.value || !msg.question) return
  const live = askMessages.value.find(m => m.id === msg.id)
  if (!live) return
  live.content = ''; live.error = ''; live.sources = []; live.status = 'streaming'
  askEvidenceFor.value = live.id; askCiteActive.value = 0
  await streamAnswer(live, msg.question)
}
function stopAsk() { askController?.abort() }
function clearAsk() { if (askBusy.value) return; askMessages.value = []; askEvidenceFor.value = ''; askCiteActive.value = 0; expandedSource.value = ''; focusAskInput() }
// 切换测试知识库时清空对话，避免把上一个知识库的上下文带入当前测试。
watch(askLibraryId, () => clearAsk())
function showEvidence(msg: AskMessage) { askEvidenceFor.value = msg.id; askCiteActive.value = 0 }
function selectCitation(event: Event, msg: AskMessage) {
  const target = (event.target as HTMLElement).closest?.('.dp-cite') as HTMLElement | null
  if (!target) return
  event.preventDefault()
  const n = Number(target.dataset.cite)
  if (!n) return
  askEvidenceFor.value = msg.id; askCiteActive.value = n
  void nextTick(() => document.getElementById(`dp-source-${msg.id}-${n}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
}
async function copyAnswer(msg: AskMessage) {
  try { await navigator.clipboard.writeText(msg.content); notify('回答已复制', 'success') }
  catch { notify('复制失败，请手动选择文本复制', 'error') }
}

// ── 用户自定义标签（维度轴固定，取值由用户创建；建议按用户标签动态匹配）──
const tags = ref<Tag[]>([]), selectedTagIds = ref<string[]>([]), suggestions = ref<TagSuggestion[]>([])
const newTagName = ref(''), newTagDimension = ref<'domain' | 'category' | 'custom'>('category'), tagBusy = ref(false)
const searchTagIds = ref<string[]>([])
const TAG_DIMENSIONS: { key: 'domain' | 'category' | 'custom'; label: string }[] = [
  { key: 'domain', label: '业务板块' }, { key: 'category', label: '资料类型' }, { key: 'custom', label: '补充标签' },
]
const tagGroups = computed(() => TAG_DIMENSIONS.map(dim => ({ ...dim, tags: tags.value.filter(tag => tag.dimension === dim.key) })))
const selectedCategoryName = computed(() => tags.value.find(tag =>
  tag.dimension === 'category' && selectedTagIds.value.includes(tag.id))?.name || '')
const selectedSearchTags = computed(() => tags.value.filter(tag => searchTagIds.value.includes(tag.id)))
async function loadTags() {
  try { tags.value = (await api.listTags()).tags }
  catch (error) { errors.value = [error instanceof Error ? error.message : '加载标签失败'] }
}
async function addTag() {
  const name = newTagName.value.trim()
  if (!name || tagBusy.value) return
  tagBusy.value = true
  try {
    const tag = await api.createTag(name, newTagDimension.value)
    await loadTags()
    if (!selectedTagIds.value.includes(tag.id)) toggleTag(tag)
    newTagName.value = ''
    notify(`已添加标签「${name}」`)
  } catch (error) { errors.value = [error instanceof Error ? error.message : '创建标签失败'] }
  finally { tagBusy.value = false }
}
function toggleTag(tag: Tag) {
  if (selectedTagIds.value.includes(tag.id)) {
    selectedTagIds.value = selectedTagIds.value.filter(id => id !== tag.id)
    return
  }
  if (tag.dimension === 'category') {
    const otherCategories = selectedTagIds.value.filter(id => tags.value.find(item => item.id === id)?.dimension !== 'category')
    selectedTagIds.value = [...otherCategories, tag.id]
  } else {
    selectedTagIds.value = [...selectedTagIds.value, tag.id]
  }
}
async function loadSuggestions() {
  const doc = activeDoc.value
  if (!doc?.parseJobId) { suggestions.value = []; return }
  try { suggestions.value = (await api.tagSuggestions(doc.id)).suggestions }
  catch { suggestions.value = [] }
}
function applySuggestion(suggestion: TagSuggestion) {
  const tag = tags.value.find(item => item.id === suggestion.id)
  if (tag && !selectedTagIds.value.includes(tag.id)) toggleTag(tag)
}
function toggleSearchTag(tag: Tag) {
  searchTagIds.value = searchTagIds.value.includes(tag.id)
    ? searchTagIds.value.filter(id => id !== tag.id)
    : [...searchTagIds.value, tag.id]
  searchResults.value = []; searchedOnce.value = false
}
/** 把服务端分块的 origin 拼成一行可读来源（页码 / 章节 / 步骤 / 问题 / 条款 / 工作表）。 */
function originMeta(origin?: Record<string, unknown>) {
  if (!origin) return ''
  const parts: string[] = []
  if (origin.question) parts.push(`问题：${origin.question}`)
  if (origin.page) parts.push(`第 ${origin.page} 页`)
  const heading = origin.heading_path
  if (Array.isArray(heading) && heading.length) parts.push(heading.join(' / '))
  if (origin.step_range) parts.push(`步骤 ${origin.step_range}`)
  if (origin.clause) parts.push(String(origin.clause))
  if (origin.sheet) parts.push(`工作表：${origin.sheet}${origin.row ? ` · 第 ${origin.row} 行` : ''}`)
  return parts.join(' · ')
}
async function loadLibraries() {
  try { libraries.value = (await api.listLibraries()).libraries }
  catch (error) { errors.value = [error instanceof Error ? error.message : '加载知识库失败'] }
}
async function addLibrary() {
  const name = newLibraryName.value.trim()
  if (!name || libraryBusy.value) return
  libraryBusy.value = true
  try {
    await api.createLibrary(name)
    await loadLibraries()
    targetName.value = name; newLibraryName.value = ''; showNewLibrary.value = false; showLibraryDialog.value = false
    notify(`已创建知识库「${name}」`)
  } catch (error) { errors.value = [error instanceof Error ? error.message : '创建知识库失败'] }
  finally { libraryBusy.value = false }
}
function openLibrary(lib: LibrarySummary) {
  libraryFilter.value = lib.id
}
async function confirmDeleteSelectedLibrary() {
  if (!libraryFilter.value || libraryBusy.value) return
  libraryBusy.value = true
  try { removingLibrary.value = await api.libraryDetail(libraryFilter.value) }
  catch (error) { notify(error instanceof Error ? error.message : '加载知识库信息失败', 'error') }
  finally { libraryBusy.value = false }
}
async function deleteLibrary() {
  const detail = removingLibrary.value
  if (!detail) return
  libraryBusy.value = true
  try {
    const result = await api.deleteLibrary(detail.id)
    removingLibrary.value = null; libraryFilter.value = ''
    await Promise.all([loadLibraries(), refreshServer(false)])
    notify(`知识库已删除，${result.affected_documents} 份资料保留并解除关联`)
  } catch (error) { errors.value = [error instanceof Error ? error.message : '删除知识库失败'] }
  finally { libraryBusy.value = false }
}
const activeDoc = computed(() => documents.value.find(doc => doc.id === selectedId.value) || documents.value[0])
const validation = computed(() => configError(config))
const allChunks = computed(() => documents.value.flatMap(doc => serverChunks.value[doc.id] || createChunks(doc, config)))
const totalChars = computed(() => documents.value.reduce((sum, doc) => sum + Array.from(cleanText(doc.text, config)).length, 0))
const ready = computed(() => documents.value.length > 0 && documents.value.every(doc => doc.serverStatus === 'done' && (doc.text.trim() || doc.images?.length)))
const visibleLibrary = computed(() => library.value.filter(e => (!libraryFilter.value || e.libraryId === libraryFilter.value) && `${e.name} ${e.target} ${e.category}`.toLowerCase().includes(search.value.toLowerCase())))
const totalStored = computed(() => library.value.reduce((n, e) => n + e.chunks.length, 0))
const heading = computed(() => section.value === 'library' ? '我的知识库' : section.value === 'tasks' ? '处理记录' : section.value === 'ask' ? '知识问答' : '导入数据')
const stepNames = ['添加数据', '确认并入库']
watch(config, () => { serverChunks.value = {} }, { deep: true })
function notify(message: string, type: FeedbackMessageType | 'error' = 'info') {
  if (type === 'error') showErrorDialog(message)
  else showMessage(message, type)
}
function selectDoc(id: string) { selectedId.value = id; if (step.value === 2) void loadSuggestions() }
async function openFullPreview(doc: SourceDocument | undefined = activeDoc.value) {
  if (!doc || doc.serverStatus !== 'done' || parsing.value || running.value || openingPreview.value) return
  openingPreview.value = true
  try {
    const profile = await api.contentProfile(doc.id)
    if (!profile.confirmed_type) { typeConfirmQueue.value = [doc]; return }
    confirmedContentTypes.value[doc.id] = profile.confirmed_type
  try {
    sessionStorage.setItem('data-platform-preview-draft', JSON.stringify({
      selectedId: doc.id, step: step.value, config: { ...config },
      targetName: targetName.value, description: description.value, selectedTagIds: selectedTagIds.value,
    }))
  } catch { /* Return still restores the document from the server. */ }
  await router.push({ name: 'DataPlatformPreview', params: { docId: doc.id }, query: { step: String(step.value) } })
  } catch (cause) { notify(cause instanceof Error ? cause.message : '预览打开失败，请重试', 'error') }
  finally { openingPreview.value = false }
}
function navigate(to: 'import' | 'library' | 'tasks' | 'ask') { section.value = to; search.value = ''; if (to !== 'import') void refreshServer(false) }
function removeImported(id: string) {
  const doc = documents.value.find(item => item.id === id)
  if (doc?.url) URL.revokeObjectURL(doc.url)
  documents.value = documents.value.filter(item => item.id !== id)
  delete serverChunks.value[id]
  delete confirmedContentTypes.value[id]
  typeConfirmQueue.value = typeConfirmQueue.value.filter(item => item.id !== id)
  if (selectedId.value === id) selectedId.value = documents.value[0]?.id || ''
}
function chunksFor(result: ProcessResult, doc: { id: string; name: string }): Chunk[] { return result.chunks.map(c => ({ ...c, sourceId: doc.id, sourceName: doc.name })) }
function entryFor(result: ProcessResult, doc: ServerDocument): LibraryEntry {
  return { id: doc.id, name: doc.name, kind: doc.kind.toUpperCase(), chars: result.text_chars, chunks: chunksFor(result, doc), at: formatDate(doc.created_at),
    target: result.options.library_name, libraryId: doc.library_id || '', category: doc.category, tags: doc.tags || [], description: doc.description, config: { ...defaultConfig, ...result.options, model: result.embedding_model }, sample: false, version: doc.process_job_id }
}
async function refreshServer(restore = false) {
  if (syncing.value || disposed) return
  syncing.value = true
  try {
    const [{ jobs }, docs] = await Promise.all([api.request<{ jobs: ServerJob[] }>('/jobs?limit=200'), api.allDocuments()])
    if (disposed) return
    tasks.value = jobs
    const entries: LibraryEntry[] = []
    for (const doc of docs.filter(item => item.status === 'indexed')) removeImported(doc.id)
    for (const doc of docs) {
      if (doc.status === 'indexed' && doc.process_job_id) {
        const existing = library.value.find(e => e.id === doc.id)
        entries.push(existing?.version === doc.process_job_id ? existing : entryFor(await api.request<ProcessResult>(`/jobs/${doc.process_job_id}/result`), doc))
      } else if (restore && doc.parse_job_id) {
        const existing = documents.value.find(d => d.id === doc.id), status = jobs.find(j => j.id === doc.parse_job_id)?.status || doc.status
        if (existing?.serverStatus === status) continue
        try { const parsed = api.toSource(await api.preview(doc.id)); if (existing) Object.assign(existing, parsed); else documents.value.push(parsed) }
        catch { if (existing) existing.serverStatus = status; else documents.value.push({ id: doc.id, name: doc.name, kind: doc.kind.toUpperCase(), size: doc.size, text: '', parser: 'server', parseJobId: doc.parse_job_id, serverStatus: status, issue: '请在处理记录中查看状态，失败后可重试。' }) }
      }
    }
    if (!disposed) library.value = entries
  } catch (error) { if (!disposed) errors.value = [error instanceof Error ? error.message : '加载资料失败'] }
  finally { syncing.value = false }
}
async function parseUploaded(doc: SourceDocument, job: ServerJob, signal: AbortSignal) {
  activeJob = job.id
  const result = await api.waitJob(job.id, j => { parseProgress.value = j.progress; uploadStage.value = `${doc.name} · ${j.stage} ${j.progress}%`; doc.serverStatus = j.status }, signal)
  if (result.status === 'done' || result.status === 'partial') {
    const parsed = api.toSource(await api.preview(doc.id, signal))
    Object.assign(doc, parsed)
    if (result.status === 'partial') errors.value.push(`${doc.name}：部分内容解析失败，请重试后再入库`)
  } else { doc.issue = result.error || '解析已取消，可在处理记录中重试'; errors.value.push(`${doc.name}：${doc.issue}`) }
  activeJob = ''
}
async function addFiles(files: FileList | File[] | null) {
  if (!files || parsing.value || running.value) return
  const queue = Array.from(files)
  if (documents.value.length + queue.length > 20) { notify('每批最多添加 20 份资料', 'warning'); return }
  parsing.value = true; errors.value = []; controller = new AbortController()
  const completed: SourceDocument[] = []
  try {
    for (const file of queue) {
      if (controller.signal.aborted) break
      try {
        if (documents.value.some(d => d.name === file.name && d.size === file.size)) { notify('同名同大小资料已在列表中'); continue }
        parseProgress.value = null
        const result = await api.upload(file, stage => { uploadStage.value = stage }, controller.signal)
        const doc: SourceDocument = { id: result.document.id, name: result.document.name, kind: result.document.kind.toUpperCase(), size: file.size, text: '', parser: 'server', parseJobId: result.job.id, serverStatus: result.job.status }
        documents.value.push(doc); selectDoc(doc.id); saved.value = false
        // Work on Vue's proxy so live parse status remains reactive.
        await parseUploaded(documents.value[documents.value.length - 1]!, result.job, controller.signal)
        const finished = documents.value[documents.value.length - 1]!
        if (finished.serverStatus === 'done') completed.push(finished)
      } catch (error) { if (!controller.signal.aborted) errors.value.push(error instanceof Error ? error.message : '上传解析失败') }
    }
  } finally { parsing.value = false; activeJob = ''; if (fileInput.value) fileInput.value.value = ''; void refreshServer(false)
    if (!controller.signal.aborted && completed.length) typeConfirmQueue.value = completed
  }
}
function handleDrop(event: DragEvent) { dragging.value = false; void addFiles(event.dataTransfer?.files || null) }
async function addText() {
  if (!textTitle.value.trim() || !textContent.value.trim()) return
  const count = documents.value.length
  await addFiles([new File([textContent.value], textTitle.value.trim().replace(/[\\/:*?"<>|]/g, '_') + '.md', { type: 'text/markdown' })])
  if (documents.value.length > count) { textTitle.value = ''; textContent.value = '' }
}
async function loadSample() { const doc = sampleDocuments()[0]!; await addFiles([new File([doc.text], doc.name + '.md', { type: 'text/markdown' })]) }
async function removeDoc(id: string) {
  try { await api.request(`/documents/${id}`, { method: 'DELETE' }); const doc = documents.value.find(d => d.id === id); if (doc?.url) URL.revokeObjectURL(doc.url); documents.value = documents.value.filter(d => d.id !== id); await refreshServer(false) }
  catch (error) { notify(error instanceof Error ? error.message : '移除失败', 'error') }
}
async function deleteEntry() { if (!removing.value) return; const id = removing.value; await removeDoc(id); removing.value = null }
function goStep(next: number) {
  if (parsing.value || running.value || saved.value) return
  if (next > 1 && !ready.value) { notify('请先完成资料解析，失败或部分失败时可在处理记录中重试', 'warning'); return }
  if (next > 1 && validation.value) { notify(validation.value, 'warning'); return }
  if (next > 1 && !contentTypesReady.value) { notify('请先确认每份资料的内容类型', 'warning'); return }
  if (next > 1 && sourceTab.value === 'text' && textContent.value.trim()) { notify('请先添加正在编辑的文本', 'warning'); return }
  step.value = next
  if (next === 2) void loadSuggestions()
}
async function beginProcess() {
  if (!contentTypesReady.value) { notify('请先确认每份资料的内容类型', 'warning'); return }
  if (!ready.value || validation.value || !targetName.value.trim() || running.value || saved.value) return
  running.value = true; controller = new AbortController(); jobProgress.value = 0; errors.value = []
  const batch = documents.value.slice(), options = { titleIndex: config.titleIndex, autoIndex: config.autoIndex, imageIndex: config.imageIndex, library_name: targetName.value.trim(), description: description.value }
  let completed = 0, completedChunks = 0
  try {
    for (const doc of batch) {
      const job = await api.post<ServerJob>(`/documents/${doc.id}/process`, options, controller.signal)
      activeJob = job.id
      if (['failed', 'cancelled', 'partial'].includes(job.status)) await api.post(`/jobs/${job.id}/retry`, {}, controller.signal)
      const result = await api.waitJob(job.id, j => { jobStage.value = `${doc.name} · ${j.stage}`; jobProgress.value = Math.round((completed * 100 + j.progress) / batch.length) }, controller.signal)
      if (result.status !== 'done') throw new Error(`${doc.name}：${result.error || '任务已取消'}`)
      // The job is committed at done even if fetching its details subsequently fails.
      removeImported(doc.id)
      completed++; activeJob = ''
      const processed = await api.request<ProcessResult>(`/jobs/${job.id}/result`, {}, controller.signal)
      completedChunks += processed.chunks.length
    }
    savedStats.value = { documents: completed, chunks: completedChunks }; saved.value = true; jobProgress.value = 100; notify('资料已写入知识库', 'success')
  } catch (error) { if (!controller.signal.aborted) errors.value.push(error instanceof Error ? error.message : '入库失败，可在处理记录中重试') }
  finally { running.value = false; activeJob = ''; void refreshServer(false) }
}
async function cancelProcess() {
  if (running.value && !activeJob) { notify('正在提交入库任务，收到任务编号后即可取消'); return }
  try { if (activeJob) {
    const result = await api.post<ServerJob>(`/jobs/${activeJob}/cancel`)
    const doc = documents.value.find(d => d.parseJobId === result.id)
    if (doc) doc.serverStatus = result.status
  } }
  catch (error) { notify(error instanceof Error ? error.message : '取消请求失败，任务可能仍在后台运行', 'error'); return }
  controller.abort(); notify('已停止当前操作，已完成入库的资料会保留')
}
async function retryTask(task: ServerJob) {
  if (running.value || parsing.value) return
  try {
    controller = new AbortController(); parsing.value = true
    const job = await api.post<ServerJob>(`/jobs/${task.id}/retry`)
    activeJob = job.id
    const result = await api.waitJob(job.id, j => { uploadStage.value = j.stage; tasks.value = tasks.value.map(t => t.id === j.id ? j : t) }, controller.signal)
    if (result.status !== 'done') notify(result.error || '部分内容未完成，请查看任务状态', 'error')
    const doc = documents.value.find(d => d.id === job.document_id)
    if (doc && job.kind === 'parse' && ['done', 'partial'].includes(result.status)) Object.assign(doc, api.toSource(await api.preview(doc.id)))
    await refreshServer(false)
  } catch (error) { if (!controller.signal.aborted) notify(error instanceof Error ? error.message : '重试失败', 'error') }
  finally { parsing.value = false; activeJob = '' }
}
function newImport() { documents.value = []; selectedId.value = ''; saved.value = false; savedStats.value = { documents: 0, chunks: 0 }; step.value = 1; section.value = 'import'; errors.value = []; serverChunks.value = {} }
function exportData(entry?: LibraryEntry) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(entry || { target: targetName.value, config: { ...config }, chunks: allChunks.value, preview: !saved.value }, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = `${entry?.name || '数据处理预览'}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const statusText = (status: string) => ({ done: '已完成', queued: '等待处理', running: '处理中', failed: '处理失败', partial: '部分失败', cancelled: '已取消' }[status] || status)
onMounted(() => {
  void api.request<{ max_file_bytes: number; max_office_bytes: number; embedding_model: string }>('/capabilities').then(c => {
    uploadLimits.value = `PDF 最大 ${documentSize(c.max_file_bytes)}，其他格式最大 ${documentSize(Math.min(c.max_file_bytes, c.max_office_bytes))}`
    config.model = c.embedding_model
  }).catch(() => { /* The primary load reports unavailable service or authentication. */ })
  void loadLibraries()
  void loadTags()
  void refreshServer(true).then(async () => {
    await Promise.all(documents.value.filter(item => item.serverStatus === 'done').map(async item => {
      try {
        const profile = await api.contentProfile(item.id)
        if (!disposed && profile.confirmed_type) confirmedContentTypes.value[item.id] = profile.confirmed_type
      } catch { /* The preview entry can retry the profile request. */ }
    }))
    let draft: { selectedId?: string; step?: number; config?: Partial<ProcessingConfig>; targetName?: string; description?: string; selectedTagIds?: string[] } | null = null
    try { draft = JSON.parse(sessionStorage.getItem('data-platform-preview-draft') || 'null') } catch { /* Ignore a stale draft. */ }
    const doc = typeof route.query.previewDoc === 'string' ? route.query.previewDoc : draft?.selectedId || ''
    // A preview draft can outlive an import; never re-add an indexed document.
    if (doc && !documents.value.some(item => item.id === doc) && !library.value.some(item => item.id === doc)) {
      try {
        const current = (await api.allDocuments()).find(item => item.id === doc)
        if (current && current.status !== 'indexed') documents.value.push(api.toSource(await api.preview(doc)))
      } catch { /* Return can still open the workspace. */ }
    }
    if (doc && documents.value.some(item => item.id === doc)) {
      if (draft?.selectedId === doc) {
        Object.assign(config, draft.config || {})
        targetName.value = draft.targetName || targetName.value
        description.value = draft.description || ''
        selectedTagIds.value = Array.isArray(draft.selectedTagIds) ? draft.selectedTagIds : []
      }
      try { sessionStorage.removeItem('data-platform-preview-draft') } catch { /* Optional session storage. */ }
      selectDoc(doc)
      const resumedStep = route.query.previewStep || draft?.step
      if (resumedStep === '2' || resumedStep === '3' || resumedStep === 2 || resumedStep === 3) {
        step.value = 2 // 兼容旧三步流程的预览返回链接
        if (step.value === 2) void loadSuggestions()
      }
    }
  }); refreshTimer = setInterval(() => { if (!running.value && !parsing.value && tasks.value.some(t => ['queued', 'running'].includes(t.status))) void refreshServer(true) }, 6000)
})
onBeforeUnmount(() => { disposed = true; controller.abort(); askController?.abort(); clearInterval(refreshTimer) })
</script>


<template>
  <div class="dp-shell">
    <div v-if="showLibraryDialog" class="dp-overlay" @click.self="showLibraryDialog = false" @keydown.esc="showLibraryDialog = false"><section class="dp-modal dp-create-library" role="dialog" aria-modal="true" aria-labelledby="create-library-title"><button type="button" class="dp-icon-button dp-create-close" aria-label="关闭" :disabled="libraryBusy" @click="showLibraryDialog = false">×</button><span class="dp-eyebrow">NEW KNOWLEDGE BASE</span><h2 id="create-library-title">新增知识库</h2><p>为资料建立一个清晰的存放位置。</p><form @submit.prevent="addLibrary"><label for="library-dialog-name">知识库名称</label><input id="library-dialog-name" v-model="newLibraryName" maxlength="120" placeholder="例如：产品说明书" :disabled="libraryBusy" required /><div class="dp-create-actions"><button type="button" class="dp-button dp-secondary" :disabled="libraryBusy" @click="showLibraryDialog = false">取消</button><button type="submit" class="dp-button dp-primary" :disabled="libraryBusy || !newLibraryName.trim()">{{ libraryBusy ? '创建中…' : '创建知识库' }}</button></div></form></section></div>
    <ContentTypeDialog v-if="typeConfirmDoc" :key="typeConfirmDoc.id" :doc-id="typeConfirmDoc.id" :name="typeConfirmDoc.name" :remaining="typeConfirmQueue.length" @close="typeConfirmQueue = []" @saved="typeSaved" />
    <div v-if="openingPreview" class="dp-preview-opening" role="status"><div><span>正在打开完整预览…</span><progress aria-label="正在打开预览"></progress></div></div>
    <aside class="dp-sidebar">
      <a class="dp-brand" href="/ai/pdf_agent/data-platform" @click.prevent="navigate('import')"><span class="dp-brand-mark"><DataIcon name="database" :size="23" /></span><span>WMS<span class="dp-brand-en">DataWorkspace</span></span></a>
      <div class="dp-workspace"><span class="dp-workspace-avatar">个</span><span>个人工作空间<small>Personal workspace</small></span><span class="dp-workspace-dot"></span></div>
      <div class="dp-nav-caption">工作台</div>
      <nav class="dp-nav" aria-label="数据中台导航">
        <button :class="{ active: section === 'ask' }" @click="navigate('ask')"><DataIcon name="chat" />知识问答</button>
        <button :class="{ active: section === 'library' }" @click="navigate('library')"><DataIcon name="database" />我的知识库<span class="dp-nav-count">{{ library.length }}</span></button>
        <button :class="{ active: section === 'import' }" @click="navigate('import')"><DataIcon name="upload" />导入数据</button>
        <button :class="{ active: section === 'tasks' }" @click="navigate('tasks')"><DataIcon name="clock" />处理记录<span v-if="tasks.length" class="dp-nav-count">{{ tasks.length }}</span></button>
      </nav>
      <div class="dp-sidebar-bottom"><button class="dp-help-link" @click="showHelp = true"><DataIcon name="help" :size="18" />使用指南<DataIcon name="chevron" :size="15" /></button><button class="dp-return" @click="router.push('/ai/pdf_agent')"><DataIcon name="back" :size="16" />返回 PDF 工作台</button><div class="dp-user"><span>U</span><div>当前用户<small>个人空间</small></div><button class="dp-icon-button" :aria-label="theme.isDark ? '切换浅色模式' : '切换深色模式'" @click="theme.toggleTheme()"><DataIcon :name="theme.isDark ? 'sun' : 'moon'" :size="18" /></button></div></div>
    </aside>

    <div class="dp-main">
      <header class="dp-topbar"><div class="dp-breadcrumb">工作空间<DataIcon name="chevron" :size="13" /><strong>{{ heading }}</strong></div><div class="dp-topbar-right"><span class="dp-topbar-hint">让每一份资料，成为可用的知识</span><button class="dp-icon-button" aria-label="打开使用指南" @click="showHelp = true"><DataIcon name="help" :size="19" /></button></div></header>
      <main class="dp-content">
        <div v-if="errors.length && section !== 'import'" class="dp-errors dp-server-errors" role="alert"><p v-for="error in errors" :key="error">{{ error }}</p></div><div class="dp-page-heading"><div><h1>{{ section === 'import' ? '把资料，变成知识。' : heading }}</h1><p>{{ section === 'import' ? '汇集文档、表格与灵感，为你的知识库添加新的内容。' : section === 'library' ? '在一个地方管理资料，查看每一份知识的来源与分块。' : section === 'ask' ? '基于已入库资料提问，回答附来源引用，可逐条核对。' : '每一次处理都有迹可循，从原始资料到知识索引。' }}</p></div><button v-if="section === 'import'" class="dp-button dp-secondary" @click="showHelp = true"><DataIcon name="help" :size="16" />导入指南</button></div>

        <div v-if="section === 'library' || section === 'tasks'" class="dp-stats"><div><span class="dp-stat-icon"><DataIcon name="file" /></span><div><small>知识文档</small><strong>{{ library.length }}<em>份</em></strong></div><span class="dp-stat-foot">当前会话</span></div><div><span class="dp-stat-icon"><DataIcon name="layers" /></span><div><small>知识分块</small><strong>{{ totalStored }}<em>块</em></strong></div><span class="dp-stat-foot">可查看与导出</span></div><div><span class="dp-stat-icon"><DataIcon name="spark" /></span><div><small>索引模式</small><strong class="dp-stat-label">语义检索</strong></div><span class="dp-stat-foot"><span class="dp-status-dot"></span>索引配置</span></div></div>

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
                  <span>{{ name }}<small>{{ ['上传文件或输入文本', '选择知识库与处理方式'][index] }}</small></span>
                </button>
              </li>
            </ol>
          </nav>

          <div v-if="saved" class="dp-success"><span class="dp-success-icon"><DataIcon name="check" :size="28" /></span><div><h2>资料整理完成</h2><p>{{ savedStats.documents }} 份资料 · {{ savedStats.chunks }} 个分块，已完成向量化并写入「{{ targetName }}」。</p></div><button class="dp-button dp-secondary" @click="newImport">继续添加</button><button class="dp-button dp-primary" @click="navigate('library')">查看知识库<DataIcon name="arrow" :size="17" /></button></div>
          <div v-else class="dp-editor-grid dp-editor-single">
            <div class="dp-editor-left">
              <section v-if="step === 1" class="dp-panel">
                <div class="dp-panel-heading"><div><h2>添加你的资料</h2><p>从本地文件开始，或直接记录一段知识。</p></div><span class="dp-section-number">01</span></div>
                <div class="dp-source-tabs" role="tablist" aria-label="资料来源"><button role="tab" :aria-selected="sourceTab === 'file'" :class="{ active: sourceTab === 'file' }" @click="sourceTab = 'file'"><DataIcon name="file" :size="17" />本地文件</button><button role="tab" :aria-selected="sourceTab === 'text'" :class="{ active: sourceTab === 'text' }" @click="sourceTab = 'text'"><DataIcon name="text" :size="17" />自定义文本</button></div>
                <div v-if="sourceTab === 'file'" class="dp-upload-area" :class="{ dragging, busy: parsing }" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="handleDrop">
                  <div class="dp-upload-illustration"><div class="dp-paper-back"></div><div class="dp-paper"><DataIcon name="file" :size="32" /><span></span><span></span></div><span class="dp-upload-bubble"><DataIcon name="upload" :size="18" /></span></div>
                  <h3>{{ parsing ? '正在上传与解析…' : '拖拽文件到这里' }}</h3><p>支持批量添加，把零散信息汇集起来</p><button class="dp-button dp-primary" :disabled="parsing" @click="fileInput?.click()"><DataIcon name="plus" :size="16" />选择本地文件</button><div class="dp-file-formats"><span>PDF</span><span>TXT</span><span>DOCX</span><span>MD</span><span>Excel / CSV</span></div><small>支持分片上传和中断续传，每批最多 20 份；{{ uploadLimits }}</small>
                  <input ref="fileInput" type="file" accept=".pdf,.txt,.md,.docx,.xlsx,.xlsm,.xltx,.xltm,.xls,.xlsb,.ods,.csv,.tsv" multiple hidden @change="addFiles(($event.target as HTMLInputElement).files)" />
                </div>
                <div v-else class="dp-text-form"><label for="text-title">文本标题<span>*</span></label><input id="text-title" v-model="textTitle" placeholder="例如：产品常见问题与补充说明" maxlength="120" /><label for="text-content">正文内容<span>*</span></label><textarea id="text-content" v-model="textContent" rows="9" placeholder="粘贴知识内容、业务规则或补充信息…&#10;&#10;支持使用 Markdown 标题组织段落。" maxlength="200000"></textarea><div class="dp-text-form-footer"><small>{{ textContent.length.toLocaleString() }} / 200,000 字符</small><button class="dp-button dp-primary" :disabled="!textTitle.trim() || !textContent.trim()" @click="addText"><DataIcon name="plus" :size="16" />添加到资料列表</button></div></div>
                <div class="dp-sample-row"><span class="dp-sample-icon"><DataIcon name="spark" :size="18" /></span><div><strong>还没有准备好资料？</strong><small>用一份产品指南，体验完整处理流程</small></div><button @click="loadSample">试试示例<DataIcon name="arrow" :size="16" /></button></div>
                <div v-if="parsing" class="dp-upload-progress" role="status"><div><p>{{ uploadStage }}</p><button class="dp-plain-link" @click="cancelProcess">停止等待</button></div><progress :value="parseProgress ?? undefined" max="100" aria-label="文件上传与解析进度"></progress></div><div v-if="errors.length" class="dp-errors" role="alert"><p v-for="error in errors" :key="error">{{ error }}</p></div>
                <div class="dp-file-list-heading"><h3>资料列表<span>{{ documents.length }}</span></h3><small>解析完成后可打开完整预览</small></div>
                <div v-if="!documents.length" class="dp-empty-list"><DataIcon name="file" :size="19" />还没有添加资料，准备好就开始吧。</div>
                <div v-for="doc in documents" :key="doc.id" class="dp-file-row" :class="{ selected: activeDoc?.id === doc.id }"><button class="dp-file-select" @click="selectDoc(doc.id)"><span class="dp-file-badge" :class="{ green: ['XLSX','XLS','CSV'].includes(doc.kind) }">{{ doc.kind }}</span><span class="dp-file-meta"><strong>{{ doc.name }}</strong><small>{{ documentSize(doc.size) }}<span>·</span>{{ statusText(doc.serverStatus || '') }}</small></span></button><button v-if="doc.serverStatus === 'done'" type="button" class="dp-preview-link" :aria-label="`查看 ${doc.name} 的完整预览`" @click="openFullPreview(doc)">完整预览 ↗</button><button class="dp-icon-button" :aria-label="`移除 ${doc.name}`" :disabled="parsing" @click="removeDoc(doc.id)"><DataIcon name="close" :size="16" /></button></div>
              </section>

              <section v-if="step === 2" class="dp-panel"><div class="dp-panel-heading"><div><h2>确认入库信息</h2><p>确认目标知识库和处理选项。</p></div><span class="dp-section-number">02</span></div><label for="kb-name">目标知识库<span class="dp-required">*</span></label><div class="dp-kb-row"><select id="kb-name" v-model="targetName" :disabled="running || libraryBusy"><option v-for="lib in libraries" :key="lib.id" :value="lib.name">{{ lib.name }}（{{ lib.document_count }} 份）</option><option v-if="!libraries.some(lib => lib.name === targetName)" :value="targetName">{{ targetName }}</option></select><button type="button" class="dp-button dp-secondary" :disabled="running || libraryBusy" @click="showNewLibrary = !showNewLibrary">{{ showNewLibrary ? '取消新建' : '新建知识库' }}</button></div><div v-if="showNewLibrary" class="dp-kb-row"><input v-model="newLibraryName" :disabled="running || libraryBusy" maxlength="120" placeholder="新知识库名称，例如：安装说明书库" aria-label="新知识库名称" @keyup.enter="addLibrary" /><button type="button" class="dp-button dp-primary" :disabled="running || libraryBusy || !newLibraryName.trim()" @click="addLibrary">创建</button></div><label for="kb-description">补充说明 <small>选填</small></label><textarea id="kb-description" v-model="description" :disabled="running" rows="3" maxlength="500" placeholder="补充这批资料的用途、适用范围或版本信息…"></textarea><div class="dp-config-summary dp-confirm-options"><h3>处理方式</h3><p class="dp-confirm-hint">处理时将按以下选项执行</p><label class="dp-switch-line"><span><strong>带上文档标题</strong><small>在每段内容中标明文档来源</small></span><input v-model="config.titleIndex" :disabled="running" type="checkbox" role="switch" /><i></i></label><label class="dp-switch-line"><span><strong>提取内容摘要</strong><small>为每段内容生成简洁摘要</small></span><input v-model="config.autoIndex" :disabled="running" type="checkbox" role="switch" /><i></i></label><label class="dp-switch-line"><span><strong>识别图片内容</strong><small>分析有效配图并生成文字说明</small></span><input v-model="config.imageIndex" :disabled="running" type="checkbox" role="switch" /><i></i></label></div><div class="dp-notice"><DataIcon name="info" :size="17" /><p>入库前可在完整预览页检查预计分块；入库时按所选项识别图片、生成摘要并向量化。</p></div></section>
              <div v-if="step > 1 && activeDoc?.serverStatus === 'done'" class="dp-preview-jump">
                <div><h3>查看完整数据预览</h3><p>在独立页面查看解析内容、图片和分块统计。</p></div>
                <select v-if="documents.length > 1" :value="activeDoc.id" aria-label="选择要预览的资料" @change="selectDoc(($event.target as HTMLSelectElement).value)"><option v-for="doc in documents" :key="doc.id" :value="doc.id">{{ doc.name }}</option></select>
                <button type="button" class="dp-button dp-secondary" @click="openFullPreview()">查看完整预览 ↗</button>
              </div>
              <div class="dp-safe-note"><DataIcon name="info" :size="15" /><span>文件将上传到你的工作空间并由后台处理。刷新页面后，可在处理记录中继续查看进度。</span></div>
            </div>

          </div>
          <div v-if="errors.length && step > 1" class="dp-errors" role="alert"><p v-for="error in errors" :key="error">{{ error }}</p></div><div v-if="!saved" class="dp-actionbar"><div><span class="dp-action-count">{{ documents.length }}<small>份资料已就绪</small></span><span class="dp-action-divider"></span><span class="dp-action-hint">{{ step === 1 ? '解析完成后可查看完整预览，再确认入库' : `${totalChars.toLocaleString()} 字符 · 预计生成 ${allChunks.length} 个分块` }}</span></div><div><button v-if="step > 1" class="dp-button dp-secondary" :disabled="running" @click="goStep(step - 1)"><DataIcon name="back" :size="16" />上一步</button><button v-if="step < 2" class="dp-button dp-primary" :disabled="!ready || parsing || !!validation" @click="goStep(step + 1)">下一步：确认入库<DataIcon name="arrow" :size="17" /></button><button v-else class="dp-button dp-primary" :disabled="running || !targetName.trim() || !ready || !!validation" @click="beginProcess"><DataIcon name="database" :size="17" />{{ running ? '正在处理…' : '开始处理并入库' }}</button></div></div>
        </template>

        <section v-else-if="section === 'library'" class="dp-panel dp-library-panel"><div class="dp-library-heading"><div><h2>我的知识库</h2><p>创建知识库后，可在导入资料时选择。</p></div><button type="button" class="dp-button dp-primary" @click="showLibraryDialog = true"><DataIcon name="plus" :size="17" />新增知识库</button></div><div class="dp-kb-chips"><button type="button" class="dp-kb-chip" :class="{ active: !libraryFilter }" @click="libraryFilter = ''">全部资料 <small>{{ library.length }}</small></button><button v-for="lib in libraries" :key="lib.id" type="button" class="dp-kb-chip" :class="{ active: libraryFilter === lib.id }" @click="openLibrary(lib)">{{ lib.name }} <small>{{ lib.document_count }}</small></button><button v-if="libraryFilter" type="button" class="dp-kb-delete-link" :disabled="libraryBusy" @click="confirmDeleteSelectedLibrary"><DataIcon name="trash" :size="15" />删除当前知识库</button></div><div class="dp-kb-search"><div class="dp-kb-search-bar"><DataIcon name="spark" :size="16" /><input v-model="searchQuery" placeholder="语义检索：例如「上合页距门顶多少毫米」" aria-label="知识库语义检索" @keyup.enter="runSearch" /><button type="button" class="dp-button dp-primary" :disabled="searching || !searchQuery.trim()" @click="runSearch">{{ searching ? '检索中…' : '检索' }}</button></div><p class="dp-kb-search-scope">检索范围：{{ searchScope }}</p><div v-if="tags.length" class="dp-kb-search-tags"><button v-for="tag in tags" :key="tag.id" type="button" class="dp-tag-chip" :class="{ active: searchTagIds.includes(tag.id) }" @click="toggleSearchTag(tag)">{{ tag.name }}</button></div><p v-if="searchError" class="dp-parser-note" role="alert">{{ searchError }}</p><div v-if="searchResults.length" class="dp-kb-hits"><div v-for="hit in searchResults" :key="(hit.version || '') + hit.id" class="dp-kb-hit"><div class="dp-kb-hit-head"><strong>{{ hit.document_name || hit.document_id.slice(0, 8) }}</strong><span>{{ Math.round(hit.score * 100) }}%</span></div><p>{{ hit.text }}</p><small v-if="originMeta(hit.origin)">{{ originMeta(hit.origin) }}</small></div></div><p v-else-if="searchedOnce && !searching" class="dp-parser-note">没有命中：换个说法，或确认资料已完成入库。</p></div><div class="dp-list-toolbar"><h2>全部资料 <span>{{ library.length }}</span></h2><div class="dp-search"><DataIcon name="search" :size="17" /><input v-model="search" placeholder="搜索资料、知识库或分类" aria-label="搜索知识库资料" /></div></div><div v-if="!visibleLibrary.length" class="dp-collection-empty"><DataIcon name="database" :size="42" /><h3>{{ library.length ? '没有找到匹配的资料' : '为你的知识库添加第一份资料' }}</h3><p>上传资料、选择索引增强方式，构建自己的知识空间。</p><button class="dp-button dp-primary" @click="saved ? newImport() : navigate('import')"><DataIcon name="plus" :size="16" />添加数据</button></div><div v-else class="dp-table-scroll"><table class="dp-library-table"><thead><tr><th>资料名称</th><th>知识库 / 分类</th><th>数据分块</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="entry in visibleLibrary" :key="entry.id"><td><div class="dp-table-file"><span class="dp-file-badge small">{{ entry.kind }}</span><div><strong>{{ entry.name }}</strong><small>{{ entry.at }}{{ entry.sample ? ' · 示例' : '' }}</small></div></div></td><td>{{ entry.target }}<small>{{ entry.category }}</small><small v-if="entry.tags.length" class="dp-tag-inline">{{ entry.tags.map(tag => tag.name).join('、') }}</small></td><td>{{ entry.chunks.length }} 块<small>{{ entry.chars.toLocaleString() }} 字符</small></td><td><span class="dp-status-pill"><span></span>已入库</span></td><td><div class="dp-table-actions"><button class="dp-icon-button" aria-label="查看分块" @click="inspecting = entry"><DataIcon name="eye" :size="17" /></button><button class="dp-icon-button" aria-label="导出分块 JSON" @click="exportData(entry)"><DataIcon name="download" :size="17" /></button><button class="dp-icon-button" aria-label="移除资料" @click="removing = entry.id"><DataIcon name="trash" :size="17" /></button></div></td></tr></tbody></table></div><div class="dp-list-footnote"><DataIcon name="info" :size="15" />已入库资料保存在服务器中，可查看分块、导出或移除。</div></section>
        <section v-else-if="section === 'tasks'" class="dp-panel dp-library-panel"><div class="dp-list-toolbar"><h2>处理记录 <span>{{ tasks.length }}</span></h2><button class="dp-button dp-secondary" :disabled="syncing" @click="refreshServer(true)">刷新状态</button></div><div v-if="!tasks.length" class="dp-collection-empty"><DataIcon name="clock" :size="42" /><h3>每一份知识，都有来时的路</h3><p>上传与入库后，可在这里查看实际处理状态。</p></div><div v-for="task in tasks" :key="task.id" class="dp-task-row"><span class="dp-task-icon"><DataIcon :name="task.status === 'done' ? 'check' : 'clock'" /></span><div><h3>{{ task.kind === 'parse' ? '文件解析' : '知识库入库' }} · {{ task.document_name || task.document_id.slice(0, 8) }}</h3><p>{{ formatDate(task.created_at) }} · {{ task.stage }} · {{ task.progress }}%</p><p v-if="task.error" role="alert">{{ task.error }}</p></div><span class="dp-status-pill" :class="{ cancelled: task.status !== 'done' }">{{ statusText(task.status) }}</span><button v-if="['failed','partial','cancelled','queued'].includes(task.status)" class="dp-button dp-secondary" :disabled="running || parsing" @click="retryTask(task)">{{ task.status === 'queued' ? '重新派发' : '重试' }}</button></div></section>
        <section v-else-if="section === 'ask'" class="dp-ask-layout">
          <div class="dp-panel dp-ask-panel">
            <div class="dp-ask-head">
              <div><h2>知识问答</h2><p>回答仅依据已入库资料生成，引用编号可逐条核对。</p></div>
              <button class="dp-button dp-secondary" :disabled="askBusy || !askMessages.length" @click="clearAsk"><DataIcon name="trash" :size="15" />清空对话</button>
            </div>
            <div ref="askScroll" class="dp-ask-messages" aria-live="polite" @scroll="onAskScroll">
              <div v-if="!askMessages.length" class="dp-ask-empty">
                <span class="dp-ask-empty-icon"><DataIcon name="chat" :size="30" /></span>
                <h3>向你的知识库提问</h3>
                <p>例如安装尺寸、承重参数、操作步骤。系统会先检索相关资料，再生成带引用的回答；资料中没有的内容不会编造。</p>
                <div class="dp-ask-suggestion-block">
                  <span class="dp-ask-suggestions-label">试试这样问</span>
                  <div class="dp-ask-suggestions">
                    <button v-for="q in ASK_SUGGESTIONS" :key="q" type="button" :disabled="askBusy" @click="sendQuestion(q)">{{ q }}<DataIcon name="arrow" :size="14" /></button>
                  </div>
                </div>
                <small v-if="!library.length">还没有已入库资料？先去「导入数据」完成处理，再回来提问。</small>
                <small v-else>对话仅保留在当前页面会话中。</small>
              </div>
              <template v-else>
                <div v-for="msg in askMessages" :key="msg.id" class="dp-ask-msg" :class="msg.role">
                  <div v-if="msg.role === 'user'" class="dp-ask-user-bubble">{{ msg.content }}</div>
                  <template v-else>
                    <span class="dp-ask-avatar"><DataIcon name="spark" :size="16" /></span>
                    <div class="dp-ask-answer-card">
                      <div v-if="msg.status === 'streaming' && !msg.content" class="dp-ask-progress" role="status"><span class="dp-ask-spinner"></span>{{ msg.sources.length ? `已找到 ${msg.sources.length} 条相关资料，正在生成回答…` : '正在检索相关资料…' }}</div>
                      <div v-if="msg.content" class="dp-ask-answer" :class="{ streaming: msg.status === 'streaming' }" v-html="answerHtml(msg)" @click="selectCitation($event, msg)" @keydown.enter="selectCitation($event, msg)" @keydown.space="selectCitation($event, msg)"></div>
                      <div v-if="msg.status === 'no_evidence'" class="dp-ask-noevidence"><DataIcon name="info" :size="16" /><p>当前范围内未找到可回答的资料。可更换关键词、切换知识库或清除标签；资料未入库时请先完成导入。</p><button class="dp-plain-link" @click="navigate('import')">去导入数据</button></div>
                      <div v-if="msg.status === 'error'" class="dp-ask-error" role="alert"><DataIcon name="info" :size="16" /><p>{{ msg.error }}</p><button class="dp-plain-link" @click="retryAnswer(msg)">重试</button></div>
                      <div v-if="msg.status === 'stopped'" class="dp-ask-stopped"><DataIcon name="info" :size="15" /><span>已停止生成</span><button class="dp-plain-link" @click="retryAnswer(msg)">重新生成</button></div>
                      <div v-if="msg.status === 'done' || msg.status === 'stopped'" class="dp-ask-meta">
                        <button v-if="msg.sources.length" class="dp-ask-sources-btn" :class="{ active: askEvidenceFor === msg.id }" @click="showEvidence(msg)"><DataIcon name="layers" :size="14" />{{ msg.sources.length }} 条引用</button>
                        <span v-if="msg.model" class="dp-ask-model">{{ msg.model }}</span>
                        <button class="dp-icon-button" aria-label="复制回答" @click="copyAnswer(msg)"><DataIcon name="copy" :size="15" /></button>
                        <button v-if="msg.status === 'done'" class="dp-icon-button" aria-label="重新生成" @click="retryAnswer(msg)"><DataIcon name="refresh" :size="15" /></button>
                      </div>
                    </div>
                  </template>
                </div>
              </template>
            </div>
            <div class="dp-ask-composer">
              <textarea ref="askInputEl" v-model="askInput" rows="1" maxlength="2000" :disabled="askBusy" placeholder="输入问题，例如：上合页距门顶多少毫米？" aria-label="知识库问题" @input="growAskInput" @keydown.enter.exact.prevent="sendQuestion()"></textarea>
              <div class="dp-ask-composer-side">
                <small>{{ askInput.length }} / 2000 · Enter 发送，Shift+Enter 换行</small>
                <button v-if="askBusy" class="dp-button dp-secondary" @click="stopAsk"><DataIcon name="stop" :size="15" />停止</button>
                <button v-else class="dp-button dp-primary" :disabled="!askInput.trim()" @click="sendQuestion()"><DataIcon name="arrow" :size="16" />提问</button>
              </div>
            </div>
          </div>
          <aside class="dp-panel dp-ask-evidence" aria-label="问答范围与引用来源">
            <div class="dp-ask-evidence-head"><h2>引用来源</h2><span v-if="askEvidenceMessage">{{ askEvidenceMessage.sources.length }} 条</span></div>
            <div class="dp-ask-scope">
              <label class="dp-ask-library-select">
                <span><DataIcon name="database" :size="16" />问答知识库</span>
                <select v-model="askLibraryId" :disabled="askBusy" aria-label="选择问答知识库">
                  <option value="">全部知识库（{{ library.length }}）</option>
                  <option v-for="lib in libraries" :key="lib.id" :value="lib.id">{{ lib.name }}（{{ lib.document_count }} 份资料）</option>
                </select>
              </label>
              <div v-if="tags.length" class="dp-kb-search-tags" role="group" aria-label="问答标签筛选">
                <button v-for="tag in tags" :key="tag.id" type="button" class="dp-tag-chip" :class="{ active: askTagIds.includes(tag.id) }" :disabled="askBusy" @click="toggleAskTag(tag)">{{ tag.name }}</button>
              </div>
              <p class="dp-ask-scope-line">检索范围：{{ askScope }}</p>
            </div>
            <p v-if="askEvidenceMessage" class="dp-ask-evidence-scope">{{ askEvidenceMessage.scope }}</p>
            <div v-if="!askEvidenceMessage" class="dp-ask-evidence-empty"><span class="dp-ask-evidence-empty-icon"><DataIcon name="layers" :size="24" /></span><strong>引用来源随回答生成</strong><p>回答中的引用编号会对应到这里，点击编号可定位原文。</p></div>
            <div v-else class="dp-ask-evidence-list">
              <article v-for="(hit, i) in askEvidenceMessage.sources" :key="hit.id" :id="`dp-source-${askEvidenceMessage.id}-${i + 1}`" class="dp-ask-source" :class="{ active: askCiteActive === i + 1 && askEvidenceFor === askEvidenceMessage.id }">
                <div class="dp-ask-source-head"><span class="dp-ask-source-no">{{ i + 1 }}</span><strong>{{ hit.document_name || hit.document_id.slice(0, 8) }}</strong><span class="dp-ask-source-score">{{ Math.round(hit.score * 100) }}%</span></div>
                <small v-if="originMeta(hit.origin)" class="dp-ask-source-origin">{{ originMeta(hit.origin) }}</small>
                <p class="dp-ask-source-text" :class="{ expanded: expandedSource === `${askEvidenceMessage.id}:${i}` }">{{ hit.text }}</p>
                <button class="dp-plain-link" @click="expandedSource = expandedSource === `${askEvidenceMessage.id}:${i}` ? '' : `${askEvidenceMessage.id}:${i}`">{{ expandedSource === `${askEvidenceMessage.id}:${i}` ? '收起' : '展开全文' }}</button>
              </article>
            </div>
          </aside>
        </section>
        <footer class="dp-page-footer"></footer>
      </main>
    </div>

    <div v-if="running" class="dp-overlay"><section class="dp-modal dp-process-modal" role="dialog" aria-modal="true" aria-labelledby="process-title"><span class="dp-process-logo"><DataIcon name="database" :size="30" /></span><span class="dp-eyebrow">BUILDING YOUR KNOWLEDGE</span><h2 id="process-title">正在整理你的知识</h2><p role="status">{{ jobStage }}</p><div class="dp-progress"><span :style="{ width: `${jobProgress}%` }"></span></div><div class="dp-process-percent">{{ jobProgress }}%</div><div class="dp-notice"><DataIcon name="info" :size="17" /><p>进度来自后台实际任务。已完成资料会保留，模型或存储服务异常时可在处理记录中重试。</p></div><button class="dp-plain-link" @click="cancelProcess">取消处理</button></section></div>
    <div v-if="showHelp" class="dp-overlay" @click.self="showHelp = false" @keydown.esc="showHelp = false"><section class="dp-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" tabindex="-1"><button class="dp-modal-close dp-icon-button" aria-label="关闭指南" autofocus @click="showHelp = false"><DataIcon name="close" /></button><div class="dp-eyebrow">A LITTLE GUIDE</div><h2 id="guide-title">两步，把资料变成知识</h2><div class="dp-guide-step"><span>01</span><div><h3>汇集资料</h3><p>上传 PDF、DOCX、文本或表格，完成解析和内容类型确认后可查看完整预览。</p></div></div><div class="dp-guide-step"><span>02</span><div><h3>确认并入库</h3><p>选择知识库及处理选项后开始入库。完成后可在“我的知识库”查看和导出资料。</p></div></div><div class="dp-notice"><DataIcon name="info" :size="17" /><p>资料及处理结果保存在你的工作空间中。后台任务失败时，可以查看原因并重试。</p></div><button class="dp-button dp-primary" @click="showHelp = false">开始体验<DataIcon name="arrow" :size="17" /></button></section></div>
    <DocumentViewer v-if="inspecting && inspecting.version" :key="inspecting.id" :id="inspecting.id" :job-id="inspecting.version" :name="inspecting.name" :kind="inspecting.kind" :library="inspecting.target" :time="inspecting.at" @close="inspecting = null" @export="exportData(inspecting || undefined)" />
    <div v-if="removingLibrary" class="dp-overlay" @click.self="removingLibrary = null"><section class="dp-modal dp-delete-modal" role="dialog" aria-modal="true" aria-labelledby="library-delete-title"><h2 id="library-delete-title">删除这个知识库？</h2><p>「{{ removingLibrary.name }}」下的 {{ removingLibrary.statistics.total_documents }} 份资料会保留，仅解除与该知识库的关联，之后不再按该知识库检索。</p><div><button class="dp-button dp-secondary" autofocus @click="removingLibrary = null">取消</button><button class="dp-button dp-primary" :disabled="libraryBusy" @click="deleteLibrary">确认删除</button></div></section></div>
    <div v-if="removing" class="dp-overlay" @click.self="removing = null"><section class="dp-modal dp-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">移除这份资料？</h2><p>移除后该资料将退出知识库检索，正在运行的处理任务也会取消。</p><div><button class="dp-button dp-secondary" autofocus @click="removing = null">取消</button><button class="dp-button dp-primary" @click="deleteEntry">确认移除</button></div></section></div>
  </div>
</template>
