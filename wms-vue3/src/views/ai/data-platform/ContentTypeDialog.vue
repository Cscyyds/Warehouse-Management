<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import ContentTypeSelector from './ContentTypeSelector.vue'
import type { ContentType } from './pipelineApi'
defineProps<{ docId: string; name: string; remaining?: number }>()
const emit = defineEmits<{ close: []; saved: [type: ContentType] }>()
const dialog = ref<HTMLDialogElement | null>(null)
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => dialog.value?.close())
</script>
<template>
  <Teleport to="body"><dialog ref="dialog" class="type-dialog dp-shell" aria-labelledby="type-dialog-title" @cancel.prevent="emit('close')"><div class="type-dialog-inner"><header><div><small>上传解析已完成</small><h2 id="type-dialog-title">确认内容类型，再查看预览</h2><p>{{ remaining && remaining > 1 ? `本批还有 ${remaining} 份资料待确认，全部确认后进入完整预览。` : '确认后将自动进入完整预览，也可以改选模型推荐的类型。' }}</p></div><button type="button" aria-label="稍后确认" @click="emit('close')">×</button></header><ContentTypeSelector :doc-id="docId" :name="name" @saved="emit('saved', $event)" /><footer><button type="button" @click="emit('close')">稍后确认</button><span>你的选择将用于切片预览和后续入库。</span></footer></div></dialog></Teleport>
</template>
<style scoped>
.type-dialog{display:block;position:fixed;inset:0;width:min(720px,calc(100vw - 32px));height:fit-content;min-height:0;max-height:calc(100dvh - 48px);margin:auto;padding:0;border:1px solid var(--dp-line);border-radius:14px;color:var(--dp-text);background:var(--dp-panel);overflow:auto;box-shadow:0 24px 90px #0005}.type-dialog:not([open]){display:none}.type-dialog::backdrop{background:#0009;backdrop-filter:blur(4px)}.type-dialog-inner{padding:24px}.type-dialog header{display:flex;justify-content:space-between;gap:16px}.type-dialog header small{color:var(--dp-red);font-size:12px}.type-dialog header h2{font-size:21px;margin:4px 0}.type-dialog header p{color:var(--dp-muted);font-size:13px;margin:6px 0}.type-dialog header button{border:0;background:none;color:var(--dp-muted);font-size:26px;align-self:flex-start}.type-dialog :deep(.content-type-card){padding:0;border:0;margin-top:20px}.type-dialog :deep(.content-type-card header h3){display:none}.type-dialog :deep(progress){display:block;width:100%;height:5px;accent-color:var(--dp-red);margin:12px 0}.type-dialog footer{display:flex;align-items:center;gap:14px;margin-top:20px;padding-top:14px;border-top:1px solid var(--dp-line);font-size:12px;color:var(--dp-muted)}.type-dialog footer button{background:none;border:1px solid var(--dp-line);border-radius:6px;color:var(--dp-muted);padding:6px 10px;white-space:nowrap}@media(max-width:600px){.type-dialog-inner{padding:18px}.type-dialog header h2{font-size:18px}}
</style>
