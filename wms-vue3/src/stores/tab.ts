import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TabItem {
  /** 标签唯一标识 + 跳转地址。对复用路由（如 /common/add）存 fullPath（含 type/id/mode），
   *  以区分不同业务与新增/编辑/详情；对普通页面即 path 本身。 */
  path: string
  title: string
  closable: boolean
}

export const useTabStore = defineStore('tab', () => {
  const tabs = ref<TabItem[]>([
    { path: '/dashboard', title: '仪表盘', closable: false }
  ])
  const activeTab = ref('/dashboard')

  /**
   * 缓存失效计数（path → 递增 tick）：keep-alive 缓存页（MainLayout）把它拼进组件 key，
   * tick 变化 → 同 fullPath 下次进入强制重建实例，不复用旧缓存（旧草稿随之丢弃）。
   * 触发时机：关闭标签（closeTab/closeOtherTabs/closeAllTabs）、表单保存成功（AddTemplate）。
   */
  const remountTicks = ref<Record<string, number>>({})

  function invalidateTab(path: string) {
    remountTicks.value[path] = (remountTicks.value[path] || 0) + 1
  }

  function addTab(path: string, title: string) {
    const exists = tabs.value.find(t => t.path === path)
    if (!exists) {
      tabs.value.push({ path, title, closable: true })
    } else if (exists.title !== title) {
      // 复用路由（/common/add）再次进入时刷新标题，区分「新增 xx」/「编辑 xx」
      exists.title = title
    }
    activeTab.value = path
  }

  function closeTab(targetPath: string) {
    const index = tabs.value.findIndex(t => t.path === targetPath)
    if (index === -1 || !tabs.value[index].closable) return

    tabs.value.splice(index, 1)
    // 标签已关：同 fullPath 的 keep-alive 缓存（未保存草稿）一并作废，重开为全新页面
    invalidateTab(targetPath)

    if (activeTab.value === targetPath) {
      const newIndex = Math.min(index, tabs.value.length - 1)
      activeTab.value = tabs.value[newIndex]?.path || '/dashboard'
    }
  }

  function closeOtherTabs(keepPath: string) {
    tabs.value.filter(t => t.closable && t.path !== keepPath).forEach(t => invalidateTab(t.path))
    tabs.value = tabs.value.filter(t => !t.closable || t.path === keepPath)
    activeTab.value = keepPath
  }

  function closeAllTabs() {
    tabs.value.filter(t => t.closable).forEach(t => invalidateTab(t.path))
    tabs.value = tabs.value.filter(t => !t.closable)
    activeTab.value = '/dashboard'
  }

  function setActiveTab(path: string) {
    activeTab.value = path
  }

  /** 重置为初始状态：登录成功（含切换账号）时调用，避免残留上一个账号的标签页 */
  function reset() {
    tabs.value = [{ path: '/dashboard', title: '仪表盘', closable: false }]
    activeTab.value = '/dashboard'
    remountTicks.value = {}
  }

  return {
    tabs,
    activeTab,
    remountTicks,
    addTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    setActiveTab,
    invalidateTab,
    reset
  }
})
