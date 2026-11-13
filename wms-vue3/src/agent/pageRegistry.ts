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

export function waitForAgentPage(
  pageId: string,
  signal: AbortSignal,
  timeoutMs = 2500,
): Promise<RegisteredAgentPage> {
  const registered = getCurrentAgentPage()
  if (registered?.definition.id === pageId) return Promise.resolve(registered)

  return new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      signal.removeEventListener('abort', handleAbort)
      unsubscribe()
    }
    const handleAbort = () => {
      cleanup()
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    const handleChange = () => {
      const page = getCurrentAgentPage()
      if (page?.definition.id !== pageId) return
      cleanup()
      resolve(page)
    }
    const unsubscribe = subscribeAgentPage(handleChange)
    const timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error(`目标页面未注册 Agent 能力：${pageId}`))
    }, timeoutMs)

    signal.addEventListener('abort', handleAbort, { once: true })
    handleChange()
  })
}
