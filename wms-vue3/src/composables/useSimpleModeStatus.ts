import { ref } from 'vue'
import { getSimpleModeStatus } from '@/api/modules/simpleMode'
import { activeSession } from '@/utils/session'

export function useSimpleModeStatus() {
  const enabled = ref<boolean>()
  const error = ref('')
  let sequence = 0

  async function refresh() {
    const current = ++sequence
    const token = activeSession()?.token
    enabled.value = undefined
    error.value = ''
    try {
      const status = await getSimpleModeStatus()
      if (current !== sequence || activeSession()?.token !== token) return
      enabled.value = status.simple_mode_enabled
    } catch {
      if (current !== sequence || activeSession()?.token !== token) return
      error.value = '未能获取简易模式状态，请刷新重试'
    }
  }

  return { enabled, error, refresh }
}
