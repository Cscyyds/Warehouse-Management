<template>
  <el-config-provider :locale="zhCn">
    <router-view />
    <WmsAgentLauncher v-if="showAgentLauncher" />
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useThemeStore } from '@/stores/theme'
import WmsAgentLauncher from '@/agent/ui/WmsAgentLauncher.vue'

const route = useRoute()
const themeStore = useThemeStore()

/** 宣传页与登录页不显示 WMS 页面助手悬浮窗 */
const NO_LAUNCHER_PATHS = new Set(['/', '/login'])
const showAgentLauncher = computed(() => !NO_LAUNCHER_PATHS.has(route.path))

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
