<template>
  <!-- 借入还出单 BB（天心借出借入）：导入即自动冲减借入待入库并联动可用库存 -->
  <TradeBillList doc-key="borrow-in-return" />
</template>

<script setup lang="ts">
import TradeBillList from '@/views/trade/TradeBillList.vue'
</script>
