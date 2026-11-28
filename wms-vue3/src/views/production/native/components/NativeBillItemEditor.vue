<template>
  <div v-show="!inlineProductPicker || !pickingProducts" class="line-editor">
    <template v-if="isReturn">
      <div class="return-source-toolbar">
        <el-input v-model="sourceKeyword" clearable placeholder="搜索产品编码 / 名称" :disabled="disabled || !sources.length" />
        <span>已选 {{ rows.length }} 条</span>
      </div>
      <el-table max-height="560" class="wms-detail-items" :data="visibleSources" row-key="item_id" border empty-text="当前来源领料单暂无明细"
        @selection-change="selectReturnSources">
        <el-table-column type="selection" width="50" align="center" :reserve-selection="true" :selectable="isSourceSelectable" />
        <el-table-column prop="line_no" label="项次" width="65" />
        <el-table-column label="产品" min-width="190" show-overflow-tooltip fixed="left">
          <template #default="{ row }">{{ row.product_code }} {{ row.product_name }}</template>
        </el-table-column>
        <el-table-column label="单位" width="75">
          <template #default="{ row }">{{ row.unit_name?.trim() || '-' }}</template>
        </el-table-column>
        <el-table-column label="可退数量" width="105" align="right">
          <template #default="{ row }">{{ returnableQuantity(row) }}</template>
        </el-table-column>
        <el-table-column label="退料数量" min-width="135" label-class-name="wms-required-column" align="right">
          <template #default="{ row }">
            <el-input v-if="returnDraft(row)" :model-value="returnDraft(row)!.qty" inputmode="decimal" maxlength="19"
              aria-label="退料数量" :disabled="disabled" @update:model-value="updateReturnField(row, 'qty', $event)" />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="可退状态" min-width="155">
          <template #default="{ row }">{{ sourceBlockedReason(row) || '可退料' }}</template>
        </el-table-column>
        <el-table-column label="备注" min-width="155">
          <template #default="{ row }">
            <el-input v-if="returnDraft(row)" :model-value="returnDraft(row)!.remark" aria-label="明细备注"
              maxlength="500" :disabled="disabled" @update:model-value="updateReturnField(row, 'remark', $event)" />
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
    </template>
    <el-button v-else v-perm="'GET /api/v1/tenant-products/search'" :disabled="disabled || rows.length >= 200"
      @click="pickingProducts = true">选择产品</el-button>
    <el-table max-height="560" class="wms-detail-items" v-if="!isReturn" :data="rows" row-key="key" border empty-text="暂无明细">
      <el-table-column type="index" width="52" label="项次" />
      <el-table-column label="产品" min-width="175" show-overflow-tooltip fixed="left">
        <template #default="{ row }">{{ row.productCode }} {{ row.productName }}</template>
      </el-table-column>
      <el-table-column label="单位" width="75">
        <template #default="{ row }">{{ row.unitName.trim() || '-' }}</template>
      </el-table-column>
      <el-table-column :label="isReturn ? '退料数量' : '数量'" min-width="135" label-class-name="wms-required-column">
        <template #default="{ row }">
          <el-input v-model="row.qty" inputmode="decimal" maxlength="19" :aria-label="isReturn ? '退料数量' : '数量'" :disabled="disabled" />
        </template>
      </el-table-column>
      <el-table-column v-if="!isReturn" label="长度" min-width="175">
        <template #default="{ row }">
          <div v-if="row.lengthApplicable" class="length-entry">
            <el-input v-model="row.length" aria-label="长度" inputmode="decimal" maxlength="19" :disabled="disabled" />
            <el-select v-model="row.lengthUnit" aria-label="长度单位" :disabled="disabled">
              <el-option v-for="unit in NATIVE_LENGTH_UNITS" :key="unit" :value="unit" :label="unit" />
            </el-select>
          </div>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column v-if="docKey === 'production-picking'" label="先进先出" width="100" align="center">
        <template #default="{ row }"><el-switch v-model="row.xjxc" :active-value="1" :inactive-value="0" :disabled="disabled" /></template>
      </el-table-column>
      <el-table-column label="备注" min-width="155">
        <template #default="{ row }"><el-input v-model="row.remark" aria-label="明细备注" maxlength="500" :disabled="disabled" /></template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button link type="danger" :disabled="disabled" @click="rows = rows.filter(item => item.key !== row.key)">移除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
  <ProductSelectDialog v-if="!isReturn && (inlineProductPicker || pickingProducts)" v-model="pickingProducts" :inline="inlineProductPicker"
    :hide-return-button="inlineProductPicker && docKey === 'finished-goods-stockin'"
    :inline-table-height="inlineProductPicker && docKey === 'finished-goods-stockin' ? '100%' : undefined"
    product-type="GOODS" multiple @confirm-multiple="addProducts" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { ProductItem } from '@/api/modules/product'
import { NATIVE_LENGTH_UNITS, type NativeDocKey, type NativeItemRow } from '@/api/modules/productionNative'
import ProductSelectDialog from '@/views/product/ProductSelectDialog.vue'
import { newDraft, sourceDraft, type DraftLine } from '../nativeBillForm'

const props = withDefaults(defineProps<{ docKey: NativeDocKey; disabled?: boolean; sources?: NativeItemRow[]; inlineProductPicker?: boolean }>(), {
  sources: () => [],
})
const rows = defineModel<DraftLine[]>({ required: true })
const isReturn = computed(() => props.docKey === 'production-return')
const pickingProducts = defineModel<boolean>('pickingProducts', { default: false })
const sourceKeyword = ref('')
const visibleSources = computed(() => {
  const keyword = sourceKeyword.value.trim().toLowerCase()
  return props.sources.filter(row => !keyword || [row.product_code, row.product_name]
    .some(value => value?.toLowerCase().includes(keyword)))
})
const returnDrafts = computed(() => new Map(rows.value.map(row => [row.sourceItemId, row])))

function returnDraft(row: NativeItemRow) {
  return returnDrafts.value.get(row.item_id)
}

function updateReturnField(row: NativeItemRow, field: 'qty' | 'remark', value: string) {
  const draft = returnDraft(row)
  if (draft) draft[field] = value
}

function decimalToScaled(value?: string | null) {
  if (!value || !/^\d+(?:\.\d{1,4})?$/.test(value)) return 0n
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'))
}

function scaledToDecimal(value: bigint) {
  if (value <= 0n) return '0'
  const fraction = (value % 10000n).toString().padStart(4, '0').replace(/0+$/, '')
  return (value / 10000n).toString() + (fraction ? `.${fraction}` : '')
}

function returnableQuantity(row: NativeItemRow) {
  const available = decimalToScaled(row.remaining_qty) + decimalToScaled(row.actual_qty)
    - decimalToScaled(row.actual_physical_return_qty) - decimalToScaled(row.pending_physical_return_qty)
  return scaledToDecimal(available)
}

function sourceBlockedReason(row: NativeItemRow) {
  if (row.exception_status === 'PAUSED') return '明细已暂停'
  if (returnableQuantity(row) === '0') return '无可退数量'
  return ''
}

function isSourceSelectable(row: NativeItemRow) {
  return !props.disabled && !sourceBlockedReason(row)
}

function selectReturnSources(selection: NativeItemRow[]) {
  const selectedIds = new Set(selection.map(row => row.item_id))
  const existing = returnDrafts.value
  rows.value = props.sources
    .filter(row => selectedIds.has(row.item_id) && isSourceSelectable(row))
    .map(row => existing.get(row.item_id) ?? sourceDraft(row))
}

function addProducts(products: ProductItem[]) {
  if (rows.value.length + products.length > 200) {
    ElMessage.warning('单次最多提交 200 条明细')
    return
  }
  rows.value = [...rows.value, ...products.map(product =>
    newDraft(product.product_id, product.product_code, product.product_name, product.unit_name ?? '', product.assist_unit_name))]
}
</script>

<style scoped>
.line-editor { display: grid; gap: 12px; justify-items: start; }
.return-source-toolbar { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.return-source-toolbar .el-input { width: min(360px, 100%); }
.return-source-toolbar span { color: var(--el-text-color-secondary); white-space: nowrap; }
.length-entry { display: grid; grid-template-columns: minmax(0, 1fr) 72px; gap: 6px; }
</style>
