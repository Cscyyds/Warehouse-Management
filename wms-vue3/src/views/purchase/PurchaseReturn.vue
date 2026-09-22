<template>
  <!-- 天心贸易模式：同一页面就地切换为天心「进货退回单」数据（走 /tenant-trade/*，只读+手动同步）；
       NATIVE 模式保持 WMS 采购退货单原样。映射见 config/tradeDocConfig.ts 的 TRADE_SHARED_PAGES -->
  <TradeBillList v-if="isTianxinTrade" doc-key="purchase-return" />
  <PurchaseGenericList v-else type="return" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import PurchaseGenericList from './PurchaseGenericList.vue'
import TradeBillList from '@/views/trade/TradeBillList.vue'
import { useTradeModeStore } from '@/stores/tradeMode'

const tradeModeStore = useTradeModeStore()
const isTianxinTrade = computed(() => tradeModeStore.isTianxin)
</script>
