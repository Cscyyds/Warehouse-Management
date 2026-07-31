import type { RegisteredAgentPage, WmsAgentPageDefinition } from './types'

const registryEvents = new EventTarget()
let currentPage: RegisteredAgentPage | undefined

function emitChange() {
  registryEvents.dispatchEvent(new Event('change'))
}

export function registerAgentPage(definition: WmsAgentPageDefinition): () => void {
  const registration: RegisteredAgentPage = { token: Symbol(definition.id), definition }
  currentPage = registration
  emitChange()

  return () => {
    if (currentPage?.token !== registration.token) return
    currentPage = undefined
    emitChange()
  }
}

export function getCurrentAgentPage(): RegisteredAgentPage | undefined {
  return currentPage
}

export function subscribeAgentPage(listener: () => void): () => void {
  registryEvents.addEventListener('change', listener)
  return () => registryEvents.removeEventListener('change', listener)
}
