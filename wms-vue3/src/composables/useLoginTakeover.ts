/**
 * 登录成功「圆形揭示」接管转场（模块级单例，消费方：App.vue 的路由 Transition + LoginTakeover 遮罩）。
 *
 * 视觉：打钩后以登录按钮圆心为原点，dashboard 透过扩大的圆实时浮现（Vue <Transition>
 * 让登录页留在底层被逐渐覆盖），圆的边缘保持透明无边框，仅靠 clip-path 揭示；
 * 覆盖完成后「欢迎回来」字样短暂浮现再消散。
 *
 * 状态机：hidden → reveal(页面圆形揭示扩散) → settled(欢迎语) → fading → hidden
 */
import { reactive, ref } from 'vue'

export type TakeoverState = 'hidden' | 'reveal' | 'settled' | 'fading'

/** 与 LoginTakeover.vue / App.vue 中 CSS 动画时长保持一致 */
export const T_REVEAL = 900 // 圆形揭示扩散（无边框，纯 clip-path 透出下层页面）
export const T_HOLD = 650 // 欢迎语停留
export const T_FADE = 300 // 欢迎语消散

const takeoverState = ref<TakeoverState>('hidden')
/** 是否启用本次路由切换的 reveal 过渡（仅登录成功那一次为 true） */
const revealActive = ref(false)
const takeoverOrigin = reactive({ x: 0, y: 0, r: 0 })

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * 预存圆心与半径，并写入 :root CSS 变量——
 * 路由组件的 clip-path 关键帧与能量环都通过 var(--reveal-x/y/r) 取锚点。
 * 必须在 Login 组件卸载前调用（打钩阶段坐标可信）。
 */
function setOrigin(x: number, y: number, r: number) {
  takeoverOrigin.x = x
  takeoverOrigin.y = y
  takeoverOrigin.r = r
  const root = document.documentElement
  root.style.setProperty('--reveal-x', `${x}px`)
  root.style.setProperty('--reveal-y', `${y}px`)
  root.style.setProperty('--reveal-r', `${r}px`)
}

/** 播放遮罩侧动画（能量环 → 欢迎语 → 消散），在 router.push 前调用与之并行 */
async function expandFrom(): Promise<void> {
  takeoverState.value = 'reveal'
  await sleep(T_REVEAL)
  takeoverState.value = 'settled'
  await sleep(T_HOLD)
  takeoverState.value = 'fading'
  await sleep(T_FADE)
  takeoverState.value = 'hidden'
}

export function useLoginTakeover() {
  return { takeoverState, takeoverOrigin, revealActive, setOrigin, expandFrom }
}
