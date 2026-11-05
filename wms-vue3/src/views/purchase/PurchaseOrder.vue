<template>
  <!-- 天心贸易模式：同一页面就地切换为天心「进货单」数据（走 /tenant-trade/*，只读+手动同步）；
       NATIVE 模式保持 WMS 采购订单原样。映射见 config/tradeDocConfig.ts 的 TRADE_SHARED_PAGES。

       ★ 2026-09-21 修正：天心侧采购只涉及「采购订单 + 采购退货单」两个业务，
         「进货单」的承载页是**采购订单**（此前误挂在采购入库单页，已纠正）。 -->
  <TradeBillList v-if="isTianxinTrade" doc-key="purchase-order" />
  <PurchaseGenericList v-else type="order" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import PurchaseGenericList from './PurchaseGenericList.vue'
import TradeBillList from '@/views/trade/TradeBillList.vue'
import { useTradeModeStore } from '@/stores/tradeMode'

const tradeModeStore = useTradeModeStore()
const isTianxinTrade = computed(() => tradeModeStore.isTianxin)
</script>
