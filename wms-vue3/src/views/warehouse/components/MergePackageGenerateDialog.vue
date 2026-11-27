<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { generateMergePackages, type GeneratedMergePackage, type MergePackageListItem } from '@/api/modules/scannerMergePackage'
import { getProductDetail } from '@/api/modules/product'
import { mergeGenerateError, generatedQuantityTotal, mergeProductLengthUnit, runMergeGenerationBatch, type MergeGenerationJob } from '@/utils/mergePackageGenerate'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ items: MergePackageListItem[] }>()
const emit = defineEmits<{ created: []; print: [rows: { id: string; title: string; subtitle: string }[]]; closed: [] }>()
const jobs = ref<MergeGenerationJob[]>([])
const saving = ref(false)
const error = ref('')
const lengthUnits = ref<Record<string, string | undefined>>({})
const lengthLoading = ref(false)
const lengthError = ref('')
let lengthLoadVersion = 0
const session = () => `${localStorage.getItem('company_id') || ''}:${localStorage.getItem('token') || ''}`
let sessionAtOpen = ''
let disposed = false
const counts = computed(() => ({
  pending: jobs.value.filter(row => row.status === 'pending').length,
  success: jobs.value.filter(row => row.status === 'success').length,
  failed: jobs.value.filter(row => row.status === 'failed').length,
  unknown: jobs.value.filter(row => row.status === 'unknown').length,
}))
const generated = computed(() => jobs.value.flatMap(job => job.generated.map(row => ({ ...row, productName: job.productName, productCode: job.productCode }))))
const statusText = { pending: '未发送', running: '生成中', success: '成功', failed: '失败', unknown: '结果未确认' }

watch(() => props.items, items => {
  if (saving.value) return
  sessionAtOpen = session()
  error.value = ''
  jobs.value = items.map((row, index) => ({
    key: `${row.merge_package_id}:${index}`, productCode: row.product_code, productName: row.product_name, sourceBarcode: row.barcode_code,
    draft: { productId: row.product_id, quantity: row.merge_qty == null ? '' : String(row.merge_qty), count: '1', specifyLength: false, length: '', lengthUnit: 'mm' },
    status: 'pending', generated: [], error: '',
  }))
  void loadLengthUnits()
}, { immediate: true })
onBeforeUnmount(() => { disposed = true })

async function loadLengthUnits() {
  const version = ++lengthLoadVersion
  const requestSession = sessionAtOpen
  const productIds = [...new Set(jobs.value.map(job => job.draft.productId))]
  lengthUnits.value = {}
  lengthError.value = ''
  lengthLoading.value = productIds.length > 0
  const results = await Promise.allSettled(productIds.map(async productId => {
    const { data } = await getProductDetail(productId, { silent: true })
    return mergeProductLengthUnit(data)
  }))
  if (disposed || version !== lengthLoadVersion || requestSession !== session()) return
  results.forEach((result, index) => {
    const productId = productIds[index]!
    if (result.status === 'fulfilled') {
      lengthUnits.value[productId] = result.value
      jobs.value.filter(job => job.draft.productId === productId).forEach(job => {
        job.draft.lengthUnit = result.value ?? ''
        if (!result.value) { job.draft.specifyLength = false; job.draft.length = '' }
      })
    } else {
      const job = jobs.value.find(job => job.draft.productId === productId)
      lengthError.value = `${job?.productCode || '产品'}：读取辅助计量单位失败，请重试`
    }
  })
  lengthLoading.value = false
}

async function generate(scope: 'pending' | 'failed' = 'pending') {
  if (saving.value || lengthLoading.value || lengthError.value) return
  if (sessionAtOpen !== session()) { error.value = '登录会话已变化，请关闭并重新勾选'; return }
  const selected = jobs.value.filter(job => job.status === scope)
  if (!selected.length) return
  for (const [index, job] of selected.entries()) {
    const invalid = mergeGenerateError(job.draft)
    if (invalid) { error.value = `${job.productCode || `第${index + 1}项`}：${invalid}`; return }
  }
  const requestSession = sessionAtOpen
  selected.forEach(job => { job.status = 'pending' })
  saving.value = true
  error.value = ''
  try {
    error.value = await runMergeGenerationBatch(selected, generateMergePackages, { isActive: () => !disposed && requestSession === session() })
    if (disposed || requestSession !== session()) return
    if (selected.some(job => job.status === 'success' || job.status === 'unknown')) emit('created')
    const successes = selected.filter(job => job.status === 'success').length
    if (successes) ElMessage.success(`本批成功 ${successes} 项，已生成条码保留在下方`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '批量生成失败'
  } finally { saving.value = false }
}

function print() {
  if (saving.value || !generated.value.length) return
  emit('print', generated.value.map(row => ({ id: row.merge_package_id, title: row.productName || '合包条码', subtitle: row.barcode_code })))
  open.value = false
}
function beforeClose(done: () => void) { if (!saving.value) done() }
function editable(job: MergeGenerationJob) { return !saving.value && (job.status === 'pending' || job.status === 'failed') }
</script>

<template>
  <el-dialog v-model="open" title="批量生成合包条码" width="min(1250px, 96vw)"
    :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving"
    :before-close="beforeClose" @closed="emit('closed')">
    <p>已从主表勾选 {{ jobs.length }} 条记录</p>
    <el-alert v-if="error" :title="error" type="warning" :closable="false" show-icon />
    <el-alert v-if="lengthError" :title="lengthError" type="warning" :closable="false" show-icon>
      <el-button link type="primary" :disabled="lengthLoading || saving" @click="loadLengthUnits">重新读取产品单位</el-button>
    </el-alert>
    <div class="batch-summary">
      <span>成功 {{ counts.success }}</span><span>失败 {{ counts.failed }}</span>
      <span>结果未确认 {{ counts.unknown }}</span><span>未发送 {{ counts.pending }}</span>
    </div>
    <el-table :data="jobs" row-key="key" border empty-text="请先在合包表格中勾选记录">
      <el-table-column label="产品" min-width="185"><template #default="{ row }">{{ row.productCode }} {{ row.productName }}</template></el-table-column>
      <el-table-column prop="sourceBarcode" label="勾选的合包条码" min-width="160" />
      <el-table-column label="单包数量" min-width="140"><template #default="{ row }"><el-input v-model="row.draft.quantity" aria-label="单包数量" inputmode="decimal" maxlength="19" :disabled="!editable(row)" /></template></el-table-column>
      <el-table-column label="生成件数" min-width="110"><template #default="{ row }"><el-input v-model="row.draft.count" aria-label="生成件数" inputmode="numeric" maxlength="6" :disabled="!editable(row)" /></template></el-table-column>
      <el-table-column label="长度" min-width="230"><template #default="{ row }">
        <span v-if="lengthLoading">读取中</span>
        <span v-else-if="!Object.hasOwn(lengthUnits, row.draft.productId)">读取失败</span>
        <template v-else-if="lengthUnits[row.draft.productId]">
          <el-checkbox v-model="row.draft.specifyLength" :disabled="!editable(row)">指定长度</el-checkbox>
          <div v-if="row.draft.specifyLength" class="length-input"><el-input v-model="row.draft.length" aria-label="合包长度" inputmode="decimal" maxlength="19" :disabled="!editable(row)" /><el-select v-model="row.draft.lengthUnit" aria-label="长度单位" :disabled="!editable(row)"><el-option v-for="unit in ['m','dm','cm','mm']" :key="unit" :label="unit" :value="unit" /></el-select></div>
        </template>
        <span v-else class="length-empty">-</span>
      </template></el-table-column>
      <el-table-column label="本项数量合计" min-width="120"><template #default="{ row }">{{ generatedQuantityTotal(row.draft.quantity, row.draft.count) }}</template></el-table-column>
      <el-table-column label="状态" width="110"><template #default="{ row }">{{ statusText[row.status as keyof typeof statusText] }}</template></el-table-column>
      <el-table-column prop="error" label="失败或未确认原因" min-width="220" show-overflow-tooltip />
    </el-table>
    <template v-if="generated.length">
      <h4>已生成 {{ generated.length }} 个合包条码</h4>
      <el-table :data="generated" row-key="merge_package_id" border>
        <el-table-column prop="productCode" label="产品编码" min-width="130" />
        <el-table-column prop="barcode_code" label="新合包条码" min-width="180" />
        <el-table-column prop="merge_qty" label="单包数量" width="120" />
        <el-table-column label="长度" min-width="140"><template #default="{ row }"><span :class="{ 'length-empty': !row.merge_length_text }">{{ row.merge_length_text || '-' }}</span></template></el-table-column>
      </el-table>
    </template>
    <template #footer>
      <el-button v-if="generated.length" type="primary" :disabled="saving" @click="print">{{ generated.length === 1 ? '打印' : '批量打印' }}</el-button>
      <el-button :disabled="saving" @click="open = false">关闭</el-button>
      <el-button v-if="counts.failed" :disabled="saving || lengthLoading || !!lengthError" @click="generate('failed')">重试失败项（{{ counts.failed }}）</el-button>
      <el-button v-if="counts.pending" type="primary" :loading="saving" :disabled="lengthLoading || !!lengthError" @click="generate('pending')">{{ counts.unknown ? '已核对，继续未发送项' : '批量生成条码' }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.length-input { display: grid; grid-template-columns: minmax(90px, 1fr) 80px; gap: 8px; }
.length-empty { display: block; width: 100%; text-align: center; }
.batch-summary { display: flex; gap: 20px; margin: 14px 0; flex-wrap: wrap; }
</style>
