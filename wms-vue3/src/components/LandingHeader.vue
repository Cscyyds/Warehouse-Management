<template>
  <header class="landing-header">
    <div class="landing-header__inner">
      <div class="landing-brand" @click="handleBrandClick">
        <div class="landing-brand__mark">
          <img :src="brandLogo" alt="智星云仓储" class="landing-brand__img" />
        </div>
        <span class="landing-brand__title">智星云仓储</span>
      </div>
      <nav class="landing-nav">
        <a
          v-for="link in navLinks"
          :key="link.label"
          class="landing-nav__link"
          :href="link.href"
          @click.prevent="goAnchor(link.href)"
        >{{ link.label }}</a>
      </nav>
      <div class="landing-actions">
        <el-tooltip :content="themeStore.isDark ? '浅色模式' : '深色模式'">
          <button class="landing-actions__btn landing-actions__btn--icon" @click="themeStore.toggleTheme()">
            <el-icon :size="18"><Sunny v-if="themeStore.isDark" /><Moon v-else /></el-icon>
          </button>
        </el-tooltip>
        <button class="landing-actions__btn landing-actions__btn--outline" @click="goToTrial">联系我们</button>
        <button class="landing-actions__btn landing-actions__btn--primary" @click="goToLogin">
          <el-icon :size="16"><Grid /></el-icon>
          <span>进入控制台</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Grid, Moon, Sunny } from '@element-plus/icons-vue'
import { useThemeStore } from '@/stores/theme'
import brandLogo from '@/static/logo.png'

const router = useRouter()
const themeStore = useThemeStore()

const navLinks = [
  { label: '产品功能', href: '#products' },
  { label: '解决方案', href: '#cases' },
  { label: '服务与支持', href: '#services' }
]

function isOnLanding() {
  return router.currentRoute.value.path === '/'
}

function goToLogin() { router.push('/login') }
function goToTrial() { router.push('/trial') }

function handleBrandClick() {
  if (isOnLanding()) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    router.push('/')
  }
}

// 锚点跳转：在宣传页内平滑滚动；在其他页面先回到宣传页再定位
function goAnchor(href: string) {
  const id = href.slice(1)
  const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  if (isOnLanding()) {
    scroll()
  } else {
    router.push('/').then(() => setTimeout(scroll, 100))
  }
}
</script>

<style scoped lang="scss">
.landing-header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
  background: color-mix(in srgb, var(--bg-white) 82%, transparent);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border-color);
}
.landing-header__inner {
  max-width: 1440px; margin: 0 auto; height: 64px; padding: 0 40px;
  display: flex; align-items: center; justify-content: space-between; gap: 24px;
}
.landing-brand { display: flex; align-items: center; gap: 10px; cursor: pointer; flex-shrink: 0; }
.landing-brand__mark { width: 34px; height: 34px; }
.landing-brand__img { width: 100%; height: 100%; object-fit: contain; }
.landing-brand__title { font-size: 18px; font-weight: 700; color: var(--text-primary); }
.landing-nav { display: flex; align-items: center; gap: 6px; }
.landing-nav__link {
  padding: 8px 16px; font-size: 15px; font-weight: 500; color: var(--text-secondary);
  text-decoration: none; border-radius: var(--radius-sm);
  transition: color .15s, background .15s;
}
.landing-nav__link:hover { color: var(--primary); background: var(--primary-bg); }
.landing-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.landing-actions__btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 36px; padding: 0 14px; border-radius: var(--radius-sm); font-size: 14px;
  font-weight: 500; cursor: pointer; transition: all .15s; border: 1px solid var(--border-color);
  background: var(--bg-white); color: var(--text-primary);
}
.landing-actions__btn--icon { width: 36px; padding: 0; color: var(--text-secondary); }
.landing-actions__btn:hover { border-color: var(--primary-border); color: var(--primary); }
.landing-actions__btn--outline { border-color: var(--primary-border); color: var(--primary); background: transparent; }
.landing-actions__btn--outline:hover { background: var(--primary-bg); }
.landing-actions__btn--primary {
  background: var(--primary); border-color: var(--primary); color: #fff;
}
.landing-actions__btn--primary:hover { background: var(--primary-light); border-color: var(--primary-light); color: #fff; }
</style>
