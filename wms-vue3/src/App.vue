<template>
  <el-config-provider :locale="zhCn">
    <router-view />
    <WmsAgentLauncher />
  </el-config-provider>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useThemeStore } from '@/stores/theme'
import WmsAgentLauncher from '@/agent/ui/WmsAgentLauncher.vue'

const themeStore = useThemeStore()

onMounted(() => {
  themeStore.initTheme()
})
</script>

<style>
/* PageAgent still creates index labels for DOM mapping; only hide their visual layer. */
.playwright-highlight-label {
  display: none !important;
}
</style>
