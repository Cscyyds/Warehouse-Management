<template>
  <!-- 借出还入单 LB（天心借出借入）：导入自动冲减借出待出库并为待回仓行生成 LEND_RETURN 入库条码 -->
  <TradeBillList doc-key="lend-out-return" />
</template>

<script setup lang="ts">
import TradeBillList from '@/views/trade/TradeBillList.vue'
</script>
