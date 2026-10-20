<template>
  <!-- messageConfig.duration 仅由 el-config-provider 写入；显式传 duration 的调用点不受影响。
       但 EP 按「等于默认值 3000」判定未显式传参，故显式写 3000 也会被改成 1500。 -->
  <el-config-provider :locale="zhCn" :message="{ duration: 1500 }">
    <!-- 登录成功时启用圆形揭示过渡（transitionName='reveal'），其余路由切换无动画。
         顶层 router-view 只在 Login ↔ MainLayout 之间切换（业务页都是 MainLayout 子路由），
         故不加 :key，避免子页面导航时重挂载布局。 -->
    <router-view v-slot="{ Component }">
      <Transition :name="transitionName" @after-enter="onRevealAfterEnter">
        <component :is="Component" />
      </Transition>
    </router-view>
    <WmsAgentLauncher v-if="showAgentLauncher" />
    <!-- 登录成功揭示转场的装饰层（欢迎语）：挂在 router-view 外，Login 卸载后仍存活 -->
    <LoginTakeover />
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useThemeStore } from '@/stores/theme'
import WmsAgentLauncher from '@/agent/ui/WmsAgentLauncher.vue'
import LoginTakeover from '@/components/LoginTakeover.vue'
import { useLoginTakeover } from '@/composables/useLoginTakeover'

const route = useRoute()
const themeStore = useThemeStore()
const { revealActive } = useLoginTakeover()

/** 仅登录成功那一次路由切换使用 reveal 过渡（Login 在 push 前置位 revealActive），其余切换无动画 */
const transitionName = computed(() => (revealActive.value ? 'reveal' : ''))
function onRevealAfterEnter() {
  revealActive.value = false
}

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

/* ── 登录成功圆形揭示转场 ──
   旧页面（Login）fixed 垫底，新页面（MainLayout）以按钮圆心为原点、
   clip-path 圆从 0 扩到覆盖全屏，透过圆洞实时显现——
   锚点坐标由 useLoginTakeover.setOrigin 写入 :root 的 --reveal-x/y/r。 */
.reveal-leave-active {
  /* !important 是必需的：页面组件 scoped 样式（如 .login-page[data-v]{position:relative}）
     的特异性高于单类 .reveal-leave-active，不加会被盖掉而导致新旧页面普通流并排 */
  position: fixed !important;
  inset: 0 !important;
  z-index: 0;
  /* 占位动画：与揭示动画等长，确保扩散期间登录页留在底层被逐渐覆盖 */
  animation: revealHold 0.9s both;
}
@keyframes revealHold {
  from { opacity: 1; }
  to { opacity: 1; }
}
.reveal-enter-active {
  position: relative;
  z-index: 1;
  animation: revealCircleExpand 0.9s cubic-bezier(0.22, 0.8, 0.32, 1) both;
}
@keyframes revealCircleExpand {
  from { clip-path: circle(0px at var(--reveal-x, 50%) var(--reveal-y, 50%)); }
  to { clip-path: circle(var(--reveal-r, 150vmax) at var(--reveal-x, 50%) var(--reveal-y, 50%)); }
}
</style>
