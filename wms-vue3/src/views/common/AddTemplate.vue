<template>
  <div class="add-template-page">
    <div class="page-header">
      <div class="page-header-left">
        <el-icon class="back-icon" @click="handleCancel"><ArrowLeft /></el-icon>
        <span class="back-label" @click="handleCancel">返回</span>
        <span class="header-divider">/</span>
        <h3>{{ pageTitle }}</h3>
      </div>
      <div class="header-actions">
        <template v-if="!isReadonly">
          <template v-for="action in visibleHeaderExtraActions" :key="action.key">
            <component
              :is="extraActionComponents[action.key]"
              v-if="extraActionComponents[action.key]"
              :form-data="formData"
              :dynamic-table-data="dynamicTableData"
              :is-edit="isEdit"
              :is-readonly="isReadonly"
              :active-tab="activeTab"
              :edit-id="editId"
            />
          </template>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
        </template>
      </div>
    </div>
    <div class="page-body" v-loading="loading">
      <div v-if="visibleContentExtraActions.length" class="content-extra-actions">
        <template v-for="action in visibleContentExtraActions" :key="action.key">
          <component
            :is="extraActionComponents[action.key]"
            v-if="extraActionComponents[action.key]"
            :form-data="formData"
            :dynamic-table-data="dynamicTableData"
            :is-edit="isEdit"
            :is-readonly="isReadonly"
          />
        </template>
      </div>
      <el-tabs v-if="config" v-model="activeTab">
        <el-tab-pane v-for="(tab, idx) in config.tabs" :key="idx" :name="String(idx)">
          <template #label>
            <span class="tab-label-wrap">
              {{ tab.label }}
              <el-badge v-if="tabErrors[idx]" :value="tabErrors[idx]" type="danger" class="tab-err-badge" />
            </span>
          </template>
          <el-form
            :ref="(el: any) => setFormRef(idx, el)"
            :model="formData"
            :label-width="config?.labelWidth || '120px'"
            :label-position="config?.labelPosition ?? 'right'"
            size="large"
          >
            <el-row :gutter="formGutter">
              <template v-for="field in tab.fields" :key="field.key">
                <el-col v-if="field.type === 'section'" :span="field.span || 24">
                  <div class="form-section-title">
                    <span class="section-line" />
                    {{ field.label }}
                  </div>
                </el-col>
                <el-col v-else-if="!['dynamic-table', 'embedded-table', 'image-upload', 'file-upload'].includes(field.type)" v-show="isFieldVisible(field)" :xs="24" :sm="field.span || 12" :md="field.span || 12" :lg="field.span || 12">
                  <el-form-item
                    :label="field.regionSource ? undefined : field.label"
                    :prop="field.key"
                    :rules="getFieldRules(field)"
                  >
                    <template v-if="field.regionSource" #label>
                      <span class="region-source-label">{{ field.label }}</span>
                      <el-radio-group
                        :model-value="regionMode"
                        size="small"
                        class="region-source-switch"
                        @change="(m: any) => onRegionSourceChange(field, m)"
                      >
                        <el-radio-button value="division">行政区划</el-radio-button>
                        <el-radio-button value="amap">高德地图</el-radio-button>
                      </el-radio-group>
                    </template>
                    <el-input
                      v-if="field.type === 'input'"
                      v-model="formData[field.key]"
                      :placeholder="field.placeholder"
                      :disabled="field.disabled || (isEdit && field.disabledInEdit) || isReadonly"
                    />
                    <el-input
                      v-else-if="field.type === 'textarea'"
                      v-model="formData[field.key]"
                      type="textarea"
                      :rows="field.rows || 3"
                      :placeholder="field.placeholder"
                      :disabled="field.disabled || (isEdit && field.disabledInEdit) || isReadonly"
                    />
                    <el-select
                      v-else-if="field.type === 'select'"
                      v-model="formData[field.key]"
                      :placeholder="field.placeholder"
                      :clearable="field.clearable !== false"
                      :filterable="field.filterable"
                      :multiple="field.multiple"
                      :show-checkbox="field.multiple"
                      :allow-create="field.allowCreate"
                      :disabled="field.disabled || (isEdit && field.disabledInEdit) || isReadonly"
                    >
                      <el-option v-for="opt in (fieldOptions[field.key] ?? field.options)" :key="opt.value" :label="opt.label" :value="opt.value" />
                    </el-select>
                    <el-radio-group v-else-if="field.type === 'radio'" v-model="formData[field.key]" :disabled="field.disabled || (isEdit && field.disabledInEdit) || isReadonly">
                      <el-radio v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</el-radio>
                    </el-radio-group>
                    <el-checkbox-group v-else-if="field.type === 'checkbox-group'" v-model="formData[field.key]" class="role-checkbox-group" :disabled="isReadonly">
                      <el-checkbox-button v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</el-checkbox-button>
                    </el-checkbox-group>
                    <template v-else-if="field.type === 'tree-select' && field.regionSource">
                      <el-tree-select
                        v-model="formData[field.key]"
                        :data="fieldTreeData[field.key] || field.treeData || []"
                        :props="field.treeProps || { label: 'label', children: 'children', value: 'value' }"
                        node-key="id"
                        :placeholder="field.placeholder"
                        :check-strictly="field.checkStrictly"
                        :clearable="field.clearable !== false"
                        :filterable="field.filterable"
                        :disabled="field.disabled || (isEdit && field.disabledInEdit) || isReadonly"
                        style="width: 100%"
                      >
                        <template #default="{ data }">
                          <span class="region-tree-node">{{ data.name ?? data.label }}</span>
                        </template>
                      </el-tree-select>
                    </template>
                    <el-tree-select
                      v-else-if="field.type === 'tree-select'"
                      v-model="formData[field.key]"
                      :data="fieldTreeData[field.key] || field.treeData || []"
                      :props="field.treeProps || { label: 'name', children: 'children', value: 'id' }"
                      node-key="id"
                      :placeholder="field.placeholder"
                      :multiple="field.multiple"
                      value-key="id"
                      :show-checkbox="field.multiple"
                      :expand-on-click-node="!field.multiple"
                      :check-on-click-node="field.multiple"
                      :check-strictly="field.checkStrictly"
                      @change="(value: any) => { if (field.multiple && Array.isArray(value)) formData[field.key] = value.map((item: any) => String(item)) }"
                      @check="(data: any, info: any) => onTreeCheck(field, data, info)"
                      :clearable="field.clearable !== false"
                      :filterable="field.filterable"
                      :disabled="field.disabled || (isEdit && field.disabledInEdit) || isReadonly"
                    />
                    <el-date-picker
                      v-else-if="field.type === 'date'"
                      v-model="formData[field.key]"
                      type="date"
                      value-format="YYYY-MM-DD"
                      :placeholder="field.placeholder"
                      :clearable="field.clearable !== false"
                      :disabled="field.disabled || (isEdit && field.disabledInEdit) || isReadonly"
                      style="width:100%"
                    />
                    <el-input-number
                      v-else-if="field.type === 'number'"
                      v-model="formData[field.key]"
                      :placeholder="field.placeholder"
                      :disabled="field.disabled || (isEdit && field.disabledInEdit) || isReadonly"
                      style="width:100%"
                    />
                    <el-input
                      v-else-if="field.type === 'computed'"
                      :model-value="formatComputed(field)"
                      readonly
                      style="width:100%"
                    />
                    <div v-else-if="field.type === 'input-suffix'" class="input-suffix-wrapper">
                      <el-input
                        v-model="formData[field.key + '_label']"
                        :placeholder="field.placeholder"
                        readonly
                        :disabled="isFieldDisabled(field)"
                        @click="!isFieldDisabled(field) && (field.dialogType ? openSelectDialog(field.key) : toggleSuffixDropdown(field.key))"
                      >
                        <template #suffix>
                          <el-icon v-if="!isFieldDisabled(field)" class="input-suffix-icon" :size="18" @click.stop="field.dialogType ? openSelectDialog(field.key) : toggleSuffixDropdown(field.key)"><component :is="field.suffixIcon || 'Search'" /></el-icon>
                        </template>
                      </el-input>
                      <div v-if="!field.dialogType && suffixDropdownVisible[field.key]" class="suffix-dropdown-panel" @click.stop>
                        <el-tree
                          :data="fieldTreeData[field.key] || field.treeData || []"
                          :props="{ label: 'name', children: 'children' }"
                          node-key="id"
                          highlight-current
                          @node-click="(data: any) => onSuffixTreeSelect(field.key, data)"
                        />
                      </div>
                    </div>
                  </el-form-item>
                </el-col>
                <el-col v-if="field.type === 'image-upload'" :span="field.span || 24" :key="'img-' + field.key">
                  <el-form-item :label="field.label">
                    <div class="image-upload-wrapper">
                      <el-upload
                        v-model:file-list="imageFileMap[field.key]"
                        list-type="picture-card"
                        :auto-upload="false"
                        :limit="field.maxImages || 9"
                        :on-exceed="() => ElMessage.warning(`最多上传 ${field.maxImages || 9} 张图片`)"
                        :on-change="(file: any, fileList: any[]) => handleUploadChange(field, 'image', file, fileList)"
                        :on-remove="(file: any) => handleRemoveFile(field, file)"
                        :disabled="isReadonly"
                        accept="image/*"
                      >
                        <el-icon v-if="!isReadonly"><Plus /></el-icon>
                      </el-upload>
                      <div class="el-upload__tip">{{ getUploadTip(field, 'image') }}</div>
                    </div>
                  </el-form-item>
                </el-col>
                <el-col v-if="field.type === 'file-upload'" :span="field.span || 24" :key="'file-' + field.key">
                  <el-form-item :label="field.label">
                    <div class="file-upload-wrapper">
                      <el-upload
                        v-model:file-list="fileFileMap[field.key]"
                        :auto-upload="false"
                        :limit="field.maxFiles || 5"
                        :on-exceed="() => ElMessage.warning(`最多上传 ${field.maxFiles || 5} 个文件`)"
                        :on-change="(file: any, fileList: any[]) => handleUploadChange(field, 'file', file, fileList)"
                        :on-remove="(file: any) => handleRemoveFile(field, file)"
                        :disabled="isReadonly"
                      >
                        <el-button v-if="!isReadonly" type="primary" plain>
                          <el-icon><Upload /></el-icon>
                          <span>点击上传</span>
                        </el-button>
                        <template #tip>
                          <div class="el-upload__tip">{{ getUploadTip(field, 'file') }}</div>
                        </template>
                      </el-upload>
                    </div>
                  </el-form-item>
                </el-col>
                <el-col v-if="field.type === 'dynamic-table'" :span="24" :key="'dt-' + field.key">
                  <el-form-item :label="field.label">
                    <div class="dynamic-table-wrapper">
                      <!-- 销售退货明细：专用优化组件 -->
                      <template v-if="config?.type === 'salesReturn' && field.key === 'items'">
                        <ReturnDetailTable
                          :rows="dynamicTableData[field.key] || []"
                          @add="addDynamicRow(field.key, field)"
                          @remove="(idx: number) => removeDynamicRow(field.key, idx)"
                        />
                      </template>
                      <template v-else>
                        <div v-if="!dynamicTableData[field.key]?.length" class="dynamic-table-empty">
                          <el-empty description="暂无数据" :image-size="56">
                            <el-button v-if="!isReadonly" size="small" @click="addDynamicRow(field.key, field)">+ {{ field.addLabel || '新增' }}</el-button>
                          </el-empty>
                        </div>
                        <template v-else>
                          <el-table :data="dynamicTableData[field.key]" border size="small" style="width:100%">
                            <el-table-column v-if="field.showIndex" type="index" label="序号" width="60" align="center" />
                            <el-table-column v-for="col in field.columns" :key="col.key" :label="col.label" :width="col.width">
                              <template #default="{ row }">
                                <el-input v-if="!col.type || col.type === 'input'" v-model="row[col.key]" size="small" class="table-cell-input" :disabled="isReadonly" @input="onTableInputDebounced(field, col, row)" @change="onTableInputChange(field, col, row)" />
                                <el-select v-else-if="col.type === 'select'" v-model="row[col.key]" size="small" class="table-cell-input" :disabled="isReadonly">
                                  <el-option v-for="opt in col.options" :key="opt.value" :label="opt.label" :value="opt.value" />
                                </el-select>
                                <el-date-picker v-else-if="col.type === 'date'" v-model="row[col.key]" type="date" value-format="YYYY-MM-DD" placeholder="请选择" size="small" style="width:100%" :disabled="isReadonly" />
                                <span v-else-if="col.type === 'dialog-select' && col.disabled" class="table-cell-display">{{ row[col.labelKey || col.key] || row[col.key] || '-' }}</span>
                                <el-input v-else-if="col.type === 'dialog-select'" :model-value="row[col.labelKey || col.key] || row[col.key]" size="small" readonly placeholder="点击选择" class="table-cell-input" @click="openTableDialog(field.key, col, row)">
                                  <template #suffix><el-icon class="el-input__icon"><Search /></el-icon></template>
                                </el-input>
                                <el-tree-select
                                  v-else-if="col.type === 'tree-select'"
                                  v-model="row[col.key]"
                                  :data="col.treeData || []"
                                  :props="col.treeProps || { label: 'name', children: 'children', value: 'id' }"
                                  size="small"
                                  style="width:100%"
                                  :disabled="isReadonly"
                                />
                                <span v-else-if="col.type === 'display'" class="table-cell-display">{{ row[col.key] ?? '-' }}</span>
                                <span v-else-if="col.type === 'computed'" class="table-cell-display">{{ col.compute ? col.compute(row) : (row[col.key] ?? '-') }}</span>
                              </template>
                            </el-table-column>
                            <el-table-column v-if="!isReadonly" label="操作" :width="global_opt_width" align="center">
                              <template #default="{ row, $index }">
                                <template v-if="config?.type === 'purchaseReturn'">
                                  <el-tag v-if="getDeductionStatusText(row) === '无需冲减'" type="info" size="small">无需冲减</el-tag>
                                  <el-tag v-else-if="getDeductionStatusText(row) === '已补足'" type="success" size="small">已补足</el-tag>
                                  <el-button v-else text type="warning" size="small" @click="openDeductionDialog(row)">选择冲减</el-button>
                                  <el-button v-if="getDeductionStatusText(row) === '已补足'" text type="primary" size="small" @click="openDeductionDialog(row)">调整</el-button>
                                  <el-button v-if="row.purchase_return_item_id" text type="info" size="small" @click="openDeductionRecords(row)">记录</el-button>
                                </template>
                                <el-button text type="danger" size="small" :icon="Delete" @click="removeDynamicRow(field.key, $index)" />
                              </template>
                            </el-table-column>
                          </el-table>
                          <el-button v-if="!isReadonly" class="add-row-btn" size="small" @click="addDynamicRow(field.key, field)">+ {{ field.addLabel || '新增' }}</el-button>
                          <!-- 销售订单：缺货提示气泡（表格外展示，不打断表格阅读） -->
                          <div
                            v-if="config?.type === 'salesOrder' && field.key === 'items' && shortageRows.length"
                            class="shortage-bubble"
                          >
                            <div class="shortage-bubble__header">
                              <el-icon class="shortage-bubble__icon"><WarningFilled /></el-icon>
                              <span>{{ shortageRows.length }} 个产品库存不足</span>
                            </div>
                            <div v-for="item in shortageRows" :key="item.product_id" class="shortage-bubble__item">
                              <span class="shortage-bubble__name" :title="item.product_name">{{ item.product_name || item.product_code }}</span>
                              <span class="shortage-bubble__detail">库存 {{ item.available_stock }}，需 {{ item.qty }}，缺 <strong class="shortage-bubble__num">{{ item._shortageQty }}</strong></span>
                              <el-button type="warning" size="small" plain @click="onSalesOrderShortageClick(item.row)">生成订货单</el-button>
                            </div>
                          </div>
                        </template>
                      </template>
                    </div>
                  </el-form-item>
                </el-col>
                <el-col v-if="field.type === 'embedded-table'" :span="24" :key="'et-' + field.key">
                  <el-form-item :label="field.label">
                    <el-table :data="field.tableData" border size="small" style="width:100%">
                      <el-table-column v-for="col in field.columns" :key="col.key" :label="col.label">
                        <template #default="{ row }">
                          <el-checkbox v-if="col.type === 'checkbox'" v-model="row.checked" :disabled="isReadonly" />
                          <el-input v-else-if="col.type === 'input'" v-model="row[col.key]" size="small" :disabled="isReadonly" />
                          <el-select v-else-if="col.type === 'select'" v-model="row[col.key]" size="small" :clearable="false" :disabled="isReadonly">
                            <el-option v-for="opt in col.options" :key="opt.value" :label="opt.label" :value="opt.value" />
                          </el-select>
                          <el-tag v-else-if="col.type === 'tag'" size="small">{{ row[col.key] }}</el-tag>
                          <span v-else>{{ row[col.key] }}</span>
                        </template>
                      </el-table-column>
                    </el-table>
                  </el-form-item>
                </el-col>
              </template>
            </el-row>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      <SupplierSelectDialog v-if="currentDialogType === 'supplier'" v-model="dialogVisible[dialogFieldKey]" :multiple="currentDialogMultiple" :monthly-only="currentDialogMonthlyOnly" :exclude-ids="currentDialogMultiple ? (formData[dialogFieldKey] || []).map((s: any) => s.supplier_id) : []" @confirm="onSupplierConfirm" @confirm-multiple="onSupplierMultipleConfirm" />
      <!-- 动态表格内"供应商"列选择（单选用，写入表格行并按已选项去重） -->
      <SupplierSelectDialog v-if="tableDialogVisible.supplier" v-model="tableDialogVisible.supplier" :exclude-ids="tableSupplierExcludeIds" @confirm="onTableSupplierConfirm" />
      <EmployeeSelectDialog v-else-if="currentDialogType === 'employee'" v-model="dialogVisible[dialogFieldKey]" @confirm="onEmployeeConfirm" />
      <CustomerSelectDialog v-else-if="currentDialogType === 'customer'" v-model="dialogVisible[dialogFieldKey]" @confirm="onCustomerConfirm" />
      <PurchaseOrderSelectDialog v-else-if="currentDialogType === 'purchaseOrder'" v-model="dialogVisible[dialogFieldKey]" :supplier-id="formData.supplier_id || ''" :monthly-only="currentDialogMonthlyOnly" @confirm="onPurchaseOrderConfirm" />
      <PurchaseReturnSelectDialog v-else-if="currentDialogType === 'purchaseReturn'" v-model="dialogVisible[dialogFieldKey]" :multiple="false" @confirm="onPurchaseReturnConfirm" />
      <SalesReturnSelectDialog v-else-if="currentDialogType === 'salesReturn'" v-model="dialogVisible[dialogFieldKey]" @confirm="onSalesReturnConfirm" />
      <SalesOrderSelectDialog v-else-if="currentDialogType === 'salesOrder'" v-model="dialogVisible[dialogFieldKey]" @confirm="onSalesOrderConfirm" />
      <ProductSelectDialog v-model="tableDialogVisible.product" :supplier-id="formData.supplier_id || ''" @confirm="onProductConfirm" />
      <ProductUnitSelectDialog v-model="tableDialogVisible.unit" @confirm="onProductUnitConfirm" />
      <PendingReceiptSelectDialog v-model="tableDialogVisible.pendingReceipt" :supplier-id="formData.supplier_id || ''" @confirm="onPendingReceiptConfirm" />
      <PendingReturnSelectDialog v-model="tableDialogVisible.pendingReturn" :supplier-id="formData.supplier_id || ''" :return-type="getPurchaseReturnType()" @confirm="onPendingReturnConfirm" />
      <UnpaidOrderSelectDialog v-model="tableDialogVisible.unpaidOrder" :supplier-id="formData.supplier_id || ''" :exclude-order-ids="getExistingUnpaidOrderIds()" @confirmMultiple="onUnpaidOrdersConfirm" />
      <SalesOrderSelectDialog v-model="tableDialogVisible.salesOrderForItems" :customer-id="formData.customer_id || ''" @confirm="onSalesOrderForItemsConfirm" />
      <SalesReturnItemSelectDialog v-model="tableDialogVisible.salesReturnItem" :customer-id="formData.customer_id || ''" :locked-sales-order-id="salesReturnLockedOrderId" @confirm="onSalesReturnItemsConfirm" />
      <DeductionReceiptSelectDialog
        v-model="deductionDialogVisible"
        :purchase-order-item-id="deductionDialogRow?.purchase_order_item_id || ''"
        :required-deduction-qty="getRequiredDeductionQty(deductionDialogRow)"
        :return-qty="deductionDialogRow?.return_qty || 0"
        :remaining="deductionDialogRow?.remaining || 0"
        :product-name="deductionDialogRow?.product_name || ''"
        :existing-deductions="deductionDialogRow?.receipt_item_deductions || []"
        @confirm="onDeductionConfirm"
      />
      <DeductionRecordsDialog
        v-model="deductionRecordsDialogVisible"
        :purchase-return-item-id="deductionRecordsItemId"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Delete, Upload, Search, WarningFilled } from '@element-plus/icons-vue'
import { getSceneConfig, type FieldConfig, type ExtraActionConfig } from '@/config/formConfigs'
import { global_opt_width } from '@/utils/data'
import { regionMode, setRegionMode, loadCityTree } from '@/utils/regionCity'
import { deleteSalesOrderItem } from '@/api'
import type { FormItemRule } from 'element-plus'
import SupplierSelectDialog from '@/views/purchase/SupplierSelectDialog.vue'
import EmployeeSelectDialog from '@/views/customer/EmployeeSelectDialog.vue'
import CustomerSelectDialog from '@/views/customer/CustomerSelectDialog.vue'
import PurchaseOrderSelectDialog from '@/views/finance/PurchaseOrderSelectDialog.vue'
import PurchaseReturnSelectDialog from '@/views/finance/PurchaseReturnSelectDialog.vue'
import SalesOrderSelectDialog from '@/views/sales/SalesOrderSelectDialog.vue'
import ProductSelectDialog from '@/views/product/ProductSelectDialog.vue'
import ProductUnitSelectDialog from '@/views/product/ProductUnitSelectDialog.vue'
import PendingReceiptSelectDialog from '@/views/purchase/PendingReceiptSelectDialog.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
// 头部附加操作组件注册表：key 与 SceneConfig.extraActions[].key 对应
import ProductRecognizeAction from '@/views/product/ProductRecognizeAction.vue'
import CreateReceiptAction from '@/views/sales/CreateReceiptAction.vue'

const extraActionComponents: Record<string, any> = {
  productRecognize: ProductRecognizeAction,
  createReceipt: CreateReceiptAction,
}

const { isTabletDown } = useBreakpoint()
/* 表单栅格间距：小屏收紧，避免字段被挤 */
const formGutter = computed(() => (isTabletDown.value ? 8 : 16))
import PendingReturnSelectDialog from '@/views/purchase/PendingReturnSelectDialog.vue'
import DeductionReceiptSelectDialog from '@/views/purchase/DeductionReceiptSelectDialog.vue'
import DeductionRecordsDialog from '@/views/purchase/DeductionRecordsDialog.vue'
import UnpaidOrderSelectDialog from '@/views/finance/UnpaidOrderSelectDialog.vue'
import SalesReturnItemSelectDialog from '@/views/sales/SalesReturnItemSelectDialog.vue'
import SalesReturnSelectDialog from '@/views/sales/SalesReturnSelectDialog.vue'
import ReturnDetailTable from '@/views/sales/ReturnDetailTable.vue'
const route = useRoute()
const router = useRouter()
const activeTab = ref('0')
const submitting = ref(false)
const loading = ref(false)
const formRefs = ref<Record<number, any>>({})
const dynamicTableData = reactive<Record<string, any[]>>({})
const suffixDropdownVisible = reactive<Record<string, boolean>>({})
const dialogVisible = reactive<Record<string, boolean>>({})
const dialogFieldKey = ref<string>('')
const tableDialogVisible = reactive<Record<string, boolean>>({ product: false, unit: false, pendingReceipt: false, pendingReturn: false, unpaidOrder: false, salesOrderForItems: false, salesReturnItem: false, supplier: false })
const tableDialogCtx = ref<{ fieldKey: string; col: any; row: any } | null>(null)
// 当前退货明细表已添加行所属的销售订单ID，用于在"选择可退明细"弹窗中锁定同单（跨弹窗会话生效）
const salesReturnLockedOrderId = computed<string>(() => {
  const ctx = tableDialogCtx.value
  if (!ctx) return ''
  const rows = dynamicTableData[ctx.fieldKey] || []
  const first = rows.find((r: any) => r.sales_order_id)
  return first?.sales_order_id || ''
})
const deductionDialogVisible = ref(false)
const deductionDialogRow = ref<any>(null)
const deductionRecordsDialogVisible = ref(false)
const deductionRecordsItemId = ref('')
const imageFileMap = reactive<Record<string, any[]>>({})
const fileFileMap = reactive<Record<string, any[]>>({})
const fieldOptions = reactive<Record<string, { label: string; value: string | number }[]>>({})
const fieldTreeData = reactive<Record<string, any[]>>({})

function onTreeCheck(field: FieldConfig, _data: any, info: any) {
  if (!field.multiple) return
  // 级联树（菜单→按钮→权限）：只收集叶子节点 id，父节点（menu_/btn_）不进表单值，
  // 避免提交给后端后报「权限不存在」。叶子判定：无 children 或 children 为空。
  const checkedNodes: any[] = Array.isArray(info?.checkedNodes) ? info.checkedNodes : []
  if (checkedNodes.length) {
    const leafIds = checkedNodes
      .filter((node: any) => !Array.isArray(node?.children) || node.children.length === 0)
      .map((node: any) => String(node?.id))
    formData[field.key] = leafIds
    return
  }
  // 兜底：拿不到节点对象时退回 checkedKeys（保持旧行为，提交侧还有前缀过滤）
  const keys = info?.checkedKeys
  if (Array.isArray(keys)) {
    formData[field.key] = keys.map((key: any) => String(key))
  }
}
/** 树数据加载序列号：防止异步请求竞态导致旧请求覆盖新结果（如高德慢请求覆盖静态切换） */
const loadSeq: Record<string, number> = {}
const tabErrors = reactive<Record<number, number>>({})
const IMAGE_MAX_SIZE_MB = 10
const FILE_MAX_SIZE_MB = 15

const config = computed(() => {
  const type = route.query.type as string
  return getSceneConfig(type)
})

// 当前场景中应渲染的头部附加操作（通过 show 回调过滤，如仅新增态显示）
const visibleExtraActions = computed<ExtraActionConfig[]>(() => {
  const actions = config.value?.extraActions
  if (!actions || !actions.length) return []
  return actions.filter(a => !a.show || a.show({ isEdit: isEdit.value, isReadonly: isReadonly.value }))
})
const visibleHeaderExtraActions = computed(() => visibleExtraActions.value.filter(action => action.placement !== 'content'))
const visibleContentExtraActions = computed(() => visibleExtraActions.value.filter(action => action.placement === 'content'))

const isEdit = computed(() => route.query.mode === 'edit')
const isReadonly = computed(() => route.query.readonly === '1')
const editId = computed(() => route.query.id as string | undefined)

// 当前打开弹窗的字段对应的 dialogType（用于条件渲染对应弹窗组件）
const currentDialogType = computed(() => {
  if (!config.value || !dialogFieldKey.value) return ''
  for (const tab of config.value.tabs) {
    const field = tab.fields.find(f => f.key === dialogFieldKey.value)
    if (field) return field.dialogType || ''
  }
  return ''
})

// 当前打开弹窗的字段是否多选模式
const currentDialogMultiple = computed(() => {
  if (!config.value || !dialogFieldKey.value) return false
  for (const tab of config.value.tabs) {
    const field = tab.fields.find(f => f.key === dialogFieldKey.value)
    if (field) return !!field.multiple
  }
  return false
})

const currentDialogMonthlyOnly = computed(() => {
  if (!config.value || !dialogFieldKey.value) return false
  for (const tab of config.value.tabs) {
    const field = tab.fields.find(f => f.key === dialogFieldKey.value)
    if (field) return !!field.monthlyOnly
  }
  return false
})

const pageTitle = computed(() => {
  if (!config.value) return '加载中...'
  if (isReadonly.value && config.value.detailTitle) return config.value.detailTitle
  return isEdit.value ? (config.value.editTitle || config.value.title) : config.value.title
})

const formData = reactive<Record<string, any>>({})

function setFormRef(idx: number, el: any) { if (el) formRefs.value[idx] = el }

function toggleSuffixDropdown(key: string) {
  suffixDropdownVisible[key] = !suffixDropdownVisible[key]
}

function onSuffixTreeSelect(key: string, data: any) {
  // 优先使用业务ID（如 category_id），不存在时回退到 id
  formData[key] = data.category_id ?? data.id
  formData[key + '_label'] = data.name
  suffixDropdownVisible[key] = false
}

// 统一判断字段是否处于禁用态（配置禁用 / 编辑态禁用 / 只读态）
function isFieldDisabled(field: FieldConfig): boolean {
  return !!(field.disabled || (isEdit.value && field.disabledInEdit) || isReadonly.value)
}

function openSelectDialog(key: string) {
  dialogFieldKey.value = key
  dialogVisible[key] = true
}

function getUploadTip(field: FieldConfig, kind: 'image' | 'file') {
  if (kind === 'image') {
    return `支持图片文件，单张不超过 ${IMAGE_MAX_SIZE_MB}MB，最多上传 ${field.maxImages || 9} 张图片`
  }
  return `单个附件不超过 ${FILE_MAX_SIZE_MB}MB，最多上传 ${field.maxFiles || 5} 个文件`
}

function handleUploadChange(field: FieldConfig, kind: 'image' | 'file', file: any, fileList: any[]) {
  const maxSizeMb = kind === 'image' ? IMAGE_MAX_SIZE_MB : FILE_MAX_SIZE_MB
  const maxSizeBytes = maxSizeMb * 1024 * 1024
  const targetMap = kind === 'image' ? imageFileMap : fileFileMap
  const validList = fileList.filter((item: any) => !item?.raw || Number(item.raw.size || 0) <= maxSizeBytes)
  targetMap[field.key] = validList
  if (file?.raw && Number(file.raw.size || 0) > maxSizeBytes) {
    ElMessage.warning(`${kind === 'image' ? '图片' : '附件'}大小不能超过 ${maxSizeMb}MB`)
  }
}

// 采购订单：选择产品前必须先选定供应商，避免选错供应商的产品
function ensurePurchaseSupplier(): boolean {
  if (config.value?.type === 'purchaseOrder' && !formData.supplier_id) {
    ElMessage.warning('请先选择供应商，再添加产品明细')
    return false
  }
  return true
}

function openTableDialog(fieldKey: string, col: any, row: any) {
  const dt = col.dialogType
  if (!dt) return
  tableDialogCtx.value = { fieldKey, col, row }
  if (dt === 'product') {
    if (!ensurePurchaseSupplier()) return
    tableDialogVisible.product = true
  }
  else if (dt === 'unit') tableDialogVisible.unit = true
  else if (dt === 'supplier') tableDialogVisible.supplier = true
}

function onProductConfirm(product: any) {
  const ctx = tableDialogCtx.value
  if (!ctx) return
  const newRow = ctx.row ?? {}
  newRow.product_id = product.product_id
  newRow.product_code = product.product_code || ''
  newRow.product_name = product.product_name || ''
  newRow.category_name = product.category_name || ''
  newRow.unit_name = product.unit_name || ''
  newRow.unit_id = product.unit_id || ''
  // 可用库存：产品查询接口（列表/搜索）已返回 available_stock（已扣采购退货预占），直接带入明细行展示
  newRow.available_stock = product.available_stock
  // 如果是通过 addViaDialog 新增的（row 为 null），先推入表格
  if (ctx.row === null) {
    if (!dynamicTableData[ctx.fieldKey]) dynamicTableData[ctx.fieldKey] = []
    // 去重：同 product_id 不允许重复添加
    const exists = dynamicTableData[ctx.fieldKey].some(
      (r: any) => r.product_id && r.product_id === product.product_id
    )
    if (exists) {
      ElMessage.warning(`产品「${product.product_name || product.product_code}」已添加，请勿重复添加`)
      tableDialogCtx.value = null
      return
    }
    dynamicTableData[ctx.fieldKey].push(newRow)
    tableDialogCtx.value = null
    return
  }
  tableDialogCtx.value = null
}

/**
 * 动态表格单元格输入变化钩子：列配置可通过 col.onChange(row, ctx) 挂载自定义逻辑。
 * 目前用于销售订单明细"数量"列触发缺货检测（库存不足时一键生成客户订货单）。
 */
function onTableInputChange(field: any, col: any, row: any) {
  if (typeof col.onChange === 'function') {
    col.onChange(row, {
      fieldKey: field.key,
      formData,
      dynamicTableData,
      activeTab: activeTab.value,
      editId: editId.value,
      isEdit: isEdit.value,
      router,
    })
  }
}

/** 表格单元格输入防抖钩子：列配置可通过 col.onInput(row, ctx) 挂载输入即检测逻辑（600ms 防抖，按行对象隔离） */
const tableInputTimers = new WeakMap<object, Map<string, ReturnType<typeof setTimeout>>>()
function onTableInputDebounced(field: any, col: any, row: any) {
  if (typeof col.onInput !== 'function') return
  let colTimers = tableInputTimers.get(row)
  if (!colTimers) {
    colTimers = new Map()
    tableInputTimers.set(row, colTimers)
  }
  const prev = colTimers.get(col.key)
  if (prev) clearTimeout(prev)
  colTimers.set(col.key, setTimeout(() => {
    colTimers!.delete(col.key)
    col.onInput(row, {
      fieldKey: field.key,
      formData,
      dynamicTableData,
      activeTab: activeTab.value,
      editId: editId.value,
      isEdit: isEdit.value,
      router,
    })
  }, 600))
}

/** 销售订单缺货行「生成订货单」按钮点击：委托 formConfigs 中注册的处理函数（确认弹窗 → 快照 → 跳转预填页） */
function onSalesOrderShortageClick(row: any) {
  const handler = (getSceneConfig('salesOrder') as any)?.__tableActionHandlers?.shortage
  if (typeof handler === 'function') {
    handler(row, {
      fieldKey: 'items',
      formData,
      dynamicTableData,
      activeTab: activeTab.value,
      editId: editId.value,
      isEdit: isEdit.value,
      router,
    })
  }
}

/** 销售订单明细缺货行汇总（供表格下方气泡展示）：每项带行引用，便于气泡按钮直接操作对应行 */
const shortageRows = computed(() => {
  if (config.value?.type !== 'salesOrder') return []
  const rows = dynamicTableData['items'] || []
  return rows
    .filter((r: any) => r._shortage && r.qty && r.product_id)
    .map((r: any) => ({
      product_id: r.product_id,
      product_name: r.product_name,
      product_code: r.product_code,
      available_stock: r.available_stock,
      qty: r.qty,
      _shortageQty: r._shortageQty,
      row: r,
    }))
})

function onProductUnitConfirm(unit: any) {
  const ctx = tableDialogCtx.value
  if (!ctx) return
  const row = ctx.row
  row.unit_id = unit.unit_id
  row.unit_name = unit.unit_name || ''
  tableDialogCtx.value = null
}

function onSupplierConfirm(supplier: any) {
  const key = dialogFieldKey.value
  if (!key) return
  const oldSupplierId = formData[key]
  const oldSupplierLabel = formData[key + '_label']
  const oldMonthlySettlement = formData.is_monthly_settlement
  const nextMonthlySettlement = Number(supplier.is_monthly_settlement) === 1 ? 1 : 0
  formData[key] = supplier.supplier_id
  formData[key + '_label'] = supplier.supplier_name
  if (config.value?.type === 'purchaseReturn') {
    formData.is_monthly_settlement = nextMonthlySettlement
  }
  // 采购退货：切换供应商时清空已选明细和冲减数据
  if (config.value?.type === 'purchaseReturn' && oldSupplierId && oldSupplierId !== supplier.supplier_id) {
    const items = dynamicTableData['items']
    if (items && items.length > 0) {
      ElMessageBox.confirm('修改供应商后，已选择的退货明细和冲减数据将全部清空，是否继续？', '提示', {
        type: 'warning',
        confirmButtonText: '确认',
        cancelButtonText: '取消'
      }).then(() => {
        dynamicTableData['items'] = []
      }).catch(() => {
        formData[key] = oldSupplierId
        formData[key + '_label'] = oldSupplierLabel || ''
        formData.is_monthly_settlement = oldMonthlySettlement
      })
    }
  }
}

function getPurchaseReturnType() {
  if (!formData.supplier_id) return ''
  if (formData.is_monthly_settlement === 1 || formData.is_monthly_settlement === '1') return '月结'
  if (formData.is_monthly_settlement === 0 || formData.is_monthly_settlement === '0') return '其他'
  return ''
}

function onSupplierMultipleConfirm(suppliers: Array<{ supplier_id: string; supplier_name: string; supplier_model: string }>) {
  const key = dialogFieldKey.value
  if (!key) return
  // 存储选中的供应商数组，供 submitCreate/submitUpdate 后调用 addProductSupplier
  formData[key] = suppliers
  formData[key + '_label'] = suppliers.map(s => s.supplier_name).join('、')
}

// 动态表格内"供应商"列已选 ID（用于 SupplierSelectDialog 去重，排除当前正在编辑行的自身 ID）
const tableSupplierExcludeIds = computed(() => {
  const ctx = tableDialogCtx.value
  if (!ctx) return []
  const editingId = ctx.row?.supplier_id
  return (dynamicTableData[ctx.fieldKey] || [])
    .map((r: any) => r.supplier_id)
    .filter((id: string) => id && id !== editingId)
})

// 动态表格内选择供应商后写入对应行（单选，按 supplier_id 去重），并带出编码/地址/电话/状态等展示字段
function onTableSupplierConfirm(supplier: any) {
  const ctx = tableDialogCtx.value
  if (!ctx) return
  const key = ctx.fieldKey
  if (!dynamicTableData[key]) dynamicTableData[key] = []
  const dup = dynamicTableData[key].some((r: any) => r.supplier_id && r.supplier_id === supplier.supplier_id)
  if (dup) {
    ElMessage.warning(`供应商「${supplier.supplier_name}」已关联，请勿重复添加`)
    tableDialogCtx.value = null
    tableDialogVisible.supplier = false
    return
  }
  const fillRow = (row: any) => {
    row.supplier_id = supplier.supplier_id
    row.supplier_code = supplier.supplier_code || ''
    row.supplier_name = supplier.supplier_name || ''
    row.detail_address = supplier.detail_address || ''
    row.phone1 = supplier.phone1 || ''
    row.status = supplier.status
    row.status_name = supplier.status === 1 ? '启用' : (supplier.status === 0 ? '禁用' : '')
    if (!row.supplier_model) row.supplier_model = ''
  }
  if (ctx.row === null) {
    const newRow: any = {}
    fillRow(newRow)
    dynamicTableData[key].push(newRow)
  } else {
    fillRow(ctx.row)
  }
  tableDialogCtx.value = null
  tableDialogVisible.supplier = false
}

function onEmployeeConfirm(user: any) {
  const key = dialogFieldKey.value
  if (!key) return
  formData[key] = user.user_id
  formData[key + '_label'] = user.user_name
}

function onCustomerConfirm(customer: any) {
  const key = dialogFieldKey.value
  if (!key) return
  formData[key] = customer.customer_id
  formData[key + '_label'] = customer.customer_name
}

function onPurchaseOrderConfirm(order: any) {
  const key = dialogFieldKey.value
  if (!key) return
  formData[key] = order.purchase_order_id
  formData[key + '_label'] = order.order_no
}

function onPurchaseReturnConfirm(item: any) {
  const key = dialogFieldKey.value
  if (!key) return
  formData[key] = item.purchase_return_id
  formData[key + '_label'] = item.return_no
}

function onSalesOrderConfirm(order: any) {
  const key = dialogFieldKey.value
  if (!key) return
  formData[key] = order.sales_order_id
  formData[key + '_label'] = order.sales_order_no
}

function onSalesReturnConfirm(item: any) {
  const key = dialogFieldKey.value
  if (!key) return
  formData[key] = item.sales_return_id
  formData[key + '_label'] = item.return_no
}

function closeSuffixDropdowns(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.input-suffix-wrapper')) {
    Object.keys(suffixDropdownVisible).forEach(k => { suffixDropdownVisible[k] = false })
  }
}

function isFieldVisible(field: FieldConfig): boolean {
  if (isEdit.value && field.hiddenInEdit) return false
  if (!field.visible) return true
  return field.visible(formData)
}

function getFieldRules(field: FieldConfig): FormItemRule[] {
  const rules: FormItemRule[] = []
  if (field.required) {
    const selectTypes = ['select', 'date', 'tree-select', 'input-suffix', 'radio']
    const isSelect = selectTypes.includes(field.type)
    rules.push({
      required: true,
      message: `${isSelect ? '请选择' : '请输入'}${field.label}`,
      trigger: isSelect ? ['blur', 'change'] : 'blur'
    })
  }
  if (field.rules) (field.rules as FormItemRule[]).forEach(r => rules.push(r))
  return rules
}

// computed 字段展示：支持金额格式（¥ 千分位两位小数）
function formatComputed(field: FieldConfig): string {
  const v = formData[field.key]
  if (v == null || v === '') return '0.00'
  if (field.money) {
    const n = Number(v)
    if (isNaN(n)) return String(v)
    return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return String(v)
}

// computed 字段自动计算：根据依赖字段（formData）重算并写回
function recalcComputedFields() {
  if (!config.value) return
  config.value.tabs.forEach(tab => {
    tab.fields.forEach(field => {
      if (field.type === 'computed' && typeof field.compute === 'function') {
        try { formData[field.key] = field.compute(formData) } catch { /* 忽略计算异常 */ }
      }
    })
  })
}

// 任意表单字段变化后，重新计算所有 computed 字段（如"最低销售价格"）
watch(formData, recalcComputedFields, { deep: true })

/**
 * 选中带 syncTo 的字段后，把当前完整值（如「省份 / 城市」）自动同步写入目标字段（如收货地址）。
 * 仅监听源字段自身变化，避免用户手动修改目标字段时被反向覆盖。
 * 仅在「新增」态自动填充；「编辑」态保留后端原值，避免覆盖已填数据。
 */
function setupSyncWatchers() {
  if (!config.value) return
  config.value.tabs.forEach(tab => {
    tab.fields.forEach(field => {
      if (field.syncTo) {
        watch(
          () => formData[field.key],
          (val) => {
            if (!isEdit.value && val) {
              const out = field.syncTransform ? field.syncTransform(val) : val
              formData[field.syncTo as string] = out
            }
          },
        )
      }
    })
  })
}

function addDynamicRow(key: string, field?: any) {
  if (!dynamicTableData[key]) dynamicTableData[key] = []
  if (field?.addViaDialog) {
    tableDialogCtx.value = { fieldKey: key, col: { dialogType: field.addDialogType || 'product', labelKey: 'product_name' }, row: null }
    if (field.addDialogType === 'pending-receipt') {
      if (!formData.supplier_id) {
        ElMessage.warning('请先选择供应商')
        return
      }
      tableDialogVisible.pendingReceipt = true
    } else if (field.addDialogType === 'pending-return') {
      if (!formData.supplier_id) {
        ElMessage.warning('请先选择供应商')
        return
      }
      tableDialogVisible.pendingReturn = true
    } else if (field.addDialogType === 'unpaid-order') {
      if (!formData.supplier_id) {
        ElMessage.warning('请先选择供应商')
        return
      }
      tableDialogVisible.unpaidOrder = true
    } else if (field.addDialogType === 'sales-order') {
      tableDialogVisible.salesOrderForItems = true
    } else if (field.addDialogType === 'sales-return-item') {
      if (!formData.customer_id) {
        ElMessage.warning('请先选择客户')
        return
      }
      tableDialogVisible.salesReturnItem = true
    } else {
      if (!ensurePurchaseSupplier()) return
      tableDialogVisible.product = true
    }
    return
  }
  dynamicTableData[key].push({})
}

function getExistingUnpaidOrderIds(): string[] {
  const ctx = tableDialogCtx.value
  if (!ctx) return []
  return (dynamicTableData[ctx.fieldKey] || []).map((r: any) => r.purchase_order_id).filter(Boolean)
}

function onUnpaidOrdersConfirm(orders: any[]) {
  const ctx = tableDialogCtx.value
  if (!ctx) return
  if (!dynamicTableData[ctx.fieldKey]) dynamicTableData[ctx.fieldKey] = []
  const existing = dynamicTableData[ctx.fieldKey]
  orders.forEach(order => {
    const dup = existing.some((r: any) => r.purchase_order_id === order.purchase_order_id)
    if (dup) return
    existing.push({
      purchase_order_id: order.purchase_order_id,
      order_no: order.order_no,
      payment_method_display: order.payment_method_display,
      pending_payable_amount: order.pending_payable_amount,
      payment_amount: order.pending_payable_amount
    })
  })
}

function onSalesOrderForItemsConfirm(order: any) {
  const ctx = tableDialogCtx.value
  if (!ctx) return
  if (!dynamicTableData[ctx.fieldKey]) dynamicTableData[ctx.fieldKey] = []
  const existing = dynamicTableData[ctx.fieldKey]
  const dup = existing.some((r: any) => r.sales_order_id === order.sales_order_id)
  if (dup) { ElMessage.warning('该销售订单已在列表中'); return }
  existing.push({
    sales_order_id: order.sales_order_id,
    order_no: order.sales_order_no,
    receivable_amount: order.receivable_amount || order.total_sales_amount || '0',
    collection_amount: order.receivable_amount || '0'
  })
}

function onSalesReturnItemsConfirm(items: any[]) {
  const ctx = tableDialogCtx.value
  if (!ctx) return
  if (!dynamicTableData[ctx.fieldKey]) dynamicTableData[ctx.fieldKey] = []
  const existing = dynamicTableData[ctx.fieldKey]
  let skipped = 0
  items.forEach(item => {
    const dup = existing.some((r: any) => r.sales_order_item_id === item.sales_order_item_id)
    if (dup) { skipped++; return }
    existing.push({
      sales_order_item_id: item.sales_order_item_id,
      sales_order_id: item.sales_order_id || '',
      sales_order_no: item.sales_order_no || '',
      product_id: item.product_id,
      product_code: item.product_code || '',
      product_name: item.product_name || '',
      specification: item.specification || '',
      color: item.color || '',
      unit_name: item.unit_name || '',
      discount_price: item.discount_price || '0',
      remaining: item.remaining || '0',
      return_qty: item.return_qty ?? 1,
      return_price: item.return_price ?? item.discount_price ?? '0',
      product_status: '完好',
      remark: '',
    })
  })
  if (skipped > 0) ElMessage.warning(`${skipped} 条明细已存在，已跳过`)
  tableDialogCtx.value = null
}

function onPendingReceiptConfirm(items: Array<{ purchase_order_item_id: string; purchase_order_no: string; in_stock_qty: number; product_name: string; product_code: string; unit_name: string; category_name: string; specification: string; color: string; purchase_price: string }>) {
  const ctx = tableDialogCtx.value
  if (!ctx) return
  if (!dynamicTableData[ctx.fieldKey]) dynamicTableData[ctx.fieldKey] = []
  const existing = dynamicTableData[ctx.fieldKey]
  let skipped = 0
  items.forEach(item => {
    // 去重：purchase_order_item_id 有值时按它去重，否则按 product_code 去重
    const dupKey = item.purchase_order_item_id || item.product_code
    const exists = existing.some((r: any) =>
      (r.purchase_order_item_id && r.purchase_order_item_id === dupKey) ||
      (!r.purchase_order_item_id && r.product_code === dupKey)
    )
    if (exists) { skipped++; return }
    dynamicTableData[ctx.fieldKey].push({
      purchase_order_item_id: item.purchase_order_item_id,
      purchase_order_no: item.purchase_order_no,
      in_stock_qty: item.in_stock_qty,
      product_name: item.product_name,
      product_code: item.product_code,
      unit_name: item.unit_name,
      category_name: item.category_name,
      specification: item.specification,
      color: item.color,
      purchase_price: item.purchase_price,
      remark: ''
    })
  })
  if (skipped > 0) {
    ElMessage.warning(`已跳过 ${skipped} 条重复明细`)
  }
  tableDialogCtx.value = null
}

function onPendingReturnConfirm(items: Array<{ purchase_order_item_id: string; purchase_order_no: string; return_price: number; return_qty: number; remaining: number; product_name: string; product_code: string; category_name: string; specification: string; color: string; unit_name: string; purchase_price: string }>) {
  const ctx = tableDialogCtx.value
  if (!ctx) return
  if (!dynamicTableData[ctx.fieldKey]) dynamicTableData[ctx.fieldKey] = []
  const existing = dynamicTableData[ctx.fieldKey]
  let skipped = 0
  items.forEach(item => {
    // 去重：purchase_order_item_id 有值时按它去重，否则按 product_code 去重
    const dupKey = item.purchase_order_item_id || item.product_code
    const exists = existing.some((r: any) =>
      (r.purchase_order_item_id && r.purchase_order_item_id === dupKey) ||
      (!r.purchase_order_item_id && r.product_code === dupKey)
    )
    if (exists) { skipped++; return }
    dynamicTableData[ctx.fieldKey].push({
      purchase_order_item_id: item.purchase_order_item_id,
      purchase_order_no: item.purchase_order_no,
      return_price: item.return_price,
      return_qty: item.return_qty,
      remaining: item.remaining,
      receipt_item_deductions: [],
      product_name: item.product_name,
      product_code: item.product_code,
      category_name: item.category_name,
      specification: item.specification,
      color: item.color,
      unit_name: item.unit_name,
      purchase_price: item.purchase_price,
      remark: ''
    })
  })
  if (skipped > 0) {
    ElMessage.warning(`已跳过 ${skipped} 条重复明细`)
  }
  tableDialogCtx.value = null
}

function getRequiredDeductionQty(row: any): number {
  if (!row) return 0
  const returnQty = Number(row.return_qty) || 0
  const remaining = Number(row.remaining) || 0
  return Math.max(returnQty - remaining, 0)
}

function openDeductionDialog(row: any) {
  if (!row.purchase_order_item_id) {
    ElMessage.warning('当前明细缺少采购明细ID，无法选择冲减')
    return
  }
  deductionDialogRow.value = row
  deductionDialogVisible.value = true
}

function onDeductionConfirm(deductions: Array<{ purchase_receipt_item_id: string; deduction_qty: string | number }>) {
  if (deductionDialogRow.value) {
    deductionDialogRow.value.receipt_item_deductions = deductions
  }
}

function openDeductionRecords(row: any) {
  if (!row.purchase_return_item_id) {
    ElMessage.warning('该明细暂无冲减记录')
    return
  }
  deductionRecordsItemId.value = row.purchase_return_item_id
  deductionRecordsDialogVisible.value = true
}

function getDeductionStatusText(row: any): string {
  const returnQty = Number(row.return_qty) || 0
  const remaining = Number(row.remaining) || 0
  if (returnQty <= remaining) return '无需冲减'
  const deductions: any[] = row.receipt_item_deductions || []
  const total = deductions.reduce((sum: number, d: any) => sum + (Number(d.deduction_qty) || 0), 0)
  const required = returnQty - remaining
  if (total >= required) return '已补足'
  return '待补冲减'
}

async function removeDynamicRow(key: string, index: number) {
  try {
    await ElMessageBox.confirm('确认删除该行？', '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger'
    })
    const row = dynamicTableData[key]?.[index]
    const salesOrderItemId = String(row?.sales_order_item_id || '').trim()
    if (config.value?.type === 'salesOrder' && key === 'items' && isEdit.value && salesOrderItemId) {
      await deleteSalesOrderItem(salesOrderItemId)
      ElMessage.success('删除成功')
    }
    dynamicTableData[key]?.splice(index, 1)
  } catch {}
}

/** 删除已上传文件回调
 *  仅在编辑态、被删项为已有后端文件（含 url 且非本次新增 raw）时联动调用后端删除接口；
 *  失败则 reject 以阻止 el-upload 从列表移除该文件。 */
async function handleRemoveFile(field: FieldConfig, file: any): Promise<void> {
  // 新增未上传的本地文件直接放行删除
  const url = file?.url || file?.raw
  if (!url || file?.raw) return
  if (!isEdit.value || !editId.value || !field.onDeleteRemote) return
  // 失败时 reject 以保留该文件在列表中；请求拦截器已统一提示错误
  await field.onDeleteRemote({ url, name: file?.name }, editId.value)
}

function handleCancel() { router.back() }

function handleReset() {
  Object.keys(formRefs.value).forEach(idx => {
    formRefs.value[Number(idx)]?.resetFields()
  })
  Object.keys(tabErrors).forEach(k => { delete tabErrors[Number(k)] })
  recalcComputedFields()
}

async function handleSubmit() {
  if (!config.value || isReadonly.value) return
  Object.keys(tabErrors).forEach(k => { delete tabErrors[Number(k)] })
  const results = await Promise.allSettled(
    config.value.tabs.map((_, idx) => {
      const ref = formRefs.value[idx]
      return ref ? ref.validate() : Promise.resolve()
    })
  )
  const firstError = results.findIndex(r => r.status === 'rejected')
  if (firstError >= 0) {
    results.forEach((r, idx) => {
      if (r.status === 'rejected') {
        const errs = (r as PromiseRejectedResult).reason
        tabErrors[idx] = errs ? Object.keys(errs).length : 1
      }
    })
    activeTab.value = String(firstError)
    ElMessage.warning('请检查表单填写')
    return
  }
  submitting.value = true
  try {
    // 过滤掉 input-suffix 的 _label 显示字段和 computed 只读字段，只提交业务字段
    const computedKeys = new Set<string>()
    config.value.tabs.forEach(tab => {
      tab.fields.forEach(f => { if (f.type === 'computed') computedKeys.add(f.key) })
    })
    const submitData: Record<string, any> = {}
    Object.entries(formData).forEach(([k, v]) => {
      if (!k.endsWith('_label') && !computedKeys.has(k)) submitData[k] = v
    })
    Object.keys(dynamicTableData).forEach(key => {
      submitData[key] = dynamicTableData[key]
    })
    Object.keys(imageFileMap).forEach(key => {
      submitData[key] = imageFileMap[key].map(f => f.url || '').filter(Boolean).join(',')
    })
    // 收集待上传的 File 对象（图片 + 附件）
    const files: Record<string, File[]> = {}
    Object.keys(imageFileMap).forEach(key => {
      const raws = imageFileMap[key].map((f: any) => f.raw).filter(Boolean)
      if (raws.length) files[key] = raws
    })
    Object.keys(fileFileMap).forEach(key => {
      const raws = fileFileMap[key].map((f: any) => f.raw).filter(Boolean)
      if (raws.length) files[key] = raws
    })
    if (isEdit.value && editId.value) {
      if (config.value.submitUpdate) {
        await config.value.submitUpdate(editId.value, submitData, files)
      }
    } else {
      if (config.value.submitCreate) {
        await config.value.submitCreate(submitData, files)
      }
    }
    ElMessage.success('保存成功')
    if (config.value?.successRoute) router.push(config.value.successRoute)
  } catch (err: any) {
    if (err?.__handledMessage) return
    const msg = err?.message || err?.data || '保存失败'
    ElMessage.error(msg)
  } finally {
    submitting.value = false
  }
}

function initFormDefaults() {
  if (!config.value) return
  config.value.tabs.forEach(tab => {
    tab.fields.forEach(field => {
      if (field.type === 'dynamic-table') {
        dynamicTableData[field.key] = []
        // 与明细数组保持同一引用，使明细行变化能触发 computed 字段（如合计）重算
        formData[field.key] = dynamicTableData[field.key]
      }
      if (field.type === 'image-upload') imageFileMap[field.key] = []
      if (field.type === 'file-upload') fileFileMap[field.key] = []
      if (field.defaultValue !== undefined) formData[field.key] = field.defaultValue
      else if (field.type === 'checkbox-group') formData[field.key] = []
      else if (!['section', 'dynamic-table', 'embedded-table', 'image-upload', 'file-upload'].includes(field.type)) formData[field.key] = ''
    })
  })
}

async function loadEditData() {
  if (!config.value || !editId.value) return
  loading.value = true
  try {
    let data: Record<string, any> | null = null
    const cacheKey = `editData:${config.value.type}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      sessionStorage.removeItem(cacheKey)
      if (config.value.loadDetail && editId.value) {
        try {
          data = await config.value.loadDetail(editId.value, JSON.parse(cached))
        } catch (err: any) {
          // 权限不足时不能用缓存的行数据兜底，否则会绕过详情接口的权限校验
          if (err?.response?.status === 403) throw err
          data = JSON.parse(cached)
        }
      } else {
        data = JSON.parse(cached)
      }
    } else if (config.value.loadDetail) {
      data = await config.value.loadDetail(editId.value)
    }
    if (data) {
      Object.assign(formData, data)
      config.value.tabs.forEach(tab => {
        tab.fields.forEach(field => {
          if (field.type === 'dynamic-table' && data![field.key]) {
            dynamicTableData[field.key] = data![field.key]
          }
          if (field.type === 'input-suffix') {
            if (field.multiple && Array.isArray(formData[field.key])) {
              // 多选：从对象数组中拼接显示名称
              const nameKey = field.labelKey || 'name'
              formData[field.key + '_label'] = (formData[field.key] as any[]).map((item: any) => item[nameKey] || '').filter(Boolean).join('、')
            } else {
              // 单选：优先使用显式声明的 labelKey，否则按约定回退
              const nameKey = field.labelKey || field.key.replace(/Id$/, 'Name')
              if (data![nameKey] !== undefined) formData[field.key + '_label'] = data![nameKey]
            }
          }
          if (field.type === 'image-upload' && data![field.key]) {
            const raw = data![field.key]
            const urls: string[] = typeof raw === 'string' ? raw.split(',').filter(Boolean) : (Array.isArray(raw) ? raw : [])
            imageFileMap[field.key] = urls.map((url, i) => ({ name: `image-${i}`, url }))
          }
          if (field.type === 'file-upload' && data![field.key]) {
            const raw = data![field.key]
            const fileList: Array<{ name: string; url: string }> = Array.isArray(raw)
              ? raw.map((item: any) => ({ name: item.file_name || item.name || 'file', url: item.file_url || item.url || '' }))
              : []
            fileFileMap[field.key] = fileList
          }
          // 多选字段：后端可能返回 str | null，统一成数组以保证 el-select multiple 回显正常
          if (field.multiple) {
            const v = formData[field.key]
            if (!Array.isArray(v)) formData[field.key] = v ? [v] : []
          }
        })
      })
    }
  } catch (err: any) {
    if (err?.response?.status === 403) {
      // request.ts 全局拦截器已弹出后端返回的权限错误提示，这里不再重复弹窗，只做退回处理
      router.back()
    } else {
      ElMessage.error('加载数据失败')
    }
  } finally {
    loading.value = false
  }
}

async function loadTreeData() {
  if (!config.value) return
  const promises: Promise<void>[] = []
  config.value.tabs.forEach(tab => {
    tab.fields.forEach(field => {
      if (field.loadTreeData) {
        const seq = (loadSeq[field.key] || 0) + 1
        loadSeq[field.key] = seq
        promises.push(
          field.loadTreeData().then(data => {
            if (loadSeq[field.key] === seq) {
              fieldTreeData[field.key] = Array.isArray(data) ? data : []
            }
          }).catch(() => {})
        )
      }
      if (field.loadOptions) {
        promises.push(
          field.loadOptions().then(opts => {
            fieldOptions[field.key] = opts
          }).catch(() => {})
        )
      }
      if (field.type === 'dynamic-table' && field.columns) {
        field.columns.forEach((col: any) => {
          if (col.loadOptions) {
            promises.push(
              col.loadOptions().then((opts: any) => {
                col.options = opts
              }).catch(() => {})
            )
          }
        })
      }
    })
  })
  await Promise.allSettled(promises)
}

/** 切换「所在城市」数据源（行政区划 / 高德地图）并重载该字段的树数据 */
async function onRegionSourceChange(field: FieldConfig, mode: 'division' | 'amap') {
  if (regionMode.value === mode) return
  setRegionMode(mode)
  if (field.loadTreeData) {
    const seq = (loadSeq[field.key] || 0) + 1
    loadSeq[field.key] = seq
    try {
      const data = await field.loadTreeData()
      if (loadSeq[field.key] !== seq) return
      fieldTreeData[field.key] = Array.isArray(data) ? data : []
      if (mode === 'amap') {
        ElMessage.success('已切换至高德地图行政区划数据')
      } else if (data && data.length) {
        ElMessage.success('已切换至后端行政区划数据')
      } else {
        ElMessage.warning('后端暂无行政区划数据，请在「系统设置 - 行政区划」中先维护省/市数据')
      }
    } catch {
      if (loadSeq[field.key] === seq) {
        fieldTreeData[field.key] = []
        ElMessage.error(
          mode === 'amap'
            ? '获取高德地图行政区划失败，请确认后端地图服务（AMAP_API_KEY）已配置且网络可用'
            : '获取后端行政区划失败，请确认服务可用',
        )
      }
    }
  }
}

onMounted(async () => {
  document.addEventListener('click', closeSuffixDropdowns)
  if (!config.value) {
    ElMessage.warning('未找到对应的表单配置')
    router.back()
    return
  }
  initFormDefaults()
  setupSyncWatchers()
  loading.value = true
  try { await loadTreeData() } catch {} finally { loading.value = false }
  // 从一键生成的客户订货单保存页返回：恢复销售订单编辑/创建时的原有（未保存）状态
  if (route.query.restoreSalesOrder === '1') {
    const snapshotKey = `salesOrderEditRestore:${config.value.type}:${editId.value || 'new'}`
    const snap = sessionStorage.getItem(snapshotKey)
    sessionStorage.removeItem(snapshotKey)
    if (snap) {
      const state = JSON.parse(snap)
      Object.assign(formData, state.formData || {})
      Object.assign(dynamicTableData, state.dynamicTableData || {})
      if (state.activeTab !== undefined) activeTab.value = String(state.activeTab)
      ElMessage.success('已保留销售订单原有数据')
    }
  } else if (isEdit.value && editId.value) {
    await loadEditData()
  } else {
    // 读取预设数据（如点击"新增子类"时传入的父类别信息；或从销售订单一键创建收款单带入的预填数据）
    const presetKey = `presetData:${config.value.type}`
    const preset = sessionStorage.getItem(presetKey)
    if (preset) {
      sessionStorage.removeItem(presetKey)
      const presetData = JSON.parse(preset)
      Object.assign(formData, presetData)
      // 为 input-suffix 字段设置 _label 显示值；为 dynamic-table 字段同步写入 dynamicTableData
      config.value.tabs.forEach(tab => {
        tab.fields.forEach(field => {
          if (field.type === 'input-suffix' && presetData[field.key] !== undefined) {
            const labelKey = field.key + '_label'
            if (presetData[labelKey] !== undefined) {
              formData[labelKey] = presetData[labelKey]
            }
          }
          // dynamic-table：Object.assign 只改了 formData[key] 引用，需同步到 dynamicTableData 以驱动表格渲染
          if (field.type === 'dynamic-table' && presetData[field.key] !== undefined) {
            dynamicTableData[field.key] = presetData[field.key]
            formData[field.key] = dynamicTableData[field.key]
          }
        })
      })
    }
  }
  // 初始化/载入完成后，计算一次 computed 字段（如"最低销售价格"）
  recalcComputedFields()
})

onUnmounted(() => {
  document.removeEventListener('click', closeSuffixDropdowns)
})
</script>

<style scoped>
.add-template-page { background: var(--bg-white); border-radius: var(--radius-md); box-shadow: var(--shadow-xs); padding: 0; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 28px; border-bottom: 1px solid var(--border-light); }
.page-header-left { display: flex; align-items: center; gap: 8px; }
.back-icon { cursor: pointer; color: var(--text-secondary); font-size: 18px; transition: color var(--transition-fast); }
.back-icon:hover { color: var(--primary); }
.back-label { cursor: pointer; font-size: var(--font-base); color: var(--text-secondary); transition: color var(--transition-fast); }
.back-label:hover { color: var(--primary); }
.header-divider { color: var(--text-tertiary); font-size: var(--font-base); margin: 0 2px; }
.page-header h3 { font-size: var(--font-h3); font-weight: 700; color: var(--text-primary); }
.header-actions { display: flex; gap: 8px; }
.page-body { padding: 24px 28px; }
.content-extra-actions { margin-bottom: 20px; }
.add-template-page :deep(.el-tabs__header) { margin-bottom: 16px; }
.add-template-page :deep(.el-form-item) { margin-bottom: 20px; }
.add-template-page :deep(.el-form-item__label) { font-size: var(--font-label); color: var(--text-secondary); }
.form-section-title { display: flex; align-items: center; gap: 8px; font-size: var(--font-h3); font-weight: 600; color: var(--text-primary); margin: 28px 0 16px; padding-left: 4px; }
.form-section-title:first-child { margin-top: 4px; }
.section-line { width: 4px; height: 18px; background: var(--primary-gradient); border-radius: 2px; flex-shrink: 0; }
.input-suffix-icon { cursor: pointer; color: var(--text-tertiary); }
.input-suffix-icon:hover { color: var(--primary); }
.input-suffix-wrapper { position: relative; width: 100%; }
/* 所在城市：数据源模式切换（行政区划 / 高德地图）置于字段标签右侧同一行，省市级联下拉在下方 */
.region-source-label { margin-right: 8px; }
.region-source-switch { display: inline-flex; vertical-align: middle; }
.region-source-switch :deep(.el-radio-button__inner) { padding: 4px 10px; font-size: 12px; }
.suffix-dropdown-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 9999;
  background: var(--bg-white);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: var(--shadow-md);
  min-width: 220px;
  max-height: 300px;
  overflow-y: auto;
  padding: 8px 0;
}
.dynamic-table-wrapper { width: 100%; }
.dynamic-table-wrapper :deep(.el-table) { border: none; }
.dynamic-table-wrapper :deep(.el-table th) { border-bottom: 1px solid var(--border-color); }
.dynamic-table-wrapper :deep(.el-table td) { border-bottom: 1px solid var(--border-light); }
.table-cell-input :deep(.el-input__wrapper) {
  box-shadow: none;
  border: none;
  border-bottom: 1px solid var(--border-color);
  border-radius: 0;
  padding: 1px 4px;
  background: transparent;
}
.table-cell-input :deep(.el-input__wrapper:hover),
.table-cell-input :deep(.el-input__wrapper.is-focus) {
  border-bottom-color: var(--primary);
}
/* 销售订单明细缺货行：数量单元格红色警示 */
.table-cell-input--error :deep(.el-input__wrapper) {
  border-bottom-color: var(--el-color-danger, #f56c6c);
}
.table-cell-input--error :deep(.el-input__inner) {
  color: var(--el-color-danger, #f56c6c);
  font-weight: 600;
}
.table-cell-display { display: inline-block; padding: 1px 4px; color: var(--text-secondary, #606266); font-size: 12px; }
/* ── 销售订单缺货气泡（表格下方，表格外提示区） ── */
.shortage-bubble {
  position: relative;
  margin-top: 10px;
  padding: 10px 14px;
  border: 1px solid var(--el-color-warning-light-5, #f3d19e);
  background: var(--el-color-warning-light-9, #fdf6ec);
  border-radius: 8px;
  font-size: 12px;
}
/* 气泡小三角，指向表格 */
.shortage-bubble::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 24px;
  width: 10px;
  height: 10px;
  background: var(--el-color-warning-light-9, #fdf6ec);
  border-left: 1px solid var(--el-color-warning-light-5, #f3d19e);
  border-top: 1px solid var(--el-color-warning-light-5, #f3d19e);
  transform: rotate(45deg);
}
.shortage-bubble__header { display: flex; align-items: center; gap: 6px; font-weight: 600; color: var(--el-color-warning, #e6a23c); margin-bottom: 6px; }
.shortage-bubble__icon { font-size: 14px; }
.shortage-bubble__item { display: flex; align-items: center; gap: 10px; padding: 3px 0; }
.shortage-bubble__name { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary, #303133); font-weight: 600; }
.shortage-bubble__detail { flex: 1; color: var(--el-color-warning, #e6a23c); font-weight: 600; }
/* 缺量数字：红色加粗，视觉焦点 */
.shortage-bubble__num { color: var(--el-color-danger, #f56c6c); font-weight: 700; font-size: 14px; }
.dynamic-table-empty { border: 1px dashed var(--border-color); border-radius: 6px; padding: 16px 0; }
.add-row-btn { margin-top: 8px; }
.role-checkbox-group { display: flex; flex-wrap: wrap; gap: 8px; }
.tab-label-wrap { display: inline-flex; align-items: center; gap: 6px; }
.add-template-page :deep(.tab-err-badge .el-badge__content) { font-size: 11px; }
.image-upload-wrapper :deep(.el-upload--picture-card) { width: 100px; height: 100px; }
.image-upload-wrapper :deep(.el-upload-list--picture-card .el-upload-list__item) { width: 100px; height: 100px; }

/* ── 响应式：小屏表单收紧 ── */
@media (max-width: 1024px) {
  .add-template-page :deep(.el-form-item) { margin-bottom: 14px; }
  .form-section-title { margin: 20px 0 12px; }
}

@media (max-width: 768px) {
  .add-template-page :deep(.el-form-item) { margin-bottom: 12px; }
}
</style>
