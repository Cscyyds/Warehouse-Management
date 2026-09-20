<template>
  <div class="combo-nebula">
    <!-- 图谱画布 -->
    <div ref="stageRef" class="cbn-stage">
      <div class="cbn-bg" />
      <svg ref="svgRef" class="cbn-svg">
        <g ref="viewportRef">
          <g ref="edgesRef" />
          <g ref="flowsRef" />
          <g ref="nodesRef" />
        </g>
      </svg>
    </div>

    <!-- 统计角标 -->
    <div class="cbn-stats">
      <div v-for="s in statsList" :key="s.k" class="cbn-stat" :class="s.cls">
        <div class="cbn-stat-v">{{ s.v }}</div>
        <div class="cbn-stat-k">{{ s.k }}</div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="cbn-tools">
      <input
        v-model="query"
        class="cbn-search"
        placeholder="搜索名称 / 编码…"
        @keydown.enter="flyToFirstMatch"
      />
      <button class="cbn-tool" title="适应视图" @click="fitView()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
      </button>
      <button class="cbn-tool" title="放大" @click="zoomCenter(1.25)">＋</button>
      <button class="cbn-tool" title="缩小" @click="zoomCenter(0.8)">－</button>
      <button class="cbn-tool" title="展开全部层级" @click="expandAll">展开</button>
      <button class="cbn-tool" title="收起到第 1 层" @click="collapseAll">收起</button>
    </div>

    <!-- 图例 -->
    <div class="cbn-legend">
      <div class="cbn-li"><span class="cbn-sw cbn-sw-root" />主产品</div>
      <div class="cbn-li"><span class="cbn-sw cbn-sw-combo" />组合子产品</div>
      <div class="cbn-li"><span class="cbn-sw cbn-sw-normal" />普通子产品</div>
      <div class="cbn-li"><span class="cbn-flow-sample" />流动光 = 绑定关系</div>
    </div>
    <div class="cbn-hint">单击节点看详情 · ○+/○− 展开收起 · 拖拽平移 · 滚轮缩放（详情打开时改为滚动详情）</div>

    <!-- 详情侧滑面板 -->
    <aside class="cbn-panel" :class="{ open: !!selected }">
      <template v-if="selected">
        <div class="cbn-p-head">
          <div class="cbn-p-type" :class="selected.type">{{ typeLabel(selected) }}</div>
          <div class="cbn-p-name">{{ selected.name }}</div>
          <div class="cbn-p-code">{{ selected.code }}</div>
          <button class="cbn-p-close" title="关闭" @click="selectNode(null)">✕</button>
        </div>
        <div ref="panelBodyRef" class="cbn-p-body">
          <div class="cbn-p-sec">
            <h4>绑定路径</h4>
            <div class="cbn-crumb">
              <template v-for="(c, i) in selectedChain" :key="c.id">
                <span :class="{ cur: c.id === selected.id }" :title="c.name">{{ c.name }}</span>
                <i v-if="i < selectedChain.length - 1">›</i>
              </template>
            </div>
          </div>
          <div class="cbn-p-sec">
            <h4>绑定信息</h4>
            <div class="cbn-kv"><span class="k">所在层级</span><span class="v">第 {{ selected.depth + 1 }} 层</span></div>
            <div class="cbn-kv"><span class="k">绑定数量</span><span class="v">× {{ selected.num }}</span></div>
            <div class="cbn-kv">
              <span class="k">子产品单价</span>
              <span class="v" :class="{ amber: selected.price > 0 }">{{ selected.price > 0 ? money(selected.price) : '—' }}</span>
            </div>
            <div v-if="selected.depth > 0" class="cbn-kv">
              <span class="k">小计</span>
              <span class="v red">{{ money(selected.num * selected.price) }}</span>
            </div>
            <div class="cbn-kv">
              <span class="k">直接下级</span>
              <span class="v">{{ selected.children.length ? selected.children.length + ' 项' : '无（叶子节点）' }}</span>
            </div>
            <div v-if="selected.remark" class="cbn-kv"><span class="k">备注</span><span class="v">{{ selected.remark }}</span></div>
          </div>
          <div v-if="selected.children.length" class="cbn-p-sec">
            <h4>下级构成</h4>
            <div v-for="c in selected.children" :key="c.id" class="cbn-kv">
              <span class="k cbn-ellipsis">{{ c.name }}</span>
              <span class="v">×{{ c.num }} · {{ c.price > 0 ? money(c.price) : '—' }}</span>
            </div>
          </div>
        </div>
        <div class="cbn-p-foot">
          <button v-if="selected.children.length" class="cbn-p-btn" @click="toggle(selected)">
            {{ collapsedSetVersion && collapsedSet.has(selected.id) ? '展开下级' : '收起下级' }}
          </button>
          <button
            v-if="selected.type === 'combo' && selected.productId"
            class="cbn-p-btn primary"
            @click="emit('navigate', selected.productId)"
          >进入该产品 →</button>
        </div>
      </template>
    </aside>

    <div class="cbn-toast" :class="{ show: toastVisible }">{{ toastMsg }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

defineOptions({ name: 'ComboStructureGraph' })

/* ───────────────────────────── 类型与入参 ───────────────────────────── */
interface RootInfo {
  product_id: string
  product_name: string
  product_code: string
}
/** 兼容 ComponentTreeNode（children 字段为 components）的结构化入参 */
interface TreeNodeLike {
  component_id?: string
  component_product_id: string
  component_product_name?: string | null
  component_product_code?: string | null
  component_is_combined?: number
  num: number | string
  unit_price?: string | null
  remark?: string | null
  components?: TreeNodeLike[]
}

const props = defineProps<{
  root: RootInfo | null
  nodes: TreeNodeLike[]
}>()

const emit = defineEmits<{
  (e: 'navigate', productId: string): void
}>()

type NodeType = 'root' | 'combo' | 'normal'
interface NebulaNode {
  id: string
  productId: string
  name: string
  code: string
  type: NodeType
  num: number
  price: number
  remark: string
  depth: number
  parent: NebulaNode | null
  children: NebulaNode[]
  x: number; y: number; tx: number; ty: number
  alpha: number; tAlpha: number
  w: number; h: number
  visible: boolean
  spawnAt: number
  el: SVGForeignObjectElement | null
  card: HTMLDivElement | null
  edgeEl: SVGPathElement | null
  grad: SVGLinearGradientElement | null
  /** 流动光线各层（下标与 FLOW_LAYERS 对齐；层序 = 头部 → 尾部，越靠后越长越细越淡） */
  flowEls: SVGPathElement[]
  /** 几何写入缓存：上一帧写过的 d / x / y，值未变则跳过 DOM 写入 */
  lastD: string
  lastX: number
  lastY: number
}

/* ───────────────────────────── 常量 ───────────────────────────── */
const NODE_W = 236, NODE_H = 62, ROOT_W = 252, ROOT_H = 72
const H_GAP = 118, SLOT = 86
const LERP = 0.16
const SVGNS = 'http://www.w3.org/2000/svg'

/** 流动光线分层配置（s0 头部 → s7 尾部：越长、越细、越淡）
 *  8 层的线宽按等步长 0.44 递减（4.3→1.2）、透明度按等步长递减，
 *  两级台阶都压到亚像素级，观感才是「均匀变化」而非阶梯。
 *  op / opHot / opDim 对应「常态 / 悬停链路 / 无关链路」三种透明度。
 *  ⚠️ 顺序必须与 CSS 里 .cbn-flow.s0 ~ .cbn-flow.s7 的线宽/dasharray 一一对应。 */
const FLOW_LAYERS = [
  { cls: 's0', op: 1, opHot: 1, opDim: 0.06 },
  { cls: 's1', op: 0.90, opHot: 0.95, opDim: 0.05 },
  { cls: 's2', op: 0.80, opHot: 0.90, opDim: 0.05 },
  { cls: 's3', op: 0.70, opHot: 0.84, opDim: 0.04 },
  { cls: 's4', op: 0.58, opHot: 0.76, opDim: 0.04 },
  { cls: 's5', op: 0.46, opHot: 0.66, opDim: 0.03 },
  { cls: 's6', op: 0.34, opHot: 0.54, opDim: 0.03 },
  { cls: 's7', op: 0.22, opHot: 0.42, opDim: 0.02 },
] as const

/** 几何写入的吸附阈值：收敛到该范围内直接吸附到目标值，使几何真正稳住（见 frame 注释） */
const GEOM_EPS = 0.05

/* ───────────────────────────── 模板引用 ───────────────────────────── */
const stageRef = ref<HTMLDivElement>()
const svgRef = ref<SVGSVGElement>()
const viewportRef = ref<SVGGElement>()
/** 详情面板的内容区（面板打开时，滚轮改为滚动它而不是缩放画布） */
const panelBodyRef = ref<HTMLDivElement>()
const edgesRef = ref<SVGGElement>()
const flowsRef = ref<SVGGElement>()
const nodesRef = ref<SVGGElement>()
let defsEl: SVGDefsElement | null = null

/* ───────────────────────────── 响应式 UI 状态 ───────────────────────────── */
const query = ref('')
const selected = shallowRef<NebulaNode | null>(null)
const statsList = ref<Array<{ v: string; k: string; cls?: string }>>([])
const toastMsg = ref('')
const toastVisible = ref(false)
/** 仅用于驱动面板按钮文案更新（collapsedSet 本身非响应式） */
const collapsedSetVersion = ref(0)

/* ───────────────────────────── 引擎状态（非响应式，逐帧变更） ───────────────────────────── */
const allNodes: NebulaNode[] = []
let rootNode: NebulaNode | null = null
const collapsedSet = new Set<string>()
let hovered: NebulaNode | null = null
const focusSet = new Set<string>()
const focusEdges = new Set<string>()
const cam = { x: 0, y: 0, k: 1, tx: 0, ty: 0, tk: 1 }
let rafId = 0
let resizeObs: ResizeObserver | null = null
let themeObs: MutationObserver | null = null
let toastTimer = 0

const palette = { primary: '#C0392B', combo: '#F59E0B', normal: '#86909C', normalHi: '#C2C7CF' }
function readPalette() {
  const cs = getComputedStyle(document.documentElement)
  palette.primary = cs.getPropertyValue('--primary').trim() || palette.primary
  palette.combo = cs.getPropertyValue('--warning').trim() || palette.combo
  palette.normal = cs.getPropertyValue('--text-secondary').trim() || palette.normal
  palette.normalHi = cs.getPropertyValue('--text-tertiary').trim() || palette.normalHi
}
function typeColor(t: NodeType) { return t === 'root' ? palette.primary : t === 'combo' ? palette.combo : palette.normal }

/* ───────────────────────────── 工具 ───────────────────────────── */
function esc(s: string) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}
function money(v: number) {
  return '¥' + v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function typeLabel(n: NebulaNode) {
  return n.type === 'root' ? '主产品（组合根）' : n.type === 'combo' ? '组合子产品' : '普通子产品'
}
const selectedChain = computed(() => {
  const chain: NebulaNode[] = []
  let p = selected.value
  while (p) { chain.unshift(p); p = p.parent }
  return chain
})

/* ───────────────────────────── 树构建 ───────────────────────────── */
let seq = 0
function buildInternal(raw: TreeNodeLike, parent: NebulaNode | null, depth: number): NebulaNode {
  const n: NebulaNode = {
    id: raw.component_id || `gen-${seq++}`,
    productId: raw.component_product_id || '',
    name: raw.component_product_name || '(未命名)',
    code: raw.component_product_code || '-',
    type: Number(raw.component_is_combined) === 1 ? 'combo' : 'normal',
    num: Number(raw.num) || 1,
    price: raw.unit_price === null || raw.unit_price === undefined || raw.unit_price === '' ? 0 : Number(raw.unit_price) || 0,
    remark: raw.remark || '',
    depth,
    parent,
    children: [],
    x: 0, y: 0, tx: 0, ty: 0,
    alpha: 0, tAlpha: 1,
    w: NODE_W, h: NODE_H,
    visible: true,
    spawnAt: 0,
    el: null, card: null, edgeEl: null, grad: null, flowEls: [],
    lastD: '', lastX: NaN, lastY: NaN,
  }
  n.children = (raw.components || []).map(c => buildInternal(c, n, depth + 1))
  return n
}
function buildRoot(): NebulaNode {
  const info = props.root
  const n: NebulaNode = {
    id: info?.product_id || '__root__',
    productId: info?.product_id || '',
    name: info?.product_name || '(主产品)',
    code: info?.product_code || '-',
    type: 'root',
    num: 1, price: 0, remark: '',
    depth: 0, parent: null, children: [],
    x: 0, y: 0, tx: 0, ty: 0,
    alpha: 0, tAlpha: 1,
    w: ROOT_W, h: ROOT_H,
    visible: true, spawnAt: 0,
    el: null, card: null, edgeEl: null, grad: null, flowEls: [],
    lastD: '', lastX: NaN, lastY: NaN,
  }
  n.children = props.nodes.map(c => buildInternal(c, n, 1))
  return n
}

/* ───────────────────────────── 统计 ───────────────────────────── */
function computeStats() {
  if (!rootNode) { statsList.value = []; return }
  let total = 0, combos = 0, maxDepth = 0, sum = 0
  ;(function walk(n: NebulaNode) {
    total++; maxDepth = Math.max(maxDepth, n.depth)
    if (n.type === 'combo') combos++
    if (n.depth > 0) sum += n.num * n.price
    n.children.forEach(walk)
  })(rootNode)
  statsList.value = [
    { v: String(total), k: '结构节点' },
    { v: String(combos), k: '组合节点', cls: 'amber' },
    { v: String(maxDepth), k: '最大层级' },
    { v: money(sum), k: '子项金额合计', cls: 'accent' },
  ]
}

/* ───────────────────────────── 布局 ───────────────────────────── */
function visibleChildren(n: NebulaNode) { return collapsedSet.has(n.id) ? [] : n.children }
function computeLayout() {
  if (!rootNode) return
  let slotY = 0
  ;(function place(n: NebulaNode) {
    n.tx = n.depth * (ROOT_W + H_GAP)
    const kids = visibleChildren(n)
    if (!kids.length) { n.ty = slotY; slotY += SLOT }
    else {
      kids.forEach(place)
      n.ty = (kids[0].ty + kids[kids.length - 1].ty) / 2
    }
  })(rootNode)
}

/* ───────────────────────────── 可见性调度（进入/退出动画） ───────────────────────────── */
function nearestVisibleParent(n: NebulaNode): NebulaNode {
  let p = n.parent
  while (p && !p.visible) p = p.parent
  return p || (rootNode as NebulaNode)
}
function refreshVisibility() {
  if (!rootNode) return
  const now = performance.now()
  const vis = new Set<string>()
  ;(function mark(n: NebulaNode) { vis.add(n.id); visibleChildren(n).forEach(mark) })(rootNode)

  for (const n of allNodes) {
    const should = vis.has(n.id)
    if (should && !n.visible) {
      n.visible = true
      const p = nearestVisibleParent(n)
      n.x = p.x; n.y = p.y
      n.alpha = 0; n.tAlpha = 1
      n.spawnAt = now + Math.min(n.depth, 6) * 70
      ensureDom(n)
    } else if (!should && n.visible) {
      n.visible = false; n.tAlpha = 0
      const p = nearestVisibleParent(n)
      n.tx = p.tx; n.ty = p.ty
    }
  }
}

/* ───────────────────────────── DOM 构建 ───────────────────────────── */
function nodeHtml(n: NebulaNode) {
  const priceText = n.price > 0 ? money(n.price) : '—'
  const badge = n.type === 'root' ? '主产品' : n.type === 'combo' ? '组合' : '普通'
  const twisty = n.children.length
    ? `<button class="cbn-twisty" title="${collapsedSet.has(n.id) ? '展开' : '收起'}">${collapsedSet.has(n.id) ? `<span class="n">+${n.children.length}</span>` : '−'}</button>`
    : ''
  const icon = n.type === 'root' ? '<div class="cbn-core"></div>' : '<div class="cbn-bar"></div>'
  return `
    ${icon}
    <div class="cbn-body">
      <div class="cbn-name" title="${esc(n.name)}">${esc(n.name)}</div>
      <div class="cbn-code">${esc(n.code)}</div>
    </div>
    <div class="cbn-meta">
      <span class="cbn-qty">×<b>${n.num}</b></span>
      <span class="cbn-price">${priceText}</span>
    </div>
    <span class="cbn-badge">${badge}</span>
    ${n.depth > 0 ? `<span class="cbn-depth-pill">L${n.depth}</span>` : ''}
    ${twisty}`
}

function ensureDom(n: NebulaNode) {
  if (n.el || !nodesRef.value || !edgesRef.value || !flowsRef.value) return
  const fo = document.createElementNS(SVGNS, 'foreignObject')
  fo.setAttribute('width', String(n.w)); fo.setAttribute('height', String(n.h))
  fo.setAttribute('overflow', 'visible')
  const div = document.createElement('div')
  div.className = `cbn-node t-${n.type}`
  div.innerHTML = nodeHtml(n)
  div.addEventListener('click', ev => {
    if ((ev.target as HTMLElement).closest('.cbn-twisty')) return
    selectNode(n)
  })
  div.addEventListener('mouseenter', () => { hovered = n; applyFocus() })
  div.addEventListener('mouseleave', () => { hovered = null; applyFocus() })
  const tw = div.querySelector('.cbn-twisty')
  if (tw) tw.addEventListener('click', ev => { ev.stopPropagation(); toggle(n) })
  fo.appendChild(div)
  nodesRef.value.appendChild(fo)
  n.el = fo; n.card = div

  if (n.parent) {
    const grad = document.createElementNS(SVGNS, 'linearGradient')
    grad.id = 'cbn-g-' + cssSafeId(n.id)
    grad.setAttribute('gradientUnits', 'userSpaceOnUse')
    const stopA = document.createElementNS(SVGNS, 'stop')
    stopA.setAttribute('offset', '0%')
    stopA.setAttribute('stop-color', typeColor(n.parent.type))
    const stopB = document.createElementNS(SVGNS, 'stop')
    stopB.setAttribute('offset', '100%')
    stopB.setAttribute('stop-color', typeColor(n.type))
    grad.appendChild(stopA); grad.appendChild(stopB)
    defsEl?.appendChild(grad)

    const path = document.createElementNS(SVGNS, 'path')
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', `url(#${grad.id})`)
    path.setAttribute('stroke-width', '1.6')
    path.setAttribute('stroke-linecap', 'round')
    edgesRef.value.appendChild(path)
    n.edgeEl = path; n.grad = grad

    // 流动光线：与底边同路径、复用同一条父→子渐变；4 层「头对齐、越长越细越淡」叠成锥形拖尾
    // ⚠️ 随机延时必须只取一次并共用 —— 各取一次会让四层的头错开，锥形就散了
    const delay = (-Math.random() * 1).toFixed(2) + 's'
    n.flowEls = FLOW_LAYERS.map(({ cls }) => {
      const p = document.createElementNS(SVGNS, 'path')
      p.setAttribute('class', 'cbn-flow ' + cls)
      p.setAttribute('stroke', `url(#${grad.id})`)
      p.setAttribute('pathLength', '252')   // 归一化：几何长度各异的连线，光锥长度与节拍一致
      p.style.animationDelay = delay
      flowsRef.value!.appendChild(p)
      return p
    })
  }
}
function cssSafeId(id: string) { return id.replace(/[^a-zA-Z0-9_-]/g, '_') }

function refreshGradients() {
  for (const n of allNodes) {
    if (!n.grad || !n.parent) continue
    const stops = n.grad.querySelectorAll('stop')
    stops[0]?.setAttribute('stop-color', typeColor(n.parent.type))
    stops[1]?.setAttribute('stop-color', typeColor(n.type))
  }
}

/* ───────────────────────────── 聚焦高亮 ───────────────────────────── */
function applyFocus() {
  focusSet.clear(); focusEdges.clear()
  if (hovered) {
    let p: NebulaNode | null = hovered
    while (p) { focusSet.add(p.id); p = p.parent }
    ;(function down(n: NebulaNode) { focusSet.add(n.id); n.children.forEach(down) })(hovered)
    p = hovered
    while (p && p.parent) { focusEdges.add(p.id); p = p.parent }
  }
  const q = query.value.trim().toLowerCase()
  for (const n of allNodes) {
    if (!n.card) continue
    const dimByFocus = !!hovered && !focusSet.has(n.id)
    const matched = !!q && (n.name.toLowerCase().includes(q) || n.code.toLowerCase().includes(q))
    n.card.classList.toggle('dim', dimByFocus || (!!q && !matched))
    n.card.classList.toggle('match', matched)
    n.card.classList.toggle('hot', hovered === n)
  }
}

/* ───────────────────────────── 展开 / 收起 ───────────────────────────── */
function toggle(n: NebulaNode) {
  if (!n.children.length) return
  if (collapsedSet.has(n.id)) collapsedSet.delete(n.id); else collapsedSet.add(n.id)
  relayout()
}
function expandAll() { collapsedSet.clear(); relayout() }
function collapseAll() {
  collapsedSet.clear()
  if (!rootNode) return
  ;(function walk(n: NebulaNode) {
    if (n.depth >= 1 && n.children.length) collapsedSet.add(n.id)
    n.children.forEach(walk)
  })(rootNode)
  relayout()
}
function relayout() {
  computeLayout()
  refreshVisibility()
  syncTwisties()
  collapsedSetVersion.value++
  fitView()
}
function syncTwisties() {
  for (const n of allNodes) {
    if (!n.card || !n.children.length) continue
    const tw = n.card.querySelector('.cbn-twisty')
    if (tw) tw.innerHTML = collapsedSet.has(n.id) ? `<span class="n">+${n.children.length}</span>` : '−'
  }
}

/* ───────────────────────────── 相机 ───────────────────────────── */
function fitView(pad = 44) {
  const stage = stageRef.value
  if (!stage) return
  const W = stage.clientWidth, H = stage.clientHeight
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const n of allNodes) {
    if (!n.visible && n.tAlpha === 0) continue
    x0 = Math.min(x0, n.tx); y0 = Math.min(y0, n.ty)
    x1 = Math.max(x1, n.tx + n.w); y1 = Math.max(y1, n.ty + n.h)
  }
  if (!isFinite(x0)) return
  const bw = x1 - x0, bh = y1 - y0
  cam.tk = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh, 1.65)
  cam.tk = Math.max(cam.tk, 0.18)
  cam.tx = (W - bw * cam.tk) / 2 - x0 * cam.tk
  cam.ty = (H - bh * cam.tk) / 2 - y0 * cam.tk
}
function zoomAt(cx: number, cy: number, factor: number) {
  const k2 = Math.min(2.4, Math.max(0.18, cam.tk * factor))
  const s = k2 / cam.tk
  cam.tx = cx - (cx - cam.tx) * s
  cam.ty = cy - (cy - cam.ty) * s
  cam.tk = k2
}
function zoomCenter(factor: number) {
  const stage = stageRef.value
  if (!stage) return
  zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, factor)
}
function flyTo(n: NebulaNode) {
  const stage = stageRef.value
  if (!stage) return
  cam.tk = Math.max(cam.tk, 1)
  cam.tx = stage.clientWidth / 2 - (n.tx + n.w / 2) * cam.tk
  cam.ty = stage.clientHeight / 2 - (n.ty + n.h / 2) * cam.tk
}
function flyToFirstMatch() {
  const q = query.value.trim().toLowerCase()
  if (!q) return
  const hit = allNodes.find(n => n.visible && (n.name.toLowerCase().includes(q) || n.code.toLowerCase().includes(q)))
  if (hit) { flyTo(hit); selectNode(hit) }
}

/* ───────────────────────────── 选中 / Toast ───────────────────────────── */
function selectNode(n: NebulaNode | null) {
  selected.value = n
  collapsedSetVersion.value++
}
function toast(msg: string) {
  toastMsg.value = msg
  toastVisible.value = true
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toastVisible.value = false }, 2200)
}

/* ───────────────────────────── 主循环 ───────────────────────────── */
/* 层数加密到 8 层后，每帧对每层 setAttribute('d') 会放大成 8 倍开销。两招把稳态开销压到 ~0：
     ① 收敛到 GEOM_EPS 内直接吸附到目标值（lerp 是渐近的，永远差一点点 → 导致 d 每帧都在变）
     ② 所有几何写入先与上帧比对，只有真的变了才写 */
let lastCamTf = ''
function frame(now: number) {
  cam.x += (cam.tx - cam.x) * 0.14
  cam.y += (cam.ty - cam.y) * 0.14
  cam.k += (cam.tk - cam.k) * 0.14
  if (Math.abs(cam.tx - cam.x) < GEOM_EPS && Math.abs(cam.ty - cam.y) < GEOM_EPS && Math.abs(cam.tk - cam.k) < 0.0005) {
    cam.x = cam.tx; cam.y = cam.ty; cam.k = cam.tk
  }
  const tf = `translate(${cam.x} ${cam.y}) scale(${cam.k})`
  if (tf !== lastCamTf) { viewportRef.value?.setAttribute('transform', tf); lastCamTf = tf }

  for (const n of allNodes) {
    if (!n.el && n.visible) ensureDom(n)
    if (!n.el) continue
    if (!n.visible && n.alpha < 0.015) {
      n.el.style.display = 'none'
      if (n.edgeEl) n.edgeEl.style.display = 'none'
      n.flowEls.forEach(el => { el.style.display = 'none' })
      continue
    }
    if (now >= n.spawnAt) n.alpha += (n.tAlpha - n.alpha) * 0.18
    n.x += (n.tx - n.x) * LERP
    n.y += (n.ty - n.y) * LERP
    if (Math.abs(n.tx - n.x) < GEOM_EPS) n.x = n.tx      // 吸附：让几何真正稳住
    if (Math.abs(n.ty - n.y) < GEOM_EPS) n.y = n.ty

    n.el.style.display = ''
    if (n.x !== n.lastX) { n.el.setAttribute('x', String(n.x)); n.lastX = n.x }
    if (n.y !== n.lastY) { n.el.setAttribute('y', String(n.y)); n.lastY = n.y }
    n.el.style.opacity = String(Math.max(0, n.alpha))

    if (n.edgeEl && n.parent && n.grad) {
      const sx = n.parent.x + n.parent.w, sy = n.parent.y + n.parent.h / 2
      const ex = n.x, ey = n.y + n.h / 2
      const dx = Math.max(46, (ex - sx) * 0.5)
      const d = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${ex - dx} ${ey}, ${ex} ${ey}`
      const edgeAlpha = Math.min(n.alpha, n.parent.alpha)
      const hot = !!hovered && focusEdges.has(n.id)
      const dimmed = !!hovered && !hot

      // 几何：d 不变 ⇒ 端点也没变（d 由这 4 个值唯一决定），故整块一起省掉
      if (d !== n.lastD) {
        n.lastD = d
        n.edgeEl.setAttribute('d', d)
        n.grad.setAttribute('x1', String(sx)); n.grad.setAttribute('y1', String(sy))
        n.grad.setAttribute('x2', String(ex)); n.grad.setAttribute('y2', String(ey))
        for (const el of n.flowEls) el.setAttribute('d', d)
      }

      // 状态类写入（与悬停/入场有关，很便宜，照常每帧写）
      n.edgeEl.style.display = ''
      n.edgeEl.style.opacity = String(edgeAlpha * (dimmed ? 0.22 : 1))
      n.edgeEl.setAttribute('stroke-width', hot ? '2.2' : '1.2')   // 底边整条常亮，作为「线路」本体

      // 流动光线：几何已在上面的缓存块里同步，这里只更新透明度与 hot 态
      const foKey = hot ? 'opHot' : dimmed ? 'opDim' : 'op'
      for (let i = 0; i < n.flowEls.length; i++) {
        const el = n.flowEls[i]
        el.style.display = ''
        el.style.opacity = String(edgeAlpha * FLOW_LAYERS[i][foKey])
        el.classList.toggle('hot', hot)
      }
    }
  }
  rafId = requestAnimationFrame(frame)
}

/* ───────────────────────────── 重建（数据变更） ───────────────────────────── */
function disposeDom() {
  if (nodesRef.value) nodesRef.value.innerHTML = ''
  if (edgesRef.value) edgesRef.value.innerHTML = ''
  if (flowsRef.value) flowsRef.value.innerHTML = ''
  if (defsEl) defsEl.innerHTML = ''
}
function rebuild() {
  disposeDom()
  allNodes.length = 0
  collapsedSet.clear()
  hovered = null
  selectNode(null)
  query.value = ''
  seq = 0

  rootNode = buildRoot()
  allNodes.push(rootNode)
  ;(function collect(n: NebulaNode) { n.children.forEach(c => { allNodes.push(c); collect(c) }) })(rootNode)

  computeLayout()
  refreshVisibility()
  computeStats()
  refreshGradients()

  // 入场：所有节点自根节点位置生长，按层级错峰
  const now = performance.now()
  for (const n of allNodes) {
    if (n !== rootNode && rootNode) { n.x = rootNode.x; n.y = rootNode.y }
    n.alpha = 0
    n.spawnAt = now + n.depth * 110
  }
  fitView()
  cam.x = cam.tx; cam.y = cam.ty; cam.k = cam.tk
  lastCamTf = ''          // 相机已直接落位，让下一帧强制改写一次 transform
  applyFocus()
}

/* ───────────────────────────── 事件绑定（平移/缩放） ───────────────────────────── */
let drag: { sx: number; sy: number; cx: number; cy: number; moved: boolean } | null = null
function onWheel(e: WheelEvent) {
  const stage = stageRef.value
  if (!stage) return

  // 详情面板打开时：滚轮不再缩放画布，而是滚动产品信息栏。
  // 悬停在面板上时浏览器原生滚动（面板是 stage 的兄弟节点，事件根本不会走到这里），
  // 这里处理的是「面板开着、鼠标还停在画布上」的情况 —— 把滚动转发给面板内容区。
  if (selected.value) {
    const body = panelBodyRef.value
    if (body) {
      const canScroll = body.scrollHeight > body.clientHeight
      const atTop = body.scrollTop <= 0 && e.deltaY < 0
      const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 1 && e.deltaY > 0
      if (canScroll && !atTop && !atBottom) {
        e.preventDefault()          // 画布不缩放，也别让整页跟着滚
        body.scrollTop += e.deltaY
      }
      // 面板本身不可滚 / 已滚到边界 → 不缩放也不拦截，交给页面自然滚动
    }
    return
  }

  e.preventDefault()
  const rect = stage.getBoundingClientRect()
  zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0014))
}
function onPointerDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('.cbn-node')) return
  drag = { sx: e.clientX, sy: e.clientY, cx: cam.tx, cy: cam.ty, moved: false }
  stageRef.value?.classList.add('dragging')
  stageRef.value?.setPointerCapture(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!drag) return
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy
  if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true
  cam.tx = drag.cx + dx; cam.ty = drag.cy + dy
  cam.x = cam.tx; cam.y = cam.ty
}
function onPointerUp() {
  if (drag && !drag.moved) selectNode(null)
  drag = null
  stageRef.value?.classList.remove('dragging')
}

/* ───────────────────────────── 生命周期 ───────────────────────────── */
onMounted(() => {
  if (svgRef.value) {
    defsEl = document.createElementNS(SVGNS, 'defs')
    svgRef.value.insertBefore(defsEl, svgRef.value.firstChild)
  }
  readPalette()
  rebuild()

  const stage = stageRef.value
  if (stage) {
    stage.addEventListener('wheel', onWheel, { passive: false })
    stage.addEventListener('pointerdown', onPointerDown)
    stage.addEventListener('pointermove', onPointerMove)
    stage.addEventListener('pointerup', onPointerUp)
    stage.addEventListener('pointercancel', onPointerUp)
  }
  resizeObs = new ResizeObserver(() => fitView())
  if (stage) resizeObs.observe(stage)
  themeObs = new MutationObserver(() => { readPalette(); refreshGradients() })
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  rafId = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  resizeObs?.disconnect()
  themeObs?.disconnect()
  window.clearTimeout(toastTimer)
  const stage = stageRef.value
  if (stage) {
    stage.removeEventListener('wheel', onWheel)
    stage.removeEventListener('pointerdown', onPointerDown)
    stage.removeEventListener('pointermove', onPointerMove)
    stage.removeEventListener('pointerup', onPointerUp)
    stage.removeEventListener('pointercancel', onPointerUp)
  }
})

watch(() => [props.nodes, props.root?.product_name, props.root?.product_code], () => rebuild())
watch(query, () => applyFocus())
</script>

<style>
/* ═══════════════ 组合星图（非 scoped，统一 .combo-nebula 前缀隔离） ═══════════════ */
.combo-nebula {
  position: relative;
  /* 画布别占满一屏：太大页面没法上下滑（但也别太矮，星图会被压得太小）。
     宽度保持撑满容器不动，只调高度。 */
  height: clamp(480px, 60vh, 660px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-page);
}
.cbn-stage { position: absolute; inset: 0; cursor: grab; }
.cbn-stage.dragging { cursor: grabbing; }
.cbn-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.cbn-bg {
  position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(var(--border-color) 1px, transparent 1px);
  background-size: 26px 26px;
  opacity: .55;
}

/* ── 节点卡片 ── */
.cbn-node {
  width: 100%; height: 100%;
  display: flex; align-items: center; gap: 10px;
  padding: 0 12px;
  background: var(--bg-white);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  cursor: pointer;
  user-select: none;
  transition: box-shadow .25s ease, border-color .25s ease, transform .25s ease, opacity .3s ease, filter .3s ease;
  position: relative;
  overflow: visible;
  font-family: inherit;
}
.cbn-node:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
.cbn-node.dim { opacity: .22; filter: saturate(.42); }
/* 聚焦高亮：克制取向 —— 只强化节点自身类型色描边 + 阴影加深，不用红色强调 */
.cbn-node.hot { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
.cbn-node.t-combo.hot { border-color: var(--warning); }
.cbn-node.t-normal.hot { border-color: var(--text-secondary); }
.cbn-node.match { border-color: var(--warning); box-shadow: 0 0 0 1.5px var(--warning), var(--shadow-lg); }

/* ── 流动光线（锥形拖尾：头粗 → 尾细） ── */
/* ── 流动光线（锥形拖尾 · 8 级平滑递减） ── */
/* ⚠️ stroke-width 在单个 path 上是恒定的，所以「多粗→多细」只能靠多层叠加近似。
   层数越少台阶越明显（4 层时每级跳 1.1px，肉眼就是"阶梯"）。这里用 8 层、宽度按
   **等步长 0.44** 从 4.3 递减到 1.2（最细一层恰好 = 底边宽度，尾部融进线里而非硬断），
   透明度也按等步长递减，两级台阶都压到亚像素级 → 观感为连续锥形。
   8 层的 (dash 长度, 线宽) 依次为：
     32/4.3  62/3.86  92/3.41  122/2.97  152/2.53  182/2.09  212/1.64  244/1.2
   起始偏移 = 各自 dash 长度（而非长度一半），才能让「头」恒对齐在 t 上。 */
.cbn-flow {
  fill: none; stroke-linecap: round;
  animation-duration: 1s;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  transition: opacity .22s ease;
}
.cbn-flow.s0 { stroke-width: 4.3;  stroke-dasharray: 32 220;  animation-name: cbnFlowS0; }
.cbn-flow.s1 { stroke-width: 3.86; stroke-dasharray: 62 190;  animation-name: cbnFlowS1; }
.cbn-flow.s2 { stroke-width: 3.41; stroke-dasharray: 92 160;  animation-name: cbnFlowS2; }
.cbn-flow.s3 { stroke-width: 2.97; stroke-dasharray: 122 130; animation-name: cbnFlowS3; }
.cbn-flow.s4 { stroke-width: 2.53; stroke-dasharray: 152 100; animation-name: cbnFlowS4; }
.cbn-flow.s5 { stroke-width: 2.09; stroke-dasharray: 182 70;  animation-name: cbnFlowS5; }
.cbn-flow.s6 { stroke-width: 1.64; stroke-dasharray: 212 40;  animation-name: cbnFlowS6; }
.cbn-flow.s7 { stroke-width: 1.2;  stroke-dasharray: 244 8;   animation-name: cbnFlowS7; }
.cbn-flow.hot  { animation-duration: .4s; }
/* from = 该层 dash 长度 L；to = L - 252（= pathLength），一个周期正好从线头流到线尾 */
@keyframes cbnFlowS0 { from { stroke-dashoffset: 32; }  to { stroke-dashoffset: -220; } }
@keyframes cbnFlowS1 { from { stroke-dashoffset: 62; }  to { stroke-dashoffset: -190; } }
@keyframes cbnFlowS2 { from { stroke-dashoffset: 92; }  to { stroke-dashoffset: -160; } }
@keyframes cbnFlowS3 { from { stroke-dashoffset: 122; } to { stroke-dashoffset: -130; } }
@keyframes cbnFlowS4 { from { stroke-dashoffset: 152; } to { stroke-dashoffset: -100; } }
@keyframes cbnFlowS5 { from { stroke-dashoffset: 182; } to { stroke-dashoffset: -70; } }
@keyframes cbnFlowS6 { from { stroke-dashoffset: 212; } to { stroke-dashoffset: -40; } }
@keyframes cbnFlowS7 { from { stroke-dashoffset: 244; } to { stroke-dashoffset: -8; } }

.cbn-node .cbn-bar { width: 4px; align-self: stretch; margin: 10px 0; border-radius: 2px; flex: none; }
.cbn-node.t-combo .cbn-bar { background: linear-gradient(180deg, var(--warning), var(--warning)); }
.cbn-node.t-normal .cbn-bar { background: var(--text-tertiary); }
.cbn-node.t-combo { background: color-mix(in srgb, var(--warning) 6%, var(--bg-white)); border-color: var(--warning-border); }
.cbn-node.t-root {
  border: 1.5px solid transparent;
  background: linear-gradient(var(--bg-white), var(--bg-white)) padding-box,
              linear-gradient(120deg, var(--primary), var(--warning)) border-box;
  box-shadow: 0 0 32px var(--primary-bg), var(--shadow-md);
}

.cbn-node .cbn-body { flex: 1; min-width: 0; }
.cbn-node .cbn-name { font-size: 13px; font-weight: 600; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary); }
.cbn-node .cbn-code { font-size: 11px; color: var(--text-secondary); font-family: Consolas, monospace; margin-top: 2px; letter-spacing: .02em; }
.cbn-node .cbn-meta { flex: none; text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.cbn-node .cbn-qty { font-size: 11px; color: var(--text-secondary); }
.cbn-node .cbn-qty b { color: var(--text-primary); font-weight: 600; }
.cbn-node .cbn-price { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-primary); }
.cbn-node.t-combo .cbn-price { color: var(--warning); }

.cbn-node .cbn-badge {
  position: absolute; top: -8px; left: 10px;
  font-size: 10px; padding: 1px 7px; border-radius: 99px; font-weight: 600; letter-spacing: .04em;
  background: var(--bg-white); border: 1px solid var(--border-color); color: var(--text-secondary);
}
.cbn-node.t-combo .cbn-badge { background: var(--warning-light); color: var(--warning); border-color: var(--warning-border); }
.cbn-node.t-root .cbn-badge { background: var(--primary); color: #fff; border-color: var(--primary); }
.cbn-node .cbn-depth-pill {
  position: absolute; top: -8px; right: 10px;
  font-size: 10px; padding: 1px 7px; border-radius: 99px;
  background: var(--bg-white); color: var(--text-tertiary); border: 1px solid var(--border-color);
}

.cbn-node .cbn-core {
  flex: none; width: 34px; height: 34px; border-radius: 50%;
  background: radial-gradient(circle at 32% 30%, var(--primary-light), var(--primary) 68%);
  box-shadow: 0 0 14px var(--primary-border), inset 0 0 6px rgba(255,255,255,.25);
  position: relative;
}
.cbn-node .cbn-core::after {
  content: ''; position: absolute; inset: -6px; border-radius: 50%;
  border: 1.5px solid var(--primary); opacity: .35;
  animation: cbnCorePulse 2.6s ease-out infinite;
}
@keyframes cbnCorePulse { 0% { transform: scale(.7); opacity: .6; } 100% { transform: scale(1.35); opacity: 0; } }

.cbn-twisty {
  position: absolute; right: -11px; top: 50%; transform: translateY(-50%);
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--bg-white); border: 1.5px solid var(--warning);
  color: var(--warning); font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; z-index: 2; line-height: 1;
  transition: transform .2s ease, background .2s ease, color .2s ease;
  box-shadow: var(--shadow-md);
}
.cbn-twisty:hover { background: var(--warning); color: #fff; transform: translateY(-50%) scale(1.12); }
.cbn-twisty .n { font-size: 10px; }

/* ── 统计角标 ── */
.cbn-stats { position: absolute; left: 14px; top: 12px; display: flex; gap: 8px; flex-wrap: wrap; z-index: 5; pointer-events: none; }
.cbn-stat {
  background: var(--bg-white); border: 1px solid var(--border-color); border-radius: 10px;
  padding: 5px 11px; box-shadow: var(--shadow-sm); pointer-events: auto;
}
.cbn-stat-v { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.2; color: var(--text-primary); }
.cbn-stat-k { font-size: 10.5px; color: var(--text-secondary); }
.cbn-stat.accent .cbn-stat-v { color: var(--primary); }
.cbn-stat.amber .cbn-stat-v { color: var(--warning); }

/* ── 工具栏 ── */
.cbn-tools { position: absolute; right: 14px; top: 12px; display: flex; gap: 6px; align-items: center; z-index: 5; }
.cbn-search {
  height: 30px; width: 160px; padding: 0 12px;
  border-radius: 99px; border: 1px solid var(--border-color);
  background: var(--bg-white); color: var(--text-primary); font-size: 12.5px; outline: none;
  transition: width .25s ease, border-color .2s ease, box-shadow .2s ease;
  box-shadow: var(--shadow-sm);
}
.cbn-search:focus { width: 210px; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-bg); }
.cbn-tool {
  height: 30px; min-width: 30px; padding: 0 8px;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  border-radius: 8px; border: 1px solid var(--border-color);
  background: var(--bg-white); color: var(--text-primary);
  font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: var(--shadow-sm);
  transition: transform .15s ease, border-color .2s ease, color .2s ease;
}
.cbn-tool:hover { border-color: var(--primary); color: var(--primary); transform: translateY(-1px); }
.cbn-tool:active { transform: scale(.94); }
.cbn-tool svg { width: 14px; height: 14px; }

/* ── 图例 / 提示 ── */
.cbn-legend {
  position: absolute; left: 14px; bottom: 12px; z-index: 5;
  display: flex; gap: 12px; padding: 7px 13px; align-items: center;
  background: var(--bg-white); border: 1px solid var(--border-color); border-radius: 99px;
  box-shadow: var(--shadow-sm); font-size: 11.5px; color: var(--text-secondary);
}
.cbn-li { display: flex; align-items: center; gap: 6px; }
.cbn-sw { width: 18px; height: 3px; border-radius: 2px; display: inline-block; }
.cbn-sw-root { background: linear-gradient(90deg, var(--primary), var(--warning)); height: 5px; }
.cbn-sw-combo { background: var(--warning); }
.cbn-sw-normal { background: var(--text-tertiary); }
.cbn-flow-sample {
  position: relative; width: 26px; height: 5px; display: inline-block; flex: none;
}
.cbn-flow-sample::before {
  content: ''; position: absolute; left: 0; right: 0; top: 50%;
  height: 1.5px; transform: translateY(-50%); border-radius: 1px;
  background: var(--warning); opacity: .35;
}
.cbn-flow-sample::after {
  content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 13px;
  background: var(--warning);
  clip-path: polygon(100% 0, 100% 100%, 0 50%);   /* 头(右)粗、尾(左)尖 = 锥形拖尾 */
  animation: cbnLegendFlow 1s linear infinite;
}
@keyframes cbnLegendFlow { from { transform: translateX(-14px); } to { transform: translateX(26px); } }
.cbn-hint { position: absolute; right: 14px; bottom: 12px; z-index: 5; font-size: 11px; color: var(--text-tertiary); }

/* ── 详情面板 ── */
.cbn-panel {
  position: absolute; top: 0; right: 0; height: 100%; width: 300px; z-index: 10;
  background: var(--bg-white); border-left: 1px solid var(--border-color);
  box-shadow: -16px 0 48px rgba(0,0,0,.18);
  transform: translateX(105%);
  transition: transform .38s cubic-bezier(.22,1,.3,1);
  display: flex; flex-direction: column;
}
.cbn-panel.open { transform: translateX(0); }
.cbn-p-head { padding: 18px 18px 12px; border-bottom: 1px solid var(--border-light); position: relative; }
.cbn-p-type { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; margin-bottom: 6px; }
.cbn-p-type.combo { color: var(--warning); }
.cbn-p-type.normal { color: var(--text-secondary); }
.cbn-p-type.root { color: var(--primary); }
.cbn-p-name { font-size: 15.5px; font-weight: 700; line-height: 1.35; color: var(--text-primary); }
.cbn-p-code { font-size: 12px; color: var(--text-secondary); font-family: Consolas, monospace; margin-top: 3px; }
.cbn-p-close {
  position: absolute; top: 14px; right: 12px; width: 26px; height: 26px;
  border-radius: 8px; border: none; background: transparent;
  color: var(--text-secondary); font-size: 14px; cursor: pointer;
}
.cbn-p-close:hover { background: var(--bg-hover); color: var(--text-primary); }
.cbn-p-body { flex: 1; overflow-y: auto; padding: 14px 18px; }
.cbn-p-sec { margin-bottom: 16px; }
.cbn-p-sec h4 { font-size: 11px; color: var(--text-tertiary); font-weight: 600; letter-spacing: .08em; margin-bottom: 8px; }
.cbn-kv { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 6px 0; border-bottom: 1px dashed var(--border-light); font-size: 12.5px; }
.cbn-kv:last-child { border-bottom: none; }
.cbn-kv .k { color: var(--text-secondary); flex: none; }
.cbn-kv .v { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text-primary); text-align: right; }
.cbn-kv .v.amber { color: var(--warning); }
.cbn-kv .v.red { color: var(--primary); }
.cbn-ellipsis { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cbn-crumb { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: 11.5px; }
.cbn-crumb span { padding: 3px 8px; border-radius: 7px; background: var(--bg-hover); color: var(--text-secondary); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cbn-crumb span.cur { background: var(--primary); color: #fff; }
.cbn-crumb i { color: var(--text-tertiary); font-style: normal; font-size: 10px; }
.cbn-p-foot { padding: 12px 18px; border-top: 1px solid var(--border-light); display: flex; gap: 8px; }
.cbn-p-btn {
  flex: 1; height: 32px; border-radius: 8px; font-size: 12.5px; font-weight: 600;
  cursor: pointer; border: 1px solid var(--border-color); background: transparent; color: var(--text-primary);
  transition: all .18s ease;
}
.cbn-p-btn:hover { border-color: var(--primary); color: var(--primary); }
.cbn-p-btn.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.cbn-p-btn.primary:hover { background: var(--primary-light); color: #fff; }

/* ── Toast ── */
.cbn-toast {
  position: absolute; left: 50%; top: 16px; transform: translate(-50%, -70px); z-index: 30;
  background: var(--bg-white); border: 1px solid var(--border-color);
  color: var(--text-primary); padding: 8px 16px; border-radius: 99px; font-size: 12.5px;
  box-shadow: var(--shadow-lg); transition: transform .35s cubic-bezier(.22,1,.3,1);
  pointer-events: none;
}
.cbn-toast.show { transform: translate(-50%, 0); }

@media (prefers-reduced-motion: reduce) {
  .cbn-node .cbn-core::after { animation: none; }
}
</style>
