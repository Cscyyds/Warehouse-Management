<script setup lang="ts">
export interface FlowStep {
  key: string
  label: string
  note: string
  ready?: boolean
}

defineProps<{ steps: FlowStep[]; active?: string }>()
</script>

<template>
  <section class="flow-rail" aria-label="操作流转轨道">
    <div
      v-for="(step, index) in steps"
      :key="step.key"
      class="flow-rail__step"
      :class="{ 'is-active': active === step.key, 'is-ready': step.ready }"
    >
      <div class="flow-rail__index mono-label">{{ String(index + 1).padStart(2, '0') }}</div>
      <div class="flow-rail__copy">
        <strong>{{ step.label }}</strong>
        <span>{{ step.note }}</span>
      </div>
      <div class="flow-rail__signal" aria-hidden="true" />
    </div>
  </section>
</template>
