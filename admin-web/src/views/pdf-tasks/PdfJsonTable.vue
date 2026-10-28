<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ data: unknown; label?: string }>()

const isObject = computed(() => props.data !== null && typeof props.data === 'object' && !Array.isArray(props.data))
const isArray = computed(() => Array.isArray(props.data))
const arrayItems = computed<unknown[]>(() => (Array.isArray(props.data) ? props.data : []))
const entries = computed(() => {
  if (!isObject.value) return []
  return Object.entries(props.data as Record<string, unknown>)
})
</script>

<template>
  <div class="pdf-json">
    <div v-if="isArray" class="pdf-json__array">
      <div v-for="(item, index) in arrayItems" :key="index" class="pdf-json__array-item">
        <span class="pdf-json__index">{{ index + 1 }}</span>
        <PdfJsonTable :data="item" />
      </div>
      <p v-if="!arrayItems.length" class="pdf-json__empty">—</p>
    </div>
    <dl v-else-if="isObject" class="pdf-json__object">
      <template v-for="item in entries" :key="item[0]">
        <dt>{{ item[0] }}</dt>
        <dd>
          <PdfJsonTable :data="item[1]" />
        </dd>
      </template>
    </dl>
    <span v-else class="pdf-json__value">{{ data === null || data === '' ? '—' : String(data) }}</span>
  </div>
</template>

<style scoped>
.pdf-json { min-width: 0; color: #33475b; font-size: 12px; line-height: 1.7; }
.pdf-json__array { display: grid; gap: 8px; }
.pdf-json__array-item { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: #f8fafc; }
.pdf-json__index { color: #8795a4; font-family: "Cascadia Mono", monospace; font-size: 10px; }
.pdf-json__object { display: grid; grid-template-columns: minmax(90px, max-content) minmax(0, 1fr); margin: 0; }
.pdf-json__object dt { color: #7b8998; font-size: 11px; font-weight: 700; }
.pdf-json__object dd { margin: 0; color: #33475b; overflow-wrap: anywhere; }
.pdf-json__value { display: block; color: #33475b; overflow-wrap: anywhere; }
.pdf-json__empty { margin: 0; color: #8a98a7; }
</style>
