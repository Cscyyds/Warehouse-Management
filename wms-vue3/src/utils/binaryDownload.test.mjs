import { test } from 'node:test'
import assert from 'node:assert/strict'
import { downloadFileName, validateXlsxDownload } from './binaryDownload.ts'

test('xlsx响应检查MIME及ZIP文件头，并读取UTF8文件名', async () => {
  const blob = new Blob([new Uint8Array([80, 75, 3, 4])], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  assert.equal(await validateXlsxDownload({ blob, contentDisposition: "attachment; filename*=UTF-8''%E4%BA%A7%E5%93%81.xlsx" }, '默认.xlsx'), '产品.xlsx')
})
test('HTTP200 JSON错误和网关HTML均不会保存成xlsx', async () => {
  await assert.rejects(validateXlsxDownload({ blob: new Blob([JSON.stringify({ data: { message: '无权导出' } })], { type: 'application/json' }) }, '默认.xlsx'), /无权导出/)
  await assert.rejects(validateXlsxDownload({ blob: new Blob(['<html>错误</html>'], { type: 'text/html' }) }, '默认.xlsx'), /有效的 Excel/)
})
test('响应头文件名安全处理，无有效文件名时使用中文回退名', () => {
  assert.equal(downloadFileName('attachment; filename="../../产品.xlsx"', '默认.xlsx'), '产品.xlsx')
  assert.equal(downloadFileName("attachment; filename*=UTF-8''%QQ", '默认.xlsx'), '默认.xlsx')
  assert.equal(downloadFileName('', '默认.xlsx'), '默认.xlsx')
})
