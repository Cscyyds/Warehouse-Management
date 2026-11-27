<template>
  <el-card v-if="result" shadow="never">
    <template #header>冲减预计算</template>
    <el-alert :type="result.can_submit ? 'success' : 'warning'" :closable="false" show-icon
      :title="result.can_submit ? '校验通过，可以保存' : '部分明细无法提交，请调整退料数量'" />
    <el-table :data="result.items" row-key="client_line_id">
      <el-table-column label="产品" min-width="155">
        <template #default="{ row }">{{ labels[row.client_line_id] || row.source_picking_item_id }}</template>
      </el-table-column>
      <el-table-column prop="return_qty" label="本次退料" width="105" />
      <el-table-column prop="max_return_qty" label="可退上限" width="105" />
      <el-table-column prop="available_physical_return_qty" label="可实退" width="95" />
      <el-table-column prop="deduct_pending_qty" label="待领冲减" width="105" />
      <el-table-column prop="source_remaining_after" label="来源剩余" width="105" />
      <el-table-column label="校验结果" min-width="180">
        <template #default="{ row }">
          <el-tag v-if="row.can_submit" type="success" size="small">可提交</el-tag>
          <span v-else>{{ row.blocked_reason_message || row.blocked_reason || '无法提交' }}</span>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import type { DeductionPreviewResult } from '@/api/modules/productionNative'

defineProps<{ result: DeductionPreviewResult | null; labels: Record<string, string> }>()
</script>
