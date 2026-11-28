<template>
  <!-- 其他入库单 XC（天心其他入库，2026-11-18 全新模块）：单管线单单据，
       挂在「仓库管理 → 库存管理」菜单下；列表/详情/失败记录全部复用家族通用组件 -->
  <TradeBillList doc-key="other-inbound" />
</template>

<script setup lang="ts">
import TradeBillList from '@/views/trade/TradeBillList.vue'
</script>