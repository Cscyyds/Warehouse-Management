/**
 * 模块：借出借入模式状态存储（TIANXIN / NATIVE 分流依据）
 *
 * 判据来源：后端 `GET /api/v1/tenant-borrow/mode` 的 `borrow_mode`，本 store 不自行判定。
 *
 * ★ 后端判据（`nuomi_wms/app/api/v1/endpoints/tenant_borrow_management.py:894-911`，勿再取反）：
 *   天心借出借入 ⟺ BORROW 行存在 且 `enabled == 0` 且 `channel_code == 'TIANXIN'`；
 *   无 BORROW 行一律 NATIVE。语义同贸易：`enabled = 0` = 本系统该模块停用、交由天心接管。
 *
 * ⚠️ 与 `stores/tradeMode.ts` **有意不合并**：贸易判据还要求 FINANCE.enabled == 0，
 *   而借出借入只看 BORROW 一行（后端 `_require_tianxin_borrow_mode` 明确「BORROW 开关独立，
 *   不 join 财务/采销模块态」）。合并会互相污染——只开借出借入的租户会被贸易判据判成 NATIVE。
 *
 * 消费点（仅两处）：
 *   1. `layout/MainLayout.vue` 顶部导航「借出借入」显隐；
 *   2. `router/index.ts` 守卫拦截 NATIVE 租户对 `/borrow/**` 的深链（手输 URL / 旧书签）。
 *
 * 策略（★ 与 tradeMode 的 fail-open 方向不同，勿照抄）：
 *   tradeMode 未知时按 NATIVE 处理不会误藏采购/销售；本模块「NATIVE = 隐藏」，
 *   若未知也按 NATIVE 会把天心租户的入口锁死。故采用三段式：
 *     - 明确 TIANXIN   → 显示
 *     - 明确 NATIVE    → 隐藏（硬判定，这是本 store 存在的唯一理由）
 *     - null（未加载/失败）→ 显示，交给权限树 + 后端 403（`_require_tianxin_borrow_mode`）兜底
 *
 * 生命周期：与 permissionStore / tradeModeStore 并行在路由守卫首次导航前 load()；
 *          退出登录时 reset()（避免切换租户残留）。
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getBorrowMode, type BorrowModeResult } from '@/api/modules/borrow'
import { isBorrowNavVisible } from '@/config/borrowModeRule'

/** sessionStorage 持久化 key：避免刷新瞬间闪族（与 trade_mode_cache_v1 分开，语义不可混用） */
const STORAGE_KEY = 'borrow_mode_cache_v1'

interface CachedBorrowMode {
  mode: 'TIANXIN' | 'NATIVE' | null
  moduleEnabled: boolean
  channelCode: string | null
  erpSyncEnabled: boolean | null
}

function readCachedMode(): CachedBorrowMode | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedBorrowMode
    if (parsed.mode !== 'TIANXIN' && parsed.mode !== 'NATIVE' && parsed.mode !== null) return null
    return parsed
  } catch {
    return null
  }
}

export const useBorrowModeStore = defineStore('borrowMode', () => {
  const cached = readCachedMode()

  /** 当前租户借出借入模式：TIANXIN=天心 ERP 单据；NATIVE=本系统（不提供该模块）；null=未就绪/加载失败 */
  const mode = ref<'TIANXIN' | 'NATIVE' | null>(cached?.mode ?? null)
  /** BORROW 模块是否启用；天心接管时为 false（enabled=0） */
  const moduleEnabled = ref<boolean>(cached?.moduleEnabled ?? false)
  /** 对接的外部系统渠道编码；天心模式下为 'TIANXIN'，NATIVE 为 null */
  const channelCode = ref<string | null>(cached?.channelCode ?? null)
  /** 借出借入 ERP 数据同步总开关（enabled=0 但该开关为 0 时页面可用、同步停摆） */
  const erpSyncEnabled = ref<boolean | null>(cached?.erpSyncEnabled ?? null)
  /** 是否已完成首次加载（无论成功失败） */
  const isLoaded = ref(false)
  /** 最近一次加载的错误信息（成功时为 null） */
  const loadError = ref<string | null>(null)
  /** 并发去重：进行中的加载 Promise */
  let loadPromise: Promise<void> | null = null

  /** 是否天心借出借入模式（fail-safe：null 视为 false，仅用于「肯定不是天心」的分支） */
  const isTianxin = computed(() => mode.value === 'TIANXIN')

  /**
   * 是否在顶部导航展示「借出借入」，也是 `/borrow/**` 深链的放行条件。
   * 判据见 `config/borrowModeRule.ts`（唯一判定点，有单测覆盖）。
   */
  const isMenuVisible = computed(() => isBorrowNavVisible(mode.value))

  function persistCache() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        mode: mode.value,
        moduleEnabled: moduleEnabled.value,
        channelCode: channelCode.value,
        erpSyncEnabled: erpSyncEnabled.value,
      }))
    } catch {
      /* 存储失败不影响主流程 */
    }
  }

  /**
   * 拉取借出借入模式（幂等、并发去重）。
   * 已加载过（无论成功失败）时不重复请求；需要刷新时（重新登录、后台切换模式）传 force=true。
   */
  function load(force = false): Promise<void> {
    if (loadPromise) return loadPromise
    if (isLoaded.value && !force) return Promise.resolve()

    loadPromise = (async () => {
      try {
        const res = await getBorrowMode()
        const data = res.data as BorrowModeResult | undefined
        if (data && (data.borrow_mode === 'TIANXIN' || data.borrow_mode === 'NATIVE')) {
          mode.value = data.borrow_mode
          moduleEnabled.value = !!data.borrow_module_enabled
          channelCode.value = data.channel_code ?? null
          erpSyncEnabled.value = data.erp_sync_enabled ?? null
          loadError.value = null
        } else {
          // 后端返回异常结构：置为未知（放行），不武断判 NATIVE
          mode.value = null
          loadError.value = '借出借入模式接口返回异常结构'
        }
      } catch (err) {
        // 失败不隐藏入口：权限树 + 后端 403 仍是有效兜底
        mode.value = null
        moduleEnabled.value = false
        channelCode.value = null
        erpSyncEnabled.value = null
        loadError.value = err instanceof Error ? err.message : String(err)
        console.warn('[借出借入模式加载失败，按「不隐藏」兜底]', err)
      } finally {
        isLoaded.value = true
        loadPromise = null
        persistCache()
      }
    })()
    return loadPromise
  }

  /** 退出登录时重置全部状态与缓存 */
  function reset() {
    mode.value = null
    moduleEnabled.value = false
    channelCode.value = null
    erpSyncEnabled.value = null
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
    moduleEnabled,
    channelCode,
    erpSyncEnabled,
    isLoaded,
    loadError,
    isTianxin,
    isMenuVisible,
    load,
    reset,
  }
})
