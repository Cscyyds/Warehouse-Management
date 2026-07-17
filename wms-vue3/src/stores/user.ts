import { defineStore } from 'pinia'
import { ref } from 'vue'

const AVATAR_KEY = 'operator_avatar'

function normalizeAvatarUrl(url: string | null | undefined): string {
  return String(url || '').trim().replace(/^`+|`+$/g, '')
}

export const useUserStore = defineStore('user', () => {
  const avatarUrl = ref<string>(normalizeAvatarUrl(localStorage.getItem(AVATAR_KEY)))

  function setAvatar(url: string | null | undefined) {
    const normalizedUrl = normalizeAvatarUrl(url)
    avatarUrl.value = normalizedUrl
    if (normalizedUrl) {
      localStorage.setItem(AVATAR_KEY, normalizedUrl)
    } else {
      localStorage.removeItem(AVATAR_KEY)
    }
  }

  function clearAvatar() {
    avatarUrl.value = ''
    localStorage.removeItem(AVATAR_KEY)
  }

  return { avatarUrl, setAvatar, clearAvatar }
})
