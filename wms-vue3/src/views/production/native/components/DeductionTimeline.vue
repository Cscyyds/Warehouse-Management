<template>
  <el-card shadow="never" v-loading="loading">
    <template #header>冲减台账</template>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <el-empty v-else-if="!loading && !records.length" description="暂无冲减记录" :image-size="56" />
    <el-timeline v-else>
      <el-timeline-item v-for="row in records" :key="row.deduction_id" :timestamp="formatNativeDateTime(row.created_at)">
        <strong>{{ actions[row.action] || row.action }}</strong>
        <span> · 数量 {{ row.qty }} · {{ row.operator_name || '—' }}</span>
        <div v-if="row.source_remaining_before != null && row.source_remaining_after != null">
          来源待领 {{ row.source_remaining_before }} → {{ row.source_remaining_after }}
        </div>
        <div v-if="row.reason">{{ row.reason }}</div>
      </el-timeline-item>
    </el-timeline>
    <el-pagination v-if="total > size" v-model:current-page="page" :page-size="size"
      :total="total" layout="total, prev, pager, next" @current-change="load" />
  </el-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { listDeductionRecords, type DeductionRecordRow } from '@/api/modules/productionNative'
import { formatNativeDateTime, nativeError } from '../nativeBillForm'

const props = defineProps<{ billId: string; version: number }>()
const actions = { APPLY: '占用冲减', REVERSE: '撤回冲减', FINALIZE: '固化冲减' }
const records = ref<DeductionRecordRow[]>([])
const page = ref(1)
const size = ref(20)
const total = ref(0)
const loading = ref(false)
const error = ref('')
let sequence = 0

async function load() {
  const id = ++sequence
  loading.value = true
  error.value = ''
  try {
    const { data } = await listDeductionRecords({ return_id: props.billId, page: page.value, page_size: size.value }, { silent: true })
    if (id !== sequence) return
    records.value = data.items
    total.value = data.total
    size.value = data.page_size
  } catch (err) {
    if (id === sequence) error.value = nativeError(err).message
  } finally {
    if (id === sequence) loading.value = false
  }
}

watch(() => [props.billId, props.version], () => {
  page.value = 1
  void load()
}, { immediate: true })
</script>
