<template>
  <el-dialog
    title="客户选择"
    :model-value="modelValue"
    width="960px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div class="select-layout">
      <div class="left-panel">
        <el-form :model="filter" inline size="small" class="filter-form">
          <el-form-item label="客户编号">
            <el-input v-model="filter.code" placeholder="请输入" clearable style="width:120px" />
          </el-form-item>
          <el-form-item label="客户名称">
            <el-input v-model="filter.name" placeholder="请输入" clearable style="width:140px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" size="small" @click="handleSearch">查询</el-button>
            <el-button size="small" @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>
        <el-table
          ref="tableRef"
          :data="list"
          size="small"
          row-key="id"
          style="width:100%"
          height="360"
          highlight-current-row
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
        >
          <el-table-column type="selection" width="40" />
          <el-table-column type="index" label="序号" width="55" align="center" />
          <el-table-column prop="code" label="客户编号" width="110" show-overflow-tooltip />
          <el-table-column prop="name" label="客户名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="address" label="公司地址" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ row.address || '-' }}</template>
          </el-table-column>
          <el-table-column prop="type" label="客户类型" width="100" />
          <el-table-column prop="settleType" label="是否月结" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.settleType === '是' ? 'success' : 'info'" size="small">{{ row.settleType || '否' }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-bar">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            small
            @change="loadData"
          />
        </div>
      </div>
      <div class="right-panel">
        <div class="right-title">当前已选择 {{ selected.length }} 项：</div>
        <ul class="selected-list">
          <li v-for="item in selected" :key="item.id" class="selected-item">
            <span class="selected-name">{{ item.name }}</span>
          </li>
          <li v-if="selected.length === 0" class="empty-tip">暂未选择</li>
        </ul>
      </div>
    </div>
    <template #footer>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { getCustomerList, type CustomerItem } from '@/api'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'confirm': [customer: CustomerItem]
}>()

const tableRef = ref()
const list = ref<CustomerItem[]>([])
const selected = ref<CustomerItem[]>([])
const filter = reactive({ code: '', name: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const fallback: CustomerItem[] = [
  { id: '1', code: 'C001', name: '广州百诺建材有限公司', shortName: '', type: '零售客户', category: '', areaId: '', areaName: '', source: '', level: '大型', industry: '', contactPerson: '张总', contactPhone: '13800138001', contactEmail: '', province: '广东', city: '广州', district: '', address: '广州市天河区某路1号', creditCode: '', taxNo: '', bankName: '', bankAccount: '', openingBank: '', invoiceTitle: '', invoicePhone: '', invoiceAddress: '', settleType: '是', creditAmount: 0, creditDays: 30, status: '正常', isFormal: true, isNewDevelop: false, salesUserId: '', salesUserName: '', remark: '', createTime: '', updateTime: '', createUserId: '', createUserName: '' },
  { id: '2', code: 'C002', name: '深圳鑫源五金贸易', shortName: '', type: '批发客户', category: '', areaId: '', areaName: '', source: '', level: '中型', industry: '', contactPerson: '王经理', contactPhone: '13900139002', contactEmail: '', province: '广东', city: '深圳', district: '', address: '深圳市南山区某路2号', creditCode: '', taxNo: '', bankName: '', bankAccount: '', openingBank: '', invoiceTitle: '', invoicePhone: '', invoiceAddress: '', settleType: '否', creditAmount: 0, creditDays: 0, status: '正常', isFormal: true, isNewDevelop: false, salesUserId: '', salesUserName: '', remark: '', createTime: '', updateTime: '', createUserId: '', createUserName: '' },
  { id: '3', code: 'C003', name: '东莞宏达装饰材料', shortName: '', type: 'VIP客户', category: '', areaId: '', areaName: '', source: '', level: '中型', industry: '', contactPerson: '李老板', contactPhone: '13700137003', contactEmail: '', province: '广东', city: '东莞', district: '', address: '东莞市长安镇某路3号', creditCode: '', taxNo: '', bankName: '', bankAccount: '', openingBank: '', invoiceTitle: '', invoicePhone: '', invoiceAddress: '', settleType: '是', creditAmount: 0, creditDays: 30, status: '正常', isFormal: true, isNewDevelop: false, salesUserId: '', salesUserName: '', remark: '', createTime: '', updateTime: '', createUserId: '', createUserName: '' },
]

function onOpen() { selected.value = []; loadData() }

async function loadData() {
  try {
    const res = await getCustomerList({ ...filter, isFormal: true, page: pagination.page, pageSize: pagination.pageSize })
    list.value = res.data.list
    pagination.total = res.data.total
  } catch {
    const filtered = fallback.filter(r => {
      if (filter.code && !r.code.includes(filter.code)) return false
      if (filter.name && !r.name.includes(filter.name)) return false
      return true
    })
    const start = (pagination.page - 1) * pagination.pageSize
    list.value = filtered.slice(start, start + pagination.pageSize)
    pagination.total = filtered.length
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() { Object.assign(filter, { code: '', name: '' }); handleSearch() }
function handleSelectionChange(val: CustomerItem[]) { selected.value = val }

function handleRowClick(row: CustomerItem) {
  tableRef.value?.clearSelection()
  tableRef.value?.toggleRowSelection(row, true)
}

function handleConfirm() {
  if (selected.value.length === 0) { ElMessage.warning('请选择一个客户'); return }
  if (selected.value.length > 1) { ElMessage.warning('只能选择一个客户'); return }
  emit('confirm', selected.value[0])
  handleClose()
}

function handleClose() { emit('update:modelValue', false) }
</script>

<style scoped>
.select-layout { display: flex; gap: 12px; height: 480px; overflow: hidden; }
.left-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.filter-form { flex-shrink: 0; padding-bottom: 8px; border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 8px; }
.pagination-bar { flex-shrink: 0; padding-top: 8px; display: flex; justify-content: flex-end; }
.right-panel { flex-shrink: 0; width: 160px; border-left: 1px solid var(--el-border-color-light); padding: 0 10px; display: flex; flex-direction: column; overflow: hidden; }
.right-title { font-size: 13px; font-weight: 500; color: var(--el-text-color-primary); margin-bottom: 8px; flex-shrink: 0; }
.selected-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
.selected-item { padding: 5px 4px; font-size: 12px; color: var(--el-text-color-regular); }
.empty-tip { font-size: 12px; color: var(--el-text-color-placeholder); text-align: center; padding: 20px 0; }
</style>
