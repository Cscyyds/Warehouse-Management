<template>
  <div class="login-page">
    <div class="bg-circle circle-1" />
    <div class="bg-circle circle-2" />
    <div class="bg-circle circle-3" />
    <div class="login-card">
      <div class="login-header">
        <div class="login-icon">
          <img :src="brandLogo" alt="智星WMS" class="login-logo-img" />
        </div>
        <h1 class="login-title">智星WMS</h1>
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
          <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="handleLogin">
            {{ loading ? '登录中...' : '登 录' }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>
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
const loading = ref(false)
const captchaImg = ref('')
const captchaId = ref('')

const form = reactive({ account: '', password: '', captcha: '' })
const rules = {
  account: [{ required: true, message: '请输入登录账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captcha: [{ required: true, message: '请输入图形验证码', trigger: 'blur' }]
}

function handleLogin() {
  formRef.value?.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
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
      router.push('/')
    } catch {
      form.captcha = ''
      await refreshCaptcha()
      // 错误提示已由 request 拦截器统一处理
    } finally {
      loading.value = false
    }
  })
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
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-page);
  overflow: hidden;
  position: relative;
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

/* ── Login Button ── */
.login-btn {
  width: 100%;
  height: 42px;
  margin-top: 5px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.04em;
  border-radius: var(--radius-sm) !important;
  background: var(--primary) !important;
  border: none !important;
  color: #fff !important;
  transition: background var(--transition-fast), transform var(--transition-fast);
}
.login-btn:hover {
  background: var(--primary-light) !important;
}
.login-btn:active {
  transform: scale(0.98);
  background: var(--primary-dark) !important;
}
</style>
