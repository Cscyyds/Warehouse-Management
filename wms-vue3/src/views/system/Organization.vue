<template>
  <ListTemplate
    title="机构管理"
    show-tree
    :tree-data="orgTree"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @tree-node-click="handleOrgClick"
    @tree-refresh="fetchOrgTree"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
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
    </template>
    <template #actions>
      <el-button text><el-icon><Download /></el-icon>导出</el-button>
      <el-button text><el-icon><Upload /></el-icon>导入</el-button>
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
    </template>
    <template #table>
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
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Upload, Plus, MoreFilled } from '@element-plus/icons-vue'
import { getOrgTree } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

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
const orgTree = ref<any[]>([])
const tableData = ref<OrgItem[]>([])
const selectedIds = ref<string[]>([])

const searchForm = reactive({ name: '', type: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: OrgItem[] = [
  { id: '0', name: '总经办', fullName: '百诺总经办', sort: 1, type: '部门', status: '启用', remark: '', parentId: 'root', updateTime: '2026-04-23 10:33', createTime: '2023-04-09 10:33' },
  { id: '1', name: '销售部', fullName: '百诺销售部', sort: 2, type: '部门', status: '启用', remark: '', parentId: '0', updateTime: '2026-04-23 09:26', createTime: '2023-04-09 09:26' },
  { id: '2', name: '仓储物流部', fullName: '百诺仓储物流部', sort: 3, type: '部门', status: '启用', remark: '负责仓储与物流配送', parentId: '0', updateTime: '2026-04-23 09:25', createTime: '2023-04-09 09:25' },
  { id: '3', name: '客服部', fullName: '百诺客服部', sort: 4, type: '部门', status: '启用', remark: '', parentId: '0', updateTime: '2026-04-23 09:23', createTime: '2023-04-09 09:23' },
  { id: '4', name: '产品部', fullName: '百诺产品部', sort: 5, type: '部门', status: '启用', remark: '', parentId: '0', updateTime: '2025-10-04 10:06', createTime: '2023-04-09 10:06' },
  { id: '7', name: '武汉分公司', fullName: '百诺武汉分公司', sort: 10, type: '公司', status: '停用', remark: '华中区域', parentId: 'root', updateTime: '2025-07-21 11:45', createTime: '2023-04-09 11:45' },
]

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
  try {
    throw new Error('API not ready')
  } catch {
    let data = fallbackData.slice()
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
function handleOrgClick(_data: any) { }
function handleSelectionChange(val: OrgItem[]) { selectedIds.value = val.map(v => v.id) }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'organization' } }) }
function handleEdit(row: OrgItem) {
  sessionStorage.setItem('editData:organization', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'organization', id: row.id, mode: 'edit' } })
}

async function handleToggleStatus(row: OrgItem) {
  const newStatus = row.status === '启用' ? '停用' : '启用'
  try {
    await ElMessageBox.confirm(`确认${newStatus}机构 ${row.name}？`, '提示')
    ElMessage.success(`${newStatus}成功`)
    loadData()
  } catch {}
}

async function handleDelete(row: OrgItem) {
  try {
    await ElMessageBox.confirm(`确认删除机构 ${row.name}？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

function handleRowCommand(command: string, row: OrgItem) {
  if (command === 'enable' || command === 'disable') handleToggleStatus(row)
  else if (command === 'view') ElMessage.info(`查看详情: ${row.name}`)
}

onMounted(() => { fetchOrgTree(); loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
