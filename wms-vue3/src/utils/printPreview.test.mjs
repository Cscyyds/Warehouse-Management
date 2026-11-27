import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { printPreviewImage, previewImageSize, previewIsSample } from './printPreview.ts'

test('preview uses the original backend PNG and never rasterizes a scaled PDF', () => {
  assert.equal(printPreviewImage({ print_data: { raster_png_base64: 'original-pixels' } }), 'data:image/png;base64,original-pixels')
  assert.equal(printPreviewImage({ print_data: { raster_png_base64: 'data:image/png;base64,original-pixels' } }), 'data:image/png;base64,original-pixels')
  assert.equal(printPreviewImage({ print_data: null }), '')
})

test('barcode image dimensions remain intrinsic or grow by an integer multiple', () => {
  assert.deepEqual(previewImageSize(559, 400, 1), { width: '559px', height: '400px' })
  assert.deepEqual(previewImageSize(559, 400, 2), { width: '1118px', height: '800px' })
  for (const zoom of [0.5, 0, -1, 1.5, 5]) assert.deepEqual(previewImageSize(559, 400, zoom), { width: '559px', height: '400px' })
})

test('sample labels are distinguished from real business barcodes', () => {
  for (const code of ['ibc_preview_123', 'mpb_preview_123', 'pb_preview_123', 'preview_123']) assert.equal(previewIsSample(code), true)
  for (const code of ['dsp_1234567890123456789', 'pb_1234567890123456789', undefined]) assert.equal(previewIsSample(code), false)
})

for (const file of ['../components/BarcodePreview.vue', '../components/PrintLabelDialog.vue', '../views/warehouse/WarehousePrintTask.vue']) {
  test(`${file} preview script and template compile`, () => {
    const { descriptor, errors } = parse(readFileSync(new URL(file, import.meta.url), 'utf8'), { filename: file })
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: file })
    const result = compileTemplate({ source: descriptor.template.content, filename: file, id: file,
      compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(result.errors, [])
  })
}

test('all website label previews use the common viewer without thumbnail shrinking', () => {
  const source = readFileSync(new URL('../components/BarcodePreview.vue', import.meta.url), 'utf8')
  assert.match(source, /max-width: none; max-height: none/)
  assert.match(source, /image-rendering: pixelated/)
  assert.match(source, /全屏查看/)
  for (const file of ['../components/PrintLabelDialog.vue', '../views/warehouse/WarehousePrintTask.vue']) {
    const caller = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.match(caller, /<BarcodePreview/)
    assert.match(caller, /printPreviewImage\(result\)/)
    assert.doesNotMatch(caller, /max-height:\s*(240|300)px/)
  }
})
