<template>
  <footer :class="['landing-footer', { 'landing-footer--dark': themeStore.isDark }]">
    <div class="landing-footer__inner">
      <div class="landing-footer__brand">
        <img :src="brandLogo" alt="智星云仓储" class="landing-footer__logo" />
        <span>智星云仓储 · 智慧仓储 · AI驱动 · 高效增长</span>
      </div>
      <div class="landing-footer__beian">
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">备案号：粤ICP备2026042135号-4</a>
      </div>
      <div class="landing-footer__company">
        <span class="landing-footer__company-name">广州星矩链动智能科技有限公司</span>
        <a href="https://www.aster-mindlink.cn/" target="_blank" rel="noopener noreferrer" class="landing-footer__company-link">https://www.aster-mindlink.cn</a>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import brandLogo from '@/static/logo.png'

const themeStore = useThemeStore()
</script>

<style scoped lang="scss">
.landing-footer { border-top: 1px solid var(--border-color); background: var(--bg-white); }
.landing-footer__inner {
  max-width: 1440px; margin: 0 auto; padding: 28px 40px;
  display: flex; align-items: center; gap: 24px; flex-wrap: wrap;
}
.landing-footer__brand {
  flex: 1; display: flex; align-items: center; justify-content: flex-start; gap: 10px;
  font-size: 14px; color: var(--text-secondary); min-width: 0;
}
.landing-footer__logo { width: 28px; height: 28px; object-fit: contain; flex-shrink: 0; }
.landing-footer__beian {
  flex: 0 0 auto; text-align: center;
}
.landing-footer__beian a {
  font-size: 13px; color: var(--text-tertiary); text-decoration: none; transition: color .2s;
}
.landing-footer__beian a:hover { color: var(--primary); }
.landing-footer__company {
  flex: 1; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; min-width: 0;
}
.landing-footer__company-name { font-size: 13px; color: var(--text-secondary); white-space: nowrap; }
.landing-footer__company-link {
  font-size: 13px; color: var(--text-tertiary); text-decoration: none; transition: color .2s;
}
.landing-footer__company-link:hover { color: var(--primary); }

/* ══════ Dark mode overrides ══════ */
.landing-footer--dark { background: var(--bg-deep-card); }

/* ══════ Responsive ══════ */
@media (max-width: 768px) {
  .landing-footer__inner { flex-direction: column; text-align: center; padding: 20px 16px; gap: 12px; }
  .landing-footer__brand { justify-content: center; }
  .landing-footer__company { align-items: center; }
}
</style>
