<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const formRef = ref<FormInstance>()
const loading = ref(false)
const showPassword = ref(false)
const form = reactive({ account: '', password: '' })
const rules: FormRules = {
  account: [{ required: true, message: '请输入管理员账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入登录密码', trigger: 'blur' }],
}

const reason = computed(() => route.query.reason === 'system-only' ? '此控制台仅对系统管理员开放' : '')

async function submit() {
  if (!await formRef.value?.validate().catch(() => false)) return
  loading.value = true
  try {
    await auth.login(form.account.trim(), form.password)
    ElMessage.success('系统管理员身份已确认')
    const target = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
      ? route.query.redirect
      : '/platform/tenants'
    await router.replace(target)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-manifest">
      <div class="manifest-grid" aria-hidden="true" />
      <div class="manifest-copy">
        <div class="manifest-kicker mono-label">WAREHOUSE PLATFORM / SYSTEM ACCESS</div>
        <h1>每一次平台配置，<br><em>都有清晰去向。</em></h1>
        <p>租客开通、权限编排、人员初始化与操作追溯，在同一条控制链上完成。</p>
      </div>
      <div class="cargo-sequence" aria-label="操作顺序">
        <span>租客</span><i>→</i><span>权限</span><i>→</i><span>人员</span><i>→</i><span>追溯</span>
      </div>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <div class="login-brand"><div class="brand-mark"><span /><span /><span /></div><strong>智星 WMS</strong></div>
        <div class="login-heading">
          <span class="mono-label">SYSTEM ADMIN ONLY</span>
          <h2>进入平台控制台</h2>
          <p>使用系统管理员账号完成身份校验。</p>
        </div>
        <el-alert v-if="reason" :title="reason" type="warning" :closable="false" show-icon />
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @keyup.enter="submit">
          <el-form-item label="管理员账号" prop="account">
            <el-input v-model="form.account" size="large" autocomplete="username" placeholder="手机号、邮箱或登录账号" />
          </el-form-item>
          <el-form-item label="登录密码" prop="password">
            <el-input v-model="form.password" size="large" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="输入登录密码">
              <template #suffix><button class="input-action" type="button" @click="showPassword = !showPassword">{{ showPassword ? '隐藏' : '显示' }}</button></template>
            </el-input>
          </el-form-item>
          <el-button class="primary-action" type="primary" size="large" :loading="loading" @click="submit">验证身份并进入</el-button>
        </el-form>
        <div class="login-footnote"><span class="status-dot" /> 登录信息仅保留在当前浏览器会话</div>
      </div>
    </section>
  </main>
</template>
