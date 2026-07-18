<template>
  <div class="profile-page">
    <div class="page-header">
      <span class="page-title">个人中心</span>
      <div class="header-tabs">
        <span class="header-tab" @click="goProfile">个人信息</span>
        <span class="header-tab" @click="goChangePassword">修改密码</span>
        <span class="header-tab active">负责拜访任务</span>
      </div>
    </div>

    <div class="profile-card" style="flex-direction: column; padding: 20px;">
      <!-- 搜索栏 -->
      <el-form :model="searchForm" inline size="default" style="margin-bottom: 14px;">
        <el-form-item label="客户名称"><el-input v-model="searchForm.customerName" placeholder="请输入" clearable style="width:140px" /></el-form-item>
        <el-form-item label="任务类型">
          <el-select v-model="searchForm.taskType" placeholder="请选择" clearable style="width:110px">
            <el-option label="上门拜访" value="上门拜访" />
            <el-option label="电话回访" value="电话回访" />
            <el-option label="视频会议" value="视频会议" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="searchForm.auditStatus" placeholder="请选择" clearable style="width:100px">
            <el-option label="待提交" value="0" />
            <el-option label="审核通过" value="1" />
            <el-option label="已完成" value="2" />
            <el-option label="已驳回" value="3" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 数据表格 -->
      <el-table border :data="tableData" stripe size="small" style="width:100%" row-class-name="table-row" @sort-change="handleSortChange" v-loading="loading">
        <el-table-column type="index" :index="(idx: number) => (pagination.page - 1) * pagination.pageSize + idx + 1" label="" width="55" align="center" />
        <el-table-column prop="customer_name" label="客户" min-width="150" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="contact_name" label="联系人" min-width="90" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="contact_phone" label="电话" min-width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="visit_address" label="拜访地址" min-width="160" show-overflow-tooltip sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.visit_address }">{{ row.visit_address || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="task_type_name" column-key="task_type" label="任务类型" min-width="100" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="visit_time" label="拜访时间" width="160" sortable="custom">
          <template #default="{ row }">{{ formatTableDate(row.visit_time) }}</template>
        </el-table-column>
        <el-table-column prop="complete_time" label="完成时间" width="160" sortable="custom">
          <template #default="{ row }"><span :class="{ 'cell-empty': !row.complete_time }">{{ formatTableDate(row.complete_time) }}</span></template>
        </el-table-column>
        <el-table-column prop="audit_status" label="审核状态" width="90" align="center" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="auditTagType(row.audit_status)" size="small">{{ auditStatusLabel(row.audit_status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="global_opt_width" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleDetail(row)">详情</el-button>
            <el-button link type="success" size="small" :disabled="row.audit_status !== 0" @click="openCompleteDialog(row)">完成</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 12px; justify-content: flex-end;"
        @size-change="handleSizeChange"
        @current-change="loadData"
      />
    </div>

    <!-- 完成拜访弹窗 -->
    <el-dialog v-model="completeDialog.visible" title="完成拜访" width="640px" :close-on-click-modal="false" @close="resetCompleteForm">
      <el-form ref="completeFormRef" :model="completeDialog.form" :rules="completeRules" label-width="100px" size="default">
        <el-form-item label="签到时间" prop="sign_in_time">
          <el-date-picker v-model="completeDialog.form.sign_in_time" type="datetime" placeholder="请选择签到时间" style="width:100%" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="签退时间" prop="sign_out_time">
          <el-date-picker v-model="completeDialog.form.sign_out_time" type="datetime" placeholder="请选择签退时间" style="width:100%" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="签到地址" prop="sign_in_address">
          <el-input v-model="completeDialog.form.sign_in_address" placeholder="请输入签到地址" />
        </el-form-item>
        <el-form-item label="签退地址" prop="sign_out_address">
          <el-input v-model="completeDialog.form.sign_out_address" placeholder="请输入签退地址" />
        </el-form-item>
        <el-form-item label="拜访结果" prop="visit_result">
          <el-input v-model="completeDialog.form.visit_result" type="textarea" :rows="3" placeholder="请输入拜访结果" />
        </el-form-item>
        <el-form-item label="下次计划">
          <el-input v-model="completeDialog.form.next_visit_plan" type="textarea" :rows="2" placeholder="请输入下次拜访计划（选填）" />
        </el-form-item>
        <el-form-item label="现场照片">
          <el-upload
            :auto-upload="false"
            :file-list="completeDialog.fileList"
            :limit="5"
            accept="image/*"
            list-type="picture-card"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            :before-upload="() => false"
          >
            <el-icon><Plus /></el-icon>
          </el-upload>
          <div class="upload-tip">仅支持图片文件，单张不超过 10MB，最多上传 5 张图片</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="completeDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="completeDialog.submitting" @click="handleCompleteSubmit">确认完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getMyVisitTaskList, searchMyVisitTasks, completeMyVisitTask, type VisitTaskItem } from '@/api'
import { useTableSort } from '@/composables/useTableSort'
import { formatTableDate } from '@/utils/date'
import { global_opt_width } from '@/utils/data'

const router = useRouter()
const tableData = ref<VisitTaskItem[]>([])
const searchForm = reactive({ customerName: '', taskType: '', auditStatus: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { sortBy, sortOrder, handleSortChange } = useTableSort(loadData)
const loading = ref(false)
const IMAGE_MAX_SIZE_MB = 10

const completeFormRef = ref<FormInstance>()
const completeDialog = reactive<{
  visible: boolean
  submitting: boolean
  currentRow: VisitTaskItem | null
  form: {
    sign_in_time: string
    sign_out_time: string
    sign_in_address: string
    sign_out_address: string
    visit_result: string
    next_visit_plan: string
  }
  fileList: any[]
}>({
  visible: false,
  submitting: false,
  currentRow: null,
  form: {
    sign_in_time: '',
    sign_out_time: '',
    sign_in_address: '',
    sign_out_address: '',
    visit_result: '',
    next_visit_plan: '',
  },
  fileList: [],
})

const completeRules: FormRules = {
  sign_in_time: [{ required: true, message: '请选择签到时间', trigger: 'change' }],
  sign_out_time: [{ required: true, message: '请选择签退时间', trigger: 'change' }],
  sign_in_address: [{ required: true, message: '请输入签到地址', trigger: 'blur' }],
  sign_out_address: [{ required: true, message: '请输入签退地址', trigger: 'blur' }],
  visit_result: [{ required: true, message: '请输入拜访结果', trigger: 'blur' }],
}

function auditStatusLabel(status: number): string {
  const map: Record<number, string> = { 0: '待提交', 1: '审核通过', 2: '已完成', 3: '已驳回' }
  return map[status] || '未知'
}

function auditTagType(status: number): 'success' | 'danger' | 'warning' | 'info' {
  if (status === 1) return 'success'
  if (status === 3) return 'danger'
  if (status === 2) return 'warning'
  return 'info'
}

async function loadData() {
  loading.value = true
  try {
    let res
    const hasFilter = !!(searchForm.customerName || searchForm.taskType || searchForm.auditStatus)
    if (hasFilter) {
      const searchField: string[] = []
      const searchValue: Record<string, unknown> = {}
      if (searchForm.customerName) {
        searchField.push('customer_name')
        searchValue.customer_name = searchForm.customerName
      }
      if (searchForm.taskType) {
        searchField.push('task_type_name')
        searchValue.task_type_name = searchForm.taskType
      }
      if (searchForm.auditStatus) {
        searchField.push('audit_status')
        searchValue.audit_status = Number(searchForm.auditStatus)
      }
      res = await searchMyVisitTasks({
        search_field: JSON.stringify(searchField),
        search_value: JSON.stringify(searchValue),
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    } else {
      res = await getMyVisitTaskList({
        page: pagination.page,
        page_size: pagination.pageSize,
        sort_by: sortBy.value || undefined,
        sort_order: sortOrder.value || undefined,
      })
    }
    tableData.value = res.data.visit_task || []
    pagination.total = res.data.total || 0
  } catch {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleSizeChange() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { customerName: '', taskType: '', auditStatus: '' })
  handleSearch()
}

function handleDetail(row: VisitTaskItem) {
  sessionStorage.setItem('editData:customerVisit', JSON.stringify(row))
  router.push({ path: '/common/add', query: { type: 'customerVisit', id: row.visit_task_id, mode: 'edit' } })
}

function openCompleteDialog(row: VisitTaskItem) {
  completeDialog.currentRow = row
  completeDialog.form = {
    sign_in_time: '',
    sign_out_time: '',
    sign_in_address: '',
    sign_out_address: '',
    visit_result: '',
    next_visit_plan: '',
  }
  completeDialog.fileList = []
  completeDialog.visible = true
}

function handleFileChange(_file: any, fileList: any[]) {
  const maxSizeBytes = IMAGE_MAX_SIZE_MB * 1024 * 1024
  if (_file?.raw && Number(_file.raw.size || 0) > maxSizeBytes) {
    ElMessage.warning(`现场照片大小不能超过 ${IMAGE_MAX_SIZE_MB}MB`)
  }
  completeDialog.fileList = fileList.filter((item: any) => !item?.raw || Number(item.raw.size || 0) <= maxSizeBytes)
}

function handleFileRemove(_file: any, fileList: any[]) {
  completeDialog.fileList = fileList
}

function resetCompleteForm() {
  completeFormRef.value?.resetFields()
  completeDialog.currentRow = null
  completeDialog.fileList = []
}

async function handleCompleteSubmit() {
  if (!completeDialog.currentRow) return
  const valid = await completeFormRef.value?.validate().catch(() => false)
  if (!valid) return

  completeDialog.submitting = true
  try {
    const images = completeDialog.fileList
      .map((f: any) => f.raw)
      .filter(Boolean) as File[]
    await completeMyVisitTask({
      visit_task_id: completeDialog.currentRow.visit_task_id,
      sign_in_time: completeDialog.form.sign_in_time,
      sign_out_time: completeDialog.form.sign_out_time,
      sign_in_address: completeDialog.form.sign_in_address,
      sign_out_address: completeDialog.form.sign_out_address,
      visit_result: completeDialog.form.visit_result,
      next_visit_plan: completeDialog.form.next_visit_plan || undefined,
      images: images.length > 0 ? images : undefined,
    })
    ElMessage.success('拜访任务已完成，等待管理员审核')
    completeDialog.visible = false
    loadData()
  } catch {
    // 错误由拦截器处理
  } finally {
    completeDialog.submitting = false
  }
}

/* ========== 导航到个人中心其他页面 ========== */
function goProfile() { router.push('/profile') }
function goChangePassword() { router.push('/profile/change-password') }

onMounted(() => { loadData() })
</script>

<style scoped>
.profile-page { padding: 0; }

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}
.page-title { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.header-tabs { display: flex; }
.header-tab {
  padding: 6px 18px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-right: none;
  background: var(--bg-white);
  transition: all 0.2s;
  user-select: none;
}
.header-tab:first-child { border-radius: 4px 0 0 4px; }
.header-tab:last-child { border-right: 1px solid var(--border-color); border-radius: 0 4px 4px 0; }
.header-tab:hover { color: var(--primary); background: var(--primary-bg); }
.header-tab.active { color: var(--primary); background: var(--primary-bg); border-color: var(--primary); font-weight: 500; }

.profile-card {
  background: var(--bg-white);
  border-radius: 6px;
  border: 1px solid var(--border-color);
  display: flex;
  min-height: 380px;
  overflow: hidden;
}
.cell-empty { color: var(--text-tertiary); }
.upload-tip { font-size: 12px; color: var(--text-tertiary); margin-top: 4px; }
</style>
