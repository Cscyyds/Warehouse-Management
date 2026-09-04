<template>
  <div class="profile-page">
    <div class="page-header">
      <span class="page-title">个人中心</span>
      <div class="header-tabs">
        <span class="header-tab active">个人信息</span>
        <span class="header-tab" @click="goChangePassword">修改密码</span>
        <span class="header-tab" @click="goMyVisitTask">负责拜访任务</span>
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
        <div class="avatar-upload-tip">仅支持图片文件，大小不超过 10MB</div>
      </div>

      <!-- 右侧：个人信息表单 -->
      <div class="info-panel">
        <el-form :model="form" label-width="110px" size="default" class="info-form">
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
          <el-form-item label="手机号码：">
            <el-input v-model="form.mobile" placeholder="请输入手机号码">
              <template #suffix><el-icon><Cellphone /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-alert
            v-if="hasMultipleSecureChanges"
            title="邮箱和手机号属于敏感信息，请一次修改一项并分别完成验证"
            type="warning"
            :closable="false"
            show-icon
            class="secure-change-alert"
          />
          <template v-else-if="requiresSensitiveVerification">
            <el-form-item label="图形验证码：">
              <div class="verify-row">
                <el-input
                  v-model="captchaCode"
                  placeholder="请输入图形验证码"
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
            <el-form-item :label="`${sensitiveFieldLabel}验证码：`">
              <div class="verify-row">
                <el-input
                  v-model="verificationCode"
                  placeholder="请输入当前绑定邮箱收到的验证码"
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
          </template>
          <el-form-item label="办公电话：">
            <el-input v-model="form.office_phone" placeholder="请输入办公电话">
              <template #suffix><el-icon><Phone /></el-icon></template>
            </el-input>
          </el-form-item>
          <!-- <el-form-item label="个性签名：">
            <el-input
              v-model="form.signature"
              type="textarea"
              :rows="3"
              placeholder="请输入个性签名"
            />
          </el-form-item> -->

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
import { updateMyProfile, updateUserSecure, sendVerificationCode, getCaptcha, getMyProfile, uploadUserAvatar } from '@/api'
import { useUserStore } from '@/stores/user'
import maleAvatarImg from '@/static/man.png'
import femaleAvatarImg from '@/static/women.png'

const router = useRouter()
const userStore = useUserStore()

const operatorName = localStorage.getItem('operator_name') || ''
const operatorId = localStorage.getItem('operator_id') || ''

const maleAvatar = maleAvatarImg
const femaleAvatar = femaleAvatarImg
const AVATAR_MAX_SIZE_MB = 10

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
  if (rawFile.size > AVATAR_MAX_SIZE_MB * 1024 * 1024) {
    ElMessage.warning(`头像图片大小不能超过 ${AVATAR_MAX_SIZE_MB}MB`)
    return
  }
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
const verificationCode = ref('')
const captchaCode = ref('')
const captchaImg = ref('')
const captchaId = ref('')
const sendingCode = ref(false)
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const normalizedFormEmail = computed(() => form.email.trim().toLowerCase())
const normalizedServerEmail = computed(() => serverEmail.value.trim().toLowerCase())
const emailChanged = computed(() => !!normalizedFormEmail.value && normalizedFormEmail.value !== normalizedServerEmail.value)
const requiresEmailVerification = computed(() => emailChanged.value && !!normalizedServerEmail.value)
const normalizedFormMobile = computed(() => form.mobile.trim())
const normalizedServerMobile = computed(() => serverMobile.value.trim())
const mobileChanged = computed(() => !!normalizedFormMobile.value && normalizedFormMobile.value !== normalizedServerMobile.value)
const requiresMobileVerification = computed(() => mobileChanged.value && !!normalizedServerMobile.value)
const hasMultipleSecureChanges = computed(() => requiresEmailVerification.value && requiresMobileVerification.value)
const secureField = computed<'email' | 'mobile' | null>(() => {
  if (hasMultipleSecureChanges.value) return null
  if (requiresEmailVerification.value) return 'email'
  if (requiresMobileVerification.value) return 'mobile'
  return null
})
const requiresSensitiveVerification = computed(() => secureField.value !== null)
const sensitiveFieldLabel = computed(() => secureField.value === 'mobile' ? '手机号' : '邮箱')
const verificationPurpose = computed(() => secureField.value === 'mobile' ? 'USER_UPDATE_PHONE' : 'USER_UPDATE_EMAIL')

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

function resetVerificationState() {
  captchaImg.value = ''
  captchaId.value = ''
  captchaCode.value = ''
  verificationCode.value = ''
  countdown.value = 0
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

async function refreshCaptcha() {
  try {
    const res = await getCaptcha()
    captchaImg.value = res.data.image_data
    captchaId.value = res.data.captcha_id
    captchaCode.value = ''
  } catch {
    // 错误已由 request 拦截器统一处理
  }
}

async function handleSendCode() {
  if (!requiresSensitiveVerification.value) return
  if (!captchaId.value || !captchaCode.value.trim()) {
    ElMessage.warning('请先填写图形验证码')
    return
  }
  sendingCode.value = true
  try {
    await sendVerificationCode({
      purpose: verificationPurpose.value,
      captcha_id: captchaId.value,
      captcha_code: captchaCode.value.trim(),
    })
    ElMessage.success('验证码已发送至当前绑定邮箱，请注意查收')
    await refreshCaptcha()
    startCountdown()
  } catch {
    await refreshCaptcha()
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
  if (hasMultipleSecureChanges.value) {
    ElMessage.warning('邮箱和手机号需要分别修改并完成验证')
    return
  }
  const profilePayload: Parameters<typeof updateMyProfile>[0] = { target_user_id: operatorId }
  const normalizedName = form.user_name.trim()
  const normalizedMobile = normalizedFormMobile.value
  const normalizedEmail = normalizedFormEmail.value

  if (normalizedName && normalizedName !== operatorName) {
    profilePayload.user_name = normalizedName
  }
  if (mobileChanged.value && !requiresMobileVerification.value) {
    // 首次绑定手机号仍走基础资料接口。
    profilePayload.mobile = normalizedMobile
  }
  if (emailChanged.value && !requiresEmailVerification.value) {
    // 首次绑定邮箱仍走基础资料接口。
    profilePayload.email = normalizedEmail
  }

  const shouldUpdateProfile = Object.keys(profilePayload).length > 1
  const shouldUpdateSecure = requiresSensitiveVerification.value
  const hasAvatarChanged = !!pendingAvatarFile.value
  if (!shouldUpdateProfile && !shouldUpdateSecure && !hasAvatarChanged) {
    ElMessage.info('未检测到可保存的变更')
    return
  }
  if (shouldUpdateSecure && !verificationCode.value.trim()) {
    ElMessage.warning('请输入邮箱验证码')
    return
  }

  try {
    if (shouldUpdateProfile) {
      await updateMyProfile(profilePayload)
    }
    if (shouldUpdateSecure && secureField.value) {
      const secureValue = secureField.value === 'email' ? normalizedEmail : normalizedMobile
      await updateUserSecure({
        field_name: secureField.value,
        value: secureValue,
        verification_code: verificationCode.value.trim(),
      })
      if (secureField.value === 'email') {
        serverEmail.value = normalizedEmail
        form.email = normalizedEmail
      } else {
        serverMobile.value = normalizedMobile
        form.mobile = normalizedMobile
      }
      verificationCode.value = ''
      captchaCode.value = ''
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
  verificationCode.value = ''
  captchaCode.value = ''
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

function goMyVisitTask() {
  router.push('/profile/my-visit-task')
}

onMounted(async () => {
  const storedName = localStorage.getItem('operator_name') || ''
  form.user_name = storedName

  try {
    // 自身信息走身份级接口（仅验登录，无需员工管理接口权限）；此前误用
    // tenant-users/search，导致无员工管理权限的账号进个人中心必弹「权限不足」
    const res = await getMyProfile()
    const user = res.data
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
})

watch(secureField, (field, previousField) => {
  if (field === previousField) return
  resetVerificationState()
  if (field) void refreshCaptcha()
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

.avatar-upload-tip {
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
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

.secure-change-alert {
  margin: 0 0 18px 110px;
  width: calc(100% - 110px);
}

/* 图形/邮箱验证码标签较长，避免在 110px label-width 下换行 */
.info-form :deep(.el-form-item) .verify-label {
  white-space: nowrap;
}

.info-form :deep(.el-form-item):has(.verify-row) .el-form-item__label {
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
  margin: 0 0 20px 110px;
  border: 1px solid var(--border-light);
}

.form-actions { margin-top: 4px; }

:deep(.form-actions .el-form-item__content) {
  display: flex;
  gap: 10px;
}
</style>
