<template>
  <!-- 采购入库单：**不参与天心侧**（天心采购只涉及采购订单与采购退货单），
       因此本页在天心 / NATIVE 两种模式下都保持 WMS 原样渲染，不做就地切换。

       ⚠️ 但天心模式下后端对本单的**写**接口仍会 403（`require_purchase_sales_write_access`
          覆盖采购单 / 入库单 / 采购退货三族），故写入口由 PurchaseGenericList 内的
          `canWrite` 门负责隐藏（见 composables/useTradeModeGate.ts）——本包装页无需处理。

       ★ 2026-09-21 修正：此前本页被误设为「进货单」的承载页，已改挂到采购订单页。 -->
  <PurchaseGenericList type="inbound" />
</template>
<script setup lang="ts">
import PurchaseGenericList from './PurchaseGenericList.vue'
</script>
