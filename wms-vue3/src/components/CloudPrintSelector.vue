<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listCloudPrinters, type CloudPrinter } from '@/api/modules/cloudPrint'
defineProps<{ disabled?: boolean }>()
const mode = defineModel<'LOCAL' | 'CLOUD'>('mode', { required: true })
const printer = defineModel<string>('printer', { required: true })
const style = defineModel<'BARCODE' | 'QRCODE'>('style', { required: true })
const printers = ref<CloudPrinter[]>([])
const loading = ref(false)
async function refresh() {
  loading.value = true
  try {
    printers.value = (await listCloudPrinters()).list.filter(row => row.status === 1)
    if (!printers.value.some(row => row.cloud_printer_id === printer.value)) printer.value = ''
  } finally { loading.value = false }
}
onMounted(() => { if (mode.value === 'CLOUD') void refresh() })
</script>

<template>
  <div class="cloud-selector">
    <el-radio-group v-model="mode" :disabled="disabled" @change="mode === 'CLOUD' && refresh()">
      <el-radio-button value="LOCAL">本地打印</el-radio-button>
      <el-radio-button value="CLOUD">云打印</el-radio-button>
    </el-radio-group>
    <template v-if="mode === 'CLOUD'">
      <el-select v-model="printer" :disabled="disabled" :loading="loading" placeholder="选择云打印机" style="width:260px">
        <el-option v-for="row in printers" :key="row.cloud_printer_id" :value="row.cloud_printer_id" :label="`${row.name}（${row.sn}）`" />
      </el-select>
      <el-select v-model="style" :disabled="disabled" style="width:150px">
        <el-option value="BARCODE" label="条码标签" /><el-option value="QRCODE" label="仅二维码" />
      </el-select>
      <el-button :disabled="disabled" @click="refresh">刷新打印机</el-button>
      <span class="hint">设备和纸张规格在「打印机配置 → 云打印」维护；双排每份出两张同内容标签。</span>
    </template>
  </div>
</template>
<style scoped>
.cloud-selector { display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin-bottom:16px; }
.hint { color:var(--text-secondary); font-size:12px; }
</style>
