<template>
  <el-card shadow="never" v-loading="loading">
    <template #header>操作记录</template>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <el-table :data="records" row-key="log_id" empty-text="暂无操作记录">
      <el-table-column label="操作" min-width="130">
        <template #default="{ row }">{{ actionNames[String(row.action ?? '').trim().toLowerCase()] || '其他操作' }}</template>
      </el-table-column>
      <el-table-column prop="operator_name" label="操作人" min-width="110" />
      <el-table-column label="时间" min-width="170">
        <template #default="{ row }">{{ formatNativeDateTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column prop="allocated_qty" label="作业数量" width="105" />
    </el-table>
    <el-pagination v-if="total > size" v-model:current-page="page" :page-size="size"
      :total="total" layout="total, prev, pager, next" @current-change="load" />
  </el-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { listNativeOperations, type NativeDocKey, type NativeOperationRow } from '@/api/modules/productionNative'
import { formatNativeDateTime, nativeError } from '../nativeBillForm'

const props = defineProps<{ docKey: NativeDocKey; billId: string; version: number }>()
const actionNames: Record<string, string> = {
  create: '建单', update: '编辑表头', audit: '审核', unaudit: '反审核', delete: '删除单据',
  'items/create': '新增明细', 'items/update': '编辑明细', 'items/delete': '删除明细',
  'warehouse/send': '发送仓库', 'warehouse/cancel-send': '撤销发送', scan: '扫码',
  confirm: '人工完结', 'simple-complete': '简易作业',
  stock_reservation: '库存预留调整', stock_conversion: '历史库存转换',
  apply: '占用冲减', reverse: '撤回冲减', finalize: '固化冲减',
  pick_outbound: '领料出库', return_inbound: '退料入库', fg_inbound: '缴库入库',
  simple_pick_outbound: '简易领料出库', simple_return_inbound: '简易退料入库',
  simple_fg_inbound: '简易缴库入库', manual_close: '人工完结',
}
const records = ref<NativeOperationRow[]>([])
const page = ref(1)
const size = ref(20)
const total = ref(0)
const loading = ref(false)
const error = ref('')
let listSequence = 0

async function load() {
  const id = ++listSequence
  loading.value = true
  error.value = ''
  try {
    const { data } = await listNativeOperations(props.docKey, {
      bill_id: props.billId, page: page.value, page_size: size.value,
    }, { silent: true })
    if (id !== listSequence) return
    records.value = data.items
    total.value = data.total
    size.value = data.page_size
  } catch (err) {
    if (id === listSequence) error.value = nativeError(err).message
  } finally {
    if (id === listSequence) loading.value = false
  }
}

watch(() => [props.billId, props.version], () => {
  page.value = 1
  void load()
}, { immediate: true })
</script>
