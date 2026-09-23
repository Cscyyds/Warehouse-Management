/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PAGE_AGENT_ENABLED?: string
  /** PageAgent OpenAI-compatible proxy path, normally /api/v1/page-agent. */
  readonly VITE_PAGE_AGENT_API_BASE_URL?: string
  /**
   * 打印客户端安装包（精臣打印服务 / USB 驱动 / 芯烨打印代理）的云下载地址前缀。
   * 百度云 BOS 桶地址，与 nuomi_wms/.env 的 BAIDU_BOS_ENDPOINT 同值；留空则用内置默认域名兜底。
   */
  readonly VITE_DOWNLOAD_BASE_URL?: string
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
