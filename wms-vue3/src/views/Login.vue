<template>
  <div class="login-page">
    <div class="bg-circle circle-1" />
    <div class="bg-circle circle-2" />
    <div class="bg-circle circle-3" />
    <div class="login-card">
      <div class="login-header">
        <div class="login-icon">
          <img :src="brandLogo" alt="矩恒WMS" class="login-logo-img" />
        </div>
        <h1 class="login-title">矩恒WMS</h1>
        <p class="login-subtitle">智慧仓储  AI驱动  高效增长</p>
      </div>
      <el-form :model="form" :rules="rules" ref="formRef" class="login-form" @keyup.enter="handleLogin">
        <el-form-item prop="account">
          <el-input v-model="form.account" placeholder="登录账号" size="large" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password :prefix-icon="Lock" />
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
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import type { FormInstance } from 'element-plus'
import { post } from '@/utils/request'
import brandLogo from '@/static/logo.png'

interface UserLoginData {
  access_token: string
  token_type: string
  operator_id: string
  operator_name: string
  operator_type: string
  company_id: string
  login_name: string
}

const router = useRouter()
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({ account: '', password: '' })
const rules = {
  account: [{ required: true, message: '请输入登录账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

function handleLogin() {
  formRef.value?.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      // 接口要求 application/x-www-form-urlencoded
      const params = new URLSearchParams()
      params.append('account', form.account)
      params.append('password', form.password)
      const res = await post<UserLoginData>('/api/v1/auth/user/login', params)
      const { access_token, operator_id, operator_name, operator_type, company_id, login_name } = res.data
      localStorage.setItem('token', access_token)
      localStorage.setItem('operator_id', operator_id)
      localStorage.setItem('operator_name', operator_name)
      localStorage.setItem('operator_type', operator_type)
      localStorage.setItem('company_id', company_id)
      localStorage.setItem('login_name', login_name)
      ElMessage.success('登录成功')
      router.push('/')
    } catch {
      // 错误提示已由 request 拦截器统一处理
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
.login-page { height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #f5f3f0, #fdf0eb, #f8ede8); overflow: hidden; position: relative; }
.bg-circle { position: absolute; border-radius: 50%; opacity: 0.18; filter: blur(70px); }
.circle-1 { width: 400px; height: 400px; background: #ff8c5a; top: -100px; right: -100px; animation: float 8s ease-in-out infinite; }
.circle-2 { width: 300px; height: 300px; background: #e84118; bottom: -50px; left: -50px; animation: float 10s ease-in-out infinite reverse; }
.circle-3 { width: 200px; height: 200px; background: #ffb347; top: 50%; left: 50%; animation: float 12s ease-in-out infinite; }
@keyframes float { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(30px, -30px) scale(1.1); } }
.login-card { width: 420px; padding: 40px; background: rgba(255,255,255,0.85); backdrop-filter: blur(20px); border-radius: var(--radius-xl); border: 1px solid rgba(232,65,24,0.1); box-shadow: 0 25px 50px rgba(232,65,24,0.08), 0 4px 16px rgba(0,0,0,0.06); position: relative; z-index: 1; }
.login-header { text-align: center; margin-bottom: 32px; }
.login-icon { width: 64px; height: 64px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; }
.login-logo-img { width: 64px; height: 64px; object-fit: contain; filter: drop-shadow(0 4px 12px rgba(232,65,24,0.3)); }
.login-title { font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; }
.login-subtitle { font-size: 14px; color: #888; letter-spacing: 0px; }
.login-form { max-width: 320px; margin: 0 auto; }
.login-form :deep(.el-input__wrapper) { background: #fff; border: 1px solid #e0e0e0; box-shadow: none; }
.login-form :deep(.el-input__wrapper:hover) { border-color: #e84118; }
.login-form :deep(.el-input__wrapper.is-focus) { border-color: #e84118; box-shadow: 0 0 0 2px rgba(232,65,24,0.1) !important; }
.login-form :deep(.el-input__inner) { color: #1a1a1a; background: transparent; }
.login-form :deep(.el-input__inner:-webkit-autofill),
.login-form :deep(.el-input__inner:-webkit-autofill:hover),
.login-form :deep(.el-input__inner:-webkit-autofill:focus) {
  -webkit-box-shadow: 0 0 0 1000px #fff inset !important;
  -webkit-text-fill-color: #1a1a1a !important;
  caret-color: #1a1a1a;
}
.login-form :deep(.el-input__prefix-inner) { color: #aaa; }
.login-btn { width: 100%; height: 44px; font-size: 16px; border-radius: var(--radius-sm); background: linear-gradient(135deg, #e84118, #ff6b35); border: none; color: #fff; }
.login-btn:hover { background: linear-gradient(135deg, #d03510, #f05a28); }
</style>
