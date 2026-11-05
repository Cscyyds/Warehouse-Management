/**
 * 卡片「原地展开 → 逐渐显现目标页」导航（生产概览单据卡片专用）。
 *
 * 与旧实现的区别：不再先播完放大动画、最后才 push（那样详情页会整块突然出现），
 * 而是点击瞬间就 router.push，让目标页在覆盖层下方**立即挂载并加载**；
 * 旧页面（含其余卡片的让位动画）克隆成一张 fixed 快照盖在上层，
 * 快照上挖一个从被点卡片位置生长到铺满内容区的圆角矩形窗口——
 * 展开过程中透过窗口看到的就是已经就绪的详情页，形成「卡片长成页面」的衔接。
 *
 * 快照挂在 document.body 上、由 rAF 自行清理，不修改原页面 DOM：
 * 概览页被 keep-alive 失活后动画照常收尾，返回本页时无任何残影。
 */
import { useRouter } from 'vue-router'

/** 窗口从卡片生长到铺满内容区的时长 */
const T_REVEAL = 520
/** 窗口圆角（与卡片圆角同一设计语言） */
const WINDOW_RADIUS = 12

/** easeOutCubic：起步快、收尾缓，接近卡片「弹开」的体感 */
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3)

/** 圆角矩形 path（顺时针），供 evenodd 挖洞使用 */
function roundedRectPath(x1: number, y1: number, x2: number, y2: number, r: number): string {
  const rr = Math.max(0, Math.min(r, (x2 - x1) / 2, (y2 - y1) / 2))
  return (
    `M${x1 + rr} ${y1} H${x2 - rr} A${rr} ${rr} 0 0 1 ${x2} ${y1 + rr} ` +
    `V${y2 - rr} A${rr} ${rr} 0 0 1 ${x2 - rr} ${y2} H${x1 + rr} ` +
    `A${rr} ${rr} 0 0 1 ${x1} ${y2 - rr} V${y1 + rr} A${rr} ${rr} 0 0 1 ${x1 + rr} ${y1} Z`
  )
}

export function useExpandNavigate() {
  const router = useRouter()
  /** 动画进行中标志：防止连点叠加多个快照层 / 重复导航 */
  let busy = false

  function expandNavigate(cardEl: HTMLElement, docKey: string) {
    if (busy) return
    const main = cardEl.closest('.main-content') as HTMLElement | null
    const page = main?.firstElementChild as HTMLElement | null

    // 兜底：拿不到页面容器时退化为普通跳转
    if (!main || !page) {
      router.push(`/production/${docKey}`)
      return
    }
    busy = true

    const mainRect = main.getBoundingClientRect()
    const pageRect = page.getBoundingClientRect()
    const cardRect = cardEl.getBoundingClientRect()

    // 卡片在网格中的索引，用于在快照里定位「被点的那张」与让位方向
    const liveCards = cardEl.parentElement
      ? (Array.from(cardEl.parentElement.children) as HTMLElement[])
      : []
    const originIndex = liveCards.indexOf(cardEl)
    const liveRects = liveCards.map((el) => el.getBoundingClientRect())

    // ── 旧页面快照层：铺满主内容区，用 evenodd 挖洞揭示下层新页面 ──
    const overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;margin:0;overflow:hidden;z-index:2000;pointer-events:auto;' +
      `left:${mainRect.left}px;top:${mainRect.top}px;` +
      `width:${mainRect.width}px;height:${mainRect.height}px;` +
      `background:${getComputedStyle(main).backgroundColor};`
    const snapshot = page.cloneNode(true) as HTMLElement
    snapshot.style.position = 'absolute'
    snapshot.style.margin = '0'
    snapshot.style.left = `${pageRect.left - mainRect.left}px`
    snapshot.style.top = `${pageRect.top - mainRect.top}px`
    snapshot.style.width = `${pageRect.width}px`
    overlay.appendChild(snapshot)
    document.body.appendChild(overlay)

    // 快照里的卡片：被点的隐藏（窗口起点就在它身上），其余沿远离方向做让位动画
    const snapCards = Array.from(snapshot.querySelectorAll<HTMLElement>('.doc-card'))
    const cx = cardRect.left + cardRect.width / 2
    const cy = cardRect.top + cardRect.height / 2
    snapCards.forEach((el, i) => {
      if (i === originIndex) {
        el.style.visibility = 'hidden'
        return
      }
      const r = liveRects[i] ?? el.getBoundingClientRect()
      const dx = r.left + r.width / 2 - cx
      const dy = r.top + r.height / 2 - cy
      const norm = Math.max(Math.abs(dx), Math.abs(dy)) || 1
      el.style.setProperty('--away-x', `${(dx / norm) * 16}px`)
      el.style.setProperty('--away-y', `${(dy / norm) * 16}px`)
    })
    // 强制一次布局，确保让位过渡从初始态开始播放（不依赖 rAF，避免后台帧节流延迟入场）
    void overlay.offsetWidth
    snapCards.forEach((el, i) => {
      if (i !== originIndex) el.classList.add('is-yielding')
    })

    // 立即导航：目标页在快照下方挂载并开始加载，窗口展开过程中即可见
    router.push(`/production/${docKey}`).catch(() => {
      /* 导航被守卫取消时窗口动画仍会自行收尾 */
    })

    // ── 生长窗口：卡片矩形 → 铺满主内容区（clamp-path evenodd 挖洞） ──
    const w = mainRect.width
    const h = mainRect.height
    const startX1 = cardRect.left - mainRect.left
    const startY1 = cardRect.top - mainRect.top
    const startX2 = startX1 + cardRect.width
    const startY2 = startY1 + cardRect.height
    // 终点外扩一个圆角半径，确保圆角落在可视区外、整层被完整揭开
    const endX1 = -WINDOW_RADIUS
    const endY1 = -WINDOW_RADIUS
    const endX2 = w + WINDOW_RADIUS
    const endY2 = h + WINDOW_RADIUS
    const outerPath = `M0 0 H${w} V${h} H0 Z`

    const setWindow = (p: number) => {
      const e = easeOutCubic(p)
      const x1 = startX1 + (endX1 - startX1) * e
      const y1 = startY1 + (endY1 - startY1) * e
      const x2 = startX2 + (endX2 - startX2) * e
      const y2 = startY2 + (endY2 - startY2) * e
      const inner = roundedRectPath(x1, y1, x2, y2, WINDOW_RADIUS)
      overlay.style.clipPath = `path(evenodd, "${outerPath} ${inner}")`
    }
    // 先以初始窗口绘制一帧，避免快照整页闪现
    setWindow(0)

    const t0 = performance.now()
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / T_REVEAL)
      setWindow(p)
      if (p < 1) {
        requestAnimationFrame(frame)
      } else {
        overlay.remove()
        busy = false
      }
    }
    requestAnimationFrame(frame)
  }

  return { expandNavigate }
}
