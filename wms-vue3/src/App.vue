<template>
  <!-- messageConfig.duration 仅由 el-config-provider 写入；显式传 duration 的调用点不受影响。
       但 EP 按「等于默认值 3000」判定未显式传参，故显式写 3000 也会被改成 1500。 -->
  <el-config-provider :locale="zhCn" :message="{ duration: 1500 }">
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

/** 宣传页、登录页、预约试用页与个人信息保护声明页不显示 WMS 页面助手悬浮窗 */
const NO_LAUNCHER_PATHS = new Set(['/', '/login', '/trial', '/privacy'])
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
