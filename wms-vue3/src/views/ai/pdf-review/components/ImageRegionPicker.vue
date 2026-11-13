<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
  sources: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['selection-change']);
const image = ref(null);
const viewport = ref(null);
const zoom = ref(1);
const sourceId = ref('');
const sourceUrl = ref('');
const loaded = ref(false);
const loading = ref(false);
const error = ref('');
const box = ref(null);
const source = computed(() => props.sources.find((item) => item.id === sourceId.value));
const selected = computed(() => loaded.value && image.value && box.value
  && (box.value[2] - box.value[0]) * image.value.naturalWidth >= 2
  && (box.value[3] - box.value[1]) * image.value.naturalHeight >= 2);
let request;
let drag;
let fitWidth = 0;

watch(selected, (value) => emit('selection-change', !!value));
watch(() => props.sources, (sources) => {
  if (!sources.some((item) => item.id === sourceId.value)) sourceId.value = sources[0]?.id || '';
}, { immediate: true });

function encode(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('无法生成裁剪图片')), type, quality);
  });
}

async function cropBlob(img, bounds) {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const x = Math.floor(bounds[0] * width);
  const y = Math.floor(bounds[1] * height);
  const w = Math.ceil(bounds[2] * width) - x;
  const h = Math.ceil(bounds[3] * height) - y;
  if (w < 2 || h < 2) throw new Error('选区太小，请重新框选');
  const scale = Math.min(1, 4096 / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器无法裁剪图片');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
  const png = await encode(canvas, 'image/png');
  return png.size <= 10 * 1024 * 1024 ? png : encode(canvas, 'image/jpeg', 0.93);
}

function clearSource() {
  request?.abort();
  drag = null;
  resetZoom();
  loaded.value = false;
  box.value = null;
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value);
  sourceUrl.value = '';
}

async function loadSource(item) {
  clearSource();
  error.value = '';
  loading.value = !!item;
  if (!item) return;
  request = new AbortController();
  const { signal } = request;
  try {
    const response = await fetch(item.url, { signal });
    if (!response.ok) throw new Error();
    const blob = await response.blob();
    if (!blob.size || !/^image\//i.test(blob.type)) throw new Error();
    if (!signal.aborted) sourceUrl.value = URL.createObjectURL(blob);
  } catch {
    if (!signal.aborted) error.value = '整页原图暂时无法读取，请换页或上传图片';
  } finally {
    if (!signal.aborted) loading.value = false;
  }
}

watch(source, loadSource, { immediate: true });
onBeforeUnmount(clearSource);

function resetZoom() {
  zoom.value = 1;
  fitWidth = 0;
  if (image.value) {
    image.value.style.width = '';
    image.value.style.maxWidth = '';
    image.value.style.maxHeight = '';
    image.value.parentElement.style.maxWidth = '';
  }
  if (viewport.value) {
    viewport.value.scrollLeft = 0;
    viewport.value.scrollTop = 0;
  }
}

function onWheel(event) {
  const img = image.value;
  const view = viewport.value;
  if (!loaded.value || !img || !view || !event.deltaY) return;
  event.preventDefault();
  if (props.disabled || drag) return;

  const rect = img.getBoundingClientRect();
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
  const step = 1 + 0.2 * Math.min(1, Math.abs(delta) / 100);
  const next = Math.min(6, Math.max(1, Number((zoom.value * (delta < 0 ? step : 1 / step)).toFixed(2))));
  if (next === zoom.value) return;
  if (next === 1) {
    resetZoom();
    return;
  }

  if (zoom.value === 1) fitWidth = rect.width;
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  zoom.value = next;
  img.parentElement.style.maxWidth = 'none';
  img.style.maxWidth = 'none';
  img.style.maxHeight = 'none';
  img.style.width = fitWidth * next + 'px';
  const scaled = img.getBoundingClientRect();
  view.scrollLeft += scaled.left + x * scaled.width - event.clientX;
  view.scrollTop += scaled.top + y * scaled.height - event.clientY;
}

function point(event) {
  const rect = image.value.getBoundingClientRect();
  const clamp = (n) => Math.max(0, Math.min(1, n));
  return [clamp((event.clientX - rect.left) / rect.width), clamp((event.clientY - rect.top) / rect.height)];
}

function start(event) {
  if (!loaded.value || props.disabled || !event.isPrimary || event.button !== 0) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  drag = { id: event.pointerId, origin: point(event) };
  box.value = [...drag.origin, ...drag.origin];
}

function move(event) {
  if (event.pointerId !== drag?.id) return;
  const [x, y] = point(event);
  const [startX, startY] = drag.origin;
  box.value = [Math.min(x, startX), Math.min(y, startY), Math.max(x, startX), Math.max(y, startY)];
}

function finish(event) {
  if (event.pointerId !== drag?.id) return;
  move(event);
  drag = null;
  if (!selected.value) box.value = null;
}

function cancelDrag() {
  if (!drag) return;
  drag = null;
  box.value = null;
}

const selectionStyle = computed(() => {
  if (!box.value) return {};
  const [x0, y0, x1, y1] = box.value;
  return { left: x0 * 100 + '%', top: y0 * 100 + '%',
    width: (x1 - x0) * 100 + '%', height: (y1 - y0) * 100 + '%' };
});

async function buildFile() {
  if (!selected.value) throw new Error('请先框选要识别的区域');
  const blob = await cropBlob(image.value, box.value);
  return new File([blob], blob.type === 'image/png' ? '识别选区.png' : '识别选区.jpg', { type: blob.type });
}
defineExpose({ buildFile });
</script>

<template>
  <div class="region-picker">
    <label class="source-picker">
      <span>PDF 原页</span>
      <select v-model="sourceId" class="input" :disabled="disabled">
        <option v-for="item in sources" :key="item.id" :value="item.id">{{ item.label }}</option>
      </select>
    </label>
    <p v-if="loading" role="status">正在加载整页原图…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <div v-if="sourceUrl" ref="viewport" class="region-view" @wheel="onWheel">
      <div class="region-stage"
           @pointerdown.prevent="start" @pointermove="move" @pointerup="finish"
           @pointercancel="cancelDrag" @lostpointercapture="cancelDrag">
        <img ref="image" :src="sourceUrl" draggable="false" alt="待框选的 PDF 整页原图"
             @load="loaded = true" @error="error = '整页原图无法显示，请换页'">
        <div v-if="box" class="region-box" :style="selectionStyle" aria-hidden="true"></div>
      </div>
    </div>
    <div v-if="loaded" class="region-tools">
      <span>拖动框选 · 滚轮缩放</span>
      <button v-if="zoom > 1" type="button" class="btn btn-ghost" :disabled="disabled" @click="resetZoom">
        适应窗口（{{ Math.round(zoom * 100) }}%）
      </button>
      <button type="button" class="btn btn-ghost" :disabled="disabled" @click="box = [0, 0, 1, 1]">使用整页</button>
      <button v-if="box" type="button" class="btn btn-ghost" :disabled="disabled" @click="box = null">清除选区</button>
    </div>
  </div>
</template>

<style scoped>
.region-picker {
  --page-fit-height: min(66dvh, 720px);
  --scrollbar-spacing: clamp(16px, 4vw, 48px);
  display: grid;
  gap: 10px;
}
.source-picker { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.source-picker span { flex: none; }
.source-picker select { min-width: 0; flex: 1; }
.region-view {
  display: flex; align-items: flex-start; overflow: auto; overscroll-behavior: contain;
  margin-right: var(--scrollbar-spacing);
  overflow-y: scroll; scrollbar-gutter: stable;
  scrollbar-color: var(--text-tertiary) var(--bg-subtle);
  max-height: calc(var(--page-fit-height) + 2px);
  border: 1px solid var(--border-default); border-radius: var(--radius-md);
  background: var(--bg-subtle);
}
.region-stage {
  position: relative; flex: none; max-width: 100%; margin-inline: auto;
  overflow: hidden; cursor: crosshair; touch-action: none;
}
.region-stage img { display: block; max-width: 100%; max-height: var(--page-fit-height); user-select: none; }
.region-box {
  position: absolute; pointer-events: none;
  border: 2px solid var(--accent-600); box-shadow: 0 0 0 200vmax rgba(0, 0, 0, 0.35);
}
.region-tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-right: var(--scrollbar-spacing); font-size: 12px; color: var(--text-secondary); }
.region-tools span { margin-right: auto; }
.region-picker p { margin: 0; font-size: 13px; color: var(--text-secondary); }
.region-picker p[role="alert"] { color: var(--danger-600); }
</style>
