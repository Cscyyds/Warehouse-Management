/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PAGE_AGENT_ENABLED?: string
  readonly VITE_PAGE_AGENT_MODEL?: string
  readonly VITE_PAGE_AGENT_BASE_URL?: string
  readonly VITE_PAGE_AGENT_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
