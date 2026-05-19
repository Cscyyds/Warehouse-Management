<template>
  <ListTemplate
    title="字典数据"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="字典标签"><el-input v-model="searchForm.label" placeholder="请输入" clearable style="width:130px" /></el-form-item>
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
    </template>
    <template #actions>
      <el-button @click="handleBack"><el-icon><Back /></el-icon>返回</el-button>
      <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column prop="label" label="字典标签" min-width="130" />
        <el-table-column prop="value" label="字典键值" min-width="130" />
        <el-table-column prop="sort" label="排序号" width="80" align="center" />
        <el-table-column prop="isSystem" label="系统内置" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isSystem ? 'danger' : 'info'" size="small">{{ row.isSystem ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updateTime" label="更新时间" width="160" />
        <el-table-column prop="remark" label="备注信息" min-width="140" show-overflow-tooltip>
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
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ListTemplate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, Plus } from '@element-plus/icons-vue'
import { getDictDataList, deleteDictData, type DictDataItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const route = useRoute()
const dictId = (route.query.dictId as string) || ''
const dictType = (route.query.dictType as string) || ''
const tableData = ref<DictDataItem[]>([])

const searchForm = reactive({ label: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallbackData: DictDataItem[] = [
  { id: '1', dictId: '1', dictType: 'sys_user_sex', label: '男', value: '0', sort: 1, isSystem: true, status: '正常', remark: '', createTime: '2023-04-09 10:00', updateTime: '2026-04-23 10:00', createUserId: '1', createUserName: '管理员' },
  { id: '2', dictId: '1', dictType: 'sys_user_sex', label: '女', value: '1', sort: 2, isSystem: true, status: '正常', remark: '', createTime: '2023-04-09 10:05', updateTime: '2026-04-23 10:05', createUserId: '1', createUserName: '管理员' },
  { id: '3', dictId: '1', dictType: 'sys_user_sex', label: '未知', value: '2', sort: 3, isSystem: false, status: '停用', remark: '', createTime: '2023-04-09 10:10', updateTime: '2025-10-04 10:10', createUserId: '1', createUserName: '管理员' },
]

async function loadData() {
  try {
    const params = { ...searchForm, dictId, dictType, page: pagination.page, pageSize: pagination.pageSize }
    const res = await getDictDataList(params)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const { label, status } = searchForm
    const filtered = fallbackData.filter(r => {
      if (label && !r.label.includes(label)) return false
      if (status && r.status !== status) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    tableData.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(searchForm, { label: '', status: '' }); handleSearch() }
function handleBack() { router.push('/system/dict') }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'dictData', dictId, dictType } }) }
function handleEdit(row: DictDataItem) {
  sessionStorage.setItem('editData:dictData', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'dictData', id: row.id, dictId, dictType, mode: 'edit' } })
}

async function handleDelete(row: DictDataItem) {
  try {
    await ElMessageBox.confirm(`确认删除字典数据「${row.label}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deleteDictData(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

onMounted(() => { loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
