<script setup>
import { computed } from 'vue';

// DESIGN_SPEC 6.2 步骤条：上传 → 处理 → 审核 → 完成
const props = defineProps({
  phase: { type: String, default: 'upload' },
  // 已进入过审核阶段：其后的 processing 段（批次间工作流续跑、W3 发布
  // 与建表等）仍属审核阶段（W3 = 人工审核与结果发布），步骤条停在
  // ③审核、不回退到②处理
  reviewEntered: { type: Boolean, default: false }
});

const order = ['upload', 'processing', 'review', 'completed'];
const steps = [
  { key: 'upload', label: '上传' },
  { key: 'processing', label: '处理' },
  { key: 'review', label: '审核' },
  { key: 'completed', label: '完成' }
];

const currentIdx = computed(() => {
  let i = order.indexOf(props.phase);
  if (i === -1) i = 0;
  if (props.reviewEntered && props.phase === 'processing') {
    i = order.indexOf('review');
  }
  return i;
});

function stepClass(key) {
  const i = order.indexOf(key);
  if (i < currentIdx.value) return 'done';
  if (i === currentIdx.value) return 'current';
  return '';
}
</script>

<template>
  <nav class="stepper" aria-label="解析流程">
    <template v-for="(step, i) in steps" :key="step.key">
      <div class="stepper-step" :class="stepClass(step.key)"
           :aria-current="stepClass(step.key) === 'current' ? 'step' : undefined">
        <span class="stepper-node" aria-hidden="true">
          {{ stepClass(step.key) === 'done' ? '✓' : i + 1 }}
        </span>
        <span>{{ step.label }}</span>
      </div>
      <div v-if="i < steps.length - 1" class="stepper-line"
           :class="{ done: i < currentIdx }"></div>
    </template>
  </nav>
</template>
