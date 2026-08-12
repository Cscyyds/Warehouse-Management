<template>
  <div :class="['landing-page', { 'landing-page--dark': themeStore.isDark }]">
    <!-- 顶部导航 -->
    <header class="landing-header">
      <div class="landing-header__inner">
        <div class="landing-brand" @click="scrollToTop">
          <div class="landing-brand__mark">
            <img :src="brandLogo" alt="智星WMS" class="landing-brand__img" />
          </div>
          <span class="landing-brand__title">智星WMS</span>
        </div>
        <nav class="landing-nav">
          <a class="landing-nav__link" href="#products">产品功能</a>
          <a class="landing-nav__link" href="#cases">解决方案</a>
          <a class="landing-nav__link" href="#services">服务与支持</a>
        </nav>
        <div class="landing-actions">
          <el-tooltip :content="themeStore.isDark ? '浅色模式' : '深色模式'">
            <button class="landing-actions__btn landing-actions__btn--icon" @click="themeStore.toggleTheme()">
              <el-icon :size="18"><Sunny v-if="themeStore.isDark" /><Moon v-else /></el-icon>
            </button>
          </el-tooltip>
          <button class="landing-actions__btn landing-actions__btn--outline" @click="goToLogin">联系我们</button>
          <button class="landing-actions__btn landing-actions__btn--primary" @click="goToLogin">
            <el-icon :size="16"><Grid /></el-icon>
            <span>进入控制台</span>
          </button>
        </div>
      </div>
    </header>

    <main class="landing-main">
      <!-- Hero 区域 — 深色全宽背景 -->
      <section class="hero-section">
        <div class="hero-inner">
          <div class="hero-text">
            <p class="hero-eyebrow">智慧仓储 · AI 驱动 · 高效增长</p>
            <h1 class="hero-title">新一代<br/>智能仓储管理平台</h1>
            <p class="hero-desc">智星WMS 覆盖采购、销售、库存、配送、财务全链路，<br/>以 AI 助手赋能决策，让仓储管理更智能、更高效。</p>
            <div class="hero-actions">
              <button class="hero-btn hero-btn--primary" @click="goToLogin">免费体验</button>
              <button class="hero-btn hero-btn--ghost" @click="scrollToFeatures">了解更多</button>
            </div>
          </div>
          <div class="hero-mockup">
            <div class="carousel-container">
              <!-- 第一屏：模拟窗口 -->
              <Transition name="carousel-fade">
                <div v-show="currentSlide === 0" class="carousel-slide">
                  <div class="mockup-window">
                    <div class="mockup-topbar">
                      <div class="mockup-dots"><span/><span/><span/></div>
                      <span class="mockup-title">智星WMS · 仓储运营总览</span>
                    </div>
                    <div class="mockup-body">
                      <div class="mockup-sidebar">
                        <div class="mockup-nav-item active"/>
                        <div class="mockup-nav-item"/>
                        <div class="mockup-nav-item"/>
                        <div class="mockup-nav-item"/>
                        <div class="mockup-nav-item"/>
                      </div>
                      <div class="mockup-content">
                        <div class="mockup-kpi-row">
                          <div class="mockup-kpi" v-for="k in 3" :key="k"><div class="kpi-bar" :style="{width: `${40+k*18}%`}"/></div>
                        </div>
                        <div class="mockup-chart">
                          <div class="chart-bar" v-for="(h, i) in chartBarHeights" :key="i" :style="{height: `${h}%`}"/>
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- 浮动卡片 -->
                  <div class="float-card float-card--ai">
                    <div class="float-card__icon"><el-icon :size="18" color="#fff"><Cpu /></el-icon></div>
                    <div><strong>AI 智能预警</strong><br/><small>3 项库存异常已识别</small></div>
                  </div>
                  <div class="float-card float-card--stat">
                    <div class="float-card__value">+43%</div>
                    <div class="float-card__label">运营效率提升</div>
                  </div>
                </div>
              </Transition>

              <!-- 第二屏：海报图片 -->
              <Transition name="carousel-fade">
                <div v-show="currentSlide === 1" class="carousel-slide">
                  <div class="poster-image">
                    <img :src="posterUrl" alt="工业智能体海报" />
                  </div>
                </div>
              </Transition>

              <!-- 轮播指示器 -->
              <div class="carousel-indicators">
                <button
                  v-for="(_, idx) in 2"
                  :key="idx"
                  :class="['indicator-dot', { active: currentSlide === idx }]"
                  @click="goToSlide(idx)"
                  :aria-label="`切换到第 ${idx + 1} 张`"
                />
              </div>

              <!-- 左右切换箭头 -->
              <button class="carousel-arrow carousel-arrow--prev" @click="prevSlide" aria-label="上一张">
                <el-icon :size="20"><ArrowLeft /></el-icon>
              </button>
              <button class="carousel-arrow carousel-arrow--next" @click="nextSlide" aria-label="下一张">
                <el-icon :size="20"><ArrowRight /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 产品功能导航条 -->
      <section id="products" class="products-bar">
        <div class="products-bar__inner">
          <div v-for="item in productNav" :key="item.title" class="product-card" @click="goToLogin">
            <div class="product-card__icon" :style="{background: item.gradient}">
              <el-icon :size="20" color="#fff"><component :is="item.icon" /></el-icon>
            </div>
            <div class="product-card__info">
              <span class="product-card__title">{{ item.title }}</span>
              <span class="product-card__desc">{{ item.desc }} →</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 场景案例卡片 -->
      <section id="cases" class="cases-section">
        <div class="section-header">
          <h2 class="section-header__title">将 AI 融入仓储全业务环节</h2>
          <p class="section-header__desc">从采购入库到配送签收，每一步都可以更智能</p>
        </div>
        <div class="cases-grid">
          <div v-for="item in cases" :key="item.title" class="case-card" :style="{'--case-bg': item.bg}">
            <div class="case-card__header">
              <div class="case-card__badge" :style="{background: item.badgeBg, color: item.badgeColor}">
                <el-icon :size="14"><component :is="item.icon" /></el-icon>
                <span>{{ item.module }}</span>
              </div>
            </div>
            <h3 class="case-card__title">{{ item.title }}</h3>
            <p class="case-card__desc">{{ item.desc }}</p>
            <div class="case-card__visual">
              <div class="case-card__metric" v-if="item.metric">
                <span class="metric-value">{{ item.metric }}</span>
                <span class="metric-label">{{ item.metricLabel }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 服务体系 -->
      <section id="services" class="services-section">
        <div class="section-header">
          <h2 class="section-header__title">全程陪伴服务体系，助力企业成功</h2>
          <p class="section-header__desc">从部署到运营，专业团队全程支持</p>
        </div>
        <div class="services-grid">
          <div v-for="item in services" :key="item.title" class="service-card" :style="{'--svc-accent': item.accent}">
            <div class="service-card__top">
              <h4 class="service-card__title">{{ item.title }}</h4>
              <div class="service-card__icon"><el-icon :size="22"><component :is="item.icon" /></el-icon></div>
            </div>
            <p class="service-card__desc">{{ item.desc }}</p>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="cta-section">
        <div class="cta-card">
          <h2 class="cta-title">开启智能仓储新时代</h2>
          <p class="cta-desc">立即进入控制台，体验高效、智能、可增长的仓储管理方式</p>
          <button class="hero-btn hero-btn--primary" @click="goToLogin">
            <el-icon :size="18"><Grid /></el-icon>
            <span>免费体验</span>
          </button>
        </div>
      </section>
    </main>

    <footer class="landing-footer">
      <div class="landing-footer__inner">
        <div class="landing-footer__brand">
          <img :src="brandLogo" alt="智星WMS" class="landing-footer__logo" />
          <span>智星WMS · 智慧仓储 · AI驱动 · 高效增长</span>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import {
  Grid, Moon, Sunny, Cpu, ArrowLeft, ArrowRight,
  Box, Download, Upload, Van, Money, DataAnalysis,
  SetUp, Headset, Connection, Document,
} from '@element-plus/icons-vue'
import { useThemeStore } from '@/stores/theme'
import brandLogo from '@/static/logo.png'

const router = useRouter()
const themeStore = useThemeStore()
const chartBarHeights = [38, 62, 48, 78, 55, 85, 42, 68, 52]
const posterUrl = 'https://chuguitest.bj.bcebos.com/images/cck/%E5%B7%A5%E4%B8%9A%E6%99%BA%E8%83%BD%E4%BD%93%E6%B5%B7%E6%8A%A5.png'

// 轮播逻辑
const currentSlide = ref(0)
const totalSlides = 2
let carouselTimer: ReturnType<typeof setInterval> | null = null

function nextSlide() {
  currentSlide.value = (currentSlide.value + 1) % totalSlides
  resetTimer()
}

function prevSlide() {
  currentSlide.value = (currentSlide.value - 1 + totalSlides) % totalSlides
  resetTimer()
}

function goToSlide(index: number) {
  currentSlide.value = index
  resetTimer()
}

function startCarousel() {
  carouselTimer = setInterval(() => {
    currentSlide.value = (currentSlide.value + 1) % totalSlides
  }, 5000) // 每5秒切换
}

function resetTimer() {
  if (carouselTimer) clearInterval(carouselTimer)
  startCarousel()
}

onMounted(() => {
  startCarousel()
})

onBeforeUnmount(() => {
  if (carouselTimer) clearInterval(carouselTimer)
})

const productNav = [
  { icon: Box, title: '库存管理', desc: '精细化库位管控', gradient: 'linear-gradient(135deg,#667eea,#764ba2)' },
  { icon: Download, title: '采购入库', desc: '全流程采购跟踪', gradient: 'linear-gradient(135deg,#10b981,#059669)' },
  { icon: Upload, title: '销售出库', desc: '高效订单处理', gradient: 'linear-gradient(135deg,#f59e0b,#d97706)' },
  { icon: Van, title: '配送调度', desc: '一体化物流管理', gradient: 'linear-gradient(135deg,#06b6d4,#0891b2)' },
  { icon: Money, title: '财务对账', desc: '自动化报表生成', gradient: 'linear-gradient(135deg,#ef4444,#dc2626)' },
  { icon: Cpu, title: 'AI 助手', desc: '智能决策辅助', gradient: 'linear-gradient(135deg,#3b82f6,#2563eb)' },
]

const cases = [
  {
    icon: DataAnalysis, module: 'AI 数据驾驶舱', title: 'AI + 库存分析',
    desc: '通过 AI 智能预测库存消耗速度，提前预警滞销与缺货风险，降低库存积压 35%',
    bg: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)',
    badgeBg: '#eef2ff', badgeColor: '#4f46e5',
    metric: '35%', metricLabel: '库存积压降低',
  },
  {
    icon: Van, module: '智能配送', title: 'AI + 配送调度',
    desc: '基于订单热力图智能分配配送路线，减少空跑率，提升配送时效 43%',
    bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    badgeBg: '#ecfdf5', badgeColor: '#059669',
    metric: '43%', metricLabel: '配送时效提升',
  },
  {
    icon: Money, module: '财务自动化', title: 'AI + 智能对账',
    desc: '自动匹配采购/销售单据与付款记录，对账效率提升 5 倍，差错率降至 0.1%',
    bg: 'linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%)',
    badgeBg: '#fefce8', badgeColor: '#ca8a04',
    metric: '5x', metricLabel: '对账效率提升',
  },
  {
    icon: Box, module: '入库自动化', title: 'AI + 智能入库',
    desc: '扫码自动匹配采购单据，AI 推荐最优库位，入库操作效率提升 60%',
    bg: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
    badgeBg: '#fdf2f8', badgeColor: '#db2777',
    metric: '60%', metricLabel: '入库效率提升',
  },
]

const services = [
  { icon: SetUp, title: '企业效能顾问', desc: '定位组织问题\n制定效能提升方案', accent: '#e0f2fe' },
  { icon: Cpu, title: 'AI + 智能客服', desc: '7×24h\n在线智能解答', accent: '#ede9fe' },
  { icon: Headset, title: '技术支持', desc: '工作时段\n一对一在线支持', accent: '#d1fae5' },
  { icon: Document, title: '部署咨询', desc: '提供组织管理升级\n咨询服务', accent: '#fee2e2' },
  { icon: Connection, title: '帮助中心', desc: '员工自助答疑\n降低企业运营成本', accent: '#fef3c7' },
  { icon: DataAnalysis, title: '数据迁移', desc: '专业团队全程陪伴\n数字化基建充分利旧', accent: '#f0fdf4' },
]

function goToLogin() { router.push('/login') }
function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }) }
function scrollToFeatures() { document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }) }
</script>

<style scoped lang="scss">
.landing-page {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* ══════ Header ══════ */
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

/* ══════ Hero ══════ */
.landing-main { padding-top: 64px; }
.hero-section {
  background: #1a1d24; position: relative; overflow: hidden;
  min-height: calc(100vh - 64px);
  display: flex; align-items: center;
}
.landing-page--dark .hero-section { background: #0d0f12; }
.hero-inner {
  max-width: 1440px; margin: 0 auto; padding: 80px 40px;
  display: grid; grid-template-columns: 1fr 1.2fr; gap: 60px; align-items: center; width: 100%;
}
.hero-text { position: relative; z-index: 2; }
.hero-eyebrow {
  font-size: 14px; color: rgba(255,255,255,.55); margin-bottom: 16px; letter-spacing: .04em;
}
.hero-title {
  font-size: clamp(36px, 4.5vw, 54px); font-weight: 800; line-height: 1.2;
  color: #fff; margin-bottom: 20px; letter-spacing: -.02em;
}
.hero-desc {
  font-size: 16px; line-height: 1.8; color: rgba(255,255,255,.6); margin-bottom: 36px;
}
.hero-actions { display: flex; gap: 14px; flex-wrap: wrap; }
.hero-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 48px; padding: 0 28px; border-radius: var(--radius-md); font-size: 16px;
  font-weight: 600; cursor: pointer; border: none; transition: all .18s;
}
.hero-btn--primary {
  background: var(--primary); color: #fff;
  box-shadow: 0 4px 20px rgba(146,43,33,.35);
}
.hero-btn--primary:hover { background: var(--primary-light); transform: translateY(-2px); box-shadow: 0 6px 24px rgba(146,43,33,.4); }
.hero-btn--ghost {
  background: rgba(255,255,255,.08); color: rgba(255,255,255,.85);
  border: 1px solid rgba(255,255,255,.18);
}
.hero-btn--ghost:hover { background: rgba(255,255,255,.14); color: #fff; }

/* Hero Mockup */
.hero-mockup { position: relative; z-index: 1; }

/* Carousel Container */
.carousel-container {
  position: relative;
  width: 100%;
  height: 420px; /* 固定容器高度防止切换抖动 */
  display: flex;
  align-items: center;
  justify-content: center;
}
.carousel-slide {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Poster Image */
.poster-image {
  max-width: 100%;
  max-height: 100%;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 40px 80px rgba(0,0,0,.4);
  border: 1px solid rgba(255,255,255,.08);
}
.poster-image img {
  width: 100%;
  height: 100%;
  max-height: 420px;
  object-fit: contain; /* 保持图片比例并完整显示 */
  display: block;
}

/* Carousel Indicators */
.carousel-indicators {
  position: absolute; bottom: -40px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 10px; z-index: 10;
}
.indicator-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: rgba(255,255,255,.3); border: none; cursor: pointer;
  transition: all .3s;
}
.indicator-dot:hover { background: rgba(255,255,255,.5); }
.indicator-dot.active { width: 24px; border-radius: 4px; background: rgba(255,255,255,.85); }

/* Carousel Arrows */
.carousel-arrow {
  position: absolute; top: 50%; transform: translateY(-50%);
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(255,255,255,.08); backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,.12); color: rgba(255,255,255,.7);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; z-index: 10; transition: all .2s;
  opacity: 0;
}
.carousel-container:hover .carousel-arrow { opacity: 1; }
.carousel-arrow:hover {
  background: rgba(255,255,255,.15); color: #fff;
  transform: translateY(-50%) scale(1.05);
}
.carousel-arrow--prev { left: -22px; }
.carousel-arrow--next { right: -22px; }

/* Carousel Fade Transition */
.carousel-fade-enter-active,
.carousel-fade-leave-active {
  transition: opacity .5s ease;
}
.carousel-fade-enter-from,
.carousel-fade-leave-to {
  opacity: 0;
}

.mockup-window {
  background: #2b2f38;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.08);
  box-shadow: 0 40px 80px rgba(0,0,0,.4);
  width: 100%;
  max-width: 100%;
}
.mockup-topbar {
  height: 40px;
  background: #23272e;
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 10px;
  flex-shrink: 0;
}
.mockup-dots { display: flex; gap: 6px; }
.mockup-dots span { width: 10px; height: 10px; border-radius: 50%; }
.mockup-dots span:nth-child(1) { background: #ff5f57; }
.mockup-dots span:nth-child(2) { background: #febc2e; }
.mockup-dots span:nth-child(3) { background: #28c840; }
.mockup-title { font-size: 12px; color: rgba(255,255,255,.5); }
.mockup-body { display: flex; height: 260px; }
.mockup-sidebar { width: 52px; background: #1e2128; padding: 14px 10px; display: flex; flex-direction: column; gap: 10px; }
.mockup-nav-item { height: 6px; border-radius: 3px; background: rgba(255,255,255,.12); }
.mockup-nav-item.active { background: var(--primary); }
.mockup-content { flex: 1; padding: 18px; display: flex; flex-direction: column; gap: 16px; }
.mockup-kpi-row { display: flex; gap: 10px; }
.mockup-kpi {
  flex: 1; height: 32px; background: rgba(255,255,255,.04); border-radius: 6px;
  display: flex; align-items: center; padding: 0 8px;
}
.kpi-bar { height: 6px; border-radius: 3px; background: var(--primary); opacity: .7; }
.mockup-chart {
  flex: 1; display: flex; align-items: flex-end; gap: 6px; padding: 10px 0;
}
.chart-bar {
  flex: 1; background: linear-gradient(180deg, var(--primary-light), var(--primary));
  border-radius: 3px 3px 0 0; opacity: .75;
}

/* Float Cards */
.float-card {
  position: absolute;
  padding: 14px 18px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #2b2f38;
  border: 1px solid rgba(255,255,255,.1);
  box-shadow: 0 12px 32px rgba(0,0,0,.3);
  color: #fff;
  z-index: 5;
  animation: fadeInUp .6s ease .4s both;
}
.float-card--ai { top: 10%; right: 5%; }
.float-card--stat { bottom: 15%; left: 5%; }
.float-card__icon {
  width: 36px; height: 36px; border-radius: 10px; background: var(--primary);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.float-card strong { font-size: 13px; line-height: 1.4; }
.float-card small { font-size: 11px; color: rgba(255,255,255,.5); }
.float-card__value { font-size: 22px; font-weight: 800; color: #34d399; line-height: 1; }
.float-card__label { font-size: 11px; color: rgba(255,255,255,.5); margin-top: 4px; }

/* ══════ Products Bar ══════ */
.products-bar {
  background: var(--bg-white); border-bottom: 1px solid var(--border-color); padding: 0 40px;
}
.products-bar__inner {
  max-width: 1440px; margin: 0 auto; display: flex; gap: 0; overflow-x: auto;
  scrollbar-width: none;
}
.products-bar__inner::-webkit-scrollbar { display: none; }
.product-card {
  flex: 1; min-width: 180px; display: flex; align-items: center; gap: 14px;
  padding: 24px 20px; cursor: pointer; position: relative;
  border-right: 1px solid var(--border-light);
  transition: background .15s;
}
.product-card:last-child { border-right: none; }
.product-card:hover { background: var(--bg-hover); }
.product-card__icon {
  width: 40px; height: 40px; border-radius: var(--radius-sm); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.product-card__info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.product-card__title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.product-card__desc { font-size: 13px; color: var(--text-secondary); white-space: nowrap; }

/* ══════ Section Header ══════ */
.section-header { text-align: center; max-width: 680px; margin: 0 auto 56px; }
.section-header__title {
  font-size: clamp(26px, 3vw, 36px); font-weight: 700; color: var(--text-primary);
  margin-bottom: 12px; letter-spacing: -.01em;
}
.section-header__desc { font-size: 16px; color: var(--text-secondary); line-height: 1.7; }

/* ══════ Cases ══════ */
.cases-section { padding: 100px 40px; max-width: 1440px; margin: 0 auto; }
.cases-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
.case-card {
  background: var(--case-bg); border-radius: var(--radius-xl); padding: 32px;
  border: 1px solid var(--border-color); position: relative; overflow: hidden;
  transition: transform .2s, box-shadow .2s;
}
.case-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
.case-card__header { margin-bottom: 16px; }
.case-card__badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: var(--radius-full); font-size: 12px; font-weight: 600;
}
.case-card__title { font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px; }
.case-card__desc { font-size: 14px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 20px; }
.case-card__visual { display: flex; align-items: center; }
.case-card__metric { display: flex; flex-direction: column; }
.metric-value { font-size: 32px; font-weight: 800; color: var(--primary); line-height: 1; }
.metric-label { font-size: 13px; color: var(--text-secondary); margin-top: 6px; }

/* ══════ Services ══════ */
.services-section { padding: 100px 40px; background: var(--bg-white); border-top: 1px solid var(--border-color); }
.services-section .section-header { max-width: 700px; }
.services-grid { max-width: 1440px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.service-card {
  padding: 28px; border-radius: var(--radius-lg);
  background: var(--svc-accent); border: 1px solid var(--border-light);
  transition: transform .2s, box-shadow .2s;
}
.service-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
.service-card__top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.service-card__title { font-size: 17px; font-weight: 600; color: var(--text-primary); }
.service-card__icon { color: var(--text-secondary); }
.service-card__desc { font-size: 14px; color: var(--text-secondary); line-height: 1.7; white-space: pre-line; }

/* ══════ CTA ══════ */
.cta-section { padding: 100px 40px; max-width: 1440px; margin: 0 auto; }
.cta-card {
  background: var(--hero-bg); border-radius: var(--radius-xl);
  padding: 72px 48px; text-align: center; position: relative; overflow: hidden;
}
.cta-title { font-size: clamp(24px, 3vw, 36px); font-weight: 700; color: #fff; margin-bottom: 14px; }
.cta-desc { font-size: 16px; color: rgba(255,255,255,.65); margin-bottom: 32px; }
.cta-section .hero-btn--primary { background: #fff; color: var(--primary); box-shadow: 0 4px 20px rgba(0,0,0,.15); }
.cta-section .hero-btn--primary:hover { background: rgba(255,255,255,.92); color: var(--primary-dark); }

/* ══════ Footer ══════ */
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
.landing-page--dark .landing-header { background: rgba(30,33,40,.82); }
.landing-page--dark .products-bar { background: var(--bg-page); }
.landing-page--dark .case-card { background: var(--bg-white) !important; border-color: var(--border-color); }
.landing-page--dark .services-section { background: var(--bg-deep-card); }
.landing-page--dark .service-card { background: var(--bg-white); border-color: var(--border-color); }
.landing-page--dark .landing-footer { background: var(--bg-deep-card); }

/* ══════ Responsive ══════ */
@media (max-width: 1024px) {
  .landing-header__inner { padding: 0 24px; }
  .hero-inner { grid-template-columns: 1fr; gap: 48px; padding: 60px 24px 80px; }
  .hero-mockup { max-width: 520px; margin: 0 auto; }
  .carousel-container { height: 360px; }
  .float-card--ai { right: 2%; top: 8%; }
  .float-card--stat { left: 2%; bottom: 12%; }
  .carousel-indicators { bottom: -32px; }
  .carousel-arrow--prev { left: -16px; }
  .carousel-arrow--next { right: -16px; }
  .cases-grid { grid-template-columns: 1fr; }
  .services-grid { grid-template-columns: repeat(2, 1fr); }
  .products-bar { padding: 0 24px; }
  .cases-section, .services-section, .cta-section { padding: 72px 24px; }
}
@media (max-width: 768px) {
  .landing-header__inner { height: 56px; padding: 0 16px; }
  .landing-nav { display: none; }
  .landing-actions__btn--outline { display: none; }
  .landing-main { padding-top: 56px; }
  .hero-inner { padding: 40px 16px 60px; }
  .hero-title { font-size: 30px; }
  .carousel-container { height: 240px; }
  .mockup-body { height: 180px; }
  .carousel-indicators { bottom: -28px; }
  .carousel-arrow { width: 36px; height: 36px; }
  .carousel-arrow--prev { left: -8px; }
  .carousel-arrow--next { right: -8px; }
  .float-card--ai, .float-card--stat { display: none; }
  .products-bar { padding: 0 16px; }
  .product-card { min-width: 160px; padding: 16px 14px; }
  .services-grid { grid-template-columns: 1fr; }
  .cases-section, .services-section, .cta-section { padding: 56px 16px; }
  .cta-card { padding: 48px 24px; }
  .landing-footer__inner { flex-direction: column; text-align: center; padding: 20px 16px; gap: 12px; }
  .landing-footer__brand { justify-content: center; }
  .landing-footer__company { align-items: center; }
}

/* ══════ Animation ══════ */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
