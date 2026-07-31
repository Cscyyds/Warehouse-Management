import { onActivated, onDeactivated, onMounted, onUnmounted } from 'vue'
import { registerAgentActions } from '@/agent/actionRegistry'
import { registerAgentPage } from '@/agent/pageRegistry'
import type { WmsAgentActionDefinition, WmsAgentPageDefinition } from '@/agent/types'

export function useAgentPage(
  page: WmsAgentPageDefinition,
  actions: WmsAgentActionDefinition<any, any>[],
) {
  let unregister: (() => void) | undefined

  const activate = () => {
    if (unregister) return
    const unregisterActions = registerAgentActions(actions)
    const unregisterPage = registerAgentPage(page)
    unregister = () => {
      unregisterPage()
      unregisterActions()
      unregister = undefined
    }
  }

  const deactivate = () => unregister?.()

  onMounted(activate)
  onActivated(activate)
  onDeactivated(deactivate)
  onUnmounted(deactivate)
}
