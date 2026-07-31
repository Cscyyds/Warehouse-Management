import {
  initializeAgentRuntime,
  shutdownAgentRuntime,
} from '@/agent/runtime/agentRuntime'

export const initializePageAgent = initializeAgentRuntime

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void shutdownAgentRuntime()
  })
}
