<template>
  <div class="profile-page">
    <div class="page-header">
      <span class="page-title">个人中心</span>
      <div class="header-tabs">
        <span class="header-tab" @click="goProfile">个人信息</span>
        <span class="header-tab active">修改密码</span>
      </div>
    </div>

    <div class="profile-card">
      <!-- 左侧：头像区域 -->
      <div class="avatar-panel">
        <div class="avatar-wrap">
          <img :src="currentAvatar" class="avatar-img" alt="头像" />
        </div>
        <div class="user-display-name">{{ operatorName }}</div>
        <div class="user-role-tag">修改密码</div>
      </div>

      <!-- 右侧：修改密码表单 -->
      <div class="info-panel">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-width="120px"
          size="default"
          class="pwd-form"
        >
          <el-form-item label="新密码：" prop="new_password">
            <el-input
              v-model="form.new_password"
              type="password"
              show-password
              placeholder="请输入新密码（至少6位）"
              style="max-width: 320px"
            />
          </el-form-item>
          <el-form-item label="确认新密码：" prop="confirm_password">
            <el-input
              v-model="form.confirm_password"
              type="password"
              show-password
              placeholder="请再次输入新密码"
              style="max-width: 320px"
            />
          </el-form-item>

          <!-- 图形验证码 -->
          <el-form-item label="图形验证码：" prop="captcha_code">
            <div class="captcha-row">
              <el-input
                v-model="form.captcha_code"
                placeholder="请输入图形验证码"
                style="width: 180px"
                maxlength="4"
              />
              <img
                v-if="captchaImg"
                :src="captchaImg"
                class="captcha-img"
                title="点击刷新"
                @click="refreshCaptcha"
              />
              <el-button v-else link @click="refreshCaptcha">加载验证码</el-button>
            </div>
          </el-form-item>

          <!-- 邮箱验证码 -->
          <el-form-item label="邮箱验证码：" prop="verification_code">
            <div class="captcha-row">
              <el-input
                v-model="form.verification_code"
                placeholder="请输入邮箱验证码"
                style="width: 180px"
                maxlength="10"
              />
              <el-button
                :disabled="countdown > 0"
                :loading="sendingCode"
                @click="handleSendCode"
              >
                {{ countdown > 0 ? `${countdown}s 后重发` : '发送验证码' }}
              </el-button>
            </div>
          </el-form-item>

          <div class="pwd-tips">
            <ul>
              <li>密码长度至少 6 位</li>
              <li>建议包含字母、数字及特殊字符</li>
              <li>请勿使用与账号相同的密码</li>
            </ul>
          </div>

          <el-form-item class="form-actions">
            <el-button type="primary" :loading="saving" @click="handleSave">
              <el-icon><Check /></el-icon>保存
            </el-button>
            <el-button @click="handleReset">
              <el-icon><RefreshLeft /></el-icon>还原
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Check, RefreshLeft } from '@element-plus/icons-vue'
import { updateUserSecure, sendVerificationCode, getCaptcha } from '@/api'
import { useUserStore } from '@/stores/user'
import maleAvatarImg from '@/static/man.png'

const router = useRouter()
const userStore = useUserStore()
const operatorName = localStorage.getItem('operator_name') || ''
const currentAvatar = computed(() => userStore.avatarUrl || maleAvatarImg)

const formRef = ref<FormInstance>()
const saving = ref(false)
const sendingCode = ref(false)
const countdown = ref(0)
const captchaImg = ref('')
const captchaId = ref('')

const form = reactive({
  new_password: '',
  confirm_password: '',
  captcha_code: '',
  verification_code: '',
})

const validateConfirm = (_rule: any, value: string, callback: any) => {
  if (value !== form.new_password) callback(new Error('两次输入的密码不一致'))
  else callback()
}

const rules: FormRules = {
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少 6 位', trigger: 'blur' },
  ],
  confirm_password: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' },
  ],
  captcha_code: [{ required: true, message: '请输入图形验证码', trigger: 'blur' }],
  verification_code: [{ required: true, message: '请输入邮箱验证码', trigger: 'blur' }],
}

async function refreshCaptcha() {
  try {
    const res = await getCaptcha()
    captchaImg.value = res.data.image_data
    captchaId.value = res.data.captcha_id
    form.captcha_code = ''
  } catch {
    // 错误由拦截器处理
  }
}

let countdownTimer: ReturnType<typeof setInterval> | null = null

async function handleSendCode() {
  if (!captchaId.value || !form.captcha_code) {
    ElMessage.warning('请先填写图形验证码')
    return
  }
  sendingCode.value = true
  try {
    await sendVerificationCode({
      purpose: 'USER_UPDATE_PASSWORD',
      captcha_id: captchaId.value,
      captcha_code: form.captcha_code,
    })
    ElMessage.success('验证码已发送至绑定邮箱，请注意查收')
    await refreshCaptcha()
    countdown.value = 60
    countdownTimer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0 && countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
    }, 1000)
  } catch {
    await refreshCaptcha()
    // 错误由拦截器处理
  } finally {
    sendingCode.value = false
  }
}

async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    await updateUserSecure({
      field_name: 'password',
      value: form.new_password,
      verification_code: form.verification_code,
    })
    ElMessage.success('密码修改成功，请重新登录')
    setTimeout(() => {
      localStorage.removeItem('token')
      router.push('/login')
    }, 1500)
  } catch {
    await refreshCaptcha()
  } finally {
    saving.value = false
  }
}

function handleReset() {
  formRef.value?.resetFields()
}

function goProfile() {
  router.push('/profile')
}

onMounted(() => {
  refreshCaptcha()
})
</script>

<style scoped>
.profile-page { padding: 0; }

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}
.page-title { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.header-tabs { display: flex; }
.header-tab {
  padding: 6px 18px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-right: none;
  background: var(--bg-white);
  transition: all 0.2s;
  user-select: none;
}
.header-tab:first-child { border-radius: 4px 0 0 4px; }
.header-tab:last-child { border-right: 1px solid var(--border-color); border-radius: 0 4px 4px 0; }
.header-tab:hover { color: var(--primary); background: var(--primary-bg); }
.header-tab.active { color: var(--primary); background: var(--primary-bg); border-color: var(--primary); font-weight: 500; }

.profile-card {
  background: var(--bg-white);
  border-radius: 6px;
  border: 1px solid var(--border-color);
  display: flex;
  min-height: 380px;
  overflow: hidden;
}
.avatar-panel {
  flex: 1;
  padding: 40px 20px 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: var(--bg-white);
}
.avatar-wrap {
  width: 100px; height: 100px;
  border-radius: 50%; overflow: hidden;
  border: 3px solid var(--border-color);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.user-display-name { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-top: 4px; }
.user-role-tag {
  font-size: 12px; color: var(--text-tertiary);
  background: var(--border-light); padding: 2px 10px; border-radius: 10px;
}
.info-panel { flex: 1; padding: 40px 40px 30px 30px; }
.pwd-form { max-width: 520px; }
.captcha-row { display: flex; align-items: center; gap: 10px; }
.captcha-img {
  height: 40px; width: 120px; cursor: pointer;
  border: 1px solid var(--border-color); border-radius: 4px;
  object-fit: contain; flex-shrink: 0;
}
.pwd-tips {
  margin: 0 0 20px 120px;
  font-size: 12px; color: var(--text-tertiary); line-height: 1.8;
}
.pwd-tips ul { margin: 0; padding-left: 16px; }
.form-actions { margin-top: 8px; }
:deep(.form-actions .el-form-item__content) { display: flex; gap: 12px; }
</style>
