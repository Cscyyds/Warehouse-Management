## 业务列表模板
<template>
  <div class="list-template">
    <div v-if="showTree && treeVisible && !treePaneCollapsed" class="tree-pane" :style="{ width: treePaneWidth + 'px' }">
      <TreePanel
        ref="treePanelRef"
        :title="treeTitle"
        :data="treeData"
        :node-key="treeNodeKey"
        :label-key="treeLabelKey"
        :children-key="treeChildrenKey"
        @node-click="handleTreeNodeClick"
        @refresh="$emit('treeRefresh')"
      >
        <template #footer>
          <button class="tree-collapse-text-btn" @click="toggleTreePane">
            <el-icon><DArrowLeft /></el-icon>
            <span>收起</span>
          </button>
        </template>
      </TreePanel>
      <div class="tree-resize-handle" @mousedown.prevent="startResize" />
    </div>
    <!-- 树面板折叠后浮动展开按钮（无树权限时一并隐藏） -->
    <button v-if="showTree && treeVisible && treePaneCollapsed" class="tree-collapse-float" @click="toggleTreePane">
      <el-icon><DArrowRight /></el-icon>
      <span>展开</span>
    </button>
    <div class="list-content-panel" ref="contentPanelRef">
      <div class="panel-header">
        <h3>{{ title }}</h3>
      </div>
      <div class="toolbar-row">
        <div class="toolbar-actions">
          <el-button @click="toggleFilter">
            <el-icon><Filter /></el-icon>筛选
          </el-button>
          <el-button v-if="showExport" @click="handleExport">
            <el-icon><Download /></el-icon>导出
          </el-button>
          <el-button v-if="showImport" v-perm="permEndpoints?.import" @click="importDialogVisible = true">
            <el-icon><Upload /></el-icon>导入
          </el-button>
          <slot name="actions">
            <el-button v-if="showAdd" v-perm="permEndpoints?.add" type="primary" @click="$emit('add')">
              <el-icon><Plus /></el-icon>新增
            </el-button>
          </slot>
        </div>
      </div>
      <div v-if="filterVisible" class="filter-row">
        <slot name="search" />
      </div>
      <template v-if="columns && columns.length > 0">
        <el-table
          :key="tableRenderKey"
          ref="tableRef"
          :data="pagedTableData"
          :row-key="rowKey"
          :stripe="stripe"
          border
          table-layout="auto"
          :size="tableSize"
          style="width:100%"
          row-class-name="table-row"
          v-loading="loading"
          @sort-change="onSortChange"
          @header-dragend="handleHeaderDragend"
        >
          <el-table-column v-if="showSelection" type="selection" width="40" class-name="non-draggable-column" />
          <el-table-column v-if="showIndex" type="index" label="" width="55" align="center" :index="indexMethod" class-name="non-draggable-column" />
          <el-table-column
            v-for="col in displayColumns"
            :key="col.prop"
            :prop="col.prop"
            :column-key="col.sortKey || col.prop"
            :label="col.label"
            :width="col.resolvedWidth"
            :min-width="col.resolvedMinWidth"
            :align="col.align || 'left'"
            :show-overflow-tooltip="col.showOverflowTooltip !== false"
            :sortable="col.sortable ? 'custom' : false"
            class-name="draggable-business-column"
            :label-class-name="getColumnHeaderClasses(col.prop, 'normal')"
          >
            <template v-if="$slots[`col-${col.prop}`]" #default="scope">
              <slot :name="`col-${col.prop}`" v-bind="scope" />
            </template>
            <template v-else #default="scope">
              <span class="table-cell-text" :class="{ 'cell-empty': isEmptyCell(scope.row[col.prop]) }">
                {{ formatCellValue(col.prop, scope.row[col.prop]) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column v-if="$slots['col-actions']" label="操作" :width="actionsWidth" fixed="right" align="center" class-name="non-draggable-column">
            <template #default="scope">
              <slot name="col-actions" v-bind="scope" />
            </template>
          </el-table-column>
        </el-table>
      </template>
      <div v-else v-loading="loading">
        <SlotTableRenderer />
      </div>
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="currentPageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="$emit('pageChange')"
      />
    </div>

    <!-- 导入 Dialog -->
    <el-dialog v-model="importDialogVisible" title="导入数据" width="800px" :close-on-click-modal="false" @close="resetImport">
      <div class="import-actions">
        <el-button @click="handleDownloadTemplate">
          <el-icon><Download /></el-icon>下载模板
        </el-button>
        <el-upload
          ref="uploadRef"
          :auto-upload="false"
          :show-file-list="false"
          accept=".xlsx,.xls"
          :on-change="handleFileChange"
        >
          <el-button type="primary">
            <el-icon><Upload /></el-icon>选择文件
          </el-button>
        </el-upload>
        <span v-if="importFileName" class="import-filename">{{ importFileName }}</span>
      </div>
      <div v-if="importPreviewData.length > 0" class="import-preview">
        <div class="import-preview-header">
          <span>预览数据（共 {{ importPreviewData.length }} 条）</span>
        </div>
        <el-table :data="importPreviewData" border size="small" max-height="360" style="width:100%">
          <el-table-column
            v-for="col in importColumns"
            :key="col.key"
            :prop="col.key"
            :label="col.label"
            min-width="120"
            show-overflow-tooltip
          />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="importPreviewData.length === 0" @click="handleImportConfirm">
          确认导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Fragment, cloneVNode, computed, defineComponent, isVNode, nextTick, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'
import type { VNode } from 'vue'
import { Plus, Filter, Download, Upload, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import Sortable from 'sortablejs'
import TreePanel from './TreePanel.vue'
import { formatTableDate, isTableDateField } from '@/utils/date'
import { global_opt_width } from '@/utils/data'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { usePermissionStore } from '@/stores/permission'

const { isTabletDown, isCompact } = useBreakpoint()

interface ImportColumn {
  key: string
  label: string
}

export interface Column {
  prop: string
  label: string
  sortKey?: string
  width?: string | number
  minWidth?: string | number
  align?: 'left' | 'center' | 'right'
  showOverflowTooltip?: boolean
  sortable?: boolean
  /**
   * 列显示优先级：
   * - 'high'   始终显示（如编号、名称、操作）
   * - 'normal' 默认（大部分业务字段）
   * - 'low'    紧凑屏（容器 < 800px）自动隐藏（如备注、更新时间等辅助列）
   * 未设置时按 'normal' 处理。
   */
  priority?: 'high' | 'normal' | 'low'
}

interface ResolvedColumn extends Column {
  resolvedWidth?: string | number
  resolvedMinWidth?: string | number
}

interface Props {
  title: string
  layoutKey?: string
  showTree?: boolean
  treeTitle?: string
  /** 左树数据源接口端点（v-perm 同款格式）；无权限时整个树面板隐藏（复合页面树与表格绑不同接口） */
  treePermEndpoint?: string
  treeData?: any[]
  treeNodeKey?: string
  treeLabelKey?: string
  treeChildrenKey?: string
  page: number
  pageSize: number
  total: number
  showAdd?: boolean
  showImport?: boolean
  showExport?: boolean
  /** 内置新增/导入按钮绑定的接口端点（v-perm）；导出为前端本地生成，不纳管 */
  permEndpoints?: { add?: string; import?: string }
  importColumns?: ImportColumn[]
  exportColumns?: ImportColumn[]
  exportData?: any[]
  exportFileName?: string
  // 内置表格模式
  columns?: Column[]
  tableData?: any[]
  paginationMode?: 'client' | 'server'
  rowKey?: string
  stripe?: boolean
  showSelection?: boolean
  showIndex?: boolean
  actionsWidth?: number
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showTree: false,
  showAdd: true,
  layoutKey: '',
  treeData: () => [],
  treeNodeKey: 'id',
  treeLabelKey: 'name',
  treeChildrenKey: 'children',
  showImport: false,
  showExport: false,
  importColumns: () => [],
  exportColumns: () => [],
  exportData: () => [],
  exportFileName: '导出数据',
  columns: undefined,
  tableData: () => [],
  paginationMode: 'client',
  rowKey: 'id',
  stripe: true,
  showSelection: false,
  showIndex: false,
  actionsWidth: global_opt_width,
  loading: false
})

const emit = defineEmits<{
  'update:page': [val: number]
  'update:pageSize': [val: number]
  pageChange: []
  add: []
  treeNodeClick: [data: any]
  treeRefresh: []
  import: [data: any[]]
  sortChange: [data: { prop: string; order: string | null }]
}>()

const slots = useSlots()
const SlotTableRenderer = defineComponent({
  name: 'ListTemplateSlotTableRenderer',
  setup: () => () => renderTableSlot()
})

const treePanelRef = ref()
const tableRef = ref()
const contentPanelRef = ref<HTMLElement>()
const permissionStore = usePermissionStore()
// 树面板可见性：未声明端点（树与表格同接口的页面）默认可见；声明了则按权限判定
const treeVisible = computed(() => !props.treePermEndpoint || permissionStore.hasUrlPerm(props.treePermEndpoint))
const filterVisible = ref(true)
const uploadRef = ref()
const importDialogVisible = ref(false)
const importPreviewData = ref<any[]>([])
const importFileName = ref('')

/* 内容面板宽度，用于按容器宽度自动隐藏低优先级列 */
const containerWidth = ref(1200)
let resizeObserver: ResizeObserver | null = null
let tableObserver: MutationObserver | null = null

function observeTableHeader() {
  if (!contentPanelRef.value || typeof MutationObserver === 'undefined') return

  tableObserver?.disconnect()
  tableObserver = new MutationObserver(() => {
    initDragSort()
  })
  tableObserver.observe(contentPanelRef.value, { childList: true, subtree: true })
}

function storageKey(suffix: string) {
  const uid = localStorage.getItem('operator_id') || 'guest'
  return `wms_layout_${uid}_${props.layoutKey || props.title}_${suffix}`
}

const TREE_MIN = 160
const TREE_MAX = 520
const TREE_DEFAULT = 160

const treePaneWidth = ref(TREE_DEFAULT)
const treePaneCollapsed = ref(false)

function toggleTreePane() {
  treePaneCollapsed.value = !treePaneCollapsed.value
  if (props.layoutKey || props.title) {
    localStorage.setItem(storageKey('tree_collapsed'), treePaneCollapsed.value ? '1' : '0')
  }
}

function loadLayout() {
  if (!props.showTree) return
  const saved = localStorage.getItem(storageKey('tree_width'))
  if (saved) {
    const n = parseInt(saved, 10)
    if (n >= TREE_MIN && n <= TREE_MAX) treePaneWidth.value = n
  }
  const savedCollapsed = localStorage.getItem(storageKey('tree_collapsed'))
  if (savedCollapsed === '1') {
    treePaneCollapsed.value = true
  } else if (savedCollapsed === null && isTabletDown.value) {
    // 用户从未手动折叠过，且当前是小屏 → 默认折叠树面板，腾出主内容空间
    treePaneCollapsed.value = true
  }
}

let resizing = false
let resizeStartX = 0
let resizeStartWidth = 0

function startResize(e: MouseEvent) {
  resizing = true
  resizeStartX = e.clientX
  resizeStartWidth = treePaneWidth.value
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onResizeMove(e: MouseEvent) {
  if (!resizing) return
  const delta = e.clientX - resizeStartX
  const next = Math.min(TREE_MAX, Math.max(TREE_MIN, resizeStartWidth + delta))
  treePaneWidth.value = next
}

function onResizeEnd() {
  if (!resizing) return
  resizing = false
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  if (props.layoutKey || props.title) {
    localStorage.setItem(storageKey('tree_width'), String(treePaneWidth.value))
  }
}

const draggableColumns = ref<Column[]>([])
const columnWidthMap = ref<Record<string, number>>({})
const tableRenderKey = ref(0)
const slotTableRenderKey = ref(0)
const slotColumnOrder = ref<string[]>([])
let sortableInstance: Sortable | null = null
let sortableHeaderRow: HTMLElement | null = null
let sortableRefreshToken = 0
let renderedSlotColumnProps: string[] = []
const headerClassToProp = new Map<string, string>()

type ColumnFixedGroup = 'left' | 'normal' | 'right'

const HEADER_PROP_CLASS_PREFIX = 'list-column-prop-'
const RESIZE_HOT_ZONE = 14
const ELEMENT_RESIZE_HOT_ZONE = 8
const synthesizedResizeEvents = new WeakSet<Event>()

const AUTO_COLUMN_MIN_WIDTH = 96
const MAX_AUTO_COLUMN_MIN_WIDTH = 320
const CELL_HORIZONTAL_PADDING = 32
const CONTENT_SAMPLE_LIMIT = 20

const displayColumns = computed<ResolvedColumn[]>(() => {
  /* 紧凑屏（容器 < 800px）隐藏低优先级列，腾出空间给核心字段 */
  const hideLowPriority = containerWidth.value < 800
  return draggableColumns.value
    .filter((col) => !(hideLowPriority && col.priority === 'low'))
    .map((col) => ({
      ...col,
      resolvedWidth: resolveColumnWidth(col),
      resolvedMinWidth: resolveColumnMinWidth(col, props.tableData)
    }))
})

/* 表格尺寸随屏幕切换：大屏 default（行高更舒展），紧凑屏 small */
const tableSize = computed<'default' | 'small'>(() => (isCompact.value ? 'small' : 'default'))

watch(() => props.columns, async (cols) => {
  draggableColumns.value = applySavedColumnOrder(cols ? [...cols] : [])
  if (cols?.length) await rebuildTableAndSortable()
})

function initDragSort() {
  let headerRow: Element | null = null

  if (tableRef.value?.$el) {
    headerRow = tableRef.value.$el.querySelector('.el-table__header-wrapper tr')
  }

  if (!headerRow && contentPanelRef.value) {
    headerRow = contentPanelRef.value.querySelector('.el-table__header-wrapper tr')
  }

  if (!headerRow || !headerRow.children.length) return
  if (sortableInstance && sortableHeaderRow === headerRow) return

  sortableInstance?.destroy()
  sortableHeaderRow?.removeEventListener('mousemove', expandColumnResizeHotZone, true)
  sortableInstance = null
  sortableHeaderRow = headerRow as HTMLElement
  sortableHeaderRow.addEventListener('mousemove', expandColumnResizeHotZone, true)

  sortableInstance = Sortable.create(headerRow as HTMLElement, {
    animation: 150,
    ghostClass: 'col-drag-ghost',
    draggable: 'th.draggable-business-column',
    handle: '.cell',
    delay: 0,
    forceFallback: true,
    fallbackOnBody: true,
    fallbackTolerance: 4,
    preventOnFilter: false,
    filter(event) {
      const target = event.target as HTMLElement | null
      const th = target?.closest('th')
      if (!th || !('clientX' in event)) return false
      return (event as MouseEvent).clientX >= th.getBoundingClientRect().right - RESIZE_HOT_ZONE
    },
    onMove({ dragged, related }) {
      const draggedGroup = getHeaderFixedGroup(dragged)
      const relatedGroup = getHeaderFixedGroup(related)
      return Boolean(draggedGroup && relatedGroup && draggedGroup === relatedGroup)
    },
    onEnd({ newDraggableIndex, oldDraggableIndex }) {
      if (
        oldDraggableIndex === undefined
        || newDraggableIndex === undefined
        || oldDraggableIndex === newDraggableIndex
      ) return

      if (props.columns?.length) {
        reorderVisibleColumns(readRenderedColumnProps())
        saveColumnsOrder()
      } else {
        reorderSlotColumns(readRenderedColumnProps())
        saveSlotColumnsOrder()
      }
      void rebuildTableAndSortable()
    }
  })
}

function reorderSlotColumns(order: string[]) {
  if (!isSamePropSet(order, renderedSlotColumnProps)) return
  slotColumnOrder.value = order
}

function reorderVisibleColumns(visibleProps: string[]) {
  const currentVisibleProps = displayColumns.value.map(col => col.prop)
  if (!isSamePropSet(visibleProps, currentVisibleProps)) return

  const visibleSet = new Set(currentVisibleProps)
  let visibleIndex = 0
  const columnsByProp = new Map(draggableColumns.value.map(col => [col.prop, col]))
  draggableColumns.value = draggableColumns.value.map((col) => {
    if (!visibleSet.has(col.prop)) return col
    return columnsByProp.get(visibleProps[visibleIndex++]) || col
  })
}

async function rebuildTableAndSortable() {
  const token = ++sortableRefreshToken
  sortableInstance?.destroy()
  sortableHeaderRow?.removeEventListener('mousemove', expandColumnResizeHotZone, true)
  sortableInstance = null
  sortableHeaderRow = null
  if (props.columns?.length) {
    tableRenderKey.value++
  } else {
    slotTableRenderKey.value++
  }

  await nextTick()
  if (token !== sortableRefreshToken) return

  tableRef.value?.doLayout?.()
  initDragSort()
}

function saveColumnsOrder() {
  const order = draggableColumns.value.map(c => c.prop)
  localStorage.setItem(storageKey('col_order'), JSON.stringify(order))
}

function saveSlotColumnsOrder() {
  localStorage.setItem(storageKey('col_order'), JSON.stringify(slotColumnOrder.value))
}

function renderTableSlot(): VNode[] {
  const nodes = slots.table?.() || []
  return nodes.map(enhanceSlotTableNode)
}

function enhanceSlotTableNode(node: VNode): VNode {
  if (!isVNode(node)) return node

  if (node.type === Fragment && Array.isArray(node.children)) {
    const clonedFragment = cloneVNode(node)
    clonedFragment.children = node.children.map(child => isVNode(child) ? enhanceSlotTableNode(child) : child)
    return clonedFragment
  }

  if (getVNodeComponentName(node) !== 'ElTable') return node

  const vnodeSlots = node.children as Record<string, unknown> | null
  const originalDefault = vnodeSlots?.default
  const clonedTable = cloneVNode(node, {
    key: `list-template-slot-table-${slotTableRenderKey.value}`,
    border: true,
    onHeaderDragend: handleHeaderDragend
  })

  if (typeof originalDefault === 'function') {
    clonedTable.children = {
      ...vnodeSlots,
      default: () => enhanceSlotColumnNodes((originalDefault as () => unknown[])())
    }
  }

  return clonedTable
}

function enhanceSlotColumnNodes(nodes: unknown[]): VNode[] {
  const flattened = flattenSlotNodes(nodes)
  const businessColumns = flattened.filter(isBusinessColumnVNode)
  const currentProps = businessColumns.map(node => String(node.props?.prop))
  const orderedProps = isSamePropSet(slotColumnOrder.value, currentProps)
    ? slotColumnOrder.value
    : currentProps
  const columnsByProp = new Map(businessColumns.map(node => [String(node.props?.prop), node]))
  const orderedColumns = orderedProps.map(prop => columnsByProp.get(prop)).filter(Boolean) as VNode[]
  let businessIndex = 0

  renderedSlotColumnProps = [...orderedProps]

  return flattened.map((node) => {
    const sourceNode = isBusinessColumnVNode(node) ? orderedColumns[businessIndex++] : node
    if (getVNodeComponentName(sourceNode) !== 'ElTableColumn') return sourceNode

    const prop = typeof sourceNode.props?.prop === 'string' ? sourceNode.props.prop : ''
    const fixedGroup = getVNodeFixedGroup(sourceNode)
    const className = [
      sourceNode.props?.className,
      prop ? 'draggable-business-column' : 'non-draggable-column'
    ].filter(Boolean).join(' ')
    const labelClassName = [
      sourceNode.props?.labelClassName,
      prop ? getColumnHeaderClasses(prop, fixedGroup) : ''
    ].filter(Boolean).join(' ')
    const savedWidth = prop ? columnWidthMap.value[prop] : undefined

    return cloneVNode(sourceNode, {
      className,
      labelClassName,
      ...(savedWidth !== undefined ? { width: savedWidth, minWidth: undefined } : {})
    })
  })
}

function flattenSlotNodes(nodes: unknown[]): VNode[] {
  return nodes.flatMap((node) => {
    if (!isVNode(node)) return []
    if (node.type === Fragment && Array.isArray(node.children)) return flattenSlotNodes(node.children)
    return [node]
  })
}

function isBusinessColumnVNode(node: VNode): boolean {
  return getVNodeComponentName(node) === 'ElTableColumn'
    && typeof node.props?.prop === 'string'
    && node.props.prop.length > 0
}

function getVNodeComponentName(node: VNode): string {
  if (typeof node.type === 'object' && node.type && 'name' in node.type) {
    return String(node.type.name || '')
  }
  return ''
}

function getVNodeFixedGroup(node: VNode): ColumnFixedGroup {
  if (node.props?.fixed === 'right') return 'right'
  if (node.props?.fixed === true || node.props?.fixed === '' || node.props?.fixed === 'left') return 'left'
  return 'normal'
}

function getColumnHeaderClasses(prop: string, group: ColumnFixedGroup): string {
  const propClass = `${HEADER_PROP_CLASS_PREFIX}${toSafeClassToken(prop)}`
  headerClassToProp.set(propClass, prop)
  return `${propClass} list-column-group-${group}`
}

function toSafeClassToken(value: string): string {
  return Array.from(value).map((char) => /[A-Za-z0-9_-]/.test(char)
    ? char
    : `_${char.codePointAt(0)?.toString(16) || '0'}_`).join('')
}

function readRenderedColumnProps(): string[] {
  if (!sortableHeaderRow) return []
  return Array.from(sortableHeaderRow.children)
    .filter(child => child.classList.contains('draggable-business-column'))
    .map(child => getHeaderProp(child))
    .filter((prop): prop is string => Boolean(prop))
}

function getHeaderProp(element: Element): string | undefined {
  const propClass = Array.from(element.classList).find(className => className.startsWith(HEADER_PROP_CLASS_PREFIX))
  return propClass ? headerClassToProp.get(propClass) : undefined
}

function getHeaderFixedGroup(element: HTMLElement): ColumnFixedGroup | undefined {
  if (element.classList.contains('list-column-group-left')) return 'left'
  if (element.classList.contains('list-column-group-right')) return 'right'
  if (element.classList.contains('list-column-group-normal')) return 'normal'
  return undefined
}

function expandColumnResizeHotZone(event: MouseEvent) {
  if (synthesizedResizeEvents.has(event)) return

  const target = event.target as HTMLElement | null
  const th = target?.closest('th') as HTMLElement | null
  if (!th) return

  const rect = th.getBoundingClientRect()
  const distanceToRight = rect.right - event.clientX
  if (distanceToRight < ELEMENT_RESIZE_HOT_ZONE || distanceToRight >= RESIZE_HOT_ZONE) return

  // Element Plus 将列宽命中范围写死为右侧 8px；把 8~14px 的移动映射到其原生热区，
  // 后续 mousedown/mouseup 仍完全使用 Element Plus 自己的 resize 与 header-dragend 流程。
  event.stopPropagation()
  const syntheticEvent = new MouseEvent('mousemove', {
    bubbles: true,
    clientX: rect.right - ELEMENT_RESIZE_HOT_ZONE + 1,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY
  })
  synthesizedResizeEvents.add(syntheticEvent)
  th.dispatchEvent(syntheticEvent)
}

function isSamePropSet(saved: string[], current: string[]): boolean {
  return saved.length === current.length && saved.every(prop => current.includes(prop))
}

function applySavedColumnOrder(columns: Column[]): Column[] {
  const savedJson = localStorage.getItem(storageKey('col_order'))
  if (!savedJson) return columns

  try {
    const savedOrder: string[] = JSON.parse(savedJson)
    if (!Array.isArray(savedOrder) || savedOrder.length !== columns.length) return columns

    const colMap = new Map(columns.map(col => [col.prop, col]))
    const reordered = savedOrder.map(prop => colMap.get(prop)).filter(Boolean) as Column[]
    return reordered.length === columns.length ? reordered : columns
  } catch {
    return columns
  }
}

function loadColumnWidths() {
  const savedJson = localStorage.getItem(storageKey('col_widths'))
  if (!savedJson) return

  try {
    const savedWidths = JSON.parse(savedJson) as Record<string, unknown>
    columnWidthMap.value = Object.fromEntries(
      Object.entries(savedWidths).filter(([, width]) => typeof width === 'number' && Number.isFinite(width) && width > 0)
    ) as Record<string, number>
  } catch {
    columnWidthMap.value = {}
  }
}

function loadSlotColumnOrder() {
  const savedJson = localStorage.getItem(storageKey('col_order'))
  if (!savedJson) return

  try {
    const savedOrder = JSON.parse(savedJson)
    slotColumnOrder.value = Array.isArray(savedOrder)
      ? savedOrder.filter(prop => typeof prop === 'string')
      : []
  } catch {
    slotColumnOrder.value = []
  }
}

function handleHeaderDragend(newWidth: number, _oldWidth: number, column: { property?: string }) {
  const prop = column.property
  const isKnownColumn = props.columns?.length
    ? draggableColumns.value.some(col => col.prop === prop)
    : renderedSlotColumnProps.includes(prop || '')
  if (!prop || !isKnownColumn) return

  columnWidthMap.value = { ...columnWidthMap.value, [prop]: newWidth }
  localStorage.setItem(storageKey('col_widths'), JSON.stringify(columnWidthMap.value))
  nextTick(() => tableRef.value?.doLayout?.())
}

onMounted(async () => {
  loadLayout()
  loadColumnWidths()
  loadSlotColumnOrder()
  draggableColumns.value = applySavedColumnOrder(props.columns ? [...props.columns] : [])
  observeTableHeader()
  await nextTick()
  initDragSort()

  /* 监听内容面板宽度，驱动低优先级列的显隐 */
  if (contentPanelRef.value && typeof ResizeObserver !== 'undefined') {
    containerWidth.value = contentPanelRef.value.clientWidth
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) containerWidth.value = entry.contentRect.width
    })
    resizeObserver.observe(contentPanelRef.value)
  }
})
onBeforeUnmount(() => {
  sortableRefreshToken++
  sortableInstance?.destroy()
  sortableHeaderRow?.removeEventListener('mousemove', expandColumnResizeHotZone, true)
  sortableHeaderRow = null
  tableObserver?.disconnect()
  resizeObserver?.disconnect()
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
})

function handleSizeChange() {
  currentPage.value = 1
  emit('pageChange')
}

function indexMethod(index: number) {
  return (props.page - 1) * props.pageSize + index + 1
}

function toggleFilter() {
  filterVisible.value = !filterVisible.value
}

function resetImport() {
  importPreviewData.value = []
  importFileName.value = ''
  uploadRef.value?.clearFiles()
}

function handleDownloadTemplate() {
  const headers = props.importColumns.map(c => c.label)
  const ws = XLSX.utils.aoa_to_sheet([headers])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${props.exportFileName}_模板.xlsx`)
}

function handleFileChange(file: any) {
  importFileName.value = file.name
  const reader = new FileReader()
  reader.onload = (e) => {
    const data = new Uint8Array(e.target!.result as ArrayBuffer)
    const wb = XLSX.read(data, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
    if (rows.length < 2) return
    const headerRow = rows[0] as string[]
    const keyMap: Record<string, string> = {}
    props.importColumns.forEach(col => { keyMap[col.label] = col.key })
    importPreviewData.value = rows.slice(1).map(row => {
      const obj: Record<string, any> = {}
      headerRow.forEach((h, i) => {
        const key = keyMap[h]
        if (key) obj[key] = row[i] ?? ''
      })
      return obj
    })
  }
  reader.readAsArrayBuffer(file.raw)
}

function handleImportConfirm() {
  emit('import', importPreviewData.value)
  importDialogVisible.value = false
  resetImport()
}

function handleExport() {
  const headers = props.exportColumns.map(c => c.label)
  const rows = props.exportData.map(row =>
    props.exportColumns.map(c => row[c.key] ?? '')
  )
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${props.exportFileName}.xlsx`)
}

const currentPage = computed({
  get: () => props.page,
  set: (val: number) => emit('update:page', val)
})

const currentPageSize = computed({
  get: () => props.pageSize,
  set: (val: number) => emit('update:pageSize', val)
})

const pagedTableData = computed(() => {
  if (!props.tableData) return []
  if (props.paginationMode === 'server') return props.tableData
  const start = (props.page - 1) * props.pageSize
  return props.tableData.slice(start, start + props.pageSize)
})

function handleTreeNodeClick(data: any) {
  emit('treeNodeClick', data)
}

function onSortChange({ prop, order }: { prop: string | null; order: string | null }) {
  emit('sortChange', { prop: prop || '', order })
}

function isEmptyCell(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

function formatCellValue(prop: string, value: unknown): string | number {
  if (isEmptyCell(value)) return '-'
  if (isTableDateField(prop)) return formatTableDate(value)
  return value as string | number
}

function resolveColumnMinWidth(col: Column, rows: any[]): string | number | undefined {
  if (columnWidthMap.value[col.prop] !== undefined) return undefined

  if (!isIdentifierColumn(col) && col.width !== undefined && col.width !== null && col.width !== '') {
    return undefined
  }

  const autoWidth = calcAutoColumnMinWidth(col.label, col.prop, rows)
  if (col.minWidth !== undefined && col.minWidth !== null && col.minWidth !== '') {
    return Math.max(normalizeWidthValue(col.minWidth), autoWidth)
  }
  if (isIdentifierColumn(col) && col.width !== undefined && col.width !== null && col.width !== '') {
    return Math.max(normalizeWidthValue(col.width), autoWidth)
  }
  return autoWidth
}

function calcAutoColumnMinWidth(label: string, prop: string, rows: any[]): number {
  const sampleRows = Array.isArray(rows) ? rows.slice(0, CONTENT_SAMPLE_LIMIT) : []
  const headerWidth = estimateTextWidth(label)
  const contentWidth = sampleRows.reduce((maxWidth, row) => {
    const displayValue = String(formatCellValue(prop, row?.[prop]))
    return Math.max(maxWidth, estimateTextWidth(displayValue))
  }, 0)
  const targetWidth = Math.max(headerWidth, contentWidth, AUTO_COLUMN_MIN_WIDTH - CELL_HORIZONTAL_PADDING)
  return Math.min(getColumnMaxWidth(label, prop), targetWidth + CELL_HORIZONTAL_PADDING)
}

function estimateTextWidth(text: string): number {
  return Array.from(text).reduce((total, char) => total + getCharacterWidth(char), 0)
}

function getCharacterWidth(char: string): number {
  if (/[\u3400-\u9FFF\uF900-\uFAFF]/.test(char)) return 14
  if (/[A-Z]/.test(char)) return 9
  if (/[a-z0-9]/.test(char)) return 8
  if (/\s/.test(char)) return 4
  return 7
}

function normalizeWidthValue(value: string | number): number {
  if (typeof value === 'number') return value
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : AUTO_COLUMN_MIN_WIDTH
}

function resolveColumnWidth(col: Column): string | number | undefined {
  const savedWidth = columnWidthMap.value[col.prop]
  if (savedWidth !== undefined) return savedWidth
  if (isIdentifierColumn(col)) return undefined
  return col.width
}

function isIdentifierColumn(col: Pick<Column, 'prop' | 'label'>): boolean {
  return isIdentifierField(col.prop, col.label)
}

function isIdentifierField(prop?: string, label?: string): boolean {
  const propValue = prop || ''
  const labelValue = label || ''
  return /(?:^|_)(id|code|no)$/i.test(propValue)
    || /(?:Id|Code|No)$/.test(propValue)
    || /(编码|编号|ID|Id|id)/.test(labelValue)
}

function getColumnMaxWidth(label: string, prop: string): number {
  return isIdentifierField(prop, label) ? 560 : MAX_AUTO_COLUMN_MIN_WIDTH
}

function setTreeCurrentKey(key: string | null) {
  treePanelRef.value?.setCurrentKey(key)
}

function expandTreeToKey(key: string | null) {
  treePanelRef.value?.expandToKey?.(key)
}

defineExpose({ setTreeCurrentKey, expandTreeToKey, treePanelRef })
</script>

<style scoped>
.list-template { height: 100%; background: var(--bg-page); border-radius: var(--radius-lg); display: flex; position: relative; }

/* 树面板 */
.tree-pane {
  position: relative;
  flex-shrink: 0;
  height: 100%;
}
.tree-pane :deep(.tree-panel) { width: 100% !important; height: 100%; }

/* 树面板底部的"收起"文字按钮 */
.tree-collapse-text-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.tree-collapse-text-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* 树面板折叠后的浮动展开按钮（图标 + 文本） */
.tree-collapse-float {
  position: absolute;
  bottom: 60px;
  left: 4px;
  height: 32px;
  min-width: 32px;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-white);
  box-shadow: var(--shadow-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  z-index: 100;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1;
  padding: 0 12px;
  white-space: nowrap;
  transition: background 0.15s, box-shadow 0.15s, color 0.15s, border-color 0.15s;
}
.tree-collapse-float:hover {
  background: var(--primary-bg);
  border-color: var(--primary);
  color: var(--primary);
  box-shadow: var(--shadow-md);
}
.tree-collapse-float .el-icon {
  font-size: 16px;
}

/* resize 句柄：贴在树面板右边缘 */
.tree-resize-handle {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  background: transparent;
  transition: background var(--transition-fast);
}
.tree-resize-handle:hover,
.tree-resize-handle:active {
  background: var(--primary);
  opacity: 0.5;
  border-radius: 3px;
}

.list-content-panel { flex: 1; min-width: 0; background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; padding: var(--space-panel); overflow-y: auto; overflow-x: hidden; margin-left: 12px; }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-gap); }
.panel-header h3 { font-size: var(--font-h3); font-weight: 700; color: var(--text-primary); }
.toolbar-row { display: flex; align-items: center; justify-content: flex-end; margin-bottom: var(--space-md); }
.toolbar-actions { display: flex; gap: 8px; align-items: center; }
.filter-row { margin-bottom: var(--space-md); }
.filter-row :deep(.el-form-item) { margin-bottom: 0; margin-right: 10px; }
.filter-row :deep(.el-form-item:last-child) { margin-right: 0; }
.filter-row :deep(.el-form-item__label) { font-size: var(--font-label); padding-right: 6px; }
.list-template :deep(.el-table td.el-table__cell),
.list-template :deep(.el-table th.el-table__cell) {
  font-size: var(--font-table);
  padding: var(--table-cell-py) var(--table-cell-px);
}
.list-template :deep(.el-table td.el-table__cell) { border-bottom: 1px solid var(--border-light); }
.list-template :deep(.el-table th.el-table__cell) { background: var(--bg-page); color: var(--text-primary); font-weight: 600; border-bottom: 1px solid var(--border-color); position: relative; user-select: none; white-space: nowrap; }
.list-template :deep(.el-table th.el-table__cell:not(:last-child)::after) { content: ''; position: absolute; right: 0; top: 20%; height: 60%; width: 2px; background: var(--border-color, #dcdfe6); border-radius: 1px; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
.list-template :deep(.el-table th.el-table__cell:not(:last-child):hover::after) { opacity: 1; }
.list-template :deep(.el-table__column-resize-proxy) { border-left: 2px dashed var(--el-color-primary, #409eff); }
.list-template :deep(.el-table th.el-table__cell .cell) { display: flex; width: 100%; align-items: center; gap: 4px; white-space: nowrap; }
.list-template :deep(.el-table th.el-table__cell.is-left .cell) { justify-content: flex-start; }
.list-template :deep(.el-table th.el-table__cell.is-center .cell) { justify-content: center; }
.list-template :deep(.el-table th.el-table__cell.is-right .cell) { justify-content: flex-end; }
.list-template :deep(.el-table th.el-table__cell .sort-caret) { display: block; }
.list-template :deep(.el-table th.el-table__cell .caret-wrapper),
.list-template :deep(.el-table th.el-table__cell .cell .el-icon) { flex-shrink: 0; }
.list-template :deep(.el-table td.el-table__cell .cell) { white-space: nowrap; }
/* 行 hover 用 EP 的表格 hover 变量而非 --bg-hover：暗色下 --bg-hover 是半透明白，
   操作列为 fixed="right" 的 sticky 单元格，hover 时会透出其覆盖的下层列文字；
   --el-table-row-hover-bg-color 在暗色下已被全局样式设为不透明纯色（index.scss）。 */
.list-template :deep(.el-table .table-row:hover > td.el-table__cell) { background-color: var(--el-table-row-hover-bg-color); }
.list-template :deep(.el-table__body tr.el-table__row--striped td.el-table__cell) { background: var(--bg-page); }
.list-template :deep(.el-pagination) { margin-top: var(--space-gap); justify-content: flex-end; }
.list-template :deep(.el-button--small) { font-size: var(--font-btn-sm); }
.table-cell-text { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
.cell-empty { color: var(--text-tertiary); }
.import-actions { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.import-filename { font-size: 13px; color: var(--text-secondary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.import-preview-header { font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
.list-template :deep(.el-table__header-wrapper th.draggable-business-column) { cursor: grab; }
.list-template :deep(.el-table__header-wrapper th.draggable-business-column:active) { cursor: grabbing; }
.list-template :deep(.col-drag-ghost) { opacity: 0.4; background: var(--el-color-primary-light-7, #c6e2ff) !important; }

/* ── 响应式：小屏筛选区换行、面板间距收紧 ── */
@media (max-width: 960px) {
  .list-content-panel { margin-left: 0; }
  .filter-row :deep(.el-form-item) {
    margin-right: 0;
    margin-bottom: 6px;
    width: 100%;
  }
  .filter-row :deep(.el-form-item .el-input),
  .filter-row :deep(.el-form-item .el-select),
  .filter-row :deep(.el-form-item .el-input__wrapper) {
    width: 100% !important;
  }
}

@media (max-width: 768px) {
  .panel-header { flex-direction: column; align-items: flex-start; gap: 6px; }
  .toolbar-row { justify-content: flex-start; }
}
</style>
