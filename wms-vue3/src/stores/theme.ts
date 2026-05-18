import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(localStorage.getItem('theme') === 'dark')

  function setDark(val: boolean) {
    isDark.value = val
    localStorage.setItem('theme', val ? 'dark' : 'light')
    applyTheme(val)
  }

  function toggleTheme() {
    setDark(!isDark.value)
  }

  function applyTheme(dark: boolean) {
    document.documentElement.classList.toggle('dark', dark)
  }

  function initTheme() {
    applyTheme(isDark.value)
  }

  return { isDark, setDark, toggleTheme, initTheme }
})
