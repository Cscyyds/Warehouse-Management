import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

/**
 * 统一的断点判断 composable
 *
 * 断点约定（与 index.scss 中的 @media 保持一致）：
 *   xs  ≤768
 *   sm  768–1024
 *   md  1024–1280
 *   lg  1280–1440
 *   xl  1440–1920
 *   xxl ≥1920
 *
 * 用法：
 *   const { width, is, isMobile, isCompact } = useBreakpoint()
 *   if (is.value.md) { ... }
 *
 * 注意：SSR 场景下 window 不存在，这里默认是 CSR 环境（Vite SPA）。
 */
export function useBreakpoint() {
  const width = ref(typeof window !== 'undefined' ? window.innerWidth : 1440)

  function update() {
    width.value = window.innerWidth
  }

  onMounted(() => {
    update()
    window.addEventListener('resize', update, { passive: true })
  })

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', update)
    }
  })

  const is = {
    xs: computed(() => width.value <= 768),
    sm: computed(() => width.value > 768 && width.value <= 1024),
    md: computed(() => width.value > 1024 && width.value <= 1280),
    lg: computed(() => width.value > 1280 && width.value <= 1440),
    xl: computed(() => width.value > 1440 && width.value <= 1920),
    xxl: computed(() => width.value > 1920),
  }

  /** 移动端降级（≤768） */
  const isMobile = computed(() => width.value <= 768)
  /** 紧凑模式（≤1280，含小笔记本） */
  const isCompact = computed(() => width.value <= 1280)
  /** 平板及以下（≤1024） */
  const isTabletDown = computed(() => width.value <= 1024)

  return { width, is, isMobile, isCompact, isTabletDown }
}
