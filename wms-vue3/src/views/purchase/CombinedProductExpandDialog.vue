<template>
  <el-dialog
    v-model="visible"
    :title="isSales ? '组合产品展开（选择要加入订单明细的产品）' : '组合产品展开（选择要采购的产品）'"
    width="1150px"
    top="6vh"
    :close-on-click-modal="false"
    @closed="onClosed"
  >
    <el-alert
      v-if="loadError"
      type="error"
      :closable="false"
      show-icon
      class="dlg-alert"
      :title="loadError"
    />
    <el-alert
      v-else-if="distinctSupplierCount > 1"
      type="info"
      :closable="false"
      show-icon
      class="dlg-alert"
      :title="`本次涉及 ${distinctSupplierCount} 个不同供应商，可自由勾选`"
      :description="isSales
        ? '不限制供应商归属；组合产品可整组、也可展开到子产品。确认后将作为明细行加入当前单据。'
        : '不限制供应商归属；组合产品可整组采购、也可展开到子产品。每行会保留自己的供应商，后续可按供应商拆分为多张采购订单。'"
    />

    <div class="tree-toolbar">
      <div class="tree-toolbar-left">
        <el-button size="small" @click="expandAll">展开全部</el-button>
        <el-button size="small" @click="collapseAll">折叠全部</el-button>
        <el-button size="small" :disabled="loading" @click="loadTree">刷新</el-button>
      </div>
      <div class="tree-toolbar-right">
        <el-checkbox v-model="onlySelectable" label="仅显示可勾选" />
      </div>
    </div>
    <div class="tree-hint">
      勾选规则：某一级展开后，该级产品本身不可勾选，只能勾选它展开出来的下一级——组装件与零件不可同时勾选。
      想买整个组装件，请先点「折叠全部」把它收起来。
      <span v-if="hierConflicts.size" class="tree-hint-em">当前有 {{ hierConflicts.size }} 行与已勾选行互斥。</span>
    </div>

    <div class="tree-wrapper" v-loading="loading">
      <div v-if="!loading && !visibleRows.length" class="tree-empty">
        <el-empty :description="emptyText" :image-size="72" />
      </div>
      <!--
        checkStrictly 必须为 true：Element Plus 默认 false 时
        ① toggleRowStatus（util.mjs:164）会级联勾选该行全部后代；
        ② updateSelectionByChildren（store/watcher.mjs:131）会把「子节点全选」的父行自动塞进 selection。
        二者让勾父行顺带选中整棵子树，使互斥规则自我触发（刚勾的行立刻被标「与已选互斥」）。
        本表要求父子勾选完全独立，由 isRowSelectable 单独裁决。
      -->
      <el-table
        v-else
        ref="treeTableRef"
        :data="visibleRows"
        row-key="__rowKey"
        :tree-props="{ children: 'children', checkStrictly: true }"
        :expand-row-keys="expandedKeys"
        border
        size="small"
        height="420"
        style="width:100%"
        @selection-change="onSelectionChange"
        @expand-change="onExpandChange"
      >
        <!-- 可勾选 = 未展开 且 有供应商绑定 且 未在本单 且 不与已勾选行构成组装件/零件关系 -->
        <el-table-column type="selection" width="52" align="center" :selectable="isRowSelectable" />
        <el-table-column label="产品编码" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="cell-text">{{ row.__code || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="产品名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="cell-text">{{ row.__name || '-' }}</span>
            <el-tag v-if="row.__depth === 1 && row.__fromCombined" size="small" type="success" class="src-tag">组合展开</el-tag>
            <!-- 展开的那一级不可勾选：要买它就先折叠 -->
            <el-tag v-if="expandedKeySet.has(row.__rowKey)" size="small" type="warning" class="src-tag">已展开</el-tag>
            <el-tag v-else-if="hierConflicts.has(row.__rowKey)" size="small" type="info" class="src-tag">与已选互斥</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="层级" width="76" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.__depth === 0 ? 'primary' : 'info'">
              {{ row.__depth === 0 ? '顶级' : `第${row.__depth}层` }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="76" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.__isCombined ? 'warning' : 'info'">
              {{ row.__isCombined ? '组合' : '普通' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="组合数量" width="86" align="center">
          <template #default="{ row }">
            <span class="cell-text">{{ row.__combNum === null ? '-' : row.__combNum }}</span>
          </template>
        </el-table-column>
        <el-table-column label="供应商" min-width="180">
          <template #default="{ row }">
            <template v-if="!row.__suppliers.length">
              <el-tag size="small" type="danger">未绑定供应商</el-tag>
            </template>
            <!-- 多个供应商可选：决定该行后续归入哪张采购订单（按供应商拆分时按此分组） -->
            <el-select
              v-else-if="row.__suppliers.length > 1"
              v-model="row.__supplierId"
              size="small"
              style="width:100%"
              @change="onSupplierChange(row)"
            >
              <el-option
                v-for="s in row.__suppliers"
                :key="s.supplier_id"
                :label="s.supplier_name || s.supplier_id"
                :value="s.supplier_id"
              />
            </el-select>
            <span v-else class="cell-text">{{ row.__supplierName || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="预设采购价" width="120" align="right">
          <template #default="{ row }">
            <span class="cell-text">{{ row.__presetPrice || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="采购数量" width="120" align="center">
          <template #default="{ row }">
            <el-input
              v-if="isRowSelectable(row)"
              v-model="row.__qty"
              size="small"
              placeholder="1"
              @input="onQtyInput(row)"
            />
            <span v-else-if="row.__blocked === 'excluded'" class="cell-muted">已在本单</span>
            <span v-else-if="expandedKeySet.has(row.__rowKey)" class="cell-muted">已展开，请选下级</span>
            <span v-else-if="hierConflicts.has(row.__rowKey)" class="cell-muted">与已选互斥</span>
            <span v-else class="cell-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column v-if="sourcesVisible" label="来源" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="cell-muted">{{ row.__sources.join('、') || '-' }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="summary" v-if="!loading && !loadError">
      已勾选 <b class="hl">{{ selectedPurchasableRows.length }}</b> 项，确认后将作为明细行加入本单。
      <span v-if="!isSales && selectedSupplierCount > 1" class="summary-sum">
        涉及 <b>{{ selectedSupplierCount }}</b> 个供应商，可在明细中按供应商拆分生成多张采购订单
      </span>
      <span v-if="!isSales && selectedSumPrice" class="summary-sum">预设价合计 ¥{{ selectedSumPrice }}</span>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button
        type="primary"
        :disabled="!selectedPurchasableRows.length"
        :loading="submitting"
        @click="handleConfirm"
      >加入{{ isSales ? '订单' : '采购' }}明细（{{ selectedPurchasableRows.length }}）</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { batchPreviewProducts, searchProduct, type BatchPreviewSupplier, type ProductItem } from '@/api'

/** 树行：batch-preview 节点 + 展示/勾选控制字段 */
interface ExpandTreeRow {
  __rowKey: string
  __productId: string
  __code: string
  __name: string
  __depth: number
  __isCombined: boolean
  /** 该节点自身的组合绑定数量（顶级行为 null） */
  __combNum: number | null
  /** 各层 num 累乘后的默认采购数量 */
  __defaultQty: number
  /** 用户可编辑数量（字符串中间态） */
  __qty: string
  __suppliers: BatchPreviewSupplier[]
  __supplierId: string
  __supplierName: string
  __presetPrice: string
  /** 不可勾选原因：'' 可勾选 */
  __blocked: '' | 'no-supplier' | 'excluded'
  /** 来源组合产品名（多个组合共享同一子产品时聚合） */
  __sources: string[]
  __fromCombined: boolean
  children: ExpandTreeRow[]
}

/** 落入明细的行（key 与 AddTemplate 明细行一致；采购/销售场景由调用方按需取用字段） */
export interface PurchaseItemRow {
  product_id: string
  product_code: string
  product_name: string
  category_name: string
  unit_name: string
  unit_id: string
  available_stock: string | null
  qty: number
  /** 采购价：仅采购场景有意义（销售场景由调用方忽略，价格留空由用户填写） */
  purchase_price: string
  /** 预设价标记：与 AddTemplate.isPresetPriceCell 约定一致，用于灰色弱化展示 */
  _preset_price?: string
  /** 该行归属供应商：不提交后端（下划线前缀为内部字段），供采购「按供应商拆分」分组用 */
  _supplier_id?: string
  _supplier_name?: string
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  /** 用户在选品弹窗中勾选的组合产品 ID（至少 1 个），仅展开这些产品的结构树 */
  productIds: string[]
  /** 同批次勾选的普通产品：作为顶级行一并展示，与本单供应商一致时可直接勾选 */
  plainProducts?: ProductItem[]
  /** 本单已选供应商：用于校验子产品供应商归属，并预填该供应商的预设采购价 */
  supplierId?: string
  /** 已在明细中的产品 ID：不可重复勾选 */
  excludeIds?: string[]
  /** 业务场景：采购（提及供应商拆分）/ 销售（仅添加产品，无拆分语义） */
  scene?: 'purchase' | 'sales'
}>(), {
  modelValue: false,
  productIds: () => [],
  plainProducts: () => [],
  supplierId: '',
  excludeIds: () => [],
  scene: 'purchase',
})

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  confirm: [rows: PurchaseItemRow[]]
}>()

/** 销售场景：无按供应商拆分语义，文案不再提采购 */
const isSales = computed(() => props.scene === 'sales')

const visible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val),
})

const treeTableRef = ref()
const loading = ref(false)
const submitting = ref(false)
const loadError = ref('')
const treeRows = ref<ExpandTreeRow[]>([])
const expandedKeys = ref<string[]>([])
const selectedRows = ref<ExpandTreeRow[]>([])
const onlySelectable = ref(false)

const orderSupplierId = computed(() => String(props.supplierId || '').trim())
const excludedIdSet = computed(() => new Set((props.excludeIds || []).map(String)))

const sourcesVisible = computed(() => {
  const all = new Set<string>()
  const walk = (rows: ExpandTreeRow[]) => {
    rows.forEach((r) => {
      r.__sources.forEach(s => all.add(s))
      if (r.children?.length) walk(r.children)
    })
  }
  walk(treeRows.value)
  return all.size > 1
})

function flatten(rows: ExpandTreeRow[], out: ExpandTreeRow[] = []): ExpandTreeRow[] {
  rows.forEach((r) => {
    out.push(r)
    if (r.children?.length) flatten(r.children, out)
  })
  return out
}

/** 树中可采购行涉及的供应商去重数量（>1 时提示后续可按供应商拆分） */
const distinctSupplierCount = computed(() => {
  const ids = new Set<string>()
  flatten(treeRows.value).forEach((r) => {
    if (r.__blocked === '' && r.__supplierId) ids.add(String(r.__supplierId))
  })
  return ids.size
})

/** 当前处于展开态的行 key 集合（展开的那一级不可勾选） */
const expandedKeySet = computed(() => new Set(expandedKeys.value))

/**
 * 可勾选判定，按优先级依次排除：
 * 1. 已展开 —— 展开某一级后只能勾选它展开出来的下级，该级自身不可勾（组装件与零件不可同时采购）
 * 2. 无供应商绑定 / 已在本单
 * 3. 兜底：与已勾选行构成祖先-后代关系（覆盖「先勾下级、再折叠、又想勾上级」的情况）
 */
function isRowSelectable(row: ExpandTreeRow): boolean {
  if (expandedKeySet.value.has(row.__rowKey)) return false
  if (row.__blocked !== '') return false
  if (hierConflicts.value.has(row.__rowKey)) return false
  return true
}

/**
 * 展开/折叠同步：把用户的手工展开写回 expandedKeys（受控 prop 不会自动回写）。
 * 展开一个已勾选的行时取消它的勾选（展开即表示「改买里面的零件」）；
 * 折叠时清掉被折叠隐藏的勾选（隐藏的勾选仍会参与互斥判定，会让用户看到「莫名互斥」）。
 */
function onExpandChange(row: ExpandTreeRow, expanded: boolean) {
  const key = row.__rowKey
  const set = new Set(expandedKeys.value)
  if (expanded) set.add(key)
  else set.delete(key)
  expandedKeys.value = Array.from(set)
  if (expanded) {
    dropSelectedExpanded()
  } else {
    const dropped = pruneHiddenSelection()
    if (dropped) ElMessage.info(`已取消折叠区域内 ${dropped} 项的勾选（折叠表示改选当前层级）`)
  }
}

/**
 * 当前实际渲染出来的行 key 集合：顶层恒可见，子行仅在其所有祖先都处于展开态时可见。
 * Element Plus 折叠只改内部 treeData.expanded，**不会**清理 selection
 * （见 element-plus/es/components/table/src/store/tree.mjs，全文不含 selection），
 * 所以必须自己保证「不存在被隐藏的勾选」。
 */
function renderedRowKeys(): Set<string> {
  const keys = new Set<string>()
  const walk = (rows: ExpandTreeRow[], ancestorsExpanded: boolean) => {
    rows.forEach((row) => {
      if (ancestorsExpanded) keys.add(row.__rowKey)
      if (row.children?.length) {
        walk(row.children, ancestorsExpanded && expandedKeySet.value.has(row.__rowKey))
      }
    })
  }
  walk(treeRows.value, true)
  return keys
}

/** 当前可见行 key 集合（响应式）；用于剔除被折叠隐藏的勾选 */
const renderedKeySet = computed(() => renderedRowKeys())

/**
 * 丢弃「已被折叠隐藏」的勾选，返回丢弃条数。
 * 用 clearSelection + 重新勾选可见项实现：折叠态下逐个 toggleRowSelection 不可靠
 * （隐藏行不在 el-table 的可见 data 里）。
 */
function pruneHiddenSelection(): number {
  const kept = selectedRows.value.filter(r => renderedKeySet.value.has(r.__rowKey))
  const dropped = selectedRows.value.length - kept.length
  if (!dropped) return 0
  treeTableRef.value?.clearSelection()
  kept.forEach(r => treeTableRef.value?.toggleRowSelection(r, true))
  return dropped
}

/**
 * 层级互斥集合：某行的祖先或后代一旦被勾选，该行即不可勾选。
 * 递归返回「该子树内是否存在已勾选行」，用于向上标记父级。
 */
const hierConflicts = computed<Set<string>>(() => {
  const selectedKeys = new Set(selectedRows.value.map(r => r.__rowKey))
  const conflicts = new Set<string>()
  const walk = (rows: ExpandTreeRow[], ancestorSelected: boolean): boolean => {
    let subtreeSelected = false
    rows.forEach((row) => {
      const selfSelected = selectedKeys.has(row.__rowKey)
      const childSelected = row.children?.length
        ? walk(row.children, ancestorSelected || selfSelected)
        : false
      // 祖先已选（自己是零件）或后代已选（自己是组装件）→ 与自己互斥
      if (ancestorSelected || childSelected) conflicts.add(row.__rowKey)
      if (selfSelected || childSelected) subtreeSelected = true
    })
    return subtreeSelected
  }
  walk(treeRows.value, false)
  return conflicts
})

const visibleRows = computed<ExpandTreeRow[]>(() => {
  if (!onlySelectable.value) return treeRows.value
  const prune = (rows: ExpandTreeRow[]): ExpandTreeRow[] => rows
    .map(r => ({ ...r, children: r.children?.length ? prune(r.children) : [] }))
    .filter(r => (r.children?.length ?? 0) > 0 || isRowSelectable(r))
  return prune(treeRows.value)
})

const selectedPurchasableRows = computed(() =>
  // 再叠一层「当前可见」过滤：被折叠隐藏的勾选不得进入提交载荷
  selectedRows.value.filter(r => renderedKeySet.value.has(r.__rowKey) && isRowSelectable(r) && Number(r.__qty) > 0),
)

/** 已勾选项涉及的供应商去重数量：>1 时提示可按供应商拆分 */
const selectedSupplierCount = computed(() => {
  const ids = new Set<string>()
  selectedPurchasableRows.value.forEach((r) => {
    if (r.__supplierId) ids.add(String(r.__supplierId))
  })
  return ids.size
})

const selectedSumPrice = computed(() => {
  const total = selectedPurchasableRows.value.reduce(
    (sum, r) => sum + (Number(r.__presetPrice) || 0) * (Number(r.__qty) || 0), 0,
  )
  return total ? total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
})

const emptyText = computed(() => {
  if (loadError.value) return '数据加载失败'
  return '该组合产品下暂无可勾选的产品'
})

/**
 * 判定不可勾选原因（顺序：已在本单 > 未绑定供应商）。
 * 注意：**不限制供应商是否属于本单** —— 子产品可来自任意供应商，后续按供应商拆分生成采购订单。
 * 仅「未绑定任何供应商」不可勾选：无法确定归属供应商，拆分时无法分组、也无法取预设采购价。
 */
function resolveBlocked(productId: string, suppliers: BatchPreviewSupplier[]): {
  blocked: ExpandTreeRow['__blocked']; supplierId: string; supplierName: string; presetPrice: string
} {
  if (excludedIdSet.value.has(productId)) {
    return { blocked: 'excluded', supplierId: '', supplierName: '', presetPrice: '' }
  }
  if (!suppliers.length) {
    return { blocked: 'no-supplier', supplierId: '', supplierName: '', presetPrice: '' }
  }
  // 本单供应商命中则优先选中（最可能的采购意图）；否则取第一条，用户可在供应商列改选
  const chosen = (orderSupplierId.value
    ? suppliers.find(s => String(s.supplier_id) === orderSupplierId.value)
    : null) || suppliers[0]
  return {
    blocked: '',
    supplierId: String(chosen.supplier_id),
    supplierName: chosen.supplier_name || String(chosen.supplier_id),
    presetPrice: chosen.preset_purchase_price || '',
  }
}

/** 供应商列改选后同步名称与预设采购价 */
function onSupplierChange(row: ExpandTreeRow) {
  const hit = row.__suppliers.find(s => String(s.supplier_id) === String(row.__supplierId))
  row.__supplierName = hit?.supplier_name || String(row.__supplierId || '')
  row.__presetPrice = hit?.preset_purchase_price || ''
}

/** 递归构建组合子树（num 逐层累乘） */
function buildComponentRows(
  nodes: any[], depth: number, parentQty: number, sources: string[],
): ExpandTreeRow[] {
  return (nodes || []).map((node) => {
    const productId = String(node.component_product_id)
    const isCombined = Number(node.component_is_combined) === 1
    const combNum = Number(node.num) || 1
    const lineQty = parentQty * combNum
    const suppliers: BatchPreviewSupplier[] = node.suppliers || []
    // 组合节点与叶子同一规则：有自身供应商绑定即可采购（整组买），无绑定则仅作分组容器
    const state = resolveBlocked(productId, suppliers)
    return {
      __rowKey: String(node.component_id || productId),
      __productId: productId,
      __code: node.component_product_code || '',
      __name: node.component_product_name || '',
      __depth: depth,
      __isCombined: isCombined,
      __combNum: combNum,
      __defaultQty: lineQty,
      __qty: String(lineQty),
      __suppliers: suppliers,
      __supplierId: state.supplierId,
      __supplierName: state.supplierName,
      __presetPrice: state.presetPrice,
      __blocked: state.blocked,
      __sources: [...sources],
      __fromCombined: true,
      children: node.components?.length
        ? buildComponentRows(node.components, depth + 1, lineQty, sources)
        : [],
    }
  })
}

/**
 * 构建完整树：
 * - 组合产品 → 展开子产品树
 * - 普通产品 → 顶级行
 * 同一子产品在多处出现（多组合共享 / 多层嵌套）按 product_id 合并数量与来源，避免重复
 */
function buildFullTree(normalProducts: any[], combinedProducts: any[]): ExpandTreeRow[] {
  const rows: ExpandTreeRow[] = []

  combinedProducts.forEach((cp) => {
    const srcLabel = cp.product_name || cp.product_code || ''
    const cpSuppliers: BatchPreviewSupplier[] = cp.suppliers || []
    // 组合主产品自身也可能绑定供应商（可整组采购），与子产品同一套判定
    const cpState = resolveBlocked(String(cp.product_id), cpSuppliers)
    rows.push({
      __rowKey: `combo:${cp.product_id}`,
      __productId: String(cp.product_id),
      __code: cp.product_code || '',
      __name: cp.product_name || '',
      __depth: 0,
      __isCombined: true,
      __combNum: null,
      __defaultQty: 1,
      __qty: '1',
      __suppliers: cpSuppliers,
      __supplierId: cpState.supplierId,
      __supplierName: cpState.supplierName,
      __presetPrice: cpState.presetPrice,
      __blocked: cpState.blocked,
      __sources: [srcLabel],
      __fromCombined: true,
      children: buildComponentRows(cp.components || [], 1, 1, [srcLabel]),
    })
  })

  normalProducts.forEach((np) => {
    const productId = String(np.product_id)
    const suppliers: BatchPreviewSupplier[] = np.suppliers || []
    const state = resolveBlocked(productId, suppliers)
    rows.push({
      __rowKey: `plain:${productId}`,
      __productId: productId,
      __code: np.product_code || '',
      __name: np.product_name || '',
      __depth: 0,
      __isCombined: false,
      __combNum: null,
      __defaultQty: 1,
      __qty: '1',
      __suppliers: suppliers,
      __supplierId: state.supplierId,
      __supplierName: state.supplierName,
      __presetPrice: state.presetPrice,
      __blocked: state.blocked,
      __sources: [],
      __fromCombined: false,
      children: [],
    })
  })

  return mergeDuplicateLeaves(rows)
}

/** 同一产品出现在多条路径 → 数量与来源合并到先出现的那条，重复行从树上摘除 */
function mergeDuplicateLeaves(rows: ExpandTreeRow[]): ExpandTreeRow[] {
  const seen = new Map<string, ExpandTreeRow>()
  const walk = (list: ExpandTreeRow[]): ExpandTreeRow[] => {
    const kept: ExpandTreeRow[] = []
    list.forEach((row) => {
      if (row.children?.length) row.children = walk(row.children)
      if (row.__isCombined) {
        kept.push(row)
        return
      }
      const prev = seen.get(row.__productId)
      if (prev) {
        prev.__defaultQty += row.__defaultQty
        prev.__qty = String(Number(prev.__qty || 0) + Number(row.__qty || 0))
        row.__sources.forEach((s) => {
          if (!prev.__sources.includes(s)) prev.__sources.push(s)
        })
        return
      }
      seen.set(row.__productId, row)
      kept.push(row)
    })
    return kept
  }
  return walk(rows)
}

function collectExpandableKeys(rows: ExpandTreeRow[]): string[] {
  const keys: string[] = []
  const walk = (list: ExpandTreeRow[]) => {
    list.forEach((r) => {
      if (r.children?.length) {
        keys.push(r.__rowKey)
        walk(r.children)
      }
    })
  }
  walk(rows)
  return keys
}

function expandAll() {
  expandedKeys.value = collectExpandableKeys(visibleRows.value)
  dropSelectedExpanded()
}
function collapseAll() {
  expandedKeys.value = []
  const dropped = pruneHiddenSelection()
  if (dropped) ElMessage.info(`已取消折叠区域内 ${dropped} 项的勾选（折叠表示改选当前层级）`)
}

/** 取消勾选所有「已展开」的行：展开即表示放弃买这一级，否则它自己的下级会被反向挡住 */
function dropSelectedExpanded() {
  const set = expandedKeySet.value
  selectedRows.value
    .filter(r => set.has(r.__rowKey))
    .forEach(r => treeTableRef.value?.toggleRowSelection(r, false))
}

/** 弹窗打开时由外部 watch 触发：拉取结构并建树 */
async function loadTree() {
  const ids = (props.productIds || []).map(String).filter(Boolean)
  const plainIds = (props.plainProducts || []).map(p => String(p.product_id)).filter(Boolean)
  if (!ids.length && !plainIds.length) {
    treeRows.value = []
    return
  }
  loading.value = true
  loadError.value = ''
  treeRows.value = []
  selectedRows.value = []
  treeTableRef.value?.clearSelection()
  try {
    // 仅组合产品需要展开；普通产品由 batch-preview 原样回传（normal_products）
    const res = ids.length
      ? await batchPreviewProducts([...ids, ...plainIds])
      : null
    const normalRaw = res ? (res.data.normal_products || []) : []
    const combinedRaw = res ? (res.data.combined_products || []) : []
    // batch-preview 未覆盖的普通产品（无 ids 时纯普通场景兜底）
    const seenPlain = new Set(normalRaw.map((n: any) => String(n.product_id)))
    const missingPlain = (props.plainProducts || [])
      .filter(p => !seenPlain.has(String(p.product_id)))
      .map(p => ({
        product_id: p.product_id,
        product_code: p.product_code,
        product_name: p.product_name,
        is_combined: p.is_combined,
        suppliers: (p as any).suppliers || [],
      }))
    treeRows.value = buildFullTree([...normalRaw, ...missingPlain], combinedRaw)
    await nextTick()
    // 默认全部折叠：展开态的那一级不可勾选，故折叠默认让「整组采购」可直接勾选，
    // 想看下级结构点「展开全部」或逐行展开
    preselectPlain(plainIds)
  } catch (err: any) {
    const detail = err?.response?.data?.detail
    const errs = Array.isArray(detail?.errors) ? detail.errors : []
    if (errs.length) {
      const all = [...ids, ...plainIds]
      const names = errs.map((e: any) => {
        const pid = String(e.product_id || '')
        const hit = (props.plainProducts || []).find(p => String(p.product_id) === pid)
        return hit?.product_name || pid || `第${Number(e.index) + 1}项`
      })
      loadError.value = `以下产品无法预览：${names.join('、')}`
    } else {
      loadError.value = detail?.message || err?.message || '组合产品结构预览失败'
    }
    treeRows.value = []
  } finally {
    loading.value = false
  }
}

function onQtyInput(row: ExpandTreeRow) {
  const digits = String(row.__qty ?? '').replace(/[^\d]/g, '')
  if (String(row.__qty ?? '') !== digits) row.__qty = digits
}

/** 预勾选用户已明确选择的普通产品（组合产品的子产品由用户自行挑选，不预勾） */
function preselectPlain(plainIds: string[]) {
  if (!plainIds.length) return
  const idSet = new Set(plainIds)
  treeRows.value.forEach((row) => {
    if (!row.__isCombined && idSet.has(row.__productId) && isRowSelectable(row)) {
      treeTableRef.value?.toggleRowSelection(row, true)
    }
  })
}

function onSelectionChange(rows: ExpandTreeRow[]) {
  selectedRows.value = rows ?? []
}

/**
 * 补齐明细行还需要、但 batch-preview 不返回的字段（单位/类别/可用库存）。
 * 走产品搜索接口的 product_ids 精准过滤：单次最多 100 个 ID、命中全量返回，一次请求搞定。
 * 失败不阻断——缺 unit_id 时用户可在明细行的单位列补选。
 */
async function enrichSelected(rows: ExpandTreeRow[]): Promise<Map<string, ProductItem>> {
  const map = new Map<string, ProductItem>()
  const ids = rows.map(r => r.__productId).filter(Boolean)
  if (!ids.length) return map
  try {
    const res = await searchProduct(
      { search_field: '[]', search_value: '{}', product_ids: JSON.stringify(ids.slice(0, 100)) },
      { silent: true },
    )
    ;(res.data?.products || []).forEach((p) => map.set(String(p.product_id), p))
  } catch {
    // 静默降级：单位/类别留空，交由用户在明细行补选
  }
  return map
}

async function handleConfirm() {
  // 兜底：正常交互下 selectable 已挡住这些行，这里再校验一次，避免静默放行
  const conflicting = selectedRows.value.filter(
    r => !renderedKeySet.value.has(r.__rowKey)
      || expandedKeySet.value.has(r.__rowKey)
      || hierConflicts.value.has(r.__rowKey),
  )
  if (conflicting.length) {
    ElMessage.error(
      `「${conflicting.map(r => r.__name || r.__code).join('、')}」已展开或与已勾选行构成组装件/零件关系，请调整勾选后再确认`,
    )
    return
  }
  const rows = selectedPurchasableRows.value
  if (!rows.length) {
    ElMessage.warning('请勾选要采购的产品')
    return
  }
  submitting.value = true
  try {
    const detailMap = await enrichSelected(rows)
    const payload: PurchaseItemRow[] = rows.map((row) => {
      const detail = detailMap.get(row.__productId)
      const price = row.__presetPrice || ''
      const item: PurchaseItemRow = {
        product_id: row.__productId,
        product_code: row.__code || detail?.product_code || '',
        product_name: row.__name || detail?.product_name || '',
        category_name: detail?.category_name || '',
        unit_name: detail?.unit_name || '',
        unit_id: detail?.unit_id || '',
        available_stock: detail?.available_stock ?? null,
        qty: Number(row.__qty) || 1,
        purchase_price: price,
        _supplier_id: row.__supplierId || '',
        _supplier_name: row.__supplierName || '',
      }
      if (price) item._preset_price = price
      return item
    })
    emit('confirm', payload)
    visible.value = false
  } finally {
    submitting.value = false
  }
}

/** 弹窗打开即拉取结构树（父组件只需切换 v-model，无需协调加载时机） */
watch(() => props.modelValue, (val) => {
  if (val) void loadTree()
})

function onClosed() {
  treeRows.value = []
  selectedRows.value = []
  expandedKeys.value = []
  onlySelectable.value = false
  loadError.value = ''
}

defineExpose({ loadTree })
</script>

<style scoped>
.dlg-alert { margin-bottom: 12px; }
.tree-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.tree-toolbar-left { display: flex; gap: 8px; }
.tree-wrapper { min-height: 200px; }
.tree-empty { padding: 20px 0; }
.tree-hint { margin-bottom: 8px; font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
.tree-hint-em { color: var(--color-warning, #e6a23c); margin-left: 4px; }
.src-tag { margin-left: 6px; }
.cell-text { color: var(--text-primary); }
.cell-muted { color: var(--text-secondary); font-size: 12px; }
.summary { margin-top: 12px; font-size: 13px; color: var(--text-primary); }
.summary .hl { color: var(--color-primary); font-size: 15px; }
.summary-sum { margin-left: 12px; color: var(--text-secondary); }
</style>
