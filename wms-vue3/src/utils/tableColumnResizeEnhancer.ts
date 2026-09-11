/**
 * el-table 表头「列宽拖拽」全局增强（整个应用只安装一次）
 *
 * 背景：Element Plus 把列宽拖拽的命中范围写死在 th 右侧 8px 内
 * （table-header/event-helper：rect.right - clientX < 8，且仅 border 模式生效），
 * 命中点过小，用户常常要点好几次才能碰到，不同页面体验也不一致。
 *
 * 做法：在 document 捕获阶段监听 mousemove：
 * 1. 命中区扩大为 th 右侧 TABLE_RESIZE_HOT_ZONE（16px）：
 *    - [0, 8px)  交给 Element Plus 原生逻辑处理；
 *    - [8px, 16px) 把事件合成为落在原生热区内的 mousemove（EP 自身据此进入
 *      col-resize 状态），并阻止原事件继续传递，避免原生逻辑把状态清掉。
 * 2. 命中区内给 th 加 is-column-resize-hover 类，由样式给出 col-resize 光标与
 *    右侧指示线，让「拖拽点」可见（见 styles/index.scss）。
 *
 * 列宽变更、代理虚线、header-dragend 等仍完全由 Element Plus 自身实现，
 * 因此列表模板的列宽持久化、列顺序拖拽（Sortable）互不干扰。
 */

/** 表头列宽拖拽命中区（th 右侧宽度，px）；Sortable 过滤列拖拽时也复用它 */
export const TABLE_RESIZE_HOT_ZONE = 16

/** Element Plus 原生命中区（不可配置，源码写死 8px） */
const ELEMENT_NATIVE_HOT_ZONE = 8

/** 命中区内的悬停类名（对应 index.scss 里的光标与指示线样式） */
const HOVER_CLASS = 'is-column-resize-hover'

let installed = false
let hoverTh: HTMLElement | null = null
/* 鼠标按下期间（可能是 EP 自己的拖拽会话）不介入，完全交还 Element Plus */
let mousePressed = false
const synthesizedResizeEvents = new WeakSet<Event>()

function setHoverTh(th: HTMLElement | null) {
  if (hoverTh === th) return
  hoverTh?.classList.remove(HOVER_CLASS)
  hoverTh = th
  hoverTh?.classList.add(HOVER_CLASS)
}

function handleDocumentMouseMove(event: MouseEvent) {
  if (synthesizedResizeEvents.has(event) || mousePressed) return

  const target = event.target as HTMLElement | null
  if (!target || typeof target.closest !== 'function') {
    setHoverTh(null)
    return
  }
  const th = target.closest('th.el-table__cell') as HTMLTableCellElement | null
  if (!th) {
    setHoverTh(null)
    return
  }
  /* 鼠标直接落在排序图标上时不算拖拽：保证图标可点击排序，不与列宽拖拽抢事件 */
  if (target.closest('.caret-wrapper')) {
    setHoverTh(null)
    return
  }

  /* 非 border 模式 EP 不支持列宽拖拽（源码里 border 为前置条件），不做提示 */
  const table = th.closest('.el-table')
  if (!table?.classList.contains('el-table--border')) {
    setHoverTh(null)
    return
  }
  /* 多级表头（colspan>1）EP 同样不支持拖拽 */
  if (th.colSpan > 1) {
    setHoverTh(null)
    return
  }

  const rect = th.getBoundingClientRect()
  const distanceToRight = rect.right - event.clientX
  const inHotZone = rect.width > ELEMENT_NATIVE_HOT_ZONE && distanceToRight >= 0 && distanceToRight < TABLE_RESIZE_HOT_ZONE
  setHoverTh(inHotZone ? th : null)

  if (!inHotZone || distanceToRight < ELEMENT_NATIVE_HOT_ZONE) return

  // 8~16px：把移动映射到 EP 原生热区（rect.right - 7），复用其拖拽状态机
  event.stopPropagation()
  const syntheticEvent = new MouseEvent('mousemove', {
    bubbles: true,
    clientX: rect.right - ELEMENT_NATIVE_HOT_ZONE + 1,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY
  })
  synthesizedResizeEvents.add(syntheticEvent)
  th.dispatchEvent(syntheticEvent)
}

export function installTableColumnResizeEnhancer() {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener('mousemove', handleDocumentMouseMove, true)
  document.addEventListener('mousedown', () => { mousePressed = true }, true)
  document.addEventListener('mouseup', () => { mousePressed = false }, true)
  document.documentElement.addEventListener('mouseleave', () => setHoverTh(null))
  window.addEventListener('blur', () => { mousePressed = false; setHoverTh(null) })
}
