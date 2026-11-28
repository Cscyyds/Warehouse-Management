<template>
  <div class="pdf-editor">
<!-- 左右两栏：左预览、右选择。预览用同一组参数渲染，所见即所得 -->
    <div class="pdf-layout">
      <!-- 左侧：实时 PDF 预览（浏览器内置阅读器 iframe） -->
      <aside class="pdf-preview">
        <div class="pdf-preview__head">
          <span class="pdf-preview__title">预览</span>
          <span v-if="previewStale || preview.loading" class="pdf-preview__hint">渲染中…</span>
          <span v-else-if="preview.error" class="pdf-preview__hint is-error">预览失败</span>
          <span v-else-if="previewInSync" class="pdf-preview__hint">{{ configurationMode ? '与当前勾选一致' : '与下载内容一致' }}</span>
          <span v-else class="pdf-preview__hint">暂无预览</span>
        </div>
        <!--
          双缓冲交叉淡入：新图先在不可见层加载，旧图全程保持不透明，
          等新层 load + 渲染缓冲后仅切换 opacity —— 这是消除白闪的关键。
        -->
        <div class="pdf-preview__stage">
          <div
            v-for="(layer, index) in previewLayers"
            :key="index"
            class="pdf-preview__layer"
            :class="{ 'is-visible': layer.visible }"
          >
            <!--
              缩放被继承的根治：每次新图换唯一 token 强制重建 iframe，
              并在 URL 上追加 zoom=100 显式指定初始缩放。
              否则内置阅读器会沿用上次 zoom，表现为「越更新越小」。
            -->
            <iframe
              v-if="layer.src"
              :key="layer.token"
              :src="iframeSrc(layer.src)"
              class="pdf-preview__frame"
              title="PDF 预览"
              @load="onLayerLoaded(index)"
            />
          </div>

          <div v-if="previewBusy" class="pdf-preview__skeleton" aria-live="polite">
            <span class="sk-dot" /><span class="sk-dot" /><span class="sk-dot" />
            <span class="sk-label">正在生成预览…</span>
          </div>

          <div v-if="!hasAnyLayer && !previewBusy && preview.error" class="pdf-preview__empty">
            <el-icon><Document /></el-icon>
            <span>{{ preview.error }}</span>
            <el-button link type="primary" size="small" @click="retryPreview">重试</el-button>
          </div>
          <div v-else-if="!hasAnyLayer && !previewBusy" class="pdf-preview__empty">
            <el-icon><Document /></el-icon>
            <span>{{ configurationMode ? '选择一张单据预览当前字段方案' : '暂无预览' }}</span>
          </div>
        </div>
        <p class="pdf-preview__foot">预览随右侧选择实时更新；下拉或滚动可查看多页。</p>
      </aside>

      <!-- 右侧：区域 + 字段选择 -->
      <div class="pdf-options">
        <!-- 混合结构：区域用「三态勾选框 + 底色标题带」，字段用普通勾选项 -->
        <div class="region-list">
      <!--
        「页面固定项」区域已移除：
        Logo/品牌名/公司名/单号/页码 是强制显示字段，不给用户操作，没必要占版面；
        「生成时间」已并入各单据的基本信息区。
      -->

      <section
        v-for="section in catalogue?.sections || []"
        :key="section.key"
        class="region"
        :class="{
          'is-on': sectionFully(section.key),
          'is-partial': sectionPartial(section.key),
        }"
      >
        <header class="region__head">
          <span class="region__bar" aria-hidden="true" />
          <!-- 区域勾选框：三态（全选/半选/未选），点击即全选或取消整个区域 -->
          <el-checkbox
            class="region__check"
            :model-value="sectionFully(section.key)"
            :indeterminate="sectionPartial(section.key)"
            :disabled="submitting || disabled"
            @change="(v: unknown) => onRegionCheck(section, Boolean(v))"
          >
            <span class="region__title">{{ section.label }}</span>
          </el-checkbox>
          <span class="region__count">{{ sectionCount(section.key) }}</span>
        </header>

        <div class="region__fields">
          <el-checkbox
            v-for="field in fieldsOfSection(section.key)"
            :key="field.key"
            :model-value="shownFields.includes(field.key)"
            :disabled="submitting || disabled"
            @change="(v: unknown) => toggleField(field.key, Boolean(v))"
          >
            <span class="field-label">{{ field.label }}</span>
            <!-- 跨区字段：勾选会在多个区域同时隐藏，必须显式提示 -->
            <el-tooltip
              v-if="isCross(field.key)"
              :content="`该字段同时出现在 ${crossNames(field.key)}，显示状态会同步变化`"
              placement="top"
            >
              <el-tag type="warning" size="small" effect="plain" class="field-cross-tag">跨区</el-tag>
            </el-tooltip>
            <el-tooltip v-if="field.note" :content="field.note" placement="top">
              <el-icon class="field-tip"><QuestionFilled /></el-icon>
            </el-tooltip>
          </el-checkbox>
        </div>
      </section>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fetchWithSafeErrors } from '@/utils/serverErrorDisplay'
import { computed, onActivated, onDeactivated, onBeforeUnmount, ref, watch } from 'vue'
import { QuestionFilled, Loading, Document } from '@element-plus/icons-vue'
import {
  getPdfCatalogue, sectionFields, isCrossSectionField, sectionsContaining,
  allFieldKeys, shownToHidden, defaultShownFields, isAlwaysShown,
  type PdfDocKind,
} from '@/config/pdfExportOptions'
import {
  createPdfPreviewController, snapshotToPreviewRequest, blobToPdfDataUrl,
  type PdfPreviewState, type PdfPreviewRequest,
} from '@/utils/pdfPreview'
import { buildPdfExportSnapshot } from '@/utils/pdfExport'

const props = defineProps<{
  modelValue: boolean
  kind: PdfDocKind
  billId: string
  billNo?: string | null
  initialShownFields?: string[]
  configurationMode?: boolean
  disabled?: boolean
  /**
   * 预览用取数函数：由调用方注入（各页面已有自己的 printXxxPdf 封装）。
   * 不传则不渲染预览区（降级为纯选择弹窗）。
   */
  previewFetcher?: (req: PdfPreviewRequest) => Promise<Blob>
}>()

const emit = defineEmits<{
  change: [fields: string[]]
}>()

const catalogue = computed(() => getPdfCatalogue(props.kind))

/**
 * 界面语义：「勾选 = 我要这个字段显示」。
 *
 * 组件内部统一用 `shownFields`（已勾选=要显示）维护界面状态，
 * 只在「发请求 / 生成快照」时通过 shownToHidden 翻转成后端要的 hide_fields。
 * 这样界面语义与后端协议解耦，翻转点只有一处。
 */
const shownFields = ref<string[]>([])
const submitting = ref(false)

/* ── 区域 ↔ 字段联动 ── */

/** 某区域下的字段（带显示名/金额标记/跨区标记） */
function fieldsOfSection(sectionKey: string) {
  return catalogue.value ? sectionFields(catalogue.value, sectionKey) : []
}

/** 该字段当前是否视为「已显示」：强制显示字段恒为 true */
function isFieldShown(key: string): boolean {
  if (shownFields.value.includes(key)) return true
  return catalogue.value ? isAlwaysShown(catalogue.value, key) : false
}

/** 该区域是否已「全选 = 全部显示」 */
function sectionFully(sectionKey: string): boolean {
  const fields = fieldsOfSection(sectionKey)
  if (!fields.length) return false
  return fields.every((f) => isFieldShown(f.key))
}

/** 区域是否半选（部分字段被取消勾选） */
function sectionPartial(sectionKey: string): boolean {
  const fields = fieldsOfSection(sectionKey)
  if (!fields.length) return false
  const hit = fields.filter((f) => isFieldShown(f.key)).length
  return hit > 0 && hit < fields.length
}

/** 区域已显示计数文案，如 8/11 */
function sectionCount(sectionKey: string): string {
  const fields = fieldsOfSection(sectionKey)
  if (!fields.length) return ''
  const hit = fields.filter((f) => isFieldShown(f.key)).length
  return `${hit}/${fields.length}`
}

/** 点击区域勾选框：显示/取消该区域全部字段（强制显示字段不受影响） */
function toggleSectionFields_(sectionKey: string, checked: boolean) {
  if (!catalogue.value || props.disabled || submitting.value) return
  const fields = fieldsOfSection(sectionKey)
  const set = new Set(shownFields.value)
  for (const field of fields) {
    // alwaysShow 字段恒显示，不允许通过区域全选被取消
    if (field.alwaysShow) continue
    if (checked) set.add(field.key)
    else set.delete(field.key)
  }
  shownFields.value = [...set]
}

/** 区域勾选框：全选 / 取消该区域全部字段（合计行区域已移除，无「整区型」分支） */
function onRegionCheck(section: { key: string }, checked: boolean) {
  toggleSectionFields_(section.key, checked)
}

/** 字段是否跨多个区域 */
function isCross(fieldKey: string): boolean {
  return catalogue.value ? isCrossSectionField(catalogue.value, fieldKey) : false
}

/** 跨区字段所在的其它区域中文名 */
function crossNames(fieldKey: string): string {
  if (!catalogue.value) return ''
  const keys = sectionsContaining(catalogue.value, fieldKey)
  return keys
    .map((k) => catalogue.value?.sections.find((s) => s.key === k)?.label ?? k)
    .join(' / ')
}

/* ── 派生：隐藏视角（仅用于摘要文案与请求参数） ── */

/** 当前「要隐藏」的字段 = 全部字段 − 已勾选显示 */
const hideFields = computed<string[]>(() => {
  const cat = catalogue.value
  if (!cat) return []
  const hidden = shownToHidden(cat, shownFields.value)
  // 双保险：强制显示字段绝不能进入 hide_fields
  return hidden.filter((key) => !isAlwaysShown(cat, key))
})

/**
 * 区域级隐藏。
 * 合计行（totals）区域已按业务要求从目录中移除，因此当前不再产生任何
 * hide_sections 值；保留该 computed 是为了让请求参数形状与后端契约保持一致
 * （hide_sections 始终为空数组，等价于不传）。
 */
const hideSections = computed<string[]>(() => [])

function resetState() {
  const cat = catalogue.value
  // 优先使用已读取的公司方案；独立使用时沿用该单据的内置默认。
  shownFields.value = props.initialShownFields ? [...props.initialShownFields] : cat ? defaultShownFields(cat) : []
  submitting.value = false
}

/* ── 左侧实时预览 ── */
/*
 * ⚠️ 声明顺序很重要：下面的 watch(..., { immediate: true }) 会**立即执行**，
 * 而它会调用 teardownPreview → previewController。若把该 watch 放在
 * `let previewController` 之前，就会命中暂时性死区（TDZ）：
 *   Cannot access 'previewController' before initialization
 * 因此所有预览状态与函数必须写在 watch 之前。
 */

/**
 * 左预览：浏览器内置 PDF 阅读器（iframe 双缓冲）。
 *
 * 说明：pdfjs 自绘方案曾用于实现「更新后保持缩放/位置」，但引入后预览无法渲染
 * （6.x 的 rendererSrc 等 API 差异），已回退到 iframe。
 * 代价是内置阅读器的缩放/滚动无法被宿主页面读取，实时更新后会回到初始视图。
 */
const preview = ref<PdfPreviewState>({ url: '', loading: false, error: '' })
const previewDataUrl = ref('')

/** 当前显示中图层的参数指纹，用于判断预览是否与勾选一致 */
const renderedKey = ref('')

/**
 * 双缓冲图层：两层 iframe 交替。
 * - visible=true 的层是正在显示的旧图，全程不卸载；
 * - 新图写入空闲层，等 load + 渲染缓冲后才切换 opacity —— 消除白闪。
 */
interface PreviewLayer {
  src: string
  visible: boolean
  key: string
  loaded: boolean
  /** 唯一标识，作为 iframe 的 key 强制重建元素，避免缩放被继承 */
  token: number
}
let layerTokenSeq = 0
const previewLayers = ref<PreviewLayer[]>([
  { src: '', visible: false, key: '', loaded: false, token: 0 },
  { src: '', visible: false, key: '', loaded: false, token: 0 },
])
let activeLayerIndex = 0

const hasAnyLayer = computed(() => previewLayers.value.some((l) => l.src))
const visibleLayer = computed(() => previewLayers.value.find((l) => l.visible) ?? null)

/** 当前显示中的图是否与勾选一致 */
const previewInSync = computed(() => {
  const layer = visibleLayer.value
  if (!layer || !layer.src) return false
  return layer.loaded && layer.key === currentParamsKey()
})

/** 有可见旧图但参数已过期 → 正在后台重渲 */
const previewStale = computed(() => hasAnyLayer.value && !previewInSync.value)

/** 预览忙：请求中或新图未就绪，用于角落提示 */
const previewBusy = computed(() => preview.value.loading || previewStale.value)

/**
 * 给 PDF URL 追加阅读器视图参数。
 *
 * ⚠️ 这里必须只用 `view=FitH`（适配宽度），不能同时传 `zoom=100`：
 * 两者互斥，`zoom` 会覆盖适配模式，让页面按 A4 原始尺寸（96dpi 下约 794px）
 * 渲染，容器宽度不够时浏览器又自动缩一次来塞进去 —— 每次重载都重新算一遍，
 * 视觉上就是「越更新越小」。
 *
 * FitH 的语义是「让页面宽度正好铺满容器」，是个稳定的确定性状态：
 * 无论重载多少次，同样容器宽度就得到同样的显示尺寸。
 */
function iframeSrc(url: string): string {
  if (!url) return url
  const base = url.split('#')[0]
  return `${base}#view=FitH`
}

/** 当前勾选状态的稳定指纹（排序后拼接，避免顺序差异） */
function currentParamsKey(): string {
  const fields = [...hideFields.value].sort().join(',')
  const sections = [...hideSections.value].sort().join(',')
  return `${props.kind}|${props.billId}|${fields}|${sections}`
}

/** 最近一次已发出的请求指纹 */
let requestedKey = ''

/** 预览控制器：防抖 + 竞态保护 + object URL 回收 */
let previewController: ReturnType<typeof createPdfPreviewController> | null = null

function hasPreview(): boolean {
  return typeof props.previewFetcher === 'function' && !!props.billId
}

function currentPreviewRequest(): PdfPreviewRequest | null {
  if (!hasPreview()) return null
  const snap = buildPdfExportSnapshot({
    kind: props.kind,
    billId: props.billId,
    billNo: props.billNo,
    hideFields: hideFields.value,
    hideSections: hideSections.value,
  })
  return snapshotToPreviewRequest(snap)
}

function refreshPreview(immediate = false) {
  const req = currentPreviewRequest()
  if (!req || !previewController) return
  requestedKey = currentParamsKey()
  previewController.request(req, immediate)
}

function retryPreview() {
  const req = currentPreviewRequest()
  if (!req || !previewController) return
  previewController.retry(req)
}

/**
 * 图层切换定时器：iframe @load 只代表文档下载完，内置阅读器仍在异步绘制，
 * 需再等一段渲染缓冲才切层，否则会露白。
 * 声明必须早于 teardownPreview（关闭时要清掉）。
 */
const PREVIEW_RENDER_SETTLE_MS = 260
let layerSwitchTimer: ReturnType<typeof setTimeout> | null = null
let previewUrlToken = 0

function teardownPreview() {
  previewUrlToken++
  if (layerSwitchTimer) {
    clearTimeout(layerSwitchTimer)
    layerSwitchTimer = null
  }
  previewController?.dispose()
  previewController = null
  preview.value = { url: '', loading: false, error: '' }
  previewDataUrl.value = ''
  renderedKey.value = ''
  requestedKey = ''
  previewLayers.value = previewLayers.value.map(() => ({ src: '', visible: false, key: '', loaded: false, token: 0 }))
  activeLayerIndex = 0
}

function setupPreview() {
  teardownPreview()
  if (!hasPreview() || !props.previewFetcher) return
  previewController = createPdfPreviewController({
    fetchPdf: props.previewFetcher,
    onChange: (state) => {
      preview.value = state
      if (!state.url) {
        previewDataUrl.value = ''
        return
      }
      const keyAtRender = requestedKey
      void convertPreviewUrl(state.url).then((dataUrl) => {
        if (!dataUrl) return
        pushPreviewLayer(dataUrl, keyAtRender)
      })
    },
  })
  refreshPreview(true)
}

/** 把新图写入空闲层（不可见），等它准备好再切层 */
function pushPreviewLayer(src: string, key: string) {
  const layers = previewLayers.value
  const visibleIdx = layers.findIndex((l) => l.visible)
  const idleIdx = layers.findIndex((_, i) => i !== visibleIdx)
  const target = idleIdx >= 0 ? idleIdx : (visibleIdx === 0 ? 1 : 0)

  // 换新 token → iframe 重建，阅读器缩放从 100% 重新开始
  layerTokenSeq += 1
  layers[target] = { src, visible: false, key, loaded: false, token: layerTokenSeq }
  previewLayers.value = [...layers]
  activeLayerIndex = target
}

/** iframe 载入完成 → 等渲染缓冲 → 切层 */
function onLayerLoaded(index: number) {
  const layer = previewLayers.value[index]
  if (!layer || !layer.src) return
  layer.loaded = true
  // 只有最新写入的层载入完成才允许切换，防止慢的旧层抢显示
  if (index !== activeLayerIndex) return

  if (layerSwitchTimer) clearTimeout(layerSwitchTimer)
  const pendingKey = layer.key
  layerSwitchTimer = setTimeout(() => {
    layerSwitchTimer = null
    // 等待期间用户可能又改了勾选：此时该层已不是最新，放弃切换
    if (index !== activeLayerIndex) return
    const current = previewLayers.value[index]
    if (!current || !current.src || current.key !== pendingKey) return
    previewLayers.value = previewLayers.value.map((l, i) => ({ ...l, visible: i === index }))
    renderedKey.value = pendingKey
  }, PREVIEW_RENDER_SETTLE_MS)
}

/**
 * object URL → data URL。
 * 带令牌：防止「先发的慢转换覆盖后发的快转换」。
 */
async function convertPreviewUrl(url: string): Promise<string> {
  previewUrlToken += 1
  const token = previewUrlToken
  try {
    const res = await fetchWithSafeErrors(url)
    const blob = await res.blob()
    const dataUrl = await blobToPdfDataUrl(blob)
    if (token !== previewUrlToken) return ''
    return dataUrl
  } catch {
    if (token !== previewUrlToken) return ''
    return url
  }
}

/** 勾选变化 → 触发预览刷新（内部自带防抖） */
watch(
  () => [hideFields.value.join(','), hideSections.value.join(',')],
  () => {
    if (!props.modelValue) return
    refreshPreview()
  },
)

onBeforeUnmount(teardownPreview)
onDeactivated(teardownPreview)
let skipFirstActivate = true
onActivated(() => {
  if (skipFirstActivate) { skipFirstActivate = false; return }
  if (props.modelValue) setupPreview()
})

/**
 * 勾选单个字段。
 *
 * 注意：勾满全部金额字段不会触发任何额外确认流程。
 * 「一键全隐金额」开关与输入确认已按业务要求移除，
 * 金额是否隐藏完全由用户逐项勾选决定。
 */
function toggleField(key: string, checked: boolean) {
  if (props.disabled || submitting.value || isAlwaysShown(catalogue.value, key)) return
  const set = new Set(shownFields.value)
  if (checked) set.add(key)
  else set.delete(key)
  shownFields.value = [...set]
}

function resetAll() {
  // 恢复本次打开时的公司默认方案，不写回服务端。
  resetState()
}

/*
 * 打开弹窗时初始化：恢复默认勾选（生成时间/页码）并启动首屏预览。
 * immediate 会立刻执行，所以必须放在这一行之前所有依赖（catalogue/resetState/preview 系列）都已声明之后。
 */
let lastOpenKey = ''
watch(
  () => [props.modelValue, props.kind, props.billId] as const,
  ([open, kind, billId]) => {
    if (!open) {
      teardownPreview()
      lastOpenKey = ''
      return
    }
    const key = props.configurationMode ? kind : `${kind}::${billId}`
    // 同一单据重复打开不重置用户选择，只在「换单/首次打开」时初始化
    if (key !== lastOpenKey) {
      lastOpenKey = key
      resetState()
    }
    setupPreview()
  },
  { immediate: true },
)

/** 由父组件在下载完成/失败后调用，复位 loading */
function finish() {
  submitting.value = false
}

function startSubmitting() {
  submitting.value = true
}

watch(() => props.initialShownFields, () => {
  if (props.modelValue) { resetState(); refreshPreview() }
})
watch(shownFields, fields => emit('change', [...fields]))

defineExpose({ finish, startSubmitting, resetAll, getShownFields: () => [...shownFields.value] })
</script>

<style scoped>
/* 左右两栏：预览占 54%，勾选区自适应；窗口加宽后 PDF 页面渲染得更清楚 */
.pdf-layout {
  display: grid;
  grid-template-columns: minmax(560px, 54%) 1fr;
  gap: 16px;
  /* stretch：让两列同高（预览区跟随右侧勾选区的实际高度） */
  align-items: stretch;
  /* 预览需要看整页，高度上限放宽到 84vh */
  max-height: 84vh;
}
.pdf-options {
  min-width: 0;
  display: flex;
  flex-direction: column;
  /* 右栏内容可滚动，高度参与 grid 拉伸计算 */
  overflow-y: auto;
  max-height: 84vh;
}

/* 左侧预览：高度由 grid 拉伸，同时保底足够看整页 */
.pdf-preview {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-page);
  align-self: stretch;
  /* 保底高度随视口自适应：小屏不至于撑爆弹窗，大屏尽量看整页 */
  min-height: min(640px, 66vh);
}
.pdf-preview__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-white);
}
.pdf-preview__title { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.pdf-preview__hint { font-size: 12px; color: var(--text-tertiary); }
.pdf-preview__hint.is-error { color: var(--el-color-danger); }
.pdf-preview__stage {
  /* 撑满 head/foot 之外的剩余高度；保底高度也随视口自适应 */
  flex: 1 1 auto;
  min-height: min(540px, 56vh);
  background: color-mix(in srgb, var(--text-tertiary) 12%, var(--bg-page));
  position: relative;
  overflow: hidden;
}

/* 双缓冲图层：两层绝对定位叠放，用透明度交叉淡入，避免切换白闪 */
.pdf-preview__layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity .22s ease-out;
  /* 不可见层也要白底，否则新 iframe 绘制期间会透出灰色 stage */
  background: var(--bg-white);
}
.pdf-preview__layer.is-visible {
  opacity: 1;
  pointer-events: auto;
  z-index: 1;
}
.pdf-preview__frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  background: var(--bg-white);
  /* 预留滚动条槽位：避免 PDF 页数变化时滚动条出现/消失导致
     iframe 宽度抖动，进而让 FitH 每次按不同宽度重新适配 */
  scrollbar-gutter: stable;
}

/* 渲染中指示：角落小胶囊，不遮挡旧图 */
.pdf-preview__skeleton {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-primary) 78%, transparent);
  color: var(--bg-white);
  font-size: 12px;
  line-height: 1;
  box-shadow: var(--shadow-sm);
  animation: skFadeIn .16s ease-out;
  pointer-events: none;
}
@keyframes skFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 小圆点脉冲，替代原骨架条 */
.sk-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  animation: skPulse 1s ease-in-out infinite;
}
.sk-dot:nth-child(2) { animation-delay: .15s; }
.sk-dot:nth-child(3) { animation-delay: .3s; }
@keyframes skPulse {
  0%, 100% { opacity: .35; transform: scale(.85); }
  50% { opacity: 1; transform: scale(1); }
}

.sk-label { letter-spacing: .3px; }

.pdf-preview__empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-tertiary);
}
.pdf-preview__empty .el-icon { font-size: 22px; }
.pdf-preview__foot {
  margin: 0;
  padding: 8px 12px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-white);
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.5;
}

/* 区域分组：区域是「标题栏」形态（实心底色 + 色条 + 文字按钮），字段是「勾选项」形态。
   两者视觉语言刻意不同，避免用户把区域当成普通字段去勾。 */
.region-list {
  /* 区域列表不再自带高度上限：滚动交给父级 .pdf-options，
     否则右栏总高 = 若干段 max-height 之和，左侧无法与之等高 */
  flex: 1 1 auto;
  min-height: 0;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.region {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-white);
  transition: border-color .15s;
  /* 关键：禁止 flex 收缩，否则 max-height 会把它压成只剩标题条 */
  flex: 0 0 auto;
}
.region.is-on { border-color: var(--el-color-warning); }
.region.is-partial { border-color: color-mix(in srgb, var(--el-color-warning) 55%, var(--border-color)); }

/* 区域头：实心底色带，与下方白底字段区形成明确分区 */
.region .region__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-page);
  border-bottom: 1px solid var(--border-light);
}
.region.is-on .region__head { background: color-mix(in srgb, var(--el-color-warning) 12%, var(--bg-page)); }
.region.is-partial .region__head { background: color-mix(in srgb, var(--el-color-warning) 6%, var(--bg-page)); }

/* 左侧色条：区域的视觉锚点 */
.region__bar {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--primary);
  flex-shrink: 0;
}
.region.is-on .region__bar { background: var(--el-color-warning); }

.region__title {
  /* 区域标题比字段再大一号，保持层级（字段 15px → 区域 17px） */
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: .2px;
}
.region__tag { transform: scale(.82); flex-shrink: 0; }
.region__count {
  font-size: 14px;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* 区域勾选框：比字段勾选框更大、更靠外，配合加粗标题形成「区域级」层级 */
/* 区域勾选框：只通过 Element Plus 官方 CSS 变量放大尺寸，
   不手动改 left/top —— 那会与 EP 自己的 translate(-45%,-60%) 叠加，把勾号推出框外。 */
.region__check {
  --el-checkbox-input-width: 18px;
  --el-checkbox-input-height: 18px;
  --el-checkbox-border-radius: 4px;
  --el-checkbox-checked-bg-color: var(--primary);
  --el-checkbox-checked-input-border-color: var(--primary);
  --el-checkbox-input-border-color-hover: var(--primary);
  margin-right: 0;
  flex-shrink: 0;
}
/* 勾号按 18px 方框等比放大；居中仍由 EP 的百分比 transform 负责 */
.region__check :deep(.el-checkbox__inner) { border-width: 1px; }
.region__check :deep(.el-checkbox__inner::after) {
  width: 4px;
  height: 9px;
}
/* 半选横杠：EP 固定 top:5px 是按 14px 方框算的，18px 需下移到垂直居中位置 */
.region__check :deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner::before) {
  top: 8px;
}
.region__check :deep(.el-checkbox__label) {
  /* 区域标题 17px：比字段（15px）大一级 */
  font-size: 17px;
  padding-left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* 区域级操作：文字按钮（不是勾选框），推到最右 */
.region__toggle {
  margin-left: auto;
  padding: 0;
  border: none;
  background: none;
  font-size: 12px;
  color: var(--primary);
  cursor: pointer;
  white-space: nowrap;
  transition: color .15s, opacity .15s;
}
.region__toggle:hover:not(:disabled) { text-decoration: underline; }
.region__toggle:disabled { cursor: not-allowed; opacity: .5; }
.region__toggle.is-active { color: var(--el-color-warning); font-weight: 600; }

/* 字段区：白底，左侧一条与区域色条同色的引导线，明确「隶属本区域」 */
.region__fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 4px 16px;
  padding: 10px 12px 12px 16px;
  margin-left: 12px;
  border-left: 2px solid var(--border-light);
  background: var(--bg-white);
  flex: 0 0 auto;
}
.region.is-on .region__fields { border-left-color: color-mix(in srgb, var(--el-color-warning) 45%, transparent); }
.region__fields :deep(.el-checkbox) {
  margin-right: 0;
  height: auto;
  min-height: 30px;
  align-items: center;
}
/* 字段文字 15px；勾选框用 Element Plus 默认 14px，不再手动放大 */
.region__fields :deep(.el-checkbox__label) { font-size: 15px; line-height: 1.35; }
/* 金额字段不再标红：与普通字段同样颜色，避免视觉噪音 */
.field-label { color: var(--text-primary); }

/* 强制显示字段：无勾选框，仅文字 + 「固定」标记，左侧用小圆点占位对齐网格 */
.field-fixed {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  font-size: 15px;
  line-height: 1.35;
}
.field-fixed::before {
  content: '';
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  /* 与勾选框占位等宽，保证文字列对齐 */
  margin-right: 8px;
}
.field-fixed__tag { transform: scale(.85); }
.field-cross-tag { margin-left: 6px; transform: scale(.85); cursor: help; }
.field-tip { margin-left: 4px; font-size: 15px; color: var(--text-tertiary); cursor: help; }

.pdf-editor { min-width: 0; }
@media (max-width: 1100px) {
  .pdf-layout { grid-template-columns: 1fr; max-height: none; }
  .pdf-preview { min-height: 480px; }
  .pdf-options { max-height: none; }
}
</style>
