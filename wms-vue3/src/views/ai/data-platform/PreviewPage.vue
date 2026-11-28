<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from './pipelineApi'
import type { Preview, ProcessResult } from './pipelineApi'
import type { Chunk } from './processing'
import ChunkInspection from './ChunkInspection.vue'
import ContentTypeDialog from './ContentTypeDialog.vue'
import './style.css'

defineOptions({ name: 'DataPlatformPreview' })
const route = useRoute(), router = useRouter()
const docId = String(route.params.docId || '')
const preview = ref<Preview | null>(null)
const loading = ref(true), busy = ref(false), error = ref('')
const tab = ref<'parsed' | 'images' | 'chunks'>('chunks')
const blockPage = ref(1), imagePage = ref(1)
const blockSize = 50, imageSize = 12
const blocks = ref<NonNullable<Preview['blocks']>>([])
const pictures = ref<{ key: string; url: string; label: string }[]>([])
const actualChunks = ref<Chunk[] | null>(null)
const typeDialogOpen = ref(false)
const indexedContentType = ref('')
const baseChunks = ref<Chunk[]>([])
let disposed = false
const controller = new AbortController()
let imageRequest = 0

const totalBlocks = computed(() => preview.value?.blocks_total || 0)
const totalImages = computed(() => preview.value?.images_total || 0)
const blockPages = computed(() => Math.max(1, Math.ceil(totalBlocks.value / blockSize)))
const imagePages = computed(() => Math.max(1, Math.ceil(totalImages.value / imageSize)))
const chunks = computed(() => actualChunks.value || baseChunks.value)
const contentTypeNames: Record<string, string> = { product: '产品资料', faq: '问答', manual: '安装说明', policy: '制度条款', generic: '通用资料' }
const routeNames: Record<string, string> = { native: '原生文字', 'native+tables': '原生文字＋表格', vlm: '页面图像识别', skipped: '已跳过' }

async function refreshTypedChunks(type: api.ContentType) {
  if (actualChunks.value && indexedContentType.value === type) return
  try {
    const base = await api.request<{ chunks: ProcessResult['chunks']; content_type: string }>(`/documents/${docId}/chunk-preview`, {}, controller.signal)
    if (!disposed && preview.value && !(actualChunks.value && indexedContentType.value === type)) {
      actualChunks.value = null
      baseChunks.value = base.chunks.map(chunk => ({ ...chunk, sourceId: docId, sourceName: preview.value!.document.name }))
      preview.value.content_type = base.content_type
    }
  } catch (cause) { if (!disposed) error.value = cause instanceof Error ? cause.message : '切片预览更新失败' }
}

function back() {
  void router.push({ name: 'DataPlatformDemo', query: { previewDoc: docId, previewStep: String(route.query.step || '1') } })
}
function originLabel(origin?: Record<string, unknown>) {
  if (!origin) return ''
  const bits = []
  if (origin.page) bits.push(`第 ${origin.page} 页`)
  if (origin.sheet) bits.push(`工作表 ${origin.sheet}`)
  if (origin.row) bits.push(`第 ${origin.row} 行`)
  if (origin.role === 'table_row') bits.push('表格记录')
  return bits.join(' · ')
}
async function loadBlocks(page: number) {
  if (!preview.value || busy.value) return
  busy.value = true
  try {
    const result = await api.request<Preview>(`/documents/${docId}/preview?block_offset=${(page - 1) * blockSize}&block_limit=${blockSize}&image_limit=1`, {}, controller.signal)
    if (!disposed) { blocks.value = result.blocks || []; blockPage.value = page }
  } catch (cause) { if (!disposed) error.value = cause instanceof Error ? cause.message : '内容加载失败' }
  finally { busy.value = false }
}
function clearPictures() { pictures.value.forEach(picture => URL.revokeObjectURL(picture.url)); pictures.value = [] }
async function loadImages(page: number) {
  if (!preview.value) return
  const request = ++imageRequest
  clearPictures()
  busy.value = true
  try {
    const result = await api.request<Preview>(`/documents/${docId}/preview?block_limit=1&image_offset=${(page - 1) * imageSize}&image_limit=${imageSize}`, {}, controller.signal)
    const loaded: typeof pictures.value = []
    for (const item of result.images) {
      try {
        const url = await api.blobUrl(`/documents/${docId}/assets/${item.id}`, controller.signal)
        if (request !== imageRequest || disposed) { URL.revokeObjectURL(url); continue }
        const label = item.origin.page ? `第 ${item.origin.page} 页` : item.origin.sheet ? `工作表 ${item.origin.sheet}` : `第 ${item.origin.paragraph || '?'} 段`
        loaded.push({ key: `${item.id}-${page}-${loaded.length}`, url, label })
      } catch { /* A failed image does not hide the other assets. */ }
    }
    if (request === imageRequest && !disposed) { pictures.value = loaded; imagePage.value = page }
    else loaded.forEach(item => URL.revokeObjectURL(item.url))
  } catch (cause) { if (!disposed) error.value = cause instanceof Error ? cause.message : '图片加载失败' }
  finally { if (request === imageRequest) busy.value = false }
}
onMounted(async () => {
  try {
    const result = await api.request<Preview>(`/documents/${docId}/preview?block_limit=${blockSize}&image_limit=1`, {}, controller.signal)
    if (disposed) return
    preview.value = result
    blocks.value = result.blocks || []
    if (result.document.status === 'indexed' && result.document.process_job_id) {
      try {
        const processed = await api.request<ProcessResult>(`/jobs/${result.document.process_job_id}/result`, {}, controller.signal)
        if (!disposed) {
          indexedContentType.value = (processed as ProcessResult & { content_type?: string }).content_type || ''
          actualChunks.value = processed.chunks.map(chunk => ({ ...chunk, sourceId: docId, sourceName: result.document.name }))
        }
      } catch { /* Parsed content remains available while an index result is unavailable. */ }
    }
    if (!disposed && actualChunks.value === null) {
      const profile = await api.contentProfile(docId, controller.signal)
      if (!profile.confirmed_type) { typeDialogOpen.value = true; return }
      let titleIndex = true
      try {
        const draft = JSON.parse(sessionStorage.getItem('data-platform-preview-draft') || 'null')
        if (draft?.selectedId === docId) titleIndex = draft.config?.titleIndex !== false
      } catch { /* Use the worker default. */ }
      const base = await api.request<{ chunks: ProcessResult['chunks']; content_type: string }>(`/documents/${docId}/chunk-preview?title_index=${titleIndex}`, {}, controller.signal)
      if (!disposed) {
        baseChunks.value = base.chunks.map(chunk => ({ ...chunk, sourceId: docId, sourceName: result.document.name }))
        result.content_type = base.content_type
      }
    }
  } catch (cause) { if (!disposed) error.value = cause instanceof Error ? cause.message : '预览加载失败' }
  finally { loading.value = false }
})
watch(tab, next => { if (next === 'images' && totalImages.value) void loadImages(imagePage.value) })
onBeforeUnmount(() => {
  disposed = true; imageRequest++; controller.abort(); clearPictures()
})
</script>

<template>
  <div class="dp-shell full-preview">
    <main class="full-preview-main">
      <header class="full-preview-top">
        <button type="button" class="full-preview-back" @click="back">← 返回导入流程</button>
        <span>数据工作空间 / 完整预览</span>
      </header>
      <div v-if="loading" class="full-preview-state" role="status">正在加载资料预览…<progress aria-label="加载资料预览"></progress></div>
      <div v-else-if="!preview" class="full-preview-state" role="alert">{{ error || '无法读取资料' }}<button type="button" @click="back">返回</button></div>
      <template v-else>
        <section class="full-preview-heading">
          <div><small>DOCUMENT PREVIEW</small><h1>{{ preview.document.name }}</h1><p>{{ preview.document.kind.toUpperCase() }} · {{ contentTypeNames[preview.content_type || ''] || '未分类' }} · {{ totalBlocks }} 个解析块 · {{ totalImages }} 张图片</p></div>
          <button type="button" class="full-preview-back" @click="back">返回处理设置 →</button>
        </section>
        <div v-if="error" class="full-preview-error" role="alert">{{ error }}</div>
        <p v-if="preview.image_selection" class="full-preview-note">图片资产共 {{ preview.image_selection.asset_occurrences }} 处（去重后 {{ preview.image_selection.unique_assets }} 张），图片增强将处理其中 {{ preview.image_selection.selected_unique }} 张局部配图。整页图仅供预览，扫描正文在解析阶段完成识别；不会再次整页分析。</p>
        <div class="full-preview-type-action"><button type="button" @click="typeDialogOpen = true">修改内容类型</button><span>已选择的类型用于当前切片预览。</span></div>
        <ContentTypeDialog v-if="typeDialogOpen" :doc-id="docId" :name="preview.document.name" @close="typeDialogOpen = false" @saved="type => { typeDialogOpen = false; refreshTypedChunks(type) }" />
        <nav class="full-preview-tabs" aria-label="预览内容">
          <button :class="{ active: tab === 'chunks' }" @click="tab = 'chunks'">{{ actualChunks ? '入库分块' : '预计分块' }} <span>{{ chunks.length }}</span></button>
          <button :class="{ active: tab === 'parsed' }" @click="tab = 'parsed'">解析内容 <span>{{ totalBlocks }}</span></button>
          <button :class="{ active: tab === 'images' }" @click="tab = 'images'">图片 <span>{{ totalImages }}</span></button>
        </nav>
        <section v-if="tab === 'parsed'" class="full-preview-grid">
          <aside class="full-preview-aside">
            <h2>解析说明</h2>
            <p v-for="note in preview.cleaning || []" :key="note">{{ note }}</p>
            <p v-if="!preview.cleaning?.length">正文与表格已按原文件顺序提取。</p>
            <details v-if="preview.page_routes?.length"><summary>按页解析路径（{{ preview.page_routes.length }} 页）</summary><div v-for="item in preview.page_routes" :key="item.page">第 {{ item.page }} 页 · {{ routeNames[item.path] || item.path }}<span v-if="item.table_rows"> · {{ item.table_rows }} 行表格</span><span v-if="item.reason"> · {{ item.reason }}</span></div></details>
          </aside>
          <div class="full-preview-list"><div class="full-preview-list-head"><h2>解析内容</h2><span>第 {{ blockPage }} / {{ blockPages }} 组 · 每组 {{ blockSize }} 块</span></div>
            <article v-for="block in blocks" :key="block.id" class="full-preview-block"><div><strong>#{{ block.id }}</strong><span>{{ originLabel(block.origin) }}</span></div><pre>{{ block.text }}</pre></article>
            <p v-if="!blocks.length" class="full-preview-empty">当前没有可展示的解析块。</p>
            <div class="full-preview-pager"><button :disabled="busy || blockPage <= 1" @click="loadBlocks(blockPage - 1)">上一组</button><span>{{ blockPage }} / {{ blockPages }}</span><button :disabled="busy || blockPage >= blockPages" @click="loadBlocks(blockPage + 1)">下一组</button></div>
          </div>
        </section>
        <section v-else-if="tab === 'images'" class="full-preview-list"><div class="full-preview-list-head"><h2>提取的图片</h2><span>共 {{ totalImages }} 张，按页加载</span></div><div v-if="pictures.length" class="full-preview-images"><figure v-for="picture in pictures" :key="picture.key"><img :src="picture.url" :alt="picture.label" loading="lazy" /><figcaption>{{ picture.label }}</figcaption></figure></div><p v-else class="full-preview-empty">{{ busy ? '正在加载图片…' : '没有可展示的图片。' }}</p><div v-if="totalImages" class="full-preview-pager"><button :disabled="busy || imagePage <= 1" @click="loadImages(imagePage - 1)">上一组</button><span>{{ imagePage }} / {{ imagePages }}</span><button :disabled="busy || imagePage >= imagePages" @click="loadImages(imagePage + 1)">下一组</button></div></section>
        <ChunkInspection v-else-if="tab === 'chunks'" :chunks="chunks" :actual="actualChunks !== null" class="full-preview-list" />
      </template>
    </main>
  </div>
</template>

<style scoped>
.full-preview-type-action { display:flex; gap:12px; align-items:center; margin:12px 0 18px; font-size:12px; color:var(--dp-muted); }
.full-preview-type-action button { border:1px solid var(--dp-line); padding:5px 10px; border-radius:6px; background:var(--dp-panel); color:var(--dp-text); }
.full-preview-type-action button:hover { border-color:var(--dp-red); color:var(--dp-red); }
.full-preview-state progress { display:block; width:min(360px,90%); height:6px; margin:20px auto; accent-color:var(--dp-red); }
.full-preview{display:block}.full-preview-main{max-width:1500px;margin:auto;padding:0 32px 56px;width:100%}.full-preview-top{display:flex;align-items:center;gap:18px;border-bottom:1px solid var(--dp-line);height:64px;color:var(--dp-muted);font-size:13px}.full-preview-back{border:1px solid var(--dp-line);border-radius:7px;background:var(--dp-panel);color:var(--dp-text);padding:7px 12px}.full-preview-back:hover,.full-preview-pager button:hover:not(:disabled){border-color:var(--dp-red);color:var(--dp-red)}.full-preview-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:30px 0 22px}.full-preview-heading small{font-size:11px;letter-spacing:1.5px;color:var(--dp-red)}.full-preview-heading h1{font-size:25px;line-height:1.4;overflow-wrap:anywhere}.full-preview-heading p{color:var(--dp-muted);font-size:13px;margin-top:7px}.full-preview-tabs{display:flex;gap:6px;border-bottom:1px solid var(--dp-line);margin-bottom:20px;overflow:auto}.full-preview-tabs button{white-space:nowrap;border:0;border-bottom:2px solid transparent;background:none;color:var(--dp-muted);padding:10px 16px}.full-preview-tabs button.active{border-bottom-color:var(--dp-red);color:var(--dp-red);font-weight:650}.full-preview-tabs span{font-size:11px;margin-left:3px}.full-preview-grid{display:grid;grid-template-columns:260px minmax(0,1fr);gap:18px;align-items:start}.full-preview-aside,.full-preview-list{background:var(--dp-panel);border:1px solid var(--dp-line);border-radius:10px;padding:20px;min-width:0}.full-preview-aside{position:sticky;top:18px;max-height:calc(100vh - 36px);overflow:auto}.full-preview-aside h2,.full-preview-list h2{font-size:17px}.full-preview-aside p,.full-preview-aside details{font-size:12px;color:var(--dp-muted);line-height:1.8;margin-top:12px}.full-preview-aside details div{padding:5px 0;border-bottom:1px solid var(--dp-line)}.full-preview-aside summary{cursor:pointer;color:var(--dp-text)}.full-preview-list-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.full-preview-list-head span{color:var(--dp-muted);font-size:12px}.full-preview-block{border:1px solid var(--dp-line);border-radius:8px;padding:15px;margin-bottom:10px}.full-preview-block>div{display:flex;gap:10px;color:var(--dp-muted);font-size:12px}.full-preview-block strong{color:var(--dp-red)}.full-preview-block pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:14px;line-height:1.8;margin:10px 0 0}.full-preview-block small{display:block;color:var(--dp-muted);border-top:1px solid var(--dp-line);padding-top:10px;font-size:12px}.full-preview-pager{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:18px}.full-preview-pager button{background:var(--dp-panel);border:1px solid var(--dp-line);border-radius:6px;padding:6px 12px;color:var(--dp-text)}.full-preview-pager button:disabled{opacity:.45}.full-preview-pager span,.full-preview-note,.full-preview-empty{color:var(--dp-muted);font-size:13px}.full-preview-note{padding:12px 14px;background:var(--dp-bg);border-radius:6px;margin:12px 0}.full-preview-empty,.full-preview-state{padding:50px 20px;text-align:center;color:var(--dp-muted)}.full-preview-error{padding:12px 14px;background:var(--dp-red-soft);color:var(--dp-red);border-radius:6px;margin-bottom:12px}.full-preview-images{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}.full-preview-images figure{margin:0;border:1px solid var(--dp-line);border-radius:8px;padding:8px}.full-preview-images img{width:100%;height:165px;object-fit:contain;background:var(--dp-bg)}.full-preview-images figcaption{font-size:12px;color:var(--dp-muted);padding:5px 0}.full-preview-stats{display:flex;gap:20px;color:var(--dp-muted);font-size:13px;margin:8px 0}.full-preview-chart{height:110px;display:flex;align-items:flex-end;gap:2px;border-bottom:1px solid var(--dp-line);margin:12px 0 18px;overflow:hidden}.full-preview-chart i{flex:1;min-width:2px;background:var(--dp-red);border-radius:2px 2px 0 0;opacity:.75}.full-preview-search{width:100%;border:1px solid var(--dp-line);border-radius:7px;background:var(--dp-panel);color:var(--dp-text);padding:9px 12px;margin:4px 0 16px}.full-preview-load{border:1px solid var(--dp-red);border-radius:7px;background:var(--dp-red-soft);color:var(--dp-red);padding:9px 14px}.full-preview-pdf{width:100%;height:75vh;border:1px solid var(--dp-line);margin-top:12px}
@media(max-width:850px){.full-preview-main{padding:0 15px 35px}.full-preview-grid{grid-template-columns:1fr}.full-preview-aside{position:static;max-height:none}.full-preview-heading{align-items:flex-start}.full-preview-heading .full-preview-back{white-space:nowrap}.full-preview-list,.full-preview-aside{padding:15px}}
@media(max-width:560px){.full-preview-heading{display:block}.full-preview-heading .full-preview-back{margin-top:12px}.full-preview-stats{flex-wrap:wrap}.full-preview-tabs button{padding:9px 11px}}
</style>
