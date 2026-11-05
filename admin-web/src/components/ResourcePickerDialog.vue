<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  searchPlatformApis,
  searchPlatformButtons,
  searchPlatformMenus,
  searchPlatformPermissions,
} from '@/api/platformAccessQueries'
import { queryPlatformApis, queryPlatformButtons, queryPlatformMenus, queryPlatformPermissions, flattenPermissionMenus } from '@/api/platformQueries'
import type { PermissionOwner, PermissionStatus } from '@/types/platform'

/** 可选择的资源类型 */
export type ResourceKind = 'menu' | 'button' | 'api' | 'permission'

/** 弹窗内统一的行结构：id 用于提交，name 用于展示，extra 为该类型的补充列 */
export interface ResourceRow {
  id: string
  name: string
  extra1?: string
  extra2?: string
  status?: number
  tenantIds?: string | null
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  kind: ResourceKind
  permissionOwner: PermissionOwner
  /** 已选中的 ID 列表（单选时长度为 0 或 1） */
  selected: string[]
  multiple?: boolean
  /** 按钮/接口可按上级前置过滤 */
  menuId?: string
  buttonId?: string
}>(), {
  multiple: false,
  menuId: '',
  buttonId: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [rows: ResourceRow[]]
}>()

const KIND_META: Record<ResourceKind, {
  title: string
  label: string
  idLabel: string
  nameLabel: string
  extra1Label: string
  extra2Label: string
  searchFields: Array<[string, string]>
  sortFields: Array<[string, string]>
  defaultSort: string
}> = {
  menu: {
    title: '选择菜单', label: '菜单', idLabel: '菜单 ID', nameLabel: '菜单名称', extra1Label: '', extra2Label: '',
    searchFields: [['menu_name', '菜单名称'], ['menu_id', '菜单 ID']],
    sortFields: [['menu_name', '菜单名称'], ['menu_id', '菜单 ID'], ['created_at', '创建时间']],
    defaultSort: 'menu_name',
  },
  button: {
    title: '选择按钮', label: '按钮', idLabel: '按钮 ID', nameLabel: '按钮名称', extra1Label: '所属菜单', extra2Label: '父按钮',
    searchFields: [['button_name', '按钮名称'], ['button_id', '按钮 ID'], ['menu_id', '所属菜单 ID'], ['parent_id', '父按钮 ID']],
    sortFields: [['button_name', '按钮名称'], ['button_id', '按钮 ID'], ['menu_id', '所属菜单 ID'], ['created_at', '创建时间']],
    defaultSort: 'button_name',
  },
  api: {
    title: '选择接口资源', label: '接口资源', idLabel: '接口 ID', nameLabel: '接口名称', extra1Label: '接口路径', extra2Label: '所属按钮',
    searchFields: [['api_name', '接口名称'], ['api_path', '接口路径'], ['api_id', '接口 ID'], ['button_id', '所属按钮 ID']],
    sortFields: [['api_name', '接口名称'], ['api_path', '接口路径'], ['api_id', '接口 ID'], ['created_at', '创建时间']],
    defaultSort: 'api_name',
  },
  permission: {
    title: '选择权限', label: '权限', idLabel: '权限编码', nameLabel: '权限名称', extra1Label: '权限类型', extra2Label: '功能 ID',
    searchFields: [['perm_name', '权限名称'], ['perm_code', '权限编码'], ['perm_type', '权限类型'], ['function_id', '功能 ID']],
    sortFields: [],
    defaultSort: '',
  },
}

const loading = ref(false)
const rows = ref<ResourceRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filters = reactive({ field: 'menu_name', keyword: '', sort_by: 'menu_name', sort_order: 'ASC' })
/** 权限专属：公开状态过滤，空表示同时查公开与未公开 */
const permStatus = ref<PermissionStatus | ''>('')
const picked = ref<ResourceRow[]>([])

const meta = computed(() => KIND_META[props.kind])
/** 权限搜索为平铺全量返回，无分页 */
const paginated = computed(() => props.kind !== 'permission')
const pickedIds = computed(() => new Set(picked.value.map((item) => item.id)))

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

async function load() {
  loading.value = true
  try {
    const keyword = filters.keyword.trim()
    const searchArgs = keyword
      ? { search_field: [filters.field], search_value: { [filters.field]: keyword } }
      : null
    const common = {
      page: page.value,
      page_size: pageSize,
      sort_by: filters.sort_by || undefined,
      sort_order: filters.sort_order,
      permission_owner: props.permissionOwner,
    }

    if (props.kind === 'menu') {
      const data = searchArgs ? await searchPlatformMenus({ ...common, ...searchArgs }) : await queryPlatformMenus(common)
      rows.value = data.menu.map((item) => ({ id: item.menu_id, name: item.menu_name }))
      total.value = data.total
    } else if (props.kind === 'button') {
      const scoped = props.menuId ? { ...common, menu_id: props.menuId } : common
      const data = searchArgs ? await searchPlatformButtons({ ...scoped, ...searchArgs }) : await queryPlatformButtons(scoped)
      rows.value = data.button.map((item) => ({
        id: item.button_id, name: item.button_name, extra1: item.menu_id, extra2: item.parent_id || '—',
      }))
      total.value = data.total
    } else if (props.kind === 'api') {
      const scoped = props.buttonId ? { ...common, button_id: props.buttonId } : common
      const data = searchArgs ? await searchPlatformApis({ ...scoped, ...searchArgs }) : await queryPlatformApis(scoped)
      rows.value = data.api.map((item) => ({
        id: item.api_id, name: item.api_name, extra1: item.api_path, extra2: item.button_id,
      }))
      total.value = data.total
    } else {
      // 权限：query 返回菜单-按钮-权限树，只有 perm_code/perm_name；需要完整字段时走 search
      if (searchArgs || permStatus.value) {
        const data = await searchPlatformPermissions({
          search_field: [searchArgs ? filters.field : 'perm_code'],
          search_value: searchArgs ? { [filters.field]: keyword } : { perm_code: 'perm' },
          permission_owner: props.permissionOwner,
          status: permStatus.value || undefined,
        })
        rows.value = data.permission.map((item) => ({
          id: item.perm_code, name: item.perm_name, extra1: item.perm_type,
          extra2: item.function_id || '—', status: item.status, tenantIds: item.tenant_ids,
        }))
        total.value = data.total
      } else {
        const data = await queryPlatformPermissions({ permission_owner: props.permissionOwner })
        rows.value = flattenPermissionMenus(data.menus).map((item) => ({ id: item.perm_code, name: item.perm_name }))
        total.value = rows.value.length
      }
    }
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(error instanceof Error ? error.message : `${meta.value.label}加载失败`)
  } finally {
    loading.value = false
  }
}

function applySearch() { page.value = 1; load() }
function resetSearch() {
  filters.field = meta.value.searchFields[0][0]
  filters.keyword = ''
  filters.sort_by = meta.value.defaultSort
  filters.sort_order = 'ASC'
  permStatus.value = ''
  applySearch()
}
function changePage(next: number) { page.value = next; load() }

function toggle(row: ResourceRow) {
  if (!props.multiple) {
    picked.value = [row]
    return
  }
  const index = picked.value.findIndex((item) => item.id === row.id)
  if (index >= 0) picked.value.splice(index, 1)
  else picked.value.push(row)
}

function remove(id: string) {
  const index = picked.value.findIndex((item) => item.id === id)
  if (index >= 0) picked.value.splice(index, 1)
}

function clearAll() { picked.value = [] }

function confirm() {
  emit('confirm', [...picked.value])
  open.value = false
}

// 打开时按外部已选值回填；已选但不在首页的记录用 ID 占位，避免右侧丢失
watch(open, (visible) => {
  if (!visible) return
  const known = new Map(picked.value.map((item) => [item.id, item]))
  picked.value = props.selected.filter(Boolean).map((id) => known.get(id) || { id, name: id })
  filters.field = meta.value.searchFields[0][0]
  filters.keyword = ''
  filters.sort_by = meta.value.defaultSort
  filters.sort_order = 'ASC'
  permStatus.value = ''
  page.value = 1
  load()
})
</script>

<template>
  <el-dialog v-model="open" :title="meta.title" width="1000px" :close-on-click-modal="false" class="resource-picker-dialog">
    <div class="resource-picker">
      <div class="resource-picker__main">
        <div class="resource-picker__filters">
          <label><span>搜索字段</span>
            <el-select v-model="filters.field"><el-option v-for="item in meta.searchFields" :key="item[0]" :label="item[1]" :value="item[0]" /></el-select>
          </label>
          <label class="resource-picker__filters-wide"><span>搜索内容</span>
            <el-input v-model="filters.keyword" clearable placeholder="留空则展示全部" @keyup.enter="applySearch" />
          </label>
          <label v-if="meta.sortFields.length"><span>排序字段</span>
            <el-select v-model="filters.sort_by"><el-option v-for="item in meta.sortFields" :key="item[0]" :label="item[1]" :value="item[0]" /></el-select>
          </label>
          <label v-if="meta.sortFields.length"><span>排序方向</span>
            <el-segmented v-model="filters.sort_order" :options="[{ label: '升序', value: 'ASC' }, { label: '降序', value: 'DESC' }]" />
          </label>
          <label v-if="kind === 'permission'"><span>公开状态</span>
            <el-select v-model="permStatus" @change="applySearch">
              <el-option label="全部" value="" />
              <el-option label="公开" :value="1" />
              <el-option label="未公开" :value="2" />
            </el-select>
          </label>
          <div class="resource-picker__filter-actions">
            <el-button @click="resetSearch">重置</el-button>
            <el-button type="primary" :loading="loading" @click="applySearch">查询</el-button>
          </div>
        </div>

        <el-table
          v-loading="loading"
          :data="rows"
          stripe
          height="360"
          table-layout="fixed"
          :empty-text="`没有符合条件的${meta.label}`"
          @row-click="toggle"
        >
          <el-table-column label="" width="48">
            <template #default="scope">
              <el-checkbox v-if="multiple" :model-value="pickedIds.has(scope.row.id)" @change="toggle(scope.row)" @click.stop />
              <el-radio v-else :model-value="pickedIds.has(scope.row.id) ? scope.row.id : ''" :value="scope.row.id" @click.stop="toggle(scope.row)"><span /></el-radio>
            </template>
          </el-table-column>
          <el-table-column prop="name" :label="meta.nameLabel" min-width="160" show-overflow-tooltip />
          <el-table-column prop="id" :label="meta.idLabel" min-width="170" show-overflow-tooltip>
            <template #default="scope"><span class="mono-label">{{ scope.row.id }}</span></template>
          </el-table-column>
          <el-table-column v-if="meta.extra1Label" prop="extra1" :label="meta.extra1Label" min-width="170" show-overflow-tooltip />
          <el-table-column v-if="meta.extra2Label" prop="extra2" :label="meta.extra2Label" min-width="150" show-overflow-tooltip />
          <el-table-column v-if="kind === 'permission'" label="公开状态" width="94" align="center">
            <template #default="scope">
              <span v-if="scope.row.status" class="status-pill" :class="Number(scope.row.status) === 1 ? 'is-success' : 'is-muted'">
                {{ Number(scope.row.status) === 1 ? '公开' : '未公开' }}
              </span>
              <span v-else>—</span>
            </template>
          </el-table-column>
        </el-table>

        <div class="resource-picker__pager">
          <span>{{ paginated ? '点击行可快速选中' : '权限一次性返回全部匹配记录，不分页' }}</span>
          <el-pagination v-if="paginated" background layout="prev, pager, next" :page-size="pageSize" :total="total" :current-page="page" @current-change="changePage" />
        </div>
      </div>

      <aside class="resource-picker__side">
        <div class="resource-picker__side-head">
          <div><span class="mono-label">SELECTED</span><h4>已选 {{ picked.length }} 项</h4></div>
          <el-button link type="danger" :disabled="!picked.length" @click="clearAll">清空</el-button>
        </div>
        <ul v-if="picked.length" class="resource-picker__list">
          <li v-for="item in picked" :key="item.id">
            <div><strong>{{ item.name }}</strong><code>{{ item.id }}</code></div>
            <button type="button" aria-label="移除" @click="remove(item.id)">×</button>
          </li>
        </ul>
        <p v-else class="resource-picker__empty">从左侧列表中点击行即可选择{{ meta.label }}。</p>
      </aside>
    </div>

    <template #footer>
      <el-button @click="open = false">取消</el-button>
      <el-button type="primary" :disabled="!picked.length" @click="confirm">确定（{{ picked.length }}）</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.resource-picker { display: grid; grid-template-columns: minmax(0, 1fr) 262px; gap: 18px; }
.resource-picker__main { display: grid; gap: 14px; min-width: 0; }

.resource-picker__filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr)); gap: 12px; align-items: end; padding: 16px; border: 1px solid var(--line); border-radius: 10px; background: #f8fafc; }
.resource-picker__filters label { display: grid; gap: 6px; min-width: 0; }
.resource-picker__filters label > span { color: #6b7c8e; font-size: 11px; font-weight: 650; letter-spacing: 0.04em; }
.resource-picker__filters-wide { grid-column: span 2; }
.resource-picker__filter-actions { display: flex; gap: 8px; }

.resource-picker__main :deep(.el-table__row) { cursor: pointer; }
.resource-picker__main :deep(.el-radio__label) { display: none; }
.resource-picker__pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #8795a4; font-size: 12px; }

.resource-picker__side { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 12px; padding: 16px; border: 1px solid var(--line); border-radius: 10px; background: #f8fafc; }
.resource-picker__side-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.resource-picker__side-head .mono-label { color: #8795a4; }
.resource-picker__side-head h4 { margin: 4px 0 0; color: var(--cargo-ink); font-size: 15px; }

.resource-picker__list { display: grid; gap: 8px; margin: 0; padding: 0; overflow-y: auto; list-style: none; align-content: start; }
.resource-picker__list li { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
.resource-picker__list li > div { display: grid; gap: 2px; min-width: 0; }
.resource-picker__list strong { color: #33465a; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.resource-picker__list code { color: #8795a4; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.resource-picker__list button { border: none; background: none; color: #a3b0bd; cursor: pointer; font-size: 16px; line-height: 1; padding: 0 2px; }
.resource-picker__list button:hover { color: #ad3e3e; }

.resource-picker__empty { margin: 0; color: #8795a4; font-size: 12px; line-height: 1.7; }

@media (max-width: 980px) {
  .resource-picker { grid-template-columns: minmax(0, 1fr); }
}
</style>
