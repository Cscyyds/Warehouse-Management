<script setup>
// DESIGN_SPEC 6.7 Toast：右下固定、左色条、自动关闭
const props = defineProps({
  message: { type: String, default: '' },
  error: { type: Boolean, default: false }
});
</script>

<template>
  <div v-if="props.message" class="toast"
       :class="{ error: props.error }"
       :role="props.error ? 'alert' : 'status'"
       :aria-live="props.error ? 'assertive' : 'polite'">
    {{ props.message }}
  </div>
</template>
