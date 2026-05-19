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
        <div class="toolbar-search">
          <slot name="search" />
        </div>
        <div class="toolbar-actions">
          <slot name="actions">
            <el-button type="primary" @click="$emit('add')">
              <el-icon><Plus /></el-icon>新增
            </el-button>
          </slot>
        </div>
      </div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import TreePanel from './TreePanel.vue'

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
}

const props = withDefaults(defineProps<Props>(), {
  showTree: false,
  treeTitle: '组织机构',
  treeData: () => [],
  treeNodeKey: 'id',
  treeLabelKey: 'name',
  treeChildrenKey: 'children',
  treeWidth: '260px'
})

const emit = defineEmits<{
  'update:page': [val: number]
  'update:pageSize': [val: number]
  pageChange: []
  add: []
  treeNodeClick: [data: any]
  treeRefresh: []
}>()

const treePanelRef = ref()

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
.toolbar-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
.toolbar-search { flex: 1; min-width: 0; }
.toolbar-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; margin-left: 16px; padding-top: 2px; }
.toolbar-search :deep(.el-form-item) { margin-bottom: 0; margin-right: 10px; }
.toolbar-search :deep(.el-form-item:last-child) { margin-right: 0; }
.toolbar-search :deep(.el-form-item__label) { font-size: 13px; padding-right: 6px; }
.list-template :deep(.el-table) { --el-table-border-color: transparent; }
.list-template :deep(.el-table th.el-table__cell) { background: var(--bg-page); color: var(--text-primary); font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--border-color); }
.list-template :deep(.el-table td.el-table__cell) { border-bottom: 1px solid var(--border-light); }
.list-template :deep(.el-table .table-row:hover > td.el-table__cell) { background-color: var(--bg-hover); }
.list-template :deep(.el-table__body tr.el-table__row--striped td.el-table__cell) { background: var(--bg-page); }
.list-template :deep(.el-pagination) { margin-top: 12px; justify-content: flex-end; }
.list-template :deep(.el-button--small) { font-size: 13px; }
</style>
