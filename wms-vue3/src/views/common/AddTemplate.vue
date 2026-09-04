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
          <!-- validate-on-rule-change 关闭：getFieldRules 每次渲染都返回新数组，
               默认值 true 会在选项异步加载等重渲染时立刻校验空的必填字段，
               造成「一进新增页就弹红字」。关闭后仍保留 blur/change 触发与提交时 validate() -->
          <el-form
            :ref="(el: any) => setFormRef(idx, el)"
            :model="formData"
            :label-width="config?.labelWidth || '120px'"
            :label-position="config?.labelPosition ?? 'right'"
            size="large"
            :validate-on-rule-change="false"
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
                    <div v-else-if="field.type === 'tree'" class="inline-tree-wrap">
                      <div v-if="(fieldTreeData[field.key] || field.treeData || []).length" class="inline-tree-toolbar">
                        <el-radio-group
                          v-if="field.ownerSwitch"
                          :model-value="treeOwner[field.key] || 'WMS_PLATFORM'"
                          size="small"
                          :disabled="isReadonly"
                          class="inline-tree-owner-switch"
                          @change="(o: any) => onTreeOwnerChange(field, o)"
                        >
                          <el-radio-button value="WMS_PLATFORM">平台</el-radio-button>
                          <el-radio-button value="WMS_SCANNER">扫码枪</el-radio-button>
                        </el-radio-group>
                        <span v-if="field.ownerSwitch && treeCheckedStat[field.key]" class="inline-tree-owner-hint">
                          当前已选 {{ treeCheckedStat[field.key].current }} 项<template v-if="treeCheckedStat[field.key].other > 0">；其他来源已绑定 {{ treeCheckedStat[field.key].other }} 项（切换数据源查看）</template>
                        </span>
                        <el-input
                          v-model="treeSearch[field.key]"
                          class="inline-tree-search"
                          placeholder="搜索模块 / 权限点"
                          clearable
                          :prefix-icon="Search"
                          size="small"
                        />
                        <el-button link type="primary" size="small" @click="setTreeExpanded(field, true)">全部展开</el-button>
                        <el-button link type="primary" size="small" @click="setTreeExpanded(field, false)">全部收起</el-button>
                      </div>
                      <el-tree
                        :ref="(el: any) => setFieldTreeRef(field.key, el)"
                        class="inline-check-tree"
                        :class="{ 'inline-tree-readonly': isReadonly }"
                        :data="fieldTreeData[field.key] || field.treeData || []"
                        :props="field.treeProps || { label: 'name', children: 'children' }"
                        node-key="id"
                        show-checkbox
                        :indent="28"
                        :default-expand-all="false"
                        :check-strictly="field.checkStrictly"
                        :filter-node-method="(value: string, data: any) => filterInlineTreeNode(field, value, data)"
                        @check="(data: any, info: any) => onTreeCheck(field, data, info)"
                        @vue:mounted="() => onTreeVnodeMounted(field)"
                      />
                    </div>
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
                            <el-table-column v-for="col in field.columns" :key="col.key" :width="col.width">
                              <template #header>
                                <!-- required 列表头带红星，与 el-form 必填标记视觉一致 -->
                                <span><span v-if="col.required" class="required-col-star">*</span>{{ col.label }}</span>
                              </template>
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
      <SalesReturnSelectDialog v-else-if="currentDialogType === 'salesReturn'" v-model="dialogVisible[dialogFieldKey]" :customer-id="formData.customer_id || ''" @confirm="onSalesReturnConfirm" />
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
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
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
import { useTabStore } from '@/stores/tab'
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
const tabStore = useTabStore()
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

function onTreeCheck(field: FieldConfig, data: any, info: any) {
  // 内联勾选树（type: 'tree'）天然多选，无需 multiple 标记；tree-select 仍需显式 multiple
  if (field.type !== 'tree' && !field.multiple) return
  // ownerSwitch 字段（角色权限树）：平台/扫码枪两侧共用一个表单值，而树一次只渲染一个 owner
  // 的节点，整体替换会覆盖清除另一侧已绑权限（后端角色-权限绑定是整组覆盖式保存）。
  // 因此做差量合并：当前树对「自己树里的 id」有完全决定权（勾上=并入、取消=剔除），
  // 不在当前树里的 id（另一 owner 的权限）原样保留。不能简单与旧值并集——那样当前侧
  // 取消勾选将无法移除权限。
  const preservedIds = collectOwnerPreservedIds(field)
  // 本次点击节点的子树叶子（勾/取消页面父节点时 = 级联受影响的全部叶子），
  // 连同点击后的勾选集一起传给值补全钩子做「显式勾选」差量记账
  const click = { toggledIds: collectSubtreeLeafIds(data), checkedSet: new Set<string>() }
  // 级联树（菜单→按钮→权限）：只收集叶子节点 id，父节点（menu_/btn_）不进表单值，
  // 避免提交给后端后报「权限不存在」。叶子判定：无 children 或 children 为空。
  const checkedNodes: any[] = Array.isArray(info?.checkedNodes) ? info.checkedNodes : []
  if (checkedNodes.length) {
    const leafIds = checkedNodes
      .filter((node: any) => !Array.isArray(node?.children) || node.children.length === 0)
      .map((node: any) => String(node?.id))
    click.checkedSet = new Set(leafIds)
    // 值补全钩子：角色权限树用它把写权限联动出查询权限/跨页依赖，补上的 id 若存在于树中会自动勾上
    formData[field.key] = mergeTreeCheckedValue(field, preservedIds, leafIds, click)
    return
  }
  // 兜底：拿不到节点对象时退回 checkedKeys（保持旧行为，提交侧还有前缀过滤）
  const keys = info?.checkedKeys
  if (Array.isArray(keys)) {
    const keyIds = keys.map((key: any) => String(key))
    click.checkedSet = new Set(keyIds)
    formData[field.key] = mergeTreeCheckedValue(field, preservedIds, keyIds, click)
  }
}

/**
 * 清空联动补全的「用户显式勾选集」记账：表单数据整体重载（编辑回显/预设/快照恢复）时，
 * 旧表单的勾选上下文作废，下一次树勾选事件以新数据的当前勾选态重新初始化。
 */
function clearTreePickState() {
  for (const key of Object.keys(treePickState)) delete treePickState[key]
}

/**
 * ownerSwitch 字段（角色权限树）差量合并的保留集：当前表单值中「不属于当前树」的 id。
 * 平台(WMS_PLATFORM)/扫码枪(WMS_SCANNER)两侧叶子同为 perm_code、后端按单行 JSON 数组
 * 整组绑定，故另一侧的 id 必须在当前侧勾选时保留下来一并提交。
 */
function collectOwnerPreservedIds(field: FieldConfig): string[] {
  if (!field.ownerSwitch) return []
  const prev = formData[field.key]
  const prevIds = Array.isArray(prev) ? prev.map(String) : (prev ? [String(prev)] : [])
  const known = collectTreeNodeIds(fieldTreeData[field.key] || field.treeData || [])
  return prevIds.filter(id => !known.has(id))
}

/** 联动补全的「用户显式勾选集」记账（key=field.key）：见 mergeTreeCheckedValue */
const treePickState: Record<string, Set<string>> = {}

/** 收集本次点击节点的子树叶子 id（勾/取消页面父节点时 = 级联受影响的全部叶子） */
function collectSubtreeLeafIds(node: any, acc: string[] = []): string[] {
  if (!node || node.id === undefined || node.id === null) return acc
  if (!Array.isArray(node.children) || node.children.length === 0) acc.push(String(node.id))
  else node.children.forEach((child: any) => collectSubtreeLeafIds(child, acc))
  return acc
}

/** 按 id 找树节点显示名（联动取消提示用） */
function findTreeNodeLabel(nodes: any[], id: string): string {
  for (const n of nodes || []) {
    if (n && String(n.id) === id) return String(n.label ?? n.name ?? id)
    if (Array.isArray(n?.children)) {
      const hit = findTreeNodeLabel(n.children, id)
      if (hit) return hit
    }
  }
  return ''
}

/**
 * 保留集与本次勾选集合并后再过值补全钩子（expandCheckedIds 只增不删）。
 *
 * ⚠️ 联动补全的「显式勾选集」差量记账：若直接拿「当前树勾选集」做联动，上一次联动
 * 补出的码（挂在其他父节点下）会被当成用户勾选继续参与匹配——用户取消勾选原节点时
 * 这些码被反复补回，节点永远取消不掉（2026-09-04 无法取消问题）。因此这里维护
 * 「用户显式勾选集」（treePickState）：
 *   - 勾选事件：本次点击节点子树的叶子并入 picks；
 *   - 取消事件：从 picks 剔除（联动需要它的码若仍被其他已勾页面依赖，会保留并给出提示）；
 *   - 联动只对 picks 重算，补出的码不进 picks——取消页面节点时随之熄灭。
 * 首次事件（回显后第一次点击）以当前勾选态初始化 picks：保存值本就是补全后的展开集，
 * 以其为显式勾选重算联动是幂等的。
 */
function mergeTreeCheckedValue(field: FieldConfig, preservedIds: string[], nextIds: string[], click?: { toggledIds: string[]; checkedSet: Set<string> }) {
  const merged = field.ownerSwitch ? [...preservedIds, ...nextIds] : nextIds
  if (typeof field.expandCheckedIds !== 'function') return merged
  let picks = treePickState[field.key]
  if (!picks) {
    picks = new Set(merged)
    treePickState[field.key] = picks
  }
  if (click && click.toggledIds.length) {
    const isCheck = click.toggledIds.some(id => click.checkedSet.has(id))
    for (const id of click.toggledIds) {
      if (isCheck) picks.add(id)
      else picks.delete(id)
    }
    const expanded = field.expandCheckedIds([...picks, ...preservedIds.filter(id => !picks.has(id))])
    if (!isCheck) {
      // 用户明确取消、但仍被其他已勾选页面的联动需要的码：解释为什么取消不掉
      const bounced = click.toggledIds.filter(id => expanded.includes(id))
      if (bounced.length) {
        const labels = [...new Set(bounced.map(id => findTreeNodeLabel(fieldTreeData[field.key] || field.treeData || [], id)).filter(Boolean))]
        ElMessage.warning(`「${labels.join('、') || bounced.length + ' 项权限'}」仍被已勾选页面的联动权限需要；如需取消，请先取消对应页面的勾选`)
      }
    }
    return expanded
  }
  return field.expandCheckedIds([...picks, ...preservedIds.filter(id => !picks.has(id))])
}

// —— 内联勾选树（type: 'tree'，角色权限选择） ——
const fieldTreeRefs: Record<string, any> = {}
/** 内联树的搜索关键字（按字段 key 存放） */
const treeSearch = reactive<Record<string, string>>({})
/** 内联树数据源归属（ownerSwitch 字段用）：WMS_PLATFORM=平台权限 / WMS_SCANNER=扫码枪权限 */
const treeOwner = reactive<Record<string, string>>({})
/** ownerSwitch 字段勾选统计（工具栏提示用）：current=当前树内已选数，other=其他来源（另一数据源/已失效）已绑定数 */
const treeCheckedStat = reactive<Record<string, { current: number; other: number }>>({})
/** ownerSwitch 字段数据源切换中标志：窗口期内统计属旧树口径，watch 暂不重算（提示保持隐藏） */
const treeOwnerLoading = reactive<Record<string, boolean>>({})
/** 结构节点 id 前缀（与 formConfigs serializePermissionIds 的提交侧黑名单同口径），仅用于统计展示 */
const TREE_STRUCT_ID_RE = /^(menu_|btn_|module:|page:)/
function setFieldTreeRef(key: string, el: any) {
  // ⚠️ 必须保持纯注册，禁止在此做任何业务逻辑：内联函数 ref 在父组件每次重渲染时都会被
  // 重调（旧 null 新 el），且回调发生在 ElFormItem 渲染 effect 栈内——此时读 formData /
  // 深度遍历 fieldTreeData 会被追踪为 ElFormItem 的渲染依赖，写 reactive 统计则直接
  // 自激成「ref 回调 → 写 → 重渲染 → ref 回调」无限循环（Maximum recursive updates
  // exceeded in <ElFormItem>，已踩坑两次）。重放勾选态走 onTreeVnodeMounted。
  if (el) fieldTreeRefs[key] = el
  else delete fieldTreeRefs[key]
}

/**
 * el-tree 真挂载（含 v-if 卸载重建）完成时重放勾选态：keep-alive 缓存期间路由切走会让
 * config（依赖 route.query.type）变 undefined、v-if 卸载整棵树，切回标签页时树全新挂载
 * 而 formData/fieldTreeData 无变化，deep watch（勾选同步入口之一）不会触发，必须显式重放。
 * @vnode-mounted 只在 vnode 实际挂载时触发一次，父组件普通重渲染不触发，天然规避函数 ref
 * 的每渲染重调问题；且 post 队列执行时无 activeEffect，此处响应式读取不会被渲染追踪。
 * ref 注册（setFieldTreeRef）先于 post 队列执行，此时 fieldTreeRefs 必已就绪。
 */
function onTreeVnodeMounted(field: FieldConfig) {
  syncTreeCheckedKeys(field)
}

/** 搜索过滤：按节点名称（模块/权限点）模糊匹配，命中节点的祖先链自动保留 */
function filterInlineTreeNode(field: FieldConfig, value: string, data: any): boolean {
  const kw = (value || '').trim().toLowerCase()
  if (!kw) return true
  const labelKey = field.treeProps?.label || 'name'
  return String(data?.[labelKey] ?? data?.label ?? '').toLowerCase().includes(kw)
}

/** 全部展开/收起：直接批量改 store 内节点展开态（el-tree 无 expandAll 方法） */
function setTreeExpanded(field: FieldConfig, expanded: boolean) {
  const nodesMap = fieldTreeRefs[field.key]?.store?.nodesMap
  if (!nodesMap) return
  Object.values(nodesMap).forEach((node: any) => { node.expanded = expanded })
}

/** 递归收集树中全部节点 id（用于过滤 formData 值，防止 setCheckedKeys 传入了树中不存在的 id） */
function collectTreeNodeIds(nodes: any[], acc: Set<string> = new Set()): Set<string> {
  for (const n of nodes || []) {
    if (n?.id !== undefined && n?.id !== null) acc.add(String(n.id))
    if (Array.isArray(n?.children)) collectTreeNodeIds(n.children, acc)
  }
  return acc
}

/**
 * 自底向上收集勾选键：叶子勾选集 + 「子节点全部勾选」的结构父节点 id，返回该子树是否全勾选。
 * el-tree 级联模式通常会自动推导父节点勾选/半选态，但兜底树（其他权限）里存在 DB 脏数据
 * 形态（如 bth_ 前缀按钮、同名按钮/权限码重复登记）时，个别父节点可能不被同步；
 * 显式把全勾选父节点并入 setCheckedKeys 的键集，保证父节点视觉状态必然与叶子一致。
 * 不变量：只允许推入「后代全部勾选」的父节点——setCheckedKeys 对父节点按 deep 级联
 * 勾选整棵子树，推入非全勾父节点会把授权静默放大成整棵子树。
 */
function collectCheckedKeysWithParents(nodes: any[], leafChecked: Set<string>, keys: string[]): boolean {
  let all = Array.isArray(nodes) && nodes.length > 0
  for (const n of nodes || []) {
    if (Array.isArray(n?.children) && n.children.length) {
      const childAll = collectCheckedKeysWithParents(n.children, leafChecked, keys)
      if (childAll) keys.push(String(n.id))
      all = all && childAll
    } else {
      all = all && leafChecked.has(String(n?.id))
    }
  }
  return all
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

// 内联勾选树（type: 'tree'，角色权限选择）回显同步：formData（详情回显 / 勾选联动补全）
// 或树数据（异步加载完成）变化时，把存在于树中的叶子 id 同步为勾选态；「子节点全部勾选」的
// 结构父节点 id 一并并入键集，显式同步父节点勾选态（见 collectCheckedKeysWithParents）。
// setCheckedKeys 为程序赋值，不触发 check 事件，不会与 onTreeCheck 互相干扰。
watch([formData, fieldTreeData], () => {
  const fields = config.value?.tabs.flatMap(t => t.fields).filter(f => f.type === 'tree') || []
  for (const field of fields) {
    syncTreeCheckedKeys(field)
  }
}, { deep: true })

/** 把 formData 中「存在于当前树」的叶子 id 同步为勾选态，并刷新 ownerSwitch 字段的工具栏提示统计 */
function syncTreeCheckedKeys(field: FieldConfig) {
  const val = formData[field.key]
  const ids = (Array.isArray(val) ? val : val ? [val] : []).map(String)
  const treeData = fieldTreeData[field.key] || field.treeData || []
  const known = collectTreeNodeIds(treeData)
  // 统计放在 treeRef 判空之前：树刚挂载（ref 未就绪）时也要能算出提示数字。
  // 切换数据源的加载窗口期内（treeOwnerLoading）统计仍是旧树口径，暂不重算、提示保持隐藏；
  // 统计前剔除结构节点 id（与提交侧 serializePermissionIds 的前缀黑名单同口径），
  // 避免脏 id 被计入「其他来源已绑定」
  if (field.ownerSwitch && !treeOwnerLoading[field.key]) {
    const permIds = ids.filter(id => !TREE_STRUCT_ID_RE.test(id))
    const inCurrent = permIds.reduce((n, id) => n + (known.has(id) ? 1 : 0), 0)
    const other = permIds.length - inCurrent
    // 值稳定写（必须）：内联函数 ref 在父组件每次重渲染时都会重调 setFieldTreeRef → 本函数，
    // 若无条件赋新对象会形成「ref 回调 → reactive 写 → 重渲染 → ref 回调」自激无限循环
    // （Maximum recursive updates exceeded in <ElFormItem>），值相同必须跳过赋值以收敛
    const prev = treeCheckedStat[field.key]
    if (!prev || prev.current !== inCurrent || prev.other !== other) {
      treeCheckedStat[field.key] = { current: inCurrent, other }
    }
  }
  const treeRef = fieldTreeRefs[field.key]
  if (!treeRef) return
  const leafSet = new Set(ids.filter(id => known.has(id)))
  const keys = [...leafSet]
  collectCheckedKeysWithParents(treeData, leafSet, keys)
  const target = [...new Set(keys)]
  // 等价跳过：setCheckedKeys 内部先全清所有节点再逐个重设，重复调用会引发整树勾选重放
  // （几百节点权限树下有明显卡顿）。当前勾选与目标一致时直接返回，口径与 target 一致
  // （叶子 + 全勾父节点；级联模式下全勾父节点 checked=true 本就含在 getCheckedKeys 中）
  const current: string[] = typeof treeRef.getCheckedKeys === 'function' ? treeRef.getCheckedKeys() : []
  if (current.length === target.length) {
    const curSet = new Set(current.map(String))
    if (target.every(k => curSet.has(k))) return
  }
  treeRef.setCheckedKeys(target)
}

// 搜索关键字变化 → 调用 el-tree 过滤；有关键字时自动全部展开，方便直接看到命中项
watch(treeSearch, () => {
  const fields = config.value?.tabs.flatMap(t => t.fields).filter(f => f.type === 'tree') || []
  for (const field of fields) {
    const treeRef = fieldTreeRefs[field.key]
    if (!treeRef) continue
    const kw = (treeSearch[field.key] || '').trim()
    if (kw) setTreeExpanded(field, true)
    treeRef.filter(kw)
  }
})

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
      // blur + change 双触发：选择类字段选完立即消除提示，输入类字段配合下方 watcher 实现改对即消
      trigger: ['blur', 'change']
    })
  }
  if (field.rules) (field.rules as FormItemRule[]).forEach(r => rules.push(r))
  return rules
}

/**
 * 校验提示即时消除：监听表单值变化，仅对「当前已处于错误态」的字段立即重校验。
 * 效果：提交后出现的红色提示，用户把内容改对的瞬间即消失，无需等 blur；
 * 未出错的字段不会被顺手触发校验，避免"越打字报错越多"。
 */
let prevFormSnapshot: Record<string, any> = {}
function refreshTabErrors(idx: number) {
  const form = formRefs.value[idx]
  if (!form) return
  const count = ((form.fields || []) as any[]).filter(f => f.validateState === 'error').length
  if (count > 0) tabErrors[idx] = count
  else delete tabErrors[idx]
}
watch(formData, () => {
  const changedKeys = Object.keys(formData).filter(k => formData[k] !== prevFormSnapshot[k])
  prevFormSnapshot = { ...formData }
  if (!changedKeys.length) return
  config.value?.tabs.forEach((_, idx) => {
    const form = formRefs.value[idx]
    if (!form) return
    const erroredProps = ((form.fields || []) as any[])
      .filter(f => f.validateState === 'error' && changedKeys.includes(String(f.prop)))
      .map(f => f.prop)
    if (!erroredProps.length) return
    Promise.resolve(form.validateField(erroredProps))
      .then(() => refreshTabErrors(idx))
      .catch(() => refreshTabErrors(idx))
  })
}, { deep: true })

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

function onPendingReturnConfirm(items: Array<{ purchase_order_id: string; purchase_order_item_id: string; purchase_order_no: string; return_price: number; return_qty: number; remaining: number; product_name: string; product_code: string; category_name: string; specification: string; color: string; unit_name: string; purchase_price: string }>) {
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
      purchase_order_id: item.purchase_order_id,
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
    // 本页在 keep-alive 缓存中（切换标签保留草稿）；保存成功后作废缓存，
    // 重开该标签时按模式重新初始化：新增=空表单，编辑=重载保存后的最新详情
    tabStore.invalidateTab(route.fullPath)
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
      clearTreePickState()
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
          field.loadTreeData(treeOwner[field.key]).then(data => {
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

/** 切换权限树数据源归属（平台 / 扫码枪）并重载该字段的树数据 */
async function onTreeOwnerChange(field: FieldConfig, owner: string) {
  if ((treeOwner[field.key] || 'WMS_PLATFORM') === owner) return
  treeOwner[field.key] = owner
  // 切换后搜索关键字对新树无意义，清空避免残留过滤态
  treeSearch[field.key] = ''
  // 统计是旧树口径，先清除并置切换中标志（提示随之隐藏），等新树数据落地后再重算，
  // 避免加载窗口期内「当前已选 N 项」与新选中的数据源语义相反
  delete treeCheckedStat[field.key]
  treeOwnerLoading[field.key] = true
  if (!field.loadTreeData) return
  const seq = (loadSeq[field.key] || 0) + 1
  loadSeq[field.key] = seq
  try {
    const data = await field.loadTreeData(owner)
    if (loadSeq[field.key] !== seq) return
    fieldTreeData[field.key] = Array.isArray(data) ? data : []
    treeOwnerLoading[field.key] = false
    // 不依赖 el-tree「setCheckedKeys 写入 defaultCheckedKeys → 数据重建后重放」的内部时序：
    // 新树渲染完成后显式同步一次勾选态（同时算出新口径统计），保证切换回显
    // 不随 element-plus 内部实现变化而失效
    await nextTick()
    if (loadSeq[field.key] === seq && (treeOwner[field.key] || 'WMS_PLATFORM') === owner) {
      syncTreeCheckedKeys(field)
    }
    ElMessage.success(owner === 'WMS_SCANNER' ? '已切换至扫码枪权限' : '已切换至平台权限')
  } catch {
    if (loadSeq[field.key] === seq) {
      // 保留旧树数据而非清空：工具栏（含 owner 切换按钮）只在树有数据时渲染，
      // 清空会导致用户无法切回；仅显式同步旧树勾选态并报错，统计随标志保持隐藏
      syncTreeCheckedKeys(field)
      ElMessage.error('切换权限数据源失败，请确认服务可用')
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
  // await 间隙路由可能已切走（如关闭标签页、被其他跳转打断），config 依赖 route.query.type
  // 会变为 undefined；继续执行会在下方 config.value.type 处抛
  // 「Cannot read properties of undefined (reading 'type')」，直接终止即可
  if (!config.value) return
  // 从一键生成的客户订货单保存页返回：恢复销售订单编辑/创建时的原有（未保存）状态
  if (route.query.restoreSalesOrder === '1') {
    const snapshotKey = `salesOrderEditRestore:${config.value.type}:${editId.value || 'new'}`
    const snap = sessionStorage.getItem(snapshotKey)
    sessionStorage.removeItem(snapshotKey)
    if (snap) {
      const state = JSON.parse(snap)
      clearTreePickState()
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
      clearTreePickState()
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
.add-template-page :deep(.el-form-item) { margin-bottom: 22px !important; }
/* 校验错误提示为绝对定位（不占布局），需保证 z-index 不被下一行输入框盖住 */
.add-template-page :deep(.el-form-item__error) { position: absolute; z-index: 20; padding-top: 3px; line-height: 1; }
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
/* dynamic-table 必填列表头红星，与 el-form 必填标记同色 */
.required-col-star { color: var(--el-color-danger); margin-right: 2px; }
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
/* 内联勾选树（角色权限设置）：限高滚动，默认收起 */
.inline-check-tree {
  width: 100%;
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 4px;
  padding: 6px;
}
.inline-tree-readonly { opacity: 0.6; pointer-events: none; }
/* 视觉层级优化：勾选行整行淡色高亮（全选=淡蓝底，父级半选=更淡），不只复选框变色 */
.inline-check-tree :deep(.el-tree-node__content) { transition: background-color 0.15s ease; }
.inline-check-tree :deep(.el-tree-node__content:has(.el-checkbox__input.is-checked)) {
  background: var(--el-color-primary-light-9, #ecf5ff);
}
.inline-check-tree :deep(.el-tree-node__content:has(.el-checkbox__input.is-indeterminate)) {
  background: color-mix(in srgb, var(--el-color-primary-light-9, #ecf5ff) 55%, transparent);
}
/* 树容器撑满表单内容区（父级 el-form-item__content 为 flex，子项默认按内容收缩） */
.inline-tree-wrap { width: 100%; min-width: 0; }
/* 树顶部工具栏：搜索 + 全部展开/收起 */
.inline-tree-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; row-gap: 4px; margin-bottom: 8px; }
.inline-tree-owner-switch { margin-right: 12px; }
.inline-tree-owner-hint { margin-right: 12px; font-size: 12px; color: var(--el-text-color-secondary); white-space: nowrap; }
.inline-tree-search { width: 240px; margin-right: auto; }
/* 顶级模块名称加重，与子级（按钮/权限）拉开层级 */
.inline-check-tree > :deep(.el-tree-node) > .el-tree-node__content .el-tree-node__label {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.tab-label-wrap { display: inline-flex; align-items: center; gap: 6px; }
.add-template-page :deep(.tab-err-badge .el-badge__content) { font-size: 11px; }
.image-upload-wrapper :deep(.el-upload--picture-card) { width: 100px; height: 100px; }
.image-upload-wrapper :deep(.el-upload-list--picture-card .el-upload-list__item) { width: 100px; height: 100px; }

/* ── 响应式：小屏表单收紧 ── */
@media (max-width: 1024px) {
  .add-template-page :deep(.el-form-item) { margin-bottom: 18px !important; }
  .form-section-title { margin: 20px 0 12px; }
}

@media (max-width: 768px) {
  .add-template-page :deep(.el-form-item) { margin-bottom: 16px !important; }
}
</style>
