<template>
  <el-dialog v-model="visible" title="手动同步单据" width="560px" style="max-width: calc(100vw - 32px)"
    :close-on-click-modal="!submitting" :close-on-press-escape="!submitting" :show-close="!submitting" @open="reset">
    <p class="intro">按 ERP 单号同步最新单据，可用于补齐漏单。已存在的单据会更新为 ERP 最新数据。</p>
    <el-form label-position="top" :disabled="submitting">
      <el-form-item label="单据类型" required>
        <el-select v-model="docKey" style="width: 100%" @change="result = null">
          <el-option v-for="doc in PRODUCTION_DOCS" :key="doc.docKey" :label="doc.name" :value="doc.docKey" />
        </el-select>
      </el-form-item>
      <el-form-item label="ERP 单号" required>
        <el-input v-model="text" type="textarea" :rows="6" placeholder="每行一个单号，也可用逗号或分号分隔" @input="result = null" />
        <div class="input-hint" :class="{ invalid: billNos.length > 50 }">已识别 {{ billNos.length }} 张 · 自动去重 · 每次最多 50 张</div>
      </el-form-item>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <div v-if="result" class="result" aria-live="polite">
      <el-alert :type="hasIssues ? 'warning' : 'success'" :closable="false" show-icon
        :title="`同步完成：请求 ${result.requested} 张，成功 ${result.fetched} 张`" />
      <p v-if="result.missing.length">ERP 未找到：{{ result.missing.join('、') }}</p>
      <p v-for="no in result.failed_nos" :key="no">{{ no }}：{{ result.bill_errors?.[no] || '同步失败，请稍后重试' }}</p>
    </div>
    <template #footer>
      <span v-if="submitting" class="waiting">正在查询 ERP，请稍候…</span>
      <el-button :disabled="submitting" @click="visible = false">关闭</el-button>
      <el-button type="primary" :loading="submitting" :disabled="!billNos.length || billNos.length > 50" @click="submit">开始同步</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { fetchProductionBills, PRODUCTION_DOCS, type ProductionDocKey, type ProductionManualSyncResult } from '@/api/modules/production'

const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{ done: [] }>()
const docKey = ref<ProductionDocKey>(PRODUCTION_DOCS[0].docKey)
const text = ref('')
const submitting = ref(false)
const error = ref('')
const result = ref<ProductionManualSyncResult | null>(null)
const billNos = computed(() => [...new Set(text.value.split(/[\r\n,，;；]+/).map(s => s.trim()).filter(Boolean))])
const hasIssues = computed(() => !!(result.value?.missing.length || result.value?.failed_nos?.length))
function reset() { text.value = ''; error.value = ''; result.value = null }
async function submit() {
  if (submitting.value || !billNos.value.length || billNos.value.length > 50) return
  submitting.value = true
  error.value = ''
  result.value = null
  try {
    result.value = (await fetchProductionBills(docKey.value, billNos.value)).data
    emit('done')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '同步失败，请稍后重试'
  } finally { submitting.value = false }
}
</script>

<style scoped>
.intro { margin: 0 0 20px; color: var(--text-secondary); line-height: 1.7; }
.input-hint, .waiting { font-size: 12px; color: var(--text-tertiary); }
.input-hint.invalid { color: var(--el-color-danger); }
.waiting { margin-right: 12px; }
.result { margin-top: 16px; max-height: 240px; overflow: auto; }
.result p { overflow-wrap: anywhere; color: var(--text-secondary); font-size: 13px; }
</style>
