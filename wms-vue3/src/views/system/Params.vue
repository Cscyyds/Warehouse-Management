<template>
  <ListTemplate
    title="参数设置"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="参数名称"><el-input v-model="searchForm.paramName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="参数键名"><el-input v-model="searchForm.paramKey" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #actions>
      <el-button type="danger" plain @click="handleClearCache">
        <el-icon><Delete /></el-icon>清除全部缓存
      </el-button>
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="paramName" label="参数名称" min-width="160" />
        <el-table-column prop="paramKey" label="参数键名" min-width="180" show-overflow-tooltip />
        <el-table-column prop="paramValue" label="参数键值" min-width="160" show-overflow-tooltip />
        <el-table-column prop="isSystem" label="系统参数" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isSystem ? 'danger' : 'info'" size="small">{{ row.isSystem ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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
import { Delete, Plus } from '@element-plus/icons-vue'
import { getParamList, deleteParam, clearParamCache, type ParamItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'
import { useTableSort } from '@/composables/useTableSort'

const router = useRouter()
const tableData = ref<ParamItem[]>([])

const searchForm = reactive({ paramName: '', paramKey: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)

const fallbackData: ParamItem[] = [
  { id: '1', paramName: '主框架页-默认皮肤', paramKey: 'sys.index.skinName', paramValue: 'skin-blue', groupName: '系统', sort: 1, status: '正常', remark: '', isSystem: true, createTime: '2023-04-09 10:00', updateTime: '2026-04-23 10:00', createUserId: '1', createUserName: '管理员' },
  { id: '2', paramName: '用户管理-密码初始化', paramKey: 'sys.user.initPassword', paramValue: '123456', groupName: '系统', sort: 2, status: '正常', remark: '', isSystem: true, createTime: '2023-04-09 10:05', updateTime: '2026-04-23 10:05', createUserId: '1', createUserName: '管理员' },
  { id: '3', paramName: '主框架页-侧边栏主题', paramKey: 'sys.index.sideTheme', paramValue: 'theme-dark', groupName: '系统', sort: 3, status: '正常', remark: '', isSystem: true, createTime: '2023-04-09 10:10', updateTime: '2025-10-04 10:10', createUserId: '1', createUserName: '管理员' },
  { id: '4', paramName: '账号自助-是否开启注册', paramKey: 'sys.account.registerUser', paramValue: 'false', groupName: '系统', sort: 4, status: '正常', remark: '', isSystem: false, createTime: '2023-04-09 10:15', updateTime: '2025-07-21 10:15', createUserId: '1', createUserName: '管理员' },
]

async function loadData() {
  try {
    const params = { ...searchForm, page: pagination.page, pageSize: pagination.pageSize, sort_by: sortBy.value || undefined, sort_order: sortOrder.value || undefined }
    const res = await getParamList(params)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { paramName, paramKey } = searchForm
    const filtered = fallbackData.filter(r => {
      if (paramName && !r.paramName.includes(paramName)) return false
      if (paramKey && !r.paramKey.includes(paramKey)) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { paramName: '', paramKey: '' }); handleSearch() }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'params' } }) }
function handleEdit(row: ParamItem) {
  sessionStorage.setItem('editData:params', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'params', id: row.id, mode: 'edit' } })
}

async function handleDelete(row: ParamItem) {
  try {
    await ElMessageBox.confirm(`确认删除参数「${row.paramName}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteParam(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

async function handleClearCache() {
  try {
    await ElMessageBox.confirm('确认清除全部参数缓存？', '提示', { confirmButtonText: '确认清除', type: 'warning' })
    await clearParamCache()
    ElMessage.success('缓存已清除')
  } catch {}
}

onMounted(() => { loadData() })
</script>

