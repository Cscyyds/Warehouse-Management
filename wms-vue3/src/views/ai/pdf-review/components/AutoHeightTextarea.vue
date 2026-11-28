<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({ modelValue: { type: String, default: '' } });
const emit = defineEmits(['update:modelValue']);
const value = computed({
  get: () => props.modelValue,
  set: (text) => emit('update:modelValue', text),
});
const textarea = ref(null);
const nativeSizing = CSS.supports('field-sizing', 'content');
let observer;

function fitContent() {
  const el = textarea.value;
  if (nativeSizing || !el?.clientWidth) return;
  const border = el.offsetHeight - el.clientHeight;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + border}px`;
}

watch(() => props.modelValue, fitContent, { flush: 'post' });

onMounted(() => {
  if (nativeSizing) return;
  const el = textarea.value;
  let width = el.clientWidth;
  fitContent();
  observer = new ResizeObserver(() => {
    if (el.clientWidth === width) return;
    width = el.clientWidth;
    fitContent();
  });
  observer.observe(el);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <textarea ref="textarea" v-model="value" class="input auto-height-textarea" rows="2"></textarea>
</template>

<style scoped>
textarea.input.auto-height-textarea {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: auto;
  field-sizing: content;
  min-height: 64px;
  padding: 8px 14px;
  overflow: hidden;
  resize: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
}
</style>
