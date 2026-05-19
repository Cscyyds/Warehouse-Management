## 树面板模板（页面侧边栏）

<template>
  <div class="tree-panel">
    <div class="tree-panel-header">
      <span class="tree-panel-title">{{ title }}</span>
      <div class="tree-panel-actions">
        <el-tooltip content="刷新">
          <el-icon :size="16" class="action-icon" @click="$emit('refresh')"><Refresh /></el-icon>
        </el-tooltip>
      </div>
    </div>
    <div class="tree-panel-body">
      <el-tree
        ref="treeRef"
        :data="data"
        :props="{ label: labelKey, children: childrenKey }"
        :node-key="nodeKey"
        highlight-current
        @node-click="handleNodeClick"
      >
        <template #default="{ node, data: nodeData }">
          <span class="tree-node">
            <el-icon v-if="nodeData[childrenKey] && nodeData[childrenKey].length" :size="16" class="tree-folder-icon">
              <FolderOpened v-if="node.expanded" />
              <Folder v-else />
            </el-icon>
            <el-icon v-else :size="16" class="tree-leaf-icon"><Document /></el-icon>
            <span class="tree-label">{{ nodeData[labelKey] }}</span>
          </span>
        </template>
      </el-tree>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Refresh, FolderOpened, Folder, Document } from '@element-plus/icons-vue'

interface Props {
  title?: string
  data: any[]
  nodeKey?: string
  labelKey?: string
  childrenKey?: string
  width?: string
}

withDefaults(defineProps<Props>(), {
  title: '组织机构',
  nodeKey: 'id',
  labelKey: 'name',
  childrenKey: 'children',
  width: '200px'
})

const emit = defineEmits<{
  refresh: []
  nodeClick: [data: any]
}>()

const treeRef = ref()

function handleNodeClick(data: any) {
  emit('nodeClick', data)
}

function setCurrentKey(key: string | null) {
  treeRef.value?.setCurrentKey(key)
}

defineExpose({ setCurrentKey, treeRef })
</script>

<style scoped>
.tree-panel { width: v-bind(width); background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden; }
.tree-panel-header { padding: 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); }
.tree-panel-title { font-weight: 600; color: var(--text-primary); }
.tree-panel-actions .action-icon { cursor: pointer; color: var(--text-tertiary); transition: color 0.2s; }
.tree-panel-actions .action-icon:hover { color: var(--primary); }
.tree-panel-body { flex: 1; overflow-y: auto; padding: 8px 0; }
.tree-node { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.tree-label { font-size: 13px; }
.tree-folder-icon { color: var(--text-tertiary); transition: color 0.2s; }
.tree-leaf-icon { color: var(--text-tertiary); transition: color 0.2s; }
.tree-node:hover .tree-folder-icon,
.tree-node:hover .tree-leaf-icon { color: var(--primary); }
</style>
