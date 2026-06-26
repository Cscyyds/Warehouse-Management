import { createApp } from 'vue'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from './router'
import ElementPlus, { ElMessage } from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import './styles/index.scss'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus)

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

app.mount('#app')
