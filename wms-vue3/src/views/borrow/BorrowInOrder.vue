<template>
  <!-- 借入单 BN（天心借出借入，2026-10-30 全新模块）：入库侧源头单，导入时生成 BORROW_IN 入库条码 -->
  <TradeBillList doc-key="borrow-in-order" />
</template>

<script setup lang="ts">
import TradeBillList from '@/views/trade/TradeBillList.vue'
</script>
