import { onActivated, onDeactivated, onMounted, onUnmounted, watch } from 'vue'
import { registerAgentActions } from '@/agent/actionRegistry'
import { registerAgentPage } from '@/agent/pageRegistry'
import type { WmsAgentActionDefinition, WmsAgentPageDefinition } from '@/agent/types'

export type WmsAgentPageSource = WmsAgentPageDefinition | (() => WmsAgentPageDefinition | undefined)
export type WmsAgentActionsSource =
  | WmsAgentActionDefinition<any, any>[]
  | (() => WmsAgentActionDefinition<any, any>[])

export function useAgentPage(
  page: WmsAgentPageSource,
  actions: WmsAgentActionsSource = [],
) {
  const resolvePage = typeof page === 'function' ? page : () => page
  const resolveActions = typeof actions === 'function' ? actions : () => actions
  let active = false
  let unregister: (() => void) | undefined

  const activate = () => {
    active = true
    if (unregister) return
    const definition = resolvePage()
    if (!definition) return
    const unregisterActions = registerAgentActions(resolveActions())
    const unregisterPage = registerAgentPage(definition)
    unregister = () => {
      unregisterPage()
      unregisterActions()
      unregister = undefined
    }
  }

  const deactivate = () => {
    active = false
    unregister?.()
  }

  onMounted(activate)
  onActivated(activate)
  onDeactivated(deactivate)
  onUnmounted(deactivate)

  // 函数形态：身份跟随响应式输入（如 /common/add 的 type/mode）变化时重注册。
  // 否则同一组件实例被复用时，注册中心会滞留在旧页面身份上。
  if (typeof page === 'function') {
    watch(resolvePage, () => {
      if (!active) return
      deactivate()
      activate()
    })
  }
}
