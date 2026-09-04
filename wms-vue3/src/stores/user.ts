import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getMyProfile } from '@/api/modules/personnel'

const AVATAR_KEY = 'operator_avatar'

function normalizeAvatarUrl(url: string | null | undefined): string {
  return String(url || '').trim().replace(/^`+|`+$/g, '')
}

export const useUserStore = defineStore('user', () => {
  const avatarUrl = ref<string>(normalizeAvatarUrl(localStorage.getItem(AVATAR_KEY)))

  /** 当前登录人角色类型（后端英文标准值：ADMIN/MANAGER/EMPLOYEE），未知时为 '' */
  const roleType = ref<string>('')
  /** 当前登录人是否绑定系统角色（is_system_role=1，内置管理角色） */
  const isSystemRole = ref<boolean>(false)
  /** 自身资料是否已加载完成（成功或失败都算，保证 loadProfile 幂等不重复请求） */
  const profileLoaded = ref(false)
  /** 加载自身资料时的登录 token：换账号登录（token 变化）后自动重新判定，无需退出钩子配合 */
  const profileToken = ref<string>('')

  /**
   * 是否管理员：role_type=ADMIN 或绑定系统角色。
   * 用于前端按钮级收口（如角色管理「新增」按钮仅管理员可见）；接口级仍由后端兜底。
   */
  const isAdmin = computed(() => roleType.value === 'ADMIN' || isSystemRole.value)

  /**
   * 拉取当前登录人自身信息（GET /tenant-users/me），幂等、并发去重。
   * 失败不抛出：profileLoaded 置位、管理员判定回退 false——消费方应自行决定
   * 加载失败时的放行策略（如角色管理页在加载完成前按未判定放行，避免管理员按钮闪烁）。
   */
  function loadProfile(): Promise<void> {
    // 幂等条件 = 已加载完成 且 token 未变（退出重登另一账号时 token 变化 → 重新拉取）
    const token = String(localStorage.getItem('token') || '')
    if (profileLoaded.value && profileToken.value === token) return Promise.resolve()
    return getMyProfile()
      .then(res => {
        const me = res?.data
        roleType.value = String(me?.role_type || '').trim()
        isSystemRole.value = Number(me?.is_system_role) === 1
      })
      .catch(err => {
        console.error('[自身信息加载失败] 管理员判定回退为否', err)
      })
      .finally(() => {
        profileToken.value = token
        profileLoaded.value = true
      })
  }

  function setAvatar(url: string | null | undefined) {
    const normalizedUrl = normalizeAvatarUrl(url)
    avatarUrl.value = normalizedUrl
    if (normalizedUrl) {
      localStorage.setItem(AVATAR_KEY, normalizedUrl)
    } else {
      localStorage.removeItem(AVATAR_KEY)
    }
  }

  /** 清空头像（退出登录时由 MainLayout 调用，保持原有行为） */
  function clearAvatar() {
    avatarUrl.value = ''
    localStorage.removeItem(AVATAR_KEY)
  }

  /** 退出登录时清空会话级自身信息 */
  function clearProfile() {
    roleType.value = ''
    isSystemRole.value = false
    profileLoaded.value = false
  }

  return { avatarUrl, roleType, isSystemRole, profileLoaded, isAdmin, loadProfile, setAvatar, clearAvatar, clearProfile }
})
