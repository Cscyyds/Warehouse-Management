<template>
  <div class="add-template-page">
    <!-- 顶部 header：左对齐返回+标题，右上重置/保存 -->
    <div class="page-header">
      <div class="page-header-left">
        <el-icon class="back-icon" @click="goBack"><ArrowLeft /></el-icon>
        <span class="back-label" @click="goBack">返回</span>
        <span class="header-divider">/</span>
        <h3>{{ isEdit ? '编辑客户订货单' : '新增客户订货单' }}</h3>
      </div>
      <div class="header-actions">
        <el-button @click="reset">重置</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </div>
    </div>

    <div class="page-body">
      <!-- 段标题：订单信息（编辑态展示主单只读元数据） -->
      <div v-if="isEdit" class="form-section-title">
        <span class="section-line" />
        订单信息
      </div>
      <el-row v-if="isEdit" :gutter="16" class="meta-row">
        <el-col :span="8">
          <div class="meta-item">
            <span class="meta-label">订单编号</span>
            <span class="meta-value">{{ orderMeta.order_no || '-' }}</span>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="meta-item">
            <span class="meta-label">审核状态</span>
            <span class="meta-value">
              <el-tag :type="auditTagType(orderMeta.audit_status)" size="small">{{ orderMeta.audit_status_name || '-' }}</el-tag>
            </span>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="meta-item">
            <span class="meta-label">审核人 / 时间</span>
            <span class="meta-value">{{ orderMeta.audit_by_name || '-' }}<template v-if="orderMeta.audit_time">（{{ formatTableDate(orderMeta.audit_time) }}）</template></span>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="meta-item">
            <span class="meta-label">创建人</span>
            <span class="meta-value">{{ orderMeta.created_by_name || '-' }}</span>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="meta-item">
            <span class="meta-label">创建时间</span>
            <span class="meta-value">{{ formatTableDate(orderMeta.created_at) }}</span>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="meta-item">
            <span class="meta-label">更新时间</span>
            <span class="meta-value">{{ formatTableDate(orderMeta.updated_at) }}</span>
          </div>
        </el-col>
      </el-row>

      <!-- 段标题：订货信息 -->
      <div class="form-section-title">
        <span class="section-line" />
        订货信息
      </div>

      <!-- 表单（label 在上、控件在下） -->
      <el-form label-position="top">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="客户" required>
              <el-input
                v-model="editor.customerName"
                placeholder="点击选择客户"
                readonly
                @click="openCustomerDialog"
              >
                <template #suffix>
                  <el-icon style="cursor:pointer" @click.stop="openCustomerDialog"><Search /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="editor.remark" type="textarea" :rows="2" placeholder="主单备注（最多 500 字）" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="图片">
              <div v-if="editor.existingImages.length" class="existing-files">
                <el-link v-for="f in editor.existingImages" :key="f.file_url" :href="f.file_url" target="_blank">{{ f.file_name || f.file_url }}</el-link>
              </div>
              <div class="upload-row">
                <input type="file" accept="image/*" multiple class="file-input" @change="selectFiles($event, 'images')" />
                <span class="file-tip">{{ isEdit ? '如需新增' : '本次' }}最多 5 张，本次 {{ editor.images.length }} 张</span>
                <div v-if="editor.images.length" class="file-list">
                  <el-tag v-for="(f, i) in editor.images" :key="i" closable @close="editor.images.splice(i, 1)">{{ f.name }}</el-tag>
                </div>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="附件">
              <div v-if="editor.existingAttachments.length" class="existing-files">
                <el-link v-for="f in editor.existingAttachments" :key="f.file_url" :href="f.file_url" target="_blank">{{ f.file_name || f.file_url }}</el-link>
              </div>
              <div class="upload-row">
                <input type="file" multiple class="file-input" @change="selectFiles($event, 'attachments')" />
                <span class="file-tip">{{ isEdit ? '如需新增' : '本次' }}最多 5 个，本次 {{ editor.attachments.length }} 个</span>
                <div v-if="editor.attachments.length" class="file-list">
                  <el-tag v-for="(f, i) in editor.attachments" :key="i" closable @close="editor.attachments.splice(i, 1)">{{ f.name }}</el-tag>
                </div>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <!-- 段标题：订货明细 + 右侧添加产品 -->
      <div class="section-header-row">
        <div class="form-section-title no-margin">
          <span class="section-line" />
          订货明细
        </div>
        <el-button size="small" type="primary" :disabled="!editor.customerId" @click="openProductDialog">添加产品</el-button>
      </div>

      <el-table :data="editor.items" border>
        <el-table-column prop="product_code" label="产品编号" min-width="120" />
        <el-table-column prop="product_name" label="产品名称" min-width="200" />
        <el-table-column prop="unit_name" label="单位" width="80" />
        <el-table-column label="数量" width="180">
          <template #default="{row}">
            <el-input-number v-model="row.qty" :min="0.0001" :precision="4" size="small" style="width:100%" />
          </template>
        </el-table-column>
        <el-table-column prop="project_name" label="项目" width="160">
          <template #default="{row}">
            <el-input v-model="row.project_name" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ $index }">
            <el-button link type="danger" @click="removeItem($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <p v-if="!editor.items.length" class="empty-tip">尚未添加产品，请选择客户后点击「添加产品」</p>
    </div>

    <CustomerSelectDialog v-model="customerDialog" @confirm="onCustomer" />
    <el-dialog v-model="productDialog" title="选择产品" width="900px" append-to-body>
      <el-input v-model="productKeyword" placeholder="按产品名称搜索" clearable @keyup.enter="loadProducts" />
      <el-table :data="products" border height="420" style="margin-top:12px" @row-dblclick="onProduct">
        <el-table-column prop="product_code" label="编号" />
        <el-table-column prop="product_name" label="名称" />
        <el-table-column prop="specification" label="规格" />
        <el-table-column prop="unit_name" label="单位" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{row}">
            <el-button link type="primary" @click="onProduct(row)">选择</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Search } from '@element-plus/icons-vue'
import CustomerSelectDialog from '@/views/customer/CustomerSelectDialog.vue'
import { createCustomerOrder, updateCustomerOrder, updateCustomerOrderItems, createCustomerOrderItems, getCustomerOrderDetail } from '@/api/modules/customerOrder'
import { searchProduct, type ProductItem, type CustomerItem } from '@/api'
import { formatTableDate } from '@/utils/date'

/** 编辑态展示的主单只读信息（订单编号 / 审核状态 / 人员与时间） */
const orderMeta = reactive({
  order_no: '',
  audit_status: 0,
  audit_status_name: '',
  audit_by_name: '',
  audit_time: '',
  created_by_name: '',
  created_at: '',
  updated_at: '',
})

/** 审核状态 0=待审核 1=审核通过 2=已反审核 3=审核失败 */
function auditTagType(status: number): 'warning' | 'success' | 'info' | 'danger' {
  const map: Record<number, 'warning' | 'success' | 'info' | 'danger'> = { 0: 'warning', 1: 'success', 2: 'info', 3: 'danger' }
  return map[status] || 'info'
}

const router = useRouter()
const route = useRoute()
const editId = route.query.id as string | undefined
const isEdit = !!editId
const prefill = route.query.prefill === '1'
const fromSalesOrder = route.query.from === 'salesOrder'
const goBack = () => {
  if (fromSalesOrder) returnToSalesOrder()
  router.push('/sales/customer-order')
}

const editor = reactive({
  id: '',
  customerId: '',
  customerName: '',
  remark: '',
  items: [] as Array<{ customer_order_item_id?: string; product_id: string; product_code: string; product_name: string; unit_id?: string; unit_name?: string; qty: number; project_name: string; line_remark: string }>,
  images: [] as File[],
  attachments: [] as File[],
  existingImages: [] as Array<{ file_name?: string; file_url: string }>,
  existingAttachments: [] as Array<{ file_name?: string; file_url: string }>
})
const saving = ref(false)
const customerDialog = ref(false)
const productDialog = ref(false)
const productKeyword = ref('')
const products = ref<ProductItem[]>([])

const openCustomerDialog = () => {
  if (editor.id) return
  customerDialog.value = true
}
const onCustomer = (c: CustomerItem) => {
  editor.customerId = c.customer_id
  editor.customerName = c.customer_name
}
const loadProducts = async () => {
  const q = productKeyword.value.trim()
  const r = await searchProduct({
    search_field: JSON.stringify(['product_name']),
    search_value: JSON.stringify({ product_name: q }),
    page: 1, page_size: 50
  })
  products.value = r.data.products || []
}
const openProductDialog = () => {
  productDialog.value = true
  loadProducts()
}
const onProduct = (p: ProductItem) => {
  if (editor.items.some(i => i.product_id === p.product_id)) {
    return ElMessage.warning('产品已添加')
  }
  editor.items.push({
    product_id: p.product_id,
    product_code: p.product_code,
    product_name: p.product_name,
    unit_id: p.unit_id || undefined,
    unit_name: p.unit_name || undefined,
    qty: 1,
    project_name: '',
    line_remark: ''
  })
  productDialog.value = false
}
const removeItem = (idx: number) => {
  editor.items.splice(idx, 1)
}
const selectFiles = (event: Event, kind: 'images' | 'attachments') => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (files.length > 5) {
    ElMessage.warning(`${kind === 'images' ? '图片' : '附件'}最多选择 5 个`)
    input.value = ''
    return
  }
  editor[kind] = files
}
const reset = () => {
  Object.assign(editor, {
    id: '', customerId: '', customerName: '', remark: '',
    items: [], images: [], attachments: [], existingImages: [], existingAttachments: []
  })
}
const loadEdit = async () => {
  if (!editId) return
  const r = await getCustomerOrderDetail(editId)
  const d = r.data
  editor.id = d.customer_order_id
  editor.customerId = d.customer_id
  editor.customerName = d.customer_name
  editor.remark = d.remark || ''
  Object.assign(orderMeta, {
    order_no: d.order_no || '',
    audit_status: d.audit_status ?? 0,
    audit_status_name: d.audit_status_name || '',
    audit_by_name: d.audit_by_name || '',
    audit_time: d.audit_time || '',
    created_by_name: d.created_by_name || '',
    created_at: d.created_at || '',
    updated_at: d.updated_at || '',
  })
  editor.items = (d.items || []).map(i => ({
    customer_order_item_id: i.customer_order_item_id,
    product_id: i.product_id,
    product_code: i.product_code || '',
    product_name: i.product_name || '',
    unit_id: i.unit_id || undefined,
    unit_name: i.unit_name || undefined,
    qty: Number(i.qty) || 1,
    project_name: i.project_name || '',
    line_remark: i.line_remark || ''
  }))
  editor.existingImages = d.images || []
  editor.existingAttachments = d.attachments || []
}

/** 从销售订单一键生成订单调入：预填客户与缺量明细 */
function loadPrefill() {
  if (!prefill) return
  let data: any = null
  try { data = JSON.parse(sessionStorage.getItem('customerOrderPrefillFromSales') || 'null') } catch { data = null }
  sessionStorage.removeItem('customerOrderPrefillFromSales')
  if (!data) return
  if (data.customer_id) {
    editor.customerId = data.customer_id
    editor.customerName = data.customer_name || ''
  }
  if (Array.isArray(data.items)) {
    editor.items = data.items.map((i: any) => ({
      product_id: i.product_id,
      product_code: i.product_code || '',
      product_name: i.product_name || '',
      unit_id: i.unit_id || undefined,
      unit_name: i.unit_name || undefined,
      qty: Number(i.qty) || 1,
      project_name: i.project_name || '',
      line_remark: i.line_remark || '',
    }))
  }
}

/** 一键生单场景：保存客户订货单后返回销售订单编辑页（通过 snapshot 恢复原有未保存状态） */
function returnToSalesOrder() {
  const soId = route.query.soId as string | undefined
  const query: Record<string, string> = { type: 'salesOrder', restoreSalesOrder: '1' }
  if (soId) { query.id = soId; query.mode = 'edit' }
  router.push({ path: '/common/add', query })
}

onMounted(() => {
  if (prefill && !isEdit) {
    loadPrefill()
  } else {
    loadEdit()
  }
})
const save = async () => {
  if (!editor.customerId) return ElMessage.warning('请选择客户')
  if (!editor.items.length) return ElMessage.warning('至少添加一条明细')
  saving.value = true
  try {
    if (isEdit) {
      await updateCustomerOrder(editor.id, editor.remark, { images: editor.images, attachments: editor.attachments })
      const existing = editor.items.filter(i => i.customer_order_item_id)
      const added = editor.items.filter(i => !i.customer_order_item_id)
      if (existing.length) await updateCustomerOrderItems(editor.id, existing.map(i => ({ customer_order_item_id: i.customer_order_item_id, qty: i.qty, project_name: i.project_name, remark: i.line_remark })))
      if (added.length) await createCustomerOrderItems(editor.id, added.map(i => ({ product_id: i.product_id, qty: i.qty, project_name: i.project_name, remark: i.line_remark })))
    } else {
      const items = editor.items.map(i => ({
        product_id: i.product_id,
        qty: i.qty,
        project_name: i.project_name,
        remark: i.line_remark
      }))
      await createCustomerOrder({
        customer_id: editor.customerId,
        remark: editor.remark,
        items: JSON.stringify(items),
        images: editor.images,
        attachments: editor.attachments
      })
    }
    ElMessage.success('保存成功')
    if (fromSalesOrder) returnToSalesOrder()
    else router.push('/sales/customer-order')
  } catch {
    // 拦截器已提示错误，这里吞掉避免冒泡到全局错误边界导致整页崩溃
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.add-template-page { background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-xs); padding: 0; }

/* 顶部 header：白卡片内的标准返回头 */
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; border-bottom: 1px solid var(--border-light); }
.page-header-left { display: flex; align-items: center; gap: 8px; }
.back-icon { cursor: pointer; color: var(--text-secondary); font-size: 16px; transition: color var(--transition-fast); }
.back-icon:hover { color: var(--primary); }
.back-label { cursor: pointer; font-size: 14px; color: var(--text-secondary); transition: color var(--transition-fast); }
.back-label:hover { color: var(--primary); }
.header-divider { color: var(--text-tertiary); font-size: 14px; margin: 0 2px; }
.page-header h3 { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.header-actions { display: flex; gap: 8px; }

/* 内容区 */
.page-body { padding: 20px 24px; }

/* 订单信息只读元数据：label 在上、值在下，3 列一行换行 */
.meta-row { margin-bottom: 8px; }
.meta-item { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.meta-label { font-size: 12px; color: var(--text-secondary); }
.meta-value { font-size: 14px; color: var(--text-primary); word-break: break-all; }

/* 段标题：竖线 + 文字 */
.form-section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 4px 0 14px; padding-left: 4px; }
.form-section-title.no-margin { margin: 0; }
.section-line { width: 4px; height: 16px; background: var(--primary-gradient); border-radius: 2px; flex-shrink: 0; }

/* 明细段标题 + 添加产品按钮（同一行） */
.section-header-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 24px 0 16px; }
.section-header-row .form-section-title { margin: 0; }

/* 表单控件间距 */
.add-template-page :deep(.el-form-item) { margin-bottom: 16px; }
.add-template-page :deep(.el-form-item__label) { font-size: 14px; color: var(--text-secondary); }

.existing-files { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.upload-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.file-input { width: auto; }
.file-tip { color: var(--text-secondary); font-size: 12px; }
.file-list { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; margin-top: 6px; }
.empty-tip { text-align: center; color: var(--text-secondary); margin: 12px 0; }
</style>
