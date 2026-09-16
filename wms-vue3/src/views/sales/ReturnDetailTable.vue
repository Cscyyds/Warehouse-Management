<template>
  <div class="return-detail-table">
    <!-- 统计区 -->
    <div v-if="rows.length" class="summary-bar">
      <div class="summary-item">
        <span class="summary-label">退货商品数量</span>
        <span class="summary-value">{{ rows.length }}</span>
      </div>
      <div class="summary-divider" />
      <div class="summary-item">
        <span class="summary-label">退货总数量</span>
        <span class="summary-value">{{ totalQty }}</span>
      </div>
      <div class="summary-divider" />
      <div class="summary-item">
        <span class="summary-label">退货金额</span>
        <span class="summary-value amount">¥{{ totalAmount }}</span>
      </div>
    </div>

    <!-- 空态 -->
    <div v-if="!rows.length" class="empty-state">
      <el-empty description="暂无退货明细" :image-size="64">
        <el-button type="primary" plain @click="$emit('add')">
          <el-icon><Plus /></el-icon>选择退货明细
        </el-button>
      </el-empty>
    </div>

    <!-- 表格 -->
    <el-table
      v-else
      :data="rows"
      border
      size="small"
      style="width:100%"
      :row-class-name="() => 'detail-row'"
    >
      <!-- 序号 -->
      <el-table-column type="index" label="序号" width="55" align="center" fixed="left" />

      <!-- 商品信息（合并编码+名称） -->
      <el-table-column label="商品信息" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="product-cell">
            <div class="product-name">{{ row.product_name }}</div>
            <div class="product-meta">
              <span class="product-code">{{ row.product_code }}</span>
              <span v-if="row.unit_name" class="product-unit">{{ row.unit_name }}</span>
              <span v-if="row.sales_order_no" class="product-order">单号：{{ row.sales_order_no }}</span>
            </div>
          </div>
        </template>
      </el-table-column>

      <!-- 可退余量 -->
      <el-table-column label="可退余量" width="90" align="center">
        <template #default="{ row }">
          <div class="remaining-cell">
            <span class="remaining-label">可退</span>
            <span class="remaining-value" :class="{ 'is-zero': Number(row.remaining) === 0 }">
              {{ row.remaining }}
            </span>
          </div>
        </template>
      </el-table-column>

      <!-- 仓库状态（决定本行可编辑范围） -->
      <el-table-column label="仓库状态" width="110" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="warehouseTagType(row)">{{ warehouseStatusText(row) }}</el-tag>
        </template>
      </el-table-column>

      <!-- 退货数量（步进器） -->
      <el-table-column label="退货数量" width="140" align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="row.return_qty"
            :min="minQty(row)"
            :max="Number(row.remaining) || 9999"
            :precision="0"
            :disabled="!canEditQty(row)"
            controls-position="right"
            size="small"
            style="width:120px"
          />
        </template>
      </el-table-column>

      <!-- 退货单价 -->
      <el-table-column label="退货单价" width="130" align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="row.return_price"
            :min="0"
            :precision="4"
            :disabled="!canEditAll(row)"
            controls-position="right"
            size="small"
            style="width:115px"
          />
        </template>
      </el-table-column>

      <!-- 产品状态（tag 点击切换） -->
      <el-table-column label="产品状态" width="120" align="center">
        <template #default="{ row }">
          <!-- 仓库已处理的明细：后端禁止改非数量字段，前端直接锁为只读展示 -->
          <el-tag
            v-if="!canEditAll(row)"
            :type="statusTagType(row.product_status)"
            size="small"
            effect="light"
          >
            {{ row.product_status || '完好' }}
          </el-tag>
          <el-dropdown v-else trigger="click" @command="(v: string) => row.product_status = v">
            <el-tag
              :type="statusTagType(row.product_status)"
              size="small"
              style="cursor:pointer"
              effect="light"
            >
              {{ row.product_status || '完好' }}
              <el-icon style="margin-left:2px;font-size:10px"><ArrowDown /></el-icon>
            </el-tag>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="opt in STATUS_OPTIONS"
                  :key="opt.value"
                  :command="opt.value"
                >
                  <el-tag :type="opt.tagType" size="small" effect="light" style="width:80px;text-align:center">
                    {{ opt.label }}
                  </el-tag>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>

      <!-- 备注（点击展开） -->
      <el-table-column label="备注" min-width="150">
        <template #default="{ row }">
          <!-- 仓库已处理的明细：备注不可改（后端拒绝提交），只做纯文本展示 -->
          <div v-if="!canEditAll(row)" class="remark-cell is-locked">
            <span v-if="row.remark" class="remark-text">{{ row.remark }}</span>
            <span v-else class="remark-placeholder">不可编辑</span>
          </div>
          <div v-else class="remark-cell" @click="startEditRemark(row)">
            <template v-if="editingRemarkRow === row">
              <el-input
                v-model="row.remark"
                size="small"
                placeholder="输入备注"
                autofocus
                @blur="editingRemarkRow = null"
                @keyup.enter="editingRemarkRow = null"
              />
            </template>
            <template v-else>
              <span v-if="row.remark" class="remark-text">{{ row.remark }}</span>
              <span v-else class="remark-placeholder">点击添加备注</span>
            </template>
          </div>
        </template>
      </el-table-column>

      <!-- 操作 -->
      <el-table-column label="操作" :width="global_opt_width" align="center" fixed="right">
        <template #default="{ row, $index }">
          <el-tooltip :content="deleteTip(row)" placement="top">
            <el-button
              text
              size="small"
              class="delete-btn"
              :icon="Delete"
              :disabled="!canDelete(row)"
              @click="handleDelete($index)"
            />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <!-- 有数据时底部添加按钮 -->
    <div v-if="rows.length" class="add-row-area">
      <el-button size="small" plain @click="$emit('add')">
        <el-icon><Plus /></el-icon>继续添加明细
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { global_opt_width } from '@/utils/data'
import { ref, computed } from 'vue'
import { Delete, Plus, ArrowDown } from '@element-plus/icons-vue'

const props = defineProps<{ rows: any[] }>()
const emit = defineEmits<{
  add: []
  remove: [index: number]
}>()

const editingRemarkRow = ref<any>(null)

const STATUS_OPTIONS = [
  { label: '完好', value: '完好', tagType: 'success' },
  { label: '轻微损坏', value: '轻微损坏', tagType: 'warning' },
  { label: '严重损坏', value: '严重损坏', tagType: 'danger' },
  { label: '报废', value: '报废', tagType: 'info' },
] as const

function statusTagType(status: string) {
  const map: Record<string, string> = {
    '完好': 'success', '轻微损坏': 'warning', '严重损坏': 'danger', '报废': 'info'
  }
  return map[status] || 'success'
}

/* ── 明细级可编辑性分级 ───────────────────────────────────────────────
 * 与后端 items/update、items/delete 的「仓库操作状态分级」保持一致：
 *   已确认完成（warehouse_task_status === 1）→ 整条禁改禁删
 *   已入库未确认（actual_in_stock_qty > 0）  → 仅可改数量，禁删
 *   未操作 / 本次新增                        → 全部可改可删
 * 前端按同一口径禁用控件，避免用户改完保存时才被后端 400 驳回。
 */
function isNewRow(row: any) {
  return !String(row?.sales_return_item_id || '').trim()
}
function isRowLocked(row: any) {
  return !isNewRow(row) && Number(row?.warehouse_task_status || 0) === 1
}
function isRowQtyOnly(row: any) {
  return !isNewRow(row) && !isRowLocked(row) && Number(row?.actual_in_stock_qty || 0) > 0
}
function canEditAll(row: any) {
  return isNewRow(row) || (!isRowLocked(row) && !isRowQtyOnly(row))
}
function canEditQty(row: any) {
  return isNewRow(row) || !isRowLocked(row)
}
function canDelete(row: any) {
  return isNewRow(row) || (!isRowLocked(row) && !isRowQtyOnly(row))
}
/** 已入库明细改后数量不得低于仓库已操作数量，步进器下限同步收紧 */
function minQty(row: any) {
  return isRowQtyOnly(row) ? Number(row.actual_in_stock_qty) : 1
}
function warehouseStatusText(row: any) {
  if (isNewRow(row)) return '待新增'
  if (isRowLocked(row)) return '仓库已确认'
  if (isRowQtyOnly(row)) return `已入库 ${row.actual_in_stock_qty}`
  return '待处理'
}
function warehouseTagType(row: any) {
  if (isNewRow(row)) return 'warning'
  if (isRowLocked(row)) return 'info'
  if (isRowQtyOnly(row)) return 'primary'
  return 'success'
}
function deleteTip(row: any) {
  if (isRowLocked(row)) return '该明细仓库已确认完成，请联系仓库处理'
  if (isRowQtyOnly(row)) return '该明细已有仓库入库操作记录，无法删除'
  return '删除'
}

function startEditRemark(row: any) {
  editingRemarkRow.value = row
}

function handleDelete(index: number) {
  // 确认弹窗与删除执行统一由 AddTemplate 的 removeDynamicRow 负责，此处直接上抛避免二次确认
  emit('remove', index)
}

const totalQty = computed(() => props.rows.reduce((s, r) => s + (Number(r.return_qty) || 0), 0))
const totalAmount = computed(() => {
  const val = props.rows.reduce((s, r) => s + (Number(r.return_qty) || 0) * (Number(r.return_price) || 0), 0)
  return val.toFixed(2)
})
</script>

<style scoped>
.return-detail-table { display: flex; flex-direction: column; gap: 12px; width: 100%; }

/* 统计栏 */
.summary-bar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 10px 16px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.summary-item { display: flex; align-items: center; gap: 8px; padding: 0 20px; }
.summary-item:first-child { padding-left: 4px; }
.summary-label { font-size: 12px; color: var(--el-text-color-secondary); }
.summary-value { font-size: 15px; font-weight: 600; color: var(--el-text-color-primary); }
.summary-value.amount { color: var(--el-color-danger); }
.summary-divider { width: 1px; height: 24px; background: var(--el-border-color); }

/* 产品信息 */
.product-cell { display: flex; flex-direction: column; gap: 3px; padding: 4px 0; }
.product-name { font-size: 13px; font-weight: 500; color: var(--el-text-color-primary); line-height: 1.4; }
.product-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.product-code { font-size: 11px; color: var(--el-text-color-secondary); font-family: monospace; }
.product-unit { font-size: 11px; color: var(--el-text-color-placeholder); background: var(--el-fill-color); padding: 1px 5px; border-radius: 3px; }
.product-order { font-size: 11px; color: var(--el-text-color-placeholder); }

/* 可退余量 */
.remaining-cell { display: flex; flex-direction: column; align-items: center; line-height: 1.3; }
.remaining-label { font-size: 10px; color: var(--el-text-color-placeholder); }
.remaining-value { font-size: 14px; font-weight: 600; color: var(--el-color-success); }
.remaining-value.is-zero { color: var(--el-color-danger); }

/* 备注 */
.remark-cell { cursor: pointer; min-height: 28px; display: flex; align-items: center; }
.remark-cell.is-locked { cursor: not-allowed; }
.remark-text { font-size: 12px; color: var(--el-text-color-regular); }
.remark-placeholder { font-size: 12px; color: var(--el-text-color-placeholder); font-style: italic; }
.remark-cell:hover .remark-placeholder { color: var(--el-color-primary); }

/* 删除按钮 */
.delete-btn { color: var(--el-text-color-placeholder) !important; }
.delete-btn:hover { color: var(--el-color-danger) !important; }

/* 添加按钮 */
.add-row-area { display: flex; justify-content: flex-start; }

/* 表格行高 */
:deep(.detail-row td) { padding: 6px 0; }
</style>
