<template>
  <div class="profile-page">
    <div class="page-header">
      <span class="page-title">个人中心</span>
      <div class="header-tabs">
        <span class="header-tab" @click="goProfile">个人信息</span>
        <span class="header-tab active">修改密码</span>
        <span class="header-tab" @click="goMyVisitTask">负责拜访任务</span>
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
          <el-form-item label="图形验证码：">
            <div class="captcha-row">
              <el-input
                v-model="captchaCode"
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

          <!-- 验证码（2026-09-29 双通道：EMAIL 发绑定邮箱 / SMS 发绑定手机号） -->
          <el-alert
            v-if="profileLoaded && !availableChannels.length"
            title="当前账号未绑定邮箱和手机号，无法接收验证码；请先在个人信息页绑定后再修改密码"
            type="warning"
            :closable="false"
            show-icon
            class="channel-alert"
          />
          <el-form-item v-if="availableChannels.length > 1" label="发送通道：">
            <el-radio-group v-model="sendChannel">
              <el-radio-button
                v-for="opt in availableChannels"
                :key="opt.value"
                :value="opt.value"
              >{{ opt.label }}</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="验证码：" prop="verification_code">
            <div class="captcha-row">
              <el-input
                v-model="form.verification_code"
                :placeholder="codeInputPlaceholder"
                style="width: 180px"
                maxlength="10"
              />
              <el-button
                :disabled="countdown > 0 || !availableChannels.length"
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
import { computed, ref, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Check, RefreshLeft } from '@element-plus/icons-vue'
import { updateUserSecure, getMyProfile } from '@/api'
import type { VerificationChannel } from '@/api'
import { useVerificationCode } from '@/composables/useVerificationCode'
import { useUserStore } from '@/stores/user'
import maleAvatarImg from '@/static/man.png'

const router = useRouter()
const userStore = useUserStore()
const operatorName = localStorage.getItem('operator_name') || ''
const currentAvatar = computed(() => userStore.avatarUrl || maleAvatarImg)

const formRef = ref<FormInstance>()
const saving = ref(false)
// 验证码发送公共逻辑（图形码/冷却/双通道发送）——2026-09-29 双通道批次抽公共 composable
const { captchaImg, captchaCode, sendingCode, countdown, supportedChannels,
        refreshCaptcha, loadSupportedChannels, sendCode } = useVerificationCode()

/** 账号绑定情况（决定通道可用性：EMAIL 需已绑邮箱、SMS 需已绑手机） */
const profileLoaded = ref(false)
const hasEmail = ref(false)
const hasMobile = ref(false)
const sendChannel = ref<VerificationChannel>('EMAIL')

const availableChannels = computed<Array<{ value: VerificationChannel; label: string }>>(() => {
  const list: Array<{ value: VerificationChannel; label: string }> = []
  if (hasEmail.value && supportedChannels.value.includes('EMAIL')) {
    list.push({ value: 'EMAIL', label: '邮箱' })
  }
  if (hasMobile.value && supportedChannels.value.includes('SMS')) {
    list.push({ value: 'SMS', label: '短信' })
  }
  return list
})
const codeInputPlaceholder = computed(() =>
  sendChannel.value === 'SMS' ? '请输入短信验证码' : '请输入邮箱验证码')

const form = reactive({
  new_password: '',
  confirm_password: '',
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
  verification_code: [{ required: true, message: '请输入验证码', trigger: 'blur' }],
}
// 可选项变化时把通道收敛到可用项
watch(availableChannels, (options) => {
  if (options.length && !options.some((opt) => opt.value === sendChannel.value)) {
    sendChannel.value = options[0].value
  }
}, { immediate: true })

async function handleSendCode() {
  if (!availableChannels.value.length) {
    ElMessage.warning('当前账号未绑定邮箱和手机号，无法接收验证码')
    return
  }
  await sendCode('USER_UPDATE_PASSWORD', sendChannel.value)
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

function goMyVisitTask() {
  router.push('/profile/my-visit-task')
}

onMounted(async () => {
  void refreshCaptcha()
  void loadSupportedChannels()
  try {
    // 账号绑定情况决定通道可用性（EMAIL 需已绑邮箱、SMS 需已绑手机）；
    // 自身信息走身份级接口（仅验登录，无需员工管理权限）
    const res = await getMyProfile()
    hasEmail.value = !!res.data?.email
    hasMobile.value = !!res.data?.mobile
    profileLoaded.value = true
  } catch {
    // 加载失败不阻塞页面；通道按钮此时不可用并给出提示
    profileLoaded.value = true
  }
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
.channel-alert { margin-bottom: 18px; }
.captcha-img {
  height: 40px; width: 120px; cursor: pointer;
  border: 1px solid var(--border-color); border-radius: 4px;
  object-fit: contain; flex-shrink: 0;
}
.pwd-tips {
  margin: 0 0 20px 0;
  font-size: 12px; color: var(--text-tertiary); line-height: 1.8;
}
.pwd-tips ul { margin: 0; padding-left: 16px; }
.form-actions { margin-top: 8px; }
:deep(.form-actions .el-form-item__content) { display: flex; gap: 12px; }
</style>
