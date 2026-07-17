<template>
  <div class="profile-page">
    <div class="page-header">
      <span class="page-title">个人中心</span>
      <div class="header-tabs">
        <span class="header-tab active">个人信息</span>
        <span class="header-tab" @click="goChangePassword">修改密码</span>
      </div>
    </div>

    <div class="profile-card">
      <!-- 左侧：头像区域 -->
      <div class="avatar-panel">
        <div class="avatar-wrap">
          <img :src="currentAvatar" class="avatar-img" alt="头像" />
        </div>
        <div class="user-display-name">{{ form.user_name || operatorName }}</div>
        <div class="user-gender-row">
          <el-radio-group v-model="selectedGender" size="small" @change="handleGenderChange">
            <el-radio value="male">男</el-radio>
            <el-radio value="female">女</el-radio>
          </el-radio-group>
        </div>
        <el-upload
          class="avatar-upload"
          action=""
          :auto-upload="false"
          :show-file-list="false"
          accept="image/*"
          :on-change="handleAvatarChange"
        >
          <el-button size="small" class="upload-btn">自定义头像</el-button>
        </el-upload>
      </div>

      <!-- 右侧：个人信息表单 -->
      <div class="info-panel">
        <el-form :model="form" label-width="90px" size="default" class="info-form">
          <el-form-item label="用户昵称：">
            <el-input v-model="form.user_name" placeholder="请输入用户昵称">
              <template #suffix><el-icon><User /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item label="电子邮箱：">
            <el-input v-model="form.email" placeholder="请输入电子邮箱">
              <template #suffix><el-icon><Message /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item v-if="requiresEmailVerification" label="图形验证码：">
            <div class="verify-row">
              <el-input
                v-model="emailCaptchaCode"
                placeholder="请输入图形验证码"
                maxlength="4"
              />
              <img
                v-if="emailCaptchaImg"
                :src="emailCaptchaImg"
                class="captcha-img"
                title="点击刷新"
                @click="refreshEmailCaptcha"
              />
              <el-button v-else link @click="refreshEmailCaptcha">加载验证码</el-button>
            </div>
          </el-form-item>
          <el-form-item v-if="requiresEmailVerification" label="邮箱验证码：">
            <div class="verify-row">
              <el-input
                v-model="emailVerificationCode"
                placeholder="请输入当前绑定邮箱收到的验证码"
                maxlength="10"
              />
              <el-button
                :disabled="countdown > 0"
                :loading="sendingCode"
                @click="handleSendEmailCode"
              >
                {{ countdown > 0 ? `${countdown}s 后重发` : '发送验证码' }}
              </el-button>
            </div>
          </el-form-item>
          <el-form-item label="手机号码：">
            <el-input v-model="form.mobile" placeholder="请输入手机号码">
              <template #suffix><el-icon><Cellphone /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item label="办公电话：">
            <el-input v-model="form.office_phone" placeholder="请输入办公电话">
              <template #suffix><el-icon><Phone /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item label="个性签名：">
            <el-input
              v-model="form.signature"
              type="textarea"
              :rows="3"
              placeholder="请输入个性签名"
            />
          </el-form-item>

          <div class="last-login-info">
            上次登录：时间：{{ lastLoginTime }}　IP：{{ lastLoginIp }}
          </div>

          <el-form-item class="form-actions">
            <el-button type="primary" @click="handleSave">
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
import { ref, reactive, onMounted, computed, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Message, Cellphone, Phone, Check, RefreshLeft } from '@element-plus/icons-vue'
import { updateUserProfile, updateUserSecure, sendVerificationCode, getCaptcha, searchUsers, uploadUserAvatar } from '@/api'
import { useUserStore } from '@/stores/user'
import maleAvatarImg from '@/static/man.png'
import femaleAvatarImg from '@/static/women.png'

const router = useRouter()
const userStore = useUserStore()

const operatorName = localStorage.getItem('operator_name') || ''
const operatorId = localStorage.getItem('operator_id') || ''

const maleAvatar = maleAvatarImg
const femaleAvatar = femaleAvatarImg

const selectedGender = ref<'male' | 'female'>('male')
const customAvatarUrl = ref<string>('')
const pendingAvatarFile = ref<File | null>(null)
const avatarChanged = ref(false)
const originalAvatarUrl = ref(userStore.avatarUrl || '')
const currentAvatar = ref(originalAvatarUrl.value || maleAvatar)

function getDefaultAvatar() {
  return selectedGender.value === 'female' ? femaleAvatar : maleAvatar
}

function syncCurrentAvatar(avatarUrl?: string | null) {
  currentAvatar.value = String(avatarUrl || '').trim() || getDefaultAvatar()
}

function revokePreviewAvatar() {
  if (customAvatarUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(customAvatarUrl.value)
  }
  customAvatarUrl.value = ''
}

syncCurrentAvatar(originalAvatarUrl.value)

const form = reactive({
  user_name: operatorName,
  email: '',
  mobile: '',
  office_phone: '',
  signature: '',
})

// 原始数据用于还原
const originalForm = { ...form }

const lastLoginTime = ref('2026-07-04 11:02')
const lastLoginIp = ref('127.0.0.134')

function handleGenderChange(val: string) {
  if (!pendingAvatarFile.value && !originalAvatarUrl.value) {
    currentAvatar.value = val === 'female' ? femaleAvatar : maleAvatar
  }
}

function handleAvatarChange(file: any) {
  const rawFile = file.raw as File | undefined
  if (!rawFile) return
  revokePreviewAvatar()
  const url = URL.createObjectURL(rawFile)
  customAvatarUrl.value = url
  pendingAvatarFile.value = rawFile
  currentAvatar.value = url
  avatarChanged.value = true
}

// 记录从服务器加载的原始 email/mobile，用于判断是否有变更
const serverEmail = ref('')
const serverMobile = ref('')
const emailVerificationCode = ref('')
const emailCaptchaCode = ref('')
const emailCaptchaImg = ref('')
const emailCaptchaId = ref('')
const sendingCode = ref(false)
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const normalizedFormEmail = computed(() => form.email.trim().toLowerCase())
const normalizedServerEmail = computed(() => serverEmail.value.trim().toLowerCase())
const emailChanged = computed(() => !!normalizedFormEmail.value && normalizedFormEmail.value !== normalizedServerEmail.value)
const requiresEmailVerification = computed(() => emailChanged.value && !!normalizedServerEmail.value)

function startCountdown() {
  countdown.value = 60
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

async function refreshEmailCaptcha() {
  try {
    const res = await getCaptcha()
    emailCaptchaImg.value = res.data.image_data
    emailCaptchaId.value = res.data.captcha_id
    emailCaptchaCode.value = ''
  } catch {
    // 错误已由 request 拦截器统一处理
  }
}

async function handleSendEmailCode() {
  if (!requiresEmailVerification.value) return
  if (!emailCaptchaId.value || !emailCaptchaCode.value.trim()) {
    ElMessage.warning('请先填写图形验证码')
    return
  }
  sendingCode.value = true
  try {
    await sendVerificationCode({
      purpose: 'USER_UPDATE_EMAIL',
      captcha_id: emailCaptchaId.value,
      captcha_code: emailCaptchaCode.value.trim(),
    })
    ElMessage.success('验证码已发送至当前绑定邮箱，请注意查收')
    await refreshEmailCaptcha()
    startCountdown()
  } catch {
    await refreshEmailCaptcha()
    // 错误已由 request 拦截器统一处理
  } finally {
    sendingCode.value = false
  }
}

async function handleSave() {
  if (!operatorId) {
    ElMessage.warning('未获取到用户ID，请重新登录')
    return
  }
  const profilePayload: Parameters<typeof updateUserProfile>[0] = { target_user_id: operatorId }
  const normalizedName = form.user_name.trim()
  const normalizedMobile = form.mobile.trim()
  const normalizedEmail = normalizedFormEmail.value
  const mobileChanged = !!normalizedMobile && normalizedMobile !== serverMobile.value

  if (normalizedName && normalizedName !== operatorName) {
    profilePayload.user_name = normalizedName
  }
  if (mobileChanged) {
    profilePayload.mobile = normalizedMobile
  }
  if (emailChanged.value && !requiresEmailVerification.value) {
    // 首次绑定邮箱仍走基础资料接口。
    profilePayload.email = normalizedEmail
  }

  const shouldUpdateProfile = Object.keys(profilePayload).length > 1
  const shouldUpdateEmailSecure = requiresEmailVerification.value
  const hasAvatarChanged = !!pendingAvatarFile.value
  if (!shouldUpdateProfile && !shouldUpdateEmailSecure && !hasAvatarChanged) {
    ElMessage.info('未检测到可保存的变更')
    return
  }
  if (shouldUpdateEmailSecure && !emailVerificationCode.value.trim()) {
    ElMessage.warning('请输入邮箱验证码')
    return
  }

  try {
    if (shouldUpdateProfile) {
      await updateUserProfile(profilePayload)
    }
    if (shouldUpdateEmailSecure) {
      await updateUserSecure({
        field_name: 'email',
        value: normalizedEmail,
        verification_code: emailVerificationCode.value.trim(),
      })
      serverEmail.value = normalizedEmail
      form.email = normalizedEmail
      emailVerificationCode.value = ''
      emailCaptchaCode.value = ''
    } else if (profilePayload.email) {
      serverEmail.value = profilePayload.email
    }
    if (profilePayload.user_name) {
      localStorage.setItem('operator_name', profilePayload.user_name)
    }
    if (profilePayload.mobile) {
      serverMobile.value = profilePayload.mobile
    }
    if (hasAvatarChanged) {
      const avatarRes = await uploadUserAvatar(pendingAvatarFile.value as File)
      const savedAvatarUrl = avatarRes.data?.avatar_url || ''
      originalAvatarUrl.value = savedAvatarUrl
      userStore.setAvatar(savedAvatarUrl)
      syncCurrentAvatar(savedAvatarUrl)
      pendingAvatarFile.value = null
      revokePreviewAvatar()
      avatarChanged.value = false
    }
    ElMessage.success('保存成功')
  } catch {
    // 错误已由 request 拦截器统一处理
  }
}

function handleReset() {
  Object.assign(form, originalForm)
  form.email = serverEmail.value
  form.mobile = serverMobile.value
  emailVerificationCode.value = ''
  emailCaptchaCode.value = ''
  selectedGender.value = 'male'
  pendingAvatarFile.value = null
  revokePreviewAvatar()
  syncCurrentAvatar(originalAvatarUrl.value)
  avatarChanged.value = false
  userStore.setAvatar(originalAvatarUrl.value)
}

function goChangePassword() {
  router.push('/profile/change-password')
}

onMounted(async () => {
  const storedName = localStorage.getItem('operator_name') || ''
  form.user_name = storedName

  if (operatorId) {
    try {
      const res = await searchUsers({
        search_field: JSON.stringify(['user_id']),
        search_value: JSON.stringify({ user_id: operatorId }),
        page: 1,
      })
      const user = res.data?.user?.[0]
      if (user) {
        form.email = user.email || ''
        form.mobile = user.mobile || ''
        serverEmail.value = user.email || ''
        serverMobile.value = user.mobile || ''
        originalAvatarUrl.value = String(user.avatar_url || '').trim()
        userStore.setAvatar(originalAvatarUrl.value)
        syncCurrentAvatar(originalAvatarUrl.value)
      }
    } catch {
      // 加载失败不阻塞页面
    }
  }
})

watch(requiresEmailVerification, (enabled) => {
  if (enabled) {
    if (!emailCaptchaImg.value) void refreshEmailCaptcha()
  } else {
    emailCaptchaImg.value = ''
    emailCaptchaId.value = ''
    emailCaptchaCode.value = ''
    emailVerificationCode.value = ''
  }
})

onBeforeUnmount(() => {
  revokePreviewAvatar()
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
})
</script>

<style scoped>
/* ── Page shell ── */
.profile-page { padding: 0; animation: fadeInUp 0.3s ease; }

/* ── Header ── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Segmented tab switcher */
.header-tabs {
  display: flex;
  gap: 0;
  background: var(--bg-page);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 3px;
}

.header-tab {
  padding: 5px 16px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: var(--radius-xs);
  background: transparent;
  border: none;
  transition: color var(--transition-fast), background var(--transition-fast);
  user-select: none;
  font-weight: 500;
}

.header-tab:hover { color: var(--text-primary); }

.header-tab.active {
  color: var(--primary);
  background: var(--bg-white);
  box-shadow: var(--shadow-xs);
}

/* ── Profile Card ── */
.profile-card {
  background: var(--bg-white);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-xs);
  display: flex;
  min-height: 400px;
  overflow: hidden;
}

/* ── Avatar Panel (left) ── */
.avatar-panel {
  flex: 1;
  padding: 36px 24px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.avatar-wrap {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid var(--bg-white);
  box-shadow: var(--shadow-md);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.user-display-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  margin-top: 2px;
}

.user-gender-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.upload-btn {
  width: 120px !important;
  font-size: 13px !important;
  border-radius: var(--radius-sm) !important;
}

/* ── Info Panel (right) ── */
.info-panel {
  flex: 1;
  padding: 28px 36px 28px 32px;
}

.info-form { max-width: 460px; }

.verify-row {
  width: 100%;
  display: flex;
  gap: 10px;
}

.verify-row .el-input {
  flex: 1;
}

/* 图形/邮箱验证码标签较长，避免在 90px label-width 下换行 */
.info-form :deep(.el-form-item) .verify-label {
  white-space: nowrap;
}

.info-form :deep(.el-form-item):has(.verify-row) .el-form-item__label {
  width: 96px !important;
  white-space: nowrap;
}

.captcha-img {
  width: 110px;
  height: 32px;
  cursor: pointer;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs);
  object-fit: cover;
  background: var(--bg-page);
}

.last-login-info {
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-page);
  border-radius: var(--radius-xs);
  padding: 6px 10px;
  margin: 0 0 20px 90px;
  border: 1px solid var(--border-light);
}

.form-actions { margin-top: 4px; }

:deep(.form-actions .el-form-item__content) {
  display: flex;
  gap: 10px;
}
</style>
