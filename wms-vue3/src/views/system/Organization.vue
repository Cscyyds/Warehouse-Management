<template>
  <div class="org-page">
    <div class="org-tree-panel">
      <div class="org-header">
        <span class="org-title">组织机构</span>
        <div class="org-actions">
          <el-tooltip content="刷新"><el-icon :size="16" class="action-icon"><Refresh /></el-icon></el-tooltip>
        </div>
      </div>
      <div class="org-tree-container">
        <el-tree
          ref="treeRef"
          :data="orgTree"
          :props="{ label: 'name', children: 'children' }"
          node-key="id"
          default-expand-all
          highlight-current
          @node-click="handleOrgClick"
        >
          <template #default="{ node, data }">
            <span class="tree-node">
              <el-icon v-if="data.children && data.children.length" :size="16" class="tree-folder-icon">
                <FolderOpened v-if="node.expanded" />
                <Folder v-else />
              </el-icon>
              <el-icon v-else :size="16" class="tree-leaf-icon"><Document /></el-icon>
              <span class="tree-label">{{ data.name }}</span>
            </span>
          </template>
        </el-tree>
      </div>
    </div>
    <div class="content-panel">
      <div class="panel-header">
        <h3>机构管理</h3>
      </div>
      <div class="toolbar-row">
        <div class="toolbar-search">
          <el-form :model="searchForm" inline size="default">
            <el-form-item label="机构名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:140px" /></el-form-item>
            <el-form-item label="机构类型">
              <el-select v-model="searchForm.type" placeholder="请选择" clearable style="width:120px">
                <el-option label="公司" value="公司" />
                <el-option label="部门" value="部门" />
                <el-option label="小组" value="小组" />
              </el-select>
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:90px">
                <el-option label="启用" value="启用" />
                <el-option label="停用" value="停用" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSearch">查询</el-button>
              <el-button @click="handleReset">重置</el-button>
            </el-form-item>
          </el-form>
        </div>
        <div class="toolbar-actions">
          <el-button text><el-icon><Download /></el-icon>导出</el-button>
          <el-button text><el-icon><Upload /></el-icon>导入</el-button>
          <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
        </div>
      </div>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column prop="name" label="机构名称" width="160" />
        <el-table-column prop="fullName" label="机构全称" width="220" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.fullName }">{{ row.fullName || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="sort" label="排序号" width="80" align="center" />
        <el-table-column prop="type" label="机构类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.type === '公司' ? '' : row.type === '部门' ? 'success' : 'warning'" size="small">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updateTime" label="更新时间" width="160" />
        <el-table-column prop="remark" label="备注信息" min-width="180" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '启用' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            <el-dropdown trigger="click" @command="(cmd: string) => handleRowCommand(cmd, row)">
              <el-button link type="primary" size="small">
                <el-icon :size="14"><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :command="row.status === '启用' ? 'disable' : 'enable'">
                    {{ row.status === '启用' ? '停用' : '启用' }}
                  </el-dropdown-item>
                  <el-dropdown-item command="view">详情</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, FolderOpened, Folder, Document, Download, Upload, Plus, MoreFilled } from '@element-plus/icons-vue'
import { getOrgTree } from '@/api'

interface OrgItem {
  id: string
  name: string
  fullName: string
  sort: number
  type: string
  status: string
  remark: string
  parentId: string
  updateTime: string
  createTime: string
}

const router = useRouter()
const treeRef = ref()
const orgTree = ref<any[]>([])
const tableData = ref<OrgItem[]>([])
const selectedIds = ref<string[]>([])

const searchForm = reactive({
  name: '', type: '', status: ''
})

const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: OrgItem[] = [
  { id: '0', name: '总经办', fullName: '百诺总经办', sort: 1, type: '部门', status: '启用', remark: '', parentId: 'root', updateTime: '2026-04-23 10:33', createTime: '2023-04-09 10:33' },
  { id: '1', name: '销售部', fullName: '百诺销售部', sort: 2, type: '部门', status: '启用', remark: '', parentId: '0', updateTime: '2026-04-23 09:26', createTime: '2023-04-09 09:26' },
  { id: '2', name: '仓储物流部', fullName: '百诺仓储物流部', sort: 3, type: '部门', status: '启用', remark: '负责仓储与物流配送', parentId: '0', updateTime: '2026-04-23 09:25', createTime: '2023-04-09 09:25' },
  { id: '3', name: '客服部', fullName: '百诺客服部', sort: 4, type: '部门', status: '启用', remark: '', parentId: '0', updateTime: '2026-04-23 09:23', createTime: '2023-04-09 09:23' },
  { id: '4', name: '产品部', fullName: '百诺产品部', sort: 5, type: '部门', status: '启用', remark: '', parentId: '0', updateTime: '2025-10-04 10:06', createTime: '2023-04-09 10:06' },
  { id: '4-1', name: '采购部', fullName: '百诺采购部', sort: 6, type: '小组', status: '启用', remark: '', parentId: '4', updateTime: '2025-10-04 09:44', createTime: '2023-04-09 09:44' },
  { id: '4-2', name: '售后部', fullName: '百诺售后部', sort: 7, type: '小组', status: '启用', remark: '', parentId: '4', updateTime: '2025-10-04 08:06', createTime: '2023-04-09 08:06' },
  { id: '5', name: '行政部', fullName: '百诺行政部', sort: 8, type: '部门', status: '启用', remark: '', parentId: '0', updateTime: '2025-07-21 11:53', createTime: '2023-04-09 11:53' },
  { id: '6', name: '财务部', fullName: '百诺财务部', sort: 9, type: '部门', status: '启用', remark: '财务管理与核算', parentId: '0', updateTime: '2025-07-21 11:49', createTime: '2023-04-09 11:49' },
  { id: '7', name: '武汉分公司', fullName: '百诺武汉分公司', sort: 10, type: '公司', status: '停用', remark: '华中区域', parentId: 'root', updateTime: '2025-07-21 11:45', createTime: '2023-04-09 11:45' },
]

function getFallbackData(): OrgItem[] {
  return fallbackData
}

async function fetchOrgTree() {
  try {
    const res = await getOrgTree()
    orgTree.value = res.data.tree
  } catch {
    orgTree.value = [
      { id: 'root', name: '百诺全屋五金配套服务商', children: [
        { id: '0', name: '总经办', children: [
          { id: '1', name: '销售部' },
          { id: '2', name: '仓储物流部' },
          { id: '3', name: '客服部' },
          { id: '4', name: '产品部', children: [
            { id: '4-1', name: '采购部' },
            { id: '4-2', name: '售后部' }
          ]},
          { id: '5', name: '行政部' },
          { id: '6', name: '财务部' }
        ]}
      ]}
    ]
  }
}

async function loadData() {
  // TODO: 替换为真实 API
  try {
    const params = { ...searchForm, page: pagination.page, pageSize: pagination.pageSize }
    // const res = await getOrgList(params)
    // tableData.value = res.data.list
    // pagination.total = res.data.total
    throw new Error('API not ready')
  } catch {
    let data = getFallbackData()
    if (searchForm.name) data = data.filter(d => d.name.includes(searchForm.name))
    if (searchForm.type) data = data.filter(d => d.type === searchForm.type)
    if (searchForm.status) data = data.filter(d => d.status === searchForm.status)
    pagination.total = data.length
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = data.slice(start, start + pagination.pageSize)
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', type: '', status: '' }); handleSearch() }
function handleOrgClick(data: any) { }
function handleSelectionChange(val: OrgItem[]) { selectedIds.value = val.map(v => v.id) }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'organization' } }) }
function handleEdit(row: OrgItem) { router.push({ path: '/common/add', query: { type: 'organization', id: row.id, mode: 'edit' } }) }
async function handleToggleStatus(row: OrgItem) {
  const newStatus = row.status === '启用' ? '停用' : '启用'
  try {
    await ElMessageBox.confirm(`确认${newStatus}机构 ${row.name}？`, '提示')
    // await updateOrgStatus(row.id, newStatus)
    ElMessage.success(`${newStatus}成功`)
    loadData()
  } catch {}
}
async function handleDelete(row: OrgItem) {
  try {
    await ElMessageBox.confirm(`确认删除机构 ${row.name}？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    // await deleteOrg(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}
function handleView(row: OrgItem) { ElMessage.info(`查看详情: ${row.name}`) }

function handleRowCommand(command: string, row: OrgItem) {
  if (command === 'enable' || command === 'disable') handleToggleStatus(row)
  else if (command === 'view') handleView(row)
}

onMounted(() => { fetchOrgTree(); loadData() })
</script>

<style scoped>
.org-page { display: flex; gap: 16px; height: 100%; padding: 4px; background: var(--bg-page); border-radius: var(--radius-lg); }

/* ── 组织机构面板 ── */
.org-tree-panel { width: 260px; background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden; }
.org-header { padding: 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); }
.org-title { font-weight: 600; color: var(--text-primary); }
.org-tree-container { flex: 1; overflow-y: auto; padding: 8px 0; }
.tree-node { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.tree-label { font-size: 13px; }
.tree-folder-icon { color: var(--text-tertiary); transition: color 0.2s; }
.tree-leaf-icon { color: var(--text-tertiary); transition: color 0.2s; }
.tree-node:hover .tree-folder-icon,
.tree-node:hover .tree-leaf-icon { color: var(--primary); }

/* ── 内容面板 ── */
.content-panel { flex: 1; background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; padding: 16px; overflow: hidden; }

/* ── 标题 ── */
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.panel-header h3 { font-size: 16px; font-weight: 600; color: var(--text-primary); }

/* ── 工具栏: 左搜索 + 右操作 ── */
.toolbar-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
.toolbar-search { flex: 1; min-width: 0; }
.toolbar-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; margin-left: 16px; padding-top: 2px; }
.toolbar-search :deep(.el-form-item) { margin-bottom: 0; margin-right: 10px; }
.toolbar-search :deep(.el-form-item:last-child) { margin-right: 0; }
.toolbar-search :deep(.el-form-item__label) { font-size: 13px; padding-right: 6px; }

/* ── 表格 ── */
.org-page :deep(.el-table) { --el-table-border-color: transparent; }
.org-page :deep(.el-table th.el-table__cell) { background: var(--bg-page); color: var(--text-primary); font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--border-color); }
.org-page :deep(.el-table td.el-table__cell) { border-bottom: 1px solid var(--border-light); }
.org-page :deep(.el-table .table-row:hover > td.el-table__cell) { background-color: var(--bg-hover); }
.org-page :deep(.el-table__body tr.el-table__row--striped td.el-table__cell) { background: var(--bg-page); }
.cell-empty { color: var(--text-tertiary); }

/* ── 操作列 ── */
.org-page :deep(.el-button--small) { font-size: 13px; }
</style>
