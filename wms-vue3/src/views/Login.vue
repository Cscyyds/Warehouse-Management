<template>
  <div class="login-page">
    <div class="bg-circle circle-1" />
    <div class="bg-circle circle-2" />
    <div class="bg-circle circle-3" />
    <div class="login-card">
      <div class="login-header">
        <div class="login-icon">
          <el-icon :size="36" color="#fff"><Box /></el-icon>
        </div>
        <h1 class="login-title">WMS 仓库管理系统</h1>
        <p class="login-subtitle">高效 · 精准 · 智能</p>
      </div>
      <el-form :model="form" :rules="rules" ref="formRef" class="login-form" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" size="large" :prefix-icon="User" />
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
import { User, Lock, Box } from '@element-plus/icons-vue'
import type { FormInstance } from 'element-plus'

const router = useRouter()
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

function handleLogin() {
  formRef.value?.validate((valid) => {
    if (!valid) return
    loading.value = true
    setTimeout(() => {
      if (form.username === 'wanghao' && form.password === '123456') {
        localStorage.setItem('token', 'mock-token')
        ElMessage.success('登录成功')
        router.push('/')
      } else {
        ElMessage.error('用户名或密码错误')
      }
      loading.value = false
    }, 800)
  })
}
</script>

<style scoped>
.login-page { height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #0f0c29, #1a1a4e, #24243e, #302b63); overflow: hidden; position: relative; }
.bg-circle { position: absolute; border-radius: 50%; opacity: 0.15; filter: blur(60px); }
.circle-1 { width: 400px; height: 400px; background: #667eea; top: -100px; right: -100px; animation: float 8s ease-in-out infinite; }
.circle-2 { width: 300px; height: 300px; background: #764ba2; bottom: -50px; left: -50px; animation: float 10s ease-in-out infinite reverse; }
.circle-3 { width: 200px; height: 200px; background: #f093fb; top: 50%; left: 50%; animation: float 12s ease-in-out infinite; }
@keyframes float { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(30px, -30px) scale(1.1); } }
.login-card { width: 420px; padding: 40px; background: rgba(255,255,255,0.08); backdrop-filter: blur(20px); border-radius: var(--radius-xl); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 25px 50px rgba(0,0,0,0.3); position: relative; z-index: 1; }
.login-header { text-align: center; margin-bottom: 32px; }
.login-icon { width: 64px; height: 64px; margin: 0 auto 16px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(102,126,234,0.4); }
.login-title { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 6px; }
.login-subtitle { font-size: 14px; color: rgba(255,255,255,0.6); letter-spacing: 4px; }
.login-form { max-width: 320px; margin: 0 auto; }
.login-form :deep(.el-input__wrapper) { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); box-shadow: none; }
.login-form :deep(.el-input__inner) { color: #fff; }
.login-form :deep(.el-input__prefix-inner) { color: rgba(255,255,255,0.5); }
.login-btn { width: 100%; height: 44px; font-size: 16px; border-radius: var(--radius-sm); background: linear-gradient(135deg, #667eea, #764ba2); border: none; }
.login-btn:hover { background: linear-gradient(135deg, #5a6fd6, #6a4192); }
</style>
