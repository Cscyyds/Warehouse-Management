<template>
  <ListTemplate
    title="岗位管理"
    v-model:page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    @page-change="loadData"
    @add="handleAdd"
  >
    <template #search>
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="岗位名称"><el-input v-model="searchForm.post_name" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="岗位编码"><el-input v-model="searchForm.post_code" placeholder="请输入" clearable style="width:130px" /></el-form-item>
        <el-form-item label="岗位分类">
          <el-select v-model="searchForm.post_category" placeholder="请选择" clearable filterable style="width:110px">
            <el-option v-for="o in categoryOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width:90px">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </template>
    <template #table>
      <el-table :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column type="index" label="" width="55" align="center" />
        <el-table-column prop="post_name" label="岗位名称" min-width="130" />
        <el-table-column prop="post_code" label="岗位编码" width="150" />
        <el-table-column prop="sort_no" label="排序号" width="80" align="center" />
        <el-table-column prop="post_category_label" label="岗位分类" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.post_category_label || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注信息" min-width="150" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.remark }">{{ row.remark || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
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
                  <el-dropdown-item :command="row.status === 1 ? 'stop' : 'start'">
                    {{ row.status === 1 ? '停用' : '启用' }}
                  </el-dropdown-item>
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
import { MoreFilled } from '@element-plus/icons-vue'
import { getPostList, searchPosts, deletePost, updatePost, getPostCategoryOptions, type PostItem } from '@/api'
import ListTemplate from '@/views/common/ListTemplate.vue'

const router = useRouter()
const tableData = ref<PostItem[]>([])
const selectedCodes = ref<string[]>([])
const categoryOptions = ref<{ label: string; value: string }[]>([])

const searchForm = reactive({ post_name: '', post_code: '', post_category: '', status: '' as number | '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

async function loadCategoryOptions() {
  try {
    categoryOptions.value = await getPostCategoryOptions()
  } catch {
    categoryOptions.value = []
  }
}

async function loadData() {
  try {
    const hasFilter = !!(searchForm.post_name || searchForm.post_code || searchForm.post_category || searchForm.status !== '')
    let res
    if (hasFilter) {
      const fields: string[] = []
      const values: Record<string, string | number> = {}
      if (searchForm.post_name) { fields.push('post_name'); values.post_name = searchForm.post_name }
      if (searchForm.post_code) { fields.push('post_code'); values.post_code = searchForm.post_code }
      if (searchForm.post_category) { fields.push('post_category'); values.post_category = searchForm.post_category }
      if (searchForm.status !== '') { fields.push('status'); values.status = searchForm.status }
      res = await searchPosts({
        search_field: JSON.stringify(fields),
        search_value: JSON.stringify(values),
        page: pagination.page,
      })
    } else {
      res = await getPostList({ page: pagination.page })
    }
    tableData.value = res.data.post || []
    pagination.total = res.data.total || 0
  } catch {
    tableData.value = []
    pagination.total = 0
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { post_name: '', post_code: '', post_category: '', status: '' })
  handleSearch()
}
function handleSelectionChange(val: PostItem[]) { selectedCodes.value = val.map(v => v.post_code) }
function handleAdd() { router.push({ path: '/common/add', query: { type: 'position' } }) }
function handleEdit(row: PostItem) {
  sessionStorage.setItem('editData:position', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'position', id: row.post_code, mode: 'edit' } })
}

async function handleToggleStatus(row: PostItem) {
  const newStatus = row.status === 1 ? 0 : 1
  const label = newStatus === 1 ? '启用' : '停用'
  try {
    await ElMessageBox.confirm(`确认${label}岗位「${row.post_name}」？`, '提示')
    // 后端 update 为整对象替换语义（post_name/post_category/status 必填），切换状态须提交整行
    await updatePost({
      post_id: row.post_code,
      post_name: row.post_name,
      post_category: row.post_category || undefined,
      sort_no: row.sort_no,
      remark: row.remark || undefined,
      status: newStatus,
    })
    ElMessage.success(`${label}成功`)
    loadData()
  } catch {}
}

async function handleDelete(row: PostItem) {
  try {
    await ElMessageBox.confirm(`确认删除岗位「${row.post_name}」？`, '提示', { confirmButtonText: '确认删除', type: 'warning' })
    await deletePost(row.post_code)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

function handleRowCommand(command: string, row: PostItem) {
  if (command === 'stop' || command === 'start') handleToggleStatus(row)
}

onMounted(() => { loadCategoryOptions(); loadData() })
</script>

<style scoped>
.cell-empty { color: var(--text-tertiary); }
</style>
