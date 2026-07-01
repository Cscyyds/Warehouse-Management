<template>
  <el-dialog
    title="审核预览"
    :model-value="modelValue"
    width="680px"
    :close-on-click-modal="false"
    class="audit-preview-dialog"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <!-- 顶部概况 -->
    <div class="preview-summary">
      <el-icon class="summary-icon" :class="hasAnyOverflow ? 'is-warn' : 'is-ok'">
        <Warning v-if="hasAnyOverflow" />
        <CircleCheck v-else />
      </el-icon>
      <span class="summary-text">
        已选 <b>{{ orderCount }}</b> 条订单 ·
        <template v-if="hasAnyOverflow">部分金额不足，溢出将转入应付金额</template>
        <template v-else>赠送金额与预付款均充足</template>
      </span>
    </div>

    <div v-loading="loading" class="preview-body">
      <!-- 赠送金额区 -->
      <section class="amount-card" :class="{ 'is-overflow': data?.has_gift_overflow }">
        <header class="card-header">
          <span class="card-title">赠送金额</span>
          <el-tag v-if="data?.has_gift_overflow" type="danger" size="small" effect="light">不足</el-tag>
          <el-tag v-else type="success" size="small" effect="light">充足</el-tag>
        </header>
        <div class="card-fields">
          <div class="field">
            <label>期望使用</label>
            <span class="value">{{ data?.requested_gift_amount ?? '-' }}</span>
          </div>
          <div class="field">
            <label>实际可用</label>
            <span class="value">{{ data?.actual_gift_amount ?? '-' }}</span>
          </div>
          <div class="field field-overflow">
            <label>溢出金额</label>
            <span class="value value-emphasis">{{ data?.gift_overflow_amount ?? '-' }}</span>
            <small v-if="data?.has_gift_overflow" class="field-hint">转入应付</small>
          </div>
        </div>
      </section>

      <!-- 预付款区 -->
      <section class="amount-card" :class="{ 'is-overflow': data?.has_prepayment_overflow }">
        <header class="card-header">
          <span class="card-title">预付款</span>
          <el-tag v-if="data?.has_prepayment_overflow" type="danger" size="small" effect="light">不足</el-tag>
          <el-tag v-else type="success" size="small" effect="light">充足</el-tag>
        </header>
        <div class="card-fields">
          <div class="field">
            <label>期望使用</label>
            <span class="value">{{ data?.requested_prepayment_amount ?? '-' }}</span>
          </div>
          <div class="field">
            <label>实际可用</label>
            <span class="value">{{ data?.actual_prepayment_amount ?? '-' }}</span>
          </div>
          <div class="field field-overflow">
            <label>溢出金额</label>
            <span class="value value-emphasis">{{ data?.prepayment_overflow_amount ?? '-' }}</span>
            <small v-if="data?.has_prepayment_overflow" class="field-hint">转入应付</small>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="loading" :disabled="loading || !data" @click="$emit('confirm')">
        确认审核
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Warning, CircleCheck } from '@element-plus/icons-vue'
import type { AuditPreviewResult } from '@/api'

const props = defineProps<{
  modelValue: boolean
  loading: boolean
  data: AuditPreviewResult | null
  orderCount: number
}>()

defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
}>()

const hasAnyOverflow = computed(
  () => !!props.data && (props.data.has_gift_overflow || props.data.has_prepayment_overflow)
)
</script>

<style scoped>
.preview-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  margin-bottom: 16px;
}
.summary-icon { font-size: 18px; }
.summary-icon.is-ok { color: var(--el-color-success); }
.summary-icon.is-warn { color: var(--el-color-warning); }
.summary-text { font-size: 13px; color: var(--el-text-color-regular); }
.summary-text b { color: var(--el-color-primary); }

.preview-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.amount-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 14px;
  background: var(--el-bg-color);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.amount-card.is-overflow {
  border-color: var(--el-color-danger-light-5);
  box-shadow: 0 0 0 1px var(--el-color-danger-light-7) inset;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}
.card-title { font-size: 14px; font-weight: 600; color: var(--el-text-color-primary); }

.card-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.field {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.field label {
  width: 72px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.field .value {
  font-size: 14px;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}
.field-overflow {
  margin-top: 2px;
  padding-top: 10px;
  border-top: 1px solid var(--el-border-color-extra-light);
}
.value-emphasis {
  font-weight: 600;
  font-size: 15px;
}
.amount-card.is-overflow .field-overflow .value-emphasis {
  color: var(--el-color-danger);
}
.field-hint {
  font-size: 11px;
  color: var(--el-color-danger);
}
</style>
