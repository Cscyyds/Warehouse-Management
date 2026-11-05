import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prepareCloudPrintRequest, newCloudRequestId, CloudPrintSelectionError } from './cloudPrintRequest.ts'

function store() {
  const data = new Map()
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
}
const selection = { cloud_printer_id: 'cpr1', code_style: 'BARCODE', items: [{ biz_type: 'MERGE_PACKAGE', biz_id: 'mpb1', print_qty: 1 }] }
const job = status => ({ job_id: 'job1', status, accepted: 1, total: 1 })

test('new cloud request and unchanged retry have one request id and retain the selected style', async () => {
  const storage = store()
  const noQuery = () => assert.fail('New requests and unchanged retries do not query a different operation')
  const first = await prepareCloudPrintRequest('a', selection, noQuery, storage)
  const retry = await prepareCloudPrintRequest('a', { ...selection, items: [{ print_qty: 1, biz_id: 'mpb1', biz_type: 'MERGE_PACKAGE' }] }, noQuery, storage)
  assert.deepEqual(retry, first)
  assert.equal(first.code_style, 'BARCODE')
})

for (const state of ['SUBMITTED', 'FAILED', 'UNKNOWN', 'SENDING']) {
  test(`${state} blocks a switch to QR instead of silently sending the original barcode`, async () => {
    const storage = store()
    const first = await prepareCloudPrintRequest('a', selection, null, storage)
    await assert.rejects(prepareCloudPrintRequest('a', { ...selection, code_style: 'QRCODE' }, async id => {
      assert.equal(id, first.request_id)
      return job(state)
    }, storage), CloudPrintSelectionError)
    assert.equal(JSON.parse(storage.getItem('a')).code_style, 'BARCODE')
  })
}

test('confirmed completion permits a new QR request using the same business code', async () => {
  const storage = store()
  const barcode = await prepareCloudPrintRequest('a', selection, null, storage)
  const qr = await prepareCloudPrintRequest('a', { ...selection, code_style: 'QRCODE' }, async () => job('PRINTED'), storage)
  assert.notEqual(qr.request_id, barcode.request_id)
  assert.equal(qr.code_style, 'QRCODE')
  assert.deepEqual(qr.items, barcode.items)
})

test('preparation rolled back before generating labels permits correcting device or quantity', async () => {
  const storage = store()
  const first = await prepareCloudPrintRequest('a', selection, null, storage)
  const corrected = await prepareCloudPrintRequest('a', { ...selection, cloud_printer_id: 'cpr2' }, async () => ({ ...job('PREPARE_FAILED'), accepted: 0, total: 0 }), storage)
  assert.notEqual(first.request_id, corrected.request_id)
  assert.equal(corrected.cloud_printer_id, 'cpr2')
})

test('HTTP pages can generate distinct cloud request ids when crypto.randomUUID is unavailable', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined })
    const ids = Array.from({ length: 50 }, () => newCloudRequestId())
    assert.equal(new Set(ids).size, ids.length)
    assert.ok(ids.every(id => id.length <= 100))
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor)
    else delete globalThis.crypto
  }
})

test('broken saved request does not silently create another cloud order', async () => {
  const storage = store()
  storage.setItem('a', '{broken')
  await assert.rejects(prepareCloudPrintRequest('a', selection, null, storage), CloudPrintSelectionError)
  assert.equal(storage.getItem('a'), '{broken')
})

test('older saved task requests keep their request id when task id was originally added at submission', async () => {
  const storage = store()
  storage.setItem('task', JSON.stringify({ request_id: 'old-req', cloud_printer_id: 'cpr1', code_style: 'QRCODE' }))
  const request = await prepareCloudPrintRequest('task', { cloud_printer_id: 'cpr1', code_style: 'QRCODE', print_task_id: 'ptask1' },
    () => assert.fail('The original task still has the same device and style'), storage)
  assert.equal(request.request_id, 'old-req')
  assert.equal(request.print_task_id, 'ptask1')
})
