<template>
  <div class="agent-login-page">
    <div class="agent-login-card">
      <header class="agent-login-header">
        <h1 class="agent-login-title">图册 PDF 解析</h1>
        <p class="agent-login-subtitle">独立账号 · 上传图册自动提取产品与图片</p>
      </header>

      <el-tabs v-model="tab" class="agent-login-tabs">
        <el-tab-pane label="登录" name="login">
          <el-form :model="loginForm" label-position="top" @submit.prevent="handleLogin">
            <el-form-item label="账号">
              <el-input
                v-model="loginForm.login_name"
                placeholder="请输入账号"
                size="large"
                autocomplete="username"
                :prefix-icon="User"
              />
            </el-form-item>
            <el-form-item label="密码">
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="请输入密码"
                size="large"
                show-password
                autocomplete="current-password"
                :prefix-icon="Lock"
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            <el-button
              type="primary"
              size="large"
              class="agent-login-submit"
              :loading="submitting"
              @click="handleLogin"
            >
              登 录
            </el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <el-form :model="registerForm" label-position="top" @submit.prevent="handleRegister">
            <el-form-item label="账号">
              <el-input
                v-model="registerForm.login_name"
                placeholder="3-32 位字母、数字或下划线"
                size="large"
                autocomplete="username"
                :prefix-icon="User"
              />
            </el-form-item>
            <el-form-item label="显示名（可选）">
              <el-input
                v-model="registerForm.user_name"
                placeholder="默认与账号相同"
                size="large"
                :prefix-icon="User"
              />
            </el-form-item>
            <el-form-item label="密码">
              <el-input
                v-model="registerForm.password"
                type="password"
                placeholder="至少 8 位，含字母和数字"
                size="large"
                show-password
                autocomplete="new-password"
                :prefix-icon="Lock"
              />
            </el-form-item>
            <el-form-item label="确认密码">
              <el-input
                v-model="registerForm.confirm"
                type="password"
                placeholder="再次输入密码"
                size="large"
                show-password
                autocomplete="new-password"
                :prefix-icon="Lock"
                @keyup.enter="handleRegister"
              />
            </el-form-item>
            <el-button
              type="primary"
              size="large"
              class="agent-login-submit"
              :loading="submitting"
              @click="handleRegister"
            >
              注 册
            </el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <p class="agent-login-tip">
        本页为图册解析的独立账号，与 WMS 账号互不相通。
        <el-link type="primary" :underline="false" @click="gotoWmsLogin">WMS 员工请用 WMS 账号登录</el-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'

const router = useRouter()
const tab = ref<'login' | 'register'>('login')
const submitting = ref(false)

const loginForm = reactive({ login_name: '', password: '' })
const registerForm = reactive({ login_name: '', user_name: '', password: '', confirm: '' })

// 独立会话与 WMS 员工会话共用 localStorage['token']（工作台就是读这个 key），
// 用 auth_kind 区分：守卫据此跳过 WMS 权限加载，401 处理据此决定跳哪个登录页。
const SESSION_FIELDS = ['operator_id', 'operator_name', 'operator_type', 'company_id', 'login_name']
// 切到独立会话前暂存的 WMS 会话：切回 WMS 时直接复用，不必重新输密码
const WMS_STASH_KEY = 'wms_session'

function readCurrentSession() {
  const token = localStorage.getItem('token') || ''
  if (!token) return null
  const session: Record<string, string> = { token }
  SESSION_FIELDS.forEach((k) => { session[k] = localStorage.getItem(k) || '' })
  return session
}

// 读 JWT 的 exp（不验签，只用于判断本地令牌是否还有效）；解析失败按过期处理
function jwtExpiresAt(token: string): number {
  try {
    const part = (token.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/')
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4)
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))))
    return Number(json.exp || 0) * 1000
  } catch {
    return 0
  }
}

function isUsable(token: string): boolean {
  return !!token && jwtExpiresAt(token) > Date.now() + 30_000
}

function saveSession(data: any) {
  // 独立会话要占用同一个 token 槽：先把现有的 WMS 会话暂存下来，切回时直接恢复
  const prev = readCurrentSession()
  if (prev && localStorage.getItem('auth_kind') !== 'pdf_agent' && isUsable(prev.token)) {
    localStorage.setItem(WMS_STASH_KEY, JSON.stringify(prev))
  }
  localStorage.setItem('token', data.access_token)
  localStorage.setItem('operator_id', data.user_id)
  localStorage.setItem('operator_name', data.user_name)
  localStorage.setItem('operator_type', 'PDF_AGENT')
  localStorage.setItem('company_id', data.company_id)
  localStorage.setItem('login_name', data.login_name)
  localStorage.setItem('auth_kind', 'pdf_agent')
}

// 切回 WMS：有可用令牌就直接进，不强制重新登录
function gotoWmsLogin() {
  const stashRaw = localStorage.getItem(WMS_STASH_KEY)
  if (stashRaw) {
    try {
      const stash = JSON.parse(stashRaw)
      if (stash?.token && isUsable(stash.token)) {
        localStorage.setItem('token', stash.token)
        SESSION_FIELDS.forEach((k) => { if (stash[k]) localStorage.setItem(k, stash[k]) })
        localStorage.setItem('auth_kind', 'wms')
        localStorage.removeItem(WMS_STASH_KEY)
        router.replace('/dashboard')
        return
      }
    } catch {
      /* 暂存损坏，按无会话处理 */
    }
    localStorage.removeItem(WMS_STASH_KEY)
  }
  // 当前本来就是 WMS 会话（WMS 用户也能打开这个页面）→ 直接进
  const current = readCurrentSession()
  if (current && localStorage.getItem('auth_kind') !== 'pdf_agent' && isUsable(current.token)) {
    router.replace('/dashboard')
    return
  }
  // 没有可用 WMS 会话：清掉独立会话，回 WMS 登录页
  localStorage.removeItem('token')
  localStorage.removeItem('auth_kind')
  router.replace('/login')
}

async function postJson(url: string, body: unknown): Promise<any> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let data: any = null
  try {
    data = await r.json()
  } catch {
    /* 响应非 JSON（如网关错误页） */
  }
  if (!r.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : `请求失败（HTTP ${r.status}）`
    throw new Error(detail)
  }
  return data
}

async function handleLogin() {
  if (submitting.value) return
  if (!loginForm.login_name || !loginForm.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  submitting.value = true
  try {
    const data = await postJson('/pdf-agent/api/auth/login', {
      login_name: loginForm.login_name.trim(),
      password: loginForm.password,
    })
    saveSession(data)
    ElMessage.success('登录成功')
    await router.replace('/ai/pdf_agent')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '登录失败，请重试')
  } finally {
    submitting.value = false
  }
}

async function handleRegister() {  if (submitting.value) return
  if (!registerForm.login_name || !registerForm.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  if (registerForm.password !== registerForm.confirm) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }
  submitting.value = true
  try {
    await postJson('/pdf-agent/api/auth/register', {
      login_name: registerForm.login_name.trim(),
      password: registerForm.password,
      user_name: registerForm.user_name.trim(),
    })
    // 注册成功后直接登录，省一次输入
    const data = await postJson('/pdf-agent/api/auth/login', {
      login_name: registerForm.login_name.trim(),
      password: registerForm.password,
    })
    saveSession(data)
    ElMessage.success('注册成功，已自动登录')
    await router.replace('/ai/pdf_agent')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '注册失败，请重试')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.agent-login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-page);
  padding: 24px;
}

.agent-login-card {
  width: 420px;
  max-width: 100%;
  padding: 40px 36px 28px;
  background: var(--bg-white);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
}

.agent-login-header {
  text-align: center;
  margin-bottom: 20px;
}

.agent-login-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 6px;
}

.agent-login-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.agent-login-tabs :deep(.el-tabs__header) {
  margin-bottom: 18px;
}

.agent-login-submit {
  width: 100%;
  margin-top: 6px;
}

.agent-login-tip {
  margin: 18px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-tertiary);
  text-align: center;
}
</style>
