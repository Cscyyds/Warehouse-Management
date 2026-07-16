<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  title: string
  data: Record<string, unknown> | null
  primaryKey?: string
}>()

const primaryValue = computed(() => props.primaryKey && props.data ? String(props.data[props.primaryKey] ?? '') : '')

async function copyPrimary() {
  if (!primaryValue.value) return
  await navigator.clipboard.writeText(primaryValue.value)
  ElMessage.success('业务编码已复制')
}
</script>

<template>
  <aside class="result-receipt" :class="{ 'is-empty': !data }">
    <div class="result-receipt__head">
      <div>
        <span class="mono-label">OPERATION RECEIPT</span>
        <h3>{{ title }}</h3>
      </div>
      <span class="receipt-status">{{ data ? '已回执' : '等待操作' }}</span>
    </div>
    <template v-if="data">
      <button v-if="primaryValue" class="receipt-code" type="button" @click="copyPrimary">
        <span>{{ primaryKey }}</span>
        <strong>{{ primaryValue }}</strong>
        <small>点击复制</small>
      </button>
      <dl class="receipt-grid">
        <template v-for="(value, key) in data" :key="key">
          <template v-if="key !== primaryKey">
            <dt>{{ key }}</dt>
            <dd>{{ value === null || value === '' ? '—' : value }}</dd>
          </template>
        </template>
      </dl>
    </template>
    <div v-else class="receipt-empty">
      完成左侧操作后，服务端返回的真实业务数据会在这里归档。
    </div>
  </aside>
</template>
