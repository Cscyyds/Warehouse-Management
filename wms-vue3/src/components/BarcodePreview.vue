<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { previewImageSize } from '@/utils/printPreview'

const props = defineProps<{ imageSrc?: string; pdfSrc?: string; sample?: boolean }>()
const fullscreen = ref(false)
const zoom = ref(1)
const width = ref(0)
const height = ref(0)
const imageStyle = computed(() => width.value ? previewImageSize(width.value, height.value, zoom.value) : {})
watch(() => [props.imageSrc, props.pdfSrc], () => {
  zoom.value = 1
  width.value = height.value = 0
  fullscreen.value = false
})
function imageLoaded(event: Event) {
  const image = event.target as HTMLImageElement
  width.value = image.naturalWidth
  height.value = image.naturalHeight
}
</script>

<template>
  <section class="barcode-preview">
    <div class="preview-tools">
      <template v-if="imageSrc">
        <el-button size="small" :disabled="zoom <= 1" @click="zoom--">缩小</el-button>
        <span>{{ zoom * 100 }}%</span>
        <el-button size="small" :disabled="zoom >= 4" @click="zoom++">放大</el-button>
      </template>
      <el-button size="small" @click="fullscreen = true">全屏查看</el-button>
    </div>
    <p v-if="sample" class="preview-help">此标签尚未建码，当前为版式样例；请先生成正式条码后再用于业务扫码。</p>
    <p v-else class="preview-help">可直接扫描屏幕中的条码。图片按原始像素显示；显示不全时请全屏查看。</p>
    <div class="preview-viewport">
      <img v-if="imageSrc" :src="imageSrc" :style="imageStyle" alt="打印预览" @load="imageLoaded" />
      <iframe v-else-if="pdfSrc" :src="pdfSrc" title="标签预览" />
    </div>
    <el-dialog v-model="fullscreen" title="标签预览 · 屏幕扫码" fullscreen append-to-body destroy-on-close>
      <div class="preview-tools">
        <template v-if="imageSrc">
          <el-button :disabled="zoom <= 1" @click="zoom--">缩小</el-button>
          <span>{{ zoom * 100 }}%</span>
          <el-button :disabled="zoom >= 4" @click="zoom++">放大</el-button>
        </template>
        <el-button @click="fullscreen = false">关闭全屏</el-button>
      </div>
      <div class="preview-viewport fullscreen-viewport">
        <img v-if="imageSrc" :src="imageSrc" :style="imageStyle" alt="打印预览原图" @load="imageLoaded" />
        <iframe v-else-if="pdfSrc" :src="pdfSrc" title="标签预览原图" />
      </div>
    </el-dialog>
  </section>
</template>

<style scoped>
.barcode-preview { margin-top: 12px; }
.preview-tools { display: flex; align-items: center; justify-content: center; gap: 10px; }
.preview-help { font-size: 12px; color: #606266; text-align: center; }
.preview-viewport { overflow: auto; max-height: 65vh; padding: 16px; border: 1px solid #dcdfe6; background: #fff; }
.preview-viewport img { display: block; width: auto; height: auto; max-width: none; max-height: none; margin: 0 auto; image-rendering: pixelated; }
.preview-viewport iframe { display: block; width: 100%; height: 65vh; min-height: 500px; border: 0; }
.fullscreen-viewport { max-height: calc(100vh - 140px); margin-top: 16px; }
.fullscreen-viewport iframe { height: calc(100vh - 170px); }
</style>
