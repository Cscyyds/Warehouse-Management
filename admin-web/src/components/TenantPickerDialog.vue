<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { queryPlatformTenants, type TenantOptionRow } from '@/api/platformQueries'

const props = defineProps<{
  modelValue: boolean
  /** 已选租客编码列表 */
  selected: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [tenants: TenantOptionRow[]]
}>()

const loading = ref(false)
const rows = ref<TenantOptionRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const keyword = ref('')
/** 已选租客的完整信息，跨分页保留（表格翻页后仍需在右侧展示） */
const picked = ref<TenantOptionRow[]>([])
const pickedCodes = computed(() => new Set(picked.value.map((item) => item.tenant_code)))

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

async function load() {
  loading.value = true
  try {
    const data = await queryPlatformTenants({ page: page.value, page_size: pageSize, keyword: keyword.value.trim() || undefined })
    rows.value = data.tenant
    total.value = data.total
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(error instanceof Error ? error.message : '租客列表加载失败')
  } finally {
    loading.value = false
  }
}

function applySearch() { page.value = 1; load() }
function resetSearch() { keyword.value = ''; applySearch() }
function changePage(next: number) { page.value = next; load() }

function toggle(row: TenantOptionRow) {
  const index = picked.value.findIndex((item) => item.tenant_code === row.tenant_code)
  if (index >= 0) picked.value.splice(index, 1)
  else picked.value.push(row)
}

function remove(code: string) {
  const index = picked.value.findIndex((item) => item.tenant_code === code)
  if (index >= 0) picked.value.splice(index, 1)
}

function clearAll() { picked.value = [] }

function confirm() {
  emit('confirm', [...picked.value])
  open.value = false
}

// 每次打开时按外部已选值回填；已选但不在当前页的租客用编码占位，避免右侧丢失
watch(open, (visible) => {
  if (!visible) return
  const known = new Map(picked.value.map((item) => [item.tenant_code, item]))
  picked.value = props.selected.map((code) => known.get(code) || { tenant_code: code, tenant_name: code })
  keyword.value = ''
  page.value = 1
  load()
})
</script>

<template>
  <el-dialog v-model="open" title="选择绑定租客" width="920px" :close-on-click-modal="false">
    <div class="tenant-picker">
      <div class="tenant-picker__main">
        <div class="tenant-picker__search">
          <el-input v-model="keyword" clearable placeholder="按租客编码或名称搜索" @keyup.enter="applySearch" />
          <el-button @click="resetSearch">重置</el-button>
          <el-button type="primary" :loading="loading" @click="applySearch">搜索</el-button>
        </div>
        <el-table
          v-loading="loading"
          :data="rows"
          stripe
          height="380"
          table-layout="fixed"
          empty-text="没有符合条件的租客"
          @row-click="toggle"
        >
          <el-table-column label="" width="48">
            <template #default="scope">
              <el-checkbox :model-value="pickedCodes.has(scope.row.tenant_code)" @change="toggle(scope.row)" @click.stop />
            </template>
          </el-table-column>
          <el-table-column prop="tenant_name" label="租客名称" min-width="180" show-overflow-tooltip />
          <el-table-column prop="tenant_code" label="租客编码" min-width="200" show-overflow-tooltip>
            <template #default="scope"><span class="mono-label">{{ scope.row.tenant_code }}</span></template>
          </el-table-column>
        </el-table>
        <div class="tenant-picker__pager">
          <span>点击行可快速选中或取消</span>
          <el-pagination background layout="prev, pager, next" :page-size="pageSize" :total="total" :current-page="page" @current-change="changePage" />
        </div>
      </div>

      <aside class="tenant-picker__side">
        <div class="tenant-picker__side-head">
          <div><span class="mono-label">SELECTED</span><h4>已选 {{ picked.length }} 个</h4></div>
          <el-button link type="danger" :disabled="!picked.length" @click="clearAll">清空</el-button>
        </div>
        <ul v-if="picked.length" class="tenant-picker__list">
          <li v-for="item in picked" :key="item.tenant_code">
            <div>
              <strong>{{ item.tenant_name }}</strong>
              <code>{{ item.tenant_code }}</code>
            </div>
            <button type="button" aria-label="移除" @click="remove(item.tenant_code)">×</button>
          </li>
        </ul>
        <p v-else class="tenant-picker__empty">未选择租客时，该权限的可见性由「公开状态」决定。</p>
      </aside>
    </div>

    <template #footer>
      <el-button @click="open = false">取消</el-button>
      <el-button type="primary" @click="confirm">确定（{{ picked.length }}）</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.tenant-picker { display: grid; grid-template-columns: minmax(0, 1fr) 268px; gap: 18px; }
.tenant-picker__main { display: grid; gap: 12px; min-width: 0; }
.tenant-picker__search { display: flex; gap: 10px; }
.tenant-picker__search .el-input { flex: 1; }
.tenant-picker__main :deep(.el-table__row) { cursor: pointer; }
.tenant-picker__pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #8795a4; font-size: 12px; }

.tenant-picker__side { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 12px; padding: 16px; border: 1px solid var(--line); border-radius: 10px; background: #f8fafc; }
.tenant-picker__side-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.tenant-picker__side-head .mono-label { color: #8795a4; }
.tenant-picker__side-head h4 { margin: 4px 0 0; color: var(--cargo-ink); font-size: 15px; }

.tenant-picker__list { display: grid; gap: 8px; margin: 0; padding: 0; overflow-y: auto; list-style: none; align-content: start; }
.tenant-picker__list li { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
.tenant-picker__list li > div { display: grid; gap: 2px; min-width: 0; }
.tenant-picker__list strong { color: #33465a; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tenant-picker__list code { color: #8795a4; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tenant-picker__list button { border: none; background: none; color: #a3b0bd; cursor: pointer; font-size: 16px; line-height: 1; padding: 0 2px; }
.tenant-picker__list button:hover { color: #ad3e3e; }

.tenant-picker__empty { margin: 0; color: #8795a4; font-size: 12px; line-height: 1.7; }

@media (max-width: 900px) {
  .tenant-picker { grid-template-columns: minmax(0, 1fr); }
}
</style>
