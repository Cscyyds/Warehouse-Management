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
                      :min="field.min"
                      :max="field.max"
                      :placeholder="field.placeholder"
                      :disabled="field.disabled || (isEdit && field.disabledInEdit) || isReadonly"
                      style="width:100%"
                      @change="(val: any) => field.onChange?.(val, formData)"
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
                    <!-- 只读态：直接渲染可点击放大的缩略图（el-upload 在 disabled 下不可点击预览） -->
                    <div v-if="isReadonly" class="readonly-upload-wrapper">
                      <div v-if="(imageFileMap[field.key] || []).length" class="readonly-image-list">
                        <el-image
                          v-for="(img, idx) in imageFileMap[field.key]"
                          :key="img.url || idx"
                          class="readonly-image-item"
                          :src="img.url"
                          :preview-src-list="readonlyImageUrls(field.key)"
                          :initial-index="idx"
                          fit="cover"
                          preview-teleported
                        >
                          <template #error>
                            <div class="readonly-image-error"><el-icon><Picture /></el-icon></div>
                          </template>
                        </el-image>
                      </div>
                      <span v-else class="readonly-upload-empty">-</span>
                    </div>
                    <div v-else class="image-upload-wrapper">
                      <el-upload
                        v-model:file-list="imageFileMap[field.key]"
                        list-type="picture-card"
                        :auto-upload="false"
                        :limit="field.maxImages || 9"
                        :on-exceed="() => ElMessage.warning(`最多上传 ${field.maxImages || 9} 张图片`)"
                        :on-change="(file: any, fileList: any[]) => handleUploadChange(field, 'image', file, fileList)"
                        :on-remove="(file: any) => handleRemoveFile(field, file)"
                        accept="image/*"
                      >
                        <el-icon><Plus /></el-icon>
                      </el-upload>
                      <div class="el-upload__tip">{{ getUploadTip(field, 'image') }}</div>
                    </div>
                  </el-form-item>
                </el-col>
                <el-col v-if="field.type === 'file-upload'" :span="field.span || 24" :key="'file-' + field.key">
                  <el-form-item :label="field.label">
                    <!-- 只读态：附件渲染为可点击打开/下载的链接列表 -->
                    <div v-if="isReadonly" class="readonly-upload-wrapper">
                      <ul v-if="(fileFileMap[field.key] || []).length" class="readonly-file-list">
                        <li v-for="(f, idx) in fileFileMap[field.key]" :key="f.url || idx" class="readonly-file-item">
                          <el-icon class="readonly-file-icon"><Document /></el-icon>
                          <a :href="f.url" target="_blank" rel="noopener noreferrer" class="readonly-file-link" :title="f.name">
                            {{ f.name || f.url }}
                          </a>
                        </li>
                      </ul>
                      <span v-else class="readonly-upload-empty">-</span>
                    </div>
                    <div v-else class="file-upload-wrapper">
                      <el-upload
                        v-model:file-list="fileFileMap[field.key]"
                        :auto-upload="false"
                        :limit="field.maxFiles || 5"
                        :on-exceed="() => ElMessage.warning(`最多上传 ${field.maxFiles || 5} 个文件`)"
                        :on-change="(file: any, fileList: any[]) => handleUploadChange(field, 'file', file, fileList)"
                        :on-remove="(file: any) => handleRemoveFile(field, file)"
                      >
                        <el-button type="primary" plain>
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
                    <!-- 采购订单：明细涉及多个供应商时，条件出现供应商拆分提示条（按钮在表格下方的「新增产品明细」旁）。
                         仅新增态出现——只读详情不可操作；编辑已有单时拆分会产生新单，语义混乱 -->
                    <div v-if="!isReadonly && !isEdit && field.key === purchaseItemsFieldKey && purchaseSupplierGroups.length > 1" class="supplier-split-bar">
                      <div class="supplier-split-text">
                        本单明细涉及 <b>{{ purchaseSupplierGroups.length }}</b> 个供应商：
                        <span v-for="(g, i) in purchaseSupplierGroups" :key="g.supplier_id" class="supplier-split-chip">
                          {{ g.supplier_name || g.supplier_id }}（{{ g.rows.length }} 项）<template v-if="i < purchaseSupplierGroups.length - 1">、</template>
                        </span>
                        —— 可按供应商一键拆分为多张采购订单
                      </div>
                    </div>
                    <div class="dynamic-table-wrapper">
                      <!-- 销售退货明细：专用优化组件 -->
                      <template v-if="config?.type === 'salesReturn' && field.key === 'items'">
                        <ReturnDetailTable
                          :rows="dynamicTableData[field.key] || []"
                          :extra-add-label="!isReadonly ? (field.extraAdd?.label || '') : ''"
                          :can-add-order="!isReadonly && showOrderAddBtn(field.key)"
                          :can-add-no-order="showNoOrderAddBtn(field.key)"
                          @add="addDynamicRow(field.key, field)"
                          @add-no-order="openNoOrderProductDialog(field.key, field)"
                          @remove="(idx: number) => removeDynamicRow(field.key, idx)"
                        />
                      </template>
                      <template v-else>
                        <div v-if="!dynamicTableData[field.key]?.length" class="dynamic-table-empty">
                          <el-empty description="暂无数据" :image-size="56">
                            <el-button v-if="!isReadonly && showOrderAddBtn(field.key)" size="small" @click="addDynamicRow(field.key, field)">+ {{ field.addLabel || '新增' }}</el-button>
                            <el-button v-if="!isReadonly && field.extraAdd && showNoOrderAddBtn(field.key)" size="small" @click="openNoOrderProductDialog(field.key, field)">+ {{ field.extraAdd.label }}</el-button>
                            <!-- 采购订单：按供应商拆分入口（与新增明细同排） -->
                            <el-button v-if="!isReadonly && !isEdit && field.key === purchaseItemsFieldKey && purchaseSupplierGroups.length > 1" type="primary" plain size="small" @click="handleSplitPurchaseBySupplier">按供应商拆分为 {{ purchaseSupplierGroups.length }} 张采购订单</el-button>
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
                                <el-input v-if="!col.type || col.type === 'input'" v-model="row[col.key]" size="small" :class="['table-cell-input', { 'table-cell-input--preset': isPresetPriceCell(row, col) }]" :placeholder="col.placeholder" :disabled="isReadonly" @input="onTableInputDebounced(field, col, row)" @change="onTableInputChange(field, col, row)" />
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
                          <el-button v-if="!isReadonly && showOrderAddBtn(field.key)" class="add-row-btn" size="small" @click="addDynamicRow(field.key, field)">+ {{ field.addLabel || '新增' }}</el-button>
                          <el-button v-if="!isReadonly && field.extraAdd && showNoOrderAddBtn(field.key)" class="add-row-btn" size="small" @click="openNoOrderProductDialog(field.key, field)">+ {{ field.extraAdd.label }}</el-button>
                          <!-- 采购订单：按供应商拆分入口（与新增明细同排） -->
                          <el-button v-if="!isReadonly && !isEdit && field.key === purchaseItemsFieldKey && purchaseSupplierGroups.length > 1" class="add-row-btn" type="primary" plain size="small" @click="handleSplitPurchaseBySupplier">按供应商拆分为 {{ purchaseSupplierGroups.length }} 张采购订单</el-button>
                          <!-- 销售订单：缺货提示气泡（表格外展示，不打断表格阅读） -->
                          <div
                            v-if="config?.type === 'salesOrder' && field.key === 'items' && shortageRows.length"
                            class="shortage-bubble"
                          >
                            <div class="shortage-bubble__header">
                              <el-icon class="shortage-bubble__icon"><WarningFilled /></el-icon>
                              <span>{{ shortageRows.length }} 个产品库存不足</span>
                              <!-- 一键把全部缺货行按缺量继承到客户订货单（不再逐行生单） -->
                              <el-button class="shortage-bubble__action" type="warning" size="small" plain @click="onSalesOrderShortageBulkClick">生成订货单</el-button>
                            </div>
                            <div v-for="item in shortageRows" :key="item.product_id" class="shortage-bubble__item">
                              <span class="shortage-bubble__name" :title="item.product_name">{{ item.product_name || item.product_code }}</span>
                              <span class="shortage-bubble__detail">库存 {{ item.available_stock }}，需 {{ item.qty }}，缺 <strong class="shortage-bubble__num">{{ item._shortageQty }}</strong></span>
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
      <!-- 动态表格内"供应商"列选择（列配置 dialogMultiple 时多选：首个写入编辑行，其余逐行追加；均按已选项去重） -->
      <SupplierSelectDialog v-if="tableDialogVisible.supplier" v-model="tableDialogVisible.supplier" :multiple="tableDialogMultiple" :exclude-ids="tableSupplierExcludeIds" @confirm="onTableSupplierConfirm" @confirm-multiple="onTableSupplierMultipleConfirm" />
      <EmployeeSelectDialog v-else-if="currentDialogType === 'employee'" v-model="dialogVisible[dialogFieldKey]" @confirm="onEmployeeConfirm" />
      <CustomerSelectDialog v-else-if="currentDialogType === 'customer'" v-model="dialogVisible[dialogFieldKey]" @confirm="onCustomerConfirm" />
      <PurchaseOrderSelectDialog v-else-if="currentDialogType === 'purchaseOrder'" v-model="dialogVisible[dialogFieldKey]" :supplier-id="formData.supplier_id || ''" :monthly-only="currentDialogMonthlyOnly" @confirm="onPurchaseOrderConfirm" />
      <PurchaseReturnSelectDialog v-else-if="currentDialogType === 'purchaseReturn'" v-model="dialogVisible[dialogFieldKey]" :multiple="false" @confirm="onPurchaseReturnConfirm" />
      <SalesReturnSelectDialog v-else-if="currentDialogType === 'salesReturn'" v-model="dialogVisible[dialogFieldKey]" :customer-id="formData.customer_id || ''" @confirm="onSalesReturnConfirm" />
      <SalesOrderSelectDialog v-else-if="currentDialogType === 'salesOrder'" v-model="dialogVisible[dialogFieldKey]" @confirm="onSalesOrderConfirm" />
      <ProductSelectDialog v-model="tableDialogVisible.product" :supplier-id="formData.supplier_id || ''" :multiple="productDialogMultiple" @confirm="onProductConfirm" @confirm-multiple="onProductMultipleConfirm" />
      <!-- 组合产品展开：选中组合产品后展开其子产品结构树，勾选后作为明细行加入本单（不跳转、不拆单） -->
      <CombinedProductExpandDialog
        v-model="combinedExpandVisible"
        :product-ids="combinedExpandCtx?.productIds || []"
        :plain-products="combinedExpandCtx?.plainProducts || []"
        :supplier-id="formData.supplier_id || ''"
        :exclude-ids="combinedExpandCtx ? currentItemProductIds(combinedExpandCtx.fieldKey) : []"
        :scene="config?.type === 'purchaseOrder' ? 'purchase' : 'sales'"
        @confirm="onCombinedExpandConfirm"
      />
      <ProductUnitSelectDialog v-model="tableDialogVisible.unit" @confirm="onProductUnitConfirm" />
      <PendingReceiptSelectDialog v-model="tableDialogVisible.pendingReceipt" :supplier-id="formData.supplier_id || ''" @confirm="onPendingReceiptConfirm" />
      <PendingReturnSelectDialog v-model="tableDialogVisible.pendingReturn" :supplier-id="formData.supplier_id || ''" :return-type="getPurchaseReturnType()" @confirm="onPendingReturnConfirm" />
      <UnpaidOrderSelectDialog v-model="tableDialogVisible.unpaidOrder" :supplier-id="formData.supplier_id || ''" :exclude-order-ids="getExistingUnpaidOrderIds()" @confirmMultiple="onUnpaidOrdersConfirm" />
      <SalesOrderSelectDialog v-model="tableDialogVisible.salesOrderForItems" :customer-id="formData.customer_id || ''" @confirm="onSalesOrderForItemsConfirm" />
      <SalesReturnItemSelectDialog v-model="tableDialogVisible.salesReturnItem" :customer-id="formData.customer_id || ''" :locked-sales-order-id="salesReturnLockedOrderId" @confirm="onSalesReturnItemsConfirm" />
      <NoOrderProductSelectDialog
        v-model="tableDialogVisible.noOrderProduct"
        :scene="noOrderCtx?.scene || 'sales'"
        :supplier-id="noOrderCtx?.supplierFilter ? (formData.supplier_id || '') : ''"
        :supplier-name="formData.supplier_id_label || ''"
        :exclude-ids="noOrderExcludeIds"
        @confirm="onNoOrderProductConfirm"
      />
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
import { ref, reactive, computed, h, onActivated, onBeforeMount, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Delete, Upload, Search, WarningFilled, Plus, Picture, Document } from '@element-plus/icons-vue'
import { getSceneConfig, type FieldConfig, type ExtraActionConfig } from '@/config/formConfigs'
import { global_opt_width } from '@/utils/data'
import { regionMode, setRegionMode, loadCityTree } from '@/utils/regionCity'
import {
  deleteSalesOrderItem, deleteSalesReturnItem,
  deletePurchaseOrderItem, deletePurchaseInboundItems, deletePurchaseReturnItem,
  deletePaymentOrderItem, deleteCollectionReceiptItem,
  getProductDetail,
} from '@/api'
import type { FormItemRule } from 'element-plus'
import SupplierSelectDialog from '@/views/purchase/SupplierSelectDialog.vue'
import EmployeeSelectDialog from '@/views/customer/EmployeeSelectDialog.vue'
import CustomerSelectDialog from '@/views/customer/CustomerSelectDialog.vue'
import PurchaseOrderSelectDialog from '@/views/finance/PurchaseOrderSelectDialog.vue'
import PurchaseReturnSelectDialog from '@/views/finance/PurchaseReturnSelectDialog.vue'
import SalesOrderSelectDialog from '@/views/sales/SalesOrderSelectDialog.vue'
import ProductSelectDialog from '@/views/product/ProductSelectDialog.vue'
import ProductUnitSelectDialog from '@/views/product/ProductUnitSelectDialog.vue'
import CombinedProductExpandDialog from '@/views/purchase/CombinedProductExpandDialog.vue'
import type { PurchaseItemRow } from '@/views/purchase/CombinedProductExpandDialog.vue'
import NoOrderProductSelectDialog from '@/views/product/NoOrderProductSelectDialog.vue'
import type { NoOrderProductRow } from '@/views/product/noOrderProduct'
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
const salesReturnHadLoadedItems = ref(false)
const submitting = ref(false)
const loading = ref(false)
const formRefs = ref<Record<number, any>>({})
const dynamicTableData = reactive<Record<string, any[]>>({})
const suffixDropdownVisible = reactive<Record<string, boolean>>({})
const dialogVisible = reactive<Record<string, boolean>>({})
const dialogFieldKey = ref<string>('')
const tableDialogVisible = reactive<Record<string, boolean>>({ product: false, unit: false, pendingReceipt: false, pendingReturn: false, unpaidOrder: false, salesOrderForItems: false, salesReturnItem: false, noOrderProduct: false, supplier: false })
const tableDialogCtx = ref<{ fieldKey: string; col: any; row: any } | null>(null)
/** 「添加无来源单据产品」弹窗上下文：由哪个明细表格触发、走销售还是采购口径、是否按供应商过滤 */
const noOrderCtx = ref<{ fieldKey: string; scene: 'sales' | 'purchase'; supplierFilter: boolean } | null>(null)
// 「选择可退明细」弹窗的同单锁定ID（后端要求一张退货单只能关联一张销售订单）。
// 优先取主单已绑定的销售订单（编辑态来自详情接口，是权威来源），
// 其次退回已添加明细行所属订单（新增态：首次选单后即锁定，跨弹窗会话持续生效）。
const salesReturnLockedOrderId = computed<string>(() => {
  const mainOrderId = String((formData as any).sales_order_id || '').trim()
  if (mainOrderId) return mainOrderId
  const ctx = tableDialogCtx.value
  if (!ctx) return ''
  const rows = dynamicTableData[ctx.fieldKey] || []
  const first = rows.find((r: any) => r.sales_order_id)
  return first?.sales_order_id || ''
})
/**
 * 退货明细模式判定（后端 has_sales_record / has_purchase_record 是主单级开关，
 * 一张单据只能处于其中一种模式，创建后不可变更）：
 *  'order'   = 关联来源单据（销售/采购订单明细）
 *  'product' = 无来源单据，直接按产品退货
 *  null      = 明细为空，两种入口都还可选，首个入口即锁定模式
 */
function getReturnMode(fieldKey: string): 'order' | 'product' | null {
  const type = config.value?.type
  const rows: any[] = dynamicTableData[fieldKey] || []
  if (type === 'salesReturn') {
    // 主单开关优先：编辑态由详情回显，创建后不可变更，即使明细被清空也应保持锁定
    const flag = String((formData as any).has_sales_record ?? '').trim()
    if (flag === '0') return 'product'
    if (flag === '1') return 'order'
    // 新增态开关未定，按已添加明细推断，首条明细即锁定模式
    if (rows.some((r: any) => String(r?.sales_order_item_id || '').trim())) return 'order'
    if (rows.length) return 'product'
    return null
  }
  if (type === 'purchaseReturn') {
    const flag = String((formData as any).has_purchase_record ?? '').trim()
    if (flag === '0') return 'product'
    if (flag === '1') return 'order'
    if (rows.some((r: any) => String(r?.purchase_order_item_id || '').trim())) return 'order'
    if (rows.length) return 'product'
    return null
  }
  return null
}

/** 是否显示「关联来源单据」新增入口：模式已锁定为无来源单据时隐藏 */
function showOrderAddBtn(fieldKey: string): boolean {
  return getReturnMode(fieldKey) !== 'product'
}

/** 是否显示「无来源单据产品」新增入口：模式已锁定为关联单据时隐藏 */
function showNoOrderAddBtn(fieldKey: string): boolean {
  return getReturnMode(fieldKey) !== 'order'
}

/** 明细中已存在的产品ID，供无来源单据产品弹窗去重 */
const noOrderExcludeIds = computed<string[]>(() => {
  const ctx = noOrderCtx.value
  if (!ctx) return []
  const rows: any[] = dynamicTableData[ctx.fieldKey] || []
  return rows.map((r: any) => String(r?.product_id || '')).filter(Boolean)
})

function openNoOrderProductDialog(key: string, field: any) {
  // 模式互斥：已添加过来源单据明细，则不能再走无单据产品入口
  if (getReturnMode(key) === 'order') {
    ElMessage.warning('当前已关联来源单据，如需无单据退货请清空明细后重新添加')
    return
  }
  const supplierFilter = !!field?.extraAdd?.supplierFilter
  if (supplierFilter && !formData.supplier_id) {
    ElMessage.warning('请先选择供应商')
    return
  }
  noOrderCtx.value = {
    fieldKey: key,
    scene: config.value?.type === 'purchaseReturn' ? 'purchase' : 'sales',
    supplierFilter,
  }
  tableDialogVisible.noOrderProduct = true
}

function onNoOrderProductConfirm(rows: NoOrderProductRow[]) {
  const ctx = noOrderCtx.value
  if (!ctx) return
  if (!dynamicTableData[ctx.fieldKey]) dynamicTableData[ctx.fieldKey] = []
  const existing = dynamicTableData[ctx.fieldKey] as any[]
  let skipped = 0
  rows.forEach(item => {
    if (existing.some((r: any) => String(r.product_id) === String(item.product_id))) { skipped++; return }
    const row: any = {
      product_id: item.product_id,
      product_code: item.product_code,
      product_name: item.product_name,
      category_name: item.category_name,
      specification: item.specification,
      color: item.color,
      unit_id: item.unit_id,
      unit_name: item.unit_name,
      return_qty: item.return_qty,
      return_price: item.return_price,
      remark: '',
    }
    if (ctx.scene === 'sales') {
      row.sales_order_item_id = ''
      row.sales_order_id = ''
      row.sales_order_no = ''
      row.product_status = '完好'
      row.actual_in_stock_qty = 0
      row.warehouse_task_status = 0
      // 无销售订单退货没有「可退余量」概念，占位符避免显示空值
      row.remaining = '-'
    } else {
      row.purchase_order_item_id = ''
      row.purchase_order_id = ''
      row.purchase_order_no = ''
      row.purchase_price = ''
      row.receipt_item_deductions = []
      // 无采购订单退货：可退余量即当前可用库存（后端按库存强校验，且禁止入库冲减）
      row.remaining = item.available_stock || ''
    }
    existing.push(row)
  })
  if (skipped > 0) ElMessage.warning(`${skipped} 个产品已在明细中，已跳过`)
  noOrderCtx.value = null
}

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

/** 基础标题（不含批量进度后缀）：保存流程结束时恢复标签页标题用 */
const basePageTitle = computed(() => {
  if (!config.value) return '加载中...'
  if (isReadonly.value && config.value.detailTitle) return config.value.detailTitle
  return isEdit.value ? (config.value.editTitle || config.value.title) : config.value.title
})

const pageTitle = computed(() => {
  // 组合产品按供应商拆分的批量流程：标注当前是第几张，便于区分正在录入的单据
  if (batchMeta.value && config.value?.type === 'purchaseOrder') {
    return `${basePageTitle.value}（组合产品 ${batchMeta.value.index}/${batchMeta.value.total}）`
  }
  return basePageTitle.value
})

const formData = reactive<Record<string, any>>({})

/** 重置创建源单据元数据（列表页「重置创建」跳转带入）：保存成功时随 create 提交 source_*_id */
const recreateSource = ref<{ source_doc_id: string; source_doc_type: string; source_return_no?: string } | null>(null)

/** 批量一键生成进度元数据（预填数据 __batch 字段分离而来）：保存成功后据此推进批量队列 */
const batchMeta = ref<{ token: string; index: number; total: number; sourceOrderNo?: string; sourceDocLabel?: string } | null>(null)

/**
 * 推进批量一键生成队列（如采购订单批量生成入库单）：
 * 队列非空则弹出下一张预填数据（写回 presetData 通道）返回 true，由调用方触发本页按新预填数据重建；
 * 队列耗尽/无批量上下文/令牌不匹配（批量已被中止或被新一批替换）时清理残留队列返回 false。
 */
function advanceBatchQueue(): boolean {
  const type = config.value?.type
  const meta = batchMeta.value
  if (!type || !meta) return false
  const queueKey = `batchQueue:${type}`
  let queue: { token: string; total: number; items: { sourceOrderNo: string; sourceDocLabel?: string; preset: Record<string, any> }[] } | null = null
  try {
    const raw = sessionStorage.getItem(queueKey)
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed && parsed.token === meta.token && Array.isArray(parsed.items)) queue = parsed
  } catch {}
  if (!queue) {
    sessionStorage.removeItem(queueKey)
    return false
  }
  const nextIndex = queue.total - queue.items.length + 1
  const next = queue.items.shift()
  if (!next) {
    sessionStorage.removeItem(queueKey)
    return false
  }
  sessionStorage.setItem(queueKey, JSON.stringify(queue))
  sessionStorage.setItem(
    `presetData:${type}`,
    JSON.stringify({ ...next.preset, __batch: { token: queue.token, index: nextIndex, total: queue.total, sourceOrderNo: next.sourceOrderNo, sourceDocLabel: next.sourceDocLabel } })
  )
  return true
}

/** 读取当前批量批次剩余未进入的张数（令牌不匹配视为无批量） */
function getBatchQueueRemaining(type: string, token: string): number {
  try {
    const raw = sessionStorage.getItem(`batchQueue:${type}`)
    const queue = raw ? JSON.parse(raw) : null
    if (queue?.token === token && Array.isArray(queue.items)) return queue.items.length
  } catch {}
  return 0
}

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
  const maxSizeMb = kind === 'image' ? IMAGE_MAX_SIZE_MB : FILE_MAX_SIZE_MB
  if (typeof field.uploadTip === 'function') return field.uploadTip(maxSizeMb)
  if (field.uploadTip) return field.uploadTip
  if (kind === 'image') {
    return `支持图片文件，单张不超过 ${maxSizeMb}MB，最多上传 ${field.maxImages || 9} 张图片`
  }
  return `单个附件不超过 ${maxSizeMb}MB，最多上传 ${field.maxFiles || 5} 个文件`
}

/** 只读态图片预览用的 URL 列表（el-image 的 preview-src-list 需要纯 URL 数组） */
function readonlyImageUrls(key: string): string[] {
  return (imageFileMap[key] || []).map((f: any) => String(f?.url || '')).filter(Boolean)
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

/** 产品选择弹窗回填明细行的字段构造（单选 / 多选共用） */
function buildProductRow(product: any) {
  return {
    product_id: product.product_id,
    product_code: product.product_code || '',
    product_name: product.product_name || '',
    category_name: product.category_name || '',
    unit_name: product.unit_name || '',
    unit_id: product.unit_id || '',
    // 可用库存：产品查询接口（列表/搜索）已返回 available_stock（已扣采购退货预占），直接带入明细行展示
    available_stock: product.available_stock,
  }
}

/**
 * 采购场景取「当前供应商对该产品的预设采购价」：以产品详情接口
 * （GET /api/v1/tenant-products/detail）返回的 suppliers 数组为准，
 * 按表单已选供应商匹配 preset_purchase_price；接口失败静默回退选品列表自带值。
 * 无供应商上下文（如销售订单选品）返回空，不发起详情请求。
 */
async function resolvePresetPurchasePrice(product: any): Promise<string> {
  const supplierId = String(formData.supplier_id || '').trim()
  const productId = String(product?.product_id || '').trim()
  if (!supplierId || !productId) return ''
  const listPrice = product?.preset_purchase_price
  const listPriceText = listPrice !== undefined && listPrice !== null && String(listPrice).trim() !== '' ? String(listPrice) : ''
  try {
    const res = await getProductDetail(productId, { silent: true })
    const hit = ((res.data as any)?.suppliers || []).find((s: any) => String(s?.supplier_id || '') === supplierId)
    const detailPrice = hit?.preset_purchase_price
    if (detailPrice !== undefined && detailPrice !== null && String(detailPrice).trim() !== '') return String(detailPrice)
  } catch {
    // 详情查询失败不阻断选品流程，走下方列表值回退
  }
  return listPriceText
}

/** 预设采购价预填到行「采购单价」：记录 _preset_price 供灰色弱化判定，用户改动后自动恢复常规颜色 */
async function applyPresetPurchasePrice(row: Record<string, any>, product: any) {
  const presetPrice = await resolvePresetPurchasePrice(product)
  delete row._preset_price
  if (presetPrice) {
    row.purchase_price = presetPrice
    row._preset_price = presetPrice
  }
}

/** 预设采购价单元格判定：行携带预设值且当前单价未被用户改动过 → 灰色弱化提示 */
function isPresetPriceCell(row: any, col: any) {
  if (col.key !== 'purchase_price') return false
  const preset = row?._preset_price
  if (preset === undefined || preset === null || preset === '') return false
  const current = row.purchase_price
  if (current === undefined || current === null || String(current).trim() === '') return false
  return Number(current) === Number(preset)
}

/** 明细表内同 product_id 去重：返回 true 表示该产品已存在 */
function productRowExists(fieldKey: string, productId: string) {
  return (dynamicTableData[fieldKey] || []).some((r: any) => r.product_id && r.product_id === productId)
}

/** 组合产品展开适用的场景：采购（后续可按供应商拆单）与销售（仅添加产品明细） */
const isCombinedExpandScene = computed(() => ['purchaseOrder', 'salesOrder'].includes(config.value?.type || ''))

async function onProductConfirm(product: any) {
  const ctx = tableDialogCtx.value
  if (!ctx) return
  tableDialogCtx.value = null
  // 组合产品不直接落行：其自身不是采购对象，改由「组合产品展开」弹窗勾选子产品后再入表
  if (isCombinedExpandScene.value && Number(product?.is_combined) === 1) {
    openCombinedExpand(ctx, [product])
    return
  }
  // 如果是通过 addViaDialog 新增的（row 为 null），先推入表格
  if (ctx.row === null) {
    if (!dynamicTableData[ctx.fieldKey]) dynamicTableData[ctx.fieldKey] = []
    if (productRowExists(ctx.fieldKey, product.product_id)) {
      ElMessage.warning(`产品「${product.product_name || product.product_code}」已添加，请勿重复添加`)
      return
    }
    const row = buildProductRow(product)
    // 采购场景：产品详情接口（detail）取该供应商预设采购价，预填「采购单价」
    await applyPresetPurchasePrice(row, product)
    dynamicTableData[ctx.fieldKey].push(row)
    return
  }
  Object.assign(ctx.row, buildProductRow(product))
  await applyPresetPurchasePrice(ctx.row, product)
}

/** 「组合产品展开」弹窗上下文：记录目标明细字段与本次涉及的产品 */
const combinedExpandVisible = ref(false)
const combinedExpandCtx = ref<{ fieldKey: string; productIds: string[]; plainProducts: any[] } | null>(null)

/** 明细表中已有产品 ID：传给展开弹窗置灰不可重复勾选 */
function currentItemProductIds(fieldKey: string): string[] {
  return (dynamicTableData[fieldKey] || []).map((r: any) => String(r.product_id || '')).filter(Boolean)
}

/**
 * 打开组合产品展开弹窗：组合产品展开为子产品树供勾选，普通产品作为顶级行一并展示，
 * 确认后统一落成当前单据的明细行（不跳转、不拆单）。
 */
function openCombinedExpand(
  ctx: { fieldKey: string; col: any; row: any },
  combinedProducts: any[],
  plainProducts: any[] = [],
) {
  // 编辑已有明细行（ctx.row 非 null）时不允许展开替换，避免把一行换成多行造成语义混乱
  if (ctx.row !== null) {
    ElMessage.warning('编辑已有明细行时不支持组合产品展开，请先删除该行后重新添加')
    return
  }
  const productIds = combinedProducts.map(p => String(p.product_id || '')).filter(Boolean)
  const plain = plainProducts.filter(p => String(p.product_id || ''))
  if (!productIds.length && !plain.length) return
  combinedExpandCtx.value = { fieldKey: ctx.fieldKey, productIds, plainProducts: plain }
  combinedExpandVisible.value = true
}

/** 组合产品展开确认：按明细行字段直接落表。采购场景价格已由弹窗按供应商预填；
 *  销售场景无采购价/供应商概念，弹窗带出的采购价不得写入折后单价，留空由用户填写 */
async function onCombinedExpandConfirm(rows: PurchaseItemRow[]) {
  const ctx = combinedExpandCtx.value
  combinedExpandCtx.value = null
  if (!ctx || !rows?.length) return
  const isPurchase = config.value?.type === 'purchaseOrder'
  if (!dynamicTableData[ctx.fieldKey]) dynamicTableData[ctx.fieldKey] = []
  const target = dynamicTableData[ctx.fieldKey]
  const added: string[] = []
  const skipped: string[] = []
  const pushed: Record<string, any>[] = []
  rows.forEach((row) => {
    if (productRowExists(ctx.fieldKey, row.product_id)) {
      skipped.push(row.product_name || row.product_code || '')
      return
    }
    let pushedRow: Record<string, any>
    if (isPurchase) {
      // 弹窗已给出采购数量与预设采购价；_preset_price 供单价单元格灰色弱化展示
      pushedRow = { ...row }
    } else {
      // 销售：只取产品标识/单位/库存与数量，价格与税率留空（与选品弹窗落行行为一致）
      pushedRow = {
        product_id: row.product_id,
        product_code: row.product_code,
        product_name: row.product_name,
        category_name: row.category_name,
        unit_name: row.unit_name,
        unit_id: row.unit_id,
        available_stock: row.available_stock,
        qty: row.qty,
      }
    }
    target.push(pushedRow)
    pushed.push(pushedRow)
    added.push(row.product_name || row.product_code || '')
  })
  // 销售场景：落表数量是程序写入，不会触发「数量」列的 onInput → 手动跑一次缺货检测，
  // 否则组合产品展开带入的行不会进入缺货气泡，也就无法一键生成客户订货单
  if (!isPurchase && pushed.length) {
    const qtyCol = config.value?.tabs.flatMap(t => t.fields)
      .find(f => f.type === 'dynamic-table' && f.key === ctx.fieldKey)
      ?.columns?.find(c => c.key === 'qty')
    if (typeof qtyCol?.onInput === 'function') {
      for (const pushedRow of pushed) {
        await qtyCol.onInput(pushedRow, {
          fieldKey: ctx.fieldKey,
          formData,
          dynamicTableData,
          activeTab: activeTab.value,
          editId: editId.value,
          isEdit: isEdit.value,
          router,
        })
      }
    }
  }
  if (added.length) {
    ElMessage.success(isPurchase ? `已加入 ${added.length} 项采购明细` : `已加入 ${added.length} 项订单明细`)
  }
  if (skipped.length) {
    ElMessage.warning(`产品「${skipped.join('、')}」已在明细中，已跳过 ${skipped.length} 项`)
  }
}

// ────────────── 采购订单：按供应商拆分生成多张采购订单 ──────────────

/** 采购订单明细字段 key（formConfigs 中 items 是配置了 addViaDialog 的 dynamic-table） */
const purchaseItemsFieldKey = computed(() => {
  if (config.value?.type !== 'purchaseOrder') return ''
  const field = config.value.tabs.flatMap(t => t.fields)
    .find(f => f.type === 'dynamic-table' && f.addViaDialog)
  return field?.key || 'items'
})

interface SupplierGroup { supplier_id: string; supplier_name: string; rows: Record<string, any>[] }

/**
 * 明细按供应商分组：分组键取行上的 _supplier_id（组合产品展开弹窗写入），
 * 手工新增的行没有该字段，归入本单已选供应商。
 * 仅用于「涉及多供应商时提示并支持拆分」，不改动明细本身。
 */
const purchaseSupplierGroups = computed<SupplierGroup[]>(() => {
  const key = purchaseItemsFieldKey.value
  if (!key) return []
  const currentSupplierId = String(formData.supplier_id || '').trim()
  const map = new Map<string, SupplierGroup>()
  ;(dynamicTableData[key] || []).forEach((row: any) => {
    const sid = String(row._supplier_id || currentSupplierId).trim()
    if (!sid) return
    if (!map.has(sid)) {
      const rowName = String(row._supplier_name || '').trim()
      const fallback = sid === currentSupplierId ? String(formData.supplier_id_label || '').trim() : ''
      map.set(sid, { supplier_id: sid, supplier_name: rowName || fallback || sid, rows: [] })
    }
    map.get(sid)!.rows.push(row)
  })
  return Array.from(map.values())
})

/**
 * 按供应商拆分：本页内容变成第 1 张单，其余写入批量队列，保存每张后自动进入下一张。
 * 同路由原地重建（invalidateTab 改 remount tick → MainLayout 的 key 变化），无需导航。
 */
async function handleSplitPurchaseBySupplier() {
  const groups = purchaseSupplierGroups.value
  const type = config.value?.type
  if (!type || groups.length < 2) return
  // 明细字段白名单与 formConfigs.purchaseOrder.submitCreate 的 items 映射保持一致
  const mapItem = (r: Record<string, any>) => ({
    product_id: r.product_id || '',
    product_code: r.product_code || '',
    product_name: r.product_name || '',
    category_name: r.category_name || '',
    unit_name: r.unit_name || '',
    unit_id: r.unit_id || '',
    qty: r.qty ?? '',
    purchase_price: r.purchase_price ?? '',
    delivery_status: r.delivery_status ?? 0,
    delivery_date: r.delivery_date || '',
    last_purchase_price: r.last_purchase_price || '',
    logistics_no: r.logistics_no || '',
    line_use_gift_amount: r.line_use_gift_amount ?? '0',
    remark: r.remark || '',
  })
  // 主单字段沿用本页已填内容；供应商、预付款/赠送余额随分组变化，不继承
  const header = {
    order_date: formData.order_date || '',
    delivery_days: formData.delivery_days ?? '',
    freight_bear_type: formData.freight_bear_type || '',
    payment_method: formData.payment_method || '',
    remark: formData.remark || '',
  }
  const items = groups.map(g => ({
    sourceOrderNo: g.supplier_name || g.supplier_id,
    sourceDocLabel: '供应商',
    preset: {
      ...header,
      supplier_id: g.supplier_id,
      supplier_id_label: g.supplier_name || g.supplier_id,
      items: g.rows.map(mapItem),
    },
  }))
  // ElMessageBox 的字符串消息不渲染 \n，供应商列表会挤成一行；改用 VNode 结构化排版，
  // 也避开 dangerouslyUseHTMLString 的注入风险（供应商名是用户录入数据）
  const message = h('div', { style: 'min-width:0;' }, [
    h('p', { style: 'margin:0 0 10px;line-height:1.7;' },
      `当前明细涉及 ${groups.length} 个供应商，将按供应商拆分为 ${groups.length} 张采购订单：`),
    h('ol', {
      style: 'margin:0 0 12px;padding-left:22px;',
    }, groups.map(g => h('li', { style: 'line-height:2;' }, [
      h('span', { style: 'font-weight:600;' }, g.supplier_name || g.supplier_id),
      h('span', { style: 'color:var(--el-text-color-secondary);' }, `（${g.rows.length} 项）`),
    ]))),
    h('p', { style: 'margin:0;font-size:13px;line-height:1.7;color:var(--el-text-color-secondary);' },
      '本页内容将成为第 1 张单，其余依次自动带出；每张保存后自动进入下一张，全部完成后回到采购订单列表。'),
  ])
  try {
    await ElMessageBox.confirm(
      message,
      '按供应商拆分为多张采购订单',
      {
        type: 'warning',
        confirmButtonText: '开始拆分',
        cancelButtonText: '取消',
        customStyle: { width: '460px', maxWidth: '92vw' },
      },
    )
  } catch {
    return
  }
  const token = Date.now().toString(36)
  // 队列排除首张：advanceBatchQueue 用 shift 取「下一张」，首张已由 presetData 预填
  const [first, ...rest] = items
  sessionStorage.setItem(`batchQueue:${type}`, JSON.stringify({ token, total: items.length, items: rest }))
  sessionStorage.setItem(
    `presetData:${type}`,
    JSON.stringify({
      ...first.preset,
      __batch: { token, index: 1, total: items.length, sourceOrderNo: first.sourceOrderNo, sourceDocLabel: first.sourceDocLabel },
    }),
  )
  tabStore.invalidateTab(route.fullPath)
}

/**
 * 产品选择弹窗多选确认（字段配置 addDialogMultiple）：按勾选顺序逐行追加到明细表。
 * 已存在的产品跳过并汇总提示，避免一条警告弹窗刷屏。
 */
async function onProductMultipleConfirm(products: any[]) {
  const ctx = tableDialogCtx.value
  if (!ctx) return
  tableDialogCtx.value = null
  // 混选时统一交给展开弹窗处理：组合产品展开为树 + 普通产品作为顶级行，用户在弹窗内一次确认
  // 仅采购订单场景生效——销售订单的组合产品是销售单元本身，不展开
  const combinedProducts = isCombinedExpandScene.value
    ? products.filter(p => Number(p?.is_combined) === 1)
    : []
  if (combinedProducts.length) {
    openCombinedExpand(ctx, combinedProducts, products.filter(p => Number(p?.is_combined) !== 1))
    return
  }
  if (!dynamicTableData[ctx.fieldKey]) dynamicTableData[ctx.fieldKey] = []
  const rows = dynamicTableData[ctx.fieldKey]
  const skipped: string[] = []
  const pendingRows: Array<{ row: Record<string, any>; product: any }> = []
  products.forEach((product: any) => {
    if (productRowExists(ctx.fieldKey, product.product_id)) {
      skipped.push(product.product_name || product.product_code || '')
      return
    }
    const row: Record<string, any> = buildProductRow(product)
    // 批量加行不会像单行那样立即被用户逐个填写，这里给数量一个合法默认值
    // （后端 _enrich_item_row 对 qty<=0 / 空值直接 400），后续仍可逐行改
    if (row.qty === undefined) row.qty = 1
    pendingRows.push({ row, product })
  })
  // 采购场景：并行按供应商取各产品预设采购价（产品详情接口），预填「采购单价」后再入表
  await Promise.all(pendingRows.map(({ row, product }) => applyPresetPurchasePrice(row, product)))
  pendingRows.forEach(({ row }) => rows.push(row))
  if (skipped.length) {
    ElMessage.warning(`产品「${skipped.join('、')}」已在明细中，已跳过 ${skipped.length} 项`)
  }
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

/** 缺货气泡「生成订货单」：把全部缺货行一次性继承到客户订货单预填页（确认弹窗 → 快照 → 跳转） */
function onSalesOrderShortageBulkClick() {
  const handler = (getSceneConfig('salesOrder') as any)?.__tableActionHandlers?.shortageBulk
  if (typeof handler !== 'function') return
  handler(shortageRows.value.map(item => item.row), {
    fieldKey: 'items',
    formData,
    dynamicTableData,
    activeTab: activeTab.value,
    editId: editId.value,
    isEdit: isEdit.value,
    router,
  })
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

/** 刷新派生的只读展示字段（场景配置可选实现，如按供应商/客户回填预存款与赠送余额） */
async function refreshDerivedFields() {
  const fn = config.value?.refreshDerivedFields
  if (typeof fn !== 'function') return
  try {
    await fn(formData)
  } catch {
    // 派生字段仅用于展示，异常不阻塞表单
  }
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
  // 按供应商刷新派生的只读展示字段（如预存款余额 / 赠送余额）
  void refreshDerivedFields()
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

function onSupplierMultipleConfirm(suppliers: Array<{ supplier_id: string; supplier_name: string }>) {
  const key = dialogFieldKey.value
  if (!key) return
  // 存储选中的供应商数组，供 submitCreate/submitUpdate 后调用 addProductSupplier
  formData[key] = suppliers
  formData[key + '_label'] = suppliers.map(s => s.supplier_name).join('、')
}

// 动态表格内"供应商"列是否多选（由列配置 dialogMultiple 标记，如产品资料"关联供应商"）
const tableDialogMultiple = computed(() => !!tableDialogCtx.value?.col?.dialogMultiple)

// 产品选择弹窗是否多选：新增明细按钮走字段 addDialogMultiple（如销售订单明细），行内"产品"列走列 dialogMultiple
const productDialogMultiple = computed(() => {
  const col = tableDialogCtx.value?.col
  return !!(col?.multiple ?? col?.dialogMultiple)
})

// 动态表格内"供应商"列已选 ID（用于 SupplierSelectDialog 去重，排除当前正在编辑行的自身 ID）
const tableSupplierExcludeIds = computed(() => {
  const ctx = tableDialogCtx.value
  if (!ctx) return []
  const editingId = ctx.row?.supplier_id
  return (dynamicTableData[ctx.fieldKey] || [])
    .map((r: any) => r.supplier_id)
    .filter((id: string) => id && id !== editingId)
})

// 把选中的供应商写入表格行，并带出编码/地址/电话/状态等展示字段
function fillSupplierRow(row: any, supplier: any) {
  row.supplier_id = supplier.supplier_id
  row.supplier_code = supplier.supplier_code || ''
  row.supplier_name = supplier.supplier_name || ''
  row.detail_address = supplier.detail_address || ''
  row.phone1 = supplier.phone1 || ''
  row.status = supplier.status
  row.status_name = supplier.status === 1 ? '启用' : (supplier.status === 0 ? '禁用' : '')
  if (!row.supplier_model) row.supplier_model = ''
}

// 动态表格内选择供应商后写入对应行（单选，按 supplier_id 去重）
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
  if (ctx.row === null) {
    const newRow: any = {}
    fillSupplierRow(newRow, supplier)
    dynamicTableData[key].push(newRow)
  } else {
    fillSupplierRow(ctx.row, supplier)
  }
  tableDialogCtx.value = null
  tableDialogVisible.supplier = false
}

// 动态表格内多选供应商：首个写入当前编辑行，其余逐行追加新行；已关联的自动跳过
function onTableSupplierMultipleConfirm(suppliers: any[]) {
  const ctx = tableDialogCtx.value
  if (!ctx) return
  const key = ctx.fieldKey
  if (!dynamicTableData[key]) dynamicTableData[key] = []
  const rows: any[] = dynamicTableData[key]
  // 当前编辑行自身允许被重新选中（仅更新展示字段），其余已关联行参与去重
  const occupied = new Set(rows.filter((r: any) => r !== ctx.row).map((r: any) => r.supplier_id).filter(Boolean))
  let skipped = 0
  let target: any = ctx.row
  for (const supplier of suppliers) {
    if (!supplier.supplier_id || occupied.has(supplier.supplier_id)) {
      skipped++
      continue
    }
    occupied.add(supplier.supplier_id)
    if (target) {
      fillSupplierRow(target, supplier)
      target = null
    } else {
      const newRow: any = {}
      fillSupplierRow(newRow, supplier)
      rows.push(newRow)
    }
  }
  if (skipped > 0) ElMessage.warning(`已过滤 ${skipped} 个已关联的供应商`)
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
  // 按客户刷新派生的只读展示字段（如预存款余额 / 赠送余额）
  void refreshDerivedFields()
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
      /* 必填红字只在提交（handleSubmit → validate()）时首次出现：
         不用 blur/change 触发，避免「点开下拉又关掉 / 点进输入框又离开」马上报红，
         也避免挂载后的默认值写入（el-select 会 watch modelValue）误触发校验。
         提交后出现的提示，用户改对时由下方 formData watcher 重校验即时消除。
         注意：EP 中「省略 trigger」等价于所有事件都触发，故这里显式用空数组关闭事件触发；
         提交走 validate('')，空 trigger 会命中全部规则，校验不受影响。 */
      trigger: []
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
  // 模式互斥：已按「无来源单据产品」添加过明细，则不能再走来源单据入口
  if (field?.addViaDialog && getReturnMode(key) === 'product') {
    ElMessage.warning('当前为无来源单据退货，如需改为关联单据请清空明细后重新添加')
    return
  }
  if (field?.addViaDialog) {
    tableDialogCtx.value = {
      fieldKey: key,
      col: { dialogType: field.addDialogType || 'product', labelKey: 'product_name', multiple: !!field.addDialogMultiple },
      row: null,
    }
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
  // 无采购订单明细：后端禁止入库冲减，恒为无需冲减（超量由后端库存校验拦截）
  if (!String(row?.purchase_order_item_id || '').trim()) return '无需冲减'
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
    if (!row) return
    const type = config.value?.type
    const salesOrderItemId = String(row?.sales_order_item_id || '').trim()
    const salesReturnItemId = String(row?.sales_return_item_id || '').trim()
    if (type === 'salesReturn' && key === 'items' && isEdit.value && salesReturnItemId) {
      // 后端分级控制：已确认完成 / 已入库的明细禁止删除，前端提前拦截避免无效请求
      if (Number(row?.warehouse_task_status || 0) === 1) {
        ElMessage.warning('该明细仓库已确认完成，不可删除，请联系仓库处理')
        return
      }
      if (Number(row?.actual_in_stock_qty || 0) > 0) {
        ElMessage.warning('该明细已有仓库入库操作记录，无法删除')
        return
      }
      // 先删后端再删前端行：接口失败时保留该行，避免「重进编辑页后明细复活」
      await deleteSalesReturnItem(salesReturnItemId)
      dynamicTableData[key]?.splice(index, 1)
      ElMessage.success('删除成功')
      return
    }
    if (type === 'salesOrder' && key === 'items' && isEdit.value && salesOrderItemId) {
      await deleteSalesOrderItem(salesOrderItemId)
      dynamicTableData[key]?.splice(index, 1)
      ElMessage.success('删除成功')
      return
    }
    // ===== 采购订单明细删除 =====
    const purchaseOrderItemId = String(row?.purchase_order_item_id || '').trim()
    if (type === 'purchaseOrder' && key === 'items' && isEdit.value && purchaseOrderItemId) {
      await deletePurchaseOrderItem(purchaseOrderItemId)
      dynamicTableData[key]?.splice(index, 1)
      ElMessage.success('删除成功')
      return
    }
    // ===== 采购入库单明细删除（后端有分级控制，前端预检避免无效请求）=====
    const purchaseReceiptItemId = String(row?.purchase_receipt_item_id || '').trim()
    if (type === 'purchaseInbound' && key === 'items' && isEdit.value && purchaseReceiptItemId) {
      if (Number(row?.warehouse_task_status || 0) === 1) {
        ElMessage.warning('该明细仓库已确认完成，不可删除，请联系仓库处理')
        return
      }
      if (Number(row?.actual_in_stock_qty || 0) > 0) {
        ElMessage.warning('该明细已有仓库入库操作记录，无法删除')
        return
      }
      // 后端为批量接口（item_ids 数组），单条删除传单元素数组
      await deletePurchaseInboundItems(String(editId.value || ''), [purchaseReceiptItemId])
      dynamicTableData[key]?.splice(index, 1)
      ElMessage.success('删除成功')
      return
    }
    // ===== 采购退货单明细删除（后端有分级控制，前端预检避免无效请求）=====
    const purchaseReturnItemId = String(row?.purchase_return_item_id || '').trim()
    if (type === 'purchaseReturn' && key === 'items' && isEdit.value && purchaseReturnItemId) {
      if (Number(row?.warehouse_task_status || 0) === 1) {
        ElMessage.warning('该明细仓库已确认完成，不可删除，请联系仓库处理')
        return
      }
      if (Number(row?.actual_return_qty || 0) > 0) {
        ElMessage.warning('该明细已有仓库出库操作记录，无法删除')
        return
      }
      await deletePurchaseReturnItem(purchaseReturnItemId)
      dynamicTableData[key]?.splice(index, 1)
      ElMessage.success('删除成功')
      return
    }
    // ===== 付款单明细删除 =====
    const paymentItemId = String(row?.payment_item_id || '').trim()
    if (type === 'paymentOrder' && key === 'items' && isEdit.value && paymentItemId) {
      await deletePaymentOrderItem(paymentItemId)
      dynamicTableData[key]?.splice(index, 1)
      ElMessage.success('删除成功')
      return
    }
    // ===== 收款单明细删除 =====
    const receiptItemId = String(row?.receipt_item_id || '').trim()
    if (type === 'collectionReceipt' && key === 'items' && isEdit.value && receiptItemId) {
      await deleteCollectionReceiptItem(receiptItemId)
      dynamicTableData[key]?.splice(index, 1)
      ElMessage.success('删除成功')
      return
    }
    // 无编辑态删除接口的场景：仅删除前端行（新增态行没有后端记录，走这里）
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

async function handleCancel() {
  // 批量一键生成中返回：明确提示中止后果并清理残留队列，避免影响后续普通新增
  const type = config.value?.type
  const meta = batchMeta.value
  if (type && meta) {
    const remaining = getBatchQueueRemaining(type, meta.token)
    if (remaining > 0) {
      try {
        await ElMessageBox.confirm(
          `当前为批量生成的第 ${meta.index}/${meta.total} 张，返回将中止剩余 ${remaining} 张的生成，是否继续？`,
          '中止批量生成',
          { confirmButtonText: '中止并返回', cancelButtonText: '继续编辑', type: 'warning' }
        )
      } catch {
        return
      }
    }
    sessionStorage.removeItem(`batchQueue:${type}`)
    batchMeta.value = null
  }
  router.back()
}

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
        await config.value.submitCreate(submitData, files, { recreateSource: recreateSource.value })
      }
    }
    ElMessage.success('保存成功')
    // 批量一键生成：队列非空则先写出下一张预填数据，再靠下方 invalidateTab 触发的
    // keep-alive key 变化让当前路由下的实例按新预填数据重建，实现"保存后自动进入下一张"
    const advancedBatch = advanceBatchQueue()
    // 批量流程已耗尽：清掉进度元数据并恢复基础标题，避免标签页残留「（组合产品 N/M）」后缀。
    // 仍有后续张时不动——实例会重建并由 onMounted 写入下一张的后缀
    if (!advancedBatch && batchMeta.value) {
      batchMeta.value = null
      tabStore.addTab(route.fullPath, basePageTitle.value)
    }
    // 本页在 keep-alive 缓存中（切换标签保留草稿）；保存成功后作废缓存，
    // 重开该标签时按模式重新初始化：新增=空表单，编辑=重载保存后的最新详情
    tabStore.invalidateTab(route.fullPath)
    if (advancedBatch) {
      // 已推进批量队列：不跳列表页，停留当前路由等待实例重建进入下一张
    } else {
      // 落点优先级：?returnTo=<站内绝对路径> > 场景 successRouteByData(submitData) > 场景 successRoute。
      // returnTo 用于「从某个派生列表页发起新增、保存后回跳该页」，显式传入即生效（新增/编辑均适用）；
      // successRouteByData 用于「按本次提交内容决定落点」（如产品新增勾选组合产品 → 跳组合产品资料），
      //   仅在**新增**态参与判定：编辑态的落点沿用 successRoute，避免改变「编辑产品资料」既有的返回行为。
      // returnTo 仅接受站内绝对路径（以 / 开头且非 //，避免被用作外部跳转）。
      const rawReturnTo = route.query.returnTo
      const returnTo = typeof rawReturnTo === 'string' ? rawReturnTo.trim() : ''
      const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : ''
      let byData: string | undefined
      if (!isEdit.value && !safeReturnTo && typeof config.value?.successRouteByData === 'function') {
        try {
          byData = config.value.successRouteByData(submitData) || undefined
        } catch {
          byData = undefined
        }
      }
      const target = safeReturnTo || byData || config.value?.successRoute
      if (target) router.push(target)
    }
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
            formData[field.key] = dynamicTableData[field.key]
            if (config.value?.type === 'salesReturn' && field.key === 'items') {
              salesReturnHadLoadedItems.value = (dynamicTableData.items?.length || 0) > 0
          }
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
      // 编辑态加载完成后刷新派生只读字段（如按供应商/客户回填预存款与赠送余额）
      await refreshDerivedFields()
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

// keep-alive 兜底：编辑态缓存激活后动态明细表为空但主单字段存在时，重新拉取详情。
// 覆盖两类空明细场景：a) 详情曾返回明细但缓存激活后表格数据丢失；
// b) 首次 loadEditData 时详情接口失败、仅靠缓存行数据回显（salesReturn 场景）而明细缺失。
onActivated(() => {
  if (!isEdit.value || !editId.value || loading.value) return
  const itemKeys = (config.value?.tabs || [])
    .flatMap(tab => tab.fields)
    .filter(f => f.type === 'dynamic-table')
    .map(f => f.key)
  if (itemKeys.length === 0) return
  // 主单有数据（任一非明细字段已回填）但明细表全空 → 视为明细加载缺失，重拉详情
  const hasMainData = itemKeys.some(k => Object.keys(formData).some(fk => fk !== k && formData[fk] !== undefined && formData[fk] !== null && formData[fk] !== ''))
  const allItemsEmpty = itemKeys.every(k => (dynamicTableData[k]?.length || 0) === 0)
  if (hasMainData && allItemsEmpty) {
    void loadEditData()
  }
})

/* 默认值初始化必须在 el-form / el-select 等子组件挂载前完成：
   Element Plus 的 el-select 会 watch modelValue，若挂载后再把 undefined 写成 ''，
   会触发一次 validate('change')，使必填下拉框「一进新增页就弹红字」。
   改在 onBeforeMount 执行后，子组件首次渲染拿到的就是 ""，不会再产生这次校验；
   点保存时 handleSubmit 里的 validate() 仍会正常报出必填红字。 */
onBeforeMount(initFormDefaults)

onMounted(async () => {
  document.addEventListener('click', closeSuffixDropdowns)
  if (!config.value) {
    ElMessage.warning('未找到对应的表单配置')
    router.back()
    return
  }
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
      // 重置创建：分离 __recreateSource 元数据（仅供提交时携带 source_*_id，不进表单字段）
      if (presetData.__recreateSource) {
        recreateSource.value = presetData.__recreateSource
        delete presetData.__recreateSource
        ElMessage.info(`已继承源退货单「${recreateSource.value?.source_return_no || ''}」数据，保存成功后源单将标记为已重置`)
      }
      // 批量一键生成：分离 __batch 进度元数据（保存成功后推进批量队列），不进表单字段
      if (presetData.__batch) {
        const batch = presetData.__batch as { token: string; index: number; total: number; sourceOrderNo?: string; sourceDocLabel?: string }
        batchMeta.value = batch
        delete presetData.__batch
        const isLast = Number(batch.index) >= Number(batch.total)
        ElMessage.info(
          `批量生成（第 ${batch.index}/${batch.total} 张）：已继承${batch.sourceDocLabel || '源单据'}「${batch.sourceOrderNo || ''}」，` +
          (isLast ? '本张保存后完成本次批量生成' : '保存后自动进入下一张')
        )
      }
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
      // 预填也要刷新派生只读字段：批量生成/按供应商拆分时每张单的供应商不同，
      // 不刷新则预存款/赠送余额会停留在上一张单的供应商数据
      await refreshDerivedFields()
      // 组合产品拆分批量流程：同步标签页标题（MainLayout 的 route 守卫只写基础标题，不感知批量进度）
      if (batchMeta.value && config.value.type === 'purchaseOrder') {
        tabStore.addTab(route.fullPath, pageTitle.value)
      }
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
/* 采购订单明细：供应商预设采购价预填的单价单元格灰色弱化，用户改动后恢复常规颜色 */
.table-cell-input--preset :deep(.el-input__inner) {
  color: var(--el-text-color-placeholder, #a8abb2);
}
/* 只读文本单元格：display:inline-block 自成一个盒子，会使 .cell 的
   text-overflow:ellipsis 失效 —— 长文本按 max-content 撑宽后溢出列边界，
   压到右侧列上（同 index.scss 里 .cell-link 的成因）。故自带裁剪 + 省略。
   box-sizing 让 max-width:100% 把左右 padding 计入，避免仍超出列宽 8px。
   这里不写 white-space:nowrap：非 show-overflow-tooltip 的列原本允许换行，
   保留 .cell 的继承值可避免把多行文本压成单行省略（tooltip 列本身会被
   .cell.el-tooltip 置为 nowrap，届时自然呈现省略号）。 */
.table-cell-display {
  display: inline-block;
  box-sizing: border-box;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 1px 4px;
  color: var(--text-secondary, #606266);
  font-size: 12px;
}
/* ── 销售订单缺货气泡（表格下方，表格外提示区） ──
   宽度随内容收缩（fit-content）：单条缺货时不至于整行拉满、中间大片留白 */
.shortage-bubble {
  position: relative;
  width: fit-content;
  max-width: 100%;
  margin-top: 10px;
  padding: 8px 12px;
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
.shortage-bubble__header { display: flex; align-items: center; gap: 6px; font-weight: 600; color: var(--el-color-warning, #e6a23c); margin-bottom: 4px; }
.shortage-bubble__icon { font-size: 14px; }
/* 一键生成按钮：推到气泡右侧，与最宽的缺货行对齐 */
.shortage-bubble__action { margin-left: auto; }
.shortage-bubble__item { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
.shortage-bubble__name { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary, #303133); font-weight: 600; }
/* 统计段不再 flex:1 拉满 —— 那会把按钮推到最右、中间大片留白（空旷感的主因） */
.shortage-bubble__detail { color: var(--el-color-warning, #e6a23c); font-weight: 600; white-space: nowrap; }
/* 缺量数字：红色加粗，视觉焦点 */
.shortage-bubble__num { color: var(--el-color-danger, #f56c6c); font-weight: 700; font-size: 14px; }
.dynamic-table-empty { border: 1px dashed var(--border-color); border-radius: 6px; padding: 16px 0; }

/* 采购订单·按供应商拆分汇总条：仅在明细涉及多供应商时出现 */
.supplier-split-bar {
  width: 100%;
  margin-bottom: 10px;
  padding: 10px 14px;
  border: 1px solid var(--border-light);
  border-left: 3px solid var(--color-warning, #e6a23c);
  border-radius: 6px;
  background: var(--bg-page);
}
/* 提示文字需要醒目：14px + 加粗 + 主文本色 */
.supplier-split-text { font-size: 14px; font-weight: 500; color: var(--text-primary); line-height: 1.7; }
.supplier-split-text b { color: var(--color-warning, #e6a23c); font-size: 15px; }
.supplier-split-chip { color: var(--text-primary); font-weight: 500; }

/* 动态表格：small 档默认 12px 偏小，统一放大到 13px（含单元格内的输入控件） */
.dynamic-table-wrapper :deep(.el-table) { font-size: 13px; }
.dynamic-table-wrapper :deep(.el-table .el-input__inner),
.dynamic-table-wrapper :deep(.el-table .el-select__wrapper),
.dynamic-table-wrapper :deep(.el-table .el-select__selected-item),
.dynamic-table-wrapper :deep(.el-table .el-date-editor) { font-size: 13px; }
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

/* ── 只读态：图片缩略图（可点击放大）/ 附件链接列表 ── */
.readonly-upload-wrapper { width: 100%; }
.readonly-image-list { display: flex; flex-wrap: wrap; gap: 8px; }
.readonly-image-item {
  width: 100px;
  height: 100px;
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
  cursor: zoom-in;
  overflow: hidden;
}
.readonly-image-error {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-light);
}
.readonly-file-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.readonly-file-item { display: flex; align-items: center; gap: 6px; line-height: 1.6; }
.readonly-file-icon { color: var(--el-text-color-secondary); flex-shrink: 0; }
.readonly-file-link {
  color: var(--el-color-primary);
  text-decoration: none;
  word-break: break-all;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.readonly-file-link:hover { text-decoration: underline; }
.readonly-upload-empty { color: var(--el-text-color-placeholder); }

/* ── 响应式：小屏表单收紧 ── */
@media (max-width: 1024px) {
  .add-template-page :deep(.el-form-item) { margin-bottom: 18px !important; }
  .form-section-title { margin: 20px 0 12px; }
}

@media (max-width: 768px) {
  .add-template-page :deep(.el-form-item) { margin-bottom: 16px !important; }
}
</style>
