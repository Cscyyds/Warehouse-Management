<template>
  <el-dialog :model-value="modelValue" :title="`选择${PDF_PRINT_TITLES[kind]}用于预览`" width="760px"
    :close-on-click-modal="false" append-to-body @update:model-value="emit('update:modelValue', $event)">
    <el-form inline @submit.prevent="search">
      <el-form-item label="单号"><el-input v-model="keyword" clearable placeholder="输入单号查找" @keyup.enter="search" /></el-form-item>
      <el-form-item><el-button type="primary" :loading="loading" @click="search">查询</el-button></el-form-item>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-table v-loading="loading" :data="rows" border height="360" empty-text="暂无可用于预览的单据">
      <el-table-column prop="no" label="单据编号" min-width="200" />
      <el-table-column prop="partyName" :label="kind === 'purchase' ? '供应商' : '客户'" min-width="180" />
      <el-table-column label="操作" width="130"><template #default="{ row }">
        <el-button link type="primary" @click="select(row)">用于预览</el-button>
      </template></el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :page-size="20" :total="total" layout="prev, pager, next, total"
      class="sample-pagination" @current-change="load" />
    <template #footer><el-button @click="emit('update:modelValue', false)">关闭</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { getPdfPreviewSamples, type PdfPreviewSample } from '@/api/modules/pdfPreviewSamples'
import { PDF_PRINT_TITLES } from '@/utils/pdfPrintSettings'
import type { PdfDocKind } from '@/config/pdfExportOptions'

const props = defineProps<{ modelValue: boolean; kind: PdfDocKind }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; select: [sample: PdfPreviewSample] }>()
const keyword = ref('')
const page = ref(1)
const total = ref(0)
const rows = ref<PdfPreviewSample[]>([])
const error = ref('')
const loading = ref(false)
let sequence = 0

async function load() {
  const current = ++sequence
  const kind = props.kind
  const token = localStorage.getItem('token')
  loading.value = true
  error.value = ''
  rows.value = []
  try {
    const result = await getPdfPreviewSamples(kind, { page: page.value, page_size: 20, keyword: keyword.value })
    if (current !== sequence || token !== localStorage.getItem('token') || !props.modelValue) return
    rows.value = result.items
    total.value = result.total
  } catch (err: any) {
    if (current === sequence) { error.value = err?.message || '读取单据失败，请重新查询'; total.value = 0 }
  } finally { if (current === sequence) loading.value = false }
}
function search() { page.value = 1; void load() }
function select(sample: PdfPreviewSample) { emit('select', sample); emit('update:modelValue', false) }

watch(() => [props.modelValue, props.kind] as const, ([open]) => {
  sequence++
  if (!open) { loading.value = false; return }
  keyword.value = ''; page.value = 1; total.value = 0
  void load()
}, { immediate: true })
</script>

<style scoped>
.sample-pagination { justify-content: flex-end; margin-top: 16px; }
</style>
