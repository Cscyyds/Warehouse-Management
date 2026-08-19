/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PAGE_AGENT_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'element-china-area-data' {
  export interface AreaOption {
    value: string
    label: string
    children?: AreaOption[]
  }
  export const provinceAndCityData: AreaOption[]
  export const provinceAndCityDataPlus: AreaOption[]
  export const regionData: AreaOption[]
  export const regionDataPlus: AreaOption[]
  export const CodeToText: Record<string, string>
  export const TextToCode: Record<string, any>
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
