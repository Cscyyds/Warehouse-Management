import { defineStore } from 'pinia'
import { ref } from 'vue'

const AVATAR_KEY = 'operator_avatar'

export const useUserStore = defineStore('user', () => {
  // 初始化时从 localStorage 读取，没有则为空字符串（显示默认图标）
  const avatarUrl = ref<string>(localStorage.getItem(AVATAR_KEY) || '')

  function setAvatar(url: string) {
    avatarUrl.value = url
    localStorage.setItem(AVATAR_KEY, url)
  }

  function clearAvatar() {
    avatarUrl.value = ''
    localStorage.removeItem(AVATAR_KEY)
  }

  return { avatarUrl, setAvatar, clearAvatar }
})
