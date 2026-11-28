<template>
  <div class="simple-stock-panel">
    <div class="stock-summary">
      <span>无条码库存合计 <strong>{{ sumSimpleStock(rows) }}</strong></span>
      <span v-for="type in placeTypes" :key="type">{{ simplePlaceLabel(type) }} <strong>{{ sumSimpleStock(rows.filter(row => row.place_type === type)) }}</strong></span>
    </div>
    <el-card shadow="never">
      <template #header>无条码库存明细</template>
      <el-table :data="displayRows" row-key="displayKey" border size="small" empty-text="暂无无条码库存">
        <el-table-column type="index" label="项次" width="65" />
        <el-table-column label="存放类型" width="110">
          <template #default="{ row }">{{ simplePlaceLabel(row.place_type) }}</template>
        </el-table-column>
        <el-table-column label="仓库" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ row.position.warehouse_name || row.position.warehouse_no || '-' }}</template></el-table-column>
        <el-table-column label="货位编号" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ row.position.location_no || '-' }}</template></el-table-column>
        <el-table-column label="货位名称" min-width="170" show-overflow-tooltip><template #default="{ row }">{{ row.position.location_name || '-' }}</template></el-table-column>
        <el-table-column label="层数" width="70"><template #default="{ row }">{{ row.position.floor_no ?? '-' }}</template></el-table-column>
        <el-table-column label="位置号" width="80"><template #default="{ row }">{{ row.position.position_no ?? '-' }}</template></el-table-column>
        <el-table-column label="位置编码" min-width="160" show-overflow-tooltip><template #default="{ row }">{{ row.position.position_code || '-' }}</template></el-table-column>
        <el-table-column prop="box_name" label="塑料盒名称" min-width="170" show-overflow-tooltip><template #default="{ row }">{{ row.box_name || '-' }}</template></el-table-column>
        <el-table-column prop="box_code" label="塑料盒编码" min-width="150" show-overflow-tooltip><template #default="{ row }">{{ row.box_code || '-' }}</template></el-table-column>
        <el-table-column label="长度（mm）" min-width="120" align="right">
          <template #default="{ row }">{{ row.length_mm != null && /^0(?:\.0+)?$/.test(String(row.length_mm)) ? '-' : formatStockDecimal(row.length_mm) }}</template>
        </el-table-column>
        <el-table-column label="数量" min-width="120" align="right">
          <template #default="{ row }">{{ formatStockDecimal(row.stock_qty) }}</template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="180">
          <template #default="{ row }">{{ row.updated_at ? String(row.updated_at).replace('T', ' ').slice(0, 19) : '-' }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SimpleStockEntry } from '@/api/modules/productInventory'
import { formatStockDecimal, simplePlaceLabel, simpleStockPositionRows, sumSimpleStock } from '@/utils/simpleStockDisplay'

const props = defineProps<{ rows: SimpleStockEntry[] }>()
const displayRows = computed(() => simpleStockPositionRows(props.rows))
const placeTypes = ['POSITION', 'PLASTIC_BOX', 'DISTRIBUTION_SPOT']
</script>

<style scoped>
.simple-stock-panel { display: grid; gap: 16px; }
.stock-summary { display: flex; gap: 24px; flex-wrap: wrap; padding: 16px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--el-bg-color); }
.stock-summary span { color: var(--text-secondary); }
.stock-summary strong { margin-left: 8px; color: var(--text-primary); }
</style>
