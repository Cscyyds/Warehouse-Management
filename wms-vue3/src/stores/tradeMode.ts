/**
 * 模块：贸易模式状态存储（TIANXIN / NATIVE 分流依据）
 *
 * 判据来源：后端 GET /api/v1/tenant-trade/mode 返回的 purchase_sales_mode，本 store 不自行判定。
 *
 * ★ 后端判据（2026-09-21 确认，勿再取反）：
 *   天心模式 ⟺ PURCHASE_SALES.enabled == 0 且 FINANCE.enabled == 0
 *             且 PURCHASE_SALES.channel_code == 'TIANXIN'
 *
 *   语义：enabled = 0 表示「本系统该模块停用、交由天心 ERP 接管」。
 *   因此天心模式下两个 enabled 字段**都是 false**——这是该口径的特征，不是异常。
 *   FINANCE.channel_code 恒为空（财务模块无外部软件方概念），渠道标识只挂在 PURCHASE_SALES 上。
 *
 *   中间态（只有一个 enabled=0）与无配置行的存量租户 → 一律 NATIVE，走 WMS 本系统。
 *   ⚠️ 前端**不要**用 finance_module_enabled / purchase_sales_module_enabled 自行拼判据，
 *      一律以 purchase_sales_mode（或本 store 的 isTianxin）为准，避免与后端口径分叉。
 *
 * 职责：
 *   1. 登录后（或刷新进入时）调用 load() 拉取 GET /api/v1/tenant-trade/mode，
 *      缓存 purchase_sales_mode / finance_module_enabled / purchase_sales_module_enabled / channel_code。
 *   2. 为路由守卫提供防御性分流依据：
 *      - TIANXIN → 拦截 /purchase/* /sales/* 写页面深链，重定向到 dashboard；
 *      - NATIVE  → 拦截 /trade/* 深链，重定向到 dashboard；
 *      - null（加载失败/未就绪）→ 不拦截，交给后端 403 兜底。
 *   3. 为页面 mounted 二次校验提供 isTianxin() 计算属性。
 *
 * 策略：fail-open —— 加载失败时 mode=null，isTianxin() 返回 false，
 *       页面按 NATIVE 处理（避免 mode 接口故障把整个采购/销售模块拖挂）；
 *       loadError 暴露给守卫做明确提示，不静默降级。
 *
 * 生命周期：登录成功后与 permissionStore.load() 并行触发；退出登录时 reset()。
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getTradeMode, type TradeModeResult } from '@/api/modules/trade'

/** sessionStorage 持久化 key：避免刷新瞬间闪族 */
const STORAGE_KEY = 'trade_mode_cache_v1'

interface CachedMode {
  mode: 'TIANXIN' | 'NATIVE' | null
  financeEnabled: boolean
  purchaseSalesEnabled: boolean
  channelCode: string | null
}

function readCachedMode(): CachedMode | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedMode
    if (parsed.mode !== 'TIANXIN' && parsed.mode !== 'NATIVE' && parsed.mode !== null) return null
    return parsed
  } catch {
    return null
  }
}

export const useTradeModeStore = defineStore('tradeMode', () => {
  const cached = readCachedMode()

  /** 当前租户贸易模式：TIANXIN=天心贸易；NATIVE=本系统采购/销售；null=未就绪/加载失败 */
  const mode = ref<'TIANXIN' | 'NATIVE' | null>(cached?.mode ?? null)
  /** 财务模块是否启用；enabled=0（天心接管）时为 false */
  const financeEnabled = ref<boolean>(cached?.financeEnabled ?? false)
  /** 采购/销售模块是否启用；enabled=0（天心接管）时为 false */
  const purchaseSalesEnabled = ref<boolean>(cached?.purchaseSalesEnabled ?? false)
  /** 对接的外部系统渠道编码；天心模式下为 'TIANXIN'，NATIVE 为 null */
  const channelCode = ref<string | null>(cached?.channelCode ?? null)
  /** 是否已完成首次加载（无论成功失败） */
  const isLoaded = ref(false)
  /** 最近一次加载的错误信息（成功时为 null） */
  const loadError = ref<string | null>(null)
  /** 并发去重：进行中的加载 Promise */
  let loadPromise: Promise<void> | null = null

  /** 计算属性：是否天心贸易模式（fail-open：null 视为 false） */
  const isTianxin = computed(() => mode.value === 'TIANXIN')

  function persistCache() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        mode: mode.value,
        financeEnabled: financeEnabled.value,
        purchaseSalesEnabled: purchaseSalesEnabled.value,
        channelCode: channelCode.value,
      }))
    } catch {
      /* 存储失败不影响主流程 */
    }
  }

  /**
   * 拉取贸易模式（幂等、并发去重）。
   * 已加载过（无论成功失败）时不重复请求；需要刷新时（重新登录、后台切换模式）传 force=true。
   */
  function load(force = false): Promise<void> {
    if (loadPromise) return loadPromise
    if (isLoaded.value && !force) return Promise.resolve()

    loadPromise = (async () => {
      try {
        const res = await getTradeMode()
        const data = res.data as TradeModeResult | undefined
        if (data && (data.purchase_sales_mode === 'TIANXIN' || data.purchase_sales_mode === 'NATIVE')) {
          mode.value = data.purchase_sales_mode
          financeEnabled.value = !!data.finance_module_enabled
          purchaseSalesEnabled.value = !!data.purchase_sales_module_enabled
          channelCode.value = data.channel_code ?? null
          loadError.value = null
        } else {
          // 后端返回异常结构：视为加载失败，fail-open
          mode.value = null
          loadError.value = '贸易模式接口返回异常结构'
        }
        isLoaded.value = true
        persistCache()
      } catch (err) {
        // fail-open：失败时 mode=null，页面按 NATIVE 处理
        mode.value = null
        financeEnabled.value = false
        purchaseSalesEnabled.value = false
        channelCode.value = null
        loadError.value = err instanceof Error ? err.message : String(err)
        isLoaded.value = true
        console.warn('[贸易模式加载失败，按 NATIVE 兜底]', err)
      } finally {
        loadPromise = null
      }
    })()
    return loadPromise
  }

  /** 退出登录时重置全部状态与缓存 */
  function reset() {
    mode.value = null
    financeEnabled.value = false
    purchaseSalesEnabled.value = false
    channelCode.value = null
    loadError.value = null
    isLoaded.value = false
    loadPromise = null
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* 忽略 */
    }
  }

  return {
    mode,
    financeEnabled,
    purchaseSalesEnabled,
    channelCode,
    isLoaded,
    loadError,
    isTianxin,
    load,
    reset,
  }
})
