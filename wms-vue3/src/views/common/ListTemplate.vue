## 业务列表模板
<template>
  <div class="list-template" :class="{ 'has-tree': showTree }">
    <TreePanel
      v-if="showTree"
      ref="treePanelRef"
      :title="treeTitle"
      :data="treeData"
      :node-key="treeNodeKey"
      :label-key="treeLabelKey"
      :children-key="treeChildrenKey"
      :width="treeWidth"
      @node-click="handleTreeNodeClick"
      @refresh="$emit('treeRefresh')"
    />
    <div class="list-content-panel">
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
            <el-button type="primary" @click="$emit('add')">
              <el-icon><Plus /></el-icon>新增
            </el-button>
          </slot>
        </div>
      </div>
      <Transition name="filter-slide">
        <div v-show="filterVisible" class="filter-row">
          <slot name="search" />
        </div>
      </Transition>
      <slot name="table" />
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="currentPageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="$emit('pageChange')"
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
import { ref, computed } from 'vue'
import { Plus, Filter, Download, Upload } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import TreePanel from './TreePanel.vue'

interface ImportColumn {
  key: string
  label: string
}

interface Props {
  title: string
  showTree?: boolean
  treeTitle?: string
  treeData?: any[]
  treeNodeKey?: string
  treeLabelKey?: string
  treeChildrenKey?: string
  treeWidth?: string
  page: number
  pageSize: number
  total: number
  showImport?: boolean
  showExport?: boolean
  importColumns?: ImportColumn[]
  exportColumns?: ImportColumn[]
  exportData?: any[]
  exportFileName?: string
}

const props = withDefaults(defineProps<Props>(), {
  showTree: false,
  treeTitle: '组织机构',
  treeData: () => [],
  treeNodeKey: 'id',
  treeLabelKey: 'name',
  treeChildrenKey: 'children',
  treeWidth: '200px',
  showImport: false,
  showExport: false,
  importColumns: () => [],
  exportColumns: () => [],
  exportData: () => [],
  exportFileName: '导出数据'
})

const emit = defineEmits<{
  'update:page': [val: number]
  'update:pageSize': [val: number]
  pageChange: []
  add: []
  treeNodeClick: [data: any]
  treeRefresh: []
  import: [data: any[]]
}>()

const treePanelRef = ref()
const filterVisible = ref(false)
const uploadRef = ref()
const importDialogVisible = ref(false)
const importPreviewData = ref<any[]>([])
const importFileName = ref('')

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

function handleTreeNodeClick(data: any) {
  emit('treeNodeClick', data)
}

function setTreeCurrentKey(key: string | null) {
  treePanelRef.value?.setCurrentKey(key)
}

defineExpose({ setTreeCurrentKey, treePanelRef })
</script>

<style scoped>
.list-template { height: 100%; padding: 4px; background: var(--bg-page); border-radius: var(--radius-lg); }
.list-template.has-tree { display: flex; gap: 16px; }
.list-content-panel { flex: 1; background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; padding: 16px; overflow: hidden; }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.panel-header h3 { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.toolbar-row { display: flex; align-items: center; justify-content: flex-end; margin-bottom: 14px; }
.toolbar-actions { display: flex; gap: 8px; align-items: center; }
.filter-row { overflow: hidden; margin-bottom: 14px; }
.filter-row :deep(.el-form-item) { margin-bottom: 0; margin-right: 10px; }
.filter-row :deep(.el-form-item:last-child) { margin-right: 0; }
.filter-row :deep(.el-form-item__label) { font-size: 13px; padding-right: 6px; }
.filter-slide-enter-active, .filter-slide-leave-active { transition: all 0.3s ease; overflow: hidden; }
.filter-slide-enter-from, .filter-slide-leave-to { opacity: 0; max-height: 0; margin-bottom: 0; }
.filter-slide-enter-to, .filter-slide-leave-from { opacity: 1; max-height: 200px; margin-bottom: 14px; }
.list-template :deep(.el-table) { --el-table-border-color: transparent; }
.list-template :deep(.el-table th.el-table__cell) { background: var(--bg-page); color: var(--text-primary); font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--border-color); }
.list-template :deep(.el-table td.el-table__cell) { border-bottom: 1px solid var(--border-light); }
.list-template :deep(.el-table .table-row:hover > td.el-table__cell) { background-color: var(--bg-hover); }
.list-template :deep(.el-table__body tr.el-table__row--striped td.el-table__cell) { background: var(--bg-page); }
.list-template :deep(.el-pagination) { margin-top: 12px; justify-content: flex-end; }
.list-template :deep(.el-button--small) { font-size: 13px; }
.import-actions { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.import-filename { font-size: 13px; color: var(--text-secondary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.import-preview-header { font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
</style>
