<template>
  <div class="position-page">
    <div class="panel-header">
      <h3>岗位管理</h3>
    </div>
    <div class="toolbar-row">
      <div class="toolbar-search">
        <el-form :model="searchForm" inline size="default">
          <el-form-item label="岗位名称"><el-input v-model="searchForm.name" placeholder="请输入" clearable style="width:130px" /></el-form-item>
          <el-form-item label="岗位编码"><el-input v-model="searchForm.code" placeholder="请输入" clearable style="width:130px" /></el-form-item>
          <el-form-item label="岗位分类">
            <el-select v-model="searchForm.category" placeholder="请选择" clearable style="width:110px">
              <el-option label="管理类" value="管理类" />
              <el-option label="技术类" value="技术类" />
              <el-option label="业务类" value="业务类" />
              <el-option label="后勤类" value="后勤类" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:90px">
              <el-option label="正常" value="正常" />
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
        <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
      </div>
    </div>
    <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="40" />
      <el-table-column type="index" label="序号" width="55" align="center" />
      <el-table-column prop="name" label="岗位名称" min-width="130" />
      <el-table-column prop="code" label="岗位编码" width="130" />
      <el-table-column prop="sort" label="排序号" width="80" align="center" />
      <el-table-column prop="category" label="岗位分类" width="100" align="center">
        <template #default="{ row }">
          <el-tag size="small" type="info">{{ row.category }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="updateTime" label="更新时间" width="160" />
      <el-table-column prop="remark" label="备注信息" min-width="150" show-overflow-tooltip>
        <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="70" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === '正常' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
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
                <el-dropdown-item :command="row.status === '正常' ? 'stop' : 'start'">
                  {{ row.status === '正常' ? '停用' : '启用' }}
                </el-dropdown-item>
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
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, MoreFilled } from '@element-plus/icons-vue'
import { getPositionList, updatePositionStatus, deletePosition, type PositionItem } from '@/api'

const router = useRouter()
const tableData = ref<PositionItem[]>([])
const selectedIds = ref<string[]>([])

const searchForm = reactive({ name: '', code: '', category: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: PositionItem[] = [
  { id: '1', code: 'POS001', name: '总经理', category: '管理类', orgId: '0', orgName: '总经办', sort: 1, remark: '', status: '正常', createTime: '2023-04-09 10:00', updateTime: '2026-04-23 10:00', createUserId: '1', createUserName: '管理员' },
  { id: '2', code: 'POS002', name: '销售经理', category: '管理类', orgId: '1', orgName: '销售部', sort: 2, remark: '', status: '正常', createTime: '2023-04-09 10:05', updateTime: '2026-04-23 10:05', createUserId: '1', createUserName: '管理员' },
  { id: '3', code: 'POS003', name: '仓库主管', category: '管理类', orgId: '2', orgName: '仓储物流部', sort: 3, remark: '负责仓库日常管理', status: '正常', createTime: '2023-04-09 10:10', updateTime: '2026-04-23 10:10', createUserId: '1', createUserName: '管理员' },
  { id: '4', code: 'POS004', name: '采购专员', category: '业务类', orgId: '4-1', orgName: '采购部', sort: 4, remark: '', status: '正常', createTime: '2023-04-09 10:15', updateTime: '2025-10-04 10:15', createUserId: '1', createUserName: '管理员' },
  { id: '5', code: 'POS005', name: '售后工程师', category: '技术类', orgId: '4-2', orgName: '售后部', sort: 5, remark: '负责产品售后维修', status: '正常', createTime: '2023-04-09 10:20', updateTime: '2025-10-04 10:20', createUserId: '1', createUserName: '管理员' },
  { id: '6', code: 'POS006', name: '财务专员', category: '后勤类', orgId: '6', orgName: '财务部', sort: 6, remark: '', status: '正常', createTime: '2023-04-09 10:25', updateTime: '2025-07-21 10:25', createUserId: '1', createUserName: '管理员' },
  { id: '7', code: 'POS007', name: '客服专员', category: '业务类', orgId: '3', orgName: '客服部', sort: 7, remark: '', status: '停用', createTime: '2023-04-09 10:30', updateTime: '2024-02-22 10:30', createUserId: '1', createUserName: '管理员' },
]

async function loadData() {
  try {
    const params = { ...searchForm, page: pagination.page, pageSize: pagination.pageSize }
    const res = await getPositionList(params)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { name, code, category, status } = searchForm
    const filtered = fallbackData.filter(u => {
      if (name && !u.name.includes(name)) return false
      if (code && !u.code.includes(code)) return false
      if (category && u.category !== category) return false
      if (status && u.status !== status) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { name: '', code: '', category: '', status: '' }); handleSearch() }
function handleSelectionChange(val: PositionItem[]) { selectedIds.value = val.map(v => v.id) }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'position' } }) }
function handleEdit(row: PositionItem) { router.push({ path: '/common/add', query: { type: 'position', id: row.id, mode: 'edit' } }) }

async function handleToggleStatus(row: PositionItem) {
  const newStatus = row.status === '正常' ? '停用' : '启用'
  try {
    await ElMessageBox.confirm(`确认${newStatus}岗位「${row.name}」？`, '提示')
    await updatePositionStatus(row.id, newStatus)
    ElMessage.success(`${newStatus}成功`)
    loadData()
  } catch {}
}

async function handleDelete(row: PositionItem) {
  try {
    await ElMessageBox.confirm(`确认删除岗位「${row.name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deletePosition(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

function handleRowCommand(command: string, row: PositionItem) {
  if (command === 'stop' || command === 'start') handleToggleStatus(row)
}

onMounted(() => { loadData() })
</script>

<style scoped>
.position-page { background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; padding: 16px; height: 100%; overflow: hidden; }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.panel-header h3 { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.toolbar-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
.toolbar-search { flex: 1; min-width: 0; }
.toolbar-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; margin-left: 16px; padding-top: 2px; }
.toolbar-search :deep(.el-form-item) { margin-bottom: 0; margin-right: 10px; }
.toolbar-search :deep(.el-form-item:last-child) { margin-right: 0; }
.toolbar-search :deep(.el-form-item__label) { font-size: 13px; padding-right: 6px; }
.position-page :deep(.el-table) { --el-table-border-color: transparent; }
.position-page :deep(.el-table th.el-table__cell) { background: var(--bg-page); color: var(--text-primary); font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--border-color); }
.position-page :deep(.el-table td.el-table__cell) { border-bottom: 1px solid var(--border-light); }
.position-page :deep(.el-table .table-row:hover > td.el-table__cell) { background-color: var(--bg-hover); }
.position-page :deep(.el-table__body tr.el-table__row--striped td.el-table__cell) { background: var(--bg-page); }
.cell-empty { color: var(--text-tertiary); }
.position-page :deep(.el-pagination) { margin-top: 12px; justify-content: flex-end; }
</style>
