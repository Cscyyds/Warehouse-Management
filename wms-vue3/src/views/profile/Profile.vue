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
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Message, Cellphone, Phone, Check, RefreshLeft } from '@element-plus/icons-vue'
import { updateUserProfile, searchUsers } from '@/api'
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

// 优先使用已持久化的头像，否则用默认性别图
const currentAvatar = ref(userStore.avatarUrl || maleAvatar)

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
  if (!customAvatarUrl.value) {
    currentAvatar.value = val === 'female' ? femaleAvatar : maleAvatar
  }
}

function handleAvatarChange(file: any) {
  const url = URL.createObjectURL(file.raw)
  customAvatarUrl.value = url
  currentAvatar.value = url
  userStore.setAvatar(url)
}

// 记录从服务器加载的原始 email/mobile，用于判断是否有变更
const serverEmail = ref('')
const serverMobile = ref('')

async function handleSave() {
  if (!operatorId) {
    ElMessage.warning('未获取到用户ID，请重新登录')
    return
  }
  const payload: Parameters<typeof updateUserProfile>[0] = {
    target_user_id: operatorId,
    user_name: form.user_name || undefined,
  }
  // 只在有新值且与服务器当前值不同时才传（首次绑定或变更）
  if (form.email && form.email !== serverEmail.value) {
    payload.email = form.email.trim()
  }
  if (form.mobile && form.mobile !== serverMobile.value) {
    payload.mobile = form.mobile.trim()
  }
  try {
    await updateUserProfile(payload)
    if (form.user_name) {
      localStorage.setItem('operator_name', form.user_name)
    }
    // 保存成功后同步 serverEmail/serverMobile，避免重复触发已绑定错误
    if (payload.email) serverEmail.value = payload.email
    if (payload.mobile) serverMobile.value = payload.mobile
    ElMessage.success('保存成功')
  } catch {
    // 错误已由 request 拦截器统一处理
  }
}

function handleReset() {
  Object.assign(form, originalForm)
  form.email = serverEmail.value
  form.mobile = serverMobile.value
  selectedGender.value = 'male'
  customAvatarUrl.value = ''
  currentAvatar.value = maleAvatar
  userStore.clearAvatar()
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
      }
    } catch {
      // 加载失败不阻塞页面
    }
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
