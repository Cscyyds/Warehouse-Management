<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as api from './pipelineApi'
import type { ContentProfile, ContentType } from './pipelineApi'

const props = defineProps<{ docId: string; name: string }>()
const emit = defineEmits<{ confirmed: [type: ContentType]; saved: [type: ContentType] }>()
const profile = ref<ContentProfile | null>(null)
const selected = ref<ContentType | ''>('')
const loading = ref(false), saving = ref(false), error = ref(''), notice = ref('')
const choices: { value: ContentType; name: string; hint: string }[] = [
  { value: 'product', name: '产品资料', hint: '产品介绍、型号和规格表' },
  { value: 'faq', name: '问答资料', hint: '完整问题和答案一起保留' },
  { value: 'manual', name: '安装／操作说明', hint: '按章节、步骤组织内容' },
  { value: 'policy', name: '制度／合同条款', hint: '按条款组织内容' },
  { value: 'generic', name: '其他文档', hint: '通用正文分块' },
]
const typeName = (value: string) => choices.find(choice => choice.value === value)?.name || value
const controller = new AbortController()
let disposed = false, changed = false
async function recommend() {
  if (!profile.value) return
  loading.value = true; error.value = ''
  try {
    const result = await api.suggestContentType(props.docId, controller.signal)
    if (disposed) return
    if (result.parse_revision !== profile.value.parse_revision) throw new Error('解析结果已更新，请刷新后重新确认')
    profile.value.suggestion = result.suggestion
    if (!changed && !profile.value.confirmed_type) selected.value = result.suggestion.content_type
  } catch (cause) {
    if (!disposed) error.value = cause instanceof Error ? cause.message : '模型建议暂不可用，可直接手动选择'
  } finally { if (!disposed) loading.value = false }
}
async function confirm() {
  if (!selected.value || !profile.value) return
  saving.value = true; error.value = ''; notice.value = ''
  try {
    const result = await api.confirmContentType(props.docId, selected.value, profile.value.parse_revision, controller.signal)
    if (disposed) return
    profile.value = result; changed = true
    notice.value = '已保存，切片预览与后续入库将使用这个类型。'
    emit('confirmed', selected.value)
    emit('saved', selected.value)
  } catch (cause) { if (!disposed) error.value = cause instanceof Error ? cause.message : '保存失败，请重试' }
  finally { if (!disposed) saving.value = false }
}
onMounted(async () => {
  loading.value = true
  try {
    profile.value = await api.contentProfile(props.docId, controller.signal)
    if (disposed) return
    if (profile.value.confirmed_type) {
      selected.value = profile.value.confirmed_type
      emit('confirmed', selected.value)
    } else if (profile.value.suggestion) selected.value = profile.value.suggestion.content_type
    else await recommend()
  } catch (cause) { if (!disposed) error.value = cause instanceof Error ? cause.message : '内容类型加载失败' }
  finally { if (!disposed) loading.value = false }
})
onBeforeUnmount(() => { disposed = true; controller.abort() })
</script>

<template>
  <section class="content-type-card" :aria-label="`${name} 的内容类型`">
    <header><div><h3>确认文档内容类型</h3><p>{{ name }}</p></div><span :class="{ confirmed: profile?.confirmed_type }">{{ profile?.confirmed_type ? `已确认 · ${typeName(profile.confirmed_type)}` : '待你确认' }}</span></header>
    <div v-if="loading" class="content-type-loading" role="status"><progress aria-label="正在分析文档类型"></progress>正在根据文档内容生成类型建议…你也可以直接选择。</div>
    <div v-if="profile?.suggestion" class="content-type-summary"><strong>模型建议：{{ typeName(profile.suggestion.content_type) }}</strong><p>{{ profile.suggestion.summary }}</p><small>依据：{{ profile.suggestion.reason }}</small><small v-if="profile.suggestion.sample_count">结合 {{ profile.suggestion.sample_count }} 组正文节选分析，最终由你决定。</small></div>
    <p v-else-if="profile" class="content-type-fallback">规则初步提示：{{ typeName(profile.rule_type) }}。这是参考提示，请确认适合的类型。</p>
    <div class="content-type-controls"><select v-model="selected" :disabled="saving || !profile" :aria-label="`${name} 的文档类型`" @change="changed = true"><option value="" disabled>请选择内容类型</option><option v-for="choice in choices" :key="choice.value" :value="choice.value">{{ choice.name }} · {{ choice.hint }}</option></select><button type="button" :disabled="saving || !selected || !profile" @click="confirm">{{ saving ? '保存中…' : '确认这个类型' }}</button><button v-if="profile" type="button" class="content-type-retry" :disabled="loading || saving" @click="recommend">重新获取建议</button></div>
    <p v-if="notice" class="content-type-notice" role="status">{{ notice }}</p>
    <p v-if="error" class="content-type-error" role="alert">{{ error }}<span v-if="profile">；也可手动选择后确认。</span></p>
  </section>
</template>

<style scoped>
.content-type-card{padding:18px;border:1px solid var(--dp-line);border-radius:9px;background:var(--dp-panel);margin-top:14px}.content-type-card header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.content-type-card h3{font-size:15px}.content-type-card header p{color:var(--dp-muted);font-size:12px;margin:4px 0;overflow-wrap:anywhere}.content-type-card header>span{white-space:nowrap;font-size:11px;border-radius:20px;padding:2px 8px;background:var(--dp-bg);color:var(--dp-muted)}.content-type-card header>span.confirmed{color:var(--dp-green,#34876b)}.content-type-summary{margin-top:10px;padding:12px;background:var(--dp-bg);border-radius:7px;font-size:13px}.content-type-summary strong{color:var(--dp-red)}.content-type-summary p{margin:5px 0;line-height:1.8}.content-type-summary small{display:block;color:var(--dp-muted);font-size:12px;line-height:1.8}.content-type-loading,.content-type-fallback{font-size:12px;color:var(--dp-muted);margin:10px 0}.content-type-controls{display:flex;flex-wrap:wrap;gap:9px;margin-top:12px}.content-type-controls select{flex:1;min-width:220px;border:1px solid var(--dp-line);border-radius:6px;background:var(--dp-panel);color:var(--dp-text);padding:7px 10px}.content-type-controls button{border:1px solid var(--dp-red);border-radius:6px;padding:7px 12px;background:var(--dp-red);color:white}.content-type-controls button:hover:not(:disabled){filter:brightness(1.1)}.content-type-controls .content-type-retry{border-color:var(--dp-line);background:transparent;color:var(--dp-muted)}.content-type-notice{font-size:12px;color:var(--dp-green,#34876b);margin:8px 0 0}.content-type-error{font-size:12px;color:var(--dp-red);margin:8px 0 0}
</style>
