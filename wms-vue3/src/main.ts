import { createApp } from 'vue'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from './router'
import ElementPlus, { ElMessage } from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import './styles/index.scss'
import { initializePageAgent } from '@/plugins/pageAgent'
import { installTableColumnResizeEnhancer } from '@/utils/tableColumnResizeEnhancer'
import { vPerm } from '@/directives/perm'
import { onSessionExpired } from '@/utils/session'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus)
// 按钮级权限可视化：v-perm="'POST /api/v1/xxx/create'"（接口 URL → perm_code，见 src/directives/perm.ts）
app.directive('perm', vPerm)

// ── 全局错误兜底 ──────────────────────────────────────────────
// MainLayout 的 onErrorCaptured 只能捕获其后代组件的渲染错误；
// 但逃逸出 Vue 组件隔离的错误（vnode 生命周期钩子、调度器任务、
// 懒加载路由 chunk 加载失败、App.vue/外壳初始挂载期抛错）会冒泡到根，
// 若无全局 handler，这些错误既不被捕获也不打印，表现为「整页空白且
// 后续切换全白、控制台无报错、只有刷新才恢复」。
// 这里兜住它们：打印到控制台便于定位，并给用户一个可见提示而非静默空白。
let lastErrorAt = 0
app.config.errorHandler = (err, _instance, info) => {
  console.error('[Vue 全局错误]', info, err)
  // 简单节流：同一时刻多条错误只弹一次提示，避免消息刷屏
  const now = Date.now()
  if (now - lastErrorAt > 1500) {
    lastErrorAt = now
    ElMessage.error('页面发生异常，请查看控制台或刷新重试')
  }
}

/* 全局统一：放大 el-table 表头列宽拖拽命中区，所有页面保持一致 */
installTableColumnResizeEnhancer()

// 会话失效（令牌过期/无效）的统一出口：清掉该类会话并跳对应登录页。
// 独立账号回自己的登录页，WMS 员工回 WMS 登录页——两类会话分槽存放，
// 清一类不影响另一类已保存的会话。
onSessionExpired((kind) => {
  const target = kind === 'pdf_agent' ? '/ai/pdf_agent/login' : '/login'
  if (router.currentRoute.value.path !== target) void router.replace(target)
})

app.mount('#app')

void initializePageAgent()
