<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as api from './pipelineApi'
import type { ProcessResult, Preview } from './pipelineApi'
import type { Chunk } from './processing'
import ChunkInspection from './ChunkInspection.vue'

const props = defineProps<{ id: string; jobId: string; name: string; kind: string; library: string; time: string }>()
const emit = defineEmits<{ close: []; export: [] }>()
const drawer = ref<HTMLDialogElement | null>(null)
const result = ref<(ProcessResult & { content_type?: string; parser_version?: string; processor_version?: string }) | null>(null)
const loading = ref(true), error = ref(''), view = ref<'chunks' | 'parsed'>('chunks')
const preview = ref<Preview | null>(null), page = ref(1), pageLoading = ref(false), pageError = ref('')
const ctrl = new AbortController()
let disposed = false, prevOverflow = '', previousFocus: HTMLElement | null = null
const chunks = computed<Chunk[]>(() => result.value?.chunks.map(c => ({ ...c, sourceId: props.id, sourceName: props.name })) || [])
const names: Record<string, string> = { product: '产品资料', faq: '问答资料', manual: '安装／操作说明', policy: '制度／合同条款', generic: '通用资料' }
const params = computed(() => {
  const r = result.value
  const yes = (value?: boolean) => value == null ? '未记录' : value ? '已开启' : '未开启'
  return [
    { label: '内容类型', value: r?.content_type ? names[r.content_type] || r.content_type : '未记录' },
    { label: '文档标题', value: yes(r?.options?.titleIndex) },
    { label: '内容摘要', value: yes(r?.options?.autoIndex) },
    { label: '图片理解', value: yes(r?.options?.imageIndex) },
  ]
})
const totalPages = computed(() => Math.max(1, Math.ceil((preview.value?.blocks_total || 0) / 50)))
async function loadParsed(target = 1) {
  pageLoading.value = true; pageError.value = ''
  try {
    const response = await api.request<Preview>(`/documents/${props.id}/preview?block_offset=${(target - 1) * 50}&block_limit=50&image_limit=1`, {}, ctrl.signal)
    if (!disposed) { preview.value = response; page.value = target }
  } catch (cause) { if (!disposed) pageError.value = cause instanceof Error ? cause.message : '原文加载失败' }
  finally { if (!disposed) pageLoading.value = false }
}
function changeView(next: 'chunks' | 'parsed') {
  view.value = next
  if (next === 'parsed' && !preview.value && !pageLoading.value) void loadParsed()
}
function originLabel(origin?: Record<string, unknown>) {
  if (!origin) return ''
  return [origin.page ? `第 ${origin.page} 页` : '', origin.sheet ? `工作表 ${origin.sheet}` : '', origin.row ? `第 ${origin.row} 行` : ''].filter(Boolean).join(' · ')
}
onMounted(async () => {
  previousFocus = document.activeElement as HTMLElement | null
  prevOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  drawer.value?.showModal()
  await nextTick()
  try { result.value = await api.request<ProcessResult>(`/jobs/${props.jobId}/result`, {}, ctrl.signal) }
  catch (cause) { if (!disposed) error.value = cause instanceof Error ? cause.message : '入库结果加载失败' }
  finally { if (!disposed) loading.value = false }
})
onBeforeUnmount(() => {
  disposed = true; ctrl.abort(); drawer.value?.close(); document.body.style.overflow = prevOverflow
  previousFocus?.focus()
})
</script>

<template>
  <Teleport to="body"><dialog ref="drawer" class="document-viewer dp-shell" :aria-label="`${name} 文档详情`" @cancel.prevent="emit('close')" @click.self="emit('close')">
    <div class="viewer-inner"><header class="viewer-head"><span class="viewer-ext">{{ kind }}</span><div class="viewer-title"><small>{{ library || '未关联知识库' }} / 已入库</small><h2 :title="name">{{ name }}</h2><p>{{ result ? `${chunks.length} 个分块 · ${result.text_chars.toLocaleString()} 字` : '正在读取入库结果' }} · 资料创建于 {{ time }}</p></div><button autofocus type="button" @click="emit('close')">关闭</button></header>
      <div class="viewer-body"><div v-if="loading" class="viewer-state" role="status">正在加载已保存的入库结果…<progress aria-label="加载文档详情"></progress></div><div v-else-if="error" class="viewer-state" role="alert">{{ error }}</div><template v-else-if="result">
        <h3 class="viewer-params-title">入库参数</h3><dl class="viewer-params"><div v-for="item in params" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div></dl>
        <section class="viewer-panel"><div class="viewer-panel-head"><div><small>DOCUMENT DETAILS</small><h2>分块详情</h2></div><nav aria-label="文档详情视图"><button type="button" :class="{ active: view === 'chunks' }" @click="changeView('chunks')">分块结果</button><button type="button" :class="{ active: view === 'parsed' }" @click="changeView('parsed')">原文解析</button></nav></div>
          <ChunkInspection v-if="view === 'chunks'" :chunks="chunks" :actual="true" />
          <div v-else class="viewer-source"><div v-if="pageError" role="alert">{{ pageError }} <button type="button" @click="loadParsed(page)">重试</button></div><div v-else-if="pageLoading" role="status">正在加载原文解析…</div><template v-else><p class="viewer-source-note">当前展示最新解析结果；文件重新解析后，它可能与本次入库使用的版本不同。</p><article v-for="block in preview?.blocks || []" :key="block.id"><header><strong>#{{ block.id }}</strong><small>{{ originLabel(block.origin) }}</small></header><pre>{{ block.text }}</pre></article><p v-if="!preview?.blocks?.length" class="viewer-state">暂无解析内容</p><div class="viewer-pagination"><button :disabled="page <= 1" @click="loadParsed(page - 1)">上一组</button><span>{{ page }} / {{ totalPages }}</span><button :disabled="page >= totalPages" @click="loadParsed(page + 1)">下一组</button></div></template></div>
        </section><footer class="viewer-footer"><button type="button" @click="emit('export')">导出分块 JSON</button></footer>
      </template></div>
    </div>
  </dialog></Teleport>
</template>

<style scoped>
.document-viewer{display:block;position:fixed;inset:0 0 0 auto;width:min(1100px,94vw);height:100dvh;max-height:none;max-width:none;margin:0;padding:0;border:1px solid var(--dp-line);background:var(--dp-bg);color:var(--dp-text);box-shadow:-20px 0 70px #0004;overflow:hidden;animation:slide-in .24s ease-out}.document-viewer:not([open]){display:none}.document-viewer::backdrop{background:#0009;backdrop-filter:blur(4px)}.viewer-inner{display:flex;flex-direction:column;height:100%}.viewer-head{display:flex;align-items:center;gap:14px;background:var(--dp-panel);border-bottom:1px solid var(--dp-line);padding:18px 24px;flex:none}.viewer-ext{display:grid;place-items:center;width:44px;height:48px;flex:none;border:1px solid var(--dp-red);border-radius:7px;color:var(--dp-red);font-size:11px;font-weight:700}.viewer-title{min-width:0;flex:1}.viewer-title small{color:var(--dp-muted);font-size:12px}.viewer-title h2{font-size:19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.viewer-title p{color:var(--dp-muted);font-size:12px;margin:2px 0 0}.viewer-head button,.viewer-pagination button,.viewer-footer button,.viewer-source button{background:var(--dp-panel);color:var(--dp-text);border:1px solid var(--dp-line);border-radius:7px;padding:7px 13px}.viewer-head button:hover,.viewer-pagination button:hover:not(:disabled),.viewer-footer button:hover{border-color:var(--dp-red);color:var(--dp-red)}.viewer-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:22px 24px 35px}.viewer-params-title{font-size:14px;margin:0 0 10px}.viewer-params{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:9px;margin:0 0 20px}.viewer-params div{background:var(--dp-panel);border:1px solid var(--dp-line);border-radius:8px;padding:10px 12px}.viewer-params dt{font-size:12px;color:var(--dp-muted)}.viewer-params dd{margin:4px 0 0;font-size:13px;font-weight:600;overflow-wrap:anywhere}.viewer-panel{background:var(--dp-panel);border:1px solid var(--dp-line);border-radius:10px;padding:22px}.viewer-panel-head{display:flex;justify-content:space-between;align-items:start;gap:12px;margin-bottom:16px}.viewer-panel-head small{color:var(--dp-muted);font-size:11px;letter-spacing:1px}.viewer-panel-head h2{font-size:20px}.viewer-panel-head nav{display:flex;gap:4px;background:var(--dp-bg);padding:4px;border-radius:7px}.viewer-panel-head nav button{border:0;border-radius:5px;background:none;color:var(--dp-muted);padding:7px 12px}.viewer-panel-head nav button.active{background:var(--dp-panel);color:var(--dp-red);box-shadow:0 2px 8px #0001}.viewer-state{text-align:center;color:var(--dp-muted);padding:40px}.viewer-state progress{display:block;width:240px;margin:18px auto;accent-color:var(--dp-red)}.viewer-source article{border:1px solid var(--dp-line);border-radius:8px;padding:12px 14px;margin:10px 0}.viewer-source article header{display:flex;gap:10px;color:var(--dp-muted);font-size:12px}.viewer-source article pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:14px;margin:8px 0 0}.viewer-source-note{color:var(--dp-muted);font-size:12px}.viewer-pagination{display:flex;justify-content:center;align-items:center;gap:16px;margin-top:16px}.viewer-pagination button:disabled{opacity:.4}.viewer-footer{display:flex;justify-content:flex-end;margin-top:16px}@keyframes slide-in{from{opacity:.5;transform:translateX(30px)}to{opacity:1;transform:none}}@media(max-width:700px){.document-viewer{width:100vw}.viewer-head,.viewer-body{padding-left:15px;padding-right:15px}.viewer-panel{padding:14px}.viewer-panel-head{flex-wrap:wrap}}@media(prefers-reduced-motion:reduce){.document-viewer{animation:none}}
</style>
