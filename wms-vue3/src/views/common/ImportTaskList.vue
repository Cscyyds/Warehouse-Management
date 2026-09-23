<template>
  <section class="task-list">
    <el-form inline class="task-filters" @submit.prevent="search">
      <el-form-item label="状态">
        <el-select v-model="status" clearable placeholder="全部状态" style="width: 140px">
          <el-option v-for="(label, value) in IMPORT_STATUS_LABELS" :key="value" :label="label" :value="value" />
        </el-select>
      </el-form-item>
      <el-form-item label="创建时间">
        <el-date-picker v-model="timeRange" type="datetimerange" value-format="YYYY-MM-DDTHH:mm:ss" start-placeholder="开始时间" end-placeholder="结束时间" range-separator="至" style="width: 360px; max-width: 100%" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button :loading="loading" @click="refresh">刷新</el-button>
      </el-form-item>
    </el-form>
    <el-alert v-if="error" :title="`记录更新失败：${error}`" type="error" show-icon :closable="false" />
    <div class="list-caption">
      <span>本租户的导入记录 · 最新提交优先</span>
      <span v-if="hasRunning">执行中的任务每 5 秒更新</span>
    </div>
    <el-table v-loading="loading && !data" :data="data?.list ?? []" row-key="import_task_id" border max-height="430" empty-text="暂无导入记录，可切换到上传文件创建任务">
      <el-table-column type="expand" width="42">
        <template #default="{ row }">
          <div class="error-preview">
            <strong>最近发现的错误（最多 5 条）</strong>
            <p v-if="row.error_message">{{ row.error_message }}</p>
            <p v-for="(item, index) in row.latest_errors" :key="index">{{ item.sheet ? `${item.sheet} · ` : '' }}第 {{ item.row }} 行 · {{ item.name || '未命名' }}：{{ item.reason }}</p>
            <p v-if="!row.latest_errors.length && !row.error_message">{{ row.is_finished ? '无错误记录' : '暂未发现错误，任务仍在处理中' }}</p>
            <el-button v-if="canViewDetail" link type="primary" @click="emit('select', row.import_task_id)">查看完整详情</el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="文件" min-width="230">
        <template #default="{ row }">
          <el-button v-if="canViewDetail" link type="primary" class="file-link" @click="emit('select', row.import_task_id)">{{ row.file_name || '未命名文件' }}</el-button>
          <span v-else>{{ row.file_name || '未命名文件' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="108">
        <template #default="{ row }"><el-tag :type="importStatusType(row.status)" size="small" disable-transitions>{{ IMPORT_STATUS_LABELS[row.status as ImportTaskStatus] || row.status_name }}</el-tag></template>
      </el-table-column>
      <el-table-column label="处理情况" min-width="210">
        <template #default="{ row }">
          <div>{{ importProgressText(row) }}</div>
          <el-progress v-if="row.status === 'VALIDATING'" :percentage="importProgress(row)" :stroke-width="5" />
        </template>
      </el-table-column>
      <el-table-column prop="created_by_name" label="提交人" width="100" show-overflow-tooltip />
      <el-table-column prop="created_at" label="提交时间" width="170" />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }"><el-button v-if="canViewDetail" link type="primary" @click="emit('select', row.import_task_id)">查看详情</el-button><span v-else>无详情权限</span></template>
      </el-table-column>
    </el-table>
    <el-pagination class="task-pagination" :current-page="query.page" :page-size="query.page_size" :total="total" :page-sizes="[10, 20, 50, 100]" layout="total, sizes, prev, pager, next" @update:current-page="query.page = $event" @update:page-size="changePageSize" />
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getImportTasks, type ImportTaskType, type ImportTaskStatus, type ImportTaskListParams } from '@/api/modules/batchImport'
import { useImportTaskQuery } from '@/composables/useImportTaskQuery'
import { IMPORT_STATUS_LABELS, importStatusType, importProgress, importProgressText } from '@/utils/importTask'

const props = defineProps<{ taskType: ImportTaskType; active: boolean; canViewDetail: boolean }>()
const emit = defineEmits<{ select: [id: string]; completed: [id: string] }>()
const status = ref<ImportTaskStatus | ''>('')
const timeRange = ref<[string, string] | null>(null)
const query = reactive<ImportTaskListParams>({ page: 1, page_size: 10 })
const { data, error, loading, refresh } = useImportTaskQuery({
  key: () => JSON.stringify([props.taskType, query]),
  enabled: () => props.active,
  request: signal => getImportTasks(props.taskType, query, { silent: true, signal }),
  interval: result => result.list.some(task => !task.is_finished) ? 5000 : 0,
})
const hasRunning = computed(() => data.value?.list.some(task => !task.is_finished))
const observed = new Map<string, ImportTaskStatus>()
const total = ref(0)
watch(data, result => {
  if (!result) return
  total.value = result.total
  result.list.forEach(task => {
    const previous = observed.get(task.import_task_id)
    if (task.status === 'SUCCESS' && previous && previous !== 'SUCCESS') emit('completed', task.import_task_id)
    observed.set(task.import_task_id, task.status)
  })
})
watch(() => props.taskType, () => {
  status.value = ''
  timeRange.value = null
  Object.assign(query, { page: 1, status: undefined, start_time: undefined, end_time: undefined })
  observed.clear()
})

function search() {
  if (timeRange.value && timeRange.value[0] > timeRange.value[1]) {
    ElMessage.warning('开始时间不能晚于结束时间')
    return
  }
  const next = { page: 1, status: status.value || undefined, start_time: timeRange.value?.[0], end_time: timeRange.value?.[1] }
  const unchanged = Object.entries(next).every(([key, value]) => query[key as keyof ImportTaskListParams] === value)
  Object.assign(query, next)
  if (unchanged) void refresh()
}
function reset() { status.value = ''; timeRange.value = null; search() }
function changePageSize(size: number) { query.page_size = size; query.page = 1 }
</script>

<style scoped>
.task-filters :deep(.el-form-item) { margin-bottom: 12px; }
.list-caption { display: flex; justify-content: space-between; gap: 12px; color: var(--text-secondary); font-size: 12px; margin: 8px 0 12px; }
.file-link { max-width: 100%; height: auto; white-space: normal; text-align: left; }
.error-preview { padding: 12px 24px; background: var(--bg-page); font-size: 13px; }
.error-preview p { margin: 8px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.task-pagination { justify-content: flex-end; margin-top: 16px; overflow-x: auto; }
@media (max-width: 768px) { .list-caption { flex-direction: column; } .task-filters :deep(.el-form-item) { max-width: 100%; margin-right: 0; } }
</style>
