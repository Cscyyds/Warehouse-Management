import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TabItem {
  path: string
  title: string
  closable: boolean
}

export const useTabStore = defineStore('tab', () => {
  const tabs = ref<TabItem[]>([
    { path: '/dashboard', title: '仪表盘', closable: false }
  ])
  const activeTab = ref('/dashboard')

  function addTab(path: string, title: string) {
    const exists = tabs.value.find(t => t.path === path)
    if (!exists) {
      tabs.value.push({ path, title, closable: true })
    }
    activeTab.value = path
  }

  function closeTab(targetPath: string) {
    const index = tabs.value.findIndex(t => t.path === targetPath)
    if (index === -1 || !tabs.value[index].closable) return

    tabs.value.splice(index, 1)

    if (activeTab.value === targetPath) {
      const newIndex = Math.min(index, tabs.value.length - 1)
      activeTab.value = tabs.value[newIndex]?.path || '/dashboard'
    }
  }

  function closeOtherTabs(keepPath: string) {
    tabs.value = tabs.value.filter(t => !t.closable || t.path === keepPath)
    activeTab.value = keepPath
  }

  function closeAllTabs() {
    tabs.value = tabs.value.filter(t => !t.closable)
    activeTab.value = '/dashboard'
  }

  function setActiveTab(path: string) {
    activeTab.value = path
  }

  return {
    tabs,
    activeTab,
    addTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    setActiveTab
  }
})
