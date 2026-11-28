import type { WmsAgentActionDefinition } from './types'

interface RegisteredAction {
  token: symbol
  definition: WmsAgentActionDefinition<any, any>
}

const actions = new Map<string, RegisteredAction>()

export function registerAgentActions(
  definitions: WmsAgentActionDefinition<any, any>[],
): () => void {
  const token = Symbol('agent-actions')

  for (const definition of definitions) {
    if (actions.has(definition.id)) {
      throw new Error(`Agent Action 已重复注册: ${definition.id}`)
    }
    actions.set(definition.id, { token, definition })
  }

  return () => {
    for (const definition of definitions) {
      if (actions.get(definition.id)?.token === token) {
        actions.delete(definition.id)
      }
    }
  }
}

export function getAgentAction(actionId: string): WmsAgentActionDefinition<any, any> | undefined {
  return actions.get(actionId)?.definition
}

export function getRegisteredAgentActions(): WmsAgentActionDefinition<any, any>[] {
  return Array.from(actions.values(), ({ definition }) => definition)
}
