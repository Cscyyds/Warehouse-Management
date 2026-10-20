<template>
  <div class="login-page">
    <LandingHeader />
    <div class="bg-circle circle-1" />
    <div class="bg-circle circle-2" />
    <div class="bg-circle circle-3" />
    <main class="login-main">
      <div class="login-card">
        <div class="login-header">
          <div class="login-icon">
            <img :src="brandLogo" alt="智星云仓储" class="login-logo-img" />
          </div>
          <h1 class="login-title">智星云仓储</h1>
          <p class="login-subtitle">智慧仓储  AI驱动  高效增长</p>
        </div>
        <el-form :model="form" :rules="rules" ref="formRef" class="login-form" @keyup.enter="handleLogin">
          <el-form-item prop="account" class="account-field">
            <el-input v-model="form.account" placeholder="登录账号" size="large" :prefix-icon="User" />
          </el-form-item>
          <el-form-item prop="password">
            <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password :prefix-icon="Lock" />
          </el-form-item>
          <el-form-item prop="captcha">
            <div class="verify-row">
              <el-input v-model="form.captcha" placeholder="图形验证码" size="large" maxlength="4" :prefix-icon="Picture" />
              <img v-if="captchaImg" :src="captchaImg" class="captcha-img" title="点击刷新验证码" @click="refreshCaptcha" />
              <el-button v-else link @click="refreshCaptcha">加载验证码</el-button>
            </div>
          </el-form-item>
          <el-form-item>
            <div class="login-btn-wrap">
              <button
                ref="btnRef"
                type="button"
                class="login-btn"
                :class="'is-' + btnState"
                :disabled="btnState !== 'idle'"
                @click="handleLogin"
              >
                <span class="login-btn__label">登 录</span>
                <span class="login-btn__spinner" aria-hidden="true" />
                <svg class="login-btn__check" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </el-form-item>
        </el-form>
      </div>
    </main>

    <LandingFooter />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock, Picture } from '@element-plus/icons-vue'
import type { FormInstance } from 'element-plus'
import { post } from '@/utils/request'
import { getCaptcha } from '@/api'
import { useUserStore } from '@/stores/user'
import LandingHeader from '@/components/LandingHeader.vue'
import LandingFooter from '@/components/LandingFooter.vue'
import { usePermissionStore } from '@/stores/permission'
import { useTradeModeStore } from '@/stores/tradeMode'
import { useTabStore } from '@/stores/tab'
import { useLoginTakeover } from '@/composables/useLoginTakeover'
import brandLogo from '@/static/logo.png'

interface UserLoginData {
  access_token: string
  token_type: string
  operator_id: string
  operator_name: string
  operator_type: string
  company_id: string
  login_name: string
  avatar_url?: string | null
}

const router = useRouter()
const userStore = useUserStore()
const formRef = ref<FormInstance>()
const btnRef = ref<HTMLButtonElement>()
// 登录按钮状态机：idle → collapse → loading → success/error → idle
// 驱动按钮「两侧向中间收缩 → 圆形旋转 → 打钩 / 失败抖动」的形变动画
type BtnState = 'idle' | 'collapse' | 'loading' | 'success' | 'error'
const btnState = ref<BtnState>('idle')
const captchaImg = ref('')
const captchaId = ref('')

// 全屏揭示转场（遮罩挂在 App.vue，跨路由存活；revealActive 点亮 App 的圆形揭示过渡）
const { setOrigin, expandFrom, revealActive } = useLoginTakeover()

// 动画节奏（ms）：需与 <style> 中对应 transition / keyframes 时长保持一致
const T_COLLAPSE = 350 // 收缩成形
const T_MIN_SPIN = 500 // 旋转圈至少转这么久才判定完成
const T_CHECK = 450 // 按钮打钩亮相时长，随后圆盘扩散接管全屏
const T_ERROR = 500 // 失败抖动后回弹
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const form = reactive({ account: '', password: '', captcha: '' })
const rules = {
  account: [{ required: true, message: '请输入登录账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captcha: [{ required: true, message: '请输入图形验证码', trigger: 'blur' }]
}

async function handleLogin() {
  if (btnState.value !== 'idle') return
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  // 1) 收缩：宽度 100% → 圆形，等动画走完
  btnState.value = 'collapse'
  await sleep(T_COLLAPSE)

  // 2) 旋转：至少转 T_MIN_SPIN，同时等真实登录结果（成功/失败都保证最小时长）
  btnState.value = 'loading'
  const minSpin = sleep(T_MIN_SPIN)
  let loginError: unknown = null
  try {
    await doLogin()
  } catch (e) {
    loginError = e
  }
  // 无论接口快慢，spinner 都至少转够 T_MIN_SPIN，避免快速失败时转圈一闪即断
  await minSpin

  if (loginError) {
    // 失败：圆形抖动 + 回弹为按钮，重置验证码，退回 idle
    btnState.value = 'error'
    form.captcha = ''
    await refreshCaptcha()
    await sleep(T_ERROR)
    btnState.value = 'idle'
    // 错误提示已由 request 拦截器统一处理
    return
  }

  // 3) 成功：打钩短暂亮相 → 点亮 App 路由的圆形揭示过渡 → push：
  //    dashboard 透过从按钮圆心扩大的圆实时浮现（登录页垫底被覆盖，圆边透明），
  //    全屏揭示后「欢迎回来」浮现再消散
  btnState.value = 'success'
  await sleep(T_CHECK)
  // 打钩阶段按钮仍在 DOM，此刻量取圆心与「到最远角」半径，作为揭示锚点
  const rect = btnRef.value!.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const radius = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(window.innerWidth - cx, cy),
    Math.hypot(cx, window.innerHeight - cy),
    Math.hypot(window.innerWidth - cx, window.innerHeight - cy),
  )
  setOrigin(cx, cy, radius)
  revealActive.value = true // 仅本次切换启用 reveal 过渡
  expandFrom() // 能量环/欢迎语与页面揭示并行播放，状态机自行归位，无需 await
  await router.push('/dashboard')
}

// 登录业务主体：调接口 + 落 token + 拉权限，全部成功才 resolve，任一失败即 reject
async function doLogin() {
  userStore.clearAvatar()
  // 接口要求 application/x-www-form-urlencoded
  const params = new URLSearchParams()
  params.append('account', form.account)
  params.append('password', form.password)
  params.append('captcha_id', captchaId.value)
  params.append('captcha_code', form.captcha.trim())
  const res = await post<UserLoginData>('/api/v1/auth/user/login', params)
  const { access_token, operator_id, operator_name, operator_type, company_id, login_name, avatar_url } = res.data
  localStorage.setItem('token', access_token)
  localStorage.setItem('operator_id', operator_id)
  localStorage.setItem('operator_name', operator_name)
  localStorage.setItem('operator_type', operator_type)
  localStorage.setItem('company_id', company_id)
  localStorage.setItem('login_name', login_name)
  userStore.setAvatar(avatar_url)
  // 切换账号场景（手动退出/401 过期/改密重登）统一在登录成功时重置会话级状态，
  // 避免残留上一个账号的标签页导航栏（权限集合由下方 load(true) 强制刷新）
  useTabStore().reset()
  // 登录成功后立即拉取可见权限，进入首页前路由守卫会等待该 Promise，
  // 避免菜单「先全量后收窄」或权限未就绪导致的误拦截
  await usePermissionStore().load(true)
  // 并行拉取贸易模式（TIANXIN/NATIVE 分流依据），失败不阻塞登录，
  // 由 tradeMode store fail-open 兜底（mode=null 时页面按 NATIVE 处理）
  useTradeModeStore().load(true).catch(() => { /* 静默，守卫会再次尝试 */ })
}

async function refreshCaptcha() {
  try {
    const res = await getCaptcha()
    const raw = res.data.image_data
    // 兼容 data URI 与裸 base64 两种返回
    captchaImg.value = raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`
    captchaId.value = res.data.captcha_id
    form.captcha = ''
  } catch {
    // 错误已由 request 拦截器统一处理
  }
}

onMounted(refreshCaptcha)
</script>

<style scoped>
/* ── Layout ── */
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-page);
  overflow-x: hidden;
  position: relative;
}

.login-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

/* Subtle geometric background accents — purposeful, not decorative */
.bg-circle {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.circle-1 {
  width: 480px; height: 480px;
  background: var(--primary);
  opacity: 0.04;
  top: -160px; right: -120px;
  filter: blur(80px);
}
.circle-2 {
  width: 320px; height: 320px;
  background: var(--primary);
  opacity: 0.05;
  bottom: -80px; left: -80px;
  filter: blur(60px);
}
.circle-3 {
  width: 200px; height: 200px;
  background: var(--warning);
  opacity: 0.04;
  top: 55%; left: 48%;
  filter: blur(50px);
}

/* ── Card ── */
.login-card {
  width: 400px;
  padding: 44px 40px 36px;
  background: var(--bg-white);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  position: relative;
  z-index: 1;
  animation: fadeInUp 0.3s ease;
}

/* ── Header ── */
.login-header {
  text-align: center;
  margin-bottom: 32px;
}
.login-icon {
  width: 56px; height: 56px;
  margin: 0 auto 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.login-logo-img {
  width: 56px; height: 56px;
  object-fit: contain;
}
.login-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
  letter-spacing: -0.01em;
}
.login-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

/* ── Form ── */
.login-form {
  margin: 0;
}
/* 加大账号输入框与密码输入框之间的间距，避免红色校验提示紧贴密码框 */
.login-form :deep(.account-field) {
  margin-bottom: 20px !important;
}
.login-form :deep(.el-input__wrapper) {
  background: var(--bg-page) !important;
  box-shadow: 0 0 0 1px var(--border-color) inset !important;
  border-radius: var(--radius-sm) !important;
  height: 42px;
  transition: box-shadow var(--transition-fast);
}
.login-form :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--primary-light) inset !important;
}
.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--primary) inset, 0 0 0 3px var(--primary-bg) !important;
  background: var(--bg-white) !important;
}
.login-form :deep(.el-input__inner) {
  color: var(--text-primary);
  background: transparent;
  font-size: 14px;
}
.login-form :deep(.el-input__inner:-webkit-autofill),
.login-form :deep(.el-input__inner:-webkit-autofill:hover),
.login-form :deep(.el-input__inner:-webkit-autofill:focus) {
  -webkit-box-shadow: 0 0 0 1000px var(--bg-page) inset !important;
  -webkit-text-fill-color: var(--text-primary) !important;
  caret-color: var(--text-primary);
}
.login-form :deep(.el-input__prefix-inner) {
  color: var(--text-tertiary);
}

/* ── Captcha ── */
.verify-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.verify-row .el-input {
  flex: 1;
}
.captcha-img {
  width: 108px;
  height: 42px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  cursor: pointer;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--bg-page);
}

/* ── Login Button (morphing: 收缩 → 圆形旋转 → 打钩 / 抖动回弹) ── */
.login-btn-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-top: 5px;
}
.login-btn {
  position: relative;
  width: 100%;
  height: 42px;
  padding: 0;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.04em;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--primary);
  color: #fff;
  cursor: pointer;
  /* 宽度和圆角走收缩曲线，背景色单独走快曲线（success/error 即时换色） */
  transition:
    width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    border-radius 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.2s ease;
}
.login-btn:disabled { cursor: default; }
/* idle 才有 hover/active 反馈，动画期间不响应 */
.login-btn.is-idle:hover { background: var(--primary-light); }
.login-btn.is-idle:active { transform: scale(0.98); }

/* 收缩态及之后：收成 42px 圆形并居中 */
.login-btn.is-collapse,
.login-btn.is-loading,
.login-btn.is-success,
.login-btn.is-error {
  width: 42px;
  border-radius: 50%;
}

/* 文字：收缩开始时即淡出，避免被挤压变形 */
.login-btn__label {
  display: inline-block;
  opacity: 1;
  transform: scale(1);
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.login-btn.is-collapse .login-btn__label,
.login-btn.is-loading .login-btn__label,
.login-btn.is-success .login-btn__label,
.login-btn.is-error .login-btn__label {
  opacity: 0;
  transform: scale(0.6);
}

/* 旋转圈：仅 loading 显示 */
.login-btn__spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  margin: -10px 0 0 -10px;
  border: 3px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.login-btn.is-loading .login-btn__spinner {
  opacity: 1;
  animation: loginSpin 0.7s linear infinite;
}

/* 打钩：SVG 描边动画，仅 success 显示并换绿底 */
.login-btn.is-success { background: var(--success); }
.login-btn__check {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 22px;
  height: 22px;
  margin: -11px 0 0 -11px;
  fill: none;
  stroke: #fff;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
  stroke-dasharray: 24;
  stroke-dashoffset: 24;
}
.login-btn.is-success .login-btn__check {
  opacity: 1;
  animation: loginDrawCheck 0.3s 0.05s ease forwards;
}

/* 失败：抖动 + 回弹为按钮，圆形保持红色（danger） */
.login-btn.is-error {
  background: var(--danger);
  animation: loginShake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

@keyframes loginSpin {
  to { transform: rotate(360deg); }
}
@keyframes loginDrawCheck {
  to { stroke-dashoffset: 0; }
}
@keyframes loginShake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-4px); }
  40%, 60% { transform: translateX(4px); }
}

/* 注意：此处刻意不加 prefers-reduced-motion 降级——登录形变动画是产品明确要求的
   核心反馈，Windows 关闭系统动画时也必须完整呈现。 */
</style>
