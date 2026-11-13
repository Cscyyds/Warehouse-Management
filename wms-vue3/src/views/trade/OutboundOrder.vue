<template>
  <!-- 出库单 CK（天心，2026-10-30 阶段一）：销售侧出库作业载体。
       与四张贸易单据同协议，但无 WMS 原生宿主页 ⇒ 独立成页；SA 的作业列已迁至本单据。 -->
  <TradeBillList doc-key="outbound-order" />
</template>

<script setup lang="ts">
import TradeBillList from './TradeBillList.vue'
</script>
