## 业务列表模板
<template>
  <div class="list-template">
    <div v-if="showTree && !treePaneCollapsed" class="tree-pane" :style="{ width: treePaneWidth + 'px' }">
      <TreePanel
        ref="treePanelRef"
        :title="treeTitle"
        :data="treeData"
        :node-key="treeNodeKey"
        :label-key="treeLabelKey"
        :children-key="treeChildrenKey"
        @node-click="handleTreeNodeClick"
        @refresh="$emit('treeRefresh')"
      />
      <div class="tree-resize-handle" @mousedown.prevent="startResize" />
    </div>
    <!-- 树面板折叠/展开悬浮按钮 -->
    <el-tooltip v-if="showTree" :content="treePaneCollapsed ? '展开树面板' : '收起树面板'" placement="right">
      <button
        class="tree-collapse-btn"
        :style="{ left: treePaneCollapsed ? '4px' : (treePaneWidth - 12) + 'px' }"
        @click="toggleTreePane"
      >
        <el-icon><DArrowLeft v-if="!treePaneCollapsed" /><DArrowRight v-else /></el-icon>
      </button>
    </el-tooltip>
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
          <el-button v-if="showImport" @click="importDialogVisible = true">
            <el-icon><Upload /></el-icon>导入
          </el-button>
          <slot name="actions">
            <el-button v-if="showAdd" type="primary" @click="$emit('add')">
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
          ref="tableRef"
          :data="pagedTableData"
          :row-key="rowKey"
          :stripe="stripe"
          border
          table-layout="auto"
          size="small"
          style="width:100%"
          row-class-name="table-row"
          v-loading="loading"
          @sort-change="onSortChange"
        >
          <el-table-column v-if="showSelection" type="selection" width="40" />
          <el-table-column v-if="showIndex" type="index" label="" width="55" align="center" :index="indexMethod" />
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
          <el-table-column v-if="$slots['col-actions']" label="操作" :width="actionsWidth" fixed="right" align="center">
            <template #default="scope">
              <slot name="col-actions" v-bind="scope" />
            </template>
          </el-table-column>
        </el-table>
      </template>
      <div v-else v-loading="loading">
        <slot name="table" />
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
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Plus, Filter, Download, Upload, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import Sortable from 'sortablejs'
import TreePanel from './TreePanel.vue'
import { formatTableDate, isTableDateField } from '@/utils/date'

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
  actionsWidth: 140,
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

const treePanelRef = ref()
const tableRef = ref()
const contentPanelRef = ref<HTMLElement>()
const filterVisible = ref(true)
const uploadRef = ref()
const importDialogVisible = ref(false)
const importPreviewData = ref<any[]>([])
const importFileName = ref('')

let tableObserver: MutationObserver | null = null

function observeTable() {
  if (!contentPanelRef.value) return
  tableObserver = new MutationObserver(() => {
    const headerRow = contentPanelRef.value?.querySelector('.el-table__header-wrapper tr')
    if (headerRow && headerRow.children.length && !sortableInstance) {
      initDragSort()
    }
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
  if (savedCollapsed === '1') treePaneCollapsed.value = true
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
let sortableInstance: Sortable | null = null

const AUTO_COLUMN_MIN_WIDTH = 96
const MAX_AUTO_COLUMN_MIN_WIDTH = 320
const CELL_HORIZONTAL_PADDING = 32
const CONTENT_SAMPLE_LIMIT = 20

const displayColumns = computed<ResolvedColumn[]>(() =>
  draggableColumns.value.map((col) => ({
    ...col,
    resolvedWidth: resolveColumnWidth(col),
    resolvedMinWidth: resolveColumnMinWidth(col, props.tableData)
  }))
)

watch(() => props.columns, async (cols) => {
  draggableColumns.value = cols ? [...cols] : []
  sortableInstance?.destroy()
  sortableInstance = null
  if (cols?.length) {
    await nextTick()
    setTimeout(initDragSort, 100)
  }
})

watch(() => props.tableData, async () => {
  await nextTick()
  setTimeout(() => {
    sortableInstance?.destroy()
    sortableInstance = null
    initDragSort()
  }, 100)
})

function initDragSort() {
  let headerRow: Element | null = null
  let tableEl: Element | null = null

  if (tableRef.value?.$el) {
    tableEl = tableRef.value.$el
    headerRow = tableEl!.querySelector('.el-table__header-wrapper tr')
  }

  if (!headerRow && contentPanelRef.value) {
    tableEl = contentPanelRef.value.querySelector('.el-table')
    headerRow = tableEl?.querySelector('.el-table__header-wrapper tr') || null
  }

  if (!headerRow || !headerRow.children.length || !tableEl) return

  const isSlotMode = !props.columns?.length
  const offset = (props.showSelection ? 1 : 0) + (props.showIndex ? 1 : 0)

  // 恢复上次保存的列顺序
  restoreColumnOrder(tableEl, headerRow, isSlotMode)

  sortableInstance = Sortable.create(headerRow as HTMLElement, {
    animation: 150,
    ghostClass: 'col-drag-ghost',
    delay: 80,
    onEnd({ newIndex, oldIndex }) {
      if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return

      if (isSlotMode) {
        const bodyWrapper = tableEl!.querySelector('.el-table__body-wrapper tbody')
        if (bodyWrapper) {
          const rows = bodyWrapper.querySelectorAll('tr')
          rows.forEach(row => {
            const cells = Array.from(row.children)
            if (oldIndex! < cells.length && newIndex! < cells.length) {
              const movedCell = cells[oldIndex!]
              if (newIndex! > oldIndex!) {
                row.insertBefore(movedCell, cells[newIndex!].nextSibling)
              } else {
                row.insertBefore(movedCell, cells[newIndex!])
              }
            }
          })
        }
        saveSlotColumnOrder(headerRow!)
      } else {
        const realOld = oldIndex - offset
        const realNew = newIndex - offset
        const len = draggableColumns.value.length
        if (realOld < 0 || realNew < 0 || realOld >= len || realNew >= len) return
        const moved = draggableColumns.value.splice(realOld, 1)[0]
        draggableColumns.value.splice(realNew, 0, moved)
        saveColumnsOrder()
      }
    }
  })
}

function saveColumnsOrder() {
  const order = draggableColumns.value.map(c => c.prop)
  localStorage.setItem(storageKey('col_order'), JSON.stringify(order))
}

function saveSlotColumnOrder(headerRow: Element) {
  const ths = Array.from(headerRow.children)
  const order = ths.map(th => {
    const cell = th.querySelector('.cell')
    return cell?.textContent?.trim() || ''
  })
  localStorage.setItem(storageKey('col_order'), JSON.stringify(order))
}

function restoreColumnOrder(tableEl: Element, headerRow: Element, isSlotMode: boolean) {
  const savedJson = localStorage.getItem(storageKey('col_order'))
  if (!savedJson) return

  try {
    const savedOrder: string[] = JSON.parse(savedJson)
    if (!Array.isArray(savedOrder) || !savedOrder.length) return

    if (isSlotMode) {
      const ths = Array.from(headerRow.children) as HTMLElement[]
      const currentLabels = ths.map(th => th.querySelector('.cell')?.textContent?.trim() || '')

      if (savedOrder.length !== currentLabels.length) return
      if (savedOrder.every((label, i) => label === currentLabels[i])) return

      const indexMap = savedOrder.map(label => currentLabels.indexOf(label))
      if (indexMap.includes(-1)) return

      // 重排表头
      indexMap.forEach(idx => headerRow.appendChild(ths[idx]))

      // 重排 body
      const bodyWrapper = tableEl.querySelector('.el-table__body-wrapper tbody')
      if (bodyWrapper) {
        const rows = bodyWrapper.querySelectorAll('tr')
        rows.forEach(row => {
          const cells = Array.from(row.children) as HTMLElement[]
          if (cells.length === indexMap.length) {
            indexMap.forEach(idx => row.appendChild(cells[idx]))
          }
        })
      }
    } else {
      const currentProps = draggableColumns.value.map(c => c.prop)
      if (savedOrder.length !== currentProps.length) return
      if (savedOrder.every((p, i) => p === currentProps[i])) return

      const colMap = new Map(draggableColumns.value.map(c => [c.prop, c]))
      const reordered = savedOrder.map(p => colMap.get(p)).filter(Boolean) as Column[]
      if (reordered.length === draggableColumns.value.length) {
        draggableColumns.value = reordered
      }
    }
  } catch {
    // 缓存损坏，忽略
  }
}

onMounted(async () => {
  loadLayout()
  draggableColumns.value = props.columns ? [...props.columns] : []
  await nextTick()
  setTimeout(initDragSort, 200)
  observeTable()
})
onBeforeUnmount(() => {
  sortableInstance?.destroy()
  tableObserver?.disconnect()
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
.list-template { height: 100%; padding: 0; background: var(--bg-page); border-radius: var(--radius-lg); display: flex; gap: 0; position: relative; }

/* 树面板 */
.tree-pane {
  position: relative;
  flex-shrink: 0;
  height: 100%;
}
.tree-pane :deep(.tree-panel) { width: 100% !important; height: 100%; }

/* 树面板折叠/展开悬浮按钮 */
.tree-collapse-btn {
  position: absolute;
  bottom: 20px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  background: var(--bg-white);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
  transition: left 0.22s ease, background 0.15s, box-shadow 0.15s;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 0;
}

.tree-collapse-btn:hover {
  background: var(--primary-bg);
  border-color: var(--primary);
  color: var(--primary);
  box-shadow: var(--shadow-md);
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

.list-content-panel { flex: 1; min-width: 0; background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; padding: 8px; overflow-y: auto; overflow-x: hidden; margin-left: 8px; }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.panel-header h3 { font-size: 20px; font-weight: 600; color: var(--text-primary); }
.toolbar-row { display: flex; align-items: center; justify-content: flex-end; margin-bottom: 6px; }
.toolbar-actions { display: flex; gap: 8px; align-items: center; }
.filter-row { margin-bottom: 6px; }
.filter-row :deep(.el-form-item) { margin-bottom: 0; margin-right: 10px; }
.filter-row :deep(.el-form-item:last-child) { margin-right: 0; }
.filter-row :deep(.el-form-item__label) { font-size: 16px; padding-right: 6px; }
.filter-slide-enter-active, .filter-slide-leave-active { transition: all 0.3s ease; overflow: hidden; }
.filter-slide-enter-from, .filter-slide-leave-to { opacity: 0; max-height: 0; margin-bottom: 0; }
.filter-slide-enter-to, .filter-slide-leave-from { opacity: 1; max-height: 200px; margin-bottom: 6px; }
.list-template :deep(.el-table) { --el-table-border-color: transparent; }
.list-template :deep(.el-table th.el-table__cell) { background: var(--bg-page); color: var(--text-primary); font-weight: 600; font-size: 16px; border-bottom: 1px solid var(--border-color); position: relative; user-select: none; padding: 6px 4px; white-space: nowrap; }
.list-template :deep(.el-table th.el-table__cell:not(:last-child)::after) { content: ''; position: absolute; right: 0; top: 20%; height: 60%; width: 2px; background: var(--border-color, #dcdfe6); border-radius: 1px; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
.list-template :deep(.el-table th.el-table__cell:not(:last-child):hover::after) { opacity: 1; }
.list-template :deep(.el-table__column-resize-proxy) { border-left: 2px dashed var(--el-color-primary, #409eff); }
.list-template :deep(.el-table th.el-table__cell .cell) { display: flex; width: 100%; align-items: center; gap: 4px; flex-wrap: nowrap; white-space: nowrap; }
.list-template :deep(.el-table th.el-table__cell.is-left .cell) { justify-content: flex-start; }
.list-template :deep(.el-table th.el-table__cell.is-center .cell) { justify-content: center; }
.list-template :deep(.el-table th.el-table__cell.is-right .cell) { justify-content: flex-end; }
.list-template :deep(.el-table th.el-table__cell .caret-wrapper) { flex-shrink: 0; }
.list-template :deep(.el-table th.el-table__cell .sort-caret) { display: block; }
.list-template :deep(.el-table th.el-table__cell .cell .el-table__column-filter-trigger),
.list-template :deep(.el-table th.el-table__cell .cell .el-icon) { flex-shrink: 0; }
.list-template :deep(.el-table td.el-table__cell) { font-size: 16px; border-bottom: 1px solid var(--border-light); padding: 6px 4px; }
.list-template :deep(.el-table td.el-table__cell .cell) { white-space: nowrap; }
.list-template :deep(.el-table .table-row:hover > td.el-table__cell) { background-color: var(--bg-hover); }
.list-template :deep(.el-table__body tr.el-table__row--striped td.el-table__cell) { background: var(--bg-page); }
.list-template :deep(.el-pagination) { margin-top: 6px; justify-content: flex-end; }
.list-template :deep(.el-button--small) { font-size: 16px; }
.table-cell-text { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
.cell-empty { color: var(--text-tertiary); }
.import-actions { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.import-filename { font-size: 13px; color: var(--text-secondary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.import-preview-header { font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
.list-template :deep(.el-table__header-wrapper th.el-table__cell) { cursor: grab; }
.list-template :deep(.el-table__header-wrapper th.el-table__cell:active) { cursor: grabbing; }
.list-template :deep(.col-drag-ghost) { opacity: 0.4; background: var(--el-color-primary-light-7, #c6e2ff) !important; }
</style>
